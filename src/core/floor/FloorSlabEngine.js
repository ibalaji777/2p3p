/**
 * FloorSlabEngine.js
 * 
 * The Single Authoritative CAD/BIM Engine for Floor Slabs & Ceilings.
 * 
 * Orchestrates:
 * - Room contour shape construction
 * - Stair opening void subtractions (StairGeometryEngine)
 * - Ceiling / floor cutout void subtractions (shape_floor_cut)
 * - Parametric slab extrusion & elevation offsets (sub-structure plinth/foundation)
 * - World-space tri-planar UV projections
 * - PBR material application & caching
 */

import * as THREE from 'three';
import { StairEngine } from '../stairs/StairEngine.js';
import { FLOOR_REGISTRY } from '../registry.js';
import { MaterialFactory } from '../engine3d/MaterialFactory.js';

export class FloorSlabEngine {
    /**
     * Cleans polygon points by removing consecutive points closer than 0.5 units
     * and trimming duplicate closure points.
     * @param {Array<{x: number, y: number}>} p 
     * @returns {Array<{x: number, y: number}>}
     */
    static cleanPolygon(p) {
        if (!p || !Array.isArray(p) || p.length < 3) return [];
        const res = [];
        for (let i = 0; i < p.length; i++) {
            const pt = { x: Number(p[i].x) || 0, y: Number(p[i].y) || 0 };
            if (res.length === 0 || Math.hypot(pt.x - res[res.length - 1].x, pt.y - res[res.length - 1].y) > 0.5) {
                res.push(pt);
            }
        }
        if (res.length > 2 && Math.hypot(res[res.length - 1].x - res[0].x, res[res.length - 1].y - res[0].y) < 0.5) {
            res.pop();
        }
        return res;
    }

    /**
     * Calculates the absolute 2D area of a polygon.
     * @param {Array<{x: number, y: number}>} p 
     * @returns {number}
     */
    static getPolygonArea(p) {
        if (!p || p.length < 3) return 0;
        let a = 0;
        for (let i = 0; i < p.length; i++) {
            const next = p[(i + 1) % p.length];
            a += (p[i].x * next.y - next.x * p[i].y);
        }
        return Math.abs(a / 2);
    }

    /**
     * Raycasting 2D point-in-polygon test.
     * @param {{x: number, y: number}} p 
     * @param {Array<{x: number, y: number}>} poly 
     * @returns {boolean}
     */
    static isPointInsidePolygon(p, poly) {
        if (!p || !poly || poly.length < 3) return false;
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            const xi = poly[i].x, yi = poly[i].y;
            const xj = poly[j].x, yj = poly[j].y;
            const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }

    /**
     * Auto-hole carving for interior rooms contained inside an outer courtyard / compound floor.
     * @param {Object} room - The host room
     * @param {Array<Object>} allRooms - All rooms in the level
     * @returns {Array<THREE.Path>}
     */
    static extractCourtyardHoles(room, allRooms = []) {
        const holes = [];
        if (!room || !allRooms || !Array.isArray(allRooms) || allRooms.length <= 1) return holes;

        const cleanPath = this.cleanPolygon(room.path);
        if (cleanPath.length < 3) return holes;
        const areaSelf = this.getPolygonArea(cleanPath);
        if (areaSelf <= 0) return holes;

        const roomElev = Number(room.elevation) || 0;

        allRooms.forEach(otherRoom => {
            if (!otherRoom || otherRoom === room || otherRoom.isDeleted || otherRoom.isHidden) return;
            const otherElev = Number(otherRoom.elevation) || 0;
            if (Math.abs(roomElev - otherElev) >= 5) return;

            const otherClean = this.cleanPolygon(otherRoom.path);
            if (otherClean.length < 3) return;

            const areaOther = this.getPolygonArea(otherClean);
            // If other room is smaller and its center is inside our polygon, it is an enclosed courtyard/room
            if (areaOther < areaSelf * 0.98) {
                let cx = 0, cy = 0;
                otherClean.forEach(p => { cx += p.x; cy += p.y; });
                cx /= otherClean.length;
                cy /= otherClean.length;

                if (this.isPointInsidePolygon({ x: cx, y: cy }, cleanPath)) {
                    // THREE.Shape holes MUST be Clockwise (CW)
                    const isHoleCW = THREE.ShapeUtils.isClockWise(otherClean);
                    const holePts = isHoleCW ? otherClean : [...otherClean].reverse();

                    const hole = new THREE.Path();
                    hole.moveTo(holePts[0].x, holePts[0].y);
                    for (let i = 1; i < holePts.length; i++) {
                        hole.lineTo(holePts[i].x, holePts[i].y);
                    }
                    hole.closePath();
                    holes.push(hole);
                }
            }
        });

        return holes;
    }

