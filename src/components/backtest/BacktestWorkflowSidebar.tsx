"use client";

import {
  LabStepBadge,
  LabWorkflowSidebar,
  LabWorkflowStepButton,
} from "@/components/lab/LabShell";

export type BacktestLabView = "setup" | "results";
export type BacktestSetupStep = "symbols" | "strategies" | "trade";

interface BacktestWorkflowSidebarProps {
  labView: BacktestLabView;
  setupStep: BacktestSetupStep;
  symbolSummary: string;
  strategySummary: string;
  tradeSummary: string;
  hasResults: boolean;
  onSelectStep: (step: BacktestSetupStep) => void;
  onViewResults: () => void;
}

const STEPS: { id: BacktestSetupStep; label: string; number: number }[] = [
  { id: "symbols", label: "Select symbols", number: 1 },
  { id: "strategies", label: "Select strategies", number: 2 },
  { id: "trade", label: "Trade settings", number: 3 },
];

export function BacktestWorkflowSidebar({
  labView,
  setupStep,
  symbolSummary,
  strategySummary,
  tradeSummary,
  hasResults,
  onSelectStep,
  onViewResults,
}: BacktestWorkflowSidebarProps) {
  const summaries: Record<BacktestSetupStep, string> = {
    symbols: symbolSummary,
    strategies: strategySummary,
    trade: tradeSummary,
  };

  return (
    <LabWorkflowSidebar
      title="Backtest workflow"
      help={
        <>
          <p className="text-sm font-medium text-ink">How it works</p>
          <p className="mt-1 text-xs leading-relaxed text-body">
            Backtests run for every combination of symbol × strategy × parameter
            set. Trade settings can override strategy exit signals for all runs.
          </p>
        </>
      }
    >
      {STEPS.map((step) => {
        const isActive = labView === "setup" && setupStep === step.id;
        const summary = summaries[step.id];

        return (
          <LabWorkflowStepButton
            key={step.id}
            active={isActive}
            onClick={() => onSelectStep(step.id)}
            badge={
              <LabStepBadge
                number={step.number}
                done={summary.length > 0 && !isActive}
                active={isActive}
              />
            }
            title={step.label}
            summary={summary || "Not configured"}
            footer={
              labView === "results" ? (
                <span
                  role="link"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectStep(step.id);
                  }}
                  className="mt-1 inline-block text-xs font-medium text-brand-text hover:underline"
                >
                  Edit
                </span>
              ) : undefined
            }
          />
        );
      })}

      <LabWorkflowStepButton
        active={labView === "results"}
        disabled={!hasResults}
        onClick={onViewResults}
        badge={
          <LabStepBadge
            number={4}
            done={hasResults && labView !== "results"}
            active={labView === "results"}
          />
        }
        title="Results"
        summary={hasResults ? "View system tester" : "Run a backtest first"}
      />
    </LabWorkflowSidebar>
  );
}
