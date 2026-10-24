// A fork: one stem splitting into two.
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#1F6F54" />
      <path
        d="M16 25V16m0 0c0-3-5-3-5-7m5 7c0-3 5-3 5-7"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="11" cy="8" r="2" fill="#F4B740" />
      <circle cx="21" cy="8" r="2" fill="#F4B740" />
    </svg>
  );
}
