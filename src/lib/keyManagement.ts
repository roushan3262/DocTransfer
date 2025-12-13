/**
 * Advanced Key Management Service
 * Handles user-managed encryption keys with master password
 */

/**
 * User's encryption key pair
 */
export interface UserKeys {
    publicKey: string; // PEM format
    privateKeyEncrypted: string; // Encrypted with master password
    keyFingerprint: string;
    keyAlgorithm: 'RSA-2048' | 'RSA-4096' | 'RSA-8192';
    createdAt: Date;
    expiresAt?: Date;
}

/**
 * Key storage options
 */
export interface KeyStorageOptions {
    storage: 'localStorage' | 'sessionStorage' | 'memory';
    autoLock?: number; // Auto-lock after N minutes of inactivity
}

/**
 * Generate a secure salt for key derivation
 */
export function generateSalt(): Uint8Array {
    return crypto.getRandomValues(new Uint8Array(32));
}

/**
 * Derive a cryptographic key from a password using PBKDF2
 */
export async function deriveKeyFromPassword(
    password: string,
    salt: Uint8Array,
    iterations: number = 100000
): Promise<CryptoKey> {
    // Import password as key material
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveBits', 'deriveKey']
    );

    // Derive AES key from password
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: iterations,
            hash: 'SHA-256'
        },
        passwordKey,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );

    return derivedKey;
}

/**
 * Generate RSA key pair for user
 */
export async function generateRSAKeyPair(
    keySize: 2048 | 4096 | 8192 = 4096
): Promise<CryptoKeyPair> {
    const keyPair = await crypto.subtle.generateKey(
        {
            name: 'RSA-OAEP',
            modulusLength: keySize,
            publicExponent: new Uint8Array([1, 0, 1]), // 65537
            hash: 'SHA-256'
        },
        true, // extractable
        ['encrypt', 'decrypt']
    );

    return keyPair;
}

/**
 * Export RSA public key to PEM format
 */
