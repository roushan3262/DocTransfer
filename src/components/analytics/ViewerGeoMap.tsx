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
import { Globe } from 'lucide-react';
import type { GeoStat } from '../../lib/analyticsService';

interface ViewerGeoMapProps {
    data: GeoStat[];
}

const ViewerGeoMap: React.FC<ViewerGeoMapProps> = ({ data }) => {
    // Aggregate by country for the main view
    const countryData = data.reduce((acc, curr) => {
        const existing = acc.find(item => item.country === curr.country_code);
        if (existing) {
            existing.count += curr.session_count;
        } else {
            acc.push({ country: curr.country_code || 'Unknown', count: curr.session_count });
        }
        return acc;
    }, [] as { country: string; count: number }[]);

    const sortedData = countryData.sort((a, b) => b.count - a.count).slice(0, 10); // Top 10

    if (data.length === 0) {
        return (
            <div style={{ height: '300px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                <Globe size={48} style={{ opacity: 0.2, marginBottom: '1rem' }} />
                <p>No geographic data collected yet</p>
            </div>
        );
    }

    return (
        <div style={{ width: '100%', height: 300 }}>
            {/* Top Countries Bar Chart */}
            <ResponsiveContainer>
                <BarChart
                    layout="vertical"
                    data={sortedData}
                    margin={{
                        top: 5,
                        right: 30,
                        left: 40, // Space for country codes
                        bottom: 5,
                    }}
                >
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis
                        dataKey="country"
                        type="category"
                        width={40}
                        tick={{ fontSize: 12, fontWeight: 600 }}
                    />
                    <Tooltip
                        cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                    <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={20}>
                        {sortedData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={`rgba(139, 92, 246, ${1 - (index * 0.1)})`} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>

            {/* Recent Cities List (Simulated "Real-time" feel) */}
            <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Recent Locations
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    {data.slice(0, 6).map((stat, i) => (
                        <div key={i} style={{ fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: '#111827' }}>
                                {stat.city && stat.city !== 'null' ? stat.city : 'Unknown City'}, {stat.country_code}
                            </span>
                            <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>{stat.session_count} visits</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ViewerGeoMap;
