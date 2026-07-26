import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { SectionCard } from "@/components/app/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/entry")({
  head: () => ({ meta: [
    { title: "Manual Sales Entry — Company OS" },
    { name: "description", content: "Add offline / manual sales entries." },
    { property: "og:title", content: "Manual Sales Entry — Company OS" },
    { property: "og:description", content: "Log offline sales into Company OS." },
  ]}),
  component: EntryPage,
});

function EntryPage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [channel, setChannel] = useState("Offline");
  const [orders, setOrders] = useState("");
  const [revenue, setRevenue] = useState("");
  const [externalId, setExternalId] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.from("sales_imports").insert({
      order_date: date,
      channel,
      source: "manual",
      orders: Number(orders) || 0,
      revenue: Number(revenue) || 0,
      external_id: externalId || null,
      currency: "INR",
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Sales entry added");
    setOrders(""); setRevenue(""); setExternalId("");
  }

  return (
    <div>
      <PageHeader
        title="Manual Sales Entry"
        description="Log offline sales or corrections. Use Integrations to pull from Shopify & Amazon."
      />
      <div className="max-w-2xl">
        <SectionCard title="New sales entry">
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Channel</Label>
              <Input value={channel} onChange={(e) => setChannel(e.target.value)} placeholder="Offline / Shopify / Amazon…" required />
            </div>
            <div className="space-y-1.5">
              <Label>Orders</Label>
              <Input type="number" min="0" value={orders} onChange={(e) => setOrders(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Revenue (INR)</Label>
              <Input type="number" min="0" step="0.01" value={revenue} onChange={(e) => setRevenue(e.target.value)} required />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label>Reference / Order ID (optional)</Label>
              <Input value={externalId} onChange={(e) => setExternalId(e.target.value)} placeholder="INV-1024" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button type="submit" disabled={busy} className="gap-1.5">
                <Plus className="h-4 w-4" /> {busy ? "Saving…" : "Add entry"}
              </Button>
            </div>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
