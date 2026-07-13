// src/features/railing/builders/Railing2DBuilder.js
import Konva from 'konva';

export class Railing2DBuilder {
    static build(entity, isSelected = false) {
        const group = new Konva.Group();
        
        const pts = entity.points; // [x1, y1, x2, y2]
        if (pts.length < 4) return group;

        const config = entity.config;
        const color = isSelected ? '#4f46e5' : '#4b5563';
        const thickness = config.thickness || 2;

        // Center line (handrail representation)
        const line = new Konva.Line({
            points: pts,
            stroke: color,
            strokeWidth: thickness,
            lineJoin: 'miter',
            lineCap: 'square',
            hitStrokeWidth: 20
        });
        group.add(line);

        // Glass representation
        if (config.glass) {
            const glassLine = new Konva.Line({
                points: pts,
                stroke: '#a5f3fc', // Cyan tint for glass
                strokeWidth: thickness * 0.5,
                lineJoin: 'miter',
                opacity: 0.6
            });
            group.add(glassLine);
        }

        // Post representation
        if (config.post) {
            const dx = pts[2] - pts[0];
            const dy = pts[3] - pts[1];
            const length = Math.hypot(dx, dy);
            
            if (length > 0) {
                const spacing = config.post.spacing;
                const count = Math.max(2, Math.floor(length / spacing) + 1);
                const actualSpacing = length / (count - 1 || 1);
                
                const pW = config.post.width;
                const pD = config.post.depth;

                for (let i = 0; i < count; i++) {
                    const t = i * actualSpacing / length;
                    const x = pts[0] + dx * t;
                    const y = pts[1] + dy * t;

                    const postRect = new Konva.Rect({
                        x: x - pW / 2,
                        y: y - pD / 2,
                        width: pW,
                        height: pD,
                        fill: color,
                        rotation: Math.atan2(dy, dx) * (180 / Math.PI)
                    });
                    group.add(postRect);
                }
            }
        }

        return group;
    }
}
