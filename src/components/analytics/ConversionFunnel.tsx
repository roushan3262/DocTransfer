import React from 'react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { ArrowDown } from 'lucide-react';
import type { FunnelStep } from '../../lib/analyticsService';

interface ConversionFunnelProps {
    data: FunnelStep[];
}

const ConversionFunnel: React.FC<ConversionFunnelProps> = ({ data }) => {
    // Add conversion rate to data
    const processedData = data.map((step, index) => {
        const prevCount = index > 0 ? data[index - 1].count : step.count;
        const conversionRate = prevCount > 0 ? (step.count / prevCount) * 100 : 0;
        const totalRate = data[0].count > 0 ? (step.count / data[0].count) * 100 : 0;

        return {
            ...step,
            conversionRate: Math.round(conversionRate),
            totalRate: Math.round(totalRate)
        };
    });

    if (data.length === 0) {
        return (
            <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
                No funnel data available
            </div>
        );
    }

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
            {/* Steps List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', justifyContent: 'center' }}>
                {processedData.map((step, index) => (
                    <div key={step.step_name} style={{ position: 'relative' }}>
                        {index > 0 && (
                            <div style={{
                                position: 'absolute',
                                top: '-15px',
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'white',
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                border: '1px solid #e5e7eb'
                            }}>
                                <ArrowDown size={14} color="#9ca3af" />
                            </div>
                        )}

                        <div style={{
                            padding: '1.25rem',
                            background: '#f9fafb',
                            border: '1px solid #e5e7eb',
                            borderRadius: '12px',
                            borderLeft: `4px solid ${['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981'][index % 4]}`,
                            position: 'relative'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                                <span style={{ fontWeight: '600', color: '#111827' }}>{step.step_name}</span>
                                <span style={{ fontWeight: '700', fontSize: '1.125rem', color: '#1f2937' }}>{step.count}</span>
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                                {step.description}
                            </div>

                            {index > 0 && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '2px 8px',
                                    background: step.conversionRate > 50 ? '#d1fae5' : '#fee2e2',
                                    color: step.conversionRate > 50 ? '#065f46' : '#991b1b',
                                    borderRadius: '99px',
                                    fontSize: '0.75rem',
                                    fontWeight: '600'
                                }}>
                                    {step.conversionRate}% Conversion
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Visual Chart */}
            <div style={{ height: 350 }}>
                <ResponsiveContainer>
                    <AreaChart
                        data={processedData}
                        margin={{
                            top: 10,
                            right: 30,
                            left: 0,
                            bottom: 0,
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="step_name" />
                        <YAxis />
                        <Tooltip
                            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                            formatter={(value: any, name: any) => [value, name === 'count' ? 'Users' : name]}
                        />
                        <Area
                            type="monotone"
                            dataKey="count"
                            stroke="#4f46e5"
                            fill="url(#colorTotal)"
                            strokeWidth={3}
                        />
                        <defs>
                            <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.8} />
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.1} />
                            </linearGradient>
                        </defs>
                    </AreaChart>
                </ResponsiveContainer>
                <div style={{ textAlign: 'center', marginTop: '1rem', color: '#6b7280', fontSize: '0.875rem' }}>
                    Overall Conversion Rate: <strong>{processedData[processedData.length - 1]?.totalRate}%</strong>
                </div>
            </div>
        </div>
    );
};

export default ConversionFunnel;
