import { type App, Modal, Notice } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { TaskStatus } from "data/models";
import { resolveCaptureTarget } from "capture/dailyNotePath";
import { captureTask, type CaptureOptions } from "capture/captureTask";

/** Pre-filled defaults shown as read-only badges in the modal. */
export interface CaptureDefaults {
	status?: TaskStatus;
	aof?: string;
	project?: string;
	starred?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
	inbox: "Inbox", next_action: "Next Action", scheduled: "Scheduled",
	someday: "Someday", completed: "Completed", dropped: "Dropped",
};

/** Quick-capture modal: type a task and press Enter to capture it. */
export class QuickCaptureModal extends Modal {
	private input!: HTMLInputElement;

	constructor(
		app: App,
		private readonly store: DataStore,
		private readonly onCapture?: () => void,
		private readonly defaults?: CaptureDefaults,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Quick Capture");
		const { contentEl } = this;
		contentEl.addClass("mlw-capture-modal");

		if (this.defaults !== undefined) {
			const bar = contentEl.createDiv("mlw-capture-defaults");
			if (this.defaults.status !== undefined) bar.createSpan({ text: STATUS_LABELS[this.defaults.status] ?? this.defaults.status, cls: "mlw-capture-defaults__badge" });
			if (this.defaults.starred === true) bar.createSpan({ text: "\u2605 Starred", cls: "mlw-capture-defaults__badge" });
			if (this.defaults.aof !== undefined) bar.createSpan({ text: this.defaults.aof, cls: "mlw-capture-defaults__badge" });
			if (this.defaults.project !== undefined) bar.createSpan({ text: this.defaults.project, cls: "mlw-capture-defaults__badge" });
		}

		this.input = contentEl.createEl("input", {
			type: "text",
			placeholder: "What\u2019s on your mind?",
			cls: "mlw-capture-input",
		});
		this.input.addEventListener("keydown", (e) => {
			if (e.key === "Enter") {
				e.preventDefault();
				void this.doCapture();
			}
		});
		requestAnimationFrame(() => this.input.focus());
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private async doCapture(): Promise<void> {
		const text = this.input.value.trim();
		if (text === "") return;

		this.input.disabled = true;
		const settings = this.store.getSettings();
		const targetFile = await resolveCaptureTarget(
			this.app, settings.captureLocation, settings.inboxFile,
		);

		const options: CaptureOptions | undefined = this.defaults !== undefined ? {
			status: this.defaults.status,
			area_of_focus: this.defaults.aof,
			project: this.defaults.project,
			starred: this.defaults.starred,
		} : undefined;

		await captureTask(this.app, this.store, text, targetFile, options);

		new Notice(`Captured: ${text}`);
		this.onCapture?.();
		this.close();
	}
}
