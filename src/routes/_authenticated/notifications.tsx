import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Heart, MessageCircle, Sparkles, Bell } from "lucide-react";

export const Route = createFileRoute("/_authenticated/notifications")({
  component: Notifications,
});

interface Notif {
  id: string;
  type: "buzz" | "match" | "message";
  actor_id: string | null;
  entity_id: string | null;
  read: boolean;
  created_at: string;
  actor?: { id: string; display_name: string; avatar_url: string | null; photos: string[] | null };
}

function Notifications() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(100);
    const actorIds = [...new Set((notifs ?? []).map((n) => n.actor_id).filter(Boolean) as string[])];
    const { data: profs } = actorIds.length
      ? await supabase.from("profiles").select("id,display_name,avatar_url,photos").in("id", actorIds)
      : { data: [] as { id: string; display_name: string; avatar_url: string | null; photos: string[] | null }[] };
    const map = new Map(profs?.map((p) => [p.id, p]) ?? []);
    setItems(((notifs ?? []) as Notif[]).map((n) => ({ ...n, actor: n.actor_id ? map.get(n.actor_id) : undefined })));
    setLoading(false);

    // mark all as read
    const unreadIds = (notifs ?? []).filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length) {
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("notifs-page")
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const iconFor = (t: Notif["type"]) =>
    t === "buzz" ? Heart : t === "match" ? Sparkles : MessageCircle;
  const labelFor = (n: Notif) =>
    n.type === "buzz" ? "buzzed you"
    : n.type === "match" ? "matched with you"
    : "sent you a message";
  const linkFor = (n: Notif) =>
    n.type === "message" && n.actor_id ? `/chat/${n.actor_id}` : n.actor_id ? `/chat/${n.actor_id}` : "/home";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-border" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-border p-8 text-center" style={{ background: "var(--gradient-card)" }}>
            <Bell className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-display text-lg font-semibold">No alerts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Buzzes, matches, and messages will appear here.</p>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {items.map((n) => {
              const Icon = iconFor(n.type);
              const photos = (n.actor?.photos as string[] | null) ?? [];
              const avatar = n.actor?.avatar_url ?? photos[0] ?? null;
              return (
                <li key={n.id}>
                  <Link
                    to={linkFor(n) as never}
                    className="flex items-center gap-3 rounded-2xl border border-border px-3 py-3 transition hover:border-primary/40"
                    style={{ background: "var(--gradient-card)" }}
                  >
                    <div className="relative">
                      {avatar ? (
                        <img src={avatar} alt="" className="h-11 w-11 rounded-full object-cover" />
                      ) : (
                        <div className="h-11 w-11 rounded-full" style={{ background: "var(--gradient-hero)", opacity: 0.4 }} />
                      )}
                      <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                        <Icon className="h-3 w-3 text-primary-foreground" />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-semibold">{n.actor?.display_name ?? "Someone"}</span>{" "}
                        <span className="text-muted-foreground">{labelFor(n)}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(n.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {n.type === "match" && (
                      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">match!</span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
