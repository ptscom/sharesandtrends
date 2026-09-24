import {
  HISTORICAL_CSV_HEADER,
  historicalRowToCsvLine,
  downloadTextFile,
} from "@/lib/upstox/csv";
import { forEachHistoricalRowBatch } from "@/lib/storage/upstox-historical";
export async function downloadFullHistoricalCsv(filename: string): Promise<void> {
  const lines: string[] = [HISTORICAL_CSV_HEADER];
  await forEachHistoricalRowBatch(2000, (batch) => {
    for (const row of batch) {
      lines.push(historicalRowToCsvLine(row));
    }
  });
  downloadTextFile(filename, lines.join("\n"));
}

export async function downloadFilteredHistoricalCsv(
  filename: string,
  symbolPrefix: string,
): Promise<void> {
  const prefix = symbolPrefix.trim().toUpperCase();
  const lines: string[] = [HISTORICAL_CSV_HEADER];
  await forEachHistoricalRowBatch(2000, (batch) => {
    for (const row of batch) {
      if (prefix && !row.symbol.startsWith(prefix)) continue;
      lines.push(historicalRowToCsvLine(row));
    }
  });
  downloadTextFile(filename, lines.join("\n"));
}
