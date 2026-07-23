import { Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const TABS: { to: string; label: string; exact?: boolean }[] = [
  { to: "/business", label: "Overview", exact: true },
  { to: "/business/pricing", label: "Pricing" },
  { to: "/business/currency", label: "Currency" },
  { to: "/business/shipping", label: "Shipping" },
  { to: "/business/rules", label: "Rules" },
  { to: "/business/profit", label: "Profit" },
  { to: "/business/audit", label: "Audit" },
];

export function BusinessShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Business Engine
              </div>
              <h1 className="text-base font-semibold text-foreground">{title}</h1>
            </div>
          </div>
          <button onClick={signOut} className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="border-t border-border/60">
          <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 py-2">
            {TABS.map((t) => (
              <Link
                key={t.to}
                to={t.to as never}
                activeOptions={{ exact: t.exact ?? false }}
                className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted"
                activeProps={{ className: "whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background" }}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-6">{children}</main>
    </div>
  );
}
