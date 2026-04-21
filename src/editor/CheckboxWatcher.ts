import type { Plugin, TAbstractFile } from "obsidian";
import { TFile } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";

const MLW_LINE_RE = /^- \[([xX ])\] (.+?)(?:\s*<!-- mlw:([a-z0-9]{6}) -->)/;
const DEBOUNCE_MS = 300;

/**
 * Watches for checkbox state changes in vault files.
 * When a user checks a tracked task's checkbox, the task is completed.
 * When unchecked, a completed task reverts to NextAction.
 */
export function registerCheckboxWatcher(plugin: Plugin, store: DataStore): void {
	let debounceTimer: ReturnType<typeof setTimeout> | null = null;

	plugin.registerEvent(
		plugin.app.vault.on("modify", (file: TAbstractFile) => {
			if (!(file instanceof TFile) || file.extension !== "md") return;

			if (debounceTimer !== null) clearTimeout(debounceTimer);
			debounceTimer = setTimeout(() => {
				debounceTimer = null;
				void processFile(file, store, plugin);
			}, DEBOUNCE_MS);
		}),
	);
}

async function processFile(file: TFile, store: DataStore, plugin: Plugin): Promise<void> {
	const content = await plugin.app.vault.cachedRead(file);
	const lines = content.split("\n");

	for (let i = 0; i < lines.length; i++) {
		const match = MLW_LINE_RE.exec(lines[i]!);
		if (match === null) continue;

		const checked = match[1] !== " ";
		const text = match[2]?.trim() ?? null;
		const id = match[3];
		if (id === undefined) continue;

		const task = store.getTask(id);
		if (task === undefined) continue;

		// Repair stale source_file or drifted source_line
		const lineNum = i + 1;
		if (task.source_file !== file.path || task.source_line !== lineNum) {
			store.updateTask(id, { source_file: file.path, source_line: lineNum });
		}
		if (text !== null && text !== task.cached_text) {
			store.updateTask(id, { cached_text: text });
		}
		if (checked && task.status !== TaskStatus.Done && task.status !== TaskStatus.Dropped) {
			store.completeTask(id);
		} else if (!checked && task.status === TaskStatus.Done) {
			store.updateTask(id, { status: TaskStatus.Active, completed_date: null });
		}
	}
}
