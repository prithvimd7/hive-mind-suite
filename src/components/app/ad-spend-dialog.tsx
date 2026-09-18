import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { platformLabel } from "@/hooks/use-marketing-data";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Plus } from "lucide-react";

const PLATFORMS = ["meta_ads", "amazon_ads", "google_ads", "other"] as const;

export function AdSpendDialog({ trigger }: { trigger?: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [platform, setPlatform] = useState<string>("meta_ads");
  const [campaign, setCampaign] = useState("");
  const [spendDate, setSpendDate] = useState(new Date().toISOString().slice(0, 10));
  const [spend, setSpend] = useState("");
  const [revenue, setRevenue] = useState("");
  const [impressions, setImpressions] = useState("");
  const [clicks, setClicks] = useState("");
  const [conversions, setConversions] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!spend) {
      toast.error("Spend is required");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("ad_spend_imports").insert({
      platform,
      campaign: campaign.trim() || null,
      spend_date: spendDate,
      spend: Number(spend) || 0,
      revenue: Number(revenue) || 0,
      impressions: Number(impressions) || 0,
      clicks: Number(clicks) || 0,
      conversions: Number(conversions) || 0,
    });
    setBusy(false);
    if (error) {
      return toast.error(error.code === "23505"
        ? "There is already an entry for this platform, campaign and date — delete it first or use a different campaign name."
        : error.message);
    }
    toast.success("Ad spend entry added");
    qc.invalidateQueries({ queryKey: ["ad_spend_imports"] });
    qc.invalidateQueries({ queryKey: ["business_snapshot"] });
    setCampaign(""); setSpend(""); setRevenue(""); setImpressions(""); setClicks(""); setConversions("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Add spend</Button>}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add ad spend entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{platformLabel(p)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={spendDate} onChange={(e) => setSpendDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Campaign name</Label>
            <Input value={campaign} onChange={(e) => setCampaign(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Spend (₹)</Label>
              <Input type="number" min="0" step="0.01" value={spend} onChange={(e) => setSpend(e.target.value)} required />
            </div>
            <div>
              <Label>Revenue (₹)</Label>
              <Input type="number" min="0" step="0.01" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
            </div>
            <div>
              <Label>Impressions</Label>
              <Input type="number" min="0" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
            </div>
            <div>
              <Label>Clicks</Label>
              <Input type="number" min="0" value={clicks} onChange={(e) => setClicks(e.target.value)} />
            </div>
            <div>
              <Label>Conversions</Label>
              <Input type="number" min="0" value={conversions} onChange={(e) => setConversions(e.target.value)} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={busy}>{busy ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
