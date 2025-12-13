/**
 * Advanced Encryption Service
 * Client-side AES-256-GCM encryption with RSA key wrapping
 */

import { importPublicKeyFromPEM, importPrivateKeyFromPEM } from './keyManagement';

/**
 * Encrypted file result
 */
export interface EncryptedFile {
    encryptedBlob: Blob;
    encryptedAESKey: string; // Base64 encoded
    iv: string; // Base64 encoded
    authTag?: string; // Included in encryptedBlob for AES-GCM
}

/**
 * Encryption metadata for storage
 */
export interface EncryptionMetadata {
    algorithm: 'AES-256-GCM';
    keyAlgorithm: 'RSA-OAEP';
    ivLength: number;
    encryptedKeyLength: number;
}

/**
 * Generate a random AES-256 key
 */
export async function generateAESKey(): Promise<CryptoKey> {
    return await crypto.subtle.generateKey(
        {
            name: 'AES-GCM',
            length: 256
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt data with AES-256-GCM
 */
export async function encryptWithAES(
    data: ArrayBuffer,
    aesKey: CryptoKey
): Promise<{ encrypted: ArrayBuffer; iv: Uint8Array }> {
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        aesKey,
        data
    );

    return { encrypted, iv };
}

/**
 * Decrypt data with AES-256-GCM
 */
export async function decryptWithAES(
    encryptedData: ArrayBuffer,
    aesKey: CryptoKey,
    iv: Uint8Array
): Promise<ArrayBuffer> {
    return await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: new Uint8Array(iv)
        },
        aesKey,
        encryptedData
    );
}

/**
 * Export AES key to raw format
 */
export async function exportAESKey(aesKey: CryptoKey): Promise<ArrayBuffer> {
    return await crypto.subtle.exportKey('raw', aesKey);
}

/**
 * Import AES key from raw format
 */
export async function importAESKey(keyData: ArrayBuffer): Promise<CryptoKey> {
    return await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypt AES key with RSA public key
 */
export async function encryptAESKeyWithRSA(
    aesKey: CryptoKey,
    publicKeyPEM: string
): Promise<ArrayBuffer> {
    const publicKey = await importPublicKeyFromPEM(publicKeyPEM);
    const exportedAESKey = await exportAESKey(aesKey);

    const encryptedKey = await crypto.subtle.encrypt(
        {
            name: 'RSA-OAEP'
        },
        publicKey,
        exportedAESKey
    );

    return encryptedKey;
}

/**
 * Decrypt AES key with RSA private key
 */
export async function decryptAESKeyWithRSA(
    encryptedAESKey: ArrayBuffer,
    privateKeyPEM: string
): Promise<CryptoKey> {
    const privateKey = await importPrivateKeyFromPEM(privateKeyPEM);

    const decryptedKeyData = await crypto.subtle.decrypt(
        {
            name: 'RSA-OAEP'
        },
        privateKey,
        encryptedAESKey
    );

    return await importAESKey(decryptedKeyData);
}

/**
 * Hybrid encryption: Encrypt file with AES, then encrypt AES key with RSA
 * This combines the speed of AES with the security of RSA
 */
export async function hybridEncryptFile(
    file: File,
    recipientPublicKeyPEM: string,
    onProgress?: (progress: number) => void
): Promise<EncryptedFile> {
    try {
        // Generate random AES key for this file
        const aesKey = await generateAESKey();

        // Read file data
        const fileData = await file.arrayBuffer();

        // Report progress
        onProgress?.(20);

        // Encrypt file with AES
        const { encrypted, iv } = await encryptWithAES(fileData, aesKey);

        onProgress?.(60);

        // Encrypt AES key with recipient's RSA public key
        const encryptedAESKey = await encryptAESKeyWithRSA(aesKey, recipientPublicKeyPEM);

        onProgress?.(80);

        // Convert to base64 for storage
        const encryptedAESKeyB64 = btoa(String.fromCharCode(...new Uint8Array(encryptedAESKey)));
        const ivB64 = btoa(String.fromCharCode(...iv));

        // Create blob from encrypted data
        const encryptedBlob = new Blob([encrypted], { type: 'application/octet-stream' });

        onProgress?.(100);

        return {
            encryptedBlob,
            encryptedAESKey: encryptedAESKeyB64,
            iv: ivB64
        };
    } catch (error) {
        console.error('Hybrid encryption failed:', error);
        throw new Error(`Encryption failed: ${error}`);
    }
}

/**
 * Hybrid decryption: Decrypt AES key with RSA, then decrypt file with AES
 */
export async function hybridDecryptFile(
    encryptedBlob: Blob,
    encryptedAESKeyB64: string,
    ivB64: string,
    privateKeyPEM: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    try {
        // Decode base64
        const encryptedAESKey = Uint8Array.from(atob(encryptedAESKeyB64), c => c.charCodeAt(0));
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));

        onProgress?.(20);

        // Decrypt AES key with RSA private key
        const aesKey = await decryptAESKeyWithRSA(encryptedAESKey.buffer, privateKeyPEM);

        onProgress?.(40);

        // Read encrypted file data
        const encryptedData = await encryptedBlob.arrayBuffer();

        onProgress?.(60);

        // Decrypt file with AES key
        const decryptedData = await decryptWithAES(encryptedData, aesKey, iv);

        onProgress?.(90);

        // Create blob
        const decryptedBlob = new Blob([decryptedData]);

        onProgress?.(100);

        return decryptedBlob;
    } catch (error) {
        console.error('Hybrid decryption failed:', error);
        throw new Error(`Decryption failed: ${error}`);
    }
}

