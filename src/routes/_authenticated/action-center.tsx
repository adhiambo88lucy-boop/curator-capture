import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { formatRelative } from "@/lib/format";
import {
  ClipboardCheck,
  ImageOff,
  DollarSign,
  PackageX,
  Truck,
  Coins,
  Flame,
  UploadCloud,
  ChevronRight,
} from "lucide-react";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/action-center")({
  component: ActionCenter,
});

function ActionCenter() {
  const { data } = useQuery({
    queryKey: ["action-center"],
    queryFn: async () => {
      const now = new Date();
      const staleShipping = new Date(now);
      staleShipping.setDate(staleShipping.getDate() - 30);
      const staleFx = new Date(now);
      staleFx.setDate(staleFx.getDate() - 7);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      const [
        pendingReservations,
        missingPhotos,
        missingPricing,
        withoutListings,
        staleShippingRates,
        staleExchangeRates,
        gbEndingToday,
        awaitingPublish,
      ] = await Promise.all([
        supabase
          .from("group_buy_reservations")
          .select("id,quantity,status,created_at,listing:listings(id,product:products(id,name,internal_code))")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("products")
          .select("id,name,internal_code,media:product_media(count)")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("listings")
          .select("id,supplier_price_rmb,product:products(id,name,internal_code)")
          .is("supplier_price_rmb", null)
          .limit(10),
        supabase
          .from("products")
          .select("id,name,internal_code,listings:listings(count)")
          .limit(50),
        supabase
          .from("shipping_rates")
          .select("id,method,rate,updated_at,company:shipping_companies(name)")
          .lt("updated_at", staleShipping.toISOString())
          .eq("active", true)
          .limit(10),
        supabase
          .from("exchange_rates")
          .select("id,currency_code,rate_to_rmb,effective_at")
          .lt("effective_at", staleFx.toISOString())
          .order("effective_at", { ascending: false })
          .limit(10),
        supabase
          .from("listings")
          .select("id,group_buy_deadline,product:products(id,name,internal_code)")
          .eq("group_buy_enabled", true)
          .not("group_buy_deadline", "is", null)
          .lte("group_buy_deadline", endOfDay.toISOString())
          .gte("group_buy_deadline", now.toISOString())
          .limit(10),
        supabase
          .from("listings")
          .select("id,code,product:products(id,name,internal_code)")
          .eq("publish_status", "draft")
          .limit(10),
      ]);

      return {
        pendingReservations: pendingReservations.data ?? [],
        missingPhotos:
          (missingPhotos.data ?? []).filter((p) => (p.media?.[0]?.count ?? 0) === 0).slice(0, 10),
        missingPricing: missingPricing.data ?? [],
        withoutListings:
          (withoutListings.data ?? []).filter((p) => (p.listings?.[0]?.count ?? 0) === 0).slice(0, 10),
        staleShippingRates: staleShippingRates.data ?? [],
        staleExchangeRates: staleExchangeRates.data ?? [],
        gbEndingToday: gbEndingToday.data ?? [],
        awaitingPublish: awaitingPublish.data ?? [],
      };
    },
    staleTime: 20_000,
  });

  return (
    <AppShell title="Action Center">
      <p className="mb-5 text-sm text-muted-foreground">
        Your daily to-do list. Everything below is waiting on a decision or refresh from the curator team.
      </p>

      <div className="space-y-4">
        <ActionGroup
          icon={<ClipboardCheck className="h-4 w-4" />}
          title="Reservations awaiting approval"
          count={data?.pendingReservations.length}
        >
          {data?.pendingReservations.map((r) => (
            <Row
              key={r.id}
              to="/reservations"
              label={`${r.listing?.product?.internal_code ?? ""} · ${r.listing?.product?.name ?? "Unknown product"}`}
              meta={`${r.quantity} units · placed ${formatRelative(r.created_at)}`}
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<ImageOff className="h-4 w-4" />}
          title="Products missing photos"
          count={data?.missingPhotos.length}
        >
          {data?.missingPhotos.map((p) => (
            <Row
              key={p.id}
              to="/products/$productId"
              params={{ productId: p.id }}
              label={`${p.internal_code} · ${p.name}`}
              meta="No media uploaded yet"
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<DollarSign className="h-4 w-4" />}
          title="Listings missing pricing"
          count={data?.missingPricing.length}
        >
          {data?.missingPricing.map((l) => (
            <Row
              key={l.id}
              to="/products/$productId"
              params={{ productId: l.product?.id ?? "" }}
              label={`${l.product?.internal_code ?? ""} · ${l.product?.name ?? ""}`}
              meta="Supplier price not set"
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<PackageX className="h-4 w-4" />}
          title="Products without supplier listings"
          count={data?.withoutListings.length}
        >
          {data?.withoutListings.map((p) => (
            <Row
              key={p.id}
              to="/products/$productId"
              params={{ productId: p.id }}
              label={`${p.internal_code} · ${p.name}`}
              meta="Add a listing to make it sellable"
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<Truck className="h-4 w-4" />}
          title="Shipping rates to refresh"
          count={data?.staleShippingRates.length}
        >
          {data?.staleShippingRates.map((r) => (
            <Row
              key={r.id}
              to="/business/shipping"
              label={`${r.company?.name ?? "Shipping"} · ${r.method}`}
              meta={`Rate ¥${r.rate} · last updated ${formatRelative(r.updated_at)}`}
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<Coins className="h-4 w-4" />}
          title="Exchange rates to refresh"
          count={data?.staleExchangeRates.length}
        >
          {data?.staleExchangeRates.map((r) => (
            <Row
              key={r.id}
              to="/business/currency"
              label={r.currency_code}
              meta={`Rate ${r.rate_to_rmb} · effective ${formatRelative(r.effective_at)}`}
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<Flame className="h-4 w-4" />}
          title="Group buys ending today"
          count={data?.gbEndingToday.length}
        >
          {data?.gbEndingToday.map((l) => (
            <Row
              key={l.id}
              to="/products/$productId"
              params={{ productId: l.product?.id ?? "" }}
              label={`${l.product?.internal_code ?? ""} · ${l.product?.name ?? ""}`}
              meta={`Closes ${formatRelative(l.group_buy_deadline ?? "")}`}
            />
          ))}
        </ActionGroup>

        <ActionGroup
          icon={<UploadCloud className="h-4 w-4" />}
          title="Listings awaiting publication"
          count={data?.awaitingPublish.length}
        >
          {data?.awaitingPublish.map((l) => (
            <Row
              key={l.id}
              to="/products/$productId"
              params={{ productId: l.product?.id ?? "" }}
              label={`${l.code} · ${l.product?.name ?? ""}`}
              meta="Currently in draft"
            />
          ))}
        </ActionGroup>
      </div>
    </AppShell>
  );
}

function ActionGroup({
  icon,
  title,
  count,
  children,
}: {
  icon: ReactNode;
  title: string;
  count?: number;
  children: ReactNode;
}) {
  const n = count ?? 0;
  return (
    <section className="rounded-2xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
            n > 0 ? "bg-foreground text-background" : "bg-muted text-muted-foreground"
          }`}
        >
          {n}
        </span>
      </header>
      <div>
        {n === 0 ? (
          <div className="px-4 py-4 text-xs text-muted-foreground">All clear.</div>
        ) : (
          <ul className="divide-y divide-border">{children}</ul>
        )}
      </div>
    </section>
  );
}

function Row({
  to,
  params,
  label,
  meta,
}: {
  to: string;
  params?: Record<string, string>;
  label: string;
  meta?: string;
}) {
  return (
    <li>
      <Link
        to={to as never}
        params={params as never}
        className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted"
      >
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{label}</div>
          {meta && <div className="mt-0.5 text-[11px] text-muted-foreground">{meta}</div>}
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>
    </li>
  );
}
