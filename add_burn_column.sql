-- Add burn_after_reading column to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS burn_after_reading BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN documents.burn_after_reading IS 'If true, document is deleted after first view/download';