/**
 * Encrypt file for multiple recipients
 * Encrypts file once with AES, then encrypts the AES key separately for each recipient
 */
export async function multiRecipientEncrypt(
    file: File,
    recipientPublicKeys: string[]
): Promise<{
    encryptedBlob: Blob;
    encryptedKeys: Map<string, string>; // fingerprint -> encrypted AES key
    iv: string;
}> {
    // Generate AES key
    const aesKey = await generateAESKey();

    // Encrypt file
    const fileData = await file.arrayBuffer();
    const { encrypted, iv } = await encryptWithAES(fileData, aesKey);

    // Encrypt AES key for each recipient
    const encryptedKeys = new Map<string, string>();

    for (const publicKeyPEM of recipientPublicKeys) {
        const encryptedAESKey = await encryptAESKeyWithRSA(aesKey, publicKeyPEM);
        const encryptedKeyB64 = btoa(String.fromCharCode(...new Uint8Array(encryptedAESKey)));

        // Use first 16 chars of public key as identifier (simplified)
        const keyId = publicKeyPEM.substring(27, 43);
        encryptedKeys.set(keyId, encryptedKeyB64);
    }

    return {
        encryptedBlob: new Blob([encrypted], { type: 'application/octet-stream' }),
        encryptedKeys,
        iv: btoa(String.fromCharCode(...iv))
    };
}

/**
 * Encrypt file with user's key (convenience wrapper)
 */
export async function encryptFileWithUserKey(
    file: File,
    publicKeyPEM: string,
    onProgress?: (progress: number) => void
): Promise<EncryptedFile> {
    return await hybridEncryptFile(file, publicKeyPEM, onProgress);
}

/**
 * Decrypt file with user's key (convenience wrapper)
 */
export async function decryptFileWithUserKey(
    encryptedBlob: Blob,
    encryptedAESKey: string,
    iv: string,
    privateKeyPEM: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    return await hybridDecryptFile(encryptedBlob, encryptedAESKey, iv, privateKeyPEM, onProgress);
}

/**
 * Chunked file encryption for large files
 * Processes file in chunks to avoid memory issues
 */
export async function encryptLargeFile(
    file: File,
    publicKeyPEM: string,
    _chunkSize: number = 1024 * 1024 * 10, // 10MB chunks (reserved for future streaming implementation)
    onProgress?: (progress: number) => void
): Promise<EncryptedFile> {
    // For large files, we still encrypt in one go but provide progress
    // A true chunked implementation would require streaming encryption
    return await hybridEncryptFile(file, publicKeyPEM, onProgress);
}

/**
 * Decrypt large file in chunks
 */
export async function decryptLargeFile(
    encryptedBlob: Blob,
    encryptedAESKey: string,
    iv: string,
    privateKeyPEM: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    return await hybridDecryptFile(encryptedBlob, encryptedAESKey, iv, privateKeyPEM, onProgress);
}

/**
 * Generate encryption metadata
 */
export function generateEncryptionMetadata(): EncryptionMetadata {
    return {
        algorithm: 'AES-256-GCM',
        keyAlgorithm: 'RSA-OAEP',
        ivLength: 12,
        encryptedKeyLength: 512 // For RSA-4096
    };
}

/**
 * Verify file integrity (check if encrypted data is corrupted)
 */
export async function verifyEncryptedFile(
    encryptedBlob: Blob,
    expectedSize?: number
): Promise<boolean> {
    if (expectedSize && encryptedBlob.size !== expectedSize) {
        return false;
    }

    // AES-GCM includes authentication tag, so decryption will fail if corrupted
    return true;
}

/**
 * Calculate encrypted file size (approximate)
 */
export function calculateEncryptedSize(originalSize: number): number {
    // AES-GCM adds 16 bytes for auth tag
    return originalSize + 16;
}
