import type { App } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";

const MLW_ID_RE = /<!-- mlw:([a-z0-9]{6}) -->/g;

/** Result of cross-referencing DataStore tasks with vault mlw comments. */
export interface IntegrityReport {
	/** Tasks in DataStore whose mlw comment was not found in any vault file. */
	orphanedTasks: Task[];
	/** mlw IDs found in vault files that have no matching DataStore entry. */
	staleCommentIds: string[];
	/** Tasks auto-removed because they exceeded the orphan grace period. */
	autoCleanedCount: number;
}

/** Scan vault and cross-reference with DataStore. Composes scan + report. */
export async function runIntegrityCheck(
	app: App, store: DataStore,
): Promise<IntegrityReport> {
	const vaultIds = await scanVaultForMLWIds(app);
	return buildIntegrityReport(vaultIds, store);
}

/** Scan all markdown files for `<!-- mlw:XXXX -->` patterns. */
async function scanVaultForMLWIds(app: App): Promise<Set<string>> {
	const ids = new Set<string>();
	for (const file of app.vault.getMarkdownFiles()) {
		const content = await app.vault.cachedRead(file);
		const re = new RegExp(MLW_ID_RE.source, "g");
		let match: RegExpExecArray | null;
		while ((match = re.exec(content)) !== null) {
			const id = match[1];
			if (id !== undefined) ids.add(id);
		}
	}
	return ids;
}

/** Cross-reference vault IDs with DataStore. Pure logic, unit-testable. */
export function buildIntegrityReport(
	vaultIds: Set<string>, store: DataStore,
): IntegrityReport {
	const settings = store.getSettings();
	const gracePeriodMs = settings.orphanGracePeriodDays * 24 * 60 * 60 * 1000;
	const now = Date.now();

	const orphanedTasks: Task[] = [];
	let autoCleanedCount = 0;

	for (const task of store.getAllTasks()) {
		if (task.status === TaskStatus.Completed || task.status === TaskStatus.Dropped) continue;
		if (!vaultIds.has(task.id)) {
			const age = now - new Date(task.modified).getTime();
			if (age > gracePeriodMs) {
				store.deleteTask(task.id);
				autoCleanedCount++;
			} else {
				orphanedTasks.push(task);
			}
		}
	}

	const staleCommentIds: string[] = [];
	for (const id of vaultIds) {
		if (store.getTask(id) === undefined) {
			staleCommentIds.push(id);
		}
	}

	return { orphanedTasks, staleCommentIds, autoCleanedCount };
}
