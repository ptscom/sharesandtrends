"use client";

import { useEffect, useRef } from "react";
import {
  AUTO_REFRESH_INTERVAL_MS,
  isInAutoRefreshWindow,
  msUntilNextAutoRefreshSlot,
} from "@/lib/upstox/current-day-schedule";

type Options = {
  enabled: boolean;
  symbolCount: number;
  onTick: () => void | Promise<void>;
};

export function useUpstoxCurrentDayAutoRefresh({
  enabled,
  symbolCount,
  onTick,
}: Options): void {
  const onTickRef = useRef(onTick);
  const lastFetchRef = useRef<number | null>(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!enabled || symbolCount === 0) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    const runTick = async () => {
      if (document.hidden || !isInAutoRefreshWindow()) return;
      if (inFlightRef.current) return;
      const now = Date.now();
      if (
        lastFetchRef.current &&
        now - lastFetchRef.current < AUTO_REFRESH_INTERVAL_MS - 5_000
      ) {
        return;
      }
      inFlightRef.current = true;
      try {
        await onTickRef.current();
        lastFetchRef.current = Date.now();
      } finally {
        inFlightRef.current = false;
      }
    };

    const schedule = () => {
      const delay = msUntilNextAutoRefreshSlot();
      timeoutId = setTimeout(() => {
        void runTick().finally(schedule);
      }, delay);
    };

    const onVisibility = () => {
      if (!document.hidden && isInAutoRefreshWindow()) {
        if (timeoutId) clearTimeout(timeoutId);
        void runTick().finally(schedule);
      }
    };

    if (isInAutoRefreshWindow()) {
      const stale =
        !lastFetchRef.current ||
        Date.now() - lastFetchRef.current >= AUTO_REFRESH_INTERVAL_MS - 5_000;
      if (stale) {
        void runTick().finally(schedule);
      } else {
        schedule();
      }
    } else {
      schedule();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, symbolCount]);
}
