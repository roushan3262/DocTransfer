import React, { useMemo } from 'react';

interface WatermarkConfig {
    text: string;
    color: string;
    opacity: number;
    fontSize: number;
    rotation: number;
    layout: 'single' | 'tiled';
}

interface WatermarkOverlayProps {
    config: WatermarkConfig;
    viewerInfo: {
        email?: string;
        ip?: string;
        date?: string;
    };
    width?: number;
    height?: number;
}

const WatermarkOverlay: React.FC<WatermarkOverlayProps> = ({ config, viewerInfo }) => {

    // Replace placeholders with actual values
    const dynamicText = useMemo(() => {
        let text = config.text;
        text = text.replace('{{email}}', viewerInfo.email || 'Anonymous');
        text = text.replace('{{ip}}', viewerInfo.ip || 'Unknown IP');
        text = text.replace('{{date}}', viewerInfo.date || new Date().toLocaleString());
        return text;
    }, [config.text, viewerInfo]);

    const style: React.CSSProperties = {
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 50,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    };

    const textStyle: React.CSSProperties = {
        color: config.color,
        opacity: config.opacity,
        fontSize: `${config.fontSize}px`,
        fontWeight: 'bold',
        transform: `rotate(${config.rotation}deg)`,
        userSelect: 'none',
        whiteSpace: 'nowrap',
    };

    if (config.layout === 'single') {
        return (
            <div style={style}>
                <span style={textStyle}>{dynamicText}</span>
            </div>
        );
    }

    // Tiled Layout Calculation
    // We create a grid larger than the container to account for rotation clipping
    const rows = 5;
    const cols = 3;

    return (
        <div style={style}>
            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                width: '150%', // Oversize to cover corners when rotated
                height: '150%',
                transform: `rotate(${config.rotation}deg)`,
                gap: '50px'
            }}>
                {[...Array(rows * cols)].map((_, i) => (
                    <div key={i} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        // Counter-rotate text if we don't want the grid itself rotated? 
                        // Actually, for tiling, we usually want the whole grid pattern rotated, 
                        // but the standard approach is just repeating text.
                    }}>
                        <span style={{
                            ...textStyle,
                            transform: 'none' // Grid is already rotated
                        }}>
                            {dynamicText}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default WatermarkOverlay;
