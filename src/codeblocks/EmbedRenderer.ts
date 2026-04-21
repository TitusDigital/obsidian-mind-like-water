import { MarkdownRenderChild, TFile } from "obsidian";
import type { App } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { Task } from "data/models";
import { MetadataEditor } from "components/MetadataEditor";
import { MLW_COMMENT_STRIP_RE as MLW_COMMENT_RE } from "data/idPattern";

const CHECKBOX_PREFIX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;

/** A task plus its display badges for embedding. */
export interface EmbedItem {
	task: Task;
	badges: string[];
}

/**
 * MarkdownRenderChild that renders a live, interactive task list
 * inside a codeblock. Re-renders automatically when DataStore changes.
 */
export class EmbedRenderer extends MarkdownRenderChild {
	private unsubscribe: (() => void) | null = null;

	constructor(
		containerEl: HTMLElement,
		private readonly app: App,
		private readonly store: DataStore,
		private readonly getItems: () => EmbedItem[],
		private readonly emptyText: string,
	) {
		super(containerEl);
	}

	/** Perform initial render and subscribe to DataStore changes. */
	start(): void {
		this.render();
		this.unsubscribe = this.store.onChange(() => this.render());
	}

	onunload(): void {
		this.unsubscribe?.();
		this.unsubscribe = null;
	}

	private render(): void {
		const el = this.containerEl;
		el.empty();
		el.addClass("mlw-embed");

		const items = this.getItems();
		if (items.length === 0) {
			el.createDiv({ text: this.emptyText, cls: "mlw-embed__empty" });
			return;
		}

		const list = el.createDiv("mlw-embed__list");
		for (const item of items) {
			void this.renderItem(list, item);
		}
	}

	private async renderItem(listEl: HTMLElement, { task, badges }: EmbedItem): Promise<void> {
		const text = await this.readTaskText(task);
		const row = listEl.createDiv("mlw-view-item");

		// Star toggle
		const star = row.createDiv({
			cls: `mlw-view-item__star${task.starred ? " mlw-view-item__star--active" : ""}`,
		});
		star.textContent = task.starred ? "\u2605" : "\u2606";
		star.addEventListener("click", (e) => {
			e.stopPropagation();
			this.store.updateTask(task.id, { starred: !task.starred });
		});

		// Complete checkbox
		const check = row.createDiv("mlw-view-item__check");
		check.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.completeTask(task);
		});

		row.createDiv({ text, cls: "mlw-view-item__text" });

		if (badges.length > 0) {
			const metaEl = row.createDiv("mlw-view-item__meta");
			for (const b of badges) {
				metaEl.createSpan({ text: b, cls: "mlw-view-item__badge" });
			}
		}

		row.addEventListener("click", (e) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();
				MetadataEditor.open(task, text, row.getBoundingClientRect(), this.store);
			} else {
				void this.navigateToTask(task);
			}
		});
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

	private async completeTask(task: Task): Promise<void> {
		this.store.completeTask(task.id);
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return;
		const content = await this.app.vault.read(file);
		const lines = content.split("\n");
		const line = lines[task.source_line - 1];
		if (line === undefined) return;
		lines[task.source_line - 1] = line.replace(/^(\s*[-*]\s+)\[ \]/, "$1[x]");
		await this.app.vault.modify(file, lines.join("\n"));
	}

	private async navigateToTask(task: Task): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return;
		const leaf = this.app.workspace.getLeaf(false);
		await leaf.openFile(file, { eState: { line: task.source_line - 1 } });
		this.app.workspace.setActiveLeaf(leaf, { focus: true });
	}

	private fallbackText(task: Task): string {
		const name = task.source_file.split("/").pop()?.replace(".md", "");
		return `Task in ${name ?? task.source_file}`;
	}
}
