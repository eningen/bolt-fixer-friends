ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS image_path text;

CREATE POLICY "post images are readable by authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'post-images');
CREATE POLICY "users upload own post images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users update own post images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "users delete own post images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);