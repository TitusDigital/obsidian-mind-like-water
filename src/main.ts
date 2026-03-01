import { Plugin, normalizePath, Platform } from "obsidian";
import { DataStore } from "data/DataStore";
import { TaskStatus } from "data/models";
import { MLWSettingTab } from "settings/MLWSettings";
import { mlwEditorExtension } from "editor/ChipDecoration";
import { canTrackLine, trackTaskWithEditor } from "editor/trackTask";
import { registerCheckboxWatcher } from "editor/CheckboxWatcher";
import { QuickCaptureModal } from "capture/QuickCaptureModal";
import { UnifiedTaskView } from "views/UnifiedTaskView";
import { VIEW_TYPE_MLW_UNIFIED, UNIFIED_ICON } from "views/ViewConstants";
import { StatusBarWidget } from "widgets/StatusBarWidget";
import { runScheduler } from "services/SchedulerService";
import { registerFocusBlock, registerCompletedBlock } from "codeblocks/registerCodeblocks";

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

		this.addCommand({ id: "open-view", name: "Open Mind Like Water", callback: () => void this.openTab("focus") });

		// ── View ──────────────────────────────────────────────
		this.registerView(VIEW_TYPE_MLW_UNIFIED, (leaf) => new UnifiedTaskView(leaf, this.store));

		// ── Ribbon Icon + Badge ───────────────────────────────
		const ribbonEl = this.addRibbonIcon(UNIFIED_ICON, "Open Mind Like Water", () => {
			void this.openTab("focus");
		});
		ribbonEl.addClass("mlw-ribbon-inbox");
		this.ribbonBadgeEl = ribbonEl.createSpan("mlw-ribbon-badge");

		// ── Status Bar (desktop only) ─────────────────────────
		if (Platform.isDesktop) {
			this.statusBarWidget = new StatusBarWidget(this.addStatusBarItem(), this.store);
		}

		// ── Codeblock Processors ─────────────────────────────
		registerFocusBlock(this, this.store);
		registerCompletedBlock(this, this.store);

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
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_MLW_UNIFIED);
		void this.store.saveImmediate();
	}

	private async openTab(tabId: string): Promise<void> {
		const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_UNIFIED);
		if (leaves.length > 0 && leaves[0] !== undefined) {
			await this.app.workspace.revealLeaf(leaves[0]);
			(leaves[0].view as UnifiedTaskView).switchTab(tabId);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (leaf !== null) {
			await leaf.setViewState({ type: VIEW_TYPE_MLW_UNIFIED, active: true });
			await this.app.workspace.revealLeaf(leaf);
			(leaf.view as UnifiedTaskView).switchTab(tabId);
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
		for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_MLW_UNIFIED)) {
			const view = leaf.view as UnifiedTaskView;
			if (typeof view.refresh === "function") view.refresh();
		}
	}

	private async ensureProjectFolder(): Promise<void> {
		const folderPath = normalizePath(this.store.getSettings().projectFolder);
		const exists = await this.app.vault.adapter.exists(folderPath);
		if (!exists) await this.app.vault.createFolder(folderPath);
	}
}
