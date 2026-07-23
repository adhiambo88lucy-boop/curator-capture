import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppButton } from "@/components/AppButton";
import { Field, Input } from "@/components/ui/field";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fn =
        mode === "signin"
          ? supabase.auth.signInWithPassword({ email, password })
          : supabase.auth.signUp({
              email,
              password,
              options: { emailRedirectTo: `${window.location.origin}/` },
            });
      const { error } = await fn;
      if (error) throw error;
      toast.success(mode === "signin" ? "Signed in" : "Account created");
      router.navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted-foreground">
            Luce Ambo
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-foreground">
            Curator Console
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Internal team — capture products from the field.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
          <Field label="Email" required>
            <Input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" required>
            <Input type="password" required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <AppButton type="submit" size="lg" className="w-full" disabled={busy}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </AppButton>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "New team member? Create an account" : "Already registered? Sign in"}
          </button>
        </form>
        <div className="mt-6 text-center text-xs text-muted-foreground">
          Buyer looking to shop?{" "}
          <Link to="/market/auth" className="font-medium text-foreground underline">
            Go to marketplace sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
