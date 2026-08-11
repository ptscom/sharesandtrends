"use client";

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
    <aside className="space-y-4">
      <div className="ui-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Explore workflow
        </p>
        <nav className="mt-4 space-y-1">
          {STEPS.map((step) => {
            const isActive = labView === "setup" && setupStep === step.id;
            const isComplete = summaries[step.id].length > 0;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                className={`relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isActive ? "bg-brand-light/70" : "hover:bg-input"
                }`}
              >
                {isActive && (
                  <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-brand" />
                )}
                <StepBadge
                  number={step.number}
                  done={isComplete && !isActive}
                  active={isActive}
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">
                    {step.label}
                  </span>
                  <span className="mt-0.5 block truncate text-xs text-muted">
                    {summaries[step.id] || "Not configured"}
                  </span>
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onViewResults}
            disabled={resultCount === 0}
            className={`relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              labView === "results" ? "bg-brand-light/70" : "hover:bg-input"
            }`}
          >
            {labView === "results" && (
              <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-brand" />
            )}
            <StepBadge
              number={4}
              done={resultCount > 0}
              active={labView === "results"}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">Results</span>
              <span className="mt-0.5 block text-xs text-muted">
                {resultCount > 0
                  ? `${resultCount} match${resultCount === 1 ? "" : "es"}`
                  : "Run a scan first"}
              </span>
            </span>
          </button>
        </nav>
      </div>

      <div className="rounded-xl border border-info/20 bg-info-light/50 p-4">
        <p className="text-sm font-medium text-ink">How it works</p>
        <p className="mt-1 text-xs leading-relaxed text-body">
          The scan runs your strategy across every selected symbol and ranks
          matches by win rate, trades, and other backtest stats.
        </p>
      </div>
    </aside>
  );
}

function StepBadge({
  number,
  done,
  active,
}: {
  number: number;
  done: boolean;
  active: boolean;
}) {
  if (done && !active) {
    return (
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-light text-success">
        ✓
      </span>
    );
  }

  return (
    <span
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
        active
          ? "bg-brand text-white"
          : "border border-border bg-surface text-muted"
      }`}
    >
      {number}
    </span>
  );
}
