import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_UNIFIED } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";
import { FilterBar } from "views/FilterBar";
import { ViewState } from "views/ViewState";
import { renderProjects } from "views/ProjectsTab";
import { renderReview } from "views/ReviewTab";
import { type Bucket, bucketByDate } from "views/DateUtils";
import type { IntegrityReport } from "services/IntegrityChecker";

function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TabId = "focus" | "inbox" | "next" | "scheduled" | "someday" | "completed" | "projects" | "review";
const TAB_ORDER: TabId[] = ["focus", "inbox", "next", "scheduled", "someday", "completed", "projects", "review"];

const TAB_CFG: Record<TabId, { label: string; aof: boolean; filter: boolean; toggle: boolean; empty: string; hint: string }> = {
	focus: { label: "Focus", aof: true, filter: false, toggle: true, empty: "Nothing to focus on right now.", hint: "Star tasks or set due dates to see them here." },
	inbox: { label: "Inbox", aof: false, filter: false, toggle: false, empty: "No unclarified tasks.", hint: "Use Ctrl+Shift+Q to capture a new task." },
	next: { label: "Next", aof: true, filter: true, toggle: true, empty: "No next actions.", hint: "Clarify tasks from your Inbox to get started." },
	scheduled: { label: "Scheduled", aof: true, filter: true, toggle: false, empty: "No scheduled tasks.", hint: "Set a task's status to Scheduled and assign a start date." },
	someday: { label: "Someday", aof: true, filter: false, toggle: false, empty: "No someday/maybe tasks.", hint: "Set a task's status to Someday to park it here." },
	completed: { label: "Completed", aof: true, filter: false, toggle: false, empty: "No completed tasks in the last 30 days.", hint: "Complete a task to see it here." },
	projects: { label: "Projects", aof: true, filter: false, toggle: false, empty: "No active projects.", hint: "Create a project from the metadata editor." },
	review: { label: "Review", aof: false, filter: false, toggle: false, empty: "Run a review to check on your system.", hint: "Review surfaces items needing attention." },
};

export class UnifiedTaskView extends BaseTaskView {
	private activeTab: TabId = "focus";
	private showCompleted = false;
	private filterBar: FilterBar | null = null;
	private controlsEl!: HTMLElement;
	private tabBtns = new Map<TabId, HTMLElement>();
	private integrityReport: IntegrityReport | null = null;

	getViewType(): string { return VIEW_TYPE_MLW_UNIFIED; }
	getDisplayText(): string { return "Mind Like Water"; }
	getIcon(): string { return "droplets"; }

	setIntegrityReport(report: IntegrityReport): void { this.integrityReport = report; }

	getViewConfig(): ViewConfig {
		const c = TAB_CFG[this.activeTab];
		return { title: c.label, emptyText: c.empty, emptyHint: c.hint, showAOFSelector: c.aof };
	}

	protected override buildLayout(): void {
		const { contentEl } = this;
		const tabBar = contentEl.createDiv("mlw-tab-bar");
		for (const id of TAB_ORDER) {
			const btn = tabBar.createEl("button", {
				text: TAB_CFG[id].label,
				cls: `mlw-tab-btn${id === this.activeTab ? " mlw-tab-btn--active" : ""}`,
			});
			btn.addEventListener("click", () => this.switchTab(id));
			this.tabBtns.set(id, btn);
		}
		this.controlsEl = contentEl.createDiv("mlw-view-controls");
		this.listEl = contentEl.createDiv("mlw-view-list");
		this.rebuildControls();
		this.unsubscribeViewState = ViewState.getInstance().subscribe(() => {
			this.rebuildControls();
			this.refresh();
		});
	}

	switchTab(tabId: string): void {
		const id = tabId as TabId;
		if (id === this.activeTab) return;
		this.tabBtns.get(this.activeTab)?.removeClass("mlw-tab-btn--active");
		this.activeTab = id;
		this.tabBtns.get(id)?.addClass("mlw-tab-btn--active");
		this.showCompleted = false;
		this.filterBar = null;
		this.rebuildControls();
		void this.renderContent();
	}

