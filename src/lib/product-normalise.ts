/**
 * Listing titles → one product, with pack sizes counted as real units.
 *
 * The logic lives with the edge functions because the sync functions (Deno) need it to work
 * out how many units a sale took out of stock, and only files under supabase/functions are
 * deployed with them. This re-export keeps the app's imports where they were.
 */
export * from "../../supabase/functions/_shared/product-normalise";
