const IST = "Asia/Kolkata";

/** First auto-refresh slot: 9:45 AM IST */
export const AUTO_REFRESH_START_MINUTES = 9 * 60 + 45;
/** Last slot start (3:45 PM IST); 30 min cadence after this waits until next session */
export const AUTO_REFRESH_END_MINUTES = 15 * 60 + 45;
export const AUTO_REFRESH_INTERVAL_MS = 30 * 60 * 1000;

export function todayYmdIst(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: IST,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isNseWeekdayIst(now = new Date()): boolean {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: IST,
    weekday: "short",
  }).format(now);
  return weekday !== "Sat" && weekday !== "Sun";
}

export function minutesSinceMidnightIst(now = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: IST,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isInAutoRefreshWindow(now = new Date()): boolean {
  if (!isNseWeekdayIst(now)) return false;
  const mins = minutesSinceMidnightIst(now);
  return mins >= AUTO_REFRESH_START_MINUTES && mins <= AUTO_REFRESH_END_MINUTES;
}

/** Ms until the next 30-minute slot aligned from 9:45 AM IST. */
export function msUntilNextAutoRefreshSlot(now = new Date()): number {
  if (!isNseWeekdayIst(now)) {
    return 60 * 60 * 1000;
  }

  const mins = minutesSinceMidnightIst(now);

  if (mins < AUTO_REFRESH_START_MINUTES) {
    return (AUTO_REFRESH_START_MINUTES - mins) * 60 * 1000;
  }

  if (mins > AUTO_REFRESH_END_MINUTES) {
    return 60 * 60 * 1000;
  }

  const elapsed = mins - AUTO_REFRESH_START_MINUTES;
  const slotsPassed = Math.floor(elapsed / 30);
  const nextSlotMinutes =
    AUTO_REFRESH_START_MINUTES + (slotsPassed + 1) * 30;

  if (nextSlotMinutes > AUTO_REFRESH_END_MINUTES) {
    return 60 * 60 * 1000;
  }

  return (nextSlotMinutes - mins) * 60 * 1000;
}
