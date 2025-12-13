-- =====================================================
-- COMPLETE SUPABASE DATABASE SETUP FOR DOCTRANSFER
-- Run this entire script in your Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. CREATE DOCUMENTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size BIGINT,
    file_type TEXT,
    share_link TEXT UNIQUE,
    password TEXT,
    expires_at TIMESTAMPTZ,
    allow_download BOOLEAN DEFAULT TRUE,
    custom_domain TEXT,
    screenshot_protection BOOLEAN DEFAULT FALSE,
    email_verification BOOLEAN DEFAULT FALSE,
    apply_watermark BOOLEAN DEFAULT FALSE,
    request_signature BOOLEAN DEFAULT FALSE,
    allowed_email TEXT,
    user_id UUID
);

-- =====================================================
-- 2. ADD ENCRYPTION SUPPORT
-- =====================================================
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS encryption_key TEXT,
ADD COLUMN IF NOT EXISTS encryption_iv TEXT,
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS original_file_name TEXT,
ADD COLUMN IF NOT EXISTS original_file_type TEXT;

-- =====================================================
-- 3. E-SIGNATURE TABLES (Document Signers FIRST)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signing_order INTEGER NOT NULL DEFAULT 1,
  signing_link TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'declined')),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  consent_given BOOLEAN DEFAULT false,
  consent_given_at TIMESTAMPTZ,
  color TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signature_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('signature', 'initials', 'text', 'date', 'checkbox')),
  field_label TEXT,
  page_number INTEGER NOT NULL DEFAULT 1,
  position_x DECIMAL NOT NULL,
  position_y DECIMAL NOT NULL,
  width DECIMAL NOT NULL DEFAULT 150,
  height DECIMAL NOT NULL DEFAULT 50,
  assigned_signer_id UUID REFERENCES document_signers(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signature_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_field_id UUID NOT NULL REFERENCES signature_fields(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES document_signers(id) ON DELETE CASCADE,
  signature_data TEXT NOT NULL,
  signature_type TEXT NOT NULL CHECK (signature_type IN ('drawn', 'typed', 'uploaded', 'value')),
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES document_signers(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('document_created', 'document_sent', 'document_viewed', 'field_filled', 'document_signed', 'document_completed', 'consent_given', 'signer_added', 'signer_removed', 'signature_declined')),
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- 4. UPDATE DOCUMENTS TABLE FOR E-SIGNATURE
-- =====================================================
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signature_workflow_type TEXT DEFAULT 'sequential' CHECK (signature_workflow_type IN ('sequential', 'parallel')),
  ADD COLUMN IF NOT EXISTS all_signed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_certificate_path TEXT;

-- =====================================================
-- 5. CREATE INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_documents_encrypted ON documents(is_encrypted);
CREATE INDEX IF NOT EXISTS idx_documents_share_link ON documents(share_link);
CREATE INDEX IF NOT EXISTS idx_document_signers_document_id ON document_signers(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_signing_link ON document_signers(signing_link);
CREATE INDEX IF NOT EXISTS idx_document_signers_status ON document_signers(status);
CREATE INDEX IF NOT EXISTS idx_signature_fields_document_id ON signature_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_fields_signer_id ON signature_fields(assigned_signer_id);
CREATE INDEX IF NOT EXISTS idx_signature_records_field_id ON signature_records(signature_field_id);
CREATE INDEX IF NOT EXISTS idx_signature_records_signer_id ON signature_records(signer_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_log_document_id ON signature_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_log_signer_id ON signature_audit_log(signer_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_log_created_at ON signature_audit_log(created_at);

-- =====================================================
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Documents Policies (Public Access for Guest Mode)
DROP POLICY IF EXISTS "Public Read Access" ON documents;
CREATE POLICY "Public Read Access" ON documents FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow Anonymous Uploads" ON documents;
CREATE POLICY "Allow Anonymous Uploads" ON documents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow Updates" ON documents;
CREATE POLICY "Allow Updates" ON documents FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow Deletes" ON documents;
CREATE POLICY "Allow Deletes" ON documents FOR DELETE USING (true);

-- Signature Fields Policies
DROP POLICY IF EXISTS "Public can view fields" ON signature_fields;
CREATE POLICY "Public can view fields" ON signature_fields FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert fields" ON signature_fields;
CREATE POLICY "Public can insert fields" ON signature_fields FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update fields" ON signature_fields;
CREATE POLICY "Public can update fields" ON signature_fields FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can delete fields" ON signature_fields;
CREATE POLICY "Public can delete fields" ON signature_fields FOR DELETE USING (true);

-- Document Signers Policies
DROP POLICY IF EXISTS "Public can view signers" ON document_signers;
CREATE POLICY "Public can view signers" ON document_signers FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public can insert signers" ON document_signers;
CREATE POLICY "Public can insert signers" ON document_signers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can update signers" ON document_signers;
CREATE POLICY "Public can update signers" ON document_signers FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public can delete signers" ON document_signers;
CREATE POLICY "Public can delete signers" ON document_signers FOR DELETE USING (true);

-- Signature Records Policies
DROP POLICY IF EXISTS "Public can insert signatures" ON signature_records;
CREATE POLICY "Public can insert signatures" ON signature_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view signatures" ON signature_records;
CREATE POLICY "Public can view signatures" ON signature_records FOR SELECT USING (true);

-- Audit Log Policies
DROP POLICY IF EXISTS "Public can insert audit logs" ON signature_audit_log;
CREATE POLICY "Public can insert audit logs" ON signature_audit_log FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public can view audit logs" ON signature_audit_log;
CREATE POLICY "Public can view audit logs" ON signature_audit_log FOR SELECT USING (true);

-- =====================================================
-- 7. TRIGGER FOR AUTO-COMPLETION
-- =====================================================
CREATE OR REPLACE FUNCTION check_signature_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM document_signers 
      WHERE document_id = NEW.document_id AND status != 'signed') = 0 THEN
    
    UPDATE documents 
    SET all_signed = true,
        signature_completed_at = NOW()
    WHERE id = NEW.document_id;
    
    INSERT INTO signature_audit_log (document_id, action, description)
    VALUES (NEW.document_id, 'document_completed', 'All signers have completed signing');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_signature_completion ON document_signers;
CREATE TRIGGER trigger_check_signature_completion
AFTER UPDATE OF status ON document_signers
FOR EACH ROW
WHEN (NEW.status = 'signed')
EXECUTE FUNCTION check_signature_completion();

-- =====================================================
-- 8. COMPLETION MESSAGE
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'DocTransfer Database Setup Complete! ✓';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Create storage bucket: "documents" (public)';
    RAISE NOTICE '2. Add CORS: http://localhost:5173';
    RAISE NOTICE '3. Test file upload in your app';
    RAISE NOTICE '==========================================';
END $$;
