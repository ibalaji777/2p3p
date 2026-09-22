import * as THREE from 'three';
import { ComponentRegistry } from '../../../../core/engine3d/ComponentRegistry.js';
import { thickenGeometry, applyRoofGroups } from './RoofGeneratorHelpers.js';

/**
 * Specialized CAD/BIM Generator for Shed and Half-Gable Roofs.
 * Handles:
 * - Single slope extrusion along X or Y axis
 * - Optional curvature and flipSlope
 * - Triangular rake side walls and high eave closure walls
 * - Geometry thickening and fascia edges
 */
export class ShedRoofGenerator {
    static build({
        roof,
        conf,
        pts,
        basePts,
        h,
        ctx,
        resolveRoofMaterial,
        isGlassRoof,
        mat,
        fasciaMat,
        hasWalls,
        wallList
    }) {
        let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
        pts.forEach(p => {
            bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
            bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
        });
        const bW = bMaxX - bMinX;
        const bD = bMaxY - bMinY;

        let baseMinX = Infinity, baseMaxX = -Infinity, baseMinY = Infinity, baseMaxY = -Infinity;
        basePts.forEach(p => {
            baseMinX = Math.min(baseMinX, p.x); baseMaxX = Math.max(baseMaxX, p.x);
            baseMinY = Math.min(baseMinY, p.y); baseMaxY = Math.max(baseMaxY, p.y);
        });
        const baseW = (baseMinX !== Infinity) ? (baseMaxX - baseMinX) : bW;
        const baseD = (baseMinY !== Infinity) ? (baseMaxY - baseMinY) : bD;

        const pitch = conf.pitch !== undefined ? conf.pitch : 20;
        const axis = conf.ridgeAxis || 'x';
        const span = axis === 'x' ? baseD : baseW;
        const rh = Math.tan(pitch * Math.PI / 180) * span;
        const curve = conf.curve || 0;
        const flip = !!conf.flipSlope;

        const hasAutoGableCADWalls = hasWalls && wallList.some(w => w.isAutoGable && w.parentRoofId === roof.id && w.mesh3D && w.mesh3D.parent);
        const shouldGenerateGableEndMesh = (conf.showGableWalls !== false) && (conf.autoShapeWalls !== false) && !hasAutoGableCADWalls && (rh > 0.5);

        const v = [], uv = [];
        const numSubdivs = curve !== 0 ? 32 : 1;
        for (let i = 0; i < numSubdivs; i++) {
            const t0 = i / numSubdivs;
            const t1 = (i + 1) / numSubdivs;
            
            let y0 = t0 * rh;
            let y1 = t1 * rh;
            if (curve !== 0) {
                y0 += curve * Math.sin(Math.PI * t0);
                y1 += curve * Math.sin(Math.PI * t1);
            }

            if (axis === 'x') {
                const z0 = flip ? (bMaxY - t0 * bD) : (bMinY + t0 * bD);
                const z1 = flip ? (bMaxY - t1 * bD) : (bMinY + t1 * bD);
                
                const pNW = { x: bMinX, y: y0, z: z0 };
                const pNE = { x: bMaxX, y: y0, z: z0 };
                const pSE = { x: bMaxX, y: y1, z: z1 };
                const pSW = { x: bMinX, y: y1, z: z1 };

                v.push(pNW.x, pNW.y, pNW.z, pNE.x, pNE.y, pNE.z, pSE.x, pSE.y, pSE.z);
                uv.push(pNW.x/100, pNW.z/100, pNE.x/100, pNE.z/100, pSE.x/100, pSE.z/100);

                v.push(pNW.x, pNW.y, pNW.z, pSE.x, pSE.y, pSE.z, pSW.x, pSW.y, pSW.z);
                uv.push(pNW.x/100, pNW.z/100, pSE.x/100, pSE.z/100, pSW.x/100, pSW.z/100);
            } else {
                const x0 = flip ? (bMaxX - t0 * bW) : (bMinX + t0 * bW);
                const x1 = flip ? (bMaxX - t1 * bW) : (bMinX + t1 * bW);
                
                const pNW = { x: x0, y: y0, z: bMinY };
                const pSW = { x: x0, y: y0, z: bMaxY };
                const pSE = { x: x1, y: y1, z: bMaxY };
                const pNE = { x: x1, y: y1, z: bMinY };

                v.push(pNW.x, pNW.y, pNW.z, pSW.x, pSW.y, pSW.z, pSE.x, pSE.y, pSE.z);
                uv.push(pNW.x/100, pNW.z/100, pSW.x/100, pSW.z/100, pSE.x/100, pSE.z/100);

                v.push(pNW.x, pNW.y, pNW.z, pSE.x, pSE.y, pSE.z, pNE.x, pNE.y, pNE.z);
                uv.push(pNW.x/100, pNW.z/100, pSE.x/100, pSE.z/100, pNE.x/100, pNE.z/100);
            }
        }

        // Triangular side rake walls and high eave closure wall for Shed / Half-Gable roof
        const gv = [], guv = [];
        const T = conf.thickness || 8;
        if (shouldGenerateGableEndMesh) {
            const gWestX = (baseMinX !== Infinity && !conf.flushGable) ? Math.max(bMinX, Math.min(bMaxX, baseMinX)) : bMinX;
            const gEastX = (baseMaxX !== -Infinity && !conf.flushGable) ? Math.max(bMinX, Math.min(bMaxX, baseMaxX)) : bMaxX;
            const gNorthY = (baseMinY !== Infinity && !conf.flushGable) ? Math.max(bMinY, Math.min(bMaxY, baseMinY)) : bMinY;
            const gSouthY = (baseMaxY !== -Infinity && !conf.flushGable) ? Math.max(bMinY, Math.min(bMaxY, baseMaxY)) : bMaxY;

            const wallSpanX = Math.max(1, gEastX - gWestX);
            const wallSpanZ = Math.max(1, gSouthY - gNorthY);
            const wallSubdivs = Math.max(1, numSubdivs);

            const getUndersideY = (t) => {
                let y = t * rh;
                if (curve !== 0) {
                    y += curve * Math.sin(Math.PI * t);
                }
                return Math.max(0, y - T);
            };

            if (axis === 'x') {
                // 1. High eave vertical back closure wall
                const backZ = flip ? gNorthY : gSouthY;
                const highY = Math.max(0, rh - T);
                gv.push(
                    gWestX, 0, backZ,
                    gEastX, 0, backZ,
                    gEastX, highY, backZ,

                    gWestX, 0, backZ,
                    gEastX, highY, backZ,
                    gWestX, highY, backZ
                );
                guv.push(
                    0, 0,  wallSpanX / 100, 0,  wallSpanX / 100, highY / 100,
                    0, 0,  wallSpanX / 100, highY / 100,  0, highY / 100
                );

                // 2. West side rake wall (segmented to track curvature smoothly)
                for (let s = 0; s < wallSubdivs; s++) {
                    const st0 = s / wallSubdivs;
                    const st1 = (s + 1) / wallSubdivs;
                    const sz0 = flip ? (gSouthY - st0 * wallSpanZ) : (gNorthY + st0 * wallSpanZ);
                    const sz1 = flip ? (gSouthY - st1 * wallSpanZ) : (gNorthY + st1 * wallSpanZ);
                    const sy0 = getUndersideY(st0);
                    const sy1 = getUndersideY(st1);

                    gv.push(
                        gWestX, 0, sz0,
                        gWestX, 0, sz1,
                        gWestX, sy1, sz1,

                        gWestX, 0, sz0,
                        gWestX, sy1, sz1,
                        gWestX, sy0, sz0
                    );
                    guv.push(
                        (st0 * wallSpanZ) / 100, 0,  (st1 * wallSpanZ) / 100, 0,  (st1 * wallSpanZ) / 100, sy1 / 100,
                        (st0 * wallSpanZ) / 100, 0,  (st1 * wallSpanZ) / 100, sy1 / 100,  (st0 * wallSpanZ) / 100, sy0 / 100
                    );
                }

                // 3. East side rake wall (segmented)
                for (let s = 0; s < wallSubdivs; s++) {
                    const st0 = s / wallSubdivs;
                    const st1 = (s + 1) / wallSubdivs;
                    const sz0 = flip ? (gSouthY - st0 * wallSpanZ) : (gNorthY + st0 * wallSpanZ);
                    const sz1 = flip ? (gSouthY - st1 * wallSpanZ) : (gNorthY + st1 * wallSpanZ);
                    const sy0 = getUndersideY(st0);
                    const sy1 = getUndersideY(st1);

                    gv.push(
                        gEastX, 0, sz0,
                        gEastX, sy1, sz1,
                        gEastX, 0, sz1,

                        gEastX, 0, sz0,
                        gEastX, sy0, sz0,
                        gEastX, sy1, sz1
                    );
                    guv.push(
                        (st0 * wallSpanZ) / 100, 0,  (st1 * wallSpanZ) / 100, sy1 / 100,  (st1 * wallSpanZ) / 100, 0,
                        (st0 * wallSpanZ) / 100, 0,  (st0 * wallSpanZ) / 100, sy0 / 100,  (st1 * wallSpanZ) / 100, sy1 / 100
                    );
                }
            } else {
                // Ridge axis is 'y': slope runs along X
                // 1. High eave vertical back closure wall
                const backX = flip ? gWestX : gEastX;
                const highY = Math.max(0, rh - T);
                gv.push(
                    backX, 0, gNorthY,
                    backX, highY, gNorthY,
                    backX, highY, gSouthY,

                    backX, 0, gNorthY,
                    backX, highY, gSouthY,
                    backX, 0, gSouthY
                );
                guv.push(
                    0, 0,  0, highY / 100,  wallSpanZ / 100, highY / 100,
                    0, 0,  wallSpanZ / 100, highY / 100,  wallSpanZ / 100, 0
                );

                // 2. North side rake wall (segmented)
                for (let s = 0; s < wallSubdivs; s++) {
                    const st0 = s / wallSubdivs;
                    const st1 = (s + 1) / wallSubdivs;
                    const sx0 = flip ? (gEastX - st0 * wallSpanX) : (gWestX + st0 * wallSpanX);
                    const sx1 = flip ? (gEastX - st1 * wallSpanX) : (gWestX + st1 * wallSpanX);
                    const sy0 = getUndersideY(st0);
                    const sy1 = getUndersideY(st1);

                    gv.push(
                        sx0, 0, gNorthY,
                        sx1, sy1, gNorthY,
                        sx1, 0, gNorthY,

                        sx0, 0, gNorthY,
                        sx0, sy0, gNorthY,
                        sx1, sy1, gNorthY
                    );
                    guv.push(
                        (st0 * wallSpanX) / 100, 0,  (st1 * wallSpanX) / 100, sy1 / 100,  (st1 * wallSpanX) / 100, 0,
                        (st0 * wallSpanX) / 100, 0,  (st0 * wallSpanX) / 100, sy0 / 100,  (st1 * wallSpanX) / 100, sy1 / 100
                    );
                }

                // 3. South side rake wall (segmented)
                for (let s = 0; s < wallSubdivs; s++) {
                    const st0 = s / wallSubdivs;
                    const st1 = (s + 1) / wallSubdivs;
                    const sx0 = flip ? (gEastX - st0 * wallSpanX) : (gWestX + st0 * wallSpanX);
                    const sx1 = flip ? (gEastX - st1 * wallSpanX) : (gWestX + st1 * wallSpanX);
                    const sy0 = getUndersideY(st0);
                    const sy1 = getUndersideY(st1);

                    gv.push(
                        sx0, 0, gSouthY,
                        sx1, 0, gSouthY,
                        sx1, sy1, gSouthY,

                        sx0, 0, gSouthY,
                        sx1, sy1, gSouthY,
                        sx0, sy0, gSouthY
                    );
                    guv.push(
                        (st0 * wallSpanX) / 100, 0,  (st1 * wallSpanX) / 100, 0,  (st1 * wallSpanX) / 100, sy1 / 100,
                        (st0 * wallSpanX) / 100, 0,  (st1 * wallSpanX) / 100, sy1 / 100,  (st0 * wallSpanX) / 100, sy0 / 100
                    );
                }
            }
        }

        const {v: vThick, uv: uvThick} = thickenGeometry(v, uv, T);

        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(vThick, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvThick, 2));
        geo.computeVertexNormals();
        
        applyRoofGroups(geo, v.length, vThick.length, isGlassRoof);
        const mesh = new THREE.Mesh(geo, [mat, fasciaMat]);

        if (gv.length > 0) {
            const gGeo = new THREE.BufferGeometry();
            gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
            gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
            gGeo.computeVertexNormals();

            let gableMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial(conf.gableMaterial || 'white_plaster_wall', 'wall') : null) || new THREE.MeshStandardMaterial({color: 0xefede5});
            gableMat.side = THREE.DoubleSide;
            const gableMesh = new THREE.Mesh(gGeo, gableMat);
            gableMesh.castShadow = true;
            gableMesh.receiveShadow = true;
            gableMesh.userData = { isRoof: true, isGable: true, isGableWall: true, entity: roof, materialSlot: 'gable', componentType: 'gable_wall' };
            mesh.add(gableMesh);
            ComponentRegistry.registerMesh(roof, "gable", gableMesh);
        }

        return mesh;
    }
}
