import { describe, it, expect } from "vitest";
import { deriveAOFColor, reindexSortOrders, type AreaOfFocus } from "./models";

describe("deriveAOFColor", () => {
	it("converts a hex color to AOFColor with correct rgba values", () => {
		const result = deriveAOFColor("#569CD6");
		expect(result).toEqual({
			bg: "rgba(86, 156, 214, 0.15)",
			text: "#569CD6",
			border: "rgba(86, 156, 214, 0.3)",
		});
	});

	it("handles pure black", () => {
		const result = deriveAOFColor("#000000");
		expect(result).toEqual({
			bg: "rgba(0, 0, 0, 0.15)",
			text: "#000000",
			border: "rgba(0, 0, 0, 0.3)",
		});
	});

	it("handles pure white", () => {
		const result = deriveAOFColor("#FFFFFF");
		expect(result).toEqual({
			bg: "rgba(255, 255, 255, 0.15)",
			text: "#FFFFFF",
			border: "rgba(255, 255, 255, 0.3)",
		});
	});

	it("handles lowercase hex", () => {
		const result = deriveAOFColor("#ff8800");
		expect(result).toEqual({
			bg: "rgba(255, 136, 0, 0.15)",
			text: "#ff8800",
			border: "rgba(255, 136, 0, 0.3)",
		});
	});
});

describe("reindexSortOrders", () => {
	it("assigns sequential sort_order values matching array index", () => {
		const aofs: AreaOfFocus[] = [
			{ name: "Work", sort_order: 5, color: deriveAOFColor("#569CD6") },
			{ name: "Health", sort_order: 10, color: deriveAOFColor("#4EB981") },
			{ name: "Finance", sort_order: 3, color: deriveAOFColor("#EBA048") },
		];
		reindexSortOrders(aofs);
		expect(aofs[0]?.sort_order).toBe(0);
		expect(aofs[1]?.sort_order).toBe(1);
		expect(aofs[2]?.sort_order).toBe(2);
	});

	it("handles empty array", () => {
		const aofs: AreaOfFocus[] = [];
		reindexSortOrders(aofs);
		expect(aofs).toEqual([]);
	});

	it("handles single element", () => {
		const aofs: AreaOfFocus[] = [
			{ name: "Work", sort_order: 99, color: deriveAOFColor("#569CD6") },
		];
		reindexSortOrders(aofs);
		expect(aofs[0]?.sort_order).toBe(0);
	});
});
