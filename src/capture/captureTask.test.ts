import { describe, it, expect } from "vitest";

/**
 * Test the line-building and line-number logic used by captureTask.
 * The actual function depends on Obsidian Vault APIs, so we test the
 * pure logic pieces extracted here.
 */

/** Build a checkbox line with MLW comment (mirrors captureTask logic). */
function buildCheckboxLine(taskText: string, id: string): string {
	return `- [ ] ${taskText} <!-- mlw:${id} -->`;
}

/** Calculate the 1-based line number of the last non-empty line after appending. */
function calcLineNumber(existingContent: string, newLine: string): number {
	let content = existingContent;
	if (content.length > 0 && !content.endsWith("\n")) {
		content += "\n";
	}
	content += newLine + "\n";
	return content.trimEnd().split("\n").length;
}

describe("buildCheckboxLine", () => {
	it("builds correct format with task text and id", () => {
		expect(buildCheckboxLine("Buy groceries", "abc123"))
			.toBe("- [ ] Buy groceries <!-- mlw:abc123 -->");
	});

	it("handles empty task text", () => {
		expect(buildCheckboxLine("", "xyz789"))
			.toBe("- [ ]  <!-- mlw:xyz789 -->");
	});
});

describe("calcLineNumber", () => {
	it("returns 1 for appending to empty file", () => {
		expect(calcLineNumber("", "- [ ] task")).toBe(1);
	});

	it("returns correct line when file has content", () => {
		expect(calcLineNumber("# Title\n\nSome text\n", "- [ ] task")).toBe(4);
	});

	it("handles file without trailing newline", () => {
		expect(calcLineNumber("line1\nline2", "- [ ] task")).toBe(3);
	});

	it("handles file with multiple trailing newlines", () => {
		expect(calcLineNumber("line1\n\n\n", "- [ ] task")).toBe(4);
	});

	it("handles single line file", () => {
		expect(calcLineNumber("# Inbox", "- [ ] task")).toBe(2);
	});
});
