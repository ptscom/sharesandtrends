import type { IndicatorScanRun, IndicatorScanResultRow } from "@/lib/explore/exploration-models";
import { snapshotDescriptionText } from "@/lib/explore/exploration-description";
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
  brandText: "#c96f00",
  brand: "#f59e0b",
  brandBadgeBg: "rgba(255, 255, 255, 0.72)",
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

  const layout = buildLayout(outputColumns, rows.length, scan.filterName, fontFamily);

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

  drawHeader(ctx, scan, contentX, y, contentW, fontFamily);
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
      document.fonts.load(`700 22px ${fontFamily}`),
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

const TITLE_SIZE = 22;
const TITLE_TOP = 36;
const TITLE_LINE_HEIGHT = 26;

function buildLayout(
  outputColumns: SnapshotColumnFilter[],
  rowCount: number,
  filterName: string,
  fontFamily: string,
): SnapshotLayout {
  const pad = 20;
  const gapAfterHeader = 8;
  const rowHeight = 54;
  const tableHeaderHeight = 34;
  const titleSize = TITLE_SIZE;
  const titleLineHeight = TITLE_LINE_HEIGHT;
  const columns: SnapshotCol[] = [
    { id: "symbol", label: "SYMBOL", width: 138, align: "left" },
    { id: "signal", label: "SIGNAL DATE", width: 98, align: "left" },
    { id: "close", label: "CLOSE", width: 78, align: "left" },
    ...outputColumns.map((column) => ({
      id: column.key,
      label: column.label.toUpperCase(),
      width: 90,
      align: "left" as ColAlign,
    })),
    { id: "last5", label: "LAST 5", width: 84, align: "center" },
  ];

  const tableWidth = columns.reduce((sum, col) => sum + col.width, 0);
  const contentWidth = tableWidth;
  const descBoxW = Math.min(300, Math.max(240, contentWidth * 0.42));
  const titleMaxW = contentWidth - descBoxW - 16;

  const measureCtx = document.createElement("canvas").getContext("2d");
  let titleLineCount = 1;
  if (measureCtx) {
    measureCtx.font = font(fontFamily, 700, titleSize);
    titleLineCount = fitTitleLines(measureCtx, filterName, titleMaxW, 2).length;
  }

  const headerBlock = TITLE_TOP + 4 + titleLineCount * titleLineHeight + 6;

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
  ctx.fillStyle = C.white;
  ctx.fillRect(0, 0, width, height);

  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, "#faf7f3");
  base.addColorStop(0.28, "#f8f7f6");
  base.addColorStop(0.55, "#fcfcfb");
  base.addColorStop(1, C.white);
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const peachGlow = ctx.createRadialGradient(
    width * 0.1,
    -height * 0.02,
    0,
    width * 0.12,
    height * 0.04,
    width * 0.62,
  );
  peachGlow.addColorStop(0, "rgba(255, 214, 170, 0.42)");
  peachGlow.addColorStop(0.42, "rgba(255, 232, 205, 0.16)");
  peachGlow.addColorStop(1, "transparent");
  ctx.fillStyle = peachGlow;
  ctx.fillRect(0, 0, width, height);

  const greyGlow = ctx.createRadialGradient(
    width * 0.78,
    -height * 0.04,
    0,
    width * 0.74,
    height * 0.06,
    width * 0.58,
  );
  greyGlow.addColorStop(0, "rgba(198, 206, 220, 0.3)");
  greyGlow.addColorStop(0.45, "rgba(220, 225, 233, 0.12)");
  greyGlow.addColorStop(1, "transparent");
  ctx.fillStyle = greyGlow;
  ctx.fillRect(0, 0, width, height);

  const centerBlend = ctx.createRadialGradient(
    width * 0.42,
    0,
    0,
    width * 0.42,
    height * 0.03,
    width * 0.48,
  );
  centerBlend.addColorStop(0, "rgba(245, 236, 226, 0.28)");
  centerBlend.addColorStop(0.55, "rgba(248, 246, 244, 0.08)");
  centerBlend.addColorStop(1, "transparent");
  ctx.fillStyle = centerBlend;
  ctx.fillRect(0, 0, width, height);

  const whiteFade = ctx.createLinearGradient(0, 0, 0, height);
  whiteFade.addColorStop(0, "rgba(255, 255, 255, 0)");
  whiteFade.addColorStop(0.38, "rgba(255, 255, 255, 0)");
  whiteFade.addColorStop(0.72, "rgba(255, 255, 255, 0.55)");
  whiteFade.addColorStop(1, "rgba(255, 255, 255, 1)");
  ctx.fillStyle = whiteFade;
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
  roundRectBottom(ctx, tableX, tableTop, tableWidth, tableBodyHeight, 10);
  ctx.fill();
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  scan: IndicatorScanRun,
  x: number,
  y: number,
  contentWidth: number,
  fontFamily: string,
): void {
  const descBoxW = Math.min(300, Math.max(240, contentWidth * 0.42));
  const descPad = 14;
  const descBoxX = x + contentWidth - descBoxW;
  const titleMaxW = contentWidth - descBoxW - 16;
  const description = snapshotDescriptionText(
    scan.filterDescription || scan.filterName,
  );

  ctx.fillStyle = C.brandText;
  ctx.font = font(fontFamily, 700, 10);
  ctx.textAlign = "left";
  const eyebrowLabel = "EXPLORATION";
  ctx.fillText(eyebrowLabel, x, y + 10);

  const eyebrowGap = 10;
  const eyebrowLabelW = ctx.measureText(eyebrowLabel).width;
  ctx.fillStyle = C.muted;
  ctx.fillText(
    formatRunDate(scan.runAt),
    x + eyebrowLabelW + eyebrowGap,
    y + 10,
  );

  ctx.fillStyle = C.ink;
  ctx.font = font(fontFamily, 700, TITLE_SIZE);
  const titleLines = fitTitleLines(ctx, scan.filterName, titleMaxW, 2);
  let titleY = y + TITLE_TOP;
  for (const line of titleLines) {
    ctx.fillText(line, x, titleY);
    titleY += TITLE_LINE_HEIGHT;
  }

  ctx.font = font(fontFamily, 400, 12);
  const descLines = wrapTextLines(
    ctx,
    description,
    descBoxW - descPad * 2,
    3,
  );
  const descBoxH = Math.max(62, 18 + descLines.length * 17 + 16);
  const descBoxY = y;

  ctx.fillStyle = C.brandBadgeBg;
  ctx.strokeStyle = C.brandBadgeBorder;
  ctx.lineWidth = 1;
  roundRect(ctx, descBoxX, descBoxY, descBoxW, descBoxH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = C.body;
  ctx.textAlign = "left";
  const lineHeight = 17;
  const textBlockHeight = descLines.length * lineHeight;
  let textY = descBoxY + (descBoxH - textBlockHeight) / 2 + 11;
  for (const line of descLines) {
    ctx.fillText(line, descBoxX + descPad, textY);
    textY += lineHeight;
  }
}

function fitTitleLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [""];
  if (ctx.measureText(trimmed).width <= maxWidth) {
    return [trimmed];
  }
  return wrapTextLines(ctx, trimmed, maxWidth, maxLines);
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let index = 0;

  while (index < words.length && lines.length < maxLines) {
    let line = words[index]!;
    index += 1;

    while (index < words.length) {
      const candidate = `${line} ${words[index]}`;
      if (ctx.measureText(candidate).width > maxWidth) break;
      line = candidate;
      index += 1;
    }

    if (lines.length === maxLines - 1 && index < words.length) {
      lines.push(
        truncateText(ctx, `${line} ${words.slice(index).join(" ")}`, maxWidth),
      );
      break;
    }

    lines.push(line);
  }

  return lines;
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

  const labelX =
    column.align === "center"
      ? x + (column.width - labelW) / 2
      : x + padL;

  ctx.fillStyle = C.headerBlue;
  ctx.textAlign = "left";
  ctx.fillText(column.label, labelX, y);
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

function roundRectBottom(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y);
  ctx.closePath();
}
