import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ShoppingBag, Package, Megaphone, Store, FileSpreadsheet, Building2, CheckCircle2, Circle, Upload, RefreshCw,
} from "lucide-react";
import {
  listDataSources, setSourceStatus, importSalesRows, importAdRows, getIntegrationsSummary,
} from "@/lib/integrations.functions";
import { triggerMetaSync } from "@/lib/meta-sync.functions";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [
    { title: "Integrations — Company OS" },
    { name: "description", content: "Connect Shopify, Amazon Seller, Meta Ads, Blinkit and upload offline sales." },
    { property: "og:title", content: "Integrations — Company OS" },
    { property: "og:description", content: "Bring every data source into one dashboard." },
  ]}),
  component: Integrations,
});

type Kind = "shopify" | "amazon_seller" | "meta_ads" | "amazon_ads" | "blinkit" | "offline";

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}

const META_RANGE_PRESETS = {
  last7: {
    label: "Last 7 days",
    compute: () => ({ since: ymd(daysAgo(7)), until: ymd(new Date()) }),
  },
  last30: {
    label: "Last 30 days",
    compute: () => ({ since: ymd(daysAgo(30)), until: ymd(new Date()) }),
  },
  last90: {
    label: "Last 90 days",
    compute: () => ({ since: ymd(daysAgo(90)), until: ymd(new Date()) }),
  },
  thisMonth: {
    label: "This month",
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { since: ymd(start), until: ymd(now) };
    },
  },
  lastMonth: {
    label: "Last month",
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { since: ymd(start), until: ymd(end) };
    },
  },
  last3Months: {
    label: "Last 3 months",
    compute: () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
      return { since: ymd(start), until: ymd(now) };
    },
  },
} as const;
type Mode = "oauth" | "api_key" | "csv";

const CATALOG: {
  kind: Kind; icon: React.ElementType; blurb: string; mode: Mode; dataset: "sales" | "ads" | "both";
}[] = [
  { kind: "shopify",       icon: ShoppingBag,     blurb: "Live orders, products and customers from your Shopify store.", mode: "oauth",   dataset: "sales" },
  { kind: "amazon_seller", icon: Package,         blurb: "Orders, returns and inventory from Amazon Seller Central.",     mode: "api_key", dataset: "sales" },
  { kind: "blinkit",       icon: Store,           blurb: "Blinkit Seller orders and daily payouts.",                       mode: "csv",     dataset: "sales" },
  { kind: "offline",       icon: Building2,       blurb: "Retail, distributor and wholesale sales you record manually.",   mode: "csv",     dataset: "sales" },
  { kind: "meta_ads",      icon: Megaphone,       blurb: "Spend and ROAS from Meta (Facebook + Instagram) ad accounts.",   mode: "oauth",   dataset: "ads" },
  { kind: "amazon_ads",    icon: FileSpreadsheet, blurb: "Sponsored Products, Brands and Display spend from Amazon Ads.",  mode: "api_key", dataset: "ads" },
];

