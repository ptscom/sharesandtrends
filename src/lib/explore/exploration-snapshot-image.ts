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
  muted: "#8a9bb0",
  headerBlue: "#4b78b8",
  borderSubtle: "#edeae5",
  white: "#ffffff",
  peachTop: "#f5f3ef",
  peachMid: "#f7f5f0",
  brandText: "#c96f00",
  brand: "#f59e0b",
  brandBadgeBg: "#f7f5f0",
  brandBadgeBorder: "#ebe7e0",
  tableHeaderBg: "#f5f3ef",
  success: "#159a68",
  danger: "#e05252",
  dotEmpty: "#d8dee6",
};

type ColAlign = "left" | "center" | "right";

interface SnapshotCol {
  id: string;
  label: string;
  width: number;
  align: ColAlign;
  sortable: boolean;
}

interface SnapshotLayout {
  pad: number;
  headerBlock: number;
  gapAfterHeader: number;
  rowHeight: number;
  tableHeaderHeight: number;
  tableWidth: number;
  width: number;
  height: number;
  columns: SnapshotCol[];
}

interface RenderOptions {
  scan: IndicatorScanRun;
  rows: IndicatorScanResultRow[];
  columns: SnapshotColumnFilter[];
}

let cachedFontFamily: string | null = null;

