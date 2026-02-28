import { ItemView, type WorkspaceLeaf, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_INBOX, INBOX_ICON } from "views/InboxViewConstants";

const CHECKBOX_PREFIX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;
const MLW_COMMENT_RE = /\s*<!-- mlw:[a-z0-9]{6} -->/;

export class InboxView extends ItemView {
	private listEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, private readonly store: DataStore) {
		super(leaf);
	}

	getViewType(): string { return VIEW_TYPE_MLW_INBOX; }
	getDisplayText(): string { return "Inbox"; }
	getIcon(): string { return INBOX_ICON; }

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("mlw-inbox-view");

		const header = contentEl.createDiv("mlw-inbox-header");
		header.createEl("h4", { text: "Inbox" });

		this.listEl = contentEl.createDiv("mlw-inbox-list");
		await this.renderTasks();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	/** Called by the plugin when tasks change. */
	refresh(): void {
		void this.renderTasks();
	}

	private async renderTasks(): Promise<void> {
		this.listEl.empty();
		const tasks = this.store.getTasksByStatus(TaskStatus.Inbox)
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		if (tasks.length === 0) {
			const empty = this.listEl.createDiv("mlw-inbox-empty");
			empty.createEl("p", { text: "No unclarified tasks." });
			empty.createEl("p", {
				text: "Use Cmd+Shift+I to capture a new task.",
				cls: "mlw-inbox-empty__hint",
			});
			return;
		}

		for (const task of tasks) {
			const text = await this.readTaskText(task);
			this.renderTaskItem(task, text);
		}
	}

	private renderTaskItem(task: Task, text: string): void {
		const item = this.listEl.createDiv("mlw-inbox-item");

		const textEl = item.createDiv("mlw-inbox-item__text");
		textEl.textContent = text;

		const metaEl = item.createDiv("mlw-inbox-item__meta");
		metaEl.createSpan({ text: this.shortenPath(task.source_file), cls: "mlw-inbox-item__source" });
		metaEl.createSpan({ text: this.formatDate(task.created), cls: "mlw-inbox-item__date" });

		item.addEventListener("click", () => void this.navigateToTask(task));
	}

	private async navigateToTask(task: Task): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return;

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { eState: { line: task.source_line - 1 } });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private async readTaskText(task: Task): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return this.fallbackText(task);

		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");
		const line = lines[task.source_line - 1];
		if (line === undefined) return this.fallbackText(task);

		const cleaned = line.replace(CHECKBOX_PREFIX_RE, "").replace(MLW_COMMENT_RE, "").trim();
		return cleaned || this.fallbackText(task);
	}

	private fallbackText(task: Task): string {
		return `Task in ${this.shortenPath(task.source_file)}`;
	}

	private shortenPath(path: string): string {
		const parts = path.split("/");
		return parts[parts.length - 1]?.replace(".md", "") ?? path;
	}

	private formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}
}
