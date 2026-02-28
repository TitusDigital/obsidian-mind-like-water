import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
	resolve: {
		alias: {
			data: path.resolve(__dirname, "src/data"),
			editor: path.resolve(__dirname, "src/editor"),
			components: path.resolve(__dirname, "src/components"),
			capture: path.resolve(__dirname, "src/capture"),
			views: path.resolve(__dirname, "src/views"),
			widgets: path.resolve(__dirname, "src/widgets"),
			services: path.resolve(__dirname, "src/services"),
			settings: path.resolve(__dirname, "src/settings"),
			// Obsidian and CM6 are externals at runtime; stub them for tests
			obsidian: path.resolve(__dirname, "src/__mocks__/obsidian.ts"),
			"@codemirror/view": path.resolve(__dirname, "src/__mocks__/codemirror-view.ts"),
		},
	},
	test: {
		include: ["src/**/*.test.ts"],
	},
});
