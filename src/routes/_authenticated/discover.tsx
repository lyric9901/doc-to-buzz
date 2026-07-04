import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, MessageCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { clearKeys } from "@/lib/keystore";

export const Route = createFileRoute("/_authenticated/discover")({
  component: Discover,
});

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender: string;
  preferred_gender: string;
  bio: string | null;
  interests: string[];
  avatar_url: string | null;
  public_key: JsonWebKey | null;
  onboarded: boolean;
}

function shuffle<T>(a: T[]): T[] {
  const arr = [...a];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function Discover() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Profile | null>(null);
  const [feed, setFeed] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const { data: myProfile } = await supabase.from("profiles").select("*").eq("id", uid).maybeSingle();
      if (!myProfile || !myProfile.onboarded) {
        navigate({ to: "/onboarding" });
        return;
      }
      setMe(myProfile as Profile);

      let q = supabase.from("profiles").select("*").neq("id", uid).eq("onboarded", true).limit(60);
      if (myProfile.preferred_gender !== "everyone") q = q.eq("gender", myProfile.preferred_gender);
      const { data: candidates } = await q;
      const list = (candidates ?? []) as Profile[];

      const mine = new Set<string>(myProfile.interests ?? []);
      const matched = list.filter((p) => (p.interests ?? []).some((i) => mine.has(i)));
      const wild = list.filter((p) => !(p.interests ?? []).some((i) => mine.has(i)));

      // 70% matched, 30% wildcard
      const target = Math.min(30, list.length);
      const nMatched = Math.min(matched.length, Math.round(target * 0.7));
      const nWild = Math.min(wild.length, target - nMatched);
      const picked = [...shuffle(matched).slice(0, nMatched), ...shuffle(wild).slice(0, nWild)];
      setFeed(shuffle(picked));
      setLoading(false);
    })();
  }, [navigate]);

  const signOut = async () => {
    await clearKeys();
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md" style={{ background: "var(--gradient-hero)" }} />
            <span className="font-display font-bold">BuzzMe</span>
          </div>
          <div className="flex items-center gap-3">
            {me?.avatar_url && <img src={me.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />}
            <Button variant="ghost" size="sm" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold">Your feed</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> 70% your vibe · 30% chaos
          </p>
        </div>

        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 rounded-2xl border border-border animate-pulse" style={{ background: "var(--gradient-card)" }} />
            ))}
          </div>
        ) : feed.length === 0 ? (
          <div className="rounded-2xl border border-border p-10 text-center" style={{ background: "var(--gradient-card)" }}>
            <p className="text-muted-foreground">No one here yet. Come back soon.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {feed.map((p) => {
              const shared = (p.interests ?? []).filter((i) => (me?.interests ?? []).includes(i));
              return (
                <div key={p.id} className="group rounded-2xl border border-border overflow-hidden transition hover:border-primary/40" style={{ background: "var(--gradient-card)" }}>
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.display_name} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : <div className="h-full w-full" style={{ background: "var(--gradient-hero)", opacity: 0.4 }} />}
                  </div>
                  <div className="p-4">
                    <div className="flex items-baseline justify-between">
                      <h3 className="font-display font-semibold">{p.display_name}, {p.age}</h3>
                      {shared.length > 0 && <span className="text-xs text-primary">{shared.length} match</span>}
                    </div>
                    {p.bio && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{p.bio}</p>}
                    <div className="mt-3 flex flex-wrap gap-1">
                      {(p.interests ?? []).slice(0, 3).map((i) => (
                        <span key={i} className={`rounded-full px-2 py-0.5 text-[10px] border ${shared.includes(i) ? "bg-primary/10 text-primary border-primary/30" : "text-muted-foreground border-border"}`}>{i}</span>
                      ))}
                    </div>
                    <Link to="/chat/$peerId" params={{ peerId: p.id }} className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary py-2 text-xs font-semibold text-primary-foreground">
                      <MessageCircle className="h-3 w-3" /> Vibe check
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
