import { useEffect, useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  RANGE_KEYS, RANGE_PRESETS, recentMonths, resolveSelection, type RangeKey, type RangeSearch,
} from "@/lib/date-range";
import { today } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Period chooser: presets, any recent calendar month ("April 2026"), or a custom from/to.
 * The value is the page's URL search, so the choice is shareable.
 */
export function DateRangePicker({
  value, onChange, className,
}: { value: RangeSearch; onChange: (next: RangeSearch) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(value.from ?? "");
  const [to, setTo] = useState(value.to ?? "");
  const [error, setError] = useState("");
  const { label } = resolveSelection(value);
  const months = recentMonths(24);

  useEffect(() => {
    if (!open) { setFrom(value.from ?? ""); setTo(value.to ?? ""); setError(""); }
  }, [open, value.from, value.to]);

  const pick = (next: RangeSearch) => { onChange(next); setOpen(false); };

  function applyCustom() {
    if (!from || !to) return setError("Pick both dates");
    if (from > to) return setError("From must be before to");
    if (to > today()) return setError("To can't be in the future");
    pick({ from, to });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("gap-1.5 font-normal", className)}>
          <CalendarDays className="h-3.5 w-3.5" />
          <span className="max-w-[150px] truncate">{label}</span>
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] p-0">
        <div className="p-1.5">
          {RANGE_KEYS.map((k) => (
            <button
              key={k}
              onClick={() => pick({ range: k })}
              className="w-full flex items-center justify-between rounded-[var(--radius)] px-2.5 py-1.5 text-[13px] hover:bg-accent text-left"
            >
              {RANGE_PRESETS[k].label}
              {value.range === k || (!value.range && !value.month && !value.from && k === "30d") ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          ))}
        </div>

        <div className="border-t p-2.5 space-y-1.5">
          <Label className="text-[11px] text-muted-foreground">Month</Label>
          <select
            value={value.month ?? ""}
            onChange={(e) => e.target.value && pick({ month: e.target.value })}
            className="w-full h-8 rounded-[var(--radius)] border bg-background px-2 text-[13px]"
          >
            <option value="">Pick a month…</option>
            {months.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>

        <div className="border-t p-2.5 space-y-2">
          <Label className="text-[11px] text-muted-foreground">Custom range</Label>
          <div className="flex items-center gap-1.5">
            <Input type="date" value={from} max={today()} onChange={(e) => { setFrom(e.target.value); setError(""); }} className="h-8 text-xs" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={to} max={today()} onChange={(e) => { setTo(e.target.value); setError(""); }} className="h-8 text-xs" />
          </div>
          {error && <p className="text-[11px] text-destructive">{error}</p>}
          <Button size="sm" className="w-full h-8" onClick={applyCustom}>Apply</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
