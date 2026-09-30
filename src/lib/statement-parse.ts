/**
 * Bank statement CSV parsing.
 *
 * Indian bank exports (ICICI, YES, HDFC, Axis, Kotak, SBI…) differ in column names, date formats
 * and whether debits/credits are two columns or one signed column — and most put several junk
 * lines above the real header. This finds the header row, maps the columns it recognises, and
 * returns clean rows. Everything is best-effort: the UI always shows the result for review.
 */

export interface StatementRow {
  /** Source line number, used to build a stable import reference. */
  line: number;
  date: string;          // YYYY-MM-DD
  description: string;
  /** Positive = money out (expense). Negative = money in (credit). */
  amount: number;
  isDebit: boolean;
  reference: string;     // cheque/UTR/ref number when the file has one
}

export interface ParseResult {
  rows: StatementRow[];
  /** Lines that looked like transactions but couldn't be read. */
  skipped: number;
  headerFound: boolean;
  columns: Partial<Record<ColumnKind, string>>;
}

type ColumnKind = "date" | "description" | "debit" | "credit" | "amount" | "reference" | "type";

/**
 * Header names are normalised before matching: lower-cased, bracketed units dropped
 * ("Withdrawal Amount (INR )" → "withdrawalamount") and punctuation removed, because every bank
 * words these differently.
 */
const normHeader = (s: string) => s.replace(/\([^)]*\)/g, " ").toLowerCase().replace(/[^a-z]/g, "");

const HEADER_PATTERNS: Record<ColumnKind, RegExp> = {
  // Checked in this order, so "withdrawalamount" is a debit column, not the generic amount one.
  date: /^(transaction|txn|posting|value)?date$/,
  description: /(description|narration|particulars|remarks|details|transactiondetails)/,
  debit: /(withdrawal|debit|^dr$)/,
  credit: /(deposit|credit|^cr$)/,
  amount: /^(transaction)?amount$|^amt$/,
  reference: /(chequeno|chqno|refno|chqrefno|reference|utr|transactionid)/,
  type: /^(drcr|crdr|type|transactiontype|indicator)$/,
};

/** Prefer a transaction/posting date over a value date when a file has both. */
const PREFERRED_DATE = /^(transaction|txn|posting)date$/;

/** Splits one CSV line, honouring quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (quoted && line[i + 1] === '"') { cur += '"'; i++; } else quoted = !quoted;
    } else if (c === "," && !quoted) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** "1,234.56", "1234.56 Dr", "(1,234.56)" and "₹1,234" all become numbers. */
