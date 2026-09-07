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
  muted: "#9aa8b6",
  headerBlue: "#4b78b8",
  borderSubtle: "#edf1f5",
  surface: "#ffffff",
  outerTop: "#e9f0f8",
  outerBottom: "#f4f7fb",
  brandText: "#c96f00",
  brand: "#f59e0b",
  brandBadgeBg: "#fff7ed",
  brandBadgeBorder: "#fde4c4",
  tableHeaderBg: "#fef6eb",
  success: "#159a68",
  danger: "#e05252",
  dotEmpty: "#d8dee6",
  shadow: "rgba(16, 42, 67, 0.07)",
};

const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

type ColAlign = "left" | "center" | "right";

interface SnapshotCol {
  id: string;
  label: string;
  width: number;
  align: ColAlign;
  sortable: boolean;
}

interface SnapshotLayout {
  outerPad: number;
  cardPadX: number;
  cardPadTop: number;
  cardPadBottom: number;
  headerBlock: number;
  gapAfterHeader: number;
  rowHeight: number;
  tableHeaderHeight: number;
  tableWidth: number;
  cardWidth: number;
  cardHeight: number;
  width: number;
  height: number;
  columns: SnapshotCol[];
}

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

  const layout = buildLayout(outputColumns, rows.length);

  const canvas = document.createElement("canvas");
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);

  drawOuterBackground(ctx, layout.width, layout.height);

  const cardX = layout.outerPad;
  const cardY = layout.outerPad;
  drawCard(ctx, cardX, cardY, layout.cardWidth, layout.cardHeight);

  const contentX = cardX + layout.cardPadX;
  const contentW = layout.cardWidth - layout.cardPadX * 2;
  let y = cardY + layout.cardPadTop;

  drawHeader(ctx, scan, rows.length, contentX, y, contentW);
  y += layout.headerBlock + layout.gapAfterHeader;

  const tableX = contentX;
  const tableTop = y;

  drawTableHeader(ctx, tableX, tableTop, layout);

  y = tableTop + layout.tableHeaderHeight;
  rows.forEach((row, index) => {
    drawTableRow(ctx, row, rowExtras.get(row.symbol), tableX, y, layout, index);
    y += layout.rowHeight;
  });

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

function buildLayout(
  outputColumns: SnapshotColumnFilter[],
  rowCount: number,
): SnapshotLayout {
  const outerPad = 10;
  const cardPadX = 18;
  const cardPadTop = 18;
  const cardPadBottom = 14;
  const headerBlock = 76;
  const gapAfterHeader = 12;
  const rowHeight = 52;
  const tableHeaderHeight = 32;

  const columns: SnapshotCol[] = [
    { id: "symbol", label: "SYMBOL", width: 138, align: "left", sortable: true },
    { id: "signal", label: "SIGNAL DATE", width: 98, align: "left", sortable: true },
    { id: "close", label: "CLOSE", width: 78, align: "left", sortable: true },
    ...outputColumns.map((column) => ({
      id: column.key,
      label: column.label.toUpperCase(),
      width: 90,
      align: "left" as ColAlign,
      sortable: true,
    })),
    { id: "last5", label: "LAST 5", width: 84, align: "center", sortable: false },
  ];

  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const cardWidth = tableWidth + cardPadX * 2;
  const width = cardWidth + outerPad * 2;
  const cardHeight =
    cardPadTop +
    headerBlock +
    gapAfterHeader +
    tableHeaderHeight +
    rowCount * rowHeight +
    cardPadBottom;
  const height = cardHeight + outerPad * 2;

  return {
    outerPad,
    cardPadX,
    cardPadTop,
    cardPadBottom,
    headerBlock,
    gapAfterHeader,
    rowHeight,
    tableHeaderHeight,
    tableWidth,
    cardWidth,
    cardHeight,
    width,
    height,
    columns,
  };
}

