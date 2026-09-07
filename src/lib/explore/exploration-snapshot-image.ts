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

  // Tight but readable margins for social sharing
  const margin = 14;
  const contentPad = 12;
  const rowHeight = 46;
  const headerHeight = 38;
  const titleBlockHeight = 92;
  const footerHeight = 22;

  const colSymbol = 104;
  const colSignal = 96;
  const colClose = 68;
  const colHorizon = 104;

  const tableWidth =
    colSymbol +
    colSignal +
    colClose +
    outputColumns.length * colHorizon;
  const cardWidth = tableWidth + contentPad * 2;
  const width = cardWidth + margin * 2;
  const height =
    margin * 2 +
    contentPad * 2 +
    titleBlockHeight +
    headerHeight +
    rows.length * rowHeight +
    footerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, width, height);

  const cardX = margin;
  const cardY = margin;
  const cardHeight = height - margin * 2;

  ctx.fillStyle = COLORS.surface;
  roundRect(ctx, cardX, cardY, cardWidth, cardHeight, 12);
  ctx.fill();

  const tableX = cardX + contentPad;
  let y = cardY + contentPad + 6;

  ctx.fillStyle = COLORS.ink;
  ctx.font = `700 20px ${FONT}`;
  ctx.fillText(scan.filterName, tableX, y + 20);

  y += 28;
  ctx.fillStyle = COLORS.body;
  ctx.font = `400 12px ${FONT}`;
  const subtitle = `${formatTimeframeModeLabel(scan.timeframeMode)} · ${rows.length} symbols · ${formatRunDate(scan.runAt)}`;
  ctx.fillText(subtitle, tableX, y + 12);

  y += 18;
  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 11px ${FONT}`;
  const desc =
    scan.filterDescription.length > 96
      ? `${scan.filterDescription.slice(0, 93)}…`
      : scan.filterDescription;
  ctx.fillText(desc, tableX, y + 11);

  y += 22;

  const tableW = tableWidth;

  ctx.fillStyle = COLORS.headerBg;
  roundRect(ctx, tableX, y, tableW, headerHeight, 6);
  ctx.fill();

  ctx.fillStyle = COLORS.brand;
  ctx.font = `600 10px ${FONT}`;
  let x = tableX + 8;
  const headerY = y + 24;
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

    let cellX = tableX + 8;
    const cellY = y + 20;

    ctx.fillStyle = COLORS.ink;
    ctx.font = `600 12px ${MONO}`;
    ctx.fillText(row.symbol, cellX, cellY);

    cellX += colSymbol;
    ctx.font = `400 11px ${FONT}`;
    ctx.fillStyle = COLORS.body;
    ctx.fillText(formatExplorationSignalDate(row), cellX, cellY);

    cellX += colSignal;
    ctx.fillStyle = COLORS.ink;
    ctx.font = `500 12px ${MONO}`;
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
      ctx.font = `600 11px ${MONO}`;
      ctx.fillText(formatted.returnLine, cellX, cellY - 2);
      if (formatted.winLine) {
        ctx.fillStyle = COLORS.muted;
        ctx.font = `400 9px ${FONT}`;
        ctx.fillText(formatted.winLine, cellX, cellY + 11);
      }
      cellX += colHorizon;
    }

    y += rowHeight;
  });

  ctx.fillStyle = COLORS.muted;
  ctx.font = `400 9px ${FONT}`;
  ctx.fillText(
    "Shares & Trends · Exploration snapshot",
    tableX,
    cardY + cardHeight - contentPad + 2,
  );

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
