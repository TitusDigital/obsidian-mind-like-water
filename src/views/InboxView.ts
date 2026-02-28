import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { VIEW_TYPE_MLW_INBOX, INBOX_ICON } from "views/InboxViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

export class InboxView extends BaseTaskView {
	constructor(leaf: WorkspaceLeaf, store: DataStore) {
		super(leaf, store);
	}

	getViewType(): string { return VIEW_TYPE_MLW_INBOX; }
	getDisplayText(): string { return "Inbox"; }
	getIcon(): string { return INBOX_ICON; }

	getViewConfig(): ViewConfig {
		return {
			title: "Inbox",
			emptyText: "No unclarified tasks.",
			emptyHint: "Use Ctrl+Shift+Q to capture a new task.",
		};
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const tasks = this.store.getTasksByStatus(TaskStatus.Inbox)
			.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());

		if (tasks.length === 0) {
			this.renderEmpty();
			return;
		}

		for (const task of tasks) {
			const text = await this.readTaskText(task);
			this.renderTaskRow(task, text, [
				this.shortenPath(task.source_file),
				this.formatDate(task.created),
			]);
		}
	}
}
