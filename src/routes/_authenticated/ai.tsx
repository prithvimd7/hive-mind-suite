import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Sparkles, ArrowRight } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/ai")({
  head: () => ({ meta: [
    { title: "AI Advisor — Company OS" },
    { name: "description", content: "Ask your business anything: sales, forecasts, campaigns, inventory, cash flow." },
    { property: "og:title", content: "AI Advisor — Company OS" },
    { property: "og:description", content: "Your AI Chief of Staff." },
  ]}),
  component: AI,
});

const PROMPTS = [
  { title: "Diagnose sales drop", body: "Why were sales lower yesterday?" },
  { title: "Top profit products", body: "Which products have the highest profit?" },
  { title: "Forecast next month",  body: "Predict next month's sales." },
  { title: "Ad waste finder",      body: "Which marketing campaign is wasting money?" },
  { title: "Distributor growth",   body: "Which distributor is growing fastest?" },
  { title: "Smart reorder",        body: "What inventory should I reorder?" },
];

function AI() {
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <div>
      <PageHeader
        title="AI Business Advisor"
        description="Your always-on Chief of Staff. Ask about anything in your business."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard title="Suggested questions" className="lg:col-span-2">
          <div className="grid sm:grid-cols-2 gap-3">
            {PROMPTS.map((p) => (
              <button
                key={p.title}
                onClick={() => setSelected(p.body)}
                className="text-left rounded-xl border p-4 hover:bg-accent transition group"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5" /> {p.title}
                </div>
                <div className="text-xs text-muted-foreground mt-1">"{p.body}"</div>
                <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium opacity-0 group-hover:opacity-100 transition">
                  Ask <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Roadmap" description="Coming to your AI advisor">
          <ul className="text-sm space-y-2">
            {[
              "Sales prediction",
              "Demand forecasting",
              "Inventory reorder AI",
              "Cash flow forecasting",
              "Marketing budget optimizer",
              "Employee performance signals",
            ].map((f) => (
              <li key={f} className="flex items-center gap-2 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground/60" /> {f}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border p-4 bg-muted/50 text-sm animate-in-up">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Selected prompt</div>
          <div className="font-medium">"{selected}"</div>
          <Button className="mt-3" size="sm">Open in advisor</Button>
        </div>
      )}
    </div>
  );
}
