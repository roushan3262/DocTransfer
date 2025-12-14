import React, { useState } from 'react';
import { Fingerprint, Smartphone, AlertCircle } from 'lucide-react';
import { authenticateBiometric } from '../lib/webauthn';

interface BiometricGateProps {
    onVerified: () => void;
    documentName: string;
    credentialId?: string; // Base64-encoded credential ID from registration
}

const BiometricGate: React.FC<BiometricGateProps> = ({ onVerified, documentName, credentialId }) => {
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleVerification = async () => {
        setVerifying(true);
        setError(null);

        try {
            // Check if credential ID exists
            if (!credentialId) {
                setError('This document requires biometric authentication, but no biometric credential was registered. Please contact the document owner.');
                setVerifying(false);
                return;
            }

            // Authenticate using the stored credential
            const result = await authenticateBiometric(credentialId);

            if (result.success) {
                // Success! Call the callback
                onVerified();
            } else {
                setError(result.error || 'Authentication failed. Please try again.');
            }

        } catch (err: any) {
            console.error('Biometric error:', err);
            setError('Verification failed. Please ensure you are using a device with biometric capabilities (TouchID, FaceID, Windows Hello).');
        } finally {
            setVerifying(false);
        }
    };

    return (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '480px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: '#f0fdf4',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: '#16a34a'
                }}>
                    <Fingerprint size={30} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>Identity Verification</h2>
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                    Accessing <strong>{documentName}</strong> requires biometric verification.
                </p>
                <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    Use the same device and fingerprint that was used to lock this file.
                </p>
            </div>

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '16px', padding: '2rem', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '2rem', opacity: 0.5 }}>
                    <Smartphone size={48} />
                    <Fingerprint size={48} />
                </div>

                <button
                    onClick={handleVerification}
                    disabled={verifying || !credentialId}
                    className="btn-primary"
                    style={{
                        width: '100%',
                        padding: '1rem',
                        background: credentialId ? '#16a34a' : '#9ca3af',
                        color: 'white',
                        border: 'none',
                        borderRadius: '12px',
                        fontWeight: '600',
                        cursor: credentialId ? 'pointer' : 'not-allowed',
                        fontSize: '1.1rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s',
                        boxShadow: credentialId ? '0 4px 6px -1px rgba(22, 163, 74, 0.2)' : 'none'
                    }}
                >
                    {verifying ? 'Verifying...' : (
                        <>
                            <Fingerprint size={24} /> Verify Identity
                        </>
                    )}
                </button>
            </div>

            {error && (
                <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', fontSize: '0.875rem', display: 'flex', alignItems: 'flex-start', gap: '0.5rem', textAlign: 'left' }}>
                    <AlertCircle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{error}</span>
                </div>
            )}
        </div>
    );
};

export default BiometricGate;
