import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SwipeCard, type SwipeProfile } from "@/components/SwipeCard";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/home")({
  component: Home,
});

interface MyProfile {
  id: string;
  preferred_gender: string;
  interests: string[];
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

function Home() {
  const navigate = useNavigate();
  const [me, setMe] = useState<MyProfile | null>(null);
  const [deck, setDeck] = useState<SwipeProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const { data: mine } = await supabase.from("profiles").select("id,preferred_gender,interests,onboarded").eq("id", uid).maybeSingle();
    if (!mine || !mine.onboarded) { navigate({ to: "/onboarding" }); return; }
    setMe(mine as MyProfile);

    // Users I've already liked
    const { data: liked } = await supabase.from("likes").select("likee_id").eq("liker_id", uid);
    const excluded = new Set<string>([uid, ...(liked ?? []).map((l) => l.likee_id)]);

    let q = supabase
      .from("profiles")
      .select("id,display_name,age,bio,interests,photos,avatar_url,height_cm,gender")
      .eq("onboarded", true)
      .limit(80);
    if (mine.preferred_gender !== "everyone") q = q.eq("gender", mine.preferred_gender);
    const { data: candidates } = await q;

    const list = ((candidates ?? []) as (SwipeProfile & { gender: string })[]).filter((p) => !excluded.has(p.id));
    const mySet = new Set<string>(mine.interests ?? []);
    const matched = list.filter((p) => (p.interests ?? []).some((i) => mySet.has(i)));
    const wild = list.filter((p) => !(p.interests ?? []).some((i) => mySet.has(i)));

    const target = Math.min(25, list.length);
    const nMatched = Math.min(matched.length, Math.round(target * 0.7));
    const nWild = Math.min(wild.length, target - nMatched);
    const picked = [...shuffle(matched).slice(0, nMatched), ...shuffle(wild).slice(0, nWild)];
    setDeck(shuffle(picked));
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const top = deck[deck.length - 1];
  const shared = useMemo(() => {
    if (!top || !me) return [];
    const mySet = new Set(me.interests ?? []);
    return (top.interests ?? []).filter((i) => mySet.has(i));
  }, [top, me]);

  const handleSwipe = async (dir: "left" | "right") => {
    if (!top || !me) return;
    const target = top;
    setDeck((d) => d.slice(0, -1));
    if (dir === "right") {
      const { error } = await supabase.from("likes").insert({ liker_id: me.id, likee_id: target.id });
      if (error && !error.message.includes("duplicate")) {
        toast.error("Couldn't send buzz");
      } else {
        toast.success(`Buzzed ${target.display_name} ⚡`, { duration: 1200 });
      }
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md" style={{ background: "var(--gradient-hero)" }} />
            <span className="font-display font-bold">BuzzMe</span>
          </div>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-primary" /> 70% vibe · 30% chaos
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-6">
        <div className="relative mx-auto aspect-[3/4] w-full max-w-sm">
          {loading ? (
            <div className="h-full w-full animate-pulse rounded-3xl border border-border" style={{ background: "var(--gradient-card)" }} />
          ) : deck.length === 0 ? (
            <div className="flex h-full w-full flex-col items-center justify-center rounded-3xl border border-border p-8 text-center" style={{ background: "var(--gradient-card)" }}>
              <Sparkles className="mb-3 h-8 w-8 text-primary" />
              <h2 className="font-display text-xl font-bold">Deck's empty</h2>
              <p className="mt-2 text-sm text-muted-foreground">You've seen everyone. Check back later or refresh.</p>
              <Button onClick={load} variant="outline" className="mt-6 gap-2">
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </div>
          ) : (
            deck.slice(-3).map((p, i, arr) => (
              <SwipeCard
                key={p.id}
                profile={p}
                sharedInterests={i === arr.length - 1 ? shared : []}
                onSwipe={handleSwipe}
                active={i === arr.length - 1}
                stackIndex={arr.length - 1 - i}
              />
            ))
          )}
        </div>
        <div className="h-24" />
      </main>
    </div>
  );
}
