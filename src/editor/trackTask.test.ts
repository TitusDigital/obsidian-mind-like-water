import { describe, it, expect } from "vitest";
import { canTrackLine } from "./trackTask";

describe("canTrackLine", () => {
	it("returns true for an untracked checkbox with dash", () => {
		expect(canTrackLine("- [ ] Buy groceries")).toBe(true);
	});

	it("returns true for an untracked checkbox with asterisk", () => {
		expect(canTrackLine("* [ ] Buy groceries")).toBe(true);
	});

	it("returns true for a completed checkbox", () => {
		expect(canTrackLine("- [x] Done task")).toBe(true);
	});

	it("returns true for a completed checkbox with uppercase X", () => {
		expect(canTrackLine("- [X] Done task")).toBe(true);
	});

	it("returns true for an indented checkbox", () => {
		expect(canTrackLine("    - [ ] Nested item")).toBe(true);
	});

	it("returns true for a tab-indented checkbox", () => {
		expect(canTrackLine("\t- [ ] Tabbed item")).toBe(true);
	});

	it("returns false for an already tracked checkbox", () => {
		expect(canTrackLine("- [ ] Buy groceries <!-- mlw:abc123 -->")).toBe(false);
	});

	it("returns false for plain text", () => {
		expect(canTrackLine("Just some text")).toBe(false);
	});

	it("returns false for a heading", () => {
		expect(canTrackLine("## Section")).toBe(false);
	});

	it("returns false for an empty line", () => {
		expect(canTrackLine("")).toBe(false);
	});

	it("returns false for a list item without checkbox", () => {
		expect(canTrackLine("- Just a bullet")).toBe(false);
	});

	it("returns false for a checkbox without text after it", () => {
		// The regex requires whitespace after the bracket, so "- [ ]" alone won't match
		expect(canTrackLine("- [ ]")).toBe(false);
	});

	it("returns true for a checkbox with only spaces after it", () => {
		expect(canTrackLine("- [ ] ")).toBe(true);
	});
});
