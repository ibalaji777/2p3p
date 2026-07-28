import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import path from 'path';

describe('GLB Model Bounding Box Mesh Filtering', () => {
    it('should compare raw Box3 vs Mesh-only Box3 for GlamVelvetSofa.glb', async () => {
        const fullPath = path.join(process.cwd(), 'public', 'models', 'sofas', 'GlamVelvetSofa.glb');
        const buffer = fs.readFileSync(fullPath);
        const ab = new Uint8Array(buffer).buffer;
        const loader = new GLTFLoader();
        const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
        const scene = gltf.scene;

        // Raw Box3 including Light nodes
        const rawBox = new THREE.Box3().setFromObject(scene);
        const rawSize = rawBox.getSize(new THREE.Vector3());
        const rawCenter = rawBox.getCenter(new THREE.Vector3());

        // Clean Mesh-only Box3
        const meshBox = new THREE.Box3();
        scene.traverse((child) => {
            if (child.isMesh) {
                if (child.userData?.isHitbox || child.userData?.isGizmo) return;
                if (child.name && (child.name.includes('Light') || child.name.includes('Camera') || child.name.includes('helper'))) return;
                child.geometry.computeBoundingBox();
                const childBox = child.geometry.boundingBox.clone().applyMatrix4(child.matrixWorld);
                meshBox.union(childBox);
            }
        });
        const meshSize = meshBox.getSize(new THREE.Vector3());
        const meshCenter = meshBox.getCenter(new THREE.Vector3());

        console.log(`RAW Box Center: (${rawCenter.x.toFixed(3)}, ${rawCenter.y.toFixed(3)}, ${rawCenter.z.toFixed(3)})`);
        console.log(`MESH Box Center: (${meshCenter.x.toFixed(3)}, ${meshCenter.y.toFixed(3)}, ${meshCenter.z.toFixed(3)})`);

        console.log(`RAW Box Size: (${rawSize.x.toFixed(3)}, ${rawSize.y.toFixed(3)}, ${rawSize.z.toFixed(3)})`);
        console.log(`MESH Box Size: (${meshSize.x.toFixed(3)}, ${meshSize.y.toFixed(3)}, ${meshSize.z.toFixed(3)})`);

        expect(meshSize.x).toBeGreaterThan(0);
    });
});
