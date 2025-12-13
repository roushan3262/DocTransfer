-- ============================================
-- FIX: Analytics Views Permissions
-- ============================================

-- Grant SELECT permissions on all analytics views to API roles
-- This ensures Supabase PostgREST API can "see" these views

GRANT SELECT ON TABLE daily_document_stats TO anon, authenticated, service_role;
GRANT SELECT ON TABLE page_attention_stats TO anon, authenticated, service_role;
GRANT SELECT ON TABLE viewer_geo_stats TO anon, authenticated, service_role;
GRANT SELECT ON TABLE device_analytics_stats TO anon, authenticated, service_role;

-- Also ensure the underlying tables have RLS policies that allow reading
-- (The views inherit RLS from underlying tables in some cases, or run as owner)
-- These views are SECURITY DEFINER by default in standard SQL, but in Postgres 
-- views run with the privileges of the user *accessing* them unless specified.
-- Since the underlying tables (document_access_sessions) have RLS, we need to ensure users can read their own data.

-- Forcing cache reload to pick up these permission changes
NOTIFY pgrst, 'reload config';
