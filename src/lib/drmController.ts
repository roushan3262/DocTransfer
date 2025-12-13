import { supabase } from './supabase';
import { getUserIP, getGeolocation } from './auditLogger';
import { generateDeviceFingerprint } from './deviceFingerprint';

/**
 * DRM Settings Interface
 */
export interface DRMSettings {
    maxViews?: number | null;
    maxUniqueDevices?: number | null;
    preventCopy: boolean;
    preventPrint: boolean;
    preventDownload: boolean;
    preventScreenshot: boolean;
    requireWatermark: boolean;
    watermarkText?: string;
    watermarkOpacity?: number;
    watermarkPosition?: 'diagonal' | 'center' | 'bottom' | 'top';
    accessExpiresAt?: Date | null;
    allowedIpRanges?: string[];
    allowedCountries?: string[];
    blockedCountries?: string[];
    allowedDaysOfWeek?: number[];
    allowedHoursStart?: number | null;
    allowedHoursEnd?: number | null;
}

/**
 * Access Validation Result
 */
export interface AccessValidationResult {
    allowed: boolean;
    reason?: string;
    sessionToken?: string;
    remainingViews?: number | null;
    drmSettings?: DRMSettings;
    watermarkData?: {
        text: string;
        opacity: number;
        position: string;
    };
}

/**
 * Access Session Context
 */
interface AccessContext {
    ip: string;
    userAgent: string;
    deviceFingerprint: string;
}

/**
 * Create a new access session for a document
 */
