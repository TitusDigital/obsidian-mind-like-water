import type { App } from "obsidian";
import type { DataStore } from "data/DataStore";
import { TaskStatus, type Task } from "data/models";
import { mlwCommentGlobalRe } from "data/idPattern";

/** Result of cross-referencing DataStore tasks with vault mlw comments. */
export interface IntegrityReport {
	/** Tasks in DataStore whose mlw comment was not found in any vault file. */
	orphanedTasks: Task[];
	/** mlw IDs found in vault files that have no matching DataStore entry. */
	staleCommentIds: string[];
	/** Tasks auto-removed because they exceeded the orphan grace period. */
	autoCleanedCount: number;
}

/** Location of a task's mlw comment in the vault. */
interface TaskLocation { file: string; line: number; }

/** Scan vault and cross-reference with DataStore. Composes scan + report. */
export async function runIntegrityCheck(
	app: App, store: DataStore,
): Promise<IntegrityReport> {
	const vaultLocations = await scanVaultForMLWIds(app);
	return buildIntegrityReport(vaultLocations, store);
}

/** Scan all markdown files for `<!-- mlw:XXXX -->` patterns. Returns ID → location map. */
async function scanVaultForMLWIds(app: App): Promise<Map<string, TaskLocation>> {
	const locations = new Map<string, TaskLocation>();
	for (const file of app.vault.getMarkdownFiles()) {
		const content = await app.vault.cachedRead(file);
		const lines = content.split("\n");
		for (let i = 0; i < lines.length; i++) {
			const re = mlwCommentGlobalRe();
			let match: RegExpExecArray | null;
			while ((match = re.exec(lines[i]!)) !== null) {
				const id = match[1];
				if (id !== undefined) locations.set(id, { file: file.path, line: i + 1 });
			}
		}
	}
	return locations;
}

/** Cross-reference vault IDs with DataStore. Repairs stale paths and detects orphans. */
export function buildIntegrityReport(
	vaultLocations: Map<string, TaskLocation>, store: DataStore,
): IntegrityReport {
	const settings = store.getSettings();
	const gracePeriodMs = settings.orphanGracePeriodDays * 24 * 60 * 60 * 1000;
	const now = Date.now();

	const orphanedTasks: Task[] = [];
	let autoCleanedCount = 0;

	for (const task of store.getAllTasks()) {
		const loc = vaultLocations.get(task.id);
		if (loc !== undefined) {
			// Repair stale source_file or drifted source_line
			if (task.source_file !== loc.file || task.source_line !== loc.line) {
				store.updateTask(task.id, { source_file: loc.file, source_line: loc.line });
			}
			continue;
		}
		if (task.status === TaskStatus.Done || task.status === TaskStatus.Dropped) continue;
		const age = now - new Date(task.modified).getTime();
		if (age > gracePeriodMs) {
			store.deleteTask(task.id);
			autoCleanedCount++;
		} else {
			orphanedTasks.push(task);
		}
	}

	const staleCommentIds: string[] = [];
	for (const id of vaultLocations.keys()) {
		if (store.getTask(id) === undefined) staleCommentIds.push(id);
	}

	return { orphanedTasks, staleCommentIds, autoCleanedCount };
}
