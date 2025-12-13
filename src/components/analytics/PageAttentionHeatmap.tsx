import React from 'react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import type { PageAttention } from '../../lib/analyticsService';

interface PageAttentionHeatmapProps {
    data: PageAttention[];
}

const PageAttentionHeatmap: React.FC<PageAttentionHeatmapProps> = ({ data }) => {
    // Sort by page number to be safe
    const sortedData = [...data].sort((a, b) => a.page_number - b.page_number);

    // Function to determine color based on duration
    const getColor = (duration: number, max: number) => {
        const intensity = Math.min(duration / max, 1);
        // Interpolate from blue (low) to red (high)
        // Simple logic: Low activity = #3b82f6 (blue), High activity = #ef4444 (red)
        return intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f59e0b' : '#3b82f6';
    };

    const maxDuration = Math.max(...data.map(d => d.avg_duration_seconds), 1);

    if (data.length === 0) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                No page view data available
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
                <BarChart
                    data={sortedData}
                    margin={{
                        top: 20,
                        right: 30,
                        left: 20,
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis
                        dataKey="page_number"
                        label={{ value: 'Page Number', position: 'insideBottom', offset: -5 }}
                    />
                    <YAxis
                        label={{ value: 'Avg Time (sec)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                                const item = payload[0].payload;
                                return (
                                    <div style={{ background: 'white', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
                                        <p style={{ fontWeight: 'bold', margin: '0 0 5px' }}>Page {label}</p>
                                        <p style={{ margin: 0, color: '#4b5563' }}>Avg Time: {Number(item.avg_duration_seconds).toFixed(1)}s</p>
                                        <p style={{ margin: 0, color: '#9ca3af', fontSize: '12px' }}>Total Views: {item.total_views}</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                    <Bar dataKey="avg_duration_seconds" radius={[4, 4, 0, 0]}>
                        {sortedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={getColor(entry.avg_duration_seconds, maxDuration)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '10px', fontSize: '0.875rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, background: '#3b82f6', borderRadius: 2 }}></div>
                    <span>Normal</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, background: '#f59e0b', borderRadius: 2 }}></div>
                    <span>High Interest</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }}></div>
                    <span>Hot Spot</span>
                </div>
            </div>
        </div>
    );
};

export default PageAttentionHeatmap;
