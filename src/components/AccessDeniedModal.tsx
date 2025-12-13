import React from 'react';
import { ShieldOff, AlertCircle, Clock, MapPin, Lock, XCircle, Mail } from 'lucide-react';

interface AccessDeniedModalProps {
    reason: string;
    documentName?: string;
    remainingViews?: number | null;
    onClose?: () => void;
    onContactOwner?: () => void;
}

const AccessDeniedModal: React.FC<AccessDeniedModalProps> = ({
    reason,
    documentName,
    remainingViews,
    onClose,
    onContactOwner
}) => {
    // Determine icon and color based on reason
    const getIconAndColor = () => {
        if (reason.includes('revoked')) {
            return { icon: <ShieldOff size={64} />, color: '#ef4444', bg: '#fee2e2' };
        }
        if (reason.includes('limit') || reason.includes('exceeded')) {
            return { icon: <XCircle size={64} />, color: '#f59e0b', bg: '#fef3c7' };
        }
        if (reason.includes('expired')) {
            return { icon: <Clock size={64} />, color: '#6b7280', bg: '#f3f4f6' };
        }
        if (reason.includes('location') || reason.includes('country')) {
            return { icon: <MapPin size={64} />, color: '#8b5cf6', bg: '#f3e8ff' };
        }
        if (reason.includes('session') || reason.includes('token')) {
            return { icon: <Lock size={64} />, color: '#3b82f6', bg: '#dbeafe' };
        }
        return { icon: <AlertCircle size={64} />, color: '#dc2626', bg: '#fee2e2' };
    };

    const { icon, color, bg } = getIconAndColor();

    // Get helpful message based on reason
    const getHelpfulMessage = () => {
        if (reason.includes('view limit')) {
            return 'This document has reached its maximum number of views.';
        }
        if (reason.includes('device limit')) {
            return 'This document has reached its maximum number of allowed devices.';
        }
        if (reason.includes('revoked')) {
            return 'The document owner has revoked access to this document.';
        }
        if (reason.includes('expired')) {
            return 'The access period for this document has ended.';
        }
        if (reason.includes('location')) {
            return 'This document is not accessible from your current location.';
        }
        if (reason.includes('day')) {
            return 'This document is not accessible on this day of the week.';
        }
        if (reason.includes('permitted between')) {
            return reason; // Already has time range info
        }
        if (reason.includes('session') || reason.includes('token')) {
            return 'Your access session is invalid or has expired.';
        }
        return reason;
    };

    const helpfulMessage = getHelpfulMessage();

    // Get suggestions
    const getSuggestions = () => {
        const suggestions: string[] = [];

        if (reason.includes('expired')) {
            suggestions.push('Contact the document owner to request an extension');
        }
        if (reason.includes('revoked')) {
            suggestions.push('Contact the document owner for more information');
        }
        if (reason.includes('location') || reason.includes('country')) {
            suggestions.push('Use a VPN from an allowed location (if permitted)');
            suggestions.push('Contact the owner to add your location to the allowed list');
        }
        if (reason.includes('device')) {
            suggestions.push('Try accessing from a device that has already viewed this document');
            suggestions.push('Contact the owner to request additional device slots');
        }
        if (reason.includes('session')) {
            suggestions.push('Try refreshing the page');
            suggestions.push('Clear your browser cache and try again');
        }

        return suggestions;
    };

    const suggestions = getSuggestions();

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                background: 'rgba(0, 0, 0, 0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '1rem'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: '24px',
                    maxWidth: '500px',
                    width: '100%',
                    padding: '2.5rem',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    position: 'relative'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Icon */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{
                        width: '120px',
                        height: '120px',
                        borderRadius: '50%',
                        background: bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: color
                    }}>
                        {icon}
                    </div>
                </div>

                {/* Title */}
                <h2 style={{
                    fontSize: '1.75rem',
                    fontWeight: '700',
                    color: '#111827',
                    textAlign: 'center',
                    marginBottom: '0.75rem'
                }}>
                    Access Denied
                </h2>

                {/* Document name */}
                {documentName && (
                    <p style={{
                        textAlign: 'center',
                        color: '#6b7280',
                        fontSize: '0.875rem',
                        marginBottom: '1.5rem'
                    }}>
                        {documentName}
                    </p>
                )}

                {/* Main message */}
                <div style={{
                    padding: '1.25rem',
                    background: '#f9fafb',
                    borderRadius: '12px',
                    marginBottom: '1.5rem',
                    border: `1px solid ${bg}`
                }}>
                    <p style={{
                        color: '#374151',
                        fontSize: '1rem',
                        lineHeight: '1.6',
                        margin: 0,
                        textAlign: 'center'
                    }}>
                        {helpfulMessage}
                    </p>
                </div>

                {/* Remaining views counter */}
                {remainingViews !== null && remainingViews !== undefined && remainingViews > 0 && (
                    <div style={{
                        padding: '1rem',
                        background: '#fef3c7',
                        borderRadius: '8px',
                        marginBottom: '1.5rem',
                        textAlign: 'center',
                        border: '1px solid #fde047'
                    }}>
                        <p style={{
                            margin: 0,
                            color: '#92400e',
                            fontSize: '0.875rem'
                        }}>
                            {remainingViews} {remainingViews === 1 ? 'view' : 'views'} remaining
                        </p>
                    </div>
                )}

                {/* Suggestions */}
                {suggestions.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                        <p style={{
                            fontSize: '0.875rem',
                            fontWeight: '600',
                            color: '#374151',
                            marginBottom: '0.75rem'
                        }}>
                            What you can do:
                        </p>
                        <ul style={{
                            margin: 0,
                            paddingLeft: '1.25rem',
                            color: '#6b7280',
                            fontSize: '0.875rem',
                            lineHeight: '1.6'
                        }}>
                            {suggestions.map((suggestion, index) => (
                                <li key={index} style={{ marginBottom: '0.5rem' }}>
                                    {suggestion}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Actions */}
                <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    flexDirection: 'column'
                }}>
                    {onContactOwner && (
                        <button
                            onClick={onContactOwner}
                            style={{
                                padding: '0.875rem 1.5rem',
                                background: color,
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'opacity 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
                            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
                        >
                            <Mail size={18} />
                            Contact Document Owner
                        </button>
                    )}

                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                padding: '0.875rem 1.5rem',
                                background: 'white',
                                color: '#374151',
                                border: '1px solid #d1d5db',
                                borderRadius: '10px',
                                fontWeight: '600',
                                fontSize: '1rem',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseOver={(e) => e.currentTarget.style.background = '#f9fafb'}
                            onMouseOut={(e) => e.currentTarget.style.background = 'white'}
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AccessDeniedModal;
