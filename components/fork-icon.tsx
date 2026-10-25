// A small fork: one stem splitting in two.
export function ForkIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8 14V8m0 0C8 6 4 6 4 3m4 5c0-2 4-2 4-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="4" cy="2.5" r="1.4" fill="currentColor" />
      <circle cx="12" cy="2.5" r="1.4" fill="currentColor" />
    </svg>
  );
}