    /**
     * Extracts stair opening hole paths from stairs on the level below.
     * @param {Array} stairsBelow 
     * @returns {Array<THREE.Path>}
     */
    static extractStairHoles(stairsBelow = []) {
        const holes = [];
        if (!stairsBelow || !Array.isArray(stairsBelow)) return holes;

        stairsBelow.forEach(stair => {
            const rotPts = StairEngine.getCutoutPolygon(stair);
            if (rotPts && rotPts.length >= 3) {
                const holeIsCW = THREE.ShapeUtils.isClockWise(rotPts);
                const finalPts = holeIsCW ? rotPts : [...rotPts].reverse();

                const hole = new THREE.Path();
                hole.moveTo(finalPts[0].x, finalPts[0].y);
                for (let i = 1; i < finalPts.length; i++) {
                    hole.lineTo(finalPts[i].x, finalPts[i].y);
                }
                hole.closePath();
                holes.push(hole);
            }
        });
        return holes;
    }

    /**
     * Extracts floor/ceiling cutout hole paths from shapes in the scene.
     * Respects bounding-box overlap and elevation match with the host room.
     * @param {Array} shapes 
     * @param {Array<{x: number, y: number}>|null} roomPath
     * @param {number} roomElevation
     * @returns {Array<THREE.Path>}
     */
    static extractCutoutHoles(shapes = [], roomPath = null, roomElevation = 0) {
        const holes = [];
        if (!shapes || !Array.isArray(shapes)) return holes;

        let cleanRoomPath = null;
        let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
        if (roomPath && roomPath.length >= 3) {
            cleanRoomPath = this.cleanPolygon(roomPath);
            cleanRoomPath.forEach(p => {
                if (p.x < minRx) minRx = p.x; if (p.x > maxRx) maxRx = p.x;
                if (p.y < minRy) minRy = p.y; if (p.y > maxRy) maxRy = p.y;
            });
        }

        shapes.forEach(shape => {
            if (!shape || shape.type !== 'shape_floor_cut') return;

            // Elevation check if roomElevation context provided
            if (shape.elevation !== undefined && roomElevation !== undefined) {
                if (Math.abs(Number(shape.elevation) - Number(roomElevation)) >= 5) return;
            }

            const rot = (shape.rotation || (shape.group ? shape.group.rotation() : 0) || 0) * Math.PI / 180;
            const sx = shape.x || shape.params?.x || (shape.group ? shape.group.x() : 0) || 0;
            const sy = shape.y || shape.params?.y || (shape.group ? shape.group.y() : 0) || 0;
            let pts;
            if (shape.params?.points && shape.params.points.length >= 3) {
                pts = shape.params.points;
            } else if (shape.path && shape.path.length >= 3) {
                pts = shape.path;
            } else {
                const w = shape.params?.width || shape.width || 100;
                const h = shape.params?.height || shape.height || 100;
                pts = [
                    { x: -w / 2, y: -h / 2 }, { x: w / 2, y: -h / 2 },
                    { x: w / 2, y: h / 2 }, { x: -w / 2, y: h / 2 }
                ];
            }

            const rotC = pts.map(c => ({
                x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
            }));

            // Bounding overlap check with room if roomPath was provided
            if (cleanRoomPath) {
                let minHx = Infinity, maxHx = -Infinity, minHy = Infinity, maxHy = -Infinity;
                rotC.forEach(p => {
                    if (p.x < minHx) minHx = p.x; if (p.x > maxHx) maxHx = p.x;
                    if (p.y < minHy) minHy = p.y; if (p.y > maxHy) maxHy = p.y;
                });

                if (maxRx < minHx || minRx > maxHx || maxRy < minHy || minRy > maxHy) {
                    return; // No bounding overlap
                }
            }

            // THREE.Shape holes MUST be Clockwise (CW)
            const holeIsCW = THREE.ShapeUtils.isClockWise(rotC);
            const finalHolePts = holeIsCW ? rotC : [...rotC].reverse();

            const hole = new THREE.Path();
            hole.moveTo(finalHolePts[0].x, finalHolePts[0].y);
            for (let i = 1; i < finalHolePts.length; i++) {
                hole.lineTo(finalHolePts[i].x, finalHolePts[i].y);
            }
            hole.closePath();
            holes.push(hole);
        });
        return holes;
    }

