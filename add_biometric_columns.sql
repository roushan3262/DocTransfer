-- Add security requirements to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS require_biometric BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS require_snapshot BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS biometric_credential_id TEXT;

-- Add verification results to access sessions
ALTER TABLE document_access_sessions
ADD COLUMN IF NOT EXISTS verified_biometric BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS snapshot_url TEXT;

-- Comment for clarity
COMMENT ON COLUMN documents.require_biometric IS 'If true, requires WebAuthn verification before access';
COMMENT ON COLUMN documents.require_snapshot IS 'If true, requires webcam snapshot before access';
COMMENT ON COLUMN documents.biometric_credential_id IS 'WebAuthn credential ID registered during upload for biometric verification';
