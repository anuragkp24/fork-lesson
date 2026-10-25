import { describe, expect, it } from "vitest";
import { parseShoutout } from "../shoutout";
import { tagLabel } from "../tags";

describe("parseShoutout", () => {
  it("keeps known tags, deduped, in display order", () => {
    expect(parseShoutout({ tags: ["clear_instructions", "saved_time", "saved_time"], note: null })).toEqual({
      ok: true,
      tags: ["saved_time", "clear_instructions"],
      note: null,
    });
  });

  it("trims the note and drops it when empty", () => {
    expect(parseShoutout({ tags: ["ready_to_use"], note: "  Using this Monday \n" })).toEqual({
      ok: true,
      tags: ["ready_to_use"],
      note: "Using this Monday",
    });
    expect(parseShoutout({ tags: ["ready_to_use"], note: "   " })).toEqual({
      ok: true,
      tags: ["ready_to_use"],
      note: null,
    });
  });

  it("accepts a note on its own", () => {
    expect(parseShoutout({ tags: [], note: "Thanks!" })).toEqual({ ok: true, tags: [], note: "Thanks!" });
  });

  it("rejects unknown tags", () => {
    expect(parseShoutout({ tags: ["saved_time", "best_ever"], note: null }).ok).toBe(false);
  });

  it("rejects empty input", () => {
    expect(parseShoutout({ tags: [], note: null }).ok).toBe(false);
    expect(parseShoutout({ tags: [], note: "  " }).ok).toBe(false);
  });

  it("rejects notes over 300 characters, after trimming", () => {
    expect(parseShoutout({ tags: [], note: "a".repeat(300) }).ok).toBe(true);
    expect(parseShoutout({ tags: [], note: ` ${"a".repeat(300)} ` }).ok).toBe(true);
    expect(parseShoutout({ tags: [], note: "a".repeat(301) }).ok).toBe(false);
  });

  it("rejects malformed input", () => {
    expect(parseShoutout({ tags: "saved_time", note: null }).ok).toBe(false);
    expect(parseShoutout({ tags: [], note: 42 }).ok).toBe(false);
  });
});

describe("tagLabel", () => {
  it("names known tags and hides unknown ones", () => {
    expect(tagLabel("saved_time")).toBe("Saved me time");
    expect(tagLabel("students_love")).toBe("Students will love it");
    expect(tagLabel("nope")).toBeNull();
  });
});
