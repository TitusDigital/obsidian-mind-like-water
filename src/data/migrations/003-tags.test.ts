import { describe, it, expect } from "vitest";
import { migration003Tags } from "./003-tags";
import type { MigrationContext, MigrationResult } from "./types";
import type { MLWData, Task } from "data/models";
import { DEFAULT_SETTINGS, TaskStatus } from "data/models";

function buildData(tasks: Record<string, Partial<Task>>): MLWData {
	return {
		dataVersion: 2,
		tasks: tasks as unknown as Record<string, Task>,
		settings: { ...DEFAULT_SETTINGS },
	};
}

function buildCtx(dryRun = false): MigrationContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { app: {} as any, plugin: {} as any, dryRun };
}

describe("migration 003: tags from context", () => {
	it("seeds an empty tags array on tasks that had none", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: null, modified: "2026-03-01T00:00:00Z" },
		});
		migration003Tags.up(data, buildCtx());
		expect(data.tasks["t1"]!.tags).toEqual([]);
	});

	it("moves '@computer' context into tags preserving the @ prefix", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "@computer", modified: "2026-03-01T00:00:00Z" },
		});
		const result = migration003Tags.up(data, buildCtx()) as MigrationResult;
		expect(data.tasks["t1"]!.tags).toEqual(["@computer"]);
		expect(result.stats["tagsMigrated"]).toBe(1);
	});

	it("moves '#errand' context into tags preserving the # prefix", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "#errand", modified: "2026-03-01T00:00:00Z" },
		});
		migration003Tags.up(data, buildCtx());
		expect(data.tasks["t1"]!.tags).toEqual(["#errand"]);
	});

	it("promotes @waiting context to status=Waiting (not tags)", () => {
		const data = buildData({
			t1: {
				id: "t1",
				status: TaskStatus.Active,
				context: "@waiting",
				waiting_date: null,
				modified: "2026-03-01T10:00:00Z",
			},
		});
		const result = migration003Tags.up(data, buildCtx()) as MigrationResult;
		expect(data.tasks["t1"]!.status).toBe(TaskStatus.Waiting);
		expect(data.tasks["t1"]!.tags).toEqual([]);
		expect(data.tasks["t1"]!.waiting_date).toBe("2026-03-01T10:00:00Z");
		expect(result.stats["promotedToWaiting"]).toBe(1);
		expect(result.stats["waitingDateEstimated"]).toBe(1);
	});

	it("promoted tasks with bare 'waiting' (no @) also promote to Waiting", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "waiting", waiting_date: null, modified: "2026-01-01T00:00:00Z" },
		});
		migration003Tags.up(data, buildCtx());
		expect(data.tasks["t1"]!.status).toBe(TaskStatus.Waiting);
	});

	it("does not overwrite an existing waiting_date when promoting", () => {
		const preset = "2026-01-15T00:00:00Z";
		const data = buildData({
			t1: {
				id: "t1", status: TaskStatus.Active, context: "@waiting",
				waiting_date: preset, modified: "2026-03-01T00:00:00Z",
			},
		});
		migration003Tags.up(data, buildCtx());
		expect(data.tasks["t1"]!.waiting_date).toBe(preset);
	});

	it("emits a warning when waiting_date had to be estimated", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "@waiting", waiting_date: null, modified: "2026-03-01T00:00:00Z" },
		});
		const result = migration003Tags.up(data, buildCtx()) as MigrationResult;
		expect(result.warnings.length).toBeGreaterThan(0);
		expect(result.warnings[0]).toMatch(/best-effort/i);
	});

	it("leaves already-migrated tasks alone (tags already present)", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "@whatever", tags: ["pre-existing"], modified: "2026-03-01T00:00:00Z" },
		});
		const result = migration003Tags.up(data, buildCtx()) as MigrationResult;
		expect(data.tasks["t1"]!.tags).toEqual(["pre-existing"]);
		expect(result.stats["alreadyMigrated"]).toBe(1);
	});

	it("does not clear context (back-compat field persists)", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "@computer", modified: "2026-03-01T00:00:00Z" },
		});
		migration003Tags.up(data, buildCtx());
		expect(data.tasks["t1"]!.context).toBe("@computer");
	});

	it("dry-run does not mutate data", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "@waiting", waiting_date: null, modified: "2026-03-01T00:00:00Z" },
		});
		const before = structuredClone(data);
		migration003Tags.up(data, buildCtx(true));
		expect(data).toEqual(before);
	});

	it("is idempotent: second run is a no-op", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "@computer", modified: "2026-03-01T00:00:00Z" },
		});
		migration003Tags.up(data, buildCtx());
		const second = migration003Tags.up(data, buildCtx()) as MigrationResult;
		expect(second.stats["tagsMigrated"]).toBe(0);
		expect(second.stats["alreadyMigrated"]).toBe(1);
	});

	it("handles empty-string context as no tag", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, context: "", modified: "2026-03-01T00:00:00Z" },
		});
		migration003Tags.up(data, buildCtx());
		expect(data.tasks["t1"]!.tags).toEqual([]);
	});
});
