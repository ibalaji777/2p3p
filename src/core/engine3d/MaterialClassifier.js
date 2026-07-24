import * as THREE from 'three';

export const FurnitureTemplates = {
    bed: [
        { category: 'fabric', check: (n) => n.y > 0.2 && n.y < 0.7 && n.volRatio > 0.1, reason: 'Matches Mattress position and volume' },
        { category: 'fabric', check: (n) => n.y >= 0.7, reason: 'Matches Pillow/Blanket height' },
        { category: 'wood', check: (n) => n.y <= 0.2, reason: 'Matches Bed Frame/Legs height' },
        { category: 'wood', check: (n) => (n.z < 0.1 || n.z > 0.9) && n.aspectZ < 0.2 && n.aspectY > 0.4, reason: 'Matches Headboard profile' }
    ],
    sofa: [
        { category: 'fabric', check: (n) => n.y > 0.1, reason: 'Matches Sofa Body/Cushions' },
        { category: 'wood', check: (n) => n.y <= 0.1, reason: 'Matches Sofa Legs' }
    ],
    table: [
        { category: 'wood', check: (n) => n.y > 0.8 && n.aspectY < 0.2, reason: 'Matches Tabletop profile' },
        { category: 'wood', check: (n) => n.y <= 0.8, reason: 'Matches Table Legs/Base' }
    ],
    chair: [
        { category: 'fabric', check: (n) => n.y > 0.3 && n.y < 0.6 && n.aspectY < 0.3, reason: 'Matches Seat profile' },
        { category: 'wood', check: (n) => n.y <= 0.3, reason: 'Matches Chair Legs' }
    ],
    cabinet: [
        { category: 'wood', check: (n) => n.volRatio > 0.1, reason: 'Matches Cabinet Body volume' },
        { category: 'metal', check: (n) => n.volRatio < 0.05, reason: 'Matches Handle/Hardware volume' }
    ],
    kitchen: [
        { category: 'stone', check: (n) => n.y > 0.8 && n.aspectY < 0.2, reason: 'Matches Countertop profile' },
        { category: 'wood', check: (n) => n.y <= 0.8 && n.volRatio > 0.1, reason: 'Matches Kitchen Cabinet volume' }
    ]
};

export const MaterialClassifierConfig = {
    confidenceThreshold: 0.60,
    weights: {
        template: 0.35,
        geometry: 0.30,
        sharedMaterial: 0.15,
        material: 0.10,
        scene: 0.05,
        keyword: 0.05
    },
    keywords: {
        wood: /wood|oak|pine|frame|cabinet|drawer|table|chair|headboard|footboard|leg|base|mahogany|teak|walnut/i,
        fabric: /fabric|cloth|cushion|upholstery|pillow|mattress|blanket|sheet|velvet|linen|cotton|bedding/i,
        metal: /metal|steel|iron|aluminum|brass|chrome|silver|gold|copper|hinge|bracket/i,
        glass: /glass|mirror|window|pane|transparent/i,
        stone: /stone|marble|granite|quartz|slate|concrete|cement/i,
        tile: /tile|ceramic|porcelain|mosaic/i,
        plastic: /plastic|pvc|acrylic|polycarbonate/i,
        leather: /leather|hide/i,
        roof: /roof|shingle/i,
        wall: /wall|brick|plaster|drywall/i,
        floor: /floor|carpet/i
    }
};

export class MaterialClassifier {
    static debug = true;

    constructor() {
        this.cache = new WeakMap(); // per-mesh cache
        this.assetCache = new Map(); // fingerprint -> AssetAnalysis
        this.stats = {
            totalMeshes: 0,
            classifiedAutomatically: 0,
            unknown: 0,
            totalTimeMs: 0,
            averageTimeMs: 0
        };
        if (typeof window !== 'undefined') {
            window.MaterialClassifier = MaterialClassifier;
        }
    }

    invalidateCache(mesh) {
        if (mesh) this.cache.delete(mesh);
    }

    getStats() {
        return {
            ...this.stats,
            averageTimeMs: this.stats.totalMeshes > 0 ? (this.stats.totalTimeMs / this.stats.totalMeshes).toFixed(2) + 'ms' : '0ms'
        };
    }

    classifyAll(meshes) {
        if (!Array.isArray(meshes)) return [];
        return meshes.map(m => this.classify(m));
    }

