import { describe, expect, it } from "vitest";
import { fromSchoolLine, payoffCandidates, payoffHeadline, pickPayoff, taughtPairs, type PayoffCandidate } from "../payoff";

let n = 0;
function lesson(over: Partial<PayoffCandidate> = {}): PayoffCandidate {
  n += 1;
  return {
    id: `l${n}`,
    ownerSchoolId: "other",
    subject: "math",
    grade: "7",
    forks: 0,
    updatedAt: `2026-10-${String(10 + (n % 15)).padStart(2, "0")}T00:00:00Z`,
    ...over,
  };
}

const grade7Math = [{ subject: "math" as const, grade: "7" as const }];

describe("pickPayoff", () => {
  it("is empty when the Library is empty", () => {
    expect(pickPayoff({ candidates: [], myClasses: grade7Math, mySchoolId: "s1" })).toEqual({ mode: "empty" });
  });

  it("shows matches when there are at least 3", () => {
    const candidates = [lesson(), lesson(), lesson(), lesson({ ownerSchoolId: "s1" }), lesson({ subject: "science" })];
    const result = pickPayoff({ candidates, myClasses: grade7Math, mySchoolId: "s1" });
    expect(result.mode).toBe("match");
    if (result.mode !== "match") return;
    expect(result.total).toBe(4);
    expect(result.fromMySchool).toBe(1);
    expect(result.label).toBe("Grade 7 Math");
    expect(result.lessons).toHaveLength(3);
  });

  it("orders her school first, then forks, then newest", () => {
    const a = lesson({ forks: 9, updatedAt: "2026-10-01T00:00:00Z" });
    const b = lesson({ ownerSchoolId: "s1", forks: 0, updatedAt: "2026-09-01T00:00:00Z" });
    const c = lesson({ forks: 2, updatedAt: "2026-10-20T00:00:00Z" });
    const d = lesson({ forks: 2, updatedAt: "2026-10-21T00:00:00Z" });
    const result = pickPayoff({ candidates: [a, b, c, d], myClasses: grade7Math, mySchoolId: "s1" });
    expect(result.mode === "match" && result.lessons.map((l) => l.id)).toEqual([b.id, a.id, d.id]);
  });

  it("has no label when she teaches several pairs", () => {
    const candidates = [lesson(), lesson(), lesson({ subject: "science", grade: "8" })];
    const result = pickPayoff({
      candidates,
      myClasses: [...grade7Math, { subject: "science", grade: "8" }],
      mySchoolId: null,
    });
    expect(result.mode === "match" && result.label).toBeNull();
    expect(result.mode === "match" && result.fromMySchool).toBe(0);
  });

  it("matches mixed grades on either side", () => {
    const candidates = [lesson({ grade: "mixed" }), lesson({ grade: "7" }), lesson({ grade: "8" })];
    expect(pickPayoff({ candidates, myClasses: grade7Math, mySchoolId: null }).mode).toBe("district");
    const mine = [{ subject: "math" as const, grade: "mixed" as const }];
    const result = pickPayoff({ candidates, myClasses: mine, mySchoolId: null });
    expect(result.mode === "match" && result.total).toBe(3);
  });

  it("never matches lessons whose class has no subject or grade yet", () => {
    const candidates = [lesson({ subject: null, grade: null }), lesson({ grade: null }), lesson(), lesson()];
    const result = pickPayoff({ candidates, myClasses: grade7Math, mySchoolId: null });
    expect(result.mode).toBe("district");
  });

  it("falls back to the most-forked, then newest, with fewer than 3 matches", () => {
    const a = lesson({ forks: 1 });
    const b = lesson({ subject: "science", forks: 5 });
    const c = lesson({ subject: "ela", forks: 0, updatedAt: "2026-10-24T00:00:00Z" });
    const d = lesson({ subject: "ela", forks: 0, updatedAt: "2026-10-01T00:00:00Z" });
    const result = pickPayoff({ candidates: [a, b, c, d], myClasses: grade7Math, mySchoolId: null });
    expect(result).toEqual({ mode: "district", lessons: [b, a, c] });
  });

  it("doesn't count classes that aren't a subject as taught", () => {
    const candidates = [lesson(), lesson(), lesson()];
    const result = pickPayoff({ candidates, myClasses: [{ subject: "none", grade: null }], mySchoolId: null });
    expect(result.mode).toBe("district");
  });
});

describe("taughtPairs", () => {
  it("dedupes and skips incomplete or non-subject classes", () => {
    expect(
      taughtPairs([
        { subject: "math", grade: "7" },
        { subject: "math", grade: "7" },
        { subject: "math", grade: null },
        { subject: null, grade: "7" },
        { subject: "none", grade: null },
      ])
    ).toEqual([{ subject: "math", grade: "7" }]);
  });
});

describe("payoffCandidates", () => {
  it("leaves out my own lessons and lessons with nothing to fork", () => {
    const rows = [
      { id: "mine", owner_id: "me", attachments: [{ kind: "link" }] },
      { id: "text", owner_id: "other", attachments: [] },
      { id: "waiting", owner_id: "other", attachments: [{ kind: "drive", library_file_id: null }] },
      { id: "ok", owner_id: "other", attachments: [{ kind: "drive", library_file_id: "f1" }] },
    ];
    expect(payoffCandidates(rows, "me").map((r) => r.id)).toEqual(["ok"]);
  });
});

describe("headline lines", () => {
  it("names the pair when there is one", () => {
    expect(payoffHeadline(12, "Grade 7 Math")).toBe("12 Grade 7 Math lessons are waiting for you");
    expect(payoffHeadline(5, null)).toBe("5 lessons for what you teach are waiting for you");
  });

  it("counts lessons from her school", () => {
    expect(fromSchoolLine(3, "Central Middle School")).toBe("3 are from Central Middle School.");
    expect(fromSchoolLine(1, "Central Middle School")).toBe("1 is from Central Middle School.");
  });
});
