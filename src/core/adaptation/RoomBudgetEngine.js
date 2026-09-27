/**
 * src/core/adaptation/RoomBudgetEngine.js
 * 
 * Manages spatial budgeting, minimum room dimensions, and door/window
 * clearance verification during building adaptation.
 */

import { DesignIntentAnalyzer } from './DesignIntentAnalyzer.js';
import { SiteGeometryEngine } from '../site/SiteGeometryEngine.js';

export class RoomBudgetEngine {
    /**
     * Standard minimum architectural dimensions in world units (20 units = 1 ft).
     */
    static MIN_DIMENSIONS_UNITS = {
        LIVING: 180,            // 9 ft (180 world units = 274.32 cm)
        BEDROOM_PRIMARY: 180,   // 9 ft (180 world units = 274.32 cm)
        BEDROOM_SECONDARY: 160, // 8 ft (160 world units = 243.84 cm)
        KITCHEN: 120,           // 6 ft (120 world units = 182.88 cm)
        BATHROOM: 80,           // 4 ft (80 world units = 121.92 cm)
        CORRIDOR: 60,           // 3 ft (60 world units = 91.44 cm)
        GENERIC_ROOM: 140       // 7 ft (140 world units = 213.36 cm)
    };

    /**
     * Standard minimum architectural dimensions in centimeters (for display/metric conversion).
     */
    static MIN_DIMENSIONS = {
        LIVING: 274.32,
        BEDROOM_PRIMARY: 274.32,
        BEDROOM_SECONDARY: 243.84,
        KITCHEN: 182.88,
        BATHROOM: 121.92,
        CORRIDOR: 91.44,
        GENERIC_ROOM: 213.36
    };

    /**
     * Returns the minimum permitted dimension for a room by name in world units (20 units = 1 ft).
     * @param {string} roomName 
     * @returns {number} Minimum width in world units
     */
    static getMinRoomDimensionUnits(roomName = '') {
        const name = (roomName || '').toLowerCase();
        if (name.includes('living') || name.includes('master') || name.includes('hall')) {
            return this.MIN_DIMENSIONS_UNITS.LIVING;
        }
        if (name.includes('bed')) {
            return this.MIN_DIMENSIONS_UNITS.BEDROOM_SECONDARY;
        }
        if (name.includes('kitchen') || name.includes('dining')) {
            return this.MIN_DIMENSIONS_UNITS.KITCHEN;
        }
        if (name.includes('bath') || name.includes('toilet') || name.includes('powder') || name.includes('wc')) {
            return this.MIN_DIMENSIONS_UNITS.BATHROOM;
        }
        if (name.includes('corridor') || name.includes('passage') || name.includes('entry') || name.includes('foyer')) {
            return this.MIN_DIMENSIONS_UNITS.CORRIDOR;
        }
        return this.MIN_DIMENSIONS_UNITS.GENERIC_ROOM;
    }

    /**
     * Backward-compatibility helper returning cm.
     * @param {string} roomName 
     * @returns {number} Minimum width in cm
     */
    static getMinRoomDimension(roomName = '') {
        const units = this.getMinRoomDimensionUnits(roomName);
        return SiteGeometryEngine.unitsToCm(units);
    }

