import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ShieldCheck, ShieldX, Loader2 } from "lucide-react";
import { PhotoViewer } from "@/components/PhotoViewer";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

interface PendingProfile {
  id: string;
  display_name: string;
  age: number;
  gender: string;
  bio: string | null;
  photos: string[];
  avatar_url: string | null;
  is_verified: boolean;
  created_at: string;
}

function AdminPage() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profiles, setProfiles] = useState<PendingProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewer, setViewer] = useState<{ photos: string[]; index: number } | null>(null);
  const [filter, setFilter] = useState<"pending" | "verified">("pending");

  const load = useCallback(async (mode: "pending" | "verified") => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,display_name,age,gender,bio,photos,avatar_url,is_verified,created_at")
      .eq("is_verified", mode === "verified")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) toast.error(error.message);
    setProfiles((data as PendingProfile[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      const admin = !!data;
      setIsAdmin(admin);
      setChecking(false);
      if (admin) load(filter);
    })();
  }, [load, filter]);

  const setVerified = async (id: string, value: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_verified: value }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success(value ? "Verified" : "Unverified");
    setProfiles((p) => p.filter((x) => x.id !== id));
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-8 text-center">
        <ShieldX className="h-10 w-10 text-muted-foreground" />
        <h1 className="font-display text-xl font-bold">Not authorized</h1>
        <p className="text-sm text-muted-foreground">This page is for admins only.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="font-display text-xl font-bold">Admin · Verification</h1>
          </div>
          <div className="flex gap-1 rounded-full border border-border p-1 text-xs">
            <button
              onClick={() => setFilter("pending")}
              className={`rounded-full px-3 py-1 ${filter === "pending" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter("verified")}
              className={`rounded-full px-3 py-1 ${filter === "verified" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Verified
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : profiles.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {filter === "pending" ? "No pending profiles." : "No verified profiles yet."}
          </p>
        ) : (
          <ul className="space-y-4">
            {profiles.map((p) => {
              const photos = p.photos?.length ? p.photos : p.avatar_url ? [p.avatar_url] : [];
              return (
                <li
                  key={p.id}
                  className="rounded-3xl border border-border p-4"
                  style={{ background: "var(--gradient-card)" }}
                >
                  <div className="flex items-baseline gap-2">
                    <h2 className="font-display text-lg font-bold">{p.display_name}</h2>
                    <span className="text-sm text-muted-foreground">{p.age} · {p.gender}</span>
                  </div>
                  {p.bio && <p className="mt-1 text-sm text-foreground/80">{p.bio}</p>}
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((i) => {
                      const src = photos[i];
                      return (
                        <button
                          key={i}
                          onClick={() => src && setViewer({ photos, index: i })}
                          className="relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
                          disabled={!src}
                        >
                          {src ? (
                            <img src={src} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">empty</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-2">
                    {filter === "pending" ? (
                      <Button size="sm" className="flex-1" onClick={() => setVerified(p.id, true)}>
                        <ShieldCheck className="mr-1 h-4 w-4" /> Approve
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setVerified(p.id, false)}>
                        <ShieldX className="mr-1 h-4 w-4" /> Revoke
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {viewer && (
        <PhotoViewer photos={viewer.photos} startIndex={viewer.index} onClose={() => setViewer(null)} />
      )}
    </div>
  );
}
