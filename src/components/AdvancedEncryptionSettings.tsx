import React, { useState } from 'react';
import { Shield, Lock, Key, Users } from 'lucide-react';

export type EncryptionType = 'basic' | 'advanced' | 'pgp';

interface AdvancedEncryptionSettingsProps {
    onEncryptionTypeChange?: (type: EncryptionType) => void;
    onRecipientChange?: (recipients: string[]) => void;
    initialType?: EncryptionType;
}

const AdvancedEncryptionSettings: React.FC<AdvancedEncryptionSettingsProps> = ({
    onEncryptionTypeChange,
    onRecipientChange,
    initialType = 'basic'
}) => {
    const [encryptionType, setEncryptionType] = useState<EncryptionType>(initialType);
    const [recipients, setRecipients] = useState<string[]>([]);
    const [newRecipient, setNewRecipient] = useState('');

    const handleTypeChange = (type: EncryptionType) => {
        setEncryptionType(type);
        onEncryptionTypeChange?.(type);
    };

    const addRecipient = () => {
        if (newRecipient && !recipients.includes(newRecipient)) {
            const updated = [...recipients, newRecipient];
            setRecipients(updated);
            onRecipientChange?.(updated);
            setNewRecipient('');
        }
    };

    const removeRecipient = (recipient: string) => {
        const updated = recipients.filter(r => r !== recipient);
        setRecipients(updated);
        onRecipientChange?.(updated);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
                    Encryption Type
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Basic */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'start',
                        gap: '1rem',
                        padding: '1.25rem',
                        background: encryptionType === 'basic' ? '#eff6ff' : 'white',
                        border: `2px solid ${encryptionType === 'basic' ? '#3b82f6' : '#e5e7eb'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}>
                        <input
                            type="radio"
                            name="encryption"
                            checked={encryptionType === 'basic'}
                            onChange={() => handleTypeChange('basic')}
                            style={{ marginTop: '0.25rem' }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Shield size={20} color={encryptionType === 'basic' ? '#3b82f6' : '#6b7280'} />
                                <span style={{ fontWeight: '600', color: '#111827' }}>Basic Encryption</span>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#d1fae5',
                                    color: '#065f46',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                }}>
                                    Recommended
                                </span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.5' }}>
                                Server-managed encryption with automatic key management. Easy to use, no password required. Suitable for most documents.
                            </p>
                        </div>
                    </label>

                    {/* Advanced */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'start',
                        gap: '1rem',
                        padding: '1.25rem',
                        background: encryptionType === 'advanced' ? '#eff6ff' : 'white',
                        border: `2px solid ${encryptionType === 'advanced' ? '#3b82f6' : '#e5e7eb'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}>
                        <input
                            type="radio"
                            name="encryption"
                            checked={encryptionType === 'advanced'}
                            onChange={() => handleTypeChange('advanced')}
                            style={{ marginTop: '0.25rem' }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Lock size={20} color={encryptionType === 'advanced' ? '#3b82f6' : '#6b7280'} />
                                <span style={{ fontWeight: '600', color: '#111827' }}>Advanced Encryption</span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.5', marginBottom: '0.5rem' }}>
                                Client-side encryption with your own keys (AES-256-GCM + RSA-4096). Maximum security, but requires master password. Server never sees your data.
                            </p>
                            {encryptionType === 'advanced' && (
                                <div style={{
                                    padding: '0.75rem',
                                    background: '#fef3c7',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    color: '#92400e'
                                }}>
                                    ⚠️ Lost password = lost documents. Make sure to backup your keys!
                                </div>
                            )}
                        </div>
                    </label>

                    {/* PGP */}
                    <label style={{
                        display: 'flex',
                        alignItems: 'start',
                        gap: '1rem',
                        padding: '1.25rem',
                        background: encryptionType === 'pgp' ? '#eff6ff' : 'white',
                        border: `2px solid ${encryptionType === 'pgp' ? '#3b82f6' : '#e5e7eb'}`,
                        borderRadius: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                    }}>
                        <input
                            type="radio"
                            name="encryption"
                            checked={encryptionType === 'pgp'}
                            onChange={() => handleTypeChange('pgp')}
                            style={{ marginTop: '0.25rem' }}
                        />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                <Key size={20} color={encryptionType === 'pgp' ? '#3b82f6' : '#6b7280'} />
                                <span style={{ fontWeight: '600', color: '#111827' }}>PGP/GPG Encryption</span>
                                <span style={{
                                    padding: '0.25rem 0.75rem',
                                    background: '#e0e7ff',
                                    color: '#3730a3',
                                    borderRadius: '12px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                }}>
                                    Expert
                                </span>
                            </div>
                            <p style={{ fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.5' }}>
                                OpenPGP standard encryption with digital signatures. Compatible with GPG tools. For advanced users who need maximum security and verification.
                            </p>
                        </div>
                    </label>
                </div>
            </div>

            {/* Multi-recipient (for advanced/PGP) */}
            {(encryptionType === 'advanced' || encryptionType === 'pgp') && (
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Users size={20} color="#4f46e5" />
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827' }}>
                            Share with Recipients
                        </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                        <input
                            type="text"
                            placeholder="Enter email or key fingerprint"
                            value={newRecipient}
                            onChange={(e) => setNewRecipient(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addRecipient()}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                fontSize: '0.875rem'
                            }}
                        />
                        <button
                            onClick={addRecipient}
                            style={{
                                padding: '0.75rem 1.5rem',
                                background: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Add
                        </button>
                    </div>

                    {recipients.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {recipients.map((recipient, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '0.75rem',
                                        background: '#f9fafb',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '8px'
                                    }}
                                >
                                    <span style={{ fontSize: '0.875rem', color: '#374151' }}>{recipient}</span>
                                    <button
                                        onClick={() => removeRecipient(recipient)}
                                        style={{
                                            padding: '0.25rem 0.75rem',
                                            background: 'white',
                                            color: '#ef4444',
                                            border: '1px solid #ef4444',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: '600',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Remove
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.75rem' }}>
                        Each recipient will receive their own encrypted copy. They must have their encryption keys configured.
                    </p>
                </div>
            )}
        </div>
    );
};

export default AdvancedEncryptionSettings;
