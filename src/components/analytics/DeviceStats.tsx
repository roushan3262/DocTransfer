import React from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend
} from 'recharts';
import { Smartphone, Monitor, Tablet } from 'lucide-react';
import type { DeviceStat } from '../../lib/analyticsService';

interface DeviceStatsProps {
    data: DeviceStat[];
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DeviceStats: React.FC<DeviceStatsProps> = ({ data }) => {
    // Aggregate by device type
    const deviceData = data.reduce((acc, curr) => {
        const existing = acc.find(item => item.name === curr.device_type);
        if (existing) {
            existing.value += curr.session_count;
        } else {
            acc.push({ name: curr.device_type, value: curr.session_count });
        }
        return acc;
    }, [] as { name: string; value: number }[]);

    // Aggregate by browser
    const browserData = data.reduce((acc, curr) => {
        const existing = acc.find(item => item.name === curr.browser_name);
        if (existing) {
            existing.value += curr.session_count;
        } else {
            acc.push({ name: curr.browser_name, value: curr.session_count });
        }
        return acc;
    }, [] as { name: string; value: number }[]);

    const getDeviceIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'mobile': return <Smartphone size={16} />;
            case 'tablet': return <Tablet size={16} />;
            default: return <Monitor size={16} />;
        }
    };

    if (data.length === 0) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                No device data available
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', height: 300 }}>
            {/* Device Type Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '1rem' }}>Device Type</h4>
                <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={deviceData}
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {deviceData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend verticalAlign="bottom" height={36} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Summary */}
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {deviceData.map((d, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: '#4b5563' }}>
                            {getDeviceIcon(d.name)}
                            <span>{d.name}: {Math.round(d.value / data.reduce((a, b) => a + b.session_count, 0) * 100)}%</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Browser Chart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#6b7280', marginBottom: '1rem' }}>Browser</h4>
                <div style={{ width: '100%', height: 200 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie
                                data={browserData}
                                cx="50%"
                                cy="50%"
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                            >
                                {browserData.map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

export default DeviceStats;
