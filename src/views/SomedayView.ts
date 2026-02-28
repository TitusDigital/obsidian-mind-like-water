import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { VIEW_TYPE_MLW_SOMEDAY, SOMEDAY_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

export class SomedayView extends BaseTaskView {
	constructor(leaf: WorkspaceLeaf, store: DataStore) {
		super(leaf, store);
	}

	getViewType(): string { return VIEW_TYPE_MLW_SOMEDAY; }
	getDisplayText(): string { return "Someday / Maybe"; }
	getIcon(): string { return SOMEDAY_ICON; }

	getViewConfig(): ViewConfig {
		return {
			title: "Someday / Maybe",
			emptyText: "No someday/maybe tasks.",
			emptyHint: "Set a task's status to Someday to park it here.",
		};
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const tasks = this.filterByActiveAOF(
			this.store.getTasksByStatus(TaskStatus.Someday),
		);

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
				this.renderTaskRow(task, text, meta);
			}
		}
	}
}
