import type { App } from "obsidian";
import { Notice } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import type { GroupContext } from "views/GroupUtils";
import { resolveCaptureTarget } from "capture/dailyNotePath";
import { captureTask, type CaptureOptions } from "capture/captureTask";

/** Module-level singleton — only one inline capture input at a time. */
let activeCapture: { el: HTMLElement; teardown: () => void } | null = null;

/** Dismiss any active inline capture input. */
export function dismissInlineCapture(): void {
	if (activeCapture !== null) {
		activeCapture.teardown();
		activeCapture = null;
	}
}

/**
 * Render an inline text input below the given anchor element.
 * Enter → creates task with context pre-filled, Escape → dismisses.
 */
export function renderInlineCapture(
	anchor: HTMLElement, app: App, store: DataStore,
	context: GroupContext, onDone: () => void,
): void {
	// Dismiss any existing inline capture first (singleton)
	dismissInlineCapture();

	const wrapper = document.createElement("div");
	wrapper.className = "mlw-inline-capture";
	anchor.insertAdjacentElement("afterend", wrapper);

	const input = document.createElement("input");
	input.type = "text";
	input.className = "mlw-inline-capture__input";
	input.placeholder = "New task…";
	wrapper.appendChild(input);

	const teardown = (): void => {
		wrapper.remove();
		if (activeCapture?.el === wrapper) activeCapture = null;
	};

	activeCapture = { el: wrapper, teardown };

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const text = input.value.trim();
			if (text === "") return;
			input.disabled = true;
			void doCapture(app, store, text, context).then(() => {
				teardown();
				onDone();
			});
		} else if (e.key === "Escape") {
			e.preventDefault();
			teardown();
		}
	});

	input.addEventListener("blur", () => {
		// Small delay so Enter handler fires before blur removes the input
		setTimeout(() => {
			if (activeCapture?.el === wrapper) teardown();
		}, 150);
	});

	requestAnimationFrame(() => input.focus());
}

/**
 * Persistent capture input for the Inbox tab. Returns a reusable element
 * that survives re-renders. Enter → capture, clear, stay focused. Escape → blur.
 */
export function renderInboxCapture(app: App, store: DataStore, onBlur: () => void): HTMLElement {
	const wrapper = document.createElement("div");
	wrapper.className = "mlw-inline-capture mlw-inbox-capture";

	const input = document.createElement("input");
	input.type = "text";
	input.className = "mlw-inline-capture__input";
	input.placeholder = "Add to inbox…";
	wrapper.appendChild(input);

	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter") {
			e.preventDefault();
			const text = input.value.trim();
			if (text === "") return;
			input.disabled = true;
			const ctx: GroupContext = { status: TaskStatus.Inbox };
			void doCapture(app, store, text, ctx).then(() => {
				input.value = "";
				input.disabled = false;
				input.focus();
			});
		} else if (e.key === "Escape") {
			input.blur();
		}
	});
	input.addEventListener("blur", onBlur);
	return wrapper;
}

async function doCapture(
	app: App, store: DataStore, text: string, context: GroupContext,
): Promise<void> {
	try {
		const settings = store.getSettings();
		const targetFile = await resolveCaptureTarget(
			app, settings.captureLocation, settings.inboxFile,
		);
		const options: CaptureOptions = {
			status: context.status,
			area_of_focus: context.aof,
			project: context.project,
			starred: context.starred,
		};
		await captureTask(app, store, text, targetFile, options);
		new Notice(`Captured: ${text}`);
	} catch (e) {
		console.error("MLW: Inline capture failed", e);
		new Notice("Failed to capture task.");
	}
}
