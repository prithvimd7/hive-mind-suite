import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "ceo" | "salesperson";

export interface RoleState {
  loading: boolean;
  role: AppRole | null;
  email: string | null;
  name: string | null;
  avatar: string | null;
  userId: string | null;
}

export function useRole(): RoleState {
  const [state, setState] = useState<RoleState>({
    loading: true, role: null, email: null, name: null, avatar: null, userId: null,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        if (!cancelled) setState({ loading: false, role: null, email: null, name: null, avatar: null, userId: null });
        return;
      }
      const { data: rows } = await supabase.from("user_roles").select("role").eq("user_id", user.id).limit(1);
      const role = (rows?.[0]?.role as AppRole | undefined) ?? "salesperson";
      if (cancelled) return;
      setState({
        loading: false,
        role,
        userId: user.id,
        email: user.email ?? null,
        name: (user.user_metadata?.full_name as string | undefined) ?? user.email ?? null,
        avatar: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") load();
    });
    return () => { cancelled = true; sub.subscription.unsubscribe(); };
  }, []);

  return state;
}
