import type { IndicatorScanRun, IndicatorScanResultRow } from "@/lib/explore/exploration-models";
import { formatTimeframeModeLabel } from "@/lib/patterns/mtf-combine";
import {
  enabledSnapshotColumns,
  formatExplorationSignalDate,
  formatHorizonForSnapshot,
  type SnapshotColumnFilter,
} from "@/lib/explore/exploration-snapshot";

const COLORS = {
  bg: "#faf8f4",
  surface: "#ffffff",
  ink: "#102a43",
  body: "#5f7184",
  muted: "#8190a0",
  border: "#e8e3dc",
  brand: "#c96f00",
  success: "#159a68",
  danger: "#e05252",
  headerBg: "#fff4dd",
};

const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

interface RenderOptions {
  scan: IndicatorScanRun;
  rows: IndicatorScanResultRow[];
  columns: SnapshotColumnFilter[];
}

export async function renderExplorationSnapshotPng(
  options: RenderOptions,
): Promise<Blob> {
  const { scan, rows, columns } = options;
  const outputColumns = enabledSnapshotColumns(columns);
  const scale = 2;
  const padding = 40;
  const rowHeight = 52;
  const headerHeight = 44;
  const titleBlockHeight = 120;

  const colSymbol = 120;
  const colSignal = 110;
  const colClose = 90;
  const colHorizon = 130;

  const tableWidth =
    colSymbol +
    colSignal +
    colClose +
    outputColumns.length * colHorizon;
  const width = tableWidth + padding * 2;
  const height =
    padding * 2 + titleBlockHeight + headerHeight + rows.length * rowHeight + 36;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, padding / 2, padding / 2, width - padding, height - padding, 16);
  ctx.fill();

  let y = padding + 20;

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 22px ${FONT}`;
  ctx.fillText(scan.filterName, padding + 16, y + 22);

  y += 34;
  ctx.fillStyle = COLORS.body;
  ctx.font = `400 13px ${FONT}`;
  const subtitle = `${formatTimeframeModeLabel(scan.timeframeMode)} · ${rows.length} symbols · ${formatRunDate(scan.runAt)}`;
  ctx.fillText(subtitle, padding + 16, y + 14);

  y += 22;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 12px ${FONT}`;
  const desc =
    scan.filterDescription.length > 90
      ? `${scan.filterDescription.slice(0, 87)}…`
      : scan.filterDescription;
  ctx.fillText(desc, padding + 16, y + 12);

  y += 28;

  const tableX = padding + 16;
  const tableW = tableWidth;

  ctx.fillStyle = COLORS.headerBg;
  roundRect(ctx, tableX, y, tableW, headerHeight, 8);
  ctx.fill();

  ctx.fillStyle = COLORS.brand;
  ctx.font = `600 11px ${FONT}`;
  let x = tableX + 12;
  const headerY = y + 28;
  ctx.fillText("SYMBOL", x, headerY);
  x += colSymbol;
  ctx.fillText("SIGNAL", x, headerY);
  x += colSignal;
  ctx.fillText("CLOSE", x, headerY);
  x += colClose;
  for (const column of outputColumns) {
    ctx.fillText(column.label.toUpperCase(), x, headerY);
    x += colHorizon;
  }

  y += headerHeight;

  rows.forEach((row, index) => {
    if (index > 0) {
      ctx.strokeStyle = COLORS.border;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX, y);
      ctx.lineTo(tableX + tableW, y);
      ctx.stroke();
    }

    ctx.fillStyle = index % 2 === 0 ? COLORS.surface : COLORS.bg;
    ctx.fillRect(tableX, y, tableW, rowHeight);

    let cellX = tableX + 12;
    const cellY = y + 22;

    ctx.fillStyle = COLORS.ink;
    ctx.font = `600 13px ${MONO}`;
    ctx.fillText(row.symbol, cellX, cellY);

    cellX += colSymbol;
    ctx.font = `400 12px ${FONT}`;
    ctx.fillStyle = COLORS.body;
    ctx.fillText(formatExplorationSignalDate(row), cellX, cellY);

    cellX += colSignal;
    ctx.fillStyle = COLORS.ink;
    ctx.font = `500 13px ${MONO}`;
    ctx.fillText(row.lastClose.toFixed(2), cellX, cellY);

    cellX += colClose;
    for (const column of outputColumns) {
      const formatted = formatHorizonForSnapshot(row.horizons?.[column.key]);
      const positive =
        (row.horizons?.[column.key]?.avgReturnPct ?? 0) >= 0;
      ctx.fillStyle = formatted.returnLine === "—"
        ? COLORS.muted
        : positive
          ? COLORS.success
          : COLORS.danger;
      ctx.font = `600 12px ${MONO}`;
      ctx.fillText(formatted.returnLine, cellX, cellY - 2);
      if (formatted.winLine) {
        ctx.fillStyle = COLORS.muted;
        ctx.font = `400 10px ${FONT}`;
        ctx.fillText(formatted.winLine, cellX, cellY + 12);
      }
      cellX += colHorizon;
    }

    y += rowHeight;
  });

  y += 12;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 10px ${FONT}`;
  ctx.fillText("Shares & Trends · Exploration snapshot", tableX, y + 10);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("Failed to create image"));
        else resolve(blob);
      },
      "image/png",
      1,
    );
  });
}

export function downloadExplorationSnapshot(blob: Blob, scan: IndicatorScanRun): void {
  const slug = scan.filterName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const date = scan.runAt.slice(0, 10);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `exploration-${slug || "scan"}-${date}.png`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatRunDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
