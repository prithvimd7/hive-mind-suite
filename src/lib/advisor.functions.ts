import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * AI business advisor. The browser sends the question, recent chat turns, and a JSON snapshot of the
 * business data the signed-in user can already see (RLS applies when it's gathered). The model is told
 * to answer only from that snapshot so it can't invent numbers.
 *
 * Provider: uses ANTHROPIC_API_KEY (Claude) if set, otherwise LOVABLE_API_KEY (Lovable AI gateway).
 * Set either one in Lovable Cloud → Project Settings → Environment / Secrets.
 */
const Input = z.object({
  question: z.string().min(1).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(8000) })).max(20),
  context: z.string().max(200_000),
});

const SYSTEM = `You are the AI business advisor inside "Company OS", the command center for Kettle & Tonic, an Indian food/beverage brand (bone broths and tonics).
You get a JSON snapshot of the company's live data (sales, marketing, production, inventory, finance, CRM, team). Currency is INR.
Rules:
- Answer ONLY from the snapshot. If the data needed isn't there or is empty, say exactly what is missing and which page of the app to fill it in (Add Sales, Marketing, Production, Inventory, Finance, CRM, Team, Integrations).
- Never invent numbers, customers, campaigns or products.
- Be concise and practical: lead with the answer, then 2–4 bullet points of evidence or next actions. Use ₹ and Indian number formatting (lakh/crore where natural).
- Plain text with simple "-" bullets. No markdown tables or headings.`;

export const askAdvisor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: z.input<typeof Input>) => Input.parse(v))
  .handler(async ({ data }) => {
    const system = `${SYSTEM}\n\nToday is ${new Date().toISOString().slice(0, 10)}.\n\nBUSINESS SNAPSHOT (JSON):\n${data.context}`;
    const messages = [...data.history, { role: "user" as const, content: data.question }];

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const lovableKey = process.env.LOVABLE_API_KEY;

    if (anthropicKey) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "anthropic-version": "2023-06-01",
          "content-type": "application/json",
        },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5", max_tokens: 1024, system, messages }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error?.message ?? `AI request failed (HTTP ${res.status})`);
      const text = (json.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("\n");
      return { answer: text || "No answer returned." };
    }

    if (lovableKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${lovableKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.LOVABLE_AI_MODEL ?? "google/gemini-2.5-flash",
          messages: [{ role: "system", content: system }, ...messages],
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 429) throw new Error("AI rate limit reached — try again in a minute.");
      if (res.status === 402) throw new Error("Lovable AI credits exhausted — top up in Lovable workspace settings.");
      if (!res.ok) throw new Error(json?.error?.message ?? `AI request failed (HTTP ${res.status})`);
      return { answer: json.choices?.[0]?.message?.content ?? "No answer returned." };
    }

    throw new Error("AI isn't configured: set ANTHROPIC_API_KEY or LOVABLE_API_KEY in the app's server environment.");
  });
