import { describe, it, expect, vi } from "vitest";
import { migration004UuidIds } from "./004-uuid-ids";
import type { MigrationContext, MigrationResult } from "./types";
import type { MLWData, Task } from "data/models";
import { DEFAULT_SETTINGS, TaskStatus } from "data/models";
import { isLegacyId, isUuid } from "data/idPattern";

/**
 * Lightweight in-memory Obsidian shim. The migration only uses:
 *   - app.vault.getMarkdownFiles() -> iterable of { path, extension }
 *   - app.vault.read(file) -> Promise<string>
 *   - app.vault.process(file, fn) -> applies fn, writes result
 */
interface FakeFile {
	path: string;
	extension: "md";
}

function fakeApp(files: Record<string, string>) {
	const fileList: FakeFile[] = Object.keys(files).map(p => ({ path: p, extension: "md" as const }));
	return {
		vault: {
			getMarkdownFiles: vi.fn().mockReturnValue(fileList),
			read: vi.fn(async (f: FakeFile) => files[f.path] ?? ""),
			process: vi.fn(async (f: FakeFile, fn: (current: string) => string) => {
				files[f.path] = fn(files[f.path] ?? "");
			}),
		},
		files,
	};
}

function fakePlugin() {
	return { saveData: vi.fn().mockResolvedValue(undefined) };
}

function buildData(tasks: Record<string, Partial<Task>>): MLWData {
	return {
		dataVersion: 3,
		tasks: tasks as unknown as Record<string, Task>,
		settings: { ...DEFAULT_SETTINGS },
	};
}

function buildTask(id: string, overrides: Partial<Task> = {}): Partial<Task> {
	return {
		id, status: TaskStatus.Active, modified: "2026-04-01T00:00:00Z",
		tags: [], context: null, waiting_date: null,
		parent_task_id: null, recurrence_template_id: null, recurrence_rule: null,
		recurrence_type: null, recurrence_suspended: false, recurrence_spawn_count: 0,
		...overrides,
	};
}

function buildCtx(appShim: ReturnType<typeof fakeApp>, plugin: ReturnType<typeof fakePlugin>, dryRun = false): MigrationContext {
	return {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		app: appShim as any,
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		plugin: plugin as any,
		dryRun,
	};
}

