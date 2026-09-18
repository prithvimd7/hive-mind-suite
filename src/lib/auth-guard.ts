import { createMiddleware } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Server-function middleware: requires a signed-in user and, optionally, the CEO role.
 * Use on every server function that touches supabaseAdmin (service role bypasses RLS,
 * so these functions are otherwise callable by anyone who finds the endpoint).
 */
export const requireUser = requireSupabaseAuth;

export const requireCeo = createMiddleware({ type: "function" })
  .middleware([requireSupabaseAuth])
  .server(async ({ next, context }) => {
    const { data, error } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "ceo")
      .maybeSingle();
    if (error || !data) throw new Error("Forbidden: CEO access required");
    return next();
  });
