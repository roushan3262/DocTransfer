import { supabase } from './supabase';
import { logExportEvent } from './auditLogger';

/**
 * Audit Filters Interface
 */
export interface AuditFilters {
    startDate?: Date;
    endDate?: Date;
    eventTypes?: string[];
    userEmail?: string;
    sessionId?: string;
}

/**
 * Document Statistics Interface
 */
export interface DocumentStatistics {
    totalViews: number;
    uniqueViewers: number;
    totalDownloads: number;
    signatureStatus: {
        requested: number;
        completed: number;
        declined: number;
        pending: number;
    };
    activityByDay: Array<{
        date: string;
        views: number;
        downloads: number;
        signatures: number;
    }>;
    topCountries: Array<{
        country: string;
        count: number;
    }>;
    lastActivity: string | null;
}

/**
 * Fetch audit trail for a document
 */
export async function getDocumentAuditTrail(
    documentId: string,
    filters?: AuditFilters
): Promise<{ success: boolean; events?: any[]; error?: string }> {
    try {
        let query = supabase
            .from('audit_events')
            .select('*')
            .eq('document_id', documentId)
            .order('event_timestamp', { ascending: false });

        // Apply filters
        if (filters?.startDate) {
            query = query.gte('event_timestamp', filters.startDate.toISOString());
        }
        if (filters?.endDate) {
            query = query.lte('event_timestamp', filters.endDate.toISOString());
        }
        if (filters?.eventTypes && filters.eventTypes.length > 0) {
            query = query.in('event_type', filters.eventTypes);
        }
        if (filters?.userEmail) {
            query = query.eq('user_email', filters.userEmail);
        }
        if (filters?.sessionId) {
            query = query.eq('session_id', filters.sessionId);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching audit trail:', error);
            return { success: false, error: error.message };
        }

        return { success: true, events: data || [] };
    } catch (error) {
        console.error('Exception fetching audit trail:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Get document statistics
 */
export async function getDocumentStatistics(
    documentId: string
): Promise<{ success: boolean; statistics?: DocumentStatistics; error?: string }> {
    try {
        // Fetch from materialized view for better performance
        const { data: analyticsData, error: analyticsError } = await supabase
            .from('audit_analytics')
            .select('*')
            .eq('document_id', documentId)
            .single();

        // Also fetch detailed data for charts
        const { data: events, error: eventsError } = await supabase
            .from('audit_events')
            .select('*')
            .eq('document_id', documentId);

        if (analyticsError && analyticsError.code !== 'PGRST116') {
            console.error('Error fetching analytics:', analyticsError);
        }

        if (eventsError) {
            console.error('Error fetching events:', eventsError);
            return { success: false, error: eventsError.message };
        }

        const eventsList = events || [];

        // Calculate activity by day
        const activityMap = new Map<string, { views: number; downloads: number; signatures: number }>();

        eventsList.forEach(event => {
            const date = new Date(event.event_timestamp).toISOString().split('T')[0];
            if (!activityMap.has(date)) {
                activityMap.set(date, { views: 0, downloads: 0, signatures: 0 });
            }

            const activity = activityMap.get(date)!;
            if (event.event_type === 'document_viewed') activity.views++;
            if (event.event_type === 'document_downloaded') activity.downloads++;
            if (event.event_type.includes('signature')) activity.signatures++;
        });

        const activityByDay = Array.from(activityMap.entries())
            .map(([date, activity]) => ({ date, ...activity }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Calculate top countries
        const countryMap = new Map<string, number>();
        eventsList.forEach(event => {
            if (event.geolocation?.country) {
                const country = event.geolocation.country;
                countryMap.set(country, (countryMap.get(country) || 0) + 1);
            }
        });

        const topCountries = Array.from(countryMap.entries())
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Calculate signature status
        const signatureRequested = eventsList.filter(e => e.event_type === 'signature_requested').length;
        const signatureCompleted = eventsList.filter(e => e.event_type === 'signature_completed').length;
        const signatureDeclined = eventsList.filter(e => e.event_type === 'signature_declined').length;

        // Get unique viewers (distinct IPs)
        const uniqueIPs = new Set(
            eventsList
                .filter(e => e.event_type === 'document_viewed' && e.ip_address)
                .map(e => e.ip_address)
        );

        // Find last activity
        const lastEvent = eventsList[0];
        const lastActivity = lastEvent ? lastEvent.event_timestamp : null;

        const statistics: DocumentStatistics = {
            totalViews: analyticsData?.total_views || eventsList.filter(e => e.event_type === 'document_viewed').length,
            uniqueViewers: analyticsData?.unique_viewers || uniqueIPs.size,
            totalDownloads: analyticsData?.total_downloads || eventsList.filter(e => e.event_type === 'document_downloaded').length,
            signatureStatus: {
                requested: signatureRequested,
                completed: signatureCompleted,
                declined: signatureDeclined,
                pending: signatureRequested - signatureCompleted - signatureDeclined
            },
            activityByDay,
            topCountries,
            lastActivity
        };

        return { success: true, statistics };
    } catch (error) {
        console.error('Exception fetching statistics:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Export audit trail as CSV
 */
export async function exportAuditTrailCSV(
    documentId: string,
    filters?: AuditFilters
): Promise<{ success: boolean; csv?: string; error?: string }> {
    try {
        const { success, events, error } = await getDocumentAuditTrail(documentId, filters);

        if (!success || !events) {
            return { success: false, error: error || 'Failed to fetch audit trail' };
        }

        // CSV Headers
        const headers = [
            'Timestamp',
            'Event Type',
            'User Email',
            'IP Address',
            'City',
            'Country',
            'Session ID',
            'User Agent',
            'Additional Data'
        ];

        // Convert events to CSV rows
        const rows = events.map(event => [
            new Date(event.event_timestamp).toLocaleString(),
            event.event_type,
            event.user_email || 'N/A',
            event.ip_address || 'N/A',
            event.geolocation?.city || 'N/A',
            event.geolocation?.country || 'N/A',
            event.session_id || 'N/A',
            event.user_agent ? event.user_agent.substring(0, 50) + '...' : 'N/A',
            event.event_metadata ? JSON.stringify(event.event_metadata) : 'N/A'
        ]);

        // Build CSV string
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Log export event
        await logExportEvent(documentId, 'csv');

        return { success: true, csv: csvContent };
    } catch (error) {
        console.error('Exception exporting CSV:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Download CSV file
 */
export function downloadCSV(csvContent: string, filename: string): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/**
 * Generate PDF compliance report
 * Note: This is a placeholder. Full implementation requires jsPDF library
 */
export async function exportComplianceReportPDF(
    documentId: string,
    filters?: AuditFilters
): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
        // For now, we'll use the CSV export and suggest PDF libraries
        // Full implementation would use jsPDF + jspdf-autotable

        const { success, events, error } = await getDocumentAuditTrail(documentId, filters);

        if (!success || !events) {
            return { success: false, error: error || 'Failed to fetch audit trail' };
        }

        // Log export event
        await logExportEvent(documentId, 'pdf');

        // In a full implementation, you would:
        // 1. Import jsPDF and jspdf-autotable
        // 2. Create PDF with company branding
        // 3. Add document summary
        // 4. Add statistics charts
        // 5. Add detailed event table
        // 6. Add certificate of completion
        // 7. Download PDF

        return {
            success: true,
            message: 'PDF generation requires jsPDF library. Using CSV export for now.'
        };
    } catch (error) {
        console.error('Exception generating PDF:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Get all event types for a document
 */
export async function getDocumentEventTypes(documentId: string): Promise<string[]> {
    try {
        const { data, error } = await supabase
            .from('audit_events')
            .select('event_type')
            .eq('document_id', documentId);

        if (error) {
            console.error('Error fetching event types:', error);
            return [];
        }

        // Get unique event types
        const eventTypes = [...new Set(data?.map(e => e.event_type) || [])];
        return eventTypes.sort();
    } catch (error) {
        console.error('Exception fetching event types:', error);
        return [];
    }
}

/**
 * Get unique users/sessions for a document
 */
export async function getDocumentUsers(documentId: string): Promise<{ emails: string[]; sessions: string[] }> {
    try {
        const { data, error } = await supabase
            .from('audit_events')
            .select('user_email, session_id')
            .eq('document_id', documentId);

        if (error) {
            console.error('Error fetching users:', error);
            return { emails: [], sessions: [] };
        }

        const emails = [...new Set(data?.map(e => e.user_email).filter(Boolean) || [])];
        const sessions = [...new Set(data?.map(e => e.session_id).filter(Boolean) || [])];

        return { emails, sessions };
    } catch (error) {
        console.error('Exception fetching users:', error);
        return { emails: [], sessions: [] };
    }
}