    _getRoot(mesh) {
        let root = mesh;
        let current = mesh.parent;
        while (current) {
            if (current.userData && current.userData.entity) {
                root = current;
                break;
            }
            // fallback if it's just a top-level scene group
            if (!current.parent || current.parent.type === 'Scene') {
                root = current;
                break;
            }
            current = current.parent;
        }
        return root;
    }

    _generateFingerprint(root) {
        let meshCount = 0;
        let matCount = 0;
        root.traverse(c => {
            if (c.isMesh) {
                meshCount++;
                if (c.material) matCount++;
            }
        });
        return `${root.name || 'Root'}_m${meshCount}_mat${matCount}_${root.uuid.substring(0,8)}`;
    }

    _analyzeAsset(root) {
        const fingerprint = this._generateFingerprint(root);
        if (this.assetCache.has(fingerprint)) return this.assetCache.get(fingerprint);

        const assetData = {
            fingerprint,
            rootType: 'unknown',
            meshMap: new Map(), // mesh -> spatial data
            sharedMaterials: new Map(), // uuid -> highest confidence score object
            localBox: new THREE.Box3(),
            volume: 0
        };

        const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();

        root.traverse(child => {
            if (child.isMesh && child.geometry) {
                if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                const childBox = new THREE.Box3().copy(child.geometry.boundingBox);
                const childToRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, child.matrixWorld);
                childBox.applyMatrix4(childToRoot);
                assetData.localBox.union(childBox);
            }
        });

        assetData.rootType = this._detectRootType(root, assetData.localBox);

        const rootSize = new THREE.Vector3();
        assetData.localBox.getSize(rootSize);
        assetData.volume = rootSize.x * rootSize.y * rootSize.z;

