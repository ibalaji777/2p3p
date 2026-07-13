// src/features/railing/builders/Railing2DBuilder.js
import Konva from 'konva';

export class Railing2DBuilder {
    static build(entity, isSelected = false) {
        const group = new Konva.Group();
        
        const pts = entity.points; // [x1, y1, x2, y2]
        if (pts.length < 4) return group;

        const config = entity.config;
        
        let color = '#555555';
        if (isSelected) color = '#2D8CFF';
        else if (entity.isHovered) color = '#FF9800';

        // Offset calculation to avoid overlapping wall centerline
        const dx = pts[2] - pts[0];
        const dy = pts[3] - pts[1];
        const length = Math.hypot(dx, dy);
        
        if (length === 0) return group;

        const nx = -dy / length;
        const ny = dx / length;
        const offset = 1.5; // ~38mm

        const ox1 = pts[0] + nx * offset;
        const oy1 = pts[1] + ny * offset;
        const ox2 = pts[2] + nx * offset;
        const oy2 = pts[3] + ny * offset;

        // Center line (handrail representation)
        const handrail = new Konva.Line({
            points: [ox1, oy1, ox2, oy2],
            stroke: color,
            strokeWidth: 2,
            lineCap: 'square',
            hitStrokeWidth: 20,
            strokeScaleEnabled: false
        });
        group.add(handrail);

        // End posts
        const endPosts = new Konva.Shape({
            sceneFunc: (ctx, shape) => {
                const scale = shape.getStage()?.scaleX() || 1;
                if (scale < 0.25) return; // Very low zoom -> thin line only
                
                ctx.beginPath();
                // Start post
                ctx.moveTo(ox1 - nx * 2, oy1 - ny * 2);
                ctx.lineTo(ox1 + nx * 2, oy1 + ny * 2);
                // End post
                ctx.moveTo(ox2 - nx * 2, oy2 - ny * 2);
                ctx.lineTo(ox2 + nx * 2, oy2 + ny * 2);
                
                ctx.fillStrokeShape(shape);
            },
            stroke: color,
            strokeWidth: 3,
            strokeScaleEnabled: false,
            listening: false
        });
        group.add(endPosts);

        // Glass or Balusters representation
        if (config.glass) {
            const glassLine = new Konva.Line({
                points: [ox1, oy1, ox2, oy2],
                stroke: '#a5f3fc', // Cyan tint for glass hatch
                strokeWidth: 4,
                opacity: 0.4,
                strokeScaleEnabled: false,
                listening: false
            });
            group.add(glassLine);
        } else {
            // Balusters
            const spacing = 6; // ~150mm spacing
            const count = Math.max(2, Math.floor(length / spacing));
            const actualSpacing = length / count;
            
            const balusters = new Konva.Shape({
                sceneFunc: (ctx, shape) => {
                    const scale = shape.getStage()?.scaleX() || 1;
                    if (scale < 0.5) return; // Low zoom -> hide balusters
                    
                    let step = 1;
                    if (scale < 1.0) step = 2; // Medium zoom -> alternate balusters
                    
                    ctx.beginPath();
                    for (let i = 1; i < count; i += step) {
                        const t = i * actualSpacing / length;
                        const bx = ox1 + dx * t;
                        const by = oy1 + dy * t;
                        
                        ctx.moveTo(bx - nx * 1.5, by - ny * 1.5);
                        ctx.lineTo(bx + nx * 1.5, by + ny * 1.5);
                    }
                    ctx.fillStrokeShape(shape);
                },
                stroke: color,
                strokeWidth: 1,
                strokeScaleEnabled: false,
                listening: false
            });
            group.add(balusters);
        }

        // Selection handles
        if (isSelected) {
            const startHandle = new Konva.Circle({
                x: ox1, y: oy1, radius: 4, fill: '#fff', stroke: color, strokeWidth: 2, strokeScaleEnabled: false, listening: false
            });
            const endHandle = new Konva.Circle({
                x: ox2, y: oy2, radius: 4, fill: '#fff', stroke: color, strokeWidth: 2, strokeScaleEnabled: false, listening: false
            });
            group.add(startHandle, endHandle);
        }

        return group;
    }
}
