-- ============================================
-- Advanced Encryption Database Migration
-- ============================================
-- Adds support for client-side encryption with user-managed keys
-- and PGP/GPG encryption
-- ============================================

-- =====================================================
-- 1. UPDATE DOCUMENTS TABLE
-- Add encryption metadata columns
-- =====================================================
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS encryption_type VARCHAR(50) DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS encrypted_symmetric_key TEXT,
ADD COLUMN IF NOT EXISTS encryption_iv BYTEA,
ADD COLUMN IF NOT EXISTS pgp_signature TEXT,
ADD COLUMN IF NOT EXISTS key_fingerprint VARCHAR(40);

-- Create index for key fingerprint lookups
CREATE INDEX IF NOT EXISTS idx_documents_key_fingerprint ON documents(key_fingerprint);
CREATE INDEX IF NOT EXISTS idx_documents_encryption_type ON documents(encryption_type);

COMMENT ON COLUMN documents.encryption_type IS 'Encryption method: basic (server), advanced (client RSA+AES), pgp (OpenPGP)';
COMMENT ON COLUMN documents.encrypted_symmetric_key IS 'AES-256 key encrypted with user RSA public key (base64)';
COMMENT ON COLUMN documents.encryption_iv IS 'Initialization vector for AES-GCM encryption';
COMMENT ON COLUMN documents.pgp_signature IS 'Detached PGP signature (armored)';
COMMENT ON COLUMN documents.key_fingerprint IS 'Fingerprint of the encryption key used';

-- =====================================================
-- 2. USER ENCRYPTION KEYS TABLE
-- Store users' public keys (private keys stay client-side)
-- =====================================================
CREATE TABLE IF NOT EXISTS user_encryption_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_email VARCHAR(255) NOT NULL,
    public_key_pem TEXT NOT NULL,
    pgp_public_key TEXT,
    key_fingerprint VARCHAR(40) UNIQUE NOT NULL,
    key_algorithm VARCHAR(50) DEFAULT 'RSA-4096',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_keys_email ON user_encryption_keys(user_email);
CREATE INDEX IF NOT EXISTS idx_user_keys_fingerprint ON user_encryption_keys(key_fingerprint);
CREATE INDEX IF NOT EXISTS idx_user_keys_revoked ON user_encryption_keys(is_revoked);

COMMENT ON TABLE user_encryption_keys IS 'Public encryption keys for users (private keys stored client-side)';
COMMENT ON COLUMN user_encryption_keys.public_key_pem IS 'RSA public key in PEM format';
COMMENT ON COLUMN user_encryption_keys.pgp_public_key IS 'PGP/GPG  public key (armored)';
COMMENT ON COLUMN user_encryption_keys.key_fingerprint IS 'SHA-256 hash of public key (first 40 chars)';

