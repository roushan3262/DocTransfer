import React, { useRef, useState, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, RefreshCw, Check } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface WebcamGateProps {
    onVerified: (snapshotUrl: string) => void;
    documentName: string;
}

const WebcamGate: React.FC<WebcamGateProps> = ({ onVerified, documentName }) => {
    const webcamRef = useRef<Webcam>(null);
    const [imgSrc, setImgSrc] = useState<string | null>(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            setImgSrc(imageSrc);
        }
    }, [webcamRef]);

    const retake = () => {
        setImgSrc(null);
        setError(null);
    };

    const confirmSnapshot = async () => {
        if (!imgSrc) return;

        setUploading(true);
        setError(null);

        try {
            // Convert base64 to blob
            const base64Response = await fetch(imgSrc);
            const blob = await base64Response.blob();

            // Upload to Supabase
            // Note: Ensure 'verification-snapshots' bucket exists or use 'documents' with a secure folder
            // For now using 'documents' bucket in a 'snapshots' folder as it likely exists
            const fileName = `snapshots/${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

            const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(fileName, blob);

            if (uploadError) throw uploadError;

            // Get public URL (or just the path if you want to keep it private but trackable)
            // Assuming we want to store the path/url in the session
            const { data } = supabase.storage
                .from('documents')
                .getPublicUrl(fileName);

            onVerified(data.publicUrl);
        } catch (err: any) {
            console.error('Snapshot upload error:', err);
            setError('Failed to upload snapshot. Please try again.');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div style={{ textAlign: 'center', width: '100%', maxWidth: '480px' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <div style={{
                    width: '60px',
                    height: '60px',
                    background: '#e0e7ff',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem',
                    color: '#4f46e5'
                }}>
                    <Camera size={30} />
                </div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#111827', marginBottom: '0.5rem' }}>Security Snapshot Required</h2>
                <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
                    Accessing <strong>{documentName}</strong> requires a security snapshot.
                </p>
            </div>

            <div style={{
                position: 'relative',
                background: '#000',
                borderRadius: '16px',
                overflow: 'hidden',
                aspectRatio: '4/3',
                marginBottom: '1.5rem',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
            }}>
                {imgSrc ? (
                    <img src={imgSrc} alt="captured" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "user" }}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                )}
            </div>

            {error && (
                <div style={{ padding: '0.75rem', background: '#fee2e2', color: '#dc2626', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
                    {error}
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem' }}>
                {imgSrc ? (
                    <>
                        <button
                            onClick={retake}
                            disabled={uploading}
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: 'white',
                                border: '1px solid #d1d5db',
                                color: '#374151',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <RefreshCw size={18} /> Retake
                        </button>
                        <button
                            onClick={confirmSnapshot}
                            disabled={uploading}
                            className="btn-primary"
                            style={{
                                flex: 1,
                                padding: '0.75rem',
                                background: '#4f46e5',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            {uploading ? 'Verifying...' : (
                                <>
                                    <Check size={18} /> Verify & Enter
                                </>
                            )}
                        </button>
                    </>
                ) : (
                    <button
                        onClick={capture}
                        className="btn-primary"
                        style={{
                            width: '100%',
                            padding: '0.875rem',
                            background: '#4f46e5',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            fontSize: '1rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <Camera size={20} /> Take Snapshot
                    </button>
                )}
            </div>
        </div>
    );
};

export default WebcamGate;
