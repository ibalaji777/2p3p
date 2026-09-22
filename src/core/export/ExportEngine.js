/**
 * src/core/export/ExportEngine.js
 * 
 * Canonical Domain Authority for Export, Import, Printing & File Formats Subsystem.
 * Unifies:
 * - Versioned project schema (v2.0 multi-story) with automatic backward compatibility for legacy v1.0 plans
 * - Safe JSON serialization with circular reference elimination
 * - File downloads (JSON, PNG, SVG)
 * - 2D blueprint high-resolution plan rendering & exports
 * - 3D architectural elevation snapshotting & multi-angle studio preview generation
 * - Cloud Save REST integration with configurable backend endpoints
 */

import * as THREE from 'three';

export class ExportEngine {
    static SCHEMA_VERSION = '2.0';
    static DEFAULT_APP_NAME = '2P3P Planner';
    static DEFAULT_API_BASE_URL = 'http://localhost:3000';

    /**
     * Creates a circular-safe JSON replacer function.
     * @returns {Function}
     */
    static getCircularReplacer() {
        const seen = new WeakSet();
        return (key, value) => {
            // Filter out technical objects, display groups, and circular parent references
            if (key === 'mesh3D' || key === 'object' || key === 'entity' || key === 'wall' || 
                key === 'parent' || key === 'planner' || key === 'poly' || key === 'wallGroup' || 
                key === 'labelGroup' || key === 'frontHighlight' || key === 'backHighlight' || 
                key === 'profileIndicators' || key === 'entranceGroup' || key === 'raiserGroup' || 
                key === 'raiserHit' || key === 'raiserBg' || key === 'raiserText') {
                return undefined;
            }
            if (typeof value === 'object' && value !== null) {
                if (value.isObject3D || value.isMesh || value.isGroup || value.isNode || value.isShape) {
                    return undefined;
                }
                if (seen.has(value)) {
                    return undefined;
                }
                seen.add(value);
            }
            return value;
        };
    }

    /**
     * Safely stringifies any object, stripping circular references and internal Three.js/Konva nodes.
     * @param {*} data 
     * @param {number} [space=2] 
     * @returns {string}
     */
    static safeStringify(data, space = 2) {
        return JSON.stringify(data, ExportEngine.getCircularReplacer(), space);
    }

    /**
     * Packages multi-level planner data into a canonical Version 2.0 Project Manifest.
     * @param {Object} options
     * @param {Array} options.levels - List of floor levels
     * @param {number} [options.activeLevelIndex=0] - Currently active floor index
     * @param {Object} [options.metadata={}] - Project metadata (name, author, etc.)
     * @param {Object} [options.settings={}] - General planner settings
     * @returns {Object} Canonical project manifest
     */
    static createProjectPackage({ levels = [], activeLevelIndex = 0, metadata = {}, settings = {} } = {}) {
        const now = new Date().toISOString();
        const normalizedLevels = Array.isArray(levels) ? levels : [];

        return {
            version: ExportEngine.SCHEMA_VERSION,
            app: ExportEngine.DEFAULT_APP_NAME,
            timestamp: now,
            metadata: {
                name: metadata.name || 'Untitled Project',
                createdAt: metadata.createdAt || now,
                updatedAt: now,
                author: metadata.author || 'User',
                units: metadata.units || 'cm',
                levelCount: normalizedLevels.length || 1,
                ...metadata
            },
            activeLevelIndex: Math.max(0, Math.min(activeLevelIndex, Math.max(0, normalizedLevels.length - 1))),
            levels: normalizedLevels,
            settings: settings || {}
        };
    }

    /**
     * Validates raw JSON string or object against project schema.
     * @param {string|Object} rawInput 
     * @returns {{ valid: boolean, version?: string, isMultiLevel?: boolean, error?: string, parsed?: Object }}
     */
    static validateProjectJSON(rawInput) {
        if (!rawInput) {
            return { valid: false, error: 'Empty or null project data' };
        }

        let parsed;
        if (typeof rawInput === 'string') {
            try {
                parsed = JSON.parse(rawInput);
            } catch (err) {
                return { valid: false, error: `Invalid JSON syntax: ${err.message}` };
            }
        } else {
            parsed = rawInput;
        }

        if (typeof parsed !== 'object' || parsed === null) {
            return { valid: false, error: 'Project data must be a valid JSON object' };
        }

        // Check if Version 2.0 Multi-Level Project
        if (parsed.version === '2.0' || (Array.isArray(parsed.levels) && parsed.activeLevelIndex !== undefined)) {
            return {
                valid: true,
                version: parsed.version || '2.0',
                isMultiLevel: true,
                parsed
            };
        }

        // Check if Version 1.0 Legacy Single-Level Plan
        if (parsed.walls || parsed.anchors || parsed.rooms || parsed.furniture || parsed.data) {
            return {
                valid: true,
                version: '1.0',
                isMultiLevel: false,
                parsed
            };
        }

        return { valid: false, error: 'Unrecognized project structure. Missing levels, walls, or anchors.', parsed };
    }

