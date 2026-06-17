import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, WALL_DECOR_REGISTRY } from '../registry.js';

export class DecorManager {
    // SOLID: Dependency Injection. We only pass the specific tools this manager needs.
    constructor(assets, interactables) { 
        this.assets = assets; 
        this.interactables = interactables;
        this.isPreview = false;
    }

    setPreviewMode(isPreview) { 
        this.isPreview = isPreview; 
    }

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

        const texture = await this.assets.getTexture(config);
        const clonedTexture = texture.clone();
        clonedTexture.needsUpdate = true;

        const wrapper = new THREE.Group();
        const matDefaults = Array(6).fill(new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        
        const boxMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), matDefaults);
        boxMesh.userData = { isPatternBox: true };
        
        const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 32, 1, true);
        const leftCyl = new THREE.Mesh(cylGeo, new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        leftCyl.userData = { isLeftCyl: true };
        
        const rightCyl = new THREE.Mesh(cylGeo.clone(), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
        rightCyl.userData = { isRightCyl: true };

        const hitBox = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
        hitBox.userData = { isHitbox: true };

        wrapper.add(boxMesh, leftCyl, rightCyl, hitBox);
        wrapper.traverse(c => { 
            if (c.isMesh && !c.userData.isHitbox) { 
                c.castShadow = true; 
                c.receiveShadow = true; 
                if (!this.isPreview) this.interactables.push(c); 
            }
        });
        
        wrapper.userData = { isWallDecor: true, entity: decor, parentWall: wallEntity, texture: clonedTexture };
        decor.mesh3D = wrapper;
        
        if (!this.isPreview) this.interactables.push(hitBox);
        
        wallEntity.mesh3D.add(wrapper);
        this.updateLive(decor);
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D) return;
        const object = entity.mesh3D;
        const wallEntity = object.userData.parentWall;

        const t = wallEntity.config.thickness;
        const d = entity.depth;
        const isFront = entity.side === 'front';

        const wallHeight = wallEntity.config?.height || wallEntity.height || WALL_HEIGHT;

        const w = wallEntity.length3D * (entity.width / 100);
        const h = wallHeight * (entity.height / 100);
        const cylRadius = (t / 2) + d;

        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) posX = wallEntity.length3D - posX;
        const posY = wallHeight * (entity.localY / 100);

        const shape = new THREE.Shape();
        shape.moveTo(-w/2, -h/2);
        shape.lineTo(w/2, -h/2);
        shape.lineTo(w/2, h/2);
        shape.lineTo(-w/2, h/2);
        shape.lineTo(-w/2, -h/2);

        wallEntity.attachedWidgets.forEach(widg => {
            const wCenter = wallEntity.length3D * widg.t;
            const halfW = widg.width / 2;
            const type = widg.type || widg.configId; // Handle both Konva and JSON formats
            
            const wx_min = wCenter - halfW;
            const wx_max = wCenter + halfW;
            
            let h_opening = widg.height; if (h_opening === undefined) h_opening = (type === 'door') ? DOOR_HEIGHT : ((type === 'window') ? WINDOW_HEIGHT : 200);
            let elev = widg.elevation; if (elev === undefined) elev = (type === 'window') ? WINDOW_SILL : 0;
            elev = Math.max(0.2, Math.min(elev, wallHeight)); // Ensure hole starts at least at floor level (0.2)
            h_opening = Math.max(0, Math.min(h_opening, wallHeight - elev));
            
            const wy_min = elev;
            const wy_max = elev + h_opening;

            let local_wx_min, local_wx_max;
            if (isFront) { 
                local_wx_min = wx_min - posX; 
                local_wx_max = wx_max - posX; 
            } else { 
                local_wx_min = -(wx_max - posX); 
                local_wx_max = -(wx_min - posX); 
            }
            
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
            boxMesh.position.z = (t / 2 + d / 2) + 0.05 + (entity.localZ || 0); 
            boxMesh.geometry.translate(0, 0, -d/2);

            // Manually generate UVs for the main decor face to respect openings and ensure continuous texture.
            // This applies a planar mapping based on the wall's absolute coordinate system.
            const positions = boxMesh.geometry.attributes.position;
            const normals = boxMesh.geometry.attributes.normal;
            const uvs = boxMesh.geometry.attributes.uv;
            const TILE_SIZE = entity.tileSize || 40;

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
        
        const leftCyl = object.children.find(c => c.userData.isLeftCyl);
        if (leftCyl) { 
            leftCyl.geometry.dispose(); 
            leftCyl.geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32, 1, true, Math.PI, Math.PI); 
        }
        
        const rightCyl = object.children.find(c => c.userData.isRightCyl);
        if (rightCyl) { 
            rightCyl.geometry.dispose(); 
            rightCyl.geometry = new THREE.CylinderGeometry(cylRadius, cylRadius, h, 32, 1, true, 0, Math.PI); 
        }

        const hitbox = object.children.find(c => c.userData && c.userData.isHitbox);
        if (hitbox) { 
            hitbox.geometry.dispose(); 
            hitbox.geometry = new THREE.BoxGeometry(w, h, d); 
            hitbox.position.z = (t / 2 + d / 2) + (entity.localZ || 0); 
        }

        const texture = object.userData.texture;
        let matFront = new THREE.MeshBasicMaterial({ visible: false });
        let matSide = new THREE.MeshBasicMaterial({ visible: false });
        let sharedCylMaterial = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });

        if (texture) {
            const TILE_SIZE = entity.tileSize || 40;
            
            let texFront = texture.clone(); 
            texFront.wrapS = texFront.wrapT = THREE.RepeatWrapping; 
            if (THREE.SRGBColorSpace) texFront.colorSpace = THREE.SRGBColorSpace;
            texFront.repeat.set(1, 1); // Repeat is 1x1 because tiling is handled by the UV coordinates.
            matFront = new THREE.MeshStandardMaterial({ map: texFront, color: 0xffffff });
            
            // For the side faces (including inside the openings), use a solid color
            // This prevents stretching of the main texture inside the cutouts.
            // Using MeshBasicMaterial ensures no lighting/reflection artifacts appear on the inside surfaces.
            // This provides a clean, solid color for the "cut" part of the decor.
            matSide = new THREE.MeshBasicMaterial({ color: 0x888888 });

            let cylTex = texture.clone(); 
            cylTex.wrapS = cylTex.wrapT = THREE.RepeatWrapping; 
            if (THREE.SRGBColorSpace) cylTex.colorSpace = THREE.SRGBColorSpace;
            cylTex.repeat.set((Math.PI * cylRadius) / TILE_SIZE, h / TILE_SIZE);
            sharedCylMaterial = new THREE.MeshStandardMaterial({ map: cylTex, color: 0xffffff });
        } else {
            matFront = new THREE.MeshStandardMaterial({ color: 0xe5e7eb });
            matSide = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        }

        if (boxMesh) { 
            if (Array.isArray(boxMesh.material)) {
                boxMesh.material.forEach(m => { if(m.map) m.map.dispose(); m.dispose(); }); 
            }
            boxMesh.material = [matFront, matSide]; 
        }

        if (leftCyl) { 
            leftCyl.material = sharedCylMaterial; 
            leftCyl.visible = entity.faces.left !== false; 
            leftCyl.position.set(-w / 2, 0, 0); 
        }
        if (rightCyl) { 
            rightCyl.material = sharedCylMaterial; 
            rightCyl.visible = entity.faces.right !== false; 
            rightCyl.position.set(w / 2, 0, 0); 
        }

        object.position.set(posX, posY, 0);
        object.rotation.y = isFront ? 0 : Math.PI;
    }
}