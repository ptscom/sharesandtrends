import type { IndicatorScanRun, IndicatorScanResultRow } from "@/lib/explore/exploration-models";
import {
  buildSnapshotRowExtras,
  formatSnapshotClose,
  type SnapshotRowExtras,
} from "@/lib/explore/exploration-snapshot-data";
import {
  enabledSnapshotColumns,
  formatExplorationSignalDate,
  formatHorizonForSnapshot,
  type SnapshotColumnFilter,
} from "@/lib/explore/exploration-snapshot";

const C = {
  ink: "#102a43",
  body: "#5f7184",
  muted: "#8190a0",
  headerBlue: "#4b78b8",
  border: "#e8e3dc",
  borderSubtle: "#f0ece6",
  surface: "#ffffff",
  outerTop: "#eef4fb",
  outerBottom: "#f7f9fc",
  brandText: "#c96f00",
  brand: "#f59e0b",
  brandBadgeBg: "#fff7ed",
  brandBadgeBorder: "#fde4c4",
  tableHeaderBg: "#fef6eb",
  success: "#159a68",
  danger: "#e05252",
  dotEmpty: "#e2e8f0",
  shadow: "rgba(16, 42, 67, 0.08)",
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
  const rowExtras = await buildSnapshotRowExtras(scan, rows);
  const scale = 2;

  const outerPad = 14;
  const cardPad = 20;
  const headerBlock = 78;
  const gapAfterHeader = 14;
  const rowHeight = 54;
  const tableHeaderHeight = 34;
  const cardRadius = 14;
  const showLast5 = true;

  const colSymbol = 148;
  const colSignal = 108;
  const colClose = 88;
  const colHorizon = 98;
  const colLast5 = 72;

  const tableWidth =
    colSymbol +
    colSignal +
    colClose +
    outputColumns.length * colHorizon +
    (showLast5 ? colLast5 : 0);

  const cardWidth = tableWidth + cardPad * 2;
  const width = cardWidth + outerPad * 2;
  const cardHeight =
    cardPad + headerBlock + gapAfterHeader + tableHeaderHeight + rows.length * rowHeight + cardPad;
  const height = cardHeight + outerPad * 2;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);

  drawOuterBackground(ctx, width, height);

  const cardX = outerPad;
  const cardY = outerPad;
  drawCard(ctx, cardX, cardY, cardWidth, cardHeight, cardRadius);

  const contentX = cardX + cardPad;
  let y = cardY + cardPad;

  drawHeader(ctx, scan, rows.length, contentX, y, cardWidth - cardPad * 2);
  y += headerBlock + gapAfterHeader;

  const tableX = contentX;
  const tableW = tableWidth;
  const tableTop = y;
  const tableH = tableHeaderHeight + rows.length * rowHeight;

  drawTableHeader(
    ctx,
    tableX,
    tableTop,
    tableW,
    tableHeaderHeight,
    outputColumns,
    showLast5,
    { colSymbol, colSignal, colClose, colHorizon, colLast5 },
  );

  y = tableTop + tableHeaderHeight;

  rows.forEach((row, index) => {
    drawTableRow(
      ctx,
      row,
      rowExtras.get(row.symbol),
      tableX,
      y,
      tableW,
      rowHeight,
      index,
      outputColumns,
      showLast5,
      { colSymbol, colSignal, colClose, colHorizon, colLast5 },
    );
    y += rowHeight;
  });

  ctx.strokeStyle = C.borderSubtle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tableX, tableTop + tableH);
  ctx.lineTo(tableX + tableW, tableTop + tableH);
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

function drawOuterBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, C.outerTop);
  grad.addColorStop(1, C.outerBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.save();
  ctx.shadowColor = C.shadow;
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = C.surface;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = C.borderSubtle;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, r);
  ctx.stroke();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  scan: IndicatorScanRun,
  symbolCount: number,
  x: number,
  y: number,
  contentWidth: number,
): void {
  ctx.fillStyle = C.brandText;
  ctx.font = `700 10px ${FONT}`;
  ctx.fillText("EXPLORATION", x, y + 10);

  ctx.fillStyle = C.ink;
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText(scan.filterName, x, y + 38);

  ctx.fillStyle = C.headerBlue;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText(formatRunDate(scan.runAt), x, y + 58);

  const badgeW = 148;
  const badgeH = 54;
  const badgeX = x + contentWidth - badgeW;
  const badgeY = y + 2;

  ctx.fillStyle = C.brandBadgeBg;
  ctx.strokeStyle = C.brandBadgeBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
  ctx.fill();
  ctx.stroke();

  drawMiniBarIcon(ctx, badgeX + 12, badgeY + 14);

  ctx.fillStyle = C.ink;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(
    `${symbolCount} symbol${symbolCount === 1 ? "" : "s"}`,
    badgeX + 34,
    badgeY + 24,
  );

  ctx.fillStyle = C.headerBlue;
  ctx.font = `400 11px ${FONT}`;
  ctx.fillText("Showing latest signals", badgeX + 34, badgeY + 40);
}

function drawMiniBarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  const heights = [10, 16, 12];
  const widths = 4;
  const gap = 3;
  heights.forEach((h, index) => {
    ctx.fillStyle = index === 1 ? C.brand : "#fbbf24";
    roundRect(ctx, x + index * (widths + gap), y + (18 - h), widths, h, 1.5);
    ctx.fill();
  });
}

function drawTableHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  outputColumns: SnapshotColumnFilter[],
  showLast5: boolean,
  cols: {
    colSymbol: number;
    colSignal: number;
    colClose: number;
    colHorizon: number;
    colLast5: number;
  },
): void {
  ctx.fillStyle = C.tableHeaderBg;
  ctx.fillRect(x, y, w, h);

  ctx.fillStyle = C.headerBlue;
  ctx.font = `600 10px ${FONT}`;

  let cellX = x + 12;
  const textY = y + 21;

  drawHeaderLabel(ctx, "SYMBOL", cellX, textY, true);
  cellX += cols.colSymbol;
  drawHeaderLabel(ctx, "SIGNAL DATE", cellX, textY, true);
  cellX += cols.colSignal;
  drawHeaderLabel(ctx, "CLOSE", cellX, textY, true);
  cellX += cols.colClose;

  for (const column of outputColumns) {
    drawHeaderLabel(ctx, column.label.toUpperCase(), cellX, textY, true);
    cellX += cols.colHorizon;
  }

  if (showLast5) {
    drawHeaderLabel(ctx, "LAST 5", cellX, textY, false);
  }

  ctx.strokeStyle = C.borderSubtle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
}

function drawHeaderLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  x: number,
  y: number,
  withSort: boolean,
): void {
  ctx.fillText(label, x, y);
  if (withSort) {
    drawSortGlyph(ctx, x + ctx.measureText(label).width + 4, y - 8);
  }
}

function drawSortGlyph(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
): void {
  ctx.fillStyle = "#a8bdd8";
  ctx.beginPath();
  ctx.moveTo(x + 3, y);
  ctx.lineTo(x + 6, y + 4);
  ctx.lineTo(x, y + 4);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, y + 6);
  ctx.lineTo(x + 6, y + 6);
  ctx.lineTo(x + 3, y + 10);
  ctx.closePath();
  ctx.fill();
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  row: IndicatorScanResultRow,
  extras: SnapshotRowExtras | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
  index: number,
  outputColumns: SnapshotColumnFilter[],
  showLast5: boolean,
  cols: {
    colSymbol: number;
    colSignal: number;
    colClose: number;
    colHorizon: number;
    colLast5: number;
  },
): void {
  if (index > 0) {
    ctx.strokeStyle = C.borderSubtle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 10, y);
    ctx.lineTo(x + w - 10, y);
    ctx.stroke();
  }

  let cellX = x + 12;

  ctx.fillStyle = C.ink;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(row.symbol, cellX, y + 22);

  ctx.fillStyle = C.headerBlue;
  ctx.font = `400 11px ${FONT}`;
  const subtitle = extras?.subtitle ?? row.symbol;
  ctx.fillText(truncateText(ctx, subtitle, cols.colSymbol - 8), cellX, y + 38);

  cellX += cols.colSymbol;
  ctx.fillStyle = C.body;
  ctx.font = `400 12px ${FONT}`;
  ctx.fillText(formatExplorationSignalDate(row), cellX, y + 30);

  cellX += cols.colSignal;
  ctx.fillStyle = C.ink;
  ctx.font = `600 13px ${MONO}`;
  ctx.fillText(formatSnapshotClose(row.lastClose), cellX, y + 30);

  cellX += cols.colClose;
  for (const column of outputColumns) {
    drawHorizonCell(ctx, row.horizons?.[column.key], cellX, y, cols.colHorizon);
    cellX += cols.colHorizon;
  }

  if (showLast5) {
    drawLast5Dots(ctx, extras?.last5 ?? [], cellX + 4, y + 22);
  }
}

function drawHorizonCell(
  ctx: CanvasRenderingContext2D,
  stats: { avgReturnPct: number; winRate: number; trades: number } | undefined,
  x: number,
  y: number,
  width: number,
): void {
  const formatted = formatHorizonForSnapshot(stats);
  if (formatted.returnLine === "—") {
    ctx.fillStyle = C.muted;
    ctx.font = `500 12px ${MONO}`;
    ctx.fillText("—", x, y + 30);
    return;
  }

  const positive = (stats?.avgReturnPct ?? 0) >= 0;
  ctx.fillStyle = positive ? C.success : C.danger;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(formatted.returnLine, x, y + 22);

  if (formatted.winLine) {
    ctx.fillStyle = C.headerBlue;
    ctx.font = `400 10px ${FONT}`;
    ctx.fillText(formatted.winLine, x, y + 38);
  }
}

function drawLast5Dots(
  ctx: CanvasRenderingContext2D,
  outcomes: boolean[],
  x: number,
  y: number,
): void {
  const dotR = 5;
  const gap = 8;
  const slots = 5;

  for (let i = 0; i < slots; i++) {
    const outcome = outcomes[i];
    let color = C.dotEmpty;
    if (outcome === true) color = C.success;
    if (outcome === false) color = C.danger;

    ctx.beginPath();
    ctx.arc(x + i * (dotR * 2 + gap) + dotR, y, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}…`;
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
