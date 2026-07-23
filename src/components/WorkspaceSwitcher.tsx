import { Link } from "@tanstack/react-router";
import { Check, ChevronDown, Store, Wrench } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Small workspace switcher. Curator Console is the current workspace;
 * the marketplace is only opened intentionally via this menu.
 */
export function WorkspaceSwitcher() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Wrench className="h-3.5 w-3.5" />
        Curator Console
        <ChevronDown className="h-3 w-3 opacity-60" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-lg"
        >
          <div className="border-b border-border px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Current workspace
          </div>
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              <span className="font-medium">Curator Console</span>
            </div>
            <Check className="h-4 w-4 text-foreground" />
          </div>
          <div className="border-t border-border">
            <Link
              to="/market"
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm hover:bg-muted"
            >
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                <span>View Marketplace</span>
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Buyer</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
