
-- Restrict authenticated read access to sensitive profile columns
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, display_name, age, gender, preferred_gender, bio, interests, avatar_url, photos, height_cm, onboarded, created_at, updated_at) ON public.profiles TO authenticated;

-- Restrict avatar reads to the owner's own folder
DROP POLICY IF EXISTS "Authenticated read avatars" ON storage.objects;
CREATE POLICY "Users read their own avatars"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
