import { Modal, type App } from "obsidian";
import type { DataStore } from "data/DataStore";
import type { Task } from "data/models";

/**
 * Confirmation dialog when deleting a recurring task.
 * Offers "delete this instance only" vs "stop this recurring task".
 */
export class RecurrenceDeleteModal extends Modal {
	private resolved = false;

	constructor(
		app: App,
		private readonly store: DataStore,
		private readonly task: Task,
		private readonly onDone: () => void,
	) {
		super(app);
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("mlw-recurrence-delete");

		contentEl.createEl("h3", { text: "Delete recurring task?" });
		contentEl.createEl("p", {
			text: this.task.cached_text ?? `Task ${this.task.id}`,
			cls: "mlw-recurrence-delete__text",
		});

		const btnRow = contentEl.createDiv("mlw-recurrence-delete__buttons");

		const deleteOne = btnRow.createEl("button", { text: "Delete this instance only" });
		deleteOne.addEventListener("click", () => {
			this.store.deleteTask(this.task.id);
			this.resolved = true;
			this.close();
			this.onDone();
		});

		const stopAll = btnRow.createEl("button", { text: "Stop this recurring task", cls: "mod-warning" });
		stopAll.addEventListener("click", () => {
			const templateId = this.task.recurrence_template_id ?? this.task.id;
			// Suspend all instances in the chain
			for (const inst of this.store.getTasksByTemplateId(templateId)) {
				this.store.updateTask(inst.id, { recurrence_suspended: true });
			}
			// Delete the current instance
			this.store.deleteTask(this.task.id);
			this.resolved = true;
			this.close();
			this.onDone();
		});

		const cancel = btnRow.createEl("button", { text: "Cancel" });
		cancel.addEventListener("click", () => this.close());
	}

	onClose(): void {
		this.contentEl.empty();
	}
}

/** Returns true if the task is recurring and needs the delete confirmation dialog. */
export function isRecurringTask(task: Task): boolean {
	return task.recurrence_rule !== null;
}