	private rebuildControls(): void {
		this.controlsEl.empty();
		const c = TAB_CFG[this.activeTab];
		if (c.aof) {
			const sel = this.controlsEl.createEl("select", { cls: "mlw-aof-selector" });
			sel.createEl("option", { text: "All", value: "" }).value = "";
			for (const aof of this.store.getSettings().areasOfFocus) {
				sel.createEl("option", { text: aof.name, value: aof.name }).value = aof.name;
			}
			sel.value = ViewState.getInstance().getActiveAOF();
			sel.addEventListener("change", () => ViewState.getInstance().setActiveAOF(sel.value));
		}
		if (c.toggle) {
			const btn = this.controlsEl.createEl("button", {
				cls: "mlw-view-header__toggle", attr: { "aria-label": "Show completed" },
			});
			btn.textContent = this.showCompleted ? "Hide completed" : "Show completed";
			btn.toggleClass("mlw-view-header__toggle--active", this.showCompleted);
			btn.addEventListener("click", () => {
				this.showCompleted = !this.showCompleted;
				btn.textContent = this.showCompleted ? "Hide completed" : "Show completed";
				btn.toggleClass("mlw-view-header__toggle--active", this.showCompleted);
				void this.renderContent();
			});
		}
		if (c.filter) {
			this.filterBar = new FilterBar(this.controlsEl, this.store, () => void this.renderContent());
		}
	}

	override refresh(): void { this.filterBar?.rebuild(); super.refresh(); }

	async renderContent(): Promise<void> {
		this.listEl.empty();
		switch (this.activeTab) {
			case "focus": await this.renderFocus(); break;
			case "inbox": await this.renderInbox(); break;
			case "next": await this.renderNextActions(); break;
			case "scheduled": await this.renderScheduled(); break;
			case "someday": await this.renderSomeday(); break;
			case "completed": await this.renderCompleted(); break;
			case "projects": renderProjects(this.listEl, this.store, this.app); break;
			case "review": renderReview(this.listEl, this.store, this.app, this.integrityReport, (id) => this.switchTab(id)); break;
		}
	}

	private async renderFocus(): Promise<void> {
		const tasks = this.filterByActiveAOF(this.getFocusTasks());
		if (tasks.length === 0 && !this.showCompleted) { this.renderEmpty(); return; }
		tasks.sort((a, b) => {
			if (a.starred !== b.starred) return a.starred ? -1 : 1;
			const da = a.due_date ?? "\uffff"; const db = b.due_date ?? "\uffff";
			if (da !== db) return da.localeCompare(db);
			return a.sort_order - b.sort_order;
		});
		for (const task of tasks) {
			const text = await this.readTaskText(task);
			this.renderTaskRow(task, text, this.buildFocusBadges(task));
		}
		if (this.showCompleted) await this.renderRecentlyCompleted();
	}

	private async renderInbox(): Promise<void> {
		const tasks = this.store.getTasksByStatus(TaskStatus.Inbox)
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		if (tasks.length === 0) { this.renderEmpty(); return; }
		for (const task of tasks) {
			const text = await this.readTaskText(task);
			this.renderTaskRow(task, text, [this.shortenPath(task.source_file), this.formatDate(task.created)]);
		}
	}

