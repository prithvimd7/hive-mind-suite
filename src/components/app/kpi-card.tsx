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
}

export function KpiCard({ label, value, delta, hint, className, to }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;

  const inner = (
    <div
      className={cn(
        "card-elevated p-5 animate-in-up transition-all hover:shadow-[var(--shadow-elevated)]",
        to && "cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
        className,
      )}
    >
      <div className="text-xs font-medium text-muted-foreground tracking-wide uppercase">{label}</div>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <div className="text-2xl md:text-[28px] font-semibold tracking-tight">{value}</div>
        {typeof delta === "number" && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium rounded-full px-2 py-0.5",
              positive ? "text-[color:var(--success)] bg-[color:var(--success)]/10" : "text-destructive bg-destructive/10",
            )}
          >
            {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}%
          </div>
        )}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );

  if (!to) return inner;

  return (
    <Link to={to} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-[var(--radius,0.75rem)]">
      {inner}
    </Link>
  );
}
