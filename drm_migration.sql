-- ============================================
-- Digital Rights Management (DRM) Migration
-- ============================================
-- This migration creates tables for access control,
-- session management, view tracking, and DRM settings
-- ============================================

-- =====================================================
-- 1. DOCUMENT ACCESS SESSIONS
-- Track individual access sessions per device/user
-- =====================================================
CREATE TABLE IF NOT EXISTS document_access_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_token VARCHAR(100) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    device_fingerprint TEXT,
    user_agent TEXT,
    geolocation JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_access_at TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 0,
    is_revoked BOOLEAN DEFAULT FALSE,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_access_sessions_doc ON document_access_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_access_sessions_token ON document_access_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_access_sessions_device ON document_access_sessions(device_fingerprint);
CREATE INDEX IF NOT EXISTS idx_access_sessions_revoked ON document_access_sessions(is_revoked);

-- Comments for documentation
COMMENT ON TABLE document_access_sessions IS 'Tracks individual access sessions for DRM-enabled documents';
COMMENT ON COLUMN document_access_sessions.session_token IS 'Unique token for this access session, stored in browser';
COMMENT ON COLUMN document_access_sessions.device_fingerprint IS 'Browser fingerprint hash for device tracking';
COMMENT ON COLUMN document_access_sessions.access_count IS 'Number of times document was accessed in this session';

-- =====================================================
-- 2. DOCUMENT VIEW TRACKING
-- Track individual page views and duration
-- =====================================================
CREATE TABLE IF NOT EXISTS document_view_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    session_id UUID REFERENCES document_access_sessions(id) ON DELETE CASCADE,
    view_timestamp TIMESTAMPTZ DEFAULT NOW(),
    page_number INTEGER,
    duration_seconds INTEGER,
    ip_address VARCHAR(45)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_view_tracking_doc ON document_view_tracking(document_id);
CREATE INDEX IF NOT EXISTS idx_view_tracking_session ON document_view_tracking(session_id);
CREATE INDEX IF NOT EXISTS idx_view_tracking_timestamp ON document_view_tracking(view_timestamp DESC);

COMMENT ON TABLE document_view_tracking IS 'Detailed view tracking for analytics and compliance';

