import * as THREE from 'three';
import { RAILING_REGISTRY } from '../registry.js';

export class RailingBuilder {
    constructor(assets, interactables, structureGroup) {
        this.assets = assets;
        this.interactables = interactables;
        this.structureGroup = structureGroup;
    }

    build(railingWalls, standardWalls = null) {
        railingWalls.forEach(w => {
            const p1 = w.startAnchor ? w.startAnchor.position() : { x: w.startX, y: w.startY };
            const p2 = w.endAnchor ? w.endAnchor.position() : { x: w.endX, y: w.endY };
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            w.length3D = length;

            const edge = {
                start: new THREE.Vector3(p1.x, 0, p1.y),
                end: new THREE.Vector3(p2.x, 0, p2.y)
            };

            const configId = w.configId || 'rail_1';
            const config = RAILING_REGISTRY[configId] || RAILING_REGISTRY['rail_1'];
            
            const wallGroup = new THREE.Group();
            wallGroup.position.set(0, 0, 0);

            let hitGeo;
            let isMitered = false;
            let railingHeight = w.height !== undefined && w.height !== null && w.height !== 0 ? w.height : (w.config?.height || 40);
            if (railingHeight === 0) railingHeight = 40;

            let elevation = 0;
            let underlyingWall = null;
            if (standardWalls) {
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                for (let sw of standardWalls) {
                    const sp1 = sw.startAnchor ? sw.startAnchor.position() : { x: sw.startX, y: sw.startY };
                    const sp2 = sw.endAnchor ? sw.endAnchor.position() : { x: sw.endX, y: sw.endY };
                    const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                    const lenSq = C * C + D * D;
                    if (lenSq !== 0) {
                        const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                        if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                            underlyingWall = sw;
                            if (sw.type !== 'railing') {
                                elevation = sw.height !== undefined ? sw.height : (sw.config?.height || 120);
                                break;
                            }
                        }
                    }
                }
            }

            // Use the exact mitered 2D boundaries for extrusion if available
            if (w.poly && typeof w.poly.points === 'function') {
                const pts = w.poly.points();
                if (pts && pts.length === 8) {
                    const shape = new THREE.Shape();
                    shape.moveTo(pts[0], pts[1]);
                    shape.lineTo(pts[2], pts[3]);
                    shape.lineTo(pts[4], pts[5]);
                    shape.lineTo(pts[6], pts[7]);
                    shape.lineTo(pts[0], pts[1]);
                    hitGeo = new THREE.ExtrudeGeometry(shape, { depth: railingHeight, bevelEnabled: false });
                    hitGeo.rotateX(Math.PI / 2);
                    isMitered = true;
                }
            }
            
            if (!isMitered) {
                hitGeo = new THREE.BoxGeometry(length, railingHeight, 10);
                hitGeo.translate(length / 2, railingHeight / 2, 0);
            }

            const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
            if (isMitered) {
                hitMesh.position.set(0, elevation + railingHeight, 0);
            } else {
                hitMesh.position.set(p1.x, elevation, p1.y);
                hitMesh.rotation.y = -Math.atan2(dz, dx);
            }
            hitMesh.userData = { isWallSide: true, side: 'front', entity: w };
            wallGroup.add(hitMesh);
            this.interactables.push(hitMesh);

            this.structureGroup.add(wallGroup);
            w.mesh3D = wallGroup;

            const buildFallback = () => {
                console.log(`[3D Engine] Using Fallback Solid Geometry for Railing.`);
                let geo;
                if (isMitered) {
                    const pts = w.poly.points();
                    const shape = new THREE.Shape();
                    shape.moveTo(pts[0], pts[1]);
                    shape.lineTo(pts[2], pts[3]);
                    shape.lineTo(pts[4], pts[5]);
                    shape.lineTo(pts[6], pts[7]);
                    shape.lineTo(pts[0], pts[1]);
                    geo = new THREE.ExtrudeGeometry(shape, { depth: railingHeight, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2);
                } else {
                    geo = new THREE.BoxGeometry(length, railingHeight, w.config?.thickness || 4);
                    geo.translate(length / 2, railingHeight / 2, 0);
                }
                
                const mat = new THREE.MeshStandardMaterial({ color: config?.color || 0xcccccc, transparent: config?.transparent || false, opacity: config?.opacity || 1 });
                const mesh = new THREE.Mesh(geo, mat);
                
                if (isMitered) {
                    mesh.position.set(0, elevation + railingHeight, 0);
                } else {
                    mesh.position.set(p1.x, elevation, p1.y);
                    mesh.rotation.y = -Math.atan2(dz, dx);
                }
                mesh.castShadow = true; mesh.receiveShadow = true;
                wallGroup.add(mesh);
            };

            if (config && config.model) {
                console.log(`[3D Engine] Attempting to load Railing GLB Model: ${config.model}`);
                this.assets.getModel(config).then(model => {
                    console.log(`[3D Engine] Successfully loaded GLB. Analyzing size...`);
                    const clone = model.clone();
                    
                    clone.updateMatrixWorld(true);
                    
                    const initialBox = new THREE.Box3().setFromObject(clone);
                    const initialSize = initialBox.getSize(new THREE.Vector3());
                    const center = initialBox.getCenter(new THREE.Vector3());

                    if (initialSize.y === 0 || initialSize.x === 0) {
                        console.warn(`[3D Engine] Invalid model size (X or Y is 0). Falling back to solid geometry.`);
                        buildFallback();
                        return;
                    }

                    const TARGET_HEIGHT = railingHeight;
                    const scaleFactor = TARGET_HEIGHT / initialSize.y;

                    clone.traverse((child) => {
                        if (child.isMesh) {
                            child.geometry = child.geometry.clone();
                            if (child.material) {
                                child.material = Array.isArray(child.material)
                                    ? child.material.map(m => m.clone())
                                    : child.material.clone();
                            }
                            child.geometry.translate(-center.x, -initialBox.min.y, -center.z);
                            child.geometry.scale(scaleFactor, scaleFactor, scaleFactor);
                            child.castShadow = true; child.receiveShadow = true;
                        }
                    });
                    
                    clone.position.set(0, 0, 0);
                    clone.rotation.set(0, 0, 0);
                    clone.scale.set(1, 1, 1);
                    clone.updateMatrixWorld(true);

                    const currentRailingLength = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3()).x;
                    const edgeVector = new THREE.Vector3().subVectors(edge.end, edge.start);
                    const edgeLength = edgeVector.length();
                    const direction = edgeVector.clone().normalize();

                    const count = Math.floor(edgeLength / currentRailingLength);
                    let stretchScale = 1;
                    let actualCount = count;

                    if (count === 0) {
                        stretchScale = edgeLength / currentRailingLength;
                        actualCount = 1;
                    } else {
                        stretchScale = (edgeLength / count) / currentRailingLength;
                    }
                    
                    for (let i = 0; i < actualCount; i++) {
                        const inst = clone.clone();
                        inst.scale.set(stretchScale, 1, 1);

                        const segmentLength = (currentRailingLength * stretchScale);
                        const offsetDistance = (i * segmentLength) + (segmentLength / 2);

                        const position = edge.start.clone().add(direction.clone().multiplyScalar(offsetDistance));
                        position.y = elevation; // Lift railing to sit on top of underlying wall
                        inst.position.copy(position);

                        const target = position.clone().add(direction);
                        inst.lookAt(target);
                        inst.rotateY(-Math.PI / 2);

                        wallGroup.add(inst);
                    }
                }).catch(e => {
                    console.error(`[3D Engine] Failed to load railing model from ${config.model}:`, e);
                    buildFallback();
                });
            } else {
                buildFallback();
            }
        });
    }
}
