-- ============================================
-- Audit Trail & Compliance Reports Migration
-- ============================================
-- This migration creates the audit_events table
-- and related infrastructure for comprehensive
-- activity tracking and compliance reporting
-- ============================================

-- Create audit_events table
CREATE TABLE IF NOT EXISTS audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(50) NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    signer_id UUID REFERENCES document_signers(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ip_address VARCHAR(45),
    user_agent TEXT,
    geolocation JSONB,
    event_metadata JSONB,
    session_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comment to table
COMMENT ON TABLE audit_events IS 'Stores all audit trail events for documents, signatures, and user activities';

-- Add column comments for documentation
COMMENT ON COLUMN audit_events.event_type IS 'Type of event: document_uploaded, document_viewed, document_downloaded, signature_completed, etc.';
COMMENT ON COLUMN audit_events.document_id IS 'Reference to the document (cascades on delete)';
COMMENT ON COLUMN audit_events.signer_id IS 'Reference to signer if signature-related event';
COMMENT ON COLUMN audit_events.user_email IS 'Email of user performing action (if available)';
COMMENT ON COLUMN audit_events.ip_address IS 'IPv4 or IPv6 address of user';
COMMENT ON COLUMN audit_events.geolocation IS 'JSON with country, region, city, lat, lng from IP lookup';
COMMENT ON COLUMN audit_events.event_metadata IS 'Additional event-specific data in JSON format';
COMMENT ON COLUMN audit_events.session_id IS 'Browser session identifier for tracking user sessions';

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_audit_document ON audit_events(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(event_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_session ON audit_events(session_id);
CREATE INDEX IF NOT EXISTS idx_audit_user_email ON audit_events(user_email);

-- Composite index for common queries (document + timestamp)
CREATE INDEX IF NOT EXISTS idx_audit_doc_timestamp ON audit_events(document_id, event_timestamp DESC);

-- Add statistics columns to documents table
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS unique_viewers INTEGER DEFAULT 0;

-- Add comments to new columns
COMMENT ON COLUMN documents.view_count IS 'Total number of times document has been viewed';
COMMENT ON COLUMN documents.download_count IS 'Total number of times document has been downloaded';
COMMENT ON COLUMN documents.last_viewed_at IS 'Timestamp of most recent view';
COMMENT ON COLUMN documents.unique_viewers IS 'Count of unique IP addresses that viewed the document';

-- Create function to auto-increment view counter
CREATE OR REPLACE FUNCTION increment_document_view_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'document_viewed' THEN
        UPDATE documents 
        SET 
            view_count = view_count + 1,
            last_viewed_at = NEW.event_timestamp
        WHERE id = NEW.document_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update document stats
CREATE TRIGGER trigger_update_view_count
    AFTER INSERT ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION increment_document_view_count();

-- Create function to auto-increment download counter
CREATE OR REPLACE FUNCTION increment_document_download_count()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.event_type = 'document_downloaded' THEN
        UPDATE documents 
        SET download_count = download_count + 1
        WHERE id = NEW.document_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for download count
CREATE TRIGGER trigger_update_download_count
    AFTER INSERT ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION increment_document_download_count();

-- Row Level Security (RLS) Policies
-- Enable RLS on audit_events
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view audit events for their own documents
-- Note: Since we don't have user authentication, we'll allow all reads for now
-- This should be restricted when auth is implemented
CREATE POLICY audit_read_policy ON audit_events
    FOR SELECT
    USING (true);

-- Policy: Only the system can insert audit events (through service role)
CREATE POLICY audit_insert_policy ON audit_events
    FOR INSERT
    WITH CHECK (true);

-- Policy: Prevent updates and deletes (audit logs should be immutable)
CREATE POLICY audit_no_update ON audit_events
    FOR UPDATE
    USING (false);

CREATE POLICY audit_no_delete ON audit_events
    FOR DELETE
    USING (false);

-- Create view for easy querying of recent activity
CREATE OR REPLACE VIEW recent_audit_activity AS
SELECT 
    ae.id,
    ae.event_type,
    ae.event_timestamp,
    d.name as document_name,
    d.id as document_id,
    ds.signer_name,
    ae.user_email,
    ae.ip_address,
    ae.geolocation->>'city' as city,
    ae.geolocation->>'country' as country,
    ae.event_metadata
FROM audit_events ae
LEFT JOIN documents d ON ae.document_id = d.id
LEFT JOIN document_signers ds ON ae.signer_id = ds.id
ORDER BY ae.event_timestamp DESC;

-- Create materialized view for analytics (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS audit_analytics AS
SELECT 
    document_id,
    COUNT(*) FILTER (WHERE event_type = 'document_viewed') as total_views,
    COUNT(DISTINCT ip_address) FILTER (WHERE event_type = 'document_viewed') as unique_viewers,
    COUNT(*) FILTER (WHERE event_type = 'document_downloaded') as total_downloads,
    COUNT(*) FILTER (WHERE event_type LIKE 'signature_%') as signature_events,
    MIN(event_timestamp) as first_activity,
    MAX(event_timestamp) as last_activity,
    COUNT(DISTINCT DATE(event_timestamp)) as active_days
FROM audit_events
WHERE document_id IS NOT NULL
GROUP BY document_id;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_audit_analytics_doc ON audit_analytics(document_id);

-- Create function to refresh analytics (call periodically or after bulk inserts)
CREATE OR REPLACE FUNCTION refresh_audit_analytics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY audit_analytics;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Sample Event Types Reference
-- ============================================
-- Event types to use in application:
-- 
-- Document Events:
--   - document_uploaded
--   - document_viewed
--   - document_downloaded
--   - document_expired
--   - document_deleted
--
-- Link Events:
--   - link_copied
--   - link_shared
--   - link_revoked
--
-- Security Events:
--   - password_verified
--   - password_failed
--   - email_verified
--   - email_failed
--
-- Signature Events:
--   - signature_requested
--   - signature_viewed
--   - signature_completed
--   - signature_declined
--   - signature_reminder_sent
--
-- Settings Events:
--   - settings_changed
--   - expiration_set
--   - password_added
--   - password_removed
--
-- Export Events:
--   - audit_export_csv
--   - audit_export_pdf
--   - compliance_report_generated
--
-- ============================================

-- Insert initial test event (optional - remove in production)
-- INSERT INTO audit_events (event_type, event_metadata) 
-- VALUES ('system_initialized', '{"migration": "audit_trail_v1", "timestamp": "2025-12-11"}');
