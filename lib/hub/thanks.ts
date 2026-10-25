// The author's private thank-you count on a My lessons card. Null at 0.
export function thanksBadge({
  thanks,
  newThanks,
}: {
  thanks: number | null | undefined;
  newThanks: number | null | undefined;
}): { label: string; hasNew: boolean; newCount: number } | null {
  if (!thanks || thanks < 1) return null;
  const newCount = newThanks && newThanks > 0 ? newThanks : 0;
  return { label: `${thanks} ${thanks === 1 ? "thank-you" : "thank-yous"}`, hasNew: newCount > 0, newCount };
}

// What a fork card offers its forker. "can-thank" only while the original is
// still visible to them and the fork worked; a sent thank-you is final.
export function forkThanksState({
  sent,
  originalVisible,
  forkOk,
}: {
  sent: boolean;
  originalVisible: boolean;
  forkOk: boolean;
}): "sent" | "can-thank" | null {
  if (sent) return "sent";
  return originalVisible && forkOk ? "can-thank" : null;
}
