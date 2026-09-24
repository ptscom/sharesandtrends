import { describe, expect, it } from "vitest";
import {
  isInAutoRefreshWindow,
  minutesSinceMidnightIst,
  todayYmdIst,
} from "@/lib/upstox/current-day-schedule";

describe("current-day schedule IST", () => {
  it("formats today in IST", () => {
    expect(todayYmdIst(new Date("2026-09-23T20:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("treats 10:00 IST on a weekday as inside the window", () => {
    // 2026-09-23 is Wednesday; 04:30 UTC = 10:00 IST
    const wed = new Date("2026-09-23T04:30:00Z");
    expect(minutesSinceMidnightIst(wed)).toBe(10 * 60);
    expect(isInAutoRefreshWindow(wed)).toBe(true);
  });
});