        root.traverse(child => {
            if (child.isMesh && child.geometry) {
                const childBox = new THREE.Box3().copy(child.geometry.boundingBox);
                const childToRoot = new THREE.Matrix4().multiplyMatrices(rootInverse, child.matrixWorld);
                childBox.applyMatrix4(childToRoot);

                const size = new THREE.Vector3();
                childBox.getSize(size);
                const center = new THREE.Vector3();
                childBox.getCenter(center);

                const maxDim = Math.max(size.x, size.y, size.z) || 1;
                const meshVol = size.x * size.y * size.z;

                const spatial = {
                    x: (center.x - assetData.localBox.min.x) / (rootSize.x || 1),
                    y: (center.y - assetData.localBox.min.y) / (rootSize.y || 1),
                    z: (center.z - assetData.localBox.min.z) / (rootSize.z || 1),
                    aspectX: size.x / maxDim,
                    aspectY: size.y / maxDim,
                    aspectZ: size.z / maxDim,
                    volRatio: meshVol / (assetData.volume || 1),
                    size
                };
                assetData.meshMap.set(child, spatial);

                // Group by material UUID for shared analysis later
                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(m => {
                        if (m.uuid && !assetData.sharedMaterials.has(m.uuid)) {
                            // Run texture analysis once per unique material!
                            const texRes = this._analyzeTextureInstance(m);
                            assetData.sharedMaterials.set(m.uuid, texRes);
                        }
                    });
                }
            }
        });

        this.assetCache.set(fingerprint, assetData);
        return assetData;
    }

    _detectRootType(root, localBox) {
        const rootSize = new THREE.Vector3();
        localBox.getSize(rootSize);
        
        let scaleFactor = 1.0;
        const maxDim = Math.max(rootSize.x, rootSize.y, rootSize.z);
        if (maxDim > 100) scaleFactor = 0.001; // likely millimeters
        else if (maxDim > 10) scaleFactor = 0.01; // likely centimeters
        
        const w = rootSize.x * scaleFactor;
        const h = rootSize.y * scaleFactor;
        const d = rootSize.z * scaleFactor;

        const maxFloor = Math.max(w, d);
        const minFloor = Math.min(w, d);

        // Mathematical inference by standard furniture proportions in meters
        if (maxFloor > 1.2 && minFloor > 1.2 && h > 0.3 && h < 1.4) return 'bed';
        if (maxFloor > 1.2 && minFloor >= 0.5 && minFloor <= 1.2 && h >= 0.5 && h <= 1.2) return 'sofa';
        if (maxFloor <= 1.0 && minFloor <= 1.0 && h >= 0.5 && h <= 1.3) return 'chair';
        if (h >= 0.65 && h <= 0.85 && maxFloor > 0.5) return 'table';
        if (h > 1.2 && minFloor < 0.8 && maxFloor > 0.4) return 'cabinet';

        // Fallback name check if math doesn't match standard sizes
        let name = (root.name || '').toLowerCase();
        if (root.userData && root.userData.entity && root.userData.entity.name) {
            name += ' ' + root.userData.entity.name.toLowerCase();
        }
        for (const type of Object.keys(FurnitureTemplates)) {
            if (name.includes(type)) return type;
        }
        return 'unknown';
    }

    classify(mesh, faceName = '') {
        const startTime = performance.now();
        if (!mesh) return this._returnResult({ category: 'unknown', confidence: 0, reasons: [] }, startTime);

        // 1. Metadata Analyzer
        const metaResult = this.analyzeMetadata(mesh);
        if (metaResult.confidence === 1.0) {
            return this._returnResult(metaResult, startTime, mesh, true);
        }

        if (this.cache.has(mesh)) {
            return this._returnResult(this.cache.get(mesh), startTime, mesh, false, true);
        }

        const root = this._getRoot(mesh);
        const assetData = this._analyzeAsset(root);

        const scores = {};
        const reasonsList = [];

        const addScore = (res, weightMultiplier, prefix) => {
            if (!res || res.category === 'unknown' || res.confidence === 0) return;
            const points = weightMultiplier * res.confidence;
            scores[res.category] = (scores[res.category] || 0) + points;
            if (res.reason) reasonsList.push(`[${prefix}] ${res.reason} (+${(points * 100).toFixed(1)}% to ${res.category})`);
        };

        const w = MaterialClassifierConfig.weights;

        // Texture / Shared Material Analysis (combining them)
        let bestTexCategory = 'unknown';
        let texConfidence = 0;
        let texReason = '';
        if (mesh.material) {
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            for (const m of mats) {
                if (m.uuid && assetData.sharedMaterials.has(m.uuid)) {
                    const sharedRes = assetData.sharedMaterials.get(m.uuid);
                    if (sharedRes.confidence > texConfidence) {
                        texConfidence = sharedRes.confidence;
                        bestTexCategory = sharedRes.category;
                        texReason = sharedRes.reason;
                    }
                }
            }
        }
        const texRes = { category: bestTexCategory, confidence: texConfidence, reason: texReason };
        addScore(texRes, w.sharedMaterial, 'Shared Texture/Material');

        // Material Props
        const matRes = this.analyzeMaterial(mesh);
        addScore(matRes, w.material, 'Material');

        // Furniture Template
        const tplRes = this.analyzeTemplate(mesh, assetData);
        addScore(tplRes, w.template, 'Template');

        // Geometry (Context aware)
        const geoRes = this.analyzeGeometry(mesh, assetData);
        addScore(geoRes, w.geometry, 'Geometry');

        // Scene Hierarchy
        const sceneRes = this.analyzeScene(mesh, assetData);
        addScore(sceneRes, w.scene, 'Scene');

        // Keyword
        const keyRes = this.analyzeKeyword(mesh, faceName);
        addScore(keyRes, w.keyword, 'Keyword');

        let bestCategory = 'unknown';
        let bestScore = 0;
        for (const [cat, score] of Object.entries(scores)) {
            if (score > bestScore) {
                bestScore = score;
                bestCategory = cat;
            }
        }

        const isKnown = bestScore >= MaterialClassifierConfig.confidenceThreshold;
        const finalCategory = isKnown ? bestCategory : 'unknown';

        const result = {
            category: finalCategory,
            confidence: bestScore,
            reasons: reasonsList,
            assetFingerprint: assetData.fingerprint,
            templateApplied: assetData.rootType,
            evidence: {
                metadata: false,
                template: tplRes.confidence > 0 ? tplRes.category : false,
                texture: texRes.confidence > 0 ? texRes.category : false,
                geometry: geoRes.confidence > 0 ? geoRes.category : false,
                material: matRes.confidence > 0 ? matRes.category : false
            }
        };

        if (MaterialClassifier.debug) {
            this._printDebug(mesh, faceName, scores, result, w, assetData, { matRes, texRes, geoRes, sceneRes, keyRes, tplRes });
        }

        this.cache.set(mesh, result);
        return this._returnResult(result, startTime, mesh, isKnown);
    }

    _printDebug(mesh, faceName, scores, result, w, assetData, subResults) {
        console.groupCollapsed(`[MaterialClassifier] Classified Mesh: ${mesh.name || 'Unnamed'}`);
        console.log(`Face: ${faceName}`);
        console.log(`Asset Fingerprint: ${assetData.fingerprint}`);
        console.log(`Root Template Selected: ${assetData.rootType}`);
        
        const spatial = assetData.meshMap.get(mesh);
        if (spatial) {
            console.log(`Normalized Position (0-1): X:${spatial.x.toFixed(2)}, Y:${spatial.y.toFixed(2)}, Z:${spatial.z.toFixed(2)}`);
            console.log(`Volume Ratio: ${(spatial.volRatio*100).toFixed(1)}%`);
        }

        const tableData = {
            SharedMaterial: { Category: subResults.texRes.category, Points: (subResults.texRes.confidence * w.sharedMaterial * 100).toFixed(1) + '%' },
            Template: { Category: subResults.tplRes.category, Points: (subResults.tplRes.confidence * w.template * 100).toFixed(1) + '%' },
            Geometry: { Category: subResults.geoRes.category, Points: (subResults.geoRes.confidence * w.geometry * 100).toFixed(1) + '%' },
            MaterialProp: { Category: subResults.matRes.category, Points: (subResults.matRes.confidence * w.material * 100).toFixed(1) + '%' },
            Scene: { Category: subResults.sceneRes.category, Points: (subResults.sceneRes.confidence * w.scene * 100).toFixed(1) + '%' },
            Keyword: { Category: subResults.keyRes.category, Points: (subResults.keyRes.confidence * w.keyword * 100).toFixed(1) + '%' }
        };
        console.table(tableData);

        console.log(`-----------------------`);
        for (const [cat, score] of Object.entries(scores)) {
            console.log(`${cat}: ${(score * 100).toFixed(1)}%`);
        }
        console.log(`Winner: ${result.category} (${(result.confidence * 100).toFixed(1)}%) [Threshold: ${MaterialClassifierConfig.confidenceThreshold * 100}%]`);
        console.log('Reasons:', result.reasons);
        console.groupEnd();
    }

    _returnResult(result, startTime, mesh = null, isKnown = false, fromCache = false) {
        const timeTaken = performance.now() - startTime;
        if (!fromCache && mesh) {
            this.stats.totalMeshes++;
            this.stats.totalTimeMs += timeTaken;
            if (isKnown) this.stats.classifiedAutomatically++;
            else this.stats.unknown++;
        }
        return result;
    }

    analyzeMetadata(mesh) {
        if (mesh.userData && mesh.userData.materialCategory) {
            return {
                category: mesh.userData.materialCategory,
                confidence: 1.0,
                reasons: [`Found explicit userData.materialCategory = '${mesh.userData.materialCategory}'`],
                evidence: { metadata: true }
            };
        }
        return { category: 'unknown', confidence: 0 };
    }

    _analyzeTextureInstance(mat) {
        let textureKeywords = "";
        if (mat.name) textureKeywords += " " + mat.name.toLowerCase();
        
        const maps = [mat.map, mat.normalMap, mat.roughnessMap, mat.metalnessMap, mat.aoMap, mat.displacementMap, mat.emissiveMap];
        for (const m of maps) {
            if (m && m.image && m.image.src) textureKeywords += " " + m.image.src.toLowerCase();
            else if (m && m.name) textureKeywords += " " + m.name.toLowerCase();
        }
        if (textureKeywords.trim() === "") return { category: 'unknown', confidence: 0 };
        const matched = this._matchKeywords(textureKeywords, 1.0);
        if (matched.category !== 'unknown') {
            matched.reason = `Shared texture URL/Name matched '${matched.category}'`;
        }
        return matched;
    }

    analyzeMaterial(mesh) {
        if (!mesh.material) return { category: 'unknown', confidence: 0 };
        let materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        
        for (const mat of materials) {
            if (mat.metalness !== undefined && mat.metalness > 0.6) return { category: 'metal', confidence: 0.9, reason: `High metalness (${mat.metalness})` };
            if (mat.transmission !== undefined && mat.transmission > 0.5) return { category: 'glass', confidence: 0.95, reason: `High transmission (${mat.transmission})` };
            if (mat.transparent && mat.opacity < 0.6) return { category: 'glass', confidence: 0.8, reason: `High transparency (opacity ${mat.opacity})` };
            if (mat.sheen !== undefined && mat.sheen > 0) return { category: 'fabric', confidence: 0.85, reason: `Has sheen > 0 (${mat.sheen})` };
            if (mat.clearcoat !== undefined && mat.clearcoat > 0.5 && (mat.metalness === undefined || mat.metalness < 0.2)) return { category: 'plastic', confidence: 0.6, reason: `High clearcoat` };
        }
        return { category: 'unknown', confidence: 0 };
    }

    analyzeTemplate(mesh, assetData) {
        if (!assetData || assetData.rootType === 'unknown') return { category: 'unknown', confidence: 0 };
        const spatial = assetData.meshMap.get(mesh);
        if (!spatial) return { category: 'unknown', confidence: 0 };

        const rules = FurnitureTemplates[assetData.rootType];
        if (!rules) return { category: 'unknown', confidence: 0 };

        for (const rule of rules) {
            if (rule.check(spatial)) {
                return { category: rule.category, confidence: 1.0, reason: rule.reason };
            }
        }
        return { category: 'unknown', confidence: 0 };
    }

    analyzeGeometry(mesh, assetData) {
        if (!assetData) return { category: 'unknown', confidence: 0 };
        const spatial = assetData.meshMap.get(mesh);
        if (!spatial) return { category: 'unknown', confidence: 0 };

        const isHorizontalPlane = spatial.aspectX > 0.8 && spatial.aspectZ > 0.8 && spatial.aspectY < 0.2;
        const isVerticalPlane = ((spatial.aspectY > 0.8 && spatial.aspectZ > 0.8) || (spatial.aspectY > 0.8 && spatial.aspectX > 0.8)) && Math.min(spatial.aspectX, spatial.aspectY, spatial.aspectZ) < 0.2;
        const isTallCylinder = spatial.aspectY > 0.8 && spatial.aspectX < 0.3 && spatial.aspectZ < 0.3 && Math.abs(spatial.aspectX - spatial.aspectZ) < 0.1;
        const isLargeCuboid = spatial.volRatio > 0.15 && spatial.aspectY >= 0.2 && spatial.aspectX >= 0.4 && spatial.aspectZ >= 0.4; 

        // If inside a furniture asset, never call it a floor or wall
        if (assetData.rootType !== 'unknown') {
            if (isLargeCuboid) return { category: 'fabric', confidence: 1.0, reason: 'Local geometry is large cushion volume' };
            if (isTallCylinder) return { category: 'wood', confidence: 1.0, reason: 'Local geometry is tall leg cylinder' };
            if (isHorizontalPlane && spatial.y >= 0.5) return { category: 'wood', confidence: 1.0, reason: 'Local geometry is high flat plane (tabletop/panel)' };
            if (isVerticalPlane) return { category: 'wood', confidence: 0.8, reason: 'Local geometry is vertical support/panel' };
        } else {
            // Standalone geometry rules
            if (isHorizontalPlane) return { category: 'floor', confidence: 0.4, reason: 'Standalone vast horizontal plane' };
            if (isVerticalPlane) return { category: 'wall', confidence: 0.4, reason: 'Standalone vertical plane' };
            if (isLargeCuboid) return { category: 'fabric', confidence: 0.6, reason: 'Standalone large cushion volume' };
            if (isTallCylinder) return { category: 'wood', confidence: 0.5, reason: 'Standalone tall cylinder/leg' };
        }

        return { category: 'unknown', confidence: 0 };
    }

    analyzeScene(mesh, assetData) {
        if (!assetData) return { category: 'unknown', confidence: 0 };
        if (assetData.rootType === 'bed' || assetData.rootType === 'sofa' || assetData.rootType === 'chair') {
            return { category: 'fabric', confidence: 0.5, reason: `Inherited from root type '${assetData.rootType}'` }; 
        }
        if (assetData.rootType === 'table' || assetData.rootType === 'cabinet') {
            return { category: 'wood', confidence: 0.5, reason: `Inherited from root type '${assetData.rootType}'` };
        }
        return { category: 'unknown', confidence: 0 };
    }

    analyzeKeyword(mesh, faceName) {
        let nameToTest = (faceName || '').toLowerCase();
        if (mesh.name) nameToTest += ' ' + mesh.name.toLowerCase();
        if (mesh.material) {
            const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            nameToTest += ' ' + materials.map(m => m.name || '').join(' ').toLowerCase();
        }
        const matched = this._matchKeywords(nameToTest, 1.0);
        if (matched.category !== 'unknown') matched.reason = `Mesh/Material name matched '${matched.category}'`;
        return matched;
    }

    _matchKeywords(text, confidenceScore) {
        if (!text || text.trim() === '') return { category: 'unknown', confidence: 0 };
        for (const [category, regex] of Object.entries(MaterialClassifierConfig.keywords)) {
            if (text.match(regex)) return { category, confidence: confidenceScore };
        }
        return { category: 'unknown', confidence: 0 };
    }
}
