import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_UNIFIED } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";
import { FilterBar } from "views/FilterBar";
import { ViewState } from "views/ViewState";
import { renderProjects } from "views/ProjectsTab";
import { renderReview } from "views/ReviewTab";
import { type Bucket, bucketByDate, localToday } from "views/DateUtils";
import { buildToolbar } from "views/Toolbar";
import { runIntegrityCheck, type IntegrityReport } from "services/IntegrityChecker";

type TabId = "focus" | "inbox" | "next" | "scheduled" | "someday" | "completed" | "projects" | "review";
const TAB_ORDER: TabId[] = ["focus", "inbox", "next", "scheduled", "someday", "completed", "projects", "review"];

import type { GroupMode } from "views/ViewState";

const TAB_CFG: Record<TabId, { label: string; pill: string; filter: boolean; completed: boolean; group: GroupMode | false; empty: string; hint: string }> = {
	focus: { label: "Focus", pill: "Focus", filter: false, completed: true, group: "none", empty: "Nothing to focus on right now.", hint: "Star tasks or set due dates to see them here." },
	inbox: { label: "Inbox", pill: "Inbox", filter: false, completed: false, group: false, empty: "No unclarified tasks.", hint: "Use Ctrl+Shift+Q to capture a new task." },
	next: { label: "Next", pill: "Next", filter: true, completed: true, group: "aof", empty: "No next actions.", hint: "Clarify tasks from your Inbox to get started." },
	scheduled: { label: "Scheduled", pill: "Sched", filter: true, completed: false, group: false, empty: "No scheduled tasks.", hint: "Set a task's status to Scheduled and assign a start date." },
	someday: { label: "Someday", pill: "Someday", filter: false, completed: false, group: "aof", empty: "No someday/maybe tasks.", hint: "Set a task's status to Someday to park it here." },
	completed: { label: "Completed", pill: "Done", filter: false, completed: false, group: false, empty: "No completed tasks in the last 30 days.", hint: "Complete a task to see it here." },
	projects: { label: "Projects", pill: "Projects", filter: false, completed: false, group: false, empty: "No active projects.", hint: "Create a project from the metadata editor." },
	review: { label: "Review", pill: "Review", filter: false, completed: false, group: false, empty: "Run a review to check on your system.", hint: "Review surfaces items needing attention." },
};

export class UnifiedTaskView extends BaseTaskView {
	private activeTab: TabId = "focus";
	private showCompleted = false;
	private filterBar: FilterBar | null = null;
	private toolbarEl!: HTMLElement;
	private controlsEl!: HTMLElement;
	private tabBtns = new Map<string, HTMLElement>();
	private integrityReport: IntegrityReport | null = null;

	getViewType(): string { return VIEW_TYPE_MLW_UNIFIED; }
	getDisplayText(): string { return "Mind Like Water"; }
	getIcon(): string { return "droplets"; }

	setIntegrityReport(report: IntegrityReport): void { this.integrityReport = report; }

	private refreshIntegrity(): void {
		void runIntegrityCheck(this.app, this.store).then(report => {
			this.integrityReport = report;
			void this.renderContent();
		});
	}

	getViewConfig(): ViewConfig {
		const c = TAB_CFG[this.activeTab];
		return { title: c.label, emptyText: c.empty, emptyHint: c.hint };
	}

	protected override buildLayout(): void {
		const { contentEl } = this;
		this.toolbarEl = contentEl.createDiv("mlw-toolbar");
		this.controlsEl = contentEl.createDiv("mlw-view-controls");
		this.listEl = contentEl.createDiv("mlw-view-list");
		this.rebuildToolbar();
		this.rebuildControls();
		this.unsubscribeViewState = ViewState.getInstance().subscribe(() => {
			this.rebuildToolbar();
			this.rebuildControls();
			this.refresh();
		});
	}

	private rebuildToolbar(): void {
		buildToolbar(this.toolbarEl, {
			activeTab: this.activeTab,
			tabLabels: TAB_ORDER.map(id => [id, TAB_CFG[id].pill] as [string, string]),
			onSwitchTab: (id) => this.switchTab(id),
			store: this.store,
		}, this.tabBtns);
	}

