import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { MaterialClassifier, MaterialClassifierConfig, FurnitureTemplates } from '../MaterialClassifier.js';

describe('MaterialClassifier Phase 3', () => {
    let classifier;

    beforeEach(() => {
        classifier = new MaterialClassifier();
        MaterialClassifier.debug = false; 
    });

    describe('Metadata Analyzer', () => {
        it('should return 100% confidence when userData.materialCategory is present', () => {
            const mesh = new THREE.Mesh();
            mesh.userData = { materialCategory: 'wood' };
            const result = classifier.classify(mesh);
            
            expect(result.category).toBe('wood');
            expect(result.confidence).toBe(1.0);
            expect(result.evidence.metadata).toBe(true);
            expect(result.reasons.some(r => r.includes('userData.materialCategory'))).toBe(true);
        });
    });

    describe('Material Analyzer', () => {
        it('should detect metal from high metalness', () => {
            const mesh = new THREE.Mesh();
            mesh.material = new THREE.MeshStandardMaterial({ metalness: 0.8 });
            const matRes = classifier.analyzeMaterial(mesh);
            expect(matRes.category).toBe('metal');
            expect(matRes.confidence).toBe(0.9);
        });
    });

    describe('Spatial Asset Pre-Analysis & Fingerprinting', () => {
        it('should generate fingerprint and cache asset data', () => {
            const root = new THREE.Group();
            root.name = 'Bed_Asset';
            const child1 = new THREE.Mesh(new THREE.BoxGeometry(2, 0.5, 2));
            child1.material = new THREE.MeshBasicMaterial();
            root.add(child1);
            
            const assetData = classifier._analyzeAsset(root);
            expect(assetData.fingerprint).toContain('Bed_Asset_m1_mat1');
            expect(assetData.rootType).toBe('bed');
            expect(assetData.meshMap.has(child1)).toBe(true);
            
            // Should reuse cache
            const assetData2 = classifier._analyzeAsset(root);
            expect(assetData2).toBe(assetData);
        });

        it('should extract shared materials correctly', () => {
            const root = new THREE.Group();
            const mat = new THREE.MeshBasicMaterial({ name: 'oak_wood' });
            
            const mesh1 = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mat);
            const mesh2 = new THREE.Mesh(new THREE.BoxGeometry(1,1,1), mat);
            root.add(mesh1, mesh2);
            
            const assetData = classifier._analyzeAsset(root);
            expect(assetData.sharedMaterials.has(mat.uuid)).toBe(true);
            expect(assetData.sharedMaterials.get(mat.uuid).category).toBe('wood');
        });
    });

    describe('Mathematical Root Detection', () => {
        it('should detect a bed from bounding box dimensions', () => {
            const root = new THREE.Group();
            
            // Create a mesh that makes the root bounding box bed-sized (e.g. 1.6m x 0.6m x 2.0m)
            const bedMesh = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0));
            root.add(bedMesh);
            root.updateMatrixWorld(true);

            const assetData = classifier._analyzeAsset(root);
            expect(assetData.rootType).toBe('bed');
        });

        it('should assign fabric to a central mattress volume in a mathematically detected bed', () => {
            const root = new THREE.Group();
            // Bed frame
            const frame = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.2, 2.0));
            frame.position.set(0, 0.1, 0);
            
            // Mattress (Y=0.4, large volume)
            const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.4, 1.9));
            mattress.position.set(0, 0.4, 0); 
            root.add(frame, mattress);
            
            root.updateMatrixWorld(true);

            const result = classifier.classify(mattress);
            expect(result.templateApplied).toBe('bed');
            expect(result.evidence.template).toBe('fabric');
            // Template weight 0.35 + Geometry weight 1.0 (from 0.30 modifier) = 0.65 (passes threshold)
            expect(result.category).toBe('fabric');
            expect(result.confidence).toBeGreaterThanOrEqual(0.60);
        });
    });

    describe('Geometry Analyzer Context Awareness', () => {
        it('should NOT classify a large flat tabletop inside a table as Floor', () => {
            const root = new THREE.Group();
            root.name = "Dining Table";
            
            const top = new THREE.Mesh(new THREE.BoxGeometry(5, 0.1, 5));
            top.position.set(0, 1.0, 0);
            root.add(top);
            root.updateMatrixWorld(true);

            const assetData = classifier._analyzeAsset(root);
            const geoRes = classifier.analyzeGeometry(top, assetData);
            
            // In a table, a high flat plane shouldn't be Floor. It should be wood (tabletop).
            expect(geoRes.category).toBe('wood');
            expect(geoRes.reason).toContain('high flat plane');
        });

        it('should classify a standalone large flat plane as Floor', () => {
            const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 0.1, 100));
            floorMesh.updateMatrixWorld(true);
            
            const assetData = classifier._analyzeAsset(floorMesh); // root is itself
            const geoRes = classifier.analyzeGeometry(floorMesh, assetData);
            
            expect(geoRes.category).toBe('floor');
        });
    });

    describe('Batch Operations', () => {
        it('should classify an array of meshes and record stats', () => {
            const meshes = [new THREE.Mesh(), new THREE.Mesh()];
            meshes[1].userData = { materialCategory: 'plastic' };
            const results = classifier.classifyAll(meshes);
            
            expect(results.length).toBe(2);
            expect(results[0].category).toBe('unknown');
            expect(results[1].category).toBe('plastic');
            
            const stats = classifier.getStats();
            expect(stats.totalMeshes).toBe(2);
        });
    });
});
