import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("bg-card border rounded-[var(--radius)]", className)}>
      <header className="flex items-start justify-between gap-3 px-4 py-3 border-b">
        <div className="min-w-0">
          <h3 className="text-[13px] font-medium tracking-tight">{title}</h3>
          {description && <p className="text-[11.5px] text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}
