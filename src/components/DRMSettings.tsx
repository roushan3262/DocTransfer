import React, { useState } from 'react';
import { Shield, Eye, Monitor, Copy, Printer, Camera, Globe, Clock, Calendar } from 'lucide-react';
import type { DRMSettings as DRMSettingsType } from '../lib/drmController';

interface DRMSettingsProps {
    initialSettings?: Partial<DRMSettingsType>;
    onChange?: (settings: DRMSettingsType) => void;
}

const DRMSettings: React.FC<DRMSettingsProps> = ({ initialSettings, onChange }) => {
    const [settings, setSettings] = useState<DRMSettingsType>({
        maxViews: initialSettings?.maxViews ?? null,
        maxUniqueDevices: initialSettings?.maxUniqueDevices ?? null,
        preventCopy: initialSettings?.preventCopy ?? false,
        preventPrint: initialSettings?.preventPrint ?? false,
        preventDownload: initialSettings?.preventDownload ?? false,
        preventScreenshot: initialSettings?.preventScreenshot ?? false,
        requireWatermark: initialSettings?.requireWatermark ?? false,
        watermarkText: initialSettings?.watermarkText ?? '',
        watermarkOpacity: initialSettings?.watermarkOpacity ?? 0.3,
        watermarkPosition: initialSettings?.watermarkPosition ?? 'diagonal',
        accessExpiresAt: initialSettings?.accessExpiresAt ?? null,
        allowedCountries: initialSettings?.allowedCountries ?? [],
        blockedCountries: initialSettings?.blockedCountries ?? [],
        allowedDaysOfWeek: initialSettings?.allowedDaysOfWeek ?? [],
        allowedHoursStart: initialSettings?.allowedHoursStart ?? null,
        allowedHoursEnd: initialSettings?.allowedHoursEnd ?? null
    });

    const updateSetting = <K extends keyof DRMSettingsType>(key: K, value: DRMSettingsType[K]) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        onChange?.(newSettings);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* View & Device Limits */}
            <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Eye size={20} color="#4f46e5" />
                    Access Limits
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    {/* Max Views */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            Maximum Views
                        </label>
                        <input
                            type="number"
                            placeholder="Unlimited"
                            value={settings.maxViews ?? ''}
                            onChange={(e) => updateSetting('maxViews', e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                                width: '100%',
                                padding: '0.625rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                            min="1"
                        />
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Leave empty for unlimited
                        </p>
                    </div>

                    {/* Max Devices */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            Maximum Devices
                        </label>
                        <input
                            type="number"
                            placeholder="Unlimited"
                            value={settings.maxUniqueDevices ?? ''}
                            onChange={(e) => updateSetting('maxUniqueDevices', e.target.value ? parseInt(e.target.value) : null)}
                            style={{
                                width: '100%',
                                padding: '0.625rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                            min="1"
                        />
                        <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
                            Number of unique devices allowed
                        </p>
                    </div>
                </div>
            </div>

            {/* Protection Features */}
            <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Shield size={20} color="#4f46e5" />
                    Protection Features
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                        { key: 'preventCopy', icon: <Copy size={16} />, label: 'Prevent Copy/Paste', desc: 'Disable text selection and copying' },
                        { key: 'preventPrint', icon: <Printer size={16} />, label: 'Prevent Printing', desc: 'Block print functionality' },
                        { key: 'preventDownload', icon: <Monitor size={16} />, label: 'Prevent Download', desc: 'Disable document download' },
                        { key: 'preventScreenshot', icon: <Camera size={16} />, label: 'Prevent Screenshots', desc: 'Attempt to block screenshot capture' }
                    ].map(({ key, icon, label, desc }) => (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'white', borderRadius: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{ color: '#6b7280' }}>{icon}</div>
                                <div>
                                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827' }}>{label}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{desc}</div>
                                </div>
                            </div>
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    checked={settings[key as keyof DRMSettingsType] as boolean}
                                    onChange={(e) => updateSetting(key as any, e.target.checked)}
                                />
                                <span className="toggle-slider"></span>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Watermark Settings */}
            <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', margin: 0 }}>
                        Watermark
                    </h3>
                    <label className="toggle-switch">
                        <input
                            type="checkbox"
                            checked={settings.requireWatermark}
                            onChange={(e) => updateSetting('requireWatermark', e.target.checked)}
                        />
                        <span className="toggle-slider"></span>
                    </label>
                </div>

                {settings.requireWatermark && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                Watermark Text
                            </label>
                            <input
                                type="text"
                                placeholder="CONFIDENTIAL"
                                value={settings.watermarkText}
                                onChange={(e) => updateSetting('watermarkText', e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '0.625rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    outline: 'none'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                Opacity: {Math.round((settings.watermarkOpacity ?? 0.3) * 100)}%
                            </label>
                            <input
                                type="range"
                                min="10"
                                max="100"
                                value={(settings.watermarkOpacity ?? 0.3) * 100}
                                onChange={(e) => updateSetting('watermarkOpacity', parseInt(e.target.value) / 100)}
                                style={{ width: '100%' }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                Position
                            </label>
                            <select
                                value={settings.watermarkPosition}
                                onChange={(e) => updateSetting('watermarkPosition', e.target.value as any)}
                                style={{
                                    width: '100%',
                                    padding: '0.625rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    outline: 'none'
                                }}
                            >
                                <option value="diagonal">Diagonal (Repeating)</option>
                                <option value="center">Center</option>
                                <option value="bottom">Bottom</option>
                                <option value="top">Top</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Time Restrictions */}
            <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={20} color="#4f46e5" />
                    Time Restrictions
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Expiration Date */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            Access Expires At
                        </label>
                        <input
                            type="datetime-local"
                            value={settings.accessExpiresAt ? new Date(settings.accessExpiresAt).toISOString().slice(0, 16) : ''}
                            onChange={(e) => updateSetting('accessExpiresAt', e.target.value ? new Date(e.target.value) : null)}
                            style={{
                                width: '100%',
                                padding: '0.625rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    {/* Hours */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                Start Hour (24h)
                            </label>
                            <input
                                type="number"
                                placeholder="00"
                                min="0"
                                max="23"
                                value={settings.allowedHoursStart ?? ''}
                                onChange={(e) => updateSetting('allowedHoursStart', e.target.value ? parseInt(e.target.value) : null)}
                                style={{
                                    width: '100%',
                                    padding: '0.625rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                                End Hour (24h)
                            </label>
                            <input
                                type="number"
                                placeholder="23"
                                min="0"
                                max="23"
                                value={settings.allowedHoursEnd ?? ''}
                                onChange={(e) => updateSetting('allowedHoursEnd', e.target.value ? parseInt(e.target.value) : null)}
                                style={{
                                    width: '100%',
                                    padding: '0.625rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '8px',
                                    outline: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Geographic Restrictions */}
            <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: '#111827', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={20} color="#4f46e5" />
                    Geographic Restrictions
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            Allowed Countries (comma-separated, e.g., US,GB,CA)
                        </label>
                        <input
                            type="text"
                            placeholder="Leave empty to allow all countries"
                            value={settings.allowedCountries?.join(',') ?? ''}
                            onChange={(e) => updateSetting('allowedCountries', e.target.value ? e.target.value.split(',').map(c => c.trim()) : [])}
                            style={{
                                width: '100%',
                                padding: '0.625rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            Blocked Countries (comma-separated)
                        </label>
                        <input
                            type="text"
                            placeholder="e.g., CN,RU"
                            value={settings.blockedCountries?.join(',') ?? ''}
                            onChange={(e) => updateSetting('blockedCountries', e.target.value ? e.target.value.split(',').map(c => c.trim()) : [])}
                            style={{
                                width: '100%',
                                padding: '0.625rem',
                                border: '1px solid #d1d5db',
                                borderRadius: '8px',
                                outline: 'none'
                            }}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DRMSettings;
