/**
 * PGP/GPG Encryption Service
 * OpenPGP.js integration for document encryption, signing, and verification
 */

import * as openpgp from 'openpgp';

/**
 * PGP Key Pair
 */
export interface PGPKeyPair {
    publicKey: string; // Armored public key
    privateKey: string; // Armored private key (encrypted)
    revocationCertificate: string;
    fingerprint: string;
}

/**
 * PGP User Identity
 */
export interface PGPUserIdentity {
    name: string;
    email: string;
}

/**
 * Generate PGP key pair
 */
export async function generatePGPKeys(
    user: PGPUserIdentity,
    passphrase: string,
    keyType: 'rsa' | 'ecc' = 'rsa',
    rsaBits: 2048 | 4096 = 4096
): Promise<PGPKeyPair> {
    try {
        const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
            type: keyType,
            rsaBits: keyType === 'rsa' ? rsaBits : undefined,
            curve: keyType === 'ecc' ? 'curve25519Legacy' as any : undefined,
            userIDs: [{ name: user.name, email: user.email }],
            passphrase: passphrase,
            format: 'armored'
        });

        // Get fingerprint
        const key = await openpgp.readKey({ armoredKey: publicKey });
        const fingerprint = key.getFingerprint();

        return {
            publicKey,
            privateKey,
            revocationCertificate,
            fingerprint
        };
    } catch (error) {
        console.error('PGP key generation failed:', error);
        throw new Error(`Failed to generate PGP keys: ${error}`);
    }
}

/**
 * Encrypt file with PGP public key
 */
export async function pgpEncryptFile(
    file: File,
    recipientPublicKey: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    try {
        onProgress?.(10);

        // Read file content
        const fileContent = await file.arrayBuffer();
        const message = await openpgp.createMessage({ binary: new Uint8Array(fileContent) });

        onProgress?.(30);

        // Read recipient's public key
        const publicKey = await openpgp.readKey({ armoredKey: recipientPublicKey });

        onProgress?.(50);

        // Encrypt
        const encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: publicKey,
            format: 'binary'
        });

        onProgress?.(90);

        // Create blob
        const encryptedBlob = new Blob([new Uint8Array(encrypted as Uint8Array)], { type: 'application/pgp-encrypted' });

        onProgress?.(100);

        return encryptedBlob;
    } catch (error) {
        console.error('PGP encryption failed:', error);
        throw new Error(`PGP encryption failed: ${error}`);
    }
}

/**
 * Decrypt file with PGP private key
 */
export async function pgpDecryptFile(
    encryptedFile: Blob,
    privateKey: string,
    passphrase: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    try {
        onProgress?.(10);

        // Read encrypted content
        const encryptedData = await encryptedFile.arrayBuffer();
        const message = await openpgp.readMessage({ binaryMessage: new Uint8Array(encryptedData) });

        onProgress?.(30);

        // Read and decrypt private key
        const key = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
            passphrase
        });

        onProgress?.(50);

        // Decrypt message
        const { data } = await openpgp.decrypt({
            message,
            decryptionKeys: key,
            format: 'binary'
        });

        onProgress?.(90);

        // Create blob
        const decryptedBlob = new Blob([new Uint8Array(data as Uint8Array)]);

        onProgress?.(100);

        return decryptedBlob;
    } catch (error) {
        console.error('PGP decryption failed:', error);
        throw new Error(`PGP decryption failed: ${error}`);
    }
}

/**
 * Sign document with PGP private key
 */
export async function pgpSignDocument(
    file: File,
    privateKey: string,
    passphrase: string
): Promise<string> {
    try {
        // Read file content
        const fileContent = await file.arrayBuffer();
        const message = await openpgp.createMessage({ binary: new Uint8Array(fileContent) });

        // Read and decrypt private key
        const key = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
            passphrase
        });

        // Create detached signature
        const signature = await openpgp.sign({
            message,
            signingKeys: key,
            detached: true
        });

        return signature as string;
    } catch (error) {
        console.error('PGP signing failed:', error);
        throw new Error(`PGP signing failed: ${error}`);
    }
}

/**
 * Verify PGP signature
 */
export async function pgpVerifySignature(
    file: File,
    signature: string,
    publicKey: string
): Promise<{
    verified: boolean;
    signerFingerprint?: string;
    signedAt?: Date;
}> {
    try {
        // Read file content
        const fileContent = await file.arrayBuffer();
        const message = await openpgp.createMessage({ binary: new Uint8Array(fileContent) });

        // Read public key
        const key = await openpgp.readKey({ armoredKey: publicKey });

        // Read signature
        const sigObj = await openpgp.readSignature({ armoredSignature: signature });

        // Verify
        const verificationResult = await openpgp.verify({
            message,
            signature: sigObj,
            verificationKeys: key
        });

        const { verified, keyID } = verificationResult.signatures[0];
        await verified; // Wait for verification

        // Get signature creation time
        const sig = verificationResult.signatures[0];
        const signedAt = (sig as any).signature?.packets?.[0]?.created;

        return {
            verified: true,
            signerFingerprint: keyID.toHex(),
            signedAt: signedAt
        };
    } catch (error) {
        console.error('PGP verification failed:', error);
        return { verified: false };
    }
}

/**
 * Encrypt and sign document (combined operation)
 */