function Integrations() {
  const qc = useQueryClient();
  const listFn = useServerFn(listDataSources);
  const setStatusFn = useServerFn(setSourceStatus);
  const importSalesFn = useServerFn(importSalesRows);
  const importAdsFn = useServerFn(importAdRows);
  const summaryFn = useServerFn(getIntegrationsSummary);

  const sources = useQuery({ queryKey: ["data_sources"], queryFn: () => listFn() });
  const summary = useQuery({ queryKey: ["integrations_summary"], queryFn: () => summaryFn() });

  const setStatus = useMutation({
    mutationFn: (v: { kind: Kind; status: "connected" | "disconnected" | "pending" }) =>
      setStatusFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["data_sources"] }),
  });

  const uploadSales = useMutation({
    mutationFn: (v: { source: Kind; rows: SalesCsvRow[] }) => importSalesFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.inserted} sales rows`);
      qc.invalidateQueries({ queryKey: ["data_sources"] });
      qc.invalidateQueries({ queryKey: ["integrations_summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAds = useMutation({
    mutationFn: (v: { platform: Kind; rows: AdCsvRow[] }) => importAdsFn({ data: v }),
    onSuccess: (r) => {
      toast.success(`Imported ${r.inserted} ad rows`);
      qc.invalidateQueries({ queryKey: ["data_sources"] });
      qc.invalidateQueries({ queryKey: ["integrations_summary"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const metaSyncFn = useServerFn(triggerMetaSync);
  const metaSync = useMutation({
    mutationFn: (range: { since: string; until: string }) => metaSyncFn({ data: range }),
    onSuccess: (r) => {
      toast.success(`Synced ${r.rows_synced} rows from Meta (${r.since} -> ${r.until})`);
      qc.invalidateQueries({ queryKey: ["data_sources"] });
      qc.invalidateQueries({ queryKey: ["integrations_summary"] });
      qc.invalidateQueries({ queryKey: ["ad_spend_imports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const byKind = new Map((sources.data ?? []).map((s) => [s.kind, s]));

  return (
    <div>
      <PageHeader
        title="Integrations"
        description="Connect every place your business earns and spends."
      />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <StatCard label="Sources connected" value={(sources.data ?? []).filter((s) => s.status === "connected").length} total={CATALOG.length} />
        <StatCard label="Sales rows"        value={summary.data?.salesRows ?? 0} />
        <StatCard label="Ad rows"           value={summary.data?.adRows ?? 0} />
        <StatCard label="Last sync"         value={mostRecent(sources.data ?? [])} isDate />
      </div>

      <SectionCard title="Sales channels" className="mb-4">
        <div className="grid gap-3 md:grid-cols-2">
          {CATALOG.filter((c) => c.dataset === "sales").map((c) => (
            <SourceCard
              key={c.kind}
              cfg={c}
              row={byKind.get(c.kind)}
              onToggle={(status) => setStatus.mutate({ kind: c.kind, status })}
              onCsv={(rows) => uploadSales.mutate({ source: c.kind, rows: rows as SalesCsvRow[] })}
              csvKind="sales"
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Marketing / ad spend">
        <div className="grid gap-3 md:grid-cols-2">
          {CATALOG.filter((c) => c.dataset === "ads").map((c) => (
            <SourceCard
              key={c.kind}
              cfg={c}
              row={byKind.get(c.kind)}
              onToggle={(status) => setStatus.mutate({ kind: c.kind, status })}
              onCsv={(rows) => uploadAds.mutate({ platform: c.kind, rows: rows as AdCsvRow[] })}
              csvKind="ads"
              onMetaSync={c.kind === "meta_ads" ? (range) => metaSync.mutate(range) : undefined}
              metaSyncing={c.kind === "meta_ads" ? metaSync.isPending : false}
            />
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

function StatCard({ label, value, total, isDate }: { label: string; value: number | string; total?: number; isDate?: boolean }) {
  const display = isDate && typeof value === "string" ? value : total ? `${value}/${total}` : value;
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tracking-tight mt-1">{display || "—"}</div>
    </div>
  );
}

function mostRecent(rows: { last_synced_at: string | null }[]) {
  const dates = rows.map((r) => r.last_synced_at).filter(Boolean) as string[];
  if (!dates.length) return "Never";
  const d = new Date(dates.sort().at(-1)!);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

type SalesCsvRow = { order_date: string; channel?: string; revenue: number; orders: number; currency: string; external_id?: string };
type AdCsvRow    = { spend_date: string; campaign?: string; spend: number; revenue: number; impressions: number; clicks: number; conversions: number };

function SourceCard({
  cfg, row, onToggle, onCsv, csvKind, onMetaSync, metaSyncing,
}: {
  cfg: typeof CATALOG[number];
  row: { status: string; last_synced_at: string | null } | undefined;
  onToggle: (s: "connected" | "disconnected" | "pending") => void;
  onCsv: (rows: unknown[]) => void;
  csvKind: "sales" | "ads";
  onMetaSync?: (range: { since: string; until: string }) => void;
  metaSyncing?: boolean;
}) {
  const Icon = cfg.icon;
  const status = row?.status ?? "disconnected";
  const connected = status === "connected";
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [metaRange, setMetaRange] = useState<keyof typeof META_RANGE_PRESETS>("last30");

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = csvKind === "sales" ? parseSalesCsv(text) : parseAdsCsv(text);
      if (!rows.length) return toast.error("No rows found in CSV");
      onCsv(rows);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-medium capitalize">{prettyLabel(cfg.kind)}</div>
            <Badge variant={connected ? "default" : "secondary"} className="rounded-full text-[10px]">
              {connected ? <><CheckCircle2 className="h-3 w-3 mr-1" />Connected</> : <><Circle className="h-3 w-3 mr-1" />{status}</>}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{cfg.blurb}</div>
        </div>
      </div>

      {cfg.mode === "oauth" && onMetaSync && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <Select value={metaRange} onValueChange={(v) => setMetaRange(v as keyof typeof META_RANGE_PRESETS)}>
              <SelectTrigger className="h-8 text-xs w-[150px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(META_RANGE_PRESETS).map(([key, p]) => (
                  <SelectItem key={key} value={key} className="text-xs">{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => onMetaSync(META_RANGE_PRESETS[metaRange].compute())}
              disabled={metaSyncing}
              className="gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${metaSyncing ? "animate-spin" : ""}`} />
              {metaSyncing ? "Syncing..." : "Sync now"}
            </Button>
          </div>
          <div className="text-[10px] text-muted-foreground">
            Pulls campaign spend from Meta for the selected range. Requires META_ACCESS_TOKEN, META_AD_ACCOUNT_ID
            and CRON_SECRET to be set as Edge Function secrets, and CRON_SECRET set in the app's server environment too.
          </div>
        </div>
      )}

      {cfg.mode === "oauth" && !onMetaSync && (
        <div className="flex gap-2">
          {connected ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onToggle("connected")} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Resync
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onToggle("disconnected")}>Disconnect</Button>
            </>
          ) : (
            <Button size="sm" onClick={() => { onToggle("connected"); toast.info(`Live ${prettyLabel(cfg.kind)} OAuth wires up next — mock connection saved.`); }}>
              Connect {prettyLabel(cfg.kind)}
            </Button>
          )}
        </div>
      )}

      {cfg.mode === "api_key" && (
        <div className="space-y-2">
          <Label className="text-xs">API key / seller token</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? "text" : "password"}
              placeholder="Paste key…"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="h-9"
            />
            <Button size="sm" variant="outline" onClick={() => setShowKey((v) => !v)}>{showKey ? "Hide" : "Show"}</Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={!apiKey && !connected}
              onClick={() => {
                onToggle(connected ? "disconnected" : "connected");
                if (!connected) toast.info("Saved — live sync wires up next.");
              }}
            >
              {connected ? "Disconnect" : "Save & connect"}
            </Button>
          </div>
        </div>
      )}

      <div className="border-t pt-3">
        <Label className="text-xs mb-2 block flex items-center gap-1.5">
          <Upload className="h-3.5 w-3.5" />
          Upload {csvKind === "sales" ? "sales" : "ad spend"} CSV
        </Label>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
          className="h-9 file:mr-2 file:text-xs"
        />
        <div className="text-[10px] text-muted-foreground mt-1.5">
          {csvKind === "sales"
            ? "Columns: order_date, channel, revenue, orders, currency, external_id"
            : "Columns: spend_date, campaign, spend, revenue, impressions, clicks, conversions"}
        </div>
      </div>

      {row?.last_synced_at && (
        <div className="text-[10px] text-muted-foreground">
          Last sync: {new Date(row.last_synced_at).toLocaleString()}
        </div>
      )}
    </div>
  );
}

