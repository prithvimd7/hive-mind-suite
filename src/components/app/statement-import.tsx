import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EXPENSE_CATEGORIES, COGS_CATEGORIES, importRules } from "@/hooks/use-modules";
import { currency, shortDate } from "@/lib/format";
import {
  DEFAULT_RULES, guessCategory, importRef, parseStatementCsv, type StatementRow,
} from "@/lib/statement-parse";
import { cn } from "@/lib/utils";

interface Draft {
  row: StatementRow;
  ref: string;
  include: boolean;
  category: string;
  duplicate: boolean;
}

const UNCATEGORISED = "Other";

/**
 * Turns a bank statement CSV into expenses, with a review step.
 * Debits become expenses; credits are shown but never imported (they are sales receipts or
 * transfers, and revenue comes from the sales syncs). Rows already imported are flagged by their
 * import_ref so re-uploading the same file is safe.
 */
export function StatementImport() {
  const qc = useQueryClient();
  const { data: savedRules } = importRules.useList();
  const createRule = importRules.useCreate();

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [problem, setProblem] = useState("");
  const [skipped, setSkipped] = useState(0);
  const [busy, setBusy] = useState(false);

  const rules = useMemo(
    () => [...(savedRules ?? []).map((r) => ({ pattern: r.pattern, category: r.category, is_cogs: r.is_cogs })), ...DEFAULT_RULES],
    [savedRules],
  );

  function reset() {
    setDrafts([]); setFileName(""); setProblem(""); setSkipped(0);
  }

  async function handleFile(file: File) {
    reset();
    setFileName(file.name);
    if (/\.(xlsx?|pdf)$/i.test(file.name)) {
      setProblem(
        /\.pdf$/i.test(file.name)
          ? "PDF statements can't be read here. In net banking, download the statement as CSV or Excel, then save it as CSV."
          : "Excel files aren't supported directly. Open it and use File → Save As → CSV, then upload that.",
      );
      return;
    }
    const text = await file.text();
    const parsed = parseStatementCsv(text);
    if (!parsed.headerFound) {
      setProblem("Couldn't find a transaction table in this file. It needs a header row with a date column and debit/credit (or amount) columns.");
      return;
    }
    if (!parsed.rows.length) {
      setProblem("The file was read, but it has no transaction rows.");
      return;
    }

    // Flag rows already imported previously.
    const refs = parsed.rows.map(importRef);
    const { data: existing } = await supabase
      .from("expenses")
      .select("import_ref")
      .in("import_ref", refs);
    const seen = new Set((existing ?? []).map((e) => e.import_ref));

    setSkipped(parsed.skipped);
    setDrafts(parsed.rows.map((row) => {
      const ref = importRef(row);
      const guess = guessCategory(row.description, rules);
      const duplicate = seen.has(ref);
      return {
        row, ref, duplicate,
        category: guess?.category ?? UNCATEGORISED,
        include: row.isDebit && !duplicate,
      };
    }));
  }

  const debits = drafts.filter((d) => d.row.isDebit);
  const credits = drafts.length - debits.length;
  const chosen = drafts.filter((d) => d.include);
  const total = chosen.reduce((a, d) => a + d.row.amount, 0);

  const setDraft = (ref: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.ref === ref ? { ...d, ...patch } : d)));

  async function importChosen() {
    if (!chosen.length) return;
    setBusy(true);
    try {
      const rows = chosen.map((d) => ({
        expense_date: d.row.date,
        category: d.category,
        vendor: d.row.description.slice(0, 120),
        amount: d.row.amount,
        gst_amount: 0,
        is_cogs: COGS_CATEGORIES.has(d.category),
        status: "paid" as const,
        notes: `Imported from ${fileName}${d.row.reference ? ` · ref ${d.row.reference}` : ""}`,
        import_ref: d.ref,
      }));
      const { error } = await supabase.from("expenses").insert(rows);
      if (error) throw error;

      // Remember categorisations for next month: first two words of the narration → category.
      const learned = new Map<string, { category: string; is_cogs: boolean }>();
      for (const d of chosen) {
        const key = d.row.description.toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
        if (key.length >= 4 && !guessCategory(d.row.description, rules)) {
          learned.set(key, { category: d.category, is_cogs: COGS_CATEGORIES.has(d.category) });
        }
      }
      for (const [pattern, v] of learned) {
        await createRule.mutateAsync({ pattern, ...v }).catch(() => {}); // duplicates are fine
      }

      toast.success(`Imported ${rows.length} expense${rows.length === 1 ? "" : "s"} totalling ${currency(total)}`);
      for (const k of ["expenses", "business_snapshot"]) qc.invalidateQueries({ queryKey: [k] });
      setOpen(false);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <Upload className="h-3.5 w-3.5" />Import statement
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import bank statement</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1.5 flex items-center gap-1.5">
              <FileSpreadsheet className="h-3.5 w-3.5" /> Statement CSV
            </Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
              className="h-9 file:mr-2 file:text-xs"
            />
            <p className="text-[11px] text-muted-foreground mt-1.5">
              Download the statement as CSV from net banking (ICICI, YES, HDFC and others all offer it).
              Money out becomes an expense; money in is listed but never imported, since revenue comes from your sales syncs.
            </p>
          </div>

          {problem && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{problem}</span>
            </div>
          )}

          {drafts.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="rounded-full">{debits.length} debits</Badge>
                <Badge variant="secondary" className="rounded-full">{credits} credits (ignored)</Badge>
                {drafts.some((d) => d.duplicate) && (
                  <Badge variant="outline" className="rounded-full">{drafts.filter((d) => d.duplicate).length} already imported</Badge>
                )}
                {skipped > 0 && <Badge variant="outline" className="rounded-full">{skipped} unreadable lines</Badge>}
              </div>

              <div className="max-h-[45vh] overflow-y-auto rounded-lg border">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="w-10"></TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="w-[190px]">Category</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drafts.map((d) => (
                      <TableRow key={d.ref} className={cn(!d.row.isDebit && "opacity-50", d.duplicate && "bg-muted/40")}>
                        <TableCell>
                          <Checkbox
                            checked={d.include}
                            disabled={!d.row.isDebit}
                            onCheckedChange={(v) => setDraft(d.ref, { include: Boolean(v) })}
                            aria-label="Include this row"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs">{shortDate(d.row.date)}</TableCell>
                        <TableCell className="text-xs">
                          <div className="max-w-[320px] truncate" title={d.row.description}>{d.row.description}</div>
                          {d.duplicate && <span className="text-[10px] text-muted-foreground">already imported</span>}
                        </TableCell>
                        <TableCell className={cn("text-right whitespace-nowrap", !d.row.isDebit && "text-[color:var(--success)]")}>
                          {d.row.isDebit ? currency(d.row.amount) : `+${currency(Math.abs(d.row.amount))}`}
                        </TableCell>
                        <TableCell>
                          {d.row.isDebit ? (
                            <Select value={d.category} onValueChange={(v) => setDraft(d.ref, { category: v })}>
                              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">credit</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <div className="text-xs text-muted-foreground">
            {chosen.length > 0 ? `${chosen.length} selected · ${currency(total)}` : "Nothing selected"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={importChosen} disabled={busy || !chosen.length}>
              {busy ? "Importing…" : `Import ${chosen.length || ""}`.trim()}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
