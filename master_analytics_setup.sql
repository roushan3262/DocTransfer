-- ============================================
-- MASTER FIX: Analytics & Insights Setup
-- ============================================
-- Run this ENTIRE file in Supabase SQL Editor to fix all missing tables/functions

-- =====================================================
-- 1. VIEWS CREATION (Drops existing first to be safe)
-- =====================================================

DROP VIEW IF EXISTS daily_document_stats CASCADE;
CREATE OR REPLACE VIEW daily_document_stats AS
SELECT
    dvt.document_id,
    DATE_TRUNC('day', dvt.view_timestamp) as stat_date,
    COUNT(*) as total_views,
    COUNT(DISTINCT dvt.session_id) as unique_sessions,
    COUNT(DISTINCT dvt.ip_address) as unique_ips,
    AVG(dvt.duration_seconds) as avg_duration_seconds
FROM document_view_tracking dvt
GROUP BY dvt.document_id, DATE_TRUNC('day', dvt.view_timestamp);

DROP VIEW IF EXISTS page_attention_stats CASCADE;
CREATE OR REPLACE VIEW page_attention_stats AS
SELECT
    dvt.document_id,
    dvt.page_number,
    COUNT(*) as total_views,
    AVG(dvt.duration_seconds) as avg_duration_seconds,
    MAX(dvt.duration_seconds) as max_duration_seconds,
    MIN(dvt.duration_seconds) as min_duration_seconds
FROM document_view_tracking dvt
WHERE dvt.page_number IS NOT NULL
GROUP BY dvt.document_id, dvt.page_number;

DROP VIEW IF EXISTS viewer_geo_stats CASCADE;
CREATE OR REPLACE VIEW viewer_geo_stats AS
SELECT
    das.document_id,
    (das.geolocation->>'country') as country_code,
    (das.geolocation->>'city') as city,
    COUNT(*) as session_count
FROM document_access_sessions das
WHERE das.geolocation IS NOT NULL
GROUP BY das.document_id, das.geolocation->>'country', das.geolocation->>'city';

DROP VIEW IF EXISTS device_analytics_stats CASCADE;
CREATE OR REPLACE VIEW device_analytics_stats AS
SELECT
    das.document_id,
    CASE
        WHEN das.user_agent ILIKE '%mobile%' THEN 'Mobile'
        WHEN das.user_agent ILIKE '%tablet%' OR das.user_agent ILIKE '%ipad%' THEN 'Tablet'
        ELSE 'Desktop'
    END as device_type,
    CASE
        WHEN das.user_agent ILIKE '%chrome%' THEN 'Chrome'
        WHEN das.user_agent ILIKE '%firefox%' THEN 'Firefox'
        WHEN das.user_agent ILIKE '%safari%' AND das.user_agent NOT ILIKE '%chrome%' THEN 'Safari'
        WHEN das.user_agent ILIKE '%edge%' OR das.user_agent ILIKE '%edg%' THEN 'Edge'
        ELSE 'Other'
    END as browser_name,
    COUNT(*) as session_count
FROM document_access_sessions das
GROUP BY 
    das.document_id,
    CASE
        WHEN das.user_agent ILIKE '%mobile%' THEN 'Mobile'
        WHEN das.user_agent ILIKE '%tablet%' OR das.user_agent ILIKE '%ipad%' THEN 'Tablet'
        ELSE 'Desktop'
    END,
    CASE
        WHEN das.user_agent ILIKE '%chrome%' THEN 'Chrome'
        WHEN das.user_agent ILIKE '%firefox%' THEN 'Firefox'
        WHEN das.user_agent ILIKE '%safari%' AND das.user_agent NOT ILIKE '%chrome%' THEN 'Safari'
        WHEN das.user_agent ILIKE '%edge%' OR das.user_agent ILIKE '%edg%' THEN 'Edge'
        ELSE 'Other'
    END;

-- =====================================================
-- 2. FUNCTIONS CREATION
-- =====================================================

DROP FUNCTION IF EXISTS get_document_conversion_funnel(UUID);
CREATE OR REPLACE FUNCTION get_document_conversion_funnel(p_document_id UUID)
RETURNS TABLE (
    step_name TEXT,
    step_order INTEGER,
    count BIGINT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Step 1: Session Started
    SELECT 'Session Started'::TEXT, 1, COUNT(*)::BIGINT, 'Total distinct sessions created'::TEXT
    FROM document_access_sessions
    WHERE document_id = p_document_id
    
    UNION ALL
    
    -- Step 2: Content Viewed
    SELECT 'Content Viewed'::TEXT, 2, COUNT(DISTINCT session_id)::BIGINT, 'Sessions with at least one page view'::TEXT
    FROM document_view_tracking
    WHERE document_id = p_document_id
    
    UNION ALL
    
    -- Step 3: Engaged (>30s)
    SELECT 'Engaged (>30s)'::TEXT, 3, COUNT(DISTINCT session_id)::BIGINT, 'Sessions with > 30 seconds total view time'::TEXT
    FROM (
        SELECT session_id, SUM(duration_seconds) as total_duration
        FROM document_view_tracking
        WHERE document_id = p_document_id
        GROUP BY session_id
        HAVING SUM(duration_seconds) > 30
    ) as engaged_sessions
    
    UNION ALL
    
    -- Step 4: Completed/Signed (Safe fallback if table missing)
    SELECT 'Completed/Signed'::TEXT, 4, 
           (CASE WHEN EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'document_signers') 
                 THEN (SELECT COUNT(*) FROM document_signers WHERE document_id = p_document_id AND status = 'signed')
                 ELSE 0 END)::BIGINT, 
           'Signatures completed'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 3. PERMISSIONS (CRITICAL FIX)
-- =====================================================

-- Grant access to views
GRANT SELECT ON daily_document_stats TO anon, authenticated, service_role;
GRANT SELECT ON page_attention_stats TO anon, authenticated, service_role;
GRANT SELECT ON viewer_geo_stats TO anon, authenticated, service_role;
GRANT SELECT ON device_analytics_stats TO anon, authenticated, service_role;

-- Grant access to function
GRANT EXECUTE ON FUNCTION get_document_conversion_funnel(UUID) TO anon, authenticated, service_role;

-- Force API cache reload
NOTIFY pgrst, 'reload config';
