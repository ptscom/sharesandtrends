import type { CurrentPriceRow, HistoricalPriceRow, UpstoxDataError } from "@/lib/upstox/types";

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
