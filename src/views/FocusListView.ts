import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_FOCUS, FOCUS_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

export class FocusListView extends BaseTaskView {
	constructor(leaf: WorkspaceLeaf, store: DataStore) {
		super(leaf, store);
	}

	getViewType(): string { return VIEW_TYPE_MLW_FOCUS; }
	getDisplayText(): string { return "Focus List"; }
	getIcon(): string { return FOCUS_ICON; }

	getViewConfig(): ViewConfig {
		return {
			title: "Focus List",
			emptyText: "Nothing to focus on right now.",
			emptyHint: "Star tasks or set due dates to see them here.",
		};
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const tasks = this.filterByActiveAOF(this.getFocusTasks());

		if (tasks.length === 0) {
			this.renderEmpty();
			return;
		}

		// Sort: starred first, then by due date ascending, then sort_order
		tasks.sort((a, b) => {
			if (a.starred !== b.starred) return a.starred ? -1 : 1;
			const da = a.due_date ?? "\uffff";
			const db = b.due_date ?? "\uffff";
			if (da !== db) return da.localeCompare(db);
			return a.sort_order - b.sort_order;
		});

		for (const task of tasks) {
			const text = await this.readTaskText(task);
			const meta = this.buildFocusBadges(task);
			this.renderTaskRow(task, text, meta);
		}
	}

	private getFocusTasks(): Task[] {
		const today = new Date().toISOString().slice(0, 10);
		return this.store.getAllTasks().filter(t => {
			if (t.status === TaskStatus.Completed || t.status === TaskStatus.Dropped) return false;
			if (t.starred) return true;
			if (t.due_date !== null && t.due_date <= today) return true;
			if (t.start_date !== null && t.start_date === today && t.status === TaskStatus.NextAction) return true;
			return false;
		});
	}

	private buildFocusBadges(task: Task): string[] {
		const today = new Date().toISOString().slice(0, 10);
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
