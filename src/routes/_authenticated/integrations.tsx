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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
  ShoppingBag, Package, Megaphone, Store, FileSpreadsheet, Building2, CheckCircle2, Circle, Upload, RefreshCw,
  AlertCircle, Clock, ChevronDown, Search,
} from "lucide-react";
import {
  listDataSources, importSalesRows, importAdRows, getIntegrationsSummary,
} from "@/lib/integrations.functions";
import { triggerSync, type SyncKind } from "@/lib/sync.functions";
import { useRole } from "@/hooks/use-role";
import { isoDaysAgo, localIso, today } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/integrations")({
  head: () => ({ meta: [
    { title: "Integrations — Company OS" },
    { name: "description", content: "Connect Shopify, Amazon, Meta Ads, Google Ads, Blinkit and upload offline sales." },
    { property: "og:title", content: "Integrations — Company OS" },
    { property: "og:description", content: "Bring every data source into one dashboard." },
  ]}),
  component: Integrations,
});

type Kind = "shopify" | "amazon_seller" | "meta_ads" | "amazon_ads" | "google_ads" | "blinkit" | "offline";

const RANGE_PRESETS = {
  last7:     { label: "Last 7 days",  compute: () => ({ since: isoDaysAgo(7), until: today() }) },
  last30:    { label: "Last 30 days", compute: () => ({ since: isoDaysAgo(30), until: today() }) },
  last90:    { label: "Last 90 days", compute: () => ({ since: isoDaysAgo(90), until: today() }) },
  thisMonth: {
    label: "This month",
    compute: () => { const n = new Date(); return { since: localIso(new Date(n.getFullYear(), n.getMonth(), 1)), until: today() }; },
  },
  lastMonth: {
    label: "Last month",
    compute: () => {
      const n = new Date();
      return { since: localIso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), until: localIso(new Date(n.getFullYear(), n.getMonth(), 0)) };
    },
  },
} as const;
type RangeKey = keyof typeof RANGE_PRESETS;

interface Source {
  kind: Kind;
  label: string;
  icon: React.ElementType;
  blurb: string;
  dataset: "sales" | "ads";
  /** Present when a live sync edge function exists for this source. */
  live?: { secrets: string[]; steps: string[] };
}

const CATALOG: Source[] = [
  {
    kind: "shopify", label: "Shopify", icon: ShoppingBag, dataset: "sales",
    blurb: "Daily revenue and orders from your Shopify store (test and cancelled orders excluded).",
    live: {
      secrets: ["SHOPIFY_STORE_DOMAIN", "SHOPIFY_CLIENT_ID", "SHOPIFY_CLIENT_SECRET"],
      steps: [
        "Shopify admin → Settings → Apps → Develop apps → Build apps in Dev Dashboard → Create app.",
        "Create a version with Admin API scope read_orders (add read_all_orders for history older than 60 days), release it, then install the app on your store.",
        "App settings → Client ID → SHOPIFY_CLIENT_ID, Client secret → SHOPIFY_CLIENT_SECRET. Your xxx.myshopify.com domain → SHOPIFY_STORE_DOMAIN.",
        "Already have a custom app made before 2026? Set its shpat_… token as SHOPIFY_ACCESS_TOKEN instead.",
      ],
    },
  },
  {
    kind: "amazon_seller", label: "Amazon Seller", icon: Package, dataset: "sales",
    blurb: "Daily revenue and orders from Amazon.in Seller Central (cancelled orders excluded).",
    live: {
      secrets: ["AMAZON_SP_CLIENT_ID", "AMAZON_SP_CLIENT_SECRET", "AMAZON_SP_REFRESH_TOKEN"],
      steps: [
        "Seller Central → Apps and Services → Develop Apps → register as a private developer (Orders role).",
        "Add a new app client (SP API) and note its LWA client id and secret.",
        "Click Authorize on the app to get a refresh token, then set the three secrets.",
      ],
    },
  },
  { kind: "blinkit", label: "Blinkit", icon: Store, dataset: "sales", blurb: "Blinkit has no public seller API — upload the seller-panel CSV." },
  { kind: "offline", label: "Offline", icon: Building2, dataset: "sales", blurb: "Retail, distributor and wholesale sales. Upload a CSV or use Add Sales." },
  {
    kind: "meta_ads", label: "Meta Ads", icon: Megaphone, dataset: "ads",
    blurb: "Daily campaign spend, purchases and purchase value from Facebook + Instagram ads.",
    live: {
      secrets: ["META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID"],
      steps: [
        "Meta Business Settings → Users → System users → add one with access to your ad account.",
        "Generate a token for it with the ads_read permission → META_ACCESS_TOKEN.",
        "Ad account id (digits only, without act_) → META_AD_ACCOUNT_ID.",
      ],
    },
  },
  {
    kind: "google_ads", label: "Google Ads", icon: Search, dataset: "ads",
    blurb: "Daily campaign cost, conversions and conversion value, via your Google Ads manager (MCC) account.",
    live: {
      secrets: [
        "GOOGLE_ADS_DEVELOPER_TOKEN", "GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET",
        "GOOGLE_ADS_REFRESH_TOKEN", "GOOGLE_ADS_LOGIN_CUSTOMER_ID", "GOOGLE_ADS_CUSTOMER_IDS",
      ],
      steps: [
        "Manager account → Tools → API Center: get the developer token (apply for Basic access to use it on live accounts).",
        "Google Cloud console: enable the Google Ads API and create an OAuth client → client id + secret.",
        "Generate a refresh token for a user with access to the manager account (scope adwords).",
        "Manager account id → GOOGLE_ADS_LOGIN_CUSTOMER_ID; client account id(s), comma-separated → GOOGLE_ADS_CUSTOMER_IDS.",
      ],
    },
  },
  {
    kind: "amazon_ads", label: "Amazon Ads", icon: FileSpreadsheet, dataset: "ads",
    blurb: "Sponsored Products daily spend and 7-day sales. Reports take a few minutes — sync again if it says pending.",
    live: {
      secrets: ["AMAZON_ADS_CLIENT_ID", "AMAZON_ADS_CLIENT_SECRET", "AMAZON_ADS_REFRESH_TOKEN", "AMAZON_ADS_PROFILE_ID"],
      steps: [
        "Apply for Amazon Ads API access and create a Login with Amazon security profile → client id + secret.",
        "Authorize it for your advertiser account (scope advertising::campaign_management) → refresh token.",
        "Look up your Amazon.in advertising profile id (GET /v2/profiles) → AMAZON_ADS_PROFILE_ID.",
      ],
    },
  },
];