    /**
     * Projects world-space tri-planar UV coordinates onto a slab geometry.
     * @param {THREE.BufferGeometry} geometry 
     */
    static applyWorldUVs(geometry) {
        if (!geometry || !geometry.attributes.position) return;
        const uvs = geometry.attributes.uv;
        const pos = geometry.attributes.position;
        geometry.computeVertexNormals();
        const norms = geometry.attributes.normal;
        if (!uvs || !norms) return;

        for (let i = 0; i < uvs.count; i++) {
            const nx = Math.abs(norms.getX(i));
            const ny = Math.abs(norms.getY(i));
            const nz = Math.abs(norms.getZ(i));
            const vx = pos.getX(i) / 100;
            const vy = pos.getY(i) / 100;
            const vz = pos.getZ(i) / 100;

            if (ny > 0.5) uvs.setXY(i, vx, vz); // Top/Bottom
            else if (nx > nz) uvs.setXY(i, vz, vy); // Side X
            else uvs.setXY(i, vx, vy); // Side Z
        }
        uvs.needsUpdate = true;
    }

    /**
     * Constructs the 2D THREE.Shape contour with all subtractions (courtyards, stairs, floor cuts).
     * @param {Object} room 
     * @param {Object} options - { allRooms, stairsBelow, shapes }
     * @returns {THREE.Shape|null}
     */
    static buildFloorShape(room, options = {}) {
        if (!room || room.isDeleted || room.isHidden) return null;
        const rawPath = room.path;
        if (!rawPath || rawPath.length < 3) return null;

        const cleanPath = this.cleanPolygon(rawPath);
        if (cleanPath.length < 3) return null;

        const { allRooms = [], stairsBelow = [], shapes = [] } = options;

        // THREE.Shape outer contour MUST be Counter-Clockwise (CCW)
        const isOuterCW = THREE.ShapeUtils.isClockWise(cleanPath);
        const outerPts = isOuterCW ? [...cleanPath].reverse() : cleanPath;

        const floorShape = new THREE.Shape();
        floorShape.moveTo(outerPts[0].x, outerPts[0].y);
        for (let i = 1; i < outerPts.length; i++) {
            floorShape.lineTo(outerPts[i].x, outerPts[i].y);
        }
        floorShape.closePath();

        // 1. Nested courtyard room voids
        const courtyardHoles = this.extractCourtyardHoles(room, allRooms);
        courtyardHoles.forEach(h => floorShape.holes.push(h));

        // 2. Stair opening voids
        const stairHoles = this.extractStairHoles(stairsBelow);
        stairHoles.forEach(h => floorShape.holes.push(h));

        // 3. Ceiling / floor cutout voids (shape_floor_cut)
        const cutoutHoles = this.extractCutoutHoles(shapes, cleanPath, room.elevation);
        cutoutHoles.forEach(h => floorShape.holes.push(h));

        return floorShape;
    }

