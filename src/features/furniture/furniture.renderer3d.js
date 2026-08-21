import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, GLASS_REGISTRY, FABRIC_REGISTRY, DOOR_MATERIALS_REGISTRY, MARBLE_REGISTRY, STONE_REGISTRY, METAL_REGISTRY, PLASTIC_REGISTRY, resolveFabricConfig } from '../../core/registry';
import { MaterialFactory } from '../../core/engine3d/MaterialFactory.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';
import { MaterialSlots } from '../../core/constants/materialSlots.js';

export class FurnitureManager {
    constructor(ctx) { this.ctx = ctx; }

    async load(entity, targetGroup = null) {
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
                    
                    if (rowType === 'base' || rowType === 'tall') {
                        const isFloating = style === 'kitchen_straight_floating';
                        const isShaker = style === 'kitchen_straight_shaker';
                        const isTall = rowType === 'tall';
                        const bH = isTall ? 210 : 90;
                        const toeH = (isFloating && !isTall) ? 20 : 10;
                        const toeRecess = 5;
                        const tThick = isFloating ? 1.5 : (isShaker ? 5 : 4);
                        
                        if (!isFloating || isTall) {
                            const toe = new THREE.Mesh(new THREE.BoxGeometry(len, toeH, dep - toeRecess), matToe);
                            toe.position.set(len/2, toeH/2, (dep - toeRecess)/2);
                            row.add(toe);
                        } else {
                            // Floating LED strip
                            const led = new THREE.Mesh(new THREE.BoxGeometry(len - 4, 1, 1), new THREE.MeshBasicMaterial({color: 0xffffff}));
                            led.position.set(len/2, toeH - 1, dep - 10);
                            row.add(led);
                        }
                        
                        if (!isTall && style !== 'kitchen_island') {
                            const top = new THREE.Mesh(new THREE.BoxGeometry(len, tThick, dep + 2), matTop);
                            top.position.set(len/2, bH - tThick/2, (dep + 2)/2);
                            row.add(top);
                        }
                        
                        for(let i=0; i<numMods; i++) {
                            const X = i * modW + modW/2;
                            const cabH = isTall ? bH - toeH : bH - tThick - toeH;
                            const body = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.2, cabH, dep - 2), matBase);
                            body.position.set(X, toeH + cabH/2, (dep - 2)/2);
                            
                            const doorGroup = new THREE.Group();
                            if (isTall) {
                                // Tall continuous doors with long handles
                                const door = new THREE.Mesh(new THREE.BoxGeometry(modW - 0.4, cabH - 0.4, 1.8), matDoor);
                                const handle = new THREE.Mesh(new THREE.BoxGeometry(1.2, 120, 2.5), matHandle);
                                handle.position.set((i%2===0)? modW/2 - 5 : -modW/2 + 5, 0, 2);
                                doorGroup.add(door, handle);
                            } else if (isShaker) {
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
                
                if (type === 'kitchen_island') {
                    // Front base cabinets
                    const frontBase = buildRow(w, 60, 'base', type);
                    innerGroup.add(frontBase);
                    
                    // Waterfall Countertop
                    const top = new THREE.Mesh(new THREE.BoxGeometry(w, 4, d + 2), matTop);
                    top.position.set(w/2, 90 - 2, d/2);
                    
                    // Left and Right waterfall legs
                    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(4, 90 - 4, d + 2), matTop);
                    leftLeg.position.set(2, 43, d/2);
                    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(4, 90 - 4, d + 2), matTop);
                    rightLeg.position.set(w - 2, 43, d/2);
                    
                    innerGroup.add(top, leftLeg, rightLeg);
                    
                    // Fluted Wood Back panel supporting the island overhang
                    const backGroup = new THREE.Group();
                    const slatW = 4;
                    const slatCount = Math.floor((w - 8) / slatW);
                    const matWood = new THREE.MeshStandardMaterial({ color: '#b45309', roughness: 0.8 }); // Rich Walnut
                    for (let i = 0; i < slatCount; i++) {
                        const slat = new THREE.Mesh(new THREE.CylinderGeometry(slatW/2, slatW/2, 86, 16), matWood);
                        slat.position.set(4 + i*slatW + slatW/2, 43, 61);
                        slat.scale.set(1, 1, 0.4); // flatten into half-ovals for fluted look
                        backGroup.add(slat);
                    }
                    innerGroup.add(backGroup);
                } else if (type === 'kitchen_tall_pantry') {
                    // Appliance garage alcove
                    const pW = w; const pD = d; const pH = 210;
                    const toe = new THREE.Mesh(new THREE.BoxGeometry(pW, 10, pD - 5), matToe); toe.position.set(pW/2, 5, pD/2 - 2.5);
                    
                    const lowH = 80;
                    const alcoveH = 45;
                    const upH = pH - 10 - lowH - alcoveH;
                    
                    // Split body to avoid z-fighting with open alcove
                    const bodyLower = new THREE.Mesh(new THREE.BoxGeometry(pW, lowH, pD), matBase);
                    bodyLower.position.set(pW/2, 10 + lowH/2, pD/2);
                    
                    const bodyUpper = new THREE.Mesh(new THREE.BoxGeometry(pW, upH, pD), matBase);
                    bodyUpper.position.set(pW/2, 10 + lowH + alcoveH + upH/2, pD/2);
                    
                    // Lower doors (Shaker)
                    const lDoorGroup = new THREE.Group();
                    const ldFrame = new THREE.Mesh(new THREE.BoxGeometry(pW-0.4, lowH-0.4, 1.8), matDoor);
                    const ldPanel = new THREE.Mesh(new THREE.BoxGeometry(pW-12, lowH-12, 1.9), matBase);
                    const lHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 30, 16), matHandle); lHandle.position.set(-pW/2 + 8, 0, 2);
                    lDoorGroup.add(ldFrame, ldPanel, lHandle);
                    lDoorGroup.position.set(pW/2, 10 + lowH/2, pD + 0.9);
                    
                    // Middle Alcove (Open shelf lined with stone)
                    const alGroup = new THREE.Group();
                    const alY = 10 + lowH;
                    const alBack = new THREE.Mesh(new THREE.BoxGeometry(pW-4, alcoveH, 2), matTop); alBack.position.set(pW/2, alY + alcoveH/2, 1);
                    const alBot = new THREE.Mesh(new THREE.BoxGeometry(pW-4, 2, pD), matTop); alBot.position.set(pW/2, alY + 1, pD/2);
                    const alTop = new THREE.Mesh(new THREE.BoxGeometry(pW-4, 2, pD), matTop); alTop.position.set(pW/2, alY + alcoveH - 1, pD/2);
                    const alL = new THREE.Mesh(new THREE.BoxGeometry(2, alcoveH, pD), matTop); alL.position.set(1, alY + alcoveH/2, pD/2);
                    const alR = new THREE.Mesh(new THREE.BoxGeometry(2, alcoveH, pD), matTop); alR.position.set(pW-1, alY + alcoveH/2, pD/2);
                    // LED Strip under alcove top
                    const led = new THREE.Mesh(new THREE.BoxGeometry(pW-8, 0.5, 2), new THREE.MeshBasicMaterial({color: 0xffffff}));
                    led.position.set(pW/2, alY + alcoveH - 2, pD/2);
                    alGroup.add(alBack, alBot, alTop, alL, alR, led);
                    
                    // Upper Doors (Shaker)
                    const uDoorGroup = new THREE.Group();
                    const udFrame = new THREE.Mesh(new THREE.BoxGeometry(pW-0.4, upH-0.4, 1.8), matDoor);
                    const udPanel = new THREE.Mesh(new THREE.BoxGeometry(pW-12, upH-12, 1.9), matBase);
                    const uHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 40, 16), matHandle); uHandle.position.set(-pW/2 + 8, 0, 2);
                    uDoorGroup.add(udFrame, udPanel, uHandle);
                    uDoorGroup.position.set(pW/2, 10 + lowH + alcoveH + upH/2, pD + 0.9);
                    
                    innerGroup.add(toe, bodyLower, bodyUpper, lDoorGroup, alGroup, uDoorGroup);
                } else if (!type.includes('_upper')) {
                    const backBase = buildRow(w, 60, 'base', type);
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
                    const backUpper = buildRow(w, 35, 'upper', type);
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
            } else if (config.procedural && config.id && ['bench', 'hood_', 'app_', 'wine_', 'trash_', 'handle_', 'cooktop_', 'furniture_', 'lighting_', 'curtain_', 'rug_', 'decor_'].some(prefix => config.id.startsWith(prefix))) {
                const sW = entity.width || config.default?.width || 60;
                const sH = entity.height || config.default?.height || 60;
                const sD = entity.depth || config.default?.depth || 60;
                
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
                } else if (config.id === 'cooktop_induction') {
                    // Schott Ceran ultra-premium Induction cooktop
                    const base = new THREE.Mesh(new THREE.BoxGeometry(58, 0.8, 50), mBlack); base.position.y = 0.4;
                    const glass = new THREE.Mesh(new THREE.BoxGeometry(60, 0.2, 52), mGlass); glass.position.y = 0.9;
                    
                    // Chamfered metal edge frame
                    const mFrame = new THREE.MeshStandardMaterial({ color: '#cbd5e1', metalness: 0.9, roughness: 0.1 });
                    const frameL = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 52.4), mFrame); frameL.position.set(-30, 0.8, 0);
                    const frameR = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 52.4), mFrame); frameR.position.set(30, 0.8, 0);
                    const frameT = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 1), mFrame); frameT.position.set(0, 0.8, -26);
                    const frameB = new THREE.Mesh(new THREE.BoxGeometry(60, 0.4, 1), mFrame); frameB.position.set(0, 0.8, 26);
                    
                    const ringMat = new THREE.MeshBasicMaterial({ color: '#ef4444' }); // Red induction glow
                    const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff' }); // White crosshairs
                    const ringPositions = [[-15, -10, 8], [15, -10, 8], [-15, 10, 6], [15, 10, 6]]; // x, z, radius
                    ringPositions.forEach(pos => {
                        // Subtle inner glowing ring
                        const ring = new THREE.Mesh(new THREE.TorusGeometry(pos[2], 0.1, 16, 32), ringMat);
                        ring.rotation.x = Math.PI/2; ring.position.set(pos[0], 1, pos[1]);
                        
                        // Crosshairs (modern minimalist UI)
                        const crossH = new THREE.Mesh(new THREE.BoxGeometry(4, 0.05, 0.2), whiteMat); crossH.position.set(pos[0], 1.05, pos[1]);
                        const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 4), whiteMat); crossV.position.set(pos[0], 1.05, pos[1]);
                        eqGroup.add(ring, crossH, crossV);
                    });
                    
                    // LED Slider Control panel
                    const slider = new THREE.Mesh(new THREE.BoxGeometry(20, 0.05, 2), ringMat); slider.position.set(0, 1.05, 22);
                    eqGroup.add(base, glass, frameL, frameR, frameT, frameB, slider);
                } else if (config.id === 'bench') {
                    const sW = entity.width || 120;
                    const sH = entity.height || 45;
                    const sD = entity.depth || 40;
                    
                    const woodMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.8 });
                    
                    // Top
                    const top = new THREE.Mesh(new THREE.BoxGeometry(sW, 4, sD), woodMat);
                    top.position.set(0, sH - 2, 0);
                    
                    // Legs
                    const legGeo = new THREE.BoxGeometry(4, sH - 4, 4);
                    const leg1 = new THREE.Mesh(legGeo, woodMat); leg1.position.set(-sW/2 + 4, (sH-4)/2, -sD/2 + 4);
                    const leg2 = new THREE.Mesh(legGeo, woodMat); leg2.position.set(sW/2 - 4, (sH-4)/2, -sD/2 + 4);
                    const leg3 = new THREE.Mesh(legGeo, woodMat); leg3.position.set(-sW/2 + 4, (sH-4)/2, sD/2 - 4);
                    const leg4 = new THREE.Mesh(legGeo, woodMat); leg4.position.set(sW/2 - 4, (sH-4)/2, sD/2 - 4);
                    
                    wrapper.add(top, leg1, leg2, leg3, leg4);
                    
                    size = new THREE.Vector3(sW, sH, sD);
                    center = new THREE.Vector3(0, sH/2, 0);
                } else if (config.id === 'furniture_barstool') {
                    // Sculpted Scandinavian Bar Stool
                    const pWood = new THREE.MeshStandardMaterial({ color: '#92400e', roughness: 0.4 }); // Walnut seat
                    const pBrass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.9, roughness: 0.2 });
                    
                    // Ergonomic sculpted seat (using deformed sphere to simulate curved dish)
                    const seat = new THREE.Mesh(new THREE.SphereGeometry(18, 32, 16, 0, Math.PI*2, 0, Math.PI/2), pWood);
                    seat.scale.set(1, 0.2, 1);
                    seat.position.y = 73.5;
                    seat.rotation.x = Math.PI; // flip upside down so flat is down, curve is up
                    
                    // Seat Base
                    const seatBase = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 2, 32), pWood);
                    seatBase.position.y = 72;
                    
                    for(let i=0; i<4; i++) {
                        const angle = (Math.PI/2) * i + Math.PI/4;
                        // Tapered legs (thicker at top, thin at bottom)
                        const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 0.6, 73, 16), pBrass);
                        leg.position.set(Math.cos(angle)*12, 36.5, Math.sin(angle)*12);
                        leg.rotation.z = Math.cos(angle) * -0.15;
                        leg.rotation.x = Math.sin(angle) * 0.15;
                        eqGroup.add(leg);
                    }
                    const footrest = new THREE.Mesh(new THREE.TorusGeometry(12, 0.6, 16, 32), pBrass);
                    footrest.rotation.x = Math.PI/2; footrest.position.y = 25;
                    eqGroup.add(seat, seatBase, footrest);
                } else if (config.id === 'lighting_pendant') {
                    // Multi-layered Ribbed Brass Fixture with Frosted Globe
                    const pBrass = new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.9, roughness: 0.2 });
                    const pGlass = new THREE.MeshPhysicalMaterial({ color: '#ffffff', transmission: 0.8, opacity: 1, transparent: true, roughness: 0.3 });
                    const pWire = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.9 });
                    
                    // Ceiling Rose / Canopy
                    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 2, 32), pBrass); canopy.position.y = 100;
                    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 70, 8), pWire); wire.position.y = 65;
                    
                    // Ribbed brass housing
                    const housing = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 15, 32), pBrass); housing.position.y = 22.5;
                    
                    // Frosted Globe
                    const globe = new THREE.Mesh(new THREE.SphereGeometry(12, 32, 32), pGlass); globe.position.y = 10;
                    
                    const bulb = new THREE.Mesh(new THREE.SphereGeometry(3, 16, 16), new THREE.MeshBasicMaterial({color: 0xfff5e6})); bulb.position.y = 10;
                    const light = new THREE.PointLight(0xffeedd, 1.5, 400); light.position.y = 10;
                    
                    eqGroup.add(canopy, wire, housing, globe, bulb, light);
                } else if (config.id.startsWith('curtain_')) {
                    const registerSlotMesh = (mesh, slotName) => {
                        mesh.userData.entity = entity;
                        mesh.userData.materialSlot = slotName;
                        mesh.userData.componentId = `${entity.id || 'decor'}_${slotName}`;
                        ComponentRegistry.registerMesh(entity, slotName, mesh, { componentId: mesh.userData.componentId, componentType: config.id });
                        eqGroup.add(mesh);
                        return mesh;
                    };

                    const getDynamicMat = (slotName, defaultKey, defaultProps = {}) => {
                        const slotId = entity.materials?.[slotName]?.id || config.default?.materials?.[slotName]?.id || defaultKey;
                        if (this.ctx?.helpers?.getDynamicMaterial) {
                            return this.ctx.helpers.getDynamicMaterial(slotId, slotName);
                        }
                        return new THREE.MeshStandardMaterial({ ...defaultProps });
                    };

                    const cW = sW;
                    const cH = sH;
                    const cD = sD;

                    // Helper to build high-fidelity continuous full fabric drape geometry
                    const buildContinuousFabricDrapeGeo = (w, h, waveCount = 8, waveAmp = 2.8) => {
                        const segX = Math.max(60, Math.floor(w * 1.5));
                        const segY = Math.max(30, Math.floor(h * 0.5));
                        const geo = new THREE.PlaneGeometry(w, h, segX, segY);
                        geo.translate(0, h / 2, 0);

                        const pos = geo.attributes.position;
                        const uv = geo.attributes.uv;

                        for (let i = 0; i < pos.count; i++) {
                            const x = pos.getX(i);
                            const y = pos.getY(i);
                            const u = (x + w / 2) / w;
                            const v = y / h;

                            const primaryWave = Math.sin(u * Math.PI * 2 * waveCount) * waveAmp;
                            const organicSag = Math.sin(u * Math.PI * 6 + v * 2.5) * (waveAmp * 0.2) * (1 - v * 0.5);
                            const foldDepth = (primaryWave + organicSag) * (0.85 + 0.15 * (1 - v));

                            pos.setZ(i, foldDepth);
                            uv.setXY(i, (x + w / 2) / 50, y / 50);
                        }

                        pos.needsUpdate = true;
                        uv.needsUpdate = true;
                        geo.computeVertexNormals();
                        return geo;
                    };

                    if (config.id === 'curtain_drapes_sheer') {
                        const mFabric = getDynamicMat('fabric', 'crepe_satin_real', { color: '#f8fafc', roughness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
                        mFabric.side = THREE.DoubleSide;
                        const mRod = getDynamicMat('rod', 'metal_brass', { color: '#d97706', metalness: 0.9, roughness: 0.2 });
                        const mRings = getDynamicMat('rings', 'metal_brass', { color: '#d97706', metalness: 0.9, roughness: 0.2 });

                        // Top curtain rod
                        const rodGeo = new THREE.CylinderGeometry(1.0, 1.0, cW + 10, 24);
                        rodGeo.rotateZ(Math.PI / 2);
                        const rod = new THREE.Mesh(rodGeo, mRod);
                        rod.position.set(0, cH - 1.5, 0);
                        registerSlotMesh(rod, 'rod');

                        // End finials (spherical brass)
                        const finialL = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), mRod);
                        finialL.position.set(-cW / 2 - 5, cH - 1.5, 0);
                        const finialR = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 24), mRod);
                        finialR.position.set(cW / 2 + 5, cH - 1.5, 0);
                        registerSlotMesh(finialL, 'rod');
                        registerSlotMesh(finialR, 'rod');

                        // Wall mounting brackets
                        [-cW / 2 + 8, 0, cW / 2 - 8].forEach(bx => {
                            const brk = new THREE.Mesh(new THREE.BoxGeometry(1.0, 2.5, 4.5), mRod);
                            brk.position.set(bx, cH - 1.5, -2.25);
                            registerSlotMesh(brk, 'rod');
                        });

                        // Rings along the rod
                        const ringCount = 14;
                        for (let i = 0; i < ringCount; i++) {
                            const rx = -cW / 2 + (cW / (ringCount - 1)) * i;
                            const ring = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.2, 12, 24), mRings);
                            ring.rotation.y = Math.PI / 2;
                            ring.position.set(rx, cH - 1.5, 0);
                            registerSlotMesh(ring, 'rings');
                        }

                        // Full continuous sheer drape across entire curtain width
                        const drapeGeo = buildContinuousFabricDrapeGeo(cW, cH - 4.5, 7.5, 2.5);
                        const drape = new THREE.Mesh(drapeGeo, mFabric);
                        drape.position.set(0, 0, 0);
                        registerSlotMesh(drape, 'fabric');

                    } else if (config.id === 'curtain_drapes_blackout') {
                        const mFabric = getDynamicMat('fabric', 'caban_neutral', { color: '#334155', roughness: 0.9, side: THREE.DoubleSide });
                        mFabric.side = THREE.DoubleSide;
                        const mRod = getDynamicMat('rod', 'metal_matte_black', { color: '#1e293b', roughness: 0.5, metalness: 0.8 });
                        const mFinials = getDynamicMat('finials', 'metal_matte_black', { color: '#1e293b', roughness: 0.5, metalness: 0.8 });

                        // Sleek black curtain rod
                        const rodGeo = new THREE.CylinderGeometry(1.2, 1.2, cW + 12, 24);
                        rodGeo.rotateZ(Math.PI / 2);
                        const rod = new THREE.Mesh(rodGeo, mRod);
                        rod.position.set(0, cH - 1.5, 0);
                        registerSlotMesh(rod, 'rod');

                        // Architectural cube finials
                        const finialL = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3.5), mFinials);
                        finialL.position.set(-cW / 2 - 6, cH - 1.5, 0);
                        const finialR = new THREE.Mesh(new THREE.BoxGeometry(3.5, 3.5, 3.5), mFinials);
                        finialR.position.set(cW / 2 + 6, cH - 1.5, 0);
                        registerSlotMesh(finialL, 'finials');
                        registerSlotMesh(finialR, 'finials');

                        // Full continuous blackout pinch-pleat drape across entire curtain width
                        const drapeGeo = buildContinuousFabricDrapeGeo(cW, cH - 4.5, 9.0, 3.5);
                        const drape = new THREE.Mesh(drapeGeo, mFabric);
                        drape.position.set(0, 0, 0);
                        registerSlotMesh(drape, 'fabric');

                    } else if (config.id === 'curtain_roller_blind') {
                        const mFabric = getDynamicMat('fabric', 'caban_neutral', { color: '#e2e8f0', roughness: 0.7, side: THREE.DoubleSide });
                        const mCassette = getDynamicMat('cassette', 'alum_silver', { color: '#94a3b8', metalness: 0.8, roughness: 0.2 });
                        const mChain = getDynamicMat('chain', 'metal_chrome', { color: '#cbd5e1', metalness: 0.9, roughness: 0.1 });

                        // Top cassette housing
                        const cassette = new THREE.Mesh(new THREE.BoxGeometry(cW, 6, 6), mCassette);
                        cassette.position.set(0, cH - 3, 0);
                        registerSlotMesh(cassette, 'cassette');

                        // Fabric sheet with mapped metric UVs
                        const sheetGeo = new THREE.PlaneGeometry(cW - 2, cH - 8);
                        const sPos = sheetGeo.attributes.position;
                        const sUv = sheetGeo.attributes.uv;
                        for (let i = 0; i < sPos.count; i++) {
                            sUv.setXY(i, (sPos.getX(i) + cW / 2) / 60, (sPos.getY(i) + (cH - 8) / 2) / 60);
                        }
                        sUv.needsUpdate = true;
                        sheetGeo.computeVertexNormals();

                        const sheet = new THREE.Mesh(sheetGeo, mFabric);
                        sheet.position.set(0, (cH - 8) / 2 + 2, 0);
                        registerSlotMesh(sheet, 'fabric');

                        // Bottom weighted teardrop hem bar
                        const hemGeo = new THREE.CylinderGeometry(0.7, 0.7, cW - 2, 16);
                        hemGeo.rotateZ(Math.PI / 2);
                        const hem = new THREE.Mesh(hemGeo, mCassette);
                        hem.position.set(0, 2, 0);
                        registerSlotMesh(hem, 'cassette');

                        // Beaded pull chain
                        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, cH * 0.65, 8), mChain);
                        chain.position.set(cW / 2 - 1.5, cH - 3 - (cH * 0.65) / 2, 2.5);
                        registerSlotMesh(chain, 'chain');

                    } else if (config.id === 'curtain_roman_shade') {
                        const mFabric = getDynamicMat('fabric', 'curly_teddy_checkered', { color: '#f1f5f9', roughness: 0.85, side: THREE.DoubleSide });
                        const mHeadrail = getDynamicMat('headrail', 'wood_white_oak', { color: '#ffffff', roughness: 0.5 });

                        // Top headrail
                        const headrail = new THREE.Mesh(new THREE.BoxGeometry(cW, 4.5, 3.5), mHeadrail);
                        headrail.position.set(0, cH - 2.25, 0);
                        registerSlotMesh(headrail, 'headrail');

                        // 5 horizontal tiered cascading soft fabric folds with continuous UVs
                        const foldCount = 5;
                        const foldH = (cH - 5) / foldCount;
                        for (let i = 0; i < foldCount; i++) {
                            const yPos = (foldCount - 1 - i) * foldH + foldH / 2;
                            const foldGeo = new THREE.BoxGeometry(cW - 1, foldH + 1, 1.2);
                            const fPos = foldGeo.attributes.position;
                            const fUv = foldGeo.attributes.uv;
                            for (let j = 0; j < fPos.count; j++) {
                                fUv.setXY(j, (fPos.getX(j) + cW / 2) / 60, (fPos.getY(j) + yPos) / 60);
                            }
                            fUv.needsUpdate = true;
                            foldGeo.computeVertexNormals();

                            const fold = new THREE.Mesh(foldGeo, mFabric);
                            fold.position.set(0, yPos, 0.5 + i * 0.15);
                            registerSlotMesh(fold, 'fabric');
                        }
                    }

                } else if (config.id.startsWith('rug_')) {
                    const registerSlotMesh = (mesh, slotName) => {
                        mesh.userData.entity = entity;
                        mesh.userData.materialSlot = slotName;
                        mesh.userData.componentId = `${entity.id || 'rug'}_${slotName}`;
                        ComponentRegistry.registerMesh(entity, slotName, mesh, { componentId: mesh.userData.componentId, componentType: config.id });
                        eqGroup.add(mesh);
                        return mesh;
                    };

                    const getDynamicMat = (slotName, defaultKey, defaultProps = {}) => {
                        const slotId = entity.materials?.[slotName]?.id || config.default?.materials?.[slotName]?.id || defaultKey;
                        if (this.ctx?.helpers?.getDynamicMaterial) {
                            return this.ctx.helpers.getDynamicMaterial(slotId, slotName);
                        }
                        return new THREE.MeshStandardMaterial({ ...defaultProps });
                    };

                    const rW = sW;
                    const rH = Math.max(1.0, sH);
                    const rD = sD;

                    if (config.id === 'rug_rectangular_modern' || config.id === 'rug_rectangular_jute') {
                        const mCarpet = getDynamicMat('carpet', config.id === 'rug_rectangular_jute' ? 'wood_golden_teak' : 'curly_teddy_checkered', { color: '#e2e8f0', roughness: 0.9 });
                        const mBorder = getDynamicMat('border', 'caban_neutral', { color: '#64748b', roughness: 0.8 });

                        const base = new THREE.Mesh(new THREE.BoxGeometry(rW, rH, rD), mCarpet);
                        base.position.set(0, rH / 2, 0);
                        registerSlotMesh(base, 'carpet');

                        if (config.id === 'rug_rectangular_modern') {
                            const borderThick = 6;
                            const border = new THREE.Mesh(new THREE.BoxGeometry(rW, rH + 0.1, borderThick), mBorder);
                            border.position.set(0, rH / 2, -rD / 2 + borderThick / 2);
                            const border2 = new THREE.Mesh(new THREE.BoxGeometry(rW, rH + 0.1, borderThick), mBorder);
                            border2.position.set(0, rH / 2, rD / 2 - borderThick / 2);
                            registerSlotMesh(border, 'border');
                            registerSlotMesh(border2, 'border');
                        }

                    } else if (config.id === 'rug_rectangular_persian') {
                        const mCarpet = getDynamicMat('carpet', 'caban_neutral', { color: '#881337', roughness: 0.85 });
                        const mFringes = getDynamicMat('fringes', 'crepe_satin_real', { color: '#fef3c7', roughness: 0.6 });

                        const base = new THREE.Mesh(new THREE.BoxGeometry(rW - 12, rH, rD), mCarpet);
                        base.position.set(0, rH / 2, 0);
                        registerSlotMesh(base, 'carpet');

                        // Fringe tassels on left and right ends
                        const fringeL = new THREE.Mesh(new THREE.BoxGeometry(6, rH * 0.6, rD - 2), mFringes);
                        fringeL.position.set(-rW / 2 + 3, rH * 0.3, 0);
                        const fringeR = new THREE.Mesh(new THREE.BoxGeometry(6, rH * 0.6, rD - 2), mFringes);
                        fringeR.position.set(rW / 2 - 3, rH * 0.3, 0);
                        registerSlotMesh(fringeL, 'fringes');
                        registerSlotMesh(fringeR, 'fringes');

                    } else if (config.id === 'rug_circular_boho' || config.id === 'rug_circular_plush') {
                        const mCarpet = getDynamicMat('carpet', config.id === 'rug_circular_plush' ? 'curly_teddy_checkered' : 'caban_neutral', { color: '#f8fafc', roughness: 0.9 });
                        const radius = rW / 2;

                        const disk = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, rH, 48), mCarpet);
                        disk.position.set(0, rH / 2, 0);
                        registerSlotMesh(disk, 'carpet');

                        if (config.id === 'rug_circular_boho') {
                            const ring = new THREE.Mesh(new THREE.TorusGeometry(radius - 2, 0.4, 8, 48), mCarpet);
                            ring.rotation.x = Math.PI / 2;
                            ring.position.set(0, rH, 0);
                            registerSlotMesh(ring, 'carpet');
                        }
                    }

                } else if (config.id.startsWith('decor_')) {
                    const registerSlotMesh = (mesh, slotName) => {
                        mesh.userData.entity = entity;
                        mesh.userData.materialSlot = slotName;
                        mesh.userData.componentId = `${entity.id || 'decor'}_${slotName}`;
                        ComponentRegistry.registerMesh(entity, slotName, mesh, { componentId: mesh.userData.componentId, componentType: config.id });
                        eqGroup.add(mesh);
                        return mesh;
                    };

                    const getDynamicMat = (slotName, defaultKey, defaultProps = {}) => {
                        const slotId = entity.materials?.[slotName]?.id || config.default?.materials?.[slotName]?.id || defaultKey;
                        if (this.ctx?.helpers?.getDynamicMaterial) {
                            return this.ctx.helpers.getDynamicMaterial(slotId, slotName);
                        }
                        return new THREE.MeshStandardMaterial({ ...defaultProps });
                    };

                    // Procedural high-resolution artwork & clock dial texture synthesizer
                    const createProceduralArtTexture = (type) => {
                        if (typeof document === 'undefined') return null;
                        try {
                            const cvs = document.createElement('canvas');
                            cvs.width = 512;
                            cvs.height = 512;
                            let pCtx = null;
                            try {
                                pCtx = cvs.getContext('2d');
                            } catch (e) {
                                return null;
                            }
                            if (!pCtx) return null;

                            if (type === 'canvas_abstract') {
                                pCtx.fillStyle = '#f6f1eb';
                                pCtx.fillRect(0, 0, 512, 512);

                                // Linen weave canvas grain
                                pCtx.fillStyle = 'rgba(0,0,0,0.025)';
                                for (let i = 0; i < 240; i++) {
                                    pCtx.fillRect(Math.random() * 512, Math.random() * 512, Math.random() * 60 + 20, 1.2);
                                    pCtx.fillRect(Math.random() * 512, Math.random() * 512, 1.2, Math.random() * 60 + 20);
                                }

                                // Terracotta arched geometric form
                                pCtx.fillStyle = '#c2410c';
                                pCtx.beginPath();
                                pCtx.arc(220, 260, 140, Math.PI, 0, false);
                                pCtx.lineTo(360, 440);
                                pCtx.lineTo(80, 440);
                                pCtx.closePath();
                                pCtx.fill();

                                // Sage olive disk
                                pCtx.fillStyle = '#4d5d43';
                                pCtx.beginPath();
                                pCtx.arc(340, 160, 75, 0, Math.PI * 2);
                                pCtx.fill();

                                // Minimalist charcoal curve
                                pCtx.strokeStyle = '#0f172a';
                                pCtx.lineWidth = 4;
                                pCtx.beginPath();
                                pCtx.moveTo(70, 100);
                                pCtx.bezierCurveTo(180, 60, 290, 310, 440, 370);
                                pCtx.stroke();

                                // Gold leaf accent foil arc
                                pCtx.strokeStyle = '#d97706';
                                pCtx.lineWidth = 6;
                                pCtx.beginPath();
                                pCtx.arc(220, 260, 155, Math.PI * 1.1, Math.PI * 1.8);
                                pCtx.stroke();

                                // Artist signature
                                pCtx.fillStyle = '#64748b';
                                pCtx.font = 'italic 15px serif';
                                pCtx.fillText('A. Moreau', 380, 480);

                            } else if (type === 'photo_1') {
                                // Architectural arches photograph with sunlight casting shadows
                                const grad = pCtx.createLinearGradient(0, 0, 512, 512);
                                grad.addColorStop(0, '#f8fafc');
                                grad.addColorStop(1, '#64748b');
                                pCtx.fillStyle = grad;
                                pCtx.fillRect(0, 0, 512, 512);

                                pCtx.fillStyle = '#1e293b';
                                pCtx.beginPath();
                                pCtx.moveTo(80, 0); pCtx.lineTo(220, 0); pCtx.lineTo(380, 512); pCtx.lineTo(240, 512);
                                pCtx.closePath();
                                pCtx.fill();

                                pCtx.fillStyle = '#f1f5f9';
                                pCtx.beginPath();
                                pCtx.arc(256, 210, 100, Math.PI, 0);
                                pCtx.lineTo(356, 512); pCtx.lineTo(156, 512);
                                pCtx.closePath();
                                pCtx.fill();

                                pCtx.fillStyle = 'rgba(251, 191, 36, 0.28)';
                                pCtx.beginPath();
                                pCtx.moveTo(0, 80); pCtx.lineTo(512, 340); pCtx.lineTo(512, 512); pCtx.lineTo(0, 260);
                                pCtx.closePath();
                                pCtx.fill();

                            } else if (type === 'photo_2') {
                                // Golden hour botanical silhouette
                                const sky = pCtx.createLinearGradient(0, 0, 0, 512);
                                sky.addColorStop(0, '#fef08a');
                                sky.addColorStop(0.5, '#f87171');
                                sky.addColorStop(1, '#818cf8');
                                pCtx.fillStyle = sky;
                                pCtx.fillRect(0, 0, 512, 512);

                                pCtx.fillStyle = '#0f172a';
                                pCtx.beginPath();
                                pCtx.moveTo(0, 512);
                                pCtx.quadraticCurveTo(200, 320, 480, 130);
                                pCtx.lineWidth = 6;
                                pCtx.strokeStyle = '#0f172a';
                                pCtx.stroke();

                                for (let i = 0; i < 16; i++) {
                                    const t = i / 16;
                                    const px = 50 + t * 390;
                                    const py = 450 - t * 290;
                                    pCtx.beginPath();
                                    pCtx.moveTo(px, py);
                                    pCtx.quadraticCurveTo(px - 35, py - 55, px - 85, py - 25);
                                    pCtx.lineWidth = 3.5;
                                    pCtx.stroke();
                                }

                            } else if (type === 'photo_3') {
                                // Serene misty mountains & lake
                                const mist = pCtx.createLinearGradient(0, 0, 0, 512);
                                mist.addColorStop(0, '#bae6fd');
                                mist.addColorStop(0.45, '#e0f2fe');
                                mist.addColorStop(0.75, '#f8fafc');
                                mist.addColorStop(1, '#0369a1');
                                pCtx.fillStyle = mist;
                                pCtx.fillRect(0, 0, 512, 512);

                                pCtx.fillStyle = 'rgba(71, 85, 105, 0.45)';
                                pCtx.beginPath();
                                pCtx.moveTo(0, 320); pCtx.lineTo(130, 230); pCtx.lineTo(270, 290); pCtx.lineTo(410, 210); pCtx.lineTo(512, 270); pCtx.lineTo(512, 512); pCtx.lineTo(0, 512);
                                pCtx.closePath();
                                pCtx.fill();

                                pCtx.fillStyle = '#0f172a';
                                pCtx.beginPath();
                                pCtx.moveTo(0, 380); pCtx.lineTo(170, 330); pCtx.lineTo(330, 370); pCtx.lineTo(512, 320); pCtx.lineTo(512, 512); pCtx.lineTo(0, 512);
                                pCtx.closePath();
                                pCtx.fill();
                            }

                            const tex = new THREE.CanvasTexture(cvs);
                            tex.colorSpace = THREE.SRGBColorSpace;
                            tex.needsUpdate = true;
                            return tex;
                        } catch (e) {
                            return null;
                        }
                    };

                    const dW = sW;
                    const dH = sH;
                    const dD = sD;

                    if (config.id === 'decor_wall_art_canvas') {
                        const mFrame = getDynamicMat('frame', 'wood_dark_walnut', { color: '#3d2b1f', roughness: 0.5 });
                        const mCanvas = getDynamicMat('canvas', 'caban_neutral', { color: '#f8fafc', roughness: 0.7 });

                        // Apply procedural gallery abstract painting if no custom user texture was uploaded
                        if (!entity.materials?.canvas?.id) {
                            const artTex = createProceduralArtTexture('canvas_abstract');
                            if (artTex) {
                                mCanvas.map = artTex;
                                mCanvas.color.setHex(0xffffff);
                                mCanvas.needsUpdate = true;
                            }
                        }

                        // Outer 4-piece floating shadow box frame
                        const frameThick = 2.0;
                        const frameDepth = 3.5;
                        const topBar = new THREE.Mesh(new THREE.BoxGeometry(dW, frameThick, frameDepth), mFrame);
                        topBar.position.set(0, dH / 2 - frameThick / 2, 0);
                        const botBar = new THREE.Mesh(new THREE.BoxGeometry(dW, frameThick, frameDepth), mFrame);
                        botBar.position.set(0, -dH / 2 + frameThick / 2, 0);
                        const leftBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, dH - frameThick * 2, frameDepth), mFrame);
                        leftBar.position.set(-dW / 2 + frameThick / 2, 0, 0);
                        const rightBar = new THREE.Mesh(new THREE.BoxGeometry(frameThick, dH - frameThick * 2, frameDepth), mFrame);
                        rightBar.position.set(dW / 2 - frameThick / 2, 0, 0);

                        registerSlotMesh(topBar, 'frame');
                        registerSlotMesh(botBar, 'frame');
                        registerSlotMesh(leftBar, 'frame');
                        registerSlotMesh(rightBar, 'frame');

                        // Recessed stretched canvas board with 0.8cm floating shadow reveal
                        const canvasW = dW - 5.6;
                        const canvasH = dH - 5.6;
                        const canvasGeo = new THREE.BoxGeometry(canvasW, canvasH, 2.0);
                        
                        // Map front face UV coordinates for high-res painting projection
                        const cPos = canvasGeo.attributes.position;
                        const cUv = canvasGeo.attributes.uv;
                        for (let i = 0; i < cPos.count; i++) {
                            cUv.setXY(i, (cPos.getX(i) + canvasW / 2) / canvasW, (cPos.getY(i) + canvasH / 2) / canvasH);
                        }
                        cUv.needsUpdate = true;

                        const canvas = new THREE.Mesh(canvasGeo, mCanvas);
                        canvas.position.set(0, 0, -0.4);
                        registerSlotMesh(canvas, 'canvas');

                    } else if (config.id === 'decor_photo_gallery') {
                        const mFrame = getDynamicMat('frame', 'metal_matte_black', { color: '#1e293b', metalness: 0.8, roughness: 0.3 });
                        const mMatting = getDynamicMat('matting', 'upvc_white', { color: '#f8fafc', roughness: 0.9 });
                        const mGlass = getDynamicMat('glass', 'glass_clear', { color: '#ffffff', transmission: 0.95, roughness: 0.05, transparent: true, opacity: 0.4 });

                        const singleW = (dW - 12) / 3;
                        const offsets = [-singleW - 5, 0, singleW + 5];
                        const photoTypes = ['photo_1', 'photo_2', 'photo_3'];

                        offsets.forEach((ox, pIdx) => {
                            const mPhoto = getDynamicMat('photo', 'crepe_satin_real', { color: '#f8fafc', roughness: 0.2 });
                            if (!entity.materials?.photo?.id) {
                                const photoTex = createProceduralArtTexture(photoTypes[pIdx]);
                                if (photoTex) {
                                    mPhoto.map = photoTex;
                                    mPhoto.color.setHex(0xffffff);
                                    mPhoto.needsUpdate = true;
                                }
                            }

                            // Outer frame molding
                            const frame = new THREE.Mesh(new THREE.BoxGeometry(singleW, dH, 2.2), mFrame);
                            frame.position.set(ox, 0, 0);

                            // Matting board
                            const matting = new THREE.Mesh(new THREE.BoxGeometry(singleW - 2.5, dH - 2.5, 2.3), mMatting);
                            matting.position.set(ox, 0, 0.05);

                            // Proportional high-res photo window (1:1.41 aspect ratio)
                            const pw = singleW * 0.72;
                            const ph = dH * 0.72;
                            const photoGeo = new THREE.BoxGeometry(pw, ph, 2.4);
                            const pPos = photoGeo.attributes.position;
                            const pUv = photoGeo.attributes.uv;
                            for (let i = 0; i < pPos.count; i++) {
                                pUv.setXY(i, (pPos.getX(i) + pw / 2) / pw, (pPos.getY(i) + ph / 2) / ph);
                            }
                            pUv.needsUpdate = true;

                            const photo = new THREE.Mesh(photoGeo, mPhoto);
                            photo.position.set(ox, 0, 0.1);

                            // Protective crystal glass pane
                            const glass = new THREE.Mesh(new THREE.BoxGeometry(singleW - 2.5, dH - 2.5, 0.2), mGlass);
                            glass.position.set(ox, 0, 1.2);

                            registerSlotMesh(frame, 'frame');
                            registerSlotMesh(matting, 'matting');
                            registerSlotMesh(photo, 'photo');
                            eqGroup.add(glass);
                        });

                    } else if (config.id === 'decor_plant_monstera' || config.id === 'decor_plant_snake' || config.id === 'decor_plant_fiddle') {
                        const mPot = getDynamicMat('pot', config.id === 'decor_plant_fiddle' ? 'wood_golden_teak' : 'stone_terrazzo_white', { color: '#f8fafc', roughness: 0.5 });
                        const mFoliage = getDynamicMat('foliage', 'plant_foliage_green', { color: '#2e5e24', roughness: 0.5, metalness: 0.05 });
                        const mSoil = new THREE.MeshStandardMaterial({ color: '#271c19', roughness: 0.95 });
                        const mBark = new THREE.MeshStandardMaterial({ color: '#5c4033', roughness: 0.9 });

                        if (config.id === 'decor_plant_monstera') {
                            // Pot with gold accent saucer
                            const pot = new THREE.Mesh(new THREE.CylinderGeometry(14, 11, 26, 32), mPot);
                            pot.position.y = 13;
                            const saucer = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 1.5, 32), new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.8, roughness: 0.2 }));
                            saucer.position.y = 0.75;
                            const soil = new THREE.Mesh(new THREE.CylinderGeometry(13.5, 13.5, 1, 32), mSoil);
                            soil.position.y = 25;
                            registerSlotMesh(pot, 'pot');
                            eqGroup.add(saucer, soil);

                            // 8 Monstera leaves with arching stems and varied organic orientations
                            const leafAngles = [0, 0.8, 1.6, 2.4, 3.2, 4.0, 4.8, 5.6];
                            leafAngles.forEach((ang, idx) => {
                                const stemH = 30 + (idx % 4) * 8;
                                const stemCurve = new THREE.CatmullRomCurve3([
                                    new THREE.Vector3(0, 25, 0),
                                    new THREE.Vector3(Math.sin(ang) * 8, 25 + stemH * 0.5, Math.cos(ang) * 8),
                                    new THREE.Vector3(Math.sin(ang) * 22, 25 + stemH, Math.cos(ang) * 22)
                                ]);
                                const stem = new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 12, 0.6, 8, false), mFoliage);
                                
                                const blade = new THREE.Mesh(new THREE.SphereGeometry(11, 16, 8), mFoliage);
                                blade.scale.set(1.4, 0.08, 0.9);
                                blade.rotation.set(0.4, ang, 0.4);
                                blade.position.set(Math.sin(ang) * 22, 25 + stemH, Math.cos(ang) * 22);

                                registerSlotMesh(stem, 'foliage');
                                registerSlotMesh(blade, 'foliage');
                            });

                        } else if (config.id === 'decor_plant_snake') {
                            const pot = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 30, 24), mPot);
                            pot.position.y = 15;
                            const soil = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 9.5, 1, 24), mSoil);
                            soil.position.y = 29;
                            registerSlotMesh(pot, 'pot');
                            eqGroup.add(soil);

                            // 14 upright sword blades
                            for (let i = 0; i < 14; i++) {
                                const ang = (i / 14) * Math.PI * 2;
                                const bladeH = 42 + (i % 4) * 16;
                                const blade = new THREE.Mesh(new THREE.ConeGeometry(3, bladeH, 4), mFoliage);
                                blade.scale.set(1.2, 1, 0.2);
                                blade.position.set(Math.sin(ang) * 5.5, 29 + bladeH / 2, Math.cos(ang) * 5.5);
                                blade.rotation.set(0.1 * Math.cos(ang), ang, 0.1 * Math.sin(ang));
                                registerSlotMesh(blade, 'foliage');
                            }

                        } else if (config.id === 'decor_plant_fiddle') {
                            const pot = new THREE.Mesh(new THREE.CylinderGeometry(15, 13, 28, 24), mPot);
                            pot.position.y = 14;
                            const soil = new THREE.Mesh(new THREE.CylinderGeometry(14.5, 14.5, 1, 24), mSoil);
                            soil.position.y = 27;
                            registerSlotMesh(pot, 'pot');
                            eqGroup.add(soil);

                            // Central trunk
                            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.5, 75, 12), mBark);
                            trunk.position.y = 27 + 37.5;
                            eqGroup.add(trunk);

                            // Canopy leaves
                            for (let i = 0; i < 16; i++) {
                                const ang = (i / 16) * Math.PI * 4;
                                const yLvl = 55 + i * 4.5;
                                const leaf = new THREE.Mesh(new THREE.SphereGeometry(9.5, 16, 8), mFoliage);
                                leaf.scale.set(1.5, 0.08, 1.0);
                                leaf.position.set(Math.sin(ang) * 14, yLvl, Math.cos(ang) * 14);
                                leaf.rotation.set(0.3, ang, 0.3);
                                registerSlotMesh(leaf, 'foliage');
                            }
                        }

                    } else if (config.id === 'decor_vases_ceramic') {
                        const mVaseA = getDynamicMat('vaseA', 'stone_terrazzo_white', { color: '#f8fafc', roughness: 0.3 });
                        const mVaseB = getDynamicMat('vaseB', 'metal_brass', { color: '#d97706', metalness: 0.9, roughness: 0.2 });

                        // Tall fluted vase
                        const vaseA = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 6.5, 28, 24), mVaseA);
                        vaseA.position.set(-6.5, 14, 0);
                        const neckA = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3.5, 6, 24), mVaseA);
                        neckA.position.set(-6.5, 31, 0);
                        registerSlotMesh(vaseA, 'vaseA');
                        registerSlotMesh(neckA, 'vaseA');

                        // Squat round brass vase
                        const vaseB = new THREE.Mesh(new THREE.SphereGeometry(7.5, 24, 24), mVaseB);
                        vaseB.scale.set(1, 0.8, 1);
                        vaseB.position.set(7.5, 6.0, 0);
                        const neckB = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 3, 24), mVaseB);
                        neckB.position.set(7.5, 12.5, 0);
                        registerSlotMesh(vaseB, 'vaseB');
                        registerSlotMesh(neckB, 'vaseB');

                        // Dried pampas grass sprigs
                        const stemMat = new THREE.MeshStandardMaterial({ color: '#a16207', roughness: 0.9 });
                        [-2, 0, 2].forEach(off => {
                            const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 22, 8), stemMat);
                            stem.position.set(-6.5 + off, 40, off * 0.8);
                            stem.rotation.z = off * 0.08;
                            eqGroup.add(stem);
                        });
                    }
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
                if (!config.model) {
                    console.error('[FurnitureManager] Missing model for non-procedural or unhandled procedural item:', config.id);
                    const fw = entity.width || config.default?.width || 50;
                    const fh = entity.height || config.default?.height || 50;
                    const fd = entity.depth || config.default?.depth || 50;
                    const fallbackMat = new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true });
                    const fallbackMesh = new THREE.Mesh(new THREE.BoxGeometry(fw, fh, fd), fallbackMat);
                    fallbackMesh.position.set(0, fh/2, 0);
                    wrapper.add(fallbackMesh);
                    size = new THREE.Vector3(fw, fh, fd);
                    center = new THREE.Vector3(0, fh/2, 0);
                    return wrapper;
                }
                const model = await this.ctx.assets.getModel(config);
                const gltfScene = model.clone();
                
                let overridePromises = [];
                gltfScene.traverse((child) => {
                    if (child.isMesh && child.material) {
                        // Clone shared materials
                        child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
                        
                        if (entity.params && entity.params.materialOverrides && entity.params.materialOverrides[child.name]) {
                            const matKey = entity.params.materialOverrides[child.name];
                            if (typeof matKey === 'string' && (matKey.includes('::pattern::') || (FABRIC_REGISTRY && FABRIC_REGISTRY[matKey]))) {
                                overridePromises.push(resolveFabricConfig(matKey).then(fConf => {
                                    if (fConf) {
                                        child.userData.entity = entity;
                                        return MaterialFactory.applyPBRMaterial(child, fConf, this.ctx);
                                    }
                                }));
                            } else {
                                let fConf = null;
                                if (DOOR_MATERIALS_REGISTRY && DOOR_MATERIALS_REGISTRY[matKey]) fConf = DOOR_MATERIALS_REGISTRY[matKey];
                                if (fConf) {
                                    child.userData.entity = entity; // Inject entity for UV density calculation
                                    overridePromises.push(MaterialFactory.applyPBRMaterial(child, fConf, this.ctx));
                                }
                            }
                        }
                    }
                });
                
                if (overridePromises.length > 0) {
                    await Promise.all(overridePromises);
                }
                
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
                if (child.isMesh && !child.userData.isHitbox) { 
                    child.castShadow = true; 
                    child.receiveShadow = true; 
                    if (this.ctx && Array.isArray(this.ctx.interactables)) {
                        this.ctx.interactables.push(child);
                    }
                } 
            });

            // Ensure every mesh child has a unique deterministic name, and register CAD/BIM material slots
            let meshIdxCount = 0;
            const usedNamesMap = new Map();
            wrapper.traverse((child) => {
                if (child.isMesh && !child.userData.isHitbox) {
                    // Only clone materials for generic imported assets without explicit material slots
                    if (!child.userData.materialSlot && child.material) {
                        child.material = Array.isArray(child.material)
                            ? child.material.map(m => m.clone())
                            : child.material.clone();
                    }
                    let base = child.name ? child.name.trim() : '';
                    if (!base) base = `submesh_${meshIdxCount}`;
                    let count = usedNamesMap.get(base) || 0;
                    let finalName = base;
                    if (count > 0) finalName = `${base}_${count}`;
                    usedNamesMap.set(base, count + 1);
                    usedNamesMap.set(finalName, (usedNamesMap.get(finalName) || 0) + 1);
                    child.name = finalName;
                    child.userData.subMeshKey = finalName;
                    meshIdxCount++;

                    // Re-affirm CAD/BIM Material System metadata and ComponentRegistry registration
                    if (child.userData.materialSlot) {
                        child.userData.entity = entity;
                        child.userData.componentId = child.userData.componentId || `${entity.id || 'furn'}_${child.userData.materialSlot}`;
                        ComponentRegistry.registerMesh(entity, child.userData.materialSlot, child, {
                            componentId: child.userData.componentId,
                            componentType: child.userData.componentType || config.id || 'furniture'
                        });
                    }
                }
            });

            // Apply material overrides to specific submeshes / material slots
            let overridePromises = [];
            if (entity.params && entity.params.materialOverrides) {
                wrapper.traverse((child) => {
                    if (child.isMesh && child.material && !child.userData.isHitbox) {
                        child.material = Array.isArray(child.material) ? child.material.map(m => m.clone()) : child.material.clone();
                        child.userData.entity = entity;
                        
                        const mats = Array.isArray(child.material) ? child.material : [child.material];
                        mats.forEach((mat, matIdx) => {
                            const meshKey = child.name || child.userData.subMeshKey;
                            const keyWithMatIndex = Array.isArray(child.material) ? `${meshKey}::mat_${matIdx}` : meshKey;
                            const matKey = entity.params.materialOverrides[keyWithMatIndex] || entity.params.materialOverrides[meshKey];
                            
                            if (matKey) {
                                const targetMatIndex = Array.isArray(child.material) ? matIdx : -1;
                                if (typeof matKey === 'string' && (matKey.includes('::pattern::') || (FABRIC_REGISTRY && FABRIC_REGISTRY[matKey]))) {
                                    overridePromises.push(resolveFabricConfig(matKey).then(fConf => {
                                        if (fConf) {
                                            return MaterialFactory.applyPBRMaterial(child, fConf, this.ctx, targetMatIndex);
                                        }
                                    }));
                                } else {
                                    let fConf = (DOOR_MATERIALS_REGISTRY && DOOR_MATERIALS_REGISTRY[matKey]) ||
                                                (WALL_DECOR_REGISTRY && WALL_DECOR_REGISTRY[matKey]) ||
                                                (GLASS_REGISTRY && GLASS_REGISTRY[matKey]) ||
                                                (MARBLE_REGISTRY && MARBLE_REGISTRY[matKey]) ||
                                                (STONE_REGISTRY && STONE_REGISTRY[matKey]) ||
                                                (METAL_REGISTRY && METAL_REGISTRY[matKey]) ||
                                                (PLASTIC_REGISTRY && PLASTIC_REGISTRY[matKey]) ||
                                                (FABRIC_REGISTRY && FABRIC_REGISTRY[matKey]);
                                    if (fConf) {
                                        overridePromises.push(MaterialFactory.applyPBRMaterial(child, fConf, this.ctx, targetMatIndex));
                                    }
                                }
                            }
                        });
                    }
                });
            }

            if (overridePromises.length > 0) {
                await Promise.all(overridePromises);
            }

            const safeW = size.x > 0 ? size.x : 1, safeH = size.y > 0 ? size.y : 1, safeD = size.z > 0 ? size.z : 1;
            wrapper.userData = { isFurniture: true, entity: entity, originalSize: new THREE.Vector3(safeW, safeH, safeD) };
            entity.mesh3D = wrapper;
            
            if (this.ctx && Array.isArray(this.ctx.interactables)) {
                this.ctx.interactables.push(hitBox);
            }
            if (targetGroup) targetGroup.add(wrapper);
            else if (this.ctx && this.ctx.structureGroup) this.ctx.structureGroup.add(wrapper);
            this.updateLive(entity);

            if (this.ctx && this.ctx.interactions && this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity === entity) {
                this.ctx.interactions.selectObject(wrapper);
            }
            return wrapper;
        } catch (e) { 
            console.error(e);
            return null;
        }
    }

    updateLive(entity) {
        if (!entity || !entity.mesh3D || this.ctx.isUpdatingFrom3D) return;
        this.ctx.isUpdatingFromUI = true;
        const obj = entity.mesh3D;
        const elev = entity.elevation !== undefined ? entity.elevation : (entity.config?.default?.elevation || 0);
        const posX = entity.group ? entity.group.x() : (entity.x || 0);
        const posZ = entity.group ? entity.group.y() : (entity.z !== undefined ? entity.z : (entity.y || 0));
        obj.position.set(posX, elev, posZ);
        obj.rotation.set(
            entity.rotationX || 0,
            -(entity.rotation || 0) * (Math.PI / 180),
            entity.rotationZ || 0,
            'YXZ'
        );
        const origSize = obj.userData.originalSize || new THREE.Vector3(1, 1, 1);
        const targetW = entity.width || origSize.x || 1;
        const targetH = entity.height || origSize.y || 1;
        const targetD = entity.depth || origSize.z || 1;
        const scaleX = (origSize.x > 0 && !isNaN(targetW)) ? targetW / origSize.x : 1;
        const scaleY = (origSize.y > 0 && !isNaN(targetH)) ? targetH / origSize.y : 1;
        const scaleZ = (origSize.z > 0 && !isNaN(targetD)) ? targetD / origSize.z : 1;
        obj.scale.set(scaleX, scaleY, scaleZ);
        obj.updateMatrixWorld();
        this.ctx.isUpdatingFromUI = false;
    }
}