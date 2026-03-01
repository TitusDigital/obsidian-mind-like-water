/** GTD task lifecycle statuses */
export enum TaskStatus {
	Inbox = "inbox",
	NextAction = "next_action",
	Scheduled = "scheduled",
	Someday = "someday",
	Completed = "completed",
	Dropped = "dropped",
}

/** Energy level for filtering */
export enum EnergyLevel {
	Low = "low",
	Medium = "medium",
	High = "high",
}

/** Where Quick Capture places new tasks */
export enum CaptureLocation {
	DailyNote = "daily_note",
	InboxFile = "inbox_file",
}

/** How much detail to show on inline editor chips */
export enum ChipDisplayMode { Full = "full", Compact = "compact", Dot = "dot" }

/** Returns the next chip display mode in the cycle: full → compact → dot → full */
export function nextChipDisplayMode(current: ChipDisplayMode): ChipDisplayMode {
	if (current === ChipDisplayMode.Full) return ChipDisplayMode.Compact;
	if (current === ChipDisplayMode.Compact) return ChipDisplayMode.Dot;
	return ChipDisplayMode.Full;
}

/** Project lifecycle statuses (stored in YAML frontmatter) */
export enum ProjectStatus {
	Active = "active",
	Someday = "someday",
	Completed = "completed",
	OnHold = "on_hold",
	Dropped = "dropped",
}

/** Parsed project metadata from a markdown file */
export interface ProjectMeta {
	filePath: string;
	title: string;
	status: ProjectStatus;
	area_of_focus: string;
	successful_outcome: string;
	sort_order: number;
	created: string;
	modified: string;
}

/** Color scheme for an Area of Focus chip */
export interface AOFColor {
	bg: string;
	text: string;
	border: string;
}

/** An Area of Focus as defined in settings */
export interface AreaOfFocus {
	name: string;
	sort_order: number;
	color: AOFColor;
}

/** A single tracked task's metadata in the data store */
export interface Task {
	id: string;
	status: TaskStatus;
	area_of_focus: string;
	project: string | null;
	starred: boolean;
	due_date: string | null;
	start_date: string | null;
	completed_date: string | null;
	energy: EnergyLevel | null;
	context: string | null;
	sort_order: number;
	source_file: string;
	source_line: number;
	created: string;
	modified: string;
	recurrence_rule: string | null;
	parent_task_id: string | null;
}

/** Plugin settings (persisted in data.json alongside tasks) */
export interface MLWSettings {
	projectFolder: string;
	captureLocation: CaptureLocation;
	inboxFile: string;
	areasOfFocus: AreaOfFocus[];
	contexts: string[];
	dateFormat: string;
	autoTransitionScheduled: boolean;
	reviewReminderDays: number;
	orphanGracePeriodDays: number;
	completedVisibilityDays: number;
	dataStoreBackup: boolean;
	lastReviewDate: string | null;
	chipDisplayMode: ChipDisplayMode;
	chipCycleModifier: "ctrl" | "shift";
}

/** The complete structure persisted to data.json */
export interface MLWData {
	tasks: Record<string, Task>;
	settings: MLWSettings;
}

/** Default colors for the first four AOFs, matching the mockup palette */
export const DEFAULT_AOF_COLORS: readonly AOFColor[] = [
	{ bg: "rgba(86, 156, 214, 0.15)", text: "#6CB6FF", border: "rgba(86, 156, 214, 0.3)" },
	{ bg: "rgba(181, 137, 214, 0.15)", text: "#C5A3E6", border: "rgba(181, 137, 214, 0.3)" },
	{ bg: "rgba(78, 185, 129, 0.15)", text: "#6BC98C", border: "rgba(78, 185, 129, 0.3)" },
	{ bg: "rgba(235, 160, 72, 0.15)", text: "#E8AE5C", border: "rgba(235, 160, 72, 0.3)" },
] as const;

/** Fallback color for AOFs beyond the first four */
export const FALLBACK_AOF_COLOR: AOFColor = {
	bg: "rgba(150, 150, 150, 0.15)",
	text: "#A0A0A0",
	border: "rgba(150, 150, 150, 0.3)",
};

export const DEFAULT_SETTINGS: MLWSettings = {
	projectFolder: "MLW/Projects",
	captureLocation: CaptureLocation.DailyNote,
	inboxFile: "MLW/Inbox.md",
	areasOfFocus: [],
	contexts: [],
	dateFormat: "YYYY-MM-DD",
	autoTransitionScheduled: true,
	reviewReminderDays: 7,
	orphanGracePeriodDays: 7,
	completedVisibilityDays: 1,
	dataStoreBackup: true,
	lastReviewDate: null,
	chipDisplayMode: ChipDisplayMode.Full,
	chipCycleModifier: "ctrl" as const,
};

export const DEFAULT_DATA: MLWData = {
	tasks: {},
	settings: { ...DEFAULT_SETTINGS },
};

/** Derive a full AOFColor from a single hex color. */
export function deriveAOFColor(hex: string): AOFColor {
	const r = parseInt(hex.slice(1, 3), 16);
	const g = parseInt(hex.slice(3, 5), 16);
	const b = parseInt(hex.slice(5, 7), 16);
	return {
		bg: `rgba(${r}, ${g}, ${b}, 0.15)`,
		text: hex,
		border: `rgba(${r}, ${g}, ${b}, 0.3)`,
	};
}

/** Re-assign sort_order values to match array position. */
export function reindexSortOrders(aofs: AreaOfFocus[]): void {
	for (let i = 0; i < aofs.length; i++) {
		const aof = aofs[i];
		if (aof !== undefined) {
			aof.sort_order = i;
		}
	}
}
