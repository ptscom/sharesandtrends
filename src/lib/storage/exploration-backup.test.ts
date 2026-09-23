import { describe, expect, it } from "vitest";
import {
  EXPLORATION_BACKUP_VERSION,
  summarizeExplorationBackup,
} from "@/lib/storage/exploration-backup";

describe("exploration backup", () => {
  it("summarizes snapshot", () => {
    const summary = summarizeExplorationBackup(
      {
        v: EXPLORATION_BACKUP_VERSION,
        exportedAt: "2026-09-23T00:00:00.000Z",
        explorations: [
          {
            id: "a",
            name: "Test",
            builder: { rows: [] },
            createdAt: "x",
            updatedAt: "x",
          },
        ],
      },
      "file.json.gz",
    );
    expect(summary.explorationCount).toBe(1);
  });
});
