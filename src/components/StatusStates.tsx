import type { ReactNode } from "react";

export function LoadingShell({ label = "Loading DeskBreak" }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5"
      role="status"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-pulse rounded-[14px] bg-coral/80" />
      <p className="text-sm font-semibold text-ink/50">{label}</p>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[24px] bg-white px-5 py-8 text-center shadow-[0_4px_0_rgba(28,25,23,0.06)]">
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/60">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="rounded-[24px] border-2 border-coral/30 bg-white px-5 py-8 text-center"
      role="alert"
    >
      <p className="font-display text-xl font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink/60">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