-- =====================================================
-- 3. DOCUMENT DRM SETTINGS
-- Configuration for per-document DRM controls
-- =====================================================
CREATE TABLE IF NOT EXISTS document_drm_settings (
    document_id UUID PRIMARY KEY REFERENCES documents(id) ON DELETE CASCADE,
    
    -- View & Device Limits
    max_views INTEGER, -- NULL = unlimited
    max_unique_devices INTEGER, -- NULL = unlimited
    
    -- Protection Flags
    prevent_copy BOOLEAN DEFAULT FALSE,
    prevent_print BOOLEAN DEFAULT FALSE,
    prevent_download BOOLEAN DEFAULT FALSE,
    prevent_screenshot BOOLEAN DEFAULT FALSE,
    
    -- Watermark Settings
    require_watermark BOOLEAN DEFAULT FALSE,
    watermark_text TEXT,
    watermark_opacity DECIMAL DEFAULT 0.3 CHECK (watermark_opacity >= 0 AND watermark_opacity <= 1),
    watermark_position VARCHAR(20) DEFAULT 'diagonal' CHECK (watermark_position IN ('diagonal', 'center', 'bottom', 'top')),
    
    -- Access Restrictions
    access_expires_at TIMESTAMPTZ,
    allowed_ip_ranges JSONB, -- Array of IP ranges or CIDR
    allowed_countries JSONB, -- Array of country codes (ISO 3166-1 alpha-2)
    blocked_countries JSONB,
    
    -- Time-based Access
    allowed_days_of_week JSONB, -- Array of integers 0-6 (Sunday=0)
    allowed_hours_start INTEGER CHECK (allowed_hours_start >= 0 AND allowed_hours_start <= 23),
    allowed_hours_end INTEGER CHECK (allowed_hours_end >= 0 AND allowed_hours_end <= 23),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE document_drm_settings IS 'DRM configuration per document';
COMMENT ON COLUMN document_drm_settings.max_views IS 'Maximum total views across all sessions (NULL = unlimited)';
COMMENT ON COLUMN document_drm_settings.max_unique_devices IS 'Maximum number of unique devices allowed (NULL = unlimited)';
COMMENT ON COLUMN document_drm_settings.allowed_ip_ranges IS 'JSON array of allowed IP ranges in CIDR notation';
COMMENT ON COLUMN document_drm_settings.allowed_countries IS 'JSON array of ISO country codes (e.g., ["US", "GB", "CA"])';

-- =====================================================
-- 4. UPDATE DOCUMENTS TABLE
-- Add DRM status columns
-- =====================================================
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS drm_enabled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS total_access_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_device_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_access_revoked_at TIMESTAMPTZ;

COMMENT ON COLUMN documents.drm_enabled IS 'Whether DRM protections are enabled for this document';
COMMENT ON COLUMN documents.total_access_count IS 'Total number of access sessions created';
COMMENT ON COLUMN documents.unique_device_count IS 'Number of unique device fingerprints that accessed this document';

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Function to auto-update last_access_at on sessions
CREATE OR REPLACE FUNCTION update_session_last_access()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE document_access_sessions
    SET 
        last_access_at = NOW(),
        access_count = access_count + 1
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update session on new view
CREATE TRIGGER trigger_update_session_access
    AFTER INSERT ON document_view_tracking
    FOR EACH ROW
    EXECUTE FUNCTION update_session_last_access();

-- Function to count unique devices for a document
CREATE OR REPLACE FUNCTION update_document_device_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Only update if not revoked and device fingerprint exists
    IF NEW.is_revoked = FALSE AND NEW.device_fingerprint IS NOT NULL THEN
        UPDATE documents
        SET 
            unique_device_count = (
                SELECT COUNT(DISTINCT device_fingerprint)
                FROM document_access_sessions
                WHERE document_id = NEW.document_id
                AND is_revoked = FALSE
                AND device_fingerprint IS NOT NULL
            ),
            total_access_count = total_access_count + 1
        WHERE id = NEW.document_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update document stats
CREATE TRIGGER trigger_update_document_stats
    AFTER INSERT ON document_access_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_document_device_count();

-- Function to check if access is allowed based on view limits
CREATE OR REPLACE FUNCTION check_access_limits(
    p_document_id UUID,
    p_device_fingerprint TEXT
) RETURNS TABLE (
    allowed BOOLEAN,
    reason TEXT,
    remaining_views INTEGER
) AS $$
DECLARE
    v_drm_settings RECORD;
    v_total_views INTEGER;
    v_unique_devices INTEGER;
    v_session_count INTEGER;
BEGIN
    -- Get DRM settings
    SELECT * INTO v_drm_settings
    FROM document_drm_settings
    WHERE document_id = p_document_id;
    
    -- If no DRM settings, allow access
    IF v_drm_settings IS NULL THEN
        RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::INTEGER;
        RETURN;
    END IF;
    
    -- Check if access has expired
    IF v_drm_settings.access_expires_at IS NOT NULL 
       AND v_drm_settings.access_expires_at < NOW() THEN
        RETURN QUERY SELECT FALSE, 'Access has expired', 0;
        RETURN;
    END IF;
    
    -- Check max views
    IF v_drm_settings.max_views IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_views
        FROM document_view_tracking
        WHERE document_id = p_document_id;
        
        IF v_total_views >= v_drm_settings.max_views THEN
            RETURN QUERY SELECT FALSE, 'Maximum view limit reached', 0;
            RETURN;
        END IF;
    END IF;
    
    -- Check max unique devices
    IF v_drm_settings.max_unique_devices IS NOT NULL THEN
        SELECT COUNT(DISTINCT device_fingerprint) INTO v_unique_devices
        FROM document_access_sessions
        WHERE document_id = p_document_id
        AND is_revoked = FALSE
        AND device_fingerprint IS NOT NULL;
        
        -- Check if this is a new device
        SELECT COUNT(*) INTO v_session_count
        FROM document_access_sessions
        WHERE document_id = p_document_id
        AND device_fingerprint = p_device_fingerprint
        AND is_revoked = FALSE;
        
        IF v_session_count = 0 AND v_unique_devices >= v_drm_settings.max_unique_devices THEN
            RETURN QUERY SELECT FALSE, 'Maximum device limit reached', NULL::INTEGER;
            RETURN;
        END IF;
    END IF;
    
    -- Calculate remaining views
    IF v_drm_settings.max_views IS NOT NULL THEN
        RETURN QUERY SELECT 
            TRUE, 
            NULL::TEXT, 
            (v_drm_settings.max_views - v_total_views)::INTEGER;
    ELSE
        RETURN QUERY SELECT TRUE, NULL::TEXT, NULL::INTEGER;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE document_access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_view_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_drm_settings ENABLE ROW LEVEL SECURITY;

-- Access Sessions Policies
CREATE POLICY access_sessions_select ON document_access_sessions
    FOR SELECT USING (true);

CREATE POLICY access_sessions_insert ON document_access_sessions
    FOR INSERT WITH CHECK (true);

CREATE POLICY access_sessions_update ON document_access_sessions
    FOR UPDATE USING (true);

-- View Tracking Policies
CREATE POLICY view_tracking_select ON document_view_tracking
    FOR SELECT USING (true);

CREATE POLICY view_tracking_insert ON document_view_tracking
    FOR INSERT WITH CHECK (true);

-- DRM Settings Policies (more restrictive)
CREATE POLICY drm_settings_select ON document_drm_settings
    FOR SELECT USING (true);

CREATE POLICY drm_settings_insert ON document_drm_settings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM documents 
            WHERE documents.id = document_drm_settings.document_id 
            AND (documents.user_id = auth.uid()::text OR documents.user_id IS NULL)
        )
    );

