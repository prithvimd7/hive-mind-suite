import type { ReactNode } from "react";

export function PageHeader({
  title, description, actions,
}: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
      <div className="min-w-0">
        <h1 className="text-lg font-medium tracking-tight">{title}</h1>
        {description && <p className="text-[13px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
