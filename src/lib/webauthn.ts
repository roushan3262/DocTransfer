/**
 * WebAuthn Service for Biometric Authentication
 * 
 * Provides fingerprint/Touch ID/Face ID/Windows Hello authentication
 * using the Web Authentication API (WebAuthn).
 * 
 * Two-phase flow:
 * 1. Registration: User registers their biometric during file upload
 * 2. Authentication: Same biometric required to access the file
 */

export interface BiometricRegistrationResult {
    success: boolean;
    credentialId?: string; // Base64-encoded credential ID
    error?: string;
}

export interface BiometricAuthenticationResult {
    success: boolean;
    error?: string;
}

/**
 * Register a new biometric credential
 * This should be called during file upload when user enables biometric protection
 * 
 * @returns Registration result with credential ID if successful
 */
export const registerBiometric = async (): Promise<BiometricRegistrationResult> => {
    try {
        // 1. Check if platform authenticator is available
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            return {
                success: false,
                error: 'Biometric authentication is not available on this device. Please ensure you have Touch ID, Face ID, or Windows Hello enabled.'
            };
        }

        // 2. Generate challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // 3. Generate user ID (random for each registration)
        const userId = new Uint8Array(16);
        window.crypto.getRandomValues(userId);

        // 4. Create credential options
        const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
            challenge: challenge,
            rp: {
                name: "DocTransfer",
                id: window.location.hostname
            },
            user: {
                id: userId,
                name: `user_${Date.now()}@doctransfer.com`,
                displayName: "DocTransfer User"
            },
            pubKeyCredParams: [
                { alg: -7, type: "public-key" },   // ES256
                { alg: -257, type: "public-key" }  // RS256
            ],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // Requires built-in authenticator
                userVerification: "required",        // Requires biometric/PIN
                residentKey: "preferred"
            },
            timeout: 60000,
            attestation: "none"
        };

        // 5. Trigger biometric registration
        const credential = await navigator.credentials.create({
            publicKey: publicKeyCredentialCreationOptions
        }) as PublicKeyCredential;

        if (!credential) {
            return {
                success: false,
                error: 'Failed to create biometric credential.'
            };
        }

        // 6. Extract and encode credential ID
        const credentialId = arrayBufferToBase64(credential.rawId);

        return {
            success: true,
            credentialId: credentialId
        };

    } catch (error: any) {
        console.error('Biometric registration error:', error);

        // Handle specific errors
        if (error.name === 'NotAllowedError') {
            return {
                success: false,
                error: 'Biometric registration was cancelled or timed out.'
            };
        } else if (error.name === 'NotSupportedError') {
            return {
                success: false,
                error: 'Biometric authentication is not supported in this browser or context. Please use HTTPS and a modern browser.'
            };
        } else if (error.name === 'InvalidStateError') {
            return {
                success: false,
                error: 'A credential already exists. Please try again.'
            };
        }

        return {
            success: false,
            error: `Registration failed: ${error.message || 'Unknown error'}`
        };
    }
};

/**
 * Authenticate using a previously registered biometric credential
 * This should be called when viewing a protected document
 * 
 * @param credentialId Base64-encoded credential ID from registration
 * @returns Authentication result
 */
export const authenticateBiometric = async (credentialId: string): Promise<BiometricAuthenticationResult> => {
    try {
        // 1. Check if platform authenticator is available
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            return {
                success: false,
                error: 'Biometric authentication is not available on this device.'
            };
        }

        // 2. Generate challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // 3. Decode credential ID
        const credentialIdBuffer = base64ToArrayBuffer(credentialId);

        // 4. Create authentication options
        const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
            challenge: challenge,
            allowCredentials: [
                {
                    id: credentialIdBuffer,
                    type: "public-key",
                    transports: ["internal"] // Platform authenticator
                }
            ],
            userVerification: "required",
            timeout: 60000,
            rpId: window.location.hostname
        };

        // 5. Trigger biometric authentication
        const assertion = await navigator.credentials.get({
            publicKey: publicKeyCredentialRequestOptions
        }) as PublicKeyCredential;

        if (!assertion) {
            return {
                success: false,
                error: 'Authentication failed. Please try again.'
            };
        }

        // 6. Verify the credential ID matches
        const returnedCredentialId = arrayBufferToBase64(assertion.rawId);
        if (returnedCredentialId !== credentialId) {
            return {
                success: false,
                error: 'Credential mismatch. This may not be the correct device.'
            };
        }

        return {
            success: true
        };

    } catch (error: any) {
        console.error('Biometric authentication error:', error);

        // Handle specific errors
        if (error.name === 'NotAllowedError') {
            return {
                success: false,
                error: 'Authentication was cancelled or timed out.'
            };
        } else if (error.name === 'NotSupportedError') {
            return {
                success: false,
                error: 'Biometric authentication is not supported in this browser or context.'
            };
        } else if (error.name === 'InvalidStateError') {
            return {
                success: false,
                error: 'The biometric credential is not found on this device. This file can only be accessed from the device where it was uploaded.'
            };
        }

        return {
            success: false,
            error: `Authentication failed: ${error.message || 'Unknown error'}`
        };
    }
};

/**
 * Check if biometric authentication is available
 * @returns True if available, false otherwise
 */
export const isBiometricAvailable = async (): Promise<boolean> => {
    try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
        return false;
    }
};

// Helper functions for encoding/decoding

/**
 * Convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

/**
 * Convert Base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}
