import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Info, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { INTERESTS } from "@/lib/interests";
import { uploadToCloudinary } from "@/lib/cloudinary";

export const Route = createFileRoute("/_authenticated/profile/edit")({
  component: EditProfile,
});

const GENDERS = ["male", "female", "nonbinary", "other"] as const;
const PREFS = ["male", "female", "everyone"] as const;

function EditProfile() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState(18);
  const [height, setHeight] = useState<number | "">("");
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("other");
  const [pref, setPref] = useState<(typeof PREFS)[number]>("everyone");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user!.id).maybeSingle();
      if (data) {
        setName(data.display_name);
        setAge(data.age);
        setHeight(data.height_cm ?? "");
        setGender(data.gender as (typeof GENDERS)[number]);
        setPref(data.preferred_gender as (typeof PREFS)[number]);
        setBio(data.bio ?? "");
        setInterests(data.interests ?? []);
        const existing = (data.photos as string[] | null) ?? [];
        const seed = existing.length ? existing : data.avatar_url ? [data.avatar_url] : [];
        setPhotos(seed);
      }
      setLoading(false);
    })();
  }, []);

  const toggleInterest = (i: string) => {
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  };

  const uploadAt = async (slot: number, file: File) => {
    if (file.size > 8 * 1024 * 1024) { toast.error("Max 8MB"); return; }
    setUploadingSlot(slot);
    try {
      const url = await uploadToCloudinary(file);
      setPhotos((prev) => {
        const next = [...prev];
        next[slot] = url;
        return next.filter(Boolean).slice(0, 3);
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingSlot(null);
    }
  };

  const removePhoto = (slot: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== slot));
  };

  const save = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    if (interests.length < 3) { toast.error("Pick at least 3 interests"); return; }
    if (photos.length === 0) { toast.error("At least one photo required"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update({
        display_name: name.trim(),
        age,
        height_cm: height === "" ? null : Number(height),
        gender,
        preferred_gender: pref,
        bio: bio.trim(),
        interests,
        photos,
        avatar_url: photos[0] ?? null,
      }).eq("id", u.user!.id);
      if (error) throw error;
      toast.success("Saved");
      navigate({ to: "/profile" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button onClick={() => navigate({ to: "/profile" })} className="flex items-center gap-2 text-sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <Button onClick={save} disabled={saving} className="glow-ring">
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6">
        {/* Photos */}
        <section className="rounded-3xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
          <h2 className="font-display text-lg font-bold">Photos</h2>
          <p className="mt-1 text-xs text-muted-foreground">Up to 3. First one is your main.</p>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[0, 1, 2].map((slot) => {
              const src = photos[slot];
              return (
                <div key={slot} className="relative aspect-square overflow-hidden rounded-2xl border border-border bg-muted">
                  {src ? (
                    <>
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => removePhoto(slot)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => fileRefs[slot].current?.click()}
                      disabled={uploadingSlot !== null}
                      className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground transition hover:text-primary disabled:opacity-50"
                    >
                      {uploadingSlot === slot ? (
                        <span>Uploading...</span>
                      ) : (
                        <><Plus className="h-5 w-5" />Add</>
                      )}
                    </button>
                  )}
                  <input
                    ref={fileRefs[slot]}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && uploadAt(slot, e.target.files[0])}
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Basics */}
        <section className="space-y-4 rounded-3xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
          <h2 className="font-display text-lg font-bold">Basics</h2>
          <div><Label>Display name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Age</Label><Input type="number" min={13} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} /></div>
            <div><Label>Height (cm)</Label><Input type="number" min={100} max={250} value={height} onChange={(e) => setHeight(e.target.value === "" ? "" : Number(e.target.value))} placeholder="170" /></div>
          </div>
          <div>
            <Label>Gender</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <button key={g} onClick={() => setGender(g)} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${gender === g ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{g}</button>
              ))}
            </div>
          </div>
          <div>
            <Label>Interested in</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {PREFS.map((p) => (
                <button key={p} onClick={() => setPref(p)} className={`rounded-full border px-4 py-1.5 text-sm capitalize ${pref === p ? "bg-accent text-accent-foreground border-accent" : "border-border"}`}>{p}</button>
              ))}
            </div>
          </div>
          <div><Label>Bio</Label><Textarea value={bio} onChange={(e) => setBio(e.target.value)} className="min-h-24" /></div>
        </section>

        {/* Interests */}
        <section className="rounded-3xl border border-border p-5" style={{ background: "var(--gradient-card)" }}>
          <h2 className="font-display text-lg font-bold">Vibes</h2>
          <p className="mt-1 text-xs text-muted-foreground">{interests.length} selected · min 3</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {INTERESTS.map((i) => (
              <button key={i} onClick={() => toggleInterest(i)} className={`rounded-full border px-3 py-1.5 text-xs transition ${interests.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>{i}</button>
            ))}
          </div>
        </section>

        {/* Google branding note */}
        <section className="flex gap-3 rounded-2xl border border-border p-4 text-xs text-muted-foreground" style={{ background: "var(--gradient-card)" }}>
          <Info className="h-4 w-4 shrink-0 text-primary" />
          <p>
            Want to remove the "lovable.app" name from Google's sign-in screen? Set up your own Google OAuth Client ID/Secret and paste them into Cloud → Auth Settings → Google. No code changes needed.
          </p>
        </section>
      </main>
    </div>
  );
}
