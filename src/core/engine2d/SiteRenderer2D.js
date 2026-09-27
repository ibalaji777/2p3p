/**
 * src/core/engine2d/SiteRenderer2D.js
 * 
 * Konva 2D Renderer for Canonical Site Boundaries, Setbacks, and Buildable Envelopes.
 * Renders:
 * 1. Outer property boundary polygon with high-contrast CAD lines and corner pins.
 * 2. Edge dimension tags with road frontage indicators.
 * 3. Corner deflection angle badges.
 * 4. Dashed setback offset lines.
 * 5. Shaded buildable area zone with square footage callout.
 */

import Konva from 'konva';
import { SiteEngine } from '../site/SiteEngine.js';
import { SiteGeometryEngine } from '../site/SiteGeometryEngine.js';

export class SiteRenderer2D {
    static _redraw(planner) {
        if (!planner) return;
        if (planner.siteLayer && typeof planner.siteLayer.batchDraw === 'function') {
            planner.siteLayer.batchDraw();
        } else if (planner.siteLayer && typeof planner.siteLayer.getLayer === 'function' && planner.siteLayer.getLayer()) {
            planner.siteLayer.getLayer().batchDraw();
        } else if (planner.mainLayer && typeof planner.mainLayer.batchDraw === 'function') {
            planner.mainLayer.batchDraw();
        } else if (planner.stage && typeof planner.stage.batchDraw === 'function') {
            planner.stage.batchDraw();
        }
    }

    /**
     * Renders or refreshes the 2D site visualization on the planner's siteLayer.
     * 
     * @param {Object} planner - Canonical FloorPlanner instance
     */
    static render(planner) {
        if (!planner || !planner.siteLayer) return;

        planner.siteLayer.destroyChildren();

        const site = SiteEngine.getSite(planner);
        if (!site || !site.vertices || site.vertices.length < 3 || site.visible === false) {
            this._redraw(planner);
            return;
        }

        const pts = site.vertices;
        const group = new Konva.Group({ id: 'site_boundary_group' });

        // 1. Buildable Envelope & Shaded Zone
        const envelope = SiteEngine.getBuildableEnvelope(planner);
        if (envelope && envelope.length >= 3) {
            const envelopeFlatPoints = envelope.flatMap(p => [p.x, p.y]);

            // Subtle green/blue shaded buildable zone
            const envelopeFill = new Konva.Line({
                points: envelopeFlatPoints,
                closed: true,
                fill: 'rgba(34, 197, 94, 0.06)',
                stroke: '#16a34a',
                strokeWidth: 1.5,
                dash: [8, 6],
                listening: false
            });
            group.add(envelopeFill);

            // Centered buildable area badge
            const envAreaUnits = SiteGeometryEngine.getArea(envelope);
            const envAreaSqFt = Math.round(SiteGeometryEngine.units2ToSqFt(envAreaUnits) * 10) / 10;
            const envXs = envelope.map(p => p.x);
            const envYs = envelope.map(p => p.y);
            const envCx = (Math.min(...envXs) + Math.max(...envXs)) / 2;
            const envCy = (Math.min(...envYs) + Math.max(...envYs)) / 2;

            // Only show center badge if no rooms are obstructing the center
            if (!planner.rooms || planner.rooms.length === 0) {
                const badgeText = new Konva.Text({
                    x: envCx - 100,
                    y: envCy - 12,
                    width: 200,
                    text: `Buildable Area: ${envAreaSqFt} sq ft`,
                    fontSize: 13,
                    fontStyle: 'bold',
                    fill: '#15803d',
                    align: 'center',
                    listening: false
                });
                group.add(badgeText);
            }
        }

        // 2. Outer Plot Boundary Polygon
        const flatPoints = pts.flatMap(p => [p.x, p.y]);
        const boundaryLine = new Konva.Line({
            points: flatPoints,
            closed: true,
            stroke: '#1e293b', // Slate 800 CAD border
            strokeWidth: 2.5,
            lineJoin: 'round',
            lineCap: 'round',
            listening: false
        });
        group.add(boundaryLine);

        // 3. Edge Dimension Labels & Frontage Callouts
        const edgeLengths = SiteGeometryEngine.getEdgeLengths(pts);
        const roadFrontages = Array.isArray(site.roadFrontages)
            ? site.roadFrontages
            : [site.roadFrontageIndex !== undefined ? site.roadFrontageIndex : 0];

        for (let i = 0; i < pts.length; i++) {
            const pA = pts[i];
            const pB = pts[(i + 1) % pts.length];
            const lengthUnits = edgeLengths[i];
            const lengthFt = Math.round(SiteGeometryEngine.unitsToFt(lengthUnits) * 10) / 10;

            const midX = (pA.x + pB.x) / 2;
            const midY = (pA.y + pB.y) / 2;

            // Compute outward normal offset
            const dx = pB.x - pA.x;
            const dy = pB.y - pA.y;
            const len = Math.hypot(dx, dy) || 1;
            const normX = -dy / len;
            const normY = dx / len;

            const offsetDist = 22; // px offset outside plot
            const labelX = midX + normX * offsetDist;
            const labelY = midY + normY * offsetDist;

            const isRoad = roadFrontages.includes(i);
            const labelStr = isRoad 
                ? `ROAD: ${lengthFt}'` 
                : `${lengthFt}'`;

            const labelTag = new Konva.Text({
                x: labelX - 75,
                y: labelY - 8,
                width: 150,
                text: labelStr,
                fontSize: 11,
                fontFamily: 'monospace, sans-serif',
                fontStyle: isRoad ? 'bold' : 'normal',
                fill: isRoad ? '#2563eb' : '#475569',
                align: 'center',
                listening: false
            });
            group.add(labelTag);
        }

        // 4. Corner Deflection Angle Badges & Corner Pins
        const angles = SiteGeometryEngine.getCornerAngles(pts);
        pts.forEach((p, idx) => {
            // Corner Pin
            const pin = new Konva.Circle({
                x: p.x,
                y: p.y,
                radius: 4.5,
                fill: '#ffffff',
                stroke: '#1e293b',
                strokeWidth: 2,
                listening: false
            });
            group.add(pin);

            // Angle Callout
            const angleDeg = angles[idx];
            if (angleDeg !== undefined) {
                const angleText = new Konva.Text({
                    x: p.x + 8,
                    y: p.y + 8,
                    text: `${angleDeg}°`,
                    fontSize: 10,
                    fontStyle: 'bold',
                    fill: '#64748b',
                    listening: false
                });
                group.add(angleText);
            }
        });

        planner.siteLayer.add(group);
        this._redraw(planner);
    }
}
