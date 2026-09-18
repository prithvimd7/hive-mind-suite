import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useCreateProduct, useUpdateProduct, type Product } from "@/hooks/use-products";

export function ProductDialog({
  product,
  trigger,
}: {
  /** Pass a product to edit it; omit to create a new one. */
  product?: Product;
  trigger: React.ReactNode;
}) {
  const isEdit = !!product;
  const [open, setOpen] = useState(false);
  const [sku, setSku] = useState(product?.sku ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [unitCost, setUnitCost] = useState(product?.unit_cost?.toString() ?? "");
  const [retailPrice, setRetailPrice] = useState(product?.retail_price?.toString() ?? "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);

  const create = useCreateProduct();
  const update = useUpdateProduct();
  const saving = create.isPending || update.isPending;

  useEffect(() => {
    if (!open) return;
    setSku(product?.sku ?? "");
    setName(product?.name ?? "");
    setCategory(product?.category ?? "");
    setUnitCost(product?.unit_cost?.toString() ?? "");
    setRetailPrice(product?.retail_price?.toString() ?? "");
    setIsActive(product?.is_active ?? true);
  }, [open, product]);

  async function handleSave() {
    if (!sku.trim() || !name.trim()) {
      toast.error("SKU and name are required");
      return;
    }
    const payload = {
      sku: sku.trim(),
      name: name.trim(),
      category: category.trim() || null,
      unit_cost: unitCost ? Number(unitCost) : null,
      retail_price: retailPrice ? Number(retailPrice) : null,
      is_active: isActive,
    };
    try {
      if (isEdit) {
        await update.mutateAsync({ id: product!.id, ...payload });
        toast.success("Product updated");
      } else {
        await create.mutateAsync(payload);
        toast.success("Product added");
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
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="sku">SKU</Label>
              <Input id="sku" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Input id="category" value={category ?? ""} onChange={(e) => setCategory(e.target.value)} />
            </div>
          </div>

          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="unitCost">Unit cost (₹)</Label>
              <Input id="unitCost" type="number" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="retailPrice">Retail price (₹)</Label>
              <Input id="retailPrice" type="number" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            <Switch id="isActive" checked={isActive} onCheckedChange={setIsActive} />
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
