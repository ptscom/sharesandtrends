import type {
  HorizonStats,
  IndicatorScanResultRow,
} from "@/lib/explore/exploration-models";

export type HorizonKey = "d3" | "d5" | "d10";

export interface SnapshotColumnFilter {
  key: HorizonKey;
  label: string;
  enabled: boolean;
  /** e.g. "70", ">70", "70%" — empty means no win-rate filter */
  minWinRate: string;
  /** e.g. "5", ">5%" — empty means no return filter */
  minReturnPct: string;
}

export const SNAPSHOT_HORIZON_COLUMNS: SnapshotColumnFilter[] = [
  {
    key: "d3",
    label: "3d return",
    enabled: true,
    minWinRate: "",
    minReturnPct: "",
  },
  {
    key: "d5",
    label: "5d return",
    enabled: true,
    minWinRate: "",
    minReturnPct: "",
  },
  {
    key: "d10",
    label: "10d return",
    enabled: true,
    minWinRate: "",
    minReturnPct: "",
  },
];

export function formatExplorationSignalDate(
  row: IndicatorScanResultRow,
): string {
  const raw = row.signalDate;
  if (!raw) return "—";
  try {
    return new Date(`${raw}T12:00:00`).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return raw;
  }
}

export function parseSnapshotThreshold(input: string): number | null {
  const trimmed = input.trim().replace(/^>/, "").replace(/%$/, "").trim();
  if (!trimmed) return null;
  const value = Number.parseFloat(trimmed);
  return Number.isFinite(value) ? value : null;
}

function horizonStats(
  row: IndicatorScanResultRow,
  key: HorizonKey,
): HorizonStats | undefined {
  return row.horizons?.[key];
}

export function rowPassesSnapshotFilters(
  row: IndicatorScanResultRow,
  columns: SnapshotColumnFilter[],
): boolean {
  const activeFilters = columns.filter(
    (column) =>
      column.enabled &&
      (parseSnapshotThreshold(column.minWinRate) !== null ||
        parseSnapshotThreshold(column.minReturnPct) !== null),
  );

  if (activeFilters.length === 0) return true;

  for (const column of activeFilters) {
    const stats = horizonStats(row, column.key);
    if (!stats || stats.trades === 0) return false;

    const minWin = parseSnapshotThreshold(column.minWinRate);
    if (minWin !== null && stats.winRate < minWin) return false;

    const minReturn = parseSnapshotThreshold(column.minReturnPct);
    if (minReturn !== null && stats.avgReturnPct < minReturn) return false;
  }

  return true;
}

export function filterSnapshotRows(
  rows: IndicatorScanResultRow[],
  columns: SnapshotColumnFilter[],
): IndicatorScanResultRow[] {
  return rows.filter((row) => rowPassesSnapshotFilters(row, columns));
}

export function enabledSnapshotColumns(
  columns: SnapshotColumnFilter[],
): SnapshotColumnFilter[] {
  return columns.filter((column) => column.enabled);
}

export function formatHorizonForSnapshot(stats?: HorizonStats): {
  returnLine: string;
  winLine: string;
} {
  if (!stats || stats.trades === 0) {
    return { returnLine: "—", winLine: "" };
  }
  const sign = stats.avgReturnPct >= 0 ? "+" : "";
  return {
    returnLine: `${sign}${stats.avgReturnPct.toFixed(2)}%`,
    winLine: `${stats.winRate.toFixed(0)}% (${stats.trades})`,
  };
}
