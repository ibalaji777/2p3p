import * as THREE from 'three';
import { DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY } from '../registry.js';

export class GizmoManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.container = ctx.container;
        this.menuVisible = false;
    }

    init() {
        this.transformMenu = document.createElement('div');
        this.transformMenu.className = 'transform-menu-3d';
        this.transformMenu.style.display = 'none';
        this.transformMenu.style.transform = 'translate(-50%, -50%)';
        this.transformMenu.style.position = 'absolute';
        this.transformMenu.style.zIndex = '1000';
        
        this.xyPanel = document.createElement('div');
        this.xyPanel.style.display = 'none';
        this.xyPanel.style.position = 'absolute';
        this.xyPanel.style.bottom = '100px';
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
        this.xyPanel.setAttribute('draggable', 'true');

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
        this.container.appendChild(this.xyPanel);

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

        this.btnSpin = document.createElement('button');
        this.btnSpin.className = 'transform-menu-btn';
        this.btnSpin.innerHTML = '⭮<br>Spin';
        this.btnSpin.style.top = '25px';
        this.btnSpin.style.left = '-15px';
        this.btnSpin.onclick = () => this.setTransformMode('rotateY'); // Spin is Y-axis (Yaw)
        
        this.btnTilt = document.createElement('button');
        this.btnTilt.className = 'transform-menu-btn';
        this.btnTilt.innerHTML = '⭮<br>Tilt';
        this.btnTilt.style.top = '25px';
        this.btnTilt.style.left = '90px';
        this.btnTilt.onclick = () => this.setTransformMode('rotateX'); // Tilt is X-axis (Pitch)

        this.btnOpening = document.createElement('button');
        this.btnOpening.className = 'transform-menu-btn';
        this.btnOpening.innerHTML = '✂️<br>Opening';
        this.btnOpening.style.top = '-30px';
        this.btnOpening.style.left = '90px';
        this.btnOpening.style.display = 'none';
        this.btnOpening.onclick = () => this.setTransformMode('opening');
        
        this.btnMaterial = document.createElement('button');
        this.btnMaterial.className = 'transform-menu-btn';
        this.btnMaterial.innerHTML = '🎨<br>Material';
        this.btnMaterial.style.top = '-85px';
        this.btnMaterial.style.left = '38px';
        this.btnMaterial.style.display = 'none';
        this.btnMaterial.onclick = () => {
            if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                this.ctx.interactions.selectedObject.userData.entity.params = this.ctx.interactions.selectedObject.userData.entity.params || {};
                this.ctx.interactions.selectedObject.userData.entity.params.isEditingMaterials = true;
                this.setTransformMode('material');
            }
        };

        this.btnCorner = document.createElement('button');
        this.btnCorner.className = 'transform-menu-btn';
        this.btnCorner.innerHTML = '✂️<br>Corner';
        this.btnCorner.style.top = '80px';
        this.btnCorner.style.left = '90px';
        this.btnCorner.style.display = 'none';
        this.btnCorner.onclick = () => this.setTransformMode('corner');
        
        this.openingPanel = document.createElement('div');
        this.openingPanel.style.display = 'none';
        this.openingPanel.style.position = 'absolute';
        this.openingPanel.style.bottom = '100px';
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
        this.openingPanel.setAttribute('draggable', 'true');
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
                <div style="display: flex; gap: 8px; margin-top: 4px;" id="gizmo-opening-flips">
                    <button id="gizmo-opening-flip-inout" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s;">Flip In/Out</button>
                    <button id="gizmo-opening-flip-lr" style="flex: 1; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; transition: all 0.2s;">Flip L/R</button>
                </div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;" id="gizmo-opening-type-container">
                    <span style="font-size:12px; color:#e2e8f0; font-weight:600; width: 45px;">Type</span>
                    <select id="gizmo-opening-type" style="flex: 1; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; padding: 4px; font-size: 11px; border-radius: 4px; outline: none;"></select>
                </div>
            </div>
        `;
        this.openingPanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.container.appendChild(this.openingPanel);
        this.transformMenu.appendChild(this.btnOpening);
        
        this.materialPanel = document.createElement('div');
        this.materialPanel.style.display = 'none';
        this.materialPanel.style.position = 'absolute';
        this.materialPanel.style.bottom = '100px';
        this.materialPanel.style.left = '50%';
        this.materialPanel.style.transform = 'translateX(-50%)';
        this.materialPanel.style.background = 'rgba(15, 23, 42, 0.9)';
        this.materialPanel.style.padding = '12px 16px';
        this.materialPanel.style.borderRadius = '12px';
        this.materialPanel.style.color = 'white';
        this.materialPanel.style.pointerEvents = 'auto';
        this.materialPanel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        this.materialPanel.style.border = '1px solid rgba(255,255,255,0.15)';
        this.materialPanel.style.backdropFilter = 'blur(8px)';
        this.materialPanel.style.zIndex = '1000';
        this.materialPanel.style.flexDirection = 'column';
        this.materialPanel.style.gap = '10px';
        this.materialPanel.style.width = '280px';
        this.materialPanel.setAttribute('draggable', 'true');
        
        let decorThumbnails = `
            <div class="mat-thumb" data-mat="" style="width: 50px; height: 50px; border-radius: 6px; cursor: pointer; border: 2px solid transparent; background: #e2e8f0; display: flex; align-items: center; justify-content: center; font-size: 10px; color: #64748b; text-align: center;">Clear</div>
        `;
        for (const [key, val] of Object.entries(WALL_DECOR_REGISTRY)) {
            const thumbUrl = val.thumbnail || val.texture;
            decorThumbnails += `
                <div class="mat-thumb" data-mat="${key}" title="${val.name}" style="width: 50px; height: 50px; border-radius: 6px; cursor: pointer; border: 2px solid transparent; background-image: url('${thumbUrl}'); background-size: cover; background-position: center;"></div>
            `;
        }
        
        this.materialPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px;">MATERIAL LIBRARY</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
                <div style="font-size: 13px; color: white; margin-bottom: -4px;">Applying material to: <span id="gizmo-material-face-name" style="color: #fca5a5; font-weight: bold; text-transform: capitalize;"></span></div>
                <div style="font-size: 11px; color: #cbd5e1; margin-bottom: -4px;">Selected Material: <span id="gizmo-material-name" style="font-weight: bold; color: white;"></span></div>
                <div id="gizmo-material-grid" style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 150px; overflow-y: auto; padding-right: 4px;">
                    ${decorThumbnails}
                </div>
            </div>
        `;
        this.materialPanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.container.appendChild(this.materialPanel);

        this.cornerPanel = document.createElement('div');
        this.cornerPanel.style.display = 'none';
        this.cornerPanel.style.position = 'absolute';
        this.cornerPanel.style.bottom = '100px';
        this.cornerPanel.style.left = '50%';
        this.cornerPanel.style.transform = 'translateX(-50%)';
        this.cornerPanel.style.background = 'rgba(15, 23, 42, 0.9)';
        this.cornerPanel.style.padding = '12px 16px';
        this.cornerPanel.style.borderRadius = '12px';
        this.cornerPanel.style.color = 'white';
        this.cornerPanel.style.pointerEvents = 'auto';
        this.cornerPanel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        this.cornerPanel.style.border = '1px solid rgba(255,255,255,0.15)';
        this.cornerPanel.style.backdropFilter = 'blur(8px)';
        this.cornerPanel.style.zIndex = '1000';
        this.cornerPanel.style.flexDirection = 'column';
        this.cornerPanel.style.gap = '10px';
        this.cornerPanel.style.width = '240px';
        this.cornerPanel.setAttribute('draggable', 'true');
        this.cornerPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px;">CORNER RADIUS</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 4px;">
                <div style="font-size: 11px; color: #cbd5e1; margin-bottom: -4px;">Selected Corner: <span id="gizmo-corner-index" style="font-weight: bold; color: white;">None</span></div>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-size:12px; color:#fca5a5; font-weight:600; width: 45px;">Radius</span>
                    <input type="range" id="gizmo-corner-r-range" min="0" max="100" step="1" style="flex: 1; accent-color:#fca5a5;">
                    <input type="number" id="gizmo-corner-r" step="1" style="width: 45px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px; font-size: 12px; outline: none; text-align: right;">
                </div>
            </div>
        `;
        this.cornerPanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.container.appendChild(this.cornerPanel);

        this.btnDone = document.createElement('button');
        this.btnDone.className = 'done-btn';
        this.btnDone.innerHTML = '✓ Done';
        this.btnDone.style.position = 'absolute';
        this.btnDone.style.bottom = '40px';
        this.btnDone.style.left = '50%';
        this.btnDone.style.transform = 'translateX(-50%)';
        this.btnDone.style.background = 'rgba(16, 185, 129, 0.95)';
        this.btnDone.style.border = '2px solid rgba(52, 211, 153, 1)';
        this.btnDone.style.color = 'white';
        this.btnDone.style.padding = '10px 30px';
        this.btnDone.style.borderRadius = '30px';
        this.btnDone.style.fontWeight = 'bold';
        this.btnDone.style.fontSize = '15px';
        this.btnDone.style.boxShadow = '0 4px 15px rgba(0,0,0,0.4)';
        this.btnDone.style.cursor = 'pointer';
        this.btnDone.style.zIndex = '1000';
        this.btnDone.style.display = 'none';
        this.btnDone.style.alignItems = 'center';
        this.btnDone.style.justifyContent = 'center';
        this.btnDone.onclick = () => this.setTransformMode('none');

        this.transformMenu.appendChild(this.btnMove);
        this.transformMenu.appendChild(this.btnPlace);
        this.transformMenu.appendChild(this.btnScale);
        this.transformMenu.appendChild(this.btnSpin);
        this.transformMenu.appendChild(this.btnTilt);
        this.transformMenu.appendChild(this.btnMaterial);
        this.transformMenu.appendChild(this.btnCorner);
        
        this.container.appendChild(this.transformMenu);
        this.transformMenu.addEventListener('pointerdown', e => e.stopPropagation());
        this.container.appendChild(this.btnDone);

        this._makePanelDraggable(this.xyPanel);
        this._makePanelDraggable(this.openingPanel);
        this._makePanelDraggable(this.materialPanel);
        this._makePanelDraggable(this.cornerPanel);

        setTimeout(() => {
            this.inputX = document.getElementById('gizmo-x');
            this.inputY = document.getElementById('gizmo-y');
            this.inputZ = document.getElementById('gizmo-z');
            this.inputSnap = document.getElementById('gizmo-snap');

            if (this.inputSnap) {
                this.inputSnap.addEventListener('change', (e) => {
                    if (this.ctx.interactions.transformControls) {
                        this.ctx.interactions.transformControls.snapEnabled = e.target.checked;
                    }
                });
            }

            const updatePos = () => {
                if(this.ctx.interactions.selectedObject) {
                    const obj = this.ctx.interactions.selectedObject;
                    obj.position.x = parseFloat(this.inputX.value) || 0;
                    obj.position.z = parseFloat(this.inputY.value) || 0;
                    
                    const newElevation = parseFloat(this.inputZ.value) || 0;
                    if (obj.userData.entity) {
                        obj.userData.entity.elevation = newElevation;
                    }
                    obj.position.y = newElevation;
                    
                    obj.updateMatrixWorld(true);
                    if(this.ctx.interactions.transformControls) this.ctx.interactions.transformControls.update();
                    this.ctx.syncToUI();
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
                if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                    const entity = this.ctx.interactions.selectedObject.userData.entity;
                    if (prop === 'width') entity.width = val;
                    if (prop === 'height') entity.height = val;
                    if (prop === 'elevation') entity.elevation = val;
                    
                    if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                    if (this.ctx.interactions.openingGizmo) this.ctx.interactions.openingGizmo.updateHandles();
                    this.updateOpeningPanel(entity);
                    window.dispatchEvent(new CustomEvent('opening-gizmo-change', { detail: { entity }}));
                }
            };
            if (opW) { opW.addEventListener('input', e => updateOpeningPos('width', parseFloat(e.target.value))); opWR.addEventListener('input', e => updateOpeningPos('width', parseFloat(e.target.value))); }
            if (opH) { opH.addEventListener('input', e => updateOpeningPos('height', parseFloat(e.target.value))); opHR.addEventListener('input', e => updateOpeningPos('height', parseFloat(e.target.value))); }
            if (opE) { opE.addEventListener('input', e => updateOpeningPos('elevation', parseFloat(e.target.value))); opER.addEventListener('input', e => updateOpeningPos('elevation', parseFloat(e.target.value))); }
            
            const flipInOutBtn = document.getElementById('gizmo-opening-flip-inout');
            const flipLRBtn = document.getElementById('gizmo-opening-flip-lr');
            const typeSelect = document.getElementById('gizmo-opening-type');

            if (flipInOutBtn) {
                flipInOutBtn.addEventListener('click', () => {
                    if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                        const entity = this.ctx.interactions.selectedObject.userData.entity;
                        entity.facing = (entity.facing === 1) ? -1 : 1;
                        if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                        if (this.ctx.interactions.openingGizmo) this.ctx.interactions.openingGizmo.updateHandles();
                        window.dispatchEvent(new CustomEvent('opening-gizmo-change', { detail: { entity }}));
                    }
                });
            }
            if (flipLRBtn) {
                flipLRBtn.addEventListener('click', () => {
                    if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                        const entity = this.ctx.interactions.selectedObject.userData.entity;
                        entity.side = (entity.side === 1) ? -1 : 1;
                        if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                        if (this.ctx.interactions.openingGizmo) this.ctx.interactions.openingGizmo.updateHandles();
                        window.dispatchEvent(new CustomEvent('opening-gizmo-change', { detail: { entity }}));
                    }
                });
            }
            if (typeSelect) {
                typeSelect.addEventListener('change', (e) => {
                    if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                        const entity = this.ctx.interactions.selectedObject.userData.entity;
                        if (entity.type === 'door') entity.doorType = e.target.value;
                        else if (entity.type === 'window') entity.windowType = e.target.value;
                        if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                        if (this.ctx.interactions.openingGizmo) this.ctx.interactions.openingGizmo.updateHandles();
                        window.dispatchEvent(new CustomEvent('opening-gizmo-change', { detail: { entity }}));
                    }
                });
            }

            this.matNameDisplay = document.getElementById('gizmo-material-name');
            this.matFaceNameDisplay = document.getElementById('gizmo-material-face-name');
            const matThumbs = document.querySelectorAll('.mat-thumb');

            const highlightSelectedThumb = (texKey) => {
                matThumbs.forEach(t => t.style.borderColor = 'transparent');
                if (texKey !== undefined) {
                    const activeThumb = Array.from(matThumbs).find(t => t.getAttribute('data-mat') === (texKey || ''));
                    if (activeThumb) activeThumb.style.borderColor = '#3b82f6';
                    if (this.matNameDisplay) {
                        const config = WALL_DECOR_REGISTRY[texKey];
                        this.matNameDisplay.innerText = config ? config.name : 'Clear Material';
                    }
                }
            };

            matThumbs.forEach(thumb => {
                thumb.addEventListener('click', (e) => {
                    const selectedObj = this.ctx.interactions.selectedObject;
                    if (selectedObj && selectedObj.userData.entity && this.activeFace) {
                        const entity = selectedObj.userData.entity;
                        entity.params = entity.params || {};
                        const target = this.activeFace;
                        const key = thumb.getAttribute('data-mat');
                        
                        let targetParams = entity.params;
                        if (this.activeSubMeshIndex !== -1 && !entity.type.startsWith('shape_')) {
                            entity.params.blocks = entity.params.blocks || {};
                            entity.params.blocks[this.activeSubMeshIndex] = entity.params.blocks[this.activeSubMeshIndex] || {};
                            targetParams = entity.params.blocks[this.activeSubMeshIndex];
                        }
                        
                        if (target === 'top') targetParams.textureTop = key;
                        else if (target === 'bottom') targetParams.textureBottom = key;
                        else if (target === 'left') targetParams.textureLeft = key;
                        else if (target === 'right') targetParams.textureRight = key;
                        else if (target === 'front') targetParams.textureFront = key;
                        else if (target === 'back') targetParams.textureBack = key;
                        
                        highlightSelectedThumb(key);
                        
                        // Apply DIRECTLY to the selected face to guarantee NO spillover
                        if (this.activeObject && this.activeMatIndex !== undefined && this.activeMatIndex !== -1) {
                            const mats = Array.isArray(this.activeObject.material) ? this.activeObject.material : [this.activeObject.material];
                            if (mats[this.activeMatIndex]) {
                                const newMat = mats[this.activeMatIndex].clone();
                                if (key && WALL_DECOR_REGISTRY[key]) {
                                    const config = WALL_DECOR_REGISTRY[key];
                                    this.ctx.assets.getTexture(config).then(tex => {
                                        const texClone = tex.clone();
                                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                                        const dim = Math.max(entity.width || 100, entity.height || 100);
                                        const ts = config.defaultTileSize || 40;
                                        texClone.repeat.set(dim / ts, dim / ts);
                                        newMat.map = texClone;
                                        newMat.color.setHex(0xffffff);
                                        newMat.needsUpdate = true;
                                    });
                                } else {
                                    newMat.map = null;
                                    let fColor = 0xffffff;
                                    if (entity.fasciaMat === 'dark_grey') fColor = 0x333333;
                                    else if (entity.fasciaMat === 'stone') fColor = 0xa8a29e;
                                    else if (entity.fasciaMat === 'wood') fColor = 0x8b5a2b;
                                    newMat.color.setHex(fColor);
                                }
                                
                                if (Array.isArray(this.activeObject.material)) {
                                    this.activeObject.material[this.activeMatIndex] = newMat;
                                } else {
                                    this.activeObject.material = newMat;
                                }
                            }
                        }
                        
                        // Ensure parameters are saved for serialization, and trigger Vue reactivity by reassignment
                        entity.params = Object.assign({}, entity.params);
                        
                        // Update instantly by rebuilding the mesh properly
                        if (entity.type && entity.type.startsWith('shape_')) {
                            if (this.ctx.updateShapeLive) this.ctx.updateShapeLive(entity);
                        } else {
                            if (this.ctx.updateMaterialLive) this.ctx.updateMaterialLive(entity);
                        }
                    }
                });
            });

            this.ctx.updateCornerPanel = this.updateCornerPanel.bind(this);
            const crR = document.getElementById('gizmo-corner-r-range');
            const crN = document.getElementById('gizmo-corner-r');
            const updateCornerRadius = (val) => {
                const gizmo = this.ctx.interactions.cornerGizmo;
                if (!gizmo || gizmo.activeHandleIndex === -1) return;
                const entity = gizmo.target.userData.entity;
                if (!entity) return;
                entity.cornerRadii = entity.cornerRadii || [];
                while(entity.cornerRadii.length <= gizmo.activeHandleIndex) entity.cornerRadii.push(0);
                entity.cornerRadii[gizmo.activeHandleIndex] = val;
                if (crR) crR.value = val;
                if (crN) crN.value = val;
                if (entity.type && entity.type.startsWith('shape_')) {
                    if (this.ctx.updateShapeLive) this.ctx.updateShapeLive(entity);
                } else {
                    if (this.ctx.updateMaterialLive) this.ctx.updateMaterialLive(entity);
                }
                if (gizmo) gizmo.updateHandles();
            };
            if (crR) crR.addEventListener('input', e => updateCornerRadius(parseFloat(e.target.value)));
            if (crN) crN.addEventListener('input', e => updateCornerRadius(parseFloat(e.target.value)));

        }, 100);
    }

    onMaterialFaceSelected(faceName, subMeshIndex = -1, activeObject = null, activeMatIndex = -1) {
        this.activeFace = faceName;
        this.activeSubMeshIndex = subMeshIndex;
        this.activeObject = activeObject;
        this.activeMatIndex = activeMatIndex;
        if (this.materialPanel) {
            this.materialPanel.style.display = 'flex';
        }
        if (this.matFaceNameDisplay) {
            this.matFaceNameDisplay.innerText = faceName + ' Face';
        }
        
        // Update highlight for the material of the newly selected face
        const selectedObj = this.ctx.interactions.selectedObject;
        if (selectedObj && selectedObj.userData.entity && selectedObj.userData.entity.params) {
            const p = selectedObj.userData.entity.params;
            let targetParams = p;
            if (this.activeSubMeshIndex !== -1 && p.blocks && p.blocks[this.activeSubMeshIndex]) {
                targetParams = p.blocks[this.activeSubMeshIndex];
            }
            let tex = targetParams.texture;
            if (faceName === 'top') tex = targetParams.textureTop || tex;
            else if (faceName === 'bottom') tex = targetParams.textureBottom || tex;
            else if (faceName === 'left') tex = targetParams.textureLeft || tex;
            else if (faceName === 'right') tex = targetParams.textureRight || tex;
            else if (faceName === 'front') tex = targetParams.textureFront || tex;
            else if (faceName === 'back') tex = targetParams.textureBack || tex;
            
            const matThumbs = document.querySelectorAll('.mat-thumb');
            matThumbs.forEach(t => t.style.borderColor = 'transparent');
            if (tex) {
                const activeThumb = Array.from(matThumbs).find(t => t.getAttribute('data-mat') === tex);
                if (activeThumb) activeThumb.style.borderColor = '#3b82f6';
                if (this.matNameDisplay) {
                    const config = window.WALL_DECOR_REGISTRY ? window.WALL_DECOR_REGISTRY[tex] : null;
                    this.matNameDisplay.innerText = config ? config.name : 'Clear Material';
                }
            } else {
                if (this.matNameDisplay) this.matNameDisplay.innerText = 'Clear Material';
            }
        }
    }

    _makePanelDraggable(panel) {
        panel.removeAttribute('draggable');
        panel.style.touchAction = 'none';

        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let containerRect, panelRect;

        panel.style.cursor = 'grab';

        const onPointerDown = (e) => {
            const ignoreTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL', 'OPTION'];
            if (ignoreTags.includes(e.target.tagName) || e.target.closest('input, button, select, textarea, label')) {
                return;
            }

            if (e.pointerType === 'mouse' && e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            if (isDragging) return;
            isDragging = true;
            panel.style.cursor = 'grabbing';

            containerRect = this.container.getBoundingClientRect();
            panelRect = panel.getBoundingClientRect();

            if (panel.style.bottom !== 'auto' && panel.style.bottom !== '') {
                panel.style.top = `${panelRect.top - containerRect.top}px`;
                panel.style.bottom = 'auto';
            }
            if (panel.style.transform !== 'none' && panel.style.transform !== '') {
                panel.style.left = `${panelRect.left - containerRect.left}px`;
                panel.style.transform = 'none';
            }
            
            initialLeft = parseFloat(panel.style.left) || (panelRect.left - containerRect.left);
            initialTop = parseFloat(panel.style.top) || (panelRect.top - containerRect.top);

            panel.style.left = `${initialLeft}px`;
            panel.style.top = `${initialTop}px`;

            startX = e.clientX;
            startY = e.clientY;
            
            window.addEventListener('pointermove', onPointerMove, { passive: false });
            window.addEventListener('pointerup', onPointerUp);
            window.addEventListener('pointercancel', onPointerUp);
        };

        const onPointerMove = (e) => {
            if (!isDragging) return;
            e.preventDefault(); 
            
            let dx = e.clientX - startX;
            let dy = e.clientY - startY;
            
            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;
            
            const maxLeft = containerRect.width - panelRect.width;
            const maxTop = containerRect.height - panelRect.height;
            
            newLeft = Math.max(0, Math.min(newLeft, maxLeft));
            newTop = Math.max(0, Math.min(newTop, maxTop));
            
            panel.style.left = `${newLeft}px`;
            panel.style.top = `${newTop}px`;
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            panel.style.cursor = 'grab';
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        };
        
        panel.addEventListener('pointerdown', onPointerDown);
    }

    showTransformMenu(visible) {
        if (this.ctx.isRebuildingScene) return;
        if (this.transformMenu) {
            if (this.menuVisible === visible) return;
            this.menuVisible = visible;
            if (!visible) {
                this.transformMenu.style.display = 'none';
                this.setTransformMode('none', true);
            } else {
                this.transformMenu.style.display = 'block';
                this.setTransformMode('none', true);
            }
        }
    }

    setTransformMode(mode, force = false) {
        if (!this.ctx.interactions.transformControls) return;
        const tc = this.ctx.interactions.transformControls;
        const selectedObj = this.ctx.interactions.selectedObject;
        
        if (!force && this.ctx.currentTransformMode === mode && mode !== 'none') {
            mode = 'none';
        }
        this.ctx.currentTransformMode = mode;

        this.btnMove.classList.remove('active');
        if (this.btnPlace) this.btnPlace.classList.remove('active');
        if (this.btnScale) this.btnScale.classList.remove('active');
        this.btnSpin.classList.remove('active');
        this.btnTilt.classList.remove('active');
        if (this.btnOpening) this.btnOpening.classList.remove('active');
        if (this.btnMaterial) this.btnMaterial.classList.remove('active');
        if (this.btnCorner) this.btnCorner.classList.remove('active');

        if (this.ctx.interactions.openingGizmo) {
            this.ctx.interactions.openingGizmo.detach();
        }
        if (this.ctx.interactions.materialGizmo && mode !== 'material') {
            this.ctx.interactions.materialGizmo.detach();
            if (selectedObj && selectedObj.userData.entity && selectedObj.userData.entity.params) {
                selectedObj.userData.entity.params.isEditingMaterials = false;
                if (this.ctx.syncToUI) this.ctx.syncToUI();
            }
        }

        const isOpening = selectedObj && (selectedObj.userData.isWidget || selectedObj.userData.isPattern || (selectedObj.userData.entity && selectedObj.userData.entity.type && ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(selectedObj.userData.entity.type)));
        const supportsFaceMaterials = selectedObj && (selectedObj.userData.isShape || selectedObj.userData.isWidget || selectedObj.userData.isMolding || selectedObj.userData.isPattern);
        const isElevationFascia = selectedObj && selectedObj.userData.entity && selectedObj.userData.entity.type === 'elevation_fascia';

        if (mode === 'none') {
            tc.visible = false;
            tc.enabled = false;
            tc.showX = false; tc.showY = false; tc.showZ = false;
            
            this.btnMove.style.display = 'flex';
            if (this.btnPlace) this.btnPlace.style.display = isOpening ? 'none' : 'flex';
            if (this.btnScale) this.btnScale.style.display = isOpening ? 'none' : 'flex';
            this.btnSpin.style.display = isOpening ? 'none' : 'flex';
            this.btnTilt.style.display = isOpening ? 'none' : 'flex';
            if (this.btnOpening) this.btnOpening.style.display = isOpening ? 'flex' : 'none';
            if (this.btnMaterial) this.btnMaterial.style.display = supportsFaceMaterials ? 'flex' : 'none';
            if (this.btnCorner) this.btnCorner.style.display = isElevationFascia ? 'flex' : 'none';
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.btnDone) this.btnDone.style.display = 'none';
            
            if (selectedObj) this.ctx.interactions.setHighlight(selectedObj, true);
            tc.detach(); // Completely detach the gizmo to avoid hidden raycast interference
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            
            return;
        }

        tc.visible = true;
        tc.enabled = true;
        if (this.ctx.controls) this.ctx.controls.enabled = false;
        
        if (selectedObj) this.ctx.interactions.setHighlight(selectedObj, false);

        this.btnMove.style.display = 'none';
        if (this.btnPlace) this.btnPlace.style.display = 'none';
        if (this.btnScale) this.btnScale.style.display = 'none';
        this.btnSpin.style.display = 'none';
        this.btnTilt.style.display = 'none';
        if (this.btnOpening) this.btnOpening.style.display = 'none';
        if (this.btnMaterial) this.btnMaterial.style.display = 'none';
        if (this.btnCorner) this.btnCorner.style.display = 'none';
        if (this.btnDone) this.btnDone.style.display = 'flex';

        if (selectedObj) tc.detach();

        if (mode === 'opening') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnOpening) this.btnOpening.classList.add('active');
            if (this.openingPanel) this.openingPanel.style.display = 'flex';
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.ctx.interactions.openingGizmo && selectedObj) {
                this.ctx.interactions.openingGizmo.attach(selectedObj, 'opening');
                this.updateOpeningPanel(selectedObj.userData.entity);
            }
            return;
        }

        if (mode === 'material') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnMaterial) this.btnMaterial.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none'; // HIDDEN initially, waits for face click
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.ctx.interactions.materialGizmo && selectedObj) {
                this.ctx.interactions.materialGizmo.attach(selectedObj);
            }
            return;
        }

        if (mode === 'corner') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnCorner) this.btnCorner.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'flex';
            if (this.ctx.interactions.cornerGizmo && selectedObj) {
                this.ctx.interactions.cornerGizmo.attach(selectedObj);
                this.updateCornerPanel(selectedObj.userData.entity, -1);
            }
            return;
        }

        if (mode === 'translate') {
            if (isOpening) {
                tc.visible = false;
                tc.enabled = false;
                this.btnMove.classList.add('active');
                if (this.xyPanel) this.xyPanel.style.display = 'none';
                if (this.ctx.interactions.openingGizmo && selectedObj) {
                    this.ctx.interactions.openingGizmo.attach(selectedObj, 'move');
                }
                return;
            }
            tc.mode = 'translate';
            tc.showTranslate = true; tc.showRotate = false; tc.showScale = false;
            tc.showX = true; tc.showY = false; tc.showZ = true;
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
            tc.showX = true; tc.showY = false; tc.showZ = false;
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            this.btnTilt.classList.add('active'); // Tilt
        } else if (mode === 'rotateY') {
            tc.mode = 'rotate';
            tc.showTranslate = false; tc.showRotate = true; tc.showScale = false;
            tc.showX = false; tc.showY = true; tc.showZ = false;
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            this.btnSpin.classList.add('active'); // Spin
        }

        if (selectedObj) tc.attach(selectedObj);
    }

    updateTransformMenu() {
        if (!this.transformMenu || !this.ctx.interactions.selectedObject || !this.menuVisible) {
            if (this.transformMenu) this.transformMenu.style.display = 'none';
            return;
        }
        
        const pos = new THREE.Vector3();
        this.ctx.interactions.selectedObject.getWorldPosition(pos);
        pos.project(this.ctx.camera);
        
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

    updateCornerPanel(entity, index) {
        if (!entity) return;
        const indexSpan = document.getElementById('gizmo-corner-index');
        const rRange = document.getElementById('gizmo-corner-r-range');
        const rNum = document.getElementById('gizmo-corner-r');
        if (index === -1 || index === undefined) {
            if (indexSpan) indexSpan.innerText = 'None';
            if (rRange) { rRange.disabled = true; rRange.value = 0; }
            if (rNum) { rNum.disabled = true; rNum.value = 0; }
            return;
        }
        if (indexSpan) indexSpan.innerText = `#${index}`;
        if (rRange) rRange.disabled = false;
        if (rNum) rNum.disabled = false;
        const radii = entity.cornerRadii || [];
        const currentR = radii[index] || 0;
        if (rRange) rRange.value = currentR;
        if (rNum) rNum.value = currentR;
    }

    updateOpeningPanel(entity) {
        if (!entity) return;
        const opW = document.getElementById('gizmo-opening-w');
        const opWR = document.getElementById('gizmo-opening-w-range');
        const opH = document.getElementById('gizmo-opening-h');
        const opHR = document.getElementById('gizmo-opening-h-range');
        const opE = document.getElementById('gizmo-opening-e');
        const opER = document.getElementById('gizmo-opening-e-range');
        const flipContainer = document.getElementById('gizmo-opening-flips');
        const typeContainer = document.getElementById('gizmo-opening-type-container');
        const typeSelect = document.getElementById('gizmo-opening-type');

        const w = entity.width || 100;
        let h = entity.height; if (h === undefined) h = (entity.type === 'door') ? 80 : ((entity.type === 'window') ? 45 : 200);
        let e = entity.elevation; if (e === undefined) e = (entity.type === 'window') ? 35 : 0;
        if (opW && document.activeElement !== opW) opW.value = w.toFixed(1); if (opWR && document.activeElement !== opWR) opWR.value = w.toFixed(1);
        if (opH && document.activeElement !== opH) opH.value = h.toFixed(1); if (opHR && document.activeElement !== opHR) opHR.value = h.toFixed(1);
        if (opE && document.activeElement !== opE) opE.value = e.toFixed(1); if (opER && document.activeElement !== opER) opER.value = e.toFixed(1);

        if (flipContainer) {
            flipContainer.style.display = (entity.type === 'door' || entity.type === 'window' || entity.type === 'jali_panel') ? 'flex' : 'none';
        }
        if (typeContainer && typeSelect) {
            if (entity.type === 'door') {
                typeContainer.style.display = 'flex';
                if (typeSelect.dataset.currentType !== 'door') {
                    typeSelect.innerHTML = '';
                    for (const [key, val] of Object.entries(DOOR_TYPES)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.textContent = val.label;
                        typeSelect.appendChild(opt);
                    }
                    typeSelect.dataset.currentType = 'door';
                }
                typeSelect.value = entity.doorType;
            } else if (entity.type === 'window') {
                typeContainer.style.display = 'flex';
                if (typeSelect.dataset.currentType !== 'window') {
                    typeSelect.innerHTML = '';
                    for (const [key, val] of Object.entries(WINDOW_TYPES)) {
                        const opt = document.createElement('option');
                        opt.value = key;
                        opt.textContent = val.label;
                        typeSelect.appendChild(opt);
                    }
                    typeSelect.dataset.currentType = 'window';
                }
                typeSelect.value = entity.windowType;
            } else {
                typeContainer.style.display = 'none';
            }
        }
    }
}