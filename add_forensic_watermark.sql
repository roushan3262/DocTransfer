-- Add forensic_watermarking column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS forensic_watermarking BOOLEAN DEFAULT FALSE;

-- Notify completion
DO $$
BEGIN
    RAISE NOTICE 'Added forensic_watermarking column to documents table';
END $$;
