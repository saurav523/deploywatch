import { ReactNode } from "react";
import clsx from "clsx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-[#1a212b]", className)} />;
}

export function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm font-medium text-red-400">Something went wrong</p>
      <p className="mt-1 text-xs text-slate-500">{message}</p>
    </div>
  );
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

export function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize",
        SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.low
      )}
    >
      {severity}
    </span>
  );
}

export function HealthBadge({ score }: { score: number }) {
  const colorClass = score >= 80 ? "text-[#3ecf8e]" : score >= 50 ? "text-[#f5a623]" : "text-[#ef4444]";
  return <span className={clsx("font-semibold tabular-nums", colorClass)}>{score}</span>;
}

export function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          connected ? "bg-[#3ecf8e] pulse-dot" : "bg-slate-600"
        )}
      />
      {connected ? "Live" : "Disconnected"}
    </span>
  );
}

export function Panel({ title, children, action }: { title?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="card">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h3 className="text-sm font-semibold text-slate-200">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
