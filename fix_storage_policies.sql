-- =====================================================
-- FIX STORAGE POLICIES
-- Run this in Supabase SQL Editor to fix 403 Errors
-- =====================================================

-- 1. Create the 'documents' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO UPDATE
SET public = true; -- FORCE PUBLIC for guest uploads

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Allow Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Deletes" ON storage.objects;
DROP POLICY IF EXISTS "Allow Document Uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow Authenticated Downloads" ON storage.objects;

-- 3. Create Permissive Policies (Guest Mode)

-- Allow ANYONE to upload files to 'documents' bucket
CREATE POLICY "Allow Public Uploads"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'documents' );

-- Allow ANYONE to view/download files (since bucket is public)
CREATE POLICY "Allow Public Downloads"
ON storage.objects FOR SELECT
USING ( bucket_id = 'documents' );

-- Allow ANYONE to delete (Optional - maybe restrict this in production)
-- Useful for development so you can clear bad uploads
CREATE POLICY "Allow Public Deletes"
ON storage.objects FOR DELETE
USING ( bucket_id = 'documents' );

-- 4. Verify Setup
DO $$
BEGIN
    RAISE NOTICE 'Storage policies fixed! Bucket "documents" is now PUBLIC.';
END $$;
