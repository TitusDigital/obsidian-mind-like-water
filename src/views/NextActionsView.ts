import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_NEXT_ACTIONS, NEXT_ACTIONS_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

export class NextActionsView extends BaseTaskView {
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

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const tasks = this.store.getTasksByStatus(TaskStatus.NextAction);

		if (tasks.length === 0) {
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
