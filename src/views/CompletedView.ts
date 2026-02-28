import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { VIEW_TYPE_MLW_COMPLETED, COMPLETED_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class CompletedView extends BaseTaskView {
	constructor(leaf: WorkspaceLeaf, store: DataStore) {
		super(leaf, store);
	}

	getViewType(): string { return VIEW_TYPE_MLW_COMPLETED; }
	getDisplayText(): string { return "Completed"; }
	getIcon(): string { return COMPLETED_ICON; }

	getViewConfig(): ViewConfig {
		return {
			title: "Completed",
			emptyText: "No completed tasks in the last 30 days.",
			emptyHint: "Complete a task to see it here.",
		};
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const cutoff = new Date(Date.now() - THIRTY_DAYS_MS).toISOString();

		const tasks = this.filterByActiveAOF(
			this.store.getTasksByStatus(TaskStatus.Completed),
		).filter(t => t.completed_date !== null && t.completed_date >= cutoff)
			.sort((a, b) => (b.completed_date ?? "").localeCompare(a.completed_date ?? ""));

		if (tasks.length === 0) {
			this.renderEmpty();
			return;
		}

		// Group by completed date (day)
		let currentDay = "";
		for (const task of tasks) {
			const day = task.completed_date?.slice(0, 10) ?? "";
			if (day !== currentDay) {
				currentDay = day;
				this.renderGroupHeader(this.formatDate(day));
			}
			const text = await this.readTaskText(task);
			const meta: string[] = [];
			if (task.area_of_focus) meta.push(task.area_of_focus);

			const item = this.listEl.createDiv("mlw-view-item mlw-view-item--completed");
			item.createDiv({ text, cls: "mlw-view-item__text" });
			if (meta.length > 0) {
				const metaEl = item.createDiv("mlw-view-item__meta");
				for (const m of meta) {
					metaEl.createSpan({ text: m, cls: "mlw-view-item__badge" });
				}
			}
			item.addEventListener("click", () => void this.navigateToTask(task));
		}
	}
}