	switchTab(tabId: string): void {
		const id = tabId as TabId;
		if (id === this.activeTab) return;
		this.activeTab = id;
		this.showCompleted = false;
		this.filterBar = null;
		if (TAB_CFG[id].group !== false) ViewState.getInstance().setGroupMode(TAB_CFG[id].group);
		this.rebuildToolbar();
		this.rebuildControls();
		void this.renderContent();
	}

	private rebuildControls(): void {
		this.controlsEl.empty();
		if (TAB_CFG[this.activeTab].filter) {
			this.filterBar = new FilterBar(this.controlsEl, () => void this.renderContent());
		}
	}

	override refresh(): void { this.rebuildToolbar(); super.refresh(); }

	private getRecentCompleted(): Task[] {
		const days = this.store.getSettings().completedVisibilityDays;
		const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
		return this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Completed))
			.filter(t => t.completed_date !== null && t.completed_date >= cutoff)
			.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));
	}

	private completedToggle(count: number): { count: number; active: boolean; onToggle: () => void } {
		return { count, active: this.showCompleted, onToggle: () => { this.showCompleted = !this.showCompleted; void this.renderContent(); } };
	}

	async renderContent(): Promise<void> {
		const gen = ++this.renderGen;
		this.listEl.empty();
		switch (this.activeTab) {
			case "focus": await this.renderFocus(gen); break;
			case "inbox": await this.renderInbox(gen); break;
			case "next": await this.renderNextActions(gen); break;
			case "scheduled": await this.renderScheduled(gen); break;
			case "someday": await this.renderSomeday(gen); break;
			case "completed": await this.renderCompleted(gen); break;
			case "projects": renderProjects(this.listEl, this.store, this.app); break;
			case "review": renderReview(this.listEl, this.store, this.app, this.integrityReport, (id) => this.switchTab(id), () => this.refreshIntegrity()); break;
		}
	}

	private async renderFocus(gen: number): Promise<void> {
		const tasks = this.filterByActiveAOF(this.getFocusTasks());
		const recent = this.getRecentCompleted();
		const completed = this.showCompleted ? recent : [];
		if (tasks.length === 0 && completed.length === 0) { this.renderEmpty(); return; }
		this.renderContentHeader("Focus", tasks.length, this.completedToggle(recent.length), true);
		const focusSort = (a: Task, b: Task): number => {
			if (a.starred !== b.starred) return a.starred ? -1 : 1;
			return (a.due_date ?? "\uffff").localeCompare(b.due_date ?? "\uffff") || a.sort_order - b.sort_order;
		};
		const allTasks = [...tasks, ...completed];
		for (const { name, color, tasks: gt } of this.groupTasks(allTasks, ViewState.getInstance().getGroupMode())) {
			const active = gt.filter(t => t.status !== TaskStatus.Completed && t.status !== TaskStatus.Dropped);
			const done = gt.filter(t => t.status === TaskStatus.Completed || t.status === TaskStatus.Dropped);
			if (name !== "") this.renderGroupHeader(name, color, active.length + done.length);
			active.sort(focusSort);
			for (const task of active) {
				if (this.isStaleRender(gen)) return;
				const text = await this.readTaskText(task);
				this.renderTaskRow(task, text, this.buildFocusBadges(task));
			}
			for (const task of done) {
				if (this.isStaleRender(gen)) return;
				const text = await this.readTaskText(task);
				this.renderCompletedRow(task, text, task.completed_date !== null ? [this.formatDate(task.completed_date)] : []);
			}
		}
	}

	private async renderInbox(gen: number): Promise<void> {
		const tasks = this.store.getTasksByStatus(TaskStatus.Inbox)
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
		if (tasks.length === 0) { this.renderEmpty(); return; }
		this.renderContentHeader("Inbox", tasks.length);
		for (const task of tasks) {
			if (this.isStaleRender(gen)) return;
			const text = await this.readTaskText(task);
			this.renderTaskRow(task, text, [this.shortenPath(task.source_file), this.formatDate(task.created)]);
		}
	}

	private async renderNextActions(gen: number): Promise<void> {
		let tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.NextAction));
		if (this.filterBar !== null) { this.filterBar.rebuild(tasks); tasks = this.filterBar.applyFilters(tasks); }
		const recent = this.getRecentCompleted();
		const completed = this.showCompleted ? recent : [];
		if (tasks.length === 0 && completed.length === 0) { this.renderEmpty(); return; }
		this.renderContentHeader("Next", tasks.length, this.completedToggle(recent.length), true);
		const today = localToday();
		const allTasks = [...tasks, ...completed];
		for (const { name, color, tasks: gt } of this.groupTasks(allTasks, ViewState.getInstance().getGroupMode())) {
			const active = gt.filter(t => t.status !== TaskStatus.Completed && t.status !== TaskStatus.Dropped);
			const done = gt.filter(t => t.status === TaskStatus.Completed || t.status === TaskStatus.Dropped);
			if (name !== "") this.renderGroupHeader(name, color, active.length + done.length);
			for (const task of active) {
				if (this.isStaleRender(gen)) return;
				const text = await this.readTaskText(task);
				const meta: string[] = [];
				if (task.due_date !== null && task.due_date <= today) meta.push(task.due_date < today ? "\uD83D\uDCC5 Overdue" : "\uD83D\uDCC5 Due today");
				if (task.project !== null) meta.push(task.project);
				if (task.context !== null) meta.push(`@${task.context}`);
				if (task.starred) meta.push("\u2B50");
				this.renderTaskRow(task, text, meta);
			}
			for (const task of done) {
				if (this.isStaleRender(gen)) return;
				const text = await this.readTaskText(task);
				this.renderCompletedRow(task, text, task.completed_date !== null ? [this.formatDate(task.completed_date)] : []);
			}
		}
	}

	private async renderScheduled(gen: number): Promise<void> {
		let tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Scheduled));
		if (this.filterBar !== null) { this.filterBar.rebuild(tasks); tasks = this.filterBar.applyFilters(tasks); }
		if (tasks.length === 0) { this.renderEmpty(); return; }
		this.renderContentHeader("Scheduled", tasks.length);
		const buckets = bucketByDate(tasks);
		for (const label of ["Overdue", "Today", "This Week", "Next Week", "This Month", "Later", "No Date"] as Bucket[]) {
			const items = buckets.get(label);
			if (items === undefined || items.length === 0) continue;
			this.renderGroupHeader(label, undefined, items.length);
			for (const task of items) {
				if (this.isStaleRender(gen)) return;
				const text = await this.readTaskText(task);
				const meta: string[] = [];
				if (task.start_date !== null) meta.push(this.formatDate(task.start_date));
				if (task.area_of_focus) meta.push(task.area_of_focus);
				this.renderTaskRow(task, text, meta);
			}
		}
	}

	private async renderSomeday(gen: number): Promise<void> {
		const tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Someday));
		if (tasks.length === 0) { this.renderEmpty(); return; }
		this.renderContentHeader("Someday", tasks.length, undefined, true);
		for (const { name, color, tasks: gt } of this.groupTasks(tasks, ViewState.getInstance().getGroupMode())) {
			if (name !== "") this.renderGroupHeader(name, color, gt.length);
			for (const task of gt) {
				if (this.isStaleRender(gen)) return;
				const text = await this.readTaskText(task);
				this.renderTaskRow(task, text, task.project !== null ? [task.project] : []);
			}
		}
	}

	private async renderCompleted(gen: number): Promise<void> {
		const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
		const tasks = this.filterByActiveAOF(this.store.getTasksByStatus(TaskStatus.Completed))
			.filter(t => t.completed_date !== null && t.completed_date >= cutoff)
			.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));
		if (tasks.length === 0) { this.renderEmpty(); return; }
		this.renderContentHeader("Completed", tasks.length);
		const dayCounts = new Map<string, number>();
		for (const t of tasks) { const d = t.completed_date?.slice(0, 10) ?? ""; dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1); }
		let currentDay = "";
		for (const task of tasks) {
			if (this.isStaleRender(gen)) return;
			const day = task.completed_date?.slice(0, 10) ?? "";
			if (day !== currentDay) { currentDay = day; this.renderGroupHeader(this.formatDate(day), undefined, dayCounts.get(day)); }
			const text = await this.readTaskText(task);
			this.renderCompletedRow(task, text, task.area_of_focus ? [task.area_of_focus] : []);
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
