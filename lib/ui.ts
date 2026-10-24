// Shared class names, so every page uses the same buttons, inputs and cards.
// Buttons and inputs are 44px tall (min-h-11).

const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[10px] px-5 text-[15px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimary = `${button} bg-brand text-white hover:bg-brand-dark`;
export const btnSecondary = `${button} border border-line bg-white text-ink hover:bg-brand-light`;
export const input =
  "min-h-11 w-full rounded-[10px] border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-muted";
export const card = "rounded-card border border-line bg-white";
export const alertError = "rounded-[10px] border border-danger/30 bg-danger-light p-3 text-sm text-danger";
