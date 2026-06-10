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
            configId: configId,
            side: side,
            localX: 50, localY: 50, localZ: 0,
            width: 100, height: 100,
            depth: config.defaultDepth || 0.2,
            tileSize: config.defaultTileSize || 40,
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
        const wallH = wallEntity.height || wallEntity.config?.height || WALL_HEIGHT;
        const d = entity.depth;
        const isFront = entity.side === 'front';

        const w = wallEntity.length3D * (entity.width / 100);
        const h = wallH * (entity.height / 100);

        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) posX = wallEntity.length3D - posX;
        const posY = wallH * (entity.localY / 100);

        const shape = new THREE.Shape();
        shape.moveTo(-w/2, -h/2);
        shape.lineTo(w/2, -h/2);
        shape.lineTo(w/2, h/2);
        shape.lineTo(-w/2, h/2);
        shape.lineTo(-w/2, -h/2);

        wallEntity.attachedWidgets.forEach(widg => {
            const wCenter = wallEntity.length3D * widg.t;
            const halfW = widg.width / 2;
            const wx_min = wCenter - halfW;
            const wx_max = wCenter + halfW;
            const type = widg.type || widg.configId;
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
            
            let cut_iy_min = local_wy_min;
            if (Math.abs(cut_iy_min - (-h/2)) < 0.1) cut_iy_min -= 1;

            const hole = new THREE.Path();
            const hCenter = (local_wx_min + local_wx_max) / 2;
            const halfW_hole = (local_wx_max - local_wx_min) / 2;
            const hole_h = local_wy_max - local_wy_min;
            const yMid = local_wy_min + hole_h / 2;
            const yMax = local_wy_max;

            if (type === 'arch_opening') {
                const radius = halfW_hole;
                const straightH = Math.max(0, hole_h - radius);
                hole.moveTo(local_wx_min, cut_iy_min);
                hole.lineTo(local_wx_max, cut_iy_min);
                hole.lineTo(local_wx_max, local_wy_min + straightH);
                if (radius > 0) hole.absarc(hCenter, local_wy_min + straightH, radius, 0, Math.PI, false);
                else hole.lineTo(local_wx_min, local_wy_min + straightH);
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
                    const tX = wallX / wallEntity.length3D;
                    const shearedWallX = startX + tX * (endX - startX);
                    const newVx = isFront ? (shearedWallX - posX) : (posX - shearedWallX);
                    pos.setX(i, newVx);
                }
                boxMesh.geometry.computeVertexNormals();
                boxMesh.geometry.computeBoundingBox();
                boxMesh.geometry.computeBoundingSphere();
            }
            // ===============================================
        }
        

        const hitbox = object.children.find(c => c.userData && c.userData.isHitbox);
        if (hitbox) { hitbox.geometry.dispose(); hitbox.geometry = new THREE.BoxGeometry(w, h, d); hitbox.position.z = (t / 2 + d / 2) + (entity.localZ || 0); }

        const texture = object.userData.texture;
        let matFront = new THREE.MeshBasicMaterial({ visible: false });
        let matSide = new THREE.MeshBasicMaterial({ visible: false });

        if (texture) {
            const tileSize = entity.tileSize || 1;
            let texFront = texture.clone(); texFront.wrapS = texFront.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texFront.colorSpace = THREE.SRGBColorSpace;
            texFront.repeat.set(1 / tileSize, 1 / tileSize);
            matFront = new THREE.MeshStandardMaterial({ map: texFront, color: 0xffffff });

            let texSide = texture.clone(); texSide.wrapS = texSide.wrapT = THREE.RepeatWrapping; if (THREE.SRGBColorSpace) texSide.colorSpace = THREE.SRGBColorSpace;
            texSide.repeat.set(1 / tileSize, 1 / tileSize);
            matSide = new THREE.MeshStandardMaterial({ map: texSide, color: 0xffffff });
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
