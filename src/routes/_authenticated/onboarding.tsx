import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { INTERESTS } from "@/lib/interests";
import { generateKeyPair } from "@/lib/crypto";
import { savePrivateKey } from "@/lib/keystore";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: Onboarding,
});

const GENDERS = ["male", "female", "nonbinary", "other"] as const;
const PREFS = ["male", "female", "everyone"] as const;

function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [age, setAge] = useState<number>(18);
  const [gender, setGender] = useState<(typeof GENDERS)[number]>("other");
  const [pref, setPref] = useState<(typeof PREFS)[number]>("everyone");
  const [bio, setBio] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const toggleInterest = (i: string) => {
    setInterests((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]));
  };

  const onFile = (f: File) => {
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!avatarFile) { toast.error("PFP is required"); return; }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;

      // Upload avatar
      const ext = avatarFile.name.split(".").pop() || "jpg";
      const path = `${uid}/avatar.${ext}`;
      const up = await supabase.storage.from("avatars").upload(path, avatarFile, { upsert: true });
      if (up.error) throw up.error;
      const { data: signed } = await supabase.storage.from("avatars").createSignedUrl(path, 60 * 60 * 24 * 365);
      const avatar_url = signed?.signedUrl ?? null;

      // Generate keypair, save private locally
      const { publicJwk, privateJwk } = await generateKeyPair();
      await savePrivateKey(uid, privateJwk);

      const { error } = await supabase.from("profiles").update({
        display_name: name,
        age,
        gender,
        preferred_gender: pref,
        bio,
        interests,
        avatar_url,
        public_key: publicJwk as never,
        onboarded: true,
      }).eq("id", uid);
      if (error) throw error;

      toast.success("Welcome to BuzzMe 🚀");
      navigate({ to: "/discover" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const canNext = [
    () => name.trim().length > 0 && age >= 13,
    () => true,
    () => interests.length >= 3,
    () => !!avatarFile,
  ][step];

  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-6 flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        <div className="rounded-3xl border border-border p-6" style={{ background: "var(--gradient-card)" }}>
          {step === 0 && (
            <>
              <h2 className="font-display text-2xl font-bold">Who's this?</h2>
              <p className="mt-1 text-sm text-muted-foreground">The basics. 15 seconds.</p>
              <div className="mt-6 space-y-4">
                <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Shanaya" /></div>
                <div><Label>Age</Label><Input type="number" min={13} max={100} value={age} onChange={(e) => setAge(Number(e.target.value))} /></div>
                <div>
                  <Label>You are</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {GENDERS.map((g) => (
                      <button key={g} type="button" onClick={() => setGender(g)}
                        className={`rounded-full px-4 py-2 text-sm capitalize border ${gender === g ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>{g}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Wanna talk to</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PREFS.map((p) => (
                      <button key={p} type="button" onClick={() => setPref(p)}
                        className={`rounded-full px-4 py-2 text-sm capitalize border ${pref === p ? "bg-accent text-accent-foreground border-accent" : "border-border"}`}>{p}</button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="font-display text-2xl font-bold">Say something.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Optional bio. Keep it unhinged.</p>
              <Textarea className="mt-6 min-h-32" value={bio} onChange={(e) => setBio(e.target.value)} placeholder="professional overthinker. matcha slut. will argue about anime." />
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-2xl font-bold">Vibes.</h2>
              <p className="mt-1 text-sm text-muted-foreground">Pick 3+ interests. Powers the matching.</p>
              <div className="mt-6 flex flex-wrap gap-2">
                {INTERESTS.map((i) => (
                  <button key={i} type="button" onClick={() => toggleInterest(i)}
                    className={`rounded-full px-3 py-1.5 text-xs border transition ${interests.includes(i) ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/40"}`}>{i}</button>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{interests.length} selected · min 3</p>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-display text-2xl font-bold">Face reveal.</h2>
              <p className="mt-1 text-sm text-muted-foreground">One photo. Required.</p>
              <div className="mt-6 flex flex-col items-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="preview" className="h-40 w-40 rounded-full object-cover glow-ring" />
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-full border border-dashed border-border">
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
                <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()}>
                  {avatarFile ? "Change photo" : "Upload PFP"}
                </Button>
              </div>
            </>
          )}

          <div className="mt-8 flex gap-2">
            {step > 0 && <Button variant="outline" onClick={() => setStep(step - 1)}>Back</Button>}
            {step < 3 ? (
              <Button onClick={() => setStep(step + 1)} disabled={!canNext} className="ml-auto glow-ring">Next</Button>
            ) : (
              <Button onClick={submit} disabled={!canNext || saving} className="ml-auto glow-ring">
                {saving ? "Setting up..." : "Enter BuzzMe"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
