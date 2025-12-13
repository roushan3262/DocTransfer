-- ============================================
-- Analytics & Insights Database Migration
-- ============================================
-- Adds materialized views and helper functions for
-- real-time document analytics dashboard
-- ============================================

-- =====================================================
-- 1. DAILY DOCUMENT STATS VIEW
-- Aggregates views, unique visitors, and average time per day
-- =====================================================
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

COMMENT ON VIEW daily_document_stats IS 'Daily aggregated statistics for document views';

-- =====================================================
-- 2. PAGE ATTENTION STATS VIEW
-- Aggregates average duration per page for heatmaps
-- =====================================================
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

COMMENT ON VIEW page_attention_stats IS 'Page-level engagement statistics for heatmaps';

-- =====================================================
-- 3. GEOGRAPHIC DISTRIBUTION VIEW
-- Aggregates viewer locations
-- =====================================================
CREATE OR REPLACE VIEW viewer_geo_stats AS
SELECT
    das.document_id,
    (das.geolocation->>'country') as country_code,
    (das.geolocation->>'city') as city,
    COUNT(*) as session_count
FROM document_access_sessions das
WHERE das.geolocation IS NOT NULL
GROUP BY das.document_id, das.geolocation->>'country', das.geolocation->>'city';

COMMENT ON VIEW viewer_geo_stats IS 'Geographic distribution of document viewers';

-- =====================================================
-- 4. DEVICE ANALYTICS VIEW
-- Aggregates device types and browsers
-- =====================================================
-- Note: This assumes simple parsing. For production, more robust UA parsing might be needed in backend.
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

COMMENT ON VIEW device_analytics_stats IS 'Device and browser usage statistics';

-- =====================================================
-- 5. CONVERSION FUNNEL FUNCTION
-- Calculates the conversion funnel metrics
-- =====================================================
CREATE OR REPLACE FUNCTION get_document_conversion_funnel(p_document_id UUID)
RETURNS TABLE (
    step_name TEXT,
    step_order INTEGER,
    count BIGINT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    -- Step 1: Access Link / Session Created
    SELECT 'Session Started'::TEXT, 1, COUNT(*)::BIGINT, 'Total distinct sessions created'::TEXT
    FROM document_access_sessions
    WHERE document_id = p_document_id
    
    UNION ALL
    
    -- Step 2: Viewed Content (at least one page view tracked)
    SELECT 'Content Viewed'::TEXT, 2, COUNT(DISTINCT session_id)::BIGINT, 'Sessions with at least one page view'::TEXT
    FROM document_view_tracking
    WHERE document_id = p_document_id
    
    UNION ALL
    
    -- Step 3: Engaged (Total duration > 30 seconds)
    SELECT 'Engaged (>30s)'::TEXT, 3, COUNT(DISTINCT session_id)::BIGINT, 'Sessions with > 30 seconds total view time'::TEXT
    FROM (
        SELECT session_id, SUM(duration_seconds) as total_duration
        FROM document_view_tracking
        WHERE document_id = p_document_id
        GROUP BY session_id
        HAVING SUM(duration_seconds) > 30
    ) as engaged_sessions
    
    UNION ALL
    
    -- Step 4: Signed (if applicable)
    -- Requires joining with document_signers table if it exists
    -- Assuming a simplified check for now or joining if the table exists
    SELECT 'Completed/Signed'::TEXT, 4, COUNT(*)::BIGINT, 'Signatures completed'::TEXT
    FROM document_signers
    WHERE document_id = p_document_id AND status = 'signed';
    
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION COMPLETE
-- ============================================
