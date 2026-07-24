import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Why were sales lower yesterday?",
  "Which products have the highest profit?",
  "Predict next month's sales.",
  "Which marketing campaign is wasting money?",
  "Which distributor is growing fastest?",
  "What inventory should I reorder?",
];

type Msg = { role: "user" | "ai"; text: string };

function canned(q: string): string {
  const s = q.toLowerCase();
  if (s.includes("sales") && s.includes("lower")) return "Yesterday's revenue was ₹4.12L, 8.2% below trend. Main driver: Blinkit orders fell 24% after a stockout on Whey Isolate 1kg. Restocking today should recover ~₹68K.";
  if (s.includes("highest profit")) return "Top margin SKUs: Electrolyte Mix (45%), Whey Isolate 1kg (42%), Protein Bar Cocoa (38%). Push Electrolyte Mix in Meta retargeting — CAC is 22% lower than average.";
  if (s.includes("predict") || s.includes("next month")) return "Forecast for next month: ₹2.24Cr revenue (±6%), driven by wholesale + Amazon. Confidence 82%. Risk: production capacity is at 91% utilization.";
  if (s.includes("wasting")) return "Google PMax is underperforming: ROAS 2.1x vs blended 3.9x. Recommend pausing and shifting ₹40K/day to Meta Retarget Q4 (ROAS 4.9x).";
  if (s.includes("distributor")) return "NB Mart is growing fastest: +38% MoM, now ₹18L/mo. Consider extended credit terms and exclusive SKU allocation.";
  if (s.includes("reorder")) return "Reorder now: Retort Chicken Meal (62 units, min 300), Whey Isolate 1kg (210, min 400), Cocoa Powder (120kg, min 200kg). Estimated PO value ₹6.8L.";
  return "I'll analyze that across your sales, marketing, inventory, and finance data. (Connect Lovable Cloud + Lovable AI to enable live answers.)";
}

export function AIAssistant({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: "ai", text: "Hi! I'm your AI business advisor. Ask about sales, inventory, campaigns, cash flow — anything." },
  ]);
  const [q, setQ] = useState("");

  const send = (text: string) => {
    if (!text.trim()) return;
    setMsgs((m) => [...m, { role: "user", text }, { role: "ai", text: canned(text) }]);
    setQ("");
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Business Advisor
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {msgs.map((m, i) => (
            <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] leading-relaxed",
                  m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md",
                )}
              >
                {m.text}
              </div>
            </div>
          ))}

          {msgs.length <= 1 && (
            <div className="pt-2">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Try asking</div>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(q); }}
          className="p-3 border-t flex items-center gap-2 bg-card"
        >
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ask the AI advisor…"
            className="h-10"
          />
          <Button type="submit" size="icon" className="h-10 w-10 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
