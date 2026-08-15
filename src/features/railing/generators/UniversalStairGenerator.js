import * as THREE from 'three';

export class UniversalStairGenerator {
    static generate(path, config, materials, entity = null) {
        const group = new THREE.Group();
        if (!path || path.type !== 'linear') return group;

        const startX = 0;
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

        const rMat = materials.handrail;
        const bMat = materials.baluster || materials.post;
        const pMat = materials.glass;
        const cMat = materials.cable;

        // Position the group at path.start (horizontally), but Y=0 so we can use absolute startH/endH
        group.position.set(path.start.x, 0, path.start.z);
        
        // Rotate group to align with path horizontal direction.
        // Math.atan2 takes (y, x), so we use (dz, dx).
        const rotY = -Math.atan2(path.end.z - path.start.z, path.end.x - path.start.x);
        group.rotation.y = rotY;

        // We center the geometry at X=0 since we are on the path line
        const railX = -hSize / 2; 

        if (config.handrail) {
            // Draw handrail (Shape X-Y plane mapped)
            const hShape = new THREE.Shape();
            const vThick = hSize;
            hShape.moveTo(0, startH + rHeight);
            hShape.lineTo(flightLength, endH + rHeight);
            hShape.lineTo(flightLength, endH + rHeight - vThick);
            hShape.lineTo(0, startH + rHeight - vThick);
            hShape.closePath();

            let extrudeSettings = { depth: hSize, bevelEnabled: false };
            const hGeo = new THREE.ExtrudeGeometry(hShape, extrudeSettings);
            const hMesh = new THREE.Mesh(hGeo, rMat);
            // Do not rotate -Math.PI / 2, Extrude depth (thickness) goes along +Z
            // railX is the sideways offset (so it applies to Z)
            hMesh.position.set(0, 0, railX); 
            hMesh.castShadow = true; 
            hMesh.receiveShadow = true;
            group.add(hMesh);
        }

        if (config.glass) {
            const gThick = config.glass.thickness || 1.5;
            const gShape = new THREE.Shape();
            // Glass sits between bottom gap and handrail
            const bottomGap = config.glass.bottomGap || 5;
            gShape.moveTo(0, startH + bottomGap);
            gShape.lineTo(flightLength, endH + bottomGap);
            gShape.lineTo(flightLength, endH + rHeight - hSize - 2);
            gShape.lineTo(0, startH + rHeight - hSize - 2);
            gShape.closePath();
            
            const gGeo = new THREE.ExtrudeGeometry(gShape, { depth: gThick, bevelEnabled: false });
            const gMesh = new THREE.Mesh(gGeo, pMat);
            // Move glass thickness to center
            gMesh.position.set(0, 0, railX + hSize/2 - gThick/2);
            gMesh.castShadow = true; 
            gMesh.receiveShadow = true;
            group.add(gMesh);
        } else if (config.cable) {
            const cables = config.cable.count || 5;
            const cDiam = config.cable.diameter || 0.8;
            const span = rHeight - hSize - 10;
            const gap = span / (cables + 1);
            
            for(let k=1; k<=cables; k++) {
                const cShape = new THREE.Shape();
                const cHeight = 5 + k*gap;
                cShape.moveTo(0, startH + cHeight);
                cShape.lineTo(flightLength, endH + cHeight);
                cShape.lineTo(flightLength, endH + cHeight - cDiam);
                cShape.lineTo(0, startH + cHeight - cDiam);
                cShape.closePath();
                
                const cGeo = new THREE.ExtrudeGeometry(cShape, { depth: cDiam, bevelEnabled: false });
                const cMesh = new THREE.Mesh(cGeo, cMat);
                cMesh.position.set(0, 0, railX + hSize/2 - cDiam/2);
                cMesh.castShadow = true; 
                cMesh.receiveShadow = true;
                group.add(cMesh);
            }
        } else if (config.baluster) {
            // Balusters - Tread-aligned placement (uniform count per step tread)
            const bSize = config.baluster.width || 4;
            const bShape = config.baluster.shape || 'square';
            const nSize = config.post ? (config.post.width || 8) : 0;

            const bSpacing = config.baluster.spacing || 15;
            const balustersPerTread = config.baluster.perTread || (bSpacing < stepDepth / 1.5 ? 2 : 1);

            const bGeo = bShape === 'round' ? new THREE.CylinderGeometry(bSize/2, bSize/2, 1, 8) : new THREE.BoxGeometry(bSize, 1, bSize);

            for (let i = 0; i < stepCount; i++) {
                // When config.post (Big Newel Posts) is active, step 0 (entrance) and step (stepCount - 1) (end)
                // ALREADY have the Big Newel Posts resting on them. Skip small balusters on step 0 and step (stepCount - 1).
                if (config.post && (i === 0 || i === stepCount - 1)) {
                    continue;
                }

                const treadTopY = minH + (i + 1) * stepHeight;

                for (let j = 0; j < balustersPerTread; j++) {
                    const offsetFraction = balustersPerTread === 1 ? 0.5 : (j + 1) / (balustersPerTread + 1);
                    const bZ = (i + offsetFraction) * stepDepth;
                    const t = flightLength > 0 ? bZ / flightLength : 0;

                    // Handrail bottom height at bZ
                    const handrailBotY = (startH * (1 - t) + endH * t) + rHeight - (config.handrail ? hSize : 0);

                    // Calculate exact baluster height from tread top to handrail bottom
                    const actualBalHeight = Math.max(5, handrailBotY - treadTopY);

                    const bm = new THREE.Mesh(bGeo, bMat);
                    bm.scale.set(1, actualBalHeight, 1);
                    // Position baluster so its bottom face rests 100% flush on top of the tread board
                    bm.position.set(bZ, treadTopY + actualBalHeight / 2, railX + hSize / 2);
                    bm.castShadow = true;
                    bm.receiveShadow = true;
                    group.add(bm);
                }
            }
        }

        // Posts (Newel Posts at start and end of flight)
        if (config.post) {
            const nSize = config.post.width || 8;
            const nHeight = rHeight + 5;
            const nGeo = new THREE.BoxGeometry(nSize, nHeight, nSize);

            // Start Newel Post: rests 100% flush on top of Step 0 tread
            const startPostY = startH + stepHeight + nHeight / 2;
            const nMeshStart = new THREE.Mesh(nGeo, bMat);
            nMeshStart.position.set(nSize / 2, startPostY, railX + hSize / 2);
            nMeshStart.castShadow = true; 
            nMeshStart.receiveShadow = true;
            group.add(nMeshStart);
            
            // End Newel Post: rests 100% flush on top of top step tread / floor
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
