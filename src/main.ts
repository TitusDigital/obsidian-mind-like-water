import { Plugin, normalizePath, Platform } from "obsidian";
import { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { MLWSettingTab } from "settings/MLWSettings";
import { mlwEditorExtension } from "editor/ChipDecoration";
import { canTrackLine, trackTaskWithEditor } from "editor/trackTask";
import { registerCheckboxWatcher } from "editor/CheckboxWatcher";
import { QuickCaptureModal } from "capture/QuickCaptureModal";
import { InboxView } from "views/InboxView";
import { VIEW_TYPE_MLW_INBOX, INBOX_ICON } from "views/InboxViewConstants";
import { NextActionsView } from "views/NextActionsView";
import { ScheduledView } from "views/ScheduledView";
import { SomedayView } from "views/SomedayView";
import { CompletedView } from "views/CompletedView";
import {
	VIEW_TYPE_MLW_NEXT_ACTIONS,
	VIEW_TYPE_MLW_SCHEDULED,
	VIEW_TYPE_MLW_SOMEDAY,
	VIEW_TYPE_MLW_COMPLETED,
} from "views/ViewConstants";
import { BaseTaskView } from "views/BaseTaskView";
import { StatusBarWidget } from "widgets/StatusBarWidget";
import { runScheduler } from "services/SchedulerService";

/** All registered view types for cleanup and refresh. */
const ALL_VIEW_TYPES = [
	VIEW_TYPE_MLW_INBOX,
	VIEW_TYPE_MLW_NEXT_ACTIONS,
	VIEW_TYPE_MLW_SCHEDULED,
	VIEW_TYPE_MLW_SOMEDAY,
	VIEW_TYPE_MLW_COMPLETED,
] as const;

export default class MindLikeWaterPlugin extends Plugin {
	store!: DataStore;
	private statusBarWidget: StatusBarWidget | null = null;
	private ribbonBadgeEl!: HTMLSpanElement;

	async onload(): Promise<void> {
		console.log("Loading Mind Like Water plugin");

		this.store = new DataStore(this);
		await this.store.load();

		this.addSettingTab(new MLWSettingTab(this.app, this));
		this.registerEditorExtension(mlwEditorExtension(this.store));

		// ── Commands ───────────────────────────────────────────
		this.addCommand({
			id: "track-task",
			name: "Track Task",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "t" }],
			editorCheckCallback: (checking, editor, ctx) => {
				const cursor = editor.getCursor();
				const lineText = editor.getLine(cursor.line);
				if (!canTrackLine(lineText)) return false;
				if (!checking) trackTaskWithEditor(editor, ctx, this.store);
				return true;
			},
		});

		this.addCommand({
			id: "quick-capture",
			name: "Quick Capture",
			hotkeys: [{ modifiers: ["Mod", "Shift"], key: "q" }],
			callback: () => {
				new QuickCaptureModal(this.app, this.store).open();
			},
		});

		this.addCommand({ id: "open-inbox", name: "Open Inbox", callback: () => void this.activateView(VIEW_TYPE_MLW_INBOX) });
		this.addCommand({ id: "open-next-actions", name: "Open Next Actions", callback: () => void this.activateView(VIEW_TYPE_MLW_NEXT_ACTIONS) });
		this.addCommand({ id: "open-scheduled", name: "Open Scheduled", callback: () => void this.activateView(VIEW_TYPE_MLW_SCHEDULED) });
		this.addCommand({ id: "open-someday", name: "Open Someday/Maybe", callback: () => void this.activateView(VIEW_TYPE_MLW_SOMEDAY) });
		this.addCommand({ id: "open-completed", name: "Open Completed", callback: () => void this.activateView(VIEW_TYPE_MLW_COMPLETED) });

		// ── Views ─────────────────────────────────────────────
		this.registerView(VIEW_TYPE_MLW_INBOX, (leaf) => new InboxView(leaf, this.store));
		this.registerView(VIEW_TYPE_MLW_NEXT_ACTIONS, (leaf) => new NextActionsView(leaf, this.store));
		this.registerView(VIEW_TYPE_MLW_SCHEDULED, (leaf) => new ScheduledView(leaf, this.store));
		this.registerView(VIEW_TYPE_MLW_SOMEDAY, (leaf) => new SomedayView(leaf, this.store));
		this.registerView(VIEW_TYPE_MLW_COMPLETED, (leaf) => new CompletedView(leaf, this.store));

		// ── Ribbon Icon + Badge ───────────────────────────────
		const ribbonEl = this.addRibbonIcon(INBOX_ICON, "Open Inbox", () => {
			void this.activateView(VIEW_TYPE_MLW_INBOX);
		});
		ribbonEl.addClass("mlw-ribbon-inbox");
		this.ribbonBadgeEl = ribbonEl.createSpan("mlw-ribbon-badge");

		// ── Status Bar (desktop only) ─────────────────────────
		if (Platform.isDesktop) {
			this.statusBarWidget = new StatusBarWidget(this.addStatusBarItem(), this.store);
		}

		// ── Checkbox Watcher ──────────────────────────────────
		registerCheckboxWatcher(this, this.store);

		// ── Scheduler (auto-transition scheduled tasks) ───────
		const transitioned = runScheduler(this.store);
		if (transitioned > 0) {
			console.log(`MLW: Transitioned ${transitioned} scheduled task(s) to Next Action`);
		}

		// ── Reactive Updates ──────────────────────────────────
		this.store.setOnChange(() => this.onTasksChanged());

		// Refresh views when any markdown file changes (catches text renames)
		let fileChangeTimer: ReturnType<typeof setTimeout> | null = null;
		this.registerEvent(
			this.app.vault.on("modify", () => {
				if (fileChangeTimer !== null) clearTimeout(fileChangeTimer);
				fileChangeTimer = setTimeout(() => {
					fileChangeTimer = null;
					this.refreshAllViews();
				}, 200);
			}),
		);

		await this.ensureProjectFolder();
	}

	onunload(): void {
		console.log("Unloading Mind Like Water plugin");
		for (const vt of ALL_VIEW_TYPES) {
			this.app.workspace.detachLeavesOfType(vt);
		}
		void this.store.saveImmediate();
	}

	private async activateView(viewType: string): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(viewType);
		if (leaves.length > 0 && leaves[0] !== undefined) {
			await this.app.workspace.revealLeaf(leaves[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf !== null) {
			await leaf.setViewState({ type: viewType, active: true });
			await this.app.workspace.revealLeaf(leaf);
		}
	}

	private onTasksChanged(): void {
		this.statusBarWidget?.update();

		const count = this.store.getTaskCountByStatus(TaskStatus.Inbox);
		if (count > 0) {
			this.ribbonBadgeEl.textContent = count > 99 ? "99+" : String(count);
			this.ribbonBadgeEl.style.display = "";
		} else {
			this.ribbonBadgeEl.style.display = "none";
		}

		this.refreshAllViews();
	}

	private refreshAllViews(): void {
		for (const vt of ALL_VIEW_TYPES) {
			for (const leaf of this.app.workspace.getLeavesOfType(vt)) {
				const view = leaf.view as BaseTaskView;
				if (typeof view.refresh === "function") {
					view.refresh();
				}
			}
		}
	}

	private async ensureProjectFolder(): Promise<void> {
		const folderPath = normalizePath(this.store.getSettings().projectFolder);
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) await this.app.vault.createFolder(folderPath);
	}
}
