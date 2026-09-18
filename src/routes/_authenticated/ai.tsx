import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { AdvisorChat, useAdvisorChat } from "@/components/app/ai-assistant";
import { Sparkles } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ai")({
  head: () => ({ meta: [
    { title: "AI Advisor — Company OS" },
    { name: "description", content: "Ask your business anything: sales, forecasts, campaigns, inventory, cash flow." },
    { property: "og:title", content: "AI Advisor — Company OS" },
    { property: "og:description", content: "Your AI Chief of Staff." },
  ]}),
  component: AI,
});

const PROMPTS = [
  { title: "Diagnose a sales dip",  body: "Were sales lower in the last 7 days than the 7 before? Why?" },
  { title: "Margin by product",     body: "Which products have the highest margin?" },
  { title: "Forecast next month",   body: "Predict next month's sales." },
  { title: "Ad waste finder",       body: "Which marketing campaign is wasting money?" },
  { title: "Smart reorder",         body: "What inventory should I reorder, and how much?" },
  { title: "Cash check",            body: "Will cash be tight in the next 30 days? What's overdue?" },
  { title: "Pipeline priorities",   body: "Which deals should I follow up on this week?" },
  { title: "Production quality",    body: "How are yield, downtime and QC trending?" },
];

function AI() {
  const { send, busy } = useAdvisorChat();
  return (
    <div>
      <PageHeader
        title="AI Business Advisor"
        description="Answers come from your live data across every module — nothing is made up."
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card-elevated lg:col-span-2 h-[70vh] min-h-[480px] flex flex-col overflow-hidden animate-in-up">
          <AdvisorChat className="flex-1" />
        </section>

        <SectionCard title="Quick questions" description="Tap to ask">
          <div className="grid gap-2">
            {PROMPTS.map((p) => (
              <button
                key={p.title}
                disabled={busy}
                onClick={() => send(p.body)}
                className="text-left rounded-xl border p-3 hover:bg-accent transition disabled:opacity-50"
              >
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5" /> {p.title}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{p.body}</div>
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
