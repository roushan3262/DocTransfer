import { supabase } from './supabase';

/**
 * Audit Event Interface
 * Represents a single audit trail event
 */
export interface AuditEvent {
    eventType: string;
    documentId?: string;
    signerId?: string;
    userEmail?: string;
    ipAddress?: string;
    userAgent?: string;
    metadata?: Record<string, any>;
    sessionId?: string;
}

/**
 * Get user's public IP address
 * Uses ipify API (free, no authentication required)
 */
export async function getUserIP(): Promise<string> {
    try {
        const response = await fetch('https://api.ipify.org?format=json');
        const data = await response.json();
        return data.ip || 'unknown';
    } catch (error) {
        console.error('Error fetching IP:', error);
        return 'unknown';
    }
}

/**
 * Get geolocation data from IP address
 * Uses ip-api.com (free, no key required, 45 req/min limit)
 */
export async function getGeolocation(ip: string): Promise<Record<string, any> | null> {
    if (!ip || ip === 'unknown') return null;

    try {
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const data = await response.json();

        if (data.status === 'success') {
            return {
                country: data.country,
                countryCode: data.countryCode,
                region: data.regionName,
                city: data.city,
                latitude: data.lat,
                longitude: data.lon,
                timezone: data.timezone,
                isp: data.isp
            };
        }
        return null;
    } catch (error) {
        console.error('Error fetching geolocation:', error);
        return null;
    }
}

/**
 * Generate or retrieve session ID from browser storage
 */
export function getSessionId(): string {
    const SESSION_KEY = 'doctransfer_session_id';

    // Try to get existing session
    let sessionId = sessionStorage.getItem(SESSION_KEY);

    if (!sessionId) {
        // Generate new session ID
        sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        sessionStorage.setItem(SESSION_KEY, sessionId);
    }

    return sessionId;
}

/**
 * Core function to log any audit event
 * This is the main entry point for all audit logging
 */
export async function logAuditEvent(event: AuditEvent): Promise<{ success: boolean; error?: string }> {
    try {
        // Get geolocation if IP is provided
        let geolocation = null;
        if (event.ipAddress && event.ipAddress !== 'unknown') {
            geolocation = await getGeolocation(event.ipAddress);
        }

        // Insert audit event
        const { error } = await supabase
            .from('audit_events')
            .insert({
                event_type: event.eventType,
                document_id: event.documentId || null,
                signer_id: event.signerId || null,
                user_email: event.userEmail || null,
                ip_address: event.ipAddress || null,
                user_agent: event.userAgent || null,
                geolocation: geolocation,
                event_metadata: event.metadata || null,
                session_id: event.sessionId || null,
                event_timestamp: new Date().toISOString()
            });

        if (error) {
            console.error('Error logging audit event:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Exception logging audit event:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Helper: Log document view event
 */
export async function logDocumentView(
    documentId: string,
    context?: {
        userEmail?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: 'document_viewed',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: context?.userEmail,
        metadata: context?.metadata
    });
}

/**
 * Helper: Log document download event
 */
export async function logDocumentDownload(
    documentId: string,
    context?: {
        userEmail?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: 'document_downloaded',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: context?.userEmail,
        metadata: context?.metadata
    });
}

/**
 * Helper: Log document upload event
 */
export async function logDocumentUpload(
    documentId: string,
    fileName: string,
    fileSize: number,
    context?: {
        userEmail?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: 'document_uploaded',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: context?.userEmail,
        metadata: {
            fileName,
            fileSize,
            ...context?.metadata
        }
    });
}

/**
 * Helper: Log link copy event
 */
export async function logLinkCopy(
    documentId: string,
    linkType: 'share' | 'signing'
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: 'link_copied',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        metadata: { linkType }
    });
}

/**
 * Helper: Log signature event
 */
export async function logSignatureEvent(
    documentId: string,
    signerId: string,
    status: 'requested' | 'viewed' | 'completed' | 'declined',
    context?: {
        userEmail?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const ip = await getUserIP();

    const eventTypeMap = {
        requested: 'signature_requested',
        viewed: 'signature_viewed',
        completed: 'signature_completed',
        declined: 'signature_declined'
    };

    await logAuditEvent({
        eventType: eventTypeMap[status],
        documentId,
        signerId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: context?.userEmail,
        metadata: context?.metadata
    });
}

/**
 * Helper: Log password verification event
 */
export async function logPasswordVerification(
    documentId: string,
    success: boolean
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: success ? 'password_verified' : 'password_failed',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        metadata: { success }
    });
}

/**
 * Helper: Log email verification event
 */
export async function logEmailVerification(
    documentId: string,
    email: string,
    success: boolean
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: success ? 'email_verified' : 'email_failed',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: email,
        metadata: { success }
    });
}

/**
 * Helper: Log settings change event
 */
export async function logSettingsChange(
    documentId: string,
    settingsChanged: string[],
    context?: {
        userEmail?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: 'settings_changed',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: context?.userEmail,
        metadata: {
            settingsChanged,
            ...context?.metadata
        }
    });
}

/**
 * Helper: Log export event
 */
export async function logExportEvent(
    documentId: string,
    exportType: 'csv' | 'pdf',
    context?: {
        userEmail?: string;
        metadata?: Record<string, any>;
    }
): Promise<void> {
    const ip = await getUserIP();

    await logAuditEvent({
        eventType: exportType === 'csv' ? 'audit_export_csv' : 'audit_export_pdf',
        documentId,
        ipAddress: ip,
        userAgent: navigator.userAgent,
        sessionId: getSessionId(),
        userEmail: context?.userEmail,
        metadata: {
            exportType,
            ...context?.metadata
        }
    });
}
/**
 * Fetch audit logs for a specific document or all documents
 */
export async function fetchAuditLogs(
    documentId?: string | string[],
    filters?: {
        limit?: number;
        offset?: number;
        eventType?: string;
    }
): Promise<{ data: any[]; count: number; error?: string }> {
    try {
        let query = supabase
            .from('recent_audit_activity')
            .select('*', { count: 'exact' });

        if (documentId) {
            if (Array.isArray(documentId)) {
                if (documentId.length > 0) {
                    query = query.in('document_id', documentId);
                } else {
                    // If empty array passed, return nothing (no documents to show logs for)
                    return { data: [], count: 0 };
                }
            } else {
                query = query.eq('document_id', documentId);
            }
        }

        if (filters?.eventType) {
            query = query.eq('event_type', filters.eventType);
        }

        query = query
            .order('event_timestamp', { ascending: false })
            .range(
                filters?.offset || 0,
                (filters?.offset || 0) + (filters?.limit || 50) - 1
            );

        const { data, count, error } = await query;

        if (error) {
            console.error('Error fetching audit logs:', error);
            return { data: [], count: 0, error: error.message };
        }

        return { data: data || [], count: count || 0 };
    } catch (error) {
        console.error('Exception fetching audit logs:', error);
        return { data: [], count: 0, error: String(error) };
    }
}
