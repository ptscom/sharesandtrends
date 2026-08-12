import { computeStats } from "@/lib/engine/backtest";
import type { BacktestSweepRow } from "@/lib/engine/param-sweep";
import type { BacktestStats, Trade } from "@/lib/types";

export type LayerKind =
  | "portfolio"
  | "strategy"
  | "parameters"
  | "symbol"
  | "run";

export type ResultsView = "portfolio" | "strategy" | "symbol" | "runs";

export interface LayerMetrics {
  runs: number;
  symbolCount: number;
  strategyCount: number;
  paramSets: number;
  stats: BacktestStats;
  trades: Trade[];
}

export interface ConsolidatedNode {
  id: string;
  kind: LayerKind;
  label: string;
  metrics: LayerMetrics;
  children: ConsolidatedNode[];
  row?: BacktestSweepRow;
}

export interface ConsolidatedModel {
  portfolio: ConsolidatedNode;
  byStrategy: ConsolidatedNode;
  bySymbol: ConsolidatedNode;
  flatRuns: BacktestSweepRow[];
}

function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string,
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

function makeMetrics(rows: BacktestSweepRow[]): LayerMetrics {
  const trades = rows.flatMap((row) => row.trades);
  return {
    runs: rows.length,
    symbolCount: new Set(rows.map((row) => row.symbol)).size,
    strategyCount: new Set(rows.map((row) => row.strategyId)).size,
    paramSets: new Set(
      rows.map((row) => `${row.strategyId}|${row.paramLabel}`),
    ).size,
    stats: computeStats(trades),
    trades,
  };
}

