import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type TableName = keyof Database["public"]["Tables"];

/**
 * Generic list/create/update/delete hooks for a Supabase table.
 * Every mutation invalidates the table's query key plus anything listed in `alsoInvalidate`
 * (e.g. the executive dashboard's aggregate queries).
 */
export function createTableHooks<T extends TableName>(
  table: T,
  opts: { orderBy: string; ascending?: boolean; alsoInvalidate?: string[] },
) {
  const keys = [table as string, ...(opts.alsoInvalidate ?? [])];
  // The generic Supabase builder types don't narrow well over a type parameter, so we cast once here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = () => supabase.from(table) as any;

  function useInvalidate() {
    const qc = useQueryClient();
    return () => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: [k] })));
  }

  function useList() {
    return useQuery({
      queryKey: [table],
      queryFn: async (): Promise<Tables<T>[]> => {
        const { data, error } = await from().select("*").order(opts.orderBy, { ascending: opts.ascending ?? false });
        if (error) throw error;
        return data ?? [];
      },
    });
  }

  function useCreate() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: async (input: TablesInsert<T>) => {
        const { data, error } = await from().insert(input).select().single();
        if (error) throw error;
        return data as Tables<T>;
      },
      onSuccess: invalidate,
    });
  }

  function useUpdate() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: async ({ id, ...input }: TablesUpdate<T> & { id: string }) => {
        const { data, error } = await from().update(input).eq("id", id).select().single();
        if (error) throw error;
        return data as Tables<T>;
      },
      onSuccess: invalidate,
    });
  }

  function useDelete() {
    const invalidate = useInvalidate();
    return useMutation({
      mutationFn: async (id: string) => {
        const { error } = await from().delete().eq("id", id);
        if (error) throw error;
      },
      onSuccess: invalidate,
    });
  }

  return { useList, useCreate, useUpdate, useDelete };
}
