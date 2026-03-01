const MONTH_NAMES = [
	"January", "February", "March", "April", "May", "June",
	"July", "August", "September", "October", "November", "December",
];
const DOW_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

let activePicker: CalendarPicker | null = null;

function localTodayStr(): string {
	const d = new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function fmt(y: number, m: number, d: number): string {
	return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Format an ISO date string for display: "Mar 1, 2026" */
export function formatDateDisplay(iso: string): string {
	const [y, m, d] = iso.split("-");
	const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	return `${names[parseInt(m!) - 1]} ${parseInt(d!)}, ${y}`;
}

/** Create a date text input wired to a CalendarPicker dropdown. */
export function createCalendarInput(
	className: string,
	value: string | null,
	onChange: (value: string | null) => void,
): HTMLInputElement {
	const input = document.createElement("input");
	input.type = "text";
	input.readOnly = true;
	input.className = `${className} mlw-editor-input--date`;
	input.value = value !== null ? formatDateDisplay(value) : "";
	input.placeholder = "None";
	input.addEventListener("click", () => {
		new CalendarPicker(input, value, (v) => {
			value = v;
			input.value = formatDateDisplay(v);
			onChange(v);
		}, () => {
			value = null;
			input.value = "";
			onChange(null);
		});
	});
	return input;
}

// ── CalendarPicker ──────────────────────────────────────────────

class CalendarPicker {
	private overlay: HTMLDivElement;
	private dropdown: HTMLDivElement;
	private grid: HTMLDivElement;
	private titleEl: HTMLSpanElement;
	private month: number;
	private year: number;
	private selected: string | null;
	private readonly onSelect: (value: string) => void;
	private readonly onClear: () => void;

	constructor(
		private readonly anchorEl: HTMLElement,
		initialValue: string | null,
		onSelect: (value: string) => void,
		onClear: () => void,
	) {
		if (activePicker !== null) activePicker.close();
		activePicker = this;
		this.onSelect = onSelect;
		this.onClear = onClear;
		this.selected = initialValue;

		// Determine initial month/year
		if (initialValue !== null) {
			const [y, m] = initialValue.split("-").map(Number);
			this.year = y!;
			this.month = m! - 1;
		} else {
			const now = new Date();
			this.year = now.getFullYear();
			this.month = now.getMonth();
		}

		// Overlay
		this.overlay = document.createElement("div");
		this.overlay.className = "mlw-cal-overlay";
		this.overlay.addEventListener("mousedown", (e) => { e.preventDefault(); this.close(); });

		// Dropdown
		this.dropdown = document.createElement("div");
		this.dropdown.className = "mlw-cal";

		// Header
		const header = document.createElement("div");
		header.className = "mlw-cal__header";
		const prevBtn = document.createElement("button");
		prevBtn.className = "mlw-cal__nav";
		prevBtn.textContent = "\u25C0";
		prevBtn.addEventListener("click", () => this.navigate(-1));
		const nextBtn = document.createElement("button");
		nextBtn.className = "mlw-cal__nav";
		nextBtn.textContent = "\u25B6";
		nextBtn.addEventListener("click", () => this.navigate(1));
		this.titleEl = document.createElement("span");
		this.titleEl.className = "mlw-cal__title";
		header.append(prevBtn, this.titleEl, nextBtn);
		this.dropdown.appendChild(header);

		// Grid
		this.grid = document.createElement("div");
		this.grid.className = "mlw-cal__grid";
		this.dropdown.appendChild(this.grid);

		// Footer
		const footer = document.createElement("div");
		footer.className = "mlw-cal__footer";
		const todayBtn = document.createElement("button");
		todayBtn.className = "mlw-cal__today";
		todayBtn.textContent = "Today";
		todayBtn.addEventListener("click", () => { this.selectDate(localTodayStr()); });
		const clearBtn = document.createElement("button");
		clearBtn.className = "mlw-cal__clear";
		clearBtn.textContent = "Clear";
		clearBtn.addEventListener("click", () => { this.onClear(); this.close(); });
		footer.append(todayBtn, clearBtn);
		this.dropdown.appendChild(footer);

		// Escape key
		this.dropdown.addEventListener("keydown", (e) => { if (e.key === "Escape") this.close(); });

		document.body.append(this.overlay, this.dropdown);
		this.renderMonth();
		this.position();
	}

	private navigate(delta: number): void {
		this.month += delta;
		if (this.month < 0) { this.month = 11; this.year--; }
		if (this.month > 11) { this.month = 0; this.year++; }
		this.renderMonth();
	}

	private renderMonth(): void {
		this.titleEl.textContent = `${MONTH_NAMES[this.month]} ${this.year}`;
		this.grid.innerHTML = "";

		// Day-of-week headers
		for (const dow of DOW_HEADERS) {
			const cell = document.createElement("div");
			cell.className = "mlw-cal__dow";
			cell.textContent = dow;
			this.grid.appendChild(cell);
		}

		const today = localTodayStr();
		const firstDay = new Date(this.year, this.month, 1).getDay();
		const daysInMonth = new Date(this.year, this.month + 1, 0).getDate();
		const daysInPrev = new Date(this.year, this.month, 0).getDate();

		// Previous month trailing days
		for (let i = firstDay - 1; i >= 0; i--) {
			const day = daysInPrev - i;
			const m = this.month === 0 ? 11 : this.month - 1;
			const y = this.month === 0 ? this.year - 1 : this.year;
			this.addDayCell(fmt(y, m, day), day, true, today);
		}
		// Current month
		for (let d = 1; d <= daysInMonth; d++) {
			this.addDayCell(fmt(this.year, this.month, d), d, false, today);
		}
		// Next month leading days (fill to 42 cells total = 6 rows)
		const totalCells = this.grid.children.length;
		const remaining = 42 + 7 - totalCells; // +7 for dow headers
		for (let d = 1; d <= remaining; d++) {
			const m = this.month === 11 ? 0 : this.month + 1;
			const y = this.month === 11 ? this.year + 1 : this.year;
			this.addDayCell(fmt(y, m, d), d, true, today);
		}
	}

	private addDayCell(dateStr: string, day: number, outside: boolean, today: string): void {
		const cell = document.createElement("div");
		cell.className = "mlw-cal__day";
		cell.textContent = String(day);
		if (outside) cell.classList.add("mlw-cal__day--outside");
		if (dateStr === today) cell.classList.add("mlw-cal__day--today");
		if (dateStr === this.selected) cell.classList.add("mlw-cal__day--selected");
		cell.addEventListener("click", () => this.selectDate(dateStr));
		this.grid.appendChild(cell);
	}

	private selectDate(dateStr: string): void {
		this.onSelect(dateStr);
		this.close();
	}

	private position(): void {
		const rect = this.anchorEl.getBoundingClientRect();
		const calWidth = 260;
		const calHeight = 310;
		let top = rect.bottom + 4;
		if (top + calHeight > window.innerHeight) top = rect.top - calHeight - 4;
		const left = Math.max(8, Math.min(rect.left, window.innerWidth - calWidth - 8));
		this.dropdown.style.top = `${top}px`;
		this.dropdown.style.left = `${left}px`;
	}

	private close(): void {
		if (activePicker === this) activePicker = null;
		this.overlay.remove();
		this.dropdown.remove();
	}
}
