import React, { useEffect, useState, useRef } from 'react';
import { Shield, Eye, Clock } from 'lucide-react';
import { validateAccess, trackView, createAccessSession } from '../lib/drmController';
import { generateDeviceFingerprint } from '../lib/deviceFingerprint';
import { getUserIP } from '../lib/auditLogger';
import { applyWatermark } from '../lib/watermarkGenerator';
import { enableCopyProtection } from '../lib/copyProtection';
import type CopyProtection from '../lib/copyProtection';
import AccessDeniedModal from './AccessDeniedModal';

interface DRMProtectedViewerProps {
    documentId: string;
    documentName: string;
    children: React.ReactNode;
    containerId?: string;
}

const DRMProtectedViewer: React.FC<DRMProtectedViewerProps> = ({
    documentId,
    documentName,
    children,
    containerId = 'drm-protected-content'
}) => {
    const [loading, setLoading] = useState(true);
    const [accessAllowed, setAccessAllowed] = useState(false);
    const [denialReason, setDenialReason] = useState<string>('');
    const [remainingViews, setRemainingViews] = useState<number | null>(null);
    const [sessionToken, setSessionToken] = useState<string | null>(null);
    const protectionRef = useRef<CopyProtection | null>(null);

    useEffect(() => {
        initializeAccess();

        // Cleanup on unmount
        return () => {
            if (protectionRef.current) {
                protectionRef.current.disable();
            }
        };
    }, [documentId]);

    const initializeAccess = async () => {
        try {
            // Check for existing session token
            let token = localStorage.getItem(`drm_session_${documentId}`);

            // If no token, create new session
            if (!token) {
                const fingerprint = await generateDeviceFingerprint();
                const ip = await getUserIP();

                const sessionResult = await createAccessSession(documentId, {
                    ip,
                    userAgent: navigator.userAgent,
                    deviceFingerprint: fingerprint
                });

                if (!sessionResult.success) {
                    setAccessAllowed(false);
                    setDenialReason(sessionResult.error || 'Failed to create access session');
                    setLoading(false);
                    return;
                }

                token = sessionResult.sessionToken!;
                localStorage.setItem(`drm_session_${documentId}`, token);
            }

            // Validate access
            const validation = await validateAccess(documentId, token);

            if (!validation.allowed) {
                setAccessAllowed(false);
                setDenialReason(validation.reason || 'Access denied');
                setRemainingViews(validation.remainingViews ?? null);

                // Clear invalid token
                localStorage.removeItem(`drm_session_${documentId}`);
                setLoading(false);
                return;
            }

            // Access granted
            setSessionToken(token);
            setAccessAllowed(true);
            setRemainingViews(validation.remainingViews ?? null);

            // Track view
            await trackView(token);

            // Apply DRM protections
            if (validation.drmSettings) {
                // Apply watermark if required
                if (validation.watermarkData) {
                    setTimeout(() => {
                        applyWatermark(containerId, {
                            text: validation.watermarkData!.text,
                            opacity: validation.watermarkData!.opacity,
                            position: validation.watermarkData!.position as any
                        });
                    }, 100);
                }

                // Enable copy protection
                setTimeout(() => {
                    const protection = enableCopyProtection(containerId, {
                        preventCopy: validation.drmSettings?.preventCopy,
                        preventPrint: validation.drmSettings?.preventPrint,
                        preventScreenshot: validation.drmSettings?.preventScreenshot,
                        preventContextMenu: true,
                        preventTextSelection: validation.drmSettings?.preventCopy,
                        onViolationAttempt: (type) => {
                            console.log(`[DRM] Protection violation: ${type}`);
                            // You can log this to audit trail
                        }
                    });
                    protectionRef.current = protection;
                }, 100);
            }

            setLoading(false);
        } catch (error) {
            console.error('Error initializing DRM:', error);
            setAccessAllowed(false);
            setDenialReason('An error occurred while checking access');
            setLoading(false);
        }
    };

    const handleContactOwner = () => {
        // Implement contact owner functionality
        // Could open email, show contact form, etc.
        alert('Contact owner functionality - to be implemented');
    };

    const handleClose = () => {
        // Navigate away or close window
        window.history.back();
    };

    if (loading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
                gap: '1rem'
            }}>
                <Shield size={48} color="#4f46e5" className="animate-pulse" />
                <p style={{ color: '#6b7280', fontSize: '1rem' }}>
                    Validating access permissions...
                </p>
            </div>
        );
    }

    if (!accessAllowed) {
        return (
            <AccessDeniedModal
                reason={denialReason}
                documentName={documentName}
                remainingViews={remainingViews}
                onContactOwner={handleContactOwner}
                onClose={handleClose}
            />
        );
    }

    return (
        <div>
            {/* DRM Status Banner */}
            <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '0.875rem 1.5rem',
                borderRadius: '12px',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield size={20} />
                    <span style={{ fontWeight: '600', fontSize: '0.875rem' }}>
                        Protected Document
                    </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                    {remainingViews !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Eye size={16} />
                            <span style={{ fontSize: '0.875rem' }}>
                                {remainingViews} views left
                            </span>
                        </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Clock size={16} />
                        <span style={{ fontSize: '0.875rem' }}>
                            Session active
                        </span>
                    </div>
                </div>
            </div>

            {/* Protected Content */}
            <div
                id={containerId}
                style={{
                    position: 'relative',
                    minHeight: '400px'
                }}
            >
                {children}
            </div>

            {/* Invisible tracking pixel */}
            <img
                src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
                alt=""
                style={{ display: 'none' }}
                onLoad={() => {
                    // Track page view loaded
                    if (sessionToken) {
                        trackView(sessionToken);
                    }
                }}
            />
        </div>
    );
};

export default DRMProtectedViewer;
