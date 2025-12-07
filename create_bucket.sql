-- 1. Membuat Bucket 'transaction-proofs'
INSERT INTO storage.buckets (id, name, public)
VALUES ('transaction-proofs', 'transaction-proofs', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Mengizinkan akses LIHAT (SELECT) untuk publik
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'transaction-proofs' );

-- 3. Mengizinkan akses UPLOAD (INSERT) untuk semua orang (termasuk anonim)
CREATE POLICY "Allow Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'transaction-proofs' );

-- 4. Mengizinkan akses UPDATE untuk semua orang
CREATE POLICY "Allow Updates"
ON storage.objects FOR UPDATE
WITH CHECK ( bucket_id = 'transaction-proofs' );

-- 5. Mengizinkan akses HAPUS (DELETE) untuk semua orang
CREATE POLICY "Allow Deletes"
ON storage.objects FOR DELETE
USING ( bucket_id = 'transaction-proofs' );