export async function pgpEncryptAndSign(
    file: File,
    recipientPublicKey: string,
    signerPrivateKey: string,
    passphrase: string,
    onProgress?: (progress: number) => void
): Promise<Blob> {
    try {
        onProgress?.(10);

        // Read file content
        const fileContent = await file.arrayBuffer();
        const message = await openpgp.createMessage({ binary: new Uint8Array(fileContent) });

        onProgress?.(25);

        // Read recipient's public key
        const encryptionKey = await openpgp.readKey({ armoredKey: recipientPublicKey });

        onProgress?.(40);

        // Read and decrypt signer's private key
        const signingKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: signerPrivateKey }),
            passphrase
        });

        onProgress?.(60);

        // Encrypt and sign
        const encrypted = await openpgp.encrypt({
            message,
            encryptionKeys: encryptionKey,
            signingKeys: signingKey,
            format: 'binary'
        });

        onProgress?.(90);

        // Create blob
        const encryptedBlob = new Blob([new Uint8Array(encrypted as Uint8Array)], { type: 'application/pgp-encrypted' });

        onProgress?.(100);

        return encryptedBlob;
    } catch (error) {
        console.error('PGP encrypt and sign failed:', error);
        throw new Error(`PGP encrypt and sign failed: ${error}`);
    }
}

/**
 * Decrypt and verify document (combined operation)
 */
export async function pgpDecryptAndVerify(
    encryptedFile: Blob,
    privateKey: string,
    senderPublicKey: string,
    passphrase: string,
    onProgress?: (progress: number) => void
): Promise<{
    decryptedBlob: Blob;
    signatureValid: boolean;
    signerFingerprint?: string;
}> {
    try {
        onProgress?.(10);

        // Read encrypted content
        const encryptedData = await encryptedFile.arrayBuffer();
        const message = await openpgp.readMessage({ binaryMessage: new Uint8Array(encryptedData) });

        onProgress?.(25);

        // Read and decrypt private key
        const decryptionKey = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
            passphrase
        });

        onProgress?.(40);

        // Read sender's public key for verification
        const verificationKey = await openpgp.readKey({ armoredKey: senderPublicKey });

        onProgress?.(60);

        // Decrypt and verify
        const { data, signatures } = await openpgp.decrypt({
            message,
            decryptionKeys: decryptionKey,
            verificationKeys: verificationKey,
            format: 'binary'
        });

        onProgress?.(85);

        // Check signature
        let signatureValid = false;
        let signerFingerprint: string | undefined;

        if (signatures && signatures.length > 0) {
            try {
                await signatures[0].verified;
                signatureValid = true;
                signerFingerprint = signatures[0].keyID.toHex();
            } catch (e) {
                signatureValid = false;
            }
        }

        onProgress?.(95);

        // Create blob
        const decryptedBlob = new Blob([new Uint8Array(data as Uint8Array)]);

        onProgress?.(100);

        return {
            decryptedBlob,
            signatureValid,
            signerFingerprint
        };
    } catch (error) {
        console.error('PGP decrypt and verify failed:', error);
        throw new Error(`PGP decrypt and verify failed: ${error}`);
    }
}

/**
 * Import PGP public key
 */
export async function importPGPPublicKey(armoredKey: string): Promise<{
    fingerprint: string;
    userIDs: string[];
    creationTime: Date;
}> {
    try {
        const key = await openpgp.readKey({ armoredKey });

        const userIDs = key.getUserIDs();
        const fingerprint = key.getFingerprint();
        const creationTime = key.getCreationTime();

        return {
            fingerprint,
            userIDs,
            creationTime
        };
    } catch (error) {
        throw new Error(`Failed to import PGP public key: ${error}`);
    }
}

/**
 * Import PGP private key
 */
export async function importPGPPrivateKey(
    armoredKey: string,
    passphrase: string
): Promise<{
    fingerprint: string;
    userIDs: string[];
    isDecrypted: boolean;
}> {
    try {
        const privateKey = await openpgp.readPrivateKey({ armoredKey });

        // Verify passphrase
        const decryptedKey = await openpgp.decryptKey({
            privateKey,
            passphrase
        });

        const userIDs = decryptedKey.getUserIDs();
        const fingerprint = decryptedKey.getFingerprint();

        return {
            fingerprint,
            userIDs,
            isDecrypted: decryptedKey.isDecrypted()
        };
    } catch (error) {
        throw new Error(`Failed to import PGP private key: ${error}`);
    }
}

/**
 * Export PGP public key (already armored)
 */
export function exportPGPPublicKey(publicKey: string): string {
    return publicKey;
}

/**
 * Change PGP key passphrase
 */
export async function changePGPPassphrase(
    privateKey: string,
    oldPassphrase: string,
    newPassphrase: string
): Promise<string> {
    try {
        // Decrypt with old passphrase
        const key = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
            passphrase: oldPassphrase
        });

        // Re-encrypt with new passphrase
        const encryptedKey = await openpgp.encryptKey({
            privateKey: key,
            passphrase: newPassphrase
        });

        return encryptedKey.armor();
    } catch (error) {
        throw new Error(`Failed to change PGP passphrase: ${error}`);
    }
}

/**
 * Revoke PGP key
 */
export async function revokePGPKey(
    privateKey: string,
    passphrase: string,
    revocationCertificate?: string
): Promise<string> {
    try {
        if (revocationCertificate) {
            return revocationCertificate;
        }

        // Decrypt private key
        const key = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: privateKey }),
            passphrase
        });

        // Generate revocation certificate
        const revocationCert = await openpgp.revokeKey({
            key: key
        });

        return revocationCert.publicKey;
    } catch (error) {
        throw new Error(`Failed to revoke PGP key: ${error}`);
    }
}

/**
 * Verify key fingerprint matches
 */
export function verifyFingerprint(fingerprint1: string, fingerprint2: string): boolean {
    return fingerprint1.toLowerCase().replace(/\s/g, '') ===
        fingerprint2.toLowerCase().replace(/\s/g, '');
}

/**
 * Format fingerprint for display (groups of 4)
 */
export function formatFingerprint(fingerprint: string): string {
    return fingerprint.match(/.{1,4}/g)?.join(' ') || fingerprint;
}
