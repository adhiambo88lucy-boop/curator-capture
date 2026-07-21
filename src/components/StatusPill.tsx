import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  discovered: "bg-muted text-muted-foreground",
  watchlist: "bg-amber-100 text-amber-800",
  draft: "bg-blue-100 text-blue-800",
  published: "bg-emerald-100 text-emerald-800",
  archived: "bg-neutral-200 text-neutral-700",
  active: "bg-emerald-100 text-emerald-800",
  ended: "bg-neutral-200 text-neutral-700",
  inactive: "bg-neutral-200 text-neutral-700",
  blacklisted: "bg-red-100 text-red-800",
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
        styles[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      {status}
    </span>
  );
}
