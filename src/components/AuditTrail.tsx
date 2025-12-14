import React, { useEffect, useState } from 'react';
import {
    Clock,
    Shield,
    FileText,
    Download,
    Eye,
    Globe,
    Search,
    RefreshCw,
    PenTool
} from 'lucide-react';
import { fetchAuditLogs } from '../lib/auditLogger';

interface AuditLog {
    id: string;
    event_type: string;
    event_timestamp: string;
    document_name?: string;
    signer_name?: string;
    user_email?: string;
    ip_address?: string;
    city?: string;
    country?: string;
    event_metadata?: any;
}

interface AuditTrailProps {
    documentId?: string | string[]; // Optional: if provided, filters by specific document(s)
}

const AuditTrail: React.FC<AuditTrailProps> = ({ documentId }) => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);

    const loadLogs = async () => {
        setLoading(true);
        setError(null);
        try {
            const filters = filterType !== 'all' ? { eventType: filterType } : undefined;
            const { data, error: fetchError } = await fetchAuditLogs(documentId, filters);

            if (fetchError) {
                setError(fetchError);
            } else {
                setLogs(data);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs();

        // Auto-refresh every 30 seconds
        const interval = setInterval(loadLogs, 30000);
        return () => clearInterval(interval);
    }, [documentId, filterType]);

    const getEventIcon = (type: string) => {
        if (type.includes('view')) return <Eye size={16} className="text-blue-500" />;
        if (type.includes('download')) return <Download size={16} className="text-green-500" />;
        if (type.includes('upload')) return <FileText size={16} className="text-purple-500" />;
        if (type.includes('signature')) return <PenTool size={16} className="text-orange-500" />;
        if (type.includes('security') || type.includes('password')) return <Shield size={16} className="text-red-500" />;
        return <Clock size={16} className="text-gray-500" />;
    };

    const getEventLabel = (type: string) => {
        return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                    <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                        <Shield size={20} className="text-indigo-600" />
                        Audit Trail
                    </h2>
                    <p className="text-sm text-gray-500">
                        Real-time chronological log of all document interactions
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                        className="text-sm border-gray-300 rounded-lg shadow-sm focus:border-indigo-500 focus:ring-indigo-500 p-2 border"
                    >
                        <option value="all">All Events</option>
                        <option value="document_viewed">Views</option>
                        <option value="document_downloaded">Downloads</option>
                        <option value="document_uploaded">Uploads</option>
                        <option value="security_alert">Security Alerts</option>
                    </select>
                    <button
                        onClick={loadLogs}
                        className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Refresh Logs"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 text-sm border-b border-red-100">
                    Error loading logs: {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="px-6 py-3 font-medium">Timestamp</th>
                            <th className="px-6 py-3 font-medium">Event</th>
                            <th className="px-6 py-3 font-medium">User / IP</th>
                            <th className="px-6 py-3 font-medium">Location</th>
                            <th className="px-6 py-3 font-medium">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {logs.length === 0 && !loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <div className="bg-gray-100 p-3 rounded-full mb-3">
                                            <Search size={24} className="text-gray-400" />
                                        </div>
                                        <p>No audit logs found for this period.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                        <div className="flex items-center gap-2">
                                            <Clock size={14} className="text-gray-400" />
                                            {formatDate(log.event_timestamp)}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
                                            {getEventIcon(log.event_type)}
                                            {getEventLabel(log.event_type)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-gray-900">
                                                {log.user_email || log.signer_name || 'Anonymous User'}
                                            </span>
                                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                                <Globe size={10} /> {log.ip_address || 'Unknown IP'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">
                                        {log.city ? (
                                            <span className="flex items-center gap-1">
                                                {log.city}, {log.country}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400 italic">Unknown</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-gray-500 max-w-xs truncate">
                                        {log.document_name && (
                                            <div className="flex items-center gap-1 mb-1">
                                                <FileText size={12} />
                                                <span className="font-medium text-gray-700">{log.document_name}</span>
                                            </div>
                                        )}
                                        <span className="text-xs">
                                            {JSON.stringify(log.event_metadata || {})}
                                        </span>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer / Pagination hint */}
            <div className="p-4 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
                <span>Showing recent 50 events</span>
                <span className="flex items-center gap-1">
                    <Shield size={12} /> Secured by Blockchain-ready Audit Log
                </span>
            </div>
        </div>
    );
};

export default AuditTrail;
