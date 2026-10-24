import { describe, expect, it } from "vitest";
import { attachmentSummary, matchesQuery } from "../search";

describe("matchesQuery", () => {
  const fields = ["Parallel vs Perpendicular Line", "Draw both kinds.", "Integers", "Sofia Marchetti", "Math", "Section B"];

  it("matches everything for an empty query", () => {
    expect(matchesQuery(fields, "   ")).toBe(true);
  });

  it("is case-insensitive and needs every word", () => {
    expect(matchesQuery(fields, "perpendicular")).toBe(true);
    expect(matchesQuery(fields, "SOFIA math")).toBe(true);
    expect(matchesQuery(fields, "sofia algebra")).toBe(false);
  });

  it("copes with missing fields and odd characters", () => {
    expect(matchesQuery([null, undefined, "Ratios"], "ratios")).toBe(true);
    expect(matchesQuery(fields, "50%, (x)")).toBe(false);
  });
});

describe("attachmentSummary", () => {
  it("counts by type", () => {
    const pdf = { kind: "drive", mime_type: "application/pdf", unsupported_type: null };
    const video = { kind: "youtube", mime_type: null, unsupported_type: null };
    expect(attachmentSummary([pdf, video, pdf, video, video])).toBe("2 PDF · 3 Video");
    expect(attachmentSummary([])).toBe("");
  });
});