export async function exportPublicKeyToPEM(publicKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('spki', publicKey);
    const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    const pem = `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
    return pem;
}

/**
 * Export RSA private key to PEM format
 */
export async function exportPrivateKeyToPEM(privateKey: CryptoKey): Promise<string> {
    const exported = await crypto.subtle.exportKey('pkcs8', privateKey);
    const exportedAsBase64 = btoa(String.fromCharCode(...new Uint8Array(exported)));
    const pem = `-----BEGIN PRIVATE KEY-----\n${exportedAsBase64.match(/.{1,64}/g)?.join('\n')}\n-----END PRIVATE KEY-----`;
    return pem;
}

/**
 * Import RSA public key from PEM format
 */
export async function importPublicKeyFromPEM(pem: string): Promise<CryptoKey> {
    const pemContents = pem
        .replace('-----BEGIN PUBLIC KEY-----', '')
        .replace('-----END PUBLIC KEY-----', '')
        .replace(/\s/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const publicKey = await crypto.subtle.importKey(
        'spki',
        binaryDer,
        {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        },
        true,
        ['encrypt']
    );

    return publicKey;
}

/**
 * Import RSA private key from PEM format
 */
export async function importPrivateKeyFromPEM(pem: string): Promise<CryptoKey> {
    const pemContents = pem
        .replace('-----BEGIN PRIVATE KEY-----', '')
        .replace('-----END PRIVATE KEY-----', '')
        .replace(/\s/g, '');

    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));

    const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        binaryDer,
        {
            name: 'RSA-OAEP',
            hash: 'SHA-256'
        },
        true,
        ['decrypt']
    );

    return privateKey;
}

/**
 * Encrypt private key with master password
 */
export async function encryptPrivateKey(
    privateKeyPEM: string,
    masterPassword: string
): Promise<{ encrypted: string; salt: string; iv: string }> {
    // Generate salt and derive key
    const salt = generateSalt();
    const encryptionKey = await deriveKeyFromPassword(masterPassword, salt);

    // Generate IV
    const iv = crypto.getRandomValues(new Uint8Array(12));

    // Encrypt private key
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        encryptionKey,
        encoder.encode(privateKeyPEM)
    );

    return {
        encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
        salt: btoa(String.fromCharCode(...salt)),
        iv: btoa(String.fromCharCode(...iv))
    };
}

/**
 * Decrypt private key with master password
 */
export async function decryptPrivateKey(
    encryptedData: string,
    salt: string,
    iv: string,
    masterPassword: string
): Promise<string> {
    // Decode base64
    const encryptedBuffer = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    const saltBuffer = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
    const ivBuffer = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    // Derive key from password
    const decryptionKey = await deriveKeyFromPassword(masterPassword, saltBuffer);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: ivBuffer
        },
        decryptionKey,
        encryptedBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
}

/**
 * Calculate key fingerprint (SHA-256 hash of public key)
 */
export async function calculateKeyFingerprint(publicKeyPEM: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(publicKeyPEM);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 40); // First 40 characters
}

/**
 * Generate complete user key set with master password
 */
export async function generateUserKeys(
    masterPassword: string,
    keySize: 2048 | 4096 | 8192 = 4096
): Promise<UserKeys> {
    // Generate RSA key pair
    const keyPair = await generateRSAKeyPair(keySize);

    // Export keys to PEM
    const publicKeyPEM = await exportPublicKeyToPEM(keyPair.publicKey);
    const privateKeyPEM = await exportPrivateKeyToPEM(keyPair.privateKey);

    // Encrypt private key
    const { encrypted, salt, iv } = await encryptPrivateKey(privateKeyPEM, masterPassword);

    // Calculate fingerprint
    const fingerprint = await calculateKeyFingerprint(publicKeyPEM);

    // Store salt and IV with encrypted key
    const privateKeyEncrypted = JSON.stringify({ encrypted, salt, iv });

    return {
        publicKey: publicKeyPEM,
        privateKeyEncrypted,
        keyFingerprint: fingerprint,
        keyAlgorithm: `RSA-${keySize}` as any,
        createdAt: new Date()
    };
}

/**
 * Decrypt user's private key from stored encrypted format
 */
export async function decryptUserPrivateKey(
    privateKeyEncrypted: string,
    masterPassword: string
): Promise<string> {
    const { encrypted, salt, iv } = JSON.parse(privateKeyEncrypted);
    return await decryptPrivateKey(encrypted, salt, iv, masterPassword);
}

/**
 * Verify master password is correct
 */
export async function verifyMasterPassword(
    privateKeyEncrypted: string,
    masterPassword: string
): Promise<boolean> {
    try {
        await decryptUserPrivateKey(privateKeyEncrypted, masterPassword);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Store user keys in browser storage
 */
export function storeUserKeys(
    keys: UserKeys,
    options: KeyStorageOptions = { storage: 'localStorage' }
): void {
    const storage = options.storage === 'sessionStorage' ? sessionStorage : localStorage;
    storage.setItem('user_encryption_keys', JSON.stringify(keys));

    if (options.autoLock) {
        // Set up auto-lock timer
        const lockTime = Date.now() + options.autoLock * 60 * 1000;
        storage.setItem('key_lock_time', lockTime.toString());
    }
}

/**
 * Retrieve user keys from browser storage
 */
export function getUserKeys(
    storageType: 'localStorage' | 'sessionStorage' = 'localStorage'
): UserKeys | null {
    const storage = storageType === 'sessionStorage' ? sessionStorage : localStorage;
    const keysJSON = storage.getItem('user_encryption_keys');

    if (!keysJSON) return null;

    // Check if keys are locked
    const lockTime = storage.getItem('key_lock_time');
    if (lockTime && Date.now() > parseInt(lockTime)) {
        clearUserKeys();
        return null;
    }

    return JSON.parse(keysJSON);
}

/**
 * Clear user keys from storage
 */
export function clearUserKeys(): void {
    localStorage.removeItem('user_encryption_keys');
    localStorage.removeItem('key_lock_time');
    sessionStorage.removeItem('user_encryption_keys');
}

/**
 * Export keys for backup (encrypted JSON)
 */
export function exportKeysForBackup(keys: UserKeys): string {
    const backup = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        keys: keys
    };
    return JSON.stringify(backup, null, 2);
}

/**
 * Import keys from backup
 */
export function importKeysFromBackup(backupJSON: string): UserKeys {
    const backup = JSON.parse(backupJSON);

    if (backup.version !== '1.0') {
        throw new Error('Unsupported backup version');
    }

    return backup.keys;
}

/**
 * Rotate keys (generate new keys, re-encrypt with new password)
 */
export async function rotateKeys(
    oldPrivateKeyEncrypted: string,
    oldPassword: string,
    newPassword: string,
    newKeySize?: 2048 | 4096 | 8192
): Promise<UserKeys> {
    // Verify old password
    const isValid = await verifyMasterPassword(oldPrivateKeyEncrypted, oldPassword);
    if (!isValid) {
        throw new Error('Invalid old password');
    }

    // Generate new keys
    const newKeys = await generateUserKeys(newPassword, newKeySize);

    return newKeys;
}

/**
 * Check password strength
 */
export function checkPasswordStrength(password: string): {
    score: number; // 0-100
    feedback: string[];
    isStrong: boolean;
} {
    const feedback: string[] = [];
    let score = 0;

    // Length check
    if (password.length >= 12) score += 25;
    else if (password.length >= 8) score += 10;
    else feedback.push('Password should be at least 12 characters');

    // Uppercase
    if (/[A-Z]/.test(password)) score += 15;
    else feedback.push('Add uppercase letters');

    // Lowercase
    if (/[a-z]/.test(password)) score += 15;
    else feedback.push('Add lowercase letters');

    // Numbers
    if (/\d/.test(password)) score += 15;
    else feedback.push('Add numbers');

    // Special characters
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 15;
    else feedback.push('Add special characters');

    // No common patterns
    const commonPatterns = ['password', '12345', 'qwerty', 'abc'];
    const hasCommonPattern = commonPatterns.some(pattern =>
        password.toLowerCase().includes(pattern)
    );
    if (!hasCommonPattern) score += 15;
    else feedback.push('Avoid common patterns');

    return {
        score,
        feedback,
        isStrong: score >= 70
    };
}
