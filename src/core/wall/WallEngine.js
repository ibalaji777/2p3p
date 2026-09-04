/**
 * WallEngine.js
 * 
 * THE SINGLE AUTHORITATIVE PUBLIC FAÇADE FOR THE WALL SYSTEM.
 * 
 * Orchestrates:
 * - Canonical Wall State (planner.walls[])
 * - Canonical Geometry (WallGeometryEngine)
 * - Canonical Topology (WallTopologyEngine)
 * - Canonical Mutations (WallMutationEngine)
 * - 2D & 3D Synchronization
 */

import { WallGeometryEngine } from './WallGeometryEngine.js';
import { WallTopologyEngine } from './WallTopologyEngine.js';
import { WallMutationEngine } from './WallMutationEngine.js';

export class WallEngine {
    // ==========================================
    // 1. GEOMETRY AUTHORITY
    // ==========================================

    static getLength(wall) {
        return WallGeometryEngine.getLength(wall);
    }

    static getDirection(wall) {
        return WallGeometryEngine.getDirection(wall);
    }

    static getAngle(wall) {
        return WallGeometryEngine.getAngle(wall);
    }

    static getNormal(wall) {
        return WallGeometryEngine.getNormal(wall);
    }

    static getCenterline(wall) {
        return WallGeometryEngine.getCenterline(wall);
    }

    static getCorners(wall, anchor, isStart, allWalls) {
        return WallGeometryEngine.getCorners(wall, anchor, isStart, allWalls);
    }

    static getExactPolygonPoints(wall, allWalls) {
        return WallGeometryEngine.getExactPolygonPoints(wall, allWalls);
    }

    static getTopProfile(wall) {
        return WallGeometryEngine.getTopProfile(wall);
    }

    static getApertureVoids(wall) {
        return WallGeometryEngine.getApertureVoids(wall);
    }

