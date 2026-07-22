import { createFileRoute, Link } from "@tanstack/react-router";
import { BusinessShell } from "@/components/BusinessShell";
import { DollarSign, Coins, Truck, Sliders, LineChart, ScrollText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/business/")({
  component: BusinessHome,
});

const CARDS = [
  { to: "/business/pricing", icon: DollarSign, title: "Pricing Studio", desc: "Markups, rounding, product overrides & live price previews." },
  { to: "/business/shipping", icon: Truck, title: "Shipping Center", desc: "Companies, methods, per-kg rates and delivery estimates." },
  { to: "/business/currency", icon: Coins, title: "Currency Center", desc: "Exchange rates, platform margin and rate history." },
  { to: "/business/rules", icon: Sliders, title: "Commercial Rules", desc: "Company-wide defaults, warnings and safety limits." },
  { to: "/business/profit", icon: LineChart, title: "Profit Dashboard", desc: "Margin, expected profit and outlier products." },
  { to: "/business/audit", icon: ScrollText, title: "Audit Log", desc: "Every rate, markup and rule change is recorded here." },
] as const;

function BusinessHome() {
  return (
    <BusinessShell title="Overview">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        The Business Engine is the single source of truth for every commercial calculation across
        Luce Ambo. Reservations, orders and quotations all consume the engine — never re-implement pricing elsewhere.
      </p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link key={c.to} to={c.to as never} className="group rounded-2xl border border-border bg-card p-5 transition hover:border-foreground/40 hover:shadow-sm">
            <c.icon className="h-6 w-6 text-foreground" />
            <div className="mt-4 font-semibold text-foreground">{c.title}</div>
            <div className="mt-1 text-xs text-muted-foreground">{c.desc}</div>
          </Link>
        ))}
      </div>
    </BusinessShell>
  );
}
