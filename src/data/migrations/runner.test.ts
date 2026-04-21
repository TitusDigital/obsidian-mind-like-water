import { describe, it, expect, vi } from "vitest";
import { runMigrations, formatRunSummary } from "./runner";
import type { Migration, MigrationContext, MigrationResult } from "./types";
import type { MLWData } from "data/models";
import { DEFAULT_SETTINGS } from "data/models";

function buildData(overrides: Partial<MLWData> = {}): MLWData {
	return {
		dataVersion: 0,
		tasks: {},
		settings: { ...DEFAULT_SETTINGS },
		...overrides,
	};
}

function buildCtx(dryRun = false): MigrationContext {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return { app: {} as any, plugin: {} as any, dryRun };
}

/** Helper: a trivial migration that tags the data by pushing to a stats counter. */
function tag(version: number, name: string): Migration {
	return {
		version,
		name,
		up(data, ctx): MigrationResult {
			if (!ctx.dryRun) {
				const rec = data as unknown as Record<string, number[]>;
				const applied = rec["_applied"] ?? [];
				applied.push(version);
				rec["_applied"] = applied;
			}
			return { stats: { touched: 1 }, warnings: [] };
		},
	};
}

describe("runMigrations", () => {
	it("runs nothing when data is already at the latest version", async () => {
		const data = buildData({ dataVersion: 2 });
		const migrations = [tag(1, "one"), tag(2, "two")];
		const summary = await runMigrations(data, buildCtx(), migrations);
		expect(summary.entries).toEqual([]);
		expect(summary.fromVersion).toBe(2);
		expect(summary.toVersion).toBe(2);
	});

	it("runs only pending migrations in ascending order", async () => {
		const data = buildData({ dataVersion: 1 });
		const migrations = [tag(1, "one"), tag(2, "two"), tag(3, "three")];
		const summary = await runMigrations(data, buildCtx(), migrations);
		expect(summary.entries.map(e => e.version)).toEqual([2, 3]);
		expect(data.dataVersion).toBe(3);
	});

	it("treats missing dataVersion as 0", async () => {
		const data = buildData();
		// Simulate legacy data.json with no dataVersion field.
		(data as Partial<MLWData>).dataVersion = undefined;
		const migrations = [tag(1, "one")];
		const summary = await runMigrations(data, buildCtx(), migrations);
		expect(summary.entries).toHaveLength(1);
		expect(data.dataVersion).toBe(1);
	});

	it("is idempotent: running twice runs pending migrations once", async () => {
		const data = buildData({ dataVersion: 0 });
		const migrations = [tag(1, "one"), tag(2, "two")];
		await runMigrations(data, buildCtx(), migrations);
		const second = await runMigrations(data, buildCtx(), migrations);
		expect(second.entries).toEqual([]);
		expect(data.dataVersion).toBe(2);
	});

	it("dry-run does not mutate input data", async () => {
		const data = buildData({ dataVersion: 0 });
		const before = structuredClone(data);
		const migrations = [tag(1, "one"), tag(2, "two")];
		const summary = await runMigrations(data, buildCtx(true), migrations);
		expect(summary.dryRun).toBe(true);
		expect(summary.entries).toHaveLength(2);
		expect(data).toEqual(before);
		expect(summary.toVersion).toBe(0);
	});

	it("throws when data.dataVersion is newer than any registered migration", async () => {
		const data = buildData({ dataVersion: 99 });
		const migrations = [tag(1, "one"), tag(2, "two")];
		await expect(runMigrations(data, buildCtx(), migrations)).rejects.toThrow(
			/newer than this plugin supports/i,
		);
	});

	it("rejects a registry with duplicate versions", async () => {
		const data = buildData();
		const migrations = [tag(1, "one"), tag(1, "one-again")];
		await expect(runMigrations(data, buildCtx(), migrations)).rejects.toThrow(/registered twice/);
	});

	it("rejects a registry that is not monotonically increasing", async () => {
		const data = buildData();
		const migrations = [tag(2, "two"), tag(1, "one")];
		await expect(runMigrations(data, buildCtx(), migrations)).rejects.toThrow(/ascending order/);
	});

	it("awaits async migrations before moving to the next", async () => {
		const order: number[] = [];
		const asyncMig = (v: number): Migration => ({
			version: v, name: `m${v}`,
			async up() {
				await new Promise(r => setTimeout(r, 5));
				order.push(v);
				return { stats: {}, warnings: [] };
			},
		});
		const data = buildData({ dataVersion: 0 });
		vi.useRealTimers();
		await runMigrations(data, buildCtx(), [asyncMig(1), asyncMig(2), asyncMig(3)]);
		expect(order).toEqual([1, 2, 3]);
	});
});

describe("formatRunSummary", () => {
	it("returns a no-op message when nothing ran", () => {
		expect(formatRunSummary({
			fromVersion: 1, toVersion: 1, dryRun: false, entries: [],
		})).toMatch(/no migrations/i);
	});

	it("lists migration versions and the from\u2192to bump", () => {
		const msg = formatRunSummary({
			fromVersion: 0, toVersion: 2, dryRun: false,
			entries: [
				{ version: 1, name: "first", result: { stats: {}, warnings: [] } },
				{ version: 2, name: "second", result: { stats: {}, warnings: [] } },
			],
		});
		expect(msg).toMatch(/#1 first/);
		expect(msg).toMatch(/#2 second/);
		expect(msg).toMatch(/v0/);
		expect(msg).toMatch(/v2/);
	});

	it("marks dry-run output", () => {
		const msg = formatRunSummary({
			fromVersion: 0, toVersion: 0, dryRun: true,
			entries: [{ version: 1, name: "x", result: { stats: {}, warnings: [] } }],
		});
		expect(msg).toMatch(/DRY RUN/);
	});
});
