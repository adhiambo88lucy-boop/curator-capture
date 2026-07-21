import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppButton } from "@/components/AppButton";
import { Field, Input } from "@/components/ui/field";

export const Route = createFileRoute("/market/auth")({
  ssr: false,
  component: MarketAuthPage,
});

function MarketAuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [country, setCountry] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/market` },
        });
        if (error) throw error;
        const userId = data.user?.id;
        if (userId) {
          await supabase.from("user_roles").insert({ user_id: userId, role: "buyer" });
          await supabase.from("buyer_profiles").insert({
            id: userId,
            business_name: businessName || null,
            contact_name: contactName || null,
            country: country || null,
          });
        }
        toast.success("Account created");
      }
      router.navigate({ to: "/market" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">Luce Ambo</div>
          <h1 className="mt-2 font-display text-3xl font-bold text-foreground">
            {mode === "signin" ? "Welcome back" : "Join the marketplace"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Sign in to shop curated fashion from Guangzhou."
              : "Create a buyer account to reserve, group-buy, and save products."}
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          {mode === "signup" && (
            <>
              <Field label="Business name">
                <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Ambo Fashion House" />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Contact name">
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
                </Field>
                <Field label="Country">
                  <Input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Ethiopia" />
                </Field>
              </div>
            </>
          )}
          <Field label="Email" required>
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" required>
            <Input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <AppButton type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create buyer account"}
          </AppButton>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "New here? Create a buyer account" : "Already have an account? Sign in"}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Curator team?{" "}
          <Link to="/auth" className="font-medium text-foreground underline">
            Go to Curator Console
          </Link>
        </div>
      </div>
    </div>
  );
}
