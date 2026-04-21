import { describe, it, expect } from "vitest";
import { MLW_ID_PATTERN } from "data/idPattern";

/**
 * Tests for the MLW checkbox line regex used by CheckboxWatcher.
 * The regex is duplicated here for unit testing since processFile is not exported.
 */
const MLW_LINE_RE = new RegExp(`^- \\[([xX ])\\] (.+?)(?:\\s*<!-- mlw:(${MLW_ID_PATTERN}) -->)`);

describe("CheckboxWatcher regex", () => {
	it("matches a checked checkbox with mlw comment", () => {
		const line = "- [x] Take out the trash <!-- mlw:abc123 -->";
		const match = MLW_LINE_RE.exec(line);
		expect(match).not.toBeNull();
		expect(match![1]).toBe("x");
		expect(match![2]).toBe("Take out the trash");
		expect(match![3]).toBe("abc123");
	});

	it("matches an unchecked checkbox with mlw comment", () => {
		const line = "- [ ] Buy groceries <!-- mlw:def456 -->";
		const match = MLW_LINE_RE.exec(line);
		expect(match).not.toBeNull();
		expect(match![1]).toBe(" ");
		expect(match![2]).toBe("Buy groceries");
		expect(match![3]).toBe("def456");
	});

	it("matches uppercase X", () => {
		const line = "- [X] Done task <!-- mlw:ghi789 -->";
		const match = MLW_LINE_RE.exec(line);
		expect(match).not.toBeNull();
		expect(match![1]).toBe("X");
	});

	it("does not match lines without mlw comment", () => {
		const line = "- [x] Normal checkbox";
		expect(MLW_LINE_RE.exec(line)).toBeNull();
	});

	it("does not match non-checkbox lines", () => {
		const line = "Some text <!-- mlw:abc123 -->";
		expect(MLW_LINE_RE.exec(line)).toBeNull();
	});

	it("does not match bullet without checkbox", () => {
		const line = "- Take out the trash <!-- mlw:abc123 -->";
		expect(MLW_LINE_RE.exec(line)).toBeNull();
	});

	it("extracts text with special characters", () => {
		const line = "- [ ] Plan Q3 review (with @team) <!-- mlw:xyz999 -->";
		const match = MLW_LINE_RE.exec(line);
		expect(match).not.toBeNull();
		expect(match![2]).toBe("Plan Q3 review (with @team)");
	});

	it("requires exactly 6-char alphanumeric ID", () => {
		expect(MLW_LINE_RE.exec("- [ ] Test <!-- mlw:ab12 -->")).toBeNull();
		expect(MLW_LINE_RE.exec("- [ ] Test <!-- mlw:abcdefg -->")).toBeNull();
		expect(MLW_LINE_RE.exec("- [ ] Test <!-- mlw:abc12! -->")).toBeNull();
	});
});
