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
            
            if (config.procedural && config.id && config.id.startsWith('kitchen_')) {
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
                const matSink = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.2 });
                const matTap = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.1 });
                
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
            } else if (config.procedural && config.id && config.id.startsWith('sink_')) {
                const sW = entity.width || 60;
                const sD = entity.depth || 45;
                const sH = entity.height || 20;
                
                const buildSinkBasin = (w, d, h, isDouble = false, isFarmhouse = false) => {
                    const group = new THREE.Group();
                    const mSink = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.2 });
                    const mDrain = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                    
                    const t = 3, r = 5;
                    const shape = new THREE.Shape();
                    shape.moveTo(-w/2, -d/2); shape.lineTo(w/2, -d/2); shape.lineTo(w/2, d/2); shape.lineTo(-w/2, d/2); shape.lineTo(-w/2, -d/2);
                    
                    const makeHole = (hW, hD, offsetX) => {
                        const hole = new THREE.Path();
                        hole.moveTo(-hW+r+offsetX, -hD);
                        hole.lineTo(hW-r+offsetX, -hD);
                        hole.quadraticCurveTo(hW+offsetX, -hD, hW+offsetX, -hD+r);
                        hole.lineTo(hW+offsetX, hD-r);
                        hole.quadraticCurveTo(hW+offsetX, hD, hW-r+offsetX, hD);
                        hole.lineTo(-hW+r+offsetX, hD);
                        hole.quadraticCurveTo(-hW+offsetX, hD, -hW+offsetX, hD-r);
                        hole.lineTo(-hW+offsetX, -hD+r);
                        hole.quadraticCurveTo(-hW+offsetX, -hD, -hW+r+offsetX, -hD);
                        return hole;
                    };

                    if (isDouble) {
                        const basinW = w/2 - t*1.5;
                        shape.holes.push(makeHole(basinW, d/2 - t, -w/4 - t/4));
                        shape.holes.push(makeHole(basinW, d/2 - t, w/4 + t/4));
                    } else {
                        shape.holes.push(makeHole(w/2 - t, d/2 - t, 0));
                    }

                    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.8, bevelThickness: 0.8 });
                    rimGeo.rotateX(-Math.PI/2); // Extrude upwards (+Y) so it sits ON the counter as a Vessel Sink
                    const rim = new THREE.Mesh(rimGeo, mSink);
                    group.add(rim);

                    const botGeo = new THREE.BoxGeometry(w - t*1.5, 1, d - t*1.5);
                    const bot = new THREE.Mesh(botGeo, mSink);
                    bot.position.y = 0.5;
                    group.add(bot);

                    const drain = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.5, 32), mDrain);
                    drain.position.set(isDouble ? w/4 : 0, 1, 0);
                    group.add(drain);
                    
                    if (isDouble) {
                        const drain2 = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.5, 32), mDrain);
                        drain2.position.set(-w/4, 1, 0);
                        group.add(drain2);
                    }

                    if (isFarmhouse) {
                        const apron = new THREE.Mesh(new THREE.BoxGeometry(w + 4, h + 2, t*4), mSink);
                        apron.position.set(0, h/2 - 1, d/2);
                        group.add(apron);
                    }
                    return group;
                };

                const basin = buildSinkBasin(sW, sD, sH, config.id === 'sink_double', config.id === 'sink_farmhouse');
                wrapper.add(basin);
                
                const box = new THREE.Box3().setFromObject(wrapper);
                size = box.getSize(new THREE.Vector3());
                center = box.getCenter(new THREE.Vector3());
            } else if (config.procedural && config.id && config.id.startsWith('tap_')) {
                const sW = entity.width || 15;
                const sH = entity.height || 35;
                const sD = entity.depth || 20;

                const tapGroup = new THREE.Group();
                const mTap = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.1 });
                
                if (config.id === 'tap_modern') {
                    const path = new THREE.CatmullRomCurve3([
                        new THREE.Vector3(0, 0, 0),
                        new THREE.Vector3(0, 15, 0),
                        new THREE.Vector3(0, 25, 5),
                        new THREE.Vector3(0, 25, 15),
                        new THREE.Vector3(0, 20, 18)
                    ]);
                    const tube = new THREE.Mesh(new THREE.TubeGeometry(path, 20, 1.2, 16, false), mTap);
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 4, 32), mTap); base.position.y = 2;
                    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 6, 16), mTap); handle.position.set(3, 8, 0); handle.rotation.z = -Math.PI/4;
                    const hBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 2, 16), mTap); hBase.position.set(2, 8, 0); hBase.rotation.z = Math.PI/2;
                    tapGroup.add(tube, base, handle, hBase);
                } else if (config.id === 'tap_industrial') {
                    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.5, 10, 32), mTap); fBase.position.set(0, 5, 0);
                    const fPipe = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 28, 16), mTap); fPipe.position.set(0, 24, 0);
                    const fSpring = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 16, 32), mTap); fSpring.rotation.x = Math.PI/2; fSpring.position.set(0, 18, 0);
                    const fSpring2 = new THREE.Mesh(new THREE.TorusGeometry(3, 0.6, 16, 32), mTap); fSpring2.rotation.x = Math.PI/2; fSpring2.position.set(0, 21, 0);
                    const fSpout = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.5, 10, 16), mTap); fSpout.rotation.x = Math.PI/4; fSpout.position.set(0, 32, 10);
                    tapGroup.add(fBase, fPipe, fSpring, fSpring2, fSpout);
                } else if (config.id === 'tap_classic') {
                    const fBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 6, 32), mTap); fBase.position.set(0, 3, 0);
                    const fPipe = new THREE.Mesh(new THREE.TorusGeometry(8, 1.2, 16, 32, Math.PI), mTap); fPipe.position.set(0, 6, 8); fPipe.rotation.y = Math.PI/2;
                    const hL = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 5, 16), mTap); hL.position.set(-6, 2.5, 0);
                    const hLTop = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1), mTap); hLTop.position.set(-6, 5, 0);
                    const hR = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 5, 16), mTap); hR.position.set(6, 2.5, 0);
                    const hRTop = new THREE.Mesh(new THREE.BoxGeometry(4, 1, 1), mTap); hRTop.position.set(6, 5, 0);
                    tapGroup.add(fBase, fPipe, hL, hLTop, hR, hRTop);
                }

                // Uniform scale to prevent distortion
                const baseBox = new THREE.Box3().setFromObject(tapGroup);
                const bSize = baseBox.getSize(new THREE.Vector3());
                const uniformScale = Math.min(sW / bSize.x, sH / bSize.y, sD / bSize.z);
                tapGroup.scale.setScalar(uniformScale);
                
                // Center and place at bottom
                const finalBox = new THREE.Box3().setFromObject(tapGroup);
                const fCenter = finalBox.getCenter(new THREE.Vector3());
                tapGroup.position.set(-fCenter.x, -finalBox.min.y, -fCenter.z);
                
                // Enforce exact bounding box with invisible corners so updateLive doesn't distort it
                const invMat = new THREE.MeshBasicMaterial({ visible: false });
                const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), invMat);
                corner1.position.set(-sW/2, 0, -sD/2);
                const corner2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), invMat);
                corner2.position.set(sW/2, sH, sD/2);
                
                wrapper.add(tapGroup, corner1, corner2);
                const box = new THREE.Box3().setFromObject(wrapper);
                size = box.getSize(new THREE.Vector3());
                center = box.getCenter(new THREE.Vector3());
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