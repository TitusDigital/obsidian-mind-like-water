import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_NEXT_ACTIONS, NEXT_ACTIONS_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

export class NextActionsView extends BaseTaskView {
	private showCompleted = false;

	constructor(leaf: WorkspaceLeaf, store: DataStore) {
		super(leaf, store);
	}

	getViewType(): string { return VIEW_TYPE_MLW_NEXT_ACTIONS; }
	getDisplayText(): string { return "Next Actions"; }
	getIcon(): string { return NEXT_ACTIONS_ICON; }

	getViewConfig(): ViewConfig {
		return {
			title: "Next Actions",
			emptyText: "No next actions.",
			emptyHint: "Clarify tasks from your Inbox to get started.",
		};
	}

	async onOpen(): Promise<void> {
		await super.onOpen();
		// Add toggle button to the header
		const header = this.contentEl.querySelector(".mlw-view-header");
		if (header !== null) {
			const toggle = header.createEl("button", { cls: "mlw-view-header__toggle", attr: { "aria-label": "Show completed" } });
			toggle.textContent = this.showCompleted ? "Hide completed" : "Show completed";
			toggle.addEventListener("click", () => {
				this.showCompleted = !this.showCompleted;
				toggle.textContent = this.showCompleted ? "Hide completed" : "Show completed";
				toggle.toggleClass("mlw-view-header__toggle--active", this.showCompleted);
				void this.renderContent();
			});
		}
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const tasks = this.store.getTasksByStatus(TaskStatus.NextAction);

		if (tasks.length === 0 && !this.showCompleted) {
			this.renderEmpty();
			return;
		}

		const groups = this.groupByAOF(tasks);
		for (const { name, color, tasks: groupTasks } of groups) {
			this.renderGroupHeader(name, color);
			for (const task of groupTasks) {
				const text = await this.readTaskText(task);
				const meta: string[] = [];
				if (task.project !== null) meta.push(task.project);
				if (task.context !== null) meta.push(`@${task.context}`);
				if (task.starred) meta.push("\u2B50");
				this.renderTaskRow(task, text, meta);
			}
		}

		if (this.showCompleted) {
			await this.renderRecentlyCompleted();
		}
	}

	private async renderRecentlyCompleted(): Promise<void> {
		const days = this.store.getSettings().completedVisibilityDays;
		const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
		const completed = this.store.getTasksByStatus(TaskStatus.Completed)
			.filter(t => t.completed_date !== null && t.completed_date >= cutoff)
			.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));

		if (completed.length === 0) return;

		this.renderGroupHeader("Recently Completed");
		for (const task of completed) {
			const text = await this.readTaskText(task);
			const item = this.listEl.createDiv("mlw-view-item mlw-view-item--completed");
			item.createDiv({ text, cls: "mlw-view-item__text" });
			if (task.completed_date !== null) {
				const metaEl = item.createDiv("mlw-view-item__meta");
				metaEl.createSpan({ text: this.formatDate(task.completed_date), cls: "mlw-view-item__badge" });
			}
			item.addEventListener("click", () => void this.navigateToTask(task));
		}
	}

	private groupByAOF(tasks: Task[]): { name: string; color: string; tasks: Task[] }[] {
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

		// Named AOFs in settings order
		for (const aof of aofOrder) {
			const groupTasks = grouped.get(aof.name);
			if (groupTasks !== undefined) {
				groupTasks.sort((a, b) => a.sort_order - b.sort_order);
				result.push({ name: aof.name, color: aof.color.text, tasks: groupTasks });
				grouped.delete(aof.name);
			}
		}

		// Remaining (unassigned or unknown AOFs)
		for (const [key, groupTasks] of grouped) {
			groupTasks.sort((a, b) => a.sort_order - b.sort_order);
			result.push({ name: key || "Uncategorized", color: "#A0A0A0", tasks: groupTasks });
		}

		return result;
	}
}
