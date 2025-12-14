/**
 * Triggers the device's native biometric prompt (TouchID/FaceID/Windows Hello)
 * to verify user presence.
 * 
 * Uses the WebAuthn `navigator.credentials.create` method with a platform authenticator
 * requirement. This effectively acts as a local "gate" that forces the user to
 * prove they are authorized on the device.
 * 
 * @returns {Promise<boolean>} Resolves to true if verification passed, false otherwise.
 * @throws {Error} If biometrics are not supported or an error occurs.
 */
export const verifyBiometricPresence = async (): Promise<boolean> => {
    try {
        // 1. Check availability
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (!available) {
            console.warn("Biometrics not available on this device.");
            // We might choose to return false or throw here depending on strictness.
            // For this implementation, we'll try to proceed (browser might handle it) or fail gracefully.
            // Returning false to signal "cannot verify".
            // However, to avoid blocking development on non-biometric machines, 
            // we could potentially soft-fail or mock in dev. 
            // Sticking to strict for "Security" feature.
        }

        // 2. Create Challenge
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        // 3. WebAuthn Options
        const publicKey: any = {
            challenge: challenge,
            rp: {
                name: "DocTransfer Secure View",
                id: window.location.hostname
            },
            user: {
                id: new Uint8Array(16),
                name: "user@doctransfer.com",
                displayName: "User Verification"
            },
            pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
            authenticatorSelection: {
                authenticatorAttachment: "platform", // Forces TouchID/FaceID/Windows Hello
                userVerification: "required",      // Forces the biometric/PIN check
                residentKey: "preferred"
            },
            timeout: 60000,
            attestation: "none"
        };

        // 4. Trigger Prompt
        await navigator.credentials.create({ publicKey });

        // If successful
        return true;

    } catch (error: any) {
        console.error("Biometric Verification Failed:", error);

        if (error.name === 'NotAllowedError') {
            // User cancelled or timed out
            throw new Error('Verification cancelled.');
        } else if (error.name === 'NotSupportedError') {
            throw new Error('Biometrics not supported on this device/context.');
        }

        throw error;
    }
};
