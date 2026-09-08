/**
 * StairGeometryEngine.js
 * 
 * Single source of truth for all staircase mathematical geometry, 2D footprint polygons,
 * 3D aperture cutout polygons, step metrics, and IRC/IBC ergonomic calculations.
 */

export class StairGeometryEngine {
    /**
     * Computes the 2D aperture cutout polygon for a staircase in world space.
     * Used across 2D reference floors, active floor slabs, and static multi-level slabs.
     * 
     * @param {Object} stair - Stair entity or serialized data
     * @returns {Array<{x: number, y: number}>} Array of world-space points
     */
    static getCutoutPolygon(stair) {
        if (!stair) return [];

        const width = Number(stair.width) || 100;
        const sd = Number(stair.stepDepth) || 28;
        const l1 = stair.flight1Steps !== undefined ? Number(stair.flight1Steps) * sd : (Number(stair.length1) || 200);
        const l2 = stair.flight2Steps !== undefined ? Number(stair.flight2Steps) * sd : (Number(stair.length2) || 200);
        const ls = stair.landingSize !== undefined ? Number(stair.landingSize) : width;
        const gw = Number(stair.gapWidth) || 20;
        const turn = stair.turnDirection || stair.turnDir || (stair.config && stair.config.turnDirection) || 'right';
        
        let shape = stair.shape;
        if (!shape && stair.type) {
            const clean = stair.type.replace('stair_v5_', '').replace('stair_v4_', '');
            shape = (clean === 'staircase' || clean === 'flight') ? 'straight' : clean;
        }
        if (!shape) shape = (stair.config && stair.config.type) || 'straight';
        if (shape === 'flight') shape = 'straight';

        let stairPts = [];

        if (stair.type === 'stair_v4_landing' || shape === 'landing') {
            const landingLen = Number(stair.length) || Number(stair.landingSize) || width;
            stairPts = [
                { x: -width / 2, y: 0 },
                { x: width / 2, y: 0 },
                { x: width / 2, y: landingLen },
                { x: -width / 2, y: landingLen }
            ];
        } else if (shape === 'straight') {
            const totalSteps = Number(stair.totalSteps) || Number(stair.flight1Steps) || Number(stair.stepCount) || 12;
            const totalL = totalSteps * sd;
            let y = 0;
            let totalLen = totalL;
            if (stair.hasTopLanding) {
                y -= ls;
                totalLen += ls;
            }
            if (stair.hasBottomLanding) {
                totalLen += ls;
            }
            stairPts = [
                { x: -width / 2, y: y },
                { x: width / 2, y: y },
                { x: width / 2, y: y + totalLen },
                { x: -width / 2, y: y + totalLen }
            ];
        } else if (shape === 'L') {
            let y = 0;
            let f1Len = l1;
            if (stair.hasTopLanding) {
                y -= ls;
                f1Len += ls;
            }
            const f2X = turn === 'right' ? -width / 2 : -width / 2 - l2;
            const f2Len = l2 + width + (stair.hasBottomLanding ? ls : 0);
            const f2Start = f2X - (stair.hasBottomLanding && turn !== 'right' ? ls : 0);

            if (turn === 'right') {
                stairPts = [
                    { x: -width / 2, y: y },
                    { x: width / 2, y: y },
                    { x: width / 2, y: l1 },
                    { x: f2Start + f2Len, y: l1 },
                    { x: f2Start + f2Len, y: l1 + width },
                    { x: -width / 2, y: l1 + width }
                ];
            } else {
                stairPts = [
                    { x: -width / 2, y: y },
                    { x: width / 2, y: y },
                    { x: width / 2, y: l1 + width },
                    { x: f2Start, y: l1 + width },
                    { x: f2Start, y: l1 },
                    { x: -width / 2, y: l1 }
                ];
            }
        } else if (shape === 'U') {
            let y = 0;
            let f1Len = l1;
            if (stair.hasTopLanding) {
                y -= ls;
                f1Len += ls;
            }
            const f2Y = l1 - l2 - (stair.hasBottomLanding ? ls : 0);
            const landingY = l1 + ls;

            if (turn === 'right') {
                stairPts = [
                    { x: -width / 2, y: y },
                    { x: width / 2, y: y },
                    { x: width / 2, y: f2Y },
                    { x: width / 2 + gw + width, y: f2Y },
                    { x: width / 2 + gw + width, y: landingY },
                    { x: -width / 2, y: landingY }
                ];
            } else {
                stairPts = [
                    { x: -width / 2, y: y },
                    { x: width / 2, y: y },
                    { x: width / 2, y: landingY },
                    { x: -width / 2 - width - gw, y: landingY },
                    { x: -width / 2 - width - gw, y: f2Y },
                    { x: -width / 2, y: f2Y }
                ];
            }
        } else if (shape === 'T') {
            let y = 0;
            let f1Len = l1;
            if (stair.hasTopLanding) {
                y -= ls;
                f1Len += ls;
            }
            const leftBranchX = -width / 2 - l2 - (stair.hasBottomLanding ? ls : 0);
            const rightBranchX = width / 2 + l2 + (stair.hasBottomLanding ? ls : 0);
            const landingY = l1 + ls;

            stairPts = [
                { x: -width / 2, y: y },
                { x: width / 2, y: y },
                { x: width / 2, y: l1 },
                { x: rightBranchX, y: l1 },
                { x: rightBranchX, y: landingY },
                { x: leftBranchX, y: landingY },
                { x: leftBranchX, y: l1 },
                { x: -width / 2, y: l1 }
            ];
        }

        if (stairPts.length === 0) return [];

        const rot = ((stair.group && typeof stair.group.rotation === 'function')
            ? stair.group.rotation()
            : (Number(stair.rotation) || 0)) * Math.PI / 180;

        const sx = (stair.group && typeof stair.group.x === 'function')
            ? stair.group.x()
            : (Number(stair.x) || 0);

        const sy = (stair.group && typeof stair.group.y === 'function')
            ? stair.group.y()
            : (Number(stair.y) || 0);

        return stairPts.map(p => ({
            x: sx + (p.x * Math.cos(rot) - p.y * Math.sin(rot)),
            y: sy + (p.x * Math.sin(rot) + p.y * Math.cos(rot))
        }));
    }

