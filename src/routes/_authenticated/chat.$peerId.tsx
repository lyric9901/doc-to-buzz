import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/chat/$peerId")({
  component: Chat,
});

interface Peer {
  id: string;
  display_name: string;
  avatar_url: string | null;
  photos: string[] | null;
}
interface Msg {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

function Chat() {
  const { peerId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = async (uid: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(`and(sender_id.eq.${uid},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${uid})`)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((data ?? []) as Msg[]);
    // mark peer's messages as read
    await supabase.from("messages").update({ read_at: new Date().toISOString() })
      .eq("sender_id", peerId).eq("recipient_id", uid).is("read_at", null);
  };

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      setMe(uid);
      const { data: p } = await supabase.from("profiles").select("id,display_name,avatar_url,photos").eq("id", peerId).maybeSingle();
      if (!p) { toast.error("User not found"); navigate({ to: "/chats" }); return; }
      setPeer(p as Peer);
      await loadMessages(uid);
    })();
    // eslint-disable-next-line
  }, [peerId]);

  useEffect(() => {
    if (!me) return;
    const ch = supabase
      .channel(`chat:${[me, peerId].sort().join(":")}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as Msg;
          const between = (m.sender_id === me && m.recipient_id === peerId) || (m.sender_id === peerId && m.recipient_id === me);
          if (!between) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          if (m.sender_id === peerId) {
            supabase.from("messages").update({ read_at: new Date().toISOString() }).eq("id", m.id);
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me, peerId]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !me) return;
    setSending(true);
    const body = text.trim();
    setText("");
    const { error } = await supabase.from("messages").insert({ sender_id: me, recipient_id: peerId, body });
    if (error) toast.error(error.message);
    setSending(false);
  };

  const avatar = peer?.avatar_url ?? (peer?.photos && peer.photos[0]) ?? null;

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <button onClick={() => navigate({ to: "/chats" })}><ArrowLeft className="h-5 w-5" /></button>
          {avatar && <img src={avatar} alt="" className="h-9 w-9 rounded-full object-cover" />}
          <div className="flex-1">
            <div className="font-display font-semibold">{peer?.display_name ?? "..."}</div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-2 px-4 py-6">
          {messages.length === 0 && (
            <div className="mt-20 text-center text-sm text-muted-foreground">
              Say hi. Break the ice.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.sender_id === me ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.sender_id === me ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                {m.body}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2 px-4 py-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="type something..."
          />
          <Button onClick={send} disabled={sending || !text.trim()} className="glow-ring">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
