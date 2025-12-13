import React, { useRef, useState, useEffect } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { X, RotateCcw, Upload as UploadIcon, PenTool } from 'lucide-react';

interface SignatureCanvasComponentProps {
    onSave: (signatureData: string, type: 'drawn' | 'typed' | 'uploaded') => void;
    onClose: () => void;
    title?: string;
    isInitials?: boolean;
    defaultValue?: string; // e.g. Pre-filled full name
}

const SignatureCanvasComponent: React.FC<SignatureCanvasComponentProps> = ({
    onSave,
    onClose,
    title = 'Sign agreement',
    isInitials = false,
    defaultValue = ''
}) => {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [activeTab, setActiveTab] = useState<'draw' | 'type' | 'upload'>('draw');

    // Name inputs
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [initials, setInitials] = useState('');

    // Signatures
    const [selectedFont, setSelectedFont] = useState('Brush Script MT');
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    const [canvasWidth, setCanvasWidth] = useState(500);

    const fonts = [
        'Brush Script MT',
        'Lucida Handwriting',
        'Segoe Script',
        'Freestyle Script',
        'Monotype Corsiva'
    ];

    // Initialize from defaultValue
    useEffect(() => {
        if (defaultValue) {
            const parts = defaultValue.split(' ');
            if (parts.length > 0) setFirstName(parts[0]);
            if (parts.length > 1) setLastName(parts.slice(1).join(' '));
        }
    }, [defaultValue]);

    // Auto-update initials
    useEffect(() => {
        const fn = firstName.trim();
        const ln = lastName.trim();
        if (fn || ln) {
            setInitials(`${fn.charAt(0)}${ln.charAt(0)}`.toUpperCase());
        }
    }, [firstName, lastName]);

    // Handle responsive canvas sizing
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                const width = containerRef.current.clientWidth - 4; // Subtract borders
                setCanvasWidth(width);
            }
        };

        updateWidth();
        window.addEventListener('resize', updateWidth);
        const timer = setTimeout(updateWidth, 100); // Slight delay for modal render
        return () => {
            window.removeEventListener('resize', updateWidth);
            clearTimeout(timer);
        };
    }, [activeTab]);

    const clearCanvas = () => {
        sigCanvas.current?.clear();
    };

    const handleSave = () => {
        // Validation
        if (!firstName.trim() || !lastName.trim()) {
            alert('Please enter your first and last name.');
            return;
        }

        if (activeTab === 'draw') {
            if (sigCanvas.current?.isEmpty()) {
                alert('Please provide a signature first');
                return;
            }
            const signatureData = sigCanvas.current?.toDataURL('image/png');
            if (signatureData) onSave(signatureData, 'drawn');

        } else if (activeTab === 'type') {
            // Render typed signature
            const canvas = document.createElement('canvas');
            canvas.width = 600;
            canvas.height = 200;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0)';
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.fillStyle = 'black';
                ctx.font = `60px "${selectedFont}", cursive`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const text = isInitials ? initials : `${firstName} ${lastName}`;
                ctx.fillText(text, canvas.width / 2, canvas.height / 2);

                onSave(canvas.toDataURL('image/png'), 'typed');
            }

        } else if (activeTab === 'upload') {
            if (!uploadedImage) {
                alert('Please upload an image first');
                return;
            }
            onSave(uploadedImage, 'uploaded');
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                alert('File size too large. Please upload an image smaller than 5MB.');
                return;
            }
            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target?.result) setUploadedImage(event.target.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0, 0, 0, 0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '1rem'
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: 'white',
                    borderRadius: '20px',
                    padding: '2.5rem',
                    maxWidth: '700px',
                    width: '100%',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: '95vh',
                    overflowY: 'auto'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
                    <div>
                        <div style={{ width: '48px', height: '48px', background: 'white', border: '1px solid #e5e7eb', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                            <PenTool size={24} color="#111827" />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '700', color: '#111827', marginBottom: '0.25rem' }}>
                            {title}
                        </h2>
                        <p style={{ color: '#6b7280' }}>Confirm your name, initials, and signature.</p>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px',
                            width: '36px', height: '36px', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', cursor: 'pointer'
                        }}
                    >
                        <X size={20} color="#6b7280" />
                    </button>
                </div>

                {/* Name Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            First name <span style={{ color: '#7c3aed' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none' }}
                        />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                            Last name <span style={{ color: '#7c3aed' }}>*</span>
                        </label>
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none' }}
                        />
                    </div>
                </div>

                <div style={{ marginBottom: '2rem' }}>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        Initials <span style={{ color: '#7c3aed' }}>*</span>
                    </label>
                    <div style={{ width: '100px' }}>
                        <input
                            type="text"
                            value={initials}
                            onChange={(e) => setInitials(e.target.value)}
                            style={{ width: '100%', padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '8px', outline: 'none' }}
                        />
                    </div>
                </div>

                {/* Signature Area */}
                <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', color: '#374151', marginBottom: '0.5rem' }}>
                        {isInitials ? 'Initials' : 'Signature'} <span style={{ color: '#7c3aed' }}>*</span>
                    </label>

                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '12px', overflow: 'hidden' }}>
                        {/* Canvas/Preview Area */}
                        <div style={{ height: '250px', background: '#f9fafb', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }} ref={containerRef}>
                            {activeTab === 'draw' && (
                                <SignatureCanvas
                                    ref={sigCanvas}
                                    canvasProps={{ width: canvasWidth, height: 250, style: { width: '100%', height: '100%', cursor: 'crosshair' } }}
                                    backgroundColor="#f9fafb"
                                    penColor="black"
                                />
                            )}
                            {activeTab === 'type' && (
                                <div style={{ fontSize: '4rem', fontFamily: `"${selectedFont}", cursive`, userSelect: 'none' }}>
                                    {isInitials ? initials : `${firstName} ${lastName}` || 'Signature'}
                                </div>
                            )}
                            {activeTab === 'upload' && (
                                uploadedImage ?
                                    <img src={uploadedImage} alt="Uploaded" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                                    : <div style={{ color: '#9ca3af' }}>No image uploaded</div>
                            )}
                        </div>

                        {/* Tabs / Footer Actions */}
                        <div style={{ borderTop: '1px solid #e5e7eb', padding: '0.5rem', display: 'flex', background: 'white' }}>
                            <button
                                onClick={() => setActiveTab('draw')}
                                style={{
                                    flex: 1, padding: '0.75rem', background: activeTab === 'draw' ? 'white' : 'transparent',
                                    fontWeight: '600', color: activeTab === 'draw' ? '#111827' : '#6b7280',
                                    border: activeTab === 'draw' ? '1px solid #e5e7eb' : 'none',
                                    borderBottom: activeTab === 'draw' ? '2px solid #111827' : 'none',
                                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                Draw signature
                            </button>
                            <button
                                onClick={() => setActiveTab('type')}
                                style={{
                                    flex: 1, padding: '0.75rem', background: activeTab === 'type' ? 'white' : 'transparent',
                                    fontWeight: '600', color: activeTab === 'type' ? '#111827' : '#6b7280',
                                    border: activeTab === 'type' ? '1px solid #e5e7eb' : 'none',
                                    borderBottom: activeTab === 'type' ? '2px solid #111827' : 'none',
                                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                Type signature
                            </button>
                            <button
                                onClick={() => setActiveTab('upload')}
                                style={{
                                    flex: 1, padding: '0.75rem', background: activeTab === 'upload' ? 'white' : 'transparent',
                                    fontWeight: '600', color: activeTab === 'upload' ? '#111827' : '#6b7280',
                                    border: activeTab === 'upload' ? '1px solid #e5e7eb' : 'none',
                                    borderBottom: activeTab === 'upload' ? '2px solid #111827' : 'none',
                                    borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s'
                                }}
                            >
                                Upload signature
                            </button>
                        </div>
                    </div>

                    {/* Controls specific to tabs */}
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        {activeTab === 'draw' && (
                            <button onClick={clearCanvas} style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <RotateCcw size={16} /> Clear
                            </button>
                        )}
                        {activeTab === 'type' && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {fonts.slice(0, 3).map(font => (
                                    <button
                                        key={font}
                                        onClick={() => setSelectedFont(font)}
                                        style={{
                                            padding: '0.25rem 0.5rem',
                                            border: selectedFont === font ? '1px solid #4f46e5' : '1px solid #e5e7eb',
                                            borderRadius: '4px',
                                            background: selectedFont === font ? '#e0e7ff' : 'white',
                                            fontFamily: font,
                                            cursor: 'pointer'
                                        }}
                                    >Aa</button>
                                ))}
                            </div>
                        )}
                        {activeTab === 'upload' && (
                            <label style={{ cursor: 'pointer', color: '#4f46e5', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <UploadIcon size={16} /> Choose Image
                                <input type="file" hidden accept="image/*" onChange={handleFileUpload} />
                            </label>
                        )}
                    </div>
                </div>

                {/* Legal Text */}
                <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.5 }}>
                    I agree that the signature and initials will be the electronic representation of my signature and initials for all purposes when I (or my agent) use them on documents, including legally binding contracts - just the same as a pen-and-paper signature or initial.
                </p>

                {/* Action Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                    <button
                        onClick={onClose}
                        style={{ padding: '0.75rem 1.5rem', background: 'white', border: '1px solid #d1d5db', borderRadius: '8px', fontWeight: '600', color: '#374151', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        style={{ padding: '0.75rem 1.5rem', background: '#111827', border: 'none', borderRadius: '8px', fontWeight: '600', color: 'white', cursor: 'pointer' }}
                    >
                        Insert
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SignatureCanvasComponent;
