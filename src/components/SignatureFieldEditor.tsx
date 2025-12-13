import React, { useState, useEffect, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { X, Check, Type, PenTool, Calendar, GripVertical } from 'lucide-react';
import { type Signer } from './SignerManagement';

// Set worker source
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface SignatureField {
    id: string;
    type: 'signature' | 'initials' | 'text' | 'date' | 'checkbox';
    page: number;
    x: number; // Percentage 0-100
    y: number; // Percentage 0-100
    width: number; // Percentage
    height: number; // Percentage
    signerId: string;
    required: boolean;
}

interface SignatureFieldEditorProps {
    file: File;
    signers: Signer[];
    onSave: (fields: SignatureField[]) => void;
    onClose: () => void;
}

const FIELD_TYPES = [
    { type: 'signature', label: 'Signature', icon: PenTool, color: '#4f46e5' },
    { type: 'initials', label: 'Initials', icon: Type, color: '#7c3aed' },
    { type: 'text', label: 'Text Box', icon: Type, color: '#059669' },
    { type: 'date', label: 'Date Signed', icon: Calendar, color: '#d97706' },
    { type: 'checkbox', label: 'Checkbox', icon: Check, color: '#dc2626' }
] as const;

const SignatureFieldEditor: React.FC<SignatureFieldEditorProps> = ({ file, signers, onSave, onClose }) => {
    const [numPages, setNumPages] = useState(0);
    const [pages, setPages] = useState<string[]>([]); // Base64 images of pages
    const [fields, setFields] = useState<SignatureField[]>([]);
    const [selectedSignerId, setSelectedSignerId] = useState<string>(signers[0]?.id || '');
    const [loading, setLoading] = useState(true);
    const [draggingType, setDraggingType] = useState<string | null>(null);
    const [activeField, setActiveField] = useState<string | null>(null);

    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (signers.length > 0 && !selectedSignerId) {
            setSelectedSignerId(signers[0].id);
        }
    }, [signers, selectedSignerId]);

    useEffect(() => {
        const loadPdf = async () => {
            try {
                setLoading(true);
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                setNumPages(pdf.numPages);

                const pageImages: string[] = [];
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.5 });
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;

                    if (context) {
                        await page.render({ canvasContext: context, canvas, viewport }).promise;
                        pageImages.push(canvas.toDataURL('image/jpeg'));
                    }
                }
                setPages(pageImages);
            } catch (error) {
                console.error('Error loading PDF:', error);
                alert('Error loading document preview. Please ensure it is a valid PDF.');
            } finally {
                setLoading(false);
            }
        };

        if (file.type === 'application/pdf') {
            loadPdf();
        } else {
            // Handle image files
            const reader = new FileReader();
            reader.onload = (e) => {
                if (e.target?.result) {
                    setPages([e.target.result as string]);
                    setNumPages(1);
                    setLoading(false);
                }
            };
            reader.readAsDataURL(file);
        }
    }, [file]);

    const handleDrop = (e: React.DragEvent, pageIndex: number) => {
        e.preventDefault();
        if (!draggingType || !containerRef.current) return;

        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        const newField: SignatureField = {
            id: Math.random().toString(36).substring(2, 9),
            type: draggingType as any,
            page: pageIndex + 1,
            x: Math.max(0, Math.min(90, x)), // Clamp to bounds
            y: Math.max(0, Math.min(95, y)),
            width: 15, // Default width %
            height: 5, // Default height %
            signerId: selectedSignerId,
            required: true
        };

        setFields([...fields, newField]);
        setDraggingType(null);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const removeField = (id: string) => {
        setFields(fields.filter(f => f.id !== id));
    };

    const getSignerColor = (id: string) => {
        const signer = signers.find(s => s.id === id);
        return signer?.color || '#000000';
    };

    if (loading) {
        return (
            <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.75)', zIndex: 1000,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', flexDirection: 'column'
            }}>
                <div className="spinner" style={{ marginBottom: '1rem' }}></div>
                <p>Loading document preview...</p>
            </div>
        );
    }

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: '#f3f4f6', zIndex: 999, display: 'flex', flexDirection: 'column'
        }}>
            {/* Header */}
            <div style={{
                height: '60px', background: 'white', borderBottom: '1px solid #e5e7eb',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1.5rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#111827' }}>Prepare Document</h2>
                    <span style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                        Drag and drop fields, or click to add
                    </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '0.5rem 1rem', border: '1px solid #e5e7eb', borderRadius: '6px',
                            background: 'white', color: '#374151', cursor: 'pointer'
                        }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(fields)}
                        style={{
                            padding: '0.5rem 1rem', background: '#4f46e5', color: 'white',
                            border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                        }}
                    >
                        Save & Continue
                    </button>
                </div>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Sidebar - Tools */}
                <div style={{
                    width: '280px', background: 'white', borderRight: '1px solid #e5e7eb',
                    display: 'flex', flexDirection: 'column', padding: '1.5rem'
                }}>
                    {/* Signer Selector */}
                    <div style={{ marginBottom: '2rem' }}>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                            Signing For
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {signers.map(signer => (
                                <button
                                    key={signer.id}
                                    onClick={() => setSelectedSignerId(signer.id)}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        padding: '0.75rem', borderRadius: '8px',
                                        border: selectedSignerId === signer.id ? `2px solid ${signer.color}` : '1px solid #e5e7eb',
                                        background: selectedSignerId === signer.id ? `${signer.color}10` : 'white',
                                        cursor: 'pointer', textAlign: 'left'
                                    }}
                                >
                                    <div style={{
                                        width: '24px', height: '24px', borderRadius: '50%',
                                        background: signer.color, color: 'white',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.75rem', fontWeight: '600'
                                    }}>
                                        {signer.name.charAt(0)}
                                    </div>
                                    <span style={{ fontSize: '0.9rem', fontWeight: '500', color: '#374151' }}>
                                        {signer.name}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Fields */}
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.75rem' }}>
                            Fields
                        </label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {FIELD_TYPES.map(field => (
                                <div
                                    key={field.type}
                                    draggable
                                    onDragStart={(e) => {
                                        setDraggingType(field.type);
                                        e.dataTransfer.effectAllowed = 'copy';
                                    }}
                                    onClick={() => {
                                        // "Click to add" fallback
                                        const newField: SignatureField = {
                                            id: Math.random().toString(36).substring(2, 9),
                                            type: field.type as any,
                                            page: 1, // Default to page 1 or visible page
                                            x: 50 - 7.5, // Center X (15% width)
                                            y: 50 - 2.5, // Center Y (5% height)
                                            width: 15,
                                            height: 5,
                                            signerId: selectedSignerId,
                                            required: true
                                        };
                                        setFields([...fields, newField]);
                                    }}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '0.75rem',
                                        padding: '0.75rem', borderRadius: '8px',
                                        border: '1px solid #e5e7eb', background: 'white',
                                        cursor: 'grab', transition: 'all 0.2s'
                                    }}
                                >
                                    <field.icon size={18} color={field.color} />
                                    <span style={{ fontSize: '0.9rem', color: '#374151' }}>{field.label}</span>
                                    <GripVertical size={16} color="#9ca3af" style={{ marginLeft: 'auto' }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Main Content - Document Preview */}
                <div style={{
                    flex: 1, overflow: 'auto', background: '#e5e7eb', padding: '2rem',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem'
                }}>
                    {pages.map((pageImage, index) => (
                        <div
                            key={index}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragOver={handleDragOver}
                            style={{
                                position: 'relative',
                                width: '100%', maxWidth: '800px',
                                background: 'white', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                                userSelect: 'none'
                            }}
                        >
                            <img
                                src={pageImage}
                                alt={`Page ${index + 1}`}
                                style={{ width: '100%', display: 'block' }}
                            />

                            {/* Page Number */}
                            <div style={{
                                position: 'absolute', bottom: '-25px', right: '0',
                                color: '#6b7280', fontSize: '0.8rem'
                            }}>
                                Page {index + 1} of {numPages}
                            </div>

                            {/* Placed Fields */}
                            {fields.filter(f => f.page === index + 1).map(field => {
                                const signerColor = getSignerColor(field.signerId);
                                const isSelected = activeField === field.id;

                                return (
                                    <div
                                        key={field.id}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveField(field.id);
                                        }}
                                        style={{
                                            position: 'absolute',
                                            left: `${field.x}%`,
                                            top: `${field.y}%`,
                                            width: `${field.width}%`,
                                            height: `${field.height}%`,
                                            background: `${signerColor}20`,
                                            border: `2px solid ${isSelected ? '#2563eb' : signerColor}`,
                                            borderRadius: '4px',
                                            cursor: 'move',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            zIndex: 10
                                        }}
                                    >
                                        <div style={{
                                            fontSize: '0.75rem', fontWeight: '600', color: signerColor,
                                            display: 'flex', alignItems: 'center', gap: '0.25rem',
                                            background: 'rgba(255,255,255,0.8)', padding: '2px 6px', borderRadius: '4px'
                                        }}>
                                            {field.type === 'signature' && <PenTool size={12} />}
                                            {field.type === 'initials' && <Type size={12} />}
                                            {field.type === 'date' && <Calendar size={12} />}
                                            {field.type === 'text' && <Type size={12} />}
                                            {field.type === 'checkbox' && <Check size={12} />}
                                            {field.required && <span style={{ color: '#dc2626' }}>*</span>}
                                        </div>

                                        {isSelected && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeField(field.id);
                                                }}
                                                style={{
                                                    position: 'absolute', top: '-10px', right: '-10px',
                                                    width: '20px', height: '20px', borderRadius: '50%',
                                                    background: '#ef4444', color: 'white', border: 'none',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                }}
                                            >
                                                <X size={12} />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SignatureFieldEditor;
