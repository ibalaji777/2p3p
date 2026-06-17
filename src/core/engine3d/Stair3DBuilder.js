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
        this._buildStairSystemV4(stairs, parentGroup);
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

    static getStairHoles(stairs) {
        const holes = [];
        
        const v4Components = stairs.filter(s => s.type === 'stair_v4_flight' || s.type === 'stair_v4_landing');
        v4Components.forEach(current => {
            let cursorX = current.x || 0;
            let cursorZ = current.y || 0; 
            let radRot = (current.rotation || 0) * (Math.PI / 180);
            
            const cos = Math.cos(-radRot);
            const sin = Math.sin(-radRot);
            const transform = (lx, lz) => ({
                x: cursorX + lx * cos + lz * sin,
                y: cursorZ - lx * sin + lz * cos 
            });
            
            const holePath = new THREE.Path();

            if (current.type === 'stair_v4_landing' && current.shape === 'u_curve') {
                const rIn = current.innerRadius || 20;
                const rOut = rIn + (current.length || 100);
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
                if (pts.length > 0) {
                    holePath.moveTo(pts[0].x, pts[0].y);
                    for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
                    holePath.lineTo(pts[0].x, pts[0].y);
                    holes.push(holePath);
                }
            } else {
                let w = current.width || 100;
                let l = current.type === 'stair_v4_flight' ? (current.stepCount || 10) * (current.stepDepth || 28.0) : (current.length || 100);
                
                const pts = [ transform(-w/2, 0), transform(w/2, 0), transform(w/2, l), transform(-w/2, l) ];
                holePath.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) holePath.lineTo(pts[i].x, pts[i].y);
                holePath.lineTo(pts[0].x, pts[0].y);
                holes.push(holePath);
            }
        });

        return holes;
    }
}
