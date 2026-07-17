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
                
                let cBase = entity.colorBase;
                let cDoor = entity.colorDoor;
                let cHandle = entity.colorHandle;
                
                let mBaseProps = { roughness: 0.9 };
                let mDoorProps = { roughness: 0.5 };
                let mUpperProps = { roughness: 0.4 };
                
                if (type === 'kitchen_straight_shaker') {
                    cBase = cBase || '#f8fafc'; // White base
                    cDoor = cDoor || '#f1f5f9'; // Soft Antique White doors
                    cHandle = cHandle || '#b45309'; // Premium Brass Handles
                } else if (type === 'kitchen_straight_floating') {
                    cBase = cBase || '#ffffff'; // Pure White
                    cDoor = cDoor || '#ffffff'; // Pure White
                    cHandle = cHandle || '#ffffff'; 
                    mDoorProps = { roughness: 0.1, metalness: 0.1 }; // High Gloss White finish
                } else if (type === 'kitchen_upper_glass') {
                    cBase = cBase || '#78350f'; // Warm Walnut Wood interior
                    cDoor = cDoor || '#F4F0EC'; // Creamy Warm White frame
                    cHandle = cHandle || '#D4AF37'; // Brushed Brass handles
                } else if (type === 'kitchen_upper_shelves') {
                    cBase = cBase || '#e6ccb2'; // Light Oak Wood shelves
                    cDoor = cDoor || '#e6ccb2';
                } else {
                    cBase = cBase || '#334155';
                    cDoor = cDoor || '#475569';
                    cHandle = cHandle || '#ffffff';
                }

                const matBase = new THREE.MeshStandardMaterial({ color: cBase, ...mBaseProps }); 
                const matToe = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                const matTop = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1 }); 
                const matDoor = new THREE.MeshStandardMaterial({ color: cDoor, ...mDoorProps });
                const matUpper = new THREE.MeshStandardMaterial({ color: cDoor, ...mUpperProps }); 
                const matHandle = new THREE.MeshStandardMaterial({ color: cHandle, roughness: 0.2, metalness: 0.8 }); 
                const matSink = new THREE.MeshStandardMaterial({ color: '#94a3b8', metalness: 0.8, roughness: 0.2 });
                const matTap = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.1 });
                
                const buildRow = (len, dep, rowType, style) => {
                    const row = new THREE.Group();
                    if (len <= 0) return row;
                    const numMods = Math.max(1, Math.round(len / 60));
                    const modW = len / numMods;
                    
                    if (rowType === 'base') {
                        const isFloating = style === 'kitchen_straight_floating';
                        const isShaker = style === 'kitchen_straight_shaker';
                        const bH = 90, toeH = isFloating ? 20 : 10, toeRecess = 5;
                        const tThick = isFloating ? 1.5 : (isShaker ? 5 : 4);
                        
                        if (!isFloating) {
                            const toe = new THREE.Mesh(new THREE.BoxGeometry(len, toeH, dep - toeRecess), matToe);
                            toe.position.set(len/2, toeH/2, (dep - toeRecess)/2);
                            row.add(toe);
                        } else {
                            // Floating LED strip
                            const led = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}));
                            led.position.set(len/2, toeH - 1, dep - 10);
                            row.add(led);
                        }
                        
                        const top = new THREE.Mesh(new THREE.BoxGeometry(len, tThick, dep + 2), matTop);
                        top.position.set(len/2, bH - tThick/2, (dep + 2)/2);
                        row.add(top);
                        
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const cabH = bH - tThick - toeH;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, cabH, dep - 2), matBase);
                            body.position.set(X, toeH + cabH/2, (dep - 2)/2);
                            
                            const doorGroup = new THREE.Group();
                            if (isShaker) {
                                // Shaker door simulation
                                const dFrame = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const dPanel = new THREE.Mesh(new THREE.BoxGeometry(modW - 12, cabH - 12, 1.9), matBase); // Recessed visual
                                doorGroup.add(dFrame, dPanel);
                                
                                // Elegant horizontal handlebar
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.5, 1.5, 3), matHandle);
                                handle.position.set(0, cabH/2 - 10, 2);
                                doorGroup.add(handle);
                            } else if (isFloating) {
                                // Flat minimalist, with sleek long handlebar
                                const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.7, 1.2, 2.5), matHandle);
                                handle.position.set(0, cabH/2 - 10, 2);
                                doorGroup.add(door, handle);
                            } else {
                                // Standard
                                const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                                handle.position.set(0, cabH/2 - 10, 2);
                                doorGroup.add(door, handle);
                            }
                            doorGroup.position.set(X, toeH + cabH/2, dep - 2 + 0.9);
                            
                            row.add(body, doorGroup);
                        }
                    } else {
                        const isGlass = style === 'kitchen_upper_glass';
                        const isShelves = style === 'kitchen_upper_shelves';
                        const uH = 70;
                        const yStart = 0; 

                        if (isShelves) {
                            const shelfThick = 4;
                            // Add Premium White Marble Backsplash
                            const mMarble = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1 });
                            const backsplash = new THREE.Mesh(new THREE.BoxGeometry(len, uH, 2), mMarble);
                            backsplash.position.set(len/2, yStart + uH/2, 1);
                            row.add(backsplash);
                            
                            for(let s=0; s<3; s++) {
                                const shelf = new THREE.Mesh(new THREE.BoxGeometry(len, shelfThick, dep - 2), matBase);
                                shelf.position.set(len/2, yStart + s * 30 + shelfThick/2, (dep - 2)/2 + 2);
                                row.add(shelf);
                                
                                // Under-shelf warm LED lighting
                                const led = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 0.5, 0.5), new THREE.MeshBasicMaterial({color: 0xffeedd}));
                                led.position.set(len/2, yStart + s * 30 - 0.25, 3);
                                row.add(led);
                            }
                        } else {
                            for(let i=0; i<numMods; i++) {
                                const X = i * modW + modW/2;
                                const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, uH, dep - 2), matBase);
                                body.position.set(X, yStart + uH/2, (dep - 2)/2);
                                
                                const doorGroup = new THREE.Group();
                                if (isGlass) {
                                    const dFrame = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, uH - 0.4, 1.8), matUpper);
                                    // Simulating fluted glass (rough, highly transmissive)
                                    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.95, opacity: 1, transparent: true, roughness: 0.4, ior: 1.5, thickness: 0.5 });
                                    const dGlass = new THREE.Mesh(new THREE.BoxGeometry(modW - 12, uH - 12, 1.9), glassMat);
                                    
                                    // Interior light
                                    const light = new THREE.PointLight(0xffeedd, 0.6, 100);
                                    light.position.set(X, yStart + uH - 5, dep/2);
                                    row.add(light);
                                    
                                    doorGroup.add(dFrame, dGlass);
                                    
                                    // Vertical sleek handlebar
                                    const handle = new THREE.Mesh(new THREE.BoxGeometry(1.2, uH * 0.5, 2.5), matHandle);
                                    handle.position.set(modW/2 - 8, -uH/2 + (uH * 0.5)/2 + 5, 2);
                                    doorGroup.add(handle);
                                } else {
                                    const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, uH - 0.4, 1.8), matUpper);
                                    const handle = new THREE.Mesh(new THREE.BoxGeometry(modW * 0.4, 1.5, 3), matHandle);
                                    handle.position.set(0, -uH/2 + 10, 2);
                                    doorGroup.add(door, handle);
                                }
                                doorGroup.position.set(X, yStart + uH/2, dep - 2 + 0.9);
                                
                                row.add(body, doorGroup);
                            }
                        }
                    }
                    return row;
                };

                const innerGroup = new THREE.Group();
                
                if (!type.includes('_upper')) {
                    const backBase = buildRow(w, d, 'base', type);
                    innerGroup.add(backBase);
                    
                    if (type === 'kitchen_l_shape' || type === 'kitchen_u_shape') {
                        const leftBase = buildRow(d - 60, 60, 'base', type);
                        leftBase.rotation.y = Math.PI / 2;
                        leftBase.position.set(0, 0, d);
                        innerGroup.add(leftBase);
                    }
                    
                    if (type === 'kitchen_u_shape') {
                        const rightBase = buildRow(d - 60, 60, 'base', type);
                        rightBase.rotation.y = -Math.PI / 2;
                        rightBase.position.set(w, 0, 60);
                        innerGroup.add(rightBase);
                    }
                } else {
                    const backUpper = buildRow(w, d, 'upper', type);
                    innerGroup.add(backUpper);
                    
                    if (type.includes('l_shape') || type.includes('u_shape')) {
                        const leftUpper = buildRow(d - 35, 35, 'upper', type);
                        leftUpper.rotation.y = Math.PI / 2;
                        leftUpper.position.set(0, 0, d);
                        innerGroup.add(leftUpper);
                    }
                    
                    if (type.includes('u_shape')) {
                        const rightUpper = buildRow(d - 35, 35, 'upper', type);
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
                
                const buildSinkBasin = (w, d, h, typeId) => {
                    const grp = new THREE.Group();
                    const isFarmhouse = typeId === 'sink_farmhouse';
                    const isDouble = typeId === 'sink_double';
                    const isStandard = typeId === 'sink_standard';
                    
                    // Premium Materials
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.85, roughness: 0.25 });
                    const mGunmetal = new THREE.MeshStandardMaterial({ color: '#475569', metalness: 0.8, roughness: 0.3 });
                    const mBlackCeramic = new THREE.MeshStandardMaterial({ color: '#0f172a', metalness: 0.1, roughness: 0.2 });
                    const mWood = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.9 });
                    const mBrass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.9, roughness: 0.2 });
                    
                    const mDrainRim = isFarmhouse ? mBrass : new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.9, roughness: 0.1 });
                    const mDrainHole = new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.9 });

                    let mSink = mSteel;
                    if (isStandard) mSink = mGunmetal; // Premium Gunmetal workstation
                    if (isFarmhouse) mSink = mBlackCeramic; // Matte black fluted farmhouse
                    
                    // Zero-radius for modern metal sinks, slightly rounded for farmhouse
                    const t = isFarmhouse ? 5 : 2.5; 
                    const r = isFarmhouse ? 4 : 0.5;   
                    
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
                        // 60/40 Split Double Sink
                        const basinL = (w * 0.55) / 2 - t;
                        const basinR = (w * 0.45) / 2 - t;
                        shape.holes.push(makeHole(basinL, d/2 - t, -w/2 + t + basinL));
                        shape.holes.push(makeHole(basinR, d/2 - t, w/2 - t - basinR));
                    } else {
                        shape.holes.push(makeHole(w/2 - t, d/2 - t, 0));
                    }

                    const rimGeo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.2, bevelThickness: 0.2 });
                    rimGeo.rotateX(-Math.PI/2); 
                    const rim = new THREE.Mesh(rimGeo, mSink);
                    grp.add(rim);

                    // Inner sloping bottom to drain
                    const botGeo = new THREE.BoxGeometry(w - t*1.5, 1, d - t*1.5);
                    const bot = new THREE.Mesh(botGeo, mSink);
                    bot.position.y = 0.5;
                    grp.add(bot);

                    const createDrain = (xPos) => {
                        const dGroup = new THREE.Group();
                        const rim = new THREE.Mesh(new THREE.TorusGeometry(3.5, 0.4, 16, 32), mDrainRim); rim.rotation.x = Math.PI/2;
                        const hole = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.2, 32), mDrainHole); hole.position.y = -0.2;
                        const strainer = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 2.5, 0.4, 32), mDrainRim);
                        dGroup.add(rim, hole, strainer);
                        dGroup.position.set(xPos, 1, 0);
                        return dGroup;
                    };

                    if (isDouble) {
                        const basinL = (w * 0.55) / 2 - t;
                        const basinR = (w * 0.45) / 2 - t;
                        grp.add(createDrain(-w/2 + t + basinL));
                        grp.add(createDrain(w/2 - t - basinR));
                        
                        // Add premium bottom grids
                        const gridMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', wireframe: true });
                        const gridL = new THREE.Mesh(new THREE.BoxGeometry(basinL*1.8, 0.5, d - t*3, 10, 1, 10), gridMat);
                        gridL.position.set(-w/2 + t + basinL, 1.5, 0);
                        const gridR = new THREE.Mesh(new THREE.BoxGeometry(basinR*1.8, 0.5, d - t*3, 8, 1, 10), gridMat);
                        gridR.position.set(w/2 - t - basinR, 1.5, 0);
                        grp.add(gridL, gridR);
                    } else {
                        grp.add(createDrain(0));
                    }

                    if (isStandard) {
                        // Workstation accessories (Wood cutting board + roll-up rack)
                        const boardW = w * 0.35;
                        const board = new THREE.Mesh(new THREE.BoxGeometry(boardW, 1.5, d - t*1.5), mWood);
                        board.position.set(-w/2 + t + boardW/2, h - 1.5, 0);
                        
                        const rackW = w * 0.35;
                        const rackGroup = new THREE.Group();
                        for (let i = 0; i < 12; i++) {
                            const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, d - t*1.5, 8), mSteel);
                            rod.rotation.x = Math.PI/2;
                            rod.position.set(-rackW/2 + (rackW/12)*i, 0, 0);
                            rackGroup.add(rod);
                        }
                        rackGroup.position.set(w/2 - t - rackW/2, h - 1, 0);
                        
                        grp.add(board, rackGroup);
                    }

                    if (isFarmhouse) {
                        // Fluted/Ribbed Apron Front
                        const apronDepth = t*3;
                        const apronGeo = new THREE.BoxGeometry(w + 2, h + 1, apronDepth);
                        const apron = new THREE.Mesh(apronGeo, mSink);
                        apron.position.set(0, h/2 - 0.5, d/2 - t);
                        grp.add(apron);
                        
                        // Add vertical ribs
                        const ribCount = Math.floor(w / 3.5);
                        const ribSpacing = w / ribCount;
                        for (let i = 0; i <= ribCount; i++) {
                            const rib = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, h + 1, 12), mSink);
                            rib.position.set(-w/2 + i*ribSpacing, h/2 - 0.5, d/2 - t + apronDepth/2);
                            grp.add(rib);
                        }
                    }
                    return grp;
                };

                const basin = buildSinkBasin(sW, sD, sH, config.id);
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
            } else if (config.procedural && config.id && ['hood_', 'app_', 'wine_', 'trash_', 'handle_'].some(prefix => config.id.startsWith(prefix))) {
                const sW = entity.width || 60;
                const sH = entity.height || 60;
                const sD = entity.depth || 60;
                
                const eqGroup = new THREE.Group();
                const mSteel = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.8, roughness: 0.3 });
                const mDarkSteel = new THREE.MeshStandardMaterial({ color: '#64748b', metalness: 0.6, roughness: 0.4 });
                const mGlass = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.1, transparent: true, opacity: 0.8 });
                const mWood = new THREE.MeshStandardMaterial({ color: '#78350f', roughness: 0.9 });
                const mWhite = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.5 });
                const mBlack = new THREE.MeshStandardMaterial({ color: '#1e293b', roughness: 0.8 });
                
                if (config.id === 'hood_chimney') {
                    const canopyGeo = new THREE.CylinderGeometry(15, 40, 15, 4);
                    canopyGeo.rotateY(Math.PI / 4);
                    canopyGeo.scale(1, 1, 0.8);
                    const canopy = new THREE.Mesh(canopyGeo, mSteel); 
                    canopy.position.y = 7.5;
                    
                    const filter = new THREE.Mesh(new THREE.BoxGeometry(46, 0.5, 32), mDarkSteel); 
                    filter.position.set(0, 0, 0);
                    
                    // Telescopic Duct
                    const pipeLower = new THREE.Mesh(new THREE.BoxGeometry(18, 30, 14), mSteel);
                    pipeLower.position.set(0, 30, 0);
                    const pipeUpper = new THREE.Mesh(new THREE.BoxGeometry(17, 30, 13), mSteel);
                    pipeUpper.position.set(0, 60, 0);
                    
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(20, 3, 1), mBlack);
                    panel.position.set(0, 2, 21.5);
                    
                    const led = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial({color: '#10b981', emissive: '#10b981', emissiveIntensity: 2}));
                    led.position.set(0, 2, 21.7);
                    
                    eqGroup.add(canopy, pipeLower, pipeUpper, filter, panel, led);
                    
                    // Ventilation Louvers
                    const mVent = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.9 });
                    for (let i = 0; i < 4; i++) {
                        const ventL = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 8), mVent);
                        ventL.position.set(-8.5, 63 + i * 3, 0);
                        const ventR = new THREE.Mesh(new THREE.BoxGeometry(1, 1.5, 8), mVent);
                        ventR.position.set(8.5, 63 + i * 3, 0);
                        eqGroup.add(ventL, ventR);
                    }

                } else if (config.id === 'app_microwave') {
                    const body = new THREE.Mesh(new THREE.BoxGeometry(50, 30, 40), mSteel); body.position.y = 15;
                    const door = new THREE.Mesh(new THREE.BoxGeometry(36, 28, 2), mGlass); door.position.set(-6, 15, 20.2);
                    const plate = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 0.5, 32), new THREE.MeshStandardMaterial({color: 0xffffff, roughness: 0.1}));
                    plate.position.set(-6, 2, 0);
                    
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(10, 30, 1.8), mBlack); panel.position.set(20, 15, 19.2);
                    const clock = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 0.5), new THREE.MeshStandardMaterial({color: '#0ea5e9', emissive: '#0ea5e9', emissiveIntensity: 1}));
                    clock.position.set(20, 25, 20.2);
                    
                    const dial = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 1, 16), mSteel); dial.rotation.x = Math.PI/2; dial.position.set(20, 18, 20.2);
                    eqGroup.add(body, door, plate, panel, clock, dial);
                    for (let i=0; i<3; i++) {
                        for (let j=0; j<2; j++) {
                            const btn = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 0.5), mSteel);
                            btn.position.set(18 + j*4, 12 - i*2, 20.2);
                            eqGroup.add(btn);
                        }
                    }
                } else if (config.id === 'app_toaster') {
                    // Premium Modern Toaster Redesign
                    const bodyMat = new THREE.MeshStandardMaterial({ color: '#fef3c7', roughness: 0.15, metalness: 0.1 }); // Glossy cream
                    const chromeMat = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.1, metalness: 0.9 });
                    const darkMat = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                    
                    // Top-down rounded rectangle profile
                    const shape = new THREE.Shape();
                    shape.moveTo(-5, -13); shape.lineTo(5, -13); shape.quadraticCurveTo(9, -13, 9, -9);
                    shape.lineTo(9, 9); shape.quadraticCurveTo(9, 13, 5, 13);
                    shape.lineTo(-5, 13); shape.quadraticCurveTo(-9, 13, -9, 9);
                    shape.lineTo(-9, -9); shape.quadraticCurveTo(-9, -13, -5, -13);
                    
                    // Bread slot holes cut directly into the shell
                    const hole1 = new THREE.Path();
                    hole1.moveTo(-4, -10); hole1.lineTo(-1, -10); hole1.lineTo(-1, 10); hole1.lineTo(-4, 10); hole1.lineTo(-4, -10);
                    shape.holes.push(hole1);
                    const hole2 = new THREE.Path();
                    hole2.moveTo(1, -10); hole2.lineTo(4, -10); hole2.lineTo(4, 10); hole2.lineTo(1, 10); hole2.lineTo(1, -10);
                    shape.holes.push(hole2);
                    
                    // Main Colored Body
                    const bodyExt = new THREE.ExtrudeGeometry(shape, {depth: 17, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5});
                    const body = new THREE.Mesh(bodyExt, bodyMat);
                    body.rotation.x = Math.PI / 2; // Converts Z-extrusion into Y-extrusion downwards
                    body.position.set(0, 19, 0); // Y goes from 19 down to 2
                    
                    // Chrome Base Plate
                    const baseExt = new THREE.ExtrudeGeometry(shape, {depth: 1, bevelEnabled: true, bevelSize: 0.2, bevelThickness: 0.2});
                    const base = new THREE.Mesh(baseExt, chromeMat);
                    base.rotation.x = Math.PI / 2;
                    base.position.set(0, 2, 0); // Y goes from 2 down to 1
                    
                    // Dark Interior (To block light inside the slots)
                    const interior = new THREE.Mesh(new THREE.BoxGeometry(9, 15, 21), darkMat);
                    interior.position.set(0, 10, 0);
                    
                    // Lever Mechanism on front face
                    const track = new THREE.Mesh(new THREE.BoxGeometry(1, 10, 0.5), darkMat); 
                    track.position.set(4, 10, 13.5); 
                    const leverArm = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 1.5), chromeMat); 
                    leverArm.position.set(4, 12, 14.5);
                    const leverKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.5, 16), darkMat); 
                    leverKnob.rotation.z = Math.PI/2; leverKnob.position.set(4, 12, 15.2);
                    
                    // Temperature Dial
                    const dialBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16), chromeMat); 
                    dialBase.rotation.x = Math.PI/2; dialBase.position.set(-4, 6, 13.7);
                    const dialKnob = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), darkMat); 
                    dialKnob.rotation.x = Math.PI/2; dialKnob.position.set(-4, 6, 14.2);
                    
                    eqGroup.add(base, body, interior, track, leverArm, leverKnob, dialBase, dialKnob);
                } else if (config.id === 'app_fridge') {
                    // Premium French-Door Refrigerator
                    const mBody = new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.7 }); // Dark grey sides
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#f1f5f9', roughness: 0.15, metalness: 0.8 }); // Brushed stainless steel
                    const mDarkPlastic = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 });
                    const mGlass = new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0.9, roughness: 0.05, clearcoat: 1 });
                    
                    const w = 90, h = 180, d = 70;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(w-2, h-2, d-4), mBody); body.position.set(0, h/2, -2);
                    
                    // Left French Door
                    const doorL = new THREE.Mesh(new THREE.BoxGeometry(w/2 - 1, h*0.65, 4), mSteel);
                    doorL.position.set(-(w/4), h*0.675 + 1, d/2 - 2);
                    // Right French Door
                    const doorR = new THREE.Mesh(new THREE.BoxGeometry(w/2 - 1, h*0.65, 4), mSteel);
                    doorR.position.set(w/4, h*0.675 + 1, d/2 - 2);
                    // Bottom Freezer Drawer
                    const freezer = new THREE.Mesh(new THREE.BoxGeometry(w - 1, h*0.33, 4), mSteel);
                    freezer.position.set(0, h*0.175, d/2 - 2);
                    
                    // Handles
                    const hMat = new THREE.MeshStandardMaterial({ color: '#cbd5e1', roughness: 0.3, metalness: 0.9 });
                    const handleL = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, h*0.4, 16), hMat); handleL.position.set(-2, h*0.675, d/2 + 1.5);
                    const handleR = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, h*0.4, 16), hMat); handleR.position.set(2, h*0.675, d/2 + 1.5);
                    const handleF = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, w*0.6, 16), hMat); handleF.rotation.z = Math.PI/2; handleF.position.set(0, h*0.25, d/2 + 1.5);
                    
                    // Ice/Water Dispenser on Left Door
                    const dispBase = new THREE.Mesh(new THREE.BoxGeometry(18, 28, 1), mDarkPlastic); dispBase.position.set(-(w/4), h*0.65, d/2);
                    const dispCavity = new THREE.Mesh(new THREE.BoxGeometry(14, 22, 2), mBody); dispCavity.position.set(-(w/4), h*0.63, d/2 - 0.5);
                    const dispPanel = new THREE.Mesh(new THREE.BoxGeometry(16, 4, 1.2), mGlass); dispPanel.position.set(-(w/4), h*0.75, d/2);
                    
                    eqGroup.add(body, doorL, doorR, freezer, handleL, handleR, handleF, dispBase, dispCavity, dispPanel);

                } else if (config.id === 'app_oven') {
                    // Premium Built-in Oven
                    const mBlackMetal = new THREE.MeshStandardMaterial({ color: '#111827', roughness: 0.6, metalness: 0.5 });
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#f8fafc', roughness: 0.2, metalness: 0.8 });
                    const mGlass = new THREE.MeshPhysicalMaterial({ color: '#000000', metalness: 0.9, roughness: 0.05, clearcoat: 1 });
                    
                    const w = 60, h = 60, d = 55;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(w-2, h-2, d-4), mBlackMetal); body.position.set(0, h/2, -2);
                    
                    // Main Glass Door
                    const door = new THREE.Mesh(new THREE.BoxGeometry(w-1, h*0.75, 4), mGlass); door.position.set(0, h*0.375, d/2 - 2);
                    // Steel Frame around Door
                    const frameT = new THREE.Mesh(new THREE.BoxGeometry(w-1, 4, 4.2), mSteel); frameT.position.set(0, h*0.75 - 2, d/2 - 2);
                    const frameB = new THREE.Mesh(new THREE.BoxGeometry(w-1, 4, 4.2), mSteel); frameB.position.set(0, 2, d/2 - 2);
                    
                    // Top Control Panel
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(w-1, h*0.23, 4), mBlackMetal); panel.position.set(0, h*0.885, d/2 - 2);
                    // Knobs
                    const knobL = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 16), mSteel); knobL.rotation.x = Math.PI/2; knobL.position.set(-15, h*0.885, d/2);
                    const knobR = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 2, 16), mSteel); knobR.rotation.x = Math.PI/2; knobR.position.set(15, h*0.885, d/2);
                    // Digital LED Display
                    const display = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 4.5), mGlass); display.position.set(0, h*0.885, d/2 - 2);
                    
                    // Large Horizontal Steel Handle
                    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, w*0.8, 16), mSteel); handle.rotation.z = Math.PI/2; handle.position.set(0, h*0.65, d/2 + 1);
                    const handleSupportL = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 16), mSteel); handleSupportL.rotation.x = Math.PI/2; handleSupportL.position.set(-w*0.35, h*0.65, d/2 - 0.5);
                    const handleSupportR = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 16), mSteel); handleSupportR.rotation.x = Math.PI/2; handleSupportR.position.set(w*0.35, h*0.65, d/2 - 0.5);
                    
                    eqGroup.add(body, door, frameT, frameB, panel, knobL, knobR, display, handle, handleSupportL, handleSupportR);

                } else if (config.id === 'app_dishwasher') {
                    // Premium Integrated Dishwasher
                    const mSteel = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.15, metalness: 0.85 });
                    const mBlackGlass = new THREE.MeshPhysicalMaterial({ color: '#020617', metalness: 0.8, roughness: 0.1, clearcoat: 1 });
                    const mGrey = new THREE.MeshStandardMaterial({ color: '#334155', roughness: 0.8 });
                    
                    const w = 60, h = 85, d = 55;
                    const body = new THREE.Mesh(new THREE.BoxGeometry(w-2, h-10, d-4), mGrey); body.position.set(0, h/2, -2);
                    const toeKick = new THREE.Mesh(new THREE.BoxGeometry(w-2, 10, d-8), mGrey); toeKick.position.set(0, 5, -4);
                    
                    // Main Steel Door
                    const door = new THREE.Mesh(new THREE.BoxGeometry(w-0.5, h - 11, 3), mSteel); door.position.set(0, h/2 - 0.5, d/2 - 1.5);
                    
                    // Sleek Top Hidden Control Panel (Front facing part)
                    const panel = new THREE.Mesh(new THREE.BoxGeometry(w-0.5, 7, 3.2), mBlackGlass); panel.position.set(0, h - 3.5, d/2 - 1.5);
                    
                    // Recessed Pocket Handle (instead of bar)
                    const pocket = new THREE.Mesh(new THREE.BoxGeometry(16, 3, 2), mGrey); pocket.position.set(0, h - 8.5, d/2 - 1);
                    const pocketLip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.5, 1), mSteel); pocketLip.position.set(0, h - 7.25, d/2 - 0.5);
                    
                    // LED indicators on panel
                    const ledMat1 = new THREE.MeshBasicMaterial({ color: '#3b82f6' }); // Blue
                    const ledMat2 = new THREE.MeshBasicMaterial({ color: '#ef4444' }); // Red
                    const led1 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), ledMat1); led1.rotation.x = Math.PI/2; led1.position.set(20, h - 3.5, d/2 + 0.1);
                    const led2 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16), ledMat2); led2.rotation.x = Math.PI/2; led2.position.set(22, h - 3.5, d/2 + 0.1);
                    
                    eqGroup.add(body, toeKick, door, panel, pocket, pocketLip, led1, led2);
                } else if (config.id === 'trash_pedal') {
                    // Premium Stainless Steel & Black Plastic Rounded Rectangle Bin
                    const pBody = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.85 }); 
                    const pBlack = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }); 
                    
                    const w = 30, d = 30, r = 8, h = 55;
                    const binShape = new THREE.Shape();
                    binShape.moveTo(-w/2+r, -d/2); binShape.lineTo(w/2-r, -d/2);
                    binShape.quadraticCurveTo(w/2, -d/2, w/2, -d/2+r); binShape.lineTo(w/2, d/2-r);
                    binShape.quadraticCurveTo(w/2, d/2, w/2-r, d/2); binShape.lineTo(-w/2+r, d/2);
                    binShape.quadraticCurveTo(-w/2, d/2, -w/2, d/2-r); binShape.lineTo(-w/2, -d/2+r);
                    binShape.quadraticCurveTo(-w/2, -d/2, -w/2+r, -d/2);
                    
                    const bodyGeo = new THREE.ExtrudeGeometry(binShape, { depth: h, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 3 });
                    bodyGeo.rotateX(-Math.PI/2);
                    const body = new THREE.Mesh(bodyGeo, pBody);
                    
                    const lidGeo = new THREE.ExtrudeGeometry(binShape, { depth: 2, bevelEnabled: true, bevelSize: 0.5, bevelThickness: 0.5, bevelSegments: 2 });
                    lidGeo.rotateX(-Math.PI/2);
                    const lid = new THREE.Mesh(lidGeo, pBlack);
                    lid.position.y = h + 1;
                    
                    const pedal = new THREE.Mesh(new THREE.BoxGeometry(14, 2, 4), pBlack); 
                    pedal.position.set(0, 3, d/2 + 1);
                    
                    eqGroup.add(body, lid, pedal);
                } else if (config.id === 'trash_recycle') {
                    // Premium Dual Compartment Stainless Steel Bin
                    const pBody = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.85 }); 
                    const pBlack = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }); 
                    
                    const w = 50, d = 35, h = 60, r = 4;
                    const binShape = new THREE.Shape();
                    binShape.moveTo(-w/2+r, -d/2); binShape.lineTo(w/2-r, -d/2);
                    binShape.quadraticCurveTo(w/2, -d/2, w/2, -d/2+r); binShape.lineTo(w/2, d/2-r);
                    binShape.quadraticCurveTo(w/2, d/2, w/2-r, d/2); binShape.lineTo(-w/2+r, d/2);
                    binShape.quadraticCurveTo(-w/2, d/2, -w/2, d/2-r); binShape.lineTo(-w/2, -d/2+r);
                    binShape.quadraticCurveTo(-w/2, -d/2, -w/2+r, -d/2);
                    
                    const bodyGeo = new THREE.ExtrudeGeometry(binShape, { depth: h, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 2 });
                    bodyGeo.rotateX(-Math.PI/2);
                    const body = new THREE.Mesh(bodyGeo, pBody);
                    
                    const lidGeo = new THREE.BoxGeometry(w/2 - 2, 3, d - 4);
                    const lid1 = new THREE.Mesh(lidGeo, pBlack); lid1.position.set(-w/4 + 0.5, h + 1.5, 0);
                    const lid2 = new THREE.Mesh(lidGeo, pBlack); lid2.position.set(w/4 - 0.5, h + 1.5, 0);
                    
                    const pedalGeo = new THREE.BoxGeometry(10, 2, 4);
                    const pedal1 = new THREE.Mesh(pedalGeo, pBlack); pedal1.position.set(-w/4, 3, d/2 + 1);
                    const pedal2 = new THREE.Mesh(pedalGeo, pBlack); pedal2.position.set(w/4, 3, d/2 + 1);
                    
                    eqGroup.add(body, lid1, lid2, pedal1, pedal2);
                } else if (config.id === 'trash_pullout') {
                    // Premium Concealed In-Cabinet Drawer Bin System
                    const pBody = new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.2, metalness: 0.85 }); 
                    const pBlack = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.8 }); 
                    const pMetal = new THREE.MeshStandardMaterial({ color: '#94a3b8', roughness: 0.3, metalness: 0.8 }); 
                    
                    const drawerW = 45, drawerD = 50, drawerH = 45;
                    
                    const face = new THREE.Mesh(new THREE.BoxGeometry(drawerW, drawerH, 2), pBody);
                    face.position.set(0, drawerH/2, drawerD/2);
                    
                    const frame = new THREE.Mesh(new THREE.BoxGeometry(drawerW - 4, 2, drawerD), pMetal);
                    frame.position.set(0, 2, 0);
                    
                    const bin1 = new THREE.Mesh(new THREE.BoxGeometry(drawerW - 6, drawerH - 5, drawerD/2 - 2), pBlack);
                    bin1.position.set(0, drawerH/2 - 1, -drawerD/4);
                    
                    const bin2 = new THREE.Mesh(new THREE.BoxGeometry(drawerW - 6, drawerH - 5, drawerD/2 - 2), pBlack);
                    bin2.position.set(0, drawerH/2 - 1, drawerD/4 - 2);
                    
                    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 15, 16), pMetal);
                    handle.rotation.z = Math.PI/2;
                    handle.position.set(0, drawerH - 5, drawerD/2 + 2);
                    
                    eqGroup.add(face, frame, bin1, bin2, handle);
                } else if (config.id === 'handle_bar') {
                    const bar = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 20, 16), mSteel); bar.rotation.z = Math.PI/2; bar.position.y = 4;
                    const leg1 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 16), mSteel); leg1.rotation.x = Math.PI/2; leg1.position.set(-7, 2, 0);
                    const leg2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 4, 16), mSteel); leg2.rotation.x = Math.PI/2; leg2.position.set(7, 2, 0);
                    eqGroup.add(bar, leg1, leg2);
                } else if (config.id === 'handle_knob') {
                    const base = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 2, 16), mSteel); base.rotation.x = Math.PI/2; base.position.y = 1;
                    const top = new THREE.Mesh(new THREE.SphereGeometry(2, 16, 16), mSteel); top.position.y = 3;
                    eqGroup.add(base, top);
                } else if (config.id === 'handle_recessed') {
                    const outer = new THREE.Mesh(new THREE.BoxGeometry(10, 4, 1), mSteel); outer.position.y = 2;
                    const hole = new THREE.Mesh(new THREE.BoxGeometry(8, 2, 2), mBlack); hole.position.set(0, 2, 0);
                    eqGroup.add(outer, hole);
                }

                const baseBox = new THREE.Box3().setFromObject(eqGroup);
                const bSize = baseBox.getSize(new THREE.Vector3());
                const defaultW = FURNITURE_REGISTRY[config.id]?.default?.width || bSize.x;
                const defaultH = FURNITURE_REGISTRY[config.id]?.default?.height || bSize.y;
                const defaultD = FURNITURE_REGISTRY[config.id]?.default?.depth || bSize.z;
                
                const uniformScale = Math.min(sW / defaultW, sH / defaultH, sD / defaultD);
                eqGroup.scale.setScalar(uniformScale);
                
                const finalBox = new THREE.Box3().setFromObject(eqGroup);
                const fCenter = finalBox.getCenter(new THREE.Vector3());
                eqGroup.position.set(-fCenter.x, -finalBox.min.y, -fCenter.z);
                
                const invMat = new THREE.MeshBasicMaterial({ visible: false });
                const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), invMat);
                corner1.position.set(-sW/2, 0, -sD/2);
                const corner2 = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), invMat);
                corner2.position.set(sW/2, sH, sD/2);
                
                wrapper.add(eqGroup, corner1, corner2);
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