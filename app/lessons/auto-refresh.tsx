"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const EVERY_MS = 8_000;
const MAX_REFRESHES = 30;

// While a sync is running, reloads the page data now and then so the status
// line catches up. Gives up after MAX_REFRESHES.
export function AutoRefresh({ active, everyMs = EVERY_MS }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    let count = 0;
    const timer = setInterval(() => {
      count += 1;
      router.refresh();
      if (count >= MAX_REFRESHES) clearInterval(timer);
    }, everyMs);
    return () => clearInterval(timer);
  }, [active, everyMs, router]);
  return null;
}
