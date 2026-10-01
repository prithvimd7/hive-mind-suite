/**
 * Marketplace listing titles → one product, and the pack size behind it.
 *
 * Amazon and Shopify titles for the same product differ wildly ("Chicken Bone Broth for Humans -
 * 14g Protein per Can | Kettle & Tonic | … | Pack of 6" vs "Chicken Bone Broth (Pack of 6)"),
 * and the quantity on an order line counts *packs*, not cans. This turns both into something
 * comparable: a canonical product name, a pack size, and therefore real units sold.
 */

export interface ParsedProduct {
  /** Canonical product name, matched to your product list where possible. */
  product: string;
  /** Cans/jars per pack, 1 when the title doesn't say. */
  packSize: number;
  /** The raw listing title, kept for drill-down. */
  title: string;
}

const PACK_PATTERNS: RegExp[] = [
  /pack\s*of\s*(\d+)/i,
  /(\d+)\s*[-\s]?pack\b/i,
  /\bset\s*of\s*(\d+)/i,
  /\b(\d+)\s*(?:cans?|bottles?|jars?|units?|pcs?)\b/i,
];

/** Pack size from a listing title; 1 when it doesn't mention one. */
export function packSizeOf(title: string): number {
  for (const re of PACK_PATTERNS) {
    const m = title.match(re);
    if (m) {
      const n = Number(m[1]);
      // Guard against grams/protein numbers being read as a pack ("14g Protein per Can").
      if (Number.isFinite(n) && n >= 2 && n <= 100) return n;
    }
  }
  return 1;
}

const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/**
 * Picks the canonical product. Known names (your Products list) win on a word-overlap test,
 * so "Kettle & Tonic Golden Tonic Bone Broth | …" maps to "Golden Tonic". Otherwise the title
 * is trimmed to its first segment with pack and marketing text removed.
 */
export function canonicalProduct(title: string, knownNames: string[] = []): string {
  const hay = clean(title);

  let best: { name: string; score: number } | null = null;
  for (const name of knownNames) {
    const words = clean(name).split(" ").filter((w) => w.length > 2);
    if (!words.length) continue;
    const hits = words.filter((w) => hay.includes(w)).length;
    // Require every significant word of the product name to appear.
    if (hits === words.length && (!best || words.length > best.score)) best = { name, score: words.length };
  }
  if (best) return best.name;

  // Fall back to the first segment of the title, minus pack and filler.
  const first = title.split(/[|—–\-(]/)[0].trim();
  const trimmed = first
    .replace(/\bpack\s*of\s*\d+\b/gi, "")
    .replace(/\bfor humans\b/gi, "")
    .replace(/\bkettle\s*&?\s*tonic\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return trimmed || title.trim();
}

export function parseProduct(title: string, knownNames: string[] = []): ParsedProduct {
  return { product: canonicalProduct(title, knownNames), packSize: packSizeOf(title), title };
}

export interface ProductSales {
  product: string;
  /** Order lines counted as sold: packs, singles, whatever the listing is. */
  packs: number;
  /** Packs × pack size: comparable units across listings. */
  units: number;
  revenue: number;
  /** Each underlying listing, for the detail view. */
  variants: { title: string; packSize: number; packs: number; units: number; revenue: number }[];
}

/** Groups raw sales lines into one row per product, with pack-aware unit counts. */
export function groupProducts(
  rows: { product: string; quantity: number; revenue: number }[],
  knownNames: string[] = [],
): ProductSales[] {
  const map = new Map<string, ProductSales>();

  for (const r of rows) {
    const { product, packSize } = parseProduct(r.product, knownNames);
    const units = r.quantity * packSize;
    const cur = map.get(product) ?? { product, packs: 0, units: 0, revenue: 0, variants: [] };
    cur.packs += r.quantity;
    cur.units += units;
    cur.revenue += r.revenue;

    const variant = cur.variants.find((v) => v.title === r.product);
    if (variant) {
      variant.packs += r.quantity;
      variant.units += units;
      variant.revenue += r.revenue;
    } else {
      cur.variants.push({ title: r.product, packSize, packs: r.quantity, units, revenue: r.revenue });
    }
    map.set(product, cur);
  }

  const out = [...map.values()].sort((a, b) => b.revenue - a.revenue);
  for (const p of out) p.variants.sort((a, b) => b.revenue - a.revenue);
  return out;
}
