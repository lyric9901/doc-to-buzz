## What you'll get

- **Home** — Tinder-style swipe deck (left = pass, right = "buzz"). Drag or use buttons.
- **Chats** — list of conversations with unread badges; tap to open thread.
- **Notifications** — new buzzes received, new matches (mutual buzz), new messages.
- **Profile** — your bio/photos/interests, plus a Settings button to edit everything (display name, age, height, gender, preferred gender, bio, interests, up to 3 photos). Tap any photo to open a full-screen viewer.
- **Bottom nav** — Home · Chats · Notifications · Profile (fixed, thumb-reach).

## Data model changes

New/updated tables (all RLS-protected, scoped to `auth.uid()`):

- `profiles` — add `height_cm int`, `photos text[]` (up to 3 URLs). Keep `avatar_url` synced to `photos[0]`.
- `likes` — `liker_id`, `likee_id`, `created_at`. Right-swipe inserts here. Unique pair.
- `messages` — `id`, `sender_id`, `recipient_id`, `body`, `created_at`, `read_at`. Realtime enabled.
- `notifications` — `id`, `user_id`, `type` (`buzz` | `match` | `message`), `actor_id`, `entity_id`, `read`, `created_at`. Trigger inserts a `buzz` notification when someone likes you, and a `match` on mutual like.

The old ephemeral E2EE chat and encrypted key columns are retired; the client-side crypto/keystore files stay for now but stop being used (no data loss, just dead code we can clean later).

## Photo uploads (Cloudinary, signed)

- API Secret stored server-side (never touches the client).
- New server function `signCloudinaryUpload` returns a signature per upload request. Client posts the file + signature directly to Cloudinary — nothing large hits our server.
- Profile stores up to 3 secure Cloudinary URLs.

## Swipe → chat flow

- Right-swipe → insert into `likes` + a `buzz` notification for the other user. If they already liked you, a `match` notification fires for both and a chat thread is unlocked.
- Left-swipe → hide locally (no server write; you'll just stop seeing them for the session).
- Any liked user can be messaged from Chats or Notifications.

## Files touched

- New: `src/routes/_authenticated/index.tsx` (swipe deck), `chats.tsx`, `notifications.tsx`, `profile.tsx`, `profile.edit.tsx`, `src/components/BottomNav.tsx`, `src/components/SwipeCard.tsx`, `src/components/PhotoViewer.tsx`, `src/lib/cloudinary.functions.ts`.
- Updated: `_authenticated/route.tsx` (mount bottom nav), `chat.$peerId.tsx` (rewrite to use `messages` table + realtime), remove `discover.tsx` (replaced by swipe home).
- Migration: schema + RLS + triggers as above.
- Secrets: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` stored securely.

## Google branding note

Removing "lovable.app" from the Google consent screen requires your own Google OAuth Client ID/Secret entered in Cloud → Auth Settings → Google. I'll show a one-time banner in Settings with the steps; no code change on our side.

## Out of scope for this pass

- Push notifications (in-app only for now).
- Match-required-to-chat gating (anyone in your Likes queue is chattable, per your earlier choice).
- Age/location filters beyond gender preference (already in place).