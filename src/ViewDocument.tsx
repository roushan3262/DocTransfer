import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { decryptFile } from './lib/crypto';
import { comparePassword, rateLimiter } from './lib/security';
import { FileText, Download, Shield, AlertCircle, Lock as LockIcon, Mail } from 'lucide-react';

interface DocumentData {
    id: string;
    name: string;
    file_path: string;
    file_size: number;
    file_type: string;
    storage_type?: string;
    google_drive_link?: string;
    password?: string;
    allow_download: boolean;
    expires_at?: string;
    screenshot_protection: boolean;
    email_verification: boolean;
    allowed_email?: string;
    // Encryption fields
    is_encrypted?: boolean;
    encryption_key?: string;
    encryption_iv?: string;
    original_file_type?: string;
}

const ViewDocument: React.FC = () => {
    const { shareLink } = useParams<{ shareLink: string }>();
    const [document, setDocument] = useState<DocumentData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [passwordInput, setPasswordInput] = useState('');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [downloading, setDownloading] = useState(false);

    // Email Verification State
    const [email, setEmail] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [sentCode, setSentCode] = useState<string | null>(null);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [showCodeInput, setShowCodeInput] = useState(false);

    // Branding State
    const [branding, setBranding] = useState<{
        logo_url?: string;
        brand_color?: string;
        site_url?: string;
    } | null>(null);

    useEffect(() => {
        fetchDocument();
    }, [shareLink]);

    const fetchDocument = async () => {
        try {
            const { data, error } = await supabase
                .from('documents')
                .select('*')
                .eq('share_link', shareLink)
                .single();

            if (error) throw error;

            setDocument(data);

            // Fetch branding settings
            if (data.user_id) {
                const { data: brandingData } = await supabase
                    .from('branding_settings')
                    .select('logo_url, brand_color, site_url')
                    .eq('user_id', data.user_id)
                    .single();
                if (brandingData) setBranding(brandingData);
            }

            // Track View
            trackView(data.id);

            // Check for expiration
            if (data.expires_at) {
                const expirationDate = new Date(data.expires_at);
                const now = new Date();
                // Set to end of day for expiration date
                expirationDate.setHours(23, 59, 59, 999);

                if (now > expirationDate) {
                    setError('This link has expired.');
                    return;
                }
            }

            // Auto-authenticate logic
            // If NO password AND NO email verification -> Authenticated
            if ((!data.password || data.password === '') && !data.email_verification) {
                setIsAuthenticated(true);
            }

            // If ONLY password -> Authenticated = false (handled by UI)
            // If ONLY email -> Authenticated = true (but blocked by email UI)
            // If BOTH -> Authenticated = false (password first), then blocked by email UI

            if (!data.password || data.password === '') {
                setIsAuthenticated(true);
            }

        } catch (err: any) {
            console.error('Error fetching document:', err);
            setError('Document not found or link expired.');
        } finally {
            setLoading(false);
        }
    };

    const trackView = async (documentId: string) => {
        try {
            // 1. Create Session
            let geoData = null;
            try {
                const res = await fetch('https://geolocation-db.com/json/');
                geoData = await res.json();
            } catch (e) {
                console.warn('Failed to fetch geolocation', e);
            }

            const { data: sessionData, error: sessionError } = await supabase
                .from('document_access_sessions')
                .insert({
                    document_id: documentId,
                    user_agent: navigator.userAgent,
                    geolocation: geoData
                })
                .select('session_id') // Correct column name
                .single();

            if (sessionError) {
                console.error('Session creation failed:', sessionError);
                return;
            }

            if (sessionData) {
                // 2. Track View (Initial)
                const { data: viewData, error: viewError } = await supabase
                    .from('document_view_tracking')
                    .insert({
                        session_id: sessionData.session_id,
                        document_id: documentId,
                        page_number: 1 // Default to page 1 for now
                    })
                    .select('id')
                    .single();

                if (viewData && !viewError) {
                    // Set up duration tracking
                    const startTime = Date.now();
                    const updateDuration = () => {
                        const duration = Math.round((Date.now() - startTime) / 1000);
                        if (duration > 0) {
                            supabase
                                .from('document_view_tracking')
                                .update({ duration_seconds: duration })
                                .eq('id', viewData.id)
                                .then(() => { }); // Fire and forget
                        }
                    };

                    // Update on unmount or page hide
                    window.addEventListener('beforeunload', updateDuration);
                    // Also update every 10 seconds for real-time feel
                    const intervalId = setInterval(updateDuration, 10000);

                    return () => {
                        window.removeEventListener('beforeunload', updateDuration);
                        clearInterval(intervalId);
                        updateDuration();
                    };
                }
            }
        } catch (err) {
            console.error('Error tracking view:', err);
        }
    };

    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (document?.password && await comparePassword(passwordInput, document.password)) {
            setIsAuthenticated(true);
        } else {
            alert('Incorrect password');
        }
    };

    const handleSendCode = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email) return;

        // Rate limiting: Only allow one code every 60 seconds per email
        const rateCheck = rateLimiter.check(email, 1, 60000);
        if (!rateCheck.allowed) {
            alert(`Please wait ${rateCheck.waitTime} seconds before requesting a new code.`);
            return;
        }

        // Check if specific email is required
        if (document?.allowed_email && document.allowed_email !== email) {
            alert('Access denied. This document is not shared with this email address.');
            return;
        }

        // Generate verification code
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setSentCode(code);
        setShowCodeInput(true);

        // TODO: In production, integrate real email service (Resend/SendGrid/AWS SES)
        alert(`Verification code sent to ${email}. Check your email.`);

        // Development only - show code in console
        if (import.meta.env.DEV) {
            console.log(`[DEV ONLY] Verification code: ${code}`);
        }
    };

    const handleVerifyCode = (e: React.FormEvent) => {
        e.preventDefault();
        if (verificationCode === sentCode) {
            setIsEmailVerified(true);
        } else {
            alert('Invalid code');
        }
    };

    const handleDownload = async () => {
        if (!document) return;
        setDownloading(true);

        try {
            // Check if it's a Google Drive link
            if (document.storage_type === 'google_drive' && document.google_drive_link) {
                // Redirect to Google Drive
                window.location.href = document.google_drive_link;
                return;
            }

            // Handle Supabase storage download
            const { data, error } = await supabase.storage
                .from('documents')
                .download(document.file_path);

            if (error) throw error;

            let blob = data;

            // Decrypt if encrypted
            if (document.is_encrypted && document.encryption_key && document.encryption_iv) {
                try {
                    blob = await decryptFile(
                        data,
                        document.encryption_key,
                        document.encryption_iv,
                        document.original_file_type || document.file_type
                    );
                } catch (decryptError) {
                    console.error('Decryption failed:', decryptError);
                    alert('Failed to decrypt file. The key may be invalid.');
                    return;
                }
            }

            // Create download link
            const url = window.URL.createObjectURL(blob);
            const a = window.document.createElement('a');
            a.href = url;
            a.download = document.name;
            window.document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            window.document.body.removeChild(a);
        } catch (err: any) {
            console.error('Download error:', err);
            alert('Failed to download file.');
        } finally {
            setDownloading(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div className="animate-spin" style={{ width: '32px', height: '32px', border: '3px solid #e5e7eb', borderTopColor: '#4f46e5', borderRadius: '50%' }}></div>
            </div>
        );
    }

    if (error || !document) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>Link Invalid</h2>
                    <p style={{ color: '#6b7280' }}>{error || "This link is invalid or has expired."}</p>
                </div>
            </div>
        );
    }

    // Determine what to show
    const showPasswordScreen = document.password && !isAuthenticated;
    const showEmailScreen = document.email_verification && !isEmailVerified && !showPasswordScreen;
    const showContent = !showPasswordScreen && !showEmailScreen;

    return (
        <div
            style={{
                minHeight: '100vh',
                background: '#f3f4f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                userSelect: document.screenshot_protection ? 'none' : 'auto',
                WebkitUserSelect: document.screenshot_protection ? 'none' : 'auto'
            }}
            onContextMenu={(e) => {
                if (document.screenshot_protection) {
                    e.preventDefault();
                }
            }}
        >
            {document.screenshot_protection && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: 9999,
                    backgroundImage: 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' version=\'1.1\' height=\'100px\' width=\'100px\'><text transform=\'translate(20, 100) rotate(-45)\' fill=\'rgba(0,0,0,0.05)\' font-size=\'20\'>Protected View</text></svg>")'
                }} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', maxWidth: '480px' }}>
                {branding?.logo_url && (
                    <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        {branding.site_url ? (
                            <a href={branding.site_url} target="_blank" rel="noopener noreferrer">
                                <img src={branding.logo_url} alt="Company Logo" style={{ height: '60px', objectFit: 'contain' }} />
                            </a>
                        ) : (
                            <img src={branding.logo_url} alt="Company Logo" style={{ height: '60px', objectFit: 'contain' }} />
                        )}
                    </div>
                )}

                <div style={{ width: '100%', background: 'white', borderRadius: '24px', padding: '2.5rem', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>

                    <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                        <div style={{
                            width: '80px',
                            height: '80px',
                            background: branding?.brand_color ? `${branding.brand_color}20` : '#e0e7ff',
                            borderRadius: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 1.5rem',
                            color: branding?.brand_color || '#4f46e5'
                        }}>
                            <FileText size={40} />
                        </div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#111827', marginBottom: '0.5rem' }}>{document.name}</h1>
                        <p style={{ color: '#6b7280', fontSize: '0.95rem' }}>
                            {document.storage_type === 'google_drive' ? (
                                <>{document.file_type}</>
                            ) : (
                                <>{(document.file_size / 1024 / 1024).toFixed(2)} MB • {document.file_type.split('/')[1]?.toUpperCase() || 'FILE'}</>
                            )}
                        </p>
                    </div>

                    {showPasswordScreen && (
                        <form onSubmit={handlePasswordSubmit}>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                                    This file is password protected
                                </label>
                                <div style={{ position: 'relative' }}>
                                    <LockIcon style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                                    <input
                                        type="password"
                                        value={passwordInput}
                                        onChange={(e) => setPasswordInput(e.target.value)}
                                        placeholder="Enter password"
                                        style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', border: '1px solid #d1d5db', borderRadius: '12px', outline: 'none', fontSize: '1rem' }}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.875rem', background: branding?.brand_color || '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}>
                                Unlock File
                            </button>
                        </form>
                    )}

                    {showEmailScreen && (
                        <div>
                            {!showCodeInput ? (
                                <form onSubmit={handleSendCode}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                                            Email Verification Required
                                        </label>
                                        <div style={{ position: 'relative' }}>
                                            <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} size={18} />
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                placeholder="Enter your email"
                                                required
                                                style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', border: '1px solid #d1d5db', borderRadius: '12px', outline: 'none', fontSize: '1rem' }}
                                            />
                                        </div>
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.875rem', background: branding?.brand_color || '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}>
                                        Send Verification Code
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyCode}>
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: '500', color: '#374151', marginBottom: '0.5rem' }}>
                                            Enter Verification Code
                                        </label>
                                        <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '1rem' }}>
                                            Code sent to {email}
                                        </p>
                                        <input
                                            type="text"
                                            value={verificationCode}
                                            onChange={(e) => setVerificationCode(e.target.value)}
                                            placeholder="000000"
                                            maxLength={6}
                                            style={{ width: '100%', padding: '0.75rem 1rem', border: '1px solid #d1d5db', borderRadius: '12px', outline: 'none', fontSize: '1.25rem', letterSpacing: '0.25rem', textAlign: 'center' }}
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" style={{ width: '100%', padding: '0.875rem', background: branding?.brand_color || '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '1rem' }}>
                                        Verify & Access
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowCodeInput(false)}
                                        style={{ width: '100%', marginTop: '1rem', background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.9rem' }}
                                    >
                                        Change Email
                                    </button>
                                </form>
                            )}
                        </div>
                    )}

                    {showContent && (
                        <div className="animate-fade-in">
                            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <Shield size={20} color="#16a34a" />
                                <span style={{ color: '#15803d', fontSize: '0.9rem', fontWeight: '500' }}>File is secure and ready to download</span>
                            </div>

                            {document.allow_download ? (
                                <button
                                    onClick={handleDownload}
                                    disabled={downloading}
                                    className="btn-primary"
                                    style={{ width: '100%', padding: '1rem', background: branding?.brand_color || '#4f46e5', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer', fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.2s' }}
                                >
                                    {downloading ? 'Opening...' : (
                                        <>
                                            <Download size={24} />
                                            {document.storage_type === 'google_drive' ? 'Open in Google Drive' : 'Download File'}
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div style={{ textAlign: 'center', padding: '1rem', background: '#fef2f2', borderRadius: '12px', color: '#dc2626' }}>
                                    <AlertCircle size={24} style={{ marginBottom: '0.5rem' }} />
                                    <p>Downloads are disabled for this file.</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ViewDocument;
