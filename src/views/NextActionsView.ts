import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { VIEW_TYPE_MLW_NEXT_ACTIONS, NEXT_ACTIONS_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";
import { FilterBar } from "views/FilterBar";

export class NextActionsView extends BaseTaskView {
	private showCompleted = false;
	private filterBar: FilterBar | null = null;

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
		// Insert filter bar between header and list
		this.filterBar = new FilterBar(this.contentEl, this.store, () => void this.renderContent());
		this.contentEl.insertBefore(this.filterBar.getContainer(), this.listEl);
	}

	/** Called by BaseTaskView when AOF changes. */
	override refresh(): void {
		this.filterBar?.rebuild();
		super.refresh();
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		let tasks = this.filterByActiveAOF(
			this.store.getTasksByStatus(TaskStatus.NextAction),
		);
		if (this.filterBar !== null) tasks = this.filterBar.applyFilters(tasks);

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
		const completed = this.filterByActiveAOF(
			this.store.getTasksByStatus(TaskStatus.Completed),
		).filter(t => t.completed_date !== null && t.completed_date >= cutoff)
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
}
