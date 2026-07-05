import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from '../../core/registry';

export class DecorManager {
    constructor(ctx) { this.ctx = ctx; }

    add(wallEntity, configId, side) {
        const config = WALL_DECOR_REGISTRY[configId];
        if (!config) return null;
        if (!wallEntity.attachedDecor) wallEntity.attachedDecor = [];
        
        const decor = {
            id: 'decor_' + Math.random().toString(36).substr(2, 9),
            type: 'wallDecor',
            configId: configId,
            side: side,
            localX: 50, localY: 50, localZ: 0,
            width: 100, height: 100,
            depth: config.defaultDepth || 0.2,
            tileSize: config.defaultTileSize || 70,
            faces: { front: true, back: false, left: true, right: true } 
        };
        
        wallEntity.attachedDecor.push(decor);
        this.load(wallEntity, decor);
        return decor;
    }

    async load(wallEntity, decor) {
        const config = WALL_DECOR_REGISTRY[decor.configId];
        if (!config) return;

        const texture = await this.ctx.assets.getTexture(config);
        const clonedTexture = texture.clone();
        clonedTexture.needsUpdate = true;

        const wrapper = new THREE.Group();
        const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), []);
        boxMesh.userData = { isPatternBox: true };
        

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
        hitBox.userData = { isHitbox: true };

        wrapper.add(boxMesh, hitBox);
        wrapper.traverse(c => { 
            if (c.isMesh && !c.userData.isHitbox) { 
                c.castShadow = true; c.receiveShadow = true; 
                if (this.ctx.viewMode3D !== 'preview' && !c.userData.isWallDecor) this.ctx.interactables.push(c); 
            }
        });
        
        wrapper.userData = { isWallDecor: true, entity: decor, parentWall: wallEntity, texture: clonedTexture };
        decor.mesh3D = wrapper;
        
        if (this.ctx.viewMode3D !== 'preview') this.ctx.interactables.push(hitBox);
        
        wallEntity.mesh3D.add(wrapper);
        this.updateLive(decor);
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D) return;
        const object = entity.mesh3D;
        const wallEntity = object.userData.parentWall;

        const t = wallEntity.thickness || wallEntity.config?.thickness || 8;
        const type = wallEntity.topProfileType || 'normal';
        
        let baseWallH = wallEntity.height !== undefined ? wallEntity.height : (wallEntity.config?.height || WALL_HEIGHT);
        const startH = wallEntity.startHeight !== undefined ? wallEntity.startHeight : baseWallH;
        const endH = wallEntity.endHeight !== undefined ? wallEntity.endHeight : baseWallH;
        const peakH = wallEntity.peakHeight !== undefined ? wallEntity.peakHeight : baseWallH;
        
        // For gable/single slopes, use the true highest point to bound the material mapping
        const wallH = type !== 'normal' ? Math.max(startH, endH, peakH, baseWallH) : baseWallH;

        const d = entity.depth;
        const isFront = entity.side === 'front';

        const w = wallEntity.length3D * (entity.width / 100);
        const h = wallH * (entity.height / 100);

        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) posX = wallEntity.length3D - posX;
        const posY = wallH * (entity.localY / 100);

        const L = wallEntity.length3D;
        
        const getWallHeightAt = (x) => {
            if (type === 'normal') return wallH;
            if (type === 'single') return startH + (x / L) * (endH - startH);
            if (type === 'gable') {
                if (x <= L / 2) return startH + (x / (L / 2)) * (peakH - startH);
                return peakH + ((x - L / 2) / (L / 2)) * (endH - peakH);
            }
            return wallH;
        };

        const wallX_left = isFront ? (posX - w/2) : (posX + w/2);
        const wallX_right = isFront ? (posX + w/2) : (posX - w/2);

        const yLeft = Math.min(h/2, getWallHeightAt(wallX_left) - posY);
        const yRight = Math.min(h/2, getWallHeightAt(wallX_right) - posY);

        const shape = new THREE.Shape();
        shape.moveTo(-w/2, -h/2);
        shape.lineTo(w/2, -h/2);
        shape.lineTo(w/2, yRight);
        
        if (type === 'gable') {
            const wallX_peak = L / 2;
            const minX = Math.min(wallX_left, wallX_right);
            const maxX = Math.max(wallX_left, wallX_right);
            if (wallX_peak > minX + 0.1 && wallX_peak < maxX - 0.1) {
                const localX_peak = isFront ? (wallX_peak - posX) : (posX - wallX_peak);
                const yPeak = Math.min(h/2, peakH - posY);
                shape.lineTo(localX_peak, yPeak);
            }
        }
        
        shape.lineTo(-w/2, yLeft);
        shape.lineTo(-w/2, -h/2);

        wallEntity.attachedWidgets.forEach(widg => {
            const wCenter = wallEntity.length3D * widg.t;
            const halfW = widg.width / 2;
            const wx_min = wCenter - halfW;
            const wx_max = wCenter + halfW;
            const type = widg.type || widg.configId;
            
            if (type === 'elevation_fascia' || type === 'niche_recess' || type === 'sunshade') return;
            
            let h_opening = widg.height;
            if (h_opening === undefined) h_opening = (type === 'door') ? DOOR_HEIGHT : ((type === 'window') ? WINDOW_HEIGHT : 200);
            let elev = widg.elevation;
            if (elev === undefined) elev = (type === 'window') ? WINDOW_SILL : 0;
            
            elev = Math.max(0, Math.min(elev, wallH));
            h_opening = Math.max(0, Math.min(h_opening, wallH - elev));
            
            const wy_min = elev;
            const wy_max = elev + h_opening;

            if (wy_min === wy_max) return;

            let local_wx_min, local_wx_max;
            if (isFront) { local_wx_min = wx_min - posX; local_wx_max = wx_max - posX; } 
            else { local_wx_min = -(wx_max - posX); local_wx_max = -(wx_min - posX); }
            
            const local_wy_min = wy_min - posY;
            const local_wy_max = wy_max - posY;

            if (local_wx_max <= -w/2 || local_wx_min >= w/2 || local_wy_max <= -h/2 || local_wy_min >= h/2) return;
            
            // Constrain hole to decor boundaries to prevent Earcut triangulation failures
            local_wx_min = Math.max(-w/2, local_wx_min);
            local_wx_max = Math.min(w/2, local_wx_max);
            const cut_iy_min = Math.max(-h/2, local_wy_min);
            const yMax = Math.min(h/2, local_wy_max);

            const hole = new THREE.Path();
            const hCenter = (local_wx_min + local_wx_max) / 2;
            const halfW_hole = (local_wx_max - local_wx_min) / 2;
            const hole_h = yMax - cut_iy_min;
            const yMid = cut_iy_min + hole_h / 2;

            if (type === 'arch_opening') {
                const radius = halfW_hole;
                const straightH = Math.max(0, hole_h - radius);
                hole.moveTo(local_wx_min, cut_iy_min);
                hole.lineTo(local_wx_max, cut_iy_min);
                hole.lineTo(local_wx_max, cut_iy_min + straightH);
                if (radius > 0) hole.absarc(hCenter, cut_iy_min + straightH, radius, 0, Math.PI, false);
                else hole.lineTo(local_wx_min, cut_iy_min + straightH);
                hole.lineTo(local_wx_min, cut_iy_min);
            } else if (type === 'circular_opening') {
                hole.moveTo(local_wx_max, yMid);
                hole.absellipse(hCenter, yMid, halfW_hole, hole_h / 2, 0, Math.PI * 2, false, 0);
            } else if (type === 'custom_shape_opening') {
                hole.moveTo(hCenter, cut_iy_min);
                hole.lineTo(local_wx_max, yMid);
                hole.lineTo(hCenter, yMax);
                hole.lineTo(local_wx_min, yMid);
                hole.lineTo(hCenter, cut_iy_min);
            } else {
                hole.moveTo(local_wx_min, cut_iy_min); 
                hole.lineTo(local_wx_max, cut_iy_min); 
                hole.lineTo(local_wx_max, yMax); 
                hole.lineTo(local_wx_min, yMax); 
                hole.lineTo(local_wx_min, cut_iy_min);
            }
            shape.holes.push(hole);
        });

        const boxMesh = object.children.find(c => c.userData.isPatternBox);
        if (boxMesh) { 
            boxMesh.geometry.dispose(); 
            boxMesh.geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }); 
            const decorLocalZ = (t / 2 + d / 2) + 0.05 + (entity.localZ || 0);
            boxMesh.position.z = decorLocalZ; 
            boxMesh.geometry.translate(0, 0, -d/2);
            
            // ====== MITER JOINT SHEARING FOR TEXTURES ======
            const pts = (wallEntity.poly && typeof wallEntity.poly.points === 'function') ? wallEntity.poly.points() : wallEntity.pts;
            if (pts && pts.length === 8) {
                const p1 = wallEntity.startAnchor ? wallEntity.startAnchor.position() : {x: wallEntity.startX, y: wallEntity.startY};
                const p2 = wallEntity.endAnchor ? wallEntity.endAnchor.position() : {x: wallEntity.endX, y: wallEntity.endY};
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                
                const toLocalX = (ptX, ptY) => {
                    const dx_pt = ptX - p1.x;
                    const dy_pt = ptY - p1.y;
                    return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                };
                const localSL_x = toLocalX(pts[0], pts[1]);
                const localEL_x = toLocalX(pts[2], pts[3]);
                const localER_x = toLocalX(pts[4], pts[5]);
                const localSR_x = toLocalX(pts[6], pts[7]);
                
                const pos = boxMesh.geometry.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const vx = pos.getX(i);
                    const vz = pos.getZ(i);
                    const wallX = isFront ? (posX + vx) : (posX - vx);
                    const wallZ = isFront ? (decorLocalZ + vz) : -(decorLocalZ + vz);
                    const tZ = (wallZ + t/2) / t;
                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                    const endX = localER_x + tZ * (localEL_x - localER_x);
                    
                    let shearedWallX = wallX;
                    if (wallX <= 0.1) {
                        shearedWallX = startX;
                    } else if (wallX >= wallEntity.length3D - 0.1) {
                        shearedWallX = endX;
                    }
                    
                    const newVx = isFront ? (shearedWallX - posX) : (posX - shearedWallX);
                    pos.setX(i, newVx);
                }
                boxMesh.geometry.computeVertexNormals();
                boxMesh.geometry.computeBoundingBox();
                boxMesh.geometry.computeBoundingSphere();
            }
            // ===============================================

            // Manually generate UVs for the main decor face to respect openings and ensure continuous texture.
            // This applies a planar mapping based on the wall's absolute coordinate system.
            const positions = boxMesh.geometry.attributes.position;
            const normals = boxMesh.geometry.attributes.normal;
            const uvs = boxMesh.geometry.attributes.uv;
            const config = WALL_DECOR_REGISTRY[entity.configId] || {};
            const scaleMult = config.scaleMultiplier || 1;
            const TILE_SIZE = (entity.tileSize || 70) * scaleMult;

            for (let i = 0; i < positions.count; i++) {
                // Only apply to front and back faces of the decor mesh (where normal is along the local Z-axis).
                if (Math.abs(normals.getZ(i)) > 0.99) {
                    // The decor mesh geometry is created relative to its own center.
                    // We offset by the decor's position on the wall (posX, posY) to get absolute coordinates for seamless mapping.
                    const worldX = isFront ? (posX + positions.getX(i)) : (posX - positions.getX(i));
                    const worldY = posY + positions.getY(i);
                    uvs.setXY(i, worldX / TILE_SIZE, worldY / TILE_SIZE);
                }
            }
            uvs.needsUpdate = true;
        }
        

        const hitbox = object.children.find(c => c.userData && c.userData.isHitbox);
        if (hitbox) { 
            hitbox.geometry.dispose(); 
            hitbox.geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }); 
            const decorLocalZ = (t / 2 + d / 2) + 0.05 + (entity.localZ || 0);
            hitbox.position.z = decorLocalZ;
            hitbox.geometry.translate(0, 0, -d/2);
        }

        const texture = object.userData.texture;
        let matFront = new THREE.MeshBasicMaterial({ visible: false });
        let matSide = new THREE.MeshBasicMaterial({ visible: false });

        if (texture) {
            const TILE_SIZE = entity.tileSize || 70;
            let texFront = texture.clone(); texFront.wrapS = texFront.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texFront.colorSpace = THREE.SRGBColorSpace;
            texFront.repeat.set(1, 1); // Repeat is 1x1 because tiling is handled by the UV coordinates.
            matFront = new THREE.MeshStandardMaterial({ map: texFront, color: 0xffffff });

            // For the side faces (including inside the openings), use a solid color
            // Using MeshBasicMaterial ensures no lighting/reflection artifacts appear on the inside surfaces.
            // This provides a clean, solid color for the "cut" part of the decor.
            matSide = new THREE.MeshBasicMaterial({ color: 0x888888 });
        } else {
            matFront = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });
            matSide = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        }

        if (boxMesh) { 
            if (Array.isArray(boxMesh.material)) boxMesh.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); }); 
            boxMesh.material = [matFront, matSide]; 
        }

        object.position.set(posX, posY, 0);
        object.rotation.y = isFront ? 0 : Math.PI;
    }
}
