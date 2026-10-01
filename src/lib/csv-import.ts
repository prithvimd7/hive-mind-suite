/**
 * Sales and ad-spend CSV import.
 *
 * Exports rarely use our column names, so headers are matched loosely ("Date", "Order date",
 * "Day" all mean the date) and dates are normalised from dd/mm/yyyy, dd-MMM-yy or ISO.
 * When nothing matches, the caller gets a message naming the headers that were found.
 */
import { parseAmount, parseStatementDate, splitCsvLine } from "./statement-parse";

export interface SalesCsvRow {
  order_date: string;
  channel?: string;
  revenue: number;
  orders: number;
  currency: string;
  external_id?: string;
}

export interface AdCsvRow {
  spend_date: string;
  campaign?: string;
  spend: number;
  revenue: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

export interface CsvResult<T> {
  rows: T[];
  /** Human-readable reason when rows is empty. */
  error?: string;
  headers: string[];
}

const norm = (s: string) => s.replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Finds a column by trying each pattern in priority order across all headers, so a file with
 * both "Gross sales" and "Net sales" picks net (what actually landed, after discounts).
 */
function column(headers: string[], ...patterns: RegExp[]): number {
  for (const p of patterns) {
    const i = headers.findIndex((h) => p.test(norm(h)));
    if (i >= 0) return i;
  }
  return -1;
}

function rows(text: string): { headers: string[]; cells: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], cells: [] };
  return { headers: splitCsvLine(lines[0]), cells: lines.slice(1).map(splitCsvLine) };
}

const describe = (headers: string[]) =>
  headers.length ? `Columns found: ${headers.filter(Boolean).join(", ")}.` : "The file appears to be empty.";

export function parseSalesCsv(text: string): CsvResult<SalesCsvRow> {
  const { headers, cells } = rows(text);
  if (!headers.length) return { rows: [], headers, error: "That file has no header row and data rows." };

  const iDate = column(headers, /^(orderdate|date|day|transactiondate|createdat|purchasedate)$/);
  const iRevenue = column(headers, /^(revenue|netsales)$/, /^(totalsales|sales|grosssales)$/, /^(amount|total|value)$/);
  const iOrders = column(headers, /^(orders|ordercount|nooforders|quantity|qty|units|transactions)$/);
  const iChannel = column(headers, /^(channel|source|marketplace|store|platform)$/);
  const iCurrency = column(headers, /^(currency|currencycode)$/);
  const iRef = column(headers, /^(externalid|orderid|orderno|invoiceno|reference|refno|name)$/);

  if (iDate < 0) return { rows: [], headers, error: `No date column found. ${describe(headers)}` };
  if (iRevenue < 0) return { rows: [], headers, error: `No revenue column found. ${describe(headers)}` };

  const out: SalesCsvRow[] = [];
  let badDates = 0;
  for (const c of cells) {
    const date = parseStatementDate(c[iDate] ?? "");
    if (!date) { if ((c[iDate] ?? "").trim()) badDates++; continue; }
    const revenue = parseAmount(c[iRevenue] ?? "") ?? 0;
    const orders = iOrders >= 0 ? Math.round(parseAmount(c[iOrders] ?? "") ?? 0) : 1;
    out.push({
      order_date: date,
      channel: iChannel >= 0 ? c[iChannel]?.trim() || undefined : undefined,
      revenue,
      orders: orders || 1,
      currency: (iCurrency >= 0 ? c[iCurrency]?.trim() : "") || "INR",
      external_id: iRef >= 0 ? c[iRef]?.trim() || undefined : undefined,
    });
  }

  if (!out.length) {
    return {
      rows: [], headers,
      error: badDates
        ? `Found ${badDates} rows, but none had a readable date. Use dd/mm/yyyy or yyyy-mm-dd.`
        : `No data rows found. ${describe(headers)}`,
    };
  }
  return { rows: out, headers };
}

export function parseAdsCsv(text: string): CsvResult<AdCsvRow> {
  const { headers, cells } = rows(text);
  if (!headers.length) return { rows: [], headers, error: "That file has no header row and data rows." };

  const iDate = column(headers, /^(spenddate|date|day|reportingstarts|reportdate)$/);
  const iSpend = column(headers, /^(spend|amountspent|amountspentinr|adspend)$/, /^(cost|totalspend)$/);
  const iCampaign = column(headers, /^(campaign|campaignname)$/);
  const iRevenue = column(headers, /^(revenue|conversionvalue|purchaseconversionvalue|sales|sales7d|totalvalue|value)$/);
  const iImpr = column(headers, /^(impressions|impr)$/);
  const iClicks = column(headers, /^(clicks|linkclicks)$/);
  const iConv = column(headers, /^(conversions|purchases|purchases7d|results|orders)$/);

  if (iDate < 0) return { rows: [], headers, error: `No date column found. ${describe(headers)}` };
  if (iSpend < 0) return { rows: [], headers, error: `No spend column found. ${describe(headers)}` };

  const out: AdCsvRow[] = [];
  let badDates = 0;
  const num = (c: string[], i: number) => (i >= 0 ? parseAmount(c[i] ?? "") ?? 0 : 0);

  for (const c of cells) {
    const date = parseStatementDate(c[iDate] ?? "");
    if (!date) { if ((c[iDate] ?? "").trim()) badDates++; continue; }
    out.push({
      spend_date: date,
      campaign: iCampaign >= 0 ? c[iCampaign]?.trim() || undefined : undefined,
      spend: num(c, iSpend),
      revenue: num(c, iRevenue),
      impressions: Math.round(num(c, iImpr)),
      clicks: Math.round(num(c, iClicks)),
      conversions: Math.round(num(c, iConv)),
    });
  }

  if (!out.length) {
    return {
      rows: [], headers,
      error: badDates
        ? `Found ${badDates} rows, but none had a readable date. Use dd/mm/yyyy or yyyy-mm-dd.`
        : `No data rows found. ${describe(headers)}`,
    };
  }
  return { rows: out, headers };
}
