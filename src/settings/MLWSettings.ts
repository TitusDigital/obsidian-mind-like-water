import { PluginSettingTab, Setting, App, Notice } from "obsidian";
import type MindLikeWaterPlugin from "main";
import {
	type AreaOfFocus,
	CaptureLocation,
	ChipDisplayMode,
	DEFAULT_AOF_COLORS,
	FALLBACK_AOF_COLOR,
	deriveAOFColor,
	reindexSortOrders,
} from "data/models";

export class MLWSettingTab extends PluginSettingTab {
	private plugin: MindLikeWaterPlugin;

	constructor(app: App, plugin: MindLikeWaterPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h1", { text: "Mind Like Water" });
		containerEl.createEl("p", {
			text: "GTD-powered task management for Obsidian.",
			cls: "setting-item-description",
		});
		this.renderGeneralSettings(containerEl);
		this.renderAreasOfFocus(containerEl);
		this.renderContexts(containerEl);
		this.renderAdvancedSettings(containerEl);
	}

	private renderGeneralSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("General").setHeading();
		const s = this.plugin.store.getSettings();
		const upd = (p: Parameters<typeof this.plugin.store.updateSettings>[0]) => this.plugin.store.updateSettings(p);

		new Setting(containerEl).setName("Project folder").setDesc("Vault folder where project files are stored.")
			.addText(t => t.setPlaceholder("MLW/Projects").setValue(s.projectFolder).onChange(v => upd({ projectFolder: v })));
		new Setting(containerEl).setName("Capture location").setDesc("Where Quick Capture places new tasks.")
			.addDropdown(d => d.addOption(CaptureLocation.DailyNote, "Daily note").addOption(CaptureLocation.InboxFile, "Inbox file")
				.setValue(s.captureLocation).onChange(v => upd({ captureLocation: v as CaptureLocation })));
		new Setting(containerEl).setName("Inbox file").setDesc("File for captured tasks when not using daily notes.")
			.addText(t => t.setPlaceholder("MLW/Inbox.md").setValue(s.inboxFile).onChange(v => upd({ inboxFile: v })));
		new Setting(containerEl).setName("Chip display mode").setDesc("Detail level for inline task chips in the editor.")
			.addDropdown(d => d.addOption(ChipDisplayMode.Full, "Full (all metadata)").addOption(ChipDisplayMode.Compact, "Compact (AOF only)")
				.addOption(ChipDisplayMode.Dot, "Dot (colored circle)").setValue(s.chipDisplayMode)
				.onChange(v => { upd({ chipDisplayMode: v as ChipDisplayMode }); this.plugin.refreshEditorChips(); }));
		new Setting(containerEl).setName("Chip cycle modifier").setDesc("Hold this key and click a chip to cycle display mode.")
			.addDropdown(d => d.addOption("ctrl", "Ctrl+click").addOption("shift", "Shift+click")
				.setValue(s.chipCycleModifier).onChange(v => upd({ chipCycleModifier: v as "ctrl" | "shift" })));
	}

	private renderAreasOfFocus(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Areas of focus").setHeading();
		const aofs = this.plugin.store.getSettings().areasOfFocus;
		for (let i = 0; i < aofs.length; i++) {
			const aof = aofs[i];
			if (aof === undefined) continue;
			this.renderAOFItem(containerEl, aof, i, aofs);
		}
		this.renderAddAOF(containerEl, aofs);
	}

	private renderAOFItem(
		containerEl: HTMLElement, aof: AreaOfFocus,
		index: number, aofs: AreaOfFocus[],
	): void {
		const setting = new Setting(containerEl).setName(aof.name);

		const swatchEl = setting.controlEl.createEl("span", { cls: "mlw-color-swatch" });
		Object.assign(swatchEl.style, {
			display: "inline-block", width: "24px", height: "24px",
			borderRadius: "4px", marginRight: "8px", verticalAlign: "middle",
			backgroundColor: aof.color.bg, border: `1px solid ${aof.color.border}`,
			color: aof.color.text, fontSize: "10px", lineHeight: "24px",
			textAlign: "center", fontFamily: "monospace",
		});
		swatchEl.textContent = "Aa";

		setting.addColorPicker(picker => picker
			.setValue(aof.color.text)
			.onChange(hexValue => {
				aof.color = deriveAOFColor(hexValue);
				this.plugin.store.updateSettings({ areasOfFocus: [...aofs] });
				this.display();
			})
		);

		if (index > 0) {
			setting.addExtraButton(btn => btn
				.setIcon("arrow-up").setTooltip("Move up")
				.onClick(() => { this.swapAOFs(aofs, index, index - 1); this.display(); })
			);
		}
		if (index < aofs.length - 1) {
			setting.addExtraButton(btn => btn
				.setIcon("arrow-down").setTooltip("Move down")
				.onClick(() => { this.swapAOFs(aofs, index, index + 1); this.display(); })
			);
		}

		setting.addExtraButton(btn => btn
			.setIcon("trash").setTooltip("Delete")
			.onClick(() => {
				const taskCount = this.plugin.store.getAllTasks()
					.filter(t => t.area_of_focus === aof.name).length;
				if (taskCount > 0) {
					new Notice(
						`Cannot delete "${aof.name}" — ${taskCount} task(s) still reference it.`
					);
					return;
				}
				aofs.splice(index, 1);
				reindexSortOrders(aofs);
				this.plugin.store.updateSettings({ areasOfFocus: [...aofs] });
				this.display();
			})
		);
	}

	private renderAddAOF(containerEl: HTMLElement, aofs: AreaOfFocus[]): void {
		let newAOFName = "";
		new Setting(containerEl)
			.setName("Add area of focus")
			.addText(text => text
				.setPlaceholder("e.g. Work, Personal, Health")
				.onChange(value => { newAOFName = value; })
			)
			.addButton(btn => btn
				.setButtonText("Add").setCta()
				.onClick(() => {
					const trimmed = newAOFName.trim();
					if (trimmed === "") {
						new Notice("Area of focus name cannot be empty.");
						return;
					}
					if (aofs.some(a => a.name === trimmed)) {
						new Notice(`"${trimmed}" already exists.`);
						return;
					}
					const colorIndex = aofs.length % DEFAULT_AOF_COLORS.length;
					const color = DEFAULT_AOF_COLORS[colorIndex] ?? FALLBACK_AOF_COLOR;
					aofs.push({ name: trimmed, sort_order: aofs.length, color: { ...color } });
					this.plugin.store.updateSettings({ areasOfFocus: [...aofs] });
					this.display();
				})
			);
	}

	private renderContexts(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Contexts").setHeading();
		const contexts = this.plugin.store.getSettings().contexts;

		for (let i = 0; i < contexts.length; i++) {
			const ctx = contexts[i];
			if (ctx === undefined) continue;
			new Setting(containerEl)
				.setName(ctx)
				.addExtraButton(btn => btn
					.setIcon("trash").setTooltip("Delete")
					.onClick(() => {
						contexts.splice(i, 1);
						this.plugin.store.updateSettings({ contexts: [...contexts] });
						this.display();
					})
				);
		}

		let newContext = "";
		new Setting(containerEl)
			.setName("Add context")
			.setDesc("GTD context tags like @computer, @phone, @errands")
			.addText(text => text
				.setPlaceholder("@computer")
				.onChange(value => { newContext = value; })
			)
			.addButton(btn => btn
				.setButtonText("Add").setCta()
				.onClick(() => {
					const trimmed = newContext.trim();
					if (trimmed === "") return;
					if (contexts.includes(trimmed)) {
						new Notice(`"${trimmed}" already exists.`);
						return;
					}
					contexts.push(trimmed);
					this.plugin.store.updateSettings({ contexts: [...contexts] });
					this.display();
				})
			);
	}

	private renderAdvancedSettings(containerEl: HTMLElement): void {
		new Setting(containerEl).setName("Advanced").setHeading();

		new Setting(containerEl)
			.setName("Auto-transition scheduled tasks")
			.setDesc("Move scheduled tasks to Next Action when their start date arrives.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.store.getSettings().autoTransitionScheduled)
				.onChange(value => {
					this.plugin.store.updateSettings({ autoTransitionScheduled: value });
				})
			);

		new Setting(containerEl)
			.setName("Completed task visibility (days)")
			.setDesc("How many days to show completed items in the Next Actions view.")
			.addText(text => text
				.setValue(String(this.plugin.store.getSettings().completedVisibilityDays))
				.onChange(value => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.store.updateSettings({ completedVisibilityDays: parsed });
					}
				})
			);

		new Setting(containerEl)
			.setName("Review reminder (days)")
			.setDesc("Days between periodic review reminders.")
			.addText(text => text
				.setValue(String(this.plugin.store.getSettings().reviewReminderDays))
				.onChange(value => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.store.updateSettings({ reviewReminderDays: parsed });
					}
				})
			);

		new Setting(containerEl)
			.setName("Orphan grace period (days)")
			.setDesc("Days before orphaned task entries are automatically cleaned up.")
			.addText(text => text
				.setValue(String(this.plugin.store.getSettings().orphanGracePeriodDays))
				.onChange(value => {
					const parsed = parseInt(value, 10);
					if (!isNaN(parsed) && parsed > 0) {
						this.plugin.store.updateSettings({ orphanGracePeriodDays: parsed });
					}
				})
			);

		new Setting(containerEl)
			.setName("Data store backup")
			.setDesc("Create a backup of data.json each time the vault loads.")
			.addToggle(toggle => toggle
				.setValue(this.plugin.store.getSettings().dataStoreBackup)
				.onChange(value => {
					this.plugin.store.updateSettings({ dataStoreBackup: value });
				})
			);
	}

	private swapAOFs(aofs: AreaOfFocus[], i: number, j: number): void {
		const temp = aofs[i];
		const aofJ = aofs[j];
		if (temp === undefined || aofJ === undefined) return;
		aofs[i] = aofJ;
		aofs[j] = temp;
		reindexSortOrders(aofs);
		this.plugin.store.updateSettings({ areasOfFocus: [...aofs] });
	}
}
