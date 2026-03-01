import { ItemView, type WorkspaceLeaf, TFile, Notice } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { Task } from "data/models";
import { ViewState, type GroupMode } from "views/ViewState";

const CHECKBOX_PREFIX_RE = /^\s*[-*]\s+\[[ xX]\]\s*/;
const MLW_COMMENT_RE = /\s*<!-- mlw:[a-z0-9]{6} -->/;
const GROUP_LABELS: [GroupMode, string][] = [["aof", "Area"], ["project", "Project"], ["context", "Context"], ["none", "Flat"]];

function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

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
	protected unsubscribeViewState: (() => void) | null = null;

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
		this.buildLayout();
		await this.renderContent();
	}

	protected buildLayout(): void {
		const { contentEl } = this;
		this.listEl = contentEl.createDiv("mlw-view-list");
	}

	async onClose(): Promise<void> {
		this.unsubscribeViewState?.();
		this.unsubscribeViewState = null;
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

	/** Render a group header with optional colored dot, divider line, and count. */
	protected renderGroupHeader(name: string, dotColor?: string, count?: number): void {
		const group = this.listEl.createDiv("mlw-view-group");
		if (dotColor !== undefined) {
			const dot = group.createSpan("mlw-view-group__dot");
			dot.style.background = dotColor;
		}
		group.createSpan({ text: name, cls: "mlw-view-group__name" });
		group.createDiv("mlw-view-group__line");
		if (count !== undefined) group.createSpan({ text: String(count), cls: "mlw-view-group__count" });
	}

	/** Render a content header with tab title, task count, optional completed toggle, and optional group-by selector. */
	protected renderContentHeader(
		title: string, count: number,
		completed?: { count: number; active: boolean; onToggle: () => void },
		showGroupBy?: boolean,
	): void {
		const header = this.listEl.createDiv("mlw-content-header");
		header.createEl("span", { text: title, cls: "mlw-content-header__title" });
		header.createEl("span", { text: `${count} task${count !== 1 ? "s" : ""}`, cls: "mlw-content-header__count" });
		if (completed !== undefined && completed.count > 0) {
			const cls = `mlw-content-header__completed${completed.active ? " mlw-content-header__completed--active" : ""}`;
			const btn = header.createEl("span", { text: `· ${completed.count} completed`, cls });
			btn.addEventListener("click", completed.onToggle);
		}
		if (showGroupBy === true) {
			const groupEl = header.createDiv("mlw-content-header__group");
			groupEl.createSpan({ text: "group:", cls: "mlw-content-header__group-label" });
			const mode = ViewState.getInstance().getGroupMode();
			for (const [m, label] of GROUP_LABELS) {
				const active = mode === m;
				const cls = `mlw-content-header__group-opt${active ? " mlw-content-header__group-opt--active" : ""}`;
				const opt = groupEl.createEl("span", { text: label, cls });
				opt.addEventListener("click", () => ViewState.getInstance().setGroupMode(m));
			}
		}
	}

	/** Render a clickable task row with complete checkbox and star toggle. */
	protected renderTaskRow(task: Task, text: string, metaItems?: string[]): void {
		const dueForced = task.due_date !== null && task.due_date <= localToday();
		const showStarred = task.starred || dueForced;
		const cls = showStarred ? "mlw-view-item mlw-view-item--starred" : "mlw-view-item";
		const item = this.listEl.createDiv(cls);

		// Star toggle (subtle)
		const star = item.createDiv({ cls: `mlw-view-item__star${showStarred ? " mlw-view-item__star--active" : ""}` });
		star.textContent = showStarred ? "\u2605" : "\u2606";
		star.addEventListener("click", (e) => {
			e.stopPropagation();
			if (dueForced && !task.starred) { new Notice("This task is starred because it's due today or overdue."); return; }
			if (dueForced && task.starred) { new Notice("Can't un-star — this task is due today or overdue."); return; }
			this.store.updateTask(task.id, { starred: !task.starred });
		});

		// Complete checkbox (circle, accent-styled when starred)
		const checkCls = showStarred ? "mlw-view-item__check mlw-view-item__check--starred" : "mlw-view-item__check";
		const check = item.createDiv(checkCls);
		check.addEventListener("click", (e) => { e.stopPropagation(); void this.completeTaskFromView(task); });

		item.createDiv({ text, cls: "mlw-view-item__text" });

		if (metaItems !== undefined && metaItems.length > 0) {
			const metaEl = item.createDiv("mlw-view-item__meta");
			for (const m of metaItems) metaEl.createSpan({ text: m, cls: "mlw-view-item__badge" });
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
		const idx = this.findTaskLine(lines, task);
		const line = lines[idx];
		if (line === undefined) return;
		lines[idx] = line.replace(/^(\s*[-*]\s+)\[ \]/, "$1[x]");
		await this.app.vault.modify(file, lines.join("\n"));
	}

	// ── AOF filtering & grouping ─────────────────────────────────

	/** Filter tasks by the global AOF selection. Returns all tasks when "All". */
	protected filterByActiveAOF(tasks: Task[]): Task[] {
		const aof = ViewState.getInstance().getActiveAOF();
		if (aof === "") return tasks;
		return tasks.filter(t => t.area_of_focus === aof);
	}

	/** Group tasks by a string key. Returns sorted groups with fallback label for empty keys. */
	private groupTasksBy(tasks: Task[], getKey: (t: Task) => string, fallback: string): { name: string; tasks: Task[] }[] {
		const grouped = new Map<string, Task[]>();
		for (const task of tasks) {
			const key = getKey(task) || "";
			const existing = grouped.get(key);
			if (existing !== undefined) existing.push(task);
			else grouped.set(key, [task]);
		}
		const result: { name: string; tasks: Task[] }[] = [];
		const noKey = grouped.get("");
		grouped.delete("");
		for (const [key, gt] of [...grouped].sort((a, b) => a[0].localeCompare(b[0]))) {
			gt.sort((a, b) => a.sort_order - b.sort_order);
			result.push({ name: key, tasks: gt });
		}
		if (noKey !== undefined) {
			noKey.sort((a, b) => a.sort_order - b.sort_order);
			result.push({ name: fallback, tasks: noKey });
		}
		return result;
	}

	/** Group tasks by AOF, respecting settings display order and colors. */
	protected groupByAOF(tasks: Task[]): { name: string; color?: string; tasks: Task[] }[] {
		const aofOrder = this.store.getSettings().areasOfFocus;
		const colorMap = new Map(aofOrder.map(a => [a.name, a.color.text]));
		const orderMap = new Map(aofOrder.map((a, i) => [a.name, i]));
		const groups = this.groupTasksBy(tasks, t => t.area_of_focus || "", "Uncategorized");
		groups.sort((a, b) => (orderMap.get(a.name) ?? 999) - (orderMap.get(b.name) ?? 999));
		return groups.map(g => ({ ...g, color: colorMap.get(g.name) ?? "#A0A0A0" }));
	}

	/** Dispatch to the appropriate grouping function based on mode. */
	protected groupTasks(tasks: Task[], mode: GroupMode): { name: string; color?: string; tasks: Task[] }[] {
		switch (mode) {
			case "aof": return this.groupByAOF(tasks);
			case "project": return this.groupTasksBy(tasks, t => t.project ?? "", "No Project");
			case "context": return this.groupTasksBy(tasks, t => t.context ?? "", "No Context");
			case "none": return [{ name: "", tasks: [...tasks].sort((a, b) => a.sort_order - b.sort_order) }];
		}
	}

	// ── Shared utilities ──────────────────────────────────────────

	/** Find the actual line index (0-based) for a task by locating its mlw comment.
	 *  Falls back to the stored source_line if the comment isn't found. Updates
	 *  the DataStore when drift is detected. */
	private findTaskLine(lines: string[], task: Task): number {
		const storedIdx = task.source_line - 1;
		const marker = `<!-- mlw:${task.id} -->`;

		// Fast path: stored line is still correct
		if (storedIdx >= 0 && storedIdx < lines.length && lines[storedIdx]!.includes(marker)) {
			return storedIdx;
		}

		// Scan for the marker
		for (let i = 0; i < lines.length; i++) {
			if (lines[i]!.includes(marker)) {
				this.store.updateTask(task.id, { source_line: i + 1 });
				return i;
			}
		}
		return storedIdx;
	}

	/** Read the task text from its source file, stripping checkbox and MLW comment. */
	protected async readTaskText(task: Task): Promise<string> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) return this.fallbackText(task);

		const content = await this.app.vault.cachedRead(file);
		const lines = content.split("\n");
		const idx = this.findTaskLine(lines, task);
		const line = lines[idx];
		if (line === undefined) return this.fallbackText(task);

		const cleaned = line.replace(CHECKBOX_PREFIX_RE, "").replace(MLW_COMMENT_RE, "").trim();
		return cleaned || this.fallbackText(task);
	}

	/** Navigate the editor to the task's source file and line. */
	protected async navigateToTask(task: Task): Promise<void> {
		const file = this.app.vault.getAbstractFileByPath(task.source_file);
		if (!(file instanceof TFile)) {
			new Notice("Source file no longer exists for this task.");
			return;
		}

		const content = await this.app.vault.cachedRead(file);
		const idx = this.findTaskLine(content.split("\n"), task);

		const leaf = this.app.workspace.getMostRecentLeaf() ?? this.app.workspace.getLeaf("tab");
		await leaf.openFile(file, { eState: { line: idx } });
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
