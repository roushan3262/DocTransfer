import React, { useEffect, useState } from 'react';
import {
    Shield,
    Download,
    FileText,
    Search,
    Filter,
    Calendar,
    MapPin,
    User,
    Clock,
    Eye,
    CheckCircle,
    XCircle,
    Upload,
    Link as LinkIcon,
    Lock,
    Mail,
    PenTool
} from 'lucide-react';
import {
    getDocumentAuditTrail,
    getDocumentStatistics,
    getDocumentEventTypes,
    exportAuditTrailCSV,
    downloadCSV,
    type AuditFilters,
    type DocumentStatistics
} from '../lib/complianceReports';

interface AuditTrailDashboardProps {
    documentId: string;
    documentName: string;
}

const AuditTrailDashboard: React.FC<AuditTrailDashboardProps> = ({ documentId, documentName }) => {
    const [events, setEvents] = useState<any[]>([]);
    const [statistics, setStatistics] = useState<DocumentStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedEventTypes, setSelectedEventTypes] = useState<string[]>([]);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Available event types
    const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);

    // Fetch audit data
    useEffect(() => {
        fetchAuditData();
    }, [documentId]);

    const fetchAuditData = async () => {
        setLoading(true);
        setError(null);

        try {
            // Build filters
            const filters: AuditFilters = {};
            if (startDate) filters.startDate = new Date(startDate);
            if (endDate) filters.endDate = new Date(endDate);
            if (selectedEventTypes.length > 0) filters.eventTypes = selectedEventTypes;

            // Fetch data
            const [auditResult, statsResult, eventTypes] = await Promise.all([
                getDocumentAuditTrail(documentId, filters),
                getDocumentStatistics(documentId),
                getDocumentEventTypes(documentId)
            ]);

            if (auditResult.success && auditResult.events) {
                setEvents(auditResult.events);
            } else {
                setError(auditResult.error || 'Failed to fetch audit trail');
            }

            if (statsResult.success && statsResult.statistics) {
                setStatistics(statsResult.statistics);
            }

            setAvailableEventTypes(eventTypes);
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    // Handle export CSV
    const handleExportCSV = async () => {
        const result = await exportAuditTrailCSV(documentId);
        if (result.success && result.csv) {
            const timestamp = new Date().toISOString().split('T')[0];
            downloadCSV(result.csv, `audit-trail-${documentName}-${timestamp}.csv`);
        } else {
            alert('Failed to export CSV: ' + result.error);
        }
    };

    // Filter events by search term
    const filteredEvents = events.filter(event => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            event.event_type.toLowerCase().includes(searchLower) ||
            event.user_email?.toLowerCase().includes(searchLower) ||
            event.ip_address?.includes(searchTerm) ||
            event.geolocation?.city?.toLowerCase().includes(searchLower) ||
            event.geolocation?.country?.toLowerCase().includes(searchLower)
        );
    });

    // Get event icon
    const getEventIcon = (eventType: string) => {
        if (eventType.includes('upload')) return <Upload size={16} />;
        if (eventType.includes('view')) return <Eye size={16} />;
        if (eventType.includes('download')) return <Download size={16} />;
        if (eventType.includes('signature')) return <PenTool size={16} />;
        if (eventType.includes('link')) return <LinkIcon size={16} />;
        if (eventType.includes('password')) return <Lock size={16} />;
        if (eventType.includes('email')) return <Mail size={16} />;
        return <FileText size={16} />;
    };

    // Get event color
    const getEventColor = (eventType: string) => {
        if (eventType.includes('upload')) return '#10b981';
        if (eventType.includes('view')) return '#3b82f6';
        if (eventType.includes('download')) return '#8b5cf6';
        if (eventType.includes('completed')) return '#22c55e';
        if (eventType.includes('declined') || eventType.includes('failed')) return '#ef4444';
        if (eventType.includes('signature')) return '#f59e0b';
        return '#6b7280';
    };

    // Format event type for display
    const formatEventType = (eventType: string) => {
        return eventType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    // Group events by date
    const groupedEvents = filteredEvents.reduce((groups: any, event) => {
        const date = new Date(event.event_timestamp).toLocaleDateString();
        if (!groups[date]) groups[date] = [];
        groups[date].push(event);
        return groups;
    }, {});

    return (
        <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <Shield size={28} color="#4f46e5" />
                    <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>Audit Trail</h2>
                        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>{documentName}</p>
                    </div>
                </div>
                <button
                    onClick={handleExportCSV}
                    style={{
                        padding: '0.75rem 1.5rem',
                        background: '#4f46e5',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {/* Statistics Cards */}
            {statistics && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                    <div style={{ padding: '1.25rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Eye size={20} color="#3b82f6" />
                            <span style={{ fontSize: '0.875rem', color: '#1e40af', fontWeight: '500' }}>Total Views</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#1e3a8a' }}>{statistics.totalViews}</div>
                        <div style={{ fontSize: '0.75rem', color: '#60a5fa', marginTop: '0.25rem' }}>
                            {statistics.uniqueViewers} unique viewers
                        </div>
                    </div>

                    <div style={{ padding: '1.25rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Download size={20} color="#10b981" />
                            <span style={{ fontSize: '0.875rem', color: '#047857', fontWeight: '500' }}>Downloads</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#065f46' }}>{statistics.totalDownloads}</div>
                    </div>

                    <div style={{ padding: '1.25rem', background: '#fef3c7', borderRadius: '12px', border: '1px solid #fde047' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <PenTool size={20} color="#f59e0b" />
                            <span style={{ fontSize: '0.875rem', color: '#92400e', fontWeight: '500' }}>Signatures</span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '700', color: '#78350f' }}>
                            {statistics.signatureStatus.completed}/{statistics.signatureStatus.requested}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '0.25rem' }}>
                            {statistics.signatureStatus.pending} pending
                        </div>
                    </div>

                    <div style={{ padding: '1.25rem', background: '#faf5ff', borderRadius: '12px', border: '1px solid #e9d5ff' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Clock size={20} color="#8b5cf6" />
                            <span style={{ fontSize: '0.875rem', color: '#6b21a8', fontWeight: '500' }}>Last Activity</span>
                        </div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '600', color: '#581c87' }}>
                            {statistics.lastActivity
                                ? new Date(statistics.lastActivity).toLocaleDateString()
                                : 'No activity'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#a78bfa', marginTop: '0.25rem' }}>
                            {statistics.lastActivity
                                ? new Date(statistics.lastActivity).toLocaleTimeString()
                                : ''}
                        </div>
                    </div>
                </div>
            )}

            {/* Filters Section */}
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                    {/* Search */}
                    <div style={{ flex: 1, position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
                        <input
                            type="text"
                            placeholder="Search events..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.75rem 0.75rem 0.75rem 2.75rem',
                                border: '1px solid #e5e7eb',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Filter Toggle */}
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: showFilters ? '#4f46e5' : 'white',
                            color: showFilters ? 'white' : '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Filter size={18} />
                        Filters
                    </button>

                    {/* Refresh */}
                    <button
                        onClick={fetchAuditData}
                        disabled={loading}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: 'white',
                            color: '#374151',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            fontWeight: '500',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            opacity: loading ? 0.6 : 1
                        }}
                    >
                        {loading ? 'Loading...' : 'Refresh'}
                    </button>
                </div>

                {/* Expanded Filters */}
                {showFilters && (
                    <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            {/* Date Range */}
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                    Start Date
                                </label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                    End Date
                                </label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '0.625rem',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        outline: 'none'
                                    }}
                                />
                            </div>
                        </div>

                        {/* Event Types */}
                        {availableEventTypes.length > 0 && (
                            <div style={{ marginTop: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                    Event Types
                                </label>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                    {availableEventTypes.map(type => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                setSelectedEventTypes(prev =>
                                                    prev.includes(type)
                                                        ? prev.filter(t => t !== type)
                                                        : [...prev, type]
                                                );
                                            }}
                                            style={{
                                                padding: '0.5rem 1rem',
                                                background: selectedEventTypes.includes(type) ? '#4f46e5' : 'white',
                                                color: selectedEventTypes.includes(type) ? 'white' : '#374151',
                                                border: `1px solid ${selectedEventTypes.includes(type) ? '#4f46e5' : '#d1d5db'}`,
                                                borderRadius: '6px',
                                                fontSize: '0.875rem',
                                                fontWeight: '500',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            {formatEventType(type)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <button
                            onClick={fetchAuditData}
                            style={{
                                marginTop: '1rem',
                                padding: '0.625rem 1.25rem',
                                background: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                fontWeight: '600',
                                cursor: 'pointer'
                            }}
                        >
                            Apply Filters
                        </button>
                    </div>
                )}
            </div>

            {/* Timeline */}
            <div>
                {loading ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        <Clock size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <p>Loading audit trail...</p>
                    </div>
                ) : error ? (
                    <div style={{ padding: '1.5rem', background: '#fee2e2', color: '#dc2626', borderRadius: '12px', textAlign: 'center' }}>
                        {error}
                    </div>
                ) : filteredEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
                        <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.3 }} />
                        <p>No audit events found</p>
                    </div>
                ) : (
                    <div>
                        {Object.entries(groupedEvents).map(([date, dateEvents]: [string, any]) => (
                            <div key={date} style={{ marginBottom: '2rem' }}>
                                {/* Date Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '1rem',
                                    paddingBottom: '0.5rem',
                                    borderBottom: '2px solid #e5e7eb'
                                }}>
                                    <Calendar size={16} color="#6b7280" />
                                    <span style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280' }}>{date}</span>
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>({dateEvents.length} events)</span>
                                </div>

                                {/* Events for this date */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {dateEvents.map((event: any) => (
                                        <div
                                            key={event.id}
                                            style={{
                                                padding: '1rem',
                                                background: '#f9fafb',
                                                border: `1px solid ${getEventColor(event.event_type)}33`,
                                                borderLeft: `4px solid ${getEventColor(event.event_type)}`,
                                                borderRadius: '8px',
                                                display: 'flex',
                                                gap: '1rem',
                                                alignItems: 'flex-start'
                                            }}
                                        >
                                            {/* Icon */}
                                            <div
                                                style={{
                                                    width: '36px',
                                                    height: '36px',
                                                    borderRadius: '8px',
                                                    background: `${getEventColor(event.event_type)}20`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: getEventColor(event.event_type),
                                                    flexShrink: 0
                                                }}
                                            >
                                                {getEventIcon(event.event_type)}
                                            </div>

                                            {/* Event Details */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: '600', color: '#111827' }}>
                                                        {formatEventType(event.event_type)}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                                        {new Date(event.event_timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>

                                                {/*Event Meta */}
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: '#6b7280' }}>
                                                    {event.user_email && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <User size={12} />
                                                            {event.user_email}
                                                        </div>
                                                    )}
                                                    {event.ip_address && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <MapPin size={12} />
                                                            {event.ip_address}
                                                        </div>
                                                    )}
                                                    {event.geolocation?.city && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                                            <MapPin size={12} />
                                                            {event.geolocation.city}, {event.geolocation.country}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AuditTrailDashboard;
