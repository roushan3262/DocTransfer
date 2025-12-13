/**
 * Device Fingerprinting Utility
 * Generates a unique browser fingerprint for device tracking
 */

/**
 * Generate a comprehensive device fingerprint
 * Combines multiple browser characteristics to create a unique hash
 */
export async function generateDeviceFingerprint(): Promise<string> {
    const components: string[] = [];

    // 1. Canvas Fingerprinting
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
            canvas.width = 200;
            canvas.height = 50;
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            ctx.fillStyle = '#069';
            ctx.fillText('DocTransfer DRM', 2, 15);
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('DocTransfer DRM', 4, 17);

            const canvasData = canvas.toDataURL();
            components.push(`canvas:${hashString(canvasData)}`);
        }
    } catch (e) {
        components.push('canvas:unavailable');
    }

    // 2. WebGL Fingerprinting
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl && gl instanceof WebGLRenderingContext) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
                const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                components.push(`webgl:${vendor}|${renderer}`);
            }
        }
    } catch (e) {
        components.push('webgl:unavailable');
    }

    // 3. Audio Context Fingerprinting
    try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
            const context = new AudioContext();
            const oscillator = context.createOscillator();
            const analyser = context.createAnalyser();
            const gainNode = context.createGain();
            const scriptProcessor = context.createScriptProcessor(4096, 1, 1);

            gainNode.gain.value = 0;
            oscillator.connect(analyser);
            analyser.connect(scriptProcessor);
            scriptProcessor.connect(gainNode);
            gainNode.connect(context.destination);

            oscillator.start(0);
            const audioHash = hashString(analyser.frequencyBinCount.toString());
            components.push(`audio:${audioHash}`);
            oscillator.stop();
        }
    } catch (e) {
        components.push('audio:unavailable');
    }

    // 4. Screen Properties
    components.push(`screen:${screen.width}x${screen.height}x${screen.colorDepth}`);
    components.push(`avail:${screen.availWidth}x${screen.availHeight}`);
    components.push(`pixel:${window.devicePixelRatio || 1}`);

    // 5. Browser & Platform
    components.push(`platform:${navigator.platform}`);
    components.push(`lang:${navigator.language}`);
    components.push(`langs:${(navigator.languages || []).join(',')}`);
    components.push(`hardwareConcurrency:${navigator.hardwareConcurrency || 0}`);
    components.push(`deviceMemory:${(navigator as any).deviceMemory || 'unknown'}`);

    // 6. Timezone
    components.push(`tz:${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
    components.push(`tzOffset:${new Date().getTimezoneOffset()}`);

    // 7. Plugins (limited in modern browsers)
    const plugins = Array.from(navigator.plugins || [])
        .map(p => p.name)
        .sort()
        .join('|');
    components.push(`plugins:${hashString(plugins)}`);

    // 8. Fonts Detection (basic)
    const baseFonts = ['monospace', 'sans-serif', 'serif'];
    const testFonts = ['Arial', 'Courier New', 'Georgia', 'Times New Roman', 'Verdana'];
    const detectedFonts: string[] = [];

    for (const font of testFonts) {
        if (isFontAvailable(font, baseFonts)) {
            detectedFonts.push(font);
        }
    }
    components.push(`fonts:${detectedFonts.join('|')}`);

    // 9. Touch Support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    components.push(`touch:${hasTouch}`);

    // 10. Battery (if available)
    try {
        if ('getBattery' in navigator) {
            const battery = await (navigator as any).getBattery();
            components.push(`battery:${battery.level}`);
        }
    } catch (e) {
        components.push('battery:unavailable');
    }

    // Combine all components and hash
    const fingerprintString = components.join('||');
    return hashString(fingerprintString);
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
}

/**
 * Check if a font is available
 */
function isFontAvailable(font: string, baseFonts: string[]): boolean {
    const testString = 'mmmmmmmmmmlli';
    const testSize = '72px';
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return false;

    const baseWidths: { [key: string]: number } = {};

    // Get base font widths
    for (const baseFont of baseFonts) {
        ctx.font = `${testSize} ${baseFont}`;
        baseWidths[baseFont] = ctx.measureText(testString).width;
    }

    // Test with specific font
    let detected = false;
    for (const baseFont of baseFonts) {
        ctx.font = `${testSize} '${font}', ${baseFont}`;
        const width = ctx.measureText(testString).width;
        if (width !== baseWidths[baseFont]) {
            detected = true;
            break;
        }
    }

    return detected;
}

/**
 * Get a persistent device ID from localStorage
 * Falls back to fingerprint if localStorage is unavailable
 */
export async function getDeviceId(): Promise<string> {
    const DEVICE_ID_KEY = 'doctransfer_device_id';

    try {
        // Try to get existing device ID
        let deviceId = localStorage.getItem(DEVICE_ID_KEY);

        if (!deviceId) {
            // Generate new device ID based on fingerprint
            const fingerprint = await generateDeviceFingerprint();
            const random = Math.random().toString(36).substring(2, 15);
            deviceId = `${fingerprint}_${random}`;

            // Store for future use
            localStorage.setItem(DEVICE_ID_KEY, deviceId);
        }

        return deviceId;
    } catch (error) {
        // Fallback to session-only fingerprint
        return await generateDeviceFingerprint();
    }
}

/**
 * Clear stored device ID (for testing)
 */
export function clearDeviceId(): void {
    try {
        localStorage.removeItem('doctransfer_device_id');
    } catch (e) {
        // Silent fail
    }
}

/**
 * Check if fingerprints match (with some tolerance)
 */
export function fingerprintsMatch(fp1: string, fp2: string, tolerance: number = 0.9): boolean {
    if (fp1 === fp2) return true;

    // Calculate similarity (simplified)
    const fp1Parts = fp1.split('||');
    const fp2Parts = fp2.split('||');

    let matches = 0;
    const totalParts = Math.max(fp1Parts.length, fp2 Parts.length);

    for (let i = 0; i < Math.min(fp1Parts.length, fp2Parts.length); i++) {
        if (fp1Parts[i] === fp2Parts[i]) {
            matches++;
        }
    }

    const similarity = matches / totalParts;
    return similarity >= tolerance;
}
