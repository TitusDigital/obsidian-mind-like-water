import { type App, Modal, Notice } from "obsidian";
import type { DataStore } from "data/DataStore";
import { resolveCaptureTarget } from "capture/dailyNotePath";
import { captureTask } from "capture/captureTask";

/** Quick-capture modal: type a task and press Enter to capture it. */
export class QuickCaptureModal extends Modal {
	private input!: HTMLInputElement;

	constructor(
		app: App,
		private readonly store: DataStore,
		private readonly onCapture?: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("Quick Capture");
		const { contentEl } = this;
		contentEl.addClass("mlw-capture-modal");

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
		await captureTask(this.app, this.store, text, targetFile);

		new Notice(`Captured: ${text}`);
		this.onCapture?.();
		this.close();
	}
}
