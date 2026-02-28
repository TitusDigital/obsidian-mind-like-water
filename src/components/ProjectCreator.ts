import type { DataStore } from "data/DataStore";
import type { AOFColor } from "data/models";

/**
 * Inline project creation form displayed inside the MetadataEditor
 * when the user clicks "+" next to the Project dropdown.
 */
export class ProjectCreator {
	private nameInput!: HTMLInputElement;
	private outcomeInput!: HTMLInputElement;
	private createBtn!: HTMLButtonElement;

	constructor(
		private readonly container: HTMLElement,
		private readonly aofName: string,
		private readonly aofColor: AOFColor,
		private readonly store: DataStore,
		private readonly onCreated: (projectName: string) => void,
		private readonly onCancel: () => void,
	) {
		this.render();
	}

	private render(): void {
		this.container.empty();
		this.container.classList.add("mlw-project-creator");

		// Header row: label + AOF badge + close
		const header = this.container.createDiv("mlw-project-creator__header");
		header.createSpan({ text: "New Project", cls: "mlw-editor-label" });

		const badge = header.createSpan({ text: this.aofName, cls: "mlw-project-creator__aof-badge" });
		badge.style.backgroundColor = this.aofColor.bg;
		badge.style.color = this.aofColor.text;
		badge.style.borderColor = this.aofColor.border;

		const closeBtn = header.createSpan({ text: "\u00D7", cls: "mlw-project-creator__close" });
		closeBtn.addEventListener("click", () => this.onCancel());

		// Project name
		this.container.createEl("label", { text: "Name", cls: "mlw-editor-label" });
		this.nameInput = this.container.createEl("input", { cls: "mlw-editor-input" });
		this.nameInput.type = "text";
		this.nameInput.placeholder = "Project name";
		this.nameInput.addEventListener("input", () => this.updateCreateBtn());
		this.nameInput.addEventListener("keydown", (e) => this.handleKeyDown(e));

		// Successful outcome
		this.container.createEl("label", { text: "Successful Outcome *", cls: "mlw-editor-label" });
		this.outcomeInput = this.container.createEl("input", { cls: "mlw-editor-input" });
		this.outcomeInput.type = "text";
		this.outcomeInput.placeholder = "What does done look like?";
		this.outcomeInput.addEventListener("input", () => this.updateCreateBtn());
		this.outcomeInput.addEventListener("keydown", (e) => this.handleKeyDown(e));

		// Create button
		this.createBtn = this.container.createEl("button", {
			text: "Create Project",
			cls: "mlw-project-creator__btn",
		});
		this.createBtn.disabled = true;
		this.createBtn.addEventListener("click", () => void this.create());

		// Auto-focus name input
		requestAnimationFrame(() => this.nameInput.focus());
	}

	private updateCreateBtn(): void {
		this.createBtn.disabled =
			this.nameInput.value.trim() === "" || this.outcomeInput.value.trim() === "";
	}

	private handleKeyDown(e: KeyboardEvent): void {
		if (e.key === "Escape") {
			e.preventDefault();
			e.stopPropagation();
			this.onCancel();
		} else if (e.key === "Enter") {
			e.preventDefault();
			e.stopPropagation();
			if (e.target === this.nameInput) {
				this.outcomeInput.focus();
			} else if (!this.createBtn.disabled) {
				void this.create();
			}
		}
	}

	private async create(): Promise<void> {
		const name = this.nameInput.value.trim();
		const outcome = this.outcomeInput.value.trim();
		if (name === "" || outcome === "") return;

		this.createBtn.disabled = true;
		this.createBtn.textContent = "Creating\u2026";

		await this.store.createProjectFile(this.aofName, name, outcome);
		this.onCreated(name);
	}
}
