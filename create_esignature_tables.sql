-- E-Signature Tables Migration
-- Creates all necessary tables for comprehensive e-signature functionality

-- =====================================================
-- 1. DOCUMENT SIGNERS TABLE
-- Tracks all signers for a document (MUST BE CREATED FIRST)
-- =====================================================
CREATE TABLE IF NOT EXISTS document_signers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_name TEXT NOT NULL,
  signer_email TEXT NOT NULL,
  signing_order INTEGER NOT NULL DEFAULT 1, -- For sequential workflows
  signing_link TEXT UNIQUE NOT NULL, -- Unique secure link for this signer
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'viewed', 'signed', 'declined')),
  viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  consent_given BOOLEAN DEFAULT false,
  consent_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_signers_document_id ON document_signers(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signers_signing_link ON document_signers(signing_link);
CREATE INDEX IF NOT EXISTS idx_document_signers_status ON document_signers(status);

-- =====================================================
-- 2. SIGNATURE FIELDS TABLE
-- Stores draggable field definitions for documents
-- =====================================================
CREATE TABLE IF NOT EXISTS signature_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  field_type TEXT NOT NULL CHECK (field_type IN ('signature', 'initials', 'text', 'date', 'checkbox')),
  field_label TEXT,
  page_number INTEGER NOT NULL DEFAULT 1,
  position_x DECIMAL NOT NULL, -- X coordinate as percentage (0-100)
  position_y DECIMAL NOT NULL, -- Y coordinate as percentage (0-100)
  width DECIMAL NOT NULL DEFAULT 150, -- Width in pixels
  height DECIMAL NOT NULL DEFAULT 50, -- Height in pixels
  assigned_signer_id UUID REFERENCES document_signers(id) ON DELETE CASCADE,
  is_required BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_fields_document_id ON signature_fields(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_fields_signer_id ON signature_fields(assigned_signer_id);

-- =====================================================
-- 3. SIGNATURE RECORDS TABLE
-- Stores actual signature data for each field
-- =====================================================
CREATE TABLE IF NOT EXISTS signature_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_field_id UUID NOT NULL REFERENCES signature_fields(id) ON DELETE CASCADE,
  signer_id UUID NOT NULL REFERENCES document_signers(id) ON DELETE CASCADE,
  signature_data TEXT NOT NULL, -- Base64 encoded signature image or text value
  signature_type TEXT NOT NULL CHECK (signature_type IN ('drawn', 'typed', 'uploaded', 'value')),
  signed_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_signature_records_field_id ON signature_records(signature_field_id);
CREATE INDEX IF NOT EXISTS idx_signature_records_signer_id ON signature_records(signer_id);

-- =====================================================
-- 4. SIGNATURE AUDIT LOG TABLE
-- Complete audit trail for legal compliance
-- =====================================================
CREATE TABLE IF NOT EXISTS signature_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  signer_id UUID REFERENCES document_signers(id) ON DELETE SET NULL,
  action TEXT NOT NULL CHECK (action IN ('document_created', 'document_sent', 'document_viewed', 'field_filled', 'document_signed', 'document_completed', 'consent_given', 'signer_added', 'signer_removed', 'signature_declined')),
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB, -- Additional context data
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_signature_audit_log_document_id ON signature_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_log_signer_id ON signature_audit_log(signer_id);
CREATE INDEX IF NOT EXISTS idx_signature_audit_log_created_at ON signature_audit_log(created_at);

-- =====================================================
-- 5. UPDATE DOCUMENTS TABLE
-- Add e-signature related fields
-- =====================================================
ALTER TABLE documents 
  ADD COLUMN IF NOT EXISTS requires_signature BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signature_workflow_type TEXT DEFAULT 'sequential' CHECK (signature_workflow_type IN ('sequential', 'parallel')),
  ADD COLUMN IF NOT EXISTS all_signed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signature_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_certificate_path TEXT; -- Path to completion certificate

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE signature_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_signers ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE signature_audit_log ENABLE ROW LEVEL SECURITY;

-- Signature Fields Policies
DROP POLICY IF EXISTS "Users can view fields for own documents" ON signature_fields;
CREATE POLICY "Users can view fields for own documents" 
ON signature_fields FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = signature_fields.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Signers can view their assigned fields" ON signature_fields;
CREATE POLICY "Signers can view their assigned fields" 
ON signature_fields FOR SELECT 
USING (true); -- Public access for viewing via signing link

DROP POLICY IF EXISTS "Users can insert fields for own documents" ON signature_fields;
CREATE POLICY "Users can insert fields for own documents" 
ON signature_fields FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = signature_fields.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can update fields for own documents" ON signature_fields;
CREATE POLICY "Users can update fields for own documents" 
ON signature_fields FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = signature_fields.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can delete fields for own documents" ON signature_fields;
CREATE POLICY "Users can delete fields for own documents" 
ON signature_fields FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = signature_fields.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

-- Document Signers Policies
DROP POLICY IF EXISTS "Public can view signers" ON document_signers;
CREATE POLICY "Public can view signers" 
ON document_signers FOR SELECT 
USING (true);

DROP POLICY IF EXISTS "Users can insert signers for own documents" ON document_signers;
CREATE POLICY "Users can insert signers for own documents" 
ON document_signers FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = document_signers.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

DROP POLICY IF EXISTS "Users can update signers" ON document_signers;
CREATE POLICY "Users can update signers" 
ON document_signers FOR UPDATE 
USING (true); -- Allow updates for signature submission

DROP POLICY IF EXISTS "Users can delete signers for own documents" ON document_signers;
CREATE POLICY "Users can delete signers for own documents" 
ON document_signers FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = document_signers.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

-- Signature Records Policies
DROP POLICY IF EXISTS "Public can insert signatures" ON signature_records;
CREATE POLICY "Public can insert signatures" 
ON signature_records FOR INSERT 
WITH CHECK (true); -- Allow signers to submit signatures

DROP POLICY IF EXISTS "Users can view signatures for own documents" ON signature_records;
CREATE POLICY "Users can view signatures for own documents" 
ON signature_records FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM signature_fields sf
    JOIN documents d ON d.id = sf.document_id
    WHERE sf.id = signature_records.signature_field_id 
    AND (d.user_id = auth.uid() OR d.user_id IS NULL)
  )
);