export function parseAmount(raw: string): number | null {
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw.trim()) || /\bdr\b/i.test(raw);
  const cleaned = raw.replace(/[()₹$,\s]/g, "").replace(/\b(dr|cr)\b/gi, "");
  if (!cleaned || !/^-?\d*\.?\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parses the date formats Indian banks use. Day-first is assumed (31/01/2026, 01-02-2026),
 * because dd/mm is the convention here; ISO (2026-01-31) is detected by its 4-digit year first.
 */
export function parseStatementDate(raw: string): string | null {
  const s = (raw ?? "").trim().split(/\s+/)[0];
  if (!s) return null;
  const pad = (n: number) => String(n).padStart(2, "0");

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    if (+mo > 12) return null;
    return `${year}-${pad(+mo)}-${pad(+d)}`;
  }

  m = s.match(/^(\d{1,2})[-/ ]?([A-Za-z]{3,})[-/ ]?(\d{2,4})$/);
  if (m) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (!mo) return null;
    const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${year}-${pad(mo)}-${pad(+m[1])}`;
  }
  return null;
}

function mapHeader(cells: string[]): Partial<Record<ColumnKind, number>> | null {
  const found: Partial<Record<ColumnKind, number>> = {};
  cells.forEach((cell, i) => {
    const name = normHeader(cell);
    if (!name) return;
    for (const kind of Object.keys(HEADER_PATTERNS) as ColumnKind[]) {
      if (!HEADER_PATTERNS[kind].test(name)) continue;
      // A transaction date replaces a value date already found; otherwise first match wins.
      const better = kind === "date" && found.date !== undefined && PREFERRED_DATE.test(name);
      if (found[kind] === undefined || better) found[kind] = i;
    }
  });
  // A usable header needs a date, something to read as money, and ideally a description.
  const hasMoney = found.debit !== undefined || found.credit !== undefined || found.amount !== undefined;
  return found.date !== undefined && hasMoney ? found : null;
}

export function parseStatementCsv(text: string): ParseResult {
  const lines = text.split(/\r?\n/);
  let header: Partial<Record<ColumnKind, number>> | null = null;
  let headerLine = -1;

  for (let i = 0; i < lines.length && i < 40; i++) {
    const mapped = mapHeader(splitCsvLine(lines[i]));
    if (mapped) { header = mapped; headerLine = i; break; }
  }
  if (!header) return { rows: [], skipped: 0, headerFound: false, columns: {} };

  const rows: StatementRow[] = [];
  let skipped = 0;

  for (let i = headerLine + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cells = splitCsvLine(raw);
    const at = (k: ColumnKind) => (header[k] === undefined ? "" : cells[header[k]!] ?? "");

    const date = parseStatementDate(at("date"));
    if (!date) { if (cells.filter(Boolean).length > 2) skipped++; continue; }

    const debit = parseAmount(at("debit"));
    const credit = parseAmount(at("credit"));
    let amount: number | null = null;

    if (debit !== null && debit !== 0) amount = Math.abs(debit);
    else if (credit !== null && credit !== 0) amount = -Math.abs(credit);
    else {
      const single = parseAmount(at("amount"));
      if (single === null || single === 0) { skipped++; continue; }
      const type = at("type").toLowerCase();
      // With one amount column, a type column decides direction; otherwise negative = money in.
      if (/^(d|dr|debit|w)/.test(type)) amount = Math.abs(single);
      else if (/^(c|cr|credit|d(ep)?)/.test(type)) amount = -Math.abs(single);
      else amount = single;
    }

    rows.push({
      line: i + 1,
      date,
      description: at("description").replace(/\s+/g, " ").trim() || "(no description)",
      amount,
      isDebit: amount > 0,
      reference: at("reference"),
    });
  }

  const columns = Object.fromEntries(
    (Object.keys(header) as ColumnKind[]).map((k) => [k, splitCsvLine(lines[headerLine])[header![k]!]]),
  ) as Partial<Record<ColumnKind, string>>;

  return { rows, skipped, headerFound: true, columns };
}

/** Stable id for a statement line, so re-importing the same file doesn't duplicate expenses. */
export function importRef(row: StatementRow): string {
  const slug = row.description.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24);
  return `stmt:${row.date}:${row.amount.toFixed(2)}:${slug}:${row.line}`;
}

export interface CategoryRule {
  pattern: string;
  category: string;
  is_cogs: boolean;
}

/** First rule whose pattern appears in the description wins; longer patterns are tried first. */
export function guessCategory(description: string, rules: CategoryRule[]): CategoryRule | null {
  const hay = description.toLowerCase();
  return (
    [...rules]
      .sort((a, b) => b.pattern.length - a.pattern.length)
      .find((r) => r.pattern && hay.includes(r.pattern.toLowerCase())) ?? null
  );
}

/** Starting rules for common Indian bank narrations, used when the user has none saved yet. */
export const DEFAULT_RULES: CategoryRule[] = [
  { pattern: "shift", category: "Freight & logistics", is_cogs: true },
  { pattern: "delhivery", category: "Freight & logistics", is_cogs: true },
  { pattern: "bluedart", category: "Freight & logistics", is_cogs: true },
  { pattern: "dtdc", category: "Freight & logistics", is_cogs: true },
  { pattern: "shiprocket", category: "Freight & logistics", is_cogs: true },
  { pattern: "salary", category: "Salaries", is_cogs: false },
  { pattern: "rent", category: "Rent", is_cogs: false },
  { pattern: "electricity", category: "Utilities", is_cogs: false },
  { pattern: "bescom", category: "Utilities", is_cogs: false },
  { pattern: "gas", category: "Utilities", is_cogs: false },
  { pattern: "airtel", category: "Utilities", is_cogs: false },
  { pattern: "jio", category: "Utilities", is_cogs: false },
  { pattern: "google", category: "Software", is_cogs: false },
  { pattern: "aws", category: "Software", is_cogs: false },
  { pattern: "zoho", category: "Software", is_cogs: false },
  { pattern: "shopify", category: "Software", is_cogs: false },
  { pattern: "facebk", category: "Marketing (non-ads)", is_cogs: false },
  { pattern: "gst", category: "Professional fees", is_cogs: false },
  { pattern: "bank charge", category: "Professional fees", is_cogs: false },
];
