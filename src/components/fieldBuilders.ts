import { TaskStatus, EnergyLevel } from "data/models";
import { createCalendarInput } from "components/CalendarPicker";

/** Status enum → human-readable labels */
export const STATUS_LABELS: Record<string, string> = {
	[TaskStatus.Inbox]: "Inbox",
	[TaskStatus.Active]: "Active",
	[TaskStatus.Waiting]: "Waiting",
	[TaskStatus.Scheduled]: "Scheduled",
	[TaskStatus.Someday]: "Someday / Maybe",
	[TaskStatus.Done]: "Done",
	[TaskStatus.Dropped]: "Dropped",
	[TaskStatus.Archived]: "Archived",
};

export const ENERGY_LABELS: Record<string, string> = {
	[EnergyLevel.Low]: "Low",
	[EnergyLevel.Medium]: "Medium",
	[EnergyLevel.High]: "High",
};

/** Create a labeled <select> field group. */
export function createSelectGroup(
	label: string, value: string,
	options: Record<string, string>,
	onChange: (value: string) => void,
	autoFocus = false,
): HTMLElement {
	const group = document.createElement("div");
	group.className = "mlw-editor-fields__group";
	const lbl = document.createElement("label");
	lbl.className = "mlw-editor-label";
	lbl.textContent = label;
	group.appendChild(lbl);

	const select = document.createElement("select");
	select.className = "mlw-editor-select";
	for (const [val, text] of Object.entries(options)) {
		const opt = document.createElement("option");
		opt.value = val;
		opt.textContent = text;
		if (val === value) opt.selected = true;
		select.appendChild(opt);
	}
	select.addEventListener("change", () => onChange(select.value));
	if (autoFocus) select.autofocus = true;
	group.appendChild(select);
	return group;
}

/** Create a labeled date field group with calendar dropdown picker. */
export function createDateGroup(
	label: string, value: string | null,
	onChange: (value: string) => void,
): HTMLElement {
	const group = document.createElement("div");
	group.className = "mlw-editor-fields__group";
	const lbl = document.createElement("label");
	lbl.className = "mlw-editor-label";
	lbl.textContent = label;
	group.appendChild(lbl);

	const input = createCalendarInput("mlw-editor-input", value, (v) => onChange(v ?? ""));
	group.appendChild(input);
	return group;
}

/** Populate a <select> with option elements. */
export function populateSelect(
	select: HTMLSelectElement,
	items: string[],
	selectedValue: string | null,
	noneLabel = "None",
): void {
	select.innerHTML = "";
	const noneOpt = document.createElement("option");
	noneOpt.value = "";
	noneOpt.textContent = noneLabel;
	select.appendChild(noneOpt);
	for (const name of items) {
		const opt = document.createElement("option");
		opt.value = name;
		opt.textContent = name;
		if (name === selectedValue) opt.selected = true;
		select.appendChild(opt);
	}
}
