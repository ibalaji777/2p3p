import * as THREE from 'three';

export class GlassPreviewRenderer {
    constructor() {
        this.cache = new Map();
        this.renderer = null;
        this.scene = null;
        this.camera = null;
        this.pmremGenerator = null;
        this.envTexture = null;
        this.sphereMesh = null;
        this.initialized = false;
    }

    init() {
        if (this.initialized) return;

        // 1. Offscreen WebGL Renderer — high precision, anti-aliased
        const size = 256;
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            preserveDrawingBuffer: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setSize(size, size);
        this.renderer.setPixelRatio(2);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;

        // 2. Main render scene
        this.scene = new THREE.Scene();

        // 3. Camera — tight framing so sphere fills the card
        this.camera = new THREE.PerspectiveCamera(40, 1, 1, 1000);
        this.camera.position.set(0, 4, 88);
        this.camera.lookAt(0, 0, 0);

        // 4. Build the rich interior environment scene and generate PMREM from it
        this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        this.pmremGenerator.compileEquirectangularShader();
        this.envTexture = this.buildInteriorEnvironment();
        this.scene.environment = this.envTexture;

        // 5. Ground plane (polished marble-like reflective floor)
        this.createGroundPlane();

        // 6. Studio lighting rig
        this.createStudioLighting();

        // 7. Backdrop — rich interior canvas behind the sphere
        this.createInteriorBackdrop();

        // 8. Glass sphere mesh
        const geo = new THREE.SphereGeometry(32, 128, 128);
        this.sphereMesh = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial());
        this.sphereMesh.position.set(0, 0, 0);
        this.sphereMesh.castShadow = true;
        this.sphereMesh.receiveShadow = false;
        this.scene.add(this.sphereMesh);