function buildRunNodes(rows: BacktestSweepRow[]): ConsolidatedNode[] {
  return rows
    .map((row) => ({
      id: `${row.strategyId}|${row.paramLabel}|${row.symbol}`,
      kind: "run" as const,
      label: row.symbol,
      metrics: makeMetrics([row]),
      children: [],
      row,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildParameterNodes(rows: BacktestSweepRow[]): ConsolidatedNode[] {
  const byParam = groupBy(rows, (row) => row.paramLabel);
  return [...byParam.entries()]
    .map(([paramLabel, paramRows]) => ({
      id: `params|${paramRows[0]!.strategyId}|${paramLabel}`,
      kind: "parameters" as const,
      label: paramLabel,
      metrics: makeMetrics(paramRows),
      children: buildRunNodes(paramRows),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildStrategyBranch(rows: BacktestSweepRow[]): ConsolidatedNode[] {
  const byStrategy = groupBy(rows, (row) => row.strategyId);
  return [...byStrategy.entries()]
    .map(([strategyId, strategyRows]) => ({
      id: `strategy|${strategyId}`,
      kind: "strategy" as const,
      label: strategyRows[0]!.strategyName,
      metrics: makeMetrics(strategyRows),
      children: buildParameterNodes(strategyRows),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function buildSymbolBranch(rows: BacktestSweepRow[]): ConsolidatedNode[] {
  const bySymbol = groupBy(rows, (row) => row.symbol);
  return [...bySymbol.entries()]
    .map(([symbol, symbolRows]) => {
      const byStrategy = groupBy(symbolRows, (row) => row.strategyId);
      const strategyChildren = [...byStrategy.entries()]
        .map(([strategyId, strategyRows]) => ({
          id: `symbol|${symbol}|${strategyId}`,
          kind: "strategy" as const,
          label: strategyRows[0]!.strategyName,
          metrics: makeMetrics(strategyRows),
          children: buildParameterNodes(strategyRows),
        }))
        .sort((a, b) => a.label.localeCompare(b.label));

      return {
        id: `symbol|${symbol}`,
        kind: "symbol" as const,
        label: symbol,
        metrics: makeMetrics(symbolRows),
        children: strategyChildren,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function makeRoot(
  id: string,
  kind: LayerKind,
  label: string,
  rows: BacktestSweepRow[],
  children: ConsolidatedNode[],
): ConsolidatedNode {
  return {
    id,
    kind,
    label,
    metrics: makeMetrics(rows),
    children,
  };
}

export function buildConsolidatedModel(
  rows: BacktestSweepRow[],
): ConsolidatedModel {
  const strategyChildren = buildStrategyBranch(rows);
  const symbolChildren = buildSymbolBranch(rows);

  return {
    portfolio: makeRoot("portfolio", "portfolio", "All results", rows, strategyChildren),
    byStrategy: makeRoot(
      "view-strategy",
      "portfolio",
      "By strategy",
      rows,
      strategyChildren,
    ),
    bySymbol: makeRoot(
      "view-symbol",
      "portfolio",
      "By symbol",
      rows,
      symbolChildren,
    ),
    flatRuns: rows,
  };
}

export function getViewRoot(
  model: ConsolidatedModel,
  view: ResultsView,
): ConsolidatedNode | null {
  switch (view) {
    case "portfolio":
      return model.portfolio;
    case "strategy":
      return model.byStrategy;
    case "symbol":
      return model.bySymbol;
    case "runs":
      return null;
    default:
      return model.portfolio;
  }
}

export function findNodeById(
  node: ConsolidatedNode,
  id: string,
): ConsolidatedNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNodeById(child, id);
    if (found) return found;
  }
  return null;
}

export function layerKindLabel(kind: LayerKind): string {
  switch (kind) {
    case "portfolio":
      return "Portfolio";
    case "strategy":
      return "Strategy";
    case "parameters":
      return "Parameters";
    case "symbol":
      return "Symbol";
    case "run":
      return "Run";
    default:
      return kind;
  }
}

export function exportLayerCsv(node: ConsolidatedNode): void {
  if (node.children.length > 0) {
    const header =
      "Layer,Label,Runs,Trades,Win Rate,Avg Return,Sharpe,Best,Worst";
    const lines = node.children.map((child) =>
      formatCsvRow(
        layerKindLabel(child.kind),
        child.label,
        child.metrics.stats,
        child.metrics.runs,
      ),
    );
    downloadCsv(`${sanitizeFilename(node.label)}-summary.csv`, header, lines);
    return;
  }

  const row = node.row;
  if (!row) return;

  const header =
    "Entry,Exit,Side,Entry Price,Exit Price,Hold Days,Return %";
  const lines = row.trades.map(
    (trade) =>
      `${trade.entryDate},${trade.exitDate},${trade.side},${trade.entryPrice.toFixed(2)},${trade.exitPrice.toFixed(2)},${trade.holdDays},${trade.returnPct.toFixed(2)}`,
  );
  downloadCsv(
    `${sanitizeFilename(row.symbol)}-${sanitizeFilename(row.paramLabel)}-trades.csv`,
    header,
    lines,
  );
}

export function exportAllRunsCsv(rows: BacktestSweepRow[]): void {
  const header =
    "Strategy,Parameters,Symbol,Trades,Win Rate,Avg Return,Sharpe,Best,Worst";
  const lines = rows.map((row) =>
    formatCsvRow(
      row.strategyName,
      row.paramLabel,
      row.stats,
      1,
      row.symbol,
    ),
  );
  downloadCsv("backtest-all-runs.csv", header, lines);
}

function formatCsvRow(
  col1: string,
  col2: string,
  stats: BacktestStats,
  runs: number,
  col3?: string,
): string {
  const fields = [
    `"${col1}"`,
    `"${col2}"`,
    ...(col3 ? [`"${col3}"`] : []),
    String(runs),
    String(stats.trades),
    stats.winRate.toFixed(2),
    stats.avgReturnPct.toFixed(2),
    stats.sharpe?.toFixed(2) ?? "",
    stats.bestReturnPct.toFixed(2),
    stats.worstReturnPct.toFixed(2),
  ];
  return fields.join(",");
}

function sanitizeFilename(value: string): string {
  return value.replace(/[^\w.-]+/g, "-").slice(0, 48);
}

function downloadCsv(filename: string, header: string, lines: string[]): void {
  const blob = new Blob([header + "\n" + lines.join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
