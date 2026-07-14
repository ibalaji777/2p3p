import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from '../../core/registry';

export class FurnitureManager {
    constructor(ctx) { this.ctx = ctx; }

    async load(entity) {
        const config = FURNITURE_REGISTRY[entity.configId || (entity.config && entity.config.id)];
        if (!config) return;

        try {
            const wrapper = new THREE.Group();
            let size, center;
            
            if (config.procedural) {
                const w = entity.width || 240;
                const d = entity.depth || 60;
                const type = config.id || 'kitchen_straight';
                
                const cBase = entity.colorBase || '#334155';
                const cDoor = entity.colorDoor || '#475569';
                const cHandle = entity.colorHandle || '#ffffff';

                const matBase = new THREE.MeshStandardMaterial({ color: cBase, roughness: 0.9 }); 
                const matToe = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                const matTop = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1 }); 
                const matDoor = new THREE.MeshStandardMaterial({ color: cDoor, roughness: 0.5 });
                const matUpper = new THREE.MeshStandardMaterial({ color: cDoor, roughness: 0.4 }); 
                const matHandle = new THREE.MeshStandardMaterial({ color: cHandle, roughness: 0.2, metalness: 0.8 }); 
                
                const buildRow = (len, dep, rowType) => {
                    const row = new THREE.Group();
                    if (len <= 0) return row;
                    const numMods = Math.max(1, Math.round(len / 60));
                    const modW = len / numMods;
                    
                    if (rowType === 'base') {
                        const bH = 90, tThick = 4, toeH = 10, toeRecess = 5;
                        const toe = new THREE.Mesh(new THREE.BoxGeometry(len, toeH, dep - toeRecess), matToe);
                        toe.position.set(len/2, toeH/2, (dep - toeRecess)/2);
                        row.add(toe);
                        
                        const top = new THREE.Mesh(new THREE.BoxGeometry(len, tThick, dep + 2), matTop);
                        top.position.set(len/2, bH - tThick/2, (dep + 2)/2);
                        row.add(top);
                        
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const cabH = bH - tThick - toeH;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, cabH, dep - 2), matBase);
                            body.position.set(X, toeH + cabH/2, (dep - 2)/2);
                            
                            const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                            door.position.set(X, toeH + cabH/2, dep - 2 + 0.9);
                            
                            const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                            handle.position.set(X, toeH + cabH - 10, dep - 2 + 1.8 + 1.5);
                            row.add(body, door, handle);
                        }
                    } else {
                        const uH = 70;
                        const yStart = 0; 
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, uH, dep - 2), matBase);
                            body.position.set(X, yStart + uH/2, (dep - 2)/2);
                            
                            const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, uH - 0.4, 1.8), matUpper);
                            door.position.set(X, yStart + uH/2, dep - 2 + 0.9);
                            
                            const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                            handle.position.set(X, yStart + 10, dep - 2 + 1.8 + 1.5);
                            row.add(body, door, handle);
                        }
                    }
                    return row;
                };

                const innerGroup = new THREE.Group();
                
                if (!type.endsWith('_upper')) {
                    const backBase = buildRow(w, 60, 'base');
                    innerGroup.add(backBase);
                    
                    if (type === 'kitchen_l_shape' || type === 'kitchen_u_shape') {
                        const leftBase = buildRow(d - 60, 60, 'base');
                        leftBase.rotation.y = Math.PI / 2;
                        leftBase.position.set(0, 0, d);
                        innerGroup.add(leftBase);
                    }
                    
                    if (type === 'kitchen_u_shape') {
                        const rightBase = buildRow(d - 60, 60, 'base');
                        rightBase.rotation.y = -Math.PI / 2;
                        rightBase.position.set(w, 0, 60);
                        innerGroup.add(rightBase);
                    }
                } else {
                    const backUpper = buildRow(w, 35, 'upper');
                    innerGroup.add(backUpper);
                    
                    if (type.includes('l_shape') || type.includes('u_shape')) {
                        const leftUpper = buildRow(d - 35, 35, 'upper');
                        leftUpper.rotation.y = Math.PI / 2;
                        leftUpper.position.set(0, 0, d);
                        innerGroup.add(leftUpper);
                    }
                    
                    if (type.includes('u_shape')) {
                        const rightUpper = buildRow(d - 35, 35, 'upper');
                        rightUpper.rotation.y = -Math.PI / 2;
                        rightUpper.position.set(w, 0, 35);
                        innerGroup.add(rightUpper);
                    }
                }
                
                innerGroup.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
                
                const box = new THREE.Box3().setFromObject(innerGroup);
                size = box.getSize(new THREE.Vector3());
                center = box.getCenter(new THREE.Vector3());
                innerGroup.position.set(-center.x, -box.min.y, -center.z);
                wrapper.add(innerGroup);
            } else {
                const model = await this.ctx.assets.getModel(config);
                const gltfScene = model.clone();
                
                gltfScene.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
                    }
                });

                wrapper.add(gltfScene);
                
                const box = new THREE.Box3().setFromObject(gltfScene);
                size = box.getSize(new THREE.Vector3());
                center = box.getCenter(new THREE.Vector3());
                gltfScene.position.set(-center.x, -box.min.y, -center.z);
            }

            const hitBox = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
            hitBox.position.set(0, size.y / 2, 0);
            hitBox.userData = { isHitbox: true };
            wrapper.add(hitBox);

            wrapper.traverse((child) => { 
                if (child.isMesh && !child.userData.isHitbox) { child.castShadow = true; child.receiveShadow = true; this.ctx.interactables.push(child); } 
            });

            const safeW = size.x > 0 ? size.x : 1, safeH = size.y > 0 ? size.y : 1, safeD = size.z > 0 ? size.z : 1;
            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            this.ctx.interactables.push(hitBox);
            this.ctx.structureGroup.add(wrapper);
            this.updateLive(entity);

            if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity === entity) {
                this.ctx.interactions.selectObject(wrapper);
            }
        } catch (e) { console.error(e); }
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D || this.ctx.isUpdatingFrom3D) return;
        this.ctx.isUpdatingFromUI = true;
        const obj = entity.mesh3D;
        obj.position.set(entity.group ? entity.group.x() : entity.x, entity.elevation || 0, entity.group ? entity.group.y() : entity.z);
        obj.rotation.set(
            entity.rotationX || 0,
            -(entity.rotation || 0) * (Math.PI / 180),
            entity.rotationZ || 0,
            'YXZ'
        );
        const origSize = obj.userData.originalSize;
        obj.scale.set(entity.width / origSize.x, entity.height / origSize.y, entity.depth / origSize.z);
        obj.updateMatrixWorld();
        this.ctx.isUpdatingFromUI = false;
    }
}