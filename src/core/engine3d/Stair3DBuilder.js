import * as THREE from 'three';
import { WALL_HEIGHT } from '../registry.js';

export class Stair3DBuilder {
    constructor(assets, interactables) {
        this.assets = assets;
        this.interactables = interactables;
        this.matStep = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.8 });
        this.matRiser = new THREE.MeshStandardMaterial({ color: 0xf3f4f6, roughness: 0.9 });
        this.matGlass = new THREE.MeshPhysicalMaterial({ color: 0x88ccff, transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.9 });
        this.matSteel = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.2 });
        this.matWood = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.8 });
        this.matBlack = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    }

    build(stairs, parentGroup, activeIndex) {
        if (!stairs) return;
        stairs.forEach(stair => {
            const stairGroup = new THREE.Group();
            
            if (stair.type === 'staircase_two') {
                this._buildStaircaseTwo(stair, stairGroup);
            } else if (stair.stepData3D && stair.stepData3D.length > 0) {
                this._buildFromStepData(stair.stepData3D, stairGroup, stair.config);
            }

            if (stair.type === 'staircase_two' || (stair.stepData3D && stair.stepData3D.length > 0)) {
                parentGroup.add(stairGroup);
            }
        });

        // --- NEW V3 LOGIC: Completely Independent Smart Chaining Builder ---
        this._buildStairSystemV3(stairs, parentGroup);
        
        // --- NEW V4 LOGIC: Fully Graph-Based Smart Builder ---
        this._buildStairSystemV4(stairs, parentGroup);
    }

    _buildStairSystemV3(stairs, parentGroup) {
        const v3Components = stairs.filter(s => s.type === 'stair' || s.type === 'stair_landing');
        if (v3Components.length === 0) return;

        v3Components.forEach(current => {
            let cursorX = current.absX !== undefined ? current.absX : (current.x || 0);
            let cursorZ = current.absY !== undefined ? current.absY : (current.y || 0); 
            let cursorElev = current.absElev !== undefined ? current.absElev : (current.elevation || 0);
            let radRot = current.absRot !== undefined ? current.absRot : ((current.rotation || 0) * (Math.PI / 180));

            const systemGroup = new THREE.Group();
            systemGroup.userData.systemId = current.systemId || current.id;
            parentGroup.add(systemGroup);
            
            const meshGroup = new THREE.Group();
            meshGroup.position.set(cursorX, cursorElev, cursorZ);
            meshGroup.rotation.y = -radRot; 
            
            meshGroup.userData.entity = current;
            meshGroup.userData.isStair = true;
            this.interactables.push(meshGroup);
            current.mesh3D = meshGroup;

                const leftRailing = new THREE.Group();
                const rightRailing = new THREE.Group();

                // 1. Generate Parametric Stair Flight
                if (current.type === 'stair') {
                    const w = current.width || 100;
                    const c = current.stepCount || 10;
                    const h = current.stepHeight || 17.5;
                    const d = current.stepDepth || 28.0;
                    
                    for (let i = 0; i < c; i++) {
                        const stepG = new THREE.Group();
                        stepG.position.set(0, i * h, i * d);
                        
                        const tGeo = new THREE.BoxGeometry(w, 2, d);
                        tGeo.translate(0, 1, d/2);
                        const tread = new THREE.Mesh(tGeo, this.matStep);
                        tread.castShadow = true; tread.receiveShadow = true;
                        stepG.add(tread);
                        
                        const rGeo = new THREE.BoxGeometry(w, h, 1);
                        rGeo.translate(0, h/2, 0.5);
                        const riser = new THREE.Mesh(rGeo, this.matRiser);
                        riser.castShadow = true; riser.receiveShadow = true;
                        stepG.add(riser);
                        
                        // Add simple balusters
                        const balGeo = new THREE.CylinderGeometry(1.5, 1.5, 90, 8);
                        balGeo.translate(0, 45, 0);
                        const balL = new THREE.Mesh(balGeo, this.matSteel);
                        balL.position.set(-w/2 + 3, i * h, i * d + d/2);
                        leftRailing.add(balL);
                        
                        const balR = new THREE.Mesh(balGeo, this.matSteel);
                        balR.position.set(w/2 - 3, i * h, i * d + d/2);
                        rightRailing.add(balR);
                        
                        meshGroup.add(stepG);
                    }
                    
                    // Handrails
                    const flightLen = Math.hypot(c * d, c * h);
                    const handAng = -Math.atan2(c * h, c * d);
                    const handGeo = new THREE.CylinderGeometry(2.5, 2.5, flightLen, 12);
                    handGeo.rotateX(Math.PI/2); handGeo.translate(0, 90, flightLen/2);
                    
                    const handL = new THREE.Mesh(handGeo, this.matBlack);
                    handL.position.set(-w/2 + 3, 0, 0); handL.rotation.x = handAng; leftRailing.add(handL);
                    const handR = new THREE.Mesh(handGeo, this.matBlack);
                    handR.position.set(w/2 - 3, 0, 0); handR.rotation.x = handAng; rightRailing.add(handR);

                    meshGroup.add(leftRailing, rightRailing);
                } 
                // 2. Generate Parametric Smart Landing
                else if (current.type === 'stair_landing') {
                    const w = current.width || 100;
                    const l = current.length || 100;
                    const t = current.thickness || 20;
                    
                    const lGeo = new THREE.BoxGeometry(w, t, l);
                    lGeo.translate(0, -t/2, l/2);
                    const landing = new THREE.Mesh(lGeo, this.matStep);
                    landing.castShadow = true; landing.receiveShadow = true;
                    meshGroup.add(landing);
                    
                    const children = stairs.filter(s => s.connectedFrom === current.id);
                    let openSides = [];
                    if (current.connectedFrom) { const p = stairs.find(s => s.id === current.connectedFrom); if (p && p.type === 'stair') openSides.push('bottom'); else if (p && p.type === 'stair_landing') { if (current.attachEdge === 'top') openSides.push('bottom'); else if (current.attachEdge === 'bottom') openSides.push('top'); else if (current.attachEdge === 'left') openSides.push('right'); else if (current.attachEdge === 'right') openSides.push('left'); } else openSides.push('bottom'); }
                    children.forEach(c => { if (c.attachEdge) openSides.push(c.attachEdge); });
                    
                    const railH = 90;
                    if (!openSides.includes('left')) { const lRailL = new THREE.Mesh(new THREE.BoxGeometry(3, railH, l), this.matGlass); lRailL.position.set(-w/2 + 1.5, railH/2, l/2); meshGroup.add(lRailL); }
                    if (!openSides.includes('right')) { const lRailR = new THREE.Mesh(new THREE.BoxGeometry(3, railH, l), this.matGlass); lRailR.position.set(w/2 - 1.5, railH/2, l/2); meshGroup.add(lRailR); }
                    if (!openSides.includes('top')) { const lRailT = new THREE.Mesh(new THREE.BoxGeometry(w, railH, 3), this.matGlass); lRailT.position.set(0, railH/2, l - 1.5); meshGroup.add(lRailT); }
                    if (!openSides.includes('bottom')) { const lRailB = new THREE.Mesh(new THREE.BoxGeometry(w, railH, 3), this.matGlass); lRailB.position.set(0, railH/2, 1.5); meshGroup.add(lRailB); }
                }
                
                systemGroup.add(meshGroup);
        });
    }

    _buildStaircaseTwo(stair, group) {
        const config = stair.config;
        group.position.set(stair.x, 0, stair.y);
        group.rotation.y = -config.rotation * Math.PI / 180;

        const w = Number(config.width) || 40;
        const h = Number(config.floorHeight) || WALL_HEIGHT;
        const stepCount = Number(config.stepCount) || 18;
        const tDepth = Number(config.treadDepth) || 11;
        const rHeight = Number(config.riserHeight) || 7.5;

        let currY = 0; // vertical height
        let currZ = 0; // local depth
        let currX = 0; // local x

        const buildStep = (px, pz, py, bw, bd, bh, rotY) => {
            const stepGroup = new THREE.Group();
            stepGroup.position.set(px, py, pz);
            stepGroup.rotation.y = rotY;

            // Tread
            const treadGeo = new THREE.BoxGeometry(bw, 2, bd);
            treadGeo.translate(0, 1, bd/2);
            const tread = new THREE.Mesh(treadGeo, this.matStep);
            tread.castShadow = true; tread.receiveShadow = true;
            stepGroup.add(tread);

            // Riser
            const riserGeo = new THREE.BoxGeometry(bw, bh, 1);
            riserGeo.translate(0, -bh/2 + 1, 0.5);
            const riser = new THREE.Mesh(riserGeo, this.matRiser);
            riser.castShadow = true; riser.receiveShadow = true;
            stepGroup.add(riser);

            group.add(stepGroup);
            return stepGroup;
        };

        const addRailing = (points, isLeft) => {
            if (!config.railing || !config.railing.enabled) return;
            if (isLeft && !config.railing.left) return;
            if (!isLeft && !config.railing.right) return;

            const style = config.railing.style || 'glass';
            const railGroup = new THREE.Group();

            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i+1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const dz = p2.z - p1.z;
                const len = Math.hypot(dx, dz);
                const angle = Math.atan2(dx, dz);

                const section = new THREE.Group();
                section.position.copy(p1);
                section.rotation.y = angle;

                if (style === 'glass') {
                    const glassGeo = new THREE.BoxGeometry(1, 90, len);
                    glassGeo.translate(0, 45, len/2);
                    const pMesh = new THREE.Mesh(glassGeo, this.matGlass);
                    section.add(pMesh);
                    
                    const handGeo = new THREE.BoxGeometry(3, 3, len);
                    handGeo.translate(0, 91.5, len/2);
                    section.add(new THREE.Mesh(handGeo, this.matSteel));
                } else if (style === 'modern' || style === 'steel' || style === 'minimal') {
                    const rMat = style === 'steel' ? this.matSteel : this.matBlack;
                    for (let j = 0; j <= 1; j++) {
                        const post = new THREE.Mesh(new THREE.BoxGeometry(2, 90, 2), rMat);
                        post.position.set(0, 45 + p2.y*j, j * len);
                        section.add(post);
                    }
                    const handGeo = new THREE.BoxGeometry(3, 3, len);
                    handGeo.translate(0, 91.5, len/2);
                    handGeo.rotateX(-Math.atan2(p2.y - p1.y, len));
                    section.add(new THREE.Mesh(handGeo, rMat));
                    
                    if (style !== 'minimal') {
                        for (let j = 1; j <= 4; j++) {
                            const mid = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, len), rMat);
                            const hRatio = j / 5;
                            mid.position.set(0, 90 * hRatio, len/2);
                            mid.position.y += (p2.y - p1.y) * 0.5;
                            mid.rotation.x = -Math.atan2(p2.y - p1.y, len);
                            section.add(mid);
                        }
                    }
                } else {
                    const postGeo = new THREE.BoxGeometry(4, 90, 4);
                    postGeo.translate(0, 45, 0);
                    const p1m = new THREE.Mesh(postGeo, this.matWood);
                    const p2m = new THREE.Mesh(postGeo, this.matWood);
                    p2m.position.z = len; p2m.position.y = p2.y - p1.y;
                    section.add(p1m, p2m);
                    
                    const handGeo = new THREE.BoxGeometry(5, 4, len);
                    handGeo.translate(0, 92, len/2);
                    handGeo.rotateX(-Math.atan2(p2.y - p1.y, len));
                    section.add(new THREE.Mesh(handGeo, this.matWood));
                }
                railGroup.add(section);
            }
            group.add(railGroup);
        };

        const leftPoints = [];
        const rightPoints = [];

        if (config.stairType === 'straight') {
            for (let i = 0; i < stepCount; i++) {
                buildStep(0, currZ, currY, w, tDepth, rHeight, 0);
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
                currZ += tDepth;
                currY += rHeight;
            }
            leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
            rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
        } else if (config.stairType === 'l_shape') {
            const f1Steps = Math.floor(stepCount / 2);
            const f2Steps = stepCount - f1Steps;
            const m = config.isMirrored ? -1 : 1;
            const lDepth = config.landing.enabled ? Math.max(config.landing.length, w) : w;

            for (let i = 0; i < f1Steps; i++) {
                buildStep(0, currZ, currY, w, tDepth, rHeight, 0);
                leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ));
                currZ += tDepth;
                currY += rHeight;
            }
            
            const landGroup = new THREE.Group();
            landGroup.position.set(config.isMirrored ? -w/2 : w/2, currY, currZ);
            const lGeo = new THREE.BoxGeometry(w * 2, 2, lDepth);
            lGeo.translate(config.isMirrored ? w/2 : -w/2, 1, lDepth/2);
            landGroup.add(new THREE.Mesh(lGeo, this.matStep));
            group.add(landGroup);

            leftPoints.push(new THREE.Vector3(-w/2 + 2, currY, currZ + lDepth/2));
            rightPoints.push(new THREE.Vector3(w/2 - 2, currY, currZ + lDepth/2));

            currX = config.isMirrored ? -w : w;
            currZ += lDepth;

            const leftPoints2 = [];
            const rightPoints2 = [];

            for (let i = 0; i < f2Steps; i++) {
                buildStep(currX, currZ - w/2, currY, w, tDepth, rHeight, m * Math.PI/2);
                leftPoints2.push(new THREE.Vector3(currX + tDepth/2 * m, currY, currZ - w/2 - 2*m));
                rightPoints2.push(new THREE.Vector3(currX + tDepth/2 * m, currY, currZ - w/2 + 2*m));
                currX += tDepth * m;
                currY += rHeight;
            }
            addRailing(leftPoints2, true);
            addRailing(rightPoints2, false);
        } else if (config.stairType === 'u_shape' || config.stairType === 'dog_leg') {
            const fSteps = Math.floor(stepCount / 2);
            const f2Steps = stepCount - fSteps;
            const gap = 10;
            const lDepth = config.landing.enabled ? Math.max(config.landing.length, w) : w;

            for (let i = 0; i < fSteps; i++) {
                buildStep(-w/2 - gap/2, currZ, currY, w, tDepth, rHeight, 0);
                leftPoints.push(new THREE.Vector3(-w - gap/2 + 2, currY, currZ));
                rightPoints.push(new THREE.Vector3(-gap/2 - 2, currY, currZ));
                currZ += tDepth;
                currY += rHeight;
            }

            const landGeo = new THREE.BoxGeometry(w * 2 + gap, 2, lDepth);
            landGeo.translate(0, 1, lDepth/2);
            const land = new THREE.Mesh(landGeo, this.matStep);
            land.position.set(0, currY, currZ);
            group.add(land);

            currZ += lDepth;
            const leftPoints2 = [];
            const rightPoints2 = [];

            for (let i = 0; i < f2Steps; i++) {
                buildStep(w/2 + gap/2, currZ, currY, w, tDepth, rHeight, Math.PI);
                leftPoints2.push(new THREE.Vector3(gap/2 + 2, currY, currZ));
                rightPoints2.push(new THREE.Vector3(w + gap/2 - 2, currY, currZ));
                currZ -= tDepth;
                currY += rHeight;
            }
            addRailing(leftPoints2, true);
            addRailing(rightPoints2, false);
        } else if (config.stairType === 'spiral' || config.stairType === 'circular') {
            const rOut = w;
            const rIn = w * 0.2;
            const angleStep = (Math.PI * 2 * 0.8) / stepCount;

            const pole = new THREE.Mesh(new THREE.CylinderGeometry(rIn, rIn, h, 16), this.matSteel);
            pole.position.set(0, h/2, 0);
            group.add(pole);

            for (let i = 0; i < stepCount; i++) {
                const a = i * angleStep;
                const stepG = new THREE.Group();
                stepG.position.set(0, currY, 0);
                stepG.rotation.y = -a;

                const shape = new THREE.Shape();
                shape.moveTo(rIn, -2);
                shape.lineTo(rOut, -tDepth/2);
                shape.lineTo(rOut, tDepth/2);
                shape.lineTo(rIn, 2);

                const tGeo = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
                tGeo.rotateX(Math.PI/2);
                stepG.add(new THREE.Mesh(tGeo, this.matStep));
                
                leftPoints.push(new THREE.Vector3(Math.cos(-a)*(rOut-2), currY, Math.sin(-a)*(rOut-2)));
                group.add(stepG);
                currY += rHeight;
            }
            addRailing(leftPoints, true);
        }
        
        if (config.stairType !== 'spiral' && config.stairType !== 'circular') {
            addRailing(leftPoints, true);
            addRailing(rightPoints, false);
        }
    }

    _buildFromStepData(stepData3D, group, config) {
        stepData3D.forEach(sd => {
            if (sd.type === 'step') {
                const stepG = new THREE.Group();
                stepG.position.set(sd.x, sd.y, sd.z);
                if (sd.angle) stepG.rotation.y = -sd.angle;

                const treadGeo = new THREE.BoxGeometry(sd.w, 2, sd.d);
                treadGeo.translate(0, 1, 0);
                stepG.add(new THREE.Mesh(treadGeo, this.matStep));

                const riserGeo = new THREE.BoxGeometry(sd.w, sd.h, 1);
                riserGeo.translate(0, -sd.h/2 + 1, -sd.d/2);
                stepG.add(new THREE.Mesh(riserGeo, this.matRiser));

                group.add(stepG);
            } else if (sd.type === 'landing_poly') {
                if (!sd.pts || sd.pts.length < 3) return;
                const shape = new THREE.Shape();
                shape.moveTo(sd.pts[0].x, sd.pts[0].y);
                for (let i = 1; i < sd.pts.length; i++) shape.lineTo(sd.pts[i].x, sd.pts[i].y);
                const geo = new THREE.ExtrudeGeometry(shape, { depth: 2, bevelEnabled: false });
                geo.rotateX(Math.PI/2);
                const mesh = new THREE.Mesh(geo, this.matStep);
                mesh.position.y = sd.y + 2;
                group.add(mesh);
            }
        });
    }

    static getStairHoles(stairs) {
        const holes = [];
        stairs.forEach(stair => {
            if (!stair.config) return;
            const w = stair.config.width || 40;
            const tDepth = stair.config.treadDepth || 11;
            const count = stair.config.stepCount || 18;
            const l = tDepth * count;

            let pts = [];
            const r = (stair.config.rotation || 0) * Math.PI / 180;
            const cos = Math.cos(-r); // negate because threejs y rot is negative
            const sin = Math.sin(-r);

            const transform = (lx, lz) => {
                return {
                    x: stair.x + lx * cos + lz * sin,
                    y: stair.y - lx * sin + lz * cos
                };
            };

            if (stair.config.stairType === 'straight') {
                pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
            } else if (stair.config.stairType === 'l_shape') {
                const f1 = Math.floor(count/2) * tDepth;
                const f2 = (count - Math.floor(count/2)) * tDepth;
                const ld = stair.config.landing?.length || w;
                const m = stair.config.isMirrored ? -1 : 1;
                const signX = stair.config.isMirrored ? -1 : 1;
                if (stair.config.isMirrored) {
                     pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, f1+ld), transform(-w/2-f2, f1+ld), transform(-w/2-f2, f1), transform(-w/2, f1) ];
                } else {
                     pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, f1), transform(w/2+f2, f1), transform(w/2+f2, f1+ld), transform(-w/2, f1+ld) ];
                }
            } else if (stair.config.stairType === 'u_shape' || stair.config.stairType === 'dog_leg') {
                const f1 = Math.floor(count/2) * tDepth;
                const ld = stair.config.landing?.length || w;
                const gap = 10;
                pts = [ transform(-w-gap/2, 0), transform(w+gap/2, 0), transform(w+gap/2, f1+ld), transform(-w-gap/2, f1+ld) ];
            } else if (stair.config.stairType === 'spiral' || stair.config.stairType === 'circular') {
                for (let a = 0; a < Math.PI * 2; a += Math.PI/4) {
                    pts.push({ x: stair.x + Math.cos(a)*w, y: stair.y + Math.sin(a)*w });
                }
            } else {
                pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
            }

            if (pts.length > 0) {
                const holePath = new THREE.Path();
                holePath.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
                holePath.lineTo(pts[0].x, pts[0].y);
                holes.push(holePath);
            }
        });
        
        // --- NEW V3 LOGIC: Accurate hole cutting for smart chained nodes ---
        const v3Components = stairs.filter(s => s.type === 'stair' || s.type === 'stair_landing');
        
        v3Components.forEach(current => {
            let cursorX = current.absX !== undefined ? current.absX : (current.x || 0);
            let cursorZ = current.absY !== undefined ? current.absY : (current.y || 0); 
            let radRot = current.absRot !== undefined ? current.absRot : ((current.rotation || 0) * (Math.PI / 180));
            let w = current.width || 100;
            let l = current.type === 'stair' ? (current.stepCount || 10) * (current.stepDepth || 28.0) : (current.length || 100);
            
            const cos = Math.cos(-radRot);
            const sin = Math.sin(-radRot);
            
            const transform = (lx, lz) => ({
                x: cursorX + lx * cos + lz * sin,
                y: cursorZ - lx * sin + lz * cos 
            });
            
            const pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
            
            const holePath = new THREE.Path();
            holePath.moveTo(pts[0].x, pts[0].y);
            for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
            holePath.lineTo(pts[0].x, pts[0].y);
            holes.push(holePath);
        });

        // --- NEW V4 LOGIC: Hole cutting ---
        const v4Components = stairs.filter(s => s.type === 'stair_v4_flight' || s.type === 'stair_v4_landing');
        v4Components.forEach(current => {
            let cursorX = current.x || 0;
            let cursorZ = current.y || 0; 
            let radRot = (current.rotation || 0) * (Math.PI / 180);
            let w = current.width || 100;
            let l = current.length || 100;
            
            const cos = Math.cos(-radRot);
            const sin = Math.sin(-radRot);
            
            const transform = (lx, lz) => ({
                x: cursorX + lx * cos + lz * sin,
                y: cursorZ - lx * sin + lz * cos 
            });
            
            if (current.shape === 'u_curve') {
                const rIn = current.innerRadius || 20;
                const rOut = rIn + l;
                const segments = 16;
                const pts = [];
                for(let i=0; i<=segments; i++) {
                    const ang = Math.PI - (i/segments)*Math.PI;
                    pts.push(transform(rOut * Math.cos(ang), -rOut * Math.sin(ang)));
                }
                for(let i=0; i<=segments; i++) {
                    const ang = (i/segments)*Math.PI;
                    pts.push(transform(rIn * Math.cos(ang), -rIn * Math.sin(ang)));
                }
                const holePath = new THREE.Path();
                holePath.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
                holePath.lineTo(pts[0].x, pts[0].y);
                holes.push(holePath);
            } else {
                const pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
                const holePath = new THREE.Path();
                holePath.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
                holePath.lineTo(pts[0].x, pts[0].y);
                holes.push(holePath);
            }
        });

        return holes;
    }

    _buildStairSystemV4(stairs, parentGroup) {
        const v4Components = stairs.filter(s => s.type === 'stair_v4_flight' || s.type === 'stair_v4_landing');
        if (v4Components.length === 0) return;

        v4Components.forEach(current => {
            let cursorX = current.x || 0;
            let cursorZ = current.y || 0; 
            let cursorElev = current.elevation || 0;
            let radRot = (current.rotation || 0) * (Math.PI / 180);

            const systemGroup = new THREE.Group();
            systemGroup.userData.systemId = current.systemId || current.id;
            parentGroup.add(systemGroup);
            
            const meshGroup = new THREE.Group();
            meshGroup.position.set(cursorX, cursorElev, cursorZ);
            meshGroup.rotation.y = -radRot; 
            
            meshGroup.userData.entity = current;
            meshGroup.userData.isStair = true;
            this.interactables.push(meshGroup);
            current.mesh3D = meshGroup;

            const leftRailing = new THREE.Group();
            const rightRailing = new THREE.Group();

            if (current.type === 'stair_v4_flight') {
                const w = current.width || 100;
                const c = current.stepCount || 10;
                const h = current.stepHeight || 17.5;
                const d = current.stepDepth || 28.0;
                
                for (let i = 0; i < c; i++) {
                    const stepG = new THREE.Group();
                    stepG.position.set(0, i * h, i * d);
                    
                    const tGeo = new THREE.BoxGeometry(w, 2, d);
                    tGeo.translate(0, 1, d/2);
                    const tread = new THREE.Mesh(tGeo, this.matStep);
                    tread.castShadow = true; tread.receiveShadow = true;
                    stepG.add(tread);
                    
                    const rGeo = new THREE.BoxGeometry(w, h, 1);
                    rGeo.translate(0, h/2, 0.5);
                    const riser = new THREE.Mesh(rGeo, this.matRiser);
                    riser.castShadow = true; riser.receiveShadow = true;
                    stepG.add(riser);
                    
                    const balGeo = new THREE.CylinderGeometry(1.5, 1.5, 90, 8);
                    balGeo.translate(0, 45, 0);
                    const balL = new THREE.Mesh(balGeo, this.matSteel);
                    balL.position.set(-w/2 + 3, i * h, i * d + d/2);
                    leftRailing.add(balL);
                    
                    const balR = new THREE.Mesh(balGeo, this.matSteel);
                    balR.position.set(w/2 - 3, i * h, i * d + d/2);
                    rightRailing.add(balR);
                    
                    meshGroup.add(stepG);
                }
                
                const flightLen = Math.hypot(c * d, c * h);
                const handAng = -Math.atan2(c * h, c * d);
                const handGeo = new THREE.CylinderGeometry(2.5, 2.5, flightLen, 12);
                handGeo.rotateX(Math.PI/2); handGeo.translate(0, 90, flightLen/2);
                
                const handL = new THREE.Mesh(handGeo, this.matBlack);
                handL.position.set(-w/2 + 3, 0, 0); handL.rotation.x = handAng; leftRailing.add(handL);
                const handR = new THREE.Mesh(handGeo, this.matBlack);
                handR.position.set(w/2 - 3, 0, 0); handR.rotation.x = handAng; rightRailing.add(handR);

                meshGroup.add(leftRailing, rightRailing);
            } 
            else if (current.type === 'stair_v4_landing') {
                const w = current.width || 100;
                const l = current.length || 100;
                const shapeType = current.shape || 'rectangular';
                const t = 20; 
                
                const railH = 90;
                if (shapeType === 'u_curve') {
                    const rIn = current.innerRadius || 20;
                    const rOut = rIn + l;
                    const segments = 16;
                    const shape = new THREE.Shape();
                    for(let i=0; i<=segments; i++) {
                        const ang = Math.PI - (i/segments)*Math.PI;
                        if(i===0) shape.moveTo(rOut * Math.cos(ang), -rOut * Math.sin(ang));
                        else shape.lineTo(rOut * Math.cos(ang), -rOut * Math.sin(ang));
                    }
                    for(let i=0; i<=segments; i++) {
                        const ang = (i/segments)*Math.PI;
                        shape.lineTo(rIn * Math.cos(ang), -rIn * Math.sin(ang));
                    }
                    
                    const lGeo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
                    lGeo.rotateX(Math.PI/2);
                    const landing = new THREE.Mesh(lGeo, this.matStep);
                    landing.castShadow = true; landing.receiveShadow = true;
                    meshGroup.add(landing);
                    
                    const createCurvedRailing = (radius) => {
                        const rShape = new THREE.Shape();
                        for(let i=0; i<=segments; i++) {
                            const ang = Math.PI - (i/segments)*Math.PI;
                            if (i===0) rShape.moveTo((radius + 1.5) * Math.cos(ang), -(radius + 1.5) * Math.sin(ang));
                            else rShape.lineTo((radius + 1.5) * Math.cos(ang), -(radius + 1.5) * Math.sin(ang));
                        }
                        for(let i=0; i<=segments; i++) {
                            const ang = (i/segments)*Math.PI;
                            rShape.lineTo((radius - 1.5) * Math.cos(ang), -(radius - 1.5) * Math.sin(ang));
                        }
                        const rGeo = new THREE.ExtrudeGeometry(rShape, { depth: railH, bevelEnabled: false });
                        rGeo.rotateX(Math.PI/2);
                        rGeo.translate(0, railH, 0);
                        return new THREE.Mesh(rGeo, this.matGlass);
                    };
                    
                    meshGroup.add(createCurvedRailing(rOut - 1.5));
                    meshGroup.add(createCurvedRailing(rIn + 1.5));
                } else {
                    const lGeo = new THREE.BoxGeometry(w, t, l);
                    lGeo.translate(0, -t/2, l/2);
                    const landing = new THREE.Mesh(lGeo, this.matStep);
                    landing.castShadow = true; landing.receiveShadow = true;
                    meshGroup.add(landing);
                    
                    const occupiedEdges = [];
                    if (current.connections) {
                        current.connections.forEach(conn => {
                            if (conn.mySpot.startsWith('south') || conn.mySpot === 'south') occupiedEdges.push('south');
                            if (conn.mySpot.startsWith('north') || conn.mySpot === 'north') occupiedEdges.push('north');
                            if (conn.mySpot.startsWith('east') || conn.mySpot === 'east') occupiedEdges.push('east');
                            if (conn.mySpot.startsWith('west') || conn.mySpot === 'west') occupiedEdges.push('west');
                        });
                    }

                    // Flow Direction Arrow
                    const aLen = Math.min(l - 20, 60);
                    const aBodyGeo = new THREE.BoxGeometry(2, 0.5, aLen - 10);
                    const aHeadGeo = new THREE.ConeGeometry(6, 12, 4);
                    aHeadGeo.rotateX(Math.PI/2);
                    aHeadGeo.rotateY(Math.PI/4); 
                    aHeadGeo.translate(0, 0, aLen/2 - 6);
                    const arrowG = new THREE.Group();
                    arrowG.add(new THREE.Mesh(aBodyGeo, this.matBlack));
                    arrowG.add(new THREE.Mesh(aHeadGeo, this.matBlack));
                    arrowG.position.set(0, t/2 + 0.2, l/2);
                    
                    const aRot = (current.arrowRotation || 0) * Math.PI / 180;
                    arrowG.rotation.y = -aRot; 
                    
                    meshGroup.add(arrowG);

                    if (!occupiedEdges.includes('west')) { const lRailL = new THREE.Mesh(new THREE.BoxGeometry(3, railH, l), this.matGlass); lRailL.position.set(-w/2 + 1.5, railH/2, l/2); meshGroup.add(lRailL); }
                    if (!occupiedEdges.includes('east')) { const lRailR = new THREE.Mesh(new THREE.BoxGeometry(3, railH, l), this.matGlass); lRailR.position.set(w/2 - 1.5, railH/2, l/2); meshGroup.add(lRailR); }
                    if (!occupiedEdges.includes('north')) { const lRailT = new THREE.Mesh(new THREE.BoxGeometry(w, railH, 3), this.matGlass); lRailT.position.set(0, railH/2, l - 1.5); meshGroup.add(lRailT); }
                    if (!occupiedEdges.includes('south')) { const lRailB = new THREE.Mesh(new THREE.BoxGeometry(w, railH, 3), this.matGlass); lRailB.position.set(0, railH/2, 1.5); meshGroup.add(lRailB); }
                }
            }
            
            systemGroup.add(meshGroup);
        });
    }
}
