import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'fs';
import path from 'path';

describe('Audit All GLB Models in Registry', () => {
    it('should inspect and classify all 51 GLB models', async () => {
        const regPath = path.join(process.cwd(), 'src', 'features', 'furniture', 'furniture.registry.js');
        const regContent = fs.readFileSync(regPath, 'utf8');

        const entryRegex = /'([^']+)':\s*\{([^}]+)\}/g;
        let match;
        const glbItems = [];

        while ((match = entryRegex.exec(regContent)) !== null) {
            const id = match[1];
            const body = match[2];
            const labelMatch = body.match(/label:\s*'([^']+)'/);
            const modelMatch = body.match(/model:\s*'([^']+)'/);
            const shape2DMatch = body.match(/shape2D:\s*'([^']+)'/);

            if (modelMatch) {
                glbItems.push({
                    id,
                    label: labelMatch ? labelMatch[1] : id,
                    model: modelMatch[1],
                    currentShape2D: shape2DMatch ? shape2DMatch[1] : 'default'
                });
            }
        }

        const loader = new GLTFLoader();
        const report = [];

        for (const item of glbItems) {
            const fullPath = path.join(process.cwd(), 'public', item.model);
            if (!fs.existsSync(fullPath)) {
                report.push({ ...item, status: 'MISSING' });
                continue;
            }

            try {
                const buffer = fs.readFileSync(fullPath);
                const ab = new Uint8Array(buffer).buffer;
                const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
                const scene = gltf.scene;

                const box = new THREE.Box3().setFromObject(scene);
                const size = box.getSize(new THREE.Vector3());

                const w = size.x;
                const d = size.z;
                const h = size.y;
                const ratio = parseFloat((w / (d || 1)).toFixed(2));

                report.push({
                    id: item.id,
                    label: item.label,
                    model: item.model,
                    currentShape2D: item.currentShape2D,
                    widthMeters: parseFloat(w.toFixed(2)),
                    depthMeters: parseFloat(d.toFixed(2)),
                    heightMeters: parseFloat(h.toFixed(2)),
                    aspectRatio: ratio
                });
            } catch (e) {
                report.push({ ...item, status: 'ERROR', error: e.message });
            }
        }

        const outPath = path.join(process.cwd(), 'scratch_glb_report.json');
        fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
        console.log(`Wrote audit report to ${outPath}`);

        expect(report.length).toBeGreaterThan(0);
    });
});
