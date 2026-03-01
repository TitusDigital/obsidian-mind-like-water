import { type Task } from "data/models";
import { ViewState } from "views/ViewState";

export type ChipState = "off" | "include" | "exclude";

interface FilterDimension {
	label: string;
	key: string;
	values: string[];
	getTaskValue: (task: Task) => string;
}

/**
 * Three-state filter chip bar.
 * Renders chips for AOF, Project, Context, Energy, and Starred dimensions.
 * Tapping cycles: Off → Include → Exclude → Off.
 */
export class FilterBar {
	private container: HTMLElement;
	private dimensions: FilterDimension[] = [];
	private states = new Map<string, ChipState>();

	constructor(
		parentEl: HTMLElement,
		private readonly onFilterChange: () => void,
	) {
		this.container = parentEl.createDiv("mlw-filter-bar");
	}

	/** Get the container element for DOM insertion. */
	getContainer(): HTMLElement { return this.container; }

	/** Rebuild chip options scoped to the given tasks. */
	rebuild(tasks?: Task[]): void {
		this.container.empty();
		this.dimensions = this.buildDimensions(tasks ?? []);
		this.pruneStaleStates();
		this.render();
	}

	/** Apply all active filters to a task array. */
	applyFilters(tasks: Task[]): Task[] {
		if (this.states.size === 0) return tasks;
		return tasks.filter(t => this.matchesAll(t));
	}

	private buildDimensions(tasks: Task[]): FilterDimension[] {
		const dims: FilterDimension[] = [];
		const activeAOFs = ViewState.getInstance().getActiveAOFs();

		// AOF chips — only when global AOF is "All"
		if (activeAOFs.size === 0) {
			const aofs = this.uniqueSorted(tasks, t => t.area_of_focus || "");
			if (aofs.length > 0) dims.push({ label: "Area", key: "aof", values: aofs, getTaskValue: (t) => t.area_of_focus || "" });
		}

		// Project chips — derived from tasks in view
		const projects = this.uniqueSorted(tasks, t => t.project ?? "");
		if (projects.length > 0) dims.push({ label: "Project", key: "project", values: projects, getTaskValue: (t) => t.project ?? "" });

		// Context chips — derived from tasks in view
		const contexts = this.uniqueSorted(tasks, t => t.context ?? "");
		if (contexts.length > 0) dims.push({ label: "Context", key: "context", values: contexts, getTaskValue: (t) => t.context ?? "" });

		// Energy chips — only values present in tasks
		const energies = this.uniqueSorted(tasks, t => t.energy ?? "");
		if (energies.length > 0) dims.push({ label: "Energy", key: "energy", values: energies, getTaskValue: (t) => t.energy ?? "" });

		// Starred chip — only if any task is starred
		if (tasks.some(t => t.starred)) {
			dims.push({ label: "Starred", key: "starred", values: ["true"], getTaskValue: (t) => String(t.starred) });
		}

		return dims;
	}

	/** Extract unique non-empty values from tasks, sorted alphabetically. */
	private uniqueSorted(tasks: Task[], getValue: (t: Task) => string): string[] {
		const set = new Set<string>();
		for (const t of tasks) { const v = getValue(t); if (v) set.add(v); }
		return [...set].sort();
	}

	/** Remove chip states for values no longer in any dimension. */
	private pruneStaleStates(): void {
		const valid = new Set<string>();
		for (const dim of this.dimensions) {
			for (const v of dim.values) valid.add(`${dim.key}:${v}`);
		}
		for (const key of this.states.keys()) {
			if (!valid.has(key)) this.states.delete(key);
		}
	}

	private render(): void {
		this.container.empty();
		for (let i = 0; i < this.dimensions.length; i++) {
			const dim = this.dimensions[i];
			if (dim === undefined) continue;
			if (i > 0) this.container.createDiv("mlw-filter-bar__sep");
			for (const value of dim.values) {
				const chipKey = `${dim.key}:${value}`;
				const state = this.states.get(chipKey) ?? "off";
				const label = dim.key === "starred" ? "\u2B50 Starred" : value;
				const chip = this.container.createSpan({
					text: label,
					cls: `mlw-filter-chip mlw-filter-chip--${state}`,
				});
				chip.addEventListener("click", (e) => this.cycleChip(dim.key, chipKey, e));
			}
		}
	}

	private cycleChip(dimKey: string, chipKey: string, e: MouseEvent): void {
		const current = this.states.get(chipKey) ?? "off";
		let next: ChipState;

		if (e.shiftKey) {
			next = current === "exclude" ? "off" : "exclude";
		} else if (e.ctrlKey || e.metaKey) {
			next = current === "include" ? "off" : "include";
		} else {
			// Radio: clear other includes in this dimension
			next = current === "include" ? "off" : "include";
			if (next === "include") {
				const prefix = `${dimKey}:`;
				for (const [k, v] of this.states) {
					if (k !== chipKey && k.startsWith(prefix) && v === "include") this.states.delete(k);
				}
			}
		}

		if (next === "off") this.states.delete(chipKey);
		else this.states.set(chipKey, next);
		this.onFilterChange();
	}

	private matchesAll(task: Task): boolean {
		for (const dim of this.dimensions) {
			if (!this.matchesDimension(task, dim)) return false;
		}
		return true;
	}

	private matchesDimension(task: Task, dim: FilterDimension): boolean {
		const includes: string[] = [];
		const excludes: string[] = [];
		for (const value of dim.values) {
			const state = this.states.get(`${dim.key}:${value}`);
			if (state === "include") includes.push(value);
			else if (state === "exclude") excludes.push(value);
		}
		if (includes.length === 0 && excludes.length === 0) return true;

		const taskValue = dim.getTaskValue(task);

		// Include mode: task must match at least one included value
		if (includes.length > 0) return includes.includes(taskValue);

		// Exclude mode: task must NOT match any excluded value
		return !excludes.includes(taskValue);
	}
}
