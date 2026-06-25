import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, RAILING_REGISTRY } from '../registry.js';

export class Wall3DBuilder {
    constructor() {
        // Procedural photorealistic plaster bump texture for modern villa exterior/interior
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 512;
        const ctx2d = canvas.getContext('2d');
        
        ctx2d.fillStyle = '#808080';
        ctx2d.fillRect(0, 0, 512, 512);
        
        // Trowel marks and soft dirt variation (seamless)
        for (let i = 0; i < 3000; i++) {
            const isLight = Math.random() > 0.5;
            ctx2d.fillStyle = isLight ? `rgba(255, 255, 255, ${Math.random() * 0.04})` : `rgba(0, 0, 0, ${Math.random() * 0.04})`;
            ctx2d.beginPath();
            const x = Math.random() * 512;
            const y = Math.random() * 512;
            const r = 5 + Math.random() * 25;
            ctx2d.arc(x, y, r, 0, Math.PI * 2);
            ctx2d.fill();
            
            if (x - r < 0) { ctx2d.beginPath(); ctx2d.arc(x + 512, y, r, 0, Math.PI * 2); ctx2d.fill(); }
            if (x + r > 512) { ctx2d.beginPath(); ctx2d.arc(x - 512, y, r, 0, Math.PI * 2); ctx2d.fill(); }
            if (y - r < 0) { ctx2d.beginPath(); ctx2d.arc(x, y + 512, r, 0, Math.PI * 2); ctx2d.fill(); }
            if (y + r > 512) { ctx2d.beginPath(); ctx2d.arc(x, y - 512, r, 0, Math.PI * 2); ctx2d.fill(); }
        }
        
        // Fine concrete grain
        const imgData = ctx2d.getImageData(0, 0, 512, 512);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const grain = (Math.random() - 0.5) * 20; 
            imgData.data[i] = Math.max(0, Math.min(255, imgData.data[i] + grain));
            imgData.data[i + 1] = Math.max(0, Math.min(255, imgData.data[i + 1] + grain));
            imgData.data[i + 2] = Math.max(0, Math.min(255, imgData.data[i + 2] + grain));
        }
        ctx2d.putImageData(imgData, 0, 0);

        this.wallBumpTex = new THREE.CanvasTexture(canvas);
        this.wallBumpTex.wrapS = this.wallBumpTex.wrapT = THREE.RepeatWrapping;
        this.wallBumpTex.repeat.set(0.05, 0.05);

