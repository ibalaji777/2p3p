import * as THREE from 'three';
import { ROOF_DECOR_REGISTRY } from '../../../../core/registry.js';

/**
 * Specialized CAD/BIM Generator for Flat Roofs.
 * Handles:
 * - ExtrudeGeometry construction
 * - Subtraction of stair/mezzanine voids via shape_floor_cut
 * - Top terrace vs. perimeter fascia materials
 * - World-space tri-planar UV mapping
 */
export class FlatRoofGenerator {
    static build({
        roof,
        conf,
        pts,
        h,
        ctx,
        resolveRoofMaterial,
        shapeList = [],
        wallsUnderRoof = [],
        isGlassRoof = false,
        mat,
        fasciaMat
    }) {
        const shape = new THREE.Shape();
        shape.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
        shape.lineTo(pts[0].x, pts[0].y);

        if (shapeList && shapeList.length > 0) {
            const floorCuts = shapeList.filter(s => s.type === 'shape_floor_cut');
            floorCuts.forEach(s => {
                const rot = (s.group ? s.group.rotation() : (s.rotation || 0)) * Math.PI / 180;
                const sx = s.group ? s.group.x() : (s.x || s.params?.x || 0);
                const sy = s.group ? s.group.y() : (s.y || s.params?.y || 0);
                let sPts = s.params?.points;
                if (!sPts || sPts.length < 3) {
                    const w = s.params?.width || s.width || 100;
                    const h = s.params?.height || s.height || 100;
                    sPts = [ { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 }, { x: w/2, y: h/2 }, { x: -w/2, y: h/2 } ];
                }
                const rotC = sPts.map(c => ({
                    x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                    y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                }));

                let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
                pts.forEach(p => {
                    if (p.x < minRx) minRx = p.x; if (p.x > maxRx) maxRx = p.x;
                    if (p.y < minRy) minRy = p.y; if (p.y > maxRy) maxRy = p.y;
                });
                let minHx = Infinity, maxHx = -Infinity, minHy = Infinity, maxHy = -Infinity;
                rotC.forEach(p => {
                    if (p.x < minHx) minHx = p.x; if (p.x > maxHx) maxHx = p.x;
                    if (p.y < minHy) minHy = p.y; if (p.y > maxHy) maxHy = p.y;
                });

                if (!(maxRx <= minHx || minRx >= maxHx || maxRy <= minHy || minRy >= maxHy)) {
                    const roofIsCW = THREE.ShapeUtils.isClockWise(pts);
                    const holeIsCW = THREE.ShapeUtils.isClockWise(rotC);
                    const finalHolePts = (roofIsCW === holeIsCW) ? [...rotC].reverse() : rotC;

                    const hole = new THREE.Path();
                    hole.moveTo(finalHolePts[0].x, finalHolePts[0].y);
                    for (let i = 1; i < finalHolePts.length; i++) hole.lineTo(finalHolePts[i].x, finalHolePts[i].y);
                    hole.lineTo(finalHolePts[0].x, finalHolePts[0].y);
                    shape.holes.push(hole);
                }
            });
        }
        
        const geo = new THREE.ExtrudeGeometry(shape, { depth: conf.thickness || 2, bevelEnabled: false });
        geo.rotateX(Math.PI / 2);
        geo.translate(0, conf.thickness || 2, 0); 
        
        // UV Fix for Flat Roof (ExtrudeGeometry) - World Space Projection
        const uvs = geo.attributes.uv;
        const pos = geo.attributes.position;
        geo.computeVertexNormals();
        const norms = geo.attributes.normal;
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

        let flatMat = mat;
        let flatMatId = conf.material;
        if (!isGlassRoof) {
            if (!flatMatId || flatMatId === 'white_gravel_roof' || flatMatId === 'terracotta_tiles_roof' || flatMatId === 'dark_asphalt_roof') {
                flatMatId = (roof.configId && roof.configId !== 'white_gravel_roof' && roof.configId !== 'dark_asphalt_roof' && roof.configId !== 'terracotta_tiles_roof') ? roof.configId : 'white_plaster_wall';
            }

            // Check if host wall under the roof has a custom material assigned and roof is using default plaster finish
            let hostWallTex = null;
            if (wallsUnderRoof && wallsUnderRoof.length > 0) {
                for (const w of wallsUnderRoof) {
                    const wt = w.params?.textureFront || w.params?.textureSides || w.params?.texture || w.materials?.wall_front || w.materials?.front;
                    if (wt) {
                        hostWallTex = wt;
                        break;
                    }
                }
            }
            if (hostWallTex && (flatMatId === 'white_plaster_wall' || !conf.material)) {
                flatMatId = hostWallTex;
            }

            if (flatMatId === 'white_plaster_wall') {
                flatMat = (ctx?.helpers?.getDynamicMaterial ? ctx.helpers.getDynamicMaterial('white_plaster_wall', 'wall') : null)
                    || new THREE.MeshStandardMaterial({
                        color: 0xefede5,
                        roughness: 0.9,
                        metalness: 0.0,
                        envMapIntensity: 0.08
                    });
            } else if (ctx?.helpers?.getDynamicMaterial) {
                flatMat = ctx.helpers.getDynamicMaterial(flatMatId, 'wall');
            }
            if (!flatMat && ROOF_DECOR_REGISTRY[flatMatId]) {
                flatMat = resolveRoofMaterial(flatMatId).mat;
            }
            if (!flatMat) {
                flatMat = new THREE.MeshStandardMaterial({ 
                    color: 0xefede5,
                    roughness: 0.9,
                    metalness: 0.0,
                    envMapIntensity: 0.08
                });
            }
        }

        // Perimeter slab side (fascia) defaults to wall plaster finish (or inherited wall texture)
        const defaultFlatFascia = isGlassRoof ? 'metal_dark_steel' : (!isGlassRoof && flatMatId ? flatMatId : 'white_plaster_wall');
        const flatFasciaMat = (ctx?.helpers?.getDynamicMaterial 
            ? ctx.helpers.getDynamicMaterial(conf.fasciaMaterial || defaultFlatFascia, isGlassRoof ? 'metal' : 'wall') 
            : null) || fasciaMat;

        if (flatMat) flatMat.side = THREE.DoubleSide;
        if (flatFasciaMat) flatFasciaMat.side = THREE.DoubleSide;

        // ExtrudeGeometry index 0 = top/bottom caps (terrace), index 1 = extruded perimeter sides (wall band)
        return new THREE.Mesh(geo, [flatMat, flatFasciaMat]);
    }
}