        this.initialized = true;
    }

    /**
     * Builds a detailed 3D penthouse interior scene with geometry (walls, windows,
     * floor, ceiling, furniture, plants) and generates a PMREM environment cubemap.
     * This cubemap is what the glass sphere refracts and reflects.
     */
    buildInteriorEnvironment() {
        const envScene = new THREE.Scene();

        // ─── Room Shell ───────────────────────────────────────────────
        // A large box-like room with warm-toned walls and a bright window wall
        const roomSize = { w: 16, h: 8, d: 14 };

        // Floor — polished dark marble
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x3a3a3a,
            roughness: 0.15,
            metalness: 0.3
        });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.w, roomSize.d), floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -4;
        envScene.add(floor);

        // Floor reflective marble tiles (lighter pattern)
        const tileMat = new THREE.MeshStandardMaterial({
            color: 0x8a8a8a,
            roughness: 0.1,
            metalness: 0.25
        });
        for (let x = -6; x <= 6; x += 3) {
            for (let z = -5; z <= 5; z += 3) {
                const tile = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), tileMat);
                tile.rotation.x = -Math.PI / 2;
                tile.position.set(x, -3.98, z);
                envScene.add(tile);
            }
        }

        // Ceiling
        const ceilingMat = new THREE.MeshStandardMaterial({
            color: 0xf5f5f5,
            roughness: 0.6,
            metalness: 0.0
        });
        const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.w, roomSize.d), ceilingMat);
        ceiling.rotation.x = Math.PI / 2;
        ceiling.position.y = 4;
        envScene.add(ceiling);

        // Back wall (warm grey)
        const wallMat = new THREE.MeshStandardMaterial({
            color: 0x9e9e8a,
            roughness: 0.65,
            metalness: 0.0
        });
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.w, roomSize.h), wallMat);
        backWall.position.z = -7;
        envScene.add(backWall);

        // Side walls (slightly darker warmth)
        const sideWallMat = new THREE.MeshStandardMaterial({
            color: 0x8a8a7a,
            roughness: 0.6,
            metalness: 0.0
        });
        const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.d, roomSize.h), sideWallMat);
        leftWall.rotation.y = Math.PI / 2;
        leftWall.position.x = -8;
        envScene.add(leftWall);

        const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(roomSize.d, roomSize.h), sideWallMat);
        rightWall.rotation.y = -Math.PI / 2;
        rightWall.position.x = 8;
        envScene.add(rightWall);

        // ─── Floor-to-Ceiling Window Wall (Front) ─────────────────────
        // The front wall is a giant window with mullions — bright sky visible
        const windowWallMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.3,
            metalness: 0.8
        });

        // Window frame — dark metal mullions
        // Vertical mullions
        for (let x = -7; x <= 7; x += 3.5) {
            const mullion = new THREE.Mesh(
                new THREE.BoxGeometry(0.15, roomSize.h, 0.1),
                windowWallMat
            );
            mullion.position.set(x, 0, 7);
            envScene.add(mullion);
        }
        // Horizontal mullion (mid)
        const hMullion = new THREE.Mesh(
            new THREE.BoxGeometry(roomSize.w, 0.12, 0.1),
            windowWallMat
        );
        hMullion.position.set(0, 0.5, 7);
        envScene.add(hMullion);

        // Sky panes (bright emissive sky blue — this is what refracts through glass)
        const skyMat = new THREE.MeshStandardMaterial({
            color: 0x87ceeb,
            emissive: 0x87ceeb,
            emissiveIntensity: 1.6,
            roughness: 0.0,
            metalness: 0.0
        });
        // Upper panes
        for (let x = -5.25; x <= 5.25; x += 3.5) {
            const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), skyMat);
            pane.position.set(x, 2.2, 6.95);
            pane.rotation.y = Math.PI;
            envScene.add(pane);
        }
        // Lower panes — greenery/trees visible
        const treeMat = new THREE.MeshStandardMaterial({
            color: 0x2d5a27,
            emissive: 0x1a3d16,
            emissiveIntensity: 0.6,
            roughness: 0.8,
            metalness: 0.0
        });
        for (let x = -5.25; x <= 5.25; x += 3.5) {
            const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.0), treeMat);
            pane.position.set(x, -1.8, 6.95);
            pane.rotation.y = Math.PI;
            envScene.add(pane);
        }

        // Bright outdoor light strip at bottom of windows
        const groundLightMat = new THREE.MeshStandardMaterial({
            color: 0xf0e68c,
            emissive: 0xf0e68c,
            emissiveIntensity: 0.8,
            roughness: 0.0
        });
        const groundLight = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.4), groundLightMat);
        groundLight.position.set(0, -3.5, 6.9);
        groundLight.rotation.y = Math.PI;
        envScene.add(groundLight);

        // ─── Simple Modern Lounge Chair & Floor Plant Next to Window ───
        const chairMat = new THREE.MeshStandardMaterial({
            color: 0x334155, // Charcoal slate fabric cushion
            roughness: 0.7,
            metalness: 0.0
        });
        const woodLegMat = new THREE.MeshStandardMaterial({
            color: 0x78350f, // Warm wood legs
            roughness: 0.4
        });

        // Chair cushion seat
        const chairSeat = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 2.0), chairMat);
        chairSeat.position.set(-2.5, -2.8, 2.5);
        envScene.add(chairSeat);

        // Chair backrest
        const chairBack = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.8, 0.4), chairMat);
        chairBack.position.set(-2.5, -1.8, 1.6);
        chairBack.rotation.x = -0.1;
        envScene.add(chairBack);

        // Chair legs (4 sleek angled wooden legs)
        [[-3.4, 1.7], [-1.6, 1.7], [-3.4, 3.3], [-1.6, 3.3]].forEach(([lx, lz]) => {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.0), woodLegMat);
            leg.position.set(lx, -3.4, lz);
            envScene.add(leg);
        });

        // Small side table next to chair
        const tableMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3, metalness: 0.2 });
        const smallTable = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08), tableMat);
        smallTable.position.set(-0.8, -2.7, 3.2);
        envScene.add(smallTable);
        const tableLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2), tableMat);
        tableLeg.position.set(-0.8, -3.3, 3.2);
        envScene.add(tableLeg);

        // Minimalist Potted Plant by Window (Right Side)
        const potMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.2 });
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.4, 1.0), potMat);
        pot.position.set(4.5, -3.4, 3.5);
        envScene.add(pot);

        const leafMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.6 });
        const plant = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 12), leafMat);
        plant.position.set(4.5, -2.4, 3.5);
        envScene.add(plant);

        // ─── Lighting for Environment Scene ──────────────────────────
        // Bright daylight coming through window
        const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
        sunLight.position.set(2, 6, 10);
        envScene.add(sunLight);

        // Warm interior fill
        const warmFill = new THREE.PointLight(0xffecd2, 2.5, 30);
        warmFill.position.set(-2, 2, 2);
        envScene.add(warmFill);

        // Cool window bounce
        const coolBounce = new THREE.PointLight(0x87ceeb, 1.5, 25);
        coolBounce.position.set(0, -2, 6);
        envScene.add(coolBounce);

        // Ambient base
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        envScene.add(ambient);

        // Hemisphere for natural sky/ground tones
        const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a3a3a, 0.8);
        envScene.add(hemi);

        // Generate PMREM cubemap from this interior scene
        const envMap = this.pmremGenerator.fromScene(envScene, 0.04).texture;

        // Dispose the environment construction scene geometry
        envScene.traverse((obj) => {
            if (obj.geometry) obj.geometry.dispose();
            if (obj.material) {
                if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                else obj.material.dispose();
            }
        });

        return envMap;
    }

    /**
     * Creates the visible backdrop canvas behind the sphere showing a blurred
     * penthouse interior. This is separate from the cubemap environment —
     * it's what you see in the card background behind the sphere.
     */
    createInteriorBackdrop() {
        const cvs = document.createElement('canvas');
        cvs.width = 512;
        cvs.height = 512;
        const ctx = cvs.getContext('2d');

        // Dark elegant room gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 512);
        bgGrad.addColorStop(0, '#2a2a2f');
        bgGrad.addColorStop(0.3, '#1e1e24');
        bgGrad.addColorStop(0.6, '#1a1a1e');
        bgGrad.addColorStop(1, '#2d2d32');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 512, 512);

        // Window glow areas (bright sky panes behind the sphere)
        ctx.fillStyle = 'rgba(135, 180, 210, 0.35)';
        ctx.fillRect(30, 20, 100, 300);
        ctx.fillRect(150, 30, 90, 280);
        ctx.fillRect(340, 20, 110, 300);

        // Window mullion lines
        ctx.strokeStyle = 'rgba(50, 50, 55, 0.8)';
        ctx.lineWidth = 3;
        [140, 260, 340].forEach(x => {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 350);
            ctx.stroke();
        });
        // Horizontal bar
        ctx.beginPath();
        ctx.moveTo(0, 180);
        ctx.lineTo(512, 180);
        ctx.stroke();

        // Green foliage through windows (lower half)
        ctx.fillStyle = 'rgba(30, 70, 25, 0.4)';
        ctx.fillRect(30, 200, 100, 120);
        ctx.fillRect(150, 210, 90, 100);
        ctx.fillRect(340, 200, 110, 120);

        // Bright sky through upper windows
        ctx.fillStyle = 'rgba(160, 210, 240, 0.25)';
        ctx.fillRect(30, 30, 100, 150);
        ctx.fillRect(150, 40, 90, 140);
        ctx.fillRect(340, 30, 110, 150);

        // Polished floor with reflections
        const floorGrad = ctx.createLinearGradient(0, 380, 0, 512);
        floorGrad.addColorStop(0, 'rgba(60, 60, 65, 0.9)');
        floorGrad.addColorStop(0.4, 'rgba(50, 50, 55, 0.95)');
        floorGrad.addColorStop(1, 'rgba(35, 35, 38, 1.0)');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, 380, 512, 132);

        // Warm lamp glow (right side)
        const lampGlow = ctx.createRadialGradient(420, 280, 5, 420, 280, 80);
        lampGlow.addColorStop(0, 'rgba(255, 200, 100, 0.4)');
        lampGlow.addColorStop(1, 'rgba(255, 200, 100, 0.0)');
        ctx.fillStyle = lampGlow;
        ctx.fillRect(340, 200, 160, 160);

        // Soft blur for depth-of-field (Pristine, 0 noise for crystal clear transparency)
        ctx.filter = 'blur(8px)';
        ctx.drawImage(cvs, 0, 0);
        ctx.filter = 'none';

        const tex = new THREE.CanvasTexture(cvs);
        tex.colorSpace = THREE.SRGBColorSpace;

        const planeGeo = new THREE.PlaneGeometry(240, 240);
        const planeMat = new THREE.MeshBasicMaterial({
            map: tex,
            depthWrite: false
        });
        this.backdropMesh = new THREE.Mesh(planeGeo, planeMat);
        this.backdropMesh.position.set(0, 0, -75);
        this.scene.add(this.backdropMesh);
    }

    createGroundPlane() {
        // Polished dark marble floor
        const floorGeo = new THREE.PlaneGeometry(300, 300);
        const floorMat = new THREE.MeshStandardMaterial({
            color: 0x2a2a2e,
            roughness: 0.15,
            metalness: 0.25
        });
        const floor = new THREE.Mesh(floorGeo, floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.y = -32.0;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Contact shadow
        const shadowGeo = new THREE.PlaneGeometry(100, 100);
        const shadowMat = new THREE.ShadowMaterial({ opacity: 0.2 });
        const shadowMesh = new THREE.Mesh(shadowGeo, shadowMat);
        shadowMesh.rotation.x = -Math.PI / 2;
        shadowMesh.position.y = -31.9;
        shadowMesh.receiveShadow = true;
        this.scene.add(shadowMesh);
    }

    createStudioLighting() {
        // Hemisphere light — cool sky / warm ground
        const hemiLight = new THREE.HemisphereLight(0xc4dff6, 0x3a3530, 1.2);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        // Key light (top-left-front) — primary white highlight
        const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(65, 100, 85);
        keyLight.castShadow = true;
        keyLight.shadow.mapSize.width = 512;
        keyLight.shadow.mapSize.height = 512;
        keyLight.shadow.bias = -0.0005;
        keyLight.shadow.radius = 3;
        this.scene.add(keyLight);

        // Back rim light — cool edge highlight for glass fresnel
        const rimLight = new THREE.DirectionalLight(0xa0c8e0, 2.8);
        rimLight.position.set(-55, 75, -85);
        this.scene.add(rimLight);

        // Front fill light — warm amber
        const fillLight = new THREE.DirectionalLight(0xffecd2, 1.0);
        fillLight.position.set(-80, -30, 65);
        this.scene.add(fillLight);

        // Bottom uplight for lower sphere curvature
        const upLight = new THREE.DirectionalLight(0xffffff, 1.0);
        upLight.position.set(0, -80, 50);
        this.scene.add(upLight);
    }

    /**
     * Pre-warms the 3D WebGL preview engine and generates all glass thumbnails during idle time.
     * @param {Object} registry - Glass materials registry.
     */
    prewarm(registry) {
        if (!registry) return;
        const doPrewarm = () => {
            for (const [key, config] of Object.entries(registry)) {
                if (config && !config.isAlias) {
                    try {
                        this.renderGlassThumbnail(key, config);
                    } catch (e) {
                        console.warn('[GlassPreviewRenderer] Prewarm warning:', e);
                    }
                }
            }
        };

        if (typeof window !== 'undefined' && window.requestIdleCallback) {
            window.requestIdleCallback(doPrewarm);
        } else {
            setTimeout(doPrewarm, 80);
        }
    }

    /**
     * Renders a photorealistic 3D PBR glass sphere preview and returns a data URL.
     * @param {string} matKey - The glass material identifier.
     * @param {Object} config - The glass configuration object.
     * @returns {string} High resolution PNG data URL of rendered 3D PBR glass sphere.
     */
    renderGlassThumbnail(matKey, config = {}) {
        const cacheKey = matKey;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (!this.initialized) this.init();

        // Higher env map intensity for reflective/metallic glass types
        const envIntensity = (config.metalness && config.metalness > 0.2) ? 3.0 : 1.8;

        // Build PBR MeshPhysicalMaterial from glass configuration
        const mat = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(config.color !== undefined ? config.color : 0xffffff),
            transmission: config.transmission !== undefined ? config.transmission : 0.95,
            ior: config.ior || 1.50,
            roughness: config.roughness !== undefined ? config.roughness : 0.02,
            metalness: config.metalness !== undefined ? config.metalness : 0.0,
            thickness: config.thickness !== undefined ? config.thickness : 22.0,
            specularIntensity: config.specularIntensity !== undefined ? config.specularIntensity : 1.0,
            specularColor: new THREE.Color(0xffffff),
            transparent: true,
            opacity: 1.0,
            depthWrite: true,
            envMapIntensity: envIntensity,
            clearcoat: 0.0,
            clearcoatRoughness: 0.0
        });

        // Attenuation (absorption tinting for colored glass)
        if (config.attenuationColor) {
            mat.attenuationColor = new THREE.Color(config.attenuationColor);
            mat.attenuationDistance = config.attenuationDistance || 15.0;
        }

        // Assign material to sphere
        this.sphereMesh.material = mat;
        this.sphereMesh.rotation.y = 0.35;

        // Render
        this.renderer.render(this.scene, this.camera);
        const dataUrl = this.renderer.domElement.toDataURL('image/png');

        // Cleanup material
        mat.dispose();

        // Cache
        this.cache.set(cacheKey, dataUrl);
        return dataUrl;
    }
}

export const glassPreviewRenderer = new GlassPreviewRenderer();
