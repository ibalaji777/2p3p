import * as THREE from 'three';

export class MarblePreviewRenderer {
    constructor() {
        this.cache = new Map();
        this.textureCache = new Map();
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.pmremGenerator = null;
        this.envTexture = null;
        this.sphereMesh = null;
        this.pedestalMesh = null;
        this.textureLoader = new THREE.TextureLoader();
        this.initialized = false;
    }

    init() {
        if (this.hasFailed) return;
        if (this.initialized && this.renderer) return;

        // 1. Offscreen WebGL Renderer — high precision, anti-aliased studio render
        const size = 256;
        try {
            this.renderer = new THREE.WebGLRenderer({
                antialias: true,
                alpha: true,
                preserveDrawingBuffer: true,
                powerPreference: 'high-performance'
            });
            if (this.renderer.domElement) {
                this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
                    e.preventDefault();
                    console.warn('[MarblePreviewRenderer] WebGL context lost prevented.');
                    this.dispose();
                }, false);
            }
            this.renderer.setSize(size, size);
            this.renderer.setPixelRatio(2);
            this.renderer.shadowMap.enabled = true;
            this.renderer.shadowMap.type = THREE.PCFShadowMap;
            if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
            this.renderer.toneMappingExposure = 1.35;
        } catch (e) {
            console.warn('[MarblePreviewRenderer] Failed to initialize WebGLRenderer:', e);
            this.renderer = null;
            this.initialized = false;
            this.hasFailed = true;
            return;
        }

        // 2. Scene
        this.scene = new THREE.Scene();

        // 3. Camera — framed to showcase full sphere with margin
        this.camera = new THREE.PerspectiveCamera(38, 1, 1, 1000);
        this.camera.position.set(0, 2, 115);
        this.camera.lookAt(0, 0, 0);

        // 4. Studio Environment PMREM
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.envTexture = this.buildStudioEnvironment();
        this.scene.environment = this.envTexture;

        // 5. Dark Reflective Studio Floor & Pedestal (Matching Screenshot!)
        this.createGroundAndPedestal();

        // 6. Studio Lighting (Soft Key Light, Crisp Window Highlight, Rim Light)
        this.createStudioLighting();

        // 7. Dark Studio Backdrop
        this.createStudioBackdrop();

        // 8. Marble Sphere Mesh (High detail SphereGeometry)
        const geo = new THREE.SphereGeometry(30, 128, 128);
        this.sphereMesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial());
        this.sphereMesh.position.set(0, 0, 0);
        this.sphereMesh.castShadow = true;
        this.sphereMesh.receiveShadow = false;
        this.scene.add(this.sphereMesh);

        this.initialized = true;
    }

    /**
     * Builds a studio HDRI environment with a bright square window softbox
     * that produces the iconic white curved window reflection on top-right of sphere.
     */
    buildStudioEnvironment() {
        const envScene = new THREE.Scene();

        // Dark ambient background
        const bgMat = new THREE.MeshBasicMaterial({ color: 0x111115, side: THREE.BackSide });
        const bgSphere = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 16), bgMat);
        envScene.add(bgSphere);

        // 1. Softbox Window 1 (Top-Right Front) — Crisp white grid reflection on sphere
        const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const softbox1 = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), windowMat);
        softbox1.position.set(18, 22, 22);
        softbox1.lookAt(0, 0, 0);
        envScene.add(softbox1);

        // Window mullion lines for architectural reflection
        const frameMat = new THREE.MeshBasicMaterial({ color: 0x111115 });
        const mullionH = new THREE.Mesh(new THREE.PlaneGeometry(18, 0.8), frameMat);
        mullionH.position.set(18, 22, 21.9);
        mullionH.lookAt(0, 0, 0);
        envScene.add(mullionH);

        const mullionV = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 18), frameMat);
        mullionV.position.set(18, 22, 21.9);
        mullionV.lookAt(0, 0, 0);
        envScene.add(mullionV);

        // 2. Soft Fill Window (Top-Left)
        const fillMat = new THREE.MeshBasicMaterial({ color: 0xdbeafe });
        const softbox2 = new THREE.Mesh(new THREE.PlaneGeometry(24, 24), fillMat);
        softbox2.position.set(-25, 20, 15);
        softbox2.lookAt(0, 0, 0);
        envScene.add(softbox2);

        // 3. Warm Underlight Bounce
        const bounceMat = new THREE.MeshBasicMaterial({ color: 0x33281e });
        const bounce = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), bounceMat);
        bounce.position.set(0, -15, 10);
        bounce.rotation.x = -Math.PI / 2;
        envScene.add(bounce);

        const envMap = this.pmremGenerator.fromScene(envScene, 0.04).texture;

        envScene.traverse(obj => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) obj.material.dispose();
        });

        return envMap;
    }

    createGroundAndPedestal() {
        // Dark polished reflective ground
        const floorGeo = new THREE.PlaneGeometry(300, 300);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x121215,
            roughness: 0.25,
            metalness: 0.4
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -35.0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Dark metallic display pedestal stand under sphere (matching reference mockup!)
        const pedGeo = new THREE.CylinderGeometry(18, 22, 6, 64);
        const pedMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1e,
            roughness: 0.3,
            metalness: 0.7
        });
        this.pedestalMesh = new THREE.Mesh(pedGeo, pedMat);
        this.pedestalMesh.position.set(0, -33.0, 0);
        this.pedestalMesh.receiveShadow = true;
        this.scene.add(this.pedestalMesh);

        // Metal bevel rim on pedestal top
        const rimGeo = new THREE.TorusGeometry(18, 0.8, 16, 64);
        const rimMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a42,
            roughness: 0.2,
            metalness: 0.9
        });
        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.set(0, -30.0, 0);
        this.scene.add(rim);

        // Contact Shadow
        const shadowGeo = new THREE.PlaneGeometry(60, 60);
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.4 });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = -29.9;
        shadowMesh.receiveShadow = true;
        this.scene.add(shadowMesh);
    }

    createStudioLighting() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x121215, 1.2);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        // Key Light (Top-Right-Front)
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.5);
        keyLight.position.set(55, 80, 75);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 512;
        keyLight.shadow.mapSize.height = 512;
        keyLight.shadow.bias = -0.0005;
        this.scene.add(keyLight);

        // Rim Light (Top-Rear-Left)
        const rimLight = new THREE.DirectionalLight(0x93c5fd, 2.0);
        rimLight.position.set(-60, 60, -70);
        this.scene.add(rimLight);

        // Front Fill
        const fillLight = new THREE.DirectionalLight(0xfef3c7, 0.8);
        fillLight.position.set(-70, -20, 60);
        this.scene.add(fillLight);
    }

    createStudioBackdrop() {
        const cvs = document.createElement('canvas');
        cvs.width = 512;
        cvs.height = 512;
        const ctx = cvs.getContext('2d');

        // Dark studio gradient backdrop (matching dark card layout)
        const bgGrad = ctx.createRadialGradient(256, 200, 20, 256, 256, 380);
        bgGrad.addColorStop(0, '#26262a');
        bgGrad.addColorStop(0.5, '#19191c');
        bgGrad.addColorStop(1, '#111114');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 512, 512);

        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;

        const planeGeo = new THREE.PlaneGeometry(240, 240);
        const planeMat = new THREE.MeshBasicMaterial({
            map: tex,
            depthWrite: false
        });
        const backdrop = new THREE.Mesh(planeGeo, planeMat);
        backdrop.position.set(0, 0, -75);
        this.scene.add(backdrop);
    }

    /**
     * Pre-warms 3D marble sphere renders in background idle time.
     * @param {Object} registry - Marble registry.
     */
    prewarm(registry) {
        if (!registry) return;
        const doPrewarm = () => {
            for (const [key, config] of Object.entries(registry)) {
                if (config && !config.isAlias) {
                    try {
                        this.renderMarbleThumbnail(key, config);
                    } catch (e) {
                        console.warn('[MarblePreviewRenderer] Prewarm warning:', e);
                    }
                }
            }
            // Dispose WebGL context after prewarm completes to free GPU context limit
            this.dispose();
        };

        if (typeof window !== 'undefined' && window.requestIdleCallback) {
            window.requestIdleCallback(doPrewarm);
        } else {
            setTimeout(doPrewarm, 80);
        }
    }

    /**
     * Renders a photorealistic 3D polished marble sphere preview data URL.
     * @param {string} matKey - Marble material key.
     * @param {Object} config - Marble material configuration.
     * @returns {string} Data URL of rendered 3D sphere.
     */
    renderMarbleThumbnail(matKey, config = {}) {
        const cacheKey = matKey;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (!this.initialized || !this.renderer) {
            this.init();
        }

        if (!this.renderer || !this.scene || !this.camera || !this.sphereMesh) {
            return '';
        }

        const textureUrl = config.texture || config.thumbnail;

        // Build PBR MeshPhysicalMaterial for Polished Marble
        const mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(config.color !== undefined ? config.color : 0xffffff),
            roughness: config.roughness !== undefined ? config.roughness : 0.12,
            metalness: config.metalness !== undefined ? config.metalness : 0.0,
            clearcoat: 1.0,               // Ultra-gloss clearcoat sheen
            clearcoatRoughness: 0.05,      // Crisp mirror reflection
            reflectivity: 0.9,
            envMapIntensity: 2.2
        });

        // Load texture map if available
        if (textureUrl) {
            if (this.textureCache.has(textureUrl)) {
                mat.map = this.textureCache.get(textureUrl);
            } else {
                const tex = this.textureLoader.load(textureUrl, (loadedTex) => {
                    loadedTex.colorSpace = THREE.SRGBColorSpace;
                    loadedTex.wrapS = loadedTex.wrapT = THREE.RepeatWrapping;
                    loadedTex.repeat.set(1.5, 1.5);
                    this.textureCache.set(textureUrl, loadedTex);
                    // Re-render and update cache once texture loads
                    if (this.sphereMesh && this.renderer && this.scene && this.camera) {
                        this.sphereMesh.material.map = loadedTex;
                        this.sphereMesh.material.needsUpdate = true;
                        try {
                            this.renderer.render(this.scene, this.camera);
                            const updatedDataUrl = this.renderer.domElement.toDataURL('image/png');
                            this.cache.set(cacheKey, updatedDataUrl);

                            // Update DOM element thumbnail if present
                            const sphereEl = document.querySelector(`#mat-thumb-${matKey}`);
                            if (sphereEl) {
                                sphereEl.style.backgroundImage = `url('${updatedDataUrl}')`;
                            }
                        } catch (e) {}
                    }
                });
                mat.map = tex;
            }
        }

        // Rotate sphere slightly to showcase diagonal veining and highlight
        this.sphereMesh.material = mat;
        this.sphereMesh.rotation.y = 0.45;
        this.sphereMesh.rotation.x = 0.2;

        // Render
        try {
            this.renderer.render(this.scene, this.camera);
            const dataUrl = this.renderer.domElement.toDataURL('image/png');

            // Cache initial render
            this.cache.set(cacheKey, dataUrl);
            return dataUrl;
        } catch (err) {
            console.warn('[MarblePreviewRenderer] Render error:', err);
            return '';
        }
    }

    dispose() {
        if (this.renderer) {
            try {
                this.renderer.dispose();
                this.renderer.forceContextLoss();
            } catch (e) {}
            this.renderer = null;
        }
        this.initialized = false;
        this.scene = null;
        this.camera = null;
        this.pmremGenerator = null;
        this.envTexture = null;
        this.sphereMesh = null;
    }
}

export const marblePreviewRenderer = new MarblePreviewRenderer();
