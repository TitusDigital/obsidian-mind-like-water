import { type App, TFile, normalizePath, Notice, moment } from "obsidian";
import { CaptureLocation } from "data/models";

interface DailyNotesConfig {
	folder: string;
	format: string;
}

/** Read the core daily-notes plugin config. Returns null if disabled. */
function getDailyNotesConfig(app: App): DailyNotesConfig | null {
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const internal = (app as any).internalPlugins;
	if (internal === undefined) return null;
	const plugin = internal.getPluginById?.("daily-notes");
	if (plugin === undefined || plugin === null || !plugin.enabled) return null;
	const opts = plugin.instance?.options;
	return {
		folder: (opts?.folder as string | undefined) ?? "",
		format: (opts?.format as string | undefined) ?? "YYYY-MM-DD",
	};
}

/** Ensure today's daily note exists, return the TFile. Null if plugin disabled. */
async function ensureTodaysDailyNote(app: App): Promise<TFile | null> {
	const config = getDailyNotesConfig(app);
	if (config === null) return null;

	const dateStr = moment().format(config.format || "YYYY-MM-DD");
	const folder = config.folder ? normalizePath(config.folder) : "";
	const filePath = normalizePath(folder ? `${folder}/${dateStr}.md` : `${dateStr}.md`);

	const existing = app.vault.getAbstractFileByPath(filePath);
	if (existing instanceof TFile) return existing;

	if (folder && !(await app.vault.adapter.exists(folder))) {
		await app.vault.createFolder(folder);
	}
	return await app.vault.create(filePath, "");
}

/** Ensure a file exists at the given path, creating it (with parent dirs) if needed. */
async function ensureFile(app: App, filePath: string, initial: string): Promise<TFile> {
	const path = normalizePath(filePath);
	const existing = app.vault.getAbstractFileByPath(path);
	if (existing instanceof TFile) return existing;

	const folderPath = path.substring(0, path.lastIndexOf("/"));
	if (folderPath && !(await app.vault.adapter.exists(folderPath))) {
		await app.vault.createFolder(folderPath);
	}
	return await app.vault.create(path, initial);
}

/** Resolve the capture target based on settings. Falls back to inbox file if daily notes disabled. */
export async function resolveCaptureTarget(
	app: App, captureLocation: CaptureLocation, inboxFilePath: string,
): Promise<TFile> {
	if (captureLocation === CaptureLocation.DailyNote) {
		const file = await ensureTodaysDailyNote(app);
		if (file !== null) return file;
		new Notice("Daily Notes plugin not enabled. Capturing to inbox file.");
	}
	return ensureFile(app, inboxFilePath, "# Inbox\n\n");
}