describe("migration 004: UUID IDs", () => {
	it("no-op on a vault with no legacy IDs", async () => {
		const app = fakeApp({ "note.md": "- [ ] hello <!-- mlw:550e8400-e29b-41d4-a716-446655440000 -->" });
		const plugin = fakePlugin();
		const data = buildData({ "550e8400-e29b-41d4-a716-446655440000": buildTask("550e8400-e29b-41d4-a716-446655440000") });
		const result = await migration004UuidIds.up(data, buildCtx(app, plugin)) as MigrationResult;
		expect(result.stats["tasksMappedNew"]).toBe(0);
		expect(data.idMigration).toBeUndefined();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it("rewrites a single legacy comment in one file", async () => {
		const app = fakeApp({ "note.md": "- [ ] hello <!-- mlw:abc123 -->\n- [ ] world <!-- mlw:def456 -->" });
		const plugin = fakePlugin();
		const data = buildData({
			abc123: buildTask("abc123"),
			def456: buildTask("def456"),
		});
		const result = await migration004UuidIds.up(data, buildCtx(app, plugin)) as MigrationResult;
		expect(result.stats["tasksMappedNew"]).toBe(2);
		expect(result.stats["commentsRewritten"]).toBe(2);
		expect(app.files["note.md"]).not.toMatch(/mlw:abc123/);
		expect(app.files["note.md"]).not.toMatch(/mlw:def456/);
		// Every remaining ID is a UUID.
		const remaining = Array.from(app.files["note.md"]!.matchAll(/<!-- mlw:([^ ]+) -->/g));
		expect(remaining).toHaveLength(2);
		for (const m of remaining) expect(isUuid(m[1]!)).toBe(true);
	});

	it("rewrites the same ID in multiple files", async () => {
		const app = fakeApp({
			"a.md": "<!-- mlw:abc123 -->",
			"b.md": "<!-- mlw:abc123 -->",
			"c.md": "<!-- mlw:abc123 -->",
		});
		const plugin = fakePlugin();
		const data = buildData({ abc123: buildTask("abc123") });
		const result = await migration004UuidIds.up(data, buildCtx(app, plugin)) as MigrationResult;
		expect(result.stats["commentsRewritten"]).toBe(3);
		expect(result.stats["filesRewritten"]).toBe(3);
		// Journal cleared on completion.
		expect(data.idMigration).toBeUndefined();
	});

	it("updates data.tasks keys, id fields, parent_task_id and recurrence_template_id", async () => {
		const app = fakeApp({ "note.md": "<!-- mlw:aaa111 -->\n<!-- mlw:bbb222 -->" });
		const plugin = fakePlugin();
		const data = buildData({
			aaa111: buildTask("aaa111", { recurrence_template_id: "aaa111" }),
			bbb222: buildTask("bbb222", { parent_task_id: "aaa111" }),
		});
		await migration004UuidIds.up(data, buildCtx(app, plugin));
		const newKeys = Object.keys(data.tasks);
		expect(newKeys.every(k => isUuid(k))).toBe(true);

		// The task that pointed at aaa111 should now point at its UUID.
		const bbbNewId = Object.keys(data.tasks).find(k => data.tasks[k]!.parent_task_id !== null);
		expect(bbbNewId).toBeDefined();
		const bbb = data.tasks[bbbNewId!]!;
		expect(isUuid(bbb.parent_task_id!)).toBe(true);

		const aaaNewId = Object.keys(data.tasks).find(k => data.tasks[k]!.recurrence_template_id !== null);
		const aaa = data.tasks[aaaNewId!]!;
		expect(aaa.recurrence_template_id).toBe(aaaNewId);
	});

	it("dry-run does not mutate data.tasks or file contents", async () => {
		const fileBefore = "<!-- mlw:abc123 -->";
		const app = fakeApp({ "note.md": fileBefore });
		const plugin = fakePlugin();
		const data = buildData({ abc123: buildTask("abc123") });
		const before = structuredClone(data);
		const result = await migration004UuidIds.up(data, buildCtx(app, plugin, true)) as MigrationResult;
		expect(result.stats["tasksMappedNew"]).toBe(1);
		expect(result.stats["commentsRewritten"]).toBe(1);
		expect(data).toEqual(before);
		expect(app.files["note.md"]).toBe(fileBefore);
		expect(app.vault.process).not.toHaveBeenCalled();
		expect(plugin.saveData).not.toHaveBeenCalled();
	});

	it("resumes from journal: already-processed files are skipped, mapping reused", async () => {
		const app = fakeApp({
			"a.md": "<!-- mlw:abc123 -->",
			"b.md": "<!-- mlw:abc123 -->",
		});
		const plugin = fakePlugin();
		// Simulate: we crashed after processing a.md but before b.md.
		const uuidForAbc = "11111111-2222-3333-4444-555555555555";
		const data = buildData({ abc123: buildTask("abc123") });
		data.idMigration = {
			status: "in_progress",
			mapping: { abc123: uuidForAbc },
			processedFiles: ["a.md"],
			startedAt: "2026-04-20T00:00:00Z",
		};
		// Simulate that a.md was already rewritten in that prior run.
		app.files["a.md"] = `<!-- mlw:${uuidForAbc} -->`;

		const result = await migration004UuidIds.up(data, buildCtx(app, plugin)) as MigrationResult;

		expect(result.stats["tasksMappedResume"]).toBe(1);
		expect(result.stats["tasksMappedNew"]).toBe(0);
		expect(result.stats["filesSkippedAlreadyProcessed"]).toBe(1);
		// a.md was NOT re-read or re-processed.
		expect(app.vault.read).not.toHaveBeenCalledWith(expect.objectContaining({ path: "a.md" }));
		// b.md got processed this run with the SAME mapping.
		expect(app.files["b.md"]).toBe(`<!-- mlw:${uuidForAbc} -->`);
		// Journal cleared.
		expect(data.idMigration).toBeUndefined();
		// Task id updated.
		expect(Object.keys(data.tasks)).toEqual([uuidForAbc]);
	});

	it("leaves markdown IDs untouched when no matching task exists (warns)", async () => {
		const app = fakeApp({ "stale.md": "<!-- mlw:zzzzz9 -->" });
		const plugin = fakePlugin();
		const data = buildData({ abc123: buildTask("abc123") }); // Different legacy ID in data.
		const result = await migration004UuidIds.up(data, buildCtx(app, plugin)) as MigrationResult;
		expect(result.stats["legacyIdsLeftUnmapped"]).toBe(1);
		expect(result.warnings.some(w => w.includes("stale.md"))).toBe(true);
		expect(app.files["stale.md"]).toBe("<!-- mlw:zzzzz9 -->");
	});

	it("is idempotent: running twice results in no further rewrites", async () => {
		const app = fakeApp({ "note.md": "<!-- mlw:abc123 -->" });
		const plugin = fakePlugin();
		const data = buildData({ abc123: buildTask("abc123") });
		await migration004UuidIds.up(data, buildCtx(app, plugin));
		// Second run: no legacy IDs left in data.tasks, vault is UUID.
		const secondApp = fakeApp({ "note.md": app.files["note.md"]! });
		const secondResult = await migration004UuidIds.up(data, buildCtx(secondApp, plugin)) as MigrationResult;
		expect(secondResult.stats["tasksMappedNew"]).toBe(0);
		expect(secondResult.stats["commentsRewritten"]).toBe(0);
	});

	it("writes a journal to data.json on fresh run (checkpoint observable)", async () => {
		const app = fakeApp({ "note.md": "<!-- mlw:abc123 -->" });
		const plugin = fakePlugin();
		const data = buildData({ abc123: buildTask("abc123") });
		await migration004UuidIds.up(data, buildCtx(app, plugin));
		// saveData is called at least once to write the journal.
		expect(plugin.saveData).toHaveBeenCalled();
	});

	it("throws when ctx.app or ctx.plugin is missing", async () => {
		const data = buildData({ abc123: buildTask("abc123") });
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const ctx: MigrationContext = { app: undefined as any, plugin: undefined as any, dryRun: false };
		await expect(migration004UuidIds.up(data, ctx)).rejects.toThrow(/App and Plugin/);
	});

	it("helper regexes round-trip: isLegacyId vs isUuid are exclusive", () => {
		expect(isLegacyId("abc123")).toBe(true);
		expect(isUuid("abc123")).toBe(false);
		expect(isLegacyId("550e8400-e29b-41d4-a716-446655440000")).toBe(false);
		expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
	});
});
