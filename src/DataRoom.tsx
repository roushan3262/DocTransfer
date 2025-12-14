import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import {
    Upload,
    FileText,
    Link as LinkIcon,
    Lock,
    Calendar,
    Download,
    Globe,
    Copy,
    Check,
    Eye,
    BarChart2,
    Shield,
    Mail,
    Image as ImageIcon,
    PenTool,
    UserPlus,
    Fingerprint,
    Camera
} from 'lucide-react';
import { supabase } from './lib/supabase';
import { encryptFile } from './lib/crypto';
import { hashPassword } from './lib/security';
import GoogleDriveTab from './components/GoogleDriveTab';
import AnalyticsDashboard from './components/analytics/AnalyticsDashboard';
import DashboardAnimation from './components/DashboardAnimation';
import AuditTrail from './components/AuditTrail';
import SignerManagement, { type Signer } from './components/SignerManagement';
import SignatureFieldEditor, { type SignatureField } from './components/SignatureFieldEditor';
import { setupDocumentESignature } from './lib/esignature';
import { logDocumentUpload, logLinkCopy } from './lib/auditLogger';
import { registerBiometric, isBiometricAvailable } from './lib/webauthn';

interface Document {
    id: string;
    name: string;
    size: string;
    type: string;
    uploadedAt: string;
    link: string;
    file_path: string;
    settings: {
        password: string;
        expiresAt: string;
        allowDownload: boolean;
        customDomain: string;
    };
    watermark_config?: WatermarkConfig;
}

interface WatermarkConfig {
    text: string;
    color: string;
    opacity: number;
    fontSize: number;
    rotation: number;
    layout: 'single' | 'tiled';
}