function colX(tableX: number, columns: SnapshotCol[], index: number): number {
  let x = tableX;
  for (let i = 0; i < index; i++) {
    x += columns[i]!.width;
  }
  return x;
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
): void {
  ctx.save();
  ctx.shadowColor = C.shadow;
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = C.surface;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = C.borderSubtle;
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 12);
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
  ctx.font = `700 23px ${FONT}`;
  ctx.fillText(scan.filterName, x, y + 36);

  ctx.fillStyle = C.headerBlue;
  ctx.font = `400 13px ${FONT}`;
  ctx.fillText(formatRunDate(scan.runAt), x, y + 56);

  const badgeW = 146;
  const badgeH = 52;
  const badgeX = x + contentWidth - badgeW;
  const badgeY = y;

  ctx.fillStyle = C.brandBadgeBg;
  ctx.strokeStyle = C.brandBadgeBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 9);
  ctx.fill();
  ctx.stroke();

  drawMiniBarIcon(ctx, badgeX + 11, badgeY + 13);

  ctx.fillStyle = C.ink;
  ctx.font = `700 13px ${FONT}`;
  ctx.fillText(
    `${symbolCount} symbol${symbolCount === 1 ? "" : "s"}`,
    badgeX + 33,
    badgeY + 22,
  );

  ctx.fillStyle = C.headerBlue;
  ctx.font = `400 11px ${FONT}`;
  ctx.fillText("Showing latest signals", badgeX + 33, badgeY + 38);
}

function drawMiniBarIcon(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  const heights = [9, 15, 11];
  const barW = 4;
  const gap = 3;
  heights.forEach((h, index) => {
    ctx.fillStyle = index === 1 ? C.brand : "#fbbf24";
    roundRect(ctx, x + index * (barW + gap), y + (16 - h), barW, h, 1.5);
    ctx.fill();
  });
}

function drawTableHeader(
  ctx: CanvasRenderingContext2D,
  tableX: number,
  tableTop: number,
  layout: SnapshotLayout,
): void {
  const { columns, tableWidth, tableHeaderHeight } = layout;

  ctx.fillStyle = C.tableHeaderBg;
  ctx.fillRect(tableX, tableTop, tableWidth, tableHeaderHeight);

  ctx.fillStyle = C.headerBlue;
  ctx.font = `600 10px ${FONT}`;

  const textY = tableTop + 20;

  columns.forEach((column, index) => {
    const x = colX(tableX, columns, index);
    drawHeaderCell(ctx, column, x, textY);
  });

  ctx.strokeStyle = C.borderSubtle;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tableX, tableTop + tableHeaderHeight);
  ctx.lineTo(tableX + tableWidth, tableTop + tableHeaderHeight);
  ctx.stroke();
}

function drawHeaderCell(
  ctx: CanvasRenderingContext2D,
  column: SnapshotCol,
  x: number,
  y: number,
): void {
  const padL = 10;
  const sortW = 8;
  const labelX =
    column.align === "center"
      ? x + (column.width - measureHeaderLabel(ctx, column.label, column.sortable)) / 2
      : x + padL;

  ctx.textAlign = "left";
  ctx.fillText(column.label, labelX, y);

  if (column.sortable) {
    const labelW = ctx.measureText(column.label).width;
    drawSortGlyph(ctx, labelX + labelW + 3, y - 7);
  }
}

function measureHeaderLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  sortable: boolean,
): number {
  const labelW = ctx.measureText(label).width;
  return labelW + (sortable ? 14 : 0);
}

function drawSortGlyph(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = "#a8bdd8";
  ctx.beginPath();
  ctx.moveTo(x + 2.5, y);
  ctx.lineTo(x + 5.5, y + 3.5);
  ctx.lineTo(x, y + 3.5);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(x, y + 4.5);
  ctx.lineTo(x + 5.5, y + 4.5);
  ctx.lineTo(x + 2.5, y + 8);
  ctx.closePath();
  ctx.fill();
}

