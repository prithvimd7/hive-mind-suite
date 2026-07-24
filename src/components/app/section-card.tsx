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
    <section className={cn("card-elevated p-5 md:p-6 animate-in-up", className)}>
      <header className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