        this.matMain = new THREE.MeshStandardMaterial({ 
            color: 0xefede5, // Premium modern warm off-white
            roughness: 0.98, // Realistic matte cement finish
            metalness: 0.02, // Subtle sunlight response
            bumpMap: this.wallBumpTex, 
            bumpScale: 0.015 // Soft but visible plaster grain depth
        });
        this.matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xdddddb, roughness: 0.9 });
        this.matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
    }

    // Abstract method that works for both Active (Konva) and Static (JSON) walls
    buildWallGroup(length, thickness, wallData, startX, startY, angle, wallHeight = WALL_HEIGHT) {
        const extraMeshes = [];
        const extraInteractables = [];
        const wallShape = this._createShape(length, wallData.attachedWidgets, wallHeight, thickness, extraMeshes, extraInteractables);
        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: thickness, bevelEnabled: false, steps: 12 });
        wallGeo.translate(0, 0, -thickness / 2);

        // ====== MITER JOINT SHEARING ======
        const startProfile = wallData.wallShapeData ? wallData.wallShapeData.startProfile : wallData.startProfile;
        const endProfile = wallData.wallShapeData ? wallData.wallShapeData.endProfile : wallData.endProfile;
        const pts = (wallData.poly && typeof wallData.poly.points === 'function') ? wallData.poly.points() : wallData.pts;
        
        let localSL_x = 0, localSR_x = 0, localEL_x = length, localER_x = length;
        
        if (startProfile && endProfile) {
            const toLocal = (ptX, ptY) => {
                const dx = ptX - startX; const dy = ptY - startY;
                const c = Math.cos(angle); const s = Math.sin(angle);
                return { x: dx * c + dy * s, z: -dx * s + dy * c };
            };
            const startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);
            const endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);

            const interpolateX = (profile, zTarget) => {
                if (profile.length === 1) return profile[0].x;
                if (zTarget <= profile[0].z) return profile[0].x;
                if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
                for (let i = 0; i < profile.length - 1; i++) {
                    const p1 = profile[i]; const p2 = profile[i+1];
                    if (zTarget >= p1.z && zTarget <= p2.z) {
                        if (p2.z === p1.z) return p1.x;
                        const t = (zTarget - p1.z) / (p2.z - p1.z);
                        return p1.x + t * (p2.x - p1.x);
                    }
                }
                return profile[0].x;
            };

            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    const z = pos.getZ(i);

                    const sX = interpolateX(startProfileLocal, z);
                    const eX = interpolateX(endProfileLocal, z);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(wallGeo);
        } else if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => { return (ptX - startX) * Math.cos(angle) + (ptY - startY) * Math.sin(angle); };
            localSL_x = toLocalX(pts[0], pts[1]); localEL_x = toLocalX(pts[2], pts[3]); localER_x = toLocalX(pts[4], pts[5]); localSR_x = toLocalX(pts[6], pts[7]);

            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i); const z = pos.getZ(i);
                    const tZ = (z + thickness / 2) / thickness;
                    const sX = localSR_x + tZ * (localSL_x - localSR_x); const eX = localER_x + tZ * (localEL_x - localER_x);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(wallGeo);
        }

        // Manually generate UVs to prevent texture stretching across openings.
        // This applies a planar mapping based on the wall's local coordinates,
        // ensuring the texture tiles correctly regardless of holes.
        const positions = wallGeo.attributes.position;
        const normals = wallGeo.attributes.normal;
        if (wallGeo.attributes.uv) {
            const uvs = wallGeo.attributes.uv;
            const TILE_SIZE = 100; // Represents the world-space size of one texture tile (e.g., 1m).

            for (let i = 0; i < positions.count; i++) {
                // Only apply to front and back faces (where normal is along the local Z-axis).
                if (Math.abs(normals.getZ(i)) > 0.99) {
                    uvs.setXY(i, positions.getX(i) / TILE_SIZE, positions.getY(i) / TILE_SIZE);
                }
            }
            uvs.needsUpdate = true;
        }

        let materials = [this.matMain, this.matEdgeDark];
        
        if (wallData.type === 'railing') {
            const configId = wallData.configId || 'glass';
            const rConf = RAILING_REGISTRY[configId];
            if (rConf) {
                let railMat;
                if (rConf.texture) {
                    const tex = new THREE.TextureLoader().load(rConf.texture);
                    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(length / (100 * (rConf.repeat || 1)), wallHeight / (100 * (rConf.repeat || 1)));
                    railMat = new THREE.MeshStandardMaterial({ map: tex, roughness: rConf.roughness || 0.8, side: THREE.DoubleSide });
                } else {
                    railMat = new THREE.MeshStandardMaterial({ 
                        color: rConf.color, roughness: rConf.roughness || 0.3, 
                        metalness: rConf.metalness || 0.1, transparent: rConf.transparent || false, 
                        opacity: rConf.opacity || 1.0, side: THREE.DoubleSide 
                    });
                }
                materials = [railMat, railMat];
            }
        }
        
        const wallMesh = new THREE.Mesh(wallGeo, materials);
        wallMesh.castShadow = true; 
        wallMesh.receiveShadow = true;

        const wallGroup = new THREE.Group();
        wallGroup.position.set(startX, 0, startY);
        wallGroup.rotation.y = -angle;
        
        wallGroup.add(wallMesh, ...extraMeshes);

        return { wallGroup, wallGeo, extraInteractables };
    }

    createHitboxes(length, thickness, wallData, isStatic = false, levelIndex = 0, wallIndex = 0, wallHeight = WALL_HEIGHT, startX = 0, startY = 0, angle = 0) {
        const hitboxes = [];
        
        const skinGeoFront = new THREE.PlaneGeometry(length - 0.5, wallHeight - 0.5);
        skinGeoFront.translate(length / 2, wallHeight / 2, thickness / 2 + 0.1);

        const skinGeoBack = new THREE.PlaneGeometry(length - 0.5, wallHeight - 0.5);
        skinGeoBack.translate(length / 2, wallHeight / 2, -thickness / 2 - 0.1);

        const startProfile = wallData.wallShapeData ? wallData.wallShapeData.startProfile : wallData.startProfile;
        const endProfile = wallData.wallShapeData ? wallData.wallShapeData.endProfile : wallData.endProfile;
        const pts = (wallData.poly && typeof wallData.poly.points === 'function') ? wallData.poly.points() : wallData.pts;
        
        if (startProfile && endProfile) {
            const toLocal = (ptX, ptY) => {
                const dx = ptX - startX; const dy = ptY - startY;
                const c = Math.cos(angle); const s = Math.sin(angle);
                return { x: dx * c + dy * s, z: -dx * s + dy * c };
            };
            const startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);
            const endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);

            const interpolateX = (profile, zTarget) => {
                if (profile.length === 1) return profile[0].x;
                if (zTarget <= profile[0].z) return profile[0].x;
                if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
                for (let i = 0; i < profile.length - 1; i++) {
                    const p1 = profile[i]; const p2 = profile[i+1];
                    if (zTarget >= p1.z && zTarget <= p2.z) {
                        if (p2.z === p1.z) return p1.x;
                        const t = (zTarget - p1.z) / (p2.z - p1.z);
                        return p1.x + t * (p2.x - p1.x);
                    }
                }
                return profile[0].x;
            };

            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i); const z = pos.getZ(i);
                    const sX = interpolateX(startProfileLocal, z);
                    const eX = interpolateX(endProfileLocal, z);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(skinGeoFront); shearGeo(skinGeoBack);
        } else if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => { return (ptX - startX) * Math.cos(angle) + (ptY - startY) * Math.sin(angle); };
            const localSL_x = toLocalX(pts[0], pts[1]), localEL_x = toLocalX(pts[2], pts[3]), localER_x = toLocalX(pts[4], pts[5]), localSR_x = toLocalX(pts[6], pts[7]);
            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i); const z = pos.getZ(i);
                    const tZ = (z + thickness / 2) / thickness;
                    const sX = localSR_x + tZ * (localSL_x - localSR_x); const eX = localER_x + tZ * (localEL_x - localER_x);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(skinGeoFront); shearGeo(skinGeoBack);
        }

        const hitFront = new THREE.Mesh(skinGeoFront, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.userData = { isWallSide: true, side: 'front', entity: wallData };

        const hitBack = new THREE.Mesh(skinGeoBack, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitBack.userData = { isWallSide: true, side: 'back', entity: wallData };

        hitboxes.push(hitFront, hitBack);

        // If it's a static wall, add a volume trigger to catch "Switch Floor" clicks
        if (isStatic) {
            const volGeo = new THREE.BoxGeometry(length, wallHeight, thickness);
            volGeo.translate(length / 2, wallHeight / 2, 0);
            const trigger = new THREE.Mesh(volGeo, new THREE.MeshBasicMaterial({ visible: false }));
            trigger.userData = { isFloorTrigger: true, levelIndex, entityIndex: wallIndex, entityType: 'wall' };
            hitboxes.push(trigger);
        }

        return hitboxes;
    }

    createJoint(x, y, thickness, wallHeight = WALL_HEIGHT) {
        const jointGeo = new THREE.CylinderGeometry(thickness / 2, thickness / 2, wallHeight, 32);
        const jointMesh = new THREE.Mesh(jointGeo, this.matMain);
        jointMesh.position.set(x, wallHeight / 2, y);
        jointMesh.castShadow = true; 
        jointMesh.receiveShadow = true;
        return jointMesh;
    }

    _createShape(length, widgets, wallHeight = WALL_HEIGHT, thickness = 20, extraMeshes = null, extraInteractables = null) {
        const wallBottom = -1;
        const wallShape = new THREE.Shape();
        wallShape.moveTo(0, wallBottom); wallShape.lineTo(length, wallBottom); wallShape.lineTo(length, wallHeight); wallShape.lineTo(0, wallHeight); wallShape.lineTo(0, wallBottom);

        if (!widgets) return wallShape;

        widgets.forEach(widg => {
            const hole = new THREE.Path();
            const wCenter = length * widg.t; 
            const halfW = widg.width / 2;
            const type = widg.type || widg.configId; 
            
            if (type === 'elevation_fascia' || type === 'niche_recess') return;
            
            let h_opening = widg.height;
            if (h_opening === undefined) h_opening = (type === 'door') ? DOOR_HEIGHT : ((type === 'window') ? WINDOW_HEIGHT : 200);
            let elev = widg.elevation;
            if (elev === undefined) elev = (type === 'window') ? WINDOW_SILL : 0;
            
            let cutElev = (elev <= 0.1) ? wallBottom : elev;
            elev = Math.max(0, Math.min(elev, wallHeight));
            h_opening = Math.max(0, Math.min(h_opening, wallHeight - elev));

            const xMin = wCenter - halfW;
            const xMax = wCenter + halfW;
            const yMax = elev + h_opening;
            const yMid = elev + h_opening / 2;

            if (type === 'arch_opening') {
                const radius = halfW;
                const straightH = Math.max(0, h_opening - radius);
                hole.moveTo(xMin, cutElev);
                hole.lineTo(xMax, cutElev);
                hole.lineTo(xMax, elev + straightH);
                if (radius > 0) hole.absarc(wCenter, elev + straightH, radius, 0, Math.PI, false);
                else hole.lineTo(xMin, elev + straightH);
                hole.lineTo(xMin, cutElev);
            } else if (type === 'circular_opening') {
                hole.moveTo(xMax, yMid);
                hole.absellipse(wCenter, yMid, halfW, h_opening / 2, 0, Math.PI * 2, false, 0);
            } else if (type === 'custom_shape_opening') {
                hole.moveTo(wCenter, cutElev);
                hole.lineTo(xMax, yMid);
                hole.lineTo(wCenter, yMax);
                hole.lineTo(xMin, yMid);
                hole.lineTo(wCenter, cutElev);
            } else {
                hole.moveTo(xMin, cutElev); 
                hole.lineTo(xMax, cutElev); 
                hole.lineTo(xMax, yMax); 
                hole.lineTo(xMin, yMax); 
                hole.lineTo(xMin, cutElev);
            }
            wallShape.holes.push(hole);

            if (extraMeshes && ['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type)) {
                const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, thickness + 4);
                hitBoxGeo.translate(0, h_opening / 2, 0);
                const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                hitBox.userData = { isHitbox: true };
                
                const group = new THREE.Group();
                group.position.set(wCenter, elev, 0);
                group.userData = { isPattern: true, entity: widg };
                widg.patternMesh3D = group;

                if (type === 'pattern_opening') {
                    const patternShape = new THREE.Shape();
                    patternShape.moveTo(-halfW, 0);
                    patternShape.lineTo(halfW, 0);
                    patternShape.lineTo(halfW, h_opening);
                    patternShape.lineTo(-halfW, h_opening);
                    patternShape.lineTo(-halfW, 0);

                    const rows = widg.rows || 4, cols = widg.cols || 4, spacing = widg.spacing !== undefined ? widg.spacing : 5;
                    const style = widg.patternStyle || 'grid';
                    const pW = (widg.width - spacing * (cols + 1)) / cols;
                    const pH = (h_opening - spacing * (rows + 1)) / rows;
                    if (pW > 0 && pH > 0) {
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                const px = -halfW + spacing + c * (pW + spacing);
                                const py = spacing + r * (pH + spacing);
                                const pPath = new THREE.Path();
                                const cx = px + pW/2, cy = py + pH/2;
                                if (style === 'diamond') {
                                    pPath.moveTo(cx, py); pPath.lineTo(px + pW, cy); pPath.lineTo(cx, py + pH); pPath.lineTo(px, cy); pPath.lineTo(cx, py);
                                } else if (style === 'circle') {
                                    pPath.moveTo(cx + Math.min(pW, pH)/2, cy); pPath.absarc(cx, cy, Math.min(pW, pH)/2, 0, Math.PI * 2, false);
                                } else if (style === 'cross') {
                                    const w1 = pW*0.2, h1 = pH*0.8, w2 = pW*0.8, h2 = pH*0.2;
                                    pPath.moveTo(cx-w1/2, cy-h1/2); pPath.lineTo(cx+w1/2, cy-h1/2); pPath.lineTo(cx+w1/2, cy-h2/2); pPath.lineTo(cx+w2/2, cy-h2/2); pPath.lineTo(cx+w2/2, cy+h2/2); pPath.lineTo(cx+w1/2, cy+h2/2); pPath.lineTo(cx+w1/2, cy+h1/2); pPath.lineTo(cx-w1/2, cy+h1/2); pPath.lineTo(cx-w1/2, cy+h2/2); pPath.lineTo(cx-w2/2, cy+h2/2); pPath.lineTo(cx-w2/2, cy-h2/2); pPath.lineTo(cx-w1/2, cy-h2/2); pPath.lineTo(cx-w1/2, cy-h1/2);
                                } else if (style === 'hexagon') {
                                    const rad = Math.min(pW, pH)/2; for (let i = 0; i < 6; i++) { const a = (i*Math.PI)/3; const hx = cx + rad*Math.cos(a), hy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(hx,hy); else pPath.lineTo(hx,hy); } pPath.lineTo(cx+rad, cy);
                                } else if (style === 'star') {
                                    const rOut = Math.min(pW, pH)/2, rIn = rOut*0.3; for (let i = 0; i < 8; i++) { const a = (i*Math.PI)/4; const rad = i%2===0 ? rOut : rIn; const sx = cx + rad*Math.cos(a), sy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(sx,sy); else pPath.lineTo(sx,sy); } pPath.lineTo(cx+rOut, cy);
                                } else if (style === 'slit') {
                                    const slitW = pW*0.3, slitH = pH*0.9; pPath.moveTo(cx-slitW/2, cy-slitH/2); pPath.lineTo(cx+slitW/2, cy-slitH/2); pPath.lineTo(cx+slitW/2, cy+slitH/2); pPath.lineTo(cx-slitW/2, cy+slitH/2); pPath.lineTo(cx-slitW/2, cy-slitH/2);
                                } else if (style === 'terracotta') {
                                    const pr = Math.min(pW, pH) / 4; pPath.moveTo(cx + pr, cy - pr); pPath.absarc(cx + pr, cy, pr, -Math.PI/2, Math.PI/2, false); pPath.absarc(cx, cy + pr, pr, 0, Math.PI, false); pPath.absarc(cx - pr, cy, pr, Math.PI/2, 3*Math.PI/2, false); pPath.absarc(cx, cy - pr, pr, Math.PI, 2*Math.PI, false);
                                } else if (style === 'arabesque') {
                                    const rOut = Math.min(pW, pH)/2, rIn = rOut*0.55; for (let i = 0; i < 16; i++) { const a = (i*Math.PI)/8; const rad = i%2===0 ? rOut : rIn; const sx = cx + rad*Math.cos(a), sy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(sx,sy); else pPath.lineTo(sx,sy); }
                                } else {
                                    pPath.moveTo(px, py); pPath.lineTo(px + pW, py); pPath.lineTo(px + pW, py + pH); pPath.lineTo(px, py + pH); pPath.lineTo(px, py);
                                }
                                pPath.closePath();
                                patternShape.holes.push(pPath);
                            }
                        }
                    }

                    if (extraMeshes) {
                        const patternGeo = new THREE.ExtrudeGeometry(patternShape, { depth: thickness, bevelEnabled: false });
                        patternGeo.translate(0, 0, -thickness / 2);
                        const patternMat = this.matMain.clone(); // inherit wall material
                        const patternMesh = new THREE.Mesh(patternGeo, patternMat);
                        patternMesh.castShadow = true; patternMesh.receiveShadow = true;
                        
                        const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, thickness + 4);
                        hitBoxGeo.translate(wCenter, elev + h_opening / 2, 0);
                        const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                        hitBox.userData = { isHitbox: true };
                        
                        const patternGroup = new THREE.Group();
                        patternGroup.add(patternMesh, hitBox);
                        patternGroup.userData = { isPattern: true, entity: widg };
                        widg.patternMesh3D = patternGroup;
                        widg.patternMat3D = patternMat;
                        
                        extraMeshes.push(patternGroup);
                        if (extraInteractables) extraInteractables.push(hitBox);
                    }
                } else {
                    // This branch is for advanced openings that are not pattern-based.
                    // The hole is already created and pushed above. No action needed.
                }
                
                if (type === 'niche_recess' && extraMeshes) {
                    const depth = widg.depth || 10;
                    const recessThickness = Math.max(0.5, thickness - depth);
                    const nicheGeo = new THREE.BoxGeometry(widg.width, h_opening, recessThickness);
                    const zOffset = (widg.facing === -1) ? (thickness/2 - recessThickness/2) : (-thickness/2 + recessThickness/2);
                    nicheGeo.translate(wCenter, elev + h_opening/2, zOffset);
                    const nicheMesh = new THREE.Mesh(nicheGeo, this.matMain);
                    nicheMesh.castShadow = true; nicheMesh.receiveShadow = true;
                    extraMeshes.push(nicheMesh);
                }
            }
        });
        return wallShape;
    }
}