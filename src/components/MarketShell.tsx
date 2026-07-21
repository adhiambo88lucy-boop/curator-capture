import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { Home, Search, Heart, User, LogIn } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function MarketShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_, session) => {
      setSignedIn(!!session?.user);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/market" });
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <Link to="/market" className="flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold tracking-tight text-foreground">Luce Ambo</span>
            <span className="hidden text-[10px] uppercase tracking-[0.25em] text-muted-foreground md:inline">Curated Marketplace</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <Link to="/market" activeOptions={{ exact: true }} className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Discover</Link>
            <Link to="/market/browse" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Browse</Link>
            <Link to="/market/favorites" className="hover:text-foreground" activeProps={{ className: "text-foreground" }}>Favorites</Link>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <button onClick={signOut} className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted">
                Sign out
              </button>
            ) : (
              <Link to="/market/auth" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90">
                <LogIn className="h-3.5 w-3.5" /> Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-6xl grid-cols-4">
          <MobileTab to="/market" icon={<Home className="h-5 w-5" />} label="Home" exact />
          <MobileTab to="/market/browse" icon={<Search className="h-5 w-5" />} label="Browse" />
          <MobileTab to="/market/favorites" icon={<Heart className="h-5 w-5" />} label="Saved" />
          <MobileTab to={signedIn ? "/market" : "/market/auth"} icon={<User className="h-5 w-5" />} label={signedIn ? "Account" : "Sign in"} />
        </div>
      </nav>
    </div>
  );
}

function MobileTab({ to, icon, label, exact }: { to: string; icon: ReactNode; label: string; exact?: boolean }) {
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
