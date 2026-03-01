import { type App, TFile, TFolder, normalizePath } from "obsidian";
import { ProjectStatus, type ProjectMeta } from "data/models";

/** Read all project files from the configured folder and return parsed metadata. */
export function readAllProjects(app: App, projectFolder: string): ProjectMeta[] {
	const folder = app.vault.getAbstractFileByPath(normalizePath(projectFolder));
	if (!(folder instanceof TFolder)) return [];

	const results: ProjectMeta[] = [];
	for (const child of folder.children) {
		if (!(child instanceof TFile) || child.extension !== "md") continue;
		const meta = parseProjectFile(app, child);
		if (meta !== null) results.push(meta);
	}
	return results;
}

/** Parse a single project file's frontmatter into ProjectMeta. */
function parseProjectFile(app: App, file: TFile): ProjectMeta | null {
	const cache = app.metadataCache.getFileCache(file);
	const fm = cache?.frontmatter;
	if (fm === undefined || fm === null) return null;
	if (fm.mlw_type !== "project") return null;

	return {
		filePath: file.path,
		title: String(fm.title ?? file.basename),
		status: parseStatus(String(fm.status ?? "active")),
		area_of_focus: String(fm.area_of_focus ?? ""),
		successful_outcome: String(fm.successful_outcome ?? ""),
		sort_order: Number(fm.sort_order ?? 0),
		created: String(fm.created ?? ""),
		modified: String(fm.modified ?? ""),
	};
}

function parseStatus(s: string): ProjectStatus {
	if (s === "someday") return ProjectStatus.Someday;
	if (s === "completed") return ProjectStatus.Completed;
	if (s === "on_hold") return ProjectStatus.OnHold;
	if (s === "dropped") return ProjectStatus.Dropped;
	return ProjectStatus.Active;
}

/** Update a project file's frontmatter status field. */
export async function updateProjectStatus(
	app: App, filePath: string, newStatus: ProjectStatus,
): Promise<void> {
	const file = app.vault.getAbstractFileByPath(filePath);
	if (!(file instanceof TFile)) return;
	await app.vault.process(file, (content) => {
		return content.replace(/^status:\s*.+$/m, `status: ${newStatus}`);
	});
}
