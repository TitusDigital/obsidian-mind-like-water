import { describe, it, expect, vi, beforeEach } from "vitest";
import { runScheduler } from "services/SchedulerService";
import { TaskStatus } from "data/models";

/** Build a minimal DataStore mock for scheduler tests. */
function mockStore(tasks: Array<{ id: string; status: string; start_date: string | null }>, autoTransition = true) {
	return {
		getSettings: () => ({ autoTransitionScheduled: autoTransition }),
		getTasksByStatus: (status: string) => tasks.filter(t => t.status === status),
		updateTask: vi.fn(),
	};
}

describe("runScheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-02-28T12:00:00Z"));
	});

	it("transitions scheduled tasks with start_date <= today", () => {
		const store = mockStore([
			{ id: "a", status: TaskStatus.Scheduled, start_date: "2026-02-28" },
			{ id: "b", status: TaskStatus.Scheduled, start_date: "2026-02-27" },
			{ id: "c", status: TaskStatus.Scheduled, start_date: "2026-03-01" },
		]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const count = runScheduler(store as any);

		expect(count).toBe(2);
		expect(store.updateTask).toHaveBeenCalledWith("a", { status: TaskStatus.NextAction });
		expect(store.updateTask).toHaveBeenCalledWith("b", { status: TaskStatus.NextAction });
		expect(store.updateTask).not.toHaveBeenCalledWith("c", expect.anything());
	});

	it("skips tasks with no start_date", () => {
		const store = mockStore([
			{ id: "a", status: TaskStatus.Scheduled, start_date: null },
		]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const count = runScheduler(store as any);

		expect(count).toBe(0);
		expect(store.updateTask).not.toHaveBeenCalled();
	});

	it("returns 0 when autoTransitionScheduled is false", () => {
		const store = mockStore([
			{ id: "a", status: TaskStatus.Scheduled, start_date: "2026-02-28" },
		], false);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const count = runScheduler(store as any);

		expect(count).toBe(0);
		expect(store.updateTask).not.toHaveBeenCalled();
	});

	it("returns 0 when no scheduled tasks exist", () => {
		const store = mockStore([]);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const count = runScheduler(store as any);

		expect(count).toBe(0);
	});
});
