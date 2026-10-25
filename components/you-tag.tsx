// The yellow "You" pill. Always place it in a flex row with a gap, never inline
// in text, so the space before it doesn't depend on a margin.
export function YouTag() {
  return <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-ink">You</span>;
}
