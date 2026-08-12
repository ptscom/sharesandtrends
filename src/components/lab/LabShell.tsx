"use client";

import type { ReactNode } from "react";

export type LabSummaryChipMode = "count" | "text";

interface LabSummaryChipProps {
  label: string;
  value: number | string;
  mode?: LabSummaryChipMode;
}

export function LabSummaryChip({
  label,
  value,
  mode = "count",
}: LabSummaryChipProps) {
  return (
    <span className="ui-lab-chip">
      {mode === "count" ? (
        <>
          <span className="font-semibold text-ink">{value}</span>
          <span>{label}</span>
        </>
      ) : (
        <>
          <span className="text-muted">{label}</span>
          <span className="truncate font-semibold text-ink">{value}</span>
        </>
      )}
    </span>
  );
}

interface LabTopBarProps {
  title: string;
  description: string;
  chips: ReactNode;
  actionLabel: string;
  loadingLabel: string;
  actionIcon?: ReactNode;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  onAction: () => void;
}

export function LabTopBar({
  title,
  description,
  chips,
  actionLabel,
  loadingLabel,
  actionIcon,
  actionDisabled = false,
  actionLoading = false,
  onAction,
}: LabTopBarProps) {
  return (
    <section className="ui-panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="ui-eyebrow">Research</p>
          <h1 className="ui-page-title mt-1">{title}</h1>
          <p className="ui-helper mt-1 max-w-2xl">{description}</p>
        </div>

        <div className="flex w-full shrink-0 flex-col items-stretch gap-3 sm:w-auto sm:items-end">
          <div className="flex flex-wrap gap-2 sm:justify-end">{chips}</div>
          <button
            type="button"
            disabled={actionDisabled || actionLoading}
            onClick={onAction}
            className="ui-btn-primary inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {actionIcon}
            {actionLoading ? loadingLabel : actionLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

interface LabStatusBannerProps {
  progress?: string | null;
  error?: string | null;
  errorExtra?: ReactNode;
}

export function LabStatusBanner({
  progress,
  error,
  errorExtra,
}: LabStatusBannerProps) {
  if (!progress && !error) return null;

  return (
    <div className="space-y-2">
      {progress && (
        <p className="ui-lab-status ui-lab-status-progress">{progress}</p>
      )}
      {error && (
        <p className="ui-lab-status ui-lab-status-error">
          {error}
          {errorExtra}
        </p>
      )}
    </div>
  );
}

interface LabStepBadgeProps {
  number: number;
  done: boolean;
  active: boolean;
}

export function LabStepBadge({ number, done, active }: LabStepBadgeProps) {
  if (done && !active) {
    return (
      <span className="ui-lab-step-badge ui-lab-step-badge-done">✓</span>
    );
  }

  return (
    <span
      className={`ui-lab-step-badge ${
        active ? "ui-lab-step-badge-active" : "ui-lab-step-badge-idle"
      }`}
    >
      {number}
    </span>
  );
}

interface LabHelpCardProps {
  children: ReactNode;
}

export function LabHelpCard({ children }: LabHelpCardProps) {
  return <div className="ui-lab-help-card">{children}</div>;
}

interface LabWorkflowStepButtonProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  badge: ReactNode;
  title: string;
  summary: string;
  footer?: ReactNode;
}

export function LabWorkflowStepButton({
  active,
  disabled = false,
  onClick,
  badge,
  title,
  summary,
  footer,
}: LabWorkflowStepButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`ui-lab-workflow-step ${active ? "ui-lab-workflow-step-active" : ""}`}
    >
      {active && <span className="ui-lab-workflow-step-indicator" aria-hidden />}
      {badge}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-ink">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted">{summary}</span>
        {footer}
      </span>
    </button>
  );
}

interface LabWorkflowSidebarProps {
  title: string;
  children: ReactNode;
  help: ReactNode;
}

export function LabWorkflowSidebar({
  title,
  children,
  help,
}: LabWorkflowSidebarProps) {
  return (
    <aside className="space-y-4">
      <div className="ui-panel p-4">
        <p className="ui-lab-workflow-title">{title}</p>
        <nav className="mt-4 space-y-1">{children}</nav>
      </div>
      <LabHelpCard>{help}</LabHelpCard>
    </aside>
  );
}
