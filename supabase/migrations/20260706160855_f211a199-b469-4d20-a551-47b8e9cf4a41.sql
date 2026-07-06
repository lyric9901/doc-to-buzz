-- Add profile fields
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS height_cm integer,
  ADD COLUMN IF NOT EXISTS photos text[] NOT NULL DEFAULT '{}'::text[];

-- Likes
CREATE TABLE IF NOT EXISTS public.likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  likee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(liker_id, likee_id),
  CHECK (liker_id <> likee_id)
);
GRANT SELECT, INSERT, DELETE ON public.likes TO authenticated;
GRANT ALL ON public.likes TO service_role;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read likes involving me" ON public.likes FOR SELECT TO authenticated
  USING (auth.uid() = liker_id OR auth.uid() = likee_id);
CREATE POLICY "insert own likes" ON public.likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = liker_id);
CREATE POLICY "delete own likes" ON public.likes FOR DELETE TO authenticated
  USING (auth.uid() = liker_id);

-- Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_id <> recipient_id),
  CHECK (char_length(body) BETWEEN 1 AND 2000)
);
CREATE INDEX IF NOT EXISTS messages_pair_idx ON public.messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages (recipient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own messages" ON public.messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "send messages" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "mark read" ON public.messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_id) WITH CHECK (auth.uid() = recipient_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('buzz','match','message')),
  entity_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own notifications" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "update own notifications" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete own notifications" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger: on new like, create buzz + maybe match notifications
CREATE OR REPLACE FUNCTION public.on_like_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE reciprocal_exists boolean;
BEGIN
  -- Always notify the person who was liked
  INSERT INTO public.notifications (user_id, actor_id, type, entity_id)
  VALUES (NEW.likee_id, NEW.liker_id, 'buzz', NEW.id);

  -- Check reciprocal like -> match
  SELECT EXISTS(SELECT 1 FROM public.likes WHERE liker_id = NEW.likee_id AND likee_id = NEW.liker_id)
    INTO reciprocal_exists;

  IF reciprocal_exists THEN
    INSERT INTO public.notifications (user_id, actor_id, type, entity_id) VALUES
      (NEW.liker_id, NEW.likee_id, 'match', NEW.id),
      (NEW.likee_id, NEW.liker_id, 'match', NEW.id);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_on_like_created ON public.likes;
CREATE TRIGGER trg_on_like_created AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION public.on_like_created();

-- Trigger: on new message, create notification for recipient
CREATE OR REPLACE FUNCTION public.on_message_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, actor_id, type, entity_id)
  VALUES (NEW.recipient_id, NEW.sender_id, 'message', NEW.id);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_on_message_created ON public.messages;
CREATE TRIGGER trg_on_message_created AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.on_message_created();