    /**
     * Generates ExtrudeGeometry with world tri-planar UV mapping for a floor slab.
     * @param {Object} room 
     * @param {Object} options - { allRooms, stairsBelow, shapes, isSub, subH, yOffset }
     * @returns {THREE.ExtrudeGeometry|null}
     */
    static buildFloorGeometry(room, options = {}) {
        const floorShape = this.buildFloorShape(room, options);
        if (!floorShape) return null;

        const { isSub = false, subH = 18, yOffset } = options;
        const slabDepth = isSub ? subH : (Number(room.thickness) || 2);
        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: slabDepth, bevelEnabled: false });
        floorGeo.rotateX(Math.PI / 2);

        const defaultYOffset = 0.2;
        const translateY = isSub ? (subH - 0.01) : (yOffset !== undefined ? yOffset : defaultYOffset);
        floorGeo.translate(0, translateY, 0);

        this.applyWorldUVs(floorGeo);
        return floorGeo;
    }

    /**
     * Updates an existing floor mesh's geometry in place (CAD-style).
     * @param {THREE.Mesh} floorMesh 
     * @param {Object} room 
     * @param {Object} options 
     * @returns {boolean}
     */
    static updateFloorMeshGeometry(floorMesh, room, options = {}) {
        if (!floorMesh || !room) return false;
        const newGeo = this.buildFloorGeometry(room, options);
        if (!newGeo) return false;

        if (floorMesh.geometry && !floorMesh.geometry.userData?.keepAlive) {
            floorMesh.geometry.dispose();
        }
        floorMesh.geometry = newGeo;

        const roomElev = Number(room.elevation) || 0;
        floorMesh.position.set(0, roomElev, 0);
        floorMesh.userData = { ...floorMesh.userData, entity: room, isFloor: true, isRoom: true };
        room.mesh3D = floorMesh;
        return true;
    }

    /**
     * Builds the complete 3D Mesh for a floor slab (active or static).
     * @param {Object} room - The room entity
     * @param {Object} options - { allRooms, stairsBelow, shapes, isSub, subH, ctx, yOffset }
     * @returns {THREE.Mesh|null}
     */
    static buildFloorSlabMesh(room, options = {}) {
        if (!room || room.isDeleted || room.isHidden) return null;
        const floorGeo = this.buildFloorGeometry(room, options);
        if (!floorGeo) return null;

        const { isSub = false, ctx = null } = options;

        const mat = new THREE.MeshStandardMaterial({
            color: isSub ? 0xffffff : 0xffffff,
            roughness: isSub ? 0.85 : 0.7,
            metalness: isSub ? 0.05 : 0,
            side: THREE.DoubleSide
        });

        const configId = room.configId || 'hardwood';
        const floorConfig = FLOOR_REGISTRY[configId];
        if (floorConfig && !isSub) {
            const config = { ...floorConfig };
            if (room.materialScale) config.tileSize = room.materialScale;
            MaterialFactory.buildPBRMaterial({
                material: mat,
                config: config,
                ctx: ctx,
                dimensions: { width: 100, height: 100 },
                faceName: 'floor'
            }).then(() => {
                if (ctx && ctx.requestRender) ctx.requestRender('material_loaded', 2);
            });
        } else if (!isSub) {
            mat.color.setHex(0xd1d5db);
        }

        const floorMesh = new THREE.Mesh(floorGeo, mat);
        floorMesh.receiveShadow = true;
        floorMesh.userData = { entity: room, isRoom: true, isFloor: true };
        const roomElev = Number(room.elevation) || 0;
        if (roomElev !== 0) floorMesh.position.y = roomElev;
        room.mesh3D = floorMesh;

        return floorMesh;
    }
}