CREATE POLICY drm_settings_update ON document_drm_settings
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM documents 
            WHERE documents.id = document_drm_settings.document_id 
            AND (documents.user_id = auth.uid()::text OR documents.user_id IS NULL)
        )
    );

-- =====================================================
-- 7. ANALYTICS VIEWS
-- =====================================================

-- View for active sessions summary
CREATE OR REPLACE VIEW active_drm_sessions AS
SELECT 
    das.document_id,
    d.name as document_name,
    COUNT(*) as total_sessions,
    COUNT(*) FILTER (WHERE das.is_revoked = FALSE) as active_sessions,
    COUNT(*) FILTER (WHERE das.is_revoked = TRUE) as revoked_sessions,
    COUNT(DISTINCT das.device_fingerprint) as unique_devices,
    MAX(das.last_access_at) as last_activity,
    MIN(das.created_at) as first_access
FROM document_access_sessions das
JOIN documents d ON das.document_id = d.id
GROUP BY das.document_id, d.name;

COMMENT ON VIEW active_drm_sessions IS 'Summary of DRM sessions per document';

-- View for access statistics
CREATE OR REPLACE VIEW drm_access_stats AS
SELECT 
    d.id as document_id,
    d.name as document_name,
    d.drm_enabled,
    dds.max_views,
    dds.max_unique_devices,
    COUNT(DISTINCT das.id) as total_sessions,
    COUNT(DISTINCT das.device_fingerprint) as unique_devices_accessed,
    COUNT(dvt.id) as total_views,
    dds.max_views - COUNT(dvt.id) as remaining_views,
    d.last_access_revoked_at
FROM documents d
LEFT JOIN document_drm_settings dds ON d.id = dds.document_id
LEFT JOIN document_access_sessions das ON d.id = das.document_id AND das.is_revoked = FALSE
LEFT JOIN document_view_tracking dvt ON d.id = dvt.document_id
WHERE d.drm_enabled = TRUE
GROUP BY d.id, d.name, d.drm_enabled, dds.max_views, dds.max_unique_devices, d.last_access_revoked_at;

COMMENT ON VIEW drm_access_stats IS 'Comprehensive DRM statistics per document';

-- ============================================
-- SAMPLE USAGE EXAMPLES
-- ============================================

-- Example 1: Enable DRM with view limit
-- INSERT INTO document_drm_settings (document_id, max_views, prevent_copy, require_watermark, watermark_text)
-- VALUES ('your-doc-uuid', 10, TRUE, TRUE, 'CONFIDENTIAL - John Doe');

-- Example 2: Check if access is allowed
-- SELECT * FROM check_access_limits('your-doc-uuid', 'device-fingerprint-hash');

-- Example 3: Get active sessions for a document
-- SELECT * FROM document_access_sessions WHERE document_id = 'your-doc-uuid' AND is_revoked = FALSE;

-- Example 4: Revoke all access to a document
-- UPDATE document_access_sessions SET is_revoked = TRUE, revoked_at = NOW(), revoked_reason = 'Owner revoked access'
-- WHERE document_id = 'your-doc-uuid';

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
