import { ItemView, type WorkspaceLeaf, TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { Task } from "data/models";
import { ViewState } from "views/ViewState";

const CHECKBOX_PREFIX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;
const MLW_COMMENT_RE = /\s*<!-- mlw:[a-z0-9]{6} -->/;

/** Configuration returned by each concrete view. */
export interface ViewConfig {
	title: string;
	emptyText: string;
	emptyHint: string;
	/** Set to false for views that should never filter by AOF (e.g. Inbox). */
	showAOFSelector?: boolean;
}

/**
 * Abstract base class for all MLW task-list views.
 * Provides shared rendering, navigation, and text-reading utilities.
 */
export abstract class BaseTaskView extends ItemView {
	protected listEl!: HTMLElement;
	private unsubscribeViewState: (() => void) | null = null;
	private aofSelectEl: HTMLSelectElement | null = null;

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

		const cfg = this.getViewConfig();
		const header = contentEl.createDiv("mlw-view-header");
		header.createEl("h4", { text: cfg.title });

		if (cfg.showAOFSelector !== false) {
			this.aofSelectEl = header.createEl("select", { cls: "mlw-aof-selector" });
			this.populateAOFSelector();
			this.aofSelectEl.addEventListener("change", () => {
				ViewState.getInstance().setActiveAOF(this.aofSelectEl?.value ?? "");
			});
			this.unsubscribeViewState = ViewState.getInstance().subscribe(() => {
				this.syncAOFSelector();
				this.refresh();
			});
		}

		this.listEl = contentEl.createDiv("mlw-view-list");
		await this.renderContent();
	}

	async onClose(): Promise<void> {
		this.unsubscribeViewState?.();
		this.unsubscribeViewState = null;
		this.contentEl.empty();
	}

	private populateAOFSelector(): void {
		if (this.aofSelectEl === null) return;
		this.aofSelectEl.empty();
		const allOpt = this.aofSelectEl.createEl("option", { text: "All", value: "" });
		allOpt.value = "";
		for (const aof of this.store.getSettings().areasOfFocus) {
			const opt = this.aofSelectEl.createEl("option", { text: aof.name, value: aof.name });
			opt.value = aof.name;
		}
		this.aofSelectEl.value = ViewState.getInstance().getActiveAOF();
	}

	private syncAOFSelector(): void {
		if (this.aofSelectEl !== null) {
			this.aofSelectEl.value = ViewState.getInstance().getActiveAOF();
		}
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

	/** Render a clickable task row with complete checkbox and star toggle. */
	protected renderTaskRow(task: Task, text: string, metaItems?: string[]): void {
		const item = this.listEl.createDiv("mlw-view-item");

		// Star toggle
		const star = item.createDiv({
			cls: `mlw-view-item__star${task.starred ? " mlw-view-item__star--active" : ""}`,
		});
		star.textContent = task.starred ? "\u2605" : "\u2606";
		star.addEventListener("click", (e) => {
			e.stopPropagation();
			this.store.updateTask(task.id, { starred: !task.starred });
		});

		// Complete checkbox (circle that checks off the task)
		const check = item.createDiv("mlw-view-item__check");
		check.addEventListener("click", (e) => {
			e.stopPropagation();
			void this.completeTaskFromView(task);
		});

		item.createDiv({ text, cls: "mlw-view-item__text" });

		if (metaItems !== undefined && metaItems.length > 0) {
			const metaEl = item.createDiv("mlw-view-item__meta");
			for (const m of metaItems) {
				metaEl.createSpan({ text: m, cls: "mlw-view-item__badge" });
			}
		}

		item.addEventListener("click", () => void this.navigateToTask(task));
	}

	/** Complete a task from the view: update DataStore + check the source file checkbox. */
	protected async completeTaskFromView(task: Task): Promise<void> {
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

	// ── AOF filtering & grouping ─────────────────────────────────

	/** Filter tasks by the global AOF selection. Returns all tasks when "All". */
	protected filterByActiveAOF(tasks: Task[]): Task[] {
		const aof = ViewState.getInstance().getActiveAOF();
		if (aof === "") return tasks;
		return tasks.filter(t => t.area_of_focus === aof);
	}

	/** Group tasks by Area of Focus, respecting settings display order. */
	protected groupByAOF(tasks: Task[]): { name: string; color: string; tasks: Task[] }[] {
		const aofOrder = this.store.getSettings().areasOfFocus;
		const grouped = new Map<string, Task[]>();

		for (const task of tasks) {
			const key = task.area_of_focus || "";
			const existing = grouped.get(key);
			if (existing !== undefined) {
				existing.push(task);
			} else {
				grouped.set(key, [task]);
			}
		}

		const result: { name: string; color: string; tasks: Task[] }[] = [];
		for (const aof of aofOrder) {
			const groupTasks = grouped.get(aof.name);
			if (groupTasks !== undefined) {
				groupTasks.sort((a, b) => a.sort_order - b.sort_order);
				result.push({ name: aof.name, color: aof.color.text, tasks: groupTasks });
				grouped.delete(aof.name);
			}
		}
		for (const [key, groupTasks] of grouped) {
			groupTasks.sort((a, b) => a.sort_order - b.sort_order);
			result.push({ name: key || "Uncategorized", color: "#A0A0A0", tasks: groupTasks });
		}
		return result;
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
