import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Lock, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg" style={{ background: "var(--gradient-hero)" }} />
          <span className="font-display text-xl font-bold">BuzzMe</span>
        </div>
        <Link to="/auth" className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          Get in
        </Link>
      </header>

      {/* hero */}
      <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-32 text-center">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-20 mx-auto h-[500px] max-w-3xl rounded-full opacity-30 blur-3xl"
          style={{ background: "var(--gradient-hero)" }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            E2EE · Ephemeral · $0 forever
          </span>
          <h1 className="mt-6 font-display text-6xl font-bold leading-[0.95] tracking-tight md:text-8xl">
            text-first<br /><span className="gradient-text">vibe check.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base text-muted-foreground md:text-lg">
            Interest-matched conversations for Indian Gen-Z. No calls, no cringe. Just messages that disappear.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/auth" className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-ring">
              Start buzzing
            </Link>
            <a href="#how" className="rounded-full border border-border px-6 py-3 text-sm font-semibold">How it works</a>
          </div>
        </div>
      </section>

      {/* pillars */}
      <section id="how" className="mx-auto grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {[
          { icon: Zap, title: "70/30 discovery", body: "Mostly people who match your interests, sprinkled with wildcards to break the algorithm." },
          { icon: Lock, title: "End-to-end encrypted", body: "Messages are encrypted on your device. The server only sees ciphertext." },
          { icon: Sparkles, title: "Zero server chat logs", body: "Messages ride through realtime channels and never touch the database." },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-2xl border border-border p-6" style={{ background: "var(--gradient-card)" }}>
            <Icon className="h-6 w-6 text-primary" />
            <h3 className="mt-4 font-display text-lg font-semibold">{title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        BuzzMe · Made with chaos for Gen-Z
      </footer>
    </div>
  );
}
