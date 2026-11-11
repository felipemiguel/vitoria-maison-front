import { describe, expect, it } from "vitest";
import { togglePageSelection, toggleSelection } from "./selection";

describe("seleção do explorador", () => {
  it("seleciona, desmarca e evita duplicação", () => {
    expect(toggleSelection([], "31")).toEqual(["31"]);
    expect(toggleSelection(["31"], "31")).toEqual([]);
    expect(togglePageSelection(["31"], ["31", "32", "32"])).toEqual(["31", "32"]);
  });

  it("respeita o limite do lote", () => {
    expect(togglePageSelection([], Array.from({ length: 25 }, (_, index) => String(index))).length).toBe(20);
  });
});
