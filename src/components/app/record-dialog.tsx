import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Pencil, Trash2 } from "lucide-react";

export type FieldType = "text" | "number" | "date" | "select" | "textarea" | "switch" | "email";

export interface Field {
  name: string;
  label: string;
  type?: FieldType;
  required?: boolean;
  placeholder?: string;
  /** For selects: value/label pairs. An empty-string value means "none" and saves as null. */
  options?: { value: string; label: string }[];
  /** Span both columns of the form grid. */
  full?: boolean;
  min?: number;
  max?: number;
  step?: string;
}

type Values = Record<string, string | boolean>;

function toFormValue(f: Field, v: unknown): string | boolean {
  if (f.type === "switch") return Boolean(v);
  if (v === null || v === undefined) return "";
  return String(v);
}

function fromFormValue(f: Field, v: string | boolean): unknown {
  if (f.type === "switch") return Boolean(v);
  const s = String(v).trim();
  if (s === "") return f.type === "number" && f.required ? 0 : null;
  if (f.type === "number") return Number(s);
  return s;
}

/**
 * Add/edit dialog driven by a field list. Pass `record` to edit; omit it to create.
 * `defaults` seeds new records; `onChange` lets a form derive one field from another.
 */
export function RecordDialog<R extends { id: string }>({
  title,
  trigger,
  fields,
  record,
  defaults,
  onSave,
  onChange,
}: {
  title: string;
  trigger: ReactNode;
  fields: Field[];
  record?: R;
  defaults?: Record<string, unknown>;
  onSave: (payload: Record<string, unknown>, id?: string) => Promise<unknown>;
  onChange?: (name: string, value: string | boolean, values: Values) => Values | void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Values>({});

  // Seed the form only when the dialog opens. Callers usually build `fields`/`defaults` inline,
  // so depending on them would reset the form on every parent render while the user is typing.
  useEffect(() => {
    if (!open) return;
    const src = (record ?? defaults ?? {}) as Record<string, unknown>;
    setValues(Object.fromEntries(fields.map((f) => [f.name, toFormValue(f, src[f.name])])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function set(name: string, value: string | boolean) {
    setValues((prev) => {
      const next = { ...prev, [name]: value };
      return onChange?.(name, value, next) ?? next;
    });
  }

  async function save() {
    const missing = fields.filter((f) => f.required && f.type !== "switch" && String(values[f.name] ?? "").trim() === "");
    if (missing.length) {
      toast.error(`${missing.map((f) => f.label).join(", ")} required`);
      return;
    }
    const payload = Object.fromEntries(fields.map((f) => [f.name, fromFormValue(f, values[f.name] ?? "")]));
    setSaving(true);
    try {
      await onSave(payload, record?.id);
      toast.success(record ? "Saved" : "Added");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{record ? `Edit ${title.toLowerCase()}` : `Add ${title.toLowerCase()}`}</DialogTitle>
        </DialogHeader>

        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(e) => { e.preventDefault(); save(); }}
        >
          {fields.map((f) => {
            const id = `f-${f.name}`;
            const v = values[f.name];
            return (
              <div key={f.name} className={cn("space-y-1.5", (f.full || f.type === "textarea") && "col-span-2")}>
                {f.type === "switch" ? (
                  <div className="flex items-center justify-between rounded-lg border p-3 h-full">
                    <Label htmlFor={id} className="cursor-pointer">{f.label}</Label>
                    <Switch id={id} checked={Boolean(v)} onCheckedChange={(c) => set(f.name, c)} />
                  </div>
                ) : (
                  <>
                    <Label htmlFor={id}>{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                    {f.type === "select" ? (
                      <Select value={String(v ?? "") || "__none"} onValueChange={(x) => set(f.name, x === "__none" ? "" : x)}>
                        <SelectTrigger id={id}><SelectValue placeholder={f.placeholder ?? "Select…"} /></SelectTrigger>
                        <SelectContent>
                          {f.options?.map((o) => (
                            <SelectItem key={o.value || "__none"} value={o.value || "__none"}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : f.type === "textarea" ? (
                      <Textarea id={id} value={String(v ?? "")} onChange={(e) => set(f.name, e.target.value)} placeholder={f.placeholder} />
                    ) : (
                      <Input
                        id={id}
                        type={f.type ?? "text"}
                        value={String(v ?? "")}
                        onChange={(e) => set(f.name, e.target.value)}
                        placeholder={f.placeholder}
                        min={f.min}
                        max={f.max}
                        step={f.step ?? (f.type === "number" ? "any" : undefined)}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
          <button type="submit" hidden />
        </form>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Edit + delete buttons for a table row. Delete asks for confirmation. */
export function RowActions({
  editTrigger,
  onDelete,
  label,
}: {
  editTrigger?: ReactNode;
  onDelete?: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-1">
      {editTrigger}
      {onDelete && (
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 text-destructive hover:text-destructive"
          aria-label={`Delete ${label}`}
          onClick={() => { if (confirm(`Delete "${label}"?`)) onDelete(); }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

/** Small ghost pencil button, used as the trigger for edit dialogs. */
export function EditButton() {
  return (
    <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Edit">
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  );
}
