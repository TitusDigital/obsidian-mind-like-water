import { describe, it, expect } from "vitest";
import { insertAtTop, insertAtBottom, insertUnderHeading } from "./captureTask";

const LINE = "- [ ] Buy groceries <!-- mlw:abc123 -->";

// ── insertAtBottom ────────────────────────────────────────────────────────────

describe("insertAtBottom", () => {
	it("appends to empty file", () => {
		const { newContent, lineNumber } = insertAtBottom("", LINE);
		expect(newContent).toBe(LINE + "\n");
		expect(lineNumber).toBe(1);
	});

	it("appends after existing content with trailing newline", () => {
		const { newContent, lineNumber } = insertAtBottom("# Title\n\nSome text\n", LINE);
		expect(newContent).toBe("# Title\n\nSome text\n" + LINE + "\n");
		expect(lineNumber).toBe(4);
	});

	it("adds newline before appending when file has no trailing newline", () => {
		const { newContent, lineNumber } = insertAtBottom("line1\nline2", LINE);
		expect(newContent).toBe("line1\nline2\n" + LINE + "\n");
		expect(lineNumber).toBe(3);
	});
});

// ── insertAtTop ───────────────────────────────────────────────────────────────

describe("insertAtTop", () => {
	it("inserts at top of empty file", () => {
		const { newContent, lineNumber } = insertAtTop("", LINE);
		expect(newContent).toBe(LINE + "\n");
		expect(lineNumber).toBe(1);
	});

	it("inserts before existing content", () => {
		const { newContent, lineNumber } = insertAtTop("# Title\n\nSome text\n", LINE);
		expect(newContent).toBe(LINE + "\n# Title\n\nSome text\n");
		expect(lineNumber).toBe(1);
	});

	it("always returns line number 1", () => {
		const { lineNumber } = insertAtTop("lots\nof\ncontent\n", LINE);
		expect(lineNumber).toBe(1);
	});
});

// ── insertUnderHeading ────────────────────────────────────────────────────────

describe("insertUnderHeading", () => {
	it("inserts after existing tasks under the heading", () => {
		const content = "# Daily\n\n## Inbox\n- [ ] Task 1\n- [ ] Task 2\n\n## Done\n- [x] Old\n";
		const { newContent, lineNumber } = insertUnderHeading(content, LINE, "## Inbox");
		const lines = newContent.split("\n");
		expect(lines[lineNumber - 1]).toBe(LINE);
		expect(lines[lineNumber - 2]).toBe("- [ ] Task 2");
	});

	it("inserts directly under heading when section is empty", () => {
		const content = "# Daily\n\n## Inbox\n\n## Done\n";
		const { newContent, lineNumber } = insertUnderHeading(content, LINE, "## Inbox");
		const lines = newContent.split("\n");
		expect(lines[lineNumber - 1]).toBe(LINE);
	});

	it("matches heading by text when no # prefix given", () => {
		const content = "# Daily\n\n## Inbox\n- [ ] Existing\n";
		const { newContent, lineNumber } = insertUnderHeading(content, LINE, "Inbox");
		const lines = newContent.split("\n");
		expect(lines[lineNumber - 1]).toBe(LINE);
	});

	it("creates heading at end of file when not found", () => {
		const content = "# Daily\n\nSome text\n";
		const { newContent } = insertUnderHeading(content, LINE, "## Inbox");
		expect(newContent).toContain("## Inbox");
		expect(newContent).toContain(LINE);
		const headingIdx = newContent.split("\n").indexOf("## Inbox");
		const taskIdx = newContent.split("\n").indexOf(LINE);
		expect(taskIdx).toBe(headingIdx + 1);
	});

	it("inserts at end of file when heading is last section", () => {
		const content = "# Daily\n\n## Inbox\n- [ ] Task 1\n";
		const { newContent, lineNumber } = insertUnderHeading(content, LINE, "## Inbox");
		const lines = newContent.split("\n");
		expect(lines[lineNumber - 1]).toBe(LINE);
		expect(lines[lineNumber - 2]).toBe("- [ ] Task 1");
	});
});
