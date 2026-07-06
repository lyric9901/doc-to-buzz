import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chats")({
  component: Chats,
});

interface Thread {
  peerId: string;
  displayName: string;
  avatar: string | null;
  lastBody: string;
  lastAt: string;
  unread: number;
  fromMe: boolean;
}

interface RawMsg { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null; }

function Chats() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;

    const { data: msgs } = await supabase
      .from("messages")
      .select("id,sender_id,recipient_id,body,created_at,read_at")
      .or(`sender_id.eq.${uid},recipient_id.eq.${uid}`)
      .order("created_at", { ascending: false })
      .limit(300);

    const byPeer = new Map<string, { last: RawMsg; unread: number }>();
    for (const m of (msgs ?? []) as RawMsg[]) {
      const peer = m.sender_id === uid ? m.recipient_id : m.sender_id;
      const existing = byPeer.get(peer);
      const isUnread = m.recipient_id === uid && !m.read_at;
      if (!existing) {
        byPeer.set(peer, { last: m, unread: isUnread ? 1 : 0 });
      } else if (isUnread) {
        existing.unread += 1;
      }
    }

    const peerIds = [...byPeer.keys()];
    if (peerIds.length === 0) { setThreads([]); setLoading(false); return; }
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,display_name,avatar_url,photos")
      .in("id", peerIds);
    const profMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);

    const list: Thread[] = peerIds
      .map((pid) => {
        const info = byPeer.get(pid)!;
        const prof = profMap.get(pid);
        const photos = (prof?.photos as string[] | null) ?? [];
        return {
          peerId: pid,
          displayName: prof?.display_name ?? "Unknown",
          avatar: prof?.avatar_url ?? photos[0] ?? null,
          lastBody: info.last.body,
          lastAt: info.last.created_at,
          unread: info.unread,
          fromMe: info.last.sender_id === uid,
        };
      })
      .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

    setThreads(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("chats-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-2xl px-4 py-4">
          <h1 className="font-display text-2xl font-bold">Chats</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-4">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-2xl border border-border" style={{ background: "var(--gradient-card)" }} />
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="mt-16 rounded-3xl border border-border p-8 text-center" style={{ background: "var(--gradient-card)" }}>
            <MessageCircle className="mx-auto h-8 w-8 text-primary" />
            <p className="mt-3 font-display text-lg font-semibold">No chats yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Buzz someone from Home to start a convo.</p>
          </div>
        ) : (
          <ul className="space-y-1">
            {threads.map((t) => (
              <li key={t.peerId}>
                <Link
                  to="/chat/$peerId"
                  params={{ peerId: t.peerId }}
                  className="flex items-center gap-3 rounded-2xl border border-transparent px-3 py-2.5 transition hover:border-border hover:bg-card"
                >
                  {t.avatar ? (
                    <img src={t.avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <div className="h-12 w-12 rounded-full" style={{ background: "var(--gradient-hero)", opacity: 0.5 }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{t.displayName}</span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {new Date(t.lastAt).toLocaleDateString([], { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p className={`truncate text-sm ${t.unread > 0 ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {t.fromMe && "You: "}{t.lastBody}
                    </p>
                  </div>
                  {t.unread > 0 && (
                    <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {t.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
