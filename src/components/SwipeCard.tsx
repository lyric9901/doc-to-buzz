import { useState, useRef, type PointerEvent } from "react";
import { Heart, X as XIcon, MapPin } from "lucide-react";

export interface SwipeProfile {
  id: string;
  display_name: string;
  age: number;
  bio: string | null;
  interests: string[];
  photos: string[];
  avatar_url: string | null;
  height_cm: number | null;
}

interface Props {
  profile: SwipeProfile;
  sharedInterests: string[];
  onSwipe: (dir: "left" | "right") => void;
  active: boolean;
  stackIndex: number;
}

export function SwipeCard({ profile, sharedInterests, onSwipe, active, stackIndex }: Props) {
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const [photoIdx, setPhotoIdx] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const photos = profile.photos.length > 0 ? profile.photos : profile.avatar_url ? [profile.avatar_url] : [];

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (!active) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    setDrag({ x: 0, y: 0 });
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!startRef.current) return;
    setDrag({ x: e.clientX - startRef.current.x, y: e.clientY - startRef.current.y });
  };
  const onPointerUp = () => {
    if (!drag) return;
    const threshold = 110;
    if (drag.x > threshold) fly("right");
    else if (drag.x < -threshold) fly("left");
    else setDrag(null);
    startRef.current = null;
  };
  const fly = (dir: "left" | "right") => {
    setLeaving(dir);
    setTimeout(() => onSwipe(dir), 250);
  };

  const dx = drag?.x ?? 0;
  const dy = drag?.y ?? 0;
  const rot = dx / 20;
  const leavingX = leaving === "right" ? 800 : leaving === "left" ? -800 : dx;
  const opacity = leaving ? 0 : 1;

  const likeStamp = Math.min(1, Math.max(0, dx / 120));
  const passStamp = Math.min(1, Math.max(0, -dx / 120));

  const tapPhoto = (e: React.MouseEvent) => {
    if (!active || Math.abs(dx) > 10 || photos.length < 2) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isRight = e.clientX - rect.left > rect.width / 2;
    setPhotoIdx((i) => Math.max(0, Math.min(photos.length - 1, i + (isRight ? 1 : -1))));
  };

  return (
    <div
      className="absolute inset-0 touch-none select-none"
      style={{
        transform: leaving
          ? `translate(${leavingX}px, ${dy}px) rotate(${leaving === "right" ? 25 : -25}deg)`
          : `translate(${dx}px, ${dy}px) rotate(${rot}deg) scale(${1 - stackIndex * 0.04}) translateY(${stackIndex * 8}px)`,
        transition: drag && !leaving ? "none" : "transform 250ms ease-out, opacity 250ms",
        opacity,
        zIndex: 10 - stackIndex,
        pointerEvents: active ? "auto" : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-3xl border border-border shadow-2xl"
        style={{ background: "var(--gradient-card)" }}
        onClick={tapPhoto}
      >
        {/* photo */}
        <div className="absolute inset-0">
          {photos[photoIdx] ? (
            <img src={photos[photoIdx]} alt={profile.display_name} className="h-full w-full object-cover" draggable={false} />
          ) : (
            <div className="h-full w-full" style={{ background: "var(--gradient-hero)", opacity: 0.5 }} />
          )}
          <div className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black via-black/70 to-transparent" />
        </div>

        {/* photo pagination */}
        {photos.length > 1 && (
          <div className="absolute inset-x-3 top-3 flex gap-1">
            {photos.map((_, idx) => (
              <div key={idx} className={`h-1 flex-1 rounded-full ${idx === photoIdx ? "bg-white" : "bg-white/30"}`} />
            ))}
          </div>
        )}

        {/* like/pass stamps */}
        <div
          className="absolute left-6 top-8 rounded-lg border-4 border-primary px-3 py-1 font-display text-2xl font-bold text-primary"
          style={{ opacity: likeStamp, transform: `rotate(-15deg) scale(${0.8 + likeStamp * 0.3})` }}
        >
          BUZZ
        </div>
        <div
          className="absolute right-6 top-8 rounded-lg border-4 border-destructive px-3 py-1 font-display text-2xl font-bold text-destructive"
          style={{ opacity: passStamp, transform: `rotate(15deg) scale(${0.8 + passStamp * 0.3})` }}
        >
          NOPE
        </div>

        {/* content */}
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <div className="flex items-baseline gap-2">
            <h2 className="font-display text-3xl font-bold">{profile.display_name}</h2>
            <span className="font-display text-2xl">{profile.age}</span>
          </div>
          {profile.height_cm && (
            <div className="mt-1 flex items-center gap-1 text-xs text-white/70">
              <MapPin className="h-3 w-3" /> {profile.height_cm} cm
            </div>
          )}
          {profile.bio && <p className="mt-2 line-clamp-2 text-sm text-white/85">{profile.bio}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(profile.interests ?? []).slice(0, 4).map((i) => (
              <span
                key={i}
                className={`rounded-full px-2 py-0.5 text-[10px] backdrop-blur ${
                  sharedInterests.includes(i)
                    ? "bg-primary/80 text-primary-foreground"
                    : "bg-white/15 text-white"
                }`}
              >
                {i}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* action buttons under card */}
      {active && (
        <div className="pointer-events-none absolute -bottom-20 left-0 right-0 flex justify-center gap-6">
          <button
            onClick={(e) => { e.stopPropagation(); fly("left"); }}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card shadow-lg transition hover:scale-110 hover:border-destructive/60"
          >
            <XIcon className="h-6 w-6 text-destructive" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); fly("right"); }}
            className="pointer-events-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary shadow-lg glow-ring transition hover:scale-110"
          >
            <Heart className="h-6 w-6 fill-primary-foreground text-primary-foreground" />
          </button>
        </div>
      )}
    </div>
  );
}
