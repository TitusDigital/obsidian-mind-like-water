import type { DataStore } from "data/DataStore";
import { EnergyLevel, type Task } from "data/models";
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
		private readonly store: DataStore,
		private readonly onFilterChange: () => void,
	) {
		this.container = parentEl.createDiv("mlw-filter-bar");
		this.rebuild();
	}

	/** Get the container element for DOM insertion. */
	getContainer(): HTMLElement { return this.container; }

	/** Rebuild chip options (e.g. when AOF changes). */
	rebuild(): void {
		this.container.empty();
		this.dimensions = this.buildDimensions();
		this.states.clear();
		this.render();
	}

	/** Apply all active filters to a task array. */
	applyFilters(tasks: Task[]): Task[] {
		if (this.states.size === 0) return tasks;
		return tasks.filter(t => this.matchesAll(t));
	}

	private buildDimensions(): FilterDimension[] {
		const dims: FilterDimension[] = [];
		const activeAOF = ViewState.getInstance().getActiveAOF();
		const settings = this.store.getSettings();

		// AOF chips — only when global AOF is "All"
		if (activeAOF === "" && settings.areasOfFocus.length > 0) {
			dims.push({
				label: "Area",
				key: "aof",
				values: settings.areasOfFocus.map(a => a.name),
				getTaskValue: (t) => t.area_of_focus || "",
			});
		}

		// Project chips — scoped to active AOF
		const projects = activeAOF !== ""
			? this.store.getProjectsForAOF(activeAOF)
			: this.getAllProjects();
		if (projects.length > 0) {
			dims.push({
				label: "Project",
				key: "project",
				values: projects,
				getTaskValue: (t) => t.project ?? "",
			});
		}

		// Context chips
		if (settings.contexts.length > 0) {
			dims.push({
				label: "Context",
				key: "context",
				values: settings.contexts,
				getTaskValue: (t) => t.context ?? "",
			});
		}

		// Energy chips
		dims.push({
			label: "Energy",
			key: "energy",
			values: [EnergyLevel.Low, EnergyLevel.Medium, EnergyLevel.High],
			getTaskValue: (t) => t.energy ?? "",
		});

		// Starred chip
		dims.push({
			label: "Starred",
			key: "starred",
			values: ["true"],
			getTaskValue: (t) => String(t.starred),
		});

		return dims;
	}

	private getAllProjects(): string[] {
		const projects = new Set<string>();
		for (const task of this.store.getAllTasks()) {
			if (task.project !== null) projects.add(task.project);
		}
		return [...projects].sort();
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
				chip.addEventListener("click", () => this.cycleChip(chipKey, chip));
			}
		}
	}

	private cycleChip(key: string, chip: HTMLSpanElement): void {
		const current = this.states.get(key) ?? "off";
		let next: ChipState;
		if (current === "off") next = "include";
		else if (current === "include") next = "exclude";
		else next = "off";

		if (next === "off") {
			this.states.delete(key);
		} else {
			this.states.set(key, next);
		}

		chip.className = `mlw-filter-chip mlw-filter-chip--${next}`;
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
