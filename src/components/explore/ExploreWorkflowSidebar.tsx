"use client";

import {
  LabStepBadge,
  LabWorkflowSidebar,
  LabWorkflowStepButton,
} from "@/components/lab/LabShell";
import type { ExplorePath } from "@/lib/explore/indicator-models";

export type ExploreLabView = "setup" | "results";
export type ExploreSetupStep = "symbols" | "indicators" | "strategy" | "scan";

interface ExploreWorkflowSidebarProps {
  labView: ExploreLabView;
  setupStep: ExploreSetupStep;
  explorePath: ExplorePath | null;
  symbolSummary: string;
  indicatorSummary: string;
  strategySummary: string;
  scanSummary: string;
  resultCount: number;
  onSelectStep: (step: ExploreSetupStep) => void;
  onViewResults: () => void;
}

const STEPS: { id: ExploreSetupStep; label: string; number: number }[] = [
  { id: "symbols", label: "Select symbols", number: 1 },
  { id: "indicators", label: "Select indicators", number: 2 },
  { id: "strategy", label: "Select strategy", number: 3 },
  { id: "scan", label: "Scan settings", number: 4 },
];

export function ExploreWorkflowSidebar({
  labView,
  setupStep,
  explorePath,
  symbolSummary,
  indicatorSummary,
  strategySummary,
  scanSummary,
  resultCount,
  onSelectStep,
  onViewResults,
}: ExploreWorkflowSidebarProps) {
  const summaries: Record<ExploreSetupStep, string> = {
    symbols: symbolSummary,
    indicators:
      explorePath === "strategy" ? "Not used (strategy scan)" : indicatorSummary,
    strategy:
      explorePath === "indicator" ? "Not used (indicator scan)" : strategySummary,
    scan:
      explorePath === "indicator"
        ? "Not used (indicator scan)"
        : explorePath === "strategy"
          ? scanSummary
          : "Choose indicator or strategy first",
  };

  return (
    <LabWorkflowSidebar
      title="Explore workflow"
      help={
        <>
          <p className="text-sm font-medium text-ink">How it works</p>
          <p className="mt-1 text-xs leading-relaxed text-body">
            Pick symbols, then scan with indicators or a strategy — not both.
            Indicator scans show signal matches per indicator. Strategy scans
            rank symbols by backtest performance.
          </p>
        </>
      }
    >
      {STEPS.map((step) => {
        const isActive = labView === "setup" && setupStep === step.id;
        const summary = summaries[step.id] || "Not configured";
        const disabled = step.id === "scan" && explorePath !== "strategy";

        return (
          <LabWorkflowStepButton
            key={step.id}
            active={isActive}
            disabled={disabled}
            onClick={() => onSelectStep(step.id)}
            badge={
              <LabStepBadge
                number={step.number}
                done={summary !== "Not configured" && !isActive && !disabled}
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
            number={5}
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
