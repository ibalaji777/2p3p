import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { WIDGET_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from './registry.js';

export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xdbeafe);
        this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.0008); 
        this.camera = new THREE.PerspectiveCamera(45, this.container.clientWidth / this.container.clientHeight, 1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.physicallyCorrectLights = true;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        this.container.appendChild(this.renderer.domElement);
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.05; 
        
        this.generateEnvironmentMap();
        this.initLighting();
        
        const groundGeo = new THREE.PlaneGeometry(10000, 10000); const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7c59, roughness: 1.0 }); const ground = new THREE.Mesh(groundGeo, groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; this.scene.add(ground);
        this.structureGroup = new THREE.Group(); this.scene.add(this.structureGroup);
        this.proceduralTextures = {}; 
        
        window.addEventListener('resize', () => this.resize()); this.animate();
    }

    initLighting() {
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2); hemiLight.position.set(0, 500, 0); this.scene.add(hemiLight);
        const sunLight = new THREE.DirectionalLight(0xfffaed, 2.5); sunLight.position.set(300, 600, 400); sunLight.castShadow = true; sunLight.shadow.mapSize.width = 2048; sunLight.shadow.mapSize.height = 2048; sunLight.shadow.camera.near = 10; sunLight.shadow.camera.far = 2000; sunLight.shadow.bias = -0.0005; const d = 800; sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d; sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d; this.scene.add(sunLight);
    }
    generateEnvironmentMap() { const pmremGenerator = new THREE.PMREMGenerator(this.renderer); pmremGenerator.compileEquirectangularShader(); this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture; }
    resize() { if (this.container.style.display !== 'none') { this.camera.aspect = this.container.clientWidth / this.container.clientHeight; this.camera.updateProjectionMatrix(); this.renderer.setSize(this.container.clientWidth, this.container.clientHeight); } }
    animate() { requestAnimationFrame(() => this.animate()); this.controls.update(); this.renderer.render(this.scene, this.camera); }
    
    getProceduralTexture(type, colorHex) {
        const key = `${type}_${colorHex}`; if (this.proceduralTextures[key]) return this.proceduralTextures[key];
        const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 1024; const ctx = canvas.getContext('2d'); ctx.fillStyle = '#' + colorHex.toString(16).padStart(6, '0'); ctx.fillRect(0, 0, 1024, 1024);
        if (type === 'wood') { ctx.globalAlpha = 0.04; ctx.fillStyle = '#1a0b00'; for (let i = 0; i < 600; i++) { let w = Math.random() * 4 + 1; let x = Math.random() * 1024; ctx.fillRect(x, 0, w, 1024); } ctx.globalAlpha = 0.02; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 300; i++) { let w = Math.random() * 3 + 1; let x = Math.random() * 1024; ctx.fillRect(x, 0, w, 1024); } ctx.globalAlpha = 0.05; ctx.strokeStyle = '#2b1400'; for (let i = 0; i < 60; i++) { ctx.beginPath(); ctx.lineWidth = Math.random() * 2 + 1; let startX = Math.random() * 1024; let sway = (Math.random() - 0.5) * 60; ctx.moveTo(startX, 0); ctx.bezierCurveTo(startX + sway, 340, startX - sway, 680, startX + (sway / 2), 1024); ctx.stroke(); } } else if (type === 'brushed') { ctx.globalAlpha = 0.05; ctx.fillStyle = '#000000'; for (let i = 0; i < 800; i++) { let h = Math.random() * 2; let y = Math.random() * 1024; ctx.fillRect(0, y, 1024, h); } }
        const texture = new THREE.CanvasTexture(canvas); texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(2, 1); texture.encoding = THREE.sRGBEncoding; this.proceduralTextures[key] = texture; return texture;
    }
    
    getDynamicMaterial(matKey, category = 'door') {
        const DOOR_MATS = window.DOOR_MATERIALS || {}; const WIN_FRAME_MATS = window.WINDOW_FRAME_MATERIALS || {}; const WIN_GLASS_MATS = window.WINDOW_GLASS_MATERIALS || {};
        let conf; if (category === 'door') conf = DOOR_MATS[matKey] || { color: 0xc4a482, roughness: 0.6, metalness: 0.05, texture: 'wood' }; else if (category === 'window_frame') conf = WIN_FRAME_MATS[matKey] || { color: 0xffffff, roughness: 0.8, metalness: 0, texture: 'solid' }; else if (category === 'window_glass') conf = WIN_GLASS_MATS[matKey] || { color: 0xeff6ff, transmission: 0.95, roughness: 0, ior: 1.5, transparent: true };
        if (conf.transmission || category === 'window_glass') { return new THREE.MeshPhysicalMaterial({ color: conf.color, metalness: conf.metalness || 0, roughness: conf.roughness || 0, transmission: conf.transmission || 0.9, ior: conf.ior || 1.5, thickness: conf.thickness || 2.0, transparent: true, envMapIntensity: 1.5, clearcoat: conf.clearcoat || 1.0 }); }
        const texture = conf.texture !== 'solid' ? this.getProceduralTexture(conf.texture, conf.color) : null; return new THREE.MeshStandardMaterial({ color: conf.color, roughness: conf.roughness, metalness: conf.metalness, map: texture, bumpMap: texture, bumpScale: conf.bumpScale || 0, envMapIntensity: 1.0, clearcoat: conf.clearcoat || 0 });
    }

    createElevation3DTexture(layers, wallLen) {
        const canvas = document.createElement('canvas'); const RES = 4; canvas.width = Math.max(128, wallLen * RES); canvas.height = WALL_HEIGHT * RES; const ctx = canvas.getContext('2d');
        layers.forEach(layer => { const w = layer.w === '100%' ? canvas.width : parseFloat(layer.w) * RES, h = layer.h === '100%' ? canvas.height : parseFloat(layer.h) * RES, x = parseFloat(layer.x) * RES, y = canvas.height - h - (parseFloat(layer.y) * RES); if (window.applyPatternToCtx) window.applyPatternToCtx(ctx, layer.texture, layer.color, x, y, w, h, 2); else { ctx.fillStyle = layer.color; ctx.fillRect(x, y, w, h); } });
        const texture = new THREE.CanvasTexture(canvas); texture.encoding = THREE.sRGBEncoding; texture.wrapS = THREE.ClampToEdgeWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.repeat.set(1, 1); return texture;
    }

    buildScene(walls, roomPaths, stairs = []) {
        while(this.structureGroup.children.length > 0) { const child = this.structureGroup.children[0]; if(child.geometry) child.geometry.dispose(); this.structureGroup.remove(child); }
        let centerX = 0, centerZ = 0, count = 0; const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 }), matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }); 
        
        roomPaths.forEach(path => { const floorShape = new THREE.Shape(); floorShape.moveTo(path[0].x, path[0].y); for(let i=1; i<path.length; i++) floorShape.lineTo(path[i].x, path[i].y); const floorGeo = new THREE.ShapeGeometry(floorShape); floorGeo.rotateX(-Math.PI / 2); const floorMesh = new THREE.Mesh(floorGeo, matFloor); floorMesh.position.y = 1; floorMesh.receiveShadow = true; this.structureGroup.add(floorMesh); });
        
        walls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position(), dx = p2.x - p1.x, dz = p2.y - p1.y, length = Math.hypot(dx, dz), angle = Math.atan2(dz, dx); centerX += p1.x + dx/2; centerZ += p1.y + dz/2; count++;
            const wallShape = new THREE.Shape(); wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, WALL_HEIGHT); wallShape.lineTo(0, WALL_HEIGHT); wallShape.lineTo(0, 0);
            w.attachedWidgets.forEach(widg => { const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2; if (widg.type === 'door') { hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0); } else if (widg.type === 'window') { hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL); } wallShape.holes.push(hole); });
            const halfThick = w.config.thickness / 2, texFront = this.createElevation3DTexture(w.elevationLayers.front, length), texBack = this.createElevation3DTexture(w.elevationLayers.back, length); texBack.wrapS = THREE.RepeatWrapping; texBack.repeat.x = -1;
            const uvGenerator = { generateTopUV: function(geometry, vertices, indexA, indexB, indexC) { return [ new THREE.Vector2(vertices[indexA*3]/length, vertices[indexA*3+1]/WALL_HEIGHT), new THREE.Vector2(vertices[indexB*3]/length, vertices[indexB*3+1]/WALL_HEIGHT), new THREE.Vector2(vertices[indexC*3]/length, vertices[indexC*3+1]/WALL_HEIGHT) ]; }, generateSideWallUV: function() { return [ new THREE.Vector2(0,0), new THREE.Vector2(1,0), new THREE.Vector2(1,1), new THREE.Vector2(0,1) ]; } };
            const extrudeOpts = { depth: halfThick, bevelEnabled: false, UVGenerator: uvGenerator };
            const matFrontMain = new THREE.MeshStandardMaterial({ map: texFront, roughness: 0.9 }), matBackMain = new THREE.MeshStandardMaterial({ map: texBack, roughness: 0.9 });
            const geoFront = new THREE.ExtrudeGeometry(wallShape, extrudeOpts), meshFront = new THREE.Mesh(geoFront, [matFrontMain, matEdgeDark]); meshFront.position.set(p1.x, 0, p1.y); meshFront.rotation.y = -angle; meshFront.castShadow = true; meshFront.receiveShadow = true; this.structureGroup.add(meshFront);
            const geoBack = new THREE.ExtrudeGeometry(wallShape, extrudeOpts); geoBack.translate(0, 0, -halfThick); const meshBack = new THREE.Mesh(geoBack, [matBackMain, matEdgeDark]); meshBack.position.set(p1.x, 0, p1.y); meshBack.rotation.y = -angle; meshBack.castShadow = true; meshBack.receiveShadow = true; this.structureGroup.add(meshBack);
            w.attachedWidgets.forEach(widg => { const wcx = p1.x + dx * widg.t, wcz = p1.y + dz * widg.t; const entityData = { ...widg, x: wcx, z: wcz, angle: angle, thick: w.config.thickness }; const definition = WIDGET_REGISTRY[widg.type]; if (definition && definition.render3D) definition.render3D(this.structureGroup, entityData, this); });
        });

        const anchorMap = new Map(); walls.forEach(w => { [w.startAnchor, w.endAnchor].forEach(a => { const data = anchorMap.get(a) || { thickness: 0, type: w.type }; if (w.config.thickness > data.thickness) { data.thickness = w.config.thickness; if(w.type === 'outer') data.type = 'outer'; } anchorMap.set(a, data); }); });
        anchorMap.forEach((data, anchor) => { const pos = anchor.position(); const jointGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, WALL_HEIGHT, 16); const jointMesh = new THREE.Mesh(jointGeo, new THREE.MeshStandardMaterial({ color: data.type==='outer'?'#f8fafc':'#ffffff', roughness: 0.9 })); jointMesh.position.set(pos.x, WALL_HEIGHT / 2, pos.y); jointMesh.castShadow = true; this.structureGroup.add(jointMesh); const capGeo = new THREE.CylinderGeometry(data.thickness / 2, data.thickness / 2, 1, 16); const capMesh = new THREE.Mesh(capGeo, matEdgeDark); capMesh.position.set(pos.x, WALL_HEIGHT, pos.y); this.structureGroup.add(capMesh); });
        
        stairs.forEach(stair => {
            const matStair = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.6 });
            stair.stepData3D.forEach(data => {
                if (data.type === 'landing_circ') { const landing = new THREE.Mesh(new THREE.CylinderGeometry(data.r, data.r, data.h, 32), matStair); landing.position.set(data.x, data.y + data.h/2, data.z); landing.rotation.y = -data.angle; landing.castShadow = true; landing.receiveShadow = true; this.structureGroup.add(landing);
                } else if (data.type === 'landing_poly') { const shape = new THREE.Shape(); shape.moveTo(data.pts[0].x, data.pts[0].y); shape.lineTo(data.pts[1].x, data.pts[1].y); shape.lineTo(data.pts[2].x, data.pts[2].y); shape.lineTo(data.pts[3].x, data.pts[3].y); const geo = new THREE.ExtrudeGeometry(shape, { depth: data.h, bevelEnabled: false }); geo.rotateX(Math.PI / 2); const landing = new THREE.Mesh(geo, matStair); landing.position.y = data.y + data.h; landing.castShadow = true; landing.receiveShadow = true; this.structureGroup.add(landing);
                } else if (data.type === 'step') { let rX = data.x - Math.cos(data.angle) * (data.d / 2), rZ = data.z - Math.sin(data.angle) * (data.d / 2); const riser = new THREE.Mesh(new THREE.BoxGeometry(1, data.h, data.w), matStair); riser.position.set(rX, data.y + data.h/2, rZ); riser.rotation.y = -data.angle; const tread = new THREE.Mesh(new THREE.BoxGeometry(data.d, 1.5, data.w + 2), matStair); tread.position.set(data.x, data.y + data.h, data.z); tread.rotation.y = -data.angle; riser.castShadow = true; tread.castShadow = true; riser.receiveShadow = true; tread.receiveShadow = true; this.structureGroup.add(riser, tread); }
            });
        });

        if (count > 0) { centerX /= count; centerZ /= count; this.controls.target.set(centerX, 0, centerZ); this.camera.position.set(centerX, 400, centerZ + 500); this.controls.update(); }
    }
}