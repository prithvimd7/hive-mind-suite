import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProductionLine, useUpdateProductionLine, type ProductionLine } from "@/hooks/use-production-lines";

export function ProductionLineDialog({
  line,
  trigger,
}: {
  /** Pass a line to edit it; omit to create a new one. */
  line?: ProductionLine;
  trigger: React.ReactNode;
}) {
  const isEdit = !!line;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(line?.name ?? "");
  const [capacity, setCapacity] = useState(line?.capacity_per_day?.toString() ?? "");
  const [status, setStatus] = useState(line?.status ?? "active");
  const [notes, setNotes] = useState(line?.notes ?? "");

  const create = useCreateProductionLine();
  const update = useUpdateProductionLine();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setName(line?.name ?? "");
    setCapacity(line?.capacity_per_day?.toString() ?? "");
    setStatus(line?.status ?? "active");
    setNotes(line?.notes ?? "");
  }, [open, line]);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Line name is required");
      return;
    }
    const payload = {
      name: name.trim(),
      capacity_per_day: capacity ? Number(capacity) : null,
      status,
      notes: notes.trim() || null,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: line!.id, ...payload });
        toast.success("Production line updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Production line added");
      }
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit production line" : "Add production line"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label htmlFor="lineName">Name</Label>
            <Input id="lineName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Retort Line 1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="capacity">Capacity (units/day)</Label>
              <Input id="capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="250" />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" value={notes ?? ""} onChange={(e) => setNotes(e.target.value)} placeholder="Autoclave, 121°C / 15 PSI / 35 min hold" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