export async function createAccessSession(
    documentId: string,
    context: AccessContext
): Promise<{ success: boolean; sessionToken?: string; error?: string }> {
    try {
        // Get geolocation from IP
        const geolocation = await getGeolocation(context.ip);

        // Generate unique session token
        const sessionToken = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        // Insert session
        const { error } = await supabase
            .from('document_access_sessions')
            .insert({
                document_id: documentId,
                session_token: sessionToken,
                ip_address: context.ip,
                device_fingerprint: context.deviceFingerprint,
                user_agent: context.userAgent,
                geolocation: geolocation,
                access_count: 0,
                is_revoked: false
            });

        if (error) {
            console.error('Error creating access session:', error);
            return { success: false, error: error.message };
        }

        return { success: true, sessionToken };
    } catch (error) {
        console.error('Exception creating access session:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Validate if access to a document is allowed
 */
export async function validateAccess(
    documentId: string,
    sessionToken?: string
): Promise<AccessValidationResult> {
    try {
        // Check if document has DRM enabled
        const { data: document, error: docError } = await supabase
            .from('documents')
            .select('drm_enabled')
            .eq('id', documentId)
            .single();

        if (docError || !document) {
            return { allowed: false, reason: 'Document not found' };
        }

        // If DRM not enabled, allow access
        if (!document.drm_enabled) {
            return { allowed: true };
        }

        // Get DRM settings
        const { data: drmSettings, error: drmError } = await supabase
            .from('document_drm_settings')
            .select('*')
            .eq('document_id', documentId)
            .single();

        if (drmError) {
            console.error('Error fetching DRM settings:', drmError);
            return { allowed: false, reason: 'Failed to load access settings' };
        }

        // If no session token provided, it's a new access attempt
        if (!sessionToken) {
            return {
                allowed: false,
                reason: 'Session token required',
                drmSettings: drmSettings as DRMSettings
            };
        }

        // Validate session exists and is not revoked
        const { data: session, error: sessionError } = await supabase
            .from('document_access_sessions')
            .select('*')
            .eq('session_token', sessionToken)
            .eq('document_id', documentId)
            .single();

        if (sessionError || !session) {
            return { allowed: false, reason: 'Invalid or expired session' };
        }

        if (session.is_revoked) {
            return {
                allowed: false,
                reason: session.revoked_reason || 'Access has been revoked'
            };
        }

        // Check access expiration
        if (drmSettings.access_expires_at) {
            const expiryDate = new Date(drmSettings.access_expires_at);
            if (expiryDate < new Date()) {
                return { allowed: false, reason: 'Access has expired' };
            }
        }

        // Check time-based access (day of week)
        if (drmSettings.allowed_days_of_week && drmSettings.allowed_days_of_week.length > 0) {
            const currentDay = new Date().getDay();
            if (!drmSettings.allowed_days_of_week.includes(currentDay)) {
                return { allowed: false, reason: 'Access not permitted on this day' };
            }
        }

        // Check time-based access (hours)
        if (drmSettings.allowed_hours_start !== null && drmSettings.allowed_hours_end !== null) {
            const currentHour = new Date().getHours();
            if (currentHour < drmSettings.allowed_hours_start || currentHour > drmSettings.allowed_hours_end) {
                return {
                    allowed: false,
                    reason: `Access only permitted between ${drmSettings.allowed_hours_start}:00 and ${drmSettings.allowed_hours_end}:00`
                };
            }
        }

        // Check country restrictions
        if (session.geolocation) {
            const country = session.geolocation.countryCode;

            // Check blocked countries
            if (drmSettings.blocked_countries && drmSettings.blocked_countries.includes(country)) {
                return { allowed: false, reason: 'Access blocked from your location' };
            }

            // Check allowed countries (if specified)
            if (drmSettings.allowed_countries && drmSettings.allowed_countries.length > 0) {
                if (!drmSettings.allowed_countries.includes(country)) {
                    return { allowed: false, reason: 'Access not permitted from your location' };
                }
            }
        }

        // Check view limits
        if (drmSettings.max_views !== null) {
            const { count: viewCount } = await supabase
                .from('document_view_tracking')
                .select('*', { count: 'exact', head: true })
                .eq('document_id', documentId);

            if (viewCount !== null && viewCount >= drmSettings.max_views) {
                return {
                    allowed: false,
                    reason: 'Maximum view limit reached',
                    remainingViews: 0
                };
            }
        }

        // Calculate remaining views
        let remainingViews: number | null = null;
        if (drmSettings.max_views !== null) {
            const { count: viewCount } = await supabase
                .from('document_view_tracking')
                .select('*', { count: 'exact', head: true })
                .eq('document_id', documentId);

            remainingViews = drmSettings.max_views - (viewCount || 0);
        }

        // Build watermark data if required
        let watermarkData = undefined;
        if (drmSettings.require_watermark) {
            const timestamp = new Date().toLocaleString();
            const watermarkText = drmSettings.watermark_text ||
                `${session.ip_address} - ${timestamp}`;

            watermarkData = {
                text: watermarkText,
                opacity: drmSettings.watermark_opacity || 0.3,
                position: drmSettings.watermark_position || 'diagonal'
            };
        }

        // Access allowed
        return {
            allowed: true,
            sessionToken,
            remainingViews,
            drmSettings: drmSettings as DRMSettings,
            watermarkData
        };

    } catch (error) {
        console.error('Exception validating access:', error);
        return { allowed: false, reason: 'Validation error occurred' };
    }
}

/**
 * Track a view event for a session
 */
export async function trackView(
    sessionToken: string,
    pageNumber?: number
): Promise<{ success: boolean; error?: string }> {
    try {
        // Get session info
        const { data: session, error: sessionError } = await supabase
            .from('document_access_sessions')
            .select('document_id, id, ip_address')
            .eq('session_token', sessionToken)
            .single();

        if (sessionError || !session) {
            return { success: false, error: 'Session not found' };
        }

        // Insert view record
        const { error } = await supabase
            .from('document_view_tracking')
            .insert({
                document_id: session.document_id,
                session_id: session.id,
                page_number: pageNumber,
                ip_address: session.ip_address
            });

        if (error) {
            console.error('Error tracking view:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Exception tracking view:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Revoke all access to a document
 */
export async function revokeDocumentAccess(
    documentId: string,
    reason?: string
): Promise<{ success: boolean; revokedSessions: number; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('document_access_sessions')
            .update({
                is_revoked: true,
                revoked_at: new Date().toISOString(),
                revoked_reason: reason || 'Access revoked by document owner'
            })
            .eq('document_id', documentId)
            .eq('is_revoked', false)
            .select();

        if (error) {
            console.error('Error revoking access:', error);
            return { success: false, revokedSessions: 0, error: error.message };
        }

        // Update document
        await supabase
            .from('documents')
            .update({ last_access_revoked_at: new Date().toISOString() })
            .eq('id', documentId);

        return { success: true, revokedSessions: data?.length || 0 };
    } catch (error) {
        console.error('Exception revoking access:', error);
        return { success: false, revokedSessions: 0, error: String(error) };
    }
}

/**
 * Revoke a specific session
 */
export async function revokeSession(
    sessionToken: string,
    reason?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const { error } = await supabase
            .from('document_access_sessions')
            .update({
                is_revoked: true,
                revoked_at: new Date().toISOString(),
                revoked_reason: reason || 'Session revoked'
            })
            .eq('session_token', sessionToken);

        if (error) {
            console.error('Error revoking session:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Exception revoking session:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Get access statistics for a document
 */
export async function getAccessStats(documentId: string): Promise<{
    totalViews: number;
    uniqueDevices: number;
    activeSessions: number;
    revokedSessions: number;
    viewsByDevice: Array<{ fingerprint: string; count: number; lastAccess: string }>;
}> {
    try {
        // Get total views
        const { count: totalViews } = await supabase
            .from('document_view_tracking')
            .select('*', { count: 'exact', head: true })
            .eq('document_id', documentId);

        // Get sessions
        const { data: sessions } = await supabase
            .from('document_access_sessions')
            .select('*')
            .eq('document_id', documentId);

        const activeSessions = sessions?.filter(s => !s.is_revoked).length || 0;
        const revokedSessions = sessions?.filter(s => s.is_revoked).length || 0;

        // Get unique devices
        const uniqueFingerprints = new Set(
            sessions
                ?.filter(s => !s.is_revoked && s.device_fingerprint)
                .map(s => s.device_fingerprint)
        );
        const uniqueDevices = uniqueFingerprints.size;

        // Get views by device
        const viewsByDevice = Array.from(uniqueFingerprints).map(fingerprint => {
            const deviceSessions = sessions?.filter(s => s.device_fingerprint === fingerprint) || [];
            const count = deviceSessions.reduce((sum, s) => sum + (s.access_count || 0), 0);
            const lastAccess = deviceSessions
                .map(s => new Date(s.last_access_at))
                .sort((a, b) => b.getTime() - a.getTime())[0]
                ?.toISOString() || '';

            return {
                fingerprint,
                count,
                lastAccess
            };
        });

        return {
            totalViews: totalViews || 0,
            uniqueDevices,
            activeSessions,
            revokedSessions,
            viewsByDevice
        };
    } catch (error) {
        console.error('Exception getting access stats:', error);
        return {
            totalViews: 0,
            uniqueDevices: 0,
            activeSessions: 0,
            revokedSessions: 0,
            viewsByDevice: []
        };
    }
}

/**
 * Save or update DRM settings for a document
 */
export async function saveDRMSettings(
    documentId: string,
    settings: DRMSettings
): Promise<{ success: boolean; error?: string }> {
    try {
        // First, enable DRM on the document
        await supabase
            .from('documents')
            .update({ drm_enabled: true })
            .eq('id', documentId);

        // Upsert DRM settings
        const { error } = await supabase
            .from('document_drm_settings')
            .upsert({
                document_id: documentId,
                max_views: settings.maxViews,
                max_unique_devices: settings.maxUniqueDevices,
                prevent_copy: settings.preventCopy,
                prevent_print: settings.preventPrint,
                prevent_download: settings.preventDownload,
                prevent_screenshot: settings.preventScreenshot,
                require_watermark: settings.requireWatermark,
                watermark_text: settings.watermarkText,
                watermark_opacity: settings.watermarkOpacity || 0.3,
                watermark_position: settings.watermarkPosition || 'diagonal',
                access_expires_at: settings.accessExpiresAt?.toISOString(),
                allowed_ip_ranges: settings.allowedIpRanges,
                allowed_countries: settings.allowedCountries,
                blocked_countries: settings.blockedCountries,
                allowed_days_of_week: settings.allowedDaysOfWeek,
                allowed_hours_start: settings.allowedHoursStart,
                allowed_hours_end: settings.allowedHoursEnd,
                updated_at: new Date().toISOString()
            });

        if (error) {
            console.error('Error saving DRM settings:', error);
            return { success: false, error: error.message };
        }

        return { success: true };
    } catch (error) {
        console.error('Exception saving DRM settings:', error);
        return { success: false, error: String(error) };
    }
}

/**
 * Get DRM settings for a document
 */
export async function getDRMSettings(documentId: string): Promise<{ success: boolean; settings?: DRMSettings; error?: string }> {
    try {
        const { data, error } = await supabase
            .from('document_drm_settings')
            .select('*')
            .eq('document_id', documentId)
            .single();

        if (error && error.code !== 'PGRST116') {
            console.error('Error getting DRM settings:', error);
            return { success: false, error: error.message };
        }

        if (!data) {
            // No settings exist yet
            return {
                success: true,
                settings: {
                    preventCopy: false,
                    preventPrint: false,
                    preventDownload: false,
                    preventScreenshot: false,
                    requireWatermark: false
                }
            };
        }

        return { success: true, settings: data as DRMSettings };
    } catch (error) {
        console.error('Exception getting DRM settings:', error);
        return { success: false, error: String(error) };
    }
}
