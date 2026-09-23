import type { ReactNode } from "react";

export function LoadingShell({ label = "Loading DeskBreak" }: { label?: string }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 px-5"
      role="status"
      aria-live="polite"
    >
      <div className="h-12 w-12 animate-pulse rounded-[14px] bg-pen/80" />
      <p className="text-sm font-semibold text-muted">{label}</p>
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
    <div className="rounded-[24px] bg-white px-5 py-8 text-center border border-line">
      <p className="font-display font-extrabold text-xl text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
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
      className="rounded-[24px] border-2 border-signal bg-white px-5 py-8 text-center"
      role="alert"
    >
      <p className="font-display font-extrabold text-xl text-ink">{title}</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
