import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Settings, LogOut, Ruler, Cake } from "lucide-react";
import { toast } from "sonner";
import { PhotoViewer } from "@/components/PhotoViewer";

export const Route = createFileRoute("/_authenticated/profile")({
  component: Profile,
});

interface Me {
  id: string;
  display_name: string;
  age: number;
  gender: string;
  preferred_gender: string;
  bio: string | null;
  interests: string[];
  photos: string[];
  avatar_url: string | null;
  height_cm: number | null;
}

function Profile() {
  const navigate = useNavigate();
  const [me, setMe] = useState<Me | null>(null);
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle();
      setMe(data as Me);
    })();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth", replace: true });
  };

  if (!me) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  const photos = me.photos?.length > 0 ? me.photos : me.avatar_url ? [me.avatar_url] : [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="font-display text-xl font-bold">Profile</h1>
          <div className="flex gap-1">
            <Button asChild variant="ghost" size="icon">
              <Link to="/profile/edit"><Settings className="h-5 w-5" /></Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-5 w-5" /></Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">
        {/* photos */}
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => {
            const src = photos[i];
            return (
              <button
                key={i}
                onClick={() => src && setViewer(i)}
                className="relative aspect-square overflow-hidden rounded-2xl border border-border"
                style={{ background: "var(--gradient-card)" }}
              >
                {src ? (
                  <img src={src} alt="" className="h-full w-full object-cover transition hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                    <Link to="/profile/edit" className="text-primary underline">+ add</Link>
                  </div>
                )}
                {i === 0 && src && (
                  <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold text-primary-foreground">MAIN</span>
                )}
              </button>
            );
          })}
        </div>

        {/* identity */}
        <div className="mt-6 rounded-3xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-3xl font-bold">{me.display_name}</h2>
            <span className="font-display text-2xl text-muted-foreground">{me.age}</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="capitalize">{me.gender}</span>
            <span>· looking for {me.preferred_gender}</span>
            {me.height_cm && (
              <span className="flex items-center gap-1"><Ruler className="h-3 w-3" /> {me.height_cm} cm</span>
            )}
            <span className="flex items-center gap-1"><Cake className="h-3 w-3" /> {me.age} yrs</span>
          </div>
          {me.bio && <p className="mt-4 text-sm text-foreground/90">{me.bio}</p>}
        </div>

        {/* interests */}
        <div className="mt-4 rounded-3xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">Vibes</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(me.interests ?? []).map((i) => (
              <span key={i} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs text-primary">{i}</span>
            ))}
            {(me.interests ?? []).length === 0 && <p className="text-xs text-muted-foreground">No interests set yet.</p>}
          </div>
        </div>

        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to="/profile/edit"><Settings className="mr-2 h-4 w-4" /> Edit profile & settings</Link>
        </Button>
      </main>

      {viewer !== null && <PhotoViewer photos={photos} startIndex={viewer} onClose={() => setViewer(null)} />}
    </div>
  );
}
