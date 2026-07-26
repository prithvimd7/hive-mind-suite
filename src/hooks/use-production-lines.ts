import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type ProductionLine = Tables<"production_lines">;

export function useProductionLines() {
  return useQuery({
    queryKey: ["production_lines"],
    queryFn: async (): Promise<ProductionLine[]> => {
      const { data, error } = await supabase.from("production_lines").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreateProductionLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: TablesInsert<"production_lines">) => {
      const { data, error } = await supabase.from("production_lines").insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production_lines"] }),
  });
}

export function useUpdateProductionLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: TablesUpdate<"production_lines"> & { id: string }) => {
      const { data, error } = await supabase.from("production_lines").update(input).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production_lines"] }),
  });
}

export function useDeleteProductionLine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("production_lines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["production_lines"] }),
  });
}
