import * as THREE from 'three';

const BASE_URL = "http://localhost:3000";

export class ServerClass {
    constructor(preview3D, planner, getProjectState) {
        this.preview3D = preview3D;
        this.planner = planner;
        this.getProjectState = getProjectState;
    }

    getBuildingBoundingBox() {
        const box = new THREE.Box3();
        
        const expandByObject = (obj) => {
            obj.traverse((child) => {
                if (child.isMesh && child.visible !== false) {
                    // Ignore technical/invisible geometry that artificially expands the bounding box
                    if (child.userData && (child.userData.isHitbox || child.userData.isWallSide || child.userData.isFloorTrigger)) return;
                    
                    // Ignore meshes whose material is explicitly invisible or fully transparent
                    if (child.material) {
                        const checkMat = (m) => m.visible === false || (m.opacity === 0 && m.transparent);
                        if (Array.isArray(child.material)) {
                            if (child.material.every(checkMat)) return;
                        } else {
                            if (checkMat(child.material)) return;
                        }
                    }
                    
                    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                    if (child.geometry.boundingBox) {
                        const childBox = child.geometry.boundingBox.clone();
                        childBox.applyMatrix4(child.matrixWorld);
                        box.union(childBox);
                    }
                }
            });
        };

        if (this.preview3D.structureGroup) {
            expandByObject(this.preview3D.structureGroup);
        }
        if (this.preview3D.staticStructureGroup) {
            expandByObject(this.preview3D.staticStructureGroup);
        }

        if (box.isEmpty()) {
            box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1000, 1000, 1000));
        }
        return box;
    }

    async captureView(viewType) {
        const { camera, renderer, scene } = this.preview3D;
        const originalCamera = camera;
        const originalBg = scene.background;
        const originalEnv = scene.environment;

        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        // Fallback for empty/flat bounding box to avoid division errors
        if (size.x < 1) size.x = 100;
        if (size.y < 1) size.y = 100;
        if (size.z < 1) size.z = 100;

        const w = renderer.domElement.clientWidth || window.innerWidth;
        const h = renderer.domElement.clientHeight || window.innerHeight;
        const aspect = w / h;

        const padding = 1.05; // Tight 5% margin for maximum visibility and size
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
        } else if (viewType === 'frontLeft' || viewType === 'frontRight') {
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

        let camTarget = center.clone();
        
        // Auto position camera to face building bounds center properly
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

        // Hide original environment and lights to guarantee crisp studio render without washout
        scene.environment = null;
        
        // Premium architectural gradient sky background
        const canvas = document.createElement('canvas');
        canvas.width = 2;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        const gradient = context.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#afcbff'); // Soft top sky
        gradient.addColorStop(1, '#eaeff5'); // Soft horizon fade
        context.fillStyle = gradient;
        context.fillRect(0, 0, 2, 512);
        const bgTexture = new THREE.CanvasTexture(canvas);
        scene.background = bgTexture;

        const originalClearColor = renderer.getClearColor(new THREE.Color());
        const originalClearAlpha = renderer.getClearAlpha();
        renderer.setClearColor(0xeaeff5, 1);

        const groundObj = this.preview3D.sceneSetup?.ground;
        const gridObj = this.preview3D.sceneSetup?.grid;
        const originalFog = scene.fog;
        scene.fog = null; // Remove standard fog to avoid clashing with gradient

        const hiddenItems = [];
        scene.traverse(child => {
            if (child.isLight || child.isHemisphereLight || child.isGridHelper || child.name === 'grid' || child.userData.isGrid || child === groundObj || child === gridObj) {
                hiddenItems.push({ obj: child, visible: child.visible });
                child.visible = false;
            }
        });

        // Setup crisp high-contrast studio lighting
        const thumbnailLightGroup = new THREE.Group();
        
        // Hemisphere Light for soft sky/ground ambient
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xd9d9d9, 0.6);
        thumbnailLightGroup.add(hemiLight);
        
        // 45-degree angled sunlight for professional architectural shadows
        const keyLight = new THREE.DirectionalLight(0xfffdfa, 1.2);
        keyLight.position.copy(camTarget).add(new THREE.Vector3(maxDim, maxDim, maxDim));
        keyLight.target.position.copy(camTarget);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 2048; // High res shadows for soft edges
        keyLight.shadow.mapSize.height = 2048;
        keyLight.shadow.bias = -0.0005;
        
        const sunD = maxDim * 1.5;
        keyLight.shadow.camera.left = -sunD;
        keyLight.shadow.camera.right = sunD;
        keyLight.shadow.camera.top = sunD;
        keyLight.shadow.camera.bottom = -sunD;
        keyLight.shadow.camera.near = 1;
        keyLight.shadow.camera.far = offset + maxDim * 4;
        keyLight.shadow.camera.updateProjectionMatrix();

        // Strong Fill Light to prevent overly dark geometry corners
        const fillLight = new THREE.DirectionalLight(0xeaeff5, 0.5);
        fillLight.position.copy(camTarget).add(new THREE.Vector3(-maxDim, maxDim * 0.5, -maxDim));
        fillLight.target.position.copy(camTarget);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        
        // Matte architectural floor to ground the building and catch shadows
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

        this.preview3D.camera = tempCamera;

        // Force scene update and capture image
        renderer.render(scene, tempCamera);
        const dataUrl = renderer.domElement.toDataURL('image/png');
        
        // Cleanup all temporary items
        scene.remove(thumbnailLightGroup);
        scene.background = originalBg;
        scene.environment = originalEnv;
        scene.fog = originalFog;
        renderer.setClearColor(originalClearColor, originalClearAlpha);

        hiddenItems.forEach(item => {
            item.obj.visible = item.visible;
        });

        this.preview3D.camera = originalCamera;
        renderer.render(scene, originalCamera);
        
        if (bgTexture) bgTexture.dispose();

        return dataUrl;
    }

    async generatePreviewImages() {
        const views = ['front', 'left', 'right', 'top', 'back', 'frontLeft', 'frontRight'];
        const images = {};
        for (const view of views) {
            images[`${view}Preview`] = await this.captureView(view);
            // Small yield to not block UI completely if generating many large images
            await new Promise(resolve => setTimeout(resolve, 10));
        }
        return images;
    }

    exportProjectJson() {
        if (this.getProjectState) {
            return JSON.stringify(this.getProjectState());
        }
        return JSON.stringify({ data: this.planner.exportState() });
    }

    async saveProject(projectName) {
        try {
            const projectJson = this.exportProjectJson();
            const imagesBase64 = await this.generatePreviewImages();
            
            const formData = new FormData();
            formData.append('projectName', projectName);
            formData.append('projectJson', projectJson);
            
            for (const [key, base64Str] of Object.entries(imagesBase64)) {
                const response = await fetch(base64Str);
                const blob = await response.blob();
                formData.append(key, blob, `${projectName}-${key}.png`);
            }

            const response = await fetch(`${BASE_URL}/api/projects/save`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Error saving project: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Failed to save project:', error);
            throw error;
        }
    }
}