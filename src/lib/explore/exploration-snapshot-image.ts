import type { IndicatorScanRun, IndicatorScanResultRow } from "@/lib/explore/exploration-models";
import {
  enabledSnapshotColumns,
  formatExplorationSignalDate,
  formatHorizonForSnapshot,
  type SnapshotColumnFilter,
} from "@/lib/explore/exploration-snapshot";

/** Matches site tokens from globals.css */
const C = {
  ink: "#102a43",
  body: "#5f7184",
  muted: "#8190a0",
  border: "#e8e3dc",
  borderSubtle: "#f0ece6",
  surface: "#ffffff",
  bg: "#faf8f4",
  bgWarm: "#f3efe8",
  bgTop: "#fdfbf7",
  brand: "#f59e0b",
  brandText: "#c96f00",
  brandLight: "#fff4dd",
  success: "#159a68",
  successLight: "#eaf7f1",
  danger: "#e05252",
  dangerLight: "#fdeeee",
  headerInk: "#0f2438",
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

  const pad = 16;
  const headerBlock = 58;
  const gapAfterHeader = 12;
  const rowHeight = 48;
  const tableHeaderHeight = 36;
  const tableRadius = 10;

  const colSymbol = 108;
  const colSignal = 98;
  const colClose = 72;
  const colHorizon = 108;

  const tableWidth =
    colSymbol + colSignal + colClose + outputColumns.length * colHorizon;
  const width = tableWidth + pad * 2;
  const height =
    pad + headerBlock + gapAfterHeader + tableHeaderHeight + rows.length * rowHeight + pad;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);

  drawBackground(ctx, width, height);

  const contentX = pad;
  let y = pad;

  // Eyebrow
  ctx.fillStyle = C.brandText;
  ctx.font = `600 9px ${FONT}`;
  ctx.letterSpacing = "0.12em";
  ctx.fillText("EXPLORATION", contentX, y + 9);
  ctx.letterSpacing = "0px";

  // Title
  y += 16;
  ctx.fillStyle = C.ink;
  ctx.font = `700 21px ${FONT}`;
  ctx.fillText(scan.filterName, contentX, y + 20);

  // Run time only
  y += 28;
  ctx.fillStyle = C.muted;
  ctx.font = `400 12px ${FONT}`;
  ctx.fillText(formatRunDate(scan.runAt), contentX, y + 12);

  y += gapAfterHeader + 8;

  const tableX = contentX;
  const tableW = tableWidth;
  const tableTop = y;

  // Table shell
  ctx.save();
  roundRect(ctx, tableX, tableTop, tableW, tableHeaderHeight + rows.length * rowHeight, tableRadius);
  ctx.clip();
  ctx.fillStyle = C.surface;
  ctx.fillRect(tableX, tableTop, tableW, tableHeaderHeight + rows.length * rowHeight);

  // Table header
  ctx.fillStyle = C.headerInk;
  ctx.fillRect(tableX, tableTop, tableW, tableHeaderHeight);

  ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
  ctx.font = `600 9px ${FONT}`;
  ctx.letterSpacing = "0.08em";
  let x = tableX + 10;
  const headerTextY = tableTop + 23;
  ctx.fillText("SYMBOL", x, headerTextY);
  x += colSymbol;
  ctx.fillText("SIGNAL", x, headerTextY);
  x += colSignal;
  ctx.fillText("CLOSE", x, headerTextY);
  x += colClose;
  for (const column of outputColumns) {
    ctx.fillText(column.label.toUpperCase(), x, headerTextY);
    x += colHorizon;
  }
  ctx.letterSpacing = "0px";

  y = tableTop + tableHeaderHeight;

  rows.forEach((row, index) => {
    const rowBg = index % 2 === 0 ? C.surface : C.bg;
    ctx.fillStyle = rowBg;
    ctx.fillRect(tableX, y, tableW, rowHeight);

    if (index > 0) {
      ctx.strokeStyle = C.borderSubtle;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tableX + 8, y);
      ctx.lineTo(tableX + tableW - 8, y);
      ctx.stroke();
    }

    let cellX = tableX + 10;
    const cellY = y + 22;

    ctx.fillStyle = C.ink;
    ctx.font = `600 12px ${MONO}`;
    ctx.fillText(row.symbol, cellX, cellY);

    cellX += colSymbol;
    ctx.font = `400 11px ${FONT}`;
    ctx.fillStyle = C.body;
    ctx.fillText(formatExplorationSignalDate(row), cellX, cellY);

    cellX += colSignal;
    ctx.fillStyle = C.ink;
    ctx.font = `500 12px ${MONO}`;
    ctx.fillText(row.lastClose.toFixed(2), cellX, cellY);

    cellX += colClose;
    for (const column of outputColumns) {
      const stats = row.horizons?.[column.key];
      const formatted = formatHorizonForSnapshot(stats);
      const positive = (stats?.avgReturnPct ?? 0) >= 0;
      const hasReturn = formatted.returnLine !== "—";

      if (hasReturn) {
        drawReturnPill(
          ctx,
          cellX,
          y + 10,
          colHorizon - 8,
          28,
          formatted.returnLine,
          positive,
        );
        if (formatted.winLine) {
          ctx.fillStyle = C.muted;
          ctx.font = `400 9px ${FONT}`;
          ctx.fillText(formatted.winLine, cellX + 2, y + 40);
        }
      } else {
        ctx.fillStyle = C.muted;
        ctx.font = `500 12px ${MONO}`;
        ctx.fillText("—", cellX, cellY);
      }

      cellX += colHorizon;
    }

    y += rowHeight;
  });

  ctx.restore();

  // Table border
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  roundRect(
    ctx,
    tableX,
    tableTop,
    tableW,
    tableHeaderHeight + rows.length * rowHeight,
    tableRadius,
  );
  ctx.stroke();

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

function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, C.bgTop);
  base.addColorStop(0.45, C.bg);
  base.addColorStop(1, C.bgWarm);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const glow = ctx.createRadialGradient(
    width * 0.08,
    0,
    0,
    width * 0.08,
    0,
    width * 0.55,
  );
  glow.addColorStop(0, "rgba(245, 158, 11, 0.14)");
  glow.addColorStop(1, "transparent");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);

  const accent = ctx.createRadialGradient(
    width * 0.95,
    height * 0.05,
    0,
    width * 0.95,
    height * 0.05,
    width * 0.4,
  );
  accent.addColorStop(0, "rgba(117, 102, 200, 0.07)");
  accent.addColorStop(1, "transparent");
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, width, height);
}

function drawReturnPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  positive: boolean,
): void {
  ctx.fillStyle = positive ? C.successLight : C.dangerLight;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();

  ctx.fillStyle = positive ? C.success : C.danger;
  ctx.font = `700 11px ${MONO}`;
  ctx.fillText(text, x + 7, y + 18);
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