	private async renderNextActions(): Promise<void> {
		let tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.NextAction));
		if (this.filterBar !== null) tasks = this.filterBar.applyFilters(tasks);
		if (tasks.length === 0 && !this.showCompleted) { this.renderEmpty(); return; }
		for (const { name, color, tasks: gt } of this.groupByAOF(tasks)) {
			this.renderGroupHeader(name, color);
			for (const task of gt) {
				const text = await this.readTaskText(task);
				const meta: string[] = [];
				if (task.project !== null) meta.push(task.project);
				if (task.context !== null) meta.push(`@${task.context}`);
				if (task.starred) meta.push("\u2B50");
				this.renderTaskRow(task, text, meta);
			}
		}
		if (this.showCompleted) await this.renderRecentlyCompleted();
	}

	private async renderScheduled(): Promise<void> {
		let tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Scheduled));
		if (this.filterBar !== null) tasks = this.filterBar.applyFilters(tasks);
		if (tasks.length === 0) { this.renderEmpty(); return; }
		const buckets = bucketByDate(tasks);
		for (const label of ["Overdue", "Today", "This Week", "Next Week", "This Month", "Later", "No Date"] as Bucket[]) {
			const items = buckets.get(label);
			if (items === undefined || items.length === 0) continue;
			this.renderGroupHeader(label);
			for (const task of items) {
				const text = await this.readTaskText(task);
				const meta: string[] = [];
				if (task.start_date !== null) meta.push(this.formatDate(task.start_date));
				if (task.area_of_focus) meta.push(task.area_of_focus);
				this.renderTaskRow(task, text, meta);
			}
		}
	}

	private async renderSomeday(): Promise<void> {
		const tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Someday));
		if (tasks.length === 0) { this.renderEmpty(); return; }
		for (const { name, color, tasks: gt } of this.groupByAOF(tasks)) {
			this.renderGroupHeader(name, color);
			for (const task of gt) {
				const text = await this.readTaskText(task);
				this.renderTaskRow(task, text, task.project !== null ? [task.project] : []);
			}
		}
	}

	private async renderCompleted(): Promise<void> {
		const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		const tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Completed))
			.filter(t => t.completed_date !== null && t.completed_date >= cutoff)
			.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));
		if (tasks.length === 0) { this.renderEmpty(); return; }
		let currentDay = "";
		for (const task of tasks) {
			const day = task.completed_date?.slice(0, 10) ?? "";
			if (day !== currentDay) { currentDay = day; this.renderGroupHeader(this.formatDate(day)); }
			const text = await this.readTaskText(task);
			this.renderCompletedRow(task, text, task.area_of_focus ? [task.area_of_focus] : []);
		}
	}

	private async renderRecentlyCompleted(): Promise<void> {
		const days = this.store.getSettings().completedVisibilityDays;
		const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
		const completed = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Completed))
			.filter(t => t.completed_date !== null && t.completed_date >= cutoff)
			.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));
		if (completed.length === 0) return;
		this.renderGroupHeader("Recently Completed");
		for (const task of completed) {
			const text = await this.readTaskText(task);
			this.renderCompletedRow(task, text, task.completed_date !== null ? [this.formatDate(task.completed_date)] : []);
		}
	}

	private renderCompletedRow(task: Task, text: string, meta: string[]): void {
		const item = this.listEl.createDiv("mlw-view-item mlw-view-item--completed");
		item.createDiv({ text, cls: "mlw-view-item__text" });
		if (meta.length > 0) {
			const metaEl = item.createDiv("mlw-view-item__meta");
			for (const m of meta) metaEl.createSpan({ text: m, cls: "mlw-view-item__badge" });
		}
		item.addEventListener("click", () => void this.navigateToTask(task));
	}

	private getFocusTasks(): Task[] {
		const today = localToday();
		return this.store.getAllTasks().filter(t => {
			if (t.status === TaskStatus.Completed || t.status === TaskStatus.Dropped) return false;
			if (t.starred) return true;
			if (t.due_date !== null && t.due_date <= today) return true;
			if (t.start_date !== null && t.start_date === today && t.status === TaskStatus.NextAction) return true;
			return false;
		});
	}

	private buildFocusBadges(task: Task): string[] {
		const today = localToday();
		const badges: string[] = [];
		if (task.starred) badges.push("\u2B50 Starred");
		if (task.due_date !== null && task.due_date <= today) {
			badges.push(task.due_date < today ? "\uD83D\uDCC5 Overdue" : "\uD83D\uDCC5 Due today");
		}
		if (task.start_date !== null && task.start_date === today && task.status === TaskStatus.NextAction) {
			badges.push("\uD83D\uDDD3\uFE0F Start today");
		}
		if (task.area_of_focus) badges.push(task.area_of_focus);
		return badges;
	}

}
