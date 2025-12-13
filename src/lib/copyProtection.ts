/**
 * Copy Protection Utilities
 * Prevents copying, printing, and screenshotting of DRM-protected content
 */

export interface ProtectionOptions {
    preventCopy?: boolean;
    preventPrint?: boolean;
    preventScreenshot?: boolean;
    preventContextMenu?: boolean;
    preventTextSelection?: boolean;
    preventDeveloperTools?: boolean;
    onViolationAttempt?: (type: string) => void;
}

class CopyProtection {
    private containerId: string;
    private options: ProtectionOptions;
    private listeners: Array<{ element: any; event: string; handler: any }> = [];

    constructor(containerId: string, options: ProtectionOptions = {}) {
        this.containerId = containerId;
        this.options = {
            preventCopy: true,
            preventPrint: true,
            preventScreenshot: true,
            preventContextMenu: true,
            preventTextSelection: true,
            preventDeveloperTools: false,
            ...options
        };
    }

    /**
     * Enable all protections
     */
    enable(): void {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error('Protection container not found:', this.containerId);
            return;
        }

        if (this.options.preventCopy) {
            this.enableCopyProtection(container);
        }

        if (this.options.preventPrint) {
            this.enablePrintProtection();
        }

        if (this.options.preventScreenshot) {
            this.enableScreenshotProtection();
        }

        if (this.options.preventContextMenu) {
            this.enableContextMenuProtection(container);
        }

        if (this.options.preventTextSelection) {
            this.enableTextSelectionProtection(container);
        }

        if (this.options.preventDeveloperTools) {
            this.enableDevToolsProtection();
        }
    }

    /**
     * Disable all protections
     */
    disable(): void {
        // Remove all event listeners
        this.listeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.listeners = [];

        // Remove CSS protections
        const container = document.getElementById(this.containerId);
        if (container) {
            container.style.userSelect = '';
            container.style.webkitUserSelect = '';
        }
    }

    /**
     * Prevent copy/cut/paste
     */
    private enableCopyProtection(container: HTMLElement): void {
        const preventCopy = (e: ClipboardEvent) => {
            e.preventDefault();
            this.logViolation('copy');
            this.showWarning('Copying is disabled for this document');
        };

        const preventCut = (e: ClipboardEvent) => {
            e.preventDefault();
            this.logViolation('cut');
        };

        // Add listeners
        this.addListener(container, 'copy', preventCopy);
        this.addListener(container, 'cut', preventCut);

        // Disable keyboard shortcuts
        const preventKeyboardCopy = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault();
                this.logViolation('keyboard_copy');
                this.showWarning('Copying is disabled for this document');
            }
            if ((e.ctrlKey || e.metaKey) && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault();
                this.logViolation('keyboard_cut');
            }
        };

        this.addListener(container, 'keydown', preventKeyboardCopy);
    }

    /**
     * Prevent printing
     */
    private enablePrintProtection(): void {
        const preventPrint = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
                e.preventDefault();
                this.logViolation('print');
                this.showWarning('Printing is disabled for this document');
            }
        };

        this.addListener(document, 'keydown', preventPrint);

        // Override window.print
        const originalPrint = window.print;
        window.print = () => {
            this.logViolation('print');
            this.showWarning('Printing is disabled for this document');
        };

        // Store original for cleanup
        (window as any).__originalPrint = originalPrint;
    }

    /**
     * Attempt to prevent screenshots
     * Note: This is limited and can be bypassed
     */
    private enableScreenshotProtection(): void {
        // Detect PrintScreen key
        const preventPrintScreen = (e: KeyboardEvent) => {
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                this.logViolation('screenshot');
                this.showWarning('Screenshots are disabled for this document');

                // Clear clipboard
                navigator.clipboard.writeText('');
            }
        };

        this.addListener(document, 'keyup', preventPrintScreen);

        // Detect window blur (might indicate screenshot tool)
        const detectBlur = () => {
            this.logViolation('possible_screenshot');
        };

        this.addListener(window, 'blur', detectBlur);

        // Add CSS to make screenshots less useful
        const style = document.createElement('style');
        style.textContent = `
            #${this.containerId} {
                -webkit-user-select: none;
                user-select: none;
            }
            #${this.containerId}::before {
                content: 'CONFIDENTIAL';
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%) rotate(-45deg);
                font-size: 10rem;
                opacity: 0.03;
                pointer-events: none;
                z-index: 9997;
                color: #000;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Prevent right-click context menu
     */
    private enableContextMenuProtection(container: HTMLElement): void {
        const preventContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            this.logViolation('context_menu');
            return false;
        };

        this.addListener(container, 'contextmenu', preventContextMenu);
    }

    /**
     * Prevent text selection
     */
    private enableTextSelectionProtection(container: HTMLElement): void {
        container.style.userSelect = 'none';
        container.style.webkitUserSelect = 'none';
        (container.style as any).mozUserSelect = 'none';
        (container.style as any).msUserSelect = 'none';

        const preventSelection = (e: Event) => {
            e.preventDefault();
            return false;
        };

        this.addListener(container, 'selectstart', preventSelection);
    }

    /**
     * Attempt to detect/prevent developer tools
     * Note: This is easily bypassable and should not be relied upon
     */
    private enableDevToolsProtection(): void {
        let devtoolsOpen = false;

        const detectDevTools = () => {
            const widthThreshold = window.outerWidth - window.innerWidth > 160;
            const heightThreshold = window.outerHeight - window.innerHeight > 160;

            if (widthThreshold || heightThreshold) {
                if (!devtoolsOpen) {
                    devtoolsOpen = true;
                    this.logViolation('devtools_open');
                    this.showWarning('Developer tools detected');
                }
            } else {
                devtoolsOpen = false;
            }
        };

        // Check periodically
        setInterval(detectDevTools, 1000);
    }

    /**
     * Add event listener and track for cleanup
     */
    private addListener(element: any, event: string, handler: any): void {
        element.addEventListener(event, handler);
        this.listeners.push({ element, event, handler });
    }

    /**
     * Log violation attempt
     */
    private logViolation(type: string): void {
        console.warn(`[DRM] Protection violation detected: ${type}`);

        if (this.options.onViolationAttempt) {
            this.options.onViolationAttempt(type);
        }

        // You can also send to analytics or audit log
        // Example: sendToAnalytics('drm_violation', { type, timestamp: new Date() });
    }

    /**
     * Show warning message to user
     */
    private showWarning(message: string): void {
        // Create temporary toast notification
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 14px;
            max-width: 300px;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);

        // Remove after 3 seconds
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }
}

/**
 * Enable copy protection on a container
 */
export function enableCopyProtection(
    containerId: string,
    options?: ProtectionOptions
): CopyProtection {
    const protection = new CopyProtection(containerId, options);
    protection.enable();
    return protection;
}

/**
 * Disable copy protection
 */
export function disableCopyProtection(protection: CopyProtection): void {
    protection.disable();
}

export default CopyProtection;
