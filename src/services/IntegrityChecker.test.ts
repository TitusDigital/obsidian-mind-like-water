import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildIntegrityReport } from "services/IntegrityChecker";
import { TaskStatus } from "data/models";

interface MockTask { id: string; status: string; modified: string }

function mockStore(tasks: MockTask[], graceDays = 7) {
	return {
		getSettings: () => ({ orphanGracePeriodDays: graceDays }),
		getAllTasks: () => tasks,
		getTask: (id: string) => tasks.find(t => t.id === id),
		deleteTask: vi.fn(),
	};
}

describe("buildIntegrityReport", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-28T12:00:00Z"));
	});

	it("flags tasks not found in vault as orphaned", () => {
		const store = mockStore([
			{ id: "abc123", status: TaskStatus.NextAction, modified: "2026-02-27T12:00:00Z" },
		]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const report = buildIntegrityReport(new Set(), store as any);
		expect(report.orphanedTasks).toHaveLength(1);
		expect(report.orphanedTasks[0]?.id).toBe("abc123");
		expect(report.autoCleanedCount).toBe(0);
	});

	it("auto-cleans orphans past grace period", () => {
		const store = mockStore([
			{ id: "old123", status: TaskStatus.NextAction, modified: "2026-02-10T12:00:00Z" },
		]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const report = buildIntegrityReport(new Set(), store as any);
		expect(report.orphanedTasks).toHaveLength(0);
		expect(report.autoCleanedCount).toBe(1);
		expect(store.deleteTask).toHaveBeenCalledWith("old123");
	});

	it("skips completed and dropped tasks", () => {
		const store = mockStore([
			{ id: "done01", status: TaskStatus.Completed, modified: "2026-02-10T12:00:00Z" },
			{ id: "drop01", status: TaskStatus.Dropped, modified: "2026-02-10T12:00:00Z" },
		]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const report = buildIntegrityReport(new Set(), store as any);
		expect(report.orphanedTasks).toHaveLength(0);
		expect(report.autoCleanedCount).toBe(0);
	});

	it("detects stale comment IDs not in DataStore", () => {
		const store = mockStore([]);
		const vaultIds = new Set(["xyz789", "abc456"]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const report = buildIntegrityReport(vaultIds, store as any);
		expect(report.staleCommentIds).toHaveLength(2);
		expect(report.staleCommentIds).toContain("xyz789");
		expect(report.staleCommentIds).toContain("abc456");
	});

	it("keeps tasks within grace period as orphaned (not deleted)", () => {
		const store = mockStore([
			{ id: "new123", status: TaskStatus.Inbox, modified: "2026-02-25T12:00:00Z" },
		]);
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const report = buildIntegrityReport(new Set(), store as any);
		expect(report.orphanedTasks).toHaveLength(1);
		expect(report.autoCleanedCount).toBe(0);
		expect(store.deleteTask).not.toHaveBeenCalled();
	});
});
