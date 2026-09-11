"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildConsolidatedModel,
  exportAllRunsCsv,
  exportLayerCsv,
  findStrategyNode,
  findSymbolNode,
  listStrategySummaries,
  type ConsolidatedNode,
} from "@/lib/backtest/consolidated-model";
import type { BacktestSweepRow } from "@/lib/engine/param-sweep";
import type { BacktestStats, Trade } from "@/lib/types";

interface ConsolidatedResultsPanelProps {
  rows: BacktestSweepRow[];
  completedAt?: string | null;
  dateRangeSummary?: string | null;
}

type DrillLevel = "strategies" | "symbols" | "trades";

function strategyIdFromNodeId(nodeId: string): string {
  return nodeId.replace(/^strategy\|/, "").split("|")[0] ?? nodeId;
}

export function ConsolidatedResultsPanel({
  rows,
  completedAt,
}: ConsolidatedResultsPanelProps) {
  const model = useMemo(() => buildConsolidatedModel(rows), [rows]);
  const strategies = useMemo(() => listStrategySummaries(model), [model]);

  const [level, setLevel] = useState<DrillLevel>("strategies");
  const [selectedStrategyId, setSelectedStrategyId] = useState<string | null>(
    null,
  );
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);

  useEffect(() => {
    if (rows.length === 0) return;
    if (strategies.length === 1) {
      const only = strategies[0]!;
      setSelectedStrategyId(strategyIdFromNodeId(only.id));
      setSelectedSymbol(null);
      setLevel("symbols");
      return;
    }
    setSelectedStrategyId(null);
    setSelectedSymbol(null);
    setLevel("strategies");
  }, [rows, strategies]);

  const strategyNode = useMemo(() => {
    if (!selectedStrategyId) return null;
    return findStrategyNode(model, selectedStrategyId);
  }, [model, selectedStrategyId]);

  const symbolNode = useMemo(() => {
    if (!strategyNode || !selectedSymbol) return null;
    return findSymbolNode(strategyNode, selectedSymbol);
  }, [strategyNode, selectedSymbol]);

  const contextMetrics: BacktestStats = useMemo(() => {
    if (level === "trades" && symbolNode) return symbolNode.metrics.stats;
    if (level === "symbols" && strategyNode) return strategyNode.metrics.stats;
    return model.portfolio.metrics.stats;
  }, [level, symbolNode, strategyNode, model.portfolio.metrics.stats]);

  const tradesCountHint = useMemo(() => {
    if (level === "symbols" && strategyNode) {
      const fromSymbols = strategyNode.children.reduce(
        (sum, child) => sum + child.metrics.stats.trades,
        0,
      );
      return `Total trades across ${strategyNode.children.length} symbols (one run per symbol). Sum of symbol rows: ${fromSymbols}.`;
    }
    if (level === "strategies") {
      return "Trades count each closed position once per symbol (primary parameter set when sweeps are enabled).";
    }
    return null;
  }, [level, strategyNode]);

  if (rows.length === 0) return null;

  const openStrategy = (node: ConsolidatedNode) => {
    setSelectedStrategyId(strategyIdFromNodeId(node.id));
    setSelectedSymbol(null);
    setLevel("symbols");
  };

  const openSymbol = (node: ConsolidatedNode) => {
    const symbol = node.label;
    setSelectedSymbol(symbol);
    setLevel("trades");
  };

  const goToStrategies = () => {
    if (strategies.length <= 1) return;
    setSelectedStrategyId(null);
    setSelectedSymbol(null);
    setLevel("strategies");
  };

  const goToSymbols = () => {
    setSelectedSymbol(null);
    setLevel("symbols");
  };

  const exportNode =
    level === "trades" && symbolNode
      ? symbolNode
      : level === "symbols" && strategyNode
        ? strategyNode
        : model.portfolio;

  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="ui-eyebrow">Results</p>
          <h2 className="ui-section-title mt-2">
            Backtest results ({rows.length} runs)
          </h2>
          <p className="ui-helper mt-1">
            Drill down: strategy summary → symbol summary → trades by date.
            {completedAt && (
              <span className="text-muted">
                {" "}
                · Completed {formatCompletedAt(completedAt)}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportLayerCsv(exportNode)}
            className="ui-btn-secondary"
          >
            Export current view
          </button>
          <button
            type="button"
            onClick={() => exportAllRunsCsv(rows)}
            className="ui-btn-secondary"
          >
            Export all runs
          </button>
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap items-center gap-1 text-sm" aria-label="Results drill-down">
        {strategies.length > 1 && (
          <>
            <BreadcrumbButton
              active={level === "strategies"}
              onClick={goToStrategies}
            >
              All strategies
            </BreadcrumbButton>
            {(level === "symbols" || level === "trades") && strategyNode && (
              <>
                <span className="text-muted">/</span>
                <BreadcrumbButton
                  active={level === "symbols"}
                  onClick={goToSymbols}
                >
                  {strategyNode.label}
                </BreadcrumbButton>
              </>
            )}
            {level === "trades" && selectedSymbol && (
              <>
                <span className="text-muted">/</span>
                <span className="font-medium text-ink">{selectedSymbol}</span>
              </>
            )}
          </>
        )}
        {strategies.length === 1 && strategyNode && (
          <>
            <BreadcrumbButton active={level === "symbols"} onClick={goToSymbols}>
              {strategyNode.label}
            </BreadcrumbButton>
            {level === "trades" && selectedSymbol && (
              <>
                <span className="text-muted">/</span>
                <span className="font-medium text-ink">{selectedSymbol}</span>
              </>
            )}
          </>
        )}
      </nav>

      <div className="mt-5">
        <MetricsGrid stats={contextMetrics} />
        {tradesCountHint && (
          <p className="ui-helper mt-2">{tradesCountHint}</p>
        )}
      </div>

      <div className="mt-6">
        {level === "strategies" && (
          <StrategySummaryTable strategies={strategies} onSelect={openStrategy} />
        )}
        {level === "symbols" && strategyNode && (
          <SymbolSummaryTable
            strategyName={strategyNode.label}
            symbols={strategyNode.children}
            onSelect={openSymbol}
          />
        )}
        {level === "trades" && symbolNode && strategyNode && (
          <TradesByDateTable
            strategyName={strategyNode.label}
            symbol={symbolNode.label}
            trades={symbolNode.metrics.trades}
          />
        )}
      </div>
    </section>
  );
}

function BreadcrumbButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  if (active) {
    return <span className="font-medium text-ink">{children}</span>;
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-brand hover:underline"
    >
      {children}
    </button>
  );
}

function StrategySummaryTable({
  strategies,
  onSelect,
}: {
  strategies: ConsolidatedNode[];
  onSelect: (node: ConsolidatedNode) => void;
}) {
  const sorted = [...strategies].sort(
    (a, b) =>
      b.metrics.stats.avgReturnPct - a.metrics.stats.avgReturnPct ||
      b.metrics.stats.winRate - a.metrics.stats.winRate,
  );

  return (
    <SummarySection
      title="Strategy summary"
      description="Click a strategy to see results by symbol."
    >
      <table className="ui-table min-w-[720px]">
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Symbols</th>
            <th>Trades</th>
            <th>Win rate</th>
            <th>Avg return</th>
            <th>Sharpe</th>
            <th>Best</th>
            <th>Worst</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((node) => (
            <ClickableRow key={node.id} onClick={() => onSelect(node)}>
              <td className="font-medium">{node.label}</td>
              <td>{node.metrics.symbolCount}</td>
              <td>{node.metrics.stats.trades}</td>
              <td>{node.metrics.stats.winRate.toFixed(1)}%</td>
              <td className={returnTone(node.metrics.stats.avgReturnPct)}>
                {formatReturn(node.metrics.stats.avgReturnPct)}
              </td>
              <td>
                {node.metrics.stats.sharpe != null
                  ? node.metrics.stats.sharpe.toFixed(2)
                  : "—"}
              </td>
              <td className="text-success">
                +{node.metrics.stats.bestReturnPct.toFixed(1)}%
              </td>
              <td className="text-danger">
                {node.metrics.stats.worstReturnPct.toFixed(1)}%
              </td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </SummarySection>
  );
}

function SymbolSummaryTable({
  strategyName,
  symbols,
  onSelect,
}: {
  strategyName: string;
  symbols: ConsolidatedNode[];
  onSelect: (node: ConsolidatedNode) => void;
}) {
  const sorted = [...symbols].sort(
    (a, b) =>
      b.metrics.stats.avgReturnPct - a.metrics.stats.avgReturnPct ||
      b.metrics.stats.winRate - a.metrics.stats.winRate,
  );

  return (
    <SummarySection
      title={`${strategyName} · by symbol`}
      description="Click a symbol to see all trades sorted by entry date."
    >
      <table className="ui-table min-w-[720px]">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Trades</th>
            <th>Win rate</th>
            <th>Avg return</th>
            <th>Sharpe</th>
            <th>Best</th>
            <th>Worst</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((node) => (
            <ClickableRow key={node.id} onClick={() => onSelect(node)}>
              <td className="font-mono font-semibold">{node.label}</td>
              <td>{node.metrics.stats.trades}</td>
              <td>{node.metrics.stats.winRate.toFixed(1)}%</td>
              <td className={returnTone(node.metrics.stats.avgReturnPct)}>
                {formatReturn(node.metrics.stats.avgReturnPct)}
              </td>
              <td>
                {node.metrics.stats.sharpe != null
                  ? node.metrics.stats.sharpe.toFixed(2)
                  : "—"}
              </td>
              <td className="text-success">
                +{node.metrics.stats.bestReturnPct.toFixed(1)}%
              </td>
              <td className="text-danger">
                {node.metrics.stats.worstReturnPct.toFixed(1)}%
              </td>
            </ClickableRow>
          ))}
        </tbody>
      </table>
    </SummarySection>
  );
}

function TradesByDateTable({
  strategyName,
  symbol,
  trades,
}: {
  strategyName: string;
  symbol: string;
  trades: Trade[];
}) {
  const sorted = [...trades].sort((a, b) =>
    b.entryDate.localeCompare(a.entryDate),
  );

  if (sorted.length === 0) {
    return (
      <SummarySection
        title={`${strategyName} · ${symbol}`}
        description="No trades for this symbol."
      >
        <p className="ui-helper rounded-xl border border-border-subtle px-4 py-6 text-center">
          No trades recorded.
        </p>
      </SummarySection>
    );
  }

  return (
    <SummarySection
      title={`${strategyName} · ${symbol}`}
      description="All trades sorted by entry date (newest first)."
    >
      <table className="ui-table min-w-[800px]">
        <thead>
          <tr>
            <th>Entry date</th>
            <th>Exit date</th>
            <th>Side</th>
            <th>Entry price</th>
            <th>Exit price</th>
            <th>Days held</th>
            <th>Return</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((trade) => (
            <tr key={`${trade.entryDate}-${trade.exitDate}-${trade.entryPrice}`}>
              <td className="font-medium">{formatTradeDate(trade.entryDate)}</td>
              <td>{formatTradeDate(trade.exitDate)}</td>
              <td>
                <span
                  className={`ui-badge ${
                    trade.side === "long"
                      ? "bg-info-light text-info"
                      : "bg-danger-light text-danger"
                  }`}
                >
                  {trade.side}
                </span>
              </td>
              <td className="font-mono">${trade.entryPrice.toFixed(2)}</td>
              <td className="font-mono">${trade.exitPrice.toFixed(2)}</td>
              <td>{trade.holdDays}</td>
              <td className={`font-semibold ${returnTone(trade.returnPct)}`}>
                {formatReturn(trade.returnPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SummarySection>
  );
}

function SummarySection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="ui-section-title">{title}</h3>
      <p className="ui-helper mt-1">{description}</p>
      <div className="mt-3 overflow-x-auto rounded-xl border border-border-subtle">
        {children}
      </div>
    </div>
  );
}

function ClickableRow({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <tr
      className="cursor-pointer hover:bg-brand-light/30"
      onClick={onClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {children}
    </tr>
  );
}

function MetricsGrid({ stats }: { stats: BacktestStats }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard label="Trades" value={String(stats.trades)} />
      <MetricCard label="Win rate" value={`${stats.winRate.toFixed(1)}%`} />
      <MetricCard
        label="Avg return"
        value={formatReturn(stats.avgReturnPct)}
        tone={stats.avgReturnPct >= 0 ? "positive" : "negative"}
      />
      <MetricCard
        label="Sharpe"
        value={stats.sharpe != null ? stats.sharpe.toFixed(2) : "—"}
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

function returnTone(value: number): string {
  return value >= 0 ? "text-success" : "text-danger";
}

function formatReturn(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatTradeDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCompletedAt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
