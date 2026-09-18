import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, RotateCcw, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADVISOR_SUGGESTIONS, useAdvisor } from "@/hooks/use-advisor";

type AdvisorState = ReturnType<typeof useAdvisor> & { open: boolean; setOpen: (v: boolean) => void };

const AdvisorCtx = createContext<AdvisorState | null>(null);

/** One conversation shared by the ⌘J side sheet and the /ai page. */
export function AdvisorProvider({ children }: { children: ReactNode }) {
  const advisor = useAdvisor();
  const [open, setOpen] = useState(false);
  return <AdvisorCtx.Provider value={{ ...advisor, open, setOpen }}>{children}</AdvisorCtx.Provider>;
}

export function useAdvisorChat() {
  const ctx = useContext(AdvisorCtx);
  if (!ctx) throw new Error("useAdvisorChat must be used inside AdvisorProvider");
  return ctx;
}

/** Message list + input. Fills its parent's height. */
export function AdvisorChat({ className }: { className?: string }) {
  const { msgs, busy, send, reset } = useAdvisorChat();
  const [q, setQ] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs.length, busy]);

  const submit = (text: string) => { send(text); setQ(""); };

  return (
    <div className={cn("flex flex-col min-h-0", className)}>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {msgs.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "rounded-2xl px-3.5 py-2.5 text-sm max-w-[85%] leading-relaxed whitespace-pre-wrap",
                m.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md",
                m.error && "bg-destructive/10 text-destructive",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-sm text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading your data…
            </div>
          </div>
        )}

        {msgs.length <= 1 && !busy && (
          <div className="pt-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground mb-2">Try asking</div>
            <div className="flex flex-wrap gap-2">
              {ADVISOR_SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => submit(s)} className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); submit(q); }} className="p-3 border-t flex items-center gap-2 bg-card">
        {msgs.length > 1 && (
          <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" onClick={reset} aria-label="New conversation" title="New conversation">
            <RotateCcw className="h-4 w-4" />
          </Button>
        )}
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask the AI advisor…" className="h-10" disabled={busy} />
        <Button type="submit" size="icon" className="h-10 w-10 shrink-0" disabled={busy || !q.trim()} aria-label="Send">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export function AIAssistant() {
  const { open, setOpen } = useAdvisorChat();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Business Advisor
          </SheetTitle>
        </SheetHeader>
        <AdvisorChat className="flex-1" />
      </SheetContent>
    </Sheet>
  );
}
