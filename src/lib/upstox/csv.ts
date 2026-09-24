import type {
  CurrentPriceRow,
  HistoricalPriceRow,
  IntradayPriceRow,
  UpstoxDataError,
} from "@/lib/upstox/types";

function escapeCsv(value: string | number | null): string {
  if (value === null) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function currentRowsToCsv(rows: CurrentPriceRow[]): string {
  const header = "symbol,open,high,low,close,volume";
  const lines = rows.map((r) =>
    [
      escapeCsv(r.symbol),
      escapeCsv(r.open),
      escapeCsv(r.high),
      escapeCsv(r.low),
      escapeCsv(r.close),
      escapeCsv(r.volume),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function historicalRowToCsvLine(row: HistoricalPriceRow): string {
  return [
    escapeCsv(row.symbol),
    escapeCsv(row.date),
    escapeCsv(row.open),
    escapeCsv(row.high),
    escapeCsv(row.low),
    escapeCsv(row.close),
    escapeCsv(row.volume),
  ].join(",");
}

export const HISTORICAL_CSV_HEADER =
  "symbol,date,open,high,low,close,volume";

export function historicalRowsToCsv(rows: HistoricalPriceRow[]): string {
  const header = "symbol,date,open,high,low,close,volume";
  const sorted = [...rows].sort((a, b) =>
    a.symbol === b.symbol
      ? a.date.localeCompare(b.date)
      : a.symbol.localeCompare(b.symbol),
  );
  const lines = sorted.map((r) =>
    [
      escapeCsv(r.symbol),
      escapeCsv(r.date),
      escapeCsv(r.open),
      escapeCsv(r.high),
      escapeCsv(r.low),
      escapeCsv(r.close),
      escapeCsv(r.volume),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function intradayRowsToCsv(rows: IntradayPriceRow[]): string {
  const header = "symbol,interval_minutes,timestamp,open,high,low,close,volume";
  const sorted = [...rows].sort((a, b) =>
    a.symbol === b.symbol
      ? a.timestamp.localeCompare(b.timestamp)
      : a.symbol.localeCompare(b.symbol),
  );
  const lines = sorted.map((r) =>
    [
      escapeCsv(r.symbol),
      escapeCsv(r.intervalMinutes),
      escapeCsv(r.timestamp),
      escapeCsv(r.open),
      escapeCsv(r.high),
      escapeCsv(r.low),
      escapeCsv(r.close),
      escapeCsv(r.volume),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function failuresToCsv(errors: UpstoxDataError[]): string {
  const header = "symbol,stage,message,retryable";
  const lines = errors.map((e) =>
    [
      escapeCsv(e.symbol),
      escapeCsv(e.stage),
      escapeCsv(e.message),
      escapeCsv(e.retryable ? "true" : "false"),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function downloadTextFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
