"use client";

export type BacktestLabView = "setup" | "results";
export type BacktestSetupStep = "symbols" | "strategies";

interface BacktestWorkflowSidebarProps {
  labView: BacktestLabView;
  setupStep: BacktestSetupStep;
  symbolSummary: string;
  strategySummary: string;
  hasResults: boolean;
  onSelectStep: (step: BacktestSetupStep) => void;
  onViewResults: () => void;
}

const STEPS: { id: BacktestSetupStep; label: string; number: number }[] = [
  { id: "symbols", label: "Select symbols", number: 1 },
  { id: "strategies", label: "Select strategies", number: 2 },
];

export function BacktestWorkflowSidebar({
  labView,
  setupStep,
  symbolSummary,
  strategySummary,
  hasResults,
  onSelectStep,
  onViewResults,
}: BacktestWorkflowSidebarProps) {
  return (
    <aside className="space-y-4">
      <div className="ui-panel p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Backtest workflow
        </p>
        <nav className="mt-4 space-y-1">
          {STEPS.map((step) => {
            const isActive =
              labView === "setup" && setupStep === step.id;
            const isComplete =
              step.id === "symbols"
                ? symbolSummary.length > 0
                : strategySummary.length > 0;

            return (
              <button
                key={step.id}
                type="button"
                onClick={() => onSelectStep(step.id)}
                className={`relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                  isActive
                    ? "bg-brand-light/70"
                    : "hover:bg-input"
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
                    {step.id === "symbols" ? symbolSummary : strategySummary}
                  </span>
                  {labView === "results" && (
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
                  )}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onViewResults}
            disabled={!hasResults}
            className={`relative flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
              labView === "results" ? "bg-brand-light/70" : "hover:bg-input"
            }`}
          >
            {labView === "results" && (
              <span className="absolute bottom-2 left-0 top-2 w-1 rounded-full bg-brand" />
            )}
            <StepBadge number={3} done={hasResults} active={labView === "results"} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-ink">
                Results
              </span>
              <span className="mt-0.5 block text-xs text-muted">
                {hasResults ? "View system tester" : "Run a backtest first"}
              </span>
            </span>
          </button>
        </nav>
      </div>

      <div className="rounded-xl border border-info/20 bg-info-light/50 p-4">
        <p className="text-sm font-medium text-ink">How it works</p>
        <p className="mt-1 text-xs leading-relaxed text-body">
          Backtests run for every combination of symbol × strategy × parameter
          set. Use the settings icon on a strategy card to configure sweeps.
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