function drawTableRow(
  ctx: CanvasRenderingContext2D,
  row: IndicatorScanResultRow,
  extras: SnapshotRowExtras | undefined,
  tableX: number,
  y: number,
  layout: SnapshotLayout,
  index: number,
): void {
  const { columns, tableWidth, rowHeight } = layout;

  if (index > 0) {
    ctx.strokeStyle = C.borderSubtle;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, y);
    ctx.lineTo(tableX + tableWidth, y);
    ctx.stroke();
  }

  columns.forEach((column, colIndex) => {
    const x = colX(tableX, columns, colIndex);
    drawBodyCell(ctx, column, row, extras, x, y, rowHeight);
  });
}

function drawBodyCell(
  ctx: CanvasRenderingContext2D,
  column: SnapshotCol,
  row: IndicatorScanResultRow,
  extras: SnapshotRowExtras | undefined,
  x: number,
  y: number,
  rowHeight: number,
): void {
  const padL = 10;
  const midY = y + rowHeight / 2 + 4;

  switch (column.id) {
    case "symbol": {
      const textX = x + padL;
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = `700 12px ${MONO}`;
      ctx.fillText(truncateText(ctx, row.symbol, column.width - padL * 2), textX, y + 20);

      ctx.fillStyle = C.headerBlue;
      ctx.font = `400 11px ${FONT}`;
      ctx.fillText(
        truncateText(ctx, extras?.subtitle ?? row.symbol, column.width - padL * 2),
        textX,
        y + 36,
      );
      break;
    }
    case "signal": {
      ctx.textAlign = "left";
      ctx.fillStyle = C.body;
      ctx.font = `400 12px ${FONT}`;
      ctx.fillText(formatExplorationSignalDate(row), x + padL, midY);
      break;
    }
    case "close": {
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = `600 13px ${MONO}`;
      ctx.fillText(formatSnapshotClose(row.lastClose), x + padL, midY);
      break;
    }
    case "last5": {
      drawLast5Dots(ctx, extras?.last5 ?? [], x, y + rowHeight / 2, column.width);
      break;
    }
    default: {
      drawHorizonCell(ctx, row.horizons?.[column.id as "d3" | "d5" | "d10"], x, y, column);
      break;
    }
  }
}

function drawHorizonCell(
  ctx: CanvasRenderingContext2D,
  stats: { avgReturnPct: number; winRate: number; trades: number } | undefined,
  x: number,
  y: number,
  column: SnapshotCol,
): void {
  const padL = 10;
  const formatted = formatHorizonForSnapshot(stats);

  ctx.textAlign = "left";

  if (formatted.returnLine === "—") {
    ctx.fillStyle = C.muted;
    ctx.font = `500 12px ${MONO}`;
    ctx.fillText("—", x + padL, y + 30);
    return;
  }

  const positive = (stats?.avgReturnPct ?? 0) >= 0;
  ctx.fillStyle = positive ? C.success : C.danger;
  ctx.font = `700 12px ${MONO}`;
  ctx.fillText(formatted.returnLine, x + padL, y + 20);

  if (formatted.winLine) {
    ctx.fillStyle = C.headerBlue;
    ctx.font = `400 10px ${FONT}`;
    ctx.fillText(formatted.winLine, x + padL, y + 36);
  }
}

function drawLast5Dots(
  ctx: CanvasRenderingContext2D,
  outcomes: boolean[],
  colX: number,
  centerY: number,
  colWidth: number,
): void {
  const dotR = 4.5;
  const step = 13;
  const slots = 5;
  const trackWidth = (slots - 1) * step + dotR * 2;
  const startX = colX + (colWidth - trackWidth) / 2 + dotR;

  for (let i = 0; i < slots; i++) {
    const outcome = outcomes[i];
    let color = C.dotEmpty;
    if (outcome === true) color = C.success;
    if (outcome === false) color = C.danger;

    ctx.beginPath();
    ctx.arc(startX + i * step, centerY, dotR, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

function truncateText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0 || ctx.measureText(text).width <= maxWidth) return text;
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