    /**
     * Recalculates and caches canonical geometry results onto a wall entity.
     * @param {Object} wall 
     * @param {Array<Object>} allWalls 
     */
    static recalculateGeometry(wall, allWalls = []) {
        if (!wall) return;
        const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor || { x: wall.startX, y: wall.startY });
        const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor || { x: wall.endX, y: wall.endY });
        const length = WallGeometryEngine.getLength(wall);
        if (length === 0) return;

        const startData = WallGeometryEngine.getCorners(wall, wall.startAnchor, true, allWalls);
        const endData = WallGeometryEngine.getCorners(wall, wall.endAnchor, false, allWalls);

        const startCorners = startData.corners;
        const endCorners = endData.corners;

        const startL = { x: startCorners[0].x, y: startCorners[0].y };
        const startR = { x: startCorners[1].x, y: startCorners[1].y };
        const endL = { x: endCorners[0].x, y: endCorners[0].y };
        const endR = { x: endCorners[1].x, y: endCorners[1].y };

        const startProfile = [startR, startData.bevelR, startData.bevelL, startL].filter(Boolean);
        const endProfile = [endR, endData.bevelR, endData.bevelL, endL].filter(Boolean);

        const startTrue = startData.trueCorners || startData.corners;
        const endTrue = endData.trueCorners || endData.corners;

        const frontVerts = [{ x: startL.x, y: startL.y }];
        const backVerts = [{ x: endR.x, y: endR.y }];

        const protrusions = (wall.attachedWidgets || []).filter(w => (w.type === 'solid_protrusion' || w.configId === 'solid_protrusion' || w.type?.includes('protrusion') || w.configId?.includes('protrusion')));
        const n = WallGeometryEngine.getNormal(wall);
        const halfThick = (Number(wall.thickness) || Number(wall.config?.thickness) || 20) / 2;
        const p1L = { x: p1.x + n.x * halfThick, y: p1.y + n.y * halfThick };
        const p2L = { x: p2.x + n.x * halfThick, y: p2.y + n.y * halfThick };
        const p1R = { x: p1.x - n.x * halfThick, y: p1.y - n.y * halfThick };
        const p2R = { x: p2.x - n.x * halfThick, y: p2.y - n.y * halfThick };

        if (protrusions.length > 0 && length > 1) {
            const isBackFacing = (p) => (p.facing === -1 || p.facing === 'back' || p.side === 'right');
            const frontProtrusions = protrusions.filter(p => !isBackFacing(p)).sort((a, b) => (a.t || 0.5) - (b.t || 0.5));
            const backProtrusions = protrusions.filter(p => isBackFacing(p)).sort((a, b) => (b.t || 0.5) - (a.t || 0.5));

            // Front edge protrusions (+n)
            frontProtrusions.forEach(p => {
                const halfSpan = Math.min(0.49, (p.width || 40) / (2 * length));
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const t1 = Math.max(0.001, tCenter - halfSpan);
                const t2 = Math.min(0.999, tCenter + halfSpan);
                const d = Math.abs(Number(p.depth) || 10);

                const ptA = {
                    x: p1L.x + t1 * (p2L.x - p1L.x),
                    y: p1L.y + t1 * (p2L.y - p1L.y)
                };
                const ptA_out = { x: ptA.x + n.x * d, y: ptA.y + n.y * d };
                const ptB = {
                    x: p1L.x + t2 * (p2L.x - p1L.x),
                    y: p1L.y + t2 * (p2L.y - p1L.y)
                };
                const ptB_out = { x: ptB.x + n.x * d, y: ptB.y + n.y * d };

                frontVerts.push(ptA, ptA_out, ptB_out, ptB);
            });

            // Back edge protrusions (-n)
            backProtrusions.forEach(p => {
                const halfSpan = Math.min(0.49, (p.width || 40) / (2 * length));
                const tCenter = p.t !== undefined ? p.t : 0.5;
                const t1 = Math.max(0.001, tCenter - halfSpan);
                const t2 = Math.min(0.999, tCenter + halfSpan);
                const d = Math.abs(Number(p.depth) || 10);

                const ptB = {
                    x: p1R.x + t2 * (p2R.x - p1R.x),
                    y: p1R.y + t2 * (p2R.y - p1R.y)
                };
                const ptB_out = { x: ptB.x - n.x * d, y: ptB.y - n.y * d };
                const ptA = {
                    x: p1R.x + t1 * (p2R.x - p1R.x),
                    y: p1R.y + t1 * (p2R.y - p1R.y)
                };
                const ptA_out = { x: ptA.x - n.x * d, y: ptA.y - n.y * d };

                backVerts.push(ptB, ptB_out, ptA_out, ptA);
            });
        }

        frontVerts.push({ x: endL.x, y: endL.y });
        backVerts.push({ x: startR.x, y: startR.y });

        wall.wallShapeData = {
            startL, endL, endR, startR,
            hasStartCap: startData.hasCap,
            hasEndCap: endData.hasCap,
            startData, endData,
            startProfile, endProfile,
            frontVerts, backVerts
        };

        return wall.wallShapeData;
    }

    // ==========================================
    // 2. TOPOLOGY AUTHORITY
    // ==========================================

    static createWall(planner, options) {
        return WallTopologyEngine.createWall(planner, options);
    }

    static createRoomBox(planner, bounds) {
        return WallTopologyEngine.createRoomBox(planner, bounds);
    }

    static splitWall(planner, wall, splitPoint) {
        return WallTopologyEngine.splitWall(planner, wall, splitPoint);
    }

    static mergeWalls(planner, wall1, wall2) {
        return WallTopologyEngine.mergeWalls(planner, wall1, wall2);
    }

    static deleteWall(planner, wall) {
        return WallTopologyEngine.deleteWall(planner, wall);
    }

    static reformAndAddWallSegments(planner, inputSegments, wallType, wallConfig) {
        return WallTopologyEngine.reformAndAddWallSegments(planner, inputSegments, wallType, wallConfig);
    }

    static extrudeWallSegment(planner, wall, tStart, tEnd, depth) {
        return WallTopologyEngine.extrudeWallSegment(planner, wall, tStart, tEnd, depth);
    }

    // ==========================================
    // 3. MUTATION AUTHORITY
    // ==========================================

    static setThickness(wall, thickness, shouldSync = true, planner = null) {
        WallMutationEngine.setThickness(wall, thickness, shouldSync, planner);
    }

    static setHeight(wall, height, shouldSync = true, planner = null) {
        WallMutationEngine.setHeight(wall, height, shouldSync, planner);
    }

    static setElevation(wall, elevation, shouldSync = true, planner = null) {
        WallMutationEngine.setElevation(wall, elevation, shouldSync, planner);
    }

    static setEndpoints(wall, startPos, endPos, shouldSync = true, planner = null) {
        WallMutationEngine.setEndpoints(wall, startPos, endPos, shouldSync, planner);
    }

    static setTopProfile(wall, profileType, options = {}, shouldSync = true, planner = null) {
        WallMutationEngine.setTopProfile(wall, profileType, options, shouldSync, planner);
    }

    static applyMaterial(wall, options = {}, planner = null) {
        WallMutationEngine.applyMaterial(wall, options, planner);
    }

    static moveWall(wall, dx, dy, shouldSync = true, planner = null) {
        WallMutationEngine.moveWall(wall, dx, dy, shouldSync, planner);
    }

    static moveAnchor(anchor, newPosition, planner = null, shouldSync = true) {
        WallMutationEngine.moveAnchor(anchor, newPosition, planner, shouldSync);
    }

    static push(wall, side, distance, options = {}, planner = null) {
        WallMutationEngine.push(wall, side, distance, options, planner);
    }

    static pull(wall, side, distance, options = {}, planner = null) {
        WallMutationEngine.pull(wall, side, distance, options, planner);
    }

    static pushPull(wall, side, distance, options = {}, planner = null) {
        WallMutationEngine.pushPull(wall, side, distance, options, planner);
    }

    static batchUpdate(planner, walls, updates) {
        WallMutationEngine.batchUpdate(planner, walls, updates);
    }

    static attachWidget(wall, widget, shouldSync = true, planner = null) {
        WallMutationEngine.attachWidget(wall, widget, shouldSync, planner);
    }

    static removeWidget(wall, widgetOrId, shouldSync = true, planner = null) {
        WallMutationEngine.removeWidget(wall, widgetOrId, shouldSync, planner);
    }

    static attachMolding(wall, molding, shouldSync = true, planner = null) {
        WallMutationEngine.attachMolding(wall, molding, shouldSync, planner);
    }

    static removeMolding(wall, moldingOrId, shouldSync = true, planner = null) {
        WallMutationEngine.removeMolding(wall, moldingOrId, shouldSync, planner);
    }

    static addSolidProtrusion(wall, options = {}, shouldSync = true, planner = null) {
        return WallMutationEngine.addSolidProtrusion(wall, options, shouldSync, planner);
    }

    static updateSolidProtrusion(wall, protrusionOrId, updates = {}, shouldSync = true, planner = null) {
        return WallMutationEngine.updateSolidProtrusion(wall, protrusionOrId, updates, shouldSync, planner);
    }

    static removeSolidProtrusion(wall, protrusionOrId, shouldSync = true, planner = null) {
        return WallMutationEngine.removeSolidProtrusion(wall, protrusionOrId, shouldSync, planner);
    }

    // ==========================================
    // 4. SYNCHRONIZATION & INVALIDATION
    // ==========================================

    /**
     * Canonical synchronization for the wall system and all attached entities.
     * @param {Object} planner 
     */
    static sync(planner) {
        if (!planner) return;
        const allWalls = planner.walls || [];

        // 1. Recalculate canonical geometry across all walls
        allWalls.forEach(w => {
            if (typeof w.update === 'function') {
                w.update();
            } else {
                this.recalculateGeometry(w, allWalls);
            }
        });

        // 2. Synchronize attached entities
        if (planner.furniture) planner.furniture.forEach(f => f.update && f.update());
        if (planner.stairs) planner.stairs.forEach(s => s.update && s.update());
        if (planner.roofs) planner.roofs.forEach(r => r.update && r.update());
        if (planner.balconies) planner.balconies.forEach(b => b.update && b.update());
        if (planner.arcs) planner.arcs.forEach(a => a.update && a.update());
        if (planner.shapes) planner.shapes.forEach(s => s.update && s.update());

        // 3. Redraw 2D layers
        if (planner.mainLayer) planner.mainLayer.batchDraw();
        if (planner.uiLayer) planner.uiLayer.batchDraw();

        // 4. Invalidate 3D on demand
        if (planner.update3D) planner.update3D();
    }
}
