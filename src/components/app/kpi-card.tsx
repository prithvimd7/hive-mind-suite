import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string;
  delta?: number;
  hint?: string;
  className?: string;
}

export function KpiCard({ label, value, delta, hint, className }: KpiCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className={cn("card-elevated p-5 animate-in-up transition-all hover:shadow-[var(--shadow-elevated)]", className)}>
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
}
