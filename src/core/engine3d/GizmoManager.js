import { EVENTS } from '../registry.js';
import { coreEventBus } from '../EventBus.js';
import * as THREE from 'three';
import { DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY, DOOR_MATERIALS_REGISTRY, DOOR_STYLES_REGISTRY, ROOF_DECOR_REGISTRY, GIZMO_REGISTRY, FABRIC_REGISTRY, FLOOR_REGISTRY, WINDOW_GLASS_MATERIALS } from '../registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { MaterialClassifier } from './MaterialClassifier.js';

const WOOD_REGISTRY = DOOR_MATERIALS_REGISTRY;
const METAL_REGISTRY = DOOR_MATERIALS_REGISTRY;
const GLASS_REGISTRY = WINDOW_GLASS_MATERIALS;
const STONE_REGISTRY = WALL_DECOR_REGISTRY;
const TILE_REGISTRY = WALL_DECOR_REGISTRY;
const WALL_REGISTRY = WALL_DECOR_REGISTRY;
const PLASTIC_REGISTRY = DOOR_MATERIALS_REGISTRY;
const ROOF_REGISTRY = ROOF_DECOR_REGISTRY;

export class GizmoManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.container = ctx.container;
        this.menuVisible = false;
        this.materialClassifier = new MaterialClassifier();
    }

    init() {
        this.ctx.showTransformMenu = this.showTransformMenu.bind(this);
        this.transformMenu = document.createElement('div');
        this.transformMenu.className = 'transform-menu-3d';
        this.transformMenu.style.display = 'none';
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
        this.btnMove.onclick = () => this.setTransformMode('translate');
        
        this.btnPlace = document.createElement('button');
        this.btnPlace.className = 'transform-menu-btn';
        this.btnPlace.innerHTML = '🎯<br>Place';
        this.btnPlace.onclick = () => this.setTransformMode('place');

        this.btnScale = document.createElement('button');
        this.btnScale.className = 'transform-menu-btn';
        this.btnScale.innerHTML = '⤢<br>Scale';
        this.btnScale.onclick = () => this.setTransformMode('scale');

        this.btnSpin = document.createElement('button');
        this.btnSpin.className = 'transform-menu-btn';
        this.btnSpin.innerHTML = '⭮<br>Spin';
        this.btnSpin.onclick = () => this.setTransformMode('rotateY'); // Spin is Y-axis (Yaw)
        
        this.btnTilt = document.createElement('button');
        this.btnTilt.className = 'transform-menu-btn';
        this.btnTilt.innerHTML = '⭮<br>Tilt';
        this.btnTilt.onclick = () => this.setTransformMode('rotateX'); // Tilt is X-axis (Pitch)

        this.btnOpening = document.createElement('button');
        this.btnOpening.className = 'transform-menu-btn';
        this.btnOpening.innerHTML = '✂️<br>Opening';
        this.btnOpening.style.display = 'none';
        this.btnOpening.onclick = () => this.setTransformMode('opening');
        
        this.btnMaterial = document.createElement('button');
        this.btnMaterial.className = 'transform-menu-btn';
        this.btnMaterial.innerHTML = '🎨<br>Material';
        this.btnMaterial.style.display = 'none';
        this.btnMaterial.onclick = () => {
            if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                this.ctx.interactions.selectedObject.userData.entity.params = this.ctx.interactions.selectedObject.userData.entity.params || {};
                this.ctx.interactions.selectedObject.userData.entity.params.isEditingMaterials = true;
                this.setTransformMode('material');
            }
        };

        this.btnStyle = document.createElement('button');
        this.btnStyle.className = 'transform-menu-btn';
        this.btnStyle.innerHTML = '🚪<br>Style';
        this.btnStyle.style.display = 'none';
        this.btnStyle.onclick = () => {
            this.setTransformMode('doorStyle');
        };

        this.btnCorner = document.createElement('button');
        this.btnCorner.className = 'transform-menu-btn';
        this.btnCorner.innerHTML = '✂️<br>Corner';
        this.btnCorner.style.display = 'none';
        this.btnCorner.onclick = () => this.setTransformMode('corner');

        this.btnVertexSlope = document.createElement('button');
        this.btnVertexSlope.className = 'transform-menu-btn';
        this.btnVertexSlope.innerHTML = '⬍<br>Slope';
        this.btnVertexSlope.style.display = 'none';
        this.btnVertexSlope.onclick = () => this.setTransformMode('vertex_slope');

        this.btnRoofCorners = document.createElement('button');
        this.btnRoofCorners.className = 'transform-menu-btn';
        this.btnRoofCorners.innerHTML = '⬡<br>Corners';
        this.btnRoofCorners.title = 'Edit Roof Corners';
        this.btnRoofCorners.style.display = 'none';
        this.btnRoofCorners.onclick = () => this.setTransformMode('roof_corners');

        this.btnRoofOverhang = document.createElement('button');
        this.btnRoofOverhang.className = 'transform-menu-btn';
        this.btnRoofOverhang.innerHTML = '↔<br>Overhang';
        this.btnRoofOverhang.title = 'Edit Roof Overhang';
        this.btnRoofOverhang.style.display = 'none';
        this.btnRoofOverhang.onclick = () => this.setTransformMode('roof_overhang');

        this.btnPolygonEdges = document.createElement('button');
        this.btnPolygonEdges.innerHTML = '✂️<br>Adjust';
        this.btnPolygonEdges.className = 'transform-menu-btn';
        this.btnPolygonEdges.title = 'Adjust Shape Cut';
        this.btnPolygonEdges.style.display = 'none';
        this.btnPolygonEdges.onclick = () => this.setTransformMode('polygon_edges');
        
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
        
        // Add custom styles for the new Material Library
        if (!document.getElementById('gizmo-material-styles')) {
            const style = document.createElement('style');
            style.id = 'gizmo-material-styles';
            style.innerHTML = `
                .mat-lib-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: transparent; 
                    z-index: 99999; display: flex; flex-direction: column; padding: 5vh 5vw; box-sizing: border-box;
                    opacity: 0; transition: opacity 0.3s ease; pointer-events: none;
                }
                .mat-lib-overlay.active {
                    opacity: 1; pointer-events: auto;
                }
                .mat-lib-inner {
                    max-width: 1400px; margin: 0 auto; width: 100%; height: 100%; 
                    display: flex; flex-direction: column; overflow: hidden;
                }
                .mat-lib-grid {
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); 
                    gap: 24px; overflow-y: auto; padding-right: 10px; padding-bottom: 80px; align-items: start; flex: 1; min-height: 0;
                }
                .mat-thumb-item {
                    display: flex; flex-direction: column; align-items: center; cursor: pointer;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                    padding: 10px; border-radius: 16px; background: rgba(255,255,255,0);
                }
                .mat-thumb-item:hover {
                    transform: translateY(-5px) scale(1.05);
                    background: rgba(255,255,255,0.05);
                }
                .mat-thumb-img {
                    width: 120px; height: 120px; background-size: contain; background-position: center; background-repeat: no-repeat;
                    filter: drop-shadow(0 15px 20px rgba(0,0,0,0.6));
                }
                .mat-close-btn {
                    background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); width: 44px; height: 44px; border-radius: 50%;
                    color: white; cursor: pointer; font-size: 24px; display: flex; align-items: center; justify-content: center;
                    transition: background 0.2s;
                }
                .mat-close-btn:hover { background: rgba(0,0,0,0.6); }
                @media (max-width: 768px) {
                    .mat-thumb-img { width: 80px; height: 80px; }
                    .mat-lib-overlay { padding: 2vh 3vw; }
                    .mat-lib-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
                    .mat-lib-header-title { font-size: 24px !important; }
                    .mat-lib-header-sub { font-size: 13px !important; }
                }
                .mat-lib-header-text {
                    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
                }
                
            `;
            document.head.appendChild(style);
        }

        this.materialPanel = document.createElement('div');
        this.materialPanel.className = 'mat-lib-overlay';
        
        let decorThumbnails = `
            <div class="mat-thumb-item mat-thumb" data-mat="">
                <div class="mat-thumb-img" style="background: rgba(0,0,0,0.2); border-radius: 50%; border: 1px dashed rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Clear</div>
                <span style="color: white; font-size: 13px; margin-top: 16px; font-weight: 500; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">Default</span>
            </div>
        `;
        for (const [key, val] of Object.entries(WALL_DECOR_REGISTRY)) {
            const thumbUrl = val.thumbnail || val.texture;
            decorThumbnails += `
                <div class="mat-thumb-item mat-thumb" data-mat="${key}" title="${val.name}">
                    <div class="mat-thumb-img" style="background-image: url('${thumbUrl}');"></div>
                    <span style="color: white; font-size: 13px; margin-top: 16px; font-weight: 500; text-align: center; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${val.name}</span>
                </div>
            `;
        }
        
        this.materialPanel.innerHTML = `
              <div class="mat-lib-inner">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; flex-shrink: 0;">
                      <div>
                          <h2 class="mat-lib-header-text mat-lib-header-title" style="font-size: 32px; font-weight: 300; color: white; margin: 0 0 8px 0; letter-spacing: 1px;">Material Library</h2>
                          <div class="mat-lib-header-text mat-lib-header-sub" style="font-size: 15px; color: #e2e8f0;">Applying to: <span id="gizmo-material-face-name" style="color: #93c5fd; font-weight: 600; text-transform: capitalize;"></span> &nbsp;&bull;&nbsp; Current: <span id="gizmo-material-name" style="color: white; font-weight: 500;"></span></div>
                      </div>
                      <button id="close-material-lib" class="mat-close-btn">&times;</button>
                  </div>
                  
                  <div id="gizmo-unknown-material" style="display: none; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 8px; text-align: center; margin-bottom: 15px; flex-shrink: 0;">
                      <div style="color: #cbd5e1; margin-bottom: 12px; font-size: 14px;">Material type couldn't be identified for this mesh.</div>
                      <select id="gizmo-assign-category" style="padding: 6px 12px; border-radius: 4px; background: rgba(0,0,0,0.3); color: white; border: 1px solid rgba(255,255,255,0.2); cursor: pointer; outline: none; font-size: 13px;">
                          <option value="" disabled selected>Assign Category...</option>
                          <option value="fabric">Fabric</option>
                          <option value="wood">Wood</option>
                          <option value="metal">Metal</option>
                          <option value="glass">Glass</option>
                          <option value="stone">Stone</option>
                          <option value="tile">Tile</option>
                          <option value="plastic">Plastic</option>
                      </select>
                  </div>

                  <div id="gizmo-material-grid" class="mat-lib-grid">
                      ${decorThumbnails}
                  </div>
              </div>
          `;
        
        // Block pointer events from hitting the 3D scene below
        ['pointerdown', 'pointerup', 'wheel'].forEach(evt => {
            this.materialPanel.addEventListener(evt, e => e.stopPropagation(), { passive: true });
        });
        
        // Add close logic
        this.materialPanel.querySelector('#close-material-lib').addEventListener('click', () => {
            this.materialPanel.classList.remove('active');
            setTimeout(() => {
                this.materialPanel.style.display = 'none';
                if (this.currentTransformMode === 'material') {
                    this.setTransformMode('none');
                }
            }, 300);
        });

        // Unknown category assignment logic
        this.materialPanel.querySelector('#gizmo-assign-category').addEventListener('change', (e) => {
            if (!this.activeObject) return;
            const cat = e.target.value;
            
            const applyToMesh = (mesh) => {
                if (!mesh.userData) mesh.userData = {};
                mesh.userData.materialCategory = cat;
                if (this.materialClassifier) {
                    this.materialClassifier.invalidateCache(mesh);
                }
            };

            applyToMesh(this.activeObject);

            // Asset Learning: propagate to other meshes with the same material UUID
            if (this.materialClassifier && this.activeObject.material) {
                const root = this.materialClassifier._getRoot(this.activeObject);
                const activeMats = Array.isArray(this.activeObject.material) ? this.activeObject.material : [this.activeObject.material];
                const activeUuids = activeMats.map(m => m.uuid).filter(Boolean);
                
                if (activeUuids.length > 0 && root) {
                    root.traverse(child => {
                        if (child.isMesh && child !== this.activeObject && child.material) {
                            const childMats = Array.isArray(child.material) ? child.material : [child.material];
                            if (childMats.some(m => activeUuids.includes(m.uuid))) {
                                applyToMesh(child);
                            }
                        }
                    });
                }
            }
            
            // Re-trigger the selection to update grid
            if (this.activeFace || this.activeObject) {
                this.onMaterialFaceSelected(this.activeFace, this.activeSubMeshIndex, this.activeObject, this.activeMatIndex);
            }
        });

        document.body.appendChild(this.materialPanel);

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

        this.stylePanel = document.createElement('div');
        this.stylePanel.style.display = 'none';
        this.stylePanel.style.position = 'absolute';
        this.stylePanel.style.bottom = '100px';
        this.stylePanel.style.left = '50%';
        this.stylePanel.style.transform = 'translateX(-50%)';
        this.stylePanel.style.background = 'rgba(15, 23, 42, 0.9)';
        this.stylePanel.style.padding = '12px 16px';
        this.stylePanel.style.borderRadius = '12px';
        this.stylePanel.style.color = 'white';
        this.stylePanel.style.pointerEvents = 'auto';
        this.stylePanel.style.boxShadow = '0 8px 32px rgba(0,0,0,0.5)';
        this.stylePanel.style.border = '1px solid rgba(255,255,255,0.15)';
        this.stylePanel.style.backdropFilter = 'blur(8px)';
        this.stylePanel.style.zIndex = '1000';
        this.stylePanel.style.flexDirection = 'column';
        this.stylePanel.style.gap = '10px';
        this.stylePanel.style.width = '300px';
        this.stylePanel.setAttribute('draggable', 'true');
        
        let styleThumbnails = '';
        Object.values(DOOR_STYLES_REGISTRY).forEach(conf => {
            styleThumbnails += `<div class="style-thumb" data-style="${conf.id}" title="${conf.name}" style="width: 45px; height: 45px; border-radius: 6px; cursor: pointer; border: 2px solid transparent; transition: all 0.2s; background: ${conf.icon}; flex-shrink: 0;"></div>`;
        });
        
        this.stylePanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px;">DOOR STYLE LIBRARY</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
                <div style="font-size: 11px; color: #cbd5e1; margin-bottom: -4px;">Selected Style: <span id="gizmo-style-name" style="font-weight: bold; color: white;"></span></div>
                <div id="gizmo-style-grid" style="display: flex; flex-wrap: wrap; gap: 8px; max-height: 150px; overflow-y: auto; padding-right: 4px;">
                    ${styleThumbnails}
                </div>
            </div>
        `;
        this.stylePanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.container.appendChild(this.stylePanel);

        this.transformMenu.appendChild(this.btnMaterial);
        this.transformMenu.appendChild(this.btnMove);
        this.transformMenu.appendChild(this.btnPlace);
        this.transformMenu.appendChild(this.btnScale);
        this.transformMenu.appendChild(this.btnSpin);
        this.transformMenu.appendChild(this.btnTilt);
        this.transformMenu.appendChild(this.btnOpening);
        this.transformMenu.appendChild(this.btnStyle);
        this.transformMenu.appendChild(this.btnCorner);
        this.transformMenu.appendChild(this.btnVertexSlope);
        this.transformMenu.appendChild(this.btnRoofCorners);
        this.transformMenu.appendChild(this.btnRoofOverhang);
        this.transformMenu.appendChild(this.btnPolygonEdges);
        
        this.btnCloseMenu = document.createElement('button');
        this.btnCloseMenu.className = 'transform-menu-btn';
        this.btnCloseMenu.innerHTML = '✕<br>Close';
        this.btnCloseMenu.style.background = 'rgba(239, 68, 68, 0.9)'; // Red background for close
        this.btnCloseMenu.addEventListener('click', () => {
            if (this.ctx && this.ctx.interactions) {
                this.ctx.interactions.deselect();
            }
        });
        this.transformMenu.appendChild(this.btnCloseMenu);
        
        this.container.appendChild(this.transformMenu);
        ['pointerdown', 'wheel'].forEach(evt => {
            this.transformMenu.addEventListener(evt, e => e.stopPropagation(), { passive: true });
        });
        this.container.appendChild(this.btnDone);

        this._makePanelDraggable(this.xyPanel);
        this._makePanelDraggable(this.openingPanel);
        this._makePanelDraggable(this.materialPanel);
        this._makePanelDraggable(this.stylePanel);
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
                    coreEventBus.emit(EVENTS.OPENING_GIZMO_CHANGE, { entity });
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
                        coreEventBus.emit(EVENTS.OPENING_GIZMO_CHANGE, { entity });
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
                        coreEventBus.emit(EVENTS.OPENING_GIZMO_CHANGE, { entity });
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
                        coreEventBus.emit(EVENTS.OPENING_GIZMO_CHANGE, { entity });
                    }
                });
            }

            this.matNameDisplay = document.getElementById('gizmo-material-name');
            this.matFaceNameDisplay = document.getElementById('gizmo-material-face-name');
            const matThumbs = document.querySelectorAll('.mat-thumb');

            const highlightSelectedThumb = (texKey) => {
                const currentThumbs = document.querySelectorAll('.mat-thumb');
                currentThumbs.forEach(t => t.style.borderColor = 'transparent');
                if (texKey !== undefined) {
                    const activeThumb = Array.from(currentThumbs).find(t => t.getAttribute('data-mat') === (texKey || ''));
                    if (activeThumb) activeThumb.style.borderColor = '#3b82f6';
                    if (this.matNameDisplay) {
                        const selectedObj = this.ctx.interactions.selectedObject;
                        let registry = WALL_DECOR_REGISTRY;
                        if (selectedObj && selectedObj.userData.entity) {
                            if (selectedObj.userData.entity.type === 'door' || selectedObj.userData.entity.type === 'window') registry = DOOR_MATERIALS_REGISTRY;
                            else if (selectedObj.userData.entity.type === 'roof') {
                                if (this.activeObject && this.activeObject.userData && this.activeObject.userData.isGable) registry = WALL_DECOR_REGISTRY;
                                else registry = ROOF_DECOR_REGISTRY;
                            } else if (selectedObj.userData.isFurniture || selectedObj.userData.entity.type === 'furniture') {
                                registry = Object.assign({}, FABRIC_REGISTRY, DOOR_MATERIALS_REGISTRY, WALL_DECOR_REGISTRY);
                            }
                        }
                        const config = registry[texKey];
                        this.matNameDisplay.innerText = config ? config.name : 'Clear Material';
                    }
                }
            };

            this._attachMaterialThumbListeners = () => {
                const currentThumbs = document.querySelectorAll('.mat-thumb');
                currentThumbs.forEach(thumb => {
                    thumb.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        let realSelectedObj = this.ctx.interactions.selectedObject;
                        if (this.activeObject) {
                            let current = this.activeObject;
                            while(current) {
                                if (current.userData && current.userData.entity) {
                                    realSelectedObj = current;
                                    break;
                                }
                                current = current.parent;
                            }
                        }
                        
                        // Fix stale activeObject if the mesh was rebuilt by sync-engine
                        if (this.activeObject && this.activeObject.name && realSelectedObj) {
                            let foundNewActive = null;
                            realSelectedObj.traverse(child => {
                                if (child.isMesh && child.name === this.activeObject.name) {
                                    foundNewActive = child;
                                }
                            });
                            if (foundNewActive) {
                                this.activeObject = foundNewActive;
                            }
                        }
                        
                        const selectedObj = realSelectedObj;
                        if (selectedObj && selectedObj.userData.entity && this.activeFace) {
                            const entity = selectedObj.userData.entity;
                            entity.params = entity.params || {};
                            const target = this.activeFace;
                            const key = thumb.getAttribute('data-mat');
                            
                            let targetParams = entity.params;
                            if (this.activeSubMeshIndex !== -1 && entity.materialMode !== 'PROCEDURAL' && entity.materialMode !== 'MONOLITHIC') {
                                entity.params.blocks = entity.params.blocks || {};
                                entity.params.blocks[this.activeSubMeshIndex] = entity.params.blocks[this.activeSubMeshIndex] || {};
                                targetParams = entity.params.blocks[this.activeSubMeshIndex];
                            }
                            
                            const isFrame = this.activeObject && this.activeObject.userData && this.activeObject.userData.isFrame;
                            
                            // Refactored: Delegate to entity.applyMaterial if available (SOLID: OCP)
                            if (typeof entity.applyMaterial === 'function') {
                                // For generic materials that GizmoManager builds (like textures)
                                let newMat = null;
                                if (this.activeObject && this.activeMatIndex !== undefined && this.activeMatIndex !== -1) {
                                    const mats = Array.isArray(this.activeObject.material) ? this.activeObject.material : [this.activeObject.material];
                                    if (mats[this.activeMatIndex]) {
                                        newMat = mats[this.activeMatIndex].clone();
                                        let registry = WALL_DECOR_REGISTRY;
                                        if (entity.type === 'door' || entity.type === 'window') registry = DOOR_MATERIALS_REGISTRY;
                                        else if (entity.type === 'roof') registry = ROOF_DECOR_REGISTRY;
                                        
                                        if (key && registry[key]) {
                                            const config = registry[key];
                                            MaterialFactory.applyPBRMaterial(this.activeObject, config, this.ctx, this.activeMatIndex).then(() => {
                                                // Event if needed
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
                                
                                entity.applyMaterial({ target, key, newMat, activeMatIndex: this.activeMatIndex, activeObject: this.activeObject, ctx: this.ctx });
                                highlightSelectedThumb(key);
                                  
                            } else {
                                // Legacy Fallback for other entities
                                if (entity.type === 'door') {
                                    if (isFrame) {
                                        entity.frameMat = key;
                                    } else {
                                        if (target === 'top') targetParams.textureTop = key;
                                        else if (target === 'bottom') targetParams.textureBottom = key;
                                        else if (target === 'left') targetParams.textureLeft = key;
                                        else if (target === 'right') targetParams.textureRight = key;
                                        else if (target === 'front') targetParams.textureFront = key;
                                        else if (target === 'back') targetParams.textureBack = key;
                                        else entity.doorMat = key;
                                    }
                                } else if (entity.type === 'window') {
                                    const isGlass = this.activeObject && this.activeObject.userData && this.activeObject.userData.isGlass;
                                    if (isGlass) {
                                        entity.glassMat = key;
                                    } else {
                                        entity.frameMat = key;
                                    }
                                } else if ((selectedObj && selectedObj.userData && selectedObj.userData.isFurniture) || (entity && (entity.type === 'furniture' || entity.isFurniture))) {
                                    entity.params.materialOverrides = entity.params.materialOverrides || {};
                                    if (this.activeObject && this.activeObject.name) {
                                        entity.params.materialOverrides[this.activeObject.name] = key;
                                    }
                                } else {
                                    if (target === 'top') targetParams.textureTop = key;
                                    else if (target === 'bottom') targetParams.textureBottom = key;
                                    else if (target === 'left') targetParams.textureLeft = key;
                                    else if (target === 'right') targetParams.textureRight = key;
                                    else if (target === 'front') targetParams.textureFront = key;
                                    else if (target === 'back') targetParams.textureBack = key;
                                }
                                
                                highlightSelectedThumb(key);
                                  
                                
                                const isFurnitureMat = (selectedObj && selectedObj.userData && selectedObj.userData.isFurniture) || (entity && (entity.type === 'furniture' || entity.isFurniture));
                                const isValidMatIndex = this.activeMatIndex !== undefined && this.activeMatIndex !== -1;
                                
                                if (this.activeObject && (isValidMatIndex || isFurnitureMat)) {
                                    const matIndexToUse = isValidMatIndex ? this.activeMatIndex : -1;
                                    const mats = Array.isArray(this.activeObject.material) ? this.activeObject.material : [this.activeObject.material];
                                    if (mats[matIndexToUse === -1 ? 0 : matIndexToUse] || isFurnitureMat) {
                                        let registry = WALL_DECOR_REGISTRY;
                                        if (entity) {
                                            if (entity.type === 'door' || entity.type === 'window') registry = DOOR_MATERIALS_REGISTRY;
                                            if (isFurnitureMat) {
                                                registry = Object.assign({}, FABRIC_REGISTRY, DOOR_MATERIALS_REGISTRY);
                                            }
                                        }
                                        if (key && registry[key]) {
                                            const config = registry[key];
                                            MaterialFactory.applyPBRMaterial(this.activeObject, config, this.ctx, matIndexToUse).then(() => {
                                                // Update local params for persistence
                                                if (isFurnitureMat) {
                                                    const meshName = (this.activeObject && this.activeObject.name) ? this.activeObject.name : '';
                                                    if (meshName) {
                                                        const p = selectedObj.userData.entity.params || {};
                                                        p.materialOverrides = p.materialOverrides || {};
                                                        p.materialOverrides[meshName] = key;
                                                        
                                                        if (selectedObj.userData.entity) {
                                                            selectedObj.userData.entity.params.materialOverrides = p.materialOverrides;
                                                        }
                                                    }
                                                    
                                                    // Auto-close the UI to provide clear closure for monolithic objects
                                                    this.setTransformMode('none');
                                                }
                                            });
                                        } else {
                                            const newMat = (mats[matIndexToUse === -1 ? 0 : matIndexToUse] || mats[0]).clone();
                                            newMat.map = null;
                                            let fColor = 0xffffff;
                                            if (entity && entity.fasciaMat === 'dark_grey') fColor = 0x333333;
                                            else if (entity && entity.fasciaMat === 'stone') fColor = 0xa8a29e;
                                            else if (entity && entity.fasciaMat === 'wood') fColor = 0x8b5a2b;
                                            newMat.color.setHex(fColor);
                                            
                                            if (Array.isArray(this.activeObject.material)) {
                                                if (!entity.supportsLiveMaterialPipeline) {
                                                    this.activeObject.material[matIndexToUse === -1 ? 0 : matIndexToUse] = newMat;
                                                }
                                            } else {
                                                if (!entity.supportsLiveMaterialPipeline) {
                                                    this.activeObject.material = newMat;
                                                }
                                            }
                                        }
                                    }
                                }
                                
                                if (!isFurnitureMat) {
                                    // Avoid reactive reset for furniture
                                }
                                
                                if (entity.supportsLiveMaterialPipeline) {
                                    if (this.ctx.updateMaterialLive) {
                                        this.ctx.updateMaterialLive(entity);
                                        if (this.ctx.interactions && this.ctx.interactions.materialGizmo) {
                                            setTimeout(() => this.ctx.interactions.materialGizmo.updateHighlights(), 10);
                                        }
                                    } else if (this.ctx.updateShapeLive) {
                                        this.ctx.updateShapeLive(entity);
                                    }
                                }
                            }
                        }
                    });
                });
            };
            this._attachMaterialThumbListeners();

            this._attachStyleThumbListeners = () => {
                const styleThumbs = document.querySelectorAll('.style-thumb');
                styleThumbs.forEach(thumb => {
                    thumb.addEventListener('click', (e) => {
                        const selectedObj = this.ctx.interactions.selectedObject;
                        if (selectedObj && selectedObj.userData.entity) {
                            const entity = selectedObj.userData.entity;
                            const key = thumb.getAttribute('data-style');
                            
                            entity.doorStyle = key;
                            
                            styleThumbs.forEach(t => t.style.borderColor = 'transparent');
                            thumb.style.borderColor = '#3b82f6';
                            const styleNameDisplay = document.getElementById('gizmo-style-name');
                            if (styleNameDisplay) {
                                const config = DOOR_STYLES_REGISTRY[key];
                                styleNameDisplay.innerText = config ? config.name : key;
                            }
                            
                            if (this.ctx.updateMaterialLive) {
                                this.ctx.updateMaterialLive(entity);
                                if (this.ctx.interactions && this.ctx.interactions.materialGizmo) {
                                    setTimeout(() => this.ctx.interactions.materialGizmo.updateHighlights(), 10);
                                }
                            }
                            if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                        }
                    });
                });
            };
            this._attachStyleThumbListeners();

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
                    if (this.ctx.updateMaterialLive) {
                        this.ctx.updateMaterialLive(entity);
                        if (this.ctx.interactions && this.ctx.interactions.materialGizmo) {
                            setTimeout(() => this.ctx.interactions.materialGizmo.updateHighlights(), 10);
                        }
                    }
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
            setTimeout(() => this.materialPanel.classList.add('active'), 10);
            if (this.btnDone) this.btnDone.style.display = 'flex';
        }

        let realSelectedObj = this.ctx.interactions.selectedObject;
        if (activeObject) {
            let current = activeObject;
            while(current) {
                if (current.userData && current.userData.entity) {
                    realSelectedObj = current;
                    break;
                }
                current = current.parent;
            }
        }
        const selectedObj = realSelectedObj;
        
        let materialCategory = 'unknown';
        if (selectedObj && selectedObj.userData && selectedObj.userData.entity) {
            const type = selectedObj.userData.entity.type;
            if (type === 'furniture' || selectedObj.userData.entity.isFurniture) {
                const detected = this.materialClassifier.classify(this.activeObject, faceName);
                materialCategory = detected.category;
            } else {
                materialCategory = type;
            }
        }
        
        const unknownPanel = document.getElementById('gizmo-unknown-material');
        const gridPanel = document.getElementById('gizmo-material-grid');
        
        if (materialCategory === 'unknown') {
            if (unknownPanel) unknownPanel.style.display = 'block';
            if (gridPanel) gridPanel.style.display = 'none';
            if (this.matFaceNameDisplay) this.matFaceNameDisplay.innerText = 'Unknown Category';
            
            // Reset the select dropdown to prompt assignment
            const selectElem = document.getElementById('gizmo-assign-category');
            if (selectElem) selectElem.value = "";
            return;
        } else {
            if (unknownPanel) unknownPanel.style.display = 'none';
            if (gridPanel) gridPanel.style.display = 'grid';
        }

        if (this.matFaceNameDisplay) {
            let title = 'Materials';
            if (materialCategory === 'wood' || materialCategory === 'door' || materialCategory === 'window' || materialCategory === 'wood_metal') title = 'Wood / Veneer';
            else if (materialCategory === 'metal') title = 'Metals';
            else if (materialCategory === 'glass') title = 'Glass';
            else if (materialCategory === 'stone') title = 'Stone';
            else if (materialCategory === 'tile') title = 'Tiles';
            else if (materialCategory === 'fabric') title = 'Fabric / Decor';
            else if (materialCategory === 'plastic') title = 'Plastics';
            else if (materialCategory === 'floor' || materialCategory === 'outer' || materialCategory === 'inner' || materialCategory === 'roof') {
                title = (materialCategory.charAt(0).toUpperCase() + materialCategory.slice(1)).replace(/_/g, ' ') + ' Materials';
            }
            this.matFaceNameDisplay.innerText = title;
        }

        let decorThumbnails = `
            <div class="mat-thumb-item mat-thumb" data-mat="">
                <div class="mat-thumb-img" style="background: rgba(0,0,0,0.2); border-radius: 50%; border: 1px dashed rgba(255,255,255,0.4); display: flex; align-items: center; justify-content: center; color: white; font-size: 14px; text-shadow: 0 2px 4px rgba(0,0,0,0.5);">Clear</div>
                <span style="color: white; font-size: 13px; margin-top: 16px; font-weight: 500; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">Default</span>
            </div>
        `;
        let registry = WALL_DECOR_REGISTRY;
        
        if (materialCategory === 'wood' || materialCategory === 'door' || materialCategory === 'window' || materialCategory === 'wood_metal') registry = WOOD_REGISTRY;
        else if (materialCategory === 'metal') registry = METAL_REGISTRY;
        else if (materialCategory === 'glass') registry = GLASS_REGISTRY;
        else if (materialCategory === 'stone') registry = STONE_REGISTRY;
        else if (materialCategory === 'tile') registry = TILE_REGISTRY;
        else if (materialCategory === 'plastic') registry = PLASTIC_REGISTRY;
        else if (materialCategory === 'roof') registry = ROOF_REGISTRY;
        else if (materialCategory === 'fabric') registry = FABRIC_REGISTRY;
        else if (materialCategory === 'floor') registry = FLOOR_REGISTRY;
        else if (materialCategory === 'wall' || materialCategory === 'outer' || materialCategory === 'inner') registry = WALL_REGISTRY;

        const matsToRender = [];
        if (registry) {
            for (const [key, val] of Object.entries(registry)) {
                // If the item doesn't have a thumbnail or texture, try to handle it (like WINDOW_GLASS_MATERIALS)
                const thumbUrl = val.thumbnail || val.texture;
                if (!thumbUrl && !val.color && !val.transparent) continue;
                
                let thumbContent = '';
                if (val.type === 'fabric') {
                    matsToRender.push({ key, val });
                    thumbContent = `<div class="mat-thumb-img" id="mat-thumb-${key}" style="display: flex; justify-content: center; align-items: center;"><span style="color: white; font-size: 24px; text-shadow: 0 2px 4px rgba(0,0,0,0.8);" class="material-icons">hourglass_empty</span></div>`;
                } else if (thumbUrl) {
                    thumbContent = `<div class="mat-thumb-img" style="background-image: url('${thumbUrl}');"></div>`;
                } else if (val.color) {
                    const hexColor = '#' + val.color.toString(16).padStart(6, '0');
                    thumbContent = `<div class="mat-thumb-img" style="background-color: ${hexColor}; opacity: ${val.transparent ? (val.transmission !== undefined ? 1 - val.transmission : 0.5) : 1};"></div>`;
                }
                
                const label = val.name || val.label || key;
                decorThumbnails += `
                    <div class="mat-thumb-item mat-thumb" data-mat="${key}" title="${label}">
                        ${thumbContent}
                        <span style="color: white; font-size: 13px; margin-top: 16px; font-weight: 500; text-align: center; max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.8);">${label}</span>
                    </div>
                `;
            }
        }
        
        const gridElem = this.materialPanel.querySelector('#gizmo-material-grid');
        if (gridElem) {
            gridElem.innerHTML = decorThumbnails;
            if (this._attachMaterialThumbListeners) this._attachMaterialThumbListeners();
            
            // Asynchronously build beautiful 3D material preview spheres
            if (matsToRender.length > 0) {
                setTimeout(async () => {
                    for (const item of matsToRender) {
                        try {
                            const thumbData = await this.ctx.thumbnailGenerator.generate('material_preview', item.val);
                            if (thumbData) {
                                const el = document.getElementById(`mat-thumb-${item.key}`);
                                if (el) {
                                    el.innerHTML = '';
                                    el.style.backgroundImage = `url('${thumbData}')`;
                                }
                            }
                        } catch (e) {
                            console.error('Failed to render material thumb:', e);
                        }
                    }
                }, 50);
            }
        }
        
        if (selectedObj && selectedObj.userData.entity) {
            const p = selectedObj.userData.entity.params || {};
            let targetParams = p;
            if (this.activeSubMeshIndex !== -1 && p.blocks && p.blocks[this.activeSubMeshIndex] && selectedObj.userData.entity.materialMode !== 'PROCEDURAL' && selectedObj.userData.entity.materialMode !== 'MONOLITHIC') {
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
                    const config = registry ? registry[tex] : null;
                    this.matNameDisplay.innerText = config ? config.name : 'Clear Material';
                }
            } else {
                if (this.matNameDisplay) this.matNameDisplay.innerText = 'Clear Material';
            }
        }
    }

    _makePanelDraggable(panel) {
        panel.removeAttribute('draggable');

        let isDragging = false;
        let startX = 0, startY = 0;
        let initialLeft = 0, initialTop = 0;
        let containerRect, panelRect;

        // Apply a drag handle cursor only to headers (we rely on CSS for the panel root to allow normal interaction)
        const header = panel.querySelector('div:first-child');
        if (header && !header.classList.contains('mat-thumb-img')) {
            header.style.cursor = 'grab';
        }

        const onPointerDown = (e) => {
            const ignoreTags = ['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'LABEL', 'OPTION'];
            if (ignoreTags.includes(e.target.tagName) || e.target.closest('input, button, select, textarea, label')) {
                return;
            }
            
            // Ignore drags on scrollable grids and thumbnails to preserve native touch scrolling
            if (e.target.closest('.mat-lib-grid, .style-grid, .decor-grid, .mat-thumb')) {
                return;
            }

            if (e.pointerType === 'mouse' && e.button !== 0) return;

            e.preventDefault();
            e.stopPropagation();

            if (isDragging) return;
            isDragging = true;
            if (header) header.style.cursor = 'grabbing';

            containerRect = this.container.getBoundingClientRect();
            panelRect = panel.getBoundingClientRect();

            if (panel.style.bottom !== 'auto' && panel.style.bottom !== '') {
                panel.style.top = `${panelRect.top - containerRect.top}px`;
                panel.style.bottom = 'auto';
            }
            
            // Clear right so left can take over smoothly
            panel.style.right = 'auto';

            if (panel.style.transform !== 'none' && panel.style.transform !== '') {
                panel.style.left = `${panelRect.left - containerRect.left}px`;
                panel.style.transform = 'none';
            }
            
            initialLeft = parseFloat(panel.style.left);
            if (isNaN(initialLeft)) initialLeft = panelRect.left - containerRect.left;
            
            initialTop = parseFloat(panel.style.top);
            if (isNaN(initialTop)) initialTop = panelRect.top - containerRect.top;

            panel.style.left = `${initialLeft}px`;
            panel.style.top = `${initialTop}px`;
            panel.style.margin = '0px';

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
            if (header) header.style.cursor = 'grab';
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
            if (this._activeDragCleanups) {
                this._activeDragCleanups = this._activeDragCleanups.filter(fn => fn !== cleanup);
            }
        };
        
        const cleanup = () => {
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerUp);
        };
        
        if (!this._activeDragCleanups) this._activeDragCleanups = [];
        this._activeDragCleanups.push(cleanup);
        
        panel.addEventListener('pointerdown', onPointerDown);
    }

    showTransformMenu(visible) {
        if (this.ctx.isRebuildingScene) return;
        if (this.transformMenu) {
            if (this.menuVisible === visible) return;
            this.menuVisible = visible;
            
            // Toggle global body class to hide/show main UI
            if (visible) {
                
            } else {
                
            }

            if (!visible) {
                this.transformMenu.style.display = 'none';
                this.setTransformMode('none', true);
            } else {
                this.transformMenu.style.display = 'flex';
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
        if (this.btnStyle) this.btnStyle.classList.remove('active');
        if (this.btnCorner) this.btnCorner.classList.remove('active');
        if (this.btnPolygonEdges) this.btnPolygonEdges.classList.remove('active');

        if (this.ctx.interactions.openingGizmo) {
            this.ctx.interactions.openingGizmo.detach();
        }
        if (this.ctx.interactions.cornerGizmo) {
            this.ctx.interactions.cornerGizmo.detach();
        }
        if (this.ctx.interactions.vertexSlopeGizmo) {
            this.ctx.interactions.vertexSlopeGizmo.detach();
        }
        if (this.ctx.interactions.roofCornerGizmo) {
            this.ctx.interactions.roofCornerGizmo.detach();
        }
        if (this.ctx.interactions.roofOverhangGizmo) {
            this.ctx.interactions.roofOverhangGizmo.detach();
        }
        if (this.ctx.interactions.polygonGizmo) {
            this.ctx.interactions.polygonGizmo.detach();
        }
        if (this.ctx.interactions.materialGizmo && mode !== 'material') {
            this.ctx.interactions.materialGizmo.detach();
            if (selectedObj && selectedObj.userData.entity && selectedObj.userData.entity.params) {
                selectedObj.userData.entity.params.isEditingMaterials = false;
                if (this.ctx.syncToUI) this.ctx.syncToUI();
            }
        } else if (mode === 'material') {
            const selectedObj = this.ctx.interactions.selectedObject;
            if (selectedObj && selectedObj.userData.entity) {
                if (!selectedObj.userData.entity.params) selectedObj.userData.entity.params = {};
                selectedObj.userData.entity.params.isEditingMaterials = true;
                
                if (selectedObj.userData.entity.type === 'elevation_fascia' || selectedObj.userData.entity.type === 'molding' || selectedObj.userData.isWidget || selectedObj.userData.entity.type === 'wallDecor') {
                    if (typeof window !== 'undefined') coreEventBus.emit(EVENTS.MATERIAL_GIZMO_SELECT, { entity: selectedObj.userData.entity, face: 'front' });
                }
                
                if (this.ctx.syncToUI) this.ctx.syncToUI();
            }
        }

        let entity = {};
        let type = '';
        let isOpening = false;
        let supportsFaceMaterials = false;
        
        if (selectedObj) {
            entity = selectedObj.userData.entity || {};
            type = entity.type || '';
            isOpening = selectedObj.userData.isWidget || selectedObj.userData.isPattern || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type);
            supportsFaceMaterials = selectedObj.userData.isShape || selectedObj.userData.isWidget || selectedObj.userData.isMolding || selectedObj.userData.isPattern || selectedObj.userData.isWallDecor || selectedObj.userData.isRoof;
        }

        if (mode === 'none') {
            tc.visible = false;
            tc.enabled = false;
            tc.showX = false; tc.showY = false; tc.showZ = false;

            let activeGizmos = GIZMO_REGISTRY.default;
            if (selectedObj) {
                if (selectedObj.userData.isRoof) {
                    activeGizmos = GIZMO_REGISTRY.roof;
                } else if (type === 'door') {
                    activeGizmos = entity.doorType === 'french' ? GIZMO_REGISTRY.door_french : GIZMO_REGISTRY.door;
                } else if (isOpening) {
                    activeGizmos = GIZMO_REGISTRY.opening;
                } else if (type === 'elevation_fascia') {
                    activeGizmos = GIZMO_REGISTRY.elevation_fascia;
                } else if (selectedObj.userData.isFloorCutProxy) {
                    activeGizmos = GIZMO_REGISTRY.floor_cut;
                } else if (selectedObj.userData.isShape) {
                    activeGizmos = GIZMO_REGISTRY.shape;
                } else if (selectedObj.userData.isFurniture || (selectedObj.userData.entity && (selectedObj.userData.entity.type === 'furniture' || selectedObj.userData.entity.isFurniture))) {
                    activeGizmos = ['material', 'move', 'place', 'scale', 'spin', 'tilt'];
                } else if (supportsFaceMaterials) {
                    activeGizmos = GIZMO_REGISTRY.face_material_obj;
                }
            }
            
            this.btnMove.style.display = activeGizmos.includes('move') ? 'flex' : 'none';
            if (this.btnPlace) this.btnPlace.style.display = activeGizmos.includes('place') ? 'flex' : 'none';
            if (this.btnScale) this.btnScale.style.display = activeGizmos.includes('scale') ? 'flex' : 'none';
            this.btnSpin.style.display = activeGizmos.includes('spin') ? 'flex' : 'none';
            this.btnTilt.style.display = activeGizmos.includes('tilt') ? 'flex' : 'none';
            if (this.btnOpening) this.btnOpening.style.display = activeGizmos.includes('opening') ? 'flex' : 'none';
            if (this.btnMaterial) this.btnMaterial.style.display = activeGizmos.includes('material') ? 'flex' : 'none';
            if (this.btnStyle) this.btnStyle.style.display = activeGizmos.includes('style') ? 'flex' : 'none';
            if (this.btnCorner) this.btnCorner.style.display = activeGizmos.includes('corner') ? 'flex' : 'none';
            if (this.btnVertexSlope) this.btnVertexSlope.style.display = activeGizmos.includes('vertexSlope') ? 'flex' : 'none';
            if (this.btnRoofCorners) this.btnRoofCorners.style.display = activeGizmos.includes('roofCorners') ? 'flex' : 'none';
            if (this.btnRoofOverhang) this.btnRoofOverhang.style.display = activeGizmos.includes('roofCorners') ? 'flex' : 'none';
            if (this.btnPolygonEdges) this.btnPolygonEdges.style.display = activeGizmos.includes('polygonEdges') ? 'flex' : 'none';
            if (this.btnCloseMenu) this.btnCloseMenu.style.display = 'flex';
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
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
        if (this.btnStyle) this.btnStyle.style.display = 'none';
        if (this.btnCorner) this.btnCorner.style.display = 'none';
        if (this.btnVertexSlope) this.btnVertexSlope.style.display = 'none';
        if (this.btnRoofCorners) this.btnRoofCorners.style.display = 'none';
        if (this.btnRoofOverhang) this.btnRoofOverhang.style.display = 'none';
        if (this.btnPolygonEdges) this.btnPolygonEdges.style.display = 'none';
        if (this.btnCloseMenu) this.btnCloseMenu.style.display = 'none';
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

        if (mode === 'doorStyle') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnStyle) this.btnStyle.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) {
                this.stylePanel.style.display = 'flex';
                const styleNameDisplay = document.getElementById('gizmo-style-name');
                const styleThumbs = document.querySelectorAll('.style-thumb');
                const currentStyle = (selectedObj && selectedObj.userData.entity && selectedObj.userData.entity.doorStyle) ? selectedObj.userData.entity.doorStyle : 'flat';
                
                styleThumbs.forEach(t => t.style.borderColor = 'transparent');
                const activeThumb = Array.from(styleThumbs).find(t => t.getAttribute('data-style') === currentStyle);
                if (activeThumb) activeThumb.style.borderColor = '#3b82f6';
                if (styleNameDisplay) {
                    const config = DOOR_STYLES_REGISTRY[currentStyle];
                    styleNameDisplay.innerText = config ? config.name : currentStyle;
                }
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

        if (mode === 'vertex_slope') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnVertexSlope) this.btnVertexSlope.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.ctx.interactions.vertexSlopeGizmo && selectedObj) {
                this.ctx.interactions.vertexSlopeGizmo.attach(selectedObj);
            }
            return;
        }

        if (mode === 'roof_corners') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnRoofCorners) this.btnRoofCorners.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.ctx.interactions.roofCornerGizmo && selectedObj) {
                this.ctx.interactions.roofCornerGizmo.attach(selectedObj);
            }
            return;
        }

        if (mode === 'roof_overhang') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnRoofOverhang) this.btnRoofOverhang.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.ctx.interactions.roofOverhangGizmo && selectedObj) {
                this.ctx.interactions.roofOverhangGizmo.attach(selectedObj);
            }
            return;
        }

        if (mode === 'polygon_edges') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnPolygonEdges) this.btnPolygonEdges.classList.add('active');
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.ctx.interactions.polygonGizmo && selectedObj) {
                this.ctx.interactions.polygonGizmo.attach(selectedObj);
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
            this.transformMenu.style.display = 'flex';
            this.transformMenu.style.left = '';
            this.transformMenu.style.top = '';
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

    dispose() {
        if (this._activeDragCleanups) {
            this._activeDragCleanups.forEach(fn => fn());
            this._activeDragCleanups = [];
        }
        if (this.xyPanel && this.xyPanel.parentNode) this.xyPanel.parentNode.removeChild(this.xyPanel);
        if (this.openingPanel && this.openingPanel.parentNode) this.openingPanel.parentNode.removeChild(this.openingPanel);
        if (this.materialPanel && this.materialPanel.parentNode) this.materialPanel.parentNode.removeChild(this.materialPanel);
        if (this.cornerPanel && this.cornerPanel.parentNode) this.cornerPanel.parentNode.removeChild(this.cornerPanel);
        if (this.stylePanel && this.stylePanel.parentNode) this.stylePanel.parentNode.removeChild(this.stylePanel);
        if (this.transformMenu && this.transformMenu.parentNode) this.transformMenu.parentNode.removeChild(this.transformMenu);
        if (this.btnDone && this.btnDone.parentNode) this.btnDone.parentNode.removeChild(this.btnDone);
        
        // Also dispose of inner gizmos
        if (this.polygonGizmo && this.polygonGizmo.dispose) this.polygonGizmo.dispose();
        if (this.materialGizmo && this.materialGizmo.dispose) this.materialGizmo.dispose();
        if (this.openingGizmo && this.openingGizmo.dispose) this.openingGizmo.dispose();
        if (this.roofCornerGizmo && this.roofCornerGizmo.dispose) this.roofCornerGizmo.dispose();
        if (this.roofOverhangGizmo && this.roofOverhangGizmo.dispose) this.roofOverhangGizmo.dispose();
        if (this.vertexSlopeGizmo && this.vertexSlopeGizmo.dispose) this.vertexSlopeGizmo.dispose();
        if (this.cornerRadiusGizmo && this.cornerRadiusGizmo.dispose) this.cornerRadiusGizmo.dispose();
    }
}



