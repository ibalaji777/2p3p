import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ShapeMirrorEngine } from '../ShapeMirrorEngine.js';
import fs from 'fs';
import path from 'path';

describe('ShapeMirrorEngine - GLB SVG Inspection', () => {
    let engine;

    beforeEach(() => {
        engine = new ShapeMirrorEngine();
    });

    it('inspect SVG path for modern_sofa_1.glb', async () => {
        const filePath = path.join(process.cwd(), 'public', 'models', 'sofas', 'modern_sofa_1.glb');
        const buffer = fs.readFileSync(filePath);
        const ab = new Uint8Array(buffer).buffer;

        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
            loader.parse(ab, '', resolve, reject);
        });

        const scene = gltf.scene;
        const wrapper = new THREE.Group();
        wrapper.add(scene);

        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        scene.position.set(-center.x, -box.min.y, -center.z);

        const footprint = engine.extractFootprint(wrapper, 'modern_sofa_1_test', true, 200, 90);
        const svg = engine.pointsToSvg(footprint);
        expect(svg).toBeDefined();
        expect(svg).toContain('M');
    });

    it('inspect SVG path for GlamVelvetSofa.glb (L-shape)', async () => {
        const filePath = path.join(process.cwd(), 'public', 'models', 'sofas', 'GlamVelvetSofa.glb');
        const buffer = fs.readFileSync(filePath);
        const ab = new Uint8Array(buffer).buffer;

        const loader = new GLTFLoader();
        const gltf = await new Promise((resolve, reject) => {
            loader.parse(ab, '', resolve, reject);
        });

        const scene = gltf.scene;
        const wrapper = new THREE.Group();
        wrapper.add(scene);

        const box = new THREE.Box3().setFromObject(scene);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        scene.position.set(-center.x, -box.min.y, -center.z);

        const footprint = engine.extractFootprint(wrapper, 'GlamVelvetSofa_test', true, 250, 150);
        const svg = engine.pointsToSvg(footprint);
        expect(svg).toBeDefined();
        expect(svg).toContain('M');
    });
});
