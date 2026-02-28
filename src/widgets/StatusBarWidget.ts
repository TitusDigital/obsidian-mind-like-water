import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";

/** Status bar element showing inbox count and starred count. */
export class StatusBarWidget {
	constructor(
		private readonly el: HTMLElement,
		private readonly store: DataStore,
	) {
		this.el.addClass("mlw-status-bar");
		this.update();
	}

	update(): void {
		const inbox = this.store.getTaskCountByStatus(TaskStatus.Inbox);
		const starred = this.store.getStarredCount();
		this.el.textContent = `\u{1F4E5} ${inbox} \u00B7 \u2B50 ${starred}`;
	}
}
