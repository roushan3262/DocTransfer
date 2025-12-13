import React, { useEffect, useState } from 'react';
import {
    Activity,
    PieChart as PieChartIcon,
    Filter,
    Clock,
    Users,
    MousePointer,
    Calendar,
    BarChart2
} from 'lucide-react';
import { analyticsService } from '../../lib/analyticsService';
import PageAttentionHeatmap from './PageAttentionHeatmap';
import ViewerGeoMap from './ViewerGeoMap';
import DeviceStats from './DeviceStats';
import ConversionFunnel from './ConversionFunnel';

interface AnalyticsDashboardProps {
    documentId?: string;
}

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ documentId }) => {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'engagement' | 'audience' | 'funnel'>('overview');
    const [timeRange, setTimeRange] = useState<number>(30); // days

    // Data states
    const [dailyStats, setDailyStats] = useState<any[]>([]); // simplified for now
    const [pageAttention, setPageAttention] = useState<any[]>([]);
    const [geoStats, setGeoStats] = useState<any[]>([]);
    const [deviceStats, setDeviceStats] = useState<any[]>([]);
    const [funnelData, setFunnelData] = useState<any[]>([]);

    useEffect(() => {
        if (!documentId) return;

        fetchData();

        // Set up real-time subscriptions
        const sessionSub = analyticsService.subscribeToSessions(documentId, (payload) => {
            console.log('Real-time session update:', payload);
            // Ideally trigger a refined refetch or state update
            fetchData(); // Simple refresh for now
        });

        const viewSub = analyticsService.subscribeToViews(documentId, (payload) => {
            console.log('Real-time view update:', payload);
            fetchData();
        });

        return () => {
            sessionSub.unsubscribe();
            viewSub.unsubscribe();
        };
    }, [documentId, timeRange]);

    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        if (!documentId) return;
        setLoading(true);
        setError(null);
        try {
            const [daily, pages, geo, devices, funnel] = await Promise.all([
                analyticsService.getDailyStats(documentId, timeRange),
                analyticsService.getPageAttention(documentId),
                analyticsService.getGeoStats(documentId),
                analyticsService.getDeviceStats(documentId),
                analyticsService.getConversionFunnel(documentId)
            ]);

            setDailyStats(daily);
            setPageAttention(pages);
            setGeoStats(geo);
            setDeviceStats(devices);
            setFunnelData(funnel);
        } catch (error: any) {
            console.error('Failed to fetch analytics:', error);
            setError(error.message || 'Failed to load analytics data');
        } finally {
            setLoading(false);
        }
    };

    const SummaryCard = ({ title, value, icon: Icon, color }: any) => (
        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ padding: '1rem', borderRadius: '12px', background: `${color} 20`, color: color }}>
                <Icon size={24} />
            </div>
            <div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>{title}</p>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: 0 }}>{value}</h3>
            </div>
        </div>
    );

    // Calculate high-level stats
    const totalViews = dailyStats.reduce((acc, curr) => acc + curr.total_views, 0);
    const uniqueViewers = dailyStats.reduce((acc, curr) => acc + curr.unique_sessions, 0);
    const avgDuration = dailyStats.length > 0
        ? Math.round(dailyStats.reduce((acc, curr) => acc + curr.avg_duration_seconds, 0) / dailyStats.length)
        : 0;

    if (!documentId) {
        return (
            <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '12px', minHeight: '400px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart2 size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#374151', marginBottom: '0.5rem' }}>Select a Document</h3>
                <p style={{ color: '#6b7280' }}>Choose a document from the Documents tab to view its analytics.</p>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#dc2626' }}>
                <p style={{ fontWeight: 600 }}>Error loading analytics</p>
                <p style={{ fontSize: '0.875rem' }}>{error}</p>
                <button onClick={fetchData} style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#dc2626', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    Retry
                </button>
            </div>
        );
    }

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading analytics...</div>;



    return (
        <div style={{ padding: '1.5rem', background: '#f3f4f6', minHeight: '100%' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', margin: 0 }}>Analytics Dashboard</h2>
                    <p style={{ color: '#6b7280', marginTop: '0.25rem' }}>Real-time insights for your document</p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <select
                        value={timeRange}
                        onChange={(e) => setTimeRange(Number(e.target.value))}
                        style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid #d1d5db' }}
                    >
                        <option value={7}>Last 7 Days</option>
                        <option value={30}>Last 30 Days</option>
                        <option value={90}>Last 3 Months</option>
                    </select>
                    <button
                        onClick={() => fetchData()}
                        style={{ padding: '0.5rem 1rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        <Calendar size={16} /> Refresh
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                <SummaryCard title="Total Views" value={totalViews} icon={Users} color="#3b82f6" />
                <SummaryCard title="Unique Viewers" value={uniqueViewers} icon={PieChartIcon} color="#8b5cf6" />
                <SummaryCard title="Avg Time (sec)" value={avgDuration + 's'} icon={Clock} color="#f59e0b" />
                <SummaryCard title="Engagement Score" value={Math.min(100, Math.round(avgDuration / 6)) + '%'} icon={Activity} color="#10b981" />
            </div>

            {/* Tabs */}
            <div style={{ borderBottom: '1px solid #e5e7eb', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                    {[
                        { id: 'overview', label: 'Overview', icon: Activity },
                        { id: 'engagement', label: 'Engagement', icon: MousePointer },
                        { id: 'audience', label: 'Audience', icon: Users },
                        { id: 'funnel', label: 'Conversion', icon: Filter },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            style={{
                                padding: '0.75rem 0',
                                background: 'none',
                                border: 'none',
                                borderBottom: activeTab === tab.id ? '2px solid #4f46e5' : 'none',
                                color: activeTab === tab.id ? '#4f46e5' : '#6b7280',
                                fontWeight: activeTab === tab.id ? '600' : '400',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <tab.icon size={18} />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>

                {activeTab === 'overview' && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>Device Distribution</h3>
                                <DeviceStats data={deviceStats} />
                            </div>
                            <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>Recent Activity</h3>
                                <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem' }}>Real-time feed placeholder</div>
                            </div>
                        </div>

                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>Geographic Distribution</h3>
                            <ViewerGeoMap data={geoStats} />
                        </div>
                    </>
                )}

                {activeTab === 'engagement' && (
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: '#1f2937' }}>Page Attention Heatmap</h3>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>See which pages viewers spend the most time on</p>
                        <PageAttentionHeatmap data={pageAttention} />
                    </div>
                )}

                {activeTab === 'audience' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>Geographic Locations</h3>
                            <ViewerGeoMap data={geoStats} />
                        </div>
                        <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                            <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '1.5rem', color: '#1f2937' }}>Devices & Browsers</h3>
                            <DeviceStats data={deviceStats} />
                        </div>
                    </div>
                )}

                {activeTab === 'funnel' && (
                    <div style={{ background: 'white', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem', color: '#1f2937' }}>Conversion Funnel</h3>
                        <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Track user journey from opening to signing</p>
                        <ConversionFunnel data={funnelData} />
                    </div>
                )}

            </div>
        </div>
    );
};

export default AnalyticsDashboard;