    /**
     * Calculates the bounding box of the staircase in local coordinates.
     * @param {Object} stair 
     * @returns {{minX: number, minY: number, maxX: number, maxY: number, width: number, length: number}}
     */
    static getLocalBounds(stair) {
        const width = Number(stair.width) || 100;
        const sd = Number(stair.stepDepth) || 28;
        const shape = (stair.shape || 'straight').toString();
        const f1 = Number(stair.flight1Steps) || (shape === 'straight' ? (Number(stair.totalSteps) || 12) : 8);
        const f2 = Number(stair.flight2Steps) || (shape === 'straight' ? 0 : 7);
        const ls = Number(stair.landingSize) || width;
        const gw = Number(stair.gapWidth) || 20;
        const turn = stair.turnDirection || 'right';

        let minX = -width / 2;
        let maxX = width / 2;
        let minY = 0;
        let maxY = f1 * sd;

        if (stair.hasTopLanding) minY -= ls;

        if (shape === 'straight') {
            if (stair.hasBottomLanding) maxY += ls;
        } else if (shape === 'L') {
            maxY += width;
            if (turn === 'right') {
                maxX = width / 2 + f2 * sd + (stair.hasBottomLanding ? ls : 0);
            } else {
                minX = -width / 2 - f2 * sd - (stair.hasBottomLanding ? ls : 0);
            }
        } else if (shape === 'U') {
            maxY = f1 * sd + ls;
            if (turn === 'right') {
                maxX = width / 2 + gw + width;
            } else {
                minX = -width / 2 - gw - width;
            }
        } else if (shape === 'T') {
            maxY = f1 * sd + ls;
            minX = -width / 2 - f2 * sd - (stair.hasBottomLanding ? ls : 0);
            maxX = width / 2 + f2 * sd + (stair.hasBottomLanding ? ls : 0);
        }

        return {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX,
            length: maxY - minY
        };
    }

    /**
     * Computes the ergonomic IRC/IBC step and riser distribution for a given height and shape.
     * 
     * @param {number} totalHeight - Total height in cm
     * @param {string} [shape='straight'] - 'straight', 'L', 'U', or 'T'
     * @returns {{totalSteps: number, flight1Steps: number, flight2Steps: number, stepHeight: number}}
     */
    static calculateOptimalSteps(totalHeight, shape = 'straight') {
        const h = Math.max(15, Math.min(600, Number(totalHeight) || 300));
        const TARGET_RISER = 17.5; // cm

        let totalSteps;
        if (h <= 25) {
            totalSteps = 1;
        } else if (h <= 42) {
            totalSteps = 2;
        } else if (h <= 60) {
            totalSteps = 3;
        } else {
            totalSteps = Math.max(1, Math.min(40, Math.round(h / TARGET_RISER)));
        }

        const stepHeight = Number((h / totalSteps).toFixed(2));

        let flight1Steps = totalSteps;
        let flight2Steps = 0;

        if (shape === 'L' || shape === 'U' || shape === 'T') {
            flight1Steps = Math.max(1, Math.ceil(totalSteps / 2));
            flight2Steps = Math.max(1, totalSteps - flight1Steps);
            totalSteps = flight1Steps + flight2Steps;
        }

        return {
            totalSteps,
            flight1Steps,
            flight2Steps,
            stepHeight
        };
    }

    /**
     * Returns key metric calculations for a staircase entity.
     * 
     * @param {Object} stair 
     * @returns {Object}
     */
    static getStepMetrics(stair) {
        const height = Number(stair.height) || 300;
        const shape = (stair.shape || 'straight').toString();
        const width = Number(stair.width) || 100;
        const stepDepth = Number(stair.stepDepth) || 28;
        
        let f1 = Number(stair.flight1Steps);
        let f2 = Number(stair.flight2Steps);
        if (shape === 'straight') {
            if (!f1) f1 = Number(stair.totalSteps) || 12;
            f2 = 0;
        } else {
            if (!f1) f1 = 8;
            if (!f2) f2 = 7;
        }

        const totalSteps = shape === 'straight' ? f1 : (f1 + f2);
        const stepHeight = totalSteps > 0 ? Number((height / totalSteps).toFixed(2)) : 17.5;

        return {
            shape,
            width,
            height,
            stepDepth,
            stepHeight,
            totalSteps,
            flight1Steps: f1,
            flight2Steps: f2,
            flight1Length: f1 * stepDepth,
            flight2Length: f2 * stepDepth,
            landingSize: Number(stair.landingSize) || width,
            gapWidth: Number(stair.gapWidth) || 20,
            treadThickness: 1.5,
            riserThickness: 1.5,
            nosing: 2.0
        };
    }
}
