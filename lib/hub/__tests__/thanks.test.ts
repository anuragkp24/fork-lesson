import { describe, expect, it } from "vitest";
import { forkThanksState, thanksBadge } from "../thanks";

describe("thanksBadge", () => {
  it("is hidden at 0 and for non-authors (null)", () => {
    expect(thanksBadge({ thanks: 0, newThanks: 0 })).toBeNull();
    expect(thanksBadge({ thanks: null, newThanks: null })).toBeNull();
  });

  it("says 1 thank-you or N thank-yous", () => {
    expect(thanksBadge({ thanks: 1, newThanks: 0 })?.label).toBe("1 thank-you");
    expect(thanksBadge({ thanks: 3, newThanks: 0 })?.label).toBe("3 thank-yous");
  });

  it("flags new ones", () => {
    expect(thanksBadge({ thanks: 3, newThanks: 2 })).toEqual({ label: "3 thank-yous", hasNew: true, newCount: 2 });
    expect(thanksBadge({ thanks: 3, newThanks: 0 })?.hasNew).toBe(false);
    expect(thanksBadge({ thanks: 3, newThanks: null })?.hasNew).toBe(false);
  });
});

describe("forkThanksState", () => {
  it("shows a sent thank-you even if the original is gone", () => {
    expect(forkThanksState({ sent: true, originalVisible: false, forkOk: true })).toBe("sent");
  });

  it("offers Say thanks while the original is visible and the fork worked", () => {
    expect(forkThanksState({ sent: false, originalVisible: true, forkOk: true })).toBe("can-thank");
  });

  it("offers nothing when the original is hidden", () => {
    expect(forkThanksState({ sent: false, originalVisible: false, forkOk: true })).toBeNull();
  });

  it("offers nothing for a failed fork", () => {
    expect(forkThanksState({ sent: false, originalVisible: true, forkOk: false })).toBeNull();
  });
});
