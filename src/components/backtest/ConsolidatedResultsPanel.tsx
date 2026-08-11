"use client";

import { useMemo, useState } from "react";
import { EquityCurveChart } from "@/components/chart/EquityCurveChart";
import { ReturnDistributionChart } from "@/components/chart/ReturnDistributionChart";
import {
  computeEquityFromTrades,
  computeReturnDistribution,
  meanReturn,
} from "@/lib/analytics/backtest-analytics";
import {
  buildConsolidatedModel,
  exportAllRunsCsv,
  exportLayerCsv,
  getViewRoot,
  layerKindLabel,
  type ConsolidatedNode,
  type ResultsView,
} from "@/lib/backtest/consolidated-model";
import type { BacktestSweepRow } from "@/lib/engine/param-sweep";
import type { BacktestStats } from "@/lib/types";

interface ConsolidatedResultsPanelProps {
  rows: BacktestSweepRow[];
  completedAt?: string | null;
}

const VIEWS: { id: ResultsView; label: string }[] = [
  { id: "portfolio", label: "Portfolio" },
  { id: "strategy", label: "By strategy" },
  { id: "symbol", label: "By symbol" },
  { id: "runs", label: "All runs" },
];

export function ConsolidatedResultsPanel({
  rows,
  completedAt,
}: ConsolidatedResultsPanelProps) {
  const model = useMemo(() => buildConsolidatedModel(rows), [rows]);
  const portfolioTrades = model.portfolio.metrics.trades;
  const equityCurve = useMemo(
    () => computeEquityFromTrades(portfolioTrades),
    [portfolioTrades],
  );
  const distribution = useMemo(
    () => computeReturnDistribution(portfolioTrades),
    [portfolioTrades],
  );
  const avgReturn = useMemo(
    () => meanReturn(portfolioTrades),
    [portfolioTrades],
  );
  const [view, setView] = useState<ResultsView>("portfolio");
  const [selectedId, setSelectedId] = useState<string>("portfolio");
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["portfolio"]));

  const viewRoot = getViewRoot(model, view);
  const selectedNode = useMemo(() => {
    if (view === "runs") return null;
    const root = viewRoot ?? model.portfolio;
    return findNode(root, selectedId) ?? root;
  }, [view, viewRoot, model.portfolio, selectedId]);

  if (rows.length === 0) return null;

  const handleViewChange = (next: ResultsView) => {
    setView(next);
    if (next === "runs") return;
    const root = getViewRoot(model, next);
    if (root) {
      setSelectedId(root.id);
      setExpanded(new Set([root.id]));
    }
  };

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Results</p>
          <h2 className="ui-section-title mt-2">
            System tester ({rows.length} runs)
          </h2>
          <p className="ui-helper mt-1">
            Drill down through portfolio, strategy, parameter, and symbol layers.
            {completedAt && (
              <span className="text-muted">
                {" "}
                · Completed {formatCompletedAt(completedAt)}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {view !== "runs" && selectedNode && (
            <button
              type="button"
              onClick={() => exportLayerCsv(selectedNode)}
              className="ui-btn-secondary"
            >
              Export layer
            </button>
          )}
          <button
            type="button"
            onClick={() => exportAllRunsCsv(rows)}
            className="ui-btn-secondary"
          >
            Export all runs
          </button>
        </div>
      </div>

      <div className="mt-6">
        <MetricsGrid stats={model.portfolio.metrics.stats} />
      </div>

      {portfolioTrades.length > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="ui-nested-card">
            <h3 className="ui-section-title">Equity curve</h3>
            <p className="ui-helper mt-0.5">Cumulative return across all runs</p>
            <div className="mt-3">
              <EquityCurveChart
                strategy={equityCurve}
                buyHold={[]}
                symbol="Portfolio"
                height={220}
              />
            </div>
          </div>
          <div className="ui-nested-card">
            <h3 className="ui-section-title">Returns distribution</h3>
            <p className="ui-helper mt-0.5">Trade return frequency</p>
            <div className="mt-3">
              <ReturnDistributionChart bins={distribution} mean={avgReturn} />
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {VIEWS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => handleViewChange(item.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              view === item.id
                ? "bg-brand text-white"
                : "bg-input text-body hover:bg-border-subtle"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {view === "runs" ? (
        <div className="mt-6">
          <h3 className="ui-section-title">All runs</h3>
          <AllRunsTable rows={rows} completedAt={completedAt} />
        </div>
      ) : (
        viewRoot && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(14rem,22rem)_1fr]">
            <div className="rounded-xl border border-border-subtle bg-input/40 p-3">
              <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                Layers
              </p>
              <LayerTree
                node={viewRoot}
                selectedId={selectedId}
                expanded={expanded}
                onSelect={setSelectedId}
                onToggle={(id) => {
                  setExpanded((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
              />
            </div>

            {selectedNode && <LayerDetail node={selectedNode} onSelect={setSelectedId} />}
          </div>
        )
      )}

      {view !== "runs" && rows.length > 0 && (
        <div className="mt-8 border-t border-border-subtle pt-6">
          <h3 className="ui-section-title">Runs summary</h3>
          <p className="ui-helper mt-1">
            All {rows.length} backtest runs from this sweep.
          </p>
          <AllRunsTable rows={rows} completedAt={completedAt} />
        </div>
      )}
    </section>
  );
}

function LayerTree({
  node,
  selectedId,
  expanded,
  onSelect,
  onToggle,
  depth = 0,
}: {
  node: ConsolidatedNode;
  selectedId: string;
  expanded: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  depth?: number;
}) {
  const hasChildren = node.children.length > 0;
  const isExpanded = expanded.has(node.id);
  const isSelected = selectedId === node.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 rounded-lg pr-2 transition ${
          isSelected ? "bg-brand-light/60" : "hover:bg-border-subtle/60"
        }`}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => onToggle(node.id)}
            className="flex h-7 w-7 shrink-0 items-center justify-center text-muted hover:text-ink"
            aria-label={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="inline-block h-7 w-7 shrink-0" />
        )}
        <button
          type="button"
          onClick={() => onSelect(node.id)}
          className="min-w-0 flex-1 py-1.5 text-left"
        >
          <span className="block truncate text-sm font-medium text-ink">
            {node.label}
          </span>
          <span className="block truncate text-xs text-muted">
            {layerKindLabel(node.kind)} · {node.metrics.stats.trades} trades
          </span>
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <LayerTree
              key={child.id}
              node={child}
              selectedId={selectedId}
              expanded={expanded}
              onSelect={onSelect}
              onToggle={onToggle}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LayerDetail({
  node,
  onSelect,
}: {
  node: ConsolidatedNode;
  onSelect: (id: string) => void;
}) {
  const { metrics } = node;
  const isLeaf = node.children.length === 0;

  return (
    <div className="min-w-0 space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {layerKindLabel(node.kind)}
        </p>
        <h3 className="mt-1 text-xl font-semibold text-ink">{node.label}</h3>
        <p className="ui-helper mt-1">
          {metrics.runs} run{metrics.runs === 1 ? "" : "s"} ·{" "}
          {metrics.strategyCount} strateg{metrics.strategyCount === 1 ? "y" : "ies"} ·{" "}
          {metrics.symbolCount} symbol{metrics.symbolCount === 1 ? "" : "s"} ·{" "}
          {metrics.paramSets} parameter set{metrics.paramSets === 1 ? "" : "s"}
        </p>
      </div>

      <MetricsGrid stats={metrics.stats} />

      {isLeaf && node.row ? (
        <TradesTable trades={node.row.trades} />
      ) : (
        <ChildrenTable children={node.children} onSelect={onSelect} />
      )}
    </div>
  );
}

function MetricsGrid({ stats }: { stats: BacktestStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Trades" value={String(stats.trades)} />
      <MetricCard label="Win rate" value={`${stats.winRate.toFixed(1)}%`} />
      <MetricCard
        label="Avg return"
        value={`${stats.avgReturnPct >= 0 ? "+" : ""}${stats.avgReturnPct.toFixed(2)}%`}
        tone={stats.avgReturnPct >= 0 ? "positive" : "negative"}
      />
      <MetricCard
        label="Sharpe"
        value={stats.sharpe != null ? stats.sharpe.toFixed(2) : "—"}
      />
      <MetricCard
        label="Best"
        value={`${stats.bestReturnPct.toFixed(1)}%`}
        tone="positive"
      />
      <MetricCard
        label="Worst"
        value={`${stats.worstReturnPct.toFixed(1)}%`}
        tone="negative"
      />
      <MetricCard
        label="Median return"
        value={`${stats.medianReturnPct.toFixed(2)}%`}
      />
      <MetricCard
        label="Wins / losses"
        value={`${stats.wins} / ${stats.losses}`}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-danger"
        : "text-ink";

  return (
    <div className="rounded-xl border border-border-subtle bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ChildrenTable({
  children,
  onSelect,
}: {
  children: ConsolidatedNode[];
  onSelect: (id: string) => void;
}) {
  const sorted = [...children].sort(
    (a, b) =>
      b.metrics.stats.winRate - a.metrics.stats.winRate ||
      b.metrics.stats.avgReturnPct - a.metrics.stats.avgReturnPct,
  );

  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">Child layers</h4>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
        <table className="ui-table min-w-[720px]">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Label</th>
              <th>Runs</th>
              <th>Trades</th>
              <th>Win rate</th>
              <th>Avg return</th>
              <th>Sharpe</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((child) => (
              <tr
                key={child.id}
                className="cursor-pointer hover:bg-brand-light/30"
                onClick={() => onSelect(child.id)}
              >
                <td className="text-muted">{layerKindLabel(child.kind)}</td>
                <td className="max-w-[14rem] font-medium">{child.label}</td>
                <td>{child.metrics.runs}</td>
                <td>{child.metrics.stats.trades}</td>
                <td>{child.metrics.stats.winRate.toFixed(1)}%</td>
                <td
                  className={
                    child.metrics.stats.avgReturnPct >= 0
                      ? "text-success"
                      : "text-danger"
                  }
                >
                  {child.metrics.stats.avgReturnPct >= 0 ? "+" : ""}
                  {child.metrics.stats.avgReturnPct.toFixed(2)}%
                </td>
                <td>
                  {child.metrics.stats.sharpe != null
                    ? child.metrics.stats.sharpe.toFixed(2)
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TradesTable({ trades }: { trades: import("@/lib/types").Trade[] }) {
  if (trades.length === 0) {
    return (
      <p className="ui-helper rounded-xl border border-border-subtle px-4 py-6 text-center">
        No trades in this run.
      </p>
    );
  }

  const sorted = [...trades].sort((a, b) => b.exitDate.localeCompare(a.exitDate));

  return (
    <div>
      <h4 className="text-sm font-semibold text-ink">Trades</h4>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
        <table className="ui-table min-w-[560px]">
          <thead>
            <tr>
              <th>Entry</th>
              <th>Exit</th>
              <th>Hold</th>
              <th>Entry price</th>
              <th>Exit price</th>
              <th>Return</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((trade) => (
              <tr key={`${trade.entryDate}-${trade.exitDate}`}>
                <td>{trade.entryDate}</td>
                <td>{trade.exitDate}</td>
                <td>{trade.holdDays}d</td>
                <td>{trade.entryPrice.toFixed(2)}</td>
                <td>{trade.exitPrice.toFixed(2)}</td>
                <td
                  className={`font-semibold ${trade.returnPct >= 0 ? "text-success" : "text-danger"}`}
                >
                  {trade.returnPct >= 0 ? "+" : ""}
                  {trade.returnPct.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllRunsTable({
  rows,
  completedAt,
}: {
  rows: BacktestSweepRow[];
  completedAt?: string | null;
}) {
  const sorted = [...rows].sort(
    (a, b) =>
      b.stats.winRate - a.stats.winRate ||
      b.stats.avgReturnPct - a.stats.avgReturnPct,
  );

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border-subtle">
      <table className="ui-table min-w-[960px]">
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Parameters</th>
            <th>Symbol</th>
            <th>Trades</th>
            <th>Win rate</th>
            <th>Avg return</th>
            <th>Sharpe</th>
            <th>Status</th>
            {completedAt && <th>Completed</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, index) => (
            <tr key={`${row.strategyId}-${row.symbol}-${row.paramLabel}-${index}`}>
              <td className="font-medium">{row.strategyName}</td>
              <td className="max-w-[14rem] text-body">{row.paramLabel}</td>
              <td className="font-mono font-semibold">{row.symbol}</td>
              <td>{row.stats.trades}</td>
              <td>{row.stats.winRate.toFixed(1)}%</td>
              <td
                className={
                  row.stats.avgReturnPct >= 0 ? "text-success" : "text-danger"
                }
              >
                {row.stats.avgReturnPct >= 0 ? "+" : ""}
                {row.stats.avgReturnPct.toFixed(2)}%
              </td>
              <td>
                {row.stats.sharpe != null ? row.stats.sharpe.toFixed(2) : "—"}
              </td>
              <td>
                <span className="ui-badge bg-success-light text-success">
                  Completed
                </span>
              </td>
              {completedAt && (
                <td className="text-muted text-xs">
                  {formatCompletedAt(completedAt)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function findNode(node: ConsolidatedNode, id: string): ConsolidatedNode | null {
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return null;
}

function formatCompletedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
