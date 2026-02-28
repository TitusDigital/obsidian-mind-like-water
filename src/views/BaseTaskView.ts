import { ItemView, type WorkspaceLeaf, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { Task } from "data/models";

const CHECKBOX_PREFIX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;
const MLW_COMMENT_RE = /\s*<!-- mlw:[a-z0-9]{6} -->/;

/** Configuration returned by each concrete view. */
export interface ViewConfig {
	title: string;
	emptyText: string;
	emptyHint: string;
}

/**
 * Abstract base class for all MLW task-list views.
 * Provides shared rendering, navigation, and text-reading utilities.
 */
export abstract class BaseTaskView extends ItemView {
	protected listEl!: HTMLElement;

	constructor(leaf: WorkspaceLeaf, protected readonly store: DataStore) {
		super(leaf);
	}

	/** Subclasses return their view-specific config. */
	abstract getViewConfig(): ViewConfig;

	/** Subclasses populate listEl with their task data. */
	abstract renderContent(): Promise<void>;

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass("mlw-view");

		const header = contentEl.createDiv("mlw-view-header");
		header.createEl("h4", { text: this.getViewConfig().title });

		this.listEl = contentEl.createDiv("mlw-view-list");
		await this.renderContent();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	/** Called by the plugin when tasks change. */
	refresh(): void {
		void this.renderContent();
	}

	// ── Shared rendering helpers ──────────────────────────────────

	/** Render an empty-state message using the view config. */
	protected renderEmpty(): void {
		const cfg = this.getViewConfig();
		const empty = this.listEl.createDiv("mlw-view-empty");
		empty.createEl("p", { text: cfg.emptyText });
		empty.createEl("p", { text: cfg.emptyHint, cls: "mlw-view-empty__hint" });
	}

	/** Render a group header with optional colored dot. */
	protected renderGroupHeader(name: string, dotColor?: string): void {
		const group = this.listEl.createDiv("mlw-view-group");
		if (dotColor !== undefined) {
			const dot = group.createSpan("mlw-view-group__dot");
			dot.style.background = dotColor;
		}
		group.createSpan({ text: name, cls: "mlw-view-group__name" });
	}

	/** Render a clickable task row. metaItems are small text badges. */
	protected renderTaskRow(task: Task, text: string, metaItems?: string[]): void {
		const item = this.listEl.createDiv("mlw-view-item");
		item.createDiv({ text, cls: "mlw-view-item__text" });

		if (metaItems !== undefined && metaItems.length > 0) {
			const metaEl = item.createDiv("mlw-view-item__meta");
			for (const m of metaItems) {
				metaEl.createSpan({ text: m, cls: "mlw-view-item__badge" });
			}
		}

		item.addEventListener("click", () => void this.navigateToTask(task));
	}

	// ── Shared utilities ──────────────────────────────────────────

	/** Read the task text from its source file, stripping checkbox and MLW comment. */
	protected async readTaskText(task: Task): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return this.fallbackText(task);

		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");
		const line = lines[task.source_line - 1];
		if (line === undefined) return this.fallbackText(task);

		const cleaned = line.replace(CHECKBOX_PREFIX_RE, "").replace(MLW_COMMENT_RE, "").trim();
		return cleaned || this.fallbackText(task);
	}

	/** Navigate the editor to the task's source file and line. */
	protected async navigateToTask(task: Task): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return;

		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { eState: { line: task.source_line - 1 } });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	protected fallbackText(task: Task): string {
		return `Task in ${this.shortenPath(task.source_file)}`;
	}

	protected shortenPath(path: string): string {
		const parts = path.split("/");
		return parts[parts.length - 1]?.replace(".md", "") ?? path;
	}

	protected formatDate(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
	}
}