const DataRoom: React.FC = () => {
    const { user } = useUser();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [activeTab, setActiveTab] = useState<'upload' | 'google-drive' | 'documents' | 'analytics' | 'audit'>('upload');
    const [selectedDocumentId, setSelectedDocumentId] = useState<string | undefined>(undefined);

    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadedDoc, setUploadedDoc] = useState<Document | null>(null);
    const [copiedId, setCopiedId] = useState<string | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    // Settings State
    const [passwordProtection, setPasswordProtection] = useState(false);
    const [linkExpiration, setLinkExpiration] = useState(false);
    const [allowDownloads, setAllowDownloads] = useState(true);
    const [password, setPassword] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    const [screenshotProtection, setScreenshotProtection] = useState(false);
    const [emailVerification, setEmailVerification] = useState(false);
    const [allowedEmail, setAllowedEmail] = useState('');
    const [applyWatermark, setApplyWatermark] = useState(false);
    const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig>({
        text: 'CONFIDENTIAL {{email}}',
        color: '#000000',
        opacity: 0.3,
        fontSize: 24,
        rotation: -45,
        layout: 'tiled'
    });
    const [requestSignature, setRequestSignature] = useState(false);

    // New Biometric/Snapshot State
    const [requireBiometric, setRequireBiometric] = useState(false);
    const [requireSnapshot, setRequireSnapshot] = useState(false);
    const [biometricCredentialId, setBiometricCredentialId] = useState<string | null>(null);
    const [biometricRegistering, setBiometricRegistering] = useState(false);

    // E-Signature State
    const [signers, setSigners] = useState<Signer[]>([]);
    const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);
    const [signatureWorkflowType, setSignatureWorkflowType] = useState<'sequential' | 'parallel'>('sequential');
    const [showFieldEditor, setShowFieldEditor] = useState(false);
    const [signingLinks, setSigningLinks] = useState<any[]>([]);

    // Create preview URL when file is selected
    useEffect(() => {
        if (selectedFile) {
            const objectUrl = URL.createObjectURL(selectedFile);
            setFilePreview(objectUrl);

            // Cleanup function to revoke object URL
            return () => {
                URL.revokeObjectURL(objectUrl);
            };
        } else {
            setFilePreview(null);
        }
    }, [selectedFile]);



    useEffect(() => {
        fetchDocuments();
    }, []);

    const fetchDocuments = async () => {
        try {
            let query = supabase
                .from('documents')
                .select('*')
                .order('created_at', { ascending: false });

            // Filter by user if authenticated
            if (user) {
                query = query.eq('user_id', user.id);
            }

            const { data, error } = await query;

            if (error) throw error;

            if (data) {
                const formattedDocs: Document[] = data.map(doc => ({
                    id: doc.id,
                    name: doc.name,
                    size: (doc.file_size / 1024).toFixed(2) + ' KB',
                    type: doc.file_type,
                    uploadedAt: new Date(doc.created_at).toLocaleDateString(),
                    link: `${window.location.origin}/view/${doc.share_link}`,
                    file_path: doc.file_path,
                    settings: {
                        password: doc.password || '',
                        expiresAt: doc.expires_at || '',
                        allowDownload: doc.allow_download,
                        customDomain: doc.custom_domain || ''
                    }
                }));
                setDocuments(formattedDocs);
            }
        } catch (error) {
            console.error('Error fetching documents:', error);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) handleFileSelection(files[0]);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    };

    const handleFileSelection = (file: File) => {
        setSelectedFile(file);
        setUploadedDoc(null);
        setUploadError(null);
        setFilePreview(null); // Will be set by useEffect
    };

    const handleBiometricToggle = async (enabled: boolean) => {
        if (!enabled) {
            // User is disabling biometric protection
            setRequireBiometric(false);
            setBiometricCredentialId(null);
            return;
        }

        // User is enabling biometric protection - register immediately
        setBiometricRegistering(true);
        setUploadError(null);

        try {
            // Check availability first
            const available = await isBiometricAvailable();
            if (!available) {
                setUploadError('Biometric authentication is not available on this device. Please ensure you have Touch ID, Face ID, or Windows Hello enabled.');
                return;
            }

            // Trigger registration
            const result = await registerBiometric();

            if (result.success && result.credentialId) {
                setRequireBiometric(true);
                setBiometricCredentialId(result.credentialId);
                // Optional: Show success feedback
                console.log('✓ Biometric registered successfully');
            } else {
                setUploadError(result.error || 'Failed to register biometric');
            }
        } catch (error: any) {
            console.error('Biometric registration error:', error);
            setUploadError('Failed to register biometric. Please try again.');
        } finally {
            setBiometricRegistering(false);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            console.log('=== UPLOAD DEBUG START ===');
            console.log('Selected file:', selectedFile.name, selectedFile.size, 'bytes');

            // Validate biometric requirement
            if (requireBiometric && !biometricCredentialId) {
                throw new Error('Biometric protection is enabled but registration was not completed. Please toggle biometric protection again.');
            }

            // 1. Encrypt file before upload
            let encryptedBlob, key, iv;
            try {
                const result = await encryptFile(selectedFile);
                encryptedBlob = result.encryptedBlob;
                key = result.key;
                iv = result.iv;
                console.log('✓ File encrypted successfully');
            } catch (err) {
                console.error('✗ Encryption error:', err);
                throw new Error('Failed to encrypt file. Please try again.');
            }

            // 2. Upload encrypted file to Supabase Storage
            const fileExt = selectedFile.name.split('.').pop();
            const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
            const filePath = `uploads/${fileName}`;

            console.log('Attempting upload to:', filePath);
            console.log('Upload size:', encryptedBlob.size, 'bytes');

            const { error: uploadError, data: uploadData } = await supabase.storage
                .from('documents')
                .upload(filePath, encryptedBlob);

            if (uploadError) {
                console.error('✗ Storage upload error:', uploadError);
                console.error('Error details:', JSON.stringify(uploadError, null, 2));
                console.error('Error name:', uploadError.name);
                console.error('Error message:', uploadError.message);

                // Check if it's a CORS error
                if (uploadError.message?.includes('fetch') || uploadError.message?.includes('CORS')) {
                    throw new Error(`CORS Error: Your Supabase project is blocking requests from localhost. Please add http://localhost:5173 to your Supabase Dashboard > Settings > API > CORS settings.`);
                }

                throw new Error(`Storage upload failed: ${uploadError.message}`);
            }
            console.log('✓ File uploaded to storage successfully');
            console.log('Upload data:', uploadData);

            const shareLink = Math.random().toString(36).substring(2, 12);

            // 4. Save document metadata to database with encryption details
            const { data: docData, error: dbError } = await supabase
                .from('documents')
                .insert({
                    name: selectedFile.name,
                    file_path: filePath,
                    file_size: selectedFile.size,
                    file_type: selectedFile.type,
                    share_link: shareLink,
                    allow_download: allowDownloads,
                    password: passwordProtection ? await hashPassword(password) : null,
                    expires_at: linkExpiration ? expiresAt : null,
                    custom_domain: null,
                    screenshot_protection: screenshotProtection,
                    email_verification: emailVerification,
                    allowed_email: emailVerification ? allowedEmail : null,
                    apply_watermark: applyWatermark,
                    watermark_config: applyWatermark ? watermarkConfig : null,
                    require_biometric: requireBiometric,
                    require_snapshot: requireSnapshot,
                    biometric_credential_id: requireBiometric ? biometricCredentialId : null,
                    // Encryption metadata
                    encryption_key: key,
                    encryption_iv: iv,
                    is_encrypted: true,
                    original_file_name: selectedFile.name,
                    original_file_type: selectedFile.type,
                    user_id: user?.id || null // Store authenticated user ID
                })
                .select()
                .single();

            if (dbError) {
                console.error('Database insert error:', dbError);
                throw new Error(`Database save failed: ${dbError.message}`);
            }
            console.log('Document metadata saved successfully');

            const newDoc: Document = {
                id: docData.id,
                name: selectedFile.name,
                size: (selectedFile.size / 1024).toFixed(2) + ' KB',
                type: selectedFile.type,
                uploadedAt: new Date().toLocaleDateString(),
                link: `${window.location.origin}/view/${shareLink}`,
                file_path: filePath,
                settings: {
                    password: passwordProtection ? 'protected' : '',
                    expiresAt: linkExpiration ? expiresAt : '',
                    allowDownload: allowDownloads,
                    customDomain: ''
                }
            };

            setDocuments(prev => [newDoc, ...prev]);
            setUploadedDoc(newDoc);

            // Log audit event for document upload
            await logDocumentUpload(docData.id, selectedFile.name, selectedFile.size, {
                metadata: {
                    passwordProtected: passwordProtection,
                    expirationSet: linkExpiration,
                    downloadsAllowed: allowDownloads,
                    signatureRequired: requestSignature,
                    biometricRequired: requireBiometric,
                    snapshotRequired: requireSnapshot
                }
            });

            // If e-signature is requested, setup signers and fields
            if (requestSignature && signers.length > 0 && signatureFields.length > 0) {
                try {
                    const result = await setupDocumentESignature(
                        docData.id,
                        signers,
                        signatureFields,
                        signatureWorkflowType
                    );

                    if (result.success && result.signingLinks) {
                        setSigningLinks(result.signingLinks);
                        console.log('E-signature setup complete:', result.signingLinks);
                    } else {
                        console.error('E-signature setup failed:', result.error);
                    }
                } catch (esigError) {
                    console.error('E-signature error:', esigError);
                }
            }

            setSelectedFile(null);

        } catch (error: any) {
            console.error('Upload error:', error);
            const errorMessage = error.message || 'Upload failed';
            setUploadError(errorMessage);
            window.alert(`Upload Error: ${errorMessage}\n\nPlease check if your CORS settings in Supabase Dashboard match your browser URL exactly.`);
        }

        setIsUploading(false);
    };

    const copyLink = (link: string) => {
        navigator.clipboard.writeText(link);
        setCopiedId('link');
        setTimeout(() => setCopiedId(null), 2000);

        // Log link copy event
        if (uploadedDoc?.id) {
            logLinkCopy(uploadedDoc.id, 'share');
        }
    };

    const handlePreview = async () => {
        if (!uploadedDoc) return;

        try {
            // Get public URL from Supabase storage
            const { data } = supabase.storage
                .from('documents')
                .getPublicUrl(uploadedDoc.file_path);

            if (data?.publicUrl) {
                setPreviewUrl(data.publicUrl);
                setShowPreviewModal(true);
            }
        } catch (error) {
            console.error('Error loading preview:', error);
        }
    };

    return (
        <div style={{ background: '#f9fafb', minHeight: '100vh' }}>
            {/* Header */}
            <header style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '1.5rem 2rem' }}>
                <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.75rem', fontWeight: '700', color: '#4f46e5', marginBottom: '0.5rem' }}>DocTransfer Dashboard</h1>
                            <p style={{ fontSize: '0.95rem', color: '#6b7280' }}>Welcome back! Here's what's happening.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                            <button style={{ padding: '0.625rem 1.25rem', background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', color: '#374151', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <UserPlus size={18} />
                                Team
                            </button>
                            <button style={{ padding: '0.625rem 1.25rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                                <Upload size={18} />
                                Upload Document
                            </button>
                        </div>
                    </div>

                    {/* Stats Grid / Animation */}
                    <div style={{ marginBottom: '2rem' }}>
                        <DashboardAnimation />
                    </div>

                    {/* Navigation Tabs */}
                    <div style={{ display: 'flex', gap: '0.5rem', background: '#f3f4f6', padding: '0.5rem', borderRadius: '12px', width: 'fit-content' }}>
                        <button onClick={() => setActiveTab('upload')} style={{ padding: '0.625rem 1.5rem', background: activeTab === 'upload' ? '#8b5cf6' : 'transparent', color: activeTab === 'upload' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <Upload size={16} /> Upload
                        </button>
                        <button onClick={() => setActiveTab('google-drive')} style={{ padding: '0.625rem 1.5rem', background: activeTab === 'google-drive' ? '#8b5cf6' : 'transparent', color: activeTab === 'google-drive' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <Globe size={16} /> Google Drive
                        </button>
                        <button onClick={() => setActiveTab('documents')} style={{ padding: '0.625rem 1.5rem', background: activeTab === 'documents' ? '#8b5cf6' : 'transparent', color: activeTab === 'documents' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <FileText size={16} /> Documents
                        </button>
                        <button onClick={() => setActiveTab('analytics')} style={{ padding: '0.625rem 1.5rem', background: activeTab === 'analytics' ? '#8b5cf6' : 'transparent', color: activeTab === 'analytics' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <BarChart2 size={16} /> Analytics
                        </button>
                        <button onClick={() => setActiveTab('audit')} style={{ padding: '0.625rem 1.5rem', background: activeTab === 'audit' ? '#8b5cf6' : 'transparent', color: activeTab === 'audit' ? 'white' : '#6b7280', border: 'none', borderRadius: '8px', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', transition: 'all 0.2s' }}>
                            <Shield size={16} /> Audit Trail
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main style={{ maxWidth: '1400px', margin: '0 auto', padding: '2rem' }}>
                {activeTab === 'google-drive' ? (
                    <GoogleDriveTab onDocumentUploaded={fetchDocuments} />
                ) : activeTab === 'analytics' ? (
                    <AnalyticsDashboard documentId={selectedDocumentId} />
                ) : activeTab === 'audit' ? (
                    <div className="animate-fade-in">
                        <AuditTrail documentId={selectedDocumentId || documents.map(d => d.id)} />
                    </div>
                ) : activeTab === 'documents' ? (
                    <div className="animate-fade-in">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827' }}>My Documents</h2>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="Search documents..."
                                    style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #d1d5db', minWidth: '250px' }}
                                />
                            </div>
                        </div>

                        {documents.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '4rem', background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                                <FileText size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>No documents found</h3>
                                <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>Upload your first document to get started.</p>
                                <button
                                    onClick={() => setActiveTab('upload')}
                                    style={{ padding: '0.75rem 1.5rem', background: '#4f46e5', color: 'white', borderRadius: '8px', border: 'none', fontWeight: '500', cursor: 'pointer' }}
                                >
                                    Upload Document
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                                {documents.map(doc => (
                                    <div key={doc.id} style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb', overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'transform 0.2s', cursor: 'pointer' }}
                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                    >
                                        <div style={{ padding: '1.25rem', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <div style={{ padding: '0.5rem', background: '#eff6ff', borderRadius: '8px', color: '#3b82f6' }}>
                                                    <FileText size={20} />
                                                </div>
                                                <div>
                                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#111827', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' }}>{doc.name}</h3>
                                                    <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>{doc.size} • {doc.uploadedAt}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    // Copy link logic
                                                    navigator.clipboard.writeText(doc.link);
                                                    setCopiedId(doc.id);
                                                    setTimeout(() => setCopiedId(null), 2000);
                                                }}
                                                style={{ padding: '0.5rem', background: 'transparent', border: 'none', cursor: 'pointer', color: copiedId === doc.id ? '#10b981' : '#9ca3af' }}
                                            >
                                                {copiedId === doc.id ? <Check size={18} /> : <Copy size={18} />}
                                            </button>
                                        </div>
                                        <div style={{ padding: '1rem', background: '#f9fafb', display: 'flex', gap: '0.5rem' }}>
                                            <a
                                                href={doc.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{ flex: 1, padding: '0.5rem', textAlign: 'center', background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', color: '#374151', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '500' }}
                                            >
                                                View
                                            </a>
                                            <button
                                                onClick={() => {
                                                    setSelectedDocumentId(doc.id);
                                                    setActiveTab('analytics');
                                                }}
                                                style={{ flex: 1, padding: '0.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', color: '#166534', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                            >
                                                <BarChart2 size={16} /> Analytics
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedDocumentId(doc.id);
                                                    setActiveTab('audit');
                                                }}
                                                style={{ padding: '0.5rem', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '6px', color: '#0369a1', fontSize: '0.875rem', fontWeight: '500', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }}
                                                title="View Audit Trail"
                                            >
                                                <Shield size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                            {/* Upload Document Section - Recreated */}
                            <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #f3f4f6' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <Upload size={24} style={{ color: '#4f46e5' }} />
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Upload Document</h2>
                                </div>
                                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1.5rem' }}>Upload any document to generate a secure sharing link</p>

                                {/* Error Display */}
                                {uploadError && (
                                    <div style={{ padding: '1rem', background: '#fee2e2', color: '#dc2626', borderRadius: '12px', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                                        <Shield size={18} />
                                        <span>{uploadError}</span>
                                    </div>
                                )}

                                {/* Upload Area */}
                                <div
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => document.getElementById('file-upload')?.click()}
                                    style={{
                                        padding: '3rem 2rem',
                                        border: isDragging ? '2px dashed #4f46e5' : selectedFile ? '2px dashed #10b981' : '2px dashed #e5e7eb',
                                        borderRadius: '12px',
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        marginBottom: '1.5rem',
                                        background: isDragging ? '#f0f4ff' : selectedFile ? '#f0fdf4' : '#fafbfc',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {/* Icon with checkmark when file selected */}
                                    <div style={{
                                        width: '80px',
                                        height: '80px',
                                        margin: '0 auto 1rem',
                                        background: selectedFile ? '#dcfce7' : '#f3f4f6',
                                        borderRadius: '50%',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        position: 'relative',
                                        transition: 'all 0.3s ease'
                                    }}>
                                        {selectedFile ? (
                                            <Check size={40} color="#10b981" strokeWidth={3} />
                                        ) : (
                                            <FileText size={36} color="#6b7280" />
                                        )}
                                    </div>
                                    <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.5rem', color: selectedFile ? '#047857' : '#374151' }}>
                                        {selectedFile ? selectedFile.name : 'Click to upload or drag and drop'}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: selectedFile ? '#10b981' : '#9ca3af', fontWeight: selectedFile ? '500' : '400' }}>
                                        {selectedFile ? `${(selectedFile.size / 1024).toFixed(2)} KB • Ready to upload` : 'Supports documents, images, videos, presentations, and more'}
                                    </p>
                                    {!selectedFile && (
                                        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>Maximum file size: 30 MB</p>
                                    )}
                                    <input
                                        type="file"
                                        onChange={handleFileInput}
                                        id="file-upload"
                                        accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                                        disabled={isUploading}
                                        style={{ display: 'none' }}
                                    />
                                </div>

                                {/* Settings */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                    {/* Password Protection */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Lock size={18} style={{ color: '#6b7280' }} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Password Protection</span>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={passwordProtection} onChange={(e) => setPasswordProtection(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {passwordProtection && (
                                            <input
                                                type="password"
                                                placeholder="Enter password"
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                style={{
                                                    padding: '0.625rem 0.875rem',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    fontSize: '0.875rem',
                                                    outline: 'none',
                                                    marginLeft: '2rem'
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Link Expiration */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Calendar size={18} style={{ color: '#6b7280' }} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Link Expiration</span>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={linkExpiration} onChange={(e) => setLinkExpiration(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {linkExpiration && (
                                            <input
                                                type="date"
                                                value={expiresAt}
                                                onChange={(e) => setExpiresAt(e.target.value)}
                                                min={new Date().toISOString().split('T')[0]}
                                                style={{
                                                    padding: '0.625rem 0.875rem',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    fontSize: '0.875rem',
                                                    outline: 'none',
                                                    marginLeft: '2rem',
                                                    color: '#374151'
                                                }}
                                            />
                                        )}
                                    </div>

                                    {/* Allow Downloads */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Download size={18} style={{ color: '#6b7280' }} />
                                            <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Allow Downloads</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={allowDownloads} onChange={(e) => setAllowDownloads(e.target.checked)} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    {/* Screenshot Protection */}
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Shield size={18} style={{ color: '#6b7280' }} />
                                            <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Screenshot Protection</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" checked={screenshotProtection} onChange={(e) => setScreenshotProtection(e.target.checked)} />
                                            <span className="toggle-slider"></span>
                                        </label>
                                    </div>

                                    {/* Email Verification */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Mail size={18} style={{ color: '#6b7280' }} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Require Email Verification</span>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={emailVerification} onChange={(e) => setEmailVerification(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {emailVerification && (
                                            <input
                                                type="email"
                                                placeholder="Enter recipient email (optional)"
                                                value={allowedEmail}
                                                onChange={(e) => setAllowedEmail(e.target.value)}
                                                style={{
                                                    padding: '0.625rem 0.875rem',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '8px',
                                                    fontSize: '0.875rem',
                                                    outline: 'none',
                                                    marginLeft: '2rem'
                                                }}
                                            />
                                        )}

                                    </div>

                                    {/* Biometric & Snapshot Gates */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '1rem', background: '#f0fdf4', borderRadius: '12px', border: '1px solid #bbf7d0' }}>
                                        <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #dcfce7', fontSize: '0.85rem', fontWeight: '600', color: '#166534' }}>
                                            SECURITY GATES
                                        </div>

                                        {/* Biometric Toggle */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Fingerprint size={18} style={{ color: '#15803d' }} />
                                                <div>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#166534', display: 'block' }}>
                                                        Require Biometrics
                                                        {biometricRegistering && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#ca8a04' }}>(Registering...)</span>}
                                                        {requireBiometric && biometricCredentialId && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: '#16a34a' }}>✓</span>}
                                                    </span>
                                                    <span style={{ fontSize: '0.75rem', color: '#15803d' }}>FaceID / TouchID / Windows Hello</span>
                                                </div>
                                            </div>
                                            <label className="toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={requireBiometric}
                                                    onChange={(e) => handleBiometricToggle(e.target.checked)}
                                                    disabled={biometricRegistering}
                                                />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>

                                        {/* Snapshot Toggle */}
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <Camera size={18} style={{ color: '#15803d' }} />
                                                <div>
                                                    <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#166534', display: 'block' }}>Require Webcam Snapshot</span>
                                                    <span style={{ fontSize: '0.75rem', color: '#15803d' }}>Capture photo before access</span>
                                                </div>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={requireSnapshot} onChange={(e) => setRequireSnapshot(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Watermark */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <ImageIcon size={18} style={{ color: '#6b7280' }} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Apply Dynamic Watermark</span>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={applyWatermark} onChange={(e) => setApplyWatermark(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {applyWatermark && (
                                            <div style={{ marginLeft: '2rem', marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                {/* Text Template */}
                                                <div style={{ marginBottom: '1rem' }}>
                                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#64748b', marginBottom: '0.25rem' }}>Watermark Text</label>
                                                    <input
                                                        type="text"
                                                        value={watermarkConfig.text}
                                                        onChange={(e) => setWatermarkConfig({ ...watermarkConfig, text: e.target.value })}
                                                        style={{ width: '100%', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem' }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                                        {['{{email}}', '{{ip}}', '{{date}}'].map(tag => (
                                                            <button
                                                                key={tag}
                                                                onClick={() => setWatermarkConfig(prev => ({ ...prev, text: prev.text + ' ' + tag }))}
                                                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: '#e0e7ff', color: '#4338ca', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                + {tag}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Settings Grid */}
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Color</label>
                                                        <input
                                                            type="color"
                                                            value={watermarkConfig.color}
                                                            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, color: e.target.value })}
                                                            style={{ width: '100%', height: '36px', border: 'none', cursor: 'pointer' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Opacity ({watermarkConfig.opacity})</label>
                                                        <input
                                                            type="range"
                                                            min="0.1" max="1" step="0.1"
                                                            value={watermarkConfig.opacity}
                                                            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, opacity: parseFloat(e.target.value) })}
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Size ({watermarkConfig.fontSize}px)</label>
                                                        <input
                                                            type="range"
                                                            min="12" max="72" step="2"
                                                            value={watermarkConfig.fontSize}
                                                            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, fontSize: parseInt(e.target.value) })}
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#64748b' }}>Rotation ({watermarkConfig.rotation}°)</label>
                                                        <input
                                                            type="range"
                                                            min="-90" max="90" step="5"
                                                            value={watermarkConfig.rotation}
                                                            onChange={(e) => setWatermarkConfig({ ...watermarkConfig, rotation: parseInt(e.target.value) })}
                                                            style={{ width: '100%' }}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Layout Toggle */}
                                                <div style={{ marginTop: '1rem' }}>
                                                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '500', color: '#64748b', marginBottom: '0.25rem' }}>Layout</label>
                                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                        <button
                                                            onClick={() => setWatermarkConfig({ ...watermarkConfig, layout: 'single' })}
                                                            style={{
                                                                flex: 1, padding: '0.5rem',
                                                                background: watermarkConfig.layout === 'single' ? '#3b82f6' : 'white',
                                                                color: watermarkConfig.layout === 'single' ? 'white' : '#64748b',
                                                                border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer'
                                                            }}
                                                        >
                                                            Single
                                                        </button>
                                                        <button
                                                            onClick={() => setWatermarkConfig({ ...watermarkConfig, layout: 'tiled' })}
                                                            style={{
                                                                flex: 1, padding: '0.5rem',
                                                                background: watermarkConfig.layout === 'tiled' ? '#3b82f6' : 'white',
                                                                color: watermarkConfig.layout === 'tiled' ? 'white' : '#64748b',
                                                                border: '1px solid #cbd5e1', borderRadius: '4px', cursor: 'pointer'
                                                            }}
                                                        >
                                                            Tiled
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Live Preview */}
                                                <div style={{
                                                    marginTop: '1rem',
                                                    height: '150px',
                                                    background: 'white',
                                                    border: '1px dashed #cbd5e1',
                                                    position: 'relative',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center'
                                                }}>
                                                    <div style={{
                                                        position: 'absolute',
                                                        inset: 0,
                                                        display: 'flex',
                                                        flexWrap: 'wrap',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        transform: `rotate(${watermarkConfig.rotation}deg)`,
                                                        pointerEvents: 'none'
                                                    }}>
                                                        {[...Array(watermarkConfig.layout === 'tiled' ? 6 : 1)].map((_, i) => (
                                                            <span key={i} style={{
                                                                color: watermarkConfig.color,
                                                                opacity: watermarkConfig.opacity,
                                                                fontSize: `${watermarkConfig.fontSize}px`,
                                                                margin: '20px',
                                                                whiteSpace: 'nowrap'
                                                            }}>
                                                                {watermarkConfig.text}
                                                            </span>
                                                        ))}
                                                    </div>
                                                    <span style={{ position: 'relative', zIndex: -1, color: '#94a3b8', fontSize: '0.8rem' }}>Document Content Preview</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* E-Signature */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <PenTool size={18} style={{ color: '#6b7280' }} />
                                                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: '#374151' }}>Request E-Signature</span>
                                            </div>
                                            <label className="toggle-switch">
                                                <input type="checkbox" checked={requestSignature} onChange={(e) => setRequestSignature(e.target.checked)} />
                                                <span className="toggle-slider"></span>
                                            </label>
                                        </div>
                                        {requestSignature && (
                                            <>
                                                <div style={{ marginLeft: '2rem', padding: '1rem', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: '8px', fontSize: '0.875rem' }}>
                                                    <p style={{ color: '#92400e', marginBottom: '0.5rem', fontWeight: '500' }}>📝 E-Signature Workflow</p>
                                                    <ol style={{ color: '#92400e', marginLeft: '1.25rem', lineHeight: '1.5' }}>
                                                        <li>Add signers below</li>
                                                        <li>Upload your document</li>
                                                        <li>Place signature fields on the document</li>
                                                        <li>Get signing links for each signer</li>
                                                    </ol>
                                                </div>

                                                {/* Workflow Type Selector */}
                                                <div style={{ marginLeft: '2rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px' }}>
                                                    <label style={{ fontSize: '0.875rem', fontWeight: '500', color: '#374151', display: 'block', marginBottom: '0.5rem' }}>
                                                        Signing Workflow
                                                    </label>
                                                    <div style={{ display: 'flex', gap: '0.5rem', background: 'white', padding: '0.25rem', borderRadius: '6px' }}>
                                                        <button
                                                            onClick={() => setSignatureWorkflowType('sequential')}
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.5rem',
                                                                background: signatureWorkflowType === 'sequential' ? '#8b5cf6' : 'transparent',
                                                                color: signatureWorkflowType === 'sequential' ? 'white' : '#6b7280',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '500',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Sequential
                                                        </button>
                                                        <button
                                                            onClick={() => setSignatureWorkflowType('parallel')}
                                                            style={{
                                                                flex: 1,
                                                                padding: '0.5rem',
                                                                background: signatureWorkflowType === 'parallel' ? '#8b5cf6' : 'transparent',
                                                                color: signatureWorkflowType === 'parallel' ? 'white' : '#6b7280',
                                                                border: 'none',
                                                                borderRadius: '4px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: '500',
                                                                cursor: 'pointer'
                                                            }}
                                                        >
                                                            Parallel
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Signer Management */}
                                                <div style={{ marginLeft: '2rem' }}>
                                                    <SignerManagement
                                                        signers={signers}
                                                        onSignersChange={setSigners}
                                                        workflowType={signatureWorkflowType}
                                                        maxSigners={10}
                                                    />
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* Upload Button */}
                                <button
                                    onClick={() => {
                                        // If e-signature is enabled and we have a document, show field editor
                                        if (requestSignature && selectedFile && !uploadedDoc && signers.length > 0) {
                                            setShowFieldEditor(true);
                                        } else {
                                            handleUpload();
                                        }
                                    }}
                                    disabled={!selectedFile || isUploading || (requestSignature && signers.length === 0)}
                                    style={{
                                        width: '100%',
                                        padding: '0.875rem',
                                        background: !selectedFile || isUploading ? '#9ca3af' : '#6366f1',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '10px',
                                        fontWeight: '600',
                                        fontSize: '0.95rem',
                                        cursor: !selectedFile || isUploading ? 'not-allowed' : 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '0.5rem'
                                    }}
                                >
                                    {isUploading ? 'Generating Link...' : (
                                        <>
                                            <LinkIcon size={18} />
                                            Generate Secure Link
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Sharing Link Section */}
                            <div style={{ background: 'white', borderRadius: '20px', padding: '2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                    <LinkIcon size={24} style={{ color: '#3b82f6' }} />
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827' }}>Sharing & Signing</h2>
                                </div>
                                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '2rem' }}>Manage links for your document</p>

                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '400px' }}>
                                    {uploadedDoc && (
                                        <div style={{ padding: '1.5rem', background: '#f9fafb', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#111827' }}>Public Share Link</h3>
                                            <div style={{ width: '100%', padding: '0.75rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                                <input
                                                    type="text"
                                                    value={uploadedDoc.link}
                                                    readOnly
                                                    style={{ fontSize: '0.875rem', flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#374151' }}
                                                />
                                                <button
                                                    onClick={() => copyLink(uploadedDoc.link)}
                                                    style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '6px', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                                                >
                                                    {copiedId === 'link' ? <Check size={16} color="#16a34a" /> : <Copy size={16} color="#6b7280" />}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {signingLinks.length > 0 && (
                                        <div style={{ padding: '1.5rem', background: '#eff6ff', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
                                            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: '#1e40af' }}>Signer Links</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                                {signingLinks.map((sl, idx) => (
                                                    <div key={idx} style={{ padding: '0.75rem', background: 'white', borderRadius: '8px', border: '1px solid #fee2e2' }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                                            <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#1f2937' }}>{sl.signer_name}</span>
                                                            <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{sl.signer_email}</span>
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                            <input
                                                                type="text"
                                                                value={`${window.location.origin}/sign/${sl.signing_link}`}
                                                                readOnly
                                                                style={{ fontSize: '0.8rem', flex: 1, border: 'none', background: 'transparent', outline: 'none', color: '#4b5563' }}
                                                            />
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(`${window.location.origin}/sign/${sl.signing_link}`);
                                                                    setCopiedId(`sl-${idx}`);
                                                                    setTimeout(() => setCopiedId(null), 2000);
                                                                }}
                                                                style={{ background: '#f3f4f6', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}
                                                            >
                                                                {copiedId === `sl-${idx}` ? <Check size={14} color="#16a34a" /> : <Copy size={14} color="#6b7280" />}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {!uploadedDoc && !selectedFile && (
                                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', flexDirection: 'column', gap: '1rem' }}>
                                            <LinkIcon size={48} opacity={0.2} />
                                            <p>Upload a file to generate links</p>
                                        </div>
                                    )}

                                    {selectedFile && filePreview && !uploadedDoc && (
                                        <div style={{ width: '100%', maxHeight: '350px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '1rem', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {selectedFile.type.startsWith('image/') ? (
                                                <img
                                                    src={filePreview}
                                                    alt="Preview"
                                                    style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', borderRadius: '8px' }}
                                                />
                                            ) : selectedFile.type === 'application/pdf' ? (
                                                <iframe
                                                    src={filePreview}
                                                    style={{ width: '100%', height: '300px', border: 'none', borderRadius: '8px' }}
                                                    title="PDF Preview"
                                                />
                                            ) : selectedFile.type === 'text/plain' ? (
                                                <iframe
                                                    src={filePreview}
                                                    style={{ width: '100%', height: '300px', border: 'none', borderRadius: '8px', background: 'white' }}
                                                    title="Text Preview"
                                                />
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '2rem', color: '#6b7280' }}>
                                                    <FileText size={64} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                                                    <p style={{ fontSize: '0.875rem' }}>Preview not available for this file type</p>
                                                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>{selectedFile.type || 'Unknown type'}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {uploadedDoc && (
                                        <button
                                            onClick={handlePreview}
                                            style={{
                                                width: '100%',
                                                padding: '0.75rem',
                                                background: '#f9fafb',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '10px',
                                                color: '#374151',
                                                fontWeight: '600',
                                                fontSize: '0.9rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                gap: '0.5rem',
                                                transition: 'all 0.2s',
                                                marginTop: 'auto'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#f3f4f6'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = '#f9fafb'}
                                        >
                                            <Eye size={18} />
                                            Preview Document
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Preview Modal */}
            {
                showPreviewModal && uploadedDoc && previewUrl && (
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            background: 'rgba(0, 0, 0, 0.85)',
                            zIndex: 9999,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: '2rem'
                        }}
                        onClick={() => setShowPreviewModal(false)}
                    >
                        <div
                            style={{
                                background: 'white',
                                borderRadius: '16px',
                                maxWidth: '1200px',
                                width: '100%',
                                maxHeight: '90vh',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden'
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{
                                padding: '1.5rem',
                                borderBottom: '1px solid #e5e7eb',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                                        {uploadedDoc.name}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                        {uploadedDoc.size} • {uploadedDoc.type}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowPreviewModal(false)}
                                    style={{
                                        width: '40px',
                                        height: '40px',
                                        borderRadius: '8px',
                                        border: '1px solid #e5e7eb',
                                        background: 'white',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: '#6b7280',
                                        fontSize: '1.5rem'
                                    }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div style={{
                                flex: 1,
                                overflow: 'auto',
                                padding: '1.5rem',
                                background: '#f9fafb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {uploadedDoc.type.startsWith('image/') ? (
                                    <img
                                        src={previewUrl}
                                        alt={uploadedDoc.name}
                                        style={{
                                            maxWidth: '100%',
                                            maxHeight: '100%',
                                            objectFit: 'contain',
                                            borderRadius: '8px'
                                        }}
                                    />
                                ) : uploadedDoc.type === 'application/pdf' ? (
                                    <iframe
                                        src={previewUrl}
                                        style={{
                                            width: '100%',
                                            height: '600px',
                                            border: 'none',
                                            borderRadius: '8px',
                                            background: 'white'
                                        }}
                                        title="PDF Preview"
                                    />
                                ) : uploadedDoc.type === 'text/plain' ? (
                                    <iframe
                                        src={previewUrl}
                                        style={{
                                            width: '100%',
                                            height: '600px',
                                            border: 'none',
                                            borderRadius: '8px',
                                            background: 'white',
                                            padding: '1rem'
                                        }}
                                        title="Text Preview"
                                    />
                                ) : (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
                                        <FileText size={80} color="#9ca3af" style={{ marginBottom: '1.5rem' }} />
                                        <h4 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '0.5rem', color: '#374151' }}>
                                            Preview not available
                                        </h4>
                                        <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                                            This file type cannot be previewed in the browser
                                        </p>
                                        <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#9ca3af' }}>
                                            {uploadedDoc.type || 'Unknown type'}
                                        </p>
                                        <a
                                            href={uploadedDoc.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            style={{
                                                display: 'inline-block',
                                                marginTop: '1.5rem',
                                                padding: '0.75rem 1.5rem',
                                                background: '#4f46e5',
                                                color: 'white',
                                                borderRadius: '8px',
                                                textDecoration: 'none',
                                                fontWeight: '600',
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            Open in New Tab
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Signature Field Editor Modal */}
            {
                showFieldEditor && selectedFile && (
                    <SignatureFieldEditor
                        file={selectedFile}
                        signers={signers}
                        onSave={(fields) => {
                            setSignatureFields(fields);
                            setShowFieldEditor(false);
                            // Now upload the document with e-signature
                            handleUpload();
                        }}
                        onClose={() => setShowFieldEditor(false)}
                    />
                )
            }

            {/* Signing Links Display (shown after successful upload with e-signature) */}
            {
                signingLinks.length > 0 && uploadedDoc && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'rgba(0, 0, 0, 0.75)',
                        zIndex: 10000,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '2rem'
                    }}
                        onClick={() => setSigningLinks([])}
                    >
                        <div style={{
                            background: 'white',
                            borderRadius: '20px',
                            padding: '2rem',
                            maxWidth: '600px',
                            width: '100%',
                            maxHeight: '80vh',
                            overflow: 'auto'
                        }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', marginBottom: '1rem' }}>
                                🎉 E-Signature Document Created!
                            </h2>
                            <p style={{ color: '#6b7280', marginBottom: '2rem' }}>
                                Share these links with signers. They will sign in the order specified.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {signingLinks.map((signer, index) => (
                                    <div key={signer.id} style={{
                                        padding: '1rem',
                                        background: '#f9fafb',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '10px'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                            <div style={{
                                                width: '32px',
                                                height: '32px',
                                                borderRadius: '50%',
                                                background: ['#4f46e5', '#10b981', '#f59e0b'][index % 3],
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontWeight: '600'
                                            }}>
                                                {signer.signing_order || (index + 1)}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', color: '#111827' }}>{signer.signer_name}</div>
                                                <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>{signer.signer_email}</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={`${window.location.origin}/sign/${signer.signing_link}`}
                                                readOnly
                                                style={{
                                                    flex: 1,
                                                    padding: '0.5rem',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    fontSize: '0.875rem',
                                                    background: 'white'
                                                }}
                                            />
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(`${window.location.origin}/sign/${signer.signing_link}`);
                                                }}
                                                style={{
                                                    padding: '0.5rem 1rem',
                                                    background: '#4f46e5',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    fontSize: '0.875rem',
                                                    fontWeight: '500'
                                                }}
                                            >
                                                Copy
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setSigningLinks([])}
                                style={{
                                    width: '100%',
                                    marginTop: '1.5rem',
                                    padding: '0.75rem',
                                    background: '#f3f4f6',
                                    border: 'none',
                                    borderRadius: '10px',
                                    fontWeight: '600',
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default DataRoom;
