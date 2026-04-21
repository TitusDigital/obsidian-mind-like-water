import type { App, Plugin } from "obsidian";
import type { MLWData, Task, IdMigrationJournal } from "data/models";
import { isLegacyId, mlwCommentGlobalRe } from "data/idPattern";
import type { Migration, MigrationContext, MigrationResult } from "./types";

/**
 * v4 schema change: replace every legacy 6-char hex ID with a fresh UUID.
 *
 * This is the only migration that writes to vault markdown files — every other
 * migration touches data.json only. It must therefore:
 *
 *   - Not auto-run at load time (main.ts registers a separate user-gated
 *     command; the migration runner never auto-invokes this one).
 *   - Be resumable: partway through, the user may close Obsidian or the
 *     filesystem may fail on one file. On next run we pick up where we left
 *     off using the `idMigration` journal persisted into data.json.
 *   - Be idempotent: running on a vault that's already fully UUID is a no-op.
 *
 * Sequence (happy path):
 *   1. Collect every task whose `id` looks legacy; build `{oldId: newId}` map.
 *   2. Persist that map into `data.idMigration` and save immediately.
 *   3. For every markdown file containing `<!-- mlw:`, rewrite legacy IDs to
 *      UUIDs. After each file write, record the path in the journal and
 *      checkpoint to disk every CHECKPOINT_EVERY_N_FILES files.
 *   4. Rewrite the `data.tasks` map keys, each task's `id`, and any
 *      `parent_task_id` / `recurrence_template_id` references.
 *   5. Delete `data.idMigration`.
 *
 * If a journal already exists on entry, step 1 is skipped and the existing
 * mapping is reused. Files in `processedFiles` are not re-scanned.
 */

const CHECKPOINT_EVERY_N_FILES = 25;

export const migration004UuidIds: Migration = {
	version: 4,
	name: "uuid-ids",
	async up(data: MLWData, ctx: MigrationContext): Promise<MigrationResult> {
		const counters = {
			tasksMappedNew: 0,
			tasksMappedResume: 0,
			filesScanned: 0,
			filesRewritten: 0,
			filesSkippedAlreadyProcessed: 0,
			commentsRewritten: 0,
			legacyIdsLeftUnmapped: 0,
		};
		const warnings: string[] = [];

		const app = ctx.app as App | undefined;
		const plugin = ctx.plugin as Plugin | undefined;
		if (app === undefined || plugin === undefined) {
			throw new Error("Migration 004 requires both App and Plugin contexts.");
		}

		const existingJournal = data.idMigration;
		const mapping: Record<string, string> = existingJournal?.mapping ?? {};
		const processedFiles: Set<string> = new Set(existingJournal?.processedFiles ?? []);

		if (existingJournal === undefined) {
			// Fresh run: build the mapping from the current task set.
			for (const task of Object.values(data.tasks) as Task[]) {
				if (isLegacyId(task.id)) {
					mapping[task.id] = crypto.randomUUID();
					counters.tasksMappedNew++;
				}
			}

			if (Object.keys(mapping).length === 0) {
				// Nothing to rewrite. No journal needed.
				return { stats: counters, warnings };
			}

			if (!ctx.dryRun) {
				data.idMigration = {
					status: "in_progress",
					mapping: { ...mapping },
					processedFiles: [],
					startedAt: new Date().toISOString(),
				} satisfies IdMigrationJournal;
				await plugin.saveData(data);
			}
		} else {
			counters.tasksMappedResume = Object.keys(mapping).length;
			counters.filesSkippedAlreadyProcessed = processedFiles.size;
		}

		// Walk vault files and rewrite comment IDs.
		const files = app.vault.getMarkdownFiles();
		let processedSinceLastCheckpoint = 0;

		for (const file of files) {
			if (processedFiles.has(file.path)) continue;
			counters.filesScanned++;

			const content = await app.vault.read(file);
			if (!content.includes("<!-- mlw:")) {
				markProcessed(data, processedFiles, file.path, ctx.dryRun);
				continue;
			}

			const { rewritten, updatedCount, unmappedLegacy } = rewriteComments(content, mapping);

			if (unmappedLegacy > 0) {
				warnings.push(
					`${file.path}: ${unmappedLegacy} legacy ID(s) present in markdown but ` +
					`not found in the mapping; they were left alone.`
				);
				counters.legacyIdsLeftUnmapped += unmappedLegacy;
			}

			if (updatedCount > 0) {
				if (!ctx.dryRun) {
					await app.vault.process(file, () => rewritten);
				}
				counters.filesRewritten++;
				counters.commentsRewritten += updatedCount;
			}

			markProcessed(data, processedFiles, file.path, ctx.dryRun);

			processedSinceLastCheckpoint++;
			if (!ctx.dryRun && processedSinceLastCheckpoint >= CHECKPOINT_EVERY_N_FILES) {
				await plugin.saveData(data);
				processedSinceLastCheckpoint = 0;
			}
		}

		if (ctx.dryRun) {
			return { stats: counters, warnings };
		}

		// Rewrite task map: keys, id field, and any references into the mapping.
		const newTasks: Record<string, Task> = {};
		for (const task of Object.values(data.tasks) as Task[]) {
			const newId = mapping[task.id] ?? task.id;
			if (task.parent_task_id !== null) {
				const mappedParent = mapping[task.parent_task_id];
				if (mappedParent !== undefined) task.parent_task_id = mappedParent;
			}
			if (task.recurrence_template_id !== null) {
				const mappedTemplate = mapping[task.recurrence_template_id];
				if (mappedTemplate !== undefined) task.recurrence_template_id = mappedTemplate;
			}
			task.id = newId;
			newTasks[newId] = task;
		}
		data.tasks = newTasks;

		// Clear journal — we're done.
		delete data.idMigration;

		return { stats: counters, warnings };
	},
};

/** Replace `<!-- mlw:<legacy> -->` with `<!-- mlw:<uuid> -->` using the mapping. */
function rewriteComments(
	content: string,
	mapping: Record<string, string>,
): { rewritten: string; updatedCount: number; unmappedLegacy: number } {
	let updatedCount = 0;
	let unmappedLegacy = 0;
	const re = mlwCommentGlobalRe();
	const rewritten = content.replace(re, (full: string, id: string) => {
		if (!isLegacyId(id)) return full; // Already UUID.
		const newId = mapping[id];
		if (newId === undefined) {
			unmappedLegacy++;
			return full;
		}
		updatedCount++;
		return `<!-- mlw:${newId} -->`;
	});
	return { rewritten, updatedCount, unmappedLegacy };
}

function markProcessed(
	data: MLWData,
	processedFiles: Set<string>,
	path: string,
	dryRun: boolean,
): void {
	processedFiles.add(path);
	if (!dryRun && data.idMigration !== undefined) {
		data.idMigration.processedFiles.push(path);
	}
}
