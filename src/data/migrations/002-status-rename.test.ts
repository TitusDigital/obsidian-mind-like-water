import { describe, it, expect } from "vitest";
import { migration002StatusRename } from "./002-status-rename";
import type { MigrationContext } from "./types";
import type { MLWData, Task } from "data/models";
import { DEFAULT_SETTINGS, TaskStatus } from "data/models";

function buildData(tasks: Record<string, Partial<Task>>): MLWData {
	return {
		dataVersion: 1,
		tasks: tasks as unknown as Record<string, Task>,
		settings: { ...DEFAULT_SETTINGS },
	};
}

function buildCtx(dryRun = false): MigrationContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { app: {} as any, plugin: {} as any, dryRun };
}

describe("migration 002: status rename + waiting_date", () => {
	it("rewrites next_action -> active", () => {
		const data = buildData({
			t1: { id: "t1", status: "next_action" as TaskStatus },
		});
		const result = migration002StatusRename.up(data, buildCtx()) as ReturnType<typeof migration002StatusRename.up> & { stats: Record<string, number> };
		expect(data.tasks["t1"]!.status).toBe(TaskStatus.Active);
		expect(result.stats["statusRenamed"]).toBe(1);
	});

	it("rewrites completed -> done", () => {
		const data = buildData({
			t1: { id: "t1", status: "completed" as TaskStatus },
		});
		migration002StatusRename.up(data, buildCtx());
		expect(data.tasks["t1"]!.status).toBe(TaskStatus.Done);
	});

	it("adds waiting_date: null to tasks missing the field", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active },
		});
		const result = migration002StatusRename.up(data, buildCtx()) as { stats: Record<string, number>; warnings: string[] };
		expect(data.tasks["t1"]!.waiting_date).toBeNull();
		expect(result.stats["waitingDateAdded"]).toBe(1);
	});

	it("leaves already-migrated tasks alone", () => {
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Active, waiting_date: null },
			t2: { id: "t2", status: TaskStatus.Done, waiting_date: "2026-04-01T00:00:00Z" },
		});
		const result = migration002StatusRename.up(data, buildCtx()) as { stats: Record<string, number> };
		expect(result.stats["statusRenamed"]).toBe(0);
		expect(result.stats["waitingDateAdded"]).toBe(0);
		expect(result.stats["alreadyMigrated"]).toBe(2);
	});

	it("preserves existing waiting_date values", () => {
		const preset = "2026-02-14T10:00:00Z";
		const data = buildData({
			t1: { id: "t1", status: TaskStatus.Waiting, waiting_date: preset },
		});
		migration002StatusRename.up(data, buildCtx());
		expect(data.tasks["t1"]!.waiting_date).toBe(preset);
	});

	it("handles mixed populations correctly", () => {
		const data = buildData({
			legacy1: { id: "legacy1", status: "next_action" as TaskStatus },
			legacy2: { id: "legacy2", status: "completed" as TaskStatus },
			current: { id: "current", status: TaskStatus.Active, waiting_date: null },
		});
		const result = migration002StatusRename.up(data, buildCtx()) as { stats: Record<string, number> };
		expect(result.stats["statusRenamed"]).toBe(2);
		expect(result.stats["waitingDateAdded"]).toBe(2);
		expect(result.stats["alreadyMigrated"]).toBe(1);
	});

	it("dry-run does not mutate data", () => {
		const data = buildData({
			t1: { id: "t1", status: "next_action" as TaskStatus },
		});
		const before = structuredClone(data);
		migration002StatusRename.up(data, buildCtx(true));
		expect(data).toEqual(before);
	});

	it("is idempotent: second run is a no-op", () => {
		const data = buildData({
			t1: { id: "t1", status: "next_action" as TaskStatus },
		});
		migration002StatusRename.up(data, buildCtx());
		const second = migration002StatusRename.up(data, buildCtx()) as { stats: Record<string, number> };
		expect(second.stats["statusRenamed"]).toBe(0);
		expect(second.stats["waitingDateAdded"]).toBe(0);
	});

	it("ignores unknown status strings", () => {
		const data = buildData({
			weird: { id: "weird", status: "mystery_status" as TaskStatus },
		});
		migration002StatusRename.up(data, buildCtx());
		expect((data.tasks["weird"]! as unknown as { status: string }).status).toBe("mystery_status");
	});
});