export async function renderExplorationSnapshotPng(
  options: RenderOptions,
): Promise<Blob> {
  const { scan, rows, columns } = options;
  const outputColumns = enabledSnapshotColumns(columns);
  const fontFamily = await ensureSnapshotFonts();
  const rowExtras = await buildSnapshotRowExtras(scan, rows);
  const scale = 2;

  const layout = buildLayout(outputColumns, rows.length);

  const canvas = document.createElement("canvas");
  canvas.width = layout.width * scale;
  canvas.height = layout.height * scale;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  ctx.scale(scale, scale);

  drawWarmBackground(ctx, layout.width, layout.height);

  const contentX = layout.pad;
  const contentW = layout.width - layout.pad * 2;
  let y = layout.pad;

  drawHeader(ctx, scan, rows.length, contentX, y, contentW, fontFamily);
  y += layout.headerBlock + layout.gapAfterHeader;

  const tableX = contentX;
  const tableTop = y;
  const tableBodyHeight = rows.length * layout.rowHeight;

  drawTableBodyBackground(
    ctx,
    tableX,
    tableTop + layout.tableHeaderHeight,
    layout.tableWidth,
    tableBodyHeight,
  );

  drawTableHeader(ctx, tableX, tableTop, layout, fontFamily);

  y = tableTop + layout.tableHeaderHeight;
  rows.forEach((row, index) => {
    drawTableRow(
      ctx,
      row,
      rowExtras.get(row.symbol),
      tableX,
      y,
      layout,
      index,
      fontFamily,
    );
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

async function ensureSnapshotFonts(): Promise<string> {
  if (cachedFontFamily) return cachedFontFamily;

  const family =
    typeof document !== "undefined"
      ? getComputedStyle(document.body).fontFamily
      : "Inter, sans-serif";

  const primary = family.split(",")[0]?.replace(/['"]/g, "").trim() || "Inter";
  const fontFamily = `${family}`;

  if (typeof document !== "undefined") {
    await Promise.all([
      document.fonts.load(`400 11px ${fontFamily}`),
      document.fonts.load(`400 12px ${fontFamily}`),
      document.fonts.load(`400 13px ${fontFamily}`),
      document.fonts.load(`600 10px ${fontFamily}`),
      document.fonts.load(`600 12px ${fontFamily}`),
      document.fonts.load(`600 13px ${fontFamily}`),
      document.fonts.load(`700 10px ${fontFamily}`),
      document.fonts.load(`700 12px ${fontFamily}`),
      document.fonts.load(`700 13px ${fontFamily}`),
      document.fonts.load(`700 24px ${fontFamily}`),
    ]);
    await document.fonts.ready;
  }

  cachedFontFamily = fontFamily;
  return primary;
}

function font(
  family: string,
  weight: number,
  size: number,
): string {
  return `${weight} ${size}px ${family}`;
}

function buildLayout(
  outputColumns: SnapshotColumnFilter[],
  rowCount: number,
): SnapshotLayout {
  const pad = 20;
  const headerBlock = 78;
  const gapAfterHeader = 14;
  const rowHeight = 54;
  const tableHeaderHeight = 34;

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
  const width = tableWidth + pad * 2;
  const height =
    pad +
    headerBlock +
    gapAfterHeader +
    tableHeaderHeight +
    rowCount * rowHeight +
    pad;

  return {
    pad,
    headerBlock,
    gapAfterHeader,
    rowHeight,
    tableHeaderHeight,
    tableWidth,
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

function drawWarmBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, C.peachTop);
  grad.addColorStop(0.32, C.peachMid);
  grad.addColorStop(0.62, "#faf9f7");
  grad.addColorStop(1, C.white);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
}

function drawTableBodyBackground(
  ctx: CanvasRenderingContext2D,
  tableX: number,
  tableTop: number,
  tableWidth: number,
  tableBodyHeight: number,
): void {
  ctx.fillStyle = C.white;
  roundRect(ctx, tableX, tableTop, tableWidth, tableBodyHeight, 10);
  ctx.fill();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  scan: IndicatorScanRun,
  symbolCount: number,
  x: number,
  y: number,
  contentWidth: number,
  fontFamily: string,
): void {
  const badgeW = 178;
  const badgeH = 54;
  const badgeX = x + contentWidth - badgeW;
  const badgeY = y;
  const badgeTextX = badgeX + 34;
  const badgeTextMaxW = badgeW - 34 - 12;
  const titleMaxW = contentWidth - badgeW - 16;

  ctx.fillStyle = C.brandText;
  ctx.font = font(fontFamily, 700, 10);
  ctx.fillText("EXPLORATION", x, y + 10);

  ctx.fillStyle = C.ink;
  ctx.font = font(fontFamily, 700, 24);
  ctx.fillText(truncateText(ctx, scan.filterName, titleMaxW), x, y + 38);

  ctx.fillStyle = C.headerBlue;
  ctx.font = font(fontFamily, 400, 13);
  ctx.fillText(formatRunDate(scan.runAt), x, y + 58);

  ctx.fillStyle = C.brandBadgeBg;
  ctx.strokeStyle = C.brandBadgeBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 10);
  ctx.fill();
  ctx.stroke();

  drawMiniBarIcon(ctx, badgeX + 12, badgeY + 14);

  ctx.fillStyle = C.ink;
  ctx.font = font(fontFamily, 700, 13);
  ctx.fillText(
    truncateText(
      ctx,
      `${symbolCount} symbol${symbolCount === 1 ? "" : "s"}`,
      badgeTextMaxW,
    ),
    badgeTextX,
    badgeY + 22,
  );

  ctx.fillStyle = C.headerBlue;
  ctx.font = font(fontFamily, 400, 11);
  ctx.fillText(
    truncateText(ctx, "Showing latest signals", badgeTextMaxW),
    badgeTextX,
    badgeY + 40,
  );
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
  fontFamily: string,
): void {
  const { columns, tableWidth, tableHeaderHeight } = layout;

  ctx.fillStyle = C.tableHeaderBg;
  roundRectTop(ctx, tableX, tableTop, tableWidth, tableHeaderHeight, 10);
  ctx.fill();

  ctx.fillStyle = C.headerBlue;
  ctx.font = font(fontFamily, 600, 10);

  const textY = tableTop + 21;

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
  const labelW = ctx.measureText(column.label).width;
  const sortW = column.sortable ? 12 : 0;
  const totalW = labelW + sortW;

  const labelX =
    column.align === "center"
      ? x + (column.width - totalW) / 2
      : x + padL;

  ctx.textAlign = "left";
  ctx.fillText(column.label, labelX, y);

  if (column.sortable) {
    drawSortGlyph(ctx, labelX + labelW + 3, y - 7);
  }
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
  fontFamily: string,
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
    drawBodyCell(ctx, column, row, extras, x, y, rowHeight, fontFamily);
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
  fontFamily: string,
): void {
  const padL = 10;
  const midY = y + rowHeight / 2 + 4;

  switch (column.id) {
    case "symbol": {
      const textX = x + padL;
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = font(fontFamily, 700, 12);
      ctx.fillText(truncateText(ctx, row.symbol, column.width - padL * 2), textX, y + 20);

      ctx.fillStyle = C.headerBlue;
      ctx.font = font(fontFamily, 400, 11);
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
      ctx.font = font(fontFamily, 400, 12);
      ctx.fillText(formatExplorationSignalDate(row), x + padL, midY);
      break;
    }
    case "close": {
      ctx.textAlign = "left";
      ctx.fillStyle = C.ink;
      ctx.font = font(fontFamily, 600, 13);
      ctx.fillText(formatSnapshotClose(row.lastClose), x + padL, midY);
      break;
    }
    case "last5": {
      drawLast5Dots(ctx, extras?.last5 ?? [], x, y + rowHeight / 2, column.width);
      break;
    }
    default: {
      drawHorizonCell(
        ctx,
        row.horizons?.[column.id as "d3" | "d5" | "d10"],
        x,
        y,
        fontFamily,
      );
      break;
    }
  }
}

function drawHorizonCell(
  ctx: CanvasRenderingContext2D,
  stats: { avgReturnPct: number; winRate: number; trades: number } | undefined,
  x: number,
  y: number,
  fontFamily: string,
): void {
  const padL = 10;
  const formatted = formatHorizonForSnapshot(stats);

  ctx.textAlign = "left";

  if (formatted.returnLine === "—") {
    ctx.fillStyle = C.muted;
    ctx.font = font(fontFamily, 500, 12);
    ctx.fillText("—", x + padL, y + 30);
    return;
  }

  const positive = (stats?.avgReturnPct ?? 0) >= 0;
  ctx.fillStyle = positive ? C.success : C.danger;
  ctx.font = font(fontFamily, 700, 12);
  ctx.fillText(formatted.returnLine, x + padL, y + 20);

  if (formatted.winLine) {
    ctx.fillStyle = C.headerBlue;
    ctx.font = font(fontFamily, 400, 10);
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
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function roundRectTop(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
