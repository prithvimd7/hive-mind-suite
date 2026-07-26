import { Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export function EmptyState({
  title = "No data yet",
  description = "Connect a data source or add an entry to see real numbers here.",
  ctaLabel,
  ctaTo,
}: {
  title?: string;
  description?: string;
  ctaLabel?: string;
  ctaTo?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="h-10 w-10 rounded-full bg-muted grid place-items-center mb-3">
        <Inbox className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-muted-foreground mt-1 max-w-xs">{description}</div>
      {ctaLabel && ctaTo && (
        <Button asChild size="sm" variant="outline" className="mt-4">
          <Link to={ctaTo}>{ctaLabel}</Link>
        </Button>
      )}
    </div>
  );
}
