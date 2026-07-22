import { Link, useRouter } from "@tanstack/react-router";
import { Home, Package, Users, LogOut, PlayCircle, Briefcase } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AppShellProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  back?: string;
}

export function AppShell({ title, action, children, back }: AppShellProps) {
  const router = useRouter();

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {back && (
              <Link
                to={back}
                className="text-sm text-muted-foreground hover:text-foreground shrink-0"
              >
                ← Back
              </Link>
            )}
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Luce Ambo
              </div>
              {title && (
                <h1 className="truncate text-base font-semibold text-foreground">
                  {title}
                </h1>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {action}
            <button
              onClick={signOut}
              className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          <NavBtn to="/" icon={<Home className="h-5 w-5" />} label="Home" exact />
          <NavBtn to="/sessions" icon={<PlayCircle className="h-5 w-5" />} label="Sessions" />
          <NavBtn to="/products" icon={<Package className="h-5 w-5" />} label="Products" />
          <NavBtn to="/suppliers" icon={<Users className="h-5 w-5" />} label="Suppliers" />
        </div>
      </nav>
    </div>
  );
}

function NavBtn({ to, icon, label, exact }: { to: string; icon: ReactNode; label: string; exact?: boolean }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-muted-foreground"
      activeProps={{ className: "flex flex-col items-center gap-1 py-3 text-[11px] font-medium text-foreground" }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
