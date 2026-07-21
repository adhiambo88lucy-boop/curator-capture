
CREATE POLICY "auth read product-media" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'product-media');
CREATE POLICY "auth insert product-media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-media');
CREATE POLICY "auth update product-media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-media');
CREATE POLICY "auth delete product-media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-media');
