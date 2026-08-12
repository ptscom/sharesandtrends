"use client";

import {
  LabStepBadge,
  LabWorkflowSidebar,
  LabWorkflowStepButton,
} from "@/components/lab/LabShell";

export type ExploreLabView = "setup" | "results";
export type ExploreSetupStep = "symbols" | "strategy" | "scan";

interface ExploreWorkflowSidebarProps {
  labView: ExploreLabView;
  setupStep: ExploreSetupStep;
  symbolSummary: string;
  strategySummary: string;
  scanSummary: string;
  resultCount: number;
  onSelectStep: (step: ExploreSetupStep) => void;
  onViewResults: () => void;
}

const STEPS: { id: ExploreSetupStep; label: string; number: number }[] = [
  { id: "symbols", label: "Select symbols", number: 1 },
  { id: "strategy", label: "Select strategy", number: 2 },
  { id: "scan", label: "Scan settings", number: 3 },
];

export function ExploreWorkflowSidebar({
  labView,
  setupStep,
  symbolSummary,
  strategySummary,
  scanSummary,
  resultCount,
  onSelectStep,
  onViewResults,
}: ExploreWorkflowSidebarProps) {
  const summaries: Record<ExploreSetupStep, string> = {
    symbols: symbolSummary,
    strategy: strategySummary,
    scan: scanSummary,
  };

  return (
    <LabWorkflowSidebar
      title="Explore workflow"
      help={
        <>
          <p className="text-sm font-medium text-ink">How it works</p>
          <p className="mt-1 text-xs leading-relaxed text-body">
            The scan runs your strategy across every selected symbol and ranks
            matches by win rate, trades, and other backtest stats.
          </p>
        </>
      }
    >
      {STEPS.map((step) => {
        const isActive = labView === "setup" && setupStep === step.id;
        const summary = summaries[step.id] || "Not configured";

        return (
          <LabWorkflowStepButton
            key={step.id}
            active={isActive}
            onClick={() => onSelectStep(step.id)}
            badge={
              <LabStepBadge
                number={step.number}
                done={summary !== "Not configured" && !isActive}
                active={isActive}
              />
            }
            title={step.label}
            summary={summary}
          />
        );
      })}

      <LabWorkflowStepButton
        active={labView === "results"}
        disabled={resultCount === 0}
        onClick={onViewResults}
        badge={
          <LabStepBadge
            number={4}
            done={resultCount > 0 && labView !== "results"}
            active={labView === "results"}
          />
        }
        title="Results"
        summary={
          resultCount > 0
            ? `${resultCount} match${resultCount === 1 ? "" : "es"}`
            : "Run a scan first"
        }
      />
    </LabWorkflowSidebar>
  );
}
