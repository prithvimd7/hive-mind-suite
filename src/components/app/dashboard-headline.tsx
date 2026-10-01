import { useRole } from "@/hooks/use-role";
import type { BusinessSnapshot } from "@/hooks/use-business-snapshot";
import { currency, pct } from "@/lib/format";
import { RANGE_PRESETS, type RangeKey } from "@/lib/date-range";
import { Skeleton } from "@/components/ui/skeleton";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

/** One plain-English sentence about how the period is going, written from the snapshot. */
function summarise(s: BusinessSnapshot, rangeKey: RangeKey): string {
  const period = RANGE_PRESETS[rangeKey].short;
  if (s.revenue === 0) {
    return `No sales recorded in the last ${period}. Sync a channel or add a sale to get started.`;
  }

  const parts: string[] = [];
  if (s.prevRevenue > 0) {
    const change = ((s.revenue - s.prevRevenue) / s.prevRevenue) * 100;
    const word = change >= 1 ? "ahead of" : change <= -1 ? "behind" : "level with";
    parts.push(
      Math.abs(change) < 1
        ? `Revenue is ${currency(s.revenue)}, level with the previous ${period}.`
        : `Revenue is ${currency(s.revenue)}, ${Math.abs(change).toFixed(0)}% ${word} the previous ${period}.`,
    );
  } else {
    parts.push(`Revenue is ${currency(s.revenue)} over the last ${period}.`);
  }

  if (s.expenses === 0 && s.adSpend === 0) {
    parts.push("Add expenses in Finance to see profit and margin.");
  } else if (s.netProfit >= 0) {
    parts.push(`Net profit ${currency(s.netProfit)} at ${pct(s.netMargin, 0)} margin.`);
  } else {
    parts.push(`Running at a loss of ${currency(Math.abs(s.netProfit))} after costs.`);
  }

  const urgent = s.alerts.filter((a) => a.kind === "destructive").length;
  if (urgent) parts.push(`${urgent} item${urgent === 1 ? "" : "s"} need${urgent === 1 ? "s" : ""} attention.`);

  return parts.join(" ");
}

export function DashboardHeadline({
  snapshot, rangeKey, loading,
}: { snapshot?: BusinessSnapshot; rangeKey: RangeKey; loading: boolean }) {
  const { name } = useRole();
  const firstName = (name ?? "").split(" ")[0];

  return (
    <div className="mb-5">
      <h1 className="text-xl md:text-2xl tracking-tight font-medium">
        {greeting()}{firstName ? `, ${firstName}` : ""}
      </h1>
      {loading || !snapshot ? (
        <Skeleton className="h-4 w-80 mt-2" />
      ) : (
        <p className="text-[13.5px] text-muted-foreground mt-1.5 max-w-3xl">{summarise(snapshot, rangeKey)}</p>
      )}
    </div>
  );
}