    /**
     * Parses and normalizes any project payload (v1.0 or v2.0) into canonical v2.0 format.
     * Automatically upgrades legacy single-story projects.
     * @param {string|Object} rawInput 
     * @returns {Object} Normalized project manifest (v2.0)
     */
    static parseProjectJSON(rawInput) {
        const validation = ExportEngine.validateProjectJSON(rawInput);
        if (!validation.valid) {
            throw new Error(`[ExportEngine] Failed to parse project: ${validation.error}`);
        }

        const parsed = validation.parsed;

        // If already v2.0 multi-level, return normalized package
        if (validation.isMultiLevel) {
            return ExportEngine.createProjectPackage({
                levels: parsed.levels || [],
                activeLevelIndex: parsed.activeLevelIndex !== undefined ? parsed.activeLevelIndex : 0,
                metadata: parsed.metadata || { name: parsed.name },
                settings: parsed.settings || {}
            });
        }

        // Upgrade legacy v1.0 single floor plan
        const legacyLevelData = parsed.data || (typeof rawInput === 'string' ? rawInput : JSON.stringify(parsed));
        const now = new Date().toISOString();

        return ExportEngine.createProjectPackage({
            levels: [
                {
                    id: 'level-ground',
                    name: 'Ground Floor',
                    elevation: 0,
                    height: 280,
                    data: legacyLevelData,
                    isVisible: true
                }
            ],
            activeLevelIndex: 0,
            metadata: {
                name: parsed.name || 'Imported Plan',
                createdAt: now,
                updatedAt: now,
                upgradedFromVersion: '1.0'
            },
            settings: parsed.settings || {}
        });
    }

    /**
     * Downloads content in the browser as a physical file.
     * @param {string|Blob} content - String content or Blob or DataURL
     * @param {string} fileName - File name to save as
     * @param {string} [mimeType='application/json'] - MIME type
     * @param {boolean} [isDataUrl=false] - True if content is a DataURL string
     */
    static downloadFile(content, fileName, mimeType = 'application/json', isDataUrl = false) {
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return false;
        }

