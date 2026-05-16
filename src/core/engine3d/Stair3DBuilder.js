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

            parentGroup.add(stairGroup);
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
        return holes;
    }
}
