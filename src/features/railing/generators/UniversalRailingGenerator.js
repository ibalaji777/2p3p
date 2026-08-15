import * as THREE from 'three';

/**
 * Universal Railing Generator
 * Authoritative generator for all railing types (stair railings, level floor railings,
 * handrails, glass panels, cables, balusters, and newel posts).
 */
export class UniversalRailingGenerator {
    static generate(path, config, materials, entity = null) {
        const group = new THREE.Group();
        if (!path || path.type !== 'linear') return group;

        const startH = path.start.y;
        const endH = path.end.y;
        const flightLength = Math.hypot(path.end.x - path.start.x, path.end.z - path.start.z);

        const rHeight = config.height || 40;
        const hSize = config.handrail?.height || 3.33;

        const totalSteps = Number(entity?.totalSteps) || Number(entity?.stepCount) || Number(entity?.flight1Steps) || 10;
        const stepCount = Math.max(1, totalSteps);
        const totalH = Math.abs(endH - startH);
        const stepHeight = totalH > 0 ? (totalH / stepCount) : 15;
        const stepDepth = flightLength > 0 ? (flightLength / stepCount) : 25;
        const minH = Math.min(startH, endH);
        const isFlat = totalH < 0.1;

        const rMat = materials.handrail;
        const bMat = materials.baluster || materials.post;
        const pMat = materials.glass;
        const cMat = materials.cable;

        // Position group at path.start (horizontally), Y=0 for absolute height math
        group.position.set(path.start.x, 0, path.start.z);
        
        // Rotate group to align with path horizontal direction
        const rotY = -Math.atan2(path.end.z - path.start.z, path.end.x - path.start.x);
        group.rotation.y = rotY;

        const railX = -hSize / 2; 

        // 1. Handrail
        if (config.handrail) {
            const hShape = new THREE.Shape();
            const vThick = hSize;
            hShape.moveTo(0, startH + rHeight);
            hShape.lineTo(flightLength, endH + rHeight);
            hShape.lineTo(flightLength, endH + rHeight - vThick);
            hShape.lineTo(0, startH + rHeight - vThick);
            hShape.closePath();

            const extrudeSettings = { depth: hSize, bevelEnabled: false };
            const hGeo = new THREE.ExtrudeGeometry(hShape, extrudeSettings);
            const hMesh = new THREE.Mesh(hGeo, rMat);
            hMesh.position.set(0, 0, railX); 
            hMesh.castShadow = true; 
            hMesh.receiveShadow = true;
            group.add(hMesh);
        }

        // 2. Glass Panels
        if (config.glass) {
            const gThick = config.glass.thickness || 1.5;
            const gShape = new THREE.Shape();
            const bottomGap = config.glass.bottomGap || 5;
            gShape.moveTo(0, startH + bottomGap);
            gShape.lineTo(flightLength, endH + bottomGap);
            gShape.lineTo(flightLength, endH + rHeight - hSize - 2);
            gShape.lineTo(0, startH + rHeight - hSize - 2);
            gShape.closePath();
            
            const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: gThick, bevelEnabled: false });
            const gMesh = new THREE.Mesh(gGeo, pMat);
            gMesh.position.set(0, 0, railX + hSize / 2 - gThick / 2);
            gMesh.castShadow = true; 
            gMesh.receiveShadow = true;
            group.add(gMesh);
        } 
        // 3. Cable Rails
        else if (config.cable) {
            const cables = config.cable.count || 5;
            const cDiam = config.cable.diameter || 0.8;
            const span = rHeight - hSize - 10;
            const gap = span / (cables + 1);
            
            for (let k = 1; k <= cables; k++) {
                const cShape = new THREE.Shape();
                const cHeight = 5 + k * gap;
                cShape.moveTo(0, startH + cHeight);
                cShape.lineTo(flightLength, endH + cHeight);
                cShape.lineTo(flightLength, endH + cHeight - cDiam);
                cShape.lineTo(0, startH + cHeight - cDiam);
                cShape.closePath();
                
                const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: cDiam, bevelEnabled: false });
                const cMesh = new THREE.Mesh(cGeo, cMat);
                cMesh.position.set(0, 0, railX + hSize / 2 - cDiam / 2);
                cMesh.castShadow = true; 
                cMesh.receiveShadow = true;
                group.add(cMesh);
            }
        } 
        // 4. Vertical Balusters
        else if (config.baluster) {
            const bSize = config.baluster.width || 4;
            const bShape = config.baluster.shape || 'square';
            const bSpacing = config.baluster.spacing || 15;

            if (isFlat) {
                // Normal Level Railing (Flat Floor)
                const numBalusters = Math.floor(flightLength / bSpacing);
                const nSize = config.post ? (config.post.width || 8) : 0;
                const actualBalHeight = Math.max(5, rHeight - (config.handrail ? hSize : 0));

                const bGeo = bShape === 'round' ? new THREE.CylinderGeometry(bSize / 2, bSize / 2, actualBalHeight, 16) : new THREE.BoxGeometry(bSize, actualBalHeight, bSize);

                for (let k = 0; k <= numBalusters; k++) {
                    const bZ = k * bSpacing;
                    // Skip small balusters at newel post locations at start/end
                    if (config.post && (bZ < nSize || bZ > flightLength - nSize)) {
                        continue;
                    }

                    const bm = new THREE.Mesh(bGeo, bMat);
                    bm.position.set(bZ, startH + actualBalHeight / 2, railX + hSize / 2);
                    bm.castShadow = true;
                    bm.receiveShadow = true;
                    group.add(bm);
                }
            } else {
                // Sloped Stair Railing (Stepped Treads & Mitered Top Faces)
                const balustersPerTread = config.baluster.perTread || (bSpacing < stepDepth / 1.5 ? 2 : 1);
                const pitchAngle = Math.atan2(endH - startH, flightLength);
                const slope = Math.tan(pitchAngle);

                for (let i = 0; i < stepCount; i++) {
                    // Skip small balusters on step 0 and step (stepCount - 1) when big newel posts are active
                    if (config.post && (i === 0 || i === stepCount - 1)) {
                        continue;
                    }

                    const treadTopY = minH + (i + 1) * stepHeight;

                    for (let j = 0; j < balustersPerTread; j++) {
                        const offsetFraction = balustersPerTread === 1 ? 0.5 : (j + 1) / (balustersPerTread + 1);
                        const bZ = (i + offsetFraction) * stepDepth;
                        const t = flightLength > 0 ? bZ / flightLength : 0;

                        // Handrail bottom height at center bZ
                        const handrailBotY = (startH * (1 - t) + endH * t) + rHeight - (config.handrail ? hSize : 0);

                        // Exact vertical baluster height from tread top to handrail bottom line at center bZ
                        const actualBalHeight = Math.max(5, handrailBotY - treadTopY);

                        let bGeo;
                        if (bShape === 'round') {
                            bGeo = new THREE.CylinderGeometry(bSize / 2, bSize / 2, actualBalHeight, 16);
                        } else {
                            bGeo = new THREE.BoxGeometry(bSize, actualBalHeight, bSize);
                        }

                        // Shear top face vertices along local X to match handrail pitch angle
                        if (config.handrail) {
                            const pos = bGeo.attributes.position;
                            const halfH = actualBalHeight / 2;
                            for (let k = 0; k < pos.count; k++) {
                                const y = pos.getY(k);
                                if (y >= halfH - 0.001) {
                                    const x = pos.getX(k);
                                    pos.setY(k, y + x * slope);
                                }
                            }
                            bGeo.computeVertexNormals();
                        }

                        const bm = new THREE.Mesh(bGeo, bMat);
                        bm.position.set(bZ, treadTopY + actualBalHeight / 2, railX + hSize / 2);
                        bm.castShadow = true;
                        bm.receiveShadow = true;
                        group.add(bm);
                    }
                }
            }
        }

        // 5. Posts (Newel Posts at start and end)
        if (config.post) {
            const nSize = config.post.width || 8;
            const nHeight = rHeight + 5;
            const nGeo = new THREE.BoxGeometry(nSize, nHeight, nSize);

            // Start Newel Post: rests flush on level floor or Step 0 tread
            const startPostY = isFlat ? (startH + nHeight / 2) : (startH + stepHeight + nHeight / 2);
            const nMeshStart = new THREE.Mesh(nGeo, bMat);
            nMeshStart.position.set(nSize / 2, startPostY, railX + hSize / 2);
            nMeshStart.castShadow = true; 
            nMeshStart.receiveShadow = true;
            group.add(nMeshStart);
            
            // End Newel Post: rests flush on level floor or top step landing
            const endPostY = endH + nHeight / 2;
            const nMeshEnd = new THREE.Mesh(nGeo, bMat);
            nMeshEnd.position.set(flightLength - nSize / 2, endPostY, railX + hSize / 2);
            nMeshEnd.castShadow = true; 
            nMeshEnd.receiveShadow = true;
            group.add(nMeshEnd);
        }

        return group;
    }
}
