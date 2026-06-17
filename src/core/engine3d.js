import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { TransformControls } from './engine3d/TransformControls.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from './registry.js';
import { EnvironmentBuilder } from "./engine3d/engine3d.EnvironmentBuilder.js";
import { Stair3DBuilder  } from "./engine3d/engine3d.Stair3DBuilder.js";
import { AssetManager  } from "./engine3d/engine3d.AssetManager.js";
import { DecorManager  } from "./engine3d/engine3d.DecorManager.js";
import { FurnitureManager  } from "./engine3d/engine3d.FurnitureManager.js";
import { InteractionSystem  } from "./engine3d/engine3d.InteractionSystem.js";


export class Preview3D {
    constructor(containerEl) {
        this.container = containerEl;
        this.scene = new THREE.Scene();
        this.structureGroup = new THREE.Group();
        this.staticStructureGroup = new THREE.Group();
        this.scene.add(this.structureGroup);
        this.scene.add(this.staticStructureGroup);
        
        const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth;
        const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight;
        
        this.camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: true });
        this.renderer.setSize(w, h);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace; 
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2 - 0.02; 

        this.interactables = [];
        this.isUpdatingFromUI = false;
        
        this.assets = new AssetManager();
        
        this.helpers = {
            getDynamicMaterial: (matId, category) => {
                let conf;
                if (category === 'door') conf = DOOR_MATERIALS[matId] || DOOR_MATERIALS.wood;
                else if (category === 'window_frame') conf = WINDOW_FRAME_MATERIALS[matId] || WINDOW_FRAME_MATERIALS.alum_powder;
                else if (category === 'window_glass') conf = WINDOW_GLASS_MATERIALS[matId] || WINDOW_GLASS_MATERIALS.clear;
                
                if (!conf) return new THREE.MeshStandardMaterial();
                
                return new THREE.MeshStandardMaterial({
                    color: conf.color,
                    roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                    metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                    transmission: conf.transmission || 0,
                    ior: conf.ior || 1.5,
                    transparent: conf.transparent || false,
                    opacity: conf.transmission ? (1 - conf.transmission) : 1
                });
            }
        };

        this.envBuilder = new EnvironmentBuilder(this);
        this.stairBuilder = new Stair3DBuilder(this.assets, this.interactables);
        this.decorManager = new DecorManager(this);
        this.furnitureManager = new FurnitureManager(this);
        this.interactions = new InteractionSystem(this);

        // Setup transform menu
        this.transformMenu = document.createElement('div');
        this.transformMenu.className = 'transform-menu-3d';
        this.transformMenu.style.display = 'none';
        this.transformMenu.style.transform = 'translate(-50%, -50%)';
        this.transformMenu.style.position = 'absolute';
        this.transformMenu.style.zIndex = '1000';
        
        this.xyPanel = document.createElement('div');
        this.xyPanel.style.display = 'none';
        this.xyPanel.style.position = 'absolute';
        this.xyPanel.style.top = '-90px';
        this.xyPanel.style.left = '50%';
        this.xyPanel.style.transform = 'translateX(-50%)';
        this.xyPanel.style.background = 'rgba(17, 24, 39, 0.95)';
        this.xyPanel.style.padding = '10px 14px';
        this.xyPanel.style.borderRadius = '8px';
        this.xyPanel.style.color = 'white';
        this.xyPanel.style.pointerEvents = 'auto';
        this.xyPanel.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
        this.xyPanel.style.border = '1px solid rgba(255,255,255,0.15)';
        this.xyPanel.style.zIndex = '1000';
        this.xyPanel.style.flexDirection = 'column';
        this.xyPanel.style.gap = '8px';
        this.xyPanel.style.width = 'max-content';

        this.xyPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
                <span style="font-size: 11px; font-weight: bold; color: #9ca3af; letter-spacing: 0.5px;">XYZ PLACEMENT</span>
                <label style="font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer;">
                    <input type="checkbox" id="gizmo-snap" checked style="accent-color: #3b82f6;"> Snap
                </label>
            </div>
            <div style="display: flex; gap: 8px; align-items: center; margin-top: 4px;">
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size:13px; font-weight: bold; color:#fca5a5;">X</span>
                    <input type="number" id="gizmo-x" step="10" style="width: 55px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 4px 6px; font-size: 12px; outline: none;">
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size:13px; font-weight: bold; color:#86efac;">Y</span>
                    <input type="number" id="gizmo-y" step="10" style="width: 55px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 4px 6px; font-size: 12px; outline: none;">
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
                    <span style="font-size:13px; font-weight: bold; color:#93c5fd;">Z</span>
                    <input type="number" id="gizmo-z" step="10" style="width: 55px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 4px 6px; font-size: 12px; outline: none;">
                </div>
            </div>
        `;
        this.xyPanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.transformMenu.appendChild(this.xyPanel);

        this.btnMove = document.createElement('button');
        this.btnMove.className = 'transform-menu-btn';
        this.btnMove.innerHTML = '⬌<br>Move';
        this.btnMove.style.top = '-30px';
        this.btnMove.style.left = '-15px';
        this.btnMove.onclick = () => this.setTransformMode('translate');
        
        this.btnPlace = document.createElement('button');
        this.btnPlace.className = 'transform-menu-btn';
        this.btnPlace.innerHTML = '🎯<br>Place';
        this.btnPlace.style.top = '-30px';
        this.btnPlace.style.left = '90px';
        this.btnPlace.onclick = () => this.setTransformMode('place');

        this.btnScale = document.createElement('button');
        this.btnScale.className = 'transform-menu-btn';
        this.btnScale.innerHTML = '⤢<br>Scale';
        this.btnScale.style.top = '80px';
        this.btnScale.style.left = '38px';
        this.btnScale.onclick = () => this.setTransformMode('scale');

        this.btnRotX = document.createElement('button');
        this.btnRotX.className = 'transform-menu-btn';
        this.btnRotX.innerHTML = '⭮<br>Rot X';
        this.btnRotX.style.top = '25px';
        this.btnRotX.style.left = '-15px';
        this.btnRotX.onclick = () => this.setTransformMode('rotateX');
        
        this.btnRotY = document.createElement('button');
        this.btnRotY.className = 'transform-menu-btn';
        this.btnRotY.innerHTML = '⭮<br>Rot Y';
        this.btnRotY.style.top = '25px';
        this.btnRotY.style.left = '90px';
        this.btnRotY.onclick = () => this.setTransformMode('rotateY');

        this.btnOpening = document.createElement('button');
        this.btnOpening.className = 'transform-menu-btn';
        this.btnOpening.innerHTML = '✂️<br>Opening';
        this.btnOpening.style.top = '-30px';
        this.btnOpening.style.left = '90px';
        this.btnOpening.style.display = 'none';
        this.btnOpening.onclick = () => this.setTransformMode('opening');
        
        this.openingPanel = document.createElement('div');
        this.openingPanel.style.display = 'none';
        this.openingPanel.style.position = 'absolute';
        this.openingPanel.style.top = '-160px';
        this.openingPanel.style.left = '50%';
        this.openingPanel.style.transform = 'translateX(-50%)';
        this.openingPanel.style.background = 'rgba(15, 23, 42, 0.9)';
        this.openingPanel.style.padding = '12px 16px';
        this.openingPanel.style.borderRadius = '12px';
        this.openingPanel.style.color = 'white';
        this.openingPanel.style.pointerEvents = 'auto';
        this.openingPanel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        this.openingPanel.style.border = '1px solid rgba(255,255,255,0.15)';
        this.openingPanel.style.backdropFilter = 'blur(8px)';
        this.openingPanel.style.zIndex = '1000';
        this.openingPanel.style.flexDirection = 'column';
        this.openingPanel.style.gap = '10px';
        this.openingPanel.style.width = '240px';
        this.openingPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px;">OPENING CONTROLS</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px;">
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size:12px; color:#fca5a5; font-weight:600; width: 45px;">Width</span>
                    <input type="range" id="gizmo-opening-w-range" min="10" max="300" step="1" style="flex: 1; accent-color:#fca5a5;">
                    <input type="number" id="gizmo-opening-w" step="0.1" style="width: 45px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px; font-size: 12px; outline: none; text-align: right;">
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size:12px; color:#86efac; font-weight:600; width: 45px;">Height</span>
                    <input type="range" id="gizmo-opening-h-range" min="10" max="300" step="1" style="flex: 1; accent-color:#86efac;">
                    <input type="number" id="gizmo-opening-h" step="0.1" style="width: 45px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px; font-size: 12px; outline: none; text-align: right;">
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size:12px; color:#93c5fd; font-weight:600; width: 45px;">Elev</span>
                    <input type="range" id="gizmo-opening-e-range" min="0" max="300" step="1" style="flex: 1; accent-color:#93c5fd;">
                    <input type="number" id="gizmo-opening-e" step="0.1" style="width: 45px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px; font-size: 12px; outline: none; text-align: right;">
                </div>
            </div>
        `;
        this.openingPanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.transformMenu.appendChild(this.openingPanel);
        this.transformMenu.appendChild(this.btnOpening);
        
        this.btnDone = document.createElement('button');
        this.btnDone.className = 'transform-menu-btn done-btn';
        this.btnDone.innerHTML = '✓<br>Done';
        this.btnDone.style.top = '25px';
        this.btnDone.style.left = '38px';
        this.btnDone.style.background = 'rgba(16, 185, 129, 0.9)';
        this.btnDone.style.borderColor = 'rgba(52, 211, 153, 1)';
        this.btnDone.style.display = 'none';
        this.btnDone.onclick = () => this.setTransformMode('none');

        this.transformMenu.appendChild(this.btnMove);
        this.transformMenu.appendChild(this.btnPlace);
        this.transformMenu.appendChild(this.btnScale);
        this.transformMenu.appendChild(this.btnRotX);
        this.transformMenu.appendChild(this.btnRotY);
        this.transformMenu.appendChild(this.btnDone);
        
        this.container.appendChild(this.transformMenu);

        setTimeout(() => {
            this.inputX = document.getElementById('gizmo-x');
            this.inputY = document.getElementById('gizmo-y');
            this.inputZ = document.getElementById('gizmo-z');
            this.inputSnap = document.getElementById('gizmo-snap');

            if (this.inputSnap) {
                this.inputSnap.addEventListener('change', (e) => {
                    if (this.interactions.transformControls) {
                        this.interactions.transformControls.snapEnabled = e.target.checked;
                    }
                });
            }

            const updatePos = () => {
                if(this.interactions.selectedObject) {
                    const obj = this.interactions.selectedObject;
                    obj.position.x = parseFloat(this.inputX.value) || 0;
                    obj.position.z = parseFloat(this.inputY.value) || 0;
                    
                    const newElevation = parseFloat(this.inputZ.value) || 0;
                    if (obj.userData.entity) {
                        obj.userData.entity.elevation = newElevation;
                    }
                    // Apply raw offset for visual update before bounding box clamps it
                    obj.position.y = newElevation;
                    
                    obj.updateMatrixWorld(true);
                    if(this.interactions.transformControls) this.interactions.transformControls.update();
                    this.syncToUI();
                }
            };

            if (this.inputX) {
                this.inputX.addEventListener('input', updatePos);
                this.inputX.addEventListener('keydown', (e) => { e.stopPropagation(); });
            }
            if (this.inputY) {
                this.inputY.addEventListener('input', updatePos);
                this.inputY.addEventListener('keydown', (e) => { e.stopPropagation(); });
            }
            if (this.inputZ) {
                this.inputZ.addEventListener('input', updatePos);
                this.inputZ.addEventListener('keydown', (e) => { e.stopPropagation(); });
            }
            
            const opW = document.getElementById('gizmo-opening-w');
            const opWR = document.getElementById('gizmo-opening-w-range');
            const opH = document.getElementById('gizmo-opening-h');
            const opHR = document.getElementById('gizmo-opening-h-range');
            const opE = document.getElementById('gizmo-opening-e');
            const opER = document.getElementById('gizmo-opening-e-range');
            const updateOpeningPos = (prop, val) => {
                if (this.interactions.selectedObject && this.interactions.selectedObject.userData.entity) {
                    const entity = this.interactions.selectedObject.userData.entity;
                    if (prop === 'width') entity.width = val;
                    if (prop === 'height') entity.height = val;
                    if (prop === 'elevation') entity.elevation = val;
                    
                    if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                    if (this.interactions.openingGizmo) this.interactions.openingGizmo.updateHandles();
                    this.updateOpeningPanel(entity);
                    window.dispatchEvent(new CustomEvent('opening-gizmo-change', { detail: { entity }}));
                }
            };
            if (opW) { opW.addEventListener('input', e => updateOpeningPos('width', parseFloat(e.target.value))); opWR.addEventListener('input', e => updateOpeningPos('width', parseFloat(e.target.value))); }
            if (opH) { opH.addEventListener('input', e => updateOpeningPos('height', parseFloat(e.target.value))); opHR.addEventListener('input', e => updateOpeningPos('height', parseFloat(e.target.value))); }
            if (opE) { opE.addEventListener('input', e => updateOpeningPos('elevation', parseFloat(e.target.value))); opER.addEventListener('input', e => updateOpeningPos('elevation', parseFloat(e.target.value))); }
        }, 100);

        this.interactions.transformControls.addEventListener('change', () => {
            if (this.currentTransformMode === 'place' && this.inputX && this.interactions.selectedObject) {
                this.inputX.value = this.interactions.selectedObject.position.x.toFixed(1);
                this.inputY.value = this.interactions.selectedObject.position.z.toFixed(1);
                if (this.inputZ && this.interactions.selectedObject.userData.entity) {
                    this.inputZ.value = (this.interactions.selectedObject.userData.entity.elevation || 0).toFixed(1);
                }
            }
        });

        this.envBuilder.setupBaseEnvironment();
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer); 
        pmremGenerator.compileEquirectangularShader(); 
        this.scene.environment = pmremGenerator.fromScene(new THREE.Scene()).texture;

        window.addEventListener('resize', () => this.resize()); 
        this.animate();
    }

    updateOpeningPanel(entity) {
        if (!entity) return;
        const opW = document.getElementById('gizmo-opening-w');
        const opWR = document.getElementById('gizmo-opening-w-range');
        const opH = document.getElementById('gizmo-opening-h');
        const opHR = document.getElementById('gizmo-opening-h-range');
        const opE = document.getElementById('gizmo-opening-e');
        const opER = document.getElementById('gizmo-opening-e-range');
        const w = entity.width || 100;
        let h = entity.height; if (h === undefined) h = (entity.type === 'door') ? 80 : ((entity.type === 'window') ? 45 : 200);
        let e = entity.elevation; if (e === undefined) e = (entity.type === 'window') ? 35 : 0;
        if (opW && document.activeElement !== opW) opW.value = w.toFixed(1); if (opWR && document.activeElement !== opWR) opWR.value = w.toFixed(1);
        if (opH && document.activeElement !== opH) opH.value = h.toFixed(1); if (opHR && document.activeElement !== opHR) opHR.value = h.toFixed(1);
        if (opE && document.activeElement !== opE) opE.value = e.toFixed(1); if (opER && document.activeElement !== opER) opER.value = e.toFixed(1);
    }

    resize() {
        if (this.container.style.display !== 'none') { 
            const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth; 
            const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight; 
            this.camera.aspect = w / h; 
            this.camera.updateProjectionMatrix(); 
            this.renderer.setSize(w, h); 
        }
    }

    animate() { 
        requestAnimationFrame(() => this.animate()); 
        this.controls.update(); 
        this.renderer.render(this.scene, this.camera); 
        this.updateTransformMenu();
    }

    showTransformMenu(visible) {
        if (this.isRebuildingScene) return;
        if (this.transformMenu) {
            if (this.menuVisible === visible) return;
            this.menuVisible = visible;
            if (!visible) {
                this.transformMenu.style.display = 'none';
                this.setTransformMode('none', true);
            } else {
                this.transformMenu.style.display = 'block';
                this.setTransformMode('none', true); // default hidden until explicitly selected
            }
        }
    }

    setTransformMode(mode, force = false) {
        if (!this.interactions.transformControls) return;
        const tc = this.interactions.transformControls;
        const selectedObj = this.interactions.selectedObject;
        
        if (!force && this.currentTransformMode === mode && mode !== 'none') {
            mode = 'none';
        }
        this.currentTransformMode = mode;

        this.btnMove.classList.remove('active');
        if (this.btnPlace) this.btnPlace.classList.remove('active');
        if (this.btnScale) this.btnScale.classList.remove('active');
        this.btnRotX.classList.remove('active');
        this.btnRotY.classList.remove('active');
        if (this.btnOpening) this.btnOpening.classList.remove('active');

        if (this.interactions.openingGizmo) {
            this.interactions.openingGizmo.detach();
        }

        const isOpening = selectedObj && (selectedObj.userData.isWidget || selectedObj.userData.isPattern || (selectedObj.userData.entity && selectedObj.userData.entity.type && ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(selectedObj.userData.entity.type)));

        if (mode === 'none') {
            tc.visible = false;
            tc.enabled = false;
            tc.showX = false; tc.showY = false; tc.showZ = false;
            
            this.btnMove.style.display = isOpening ? 'none' : 'flex';
            if (this.btnPlace) this.btnPlace.style.display = isOpening ? 'none' : 'flex';
            if (this.btnScale) this.btnScale.style.display = isOpening ? 'none' : 'flex';
            this.btnRotX.style.display = isOpening ? 'none' : 'flex';
            this.btnRotY.style.display = isOpening ? 'none' : 'flex';
            if (this.btnOpening) this.btnOpening.style.display = isOpening ? 'flex' : 'none';
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.btnDone) this.btnDone.style.display = 'none';
            
            // Restore selection highlight when returning to normal view
            if (selectedObj) this.interactions.setHighlight(selectedObj, true);
            
            return;
        }

        tc.visible = true;
        tc.enabled = true;
        
        // Remove selection highlight during active transform for a cleaner workspace
        if (selectedObj) this.interactions.setHighlight(selectedObj, false);

        this.btnMove.style.display = 'none';
        if (this.btnPlace) this.btnPlace.style.display = 'none';
        if (this.btnScale) this.btnScale.style.display = 'none';
        this.btnRotX.style.display = 'none';
        this.btnRotY.style.display = 'none';
        if (this.btnOpening) this.btnOpening.style.display = 'none';
        if (this.btnDone) this.btnDone.style.display = 'flex';

        // Force a UI refresh for the TransformControls by detaching before mode switch
        if (selectedObj) tc.detach();

        if (mode === 'opening') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnOpening) this.btnOpening.classList.add('active');
            if (this.openingPanel) this.openingPanel.style.display = 'flex';
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.interactions.openingGizmo && selectedObj) {
                this.interactions.openingGizmo.attach(selectedObj);
                this.updateOpeningPanel(selectedObj.userData.entity);
            }
            return;
        }

        if (mode === 'translate') {
            tc.mode = 'translate';
            tc.showTranslate = true; tc.showRotate = false; tc.showScale = false;
            tc.showX = true; tc.showY = false; tc.showZ = true; // Drag only on floor plane
            this.btnMove.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
        } else if (mode === 'place') {
            tc.mode = 'place';
            tc.showTranslate = true; tc.showRotate = false; tc.showScale = false;
            tc.showX = true; tc.showY = false; tc.showZ = true;
            if (this.btnPlace) this.btnPlace.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'flex';
            if (this.inputX && selectedObj) {
                this.inputX.value = selectedObj.position.x.toFixed(1);
                this.inputY.value = selectedObj.position.z.toFixed(1);
                if (this.inputZ && selectedObj.userData.entity) {
                    this.inputZ.value = (selectedObj.userData.entity.elevation || 0).toFixed(1);
                }
            }
        } else if (mode === 'scale') {
            tc.mode = 'scale';
            tc.showTranslate = false; tc.showRotate = false; tc.showScale = true;
            tc.showX = true; tc.showY = true; tc.showZ = true;
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.btnScale) this.btnScale.classList.add('active');
        } else if (mode === 'rotateX') {
            tc.mode = 'rotate';
            tc.showTranslate = false; tc.showRotate = true; tc.showScale = false;
            tc.showX = false; tc.showY = true; tc.showZ = false; // Green circle (yaw)
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            this.btnRotX.classList.add('active');
        } else if (mode === 'rotateY') {
            tc.mode = 'rotate';
            tc.showTranslate = false; tc.showRotate = true; tc.showScale = false;
            tc.showX = true; tc.showY = false; tc.showZ = false; // Red circle (pitch)
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            this.btnRotY.classList.add('active');
        }

        // Re-attach to cleanly render only the requested handles
        if (selectedObj) tc.attach(selectedObj);
    }

    updateTransformMenu() {
        if (!this.transformMenu || !this.interactions.selectedObject || !this.menuVisible) {
            if (this.transformMenu) this.transformMenu.style.display = 'none';
            return;
        }
        
        const pos = new THREE.Vector3();
        this.interactions.selectedObject.getWorldPosition(pos);
        pos.project(this.camera);
        
        if (pos.z > 1) {
            this.transformMenu.style.display = 'none';
        } else {
            this.transformMenu.style.display = 'block';
            const w = this.container.clientWidth > 0 ? this.container.clientWidth : window.innerWidth;
            const h = this.container.clientHeight > 0 ? this.container.clientHeight : window.innerHeight;
            const x = (pos.x * .5 + .5) * w;
            const y = (pos.y * -.5 + .5) * h;
            this.transformMenu.style.left = `${x}px`;
            this.transformMenu.style.top = `${y}px`;
        }
    }

    setEnvironment(skyKey, groundKey) { this.envBuilder.setEnvironment(skyKey, groundKey); }
    setInteractionMode(mode) { this.interactions.setMode(mode); }
    cancelRelocation() { this.interactions.cancelRelocation(); }
    selectObject(obj) { this.interactions.selectObject(obj); }
    deselectObject() { this.interactions.deselect(); }
    
    addWallPattern(w, id, s) { return this.decorManager.add(w, id, s); }
    updateWallDecorLive(e) { this.decorManager.updateLive(e); }
    
    updateFurnitureLive(e) { this.furnitureManager.updateLive(e); }
    
    updatePatternLive(widg) {
        if (!widg || !widg.patternMesh3D) return;
        const mat = widg.patternMat3D || (widg.patternMesh3D.isGroup ? widg.patternMesh3D.children[0].material : widg.patternMesh3D.material);

        if (widg.patternLayer && typeof widg.patternLayer === 'object') {
            const layer = widg.patternLayer;
            if (layer.texture && layer.texture !== 'none' && layer.texture !== '') {
                this.assets.getTexture({ id: 'pat_tex_' + (layer.texture.replace(/[^a-z0-9]/gi, '')), texture: layer.texture }).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const tileSize = layer.tileSize || 40;
                    texClone.repeat.set(1 / tileSize, 1 / tileSize);
                    if (layer.rotation) texClone.rotation = (layer.rotation * Math.PI) / 180;
                    if (layer.offsetX || layer.offsetY) texClone.offset.set(layer.offsetX || 0, layer.offsetY || 0);
                    mat.map = texClone;
                    mat.color.setHex(layer.color ? parseInt(layer.color.replace('#', '0x')) : 0xffffff);
                    mat.needsUpdate = true;
                }).catch(() => {
                    mat.map = null;
                    if (layer.color) mat.color.setHex(parseInt(layer.color.replace('#', '0x')));
                    mat.needsUpdate = true;
                });
            } else {
                mat.map = null;
                mat.color.setHex(layer.color ? parseInt(layer.color.replace('#', '0x')) : 0xd1d5db);
                mat.needsUpdate = true;
            }
            return;
        }
        
        const configId = typeof widg.patternLayer === 'string' && widg.patternLayer ? widg.patternLayer : widg.decorConfigId;
        if (configId && WALL_DECOR_REGISTRY[configId]) {
            const config = WALL_DECOR_REGISTRY[configId];
            this.assets.getTexture(config).then(tex => {
                const texClone = tex.clone();
                texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                const tileSize = config.defaultTileSize || 40;
                texClone.repeat.set(1 / tileSize, 1 / tileSize);
                mat.map = texClone;
                mat.color.setHex(0xffffff);
                mat.needsUpdate = true;
            });
        } else {
            mat.map = null;
            mat.color.setHex(0xf5f5f0);
            mat.needsUpdate = true;
        }
    }

    updateShapeLive(entity) {
        if (!entity || !entity.mesh3D || this.isUpdatingFrom3D) return;
        this.isUpdatingFromUI = true;
        const obj = entity.mesh3D;
        const h = entity.params.height3D || 100;
        
        if (entity.type === 'shape_rect') {
            obj.position.set(entity.group.x(), h / 2, entity.group.y());
            obj.rotation.y = -(entity.rotation || 0) * Math.PI / 180;
            obj.geometry.dispose();
            obj.geometry = new THREE.BoxGeometry(entity.params.width, h, entity.params.height);
            obj.geometry.translate(0, h / 2, 0);
        } else if (entity.type === 'shape_circle') {
            obj.position.set(entity.group.x(), 0, entity.group.y());
            obj.geometry.dispose();
            obj.geometry = new THREE.CylinderGeometry(entity.params.radius, entity.params.radius, h, 32);
            obj.geometry.translate(0, h / 2, 0);
        } else if (entity.type === 'shape_triangle' || entity.type === 'shape_polygon') {
            const shape2d = new THREE.Shape();
            if (entity.params.points && entity.params.points.length >= 3) {
                const pts = entity.params.points;
                shape2d.moveTo(pts[0].x, pts[0].y);
                for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                shape2d.lineTo(pts[0].x, pts[0].y);
                obj.geometry.dispose();
                obj.geometry = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                obj.geometry.rotateX(Math.PI / 2);
                obj.geometry.translate(0, h, 0);
            }
        }
        
        obj.position.set(entity.group.x(), 0, entity.group.y());
        obj.rotation.y = -(entity.rotation || 0) * Math.PI / 180;

        const color = entity.params.fill ? parseInt(entity.params.fill.replace('#', '0x')) : 0x38bdf8;
        
        const matBase = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
        let matSides = matBase.clone();
        let matTop = matBase.clone();
        let matBottom = matBase.clone();
        let matLeft = matBase.clone();
        let matRight = matBase.clone();
        let matFront = matBase.clone();
        let matBack = matBase.clone();

        const applyTex = (mat, texKey) => {
            if (!texKey) return;
            const config = WALL_DECOR_REGISTRY[texKey];
            if (config) {
                this.assets.getTexture(config).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const tileSize = config.defaultTileSize || 40;
                    const maxDim = Math.max(entity.params.width || entity.params.radius || 100, h);
                    texClone.repeat.set(maxDim / tileSize, maxDim / tileSize);
                    mat.map = texClone;
                    mat.color.setHex(0xffffff);
                    mat.needsUpdate = true;
                });
            }
        };

        applyTex(matTop, entity.params.textureTop || entity.params.texture);
        applyTex(matBottom, entity.params.textureBottom || entity.params.texture);
        applyTex(matSides, entity.params.textureSides || entity.params.texture);
        applyTex(matLeft, entity.params.textureLeft || entity.params.textureSides || entity.params.texture);
        applyTex(matRight, entity.params.textureRight || entity.params.textureSides || entity.params.texture);
        applyTex(matFront, entity.params.textureFront || entity.params.textureSides || entity.params.texture);
        applyTex(matBack, entity.params.textureBack || entity.params.textureSides || entity.params.texture);

        if (entity.type === 'shape_rect') {
            obj.material = [matRight, matLeft, matTop, matBottom, matFront, matBack];
        } else if (entity.type === 'shape_circle') {
            obj.material = [matSides, matTop, matBottom];
        } else {
            obj.material = [matTop, matSides];
        }
        
        const hitbox = obj.children.find(c => c.userData.isHitbox);
        if (hitbox) {
            hitbox.geometry.dispose();
            hitbox.geometry = obj.geometry;
        }
        this.isUpdatingFromUI = false;
    }

    syncToUI() {
        if (!this.isUpdatingFromUI && this.interactions.selectedObject && (this.interactions.selectedObject.userData.isFurniture || this.interactions.selectedObject.userData.isShape)) {
            const obj3D = this.interactions.selectedObject;
            const ent2D = obj3D.userData.entity;
            if (ent2D && ent2D.group) { 
                ent2D.group.x(obj3D.position.x); 
                ent2D.group.y(obj3D.position.z); 
                ent2D.rotation = -obj3D.rotation.y * (180 / Math.PI);
                ent2D.update(); 
            }
        }
        if (this.onEntityTransform) this.onEntityTransform();
    }

    deepDispose(obj) {
        if (obj.userData && obj.userData.keepAlive) return;
        
        if (obj.geometry && !obj.geometry.userData?.keepAlive) obj.geometry.dispose();
        if (obj.material) {
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => { if (!m.userData?.keepAlive) m.dispose(); });
            } else {
                if (!obj.material.userData?.keepAlive) obj.material.dispose();
            }
        }
        if (obj.children) [...obj.children].forEach(c => this.deepDispose(c));
    }

    buildScene(walls, rooms, stairs = [], furnitureList = [], roofs = [], shapes = [], levelsConfigArray = [], activeIndex = 0, viewMode3D = 'full-edit', preserveCamera = false) {
        this.deselectObject();
        this.interactables.length = 0;
        this.viewMode3D = viewMode3D;
        
        while(this.structureGroup.children.length > 0) { 
            const c = this.structureGroup.children[0]; 
            this.deepDispose(c); 
            this.structureGroup.remove(c); 
        }
        while(this.staticStructureGroup.children.length > 0) { 
            const c = this.staticStructureGroup.children[0]; 
            this.deepDispose(c); 
            this.staticStructureGroup.remove(c); 
        }

        const targetY = activeIndex * WALL_HEIGHT;
        this.structureGroup.position.y = targetY;

        const activeLevelConfig = levelsConfigArray[activeIndex];
        const isActiveVisible = activeLevelConfig ? activeLevelConfig.isVisible : true;

        if (isActiveVisible) {
            this.envBuilder.buildActiveFloor(walls, rooms, shapes, stairs);
            this.stairBuilder.build(stairs, this.structureGroup, activeIndex);
            if (furnitureList) furnitureList.forEach(furn => this.furnitureManager.load(furn));

            if (roofs && roofs.length > 0) this.envBuilder.buildRoofs(roofs, activeIndex, walls, this.structureGroup);
            if (shapes && shapes.length > 0) this.envBuilder.buildShapes(shapes);
        }

        if (levelsConfigArray && levelsConfigArray.length > 0) {
            this.envBuilder.buildStaticFloors(levelsConfigArray, activeIndex, viewMode3D, stairs);
        }

        if (this.previousTargetY === undefined) this.previousTargetY = targetY;
        const diff = targetY - this.previousTargetY;

        if (preserveCamera) {
            if (diff !== 0 && viewMode3D !== 'full-edit') {
                this.controls.target.y += diff;
                this.camera.position.y += diff;
                this.controls.update();
            }
        } else {
            let centerX = 0, centerZ = 0;
            if (walls.length > 0) {
                walls.forEach(w => { const p = w.startAnchor ? w.startAnchor.position() : w; centerX += p.x || w.startX; centerZ += p.y || w.startY; });
                centerX /= walls.length; centerZ /= walls.length;
            }
            this.controls.target.set(centerX, targetY, centerZ); 
            this.camera.position.set(centerX, targetY + 600, centerZ + 800); 
            this.controls.update(); 
        }
        this.previousTargetY = targetY;

        if (this.isXRayMode) {
            this.setXRayMode(true);
        }
    }
    
    setXRayMode(enabled) {
        this.isXRayMode = enabled;
        const applyXRay = (group) => {
            group.traverse((child) => {
                if (child.isMesh && child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach(mat => {
                        if (mat.name === 'highlightMaterial' || mat.name === 'cutHighlightMaterial' || child.userData.isHighlight) return;
                        
                        if (mat._originalOpacity === undefined) {
                            mat._originalOpacity = mat.opacity;
                            mat._originalTransparent = mat.transparent;
                            mat._originalDepthWrite = mat.depthWrite;
                        }

                        if (enabled) {
                            mat.transparent = true;
                            mat.opacity = 0.3;
                            mat.depthWrite = false;
                        } else {
                            mat.opacity = mat._originalOpacity !== undefined ? mat._originalOpacity : 1;
                            mat.transparent = mat._originalTransparent !== undefined ? mat._originalTransparent : false;
                            mat.depthWrite = mat._originalDepthWrite !== undefined ? mat._originalDepthWrite : true;
                        }
                        mat.needsUpdate = true;
                    });
                }
            });
        };
        applyXRay(this.structureGroup);
        applyXRay(this.staticStructureGroup);
    }

    get selectedObject() { return this.interactions.selectedObject; }
}