import { describe, it, expect, vi, beforeEach } from "vitest";
import { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";

/** Build a minimal Plugin mock for DataStore tests. */
function mockPlugin(savedData: unknown = null) {
	return {
		loadData: vi.fn().mockResolvedValue(savedData),
		saveData: vi.fn().mockResolvedValue(undefined),
		manifest: { id: "mind-like-water" },
		app: {
			vault: {
				adapter: { exists: vi.fn().mockResolvedValue(true), write: vi.fn() },
				configDir: ".obsidian",
			},
		},
	};
}

function createStore(plugin = mockPlugin()) {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	return new DataStore(plugin as any);
}

describe("DataStore", () => {
	beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date("2026-03-01T12:00:00Z")); });

	describe("createTask", () => {
		it("creates a task with default fields", () => {
			const store = createStore();
			const task = store.createTask({ source_file: "test.md", source_line: 1 });
			expect(task.id).toHaveLength(6);
			expect(task.status).toBe(TaskStatus.Inbox);
			expect(task.area_of_focus).toBe("");
			expect(task.project).toBeNull();
			expect(task.starred).toBe(false);
			expect(task.due_date).toBeNull();
			expect(task.start_date).toBeNull();
			expect(task.source_file).toBe("test.md");
			expect(task.source_line).toBe(1);
			expect(task.created).toBeTruthy();
			expect(task.modified).toBeTruthy();
		});

		it("accepts override fields", () => {
			const store = createStore();
			const task = store.createTask({
				source_file: "test.md", source_line: 5,
				status: TaskStatus.NextAction, starred: true, area_of_focus: "Work",
			});
			expect(task.status).toBe(TaskStatus.NextAction);
			expect(task.starred).toBe(true);
			expect(task.area_of_focus).toBe("Work");
		});

		it("accepts a pre-generated id", () => {
			const store = createStore();
			const task = store.createTask({ id: "abc123", source_file: "test.md", source_line: 1 });
			expect(task.id).toBe("abc123");
		});
	});

	describe("getTask", () => {
		it("returns the task by ID", () => {
			const store = createStore();
			const created = store.createTask({ id: "aaa111", source_file: "f.md", source_line: 1 });
			expect(store.getTask("aaa111")).toBe(created);
		});

		it("returns undefined for missing ID", () => {
			const store = createStore();
			expect(store.getTask("missing")).toBeUndefined();
		});
	});

	describe("getAllTasks", () => {
		it("returns all tasks as an array", () => {
			const store = createStore();
			store.createTask({ source_file: "a.md", source_line: 1 });
			store.createTask({ source_file: "b.md", source_line: 2 });
			expect(store.getAllTasks()).toHaveLength(2);
		});
	});

	describe("updateTask", () => {
		it("modifies fields and updates modified timestamp", () => {
			const store = createStore();
			const task = store.createTask({ id: "upd001", source_file: "f.md", source_line: 1 });
			const oldModified = task.modified;
			vi.advanceTimersByTime(1000);
			const updated = store.updateTask("upd001", { starred: true, area_of_focus: "Health" });
			expect(updated).toBeDefined();
			expect(updated!.starred).toBe(true);
			expect(updated!.area_of_focus).toBe("Health");
			expect(updated!.modified).not.toBe(oldModified);
		});

		it("returns undefined for missing task", () => {
			const store = createStore();
			expect(store.updateTask("missing", { starred: true })).toBeUndefined();
		});
	});

	describe("deleteTask", () => {
		it("removes the task and returns true", () => {
			const store = createStore();
			store.createTask({ id: "del001", source_file: "f.md", source_line: 1 });
			expect(store.deleteTask("del001")).toBe(true);
			expect(store.getTask("del001")).toBeUndefined();
		});

		it("returns false for missing task", () => {
			const store = createStore();
			expect(store.deleteTask("missing")).toBe(false);
		});
	});

	describe("completeTask", () => {
		it("sets status to completed with completed_date", () => {
			const store = createStore();
			store.createTask({ id: "cmp001", source_file: "f.md", source_line: 1 });
			const result = store.completeTask("cmp001");
			expect(result).toBeDefined();
			expect(result!.status).toBe(TaskStatus.Completed);
			expect(result!.completed_date).toBeTruthy();
		});
	});

	describe("getTasksByStatus", () => {
		it("filters tasks by status", () => {
			const store = createStore();
			store.createTask({ source_file: "f.md", source_line: 1, status: TaskStatus.Inbox });
			store.createTask({ source_file: "f.md", source_line: 2, status: TaskStatus.NextAction });
			store.createTask({ source_file: "f.md", source_line: 3, status: TaskStatus.Inbox });
			expect(store.getTasksByStatus(TaskStatus.Inbox)).toHaveLength(2);
			expect(store.getTasksByStatus(TaskStatus.NextAction)).toHaveLength(1);
			expect(store.getTasksByStatus(TaskStatus.Completed)).toHaveLength(0);
		});
	});

	describe("getTasksByTemplateId", () => {
		it("filters tasks by recurrence template ID", () => {
			const store = createStore();
			store.createTask({ id: "tmpl01", source_file: "f.md", source_line: 1, recurrence_template_id: "tmpl01" });
			store.createTask({ id: "inst01", source_file: "f.md", source_line: 2, recurrence_template_id: "tmpl01" });
			store.createTask({ id: "other1", source_file: "f.md", source_line: 3 });
			expect(store.getTasksByTemplateId("tmpl01")).toHaveLength(2);
			expect(store.getTasksByTemplateId("nonexistent")).toHaveLength(0);
		});
	});

	describe("getStarredCount", () => {
		it("counts active starred tasks only", () => {
			const store = createStore();
			store.createTask({ source_file: "f.md", source_line: 1, starred: true, status: TaskStatus.NextAction });
			store.createTask({ source_file: "f.md", source_line: 2, starred: true, status: TaskStatus.Completed });
			store.createTask({ source_file: "f.md", source_line: 3, starred: false, status: TaskStatus.NextAction });
			expect(store.getStarredCount()).toBe(1);
		});
	});

	describe("generateId", () => {
		it("generates unique 6-char IDs", () => {
			const store = createStore();
			const ids = new Set<string>();
			for (let i = 0; i < 50; i++) ids.add(store.generateId());
			expect(ids.size).toBe(50);
			for (const id of ids) expect(id).toMatch(/^[a-z0-9]{6}$/);
		});
	});

	describe("load", () => {
		it("loads saved data and applies backward-compat defaults", async () => {
			const savedData = {
				tasks: {
					old001: {
						id: "old001", status: "inbox", source_file: "f.md", source_line: 1,
						area_of_focus: "", project: null, starred: false,
						due_date: null, start_date: null, completed_date: null,
						energy: null, context: null, sort_order: 0,
						created: "2026-01-01", modified: "2026-01-01",
						recurrence_rule: null, parent_task_id: null, cached_text: null,
						// Missing: recurrence_type, recurrence_template_id, recurrence_suspended, recurrence_spawn_count
					},
				},
				settings: {},
			};
			const plugin = mockPlugin(savedData);
			const store = createStore(plugin);
			await store.load();
			const task = store.getTask("old001");
			expect(task).toBeDefined();
			expect(task!.recurrence_type).toBeNull();
			expect(task!.recurrence_template_id).toBeNull();
			expect(task!.recurrence_suspended).toBe(false);
			expect(task!.recurrence_spawn_count).toBe(0);
		});

		it("uses DEFAULT_DATA when loadData returns null", async () => {
			const plugin = mockPlugin(null);
			const store = createStore(plugin);
			await store.load();
			expect(store.getAllTasks()).toHaveLength(0);
		});
	});

	describe("onChange", () => {
		it("notifies listeners on task create/update/delete", () => {
			const store = createStore();
			const listener = vi.fn();
			store.onChange(listener);
			store.createTask({ source_file: "f.md", source_line: 1 });
			expect(listener).toHaveBeenCalledTimes(1);
			store.updateTask(store.getAllTasks()[0]!.id, { starred: true });
			expect(listener).toHaveBeenCalledTimes(2);
		});

		it("returns unsubscribe function", () => {
			const store = createStore();
			const listener = vi.fn();
			const unsub = store.onChange(listener);
			store.createTask({ source_file: "f.md", source_line: 1 });
			expect(listener).toHaveBeenCalledTimes(1);
			unsub();
			store.createTask({ source_file: "f.md", source_line: 2 });
			expect(listener).toHaveBeenCalledTimes(1);
		});
	});

	describe("sort_order", () => {
		it("assigns incrementing sort_order values", () => {
			const store = createStore();
			const t1 = store.createTask({ source_file: "f.md", source_line: 1 });
			const t2 = store.createTask({ source_file: "f.md", source_line: 2 });
			const t3 = store.createTask({ source_file: "f.md", source_line: 3 });
			expect(t1.sort_order).toBe(0);
			expect(t2.sort_order).toBe(1);
			expect(t3.sort_order).toBe(2);
		});
	});
});
