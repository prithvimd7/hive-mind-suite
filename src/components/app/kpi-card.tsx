import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  className?: string;
  /** Route to navigate to when the card is tapped/clicked (e.g. "/sales") */
  to?: string;
  /** Primary KPIs are larger; secondary ones sit in a compact row underneath. */
  size?: "primary" | "compact";
}

export function KpiCard({ label, value, delta, hint, className, to, size = "primary" }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  const compact = size === "compact";

  const inner = (
    <div
      className={cn(
        "h-full bg-card border rounded-[var(--radius)] transition-colors",
        compact ? "px-3.5 py-3" : "px-4 py-3.5",
        to && "hover:border-foreground/20",
        className,
      )}
    >
      <div className={cn("font-medium text-muted-foreground", compact ? "text-[11px]" : "text-xs")}>{label}</div>
      <div className="mt-1.5 flex items-baseline gap-2 flex-wrap">
        <div className={cn("font-medium tracking-tight tabular", compact ? "text-lg" : "text-[26px] leading-none")}>
          {value}
        </div>
        {typeof delta === "number" && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-[11px] font-medium tabular",
              positive ? "text-[color:var(--success)]" : "text-destructive",
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      {hint && !compact && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );

  if (!to) return inner;

  return (
    <Link to={to} className="block rounded-[var(--radius)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {inner}
    </Link>
  );
}