-- Audit Log Policies
DROP POLICY IF EXISTS "Public can insert audit logs" ON signature_audit_log;
CREATE POLICY "Public can insert audit logs" 
ON signature_audit_log FOR INSERT 
WITH CHECK (true);

DROP POLICY IF EXISTS "Users can view audit logs for own documents" ON signature_audit_log;
CREATE POLICY "Users can view audit logs for own documents" 
ON signature_audit_log FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM documents 
    WHERE documents.id = signature_audit_log.document_id 
    AND (documents.user_id = auth.uid() OR documents.user_id IS NULL)
  )
);

-- =====================================================
-- 7. HELPER VIEWS FOR ANALYTICS
-- =====================================================

-- View to get signature completion status for documents
CREATE OR REPLACE VIEW signature_completion_stats AS
SELECT 
  d.id AS document_id,
  d.user_id,
  d.requires_signature,
  d.signature_workflow_type,
  d.all_signed,
  COUNT(ds.id) AS total_signers,
  COUNT(CASE WHEN ds.status = 'signed' THEN 1 END) AS signed_count,
  COUNT(CASE WHEN ds.status = 'pending' THEN 1 END) AS pending_count,
  COUNT(CASE WHEN ds.status = 'viewed' THEN 1 END) AS viewed_count,
  MIN(ds.signed_at) AS first_signature_at,
  MAX(ds.signed_at) AS last_signature_at
FROM documents d
LEFT JOIN document_signers ds ON d.id = ds.document_id
WHERE d.requires_signature = true
GROUP BY d.id, d.user_id, d.requires_signature, d.signature_workflow_type, d.all_signed;

-- Grant access to views
GRANT SELECT ON signature_completion_stats TO authenticated;
GRANT SELECT ON signature_completion_stats TO anon;

-- =====================================================
-- 8. TRIGGERS FOR AUTOMATED ACTIONS
-- =====================================================

-- Function to check and update document completion status
CREATE OR REPLACE FUNCTION check_signature_completion()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if all signers have signed
  IF (SELECT COUNT(*) FROM document_signers 
      WHERE document_id = NEW.document_id AND status != 'signed') = 0 THEN
    
    -- Update document as fully signed
    UPDATE documents 
    SET all_signed = true,
        signature_completed_at = NOW()
    WHERE id = NEW.document_id;
    
    -- Log completion event
    INSERT INTO signature_audit_log (document_id, action, description)
    VALUES (NEW.document_id, 'document_completed', 'All signers have completed signing');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update completion status
DROP TRIGGER IF EXISTS trigger_check_signature_completion ON document_signers;
CREATE TRIGGER trigger_check_signature_completion
AFTER UPDATE OF status ON document_signers
FOR EACH ROW
WHEN (NEW.status = 'signed')
EXECUTE FUNCTION check_signature_completion();

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
