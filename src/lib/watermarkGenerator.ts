/**
 * Dynamic Watermark Generator
 * Creates and applies watermarks to protected documents
 */

export interface WatermarkConfig {
    text: string;
    opacity?: number;
    position?: 'diagonal' | 'center' | 'bottom' | 'top';
    fontSize?: number;
    color?: string;
    rotation?: number;
}

/**
 * Apply a dynamic watermark to a container element
 */
export function applyWatermark(
    containerId: string,
    config: WatermarkConfig
): void {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error('Watermark container not found:', containerId);
        return;
    }

    // Remove existing watermark if any
    const existing = container.querySelector('.drm-watermark');
    if (existing) {
        existing.remove();
    }

    // Create watermark overlay
    const watermarkDiv = document.createElement('div');
    watermarkDiv.className = 'drm-watermark';

    const opacity = config.opacity ?? 0.3;
    const fontSize = config.fontSize ?? 20;
    const color = config.color ?? '#000000';
    const rotation = config.rotation ?? -45;

    // Base styles
    watermarkDiv.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 9998;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
    `;

    // Create watermark pattern based on position
    switch (config.position) {
        case 'diagonal':
            createDiagonalWatermark(watermarkDiv, config.text, opacity, fontSize, color, rotation);
            break;
        case 'center':
            createCenterWatermark(watermarkDiv, config.text, opacity, fontSize, color);
            break;
        case 'bottom':
            createBottomWatermark(watermarkDiv, config.text, opacity, fontSize, color);
            break;
        case 'top':
            createTopWatermark(watermarkDiv, config.text, opacity, fontSize, color);
            break;
        default:
            createDiagonalWatermark(watermarkDiv, config.text, opacity, fontSize, color, rotation);
    }

    container.style.position = 'relative';
    container.appendChild(watermarkDiv);
}

/**
 * Create diagonal repeating watermark
 */
function createDiagonalWatermark(
    element: HTMLElement,
    text: string,
    opacity: number,
    fontSize: number,
    color: string,
    rotation: number
): void {
    // Create canvas for pattern
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.font = `${fontSize}px Arial`;
    ctx.fillStyle = color;
    ctx.globalAlpha = opacity;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Rotate and draw text
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.fillText(text, 0, 0);

    // Apply as repeating background
    element.style.backgroundImage = `url(${canvas.toDataURL()})`;
    element.style.backgroundRepeat = 'repeat';
}

/**
 * Create centered watermark
 */
function createCenterWatermark(
    element: HTMLElement,
    text: string,
    opacity: number,
    fontSize: number,
    color: string
): void {
    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: ${fontSize * 2}px;
        font-weight: bold;
        color: ${color};
        opacity: ${opacity};
        white-space: nowrap;
        pointer-events: none;
    `;
    textDiv.textContent = text;
    element.appendChild(textDiv);
}

/**
 * Create bottom watermark
 */
function createBottomWatermark(
    element: HTMLElement,
    text: string,
    opacity: number,
    fontSize: number,
    color: string
): void {
    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
        position: absolute;
        bottom: 10px;
        left: 50%;
        transform: translateX(-50%);
        font-size: ${fontSize}px;
        color: ${color};
        opacity: ${opacity};
        white-space: nowrap;
        pointer-events: none;
    `;
    textDiv.textContent = text;
    element.appendChild(textDiv);
}

/**
 * Create top watermark
 */
function createTopWatermark(
    element: HTMLElement,
    text: string,
    opacity: number,
    fontSize: number,
    color: string
): void {
    const textDiv = document.createElement('div');
    textDiv.style.cssText = `
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        font-size: ${fontSize}px;
        color: ${color};
        opacity: ${opacity};
        white-space: nowrap;
        pointer-events: none;
    `;
    textDiv.textContent = text;
    element.appendChild(textDiv);
}

/**
 * Remove watermark from container
 */
export function removeWatermark(containerId: string): void {
    const container = document.getElementById(containerId);
    if (!container) return;

    const watermark = container.querySelector('.drm-watermark');
    if (watermark) {
        watermark.remove();
    }
}

/**
 * Generate watermark text with session info
 */
export function generateWatermarkText(options: {
    ip?: string;
    timestamp?: Date;
    sessionId?: string;
    customText?: string;
}): string {
    if (options.customText) {
        return options.customText;
    }

    const parts: string[] = [];

    if (options.ip) {
        parts.push(`IP: ${options.ip}`);
    }

    if (options.timestamp) {
        parts.push(options.timestamp.toLocaleString());
    }

    if (options.sessionId) {
        // Truncate session ID for brevity
        const shortId = options.sessionId.substring(0, 8);
        parts.push(`ID: ${shortId}`);
    }

    return parts.join(' | ') || 'CONFIDENTIAL';
}

/**
 * Create forensic watermark with embedded user/session data
 * Useful for tracking document leaks
 */
export function createForensicWatermark(
    containerId: string,
    sessionToken: string,
    ipAddress: string
): void {
    // Create visible watermark
    const visibleText = generateWatermarkText({
        ip: ipAddress,
        timestamp: new Date()
    });

    applyWatermark(containerId, {
        text: visibleText,
        opacity: 0.15,
        position: 'diagonal'
    });

    // Create invisible metadata watermark (steganography-like)
    const container = document.getElementById(containerId);
    if (container) {
        // Store forensic data in data attributes (hidden but retrievable)
        container.setAttribute('data-session', sessionToken);
        container.setAttribute('data-timestamp', new Date().toISOString());
        container.setAttribute('data-ip', ipAddress);
    }
}
