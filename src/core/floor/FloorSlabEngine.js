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
import { StairGeometryEngine } from '../stairs/StairGeometryEngine.js';
import { FLOOR_REGISTRY } from '../registry.js';
import { MaterialFactory } from '../engine3d/MaterialFactory.js';

export class FloorSlabEngine {
    /**
     * Extracts stair opening hole paths from stairs on the level below.
     * @param {Array} stairsBelow 
     * @returns {Array<THREE.Path>}
     */
    static extractStairHoles(stairsBelow = []) {
        const holes = [];
        if (!stairsBelow || !Array.isArray(stairsBelow)) return holes;

        stairsBelow.forEach(stair => {
            const rotPts = StairGeometryEngine.getCutoutPolygon(stair);
            if (rotPts && rotPts.length >= 3) {
                const hole = new THREE.Path();
                hole.moveTo(rotPts[0].x, rotPts[0].y);
                for (let i = 1; i < rotPts.length; i++) {
                    hole.lineTo(rotPts[i].x, rotPts[i].y);
                }
                hole.lineTo(rotPts[0].x, rotPts[0].y);
                holes.push(hole);
            }
        });
        return holes;
    }

    /**
     * Extracts floor/ceiling cutout hole paths from shapes in the scene.
     * @param {Array} shapes 
     * @returns {Array<THREE.Path>}
     */
    static extractCutoutHoles(shapes = []) {
        const holes = [];
        if (!shapes || !Array.isArray(shapes)) return holes;

        shapes.forEach(shape => {
            if (shape.type === 'shape_floor_cut') {
                const rot = (shape.rotation || (shape.group ? shape.group.rotation() : 0) || 0) * Math.PI / 180;
                const sx = shape.x || shape.params?.x || (shape.group ? shape.group.x() : 0) || 0;
                const sy = shape.y || shape.params?.y || (shape.group ? shape.group.y() : 0) || 0;
                let pts;
                if (shape.params?.points) {
                    pts = shape.params.points;
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

                const hole = new THREE.Path();
                hole.moveTo(rotC[0].x, rotC[0].y);
                for (let i = 1; i < rotC.length; i++) {
                    hole.lineTo(rotC[i].x, rotC[i].y);
                }
                hole.lineTo(rotC[0].x, rotC[0].y);
                holes.push(hole);
            }
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
     * Builds the complete 3D Mesh for a floor slab (active or static).
     * @param {Object} room - The room entity
     * @param {Object} options - { stairsBelow, shapes, isSub, subH, ctx }
     * @returns {THREE.Mesh|null}
     */
    static buildFloorSlabMesh(room, options = {}) {
        if (!room || room.isDeleted || room.isHidden) return null;
        const path = room.path;
        if (!path || path.length < 3) return null;

        const { stairsBelow = [], shapes = [], isSub = false, subH = 18, ctx = null } = options;

        const floorShape = new THREE.Shape();
        floorShape.moveTo(path[0].x, path[0].y);
        for (let i = 1; i < path.length; i++) {
            floorShape.lineTo(path[i].x, path[i].y);
        }

        // Add stair opening voids
        const stairHoles = this.extractStairHoles(stairsBelow);
        stairHoles.forEach(h => floorShape.holes.push(h));

        // Add ceiling / floor cutout voids
        const cutoutHoles = this.extractCutoutHoles(shapes);
        cutoutHoles.forEach(h => floorShape.holes.push(h));

        const slabDepth = isSub ? subH : (Number(room.thickness) || 2);
        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: slabDepth, bevelEnabled: false });
        floorGeo.rotateX(Math.PI / 2);
        floorGeo.translate(0, isSub ? (subH - 0.01) : 0.2, 0);

        this.applyWorldUVs(floorGeo);

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

        return floorMesh;
    }
}
