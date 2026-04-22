import type { Task } from "data/models";
import type { DataStore } from "data/DataStore";
import { getRecurrenceSummary, pauseTask, resumeTask } from "services/RecurrenceService";
import { createCalendarInput } from "components/CalendarPicker";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function localToday(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type UpdateFn = (field: string, value: unknown) => void;

interface Preset { label: string; rrule: string }

function buildPresets(refDate: Date): Preset[] {
	const dayCode = DAY_CODES[refDate.getDay()]!;
	const dayName = DAY_NAMES[refDate.getDay()]!;
	const monthDay = refDate.getDate();
	const monthNames = ["January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December"];
	const monthName = monthNames[refDate.getMonth()]!;
	return [
		{ label: "Every day", rrule: "RRULE:FREQ=DAILY" },
		{ label: "Every weekday", rrule: "RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
		{ label: `Every week on ${dayName}`, rrule: `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}` },
		{ label: `Every 2 weeks on ${dayName}`, rrule: `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode}` },
		{ label: `Monthly on the ${ordinal(monthDay)}`, rrule: `RRULE:FREQ=MONTHLY;BYMONTHDAY=${monthDay}` },
		{ label: `Yearly on ${monthName} ${monthDay}`, rrule: `RRULE:FREQ=YEARLY;BYMONTH=${refDate.getMonth() + 1};BYMONTHDAY=${monthDay}` },
	];
}

function ordinal(n: number): string {
	if (n === 1 || n === 21 || n === 31) return `${n}st`;
	if (n === 2 || n === 22) return `${n}nd`;
	if (n === 3 || n === 23) return `${n}rd`;
	return `${n}th`;
}

function matchPreset(presets: Preset[], rule: string | null): string {
	if (rule === null) return "";
	const match = presets.find(p => p.rrule === rule);
	return match !== undefined ? match.rrule : "custom";
}

/** Build the recurrence configuration section for the MetadataEditor popover. */
export function buildRecurrenceSection(task: Task, store: DataStore, updateField: UpdateFn): HTMLElement & { notifyStartDate: (d: string | null) => void } {
	const section = el("div", "mlw-recurrence-section") as unknown as HTMLElement & { notifyStartDate: (d: string | null) => void };
	const isRecurring = task.recurrence_rule !== null;

	// Toggle row
	const toggleRow = el("div", "mlw-recurrence-toggle");
	const toggleLabel = el("label", "mlw-editor-label", "Repeats");
	const toggle = document.createElement("input");
	toggle.type = "checkbox";
	toggle.className = "mlw-recurrence-toggle__input";
	toggle.checked = isRecurring;
	toggleRow.append(toggleLabel, toggle);
	section.appendChild(toggleRow);

	// Config container (shown only when recurring)
	const config = el("div", "mlw-recurrence-config");
	if (!isRecurring) config.style.display = "none";

	// Frequency preset — tracks current start_date for day-of-week labels
	let currentStartDate = task.start_date;
	const presetGroup = el("div", "mlw-editor-fields__group");
	presetGroup.appendChild(el("label", "mlw-editor-label", "Frequency"));
	const presetSelect = document.createElement("select");
	presetSelect.className = "mlw-editor-select";

	function rebuildPresetOptions(autoUpdateDay?: boolean): void {
		const refDate = currentStartDate !== null ? new Date(currentStartDate + "T00:00:00") : new Date();
		const presets = buildPresets(refDate);
		let prev = presetSelect.value;
		// When start_date changes, swap BYDAY in the current rule to match the new day
		if (autoUpdateDay === true && prev !== "" && prev !== "custom") {
			const newDay = DAY_CODES[refDate.getDay()]!;
			prev = prev.replace(/BYDAY=[A-Z,]+/, `BYDAY=${newDay}`);
			updateField("recurrence_rule", prev);
		}
		presetSelect.innerHTML = "";
		presetSelect.appendChild(optionEl("", "Choose..."));
		for (const p of presets) presetSelect.appendChild(optionEl(p.rrule, p.label));
		presetSelect.appendChild(optionEl("custom", "Custom..."));
		presetSelect.value = matchPreset(presets, prev || task.recurrence_rule);
	}
	rebuildPresetOptions();
	section.notifyStartDate = (d: string | null) => { currentStartDate = d; rebuildPresetOptions(true); };
	config.appendChild(presetGroup);
	presetGroup.appendChild(presetSelect);

	// Custom RRULE section
	const customSection = el("div", "mlw-recurrence-custom");
	customSection.style.display = presetSelect.value === "custom" ? "" : "none";
	buildCustomFields(customSection, task, updateField);
	config.appendChild(customSection);

	presetSelect.addEventListener("change", () => {
		if (presetSelect.value === "custom") {
			customSection.style.display = "";
		} else if (presetSelect.value !== "") {
			customSection.style.display = "none";
			updateField("recurrence_rule", presetSelect.value);
		}
	});

	// Recurrence type (fixed / relative)
	const typeGroup = el("div", "mlw-recurrence-type");
	typeGroup.appendChild(el("label", "mlw-editor-label", "Schedule type"));
	const typeContainer = el("div", "mlw-recurrence-type__options");
	const fixedRadio = buildRadio("recurrence_type", "fixed", "On schedule",
		"Next task appears on the scheduled date", task.recurrence_type === "fixed" || task.recurrence_type === null);
	const relativeRadio = buildRadio("recurrence_type", "relative", "After completion",
		"Next task appears after this one is completed", task.recurrence_type === "relative");
	typeContainer.append(fixedRadio.wrapper, relativeRadio.wrapper);
	typeGroup.appendChild(typeContainer);
	config.appendChild(typeGroup);

	fixedRadio.input.addEventListener("change", () => { if (fixedRadio.input.checked) updateField("recurrence_type", "fixed"); });
	relativeRadio.input.addEventListener("change", () => { if (relativeRadio.input.checked) updateField("recurrence_type", "relative"); });

	// End condition
	const endGroup = el("div", "mlw-editor-fields__group");
	endGroup.appendChild(el("label", "mlw-editor-label", "Ends"));
	const endSelect = document.createElement("select");
	endSelect.className = "mlw-editor-select";
	endSelect.appendChild(optionEl("never", "Never"));
	endSelect.appendChild(optionEl("count", "After N occurrences"));
	endSelect.appendChild(optionEl("until", "On date"));
	const endExtra = el("div", "mlw-recurrence-end-extra");
	endExtra.style.display = "none";
	const currentEnd = detectEndCondition(task.recurrence_rule);
	endSelect.value = currentEnd.type;
	if (currentEnd.type !== "never") endExtra.style.display = "";
	buildEndExtra(endExtra, currentEnd, task, updateField);
	endGroup.append(endSelect, endExtra);
	config.appendChild(endGroup);

	endSelect.addEventListener("change", () => {
		endExtra.innerHTML = "";
		endExtra.style.display = endSelect.value === "never" ? "none" : "";
		if (endSelect.value === "never") {
			// Strip COUNT/UNTIL from rule
			updateField("recurrence_rule", stripEndCondition(task.recurrence_rule));
		} else {
			buildEndExtra(endExtra, { type: endSelect.value as "count" | "until", value: "" }, task, updateField);
		}
	});

	// Pause toggle (only for already-recurring tasks)
	if (isRecurring) {
		const pauseBtn = document.createElement("button");
		pauseBtn.className = "mlw-recurrence-pause-btn" + (task.recurrence_suspended ? " mlw-recurrence-pause-btn--active" : "");
		pauseBtn.textContent = task.recurrence_suspended ? "Resume recurrence" : "Pause recurrence";
		pauseBtn.addEventListener("click", () => {
			if (task.recurrence_suspended) {
				void resumeTask(store, task.id);
			} else {
				pauseTask(store, task.id);
			}
			updateField("recurrence_suspended", !task.recurrence_suspended);
			pauseBtn.textContent = task.recurrence_suspended ? "Resume recurrence" : "Pause recurrence";
			pauseBtn.classList.toggle("mlw-recurrence-pause-btn--active", task.recurrence_suspended);
		});
		config.appendChild(pauseBtn);
	}

	// Summary
	if (isRecurring && task.recurrence_rule !== null) {
		const summary = el("div", "mlw-recurrence-summary", getRecurrenceSummary(task.recurrence_rule, task.recurrence_type));
		config.appendChild(summary);
	}

	section.appendChild(config);

	// Toggle handler
	toggle.addEventListener("change", () => {
		if (toggle.checked) {
			config.style.display = "";
			if (task.start_date === null) {
				const today = localToday();
				currentStartDate = today;
				updateField("start_date", today);
				rebuildPresetOptions();
			}
			updateField("recurrence_template_id", task.id);
			updateField("recurrence_spawn_count", 1);
			updateField("recurrence_type", "fixed");
			if (task.recurrence_rule === null) {
				updateField("recurrence_rule", "RRULE:FREQ=DAILY");
				presetSelect.value = "RRULE:FREQ=DAILY";
			}
		} else {
			config.style.display = "none";
			updateField("recurrence_rule", null);
			updateField("recurrence_type", null);
			updateField("recurrence_template_id", null);
			updateField("recurrence_suspended", false);
			updateField("recurrence_spawn_count", 0);
		}
	});

	return section;
}

function buildCustomFields(container: HTMLElement, task: Task, updateField: UpdateFn): void {
	const row = el("div", "mlw-recurrence-custom__row");
	const freqSelect = document.createElement("select");
	freqSelect.className = "mlw-editor-select";
	for (const [v, l] of [["DAILY", "Day(s)"], ["WEEKLY", "Week(s)"], ["MONTHLY", "Month(s)"], ["YEARLY", "Year(s)"]] as const) {
		freqSelect.appendChild(optionEl(v, l));
	}
	const intervalInput = document.createElement("input");
	intervalInput.type = "number";
	intervalInput.className = "mlw-editor-input mlw-recurrence-interval";
	intervalInput.min = "1"; intervalInput.max = "365"; intervalInput.value = "1";
	row.append(el("span", "mlw-recurrence-custom__label", "Every"), intervalInput, freqSelect);
	container.appendChild(row);
	const applyCustom = () => {
		const freq = freqSelect.value;
		const interval = parseInt(intervalInput.value) || 1;
		let rule = `RRULE:FREQ=${freq}`;
		if (interval > 1) rule += `;INTERVAL=${interval}`;
		updateField("recurrence_rule", rule);
	};
	freqSelect.addEventListener("change", applyCustom);
	intervalInput.addEventListener("change", applyCustom);
}

function detectEndCondition(rule: string | null): { type: "never" | "count" | "until"; value: string } {
	if (rule === null) return { type: "never", value: "" };
	const countMatch = /COUNT=(\d+)/.exec(rule);
	if (countMatch !== null) return { type: "count", value: countMatch[1]! };
	const untilMatch = /UNTIL=(\d{8})/.exec(rule);
	if (untilMatch !== null) {
		const u = untilMatch[1]!;
		return { type: "until", value: `${u.slice(0, 4)}-${u.slice(4, 6)}-${u.slice(6, 8)}` };
	}
	return { type: "never", value: "" };
}

function stripEndCondition(rule: string | null): string | null {
	if (rule === null) return null;
	return rule.replace(/;?COUNT=\d+/, "").replace(/;?UNTIL=\d+/, "");
}

function buildEndExtra(container: HTMLElement, current: { type: string; value: string }, task: Task, updateField: UpdateFn): void {
	if (current.type === "count") {
		const input = document.createElement("input");
		input.type = "number"; input.min = "1"; input.max = "999";
		input.className = "mlw-editor-input mlw-recurrence-interval";
		input.value = current.value || "10";
		input.addEventListener("change", () => {
			const base = stripEndCondition(task.recurrence_rule) ?? "RRULE:FREQ=DAILY";
			updateField("recurrence_rule", `${base};COUNT=${input.value}`);
		});
		container.append(el("span", "mlw-recurrence-custom__label", "After"), input, el("span", "mlw-recurrence-custom__label", "times"));
	} else if (current.type === "until") {
		// Convert RRULE UNTIL value (YYYYMMDD) to ISO format for the picker
		const isoVal = current.value.length === 8
			? `${current.value.slice(0, 4)}-${current.value.slice(4, 6)}-${current.value.slice(6, 8)}`
			: current.value;
		const input = createCalendarInput("mlw-editor-input", isoVal || null, (v) => {
			const base = stripEndCondition(task.recurrence_rule) ?? "RRULE:FREQ=DAILY";
			if (v === null) { updateField("recurrence_rule", base); return; }
			updateField("recurrence_rule", `${base};UNTIL=${v.replace(/-/g, "")}`);
		});
		container.appendChild(input);
	}
}

// ── Radio Button Helper ──────────────────────────────────────────

function buildRadio(name: string, value: string, label: string, desc: string, checked: boolean): { wrapper: HTMLElement; input: HTMLInputElement } {
	const wrapper = el("label", "mlw-recurrence-radio");
	const input = document.createElement("input");
	input.type = "radio"; input.name = name; input.value = value; input.checked = checked;
	wrapper.append(input, el("span", "mlw-recurrence-radio__label", label));
	wrapper.appendChild(el("span", "mlw-recurrence-radio__desc", desc));
	return { wrapper, input };
}

// ── DOM Helpers ──────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string): HTMLElementTagNameMap[K] {
	const e = document.createElement(tag); e.className = cls;
	if (text !== undefined) e.textContent = text; return e;
}

function optionEl(value: string, text: string): HTMLOptionElement {
	const opt = document.createElement("option"); opt.value = value; opt.textContent = text; return opt;
}
