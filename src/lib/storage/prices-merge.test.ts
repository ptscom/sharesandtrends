import { describe, expect, it } from "vitest";
import { mergeOhlcvByDate } from "@/lib/storage/prices";
import type { OhlcvBar } from "@/lib/types";

function bar(date: string, close = 100): OhlcvBar {
  return { date, open: close, high: close, low: close, close, volume: 1 };
}

describe("mergeOhlcvByDate", () => {
  it("keeps older bars when patching a middle date range", () => {
    const merged = mergeOhlcvByDate(
      [bar("2024-01-02"), bar("2024-06-01"), bar("2025-01-02")],
      [bar("2024-03-01", 200)],
    );
    expect(merged.map((b) => b.date)).toEqual([
      "2024-01-02",
      "2024-03-01",
      "2024-06-01",
      "2025-01-02",
    ]);
    expect(merged.find((b) => b.date === "2024-03-01")?.close).toBe(200);
  });
});
