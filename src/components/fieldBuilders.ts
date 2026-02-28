import { TaskStatus, EnergyLevel } from "data/models";

/** Status enum → human-readable labels */
export const STATUS_LABELS: Record<string, string> = {
	[TaskStatus.Inbox]: "Inbox",
	[TaskStatus.NextAction]: "Next Action",
	[TaskStatus.Scheduled]: "Scheduled",
	[TaskStatus.Someday]: "Someday / Maybe",
	[TaskStatus.Completed]: "Completed",
	[TaskStatus.Dropped]: "Dropped",
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

/** Create a labeled <input type="date"> field group. */
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

	const input = document.createElement("input");
	input.type = "date";
	input.className = "mlw-editor-input";
	input.value = value ?? "";
	input.addEventListener("change", () => onChange(input.value));
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