function prettyLabel(k: string) {
  return ({
    shopify: "Shopify",
    amazon_seller: "Amazon Seller",
    meta_ads: "Meta Ads",
    amazon_ads: "Amazon Ads",
    blinkit: "Blinkit",
    offline: "Offline",
  } as Record<string, string>)[k] ?? k;
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = splitLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? "").trim()]));
  });
}
function splitLine(line: string) {
  const out: string[] = []; let cur = ""; let q = false;
  for (const c of line) {
    if (c === '"') q = !q;
    else if (c === "," && !q) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur); return out;
}
function n(v: string | undefined, d = 0) { const x = Number((v ?? "").replace(/[,₹$]/g, "")); return Number.isFinite(x) ? x : d; }
function parseSalesCsv(text: string): SalesCsvRow[] {
  return parseCsv(text).filter((r) => r.order_date).map((r) => ({
    order_date: r.order_date,
    channel: r.channel || undefined,
    revenue: n(r.revenue),
    orders: n(r.orders, 1),
    currency: (r.currency || "INR").toUpperCase(),
    external_id: r.external_id || undefined,
  }));
}
function parseAdsCsv(text: string): AdCsvRow[] {
  return parseCsv(text).filter((r) => r.spend_date).map((r) => ({
    spend_date: r.spend_date,
    campaign: r.campaign || undefined,
    spend: n(r.spend),
    revenue: n(r.revenue),
    impressions: n(r.impressions),
    clicks: n(r.clicks),
    conversions: n(r.conversions),
  }));
}
