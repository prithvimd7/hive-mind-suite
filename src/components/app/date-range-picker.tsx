import { CalendarDays } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_KEYS, RANGE_PRESETS, type RangeKey } from "@/lib/date-range";

/** Preset date-range switcher: segmented buttons on wide screens, a dropdown on phones. */
export function DateRangePicker({ value, onChange }: { value: RangeKey; onChange: (v: RangeKey) => void }) {
  return (
    <>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={value}
        onValueChange={(v) => v && onChange(v as RangeKey)}
        className="hidden lg:flex"
        aria-label="Date range"
      >
        {RANGE_KEYS.map((k) => (
          <ToggleGroupItem key={k} value={k} className="text-xs px-2.5 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            {RANGE_PRESETS[k].label.replace("Last ", "")}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <Select value={value} onValueChange={(v) => onChange(v as RangeKey)}>
        <SelectTrigger className="h-8 w-[150px] text-xs lg:hidden" aria-label="Date range">
          <CalendarDays className="h-3.5 w-3.5" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {RANGE_KEYS.map((k) => (
            <SelectItem key={k} value={k} className="text-xs">{RANGE_PRESETS[k].label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}
