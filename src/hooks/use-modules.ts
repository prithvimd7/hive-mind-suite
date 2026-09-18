import type { Tables } from "@/integrations/supabase/types";
import { createTableHooks } from "./use-table";
import { today } from "@/lib/format";

export type Batch = Tables<"production_batches">;
export type InventoryItem = Tables<"inventory_items">;
export type Expense = Tables<"expenses">;
export type Invoice = Tables<"invoices">;
export type Contact = Tables<"crm_contacts">;
export type TeamMember = Tables<"team_members">;

// "business_snapshot" is the executive dashboard's aggregate query — refresh it whenever source data changes.
const DASH = ["business_snapshot"];

export const batches = createTableHooks("production_batches", { orderBy: "batch_date", alsoInvalidate: DASH });
export const inventory = createTableHooks("inventory_items", { orderBy: "name", ascending: true, alsoInvalidate: DASH });
export const expenses = createTableHooks("expenses", { orderBy: "expense_date", alsoInvalidate: DASH });
export const invoices = createTableHooks("invoices", { orderBy: "issue_date", alsoInvalidate: DASH });
export const contacts = createTableHooks("crm_contacts", { orderBy: "updated_at", alsoInvalidate: DASH });
export const team = createTableHooks("team_members", { orderBy: "kpi_score", alsoInvalidate: DASH });

export const EXPENSE_CATEGORIES = [
  "Raw materials", "Packaging", "Co-packing / processing", "Freight & logistics",
  "Salaries", "Rent", "Utilities", "Marketing (non-ads)", "Software", "Professional fees", "Other",
] as const;

/** Categories that count toward cost of goods sold by default (user can override per expense). */
export const COGS_CATEGORIES = new Set(["Raw materials", "Packaging", "Co-packing / processing", "Freight & logistics"]);

export const STAGES = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
export const CONTACT_TYPES = ["lead", "customer", "distributor", "retailer"] as const;

export const isLowStock = (i: InventoryItem) => Number(i.reorder_level) > 0 && Number(i.stock) <= Number(i.reorder_level);
export const isCriticalStock = (i: InventoryItem) => Number(i.reorder_level) > 0 && Number(i.stock) <= Number(i.reorder_level) / 2;

export { today };

export function isInvoiceOverdue(inv: Invoice) {
  return inv.status === "sent" && !!inv.due_date && inv.due_date < today();
}