    /**
     * Evaluates room dimensions across the plan and identifies any violations.
     * Operates strictly in canonical world units (20 units = 1 ft).
     * 
     * @param {Array<Object>} rooms 
     * @param {Function} [transformFn=null] - Optional point transformer to test prospective dimensions
     * @returns {{ valid: boolean, warnings: Array<string>, roomReports: Array<Object> }}
     */
    static auditRoomDimensions(rooms = [], transformFn = null) {
        const warnings = [];
        const roomReports = [];

        rooms.forEach((r, idx) => {
            const rawPath = r.path || [];
            if (rawPath.length < 3) return;

            const path = transformFn ? rawPath.map(p => transformFn(p)) : rawPath;

            // Compute AABB of room in world units
            const xs = path.map(p => p.x);
            const ys = path.map(p => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            const width = maxX - minX;
            const depth = maxY - minY;
            const minSide = Math.min(width, depth);
            const areaUnits2 = SiteGeometryEngine.getArea(path);
            const areaSqFt = SiteGeometryEngine.units2ToSqFt(areaUnits2);

            const roomName = r.name || `Room ${idx + 1}`;
            const requiredMinUnits = this.getMinRoomDimensionUnits(roomName);
            const requiredMinFt = SiteGeometryEngine.unitsToFt(requiredMinUnits);
            const minSideFt = SiteGeometryEngine.unitsToFt(minSide);

            const isBelowMin = minSide < (requiredMinUnits - 0.5);
            if (isBelowMin) {
                warnings.push(
                    `Room "${roomName}" width (${minSideFt.toFixed(1)} ft / ${Math.round(minSide)} units) falls below architectural standard minimum (${requiredMinFt.toFixed(1)} ft / ${requiredMinUnits} units).`
                );
            }

            roomReports.push({
                room: r,
                name: roomName,
                width: Math.round(width),
                depth: Math.round(depth),
                widthFt: Math.round(SiteGeometryEngine.unitsToFt(width) * 10) / 10,
                depthFt: Math.round(SiteGeometryEngine.unitsToFt(depth) * 10) / 10,
                areaSqFt: Math.round(areaSqFt * 10) / 10,
                requiredMinUnits,
                requiredMinFt,
                valid: !isBelowMin
            });
        });

        return {
            valid: warnings.length === 0,
            warnings,
            roomReports
        };
    }

    /**
     * Audits all attached doors and windows against updated wall lengths.
     * Computes safe clamped t coordinates to prevent miter collision.
     * 
     * @param {Array<Object>} walls 
     * @param {Function} [transformFn=null] 
     * @param {number} [minClearance=10] - Minimum end clearance in world units (10 units = 0.5 ft)
     * @returns {{ valid: boolean, warnings: Array<string>, widgetAdjustments: Map<Object, { t: number, previousT: number }> }}
     */
    static auditOpenings(walls = [], transformFn = null, minClearance = 10) {
        const warnings = [];
        const widgetAdjustments = new Map();

        walls.forEach(w => {
            if (!w.widgets || !Array.isArray(w.widgets) || w.widgets.length === 0) return;

            const startPos = w.startAnchor?.position ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
            const endPos = w.endAnchor?.position ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });

            const newStart = transformFn ? transformFn(startPos) : startPos;
            const newEnd = transformFn ? transformFn(endPos) : endPos;

            const newLength = Math.hypot(newEnd.x - newStart.x, newEnd.y - newStart.y);

            w.widgets.forEach(widget => {
                const width = Number(widget.width) || 60; // 60 world units = 3 ft standard door
                const currentT = Number(widget.t) !== undefined ? Number(widget.t) : 0.5;

                const clearanceCheck = DesignIntentAnalyzer.calculateSafeOpeningT(
                    newLength,
                    width,
                    currentT,
                    minClearance
                );

                if (!clearanceCheck.fits) {
                    const lenFt = SiteGeometryEngine.unitsToFt(newLength);
                    warnings.push(
                        `Wall length (${lenFt.toFixed(1)} ft / ${Math.round(newLength)} units) is too short to host opening "${widget.type || 'door'}" (${width} units + clearances).`
                    );
                }

                if (Math.abs(clearanceCheck.clampedT - currentT) > 0.001) {
                    widgetAdjustments.set(widget, {
                        t: clearanceCheck.clampedT,
                        previousT: currentT
                    });
                }
            });
        });

        return {
            valid: warnings.length === 0,
            warnings,
            widgetAdjustments
        };
    }

    /**
     * Audits existing staircases to ensure target room dimensions still accommodate
     * stair flight footprint and landing clearances.
     * 
     * @param {Array<Object>} stairs 
     * @param {Array<Object>} rooms 
     * @param {Function} [transformFn=null] 
     * @returns {{ valid: boolean, warnings: Array<string> }}
     */
    static auditStairs(stairs = [], rooms = [], transformFn = null) {
        const warnings = [];
        if (!stairs || stairs.length === 0) return { valid: true, warnings };

        stairs.forEach((s, idx) => {
            const stairWidth = Number(s.width) || 60; // 60 units = 3 ft flight width
            const totalSteps = Number(s.totalSteps) || Number(s.stepCount) || 14;
            const stepDepth = Number(s.stepDepth) || 20; // 20 units = 10 inches
            const flightLength = totalSteps * stepDepth;

            // Required stair bounding area in world units²
            const minStairAreaUnits2 = stairWidth * (flightLength + 60); // include 3 ft landing clearance
            const minStairAreaSqFt = SiteGeometryEngine.units2ToSqFt(minStairAreaUnits2);

            // If stair is inside a specific room, check that transformed room area accommodates stair
            if (rooms && rooms.length > 0 && s.group && typeof s.group.position === 'function') {
                const pos = s.group.position();
                const transformedPos = transformFn ? transformFn(pos) : pos;

                const hostRoom = rooms.find(r => {
                    const path = transformFn && r.path ? r.path.map(p => transformFn(p)) : (r.path || []);
                    return SiteGeometryEngine.isPointInsidePolygon(transformedPos, path);
                });

                if (hostRoom && hostRoom.path && hostRoom.path.length >= 3) {
                    const hostPath = transformFn ? hostRoom.path.map(p => transformFn(p)) : hostRoom.path;
                    const roomArea = SiteGeometryEngine.getArea(hostPath);
                    const roomAreaSqFt = SiteGeometryEngine.units2ToSqFt(roomArea);

                    if (roomAreaSqFt < minStairAreaSqFt) {
                        warnings.push(
                            `Room "${hostRoom.name || 'Stair Hall'}" area (${roomAreaSqFt.toFixed(1)} sq ft) is too small to accommodate stair flight (${minStairAreaSqFt.toFixed(1)} sq ft required).`
                        );
                    }
                }
            }
        });

        return {
            valid: warnings.length === 0,
            warnings
        };
    }
}
