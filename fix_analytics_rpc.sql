-- ============================================
-- FIX: Analytics RPC Function
-- ============================================

-- 1. Drop the existing function to ensure a clean slate
DROP FUNCTION IF EXISTS get_document_conversion_funnel(UUID);

-- 2. Recreate the function
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
    
    -- Step 4: Completed/Signed (Placeholder until signers table is confirmed)
    SELECT 'Completed/Signed'::TEXT, 4, 0::BIGINT, 'Signatures completed'::TEXT;
    
END;
$$ LANGUAGE plpgsql;

-- 3. CRITICAL: Grant execute permissions
-- This is often required for the function to be visible to the API
GRANT EXECUTE ON FUNCTION get_document_conversion_funnel(UUID) TO anon, authenticated, service_role;

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload config';
