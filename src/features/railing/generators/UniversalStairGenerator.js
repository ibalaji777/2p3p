import * as THREE from 'three';

export class UniversalStairGenerator {
    static generate(path, config, materials) {
        const group = new THREE.Group();
        if (!path || path.type !== 'linear') return group;

        const startX = 0;
        const startH = path.start.y;
        const endH = path.end.y;
        const flightLength = Math.hypot(path.end.x - path.start.x, path.end.z - path.start.z);

        const rHeight = config.height || 40;
        const hSize = config.handrail?.height || 3.33;

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
            // Balusters
            const bSpacing = config.baluster.spacing || 15;
            const bSize = config.baluster.width || 4;
            const bShape = config.baluster.shape || 'square';
            const numBalusters = Math.floor(flightLength / bSpacing);
            
            const bGeo = bShape === 'round' ? new THREE.CylinderGeometry(bSize/2, bSize/2, 1, 8) : new THREE.BoxGeometry(bSize, 1, bSize);
            
            for(let k=0; k<=numBalusters; k++) {
                const bZ = k * bSpacing;
                const t = flightLength > 0 ? bZ / flightLength : 0;
                const bH = startH * (1 - t) + endH * t;
                const balHeight = rHeight - hSize;
                
                // If no handrail, extend baluster to top
                const actualBalHeight = config.handrail ? balHeight : rHeight;
                
                const bm = new THREE.Mesh(bGeo, bMat);
                bm.scale.set(1, actualBalHeight, 1);
                // bZ was the length coordinate, which is now local X. railX is local Z.
                bm.position.set(bZ, bH + actualBalHeight/2, railX + hSize/2);
                bm.castShadow = true; 
                bm.receiveShadow = true;
                group.add(bm);
            }
        }

        // Posts
        if (config.post) {
            const nSize = config.post.width || 8;
            const nGeo = new THREE.BoxGeometry(nSize, rHeight + 5, nSize);
            const nMeshStart = new THREE.Mesh(nGeo, bMat);
            nMeshStart.position.set(0, startH + (rHeight+5)/2, railX + hSize/2);
            nMeshStart.castShadow = true; 
            nMeshStart.receiveShadow = true;
            group.add(nMeshStart);
            
            const nMeshEnd = new THREE.Mesh(nGeo, bMat);
            nMeshEnd.position.set(flightLength, endH + (rHeight+5)/2, railX + hSize/2);
            nMeshEnd.castShadow = true; 
            nMeshEnd.receiveShadow = true;
            group.add(nMeshEnd);
        }

        return group;
    }
}
