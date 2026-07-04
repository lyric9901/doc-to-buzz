import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { encryptFor, decryptWith, type EncryptedPayload } from "@/lib/crypto";
import { loadPrivateKey } from "@/lib/keystore";
import type { RealtimeChannel } from "@supabase/supabase-js";

export const Route = createFileRoute("/_authenticated/chat/$peerId")({
  component: Chat,
});

interface Peer {
  id: string;
  display_name: string;
  avatar_url: string | null;
  public_key: JsonWebKey | null;
}
interface Msg { id: string; from: string; text: string; ts: number; }

function channelId(a: string, b: string) {
  return `dm:${[a, b].sort().join(":")}`;
}

function Chat() {
  const { peerId } = Route.useParams();
  const navigate = useNavigate();
  const [me, setMe] = useState<string | null>(null);
  const [privKey, setPrivKey] = useState<JsonWebKey | null>(null);
  const [peer, setPeer] = useState<Peer | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      setMe(uid);
      const key = await loadPrivateKey(uid);
      if (!key) {
        toast.error("Encryption key missing on this device. Re-onboard to regenerate.");
        navigate({ to: "/discover" });
        return;
      }
      setPrivKey(key);
      const { data: p } = await supabase.from("profiles").select("id,display_name,avatar_url,public_key").eq("id", peerId).maybeSingle();
      if (!p) { toast.error("User not found"); navigate({ to: "/discover" }); return; }
      setPeer(p as Peer);
    })();
  }, [peerId, navigate]);

  useEffect(() => {
    if (!me || !privKey) return;
    const ch = supabase.channel(channelId(me, peerId), { config: { broadcast: { self: false } } });
    ch.on("broadcast", { event: "msg" }, async (payload) => {
      const { from, payload: enc, ts, id } = payload.payload as { from: string; payload: EncryptedPayload; ts: number; id: string };
      try {
        const text = await decryptWith(privKey, enc);
        setMessages((m) => [...m, { id, from, text, ts }]);
      } catch {
        setMessages((m) => [...m, { id, from, text: "[unable to decrypt]", ts }]);
      }
    });
    ch.subscribe();
    chanRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [me, peerId, privKey]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!text.trim() || !peer?.public_key || !me || !chanRef.current) return;
    setSending(true);
    try {
      const plaintext = text.trim();
      const enc = await encryptFor(peer.public_key, plaintext);
      const id = crypto.randomUUID();
      const ts = Date.now();
      await chanRef.current.send({ type: "broadcast", event: "msg", payload: { from: me, payload: enc, ts, id } });
      setMessages((m) => [...m, { id, from: me, text: plaintext, ts }]);
      setText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link to="/discover"><ArrowLeft className="h-5 w-5" /></Link>
          {peer?.avatar_url && <img src={peer.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />}
          <div className="flex-1">
            <div className="font-display font-semibold">{peer?.display_name ?? "..."}</div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3 text-primary" /> end-to-end encrypted · ephemeral
            </div>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-4 py-6 space-y-3">
          {messages.length === 0 && (
            <div className="mt-20 text-center text-sm text-muted-foreground">
              Say something unhinged. Messages disappear on refresh.
            </div>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.from === me ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.from === me ? "bg-primary text-primary-foreground" : "bg-card border border-border"}`}>
                {m.text}
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
            disabled={!peer?.public_key}
          />
          <Button onClick={send} disabled={sending || !text.trim() || !peer?.public_key} className="glow-ring">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {peer && !peer.public_key && (
          <p className="pb-2 text-center text-[10px] text-muted-foreground">This user hasn't set up encryption yet.</p>
        )}
      </div>
    </div>
  );
}