-- =====================================================
-- 3. DOCUMENT RECIPIENTS TABLE
-- Track multi-recipient encrypted documents
-- =====================================================
CREATE TABLE IF NOT EXISTS document_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_key_fingerprint VARCHAR(40) REFERENCES user_encryption_keys(key_fingerprint),
    encrypted_aes_key TEXT NOT NULL,
    can_view BOOLEAN DEFAULT TRUE,
    can_download BOOLEAN DEFAULT FALSE,
    access_granted_at TIMESTAMPTZ DEFAULT NOW(),
    access_revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_doc_recipients_doc ON document_recipients(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_recipients_email ON document_recipients(recipient_email);
CREATE INDEX IF NOT EXISTS idx_doc_recipients_fingerprint ON document_recipients(recipient_key_fingerprint);

COMMENT ON TABLE document_recipients IS 'Recipients who can decrypt the document (multi-recipient encryption)';
COMMENT ON COLUMN document_recipients.encrypted_aes_key IS 'Document AES key encrypted with recipient public RSA key';

-- =====================================================
-- 4. ENCRYPTION AUDIT LOG
-- Log all encryption/decryption operations
-- =====================================================
CREATE TABLE IF NOT EXISTS encryption_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    operation VARCHAR(50) NOT NULL,
    encryption_type VARCHAR(50),
    key_fingerprint VARCHAR(40),
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enc_audit_doc ON encryption_audit_log(document_id);
CREATE INDEX IF NOT EXISTS idx_enc_audit_operation ON encryption_audit_log(operation);
CREATE INDEX IF NOT EXISTS idx_enc_audit_timestamp ON encryption_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_enc_audit_key ON encryption_audit_log(key_fingerprint);

COMMENT ON TABLE encryption_audit_log IS 'Audit trail for all encryption operations';
COMMENT ON COLUMN encryption_audit_log.operation IS 'Operation type: encrypt, decrypt, sign, verify, key_generate, key_rotate';

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to add document recipient
CREATE OR REPLACE FUNCTION add_document_recipient(
    p_document_id UUID,
    p_recipient_email VARCHAR,
    p_encrypted_aes_key TEXT,
    p_key_fingerprint VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_recipient_id UUID;
BEGIN
    INSERT INTO document_recipients (
        document_id,
        recipient_email,
        recipient_key_fingerprint,
        encrypted_aes_key
    ) VALUES (
        p_document_id,
        p_recipient_email,
        p_key_fingerprint,
        p_encrypted_aes_key
    ) RETURNING id INTO v_recipient_id;
    
    RETURN v_recipient_id;
END;
$$ LANGUAGE plpgsql;

-- Function to revoke recipient access
CREATE OR REPLACE FUNCTION revoke_recipient_access(
    p_document_id UUID,
    p_recipient_email VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE document_recipients
    SET 
        can_view = FALSE,
        can_download = FALSE,
        access_revoked_at = NOW()
    WHERE document_id = p_document_id
    AND recipient_email = p_recipient_email;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to log encryption operation
CREATE OR REPLACE FUNCTION log_encryption_operation(
    p_document_id UUID,
    p_operation VARCHAR,
    p_encryption_type VARCHAR,
    p_key_fingerprint VARCHAR,
    p_user_email VARCHAR,
    p_ip_address VARCHAR,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO encryption_audit_log (
        document_id,
        operation,
        encryption_type,
        key_fingerprint,
        user_email,
        ip_address,
        success,
        error_message
    ) VALUES (
        p_document_id,
        p_operation,
        p_encryption_type,
        p_key_fingerprint,
        p_user_email,
        p_ip_address,
        p_success,
        p_error_message
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE user_encryption_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

-- User keys policies
CREATE POLICY user_keys_select ON user_encryption_keys
    FOR SELECT USING (true);

CREATE POLICY user_keys_insert ON user_encryption_keys
    FOR INSERT WITH CHECK (true);

CREATE POLICY user_keys_update ON user_encryption_keys
    FOR UPDATE USING (user_email = current_setting('request.jwt.claims', true)::json->>'email');

-- Document recipients policies
CREATE POLICY doc_recipients_select ON document_recipients
    FOR SELECT USING (true);

CREATE POLICY doc_recipients_insert ON document_recipients
    FOR INSERT WITH CHECK (true);

-- Audit log policies (read-only)
CREATE POLICY enc_audit_select ON encryption_audit_log
    FOR SELECT USING (true);

CREATE POLICY enc_audit_insert ON encryption_audit_log
    FOR INSERT WITH CHECK (true);

-- =====================================================
-- 7. ANALYTICS VIEWS
-- =====================================================

-- View for encryption statistics
CREATE OR REPLACE VIEW encryption_statistics AS
SELECT 
    encryption_type,
    COUNT(*) as total_documents,
    COUNT(DISTINCT key_fingerprint) as unique_keys,
    AVG(CASE WHEN encryption_type = 'pgp' THEN 1 ELSE 0 END) as pgp_percentage
FROM documents
WHERE encryption_type IS NOT NULL
GROUP BY encryption_type;

COMMENT ON VIEW encryption_statistics IS 'Statistics on encryption usage';

-- View for user key status
CREATE OR REPLACE VIEW user_key_status AS
SELECT 
    user_email,
    key_fingerprint,
    key_algorithm,
    created_at,
    expires_at,
    is_revoked,
    CASE 
        WHEN is_revoked THEN 'Revoked'
        WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 'Expired'
        ELSE 'Active'
    END as status
FROM user_encryption_keys
ORDER BY created_at DESC;

COMMENT ON VIEW user_key_status IS 'Current status of all user encryption keys';

-- ============================================
-- SAMPLE USAGE EXAMPLES
-- ============================================

-- Example 1: Store user's public key
-- INSERT INTO user_encryption_keys (user_email, public_key_pem, key_fingerprint, key_algorithm)
-- VALUES ('user@example.com', '<PEM-formatted-key>', 'abc123...', 'RSA-4096');

-- Example 2: Upload encrypted document (advanced encryption)
-- UPDATE documents 
-- SET encryption_type = 'advanced',
--     encrypted_symmetric_key = '<base64-encrypted-aes-key>',
--     encryption_iv = decode('<base64-iv>', 'base64'),
--     key_fingerprint = 'abc123...'
-- WHERE id = '<document-uuid>';

-- Example 3: Add recipient to encrypted document
-- SELECT add_document_recipient(
--     '<document-uuid>',
--     'recipient@example.com',
--     '<encrypted-aes-key-for-recipient>',
--     '<recipient-key-fingerprint>'
-- );

-- Example 4: Log encryption operation
-- SELECT log_encryption_operation(
--     '<document-uuid>',
--     'encrypt',
--     'advanced',
--     '<key-fingerprint>',
--     'user@example.com',
--     '192.168.1.1',
--     true,
--     NULL
-- );

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
