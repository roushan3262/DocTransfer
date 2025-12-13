import React, { useState, useEffect } from 'react';
import { Key, Download, Upload, RefreshCw, Shield, AlertTriangle, Copy, Check } from 'lucide-react';
import {
    getUserKeys,
    generateUserKeys,
    exportKeysForBackup,
    importKeysFromBackup,
    rotateKeys,
    checkPasswordStrength,
    storeUserKeys,
    clearUserKeys
} from '../lib/keyManagement';
import type { UserKeys } from '../lib/keyManagement';

const KeyManagementDashboard: React.FC = () => {
    const [keys, setKeys] = useState<UserKeys | null>(null);
    const [loading, setLoading] = useState(true);
    const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
    const [masterPassword, setMasterPassword] = useState('');
    const [showRotateKeys, setShowRotateKeys] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        loadKeys();
    }, []);

    const loadKeys = () => {
        const userKeys = getUserKeys();
        setKeys(userKeys);
        setLoading(false);
    };

    const handleGenerateKeys = async () => {
        if (!masterPassword) {
            alert('Please enter a master password');
            return;
        }

        const strength = checkPasswordStrength(masterPassword);
        if (!strength.isStrong) {
            alert(`Weak password! ${strength.feedback.join(', ')}`);
            return;
        }

        setLoading(true);
        try {
            const newKeys = await generateUserKeys(masterPassword, 4096);
            storeUserKeys(newKeys);
            setKeys(newKeys);
            setShowPasswordPrompt(false);
            setMasterPassword('');
            alert('Encryption keys generated successfully!');
        } catch (error) {
            alert(`Failed to generate keys: ${error}`);
        }
        setLoading(false);
    };

    const handleExportKeys = () => {
        if (!keys) return;

        const backup = exportKeysForBackup(keys);
        const blob = new Blob([backup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `encryption-keys-backup-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImportKeys = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = e.target?.result as string;
                const importedKeys = importKeysFromBackup(backup);
                storeUserKeys(importedKeys);
                setKeys(importedKeys);
                alert('Keys imported successfully!');
            } catch (error) {
                alert(`Failed to import keys: ${error}`);
            }
        };
        reader.readAsText(file);
    };

    const handleRotateKeys = async () => {
        if (!keys || !masterPassword) return;

        const newPassword = prompt('Enter NEW master password:');
        if (!newPassword) return;

        const strength = checkPasswordStrength(newPassword);
        if (!strength.isStrong) {
            alert(`Weak password! ${strength.feedback.join(', ')}`);
            return;
        }

        setLoading(true);
        try {
            const newKeys = await rotateKeys(
                keys.privateKeyEncrypted,
                masterPassword,
                newPassword,
                4096
            );
            storeUserKeys(newKeys);
            setKeys(newKeys);
            setMasterPassword('');
            setShowRotateKeys(false);
            alert('Keys rotated successfully!');
        } catch (error) {
            alert(`Failed to rotate keys: ${error}`);
        }
        setLoading(false);
    };

    const copyFingerprint = () => {
        if (!keys) return;
        navigator.clipboard.writeText(keys.keyFingerprint);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return <div style={{ textAlign: 'center', padding: '3rem' }}>Loading...</div>;
    }

    if (!keys) {
        return (
            <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <Shield size={64} color="#4f46e5" style={{ marginBottom: '1rem' }} />
                    <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
                        Advanced Encryption
                    </h2>
                    <p style={{ color: '#6b7280' }}>
                        Generate your encryption keys to enable advanced security features
                    </p>
                </div>

                <div style={{ background: '#fef3c7', border: '1px solid #fde047', borderRadius: '12px', padding: '1.25rem', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <AlertTriangle size={24} color="#92400e" style={{ flexShrink: 0 }} />
                        <div>
                            <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#92400e', marginBottom: '0.5rem' }}>
                                Important: Key Management Responsibility
                            </h4>
                            <p style={{ fontSize: '0.875rem', color: '#78350f', lineHeight: '1.5' }}>
                                You are responsible for your encryption keys. If you lose your master password, your encrypted documents cannot be recovered. Make sure to backup your keys securely.
                            </p>
                        </div>
                    </div>
                </div>

                {!showPasswordPrompt ? (
                    <button
                        onClick={() => setShowPasswordPrompt(true)}
                        style={{
                            width: '100%',
                            padding: '1rem',
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '12px',
                            fontWeight: '600',
                            fontSize: '1rem',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Key size={20} />
                        Generate Encryption Keys
                    </button>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                Master Password
                            </label>
                            <input
                                type="password"
                                value={masterPassword}
                                onChange={(e) => setMasterPassword(e.target.value)}
                                placeholder="Enter a strong password"
                                style={{
                                    width: '100%',
                                    padding: '0.75rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontSize: '1rem'
                                }}
                            />
                            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                                At least 12 characters with uppercase, lowercase, numbers, and symbols
                            </p>
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleGenerateKeys}
                                disabled={!masterPassword}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    background: masterPassword ? '#4f46e5' : '#e5e7eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: masterPassword ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Generate Keys
                            </button>
                            <button
                                onClick={() => {
                                    setShowPasswordPrompt(false);
                                    setMasterPassword('');
                                }}
                                style={{
                                    padding: '0.875rem 1.5rem',
                                    background: 'white',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}>
                        or import existing keys
                    </p>
                    <label style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        background: 'white',
                        color: '#4f46e5',
                        border: '2px solid #4f46e5',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer'
                    }}>
                        <Upload size={18} />
                        Import Keys
                        <input type="file" accept=".json" onChange={handleImportKeys} style={{ display: 'none' }} />
                    </label>
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#111827', marginBottom: '2rem' }}>
                Encryption Key Management
            </h2>

            {/* Key Info Card */}
            <div style={{ background: 'white', borderRadius: '16px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                    <div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>
                            Your Encryption Keys
                        </h3>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                            Created: {new Date(keys.createdAt).toLocaleDateString()}
                        </p>
                    </div>
                    <div style={{
                        padding: '0.5rem 1rem',
                        background: '#d1fae5',
                        color: '#065f46',
                        borderRadius: '20px',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                    }}>
                        {keys.keyAlgorithm}
                    </div>
                </div>

                <div style={{ background: '#f9fafb', padding: '1.25rem', borderRadius: '12px', marginBottom: '1.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>
                        KEY FINGERPRINT
                    </div>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'white',
                        padding: '0.875rem',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                    }}>
                        <code style={{ fontSize: '0.875rem', color: '#111827', fontFamily: 'monospace' }}>
                            {keys.keyFingerprint}
                        </code>
                        <button
                            onClick={copyFingerprint}
                            style={{
                                padding: '0.5rem',
                                background: copied ? '#d1fae5' : '#f3f4f6',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                        >
                            {copied ? <Check size={16} color="#065f46" /> : <Copy size={16} color="#6b7280" />}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                    <button
                        onClick={handleExportKeys}
                        style={{
                            padding: '0.875rem',
                            background: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Download size={18} />
                        Backup
                    </button>

                    <button
                        onClick={() => setShowRotateKeys(true)}
                        style={{
                            padding: '0.875rem',
                            background: 'white',
                            color: '#4f46e5',
                            border: '2px solid #4f46e5',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <RefreshCw size={18} />
                        Rotate
                    </button>

                    <button
                        onClick={() => {
                            if (confirm('Delete encryption keys? This will make encrypted documents inaccessible!')) {
                                clearUserKeys();
                                setKeys(null);
                            }
                        }}
                        style={{
                            padding: '0.875rem',
                            background: 'white',
                            color: '#ef4444',
                            border: '2px solid #ef4444',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer'
                        }}
                    >
                        Delete
                    </button>
                </div>
            </div>

            {/* Rotate Keys Modal */}
            {showRotateKeys && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'white',
                        borderRadius: '16px',
                        padding: '2rem',
                        maxWidth: '500px',
                        width: '100%'
                    }}>
                        <h3 style={{ fontSize: '1.5rem', fontWeight: '700', marginBottom: '1rem' }}>
                            Rotate Encryption Keys
                        </h3>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                            Enter your current master password to generate new keys
                        </p>

                        <input
                            type="password"
                            placeholder="Current master password"
                            value={masterPassword}
                            onChange={(e) => setMasterPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.875rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                marginBottom: '1.5rem'
                            }}
                        />

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button
                                onClick={handleRotateKeys}
                                disabled={!masterPassword}
                                style={{
                                    flex: 1,
                                    padding: '0.875rem',
                                    background: masterPassword ? '#4f46e5' : '#e5e7eb',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: masterPassword ? 'pointer' : 'not-allowed'
                                }}
                            >
                                Rotate Keys
                            </button>
                            <button
                                onClick={() => {
                                    setShowRotateKeys(false);
                                    setMasterPassword('');
                                }}
                                style={{
                                    padding: '0.875rem 1.5rem',
                                    background: 'white',
                                    color: '#374151',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Security Tips */}
            <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '12px', padding: '1.25rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '700', color: '#1e40af', marginBottom: '0.75rem' }}>
                    Security Best Practices
                </h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', color: '#1e3a8a', fontSize: '0.875rem', lineHeight: '1.6' }}>
                    <li>Backup your keys immediately after generation</li>
                    <li>Store backups in a secure location (encrypted USB, password manager)</li>
                    <li>Never share your master password or private keys</li>
                    <li>Rotate keys periodically (every 6-12 months)</li>
                    <li>Use a strong, unique master password</li>
                </ul>
            </div>
        </div>
    );
};

export default KeyManagementDashboard;
