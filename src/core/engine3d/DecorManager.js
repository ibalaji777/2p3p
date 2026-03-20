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

        const w = wallEntity.length3D * (entity.width / 100);
        const h = WALL_HEIGHT * (entity.height / 100);
        const cylRadius = (t / 2) + d;

        let posX = wallEntity.length3D * (entity.localX / 100);
        if (!isFront) posX = wallEntity.length3D - posX;
        const posY = WALL_HEIGHT * (entity.localY / 100);

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
            const wy_min = type === 'door' ? 0 : WINDOW_SILL;
            const wy_max = type === 'door' ? DOOR_HEIGHT : WINDOW_SILL + WINDOW_HEIGHT;

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

            const ix_min = Math.max(local_wx_min, -w/2);
            const ix_max = Math.min(local_wx_max, w/2);
            const iy_min = Math.max(local_wy_min, -h/2);
            const iy_max = Math.min(local_wy_max, h/2);

            if (ix_min < ix_max && iy_min < iy_max) {
                const hole = new THREE.Path();
                hole.moveTo(ix_min, iy_min); 
                hole.lineTo(ix_max, iy_min); 
                hole.lineTo(ix_max, iy_max); 
                hole.lineTo(ix_min, iy_max); 
                hole.lineTo(ix_min, iy_min);
                shape.holes.push(hole);
            }
        });

        const boxMesh = object.children.find(c => c.userData.isPatternBox);
        if (boxMesh) { 
            boxMesh.geometry.dispose(); 
            boxMesh.geometry = new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }); 
            boxMesh.position.z = (t / 2 + d / 2) + 0.05 + (entity.localZ || 0); 
            boxMesh.geometry.translate(0, 0, -d/2);
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
            const tileSize = entity.tileSize || 1;
            
            let texFront = texture.clone(); 
            texFront.wrapS = texFront.wrapT = THREE.RepeatWrapping; 
            if (THREE.SRGBColorSpace) texFront.colorSpace = THREE.SRGBColorSpace;
            texFront.repeat.set(1 / tileSize, 1 / tileSize);
            matFront = new THREE.MeshStandardMaterial({ map: texFront, color: 0xffffff });

            let texSide = texture.clone(); 
            texSide.wrapS = texSide.wrapT = THREE.RepeatWrapping; 
            if (THREE.SRGBColorSpace) texSide.colorSpace = THREE.SRGBColorSpace;
            texSide.repeat.set(1 / tileSize, 1 / tileSize);
            matSide = new THREE.MeshStandardMaterial({ map: texSide, color: 0xffffff });

            let cylTex = texture.clone(); 
            cylTex.wrapS = cylTex.wrapT = THREE.RepeatWrapping; 
            if (THREE.SRGBColorSpace) cylTex.colorSpace = THREE.SRGBColorSpace;
            cylTex.repeat.set((Math.PI * cylRadius) / tileSize, h / tileSize);
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