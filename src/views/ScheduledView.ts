import type { WorkspaceLeaf } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { VIEW_TYPE_MLW_SCHEDULED, SCHEDULED_ICON } from "views/ViewConstants";
import { BaseTaskView, type ViewConfig } from "views/BaseTaskView";

/** Date bucket labels for the Scheduled view. */
type Bucket = "Overdue" | "Today" | "This Week" | "Next Week" | "This Month" | "Later" | "No Date";

export class ScheduledView extends BaseTaskView {
	constructor(leaf: WorkspaceLeaf, store: DataStore) {
		super(leaf, store);
	}

	getViewType(): string { return VIEW_TYPE_MLW_SCHEDULED; }
	getDisplayText(): string { return "Scheduled"; }
	getIcon(): string { return SCHEDULED_ICON; }

	getViewConfig(): ViewConfig {
		return {
			title: "Scheduled",
			emptyText: "No scheduled tasks.",
			emptyHint: "Set a task's status to Scheduled and assign a start date.",
		};
	}

	async renderContent(): Promise<void> {
		this.listEl.empty();
		const tasks = this.filterByActiveAOF(
			this.store.getTasksByStatus(TaskStatus.Scheduled),
		);

		if (tasks.length === 0) {
			this.renderEmpty();
			return;
		}

		const buckets = this.bucketByDate(tasks);
		const order: Bucket[] = ["Overdue", "Today", "This Week", "Next Week", "This Month", "Later", "No Date"];

		for (const label of order) {
			const items = buckets.get(label);
			if (items === undefined || items.length === 0) continue;

			this.renderGroupHeader(label);
			for (const task of items) {
				const text = await this.readTaskText(task);
				const meta: string[] = [];
				if (task.start_date !== null) meta.push(this.formatDate(task.start_date));
				const color = this.store.getAOFColor(task.area_of_focus);
				if (task.area_of_focus) meta.push(task.area_of_focus);
				void color; // color used in future AOF dot; for now show name as badge
				this.renderTaskRow(task, text, meta);
			}
		}
	}

	private bucketByDate(tasks: Task[]): Map<Bucket, Task[]> {
		const now = new Date();
		const today = this.stripTime(now);
		const endOfWeek = this.addDays(today, 7 - today.getDay());
		const endOfNextWeek = this.addDays(endOfWeek, 7);
		const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);

		const result = new Map<Bucket, Task[]>();

		const sorted = [...tasks].sort((a, b) => {
			if (a.start_date === null && b.start_date === null) return 0;
			if (a.start_date === null) return 1;
			if (b.start_date === null) return -1;
			return a.start_date.localeCompare(b.start_date);
		});

		for (const task of sorted) {
			const bucket = this.getBucket(task.start_date, today, endOfWeek, endOfNextWeek, endOfMonth);
			const list = result.get(bucket);
			if (list !== undefined) {
				list.push(task);
			} else {
				result.set(bucket, [task]);
			}
		}

		return result;
	}

	private getBucket(
		startDate: string | null, today: Date, endOfWeek: Date, endOfNextWeek: Date, endOfMonth: Date,
	): Bucket {
		if (startDate === null) return "No Date";
		const d = this.stripTime(new Date(startDate));
		if (d < today) return "Overdue";
		if (d.getTime() === today.getTime()) return "Today";
		if (d < endOfWeek) return "This Week";
		if (d < endOfNextWeek) return "Next Week";
		if (d < endOfMonth) return "This Month";
		return "Later";
	}

	private stripTime(d: Date): Date {
		return new Date(d.getFullYear(), d.getMonth(), d.getDate());
	}

	private addDays(d: Date, n: number): Date {
		const r = new Date(d);
		r.setDate(r.getDate() + n);
		return r;
	}
}
