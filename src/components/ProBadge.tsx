export function ProBadge({ className = "" }: { className?: string }) {
  return (
    <span
      // Named so screen readers announce what the badge means rather than
      // reading a bare word out of context.
      aria-label="DeskBreak Pro subscriber"
      className={[
        "inline-flex items-center rounded-full bg-ink px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-mint",
        className,
      ].join(" ")}
    >
      Pro
    </span>
  );
}
