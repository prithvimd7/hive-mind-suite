import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Sparkles, LogIn } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [
    { title: "Sign in — Company OS" },
    { name: "description", content: "Sign in to Company OS with your Google account." },
    { property: "og:title", content: "Sign in — Company OS" },
    { property: "og:description", content: "Sign in to Company OS." },
  ]}),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate({ to: "/" });
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  async function signIn() {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message || "Sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sign-in failed");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">C</div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Company OS</div>
            <div className="text-[11px] text-muted-foreground -mt-0.5">Business Intelligence</div>
          </div>
        </div>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Use your Google account. The first user becomes CEO; the rest join as Salesperson.
        </p>

        <Button onClick={signIn} disabled={busy} className="mt-6 w-full gap-2" size="lg">
          <LogIn className="h-4 w-4" />
          {busy ? "Redirecting…" : "Continue with Google"}
        </Button>

        <div className="mt-6 text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" />
          CEOs see all dashboards. Salespersons can upload data and pull from Shopify & Amazon.
        </div>
      </div>
    </div>
  );
}
