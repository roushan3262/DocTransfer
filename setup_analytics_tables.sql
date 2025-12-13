-- ============================================
-- SETUP ANALYTICS TABLES
-- ============================================

-- 1. Create document_access_sessions table
CREATE TABLE IF NOT EXISTS document_access_sessions (
    session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    user_agent TEXT,
    ip_address TEXT,
    geolocation JSONB
);

-- 2. Create document_view_tracking table
CREATE TABLE IF NOT EXISTS document_view_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES document_access_sessions(session_id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    view_timestamp TIMESTAMPTZ DEFAULT NOW(),
    page_number INTEGER DEFAULT 1,
    duration_seconds INTEGER DEFAULT 0,
    ip_address TEXT
);

-- 3. Enable RLS
ALTER TABLE document_access_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_view_tracking ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies (Allow Public Insert/Select for Analytics)

-- document_access_sessions policies
CREATE POLICY "Public can insert sessions" 
ON document_access_sessions FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can select sessions" 
ON document_access_sessions FOR SELECT 
USING (true);

-- document_view_tracking policies
CREATE POLICY "Public can insert tracking" 
ON document_view_tracking FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Public can update tracking" 
ON document_view_tracking FOR UPDATE 
USING (true);

CREATE POLICY "Public can select tracking" 
ON document_view_tracking FOR SELECT 
USING (true);

-- 5. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_analytics_doc_id ON document_access_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_tracking_doc_id ON document_view_tracking(document_id);
CREATE INDEX IF NOT EXISTS idx_tracking_session_id ON document_view_tracking(session_id);