function Integrations() {
  const qc = useQueryClient();
  const { role } = useRole();
  const isCeo = role === "ceo";
  const listFn = useServerFn(listDataSources);
  const importSalesFn = useServerFn(importSalesRows);
  const importAdsFn = useServerFn(importAdRows);
  const summaryFn = useServerFn(getIntegrationsSummary);
  const syncFn = useServerFn(triggerSync);

  const sources = useQuery({ queryKey: ["data_sources"], queryFn: () => listFn() });
  const summary = useQuery({ queryKey: ["integrations_summary"], queryFn: () => summaryFn() });

  const refresh = () => {
    for (const k of ["data_sources", "integrations_summary", "sales_imports", "ad_spend_imports", "business_snapshot"]) {
      qc.invalidateQueries({ queryKey: [k] });
    }
  };

  const uploadSales = useMutation({
    mutationFn: (v: { source: Kind; rows: SalesCsvRow[] }) => importSalesFn({ data: v }),
    onSuccess: (r) => { toast.success(`Imported ${r.inserted} sales rows`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const uploadAds = useMutation({
    mutationFn: (v: { platform: Kind; rows: AdCsvRow[] }) => importAdsFn({ data: v }),
    onSuccess: (r) => { toast.success(`Imported ${r.inserted} ad rows`); refresh(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [syncing, setSyncing] = useState<Kind | null>(null);
  async function runSync(kind: SyncKind, label: string, range: { since: string; until: string }) {
    setSyncing(kind);
    try {
      const r = await syncFn({ data: { kind, ...range } });
      if (r.pending) toast.info(r.note ?? `${label}: report is still being prepared — sync again in a few minutes.`);
      else {
        const what = r.orders !== undefined ? `${r.orders} orders` : `${r.rows_synced} rows`;
        toast.success(`${label}: synced ${what} (${r.since} → ${r.until})${r.note ? `. ${r.note}` : ""}`);
      }
    } catch (e) {
      toast.error(`${label}: ${(e as Error).message}`);
    } finally {
      setSyncing(null);
      refresh();
    }
  }

  const byKind = new Map((sources.data ?? []).map((s) => [s.kind, s]));
  const card = (c: Source) => (
    <SourceCard
      key={c.kind}
      cfg={c}
      row={byKind.get(c.kind)}
      canSync={isCeo}
      syncing={syncing === c.kind}
      onSync={c.live ? (range) => runSync(c.kind as SyncKind, c.label, range) : undefined}
      onCsv={(rows) =>
        c.dataset === "sales"
          ? uploadSales.mutate({ source: c.kind, rows: rows as SalesCsvRow[] })
          : uploadAds.mutate({ platform: c.kind, rows: rows as AdCsvRow[] })
      }
      // Ad CSV import is CEO-only on the server; salespeople can still upload sales.
      canUploadCsv={c.dataset === "sales" || isCeo}
    />
  );

  return (
    <div>
      <PageHeader title="Integrations" description="Connect every place your business earns and spends." />

      <div className="grid gap-3 md:gap-4 grid-cols-2 md:grid-cols-4 mb-6">
        <StatCard label="Sources syncing" value={(sources.data ?? []).filter((s) => s.status === "connected").length} total={CATALOG.length} />
        <StatCard label="Sales rows"      value={summary.data?.salesRows ?? 0} />
        <StatCard label="Ad rows"         value={summary.data?.adRows ?? 0} />
        <StatCard label="Last sync"       value={mostRecent(sources.data ?? [])} isDate />
      </div>

      {isCeo && (
        <div className="mb-4 rounded-xl border bg-muted/40 p-3 text-xs text-muted-foreground">
          Live syncs use each provider's securely stored credentials. A source shows
          <b className="text-foreground"> Connected</b> only after a sync has actually succeeded.
        </div>
      )}

      <SectionCard title="Sales channels" className="mb-4">
        <div className="grid gap-3 md:grid-cols-2">{CATALOG.filter((c) => c.dataset === "sales").map(card)}</div>
      </SectionCard>

      <SectionCard title="Marketing / ad spend">
        <div className="grid gap-3 md:grid-cols-2">{CATALOG.filter((c) => c.dataset === "ads").map(card)}</div>
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

const STATUS: Record<string, { label: string; icon: React.ElementType; variant: "default" | "secondary" | "destructive" }> = {
  connected: { label: "Connected",  icon: CheckCircle2, variant: "default" },
  pending:   { label: "Pending",    icon: Clock,        variant: "secondary" },
  error:     { label: "Sync error", icon: AlertCircle,  variant: "destructive" },
};

function SourceCard({
  cfg, row, onSync, syncing, canSync, onCsv, canUploadCsv,
}: {
  cfg: Source;
  row: { status: string; last_synced_at: string | null } | undefined;
  onSync?: (range: { since: string; until: string }) => void;
  syncing: boolean;
  canSync: boolean;
  onCsv: (rows: unknown[]) => void;
  canUploadCsv: boolean;
}) {
  const Icon = cfg.icon;
  const st = STATUS[row?.status ?? ""] ?? { label: cfg.live ? "Not connected" : "CSV only", icon: Circle, variant: "secondary" as const };
  const [range, setRange] = useState<RangeKey>("last30");

  const handleFile = async (file: File) => {
    try {
      const text = await file.text();
      const rows = cfg.dataset === "sales" ? parseSalesCsv(text) : parseAdsCsv(text);
      if (!rows.length) return toast.error("No rows found in CSV");
      onCsv(rows);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-muted grid place-items-center shrink-0">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium">{cfg.label}</div>
            <Badge variant={st.variant} className="rounded-full text-[10px]">
              <st.icon className="h-3 w-3 mr-1" />{st.label}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{cfg.blurb}</div>
        </div>
      </div>

      {cfg.live && onSync && canSync && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
              <SelectTrigger className="h-8 text-xs w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(RANGE_PRESETS).map(([key, p]) => (
                  <SelectItem key={key} value={key} className="text-xs">{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => onSync(RANGE_PRESETS[range].compute())} disabled={syncing} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
          <Collapsible>
            <CollapsibleTrigger className="group flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3 transition group-data-[state=open]:rotate-180" /> Setup
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2 text-[11px] text-muted-foreground">
              <ol className="list-decimal pl-4 space-y-1">{cfg.live.steps.map((s) => <li key={s}>{s}</li>)}</ol>
              <div className="flex flex-wrap gap-1 items-center">
                <span>Edge function secrets:</span>
                {cfg.live.secrets.map((s) => <code key={s} className="rounded bg-muted px-1 py-0.5 text-foreground">{s}</code>)}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}

      {canUploadCsv && (
        <div className="border-t pt-3">
          <Label className="text-xs mb-2 flex items-center gap-1.5">
            <Upload className="h-3.5 w-3.5" />
            {cfg.live ? "Or upload" : "Upload"} {cfg.dataset === "sales" ? "sales" : "ad spend"} CSV
          </Label>
          <Input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ""; }}
            className="h-9 file:mr-2 file:text-xs"
          />
          <div className="text-[10px] text-muted-foreground mt-1.5">
            {cfg.dataset === "sales"
              ? "Columns: order_date, channel, revenue, orders, currency, external_id"
              : "Columns: spend_date, campaign, spend, revenue, impressions, clicks, conversions"}
          </div>
        </div>
      )}

      {row?.last_synced_at && (
        <div className="text-[10px] text-muted-foreground">Last sync: {new Date(row.last_synced_at).toLocaleString()}</div>
      )}
    </div>
  );
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
