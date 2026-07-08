import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Hash, Mail, ShieldCheck, Sparkles } from "lucide-react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

type SupabaseOAuthError = {
  error?: string;
  error_description?: string;
  error_code?: string;
  msg?: string;
  message?: string;
};

const googleSetupMessage =
  "Google login is not configured in Supabase yet. Add the Google OAuth Client ID and Client Secret in Supabase Auth > Providers > Google.";

function getOAuthErrorMessage(payload: SupabaseOAuthError) {
  return payload.msg ?? payload.message ?? payload.error_description ?? payload.error ?? "Google sign-in failed";
}

async function validateOAuthUrl(url: string) {
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "manual",
    });

    if (response.status >= 300 && response.status < 400) return null;
    if (response.type === "opaqueredirect" || response.status === 0) return null;
    if (response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) return "Google sign-in failed. Check Supabase Auth provider settings.";

    const payload = (await response.json()) as SupabaseOAuthError;
    const detail = getOAuthErrorMessage(payload);
    if (detail.toLowerCase().includes("missing oauth secret")) return googleSetupMessage;
    return detail;
  } catch {
    return null;
  }
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const isSignup = mode === "signup";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/home" });
    });
  }, [navigate]);

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/auth" },
        });
        if (error) throw error;
        if (data.session) {
          navigate({ to: "/home" });
          return;
        }
        setMessage("Check your email to verify your account, then sign in.");
        toast.success("Verification email sent.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/home" });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: window.location.origin + "/auth",
          skipBrowserRedirect: true,
          queryParams: {
            prompt: "select_account",
          },
        },
      });
      if (error) throw error;
      if (!data.url) throw new Error("Google sign-in URL was not returned");

      const setupError = await validateOAuthUrl(data.url);
      if (setupError) {
        setMessage(setupError);
        toast.error("Google login needs Supabase setup");
        return;
      }

      window.location.assign(data.url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -top-28 h-72 w-72 rounded-full opacity-30 blur-3xl sm:h-96 sm:w-96"
        style={{ background: "var(--gradient-hero)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-28 right-[-120px] h-80 w-80 rounded-full bg-primary/20 blur-3xl"
      />

      <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] sm:max-w-lg lg:max-w-5xl lg:flex-row lg:items-center lg:gap-10">
        <header className="flex items-center justify-between py-2">
          <Link to="/" className="grid h-10 w-10 place-items-center rounded-full border border-border/80 bg-card/70 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back home</span>
          </Link>
          <div className="rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            BuzzMe
          </div>
        </header>

        <section className="flex-1 pt-6 lg:flex lg:items-center">
          <div className="w-full">
            <div className="lg:grid lg:grid-cols-[0.95fr_1fr] lg:items-center lg:gap-10">
              <div className="lg:pr-4">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">Mobile-first vibe check</p>
                <h1 className="mt-4 font-display text-5xl font-bold leading-[0.92] sm:text-6xl">
                  Meet your <span className="gradient-text">people</span> faster.
                </h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-muted-foreground">
                  Sign in with Google or email. Every profile gets a 6-digit Buzz ID for search later.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">Email verify</span>
                  <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">Google auth</span>
                  <span className="rounded-full border border-border/70 bg-card/70 px-3 py-1.5 text-xs text-muted-foreground">Buzz ID</span>
                </div>
              </div>

              <section className="mt-7 rounded-[28px] border border-border/80 bg-card/80 p-4 shadow-2xl shadow-black/30 backdrop-blur lg:mt-0 lg:p-5">
                <div className="rounded-[24px] border border-border/70 p-4" style={{ background: "var(--gradient-card)" }}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-bold">{isSignup ? "Create account" : "Welcome back"}</h2>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {isSignup ? "Your Buzz ID is assigned automatically." : "Jump back into your chats."}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-primary/30 bg-primary/10 px-3 py-2 text-right">
                      <span className="block font-display text-base font-bold text-primary">6 digit</span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">ID</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={loading}
                    className="mt-6 h-14 w-full rounded-2xl border border-white/15 bg-white text-base font-bold text-black shadow-lg shadow-white/10 transition active:scale-[0.99] hover:bg-white/90"
                    onClick={handleGoogle}
                  >
                    <span className="mr-2 grid h-7 w-7 place-items-center rounded-full bg-black text-sm font-black text-white">G</span>
                    Continue with Google
                  </Button>

                  <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="h-px flex-1 bg-border" />
                    <span>or email</span>
                    <span className="h-px flex-1 bg-border" />
                  </div>

                  <form onSubmit={handleEmail} className="space-y-4">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <div className="relative mt-2">
                        <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="email"
                          className="h-[52px] rounded-2xl border-border/80 bg-background/40 pl-11 text-base"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        className="mt-2 h-[52px] rounded-2xl border-border/80 bg-background/40 text-base"
                        type="password"
                        required
                        minLength={6}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Minimum 6 characters"
                      />
                    </div>
                    <Button type="submit" disabled={loading} className="h-14 w-full rounded-2xl text-base font-bold glow-ring">
                      {loading ? "Working..." : isSignup ? "Create account" : "Sign in"}
                    </Button>
                  </form>

                  {message && (
                    <p className="mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-3 text-xs leading-5 text-primary">
                      {message}
                    </p>
                  )}

                  <button
                    type="button"
                    className="mt-5 w-full rounded-2xl border border-border/70 px-4 py-3 text-center text-sm text-muted-foreground transition active:scale-[0.99] hover:border-primary/50 hover:text-foreground"
                    onClick={() => {
                      setMode(isSignup ? "signin" : "signup");
                      setMessage(null);
                    }}
                  >
                    {isSignup ? "Already have an account? Sign in" : "New here? Create an account"}
                  </button>
                </div>
              </section>
            </div>
          </div>
        </section>

        <footer className="py-4 text-center text-[11px] leading-5 text-muted-foreground lg:hidden">
          <span className="inline-flex items-center gap-1">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Supabase auth, email verify, future search-ready IDs.
          </span>
        </footer>
      </main>
    </div>
  );
}