        try {
            let url;
            let shouldRevoke = false;

            if (isDataUrl && typeof content === 'string') {
                url = content;
            } else if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
                const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
                url = URL.createObjectURL(blob);
                shouldRevoke = true;
            } else {
                return false;
            }

            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            if (shouldRevoke) {
                setTimeout(() => URL.revokeObjectURL(url), 1000);
            }
            return true;
        } catch (err) {
            console.error('[ExportEngine] File download error:', err);
            return false;
        }
    }

    /**
     * Exports full project as downloadable JSON file.
     * @param {Object} projectData - Project manifest or planner state
     * @param {Object} [options={}] - Options { fileName, download = true }
     * @returns {string} JSON string
     */
    static exportProjectJSON(projectData, options = {}) {
        let manifest;

        if (projectData && (projectData.levels || projectData.version === '2.0')) {
            manifest = ExportEngine.createProjectPackage(projectData);
        } else if (projectData && typeof projectData.exportState === 'function') {
            // Planner instance passed directly
            const levelData = projectData.exportState();
            manifest = ExportEngine.createProjectPackage({
                levels: [{ id: 'level-0', name: 'Ground Floor', elevation: 0, height: 280, data: levelData, isVisible: true }],
                activeLevelIndex: 0,
                settings: projectData.settings || {}
            });
        } else {
            manifest = projectData;
        }

        const jsonStr = ExportEngine.safeStringify(manifest);
        const fileName = options.fileName || `${manifest.metadata?.name || 'floorplan'}.json`.replace(/[^a-zA-Z0-9_.-]/g, '_');

        if (options.download !== false) {
            ExportEngine.downloadFile(jsonStr, fileName, 'application/json');
        }

        return jsonStr;
    }

    /**
     * Imports project JSON into active planner.
     * @param {Object} planner - 2D planner instance
     * @param {string|Object} rawJSON - JSON payload
     * @param {Object} [options={}] - Options { sync = true }
     * @returns {Object} Normalized project manifest
     */
    static importProjectJSON(planner, rawJSON, options = {}) {
        const manifest = ExportEngine.parseProjectJSON(rawJSON);

        if (planner && manifest.levels && manifest.levels.length > 0) {
            const activeLevel = manifest.levels[manifest.activeLevelIndex] || manifest.levels[0];
            if (activeLevel && activeLevel.data) {
                planner.importState(activeLevel.data);
                if (manifest.settings && Object.keys(manifest.settings).length > 0) {
                    planner.settings = { ...(planner.settings || {}), ...manifest.settings };
                }
                if (options.sync !== false && typeof planner.syncAll === 'function') {
                    planner.syncAll();
                }
            }
        }

        return manifest;
    }

    /**
     * Captures high-resolution 2D plan blueprint image.
     * @param {Object} planner - 2D planner instance
     * @param {Object} [options={}] - Options { pixelRatio = 2, mimeType = 'image/png', download = false, fileName = 'blueprint.png' }
     * @returns {string|null} DataURL
     */
    static export2DPlanImage(planner, options = {}) {
        if (!planner || !planner.stage || typeof planner.stage.toDataURL !== 'function') {
            console.warn('[ExportEngine] 2D stage not available for plan export.');
            return null;
        }

        const pixelRatio = options.pixelRatio || 2;
        const mimeType = options.mimeType || 'image/png';
        const fileName = options.fileName || 'blueprint.png';

        try {
            const dataUrl = planner.stage.toDataURL({
                pixelRatio,
                mimeType
            });

            if (options.download && dataUrl) {
                ExportEngine.downloadFile(dataUrl, fileName, mimeType, true);
            }

            return dataUrl;
        } catch (err) {
            console.error('[ExportEngine] Failed to capture 2D plan image:', err);
            return null;
        }
    }

    /**
     * Computes tight architectural building bounding box across active 3D groups.
     * Filters out hitboxes, technical triggers, and invisible meshes.
     * @param {Object} preview3D - 3D engine/preview context
     * @returns {THREE.Box3}
     */
    static getBuildingBoundingBox(preview3D) {
        const box = new THREE.Box3();
        if (!preview3D) return box;

        const expandByObject = (obj) => {
            if (!obj) return;
            obj.traverse((child) => {
                if (child.isMesh && child.visible !== false) {
                    // Ignore technical/invisible geometry that artificially expands the bounding box
                    if (child.userData && (child.userData.isHitbox || child.userData.isWallSide || child.userData.isFloorTrigger)) {
                        return;
                    }

                    // Ignore meshes whose material is explicitly invisible or fully transparent
                    if (child.material) {
                        const checkMat = (m) => m && (m.visible === false || (m.opacity === 0 && m.transparent));
                        if (Array.isArray(child.material)) {
                            if (child.material.every(checkMat)) return;
                        } else {
                            if (checkMat(child.material)) return;
                        }
                    }

                    if (!child.geometry.boundingBox) {
                        child.geometry.computeBoundingBox();
                    }
                    if (child.geometry.boundingBox) {
                        const childBox = child.geometry.boundingBox.clone();
                        childBox.applyMatrix4(child.matrixWorld);
                        box.union(childBox);
                    }
                }
            });
        };

        if (preview3D.structureGroup) {
            expandByObject(preview3D.structureGroup);
        }
        if (preview3D.staticStructureGroup) {
            expandByObject(preview3D.staticStructureGroup);
        }

        if (box.isEmpty()) {
            box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1000, 1000, 1000));
        }

        return box;
    }

    /**
     * Renders a professional architectural studio capture from a specific view angle.
     * @param {Object} preview3D - 3D engine context
     * @param {'top'|'front'|'back'|'left'|'right'|'frontLeft'|'frontRight'} viewType
     * @param {Object} [options={}]
     * @returns {Promise<string|null>} DataURL of the captured view
     */
    static async capture3DView(preview3D, viewType, options = {}) {
        if (!preview3D || !preview3D.renderer || !preview3D.scene) {
            console.warn('[ExportEngine] 3D preview context unavailable for view capture.');
            return null;
        }

        const { camera, renderer, scene } = preview3D;
        const originalCamera = camera;
        const originalBg = scene.background;
        const originalEnv = scene.environment;

        const box = ExportEngine.getBuildingBoundingBox(preview3D);
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);

        if (size.x < 1) size.x = 100;
        if (size.y < 1) size.y = 100;
        if (size.z < 1) size.z = 100;

        const w = renderer.domElement?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 1024);
        const h = renderer.domElement?.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 768);
        const aspect = (w && h) ? (w / h) : 1.33;

        const padding = 1.05;
        let camW, camH;

        if (viewType === 'top') {
            const topW = size.x;
            const topH = size.z;
            if (topW / topH > aspect) {
                camW = topW * padding;
                camH = camW / aspect;
            } else {
                camH = topH * padding;
                camW = camH * aspect;
            }
        } else if (viewType === 'front' || viewType === 'back') {
            const elevW = size.x;
            const elevH = size.y;
            if (elevW / elevH > aspect) {
                camW = elevW * padding;
                camH = camW / aspect;
            } else {
                camH = elevH * padding;
                camW = camH * aspect;
            }
        } else if (viewType === 'left' || viewType === 'right') {
            const elevW = size.z;
            const elevH = size.y;
            if (elevW / elevH > aspect) {
                camW = elevW * padding;
                camH = camW / aspect;
            } else {
                camH = elevH * padding;
                camW = camH * aspect;
            }
        } else {
            // frontLeft, frontRight axonometric
            const elevW = Math.hypot(size.x, size.z);
            const elevH = size.y + Math.min(size.x, size.z) * 0.5;
            if (elevW / elevH > aspect) {
                camW = elevW * padding;
                camH = camW / aspect;
            } else {
                camH = elevH * padding;
                camW = camH * aspect;
            }
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        const offset = maxDim * 2;

        const tempCamera = new THREE.OrthographicCamera(
            -camW / 2, camW / 2, camH / 2, -camH / 2,
            1, offset + maxDim * 4
        );

        const camTarget = center.clone();

        if (viewType === 'top') {
            tempCamera.position.set(camTarget.x, camTarget.y + offset, camTarget.z);
        } else if (viewType === 'front') {
            tempCamera.position.set(camTarget.x, camTarget.y, camTarget.z + offset);
        } else if (viewType === 'back') {
            tempCamera.position.set(camTarget.x, camTarget.y, camTarget.z - offset);
        } else if (viewType === 'left') {
            tempCamera.position.set(camTarget.x - offset, camTarget.y, camTarget.z);
        } else if (viewType === 'right') {
            tempCamera.position.set(camTarget.x + offset, camTarget.y, camTarget.z);
        } else if (viewType === 'frontLeft') {
            tempCamera.position.set(camTarget.x - offset, camTarget.y + offset * 0.5, camTarget.z + offset);
        } else if (viewType === 'frontRight') {
            tempCamera.position.set(camTarget.x + offset, camTarget.y + offset * 0.5, camTarget.z + offset);
        }

        tempCamera.lookAt(camTarget);
        tempCamera.updateProjectionMatrix();

        scene.environment = null;

        // Premium architectural gradient background
        let bgTexture = null;
        if (typeof document !== 'undefined') {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 2;
                canvas.height = 512;
                const context = canvas.getContext('2d');
                if (context) {
                    const gradient = context.createLinearGradient(0, 0, 0, 512);
                    gradient.addColorStop(0, '#afcbff');
                    gradient.addColorStop(1, '#eaeff5');
                    context.fillStyle = gradient;
                    context.fillRect(0, 0, 2, 512);
                    bgTexture = new THREE.CanvasTexture(canvas);
                    scene.background = bgTexture;
                }
            } catch (e) {}
        }

        const originalClearColor = renderer.getClearColor ? renderer.getClearColor(new THREE.Color()) : 0xeaeff5;
        const originalClearAlpha = renderer.getClearAlpha ? renderer.getClearAlpha() : 1;
        if (renderer.setClearColor) renderer.setClearColor(0xeaeff5, 1);

        const groundObj = preview3D.sceneSetup?.ground;
        const gridObj = preview3D.sceneSetup?.grid;
        const originalFog = scene.fog;
        scene.fog = null;

        const hiddenItems = [];
        scene.traverse(child => {
            if (child.isLight || child.isHemisphereLight || child.isGridHelper || child.name === 'grid' || child.userData?.isGrid || child === groundObj || child === gridObj) {
                hiddenItems.push({ obj: child, visible: child.visible });
                child.visible = false;
            }
        });

        const thumbnailLightGroup = new THREE.Group();
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd9d9d9, 0.6);
        thumbnailLightGroup.add(hemiLight);

        const keyLight = new THREE.DirectionalLight(0xfffdfa, 1.2);
        let lightOffsetX = maxDim;
        let lightOffsetZ = maxDim;

        if (viewType === 'frontRight' || viewType === 'right') {
            lightOffsetX = -maxDim;
        } else if (viewType === 'back') {
            lightOffsetZ = -maxDim;
        }

        keyLight.position.copy(camTarget).add(new THREE.Vector3(lightOffsetX, maxDim, lightOffsetZ));
        keyLight.target.position.copy(camTarget);
        keyLight.castShadow = true;

        const fillLight = new THREE.DirectionalLight(0xeaeff5, 0.5);
        fillLight.position.copy(camTarget).add(new THREE.Vector3(-lightOffsetX, maxDim * 0.5, -lightOffsetZ));
        fillLight.target.position.copy(camTarget);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);

        const previewGroundGeo = new THREE.PlaneGeometry(maxDim * 10, maxDim * 10);
        const previewGroundMat = new THREE.MeshStandardMaterial({ color: 0xe5e5e5, roughness: 1.0, metalness: 0.0 });
        const previewGround = new THREE.Mesh(previewGroundGeo, previewGroundMat);
        previewGround.rotation.x = -Math.PI / 2;
        previewGround.position.y = -0.5;
        previewGround.receiveShadow = true;

        thumbnailLightGroup.add(keyLight);
        thumbnailLightGroup.add(keyLight.target);
        thumbnailLightGroup.add(fillLight);
        thumbnailLightGroup.add(fillLight.target);
        thumbnailLightGroup.add(ambientLight);
        thumbnailLightGroup.add(previewGround);

        scene.add(thumbnailLightGroup);
        preview3D.camera = tempCamera;

        renderer.render(scene, tempCamera);
        let dataUrl = '';
        if (renderer.domElement && typeof renderer.domElement.toDataURL === 'function') {
            dataUrl = renderer.domElement.toDataURL('image/png');
        }

        // Cleanup temporary lights & ground
        scene.remove(thumbnailLightGroup);
        scene.background = originalBg;
        scene.environment = originalEnv;
        scene.fog = originalFog;
        if (renderer.setClearColor) renderer.setClearColor(originalClearColor, originalClearAlpha);

        hiddenItems.forEach(item => {
            item.obj.visible = item.visible;
        });

        preview3D.camera = originalCamera;
        renderer.render(scene, originalCamera);

        if (bgTexture) bgTexture.dispose();
        previewGroundGeo.dispose();
        previewGroundMat.dispose();

        return dataUrl;
    }

    /**
     * Batch generates preview thumbnails across multiple standard angles.
     * @param {Object} preview3D 
     * @param {string[]} [views=['frontLeft', 'frontRight', 'top', 'back']] 
     * @returns {Promise<Object>} Map of { viewTypePreview: dataUrl }
     */
    static async generate3DPreviews(preview3D, views = ['frontLeft', 'frontRight', 'top', 'back']) {
        const images = {};
        for (const view of views) {
            const dataUrl = await ExportEngine.capture3DView(preview3D, view);
            if (dataUrl) {
                images[`${view}Preview`] = dataUrl;
            }
        }
        return images;
    }

    /**
     * Uploads project data and generated thumbnails to backend cloud save endpoint.
     * @param {string} projectName 
     * @param {Object|string} projectData 
     * @param {Object} previewImages - Map of image base64 strings
     * @param {Object} [options={}] - Options { baseUrl }
     * @returns {Promise<Object>}
     */
    static async saveProjectToCloud(projectName, projectData, previewImages = {}, options = {}) {
        const baseUrl = options.baseUrl || ExportEngine.DEFAULT_API_BASE_URL;
        const projectJson = typeof projectData === 'string' ? projectData : ExportEngine.safeStringify(projectData);

        const formData = new FormData();
        formData.append('projectName', projectName);
        formData.append('projectJson', projectJson);

        for (const [key, base64Str] of Object.entries(previewImages)) {
            if (base64Str) {
                const response = await fetch(base64Str);
                const blob = await response.blob();
                formData.append(key, blob, `${projectName}-${key}.png`);
            }
        }

        const res = await fetch(`${baseUrl}/api/projects/save`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            throw new Error(`[ExportEngine] Error saving project to cloud: ${res.statusText}`);
        }

        return await res.json();
    }
}

if (typeof window !== 'undefined') {
    window.ExportEngine = ExportEngine;
}
