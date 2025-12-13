import React, { useEffect, useState } from 'react';
import { Monitor, MapPin, Calendar, Ban, RefreshCw, Shield } from 'lucide-react';
import { getAccessStats, revokeSession, revokeDocumentAccess } from '../lib/drmController';

interface ActiveSessionsManagerProps {
    documentId: string;
    documentName: string;
}

const ActiveSessionsManager: React.FC<ActiveSessionsManagerProps> = ({ documentId, documentName }) => {
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchStats();
    }, [documentId]);

    const fetchStats = async () => {
        setLoading(true);
        const result = await getAccessStats(documentId);
        setStats(result);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        await fetchStats();
        setRefreshing(false);
    };

    const handleRevokeAll = async () => {
        if (!confirm(`Revoke access for ALL sessions? This will block ${stats.activeSessions} active sessions.`)) {
            return;
        }

        const result = await revokeDocumentAccess(documentId, 'Revoked by owner');
        if (result.success) {
            alert(`Successfully revoked ${result.revokedSessions} sessions`);
            fetchStats();
        } else {
            alert(`Error: ${result.error}`);
        }
    };

    if (loading) {
        return (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                <Shield size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                <p>Loading session data...</p>
            </div>
        );
    }

    return (
        <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>Active Sessions</h2>
                    <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>{documentName}</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: 'white',
                            color: '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontWeight: '500',
                            cursor: refreshing ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            opacity: refreshing ? 0.6 : 1
                        }}
                    >
                        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={handleRevokeAll}
                        disabled={stats.activeSessions === 0}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: stats.activeSessions === 0 ? '#e5e7eb' : '#ef4444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: stats.activeSessions === 0 ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Ban size={16} />
                        Revoke All
                    </button>
                </div>
            </div>

            {/* Statistics Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                <div style={{ padding: '1.25rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                    <div style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Total Views
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e3a8a' }}>{stats.totalViews}</div>
                </div>

                <div style={{ padding: '1.25rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                    <div style={{ fontSize: '0.875rem', color: '#047857', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Unique Devices
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#065f46' }}>{stats.uniqueDevices}</div>
                </div>

                <div style={{ padding: '1.25rem', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde047' }}>
                    <div style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Active Sessions
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#78350f' }}>{stats.activeSessions}</div>
                </div>

                <div style={{ padding: '1.25rem', background: '#fee2e2', borderRadius: '12px', border: '1px solid #fecaca' }}>
                    <div style={{ fontSize: '0.875rem', color: '#991b1b', fontWeight: '500', marginBottom: '0.5rem' }}>
                        Revoked
                    </div>
                    <div style={{ fontSize: '2rem', fontWeight: '700', color: '#7f1d1d' }}>{stats.revokedSessions}</div>
                </div>
            </div>

            {/* Device Sessions List */}
            <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
                    Sessions by Device
                </h3>

                {stats.viewsByDevice.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        <Monitor size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <p>No active sessions</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {stats.viewsByDevice.map((device: any, index: number) => (
                            <div
                                key={device.fingerprint}
                                style={{
                                    padding: '1.25rem',
                                    background: '#f9fafb',
                                    border: '1px solid #e5e7eb',
                                    borderLeft: '4px solid #4f46e5',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flex: 1 }}>
                                    {/* Device Icon */}
                                    <div
                                        style={{
                                            width: '48px',
                                            height: '48px',
                                            borderRadius: '12px',
                                            background: '#e0e7ff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#4f46e5',
                                            flexShrink: 0
                                        }}
                                    >
                                        <Monitor size={24} />
                                    </div>

                                    {/* Device Info */}
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>
                                            Device #{index + 1}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: '#6b7280', fontFamily: 'monospace' }}>
                                            {device.fingerprint.substring(0, 16)}...
                                        </div>
                                    </div>

                                    {/* Stats */}
                                    <div style={{ display: 'flex', gap: '2rem' }}>
                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                                                Views
                                            </div>
                                            <div style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>
                                                {device.count}
                                            </div>
                                        </div>

                                        <div>
                                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' }}>
                                                Last Active
                                            </div>
                                            <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#6b7280' }}>
                                                {new Date(device.lastAccess).toLocaleDateString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ActiveSessionsManager;
