# Audit Trail Setup Guide

## Quick Start

### Step 1: Apply Database Migration

Run this SQL script in your Supabase SQL Editor:

```bash
# In Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Click "New Query"
# 3. Copy and paste the contents of audit_trail_migration.sql
# 4. Click "Run"
```

Or use the Supabase CLI:
```bash
supabase db push --include-all
```

### Step 2: Verify Migration

Check that the tables were created:
```sql
SELECT * FROM audit_events LIMIT 5;
SELECT * FROM audit_analytics;
```

### Step 3: Test Audit Logging

Upload a document in the dashboard and verify the event was logged:
```sql
SELECT event_type, event_timestamp, ip_address, geolocation
FROM audit_events
WHERE event_type = 'document_uploaded'
ORDER BY event_timestamp DESC
LIMIT 5;
```

## Integration Points

### Already Integrated

✅ **Document Upload** - Logs when documents are uploaded  
✅ **Signature Workflows** - Tracks signature requests, completions, declines  

### Manual Integration Needed

The following components need audit logging added:

#### 1. ViewDocument.tsx
Add view tracking:
```typescript
import { logDocumentView } from './lib/auditLogger';

useEffect(() => {
    if (document?.id) {
        logDocumentView(document.id);
    }
}, [document]);
```

#### 2. Download Button (in ViewDocument.tsx)
Add download tracking:
```typescript
import { logDocumentDownload } from './lib/auditLogger';

const handleDownload = async () => {
    await logDocumentDownload(document.id);
    // existing download logic...
};
```

#### 3. Link Copy (in DataRoom.tsx)
Add link copy tracking:
```typescript
import { logLinkCopy } from './lib/auditLogger';

const copyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    logLinkCopy(uploadedDoc.id, 'share');
    // existing code...
};
```

#### 4. Password Verification (in ViewDocument.tsx)
Add password verification tracking:
```typescript
import { logPasswordVerification } from './lib/auditLogger';

const verifyPassword = async (inputPassword: string) => {
    const isValid = await checkPassword(inputPassword);
    await logPasswordVerification(document.id, isValid);
    // existing code...
};
```

## Accessing the Audit Trail

### Option 1: Add to DataRoom Dashboard

The audit trail has been integrated into the DataRoom component. Simply upload a document and navigate to a document's audit trail.

### Option 2: Standalone Page

Create a new route `/audit/:documentId` to view audit trail for any document.

## Exporting Reports

### CSV Export
Click the "Export CSV" button in the Audit Trail Dashboard to download a CSV file with all audit events.

### PDF Export (Coming Soon)
PDF export requires the jsPDF library. Install it:
```bash
npm install jspdf jspdf-autotable
```

Then implement the PDF generation in `complianceReports.ts`.

## Performance Optimization

### Refresh Materialized View

The `audit_analytics` materialized view caches statistics. Refresh it periodically:

```sql
SELECT refresh_audit_analytics();
```

Set up a cron job or scheduled function to refresh every hour:
```sql
-- In Supabase Dashboard > Database > Extensions
-- Enable pg_cron extension, then:
SELECT cron.schedule(
    'refresh-audit-analytics',
    '0 * * * *', -- Every hour
    $$SELECT refresh_audit_analytics()$$
);
```

### Query Optimization

For documents with 10,000+ audit events, use pagination:

```typescript
const { data, error } = await supabase
    .from('audit_events')
    .select('*')
    .eq('document_id', documentId)
    .order('event_timestamp', { ascending: false })
    .range(0, 99); // First 100 events
```

## Event Types Reference

### Document Events
- `document_uploaded` - Document uploaded to system
- `document_viewed` - Someone viewed the document
- `document_downloaded` - Document was downloaded
- `document_expired` - Document expired
- `document_deleted` - Document deleted

### Security Events
- `password_verified` - Password successfully verified
- `password_failed` - Password verification failed
- `email_verified` - Email successfully verified
- `email_failed` - Email verification failed

### Signature Events
- `signature_requested` - Signature requested from signer
- `signature_viewed` - Signer viewed signature page
- `signature_completed` - Signature completed
- `signature_declined` - Signature declined

### Link Events
- `link_copied` - Share link copied to clipboard
- `link_shared` - Link shared via email/message
- `link_revoked` - Link access revoked

## Compliance Features

### GDPR Compliance
- All events include IP address and geolocation
- User emails are captured for accountability
- Data can be exported as CSV for audits
- Events are immutable (no updates/deletes allowed)

### SOC 2 Compliance
- Complete audit trail of all access
- IP address logging for security
- Timestamp precision for incident investigation
- Geolocation tracking for fraud detection

### HIPAA Compliance  
- All document access is logged
- User identification via email
- Export capability for compliance audits
- Immutable records with RLS protection

## Troubleshooting

### Events Not Being Logged

1. Check if migration was applied:
```sql
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'audit_events'
);
```

2. Check RLS policies:
```sql
SELECT * FROM pg_policies WHERE tablename = 'audit_events';
```

3. Check function exists:
```typescript
import { logAuditEvent } from './lib/auditLogger';
console.log(typeof logAuditEvent); // Should output 'function'
```

### Geolocation Not Working

The free IP geolocation service (ip-api.com) has a rate limit of 45 requests/minute. If you exceed this, geolocation will be null. Consider:

1. Caching geolocation by IP for 24 hours
2. Using a paid service (ipapi.co, ipgeolocation.io)
3. Making geolocation optional

### Performance Issues

If the audit_events table grows very large (>1M rows):

1. **Partition the table** by date:
```sql
-- Create partitioned table (advanced)
CREATE TABLE audit_events_partitioned (LIKE audit_events)
PARTITION BY RANGE (event_timestamp);
```

2. **Archive old events**:
```sql
-- Archive events older than 1 year
DELETE FROM audit_events 
WHERE event_timestamp < NOW() - INTERVAL '1 year';
```

3. **Use materialized view** for statistics instead of real-time queries

## Next Steps

1. Apply the database migration
2. Test audit logging on a sample document
3. Integrate audit calls into ViewDocument.tsx
4. Set up automated materialized view refresh
5. Configure data retention policy
6. (Optional) Install jsPDF for PDF exports
