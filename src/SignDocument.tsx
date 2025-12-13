
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { decryptFile } from './lib/crypto';
import * as pdfjsLib from 'pdfjs-dist';
import {
    Check,
    AlertCircle,
    Calendar,
    Type,
    PenTool,
    Loader2
} from 'lucide-react';
import SignatureCanvasComponent from './components/SignatureCanvas';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface Signer {
    id: string;
    signer_name: string;
    signer_email: string;
    status: 'pending' | 'viewed' | 'signed';
}

interface DocumentData {
    id: string;
    name: string;
    file_path: string;
    file_type: string;
    is_encrypted: boolean;
    encryption_key?: string;
    encryption_iv?: string;
    original_file_type?: string;
    user_id: string; // owner
}

interface SignatureField {
    id: string;
    field_type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox';
    page_number: number;
    position_x: number;
    position_y: number;
    width: number;
    height: number;
    assigned_signer_id: string;
    is_required: boolean;
    value?: string; // For text/date/checkbox
}

const SignDocument: React.FC = () => {
    const { signingLink } = useParams<{ signingLink: string }>();

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [signer, setSigner] = useState<Signer | null>(null);
    const [documentData, setDocumentData] = useState<DocumentData | null>(null);
    const [fields, setFields] = useState<SignatureField[]>([]);
    const [pdfPages, setPdfPages] = useState<string[]>([]);
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
    const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
    const [signatureRecords, setSignatureRecords] = useState<Record<string, string>>({}); // fieldId -> signatureData (base64)
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);

    // Initial Fetch
    useEffect(() => {
        const init = async () => {
            if (!signingLink) return;

            try {
                // 1. Get Signer & Document Info
                const { data: signerData, error: signerError } = await supabase
                    .from('document_signers')
                    .select('*, documents(*)')
                    .eq('signing_link', signingLink)
                    .single();

                if (signerError || !signerData) {
                    throw new Error('Invalid signing link.');
                }

                setSigner({
                    id: signerData.id,
                    signer_name: signerData.signer_name,
                    signer_email: signerData.signer_email,
                    status: signerData.status
                });

                const doc = signerData.documents;
                if (!doc) throw new Error('Document not found.');

                setDocumentData(doc);

                // 2. Mark as viewed if pending
                if (signerData.status === 'pending') {
                    await supabase
                        .from('document_signers')
                        .update({ status: 'viewed', viewed_at: new Date().toISOString() })
                        .eq('id', signerData.id);
                }

                // 3. Get Signature Fields
                const { data: fieldsData } = await supabase
                    .from('signature_fields')
                    .select('*')
                    .eq('document_id', doc.id);

                if (fieldsData) setFields(fieldsData);

                // 4. Download & Render Document
                await renderDocument(doc);

            } catch (err: any) {
                console.error('Initialization error:', err);
                setError(err.message || 'Failed to load document.');
            } finally {
                setLoading(false);
            }
        };

        init();
    }, [signingLink]);

    const renderDocument = async (doc: DocumentData) => {
        try {
            const { data, error } = await supabase.storage
                .from('documents')
                .download(doc.file_path);

            if (error) throw error;

            let blob = data;
            if (doc.is_encrypted && doc.encryption_key && doc.encryption_iv) {
                blob = await decryptFile(
                    data,
                    doc.encryption_key,
                    doc.encryption_iv,
                    doc.original_file_type || doc.file_type
                );
            }

            if (doc.file_type === 'application/pdf' || doc.original_file_type === 'application/pdf') {
                // Render PDF
                const arrayBuffer = await blob.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                const pages: string[] = [];

                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (context) {
                        await page.render({ canvasContext: context, canvas, viewport }).promise;
                        pages.push(canvas.toDataURL('image/jpeg'));
                    }
                }
                setPdfPages(pages);
            } else {
                // Image
                const url = URL.createObjectURL(blob);
                setPdfPages([url]);
            }
        } catch (err) {
            console.error('Render error:', err);
            setError('Failed to render document.');
        }
    };

    const handleFieldClick = (field: SignatureField) => {
        if (field.assigned_signer_id !== signer?.id) return;
        setActiveFieldId(field.id);

        if (field.field_type === 'signature' || field.field_type === 'initials') {
            setShowSignatureCanvas(true);
        } else if (field.field_type === 'checkbox') {
            // Toggle checkbox
            const currentVal = signatureRecords[field.id];
            const newVal = currentVal === 'checked' ? '' : 'checked';
            handleSignatureSave(newVal, 'value');
        }
        // Text field handling
        if (field.field_type === 'text') {
            const currentVal = signatureRecords[field.id] || '';
            const val = window.prompt('Enter text:', currentVal);
            if (val !== null) {
                handleSignatureSave(val, 'value');
            }
        }

        if (field.field_type === 'date') {
            handleSignatureSave(new Date().toLocaleDateString(), 'value');
        }
    };

    const handleSignatureSave = async (data: string, type: 'drawn' | 'typed' | 'uploaded' | 'value') => {
        if (!activeFieldId || !signer) return;

        // Optimistic update
        setSignatureRecords(prev => ({
            ...prev,
            [activeFieldId]: data
        }));

        if (type !== 'value') {
            setShowSignatureCanvas(false);
        }
        setActiveFieldId(null);

        // Ideally we save to DB here or at the end. Saving here is safer.
        // But for 'value' types we might want to wait. 
        // Let's implement 'Finish' to save all.
        // OR save individual records now? The requirements say "Users can ...".
        // Let's save individually for better UX persistence? 
        // Actually, let's just keep in state and save all at 'Finish' 
        // OR save to DB immediately to avoid data loss.
        // Let's save immediately.

        try {
            // Check if record exists
            const { data: existing } = await supabase
                .from('signature_records')
                .select('id')
                .eq('signature_field_id', activeFieldId)
                .single();

            if (existing) {
                await supabase
                    .from('signature_records')
                    .update({
                        signature_data: data,
                        signature_type: type,
                        signed_at: new Date().toISOString()
                    })
                    .eq('signature_field_id', activeFieldId);
            } else {
                await supabase
                    .from('signature_records')
                    .insert({
                        signature_field_id: activeFieldId,
                        signer_id: signer.id,
                        signature_data: data,
                        signature_type: type,
                        ip_address: 'unknown', // client-side, maybe fetch via API
                        user_agent: navigator.userAgent
                    });
            }
        } catch (err) {
            console.error('Error saving signature record:', err);
        }
    };

    const handleFinish = async () => {
        if (!signer || !documentData) return;

        // Validate required fields
        const myFields = fields.filter(f => f.assigned_signer_id === signer.id);
        const missing = myFields.filter(f => f.is_required && !signatureRecords[f.id]);

        if (missing.length > 0) {
            alert(`Please fill in all required fields (${missing.length} remaining).`);
            return;
        }

        setSubmitting(true);
        try {
            // Update signer status
            const { error } = await supabase
                .from('document_signers')
                .update({
                    status: 'signed',
                    signed_at: new Date().toISOString(),
                    ip_address: 'client', // placeholder
                    user_agent: navigator.userAgent
                })
                .eq('id', signer.id);

            if (error) throw error;

            setSuccess(true);
        } catch (err: any) {
            console.error('Finish error:', err);
            alert('Failed to complete signing. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ textAlign: 'center' }}>
                    <Loader2 className="animate-spin" size={48} color="#4f46e5" style={{ margin: '0 auto 1rem' }} />
                    <p style={{ color: '#6b7280' }}>Loading document...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' }}>
                <div style={{ textAlign: 'center', padding: '2rem', background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ margin: '0 auto 1rem' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#1f2937', marginBottom: '0.5rem' }}>Unable to Access Document</h2>
                    <p style={{ color: '#6b7280' }}>{error}</p>
                </div>
            </div>
        );
    }

    if (success) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0fdf4' }}>
                <div style={{ textAlign: 'center', padding: '3rem', background: 'white', borderRadius: '24px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', maxWidth: '500px' }}>
                    <div style={{ width: '80px', height: '80px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                        <Check size={40} color="#16a34a" strokeWidth={3} />
                    </div>
                    <h1 style={{ fontSize: '2rem', fontWeight: '800', color: '#166534', marginBottom: '1rem' }}>You're All Set!</h1>
                    <p style={{ color: '#4b5563', fontSize: '1.1rem', marginBottom: '2rem' }}>
                        The document has been successfully signed. A copy will be sent to your email once all parties have signed.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        style={{ padding: '0.875rem 2rem', background: '#16a34a', color: 'white', border: 'none', borderRadius: '12px', fontWeight: '600', fontSize: '1rem', cursor: 'pointer' }}
                    >
                        Return Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ background: '#f3f4f6', minHeight: '100vh', paddingBottom: '100px' }}>
            {/* Header */}
            <header style={{
                position: 'sticky', top: 0, zIndex: 50, background: 'white', borderBottom: '1px solid #e5e7eb',
                padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', background: '#4f46e5', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700' }}>
                        DT
                    </div>
                    <div>
                        <h1 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#111827', margin: 0 }}>{documentData?.name}</h1>
                        <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>Signing as {signer?.signer_name}</p>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={handleFinish}
                        disabled={submitting}
                        style={{
                            padding: '0.75rem 1.5rem', background: '#4f46e5', color: 'white',
                            border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem',
                            opacity: submitting ? 0.7 : 1
                        }}
                    >
                        {submitting && <Loader2 className="animate-spin" size={18} />}
                        Finish Signing
                    </button>
                </div>
            </header>

            {/* Document Content */}
            <main style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
                {pdfPages.map((pageImg, index) => (
                    <div
                        key={index}
                        style={{
                            position: 'relative',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                            background: 'white',
                            maxWidth: '100%',
                            width: '800px' // Ideal width, but responsive
                        }}
                    >
                        <img src={pageImg} alt={`Page ${index + 1}`} style={{ width: '100%', display: 'block' }} />

                        {/* Fields Overlay */}
                        {fields.filter(f => f.page_number === index + 1).map(field => {
                            const isMyField = field.assigned_signer_id === signer?.id;
                            const isSigned = !!signatureRecords[field.id];

                            return (
                                <div
                                    key={field.id}
                                    onClick={() => handleFieldClick(field)}
                                    style={{
                                        position: 'absolute',
                                        left: `${field.position_x}%`,
                                        top: `${field.position_y}%`,
                                        width: `${field.width}%`,
                                        height: `${field.height}%`,
                                        background: isSigned ? 'rgba(220, 252, 231, 0.8)' : isMyField ? 'rgba(238, 242, 255, 0.6)' : 'rgba(243, 244, 246, 0.5)',
                                        border: isSigned ? '2px solid #16a34a' : isMyField ? '2px dashed #4f46e5' : '1px solid #d1d5db',
                                        borderRadius: '4px',
                                        cursor: isMyField ? 'pointer' : 'default',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        transition: 'all 0.2s',
                                        pointerEvents: isMyField ? 'auto' : 'none'
                                    }}
                                >
                                    {isSigned ? (
                                        field.field_type === 'signature' || field.field_type === 'initials' || field.field_type === 'checkbox' ? (
                                            signatureRecords[field.id] === 'checked' ? <Check color="#16a34a" /> :
                                                <img src={signatureRecords[field.id]} alt="Signature" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                                        ) : (
                                            <span style={{ fontSize: '0.9rem', color: '#166534', fontWeight: '500' }}>{signatureRecords[field.id]}</span>
                                        )
                                    ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: isMyField ? '#4f46e5' : '#9ca3af', fontSize: '0.8rem', fontWeight: '600' }}>
                                            {field.field_type === 'signature' && <PenTool size={14} />}
                                            {field.field_type === 'initials' && <Type size={14} />}
                                            {field.field_type === 'date' && <Calendar size={14} />}
                                            {isMyField ? 'Sign Here' : 'Other Signer'}
                                            {field.is_required && <span style={{ color: '#dc2626' }}>*</span>}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </main>

            {/* Signature Canvas Modal */}
            {showSignatureCanvas && activeFieldId && (
                <SignatureCanvasComponent
                    onClose={() => setShowSignatureCanvas(false)}
                    onSave={handleSignatureSave}
                    isInitials={fields.find(f => f.id === activeFieldId)?.field_type === 'initials'}
                    title={fields.find(f => f.id === activeFieldId)?.field_type === 'initials' ? 'Adopt Your Initials' : 'Adopt Your Signature'}
                    defaultValue={signer?.signer_name || ''}
                />
            )}
        </div>
    );
};

export default SignDocument;
