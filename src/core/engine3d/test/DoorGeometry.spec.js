import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WIDGET_REGISTRY } from '../../registry.js';

describe('Door Architecture Audit', () => {
    const mockHelpers = {
        getDynamicMaterial: () => new THREE.MeshStandardMaterial({ color: 0x888888 }),
        getFaceMaterials: () => ({ box: [new THREE.MeshStandardMaterial()] })
    };

    function findDoorLeaf(doorGroup) {
        let leaf = null;
        doorGroup.traverse((child) => {
            if (!child.isMesh) return;
            if (child.userData?.isFrame || child.userData?.isHandle || child.userData?.isShadow || child.userData?.isSweep || child.userData?.isThreshold) return;
            if (child.material?.opacity === 0) return; // hitbox
            const box = new THREE.Box3().setFromObject(child);
            const h = box.max.y - box.min.y;
            if (child.geometry?.type === 'ExtrudeGeometry' && h > 50) {
                // Check if any ancestor has isMovingPart
                let p = child.parent;
                while (p) {
                    if (p.userData?.isMovingPart) { leaf = { child, box, h }; return; }
                    p = p.parent;
                }
            }
        });
        return leaf;
    }

    it('should match architectural door specification: no bottom frame, separate threshold, 8-10mm clearance', () => {
        const entity = {
            id: 'test_door_1', type: 'door', width: 36, height: 80, thick: 4,
            doorType: 'single', doorStyle: 'flat', materials: { leaf: { id: 'wood_golden_teak' } },
            facing: 1, side: 1, elevation: 0, x: 0, z: 0, angle: 0
        };

        const sceneGroup = new THREE.Group();
        const doorGroup = WIDGET_REGISTRY['door'].render3D(sceneGroup, entity, mockHelpers);
        doorGroup.updateMatrixWorld(true);

        let thresholdMesh = null;
        let contactShadowMesh = null;
        let sweepMesh = null;
        const jambMeshes = []; // Only actual jambs (jambW=0.75), not stops

        doorGroup.traverse((child) => {
            if (!child.isMesh) return;
            if (child.userData?.isShadow) { contactShadowMesh = child; return; }
            if (child.userData?.isSweep) { sweepMesh = child; return; }
            if (child.userData?.isThreshold) { thresholdMesh = child; return; }
            if ((child.userData?.isJamb || (child.userData?.isFrame && !child.userData?.isStop && !child.userData?.isHeadJamb)) && child.geometry?.type === 'ExtrudeGeometry') {
                const box = new THREE.Box3().setFromObject(child);
                const h = box.max.y - box.min.y;
                const w = box.max.x - box.min.x;
                // Actual side jambs: 0.5 to 2.0 wide, full height
                if (w < 2.0 && w > 0.5 && h > 70) {
                    jambMeshes.push({ box, h, w });
                }
            }
        });

        // === 1. NO BOTTOM FRAME MEMBER ===
        // There should be no frame mesh that horizontally connects left and right jambs at the bottom
        let bottomFrameCount = 0;
        doorGroup.traverse((child) => {
            if (!child.isMesh || !child.userData?.isFrame) return;
            if (child.userData?.isThreshold || child.userData?.isSillPlate) return; // separate pieces, not a bottom frame
            const box = new THREE.Box3().setFromObject(child);
            const w = box.max.x - box.min.x;
            const h = box.max.y - box.min.y;
            // A "bottom frame" would be: wide (>20), short (<2), near floor
            if (w > 20 && h < 2 && box.max.y < 2) bottomFrameCount++;
        });
        expect(bottomFrameCount).toBe(0); // NO bottom frame!

        // === 2. SEPARATE THRESHOLD (20-25mm) ===
        expect(thresholdMesh).not.toBeNull();
        const tBox = new THREE.Box3().setFromObject(thresholdMesh);
        const tHeightMm = (tBox.max.y - tBox.min.y) * 25.4;
        
        console.log(`Threshold: height=${tHeightMm.toFixed(1)}mm width=${(tBox.max.x - tBox.min.x).toFixed(2)}in`);
        expect(tHeightMm).toBeGreaterThanOrEqual(19);
        expect(tHeightMm).toBeLessThanOrEqual(26);
        expect(tBox.min.y).toBeCloseTo(0, 0); // Sits on floor

        // === 3. JAMBS SOLID TO FLOOR ===
        expect(jambMeshes.length).toBeGreaterThanOrEqual(2);
        jambMeshes.forEach(j => {
            expect(j.box.min.y).toBeCloseTo(0, 0); // Solid to floor
        });

        // === 4. DOOR LEAF CLEARANCE: 8-10mm above threshold top ===
        const doorLeaf = findDoorLeaf(doorGroup);
        expect(doorLeaf).not.toBeNull();
        const clearanceInches = doorLeaf.box.min.y - tBox.max.y;
        const clearanceMm = clearanceInches * 25.4;
        
        console.log(`Door leaf bottom: ${doorLeaf.box.min.y.toFixed(3)}`);
        console.log(`Threshold top: ${tBox.max.y.toFixed(3)}`);
        console.log(`Clearance: ${clearanceMm.toFixed(1)}mm`);
        
        expect(clearanceMm).toBeGreaterThanOrEqual(7);
        expect(clearanceMm).toBeLessThanOrEqual(12);

        // === 5. CONTACT SHADOW ===
        expect(contactShadowMesh).not.toBeNull();

        // === 6. DOOR SWEEP ===
        expect(sweepMesh).not.toBeNull();
    });

    it('should support no-threshold interior door (hasThreshold=false)', () => {
        const entity = {
            id: 'test_door_2', type: 'door', width: 36, height: 80, thick: 4,
            doorType: 'single', doorStyle: 'flat', materials: { leaf: { id: 'wood_golden_teak' } },
            facing: 1, side: 1, elevation: 0, x: 0, z: 0, angle: 0,
            hasThreshold: false
        };

        const sceneGroup = new THREE.Group();
        const doorGroup = WIDGET_REGISTRY['door'].render3D(sceneGroup, entity, mockHelpers);
        doorGroup.updateMatrixWorld(true);

        let thresholdMesh = null;
        doorGroup.traverse((child) => {
            if (child.isMesh && child.userData?.isThreshold) thresholdMesh = child;
        });

        // No threshold
        expect(thresholdMesh).toBeNull();

        // Door leaf: 8-10mm above FLOOR (Y=0)
        const doorLeaf = findDoorLeaf(doorGroup);
        expect(doorLeaf).not.toBeNull();
        const clearanceMm = doorLeaf.box.min.y * 25.4;
        console.log(`No-threshold door clearance above floor: ${clearanceMm.toFixed(1)}mm`);
        expect(clearanceMm).toBeGreaterThanOrEqual(7);
        expect(clearanceMm).toBeLessThanOrEqual(12);
    });
});
