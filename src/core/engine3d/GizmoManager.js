import { EVENTS } from '../registry.js';
import { coreEventBus } from '../EventBus.js';
import * as THREE from 'three';
import { DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY, WOOD_REGISTRY, DOOR_STYLES_REGISTRY, ROOF_DECOR_REGISTRY, GIZMO_REGISTRY, FABRIC_REGISTRY, LEATHER_REGISTRY, FLOOR_REGISTRY, GLASS_REGISTRY, METAL_REGISTRY, STONE_REGISTRY, BRICK_REGISTRY, MARBLE_REGISTRY, PLASTIC_REGISTRY, parseCompositeMaterialKey, resolveFabricConfig, getFabricBaseConfig } from '../registry.js';
import { DEFAULT_UNIVERSAL_TILE_SIZE, PAINT_REGISTRY } from '../registries/material.registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { UniversalMaterialManager } from './UniversalMaterialManager.js';
import { BIMMaterialSystem } from './BIMMaterialSystem.js';
import { glassPreviewRenderer } from './GlassPreviewRenderer.js';
import { marblePreviewRenderer } from './MarblePreviewRenderer.js';
import { patternManager } from '../services/pattern/PatternManager.js';
import { PatternTextureBlender } from '../services/pattern/PatternTextureBlender.js';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { SLOT_DEFINITIONS } from '../constants/materialSlots.js';
import { applyWallPaintWithScope } from './WallPaintSystem.js';
import { WallEngine } from '../wall/WallEngine.js';
import { RoofEngine } from '../roof/RoofEngine.js';
export const TILE_REGISTRY = Object.fromEntries(
    Object.entries(FLOOR_REGISTRY).filter(([k, v]) => 
        k.startsWith('tile_') || 
        v.id?.startsWith('tile_') || 
        v.type === 'tile' || 
        (v.name && v.name.toLowerCase().includes('tile'))
    )
);
const WALL_REGISTRY = WALL_DECOR_REGISTRY;
const ROOF_REGISTRY = ROOF_DECOR_REGISTRY;

export class GizmoManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.container = ctx.container;
        this.menuVisible = false;
        this.materialScope = 'selectedFace'; // 'selectedFace' | 'entireObject'
    }

    init() {
        this.ctx.showTransformMenu = this.showTransformMenu.bind(this);
        
        // Pre-warm 3D preview renderers in background idle time
        glassPreviewRenderer.prewarm(GLASS_REGISTRY);

        this._onInteractionStateChanged = (state) => {
            if (state && (state.state === 'action_active' || state.activeAction)) {
                if (this.openingPanel) this.openingPanel.style.display = 'none';
                if (this.roofSpinPanel) this.roofSpinPanel.style.display = 'none';
                if (this.cornerPanel) this.cornerPanel.style.display = 'none';
                if (this.stylePanel) this.stylePanel.style.display = 'none';
                if (this.transformMenu) this.transformMenu.style.display = 'none';
                if (this.btnDone) this.btnDone.style.display = 'none';
            }
        };
        if (coreEventBus) {
            coreEventBus.on('InteractionStateChanged', this._onInteractionStateChanged);
        }

        this.transformMenu = document.createElement('div');
        this.transformMenu.className = 'transform-menu-3d';
        this.transformMenu.style.display = 'none';
        this.transformMenu.style.zIndex = '1000';

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
        this.btnMaterial.onclick = (e) => {
            if (!this._menuPointerDown) return;
            this._menuPointerDown = false;
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

        this.btnPushPull = document.createElement('button');
        this.btnPushPull.innerHTML = '↔<br>Extender';
        this.btnPushPull.className = 'transform-menu-btn';
        this.btnPushPull.title = 'Extender (Resize Room / Wall)';
        this.btnPushPull.style.display = 'none';
        this.btnPushPull.onclick = () => this.setTransformMode('wall_push_pull');
        
        this.openingPanel = document.createElement('div');
        this.openingPanel.style.display = 'none';
        this.openingPanel.style.position = 'absolute';
        this.openingPanel.style.bottom = '145px';
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
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;" id="gizmo-opening-d-container">
                    <span style="font-size:12px; color:#c084fc; font-weight:600; width: 45px;">Depth</span>
                    <input type="range" id="gizmo-opening-d-range" min="1" max="100" step="1" style="flex: 1; accent-color:#c084fc;">
                    <input type="number" id="gizmo-opening-d" step="0.1" style="width: 45px; background: transparent; border: none; border-bottom: 1px solid rgba(255,255,255,0.2); color: white; padding: 2px; font-size: 12px; outline: none; text-align: right;">
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

        // Dedicated Roof Spin & Orientation Floating Panel
        this.roofSpinPanel = document.createElement('div');
        this.roofSpinPanel.className = 'roof-spin-panel';
        this.roofSpinPanel.style.cssText = `
            display: none; position: absolute; bottom: 130px; left: 50%;
            transform: translateX(-50%); background: rgba(15, 23, 42, 0.95);
            padding: 12px 18px; border-radius: 14px; color: white;
            pointer-events: auto; box-shadow: 0 10px 30px rgba(0,0,0,0.6);
            border: 1px solid rgba(99, 102, 241, 0.4); backdrop-filter: blur(12px);
            z-index: 1000; flex-direction: column; gap: 10px; min-width: 280px;
        `;
        this.roofSpinPanel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
                <span style="font-size: 11px; font-weight: 800; color: #818cf8; letter-spacing: 0.8px; display: flex; align-items: center; gap: 6px;">
                    ⭮ ROOF SPIN & ORIENTATION
                </span>
                <span id="gizmo-roof-angle-display" style="font-size: 12px; font-weight: 700; color: #fde047;">0°</span>
            </div>
            
            <div style="display: flex; gap: 8px;">
                <button id="gizmo-roof-spin-ccw90" style="flex: 1; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.5); color: white; border-radius: 6px; padding: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">↺ -90°</button>
                <button id="gizmo-roof-spin-cw90" style="flex: 1; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.5); color: white; border-radius: 6px; padding: 6px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s;">↻ +90°</button>
                <button id="gizmo-roof-flip-ridge" style="flex: 1.2; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.5); color: #fde047; border-radius: 6px; padding: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: all 0.2s;">↔ Flip Axis</button>
            </div>

            <div style="display: flex; gap: 4px; justify-content: space-between;">
                <button class="gizmo-roof-angle-preset" data-angle="0" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer;">0°</button>
                <button class="gizmo-roof-angle-preset" data-angle="45" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer;">45°</button>
                <button class="gizmo-roof-angle-preset" data-angle="90" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer;">90°</button>
                <button class="gizmo-roof-angle-preset" data-angle="180" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer;">180°</button>
                <button class="gizmo-roof-angle-preset" data-angle="270" style="flex: 1; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: white; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer;">270°</button>
            </div>

            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 11px; color: #94a3b8; width: 32px;">Angle</span>
                <input type="range" id="gizmo-roof-angle-slider" min="0" max="360" step="1" style="flex: 1; accent-color: #6366f1; cursor: pointer;">
                <input type="number" id="gizmo-roof-angle-input" min="0" max="360" step="1" style="width: 42px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 2px 4px; font-size: 11px; text-align: right;">
            </div>
        `;
        this.roofSpinPanel.addEventListener('pointerdown', e => e.stopPropagation());
        this.container.appendChild(this.roofSpinPanel);
        this._initRoofSpinPanelEvents();
        
        // Add custom styles for the new Material Library
        if (!document.getElementById('gizmo-material-styles')) {
            const style = document.createElement('style');
            style.id = 'gizmo-material-styles';
            style.innerHTML = `
                /* sms 4 Style Non-Obtrusive Light 3D Material HUD & Catalog Dock */
                .mat-lib-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: transparent !important;
                    z-index: 99999;
                    display: flex; flex-direction: column; justify-content: space-between;
                    padding: 0; box-sizing: border-box;
                    opacity: 0; pointer-events: none !important;
                    transition: opacity 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .mat-lib-overlay.active {
                    opacity: 1; pointer-events: none !important;
                }

                /* 1. Top Space-Saving Controls Ribbon Disabled */
                .mat-sms4-top-hud {
                    display: none !important;
                }

                .mat-hud-chip {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    background: #f8fafc;
                    border: 1px solid #e2e8f0;
                    padding: 2px 8px 2px 4px;
                    border-radius: 999px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }
                .mat-hud-chip:hover {
                    background: #f1f5f9;
                    border-color: #cbd5e1;
                }

                .mat-hud-thumb {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    background-color: #2563eb;
                    background-size: cover;
                    background-position: center;
                    border: 1.5px solid #ffffff;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
                    flex-shrink: 0;
                }

                .mat-hud-info {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    line-height: 1.1;
                }

                .mat-hud-label {
                    font-size: 7.5px;
                    font-weight: 800;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .mat-hud-name {
                    font-size: 11px;
                    font-weight: 700;
                    color: #0f172a;
                    max-width: 120px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .mat-hud-toggle-tray-btn {
                    background: #eff6ff;
                    border: 1px solid #bfdbfe;
                    color: #2563eb;
                    font-size: 9.5px;
                    font-weight: 700;
                    padding: 2px 7px;
                    border-radius: 999px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    margin-left: 2px;
                }
                .mat-hud-toggle-tray-btn:hover {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: #ffffff;
                }

                .mat-hud-divider {
                    width: 1px;
                    height: 18px;
                    background: #e2e8f0;
                    flex-shrink: 0;
                }

                .mat-hud-scope-group, .mat-hud-face-group {
                    display: inline-flex;
                    background: #f1f5f9;
                    padding: 2px;
                    border-radius: 999px;
                    border: 1px solid #e2e8f0;
                    gap: 2px;
                    flex-shrink: 0;
                }

                .mat-scope-pill, .mat-face-pill {
                    padding: 3px 8px;
                    border-radius: 999px;
                    border: none;
                    background: transparent;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                }
                .mat-scope-pill:hover, .mat-face-pill:hover {
                    color: #0f172a;
                    background: #e2e8f0;
                }
                .mat-scope-pill.active, .mat-face-pill.active {
                    background: #2563eb !important;
                    color: #ffffff !important;
                    box-shadow: 0 1px 4px rgba(37, 99, 235, 0.35);
                }

                .mat-hud-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 8px;
                    border-radius: 999px;
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    color: #475569;
                    font-size: 10.5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }
                .mat-hud-btn:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                }
                .mat-hud-btn.active {
                    background: #0284c7 !important;
                    color: #ffffff !important;
                    font-weight: 700;
                    border-color: #0284c7 !important;
                    box-shadow: 0 1px 6px rgba(2, 132, 199, 0.35);
                }

                .mat-hud-session-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                }
                .mat-hud-done-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 3px 10px;
                    border-radius: 999px;
                    border: none;
                    background: #10b981;
                    color: #ffffff;
                    font-size: 11px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    box-shadow: 0 1px 4px rgba(16, 185, 129, 0.35);
                    flex-shrink: 0;
                }
                .mat-hud-done-btn:hover {
                    background: #059669;
                    box-shadow: 0 2px 6px rgba(16, 185, 129, 0.45);
                }
                .mat-hud-cancel-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    padding: 3px 8px;
                    border-radius: 999px;
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    color: #64748b;
                    font-size: 10.5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }
                .mat-hud-cancel-btn:hover {
                    background: #fee2e2;
                    color: #ef4444;
                    border-color: #fca5a5;
                }

                .mat-dock-actions {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    flex-shrink: 0;
                }
                .mat-dock-btn-pick {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #cbd5e1;
                    padding: 2.5px 8px;
                    border-radius: 6px;
                    font-size: 10.5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .mat-dock-btn-pick:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                }
                .mat-dock-btn-pick.active {
                    background: #3b82f6;
                    color: #ffffff;
                    border-color: #2563eb;
                }
                .mat-dock-btn-done {
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                    background: #10b981;
                    color: white;
                    border: none;
                    padding: 2.5px 10px;
                    border-radius: 6px;
                    font-size: 10.5px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    box-shadow: 0 1px 3px rgba(16, 185, 129, 0.3);
                }
                .mat-dock-btn-done:hover {
                    background: #059669;
                }
                .mat-dock-btn-cancel {
                    display: inline-flex;
                    align-items: center;
                    gap: 2px;
                    background: #fee2e2;
                    color: #ef4444;
                    border: 1px solid #fca5a5;
                    padding: 2.5px 7px;
                    border-radius: 6px;
                    font-size: 10.5px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.15s ease;
                }
                .mat-dock-btn-cancel:hover {
                    background: #fecaca;
                }

                .mat-hud-close-btn {
                    width: 22px;
                    height: 22px;
                    border-radius: 50%;
                    border: 1px solid #e2e8f0;
                    background: #f8fafc;
                    color: #64748b;
                    font-size: 14px;
                    line-height: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    flex-shrink: 0;
                }
                .mat-hud-close-btn:hover {
                    background: #fee2e2;
                    border-color: #fca5a5;
                    color: #ef4444;
                }

                /* Mobile Optimization (< 640px) */
                @media (max-width: 640px) {
                    .mat-sms4-top-hud {
                        display: none !important;
                    }
                    .mat-sms4-bottom-dock {
                        bottom: 0 !important;
                        left: 0 !important;
                        right: 0 !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        transform: none !important;
                        border-radius: 14px 14px 0 0 !important;
                        max-height: 168px !important;
                    }
                    .mat-dock-actions {
                        display: flex !important;
                    }
                }

                /* Tablet Optimization (641px - 1024px) */
                @media (min-width: 641px) and (max-width: 1024px) {
                    .mat-sms4-top-hud {
                        display: none !important;
                    }
                    .mat-sms4-bottom-dock {
                        bottom: 10px !important;
                        left: 16px !important;
                        right: 16px !important;
                        width: auto !important;
                        max-width: 100% !important;
                        transform: none !important;
                        border-radius: 12px !important;
                    }
                }

                /* 2. Docked Bottom Material Tray (Light Theme, Ultra Compact) */
                .mat-sms4-bottom-dock {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    width: 100vw;
                    background: rgba(255, 255, 255, 0.97);
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border-top: 1px solid #e2e8f0;
                    box-shadow: 0 -4px 20px -2px rgba(15, 23, 42, 0.08);
                    z-index: 10000;
                    pointer-events: auto !important;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
                    box-sizing: border-box;
                    max-height: 160px;
                }
                .mat-sms4-bottom-dock.collapsed {
                    transform: translateY(calc(100% - 32px));
                }

                .mat-dock-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 4px 10px;
                    border-bottom: 1px solid #e2e8f0;
                    background: #f8fafc;
                    gap: 6px;
                    flex-shrink: 0;
                    height: 32px;
                    box-sizing: border-box;
                }

                .mat-cat-nav-wrapper {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    flex: 1;
                    min-width: 0;
                    overflow: hidden;
                }

                .mat-cat-scroll-arrow {
                    background: #ffffff;
                    border: 1px solid #cbd5e1;
                    border-radius: 999px;
                    color: #475569;
                    cursor: pointer;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 8px;
                    font-weight: bold;
                    flex-shrink: 0;
                    transition: all 0.15s ease;
                    user-select: none;
                    padding: 0;
                }
                .mat-cat-scroll-arrow:hover {
                    background: #2563eb;
                    border-color: #2563eb;
                    color: #ffffff;
                }

                .mat-dock-categories {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    overflow-x: auto;
                    scrollbar-width: none;
                    flex: 1;
                    min-width: 0;
                }
                .mat-dock-categories::-webkit-scrollbar {
                    display: none;
                }

                .mat-cat-tab-btn {
                    padding: 3px 9px;
                    border-radius: 999px;
                    border: 1px solid #e2e8f0;
                    background: #ffffff;
                    color: #475569;
                    font-size: 10.5px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                .mat-cat-tab-btn:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                    border-color: #cbd5e1;
                }
                .mat-cat-tab-btn.active {
                    background: #2563eb !important;
                    border-color: #2563eb !important;
                    color: #ffffff !important;
                    box-shadow: 0 1px 6px rgba(37, 99, 235, 0.3);
                }

                /* Wall Multi-Material Sub-bar */
                .mat-dock-subbar {
                    display: none;
                    align-items: center;
                    justify-content: flex-start;
                    gap: 6px;
                    padding: 2px 10px;
                    background: #f1f5f9;
                    border-bottom: 1px solid #e2e8f0;
                    box-sizing: border-box;
                    flex-shrink: 0;
                    height: 28px;
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                .mat-dock-subbar::-webkit-scrollbar {
                    display: none;
                }
                .mat-dock-face-group, .mat-dock-scope-group {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    flex-shrink: 0;
                }
                .mat-dock-face-pill, .mat-dock-scope-pill {
                    padding: 2px 8px;
                    border-radius: 999px;
                    border: 1px solid #cbd5e1;
                    background: #ffffff;
                    color: #475569;
                    font-size: 10px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    white-space: nowrap;
                    line-height: 1.4;
                    flex-shrink: 0;
                }
                .mat-dock-face-pill:hover, .mat-dock-scope-pill:hover {
                    background: #e2e8f0;
                    color: #0f172a;
                }
                .mat-dock-face-pill.active, .mat-dock-scope-pill.active {
                    background: #0284c7 !important;
                    border-color: #0284c7 !important;
                    color: #ffffff !important;
                    box-shadow: 0 1px 4px rgba(2, 132, 199, 0.35);
                }
                .mat-dock-divider {
                    width: 1px;
                    height: 14px;
                    background: #cbd5e1;
                    flex-shrink: 0;
                }

                .mat-dock-collapse-btn {
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    color: #64748b;
                    width: 24px;
                    height: 24px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    font-size: 10px;
                    flex-shrink: 0;
                }
                .mat-dock-collapse-btn:hover {
                    background: #f1f5f9;
                    color: #0f172a;
                }

                /* Compact Swatch Card Styling inside the Dock (Light Theme) */
                .mat-lib-grid-wrapper {
                    width: 100%; overflow-x: auto; padding: 6px 10px 8px 10px; pointer-events: auto;
                    scrollbar-width: thin; scrollbar-color: #cbd5e1 transparent;
                    -webkit-overflow-scrolling: touch; scroll-behavior: smooth;
                    box-sizing: border-box;
                }
                .mat-lib-grid {
                    display: flex; flex-direction: row; gap: 8px; align-items: stretch; width: max-content; min-width: 100%;
                }
                .mat-card {
                    width: 70px; height: 86px; border-radius: 10px;
                    background: #ffffff;
                    border: 1px solid #e2e8f0;
                    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
                    display: flex; flex-direction: column; align-items: center; justify-content: center;
                    padding: 4px; box-sizing: border-box; cursor: pointer;
                    transition: all 0.15s cubic-bezier(0.16, 1, 0.3, 1); position: relative;
                    user-select: none; flex-shrink: 0; touch-action: pan-x;
                }
                .mat-card:hover {
                    transform: translateY(-2px);
                    border-color: #cbd5e1;
                    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
                }
                .mat-card.active-card {
                    border: 2px solid #2563eb !important;
                    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.18), 0 2px 8px rgba(37, 99, 235, 0.15) !important;
                }
                .mat-card-selected-checkmark {
                    position: absolute; top: 3px; right: 3px;
                    width: 14px; height: 14px; border-radius: 50%;
                    background: #2563eb; color: #ffffff;
                    font-size: 9px; font-weight: bold;
                    display: none; align-items: center; justify-content: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    z-index: 2;
                }
                .mat-card.active-card .mat-card-selected-checkmark {
                    display: flex;
                }
                .mat-sphere {
                    width: 44px; height: 44px; border-radius: 50%; position: relative;
                    margin: 2px 0;
                    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.15), inset 0 1px 1px rgba(255, 255, 255, 0.4);
                    border: 1px solid rgba(0, 0, 0, 0.08);
                    overflow: hidden; background-size: cover; background-position: center;
                    transition: transform 0.15s ease; flex-shrink: 0;
                }
                .mat-sphere::after {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%;
                    background: radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.5) 0%, rgba(255, 255, 255, 0.05) 50%, rgba(0, 0, 0, 0.25) 100%);
                    pointer-events: none;
                }
                .mat-card-title {
                    color: #0f172a; font-weight: 600; font-size: 9.5px; margin-top: 3px; text-align: center;
                    width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .mat-card-sub {
                    display: none;
                }

                @media (max-width: 768px) {
                    .mat-sms4-top-hud { padding: 3px 6px; gap: 4px; top: 6px; }
                    .mat-hud-name { max-width: 80px; font-size: 10px; }
                    .mat-scope-pill, .mat-face-pill { padding: 2.5px 5px; font-size: 9px; }
                    .mat-card { width: 64px; height: 80px; }
                    .mat-sphere { width: 38px; height: 38px; }
                }
            `;
            document.head.appendChild(style);
        }

        this.materialPanel = document.createElement('div');
        this.materialPanel.className = 'mat-lib-overlay';
        this.materialPanel.style.display = 'none';
        
        this.materialPanel.innerHTML = `
            <!-- Fallback hidden subtitle element for legacy references -->
            <span id="gizmo-material-face-name" style="display: none;">Select Material Type</span>

            <!-- Docked Bottom Material Catalog Tray -->
            <div class="mat-sms4-bottom-dock" id="mat-sms4-bottom-dock">
                <div class="mat-dock-header">
                    <div class="mat-cat-nav-wrapper">
                        <button class="mat-cat-scroll-arrow" id="mat-cat-scroll-left" title="Scroll categories left">◀</button>
                        <div class="mat-dock-categories" id="mat-dock-categories-bar"></div>
                        <button class="mat-cat-scroll-arrow" id="mat-cat-scroll-right" title="Scroll categories right">▶</button>
                    </div>
                    <div class="mat-search-pill" style="padding: 2px 8px; height: 24px; background: #ffffff; border-radius: 999px; border: 1px solid #e2e8f0; display: flex; align-items: center; width: 90px; flex-shrink: 0;">
                        <svg style="width: 12px; height: 12px; color: #94a3b8; margin-right: 4px; flex-shrink: 0;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input id="mat-lib-search-input" type="text" placeholder="Search..." style="background: transparent; border: none; color: #0f172a; outline: none; width: 100%; font-size: 10.5px; font-family: inherit;">
                    </div>
                    <div class="mat-dock-actions" id="mat-dock-actions">
                        <button class="mat-dock-btn-pick" id="mat-eyedropper-btn" title="Eyedropper: Sample material from scene">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m14 2 4 4-8.5 8.5H5.5v-4L14 2z"/><line x1="16" y1="4" x2="20" y2="8"/><line x1="2" y1="22" x2="6" y2="18"/></svg>
                            <span>Pick</span>
                        </button>
                        <button class="mat-dock-btn-done" id="mat-dock-btn-done" title="Commit all material changes (Enter)">✓ Done</button>
                        <button class="mat-dock-btn-cancel" id="mat-dock-btn-cancel" title="Discard changes (Esc)">✕</button>
                    </div>
                    <button class="mat-dock-collapse-btn" id="mat-dock-collapse-btn" title="Collapse / Expand Material Catalog">
                        ▼
                    </button>
                </div>

                <!-- Dock Subbar: Multi-material Wall Faces & Scope Selector -->
                <div class="mat-dock-subbar" id="mat-dock-subbar">
                    <div class="mat-dock-face-group" id="mat-dock-face-group">
                        <button class="mat-dock-face-pill active" data-side="front" title="Inner Face (Face 1)">🧱 Inner Face</button>
                        <button class="mat-dock-face-pill" data-side="back" title="Outer Face (Face 2)">🧱 Outer Face</button>
                        <button class="mat-dock-face-pill" data-side="both" title="Both Inner & Outer Faces">📦 Both Faces</button>
                    </div>
                    <div class="mat-dock-divider"></div>
                    <div class="mat-dock-scope-group" id="mat-dock-scope-group">
                        <button class="mat-dock-scope-pill active" data-scope="selectedFace" title="Paint clicked face only">Single</button>
                        <button class="mat-dock-scope-pill" data-scope="room" title="Paint all room walls (Shift)">Room (Shift)</button>
                        <button class="mat-dock-scope-pill" data-scope="exterior" title="Paint entire exterior facade (Alt)">Exterior (Alt)</button>
                    </div>
                </div>

                <!-- Horizontal Scrolling Swatches Grid -->
                <div class="mat-lib-grid-wrapper">
                    <div id="gizmo-material-grid" class="mat-lib-grid"></div>
                </div>

                <!-- Hidden / Subgroup tabs container for decor layer controls -->
            </div>
        `;
        
        // Block pointer events from hitting the 3D scene below only when interacting with HUD or dock elements
        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'touchstart', 'touchend', 'touchmove'].forEach(evt => {
            this.materialPanel.addEventListener(evt, e => {
                if (e.target.closest('.mat-sms4-top-hud, .mat-sms4-bottom-dock, .mat-lib-grid-wrapper, #gizmo-subgroup-tabs-container, .gizmo-wall-target-bar, .gizmo-decor-chip, .gizmo-decor-card, .gizmo-slider, .gizmo-input-num, input, button')) {
                    e.stopPropagation();
                }
            }, { passive: false });
        });
        
        // Close and session management logic
        this.closeMaterialPanel = (isCommitted = false) => {
            this.materialPanel.classList.remove('active');
            if (!isCommitted && this.ctx?.commonTools?.paintSystem?.isSessionActive) {
                this.ctx.commonTools.paintSystem.cancelSession();
            }
            setTimeout(() => {
                this.materialPanel.style.display = 'none';
                if (this.currentTransformMode === 'material') {
                    this.setTransformMode('none');
                }
                if (this.ctx?.commonTools?.paintSystem) {
                    this.ctx.commonTools.paintSystem.setActive(false);
                }
            }, 250);
        };

        const handleCommitMaterialSession = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (this.ctx?.commonTools?.commitMaterialSession) {
                this.ctx.commonTools.commitMaterialSession();
            } else if (this.ctx?.commonTools?.paintSystem?.commitSession) {
                this.ctx.commonTools.paintSystem.commitSession();
            } else {
                this.closeMaterialPanel(true);
            }
        };

        const handleCancelMaterialSession = (e) => {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (this.ctx?.commonTools?.cancelMaterialSession) {
                this.ctx.commonTools.cancelMaterialSession();
            } else if (this.ctx?.commonTools?.paintSystem?.cancelSession) {
                this.ctx.commonTools.paintSystem.cancelSession();
            } else {
                this.closeMaterialPanel(false);
            }
        };

        this.materialPanel.querySelector('#mat-hud-done-btn')?.addEventListener('click', handleCommitMaterialSession);
        this.materialPanel.querySelector('#mat-dock-btn-done')?.addEventListener('click', handleCommitMaterialSession);
        this.materialPanel.querySelector('#mat-hud-cancel-btn')?.addEventListener('click', handleCancelMaterialSession);
        this.materialPanel.querySelector('#mat-dock-btn-cancel')?.addEventListener('click', handleCancelMaterialSession);
        this.materialPanel.querySelector('#close-material-lib')?.addEventListener('click', handleCancelMaterialSession);

        const clearBrushBtn = this.materialPanel.querySelector('#mat-clear-brush-btn');
        if (clearBrushBtn) {
            clearBrushBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.activeMaterialKey = null;
                this.updateActiveBrushUI(null);
                if (this.ctx?.commonTools?.paintSystem) {
                    this.ctx.commonTools.paintSystem.setActiveMaterial(null);
                    this.ctx.commonTools.paintSystem.lockedCategory = null;
                }
                if (this.highlightSelectedThumb) {
                    this.highlightSelectedThumb(null);
                }
                if (this.ctx?.requestRender) {
                    this.ctx.requestRender('clear_material_brush');
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (!this.materialPanel || this.materialPanel.style.display === 'none') return;
            if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
                if (e.key === 'Escape') e.target.blur();
                return;
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                handleCommitMaterialSession(e);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                handleCancelMaterialSession(e);
            }
        });

        // Scope pills in Top HUD
        const scopeBtns = this.materialPanel.querySelectorAll('.mat-scope-pill');
        scopeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                scopeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const scope = btn.getAttribute('data-scope');
                this.materialScope = scope;
                if (this.ctx?.commonTools?.paintSystem) {
                    this.ctx.commonTools.paintSystem.setMaterialScope(scope);
                }
                const selectedObj = this.ctx?.interactions?.selectedObject;
                if (selectedObj?.userData?.entity) {
                    this._updateDockWallPills(selectedObj.userData.entity);
                    this._renderWallMultiMaterialTabs(selectedObj.userData.entity, selectedObj);
                }
            });
        });

        // Face pills in Top HUD
        const faceBtns = this.materialPanel.querySelectorAll('.mat-face-pill');
        faceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                faceBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.activeFace = btn.getAttribute('data-side');
                this.materialScope = 'selectedFace';
                if (this.ctx?.commonTools?.paintSystem) {
                    this.ctx.commonTools.paintSystem.setMaterialScope('selectedFace');
                }
                const selectedObj = this.ctx?.interactions?.selectedObject;
                if (selectedObj?.userData?.entity) {
                    const wall = selectedObj.userData.entity;
                    const matOnSide = (this.activeFace === 'back') ? (wall.params?.textureBack || wall.textureBack || wall.params?.texture || wall.texture) : (wall.params?.textureFront || wall.textureFront || wall.params?.texture || wall.texture);
                    if (matOnSide) {
                        this.activeMaterialKey = matOnSide;
                        this.updateActiveBrushUI(matOnSide);
                        if (this.ctx?.commonTools?.paintSystem) {
                            this.ctx.commonTools.paintSystem.setActiveMaterial(matOnSide);
                        }
                        if (this.highlightSelectedThumb) {
                            this.highlightSelectedThumb(matOnSide);
                        }
                    }
                    this._updateDockWallPills(wall);
                    this._renderWallMultiMaterialTabs(selectedObj.userData.entity, selectedObj);
                }
            });
        });

        // Face pills in Dock Sub-bar
        const dockFaceBtns = this.materialPanel.querySelectorAll('.mat-dock-face-pill');
        dockFaceBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const side = btn.getAttribute('data-side');
                const selectedObj = this.ctx?.interactions?.selectedObject;
                const wall = selectedObj?.userData?.entity;

                if (side === 'both') {
                    this.materialScope = 'entireObject';
                    if (this.ctx?.commonTools?.paintSystem) {
                        this.ctx.commonTools.paintSystem.setMaterialScope('entireObject');
                    }
                } else {
                    this.activeFace = side;
                    this.materialScope = 'selectedFace';
                    if (this.ctx?.commonTools?.paintSystem) {
                        this.ctx.commonTools.paintSystem.setMaterialScope('selectedFace');
                    }
                    if (wall) {
                        const matOnSide = (side === 'back') 
                            ? (wall.params?.textureBack || wall.textureBack || wall.params?.texture || wall.texture) 
                            : (wall.params?.textureFront || wall.textureFront || wall.params?.texture || wall.texture);
                        if (matOnSide) {
                            this.activeMaterialKey = matOnSide;
                            this.updateActiveBrushUI(matOnSide);
                            if (this.ctx?.commonTools?.paintSystem) {
                                this.ctx.commonTools.paintSystem.setActiveMaterial(matOnSide);
                            }
                            if (this.highlightSelectedThumb) {
                                this.highlightSelectedThumb(matOnSide);
                            }
                        }
                    }
                }
                if (wall) {
                    this._updateDockWallPills(wall);
                    this._renderWallMultiMaterialTabs(wall, selectedObj);
                }
            });
        });

        // Scope pills in Dock Sub-bar
        const dockScopeBtns = this.materialPanel.querySelectorAll('.mat-dock-scope-pill');
        dockScopeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const scope = btn.getAttribute('data-scope');
                this.materialScope = scope;
                if (this.ctx?.commonTools?.paintSystem) {
                    this.ctx.commonTools.paintSystem.setMaterialScope(scope);
                }
                const selectedObj = this.ctx?.interactions?.selectedObject;
                if (selectedObj?.userData?.entity) {
                    this._updateDockWallPills(selectedObj.userData.entity);
                    this._renderWallMultiMaterialTabs(selectedObj.userData.entity, selectedObj);
                }
            });
        });

        // Eyedropper button in Top HUD
        const eyedropperBtn = this.materialPanel.querySelector('#mat-eyedropper-btn');
        if (eyedropperBtn) {
            eyedropperBtn.addEventListener('click', () => {
                const paintSys = this.ctx?.commonTools?.paintSystem;
                if (paintSys) {
                    const nextState = !paintSys.isEyedropper;
                    paintSys.setEyedropper(nextState);
                    eyedropperBtn.classList.toggle('active', nextState);
                }
            });
        }

        // Toggle Catalog Tray collapse/expand
        const toggleDock = () => {
            const dock = this.materialPanel.querySelector('#mat-sms4-bottom-dock');
            const collapseBtn = this.materialPanel.querySelector('#mat-dock-collapse-btn');
            const trayBtn = this.materialPanel.querySelector('#mat-toggle-tray-btn');
            if (!dock) return;
            dock.classList.toggle('collapsed');
            const isCollapsed = dock.classList.contains('collapsed');
            if (collapseBtn) collapseBtn.textContent = isCollapsed ? '▲' : '▼';
            if (trayBtn) trayBtn.textContent = isCollapsed ? '▲ Swatches' : '▼ Swatches';
        };
        this.materialPanel.querySelector('#mat-dock-collapse-btn')?.addEventListener('click', toggleDock);
        this.materialPanel.querySelector('#mat-toggle-tray-btn')?.addEventListener('click', toggleDock);

        // Update Active Brush UI in Top HUD
        this.updateActiveBrushUI = (matKeyOrConfig) => {
            if (!this.materialPanel) return;
            const nameEl = this.materialPanel.querySelector('#mat-hud-brush-name');
            const thumbEl = this.materialPanel.querySelector('#mat-hud-brush-thumb');
            const clearBtn = this.materialPanel.querySelector('#mat-clear-brush-btn');
            if (!matKeyOrConfig) {
                if (nameEl) nameEl.textContent = 'Select Material';
                if (thumbEl) { thumbEl.style.backgroundImage = ''; thumbEl.style.backgroundColor = '#94a3b8'; }
                if (clearBtn) clearBtn.style.display = 'none';
                return;
            }
            if (clearBtn) clearBtn.style.display = 'inline-flex';
            if (matKeyOrConfig === '__default__' || matKeyOrConfig === 'default') {
                if (nameEl) nameEl.textContent = 'Default (Clear)';
                if (thumbEl) {
                    thumbEl.style.backgroundImage = '';
                    thumbEl.style.backgroundColor = '#f1f5f9';
                    thumbEl.style.border = '1.5px dashed #94a3b8';
                }
                return;
            }
            if (thumbEl) thumbEl.style.border = '1.5px solid #ffffff';
            const conf = MaterialManager.resolveMaterialConfig(matKeyOrConfig) || {};
            const title = conf.name || (typeof matKeyOrConfig === 'string' ? matKeyOrConfig : (conf.id || 'Material'));
            const cleanTitle = title.replace(/^(wood|stone|brick|marble|floor|paint)_/, '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            if (nameEl) nameEl.textContent = cleanTitle;
            const thumbUrl = conf.thumbnail || conf.texture || conf.map || conf.diffuseMap;
            if (thumbEl) {
                if (thumbUrl) {
                    thumbEl.style.backgroundImage = `url('${thumbUrl}')`;
                    thumbEl.style.backgroundColor = 'transparent';
                } else if (conf.color !== undefined) {
                    thumbEl.style.backgroundImage = '';
                    thumbEl.style.backgroundColor = typeof conf.color === 'number' ? ('#' + conf.color.toString(16).padStart(6, '0')) : conf.color;
                } else {
                    thumbEl.style.backgroundImage = '';
                    thumbEl.style.backgroundColor = '#3b82f6';
                }
            }
        };

        this.updateEyedropperUI = (active) => {
            if (!this.materialPanel) return;
            const btn = this.materialPanel.querySelector('#mat-eyedropper-btn');
            if (btn) btn.classList.toggle('active', !!active);
        };

        // Add search filtering logic
        const searchInput = this.materialPanel.querySelector('#mat-lib-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const q = e.target.value.toLowerCase().trim();
                const cards = this.materialPanel.querySelectorAll('.mat-card');
                cards.forEach(card => {
                    const titleEl = card.querySelector('.mat-card-title') || card;
                    const text = titleEl.textContent.toLowerCase();
                    card.style.display = text.includes(q) || q === '' ? 'flex' : 'none';
                });
            });
        }

        document.body.appendChild(this.materialPanel);

        this.cornerPanel = document.createElement('div');
        this.cornerPanel.style.display = 'none';
        this.cornerPanel.style.position = 'absolute';
        this.cornerPanel.style.bottom = '145px';
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
        this.btnDone.style.bottom = '74px';
        this.btnDone.style.left = '50%';
        this.btnDone.style.transform = 'translateX(-50%)';
        this.btnDone.style.background = '#059669';
        this.btnDone.style.border = '1px solid rgba(52, 211, 153, 0.9)';
        this.btnDone.style.color = 'white';
        this.btnDone.style.padding = '8px 26px';
        this.btnDone.style.borderRadius = '24px';
        this.btnDone.style.fontWeight = '700';
        this.btnDone.style.fontSize = '14px';
        this.btnDone.style.boxShadow = '0 6px 20px rgba(5, 150, 105, 0.45), 0 2px 6px rgba(0,0,0,0.2)';
        this.btnDone.style.cursor = 'pointer';
        this.btnDone.style.zIndex = '3000';
        this.btnDone.style.display = 'none';
        this.btnDone.style.alignItems = 'center';
        this.btnDone.style.justifyContent = 'center';
        this.btnDone.onclick = () => this.setTransformMode('none');

        this.stylePanel = document.createElement('div');
        this.stylePanel.style.display = 'none';
        this.stylePanel.style.position = 'absolute';
        this.stylePanel.style.bottom = '145px';
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
        this.transformMenu.appendChild(this.btnPushPull);

        this.btnDelete = document.createElement('button');
        this.btnDelete.className = 'transform-menu-btn delete-btn';
        this.btnDelete.innerHTML = '🗑️<br>Delete';
        this.btnDelete.style.display = 'none';
        this.btnDelete.onclick = () => {
            const ent = this.ctx.interactions?.selectedObject?.userData?.entity;
            if (ent) {
                if (this.ctx.onDeleteRequested) {
                    this.ctx.onDeleteRequested(ent);
                } else if (this.ctx.planner?.delete) {
                    this.ctx.planner.delete(ent.id || ent);
                } else if (typeof window !== 'undefined' && window.planner?.delete) {
                    window.planner.delete(ent.id || ent);
                }
            }
            if (this.ctx.interactions) this.ctx.interactions.deselect();
        };
        this.transformMenu.appendChild(this.btnDelete);
        
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
        ['pointerdown', 'touchstart', 'mousedown'].forEach(evt => {
            this.transformMenu.addEventListener(evt, e => {
                this._menuPointerDown = true;
                e.stopPropagation();
            }, { passive: true });
        });
        ['wheel', 'pointerup', 'touchend', 'click'].forEach(evt => {
            this.transformMenu.addEventListener(evt, e => e.stopPropagation(), { passive: true });
        });
        this.container.appendChild(this.btnDone);

        this._makePanelDraggable(this.openingPanel);
        this._makePanelDraggable(this.stylePanel);
        this._makePanelDraggable(this.cornerPanel);

        setTimeout(() => {
            const opW = document.getElementById('gizmo-opening-w');
            const opWR = document.getElementById('gizmo-opening-w-range');
            const opH = document.getElementById('gizmo-opening-h');
            const opHR = document.getElementById('gizmo-opening-h-range');
            const opE = document.getElementById('gizmo-opening-e');
            const opER = document.getElementById('gizmo-opening-e-range');
            const opD = document.getElementById('gizmo-opening-d');
            const opDR = document.getElementById('gizmo-opening-d-range');
            const updateOpeningPos = (prop, val) => {
                if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                    const entity = this.ctx.interactions.selectedObject.userData.entity;
                    if (prop === 'width') entity.width = val;
                    if (prop === 'height') entity.height = val;
                    if (prop === 'elevation') entity.elevation = val;
                    if (prop === 'depth') {
                        entity.depth = val;
                        if (entity.params) entity.params.depth = val;
                    }
                    
                    if (this.ctx.realtimeUpdate) {
                        this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
                    }
                    
                    if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
                    if (this.ctx.interactions.openingGizmo) this.ctx.interactions.openingGizmo.updateHandles();
                    this.updateOpeningPanel(entity);
                    coreEventBus.emit(EVENTS.OPENING_GIZMO_CHANGE, { entity });
                }
            };
            if (opW) { opW.addEventListener('input', e => updateOpeningPos('width', parseFloat(e.target.value))); opWR.addEventListener('input', e => updateOpeningPos('width', parseFloat(e.target.value))); }
            if (opH) { opH.addEventListener('input', e => updateOpeningPos('height', parseFloat(e.target.value))); opHR.addEventListener('input', e => updateOpeningPos('height', parseFloat(e.target.value))); }
            if (opE) { opE.addEventListener('input', e => updateOpeningPos('elevation', parseFloat(e.target.value))); opER.addEventListener('input', e => updateOpeningPos('elevation', parseFloat(e.target.value))); }
            if (opD) { opD.addEventListener('input', e => updateOpeningPos('depth', parseFloat(e.target.value))); opDR.addEventListener('input', e => updateOpeningPos('depth', parseFloat(e.target.value))); }
            
            const flipInOutBtn = document.getElementById('gizmo-opening-flip-inout');
            const flipLRBtn = document.getElementById('gizmo-opening-flip-lr');
            const typeSelect = document.getElementById('gizmo-opening-type');

            if (flipInOutBtn) {
                flipInOutBtn.addEventListener('click', () => {
                    if (this.ctx.interactions.selectedObject && this.ctx.interactions.selectedObject.userData.entity) {
                        const entity = this.ctx.interactions.selectedObject.userData.entity;
                        entity.facing = (entity.facing === 1) ? -1 : 1;
                        if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
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
                        if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
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
                        if (this.ctx.realtimeUpdate) this.ctx.realtimeUpdate.markDirty(entity, 'geometry');
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
                currentThumbs.forEach(t => {
                    t.classList.remove('active-card');
                    t.style.borderColor = '';
                });
                if (texKey !== undefined) {
                    const activeThumb = Array.from(currentThumbs).find(t => t.getAttribute('data-mat') === (texKey || ''));
                    if (activeThumb) {
                        activeThumb.classList.add('active-card');
                    }
                    if (this.matNameDisplay) {
                        const selectedObj = this.ctx.interactions.selectedObject;
                        let registry = WALL_DECOR_REGISTRY;
                        if (selectedObj && selectedObj.userData.entity) {
                            if (selectedObj.userData.entity.type === 'door' || selectedObj.userData.entity.type === 'window') {
                                registry = Object.assign({}, WOOD_REGISTRY, GLASS_REGISTRY);
                            } else if (selectedObj.userData.entity.type === 'roof') {
                                if (this.activeObject && this.activeObject.userData && this.activeObject.userData.isGable) registry = WALL_DECOR_REGISTRY;
                                else if (this.activeFace === 'sides' || this.activeFace === 'fascia' || this.activeDescriptor?.slotName === 'fascia') registry = WALL_DECOR_REGISTRY;
                                else registry = Object.assign({}, ROOF_DECOR_REGISTRY, WALL_DECOR_REGISTRY);
                            } else if (selectedObj.userData.isFurniture || selectedObj.userData.entity.type === 'furniture') {
                                registry = Object.assign({}, FABRIC_REGISTRY, WOOD_REGISTRY, WALL_DECOR_REGISTRY, GLASS_REGISTRY);
                            }
                        }
                        const config = registry[texKey] || GLASS_REGISTRY[texKey];
                        this.matNameDisplay.innerText = config ? (config.name || config.label) : (texKey || 'Clear Material');
                    }
                }
            };
            this.highlightSelectedThumb = highlightSelectedThumb;

            this._attachMaterialThumbListeners = () => {
                const currentThumbs = document.querySelectorAll('.mat-thumb');
                currentThumbs.forEach(thumb => {
                    thumb.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        let key = thumb.getAttribute('data-mat');
                        if (key === null) return;
                        if (key === '' || key === 'default') key = '__default__';

                        // 1. Arm active brush in Top HUD and paintSystem (NO premature scene preview or mutation on click)
                        this.activeMaterialKey = key;
                        if (this.ctx?.commonTools?.paintSystem) {
                            this.ctx.commonTools.paintSystem.setActiveMaterial(key);
                        }
                        this.activeDescriptor = null;
                        this.updateActiveBrushUI(key);
                        highlightSelectedThumb(key);
                        if (this.ctx?.interactions?.materialGizmo?.clearHighlight) {
                            this.ctx.interactions.materialGizmo.clearHighlight();
                        }
                        if (this.ctx?.requestRender) {
                            this.ctx.requestRender('material_brush_armed');
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

    getCompatibleCategoriesForEntity(entity, descriptor = null) {
        if (!entity) {
            return [
                { id: 'marble', label: 'Marble' },
                { id: 'tile', label: 'Tiles' },
                { id: 'brick', label: 'Bricks' },
                { id: 'paint', label: 'Paint' },
                { id: 'stone', label: 'Natural Stone' },
                { id: 'wood', label: 'Wood' },
                { id: 'floor', label: 'Floor' },
                { id: 'roof', label: 'Roof' },
                { id: 'wall_decor', label: 'Wall Decor' },
                { id: 'fabric', label: 'Fabric' },
                { id: 'metal', label: 'Metals' },
                { id: 'glass', label: 'Glass' },
                { id: 'plastic', label: 'Plastics' },
                { id: 'leather', label: 'Leather' }
            ];
        }

        const type = entity.type;
        const isWall = type === 'outer' || type === 'inner' || type === 'compound' || type === 'wall' || type === 'arc' || type === 'half_wall' || type === 'foundation' || entity.walls || entity.parentArc || entity.startX !== undefined;

        if (isWall) {
            return [
                { id: 'marble', label: 'Marble' },
                { id: 'tile', label: 'Tiles' },
                { id: 'brick', label: 'Bricks' },
                { id: 'paint', label: 'Paint' },
                { id: 'stone', label: 'Natural Stone' },
                { id: 'wood', label: 'Wood' },
                { id: 'wall_decor', label: 'Wall Decor' }
            ];
        }

        if (type === 'roof' || entity.isRoof || descriptor?.isRoof) {
            return [
                { id: 'roof', label: 'Roof Shingles' },
                { id: 'wood', label: 'Wood / Fascia' },
                { id: 'metal', label: 'Metal' },
                { id: 'stone', label: 'Stone' }
            ];
        }

        if (type === 'room' || type === 'floor' || type === 'outdoor_zone' || entity.isFloor || entity.isOutdoorZone) {
            return [
                { id: 'floor', label: 'Floor Tiles' },
                { id: 'marble', label: 'Marble' },
                { id: 'wood', label: 'Hardwood' },
                { id: 'stone', label: 'Stone' },
                { id: 'tile', label: 'Tiles' }
            ];
        }

        if (type === 'door') {
            return [
                { id: 'wood', label: 'Wood' },
                { id: 'glass', label: 'Glass' },
                { id: 'metal', label: 'Metals' },
                { id: 'plastic', label: 'Plastics' }
            ];
        }

        if (type === 'window') {
            return [
                { id: 'glass', label: 'Glass' },
                { id: 'wood', label: 'Wood' },
                { id: 'metal', label: 'Metals' },
                { id: 'plastic', label: 'Plastics' }
            ];
        }

        if (type === 'stair' || type === 'staircase') {
            return [
                { id: 'wood', label: 'Wood' },
                { id: 'marble', label: 'Marble' },
                { id: 'stone', label: 'Stone' },
                { id: 'metal', label: 'Metals' },
                { id: 'tile', label: 'Tiles' }
            ];
        }

        if (type === 'furniture' || entity.isFurniture) {
            return [
                { id: 'fabric', label: 'Fabric' },
                { id: 'leather', label: 'Leather' },
                { id: 'wood', label: 'Wood' },
                { id: 'metal', label: 'Metals' },
                { id: 'plastic', label: 'Plastics' },
                { id: 'marble', label: 'Marble' },
                { id: 'glass', label: 'Glass' }
            ];
        }

        return [
            { id: 'wood', label: 'Wood' },
            { id: 'stone', label: 'Stone' },
            { id: 'marble', label: 'Marble' },
            { id: 'metal', label: 'Metals' },
            { id: 'plastic', label: 'Plastics' }
        ];
    }

    _renderDockCategoriesBar(currentCategory, selectedObj = null, descriptor = null) {
        if (!this.materialPanel) return;
        const bar = this.materialPanel.querySelector('#mat-dock-categories-bar');
        if (!bar) return;

        const entity = selectedObj?.userData?.entity || (this.ctx?.interactions?.selectedObject?.userData?.entity);
        const cats = this.getCompatibleCategoriesForEntity(entity, descriptor || this.activeDescriptor);

        const normCurrent = (currentCategory === 'stones' ? 'stone' : (currentCategory === 'bricks' ? 'brick' : currentCategory));

        bar.innerHTML = cats.map(cat => {
            const isActive = cat.id === normCurrent;
            return `<button class="mat-cat-tab-btn ${isActive ? 'active' : ''}" data-cat="${cat.id}">${cat.label}</button>`;
        }).join('');

        bar.querySelectorAll('.mat-cat-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const chosenCat = btn.getAttribute('data-cat');
                this._lastSelectedCat = chosenCat;
                this.onMaterialFaceSelected(this.activeFace, this.activeSubMeshIndex, this.activeObject, this.activeMatIndex, chosenCat);
            });
        });

        // Category scroll arrow navigation
        const btnLeft = this.materialPanel.querySelector('#mat-cat-scroll-left');
        const btnRight = this.materialPanel.querySelector('#mat-cat-scroll-right');
        if (btnLeft && !btnLeft._hasScrollListener) {
            btnLeft._hasScrollListener = true;
            btnLeft.addEventListener('click', (e) => {
                e.stopPropagation();
                bar.scrollBy({ left: -140, behavior: 'smooth' });
            });
        }
        if (btnRight && !btnRight._hasScrollListener) {
            btnRight._hasScrollListener = true;
            btnRight.addEventListener('click', (e) => {
                e.stopPropagation();
                bar.scrollBy({ left: 140, behavior: 'smooth' });
            });
        }

        const activeBtn = bar.querySelector('.mat-cat-tab-btn.active');
        if (activeBtn) {
            activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    _updateDockWallPills(entity) {
        if (!this.materialPanel) return;
        const subbar = this.materialPanel.querySelector('#mat-dock-subbar');
        const isWall = entity && (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'arc' || entity.walls || entity.parentArc || entity.startX !== undefined);
        if (subbar) {
            subbar.style.display = isWall ? 'flex' : 'none';
        }
        if (!isWall) return;

        const facePills = this.materialPanel.querySelectorAll('.mat-dock-face-pill');
        const scopePills = this.materialPanel.querySelectorAll('.mat-dock-scope-pill');
        const topFacePills = this.materialPanel.querySelectorAll('.mat-face-pill');
        const topScopePills = this.materialPanel.querySelectorAll('.mat-scope-pill');

        const activeFace = this.activeFace || 'front';
        const isBoth = this.materialScope === 'entireObject';

        facePills.forEach(p => {
            const side = p.getAttribute('data-side');
            if (isBoth) {
                p.classList.toggle('active', side === 'both');
            } else {
                p.classList.toggle('active', side === activeFace);
            }
        });

        topFacePills.forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-side') === activeFace);
        });

        scopePills.forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-scope') === (this.materialScope || 'selectedFace'));
        });

        topScopePills.forEach(p => {
            p.classList.toggle('active', p.getAttribute('data-scope') === (this.materialScope || 'selectedFace'));
        });
    }

    async onMaterialFaceSelected(faceName, subMeshIndex = -1, activeObject = null, activeMatIndex = -1, forcedCategory = null) {
        this.activeFace = faceName;
        this.activeSubMeshIndex = subMeshIndex;
        this.activeObject = activeObject;
        this.activeMatIndex = activeMatIndex;
        
        if (activeObject && BIMMaterialSystem) {
            try {
                this.activeDescriptor = BIMMaterialSystem.resolveBIMTarget(activeObject, activeMatIndex, null, activeObject?.userData?.entity);
            } catch (e) {
                console.warn("BIM Selection Error:", e);
            }
        }
        if (this.materialPanel) {
            this.materialPanel.style.display = 'flex';
            setTimeout(() => this.materialPanel.classList.add('active'), 10);
            const isUnifiedHUDActive = Boolean(this.ctx.commonTools || (typeof document !== 'undefined' && document.querySelector('.contextual-action-hud-container')));
            if (this.btnDone) this.btnDone.style.display = isUnifiedHUDActive ? 'none' : 'flex';
        }

        let realSelectedObj = this.ctx.interactions?.selectedObject || this.ctx.commonTools?.selectedMesh || this.ctx.commonTools?.selectedEntity?.mesh3D || null;
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

        // Activate sms 4 UniversalMaterialPaintSystem & start session if not started
        if (this.ctx?.commonTools?.paintSystem) {
            if (!this.ctx.commonTools.paintSystem.isSessionActive && selectedObj?.userData?.entity) {
                this.ctx.commonTools.paintSystem.startSession(selectedObj.userData.entity);
            }
            this.ctx.commonTools.paintSystem.setActive(true);
            if (this.materialScope) {
                this.ctx.commonTools.paintSystem.setMaterialScope(this.materialScope);
            }
            if (this.activeMaterialKey) {
                this.ctx.commonTools.paintSystem.setActiveMaterial(this.activeMaterialKey);
            }
        }
        
        const entity = selectedObj?.userData?.entity;
        if (entity) {
            this._updateDockWallPills(entity);
        }
        const compatibleCats = this.getCompatibleCategoriesForEntity(entity, this.activeDescriptor);

        let materialCategory = (forcedCategory && forcedCategory !== 'categories') ? forcedCategory : null;
        
        if (!materialCategory) {
            if (this.activeDescriptor && this.activeDescriptor.slotName) {
                const slot = this.activeDescriptor.slotName;
                materialCategory = SLOT_DEFINITIONS[slot]?.defaultCategory || null;
            } else if (entity) {
                if (entity.params && entity.params.materialCategory) {
                    materialCategory = entity.params.materialCategory;
                } else {
                    const type = entity.type;
                    if (type === 'room' || selectedObj?.userData?.isFloor || type === 'floor') {
                        materialCategory = 'floor';
                    } else if (type === 'roof' || entity.isRoof) {
                        materialCategory = 'roof';
                    } else if (type === 'door') {
                        materialCategory = 'wood';
                    } else if (type === 'window') {
                        materialCategory = 'glass';
                    } else if (type === 'outer' || type === 'inner' || type === 'compound' || type === 'wall' || type === 'arc' || entity.walls || entity.parentArc) {
                        materialCategory = this._lastSelectedCat || 'marble';
                    } else if (type !== 'furniture' && !entity.isFurniture) {
                        materialCategory = type;
                    }
                }
            }
        }

        // Validate that materialCategory is compatible with selected object
        const isCompatible = compatibleCats.some(c => c.id === materialCategory);
        if (!isCompatible) {
            materialCategory = compatibleCats[0]?.id || 'marble';
        }
        this._lastSelectedCat = materialCategory;

        // Render Quick Category Tabs in Dock Header (filtered by selected object)
        this._renderDockCategoriesBar(materialCategory, selectedObj, this.activeDescriptor);
        
        const gridPanel = document.getElementById('gizmo-material-grid');
        if (gridPanel) {
            gridPanel.style.display = 'flex';
            const wrapper = gridPanel.closest('.mat-lib-grid-wrapper') || gridPanel.parentElement;
            if (wrapper) wrapper.scrollLeft = 0;
        }
        const searchEl = document.getElementById('mat-lib-search-input');
        if (searchEl) searchEl.value = '';

        let decorThumbnails = `
            <div class="mat-card mat-thumb" data-mat="__default__" title="Revert to Default Material">
                <div class="mat-card-selected-checkmark">✓</div>
                <div class="mat-clear-circle" style="width: 44px; height: 44px; border-radius: 50%; background: #f1f5f9; border: 1.5px dashed #94a3b8; display: flex; align-items: center; justify-content: center; margin: 2px 0;">
                    <svg style="width: 18px; height: 18px; color: #64748b;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </div>
                <div class="mat-card-title">Default</div>
            </div>
        `;
        let registry = null;
        let activeGroup = null;
        const ALL_REGISTRY = Object.assign({}, WOOD_REGISTRY, METAL_REGISTRY, PLASTIC_REGISTRY, GLASS_REGISTRY, STONE_REGISTRY, BRICK_REGISTRY, MARBLE_REGISTRY, FABRIC_REGISTRY, LEATHER_REGISTRY, TILE_REGISTRY, ROOF_REGISTRY, FLOOR_REGISTRY, WALL_REGISTRY, PAINT_REGISTRY);

        // 1. Resolve category based on user selection (takes absolute priority)
        switch (materialCategory) {
            case 'paint':
                registry = PAINT_REGISTRY;
                activeGroup = null;
                break;
            case 'wood':
            case 'door':
            case 'window':
            case 'wood_metal':
                registry = WOOD_REGISTRY;
                activeGroup = null;
                break;
            case 'steel':
            case 'aluminium':
                registry = METAL_REGISTRY;
                activeGroup = materialCategory;
                break;
            case 'metal':
                registry = METAL_REGISTRY;
                activeGroup = null;
                break;
            case 'wpc':
            case 'pvc':
            case 'upvc':
            case 'frp':
                registry = PLASTIC_REGISTRY;
                activeGroup = materialCategory;
                break;
            case 'fiberglass':
                registry = PLASTIC_REGISTRY;
                activeGroup = 'frp';
                break;
            case 'composite':
            case 'plastic':
                registry = PLASTIC_REGISTRY;
                activeGroup = null;
                break;
            case 'glass': registry = GLASS_REGISTRY; break;
            case 'marble': registry = MARBLE_REGISTRY; break;
            case 'stone':
            case 'stones':
                registry = STONE_REGISTRY;
                activeGroup = null;
                break;
            case 'brick':
            case 'bricks':
                registry = BRICK_REGISTRY;
                activeGroup = null;
                break;
            case 'tile': registry = TILE_REGISTRY; break;
            case 'fabric': registry = FABRIC_REGISTRY; break;
            case 'leather': registry = LEATHER_REGISTRY; break;
            case 'roof': registry = ROOF_REGISTRY; break;
            case 'floor': registry = FLOOR_REGISTRY; break;
            case 'wall_decor': registry = WALL_REGISTRY; break;
            case 'wall':
            case 'outer':
            case 'inner':
                registry = ALL_REGISTRY;
                break;
            default: {
                // Fallback: If no explicit category chosen, infer from applied material on sub-component
                let texKey = null;
                if (this.activeDescriptor) {
                    const slotName = this.activeDescriptor.slotName; 
                    const entity = this.activeDescriptor.entity;
                    if (entity && entity.materials && entity.materials[slotName]) {
                        texKey = typeof entity.materials[slotName] === 'string' ? entity.materials[slotName] : entity.materials[slotName].id;
                    }
                }
                if (!texKey && selectedObj && selectedObj.userData && selectedObj.userData.entity) {
                    const entity = selectedObj.userData.entity;
                    const p = entity.params || {};
                    let targetParams = p;
                    if (this.activeSubMeshIndex !== -1 && p.blocks && p.blocks[this.activeSubMeshIndex]) {
                        targetParams = p.blocks[this.activeSubMeshIndex];
                    }
                    texKey = targetParams.texture || targetParams.textureFront || entity.doorMat || entity.frameMat || null;
                }
                if (texKey && ALL_REGISTRY[texKey]) {
                    if (WOOD_REGISTRY[texKey]) registry = WOOD_REGISTRY;
                    else if (METAL_REGISTRY[texKey]) registry = METAL_REGISTRY;
                    else if (PLASTIC_REGISTRY[texKey]) registry = PLASTIC_REGISTRY;
                    else if (GLASS_REGISTRY[texKey]) registry = GLASS_REGISTRY;
                    else if (STONE_REGISTRY[texKey]) registry = STONE_REGISTRY;
                    else if (BRICK_REGISTRY[texKey]) registry = BRICK_REGISTRY;
                    else if (MARBLE_REGISTRY[texKey]) registry = MARBLE_REGISTRY;
                    else if (FABRIC_REGISTRY[texKey]) registry = FABRIC_REGISTRY;
                    else if (LEATHER_REGISTRY[texKey]) registry = LEATHER_REGISTRY;
                    else if (TILE_REGISTRY[texKey]) registry = TILE_REGISTRY;
                    else if (ROOF_REGISTRY[texKey]) registry = ROOF_REGISTRY;
                    else if (FLOOR_REGISTRY[texKey]) registry = FLOOR_REGISTRY;
                    else if (WALL_REGISTRY[texKey]) registry = WALL_REGISTRY;
                    else if (PAINT_REGISTRY && PAINT_REGISTRY[texKey]) registry = PAINT_REGISTRY;
                    activeGroup = ALL_REGISTRY[texKey].group || null;
                }
                break;
            }
        }

        // 4. Ultimate generic fallback
        if (!registry) {
            registry = ALL_REGISTRY;
            activeGroup = null;
        }
        let title = 'Materials';
        if (registry === WOOD_REGISTRY) title = 'Wood / Veneer';
        else if (registry === METAL_REGISTRY) title = 'Metals';
        else if (registry === GLASS_REGISTRY) title = 'Glass';
        else if (registry === STONE_REGISTRY) title = 'Natural Stone';
        else if (registry === BRICK_REGISTRY) title = 'Bricks & Masonry';
        else if (registry === MARBLE_REGISTRY) title = 'Marble';
        else if (registry === TILE_REGISTRY) title = 'Tiles';
        else if (registry === PAINT_REGISTRY) title = 'Wall Paint';
        else if (registry === FABRIC_REGISTRY) title = 'Fabric / Decor';
        else if (registry === PLASTIC_REGISTRY) title = 'Plastics';
        else if (registry === LEATHER_REGISTRY) title = 'Leather';
        else if (registry === FLOOR_REGISTRY) title = 'Floor Materials';
        else if (registry === ROOF_REGISTRY) title = 'Roof Materials';
        else if (registry === WALL_REGISTRY) title = 'Wall Materials';
        else if (materialCategory) {
            title = (materialCategory.charAt(0).toUpperCase() + materialCategory.slice(1)).replace(/_/g, ' ') + ' Materials';
        }

        const matsToRender = [];
        if (registry) {
            for (const [key, val] of Object.entries(registry)) {
                if (val.isAlias) continue;
                const thumbUrl = val.thumbnail || val.texture;
                if (!thumbUrl && !val.color && !val.transparent && !val.cssSphere) continue;
                
                let sphereStyle = 'background: rgba(100,100,100,0.5);';
                if (thumbUrl) {
                    sphereStyle = `background-image: url('${thumbUrl}'); background-size: cover; background-position: center;`;
                } else if (val.cssSphere) {
                    sphereStyle = val.cssSphere;
                } else if (val.color) {
                    const hexColor = '#' + val.color.toString(16).padStart(6, '0');
                    sphereStyle = `background-color: ${hexColor}; opacity: ${val.transparent ? (val.transmission !== undefined ? 1 - val.transmission : 0.5) : 1};`;
                }
                if (val.type === 'fabric') {
                    matsToRender.push({ key, val });
                }
                
                const label = val.name || val.label || key;
                const groupAttr = val.group ? `data-group="${val.group}"` : '';
                
                const isGlass = materialCategory === 'glass';
                const sphereClass = isGlass ? 'mat-sphere is-3d-glass' : 'mat-sphere';
                const glassStyle = isGlass ? "background: radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.25) 0%, rgba(56, 189, 248, 0.06) 55%, transparent 75%);" : sphereStyle;

                decorThumbnails += `
                    <div class="mat-card mat-thumb" data-mat="${key}" ${groupAttr} title="${label}">
                        <div class="mat-card-selected-checkmark">✓</div>
                        <div class="${sphereClass}" id="mat-thumb-${key}" style="${glassStyle}"></div>
                        <div class="mat-card-title">${label}</div>
                    </div>
                `;
            }
        }
        
        const gridElem = this.materialPanel.querySelector('#gizmo-material-grid');
        if (gridElem) {
            let patternLauncherHtml = '';
            if (materialCategory === 'fabric') {
                const state = this._getCurrentFabricState(selectedObj);
                const fabricConf = FABRIC_REGISTRY[state.baseFabricId] || {};
                const supportsPatterns = fabricConf.supportsPatterns !== false;
                
                this._patternTransformState = this._patternTransformState || { scale: 120, rotation: 45, repeat: 2.0, opacity: 100, mirror: 'vertical' };
                if (!state.patternId) {
                    patternLauncherHtml = `
                        <div class="mat-card" id="card-pattern-customizer-launcher" style="border: 1.5px dashed #a855f7; background: #faf5ff; cursor: pointer; padding: 4px;" title="Select Pattern Motif">
                            <div class="mat-sphere" style="width: 44px; height: 44px; background: radial-gradient(circle at 35% 25%, #f3e8ff 0%, #d8b4fe 60%, #a855f7 100%); display: flex; align-items: center; justify-content: center; font-size: 20px; box-shadow: 0 2px 6px rgba(168, 85, 247, 0.2); border-radius: 50%;">
                                🎨
                            </div>
                            <div class="mat-card-title" style="color: #7e22ce; font-weight: 700; margin-top: 4px; font-size: 11px;">+ Pattern</div>
                            <button id="btn-gizmo-open-pattern-popup" ${!supportsPatterns ? 'disabled' : ''} style="display: none;"></button>
                        </div>
                    `;
                } else {
                    const rawName = state.patternId.replace(/^offline_/, '').replace(/_\d+$/, '').replace(/_/g, ' ').trim();
                    const prettyPatternTitle = rawName ? rawName.replace(/\b\w/g, c => c.toUpperCase()) : 'Motif';

                    patternLauncherHtml = `
                        <div class="mat-card active-card" id="card-pattern-customizer-applied" style="border: 1.5px solid #a855f7 !important; background: #faf5ff; position: relative; padding: 4px;">
                            <div class="mat-card-selected-checkmark" style="display: flex; background: #a855f7;">✓</div>
                            <div class="mat-sphere" id="pattern-card-thumb-preview" style="width: 44px; height: 44px; background: #ffffff center/cover no-repeat; border: 1.5px solid #a855f7; border-radius: 50%;"></div>
                            <div id="pattern-card-title-text" class="mat-card-title" style="color: #7e22ce; font-weight: 700; margin-top: 2px; font-size: 10px; max-width: 62px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${prettyPatternTitle}</div>
                            <div style="display: flex; gap: 3px; margin-top: 2px;">
                                <button id="btn-gizmo-open-pattern-popup" ${!supportsPatterns ? 'disabled' : ''} style="background: #a855f7; color: white; border: none; padding: 2px 4px; border-radius: 4px; font-size: 9px; font-weight: 700; cursor: pointer;" title="Change Pattern">🎨</button>
                                <button id="btn-gizmo-open-pattern-controls" style="background: #f3e8ff; border: 1px solid #d8b4fe; color: #7e22ce; padding: 2px 4px; border-radius: 4px; font-size: 9px; cursor: pointer;" title="Fine-Tune Settings">⚙️</button>
                                <button id="btn-gizmo-remove-pattern" style="background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; padding: 2px 4px; border-radius: 4px; font-size: 9px; cursor: pointer;" title="Remove Pattern">✕</button>
                            </div>
                        </div>
                    `;

                    (async () => {
                        try {
                            const patObj = await patternManager.getPatternById(state.patternId);
                            const compKey = `${state.baseFabricId}::pattern::${state.patternId}`;
                            const compConfig = await resolveFabricConfig(compKey, this._patternTransformState);
                            
                            const cardThumb = gridElem.querySelector('#pattern-card-thumb-preview');
                            const titleElem = gridElem.querySelector('#pattern-card-title-text');
                            
                            const realThumb = (compConfig && compConfig.texture) ? compConfig.texture : (patObj ? (patObj.thumbnail || patObj.textureUrl) : '');
                            if (cardThumb && realThumb) {
                                cardThumb.style.backgroundImage = `url('${realThumb}')`;
                            }
                            if (titleElem && patObj && patObj.title) {
                                titleElem.innerText = patObj.title;
                            }
                        } catch (e) {
                            console.error('[GizmoManager] Error populating pattern card preview:', e);
                        }
                    })();
                }
            }

            let woodCustomizerHtml = '';
            if (materialCategory === 'wood' || materialCategory === 'door' || materialCategory === 'window' || materialCategory === 'wood_metal') {
                const woodColors = [
                    { name: 'Light Maple', hex: '#E8D5B7' },
                    { name: 'Natural Oak', hex: '#D6B07A' },
                    { name: 'Golden Oak', hex: '#C8904A' },
                    { name: 'Pine', hex: '#D8B56C' },
                    { name: 'Teak', hex: '#A66A3F' },
                    { name: 'Cherry', hex: '#A24F38' },
                    { name: 'Walnut', hex: '#6B4A2E' },
                    { name: 'Mahogany', hex: '#7B3F27' },
                    { name: 'Ash', hex: '#C7B79A' },
                    { name: 'Ebony', hex: '#2C211A' },
                    { name: 'Whitewashed Oak', hex: '#E9E4D8' },
                    { name: 'Espresso', hex: '#3B2A20' }
                ];
                
                let swatchesHtml = '';
                woodColors.forEach(c => {
                    swatchesHtml += `<div class="mat-thumb wood-swatch" data-mat="color_${c.hex}" title="${c.name}" style="background-color: ${c.hex}; width: 17px; height: 17px; border-radius: 3px; cursor: pointer; border: 1px solid rgba(0,0,0,0.12); flex-shrink: 0; box-sizing: border-box; transition: transform 0.15s, border-color 0.15s;" onmouseover="this.style.transform='scale(1.2)'; this.style.borderColor='#92400e';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='rgba(0,0,0,0.12)';"></div>`;
                });

                woodCustomizerHtml = `
                    <div class="mat-card" id="card-wood-customizer" style="width: 144px; height: 86px; border: 1px solid #fde68a; background: #fffbeb; padding: 6px 8px; display: flex; flex-direction: column; justify-content: space-between; box-sizing: border-box; flex-shrink: 0;">
                        <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
                            <span style="font-size: 10.5px; font-weight: 700; color: #92400e;">🎨 Wood Tone</span>
                            <input type="color" id="gizmo-wood-color-picker" value="#C8904A" title="Custom Hex Picker" style="width: 18px; height: 18px; border: 1px solid #d97706; padding: 0; background: transparent; cursor: pointer; border-radius: 3px;">
                        </div>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 4px; justify-content: flex-start; align-content: flex-start;">
                            ${swatchesHtml}
                        </div>
                    </div>
                `;
            }
            
            // Build Subgroup Tabs HTML
            let tabsHtml = '';
            if (registry) {
                const uniqueGroups = new Set();
                for (const val of Object.values(registry)) {
                    if (val.group) uniqueGroups.add(val.group);
                }
                
                if (uniqueGroups.size > 0) {
                    const groupsArray = Array.from(uniqueGroups).sort();
                    let tabsButtons = `<button class="gizmo-subgroup-tab ${!activeGroup ? 'active' : ''}" data-target-group="all" style="padding: 4px 10px; margin-right: 6px; border-radius: 999px; background: ${!activeGroup ? '#eff6ff' : '#f8fafc'}; color: ${!activeGroup ? '#2563eb' : '#64748b'}; cursor: pointer; font-weight: 600; font-size: 11px; border: 1px solid ${!activeGroup ? '#bfdbfe' : '#e2e8f0'};">All</button>`;
                    
                    for (const g of groupsArray) {
                        const isActive = activeGroup === g;
                        tabsButtons += `<button class="gizmo-subgroup-tab ${isActive ? 'active' : ''}" data-target-group="${g}" style="padding: 4px 10px; margin-right: 6px; border-radius: 999px; background: ${isActive ? '#eff6ff' : '#f8fafc'}; color: ${isActive ? '#2563eb' : '#64748b'}; cursor: pointer; font-weight: 600; font-size: 11px; border: 1px solid ${isActive ? '#bfdbfe' : '#e2e8f0'};">${g.toUpperCase()}</button>`;
                    }
                    
                    tabsHtml = `
                        <div class="gizmo-subgroup-tabs-container" style="width: 100%; display: flex; align-items: center; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 8px; overflow-x: auto;">
                            ${tabsButtons}
                        </div>
                    `;
                }
            }
            
            gridElem.innerHTML = patternLauncherHtml + woodCustomizerHtml + decorThumbnails;
            
            const tabsContainerWrapper = this.materialPanel.querySelector('#gizmo-subgroup-tabs-container');
            if (tabsContainerWrapper) {
                tabsContainerWrapper.innerHTML = tabsHtml;
            }

            if (selectedObj?.userData?.entity) {
                const isWall = selectedObj.userData.entity.type === 'outer' || selectedObj.userData.entity.type === 'inner' || selectedObj.userData.entity.type === 'compound' || selectedObj.userData.entity.type === 'wall' || selectedObj.userData.entity.type === 'wallDecor' || selectedObj.userData.entity.startX !== undefined;
                if (isWall) {
                    this._renderWallMultiMaterialTabs(selectedObj.userData.entity, selectedObj);
                    if (tabsHtml && tabsContainerWrapper) {
                        tabsContainerWrapper.insertAdjacentHTML('beforeend', tabsHtml);
                    }
                }
            }

            // Bind Subgroup Tab Events
            const tabsContainer = tabsContainerWrapper ? tabsContainerWrapper.querySelector('.gizmo-subgroup-tabs-container') : null;
            if (tabsContainer) {
                const tabs = tabsContainer.querySelectorAll('.gizmo-subgroup-tab');
                tabs.forEach(tab => {
                    tab.addEventListener('click', (e) => {
                        const targetGroup = e.currentTarget.getAttribute('data-target-group');
                        
                        // Update active visual state on tabs
                        tabs.forEach(t => {
                            t.classList.remove('active');
                            t.style.background = '#f8fafc';
                            t.style.color = '#64748b';
                            t.style.borderColor = '#e2e8f0';
                        });
                        e.currentTarget.classList.add('active');
                        e.currentTarget.style.background = '#eff6ff';
                        e.currentTarget.style.color = '#2563eb';
                        e.currentTarget.style.borderColor = '#bfdbfe';
                        
                        // Filter thumbnails
                        const allThumbs = gridElem.querySelectorAll('.mat-thumb');
                        allThumbs.forEach(thumb => {
                            const matKey = thumb.getAttribute('data-mat');
                            if (!matKey) return; // Always show Clear Material or customizer blocks? Actually Clear Material doesn't have a group, it shows if 'all'. But let's just ignore it or show it.
                            const thumbGroup = thumb.getAttribute('data-group');
                            
                            if (targetGroup === 'all') {
                                thumb.style.display = '';
                            } else {
                                if (thumbGroup === targetGroup) {
                                    thumb.style.display = '';
                                } else {
                                    thumb.style.display = 'none';
                                }
                            }
                        });
                    });
                });
                
                // Trigger initial filter immediately if there's an active group
                if (activeGroup) {
                    const allThumbs = gridElem.querySelectorAll('.mat-thumb');
                    allThumbs.forEach(thumb => {
                        const matKey = thumb.getAttribute('data-mat');
                        if (!matKey) return; // Leave Clear Material visible
                        const thumbGroup = thumb.getAttribute('data-group');
                        if (thumbGroup !== activeGroup) {
                            thumb.style.display = 'none';
                        }
                    });
                }
            }
            
            if (materialCategory === 'fabric') {
                const btnOpen = gridElem.querySelector('#btn-gizmo-open-pattern-popup');
                const btnControls = gridElem.querySelector('#btn-gizmo-open-pattern-controls');
                const btnRemove = gridElem.querySelector('#btn-gizmo-remove-pattern');
                const cardLauncher = gridElem.querySelector('#card-pattern-customizer-launcher');
                
                if (btnOpen) {
                    btnOpen.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this._openPatternPopupModal(selectedObj);
                    });
                }
                if (cardLauncher) {
                    cardLauncher.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this._openPatternPopupModal(selectedObj);
                    });
                }
                if (btnControls) {
                    btnControls.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this._openPatternControlsModal(selectedObj);
                    });
                }
                if (btnRemove) {
                    btnRemove.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const state = this._getCurrentFabricState(selectedObj);
                        this._applyFabricCompositeMaterial(state.baseFabricId || 'caban_neutral', selectedObj);
                        this._renderMaterials(selectedObj);
                    });
                }
            }

            const scrollWrap = gridElem.closest('.mat-lib-grid-wrapper') || gridElem.parentElement;
            if (scrollWrap) scrollWrap.scrollLeft = 0;
            if (this._attachMaterialThumbListeners) this._attachMaterialThumbListeners();
            if (this.highlightSelectedThumb && this.activeMaterialKey) {
                this.highlightSelectedThumb(this.activeMaterialKey);
            }
            
            // Wire up item clicks to update active highlight
            const thumbs = gridElem.querySelectorAll('.mat-thumb');
            thumbs.forEach(t => {
                t.addEventListener('click', (e) => {
                    thumbs.forEach(el => el.classList.remove('active-card'));
                    t.classList.add('active-card');
                    const matName = t.querySelector('.mat-card-title')?.textContent || 'Material';
                    if (this.matNameDisplay) this.matNameDisplay.innerText = matName;
                    
                    if (materialCategory === 'fabric') {
                        const newMatKey = t.getAttribute('data-mat');
                        const fabConf = FABRIC_REGISTRY[newMatKey] || {};
                        const btnOpen = gridElem.querySelector('#btn-gizmo-open-pattern-popup');
                        const btnRemove = gridElem.querySelector('#btn-gizmo-remove-pattern');
                        const statusText = gridElem.querySelector('#fabric-pattern-status-text');
                        const currentState = this._getCurrentFabricState(selectedObj);

                        if (btnOpen) {
                            if (fabConf.supportsPatterns === false) {
                                btnOpen.disabled = true;
                                btnOpen.style.background = 'rgba(100,116,139,0.4)';
                                btnOpen.style.cursor = 'not-allowed';
                                if (statusText) statusText.innerText = '🔒 Pattern Not Supported for this plain fabric';
                                if (btnRemove) btnRemove.style.display = 'none';
                            } else {
                                btnOpen.disabled = false;
                                btnOpen.style.background = 'linear-gradient(135deg, #a855f7, #7c3aed)';
                                btnOpen.style.cursor = 'pointer';
                                if (currentState.patternId) {
                                    if (statusText) {
                                        statusText.innerText = `✨ Active Pattern: ${currentState.patternId} (Applied across plain fabrics)`;
                                        statusText.style.color = '#c084fc';
                                        statusText.style.fontWeight = '600';
                                    }
                                    if (btnRemove) btnRemove.style.display = 'inline-block';
                                } else {
                                    if (statusText) {
                                        statusText.innerText = 'Add decorative pattern overlay';
                                        statusText.style.color = '#94a3b8';
                                        statusText.style.fontWeight = '400';
                                    }
                                    if (btnRemove) btnRemove.style.display = 'none';
                                }
                            }
                        }
                    }
                });
            });

            const woodColorPicker = gridElem.querySelector('#gizmo-wood-color-picker');
            if (woodColorPicker) {
                woodColorPicker.addEventListener('input', (e) => {
                    const hexColor = e.target.value.toUpperCase();
                    const key = 'color_' + hexColor;
                    if (this.matNameDisplay) this.matNameDisplay.innerText = 'Custom ' + hexColor;
                    
                    let targetMeshToUse = this.activeObject || selectedObj;
                    let descriptor = this.activeDescriptor || (BIMMaterialSystem ? BIMMaterialSystem.resolveBIMTarget(
                        targetMeshToUse,
                        this.activeMatIndex,
                        null,
                        selectedObj?.userData?.entity
                    ) : null);
                    
                    if (descriptor && BIMMaterialSystem) {
                        BIMMaterialSystem.applyBIMMaterial(descriptor, key, this.ctx);
                    }
                });
            }

            // Build 3D material preview thumbnails with pattern overlay for every plain fabric card
            if (matsToRender.length > 0) {
                const state = materialCategory === 'fabric' ? this._getCurrentFabricState(selectedObj) : { patternId: null };
                for (const item of matsToRender) {
                    try {
                        let matToUse = item.val;
                        if (state.patternId && item.val.supportsPatterns !== false) {
                            const compositeKey = `${item.key}::pattern::${state.patternId}`;
                            matToUse = (await resolveFabricConfig(compositeKey)) || item.val;
                        }
                        const el = document.getElementById(`mat-thumb-${item.key}`);
                        if (el && (matToUse.thumbnail || matToUse.texture)) {
                            el.style.backgroundImage = `url('${matToUse.thumbnail || matToUse.texture}')`;
                            el.style.backgroundSize = 'cover';
                            el.style.backgroundPosition = 'center';
                        }
                    } catch (e) {
                        console.error('Failed to render material thumb:', e);
                    }
                }
            }

            // Render 3D PBR glass preview thumbnails for all glass material cards
            if (materialCategory === 'glass') {
                for (const [key, val] of Object.entries(GLASS_REGISTRY)) {
                    if (val.isAlias) continue;
                    try {
                        const dataUrl = glassPreviewRenderer.renderGlassThumbnail(key, val);
                        const sphereEl = gridElem.querySelector(`#mat-thumb-${key}`);
                        if (sphereEl) {
                            sphereEl.style.backgroundImage = `url('${dataUrl}')`;
                            sphereEl.style.backgroundSize = 'cover';
                            sphereEl.style.backgroundPosition = 'center';
                        }
                    } catch (e) {
                        console.error('[GizmoManager] Failed to render 3D glass thumbnail:', e);
                    }
                }
            }


        }
        
        if (selectedObj && selectedObj.userData.entity) {
            const entity = selectedObj.userData.entity;
            const p = entity.params || {};
            let targetParams = p;
            if (this.activeSubMeshIndex !== -1 && p.blocks && p.blocks[this.activeSubMeshIndex] && entity.materialMode !== 'PROCEDURAL' && entity.materialMode !== 'MONOLITHIC') {
                targetParams = p.blocks[this.activeSubMeshIndex];
            }
            
            let tex = null;
            const isWall = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'wallDecor' || entity.type === 'arc' || entity.walls || entity.parentArc || entity.startX !== undefined;
            if (isWall && this.materialScope === 'selectedFace') {
                const side = selectedObj?.userData?.side || this.activeObject?.userData?.side || this.activeFace || 'front';
                const wall = entity.type === 'wallDecor' ? (entity.mesh3D?.userData?.parentWall || selectedObj?.parent?.userData?.entity || entity) : entity;
                if (side === 'left') {
                    tex = wall.params?.textureLeft || wall.params?.textureSides || wall.params?.texture || null;
                } else if (side === 'right') {
                    tex = wall.params?.textureRight || wall.params?.textureSides || wall.params?.texture || null;
                } else {
                    const attachedDecors = (wall.attachedDecor || []).filter(d => d.side === side);
                    const activeDecor = (attachedDecors || []).find(d => d.id === this.activeDecorId) || attachedDecors[0];
                    if (activeDecor) {
                        tex = activeDecor.configId;
                    } else {
                        tex = side === 'back' ? (wall.params?.textureBack || wall.params?.textureSides || wall.params?.texture) : (wall.params?.textureFront || wall.params?.textureSides || wall.params?.texture);
                    }
                }
            } else {
                tex = targetParams.texture || targetParams.textureFront || null;
            }
            const isFurnitureMat = (selectedObj.userData && selectedObj.userData.isFurniture) || entity.type === 'furniture' || entity.isFurniture;
            if (isFurnitureMat && this.activeObject && this.activeObject.name && p.materialOverrides) {
                tex = p.materialOverrides[this.activeObject.name] || tex;
            }

            const parsedTex = parseCompositeMaterialKey(tex);
            const matThumbs = gridElem ? gridElem.querySelectorAll('.mat-thumb') : document.querySelectorAll('.mat-thumb');
            matThumbs.forEach(t => t.classList.remove('active-card'));

            if (tex) {
                const activeThumb = Array.from(matThumbs).find(t => 
                    t.getAttribute('data-mat') === tex || 
                    (parsedTex.baseFabricId && t.getAttribute('data-mat') === parsedTex.baseFabricId)
                );
                if (activeThumb) {
                    activeThumb.classList.add('active-card');
                }
                if (this.matNameDisplay) {
                    const resolvedConf = MaterialManager.resolveMaterialConfig(tex);
                    this.matNameDisplay.innerText = resolvedConf ? resolvedConf.name : 'Selected Material';
                }
            } else {
                if (this.matNameDisplay) this.matNameDisplay.innerText = 'Clear Material';
                const clearThumb = Array.from(matThumbs).find(t => t.getAttribute('data-mat') === '');
            }
        }
    }

    async _renderMaterials(selectedObj) {
        return this.onMaterialFaceSelected(this.activeFace, this.activeSubMeshIndex, this.activeObject || selectedObj, this.activeMatIndex, 'fabric');
    }

    _getCurrentFabricState(selectedObj) {
        let currentKey = null;
        if (selectedObj && selectedObj.userData && selectedObj.userData.entity) {
            const entity = selectedObj.userData.entity;
            const isFurnitureMat = (selectedObj.userData.isFurniture || entity.type === 'furniture' || entity.isFurniture);
            if (isFurnitureMat && this.activeObject && this.activeObject.name && entity.params && entity.params.materialOverrides) {
                currentKey = entity.params.materialOverrides[this.activeObject.name];
            } else {
                const p = entity.params || {};
                let targetParams = p;
                if (this.activeSubMeshIndex !== -1 && p.blocks && p.blocks[this.activeSubMeshIndex] && entity.materialMode !== 'PROCEDURAL' && entity.materialMode !== 'MONOLITHIC') {
                    targetParams = p.blocks[this.activeSubMeshIndex];
                }
                currentKey = targetParams.texture || targetParams.textureFront || entity.doorMat || null;
            }
        }
        const parsed = parseCompositeMaterialKey(currentKey || 'caban_neutral');
        const baseFabricId = FABRIC_REGISTRY[parsed.baseFabricId] ? parsed.baseFabricId : 'caban_neutral';
        return { baseFabricId, patternId: parsed.patternId || null };
    }

    _openPatternPopupModal(selectedObj) {
        const existingModal = document.getElementById('gizmo-pattern-popup-modal');
        if (existingModal) existingModal.remove();

        const state = this._getCurrentFabricState(selectedObj);
        const baseFabric = FABRIC_REGISTRY[state.baseFabricId] || { name: 'Premium Caban (Warm Neutral)', texture: '' };

        let searchCategory = 'All';
        let searchQuery = '';
        let previewPattern = null;

        const modal = document.createElement('div');
        modal.id = 'gizmo-pattern-popup-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; animation: fadeIn 0.2s ease-out;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'width: 100%; max-width: 780px; max-height: 85vh; background: #0f172a; border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; overflow: hidden; font-family: sans-serif;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 16px 22px; border-bottom: 1px solid rgba(255,255,255,0.1); background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95));';
        header.innerHTML = `
            <div>
                <div style="font-size: 18px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                    <span>🎨 Open-Source Seamless Pattern Library</span>
                </div>
                <div style="font-size: 12px; color: #a855f7; margin-top: 3px; font-weight: 500;">Select a seamless pattern motif to overlay onto <b>${baseFabric.name || state.baseFabricId}</b> and all plain fabrics</div>
            </div>
            <button id="btn-close-pattern-popup" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); width: 32px; height: 32px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">✕</button>
        `;

        const closeModal = () => { if (modal && modal.parentElement) modal.remove(); };
        header.querySelector('#btn-close-pattern-popup').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const body = document.createElement('div');
        body.style.cssText = 'padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1;';

        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 12px;';

        const pillsWrap = document.createElement('div');
        pillsWrap.style.cssText = 'display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; scrollbar-width: none;';
        
        const searchWrap = document.createElement('div');
        searchWrap.style.cssText = 'display: flex; align-items: center; gap: 12px;';
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search full patterns by motif (e.g. botanical, plaid, damask, geometric)...';
        searchInput.style.cssText = 'flex: 1; padding: 10px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(30,41,59,0.7); color: #f8fafc; font-size: 13px; outline: none; transition: 0.2s;';
        const infoBadge = document.createElement('div');
        infoBadge.style.cssText = 'font-size: 11px; font-weight: 600; color: #a855f7; background: rgba(168,85,247,0.15); padding: 6px 12px; border-radius: 20px; white-space: nowrap; border: 1px solid rgba(168,85,247,0.3);';
        infoBadge.innerText = '🛡️ CC0 Commercial Free';
        
        searchWrap.appendChild(searchInput);
        searchWrap.appendChild(infoBadge);
        controlsDiv.appendChild(pillsWrap);
        controlsDiv.appendChild(searchWrap);
        body.appendChild(controlsDiv);

        // Preview Banner in Modal
        const previewWrap = document.createElement('div');
        previewWrap.style.cssText = 'display: none; background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95)); border: 1px solid #a855f7; border-radius: 12px; padding: 14px 18px; align-items: center; justify-content: space-between; box-shadow: 0 6px 20px rgba(168,85,247,0.25);';
        body.appendChild(previewWrap);

        // Grid Area
        const gridDiv = document.createElement('div');
        gridDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 14px; width: 100%; min-height: 250px; align-content: flex-start;';
        body.appendChild(gridDiv);
        dialog.appendChild(body);
        modal.appendChild(dialog);
        document.body.appendChild(modal);


        const updatePills = () => {
            pillsWrap.innerHTML = '';
            patternManager.getCategories().forEach(cat => {
                const isSel = searchCategory === cat;
                const pill = document.createElement('button');
                pill.innerText = cat;
                pill.style.cssText = `padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; cursor: pointer; white-space: nowrap; transition: 0.2s; border: 1px solid ${isSel ? '#c084fc' : 'rgba(255,255,255,0.1)'}; background: ${isSel ? 'rgba(168,85,247,0.25)' : 'rgba(30,41,59,0.5)'}; color: ${isSel ? '#f3e8ff' : '#94a3b8'};`;
                pill.addEventListener('click', () => {
                    searchCategory = cat;
                    previewPattern = null;
                    previewWrap.style.display = 'none';
                    updatePills();
                    renderGallery();
                });
                pillsWrap.appendChild(pill);
            });
        };

        const renderPreview = async (pat) => {
            previewWrap.style.display = 'flex';
            previewWrap.innerHTML = `<div style="color: #a855f7; font-size: 13px; font-weight: 600;">Synthesizing 3D PBR fabric preview...</div>`;
            
            const compKey = `${state.baseFabricId}::pattern::${pat.id}`;
            const compConfig = await resolveFabricConfig(compKey, this._patternTransformState);
            let blendedUrl = (compConfig && compConfig.texture) ? compConfig.texture : (pat.thumbnail || pat.textureUrl);
            if (this.ctx && this.ctx.thumbnailGenerator && compConfig) {
                blendedUrl = await this.ctx.thumbnailGenerator.generate('material_preview_box', compConfig) || blendedUrl;
            }
            
            previewWrap.innerHTML = `
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 60px; height: 60px; border-radius: 10px; border: 2px solid #c084fc; background: #0f172a url('${blendedUrl}') center/cover no-repeat; box-shadow: 0 4px 12px rgba(0,0,0,0.5); flex-shrink: 0;"></div>
                    <div>
                        <div style="font-size: 10px; font-weight: 700; color: #4ade80; letter-spacing: 0.5px; text-transform: uppercase;">⚡ Real-time 3D PBR Preview</div>
                        <div style="font-size: 15px; font-weight: 700; color: #f8fafc;">${pat.title} on ${baseFabric.name || state.baseFabricId}</div>
                        <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">License: ${pat.license} (${pat.attribution})</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <button id="btn-apply-pattern-now" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 11px; border: none; cursor: pointer; white-space: nowrap; box-shadow: 0 2px 8px rgba(16,185,129,0.3); transition: 0.2s;">✔ Apply to 3D Model</button>
                    <button id="btn-dismiss-preview" style="background: rgba(255,255,255,0.1); color: #cbd5e1; padding: 7px 12px; border-radius: 8px; font-weight: 600; font-size: 11px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; white-space: nowrap;">Cancel</button>
                </div>
            `;
            
            previewWrap.querySelector('#btn-apply-pattern-now').addEventListener('click', async () => {
                const compKey = `${state.baseFabricId}::pattern::${pat.id}`;
                await this._applyFabricCompositeMaterial(compKey, selectedObj);
                closeModal();
                this._renderMaterials(selectedObj);
            });
            previewWrap.querySelector('#btn-dismiss-preview').addEventListener('click', () => {
                previewPattern = null;
                previewWrap.style.display = 'none';
            });
        };

        const renderGallery = async () => {
            gridDiv.innerHTML = `<div style="color: #94a3b8; padding: 20px; font-size: 14px; text-align: center; width: 100%;">Loading open-source patterns...</div>`;
            const results = await patternManager.search({ category: searchCategory, query: searchQuery });
            gridDiv.innerHTML = '';
            
            if (!results.patterns || results.patterns.length === 0) {
                gridDiv.innerHTML = `<div style="color: #64748b; font-size: 14px; font-weight: 600; padding: 30px; text-align: center; width: 100%;">No seamless decorative patterns found. Try another keyword or switch category!</div>`;
                return;
            }

            results.patterns.forEach(pat => {
                const card = document.createElement('div');
                card.style.cssText = 'cursor: pointer; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 14px; width: calc(50% - 7px); background: rgba(30,41,59,0.5); box-sizing: border-box;';
                card.addEventListener('mouseenter', () => { card.style.borderColor = '#a855f7'; card.style.background = 'rgba(30,41,59,0.8)'; });
                card.addEventListener('mouseleave', () => { card.style.borderColor = 'rgba(255,255,255,0.12)'; card.style.background = 'rgba(30,41,59,0.5)'; });

                // Full Pattern display (background repeat & contain/cover so full repeating motif is visible)
                card.innerHTML = `
                    <div style="width: 60px; height: 60px; border-radius: 8px; background: url('${pat.thumbnail || pat.textureUrl}') center/cover no-repeat; flex-shrink: 0; border: 1px solid rgba(255,255,255,0.25); box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
                    <div style="overflow: hidden; width: 100%;">
                        <div style="font-size: 14px; font-weight: 700; color: #f8fafc; text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${pat.title}</div>
                        <div style="color: #c084fc; font-size: 11px; margin-top: 4px; font-weight: 600;">${pat.category} &bull; <span style="color: #94a3b8; font-weight: 400;">${pat.attribution}</span></div>
                    </div>
                `;

                card.addEventListener('click', () => {
                    previewPattern = pat;
                    renderPreview(pat);
                    previewWrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                });
                gridDiv.appendChild(card);
            });
        };

        searchInput.addEventListener('input', (e) => { searchQuery = e.target.value; });
        searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') renderGallery(); });

        updatePills();
        renderGallery();
    }

    _openPatternControlsModal(selectedObj) {
        const existingModal = document.getElementById('gizmo-pattern-controls-modal');
        if (existingModal) existingModal.remove();

        this._modalTargetMesh = selectedObj || this.activeObject;
        const state = this._getCurrentFabricState(selectedObj);
        if (!state.patternId) return;

        const baseFabric = FABRIC_REGISTRY[state.baseFabricId] || { name: 'Premium Caban Weave' };
        const defaultPts = { scale: 120, rotation: 45, repeat: 2.0, opacity: 100, mirror: 'off', roughness: 50, sheen: 50 };
        this._patternTransformState = Object.assign({}, defaultPts, this._patternTransformState || {});
        const localPts = { ...this._patternTransformState };

        const rawName = state.patternId.replace(/^offline_/, '').replace(/_\d+$/, '').replace(/_/g, ' ').trim();
        const prettyPatternTitle = rawName ? rawName.replace(/\b\w/g, c => c.toUpperCase()) + ' Motif' : 'Pattern Motif';

        const modal = document.createElement('div');
        modal.id = 'gizmo-pattern-controls-modal';
        modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999999; background: rgba(0, 0, 0, 0.75); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; animation: fadeIn 0.2s ease-out;';

        const dialog = document.createElement('div');
        dialog.style.cssText = 'width: 100%; max-width: 720px; max-height: 90vh; background: #0f172a; border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 16px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6); display: flex; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; color: #f8fafc;';

        // Header
        const header = document.createElement('div');
        header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); background: linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.95));';
        header.innerHTML = `
            <div>
                <div style="font-size: 16px; font-weight: 800; color: #f8fafc; display: flex; align-items: center; gap: 8px;">
                    <span>⚙️ Fabric Physical Properties & Pattern Transform Controls</span>
                </div>
                <div style="font-size: 11px; color: #c084fc; margin-top: 2px; font-weight: 500;">
                    Fine-tune scale, rotation, repeat grid, roughness, sheen & opacity for <b>${prettyPatternTitle}</b> on <b>${baseFabric.name || state.baseFabricId}</b>
                </div>
            </div>
            <button id="btn-close-ctrl-modal" style="background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); width: 30px; height: 30px; border-radius: 8px; font-size: 15px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">✕</button>
        `;

        const closeModal = () => { if (modal && modal.parentElement) modal.remove(); };
        header.querySelector('#btn-close-ctrl-modal').addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

        const body = document.createElement('div');
        body.style.cssText = 'padding: 18px 20px; display: grid; grid-template-columns: 220px 1fr; gap: 20px; overflow-y: auto; flex: 1; align-items: start;';

        body.innerHTML = `
            <!-- Left: Real-time Live Synthesis Canvas -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; background: rgba(30, 41, 59, 0.4); padding: 14px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08);">
                <div id="ctrl-live-preview-box" style="width: 190px; height: 190px; border-radius: 12px; background: #0f172a center/cover no-repeat; border: 2px solid rgba(168, 85, 247, 0.6); box-shadow: 0 8px 24px rgba(0,0,0,0.5); transition: background 0.15s ease;"></div>
                <div style="text-align: center; width: 100%;">
                    <div style="font-size: 10px; font-weight: 700; color: #4ade80; background: rgba(34, 197, 94, 0.15); border: 1px solid rgba(34, 197, 94, 0.3); padding: 2px 8px; border-radius: 10px; display: inline-block; margin-bottom: 4px;">⚡ Real-time Synthesis Preview</div>
                    <div id="ctrl-status-summary" style="font-size: 11px; color: #94a3b8; line-height: 1.3;">Scale: ${localPts.scale}% | Rot: ${localPts.rotation}°</div>
                </div>
            </div>

            <!-- Right: Physical Fabric & Pattern Controls -->
            <div style="display: flex; flex-direction: column; gap: 12px;">
                
                <!-- Pattern Scale -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 12px; font-weight: 700; color: #e2e8f0;">⤢ Pattern Scale</label>
                        <span id="val-ctrl-scale" style="font-size: 11px; font-weight: 800; color: #c084fc; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px;">${localPts.scale}%</span>
                    </div>
                    <input type="range" id="slider-ctrl-scale" min="50" max="300" step="5" value="${localPts.scale}" style="width: 100%; accent-color: #a855f7; cursor: pointer;">
                </div>

                <!-- Pattern Rotation -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 12px; font-weight: 700; color: #e2e8f0;">🔄 Pattern Rotation</label>
                        <span id="val-ctrl-rotation" style="font-size: 11px; font-weight: 800; color: #c084fc; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px;">${localPts.rotation}°</span>
                    </div>
                    <input type="range" id="slider-ctrl-rotation" min="0" max="360" step="5" value="${localPts.rotation}" style="width: 100%; accent-color: #a855f7; cursor: pointer;">
                </div>

                <!-- Tile Repeat Density -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 12px; font-weight: 700; color: #e2e8f0;">⣿ Tile Repeat Density</label>
                        <span id="val-ctrl-repeat" style="font-size: 11px; font-weight: 800; color: #c084fc; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px;">${localPts.repeat}x</span>
                    </div>
                    <input type="range" id="slider-ctrl-repeat" min="0.5" max="5.0" step="0.1" value="${localPts.repeat}" style="width: 100%; accent-color: #a855f7; cursor: pointer;">
                </div>

                <!-- Fabric Micro-Roughness -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 12px; font-weight: 700; color: #e2e8f0;">✨ Fabric Roughness (Cloth Texture)</label>
                        <span id="val-ctrl-roughness" style="font-size: 11px; font-weight: 800; color: #c084fc; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px;">${localPts.roughness}%</span>
                    </div>
                    <input type="range" id="slider-ctrl-roughness" min="0" max="100" step="5" value="${localPts.roughness}" style="width: 100%; accent-color: #a855f7; cursor: pointer;">
                </div>

                <!-- Sheen & Velvet Micro-Fibers -->
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                        <label style="font-size: 12px; font-weight: 700; color: #e2e8f0;">🪡 Sheen & Velvet Micro-Fibers</label>
                        <span id="val-ctrl-sheen" style="font-size: 11px; font-weight: 800; color: #c084fc; background: rgba(168,85,247,0.15); padding: 1px 6px; border-radius: 4px;">${localPts.sheen}%</span>
                    </div>
                    <input type="range" id="slider-ctrl-sheen" min="0" max="100" step="5" value="${localPts.sheen}" style="width: 100%; accent-color: #a855f7; cursor: pointer;">
                </div>

                <!-- Mirror Alignment -->
                <div>
                    <label style="font-size: 12px; font-weight: 700; color: #e2e8f0; display: block; margin-bottom: 4px;">🪞 Mirror Mode</label>
                    <div style="display: flex; gap: 6px;">
                        <button id="btn-mirror-off" style="flex: 1; padding: 5px 0; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid ${localPts.mirror === 'off' ? '#a855f7' : 'rgba(255,255,255,0.15)'}; background: ${localPts.mirror === 'off' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.05)'}; color: white;">Off</button>
                        <button id="btn-mirror-horiz" style="flex: 1; padding: 5px 0; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid ${localPts.mirror === 'horizontal' ? '#a855f7' : 'rgba(255,255,255,0.15)'}; background: ${localPts.mirror === 'horizontal' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.05)'}; color: white;">Horizontal</button>
                        <button id="btn-mirror-vert" style="flex: 1; padding: 5px 0; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid ${localPts.mirror === 'vertical' ? '#a855f7' : 'rgba(255,255,255,0.15)'}; background: ${localPts.mirror === 'vertical' ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.05)'}; color: white;">Vertical</button>
                    </div>
                </div>

            </div>
        `;

        // Footer Bar
        const footer = document.createElement('div');
        footer.style.cssText = 'display: flex; align-items: center; justify-content: flex-end; gap: 10px; padding: 14px 20px; border-top: 1px solid rgba(255,255,255,0.1); background: rgba(15, 23, 42, 0.8);';
        footer.innerHTML = `
            <button id="btn-apply-ctrl-now" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 12px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: 0.2s;">
                ✔ Apply to 3D Model
            </button>
            <button id="btn-cancel-ctrl" style="background: rgba(255,255,255,0.1); color: #cbd5e1; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 12px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;">
                Cancel
            </button>
        `;

        dialog.appendChild(header);
        dialog.appendChild(body);
        dialog.appendChild(footer);
        modal.appendChild(dialog);
        document.body.appendChild(modal);

        const updateLivePreview = async () => {
            const compKey = `${state.baseFabricId}::pattern::${state.patternId}`;
            const compConfig = await resolveFabricConfig(compKey, localPts);
            const prevBox = body.querySelector('#ctrl-live-preview-box');
            const summary = body.querySelector('#ctrl-status-summary');
            if (prevBox && compConfig) {
                let sphereUrl = null;
                if (this.ctx && this.ctx.thumbnailGenerator) {
                    sphereUrl = await this.ctx.thumbnailGenerator.generate('material_preview_box', compConfig);
                }
                prevBox.style.backgroundImage = `url('${sphereUrl || compConfig.texture}')`;
                prevBox.style.backgroundSize = 'cover';
                prevBox.style.backgroundPosition = 'center';
            }
            if (summary) {
                summary.innerText = `Scale: ${localPts.scale}% | Rot: ${localPts.rotation}° | Rough: ${localPts.roughness}%`;
            }
        };

        // Initial preview load
        updateLivePreview();

        // Event listeners for sliders
        const sliderScale = body.querySelector('#slider-ctrl-scale');
        const sliderRot = body.querySelector('#slider-ctrl-rotation');
        const sliderRep = body.querySelector('#slider-ctrl-repeat');
        const sliderRough = body.querySelector('#slider-ctrl-roughness');
        const sliderSheen = body.querySelector('#slider-ctrl-sheen');

        sliderScale.addEventListener('input', (e) => {
            localPts.scale = parseInt(e.target.value);
            body.querySelector('#val-ctrl-scale').innerText = `${localPts.scale}%`;
            updateLivePreview();
        });

        sliderRot.addEventListener('input', (e) => {
            localPts.rotation = parseInt(e.target.value);
            body.querySelector('#val-ctrl-rotation').innerText = `${localPts.rotation}°`;
            updateLivePreview();
        });

        sliderRep.addEventListener('input', (e) => {
            localPts.repeat = parseFloat(e.target.value);
            body.querySelector('#val-ctrl-repeat').innerText = `${localPts.repeat}x`;
            updateLivePreview();
        });

        sliderRough.addEventListener('input', (e) => {
            localPts.roughness = parseInt(e.target.value);
            body.querySelector('#val-ctrl-roughness').innerText = `${localPts.roughness}%`;
            updateLivePreview();
        });

        sliderSheen.addEventListener('input', (e) => {
            localPts.sheen = parseInt(e.target.value);
            body.querySelector('#val-ctrl-sheen').innerText = `${localPts.sheen}%`;
            updateLivePreview();
        });

        // Mirror buttons
        const setMirrorMode = (mode) => {
            localPts.mirror = mode;
            ['off', 'horiz', 'vert'].forEach(m => {
                const btn = body.querySelector(`#btn-mirror-${m}`);
                const isSel = (mode === 'off' && m === 'off') || (mode === 'horizontal' && m === 'horiz') || (mode === 'vertical' && m === 'vert');
                if (btn) {
                    btn.style.borderColor = isSel ? '#a855f7' : 'rgba(255,255,255,0.15)';
                    btn.style.background = isSel ? 'rgba(168,85,247,0.3)' : 'rgba(255,255,255,0.05)';
                }
            });
            updateLivePreview();
        };

        body.querySelector('#btn-mirror-off').addEventListener('click', () => setMirrorMode('off'));
        body.querySelector('#btn-mirror-horiz').addEventListener('click', () => setMirrorMode('horizontal'));
        body.querySelector('#btn-mirror-vert').addEventListener('click', () => setMirrorMode('vertical'));

        // Footer buttons
        footer.querySelector('#btn-cancel-ctrl').addEventListener('click', closeModal);
        footer.querySelector('#btn-apply-ctrl-now').addEventListener('click', async () => {
            this._patternTransformState = { ...localPts };
            const compKey = `${state.baseFabricId}::pattern::${state.patternId}`;
            await this._applyFabricCompositeMaterial(compKey, selectedObj);
            closeModal();
            this._renderMaterials(selectedObj);
        });
    }

    async _applyFabricCompositeMaterial(matKey, selectedObj) {
        if (!matKey) return;
        let realSelectedObj = selectedObj || this.ctx.interactions.selectedObject;
        if (this.activeObject && !realSelectedObj) {
            let current = this.activeObject;
            while(current) {
                if (current.userData && current.userData.entity) {
                    realSelectedObj = current;
                    break;
                }
                current = current.parent;
            }
        }
        
        const config = await resolveFabricConfig(matKey, this._patternTransformState);
        if (!config) return;
        
        if (realSelectedObj && realSelectedObj.userData.entity) {
            const entity = realSelectedObj.userData.entity;
            entity.params = entity.params || {};
            const target = this.activeFace || 'front';
            
            let targetParams = entity.params;
            if (this.activeSubMeshIndex !== -1 && entity.materialMode !== 'PROCEDURAL' && entity.materialMode !== 'MONOLITHIC') {
                entity.params.blocks = entity.params.blocks || {};
                entity.params.blocks[this.activeSubMeshIndex] = entity.params.blocks[this.activeSubMeshIndex] || {};
                targetParams = entity.params.blocks[this.activeSubMeshIndex];
            }
            
            const isFrame = this.activeObject && this.activeObject.userData && this.activeObject.userData.isFrame;
            const isFurnitureMat = (realSelectedObj && realSelectedObj.userData && realSelectedObj.userData.isFurniture) || (entity && (entity.type === 'furniture' || entity.isFurniture));

            const targetMeshToUse = this.activeObject || this._modalTargetMesh || realSelectedObj;
            const descriptor = this.activeDescriptor || BIMMaterialSystem.resolveBIMTarget(
                targetMeshToUse,
                this.activeMatIndex,
                null,
                entity
            );

            BIMMaterialSystem.applyBIMMaterial(descriptor, matKey, this.ctx);

            if (typeof entity.applyMaterial === 'function') {
                entity.applyMaterial({ target, key: matKey, activeMatIndex: this.activeMatIndex, activeObject: this.activeObject, ctx: this.ctx });
            }

            if (this.ctx && typeof this.ctx.requestRender === 'function') {
                this.ctx.requestRender();
            }
        }
    }

    _renderWallMultiMaterialTabs(entity, selectedObj) {
        const isWall = entity && (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.startX !== undefined);
        const isWallDecor = entity && entity.type === 'wallDecor';
        
        const side = this.activeFace || this.activeObject?.userData?.side || selectedObj?.userData?.side || 'front';
        
        // Synchronize Top HUD scope & face pills
        const hudScopeBtns = this.materialPanel.querySelectorAll('.mat-sms4-top-hud .mat-scope-pill');
        hudScopeBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-scope') === (this.materialScope || 'selectedFace'));
        });

        const hudFaceBtns = this.materialPanel.querySelectorAll('.mat-sms4-top-hud .mat-face-pill');
        hudFaceBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-side') === side);
        });

        if (isWall || isWallDecor) {
            this._updateDockWallPills(entity);
        }

        const tabsContainerWrapper = this.materialPanel.querySelector('#gizmo-subgroup-tabs-container');
        if (!tabsContainerWrapper) return;
        
        if (!isWall && !isWallDecor) {
            tabsContainerWrapper.innerHTML = '';
            return;
        }

        const wall = isWallDecor ? (entity.mesh3D?.userData?.parentWall || selectedObj?.parent?.userData?.entity || entity) : entity;
        const attachedDecors = (wall.attachedDecor || []).filter(d => d.side === side);
        
        if (isWallDecor && entity.id) {
            this.activeDecorId = entity.id;
        }

        // Always keep the material grid visible
        const gridWrapper = this.materialPanel.querySelector('.mat-lib-grid-wrapper');
        const gridPanel = document.getElementById('gizmo-material-grid');
        const searchWrapper = this.materialPanel.querySelector('.mat-lib-header .mat-search-box') || this.materialPanel.querySelector('#mat-lib-search-input')?.parentElement;
        if (gridWrapper) gridWrapper.style.display = 'flex';
        if (gridPanel) gridPanel.style.display = 'flex';
        if (searchWrapper) searchWrapper.style.display = 'flex';

        // Auto-select first decor if available and none selected
        if (attachedDecors.length > 0 && !this.activeDecorId) {
            this.activeDecorId = attachedDecors[0].id;
        }

        // Selected decor object
        const selectedDecor = attachedDecors.find(d => d.id === this.activeDecorId) || null;

        // 0. Material Scope Selector (sms 4 Paint Scope Standard)
        const isSelectedFace = this.materialScope === 'selectedFace' || !this.materialScope;
        const isRoomLoop = this.materialScope === 'room';
        const isExteriorLoop = this.materialScope === 'exterior';
        const isEntireObject = this.materialScope === 'entireObject';

        const scopeHtml = `
            <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
                    Paint Application Mode
                </div>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: rgba(0,0,0,0.5); padding: 3px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);">
                    <button class="gizmo-scope-btn ${isSelectedFace ? 'active' : ''}" data-scope="selectedFace" style="padding: 5px 2px; border-radius: 5px; border: none; background: ${isSelectedFace ? '#3b82f6' : 'transparent'}; color: ${isSelectedFace ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 10px; font-weight: 600; transition: all 0.15s; text-align: center;" title="Paint clicked face only">
                        🧱 Single
                    </button>
                    <button class="gizmo-scope-btn ${isRoomLoop ? 'active' : ''}" data-scope="room" style="padding: 5px 2px; border-radius: 5px; border: none; background: ${isRoomLoop ? '#3b82f6' : 'transparent'}; color: ${isRoomLoop ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 10px; font-weight: 600; transition: all 0.15s; text-align: center;" title="Paint all interior walls of this room (Shortcut: Hold Shift)">
                        🔄 Room (Shift)
                    </button>
                    <button class="gizmo-scope-btn ${isExteriorLoop ? 'active' : ''}" data-scope="exterior" style="padding: 5px 2px; border-radius: 5px; border: none; background: ${isExteriorLoop ? '#3b82f6' : 'transparent'}; color: ${isExteriorLoop ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 10px; font-weight: 600; transition: all 0.15s; text-align: center;" title="Paint entire exterior facade (Shortcut: Hold Alt)">
                        🌐 Exterior (Alt)
                    </button>
                    <button class="gizmo-scope-btn ${isEntireObject ? 'active' : ''}" data-scope="entireObject" style="padding: 5px 2px; border-radius: 5px; border: none; background: ${isEntireObject ? '#3b82f6' : 'transparent'}; color: ${isEntireObject ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 10px; font-weight: 600; transition: all 0.15s; text-align: center;" title="Paint both front & back faces simultaneously">
                        📦 Both
                    </button>
                </div>
            </div>
        `;

        // 1. Top Header: Face Selector + Layer Count + Mode Hint
        let headerHtml = '';
        if (isRoomLoop) {
            headerHtml = `
                <div style="padding: 6px 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 6px; font-size: 10.5px; color: #6ee7b7; line-height: 1.4;">
                    🔄 <strong>Room Loop:</strong> Click any pattern to paint all interior walls in this room at once.
                </div>
            `;
        } else if (isExteriorLoop) {
            headerHtml = `
                <div style="padding: 6px 10px; background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3); border-radius: 6px; font-size: 10.5px; color: #fde68a; line-height: 1.4;">
                    🌐 <strong>Exterior Loop:</strong> Click any pattern to paint the entire outer facade perimeter.
                </div>
            `;
        } else if (isEntireObject) {
            headerHtml = `
                <div style="padding: 6px 10px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.25); border-radius: 6px; font-size: 10.5px; color: #93c5fd; line-height: 1.4;">
                    📦 <strong>Both Sides:</strong> Material applies to inner and outer faces simultaneously.
                </div>
            `;
        } else if (side === 'left' || side === 'right') {
            const sideLabel = side === 'left' ? 'Start Corner / Bevel' : 'End Corner / Bevel';
            headerHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Face:</span>
                        <span style="padding: 4px 10px; border-radius: 6px; background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.4); color: #93c5fd; font-size: 11px; font-weight: 700;">📐 ${sideLabel}</span>
                    </div>
                </div>
            `;
        } else {
            headerHtml = `
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Face:</span>
                        <div style="display: inline-flex; background: rgba(0,0,0,0.5); padding: 2px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.12);">
                            <button class="gizmo-wall-face-toggle ${side === 'front' ? 'active' : ''}" data-side="front" style="padding: 4px 10px; border-radius: 4px; border: none; background: ${side === 'front' ? '#3b82f6' : 'transparent'}; color: ${side === 'front' ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;">Inner Face</button>
                            <button class="gizmo-wall-face-toggle ${side === 'back' ? 'active' : ''}" data-side="back" style="padding: 4px 10px; border-radius: 4px; border: none; background: ${side === 'back' ? '#3b82f6' : 'transparent'}; color: ${side === 'back' ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s;">Outer Face</button>
                        </div>
                    </div>

                    <span style="font-size: 11px; color: #cbd5e1; font-weight: 600;">${attachedDecors.length} Layer${attachedDecors.length === 1 ? '' : 's'}</span>
                </div>
            `;
        }

        // 2. Applied Materials Cards Vertical List
        let layersCardsHtml = '';
        if (attachedDecors.length > 0) {
            layersCardsHtml = `
                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                    <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px;">
                        Applied Layers (${attachedDecors.length})
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; padding-right: 2px; scrollbar-width: thin;">
                        ${attachedDecors.map(decor => {
                            const isSelected = this.activeDecorId === decor.id;
                            const reg = MaterialManager.resolveMaterialConfig(decor.configId) || {};
                            const thumbUrl = reg.thumbnail || reg.texture || '';
                            const name = reg.name || decor.configId;

                            return `
                                <div class="gizmo-decor-chip" data-decor-id="${decor.id}" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; border-radius: 8px; border: 1.5px solid ${isSelected ? '#3b82f6' : 'rgba(255,255,255,0.1)'}; background: ${isSelected ? 'rgba(59,130,246,0.2)' : 'rgba(0,0,0,0.3)'}; cursor: pointer; box-shadow: ${isSelected ? '0 0 10px rgba(59,130,246,0.35)' : 'none'}; transition: all 0.15s;">
                                    <div style="display: flex; align-items: center; gap: 8px;">
                                        ${thumbUrl ? `<img src="${thumbUrl}" style="width: 28px; height: 28px; border-radius: 4px; object-fit: cover; border: 1px solid rgba(255,255,255,0.2);" />` : ''}
                                        <div style="display: flex; flex-direction: column;">
                                            <div style="display: flex; align-items: center; gap: 4px;">
                                                <span style="font-size: 11px; font-weight: 700; color: #f8fafc; white-space: nowrap;">${name}</span>
                                                ${isSelected ? `<span style="font-size: 8px; padding: 1px 4px; border-radius: 4px; background: #3b82f6; color: white; font-weight: bold;">EDITING</span>` : ''}
                                            </div>
                                            <span style="font-size: 9.5px; color: #94a3b8; white-space: nowrap;">${decor.depth || 0.2}cm thick &bull; ${decor.width || 100}% × ${decor.height || 100}%</span>
                                        </div>
                                    </div>
                                    <button class="gizmo-btn-del-layer" data-decor-id="${decor.id}" style="background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); border-radius: 4px; padding: 2px 6px; font-size: 10px; font-weight: bold; cursor: pointer;" title="Delete Layer">✕</button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        } else {
            layersCardsHtml = `
                <div style="padding: 10px 12px; background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.15); border-radius: 8px; text-align: center; color: #94a3b8; font-size: 11px;">
                    🧱 No layers on this face yet. Click any material on the left to apply.
                </div>
            `;
        }

        // 3. Properties Inspector for Selected Layer
        let inspectorHtml = '';
        if (selectedDecor) {
            inspectorHtml = `
                <div style="background: rgba(15,23,42,0.85); border: 1px solid rgba(59,130,246,0.4); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
                    <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 4px;">
                        <span style="font-size: 10.5px; font-weight: 700; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">⚙️ Live Layer Properties</span>
                        <span style="font-size: 10px; color: #94a3b8;">${selectedDecor.id.slice(0, 10)}</span>
                    </div>

                    <!-- Row 1: Thickness (cm) & Tile Scale -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="gizmo-wall-target-bar" style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #cbd5e1; font-weight: 600;">
                                <span>Thickness</span>
                                <span>${selectedDecor.depth || 0.2} cm</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="depth" data-decor-id="${selectedDecor.id}" min="0.1" max="40" step="0.1" value="${selectedDecor.depth || 0.2}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="depth" data-decor-id="${selectedDecor.id}" min="0.1" max="40" step="0.1" value="${selectedDecor.depth || 0.2}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
                            </div>
                        </div>

                        <div class="gizmo-wall-target-bar" style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #cbd5e1; font-weight: 600;">
                                <span>Tile Scale</span>
                                <span>${selectedDecor.tileSize || DEFAULT_UNIVERSAL_TILE_SIZE}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="tileSize" data-decor-id="${selectedDecor.id}" min="10" max="300" step="5" value="${selectedDecor.tileSize || DEFAULT_UNIVERSAL_TILE_SIZE}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="tileSize" data-decor-id="${selectedDecor.id}" min="10" max="300" step="5" value="${selectedDecor.tileSize || DEFAULT_UNIVERSAL_TILE_SIZE}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
                            </div>
                        </div>
                    </div>

                    <!-- Row 2: Width (%) & Height (%) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="gizmo-wall-target-bar" style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #cbd5e1; font-weight: 600;">
                                <span>Width</span>
                                <span>${selectedDecor.width || 100}%</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="width" data-decor-id="${selectedDecor.id}" min="1" max="100" step="1" value="${selectedDecor.width || 100}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="width" data-decor-id="${selectedDecor.id}" min="1" max="100" step="1" value="${selectedDecor.width || 100}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
                            </div>
                        </div>

                        <div class="gizmo-wall-target-bar" style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #cbd5e1; font-weight: 600;">
                                <span>Height</span>
                                <span>${selectedDecor.height || 100}%</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="height" data-decor-id="${selectedDecor.id}" min="1" max="100" step="1" value="${selectedDecor.height || 100}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="height" data-decor-id="${selectedDecor.id}" min="1" max="100" step="1" value="${selectedDecor.height || 100}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
                            </div>
                        </div>
                    </div>

                    <!-- Row 3: X Offset (%) & Y Offset (%) -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div class="gizmo-wall-target-bar" style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #cbd5e1; font-weight: 600;">
                                <span>Offset X</span>
                                <span>${selectedDecor.localX !== undefined ? selectedDecor.localX : 50}%</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="localX" data-decor-id="${selectedDecor.id}" min="0" max="100" step="1" value="${selectedDecor.localX !== undefined ? selectedDecor.localX : 50}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="localX" data-decor-id="${selectedDecor.id}" min="0" max="100" step="1" value="${selectedDecor.localX !== undefined ? selectedDecor.localX : 50}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
                            </div>
                        </div>

                        <div class="gizmo-wall-target-bar" style="display: flex; flex-direction: column; gap: 3px;">
                            <div style="display: flex; justify-content: space-between; font-size: 10.5px; color: #cbd5e1; font-weight: 600;">
                                <span>Offset Y</span>
                                <span>${selectedDecor.localY !== undefined ? selectedDecor.localY : 50}%</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="localY" data-decor-id="${selectedDecor.id}" min="0" max="100" step="1" value="${selectedDecor.localY !== undefined ? selectedDecor.localY : 50}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="localY" data-decor-id="${selectedDecor.id}" min="0" max="100" step="1" value="${selectedDecor.localY !== undefined ? selectedDecor.localY : 50}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }

        tabsContainerWrapper.innerHTML = `
            <div style="width: 100%; display: flex; flex-direction: column; gap: 10px; padding: 4px 2px;">
                ${scopeHtml}
                ${headerHtml}
                ${layersCardsHtml}
                ${inspectorHtml}
            </div>
        `;

        // Bind Events

        // 0. Scope buttons
        tabsContainerWrapper.querySelectorAll('.gizmo-scope-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetScope = e.currentTarget.getAttribute('data-scope');
                this.materialScope = targetScope;
                this._renderWallMultiMaterialTabs(wall, selectedObj);
            });
        });

        // 1. Face toggle buttons
        tabsContainerWrapper.querySelectorAll('.gizmo-wall-face-toggle').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetSide = e.currentTarget.getAttribute('data-side');
                this.activeFace = targetSide;
                this.activeDecorId = null;
                const targetMatIndex = targetSide === 'back' ? 5 : 4;
                const targetWallMesh = wall.wallMesh3D || (wall.mesh3D && (wall.mesh3D.userData?.wallMesh || (wall.mesh3D.children ? wall.mesh3D.children.find(c => c.userData?.isWallMesh || (c.isMesh && !c.userData?.isHitbox && !c.userData?.isWallSide && !c.userData?.isDoor && !c.userData?.isWindow && !c.userData?.isFrame && !c.userData?.isGlass && !c.userData?.isHandle)) : null))) || selectedObj;
                this.activeObject = targetWallMesh;
                this.activeMatIndex = targetMatIndex;
                if (targetWallMesh && BIMMaterialSystem) {
                    this.activeDescriptor = BIMMaterialSystem.resolveBIMTarget(targetWallMesh, targetMatIndex, null, wall);
                    if (this.ctx.interactions?.materialGizmo) {
                        this.ctx.interactions.materialGizmo.clearHighlight();
                        BIMMaterialSystem.setBIMHighlight(this.activeDescriptor, true, 0x00ff00, this.ctx);
                        this.ctx.interactions.materialGizmo.highlightedObject = this.activeDescriptor.mesh;
                        this.ctx.interactions.materialGizmo.highlightedMatIndex = this.activeDescriptor.targetMatIndex;
                    }
                }
                this._renderWallMultiMaterialTabs(wall, selectedObj);
            });
        });

        // 2. Select Layer (click on chip)
        tabsContainerWrapper.querySelectorAll('.gizmo-decor-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                if (e.target.closest('.gizmo-btn-del-layer')) return;
                e.stopPropagation();
                const decorId = e.currentTarget.getAttribute('data-decor-id');
                this.activeDecorId = (this.activeDecorId === decorId) ? null : decorId;
                this._renderWallMultiMaterialTabs(wall, selectedObj);
            });
        });

        // 4. Delete layer button
        tabsContainerWrapper.querySelectorAll('.gizmo-btn-del-layer').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const decorId = e.currentTarget.getAttribute('data-decor-id');
                const decor = (wall.attachedDecor || []).find(d => d.id === decorId);
                if (decor) {
                    WallEngine.removeDecor(wall, decorId, false, this.ctx ? this.ctx.planner : null);
                    if (decor.mesh3D && decor.mesh3D.parent) {
                        decor.mesh3D.parent.remove(decor.mesh3D);
                    }
                    if (this.activeDecorId === decorId) this.activeDecorId = null;
                    if (this.ctx && typeof this.ctx.requestRender === 'function') {
                        this.ctx.requestRender();
                    }
                    this._renderWallMultiMaterialTabs(wall, selectedObj);
                }
            });
        });

        // 5. Sliders and Number Inputs with live 3D sync
        const updateDecorProp = (decorId, prop, val, sourceElem) => {
            const decor = (wall.attachedDecor || []).find(d => d.id === decorId);
            if (decor && !isNaN(val)) {
                decor[prop] = val;
                const container = sourceElem.closest('.gizmo-wall-target-bar');
                if (container) {
                    const siblingSlider = container.querySelector(`.gizmo-slider[data-prop="${prop}"][data-decor-id="${decorId}"]`);
                    const siblingNum = container.querySelector(`.gizmo-input-num[data-prop="${prop}"][data-decor-id="${decorId}"]`);
                    if (siblingSlider && siblingSlider !== sourceElem) siblingSlider.value = val;
                    if (siblingNum && siblingNum !== sourceElem) siblingNum.value = val;
                }
                if (this.ctx && typeof this.ctx.updateWallDecorLive === 'function') {
                    this.ctx.updateWallDecorLive(decor);
                }
                if (this.ctx && typeof this.ctx.requestRender === 'function') {
                    this.ctx.requestRender();
                }
            }
        };

        tabsContainerWrapper.querySelectorAll('.gizmo-slider').forEach(slider => {
            slider.addEventListener('input', (e) => {
                e.stopPropagation();
                const decorId = e.currentTarget.getAttribute('data-decor-id');
                const prop = e.currentTarget.getAttribute('data-prop');
                const val = parseFloat(e.currentTarget.value);
                updateDecorProp(decorId, prop, val, e.currentTarget);
            });
        });

        tabsContainerWrapper.querySelectorAll('.gizmo-input-num').forEach(numInput => {
            numInput.addEventListener('input', (e) => {
                e.stopPropagation();
                const decorId = e.currentTarget.getAttribute('data-decor-id');
                const prop = e.currentTarget.getAttribute('data-prop');
                const val = parseFloat(e.currentTarget.value);
                updateDecorProp(decorId, prop, val, e.currentTarget);
            });
        });
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
            if (ignoreTags.includes(e.target.tagName) || e.target.closest('input, button, select, textarea, label, .gizmo-slider, .gizmo-input-num, .gizmo-wall-target-bar, #gizmo-subgroup-tabs-container, .gizmo-decor-card')) {
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
            this.menuVisible = visible;
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
        const selectedObj = this.ctx.interactions?.selectedObject || this.ctx.commonTools?.selectedMesh || this.ctx.commonTools?.selectedEntity?.mesh3D || null;
        
        if (!force && this.ctx.currentTransformMode === mode && mode !== 'none') {
            mode = 'none';
        }
        this.ctx.currentTransformMode = mode;

        if (this.btnMove) this.btnMove.classList.remove('active');
        if (this.btnPlace) this.btnPlace.classList.remove('active');
        if (this.btnScale) this.btnScale.classList.remove('active');
        if (this.btnSpin) this.btnSpin.classList.remove('active');
        if (this.btnTilt) this.btnTilt.classList.remove('active');
        if (this.btnOpening) this.btnOpening.classList.remove('active');
        if (this.btnMaterial) this.btnMaterial.classList.remove('active');
        if (this.btnStyle) this.btnStyle.classList.remove('active');
        if (this.btnCorner) this.btnCorner.classList.remove('active');
        if (this.btnPolygonEdges) this.btnPolygonEdges.classList.remove('active');
        if (this.btnPushPull) this.btnPushPull.classList.remove('active');
        if (this.btnDelete) this.btnDelete.classList.remove('active');

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
        const wallExt = this.ctx.interactions.wallExtenderGizmo || this.ctx.interactions.wallPushPullGizmo;
        if (wallExt) {
            wallExt.detach();
        }
        if (this.ctx.interactions.curvedPortalRoofGizmo) {
            this.ctx.interactions.curvedPortalRoofGizmo.detach();
        }
        if (this.ctx.interactions.universalSpinGizmo && mode !== 'rotateY' && mode !== 'spin') {
            this.ctx.interactions.universalSpinGizmo.detach();
        }
        if (this.ctx.interactions.materialGizmo && mode !== 'material') {
            this.ctx.interactions.materialGizmo.detach();
            if (this.materialPanel) {
                this.materialPanel.classList.remove('active');
                this.materialPanel.style.display = 'none';
            }
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
        let isSolidProtrusion = false;
        
        if (selectedObj) {
            entity = selectedObj.userData.entity || {};
            type = entity.type || '';
            isSolidProtrusion = !!selectedObj.userData.isProtrusion || type === 'solid_protrusion' || selectedObj.userData.widget?.type === 'solid_protrusion';
            isOpening = !isSolidProtrusion && (selectedObj.userData.isWidget || selectedObj.userData.isPattern || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type));
            const compType = selectedObj?.userData?.entity?.type || '';
            const isStaircaseOrRailing = compType.startsWith('stair_') || compType.startsWith('glass_') || compType.startsWith('metal_') || compType.startsWith('wood_') || compType.startsWith('cable_') || compType === 'staircase' || compType === 'railing';
            supportsFaceMaterials = selectedObj.userData.isShape || selectedObj.userData.isWidget || selectedObj.userData.isMolding || selectedObj.userData.isPattern || selectedObj.userData.isRoof || selectedObj.userData.isStair || isStaircaseOrRailing;
        }

        console.info(`%c[GizmoManager] %cTransform Mode Changed: %c${mode} %c(Target: ${type || 'None'})`, 
            'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #3b82f6; font-weight: bold;', 'color: #6b7280;');


        const isRoof = selectedObj && (selectedObj.userData?.isRoof || (entity && entity.type === 'roof'));
        if (isRoof) {
            tc.visible = false;
            tc.enabled = false;
            if (tc.detach) tc.detach();
            if (this.ctx.controls) this.ctx.controls.enabled = true;

            // Keep all roof menu buttons visible in toolbar
            if (this.btnMaterial) this.btnMaterial.style.display = 'flex';
            if (this.btnRoofCorners) this.btnRoofCorners.style.display = 'flex';
            if (this.btnMove) this.btnMove.style.display = 'flex';
            if (this.btnSpin) this.btnSpin.style.display = 'flex';
            if (this.btnRoofOverhang) this.btnRoofOverhang.style.display = 'none';
            if (this.btnPlace) this.btnPlace.style.display = 'none';
            if (this.btnScale) this.btnScale.style.display = 'none';
            if (this.btnTilt) this.btnTilt.style.display = 'none';
            if (this.btnOpening) this.btnOpening.style.display = 'none';
            if (this.btnStyle) this.btnStyle.style.display = 'none';
            if (this.btnCorner) this.btnCorner.style.display = 'none';
            if (this.btnVertexSlope) this.btnVertexSlope.style.display = 'none';
            if (this.btnPolygonEdges) this.btnPolygonEdges.style.display = 'none';
            if (this.btnPushPull) this.btnPushPull.style.display = 'none';
            if (this.btnCloseMenu) this.btnCloseMenu.style.display = 'flex';
            if (this.btnDone) this.btnDone.style.display = 'none';

            // Active button indicators
            if (this.btnMaterial) this.btnMaterial.classList.toggle('active', mode === 'material');
            if (this.btnRoofCorners) this.btnRoofCorners.classList.toggle('active', mode === 'roof_corners' || mode === 'corners' || mode === 'none');
            if (this.btnMove) this.btnMove.classList.toggle('active', mode === 'translate' || mode === 'move');
            if (this.btnSpin) this.btnSpin.classList.toggle('active', mode === 'rotateY' || mode === 'spin');

            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.roofSpinPanel && (mode !== 'rotateY' && mode !== 'spin')) {
                this.roofSpinPanel.style.display = 'none';
            }

            const isCurvedPortal = ['curved_portal', 'modern_wrap'].includes(selectedObj?.userData?.entity?.config?.roofType || selectedObj?.userData?.entity?.roofType);
            const isFlat = selectedObj?.userData?.entity?.config?.roofType === 'flat' || selectedObj?.userData?.entity?.roofType === 'flat';
            const isGable = selectedObj?.userData?.entity?.config?.roofType === 'gable' || selectedObj?.userData?.entity?.roofType === 'gable';
            const isHalfGable = ['shed', 'half_gable'].includes(selectedObj?.userData?.entity?.config?.roofType || selectedObj?.userData?.entity?.roofType);

            if (isCurvedPortal) {
                if (this.ctx.interactions.roofPitchGizmo) this.ctx.interactions.roofPitchGizmo.detach();
                if (this.ctx.interactions.gableRoofGizmo) this.ctx.interactions.gableRoofGizmo.detach();
                if (this.ctx.interactions.halfGableRoofGizmo) this.ctx.interactions.halfGableRoofGizmo.detach();
                if (this.ctx.interactions.flatRoofGizmo) this.ctx.interactions.flatRoofGizmo.detach();

                if (mode === 'material') {
                    if (this.ctx.interactions.curvedPortalRoofGizmo) {
                        this.ctx.interactions.curvedPortalRoofGizmo.detach();
                    }
                    if (this.ctx.interactions.materialGizmo) {
                        this.ctx.interactions.materialGizmo.attach(selectedObj);
                    }
                    this.onMaterialFaceSelected('outer', -1, selectedObj, 0, 'categories');
                    return;
                }

                if (this.materialPanel) {
                    this.materialPanel.classList.remove('active');
                    this.materialPanel.style.display = 'none';
                }

                if (mode === 'translate' || mode === 'move') {
                    if (this.ctx.interactions.curvedPortalRoofGizmo) {
                        this.ctx.interactions.curvedPortalRoofGizmo.attach(selectedObj, 'move');
                    }
                    return;
                }

                if (mode === 'rotateY' || mode === 'spin') {
                    if (this.roofSpinPanel && selectedObj) {
                        this.roofSpinPanel.style.display = 'flex';
                        this.syncRoofSpinPanel(selectedObj.userData.entity);
                    }
                    if (this.ctx.interactions.universalSpinGizmo && selectedObj) {
                        this.ctx.interactions.universalSpinGizmo.attach(selectedObj);
                    }
                    if (this.ctx.interactions.curvedPortalRoofGizmo) {
                        this.ctx.interactions.curvedPortalRoofGizmo.attach(selectedObj, 'spin');
                    }
                    return;
                }

                if (this.ctx.interactions.curvedPortalRoofGizmo) {
                    this.ctx.interactions.curvedPortalRoofGizmo.attach(selectedObj, 'corners');
                }
                return;
            }

            if (isFlat) {
                if (this.ctx.interactions.roofPitchGizmo) {
                    this.ctx.interactions.roofPitchGizmo.detach();
                }
                if (this.ctx.interactions.gableRoofGizmo) {
                    this.ctx.interactions.gableRoofGizmo.detach();
                }
                if (this.ctx.interactions.halfGableRoofGizmo) {
                    this.ctx.interactions.halfGableRoofGizmo.detach();
                }
                if (mode === 'material') {
                    if (this.ctx.interactions.flatRoofGizmo) {
                        this.ctx.interactions.flatRoofGizmo.detach();
                    }
                    if (this.ctx.interactions.materialGizmo) {
                        this.ctx.interactions.materialGizmo.attach(selectedObj);
                    }
                    this.onMaterialFaceSelected('top', -1, selectedObj, 0, 'categories');
                    return;
                }

                if (this.materialPanel) {
                    this.materialPanel.classList.remove('active');
                    this.materialPanel.style.display = 'none';
                }

                if (mode === 'translate' || mode === 'move') {
                    if (this.ctx.interactions.flatRoofGizmo) {
                        this.ctx.interactions.flatRoofGizmo.attach(selectedObj, 'move');
                    }
                    return;
                }

                if (mode === 'rotateY' || mode === 'spin') {
                    if (this.roofSpinPanel && selectedObj) {
                        this.roofSpinPanel.style.display = 'flex';
                        this.syncRoofSpinPanel(selectedObj.userData.entity);
                    }
                    if (this.ctx.interactions.universalSpinGizmo && selectedObj) {
                        this.ctx.interactions.universalSpinGizmo.attach(selectedObj);
                    }
                    if (this.ctx.interactions.flatRoofGizmo) {
                        this.ctx.interactions.flatRoofGizmo.attach(selectedObj, 'spin');
                    }
                    return;
                }

                if (this.ctx.interactions.flatRoofGizmo) {
                    this.ctx.interactions.flatRoofGizmo.attach(selectedObj, 'corners');
                }
                return;
            }

            if (isGable) {
                if (this.ctx.interactions.roofPitchGizmo) {
                    this.ctx.interactions.roofPitchGizmo.detach();
                }
                if (this.ctx.interactions.flatRoofGizmo) {
                    this.ctx.interactions.flatRoofGizmo.detach();
                }
                if (this.ctx.interactions.halfGableRoofGizmo) {
                    this.ctx.interactions.halfGableRoofGizmo.detach();
                }
                if (mode === 'material') {
                    if (this.ctx.interactions.gableRoofGizmo) {
                        this.ctx.interactions.gableRoofGizmo.detach();
                    }
                    this.onMaterialFaceSelected('top', -1, selectedObj, 0, 'roof');
                    return;
                }

                if (this.materialPanel) {
                    this.materialPanel.classList.remove('active');
                    this.materialPanel.style.display = 'none';
                }

                if (mode === 'translate' || mode === 'move') {
                    if (this.ctx.interactions.gableRoofGizmo) {
                        this.ctx.interactions.gableRoofGizmo.attach(selectedObj, 'move');
                    }
                    return;
                }

                if (mode === 'rotateY' || mode === 'spin') {
                    if (this.roofSpinPanel && selectedObj) {
                        this.roofSpinPanel.style.display = 'flex';
                        this.syncRoofSpinPanel(selectedObj.userData.entity);
                    }
                    if (this.ctx.interactions.universalSpinGizmo && selectedObj) {
                        this.ctx.interactions.universalSpinGizmo.attach(selectedObj);
                    }
                    if (this.ctx.interactions.gableRoofGizmo) {
                        this.ctx.interactions.gableRoofGizmo.attach(selectedObj, 'spin');
                    }
                    return;
                }

                if (this.ctx.interactions.gableRoofGizmo) {
                    this.ctx.interactions.gableRoofGizmo.attach(selectedObj, 'corners');
                }
                return;
            }

            if (isHalfGable) {
                if (this.ctx.interactions.roofPitchGizmo) {
                    this.ctx.interactions.roofPitchGizmo.detach();
                }
                if (this.ctx.interactions.flatRoofGizmo) {
                    this.ctx.interactions.flatRoofGizmo.detach();
                }
                if (this.ctx.interactions.gableRoofGizmo) {
                    this.ctx.interactions.gableRoofGizmo.detach();
                }
                if (mode === 'material') {
                    if (this.ctx.interactions.halfGableRoofGizmo) {
                        this.ctx.interactions.halfGableRoofGizmo.detach();
                    }
                    this.onMaterialFaceSelected('top', -1, selectedObj, 0, 'roof');
                    return;
                }

                if (this.materialPanel) {
                    this.materialPanel.classList.remove('active');
                    this.materialPanel.style.display = 'none';
                }

                if (mode === 'translate' || mode === 'move') {
                    if (this.ctx.interactions.halfGableRoofGizmo) {
                        this.ctx.interactions.halfGableRoofGizmo.attach(selectedObj, 'move');
                    }
                    return;
                }

                if (mode === 'rotateY' || mode === 'spin') {
                    if (this.roofSpinPanel && selectedObj) {
                        this.roofSpinPanel.style.display = 'flex';
                        this.syncRoofSpinPanel(selectedObj.userData.entity);
                    }
                    if (this.ctx.interactions.universalSpinGizmo && selectedObj) {
                        this.ctx.interactions.universalSpinGizmo.attach(selectedObj);
                    }
                    if (this.ctx.interactions.halfGableRoofGizmo) {
                        this.ctx.interactions.halfGableRoofGizmo.attach(selectedObj, 'spin');
                    }
                    return;
                }

                if (this.ctx.interactions.halfGableRoofGizmo) {
                    this.ctx.interactions.halfGableRoofGizmo.attach(selectedObj, 'corners');
                }
                return;
            }

            if (this.ctx.interactions.flatRoofGizmo) {
                this.ctx.interactions.flatRoofGizmo.detach();
            }
            if (this.ctx.interactions.gableRoofGizmo) {
                this.ctx.interactions.gableRoofGizmo.detach();
            }
            if (this.ctx.interactions.halfGableRoofGizmo) {
                this.ctx.interactions.halfGableRoofGizmo.detach();
            }

            if (mode === 'material') {
                if (this.ctx.interactions.roofPitchGizmo) {
                    this.ctx.interactions.roofPitchGizmo.detach();
                }
                this.onMaterialFaceSelected('top', -1, selectedObj, 0, 'roof');
                return;
            }

            if (this.materialPanel) {
                this.materialPanel.classList.remove('active');
                this.materialPanel.style.display = 'none';
            }

            if (mode === 'translate' || mode === 'move') {
                if (this.ctx.interactions.roofPitchGizmo) {
                    this.ctx.interactions.roofPitchGizmo.attach(selectedObj, 'move');
                }
                return;
            }

            if (mode === 'rotateY' || mode === 'spin') {
                if (this.roofSpinPanel && selectedObj) {
                    this.roofSpinPanel.style.display = 'flex';
                    this.syncRoofSpinPanel(selectedObj.userData.entity);
                }
                if (this.ctx.interactions.universalSpinGizmo && selectedObj) {
                    this.ctx.interactions.universalSpinGizmo.attach(selectedObj);
                }
                if (this.ctx.interactions.roofPitchGizmo) {
                    this.ctx.interactions.roofPitchGizmo.attach(selectedObj, 'spin');
                }
                return;
            }

            // Default 'corners' / 'none' mode
            if (this.ctx.interactions.roofPitchGizmo) {
                this.ctx.interactions.roofPitchGizmo.attach(selectedObj, 'corners');
            }
            return;
        }

        if (mode === 'none') {
            tc.visible = false;
            tc.enabled = false;
            tc.showX = false; tc.showY = false; tc.showZ = false;

            let activeGizmos = GIZMO_REGISTRY.default;
            if (selectedObj) {
                if (selectedObj.userData.isRoof || (selectedObj.userData?.entity && selectedObj.userData.entity.type === 'roof')) {
                    activeGizmos = GIZMO_REGISTRY.roof;
                } else if (selectedObj.userData.isRoofAddon || selectedObj.userData.isRoofSculpture || selectedObj.userData.isSkylight) {
                    activeGizmos = ['material', 'move', 'spin'];
                } else if (type === 'door') {
                    activeGizmos = entity.doorType === 'french' ? GIZMO_REGISTRY.door_french : GIZMO_REGISTRY.door;
                } else if (type === 'window') {
                    activeGizmos = GIZMO_REGISTRY.window || GIZMO_REGISTRY.door;
                } else if (isSolidProtrusion) {
                    activeGizmos = ['pushPull', 'material'];
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
                } else if (selectedObj.userData.isWallSide || selectedObj.userData.isWallMesh || selectedObj.userData.isWallDecor || type === 'outer' || type === 'inner' || type === 'compound' || type === 'wall' || type === 'wallDecor') {
                    activeGizmos = GIZMO_REGISTRY.wall || ['pushPull', 'material'];
                } else if (selectedObj.userData.isFloor || type === 'room' || type === 'floor') {
                    activeGizmos = GIZMO_REGISTRY.floor || GIZMO_REGISTRY.room || ['material'];
                } else if (supportsFaceMaterials) {
                    activeGizmos = GIZMO_REGISTRY.face_material_obj;
                }
            }
            
            if (this.btnMove) this.btnMove.style.display = activeGizmos.includes('move') ? 'flex' : 'none';
            if (this.btnPlace) this.btnPlace.style.display = activeGizmos.includes('place') ? 'flex' : 'none';
            if (this.btnScale) this.btnScale.style.display = activeGizmos.includes('scale') ? 'flex' : 'none';
            if (this.btnSpin) this.btnSpin.style.display = activeGizmos.includes('spin') ? 'flex' : 'none';
            if (this.btnTilt) this.btnTilt.style.display = activeGizmos.includes('tilt') ? 'flex' : 'none';
            if (this.btnOpening) this.btnOpening.style.display = activeGizmos.includes('opening') ? 'flex' : 'none';
            if (this.btnMaterial) this.btnMaterial.style.display = activeGizmos.includes('material') ? 'flex' : 'none';
            if (this.btnStyle) this.btnStyle.style.display = activeGizmos.includes('style') ? 'flex' : 'none';
            if (this.btnCorner) this.btnCorner.style.display = activeGizmos.includes('corner') ? 'flex' : 'none';
            if (this.btnVertexSlope) this.btnVertexSlope.style.display = activeGizmos.includes('vertexSlope') ? 'flex' : 'none';
            if (this.btnRoofCorners) this.btnRoofCorners.style.display = activeGizmos.includes('roofCorners') ? 'flex' : 'none';
            if (this.btnRoofOverhang) this.btnRoofOverhang.style.display = 'none';
            if (this.btnPolygonEdges) this.btnPolygonEdges.style.display = activeGizmos.includes('polygonEdges') ? 'flex' : 'none';
            if (this.btnDelete) this.btnDelete.style.display = activeGizmos.includes('delete') ? 'flex' : 'none';
            if (this.btnCloseMenu) this.btnCloseMenu.style.display = 'flex';
            const isDedicatedMenuEntity = Boolean(selectedObj && (isOpening || type === 'door' || type === 'window' || type === 'jali_panel' || type === 'sunshade' || type === 'elevation_fascia' || type === 'niche_recess' || isSolidProtrusion));
            if (isDedicatedMenuEntity) {
                if (this.transformMenu) {
                    this.transformMenu.style.display = 'flex';
                    this.menuVisible = true;
                }
            } else {
                const isUnifiedHUDActive = Boolean(
                    this.ctx.commonTools ||
                    (typeof document !== 'undefined' && (
                        document.querySelector('.contextual-action-hud-container') ||
                        document.querySelector('.action-hud-card') ||
                        document.querySelector('.common-toolbar-3d')
                    ))
                );
                if (this.transformMenu) this.transformMenu.style.display = isUnifiedHUDActive ? 'none' : 'flex';
            }
            if (this.xyPanel) this.xyPanel.style.display = 'none';
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) {
                this.materialPanel.classList.remove('active');
                this.materialPanel.style.display = 'none';
            }
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.btnDone) this.btnDone.style.display = 'none';
            
            if (selectedObj) {
                this.ctx.interactions.setHighlight(selectedObj, true);
            }
            if (tc.detach) tc.detach(); // Completely detach the gizmo to avoid hidden raycast interference
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            
            return;
        }

        tc.showY = true;
        tc.showZ = true;

        tc.visible = true;
        tc.enabled = true;
        if (this.ctx.controls) this.ctx.controls.enabled = false;
        
        if (selectedObj) this.ctx.interactions.setHighlight(selectedObj, false);

        if (this.btnMove) this.btnMove.style.display = 'none';
        if (this.btnPlace) this.btnPlace.style.display = 'none';
        if (this.btnScale) this.btnScale.style.display = 'none';
        if (this.btnSpin) this.btnSpin.style.display = 'none';
        if (this.btnTilt) this.btnTilt.style.display = 'none';
        if (this.btnOpening) this.btnOpening.style.display = 'none';
        if (this.btnMaterial) this.btnMaterial.style.display = 'none';
        if (this.btnStyle) this.btnStyle.style.display = 'none';
        if (this.btnCorner) this.btnCorner.style.display = 'none';
        if (this.btnVertexSlope) this.btnVertexSlope.style.display = 'none';
        if (this.btnRoofCorners) this.btnRoofCorners.style.display = 'none';
        if (this.btnRoofOverhang) this.btnRoofOverhang.style.display = 'none';
        if (this.btnPolygonEdges) this.btnPolygonEdges.style.display = 'none';
        if (this.btnPushPull) this.btnPushPull.style.display = 'none';
        if (this.btnDelete) this.btnDelete.style.display = 'none';
        if (this.btnCloseMenu) this.btnCloseMenu.style.display = 'none';
        if (this.transformMenu) this.transformMenu.style.display = 'none';
        const isDedicatedMenuEntity = Boolean(selectedObj && (isOpening || type === 'door' || type === 'window' || type === 'jali_panel' || type === 'sunshade' || type === 'elevation_fascia' || type === 'niche_recess' || isSolidProtrusion));
        if (isDedicatedMenuEntity) {
            if (this.btnDone) this.btnDone.style.display = 'flex';
        } else {
            const isUnifiedHUDActive = Boolean(this.ctx.commonTools || (typeof document !== 'undefined' && document.querySelector('.contextual-action-hud-container')));
            if (this.btnDone) this.btnDone.style.display = isUnifiedHUDActive ? 'none' : 'flex';
        }

        if (selectedObj && tc.detach) tc.detach();

        if (mode === 'opening') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnOpening) this.btnOpening.classList.add('active');
            if (this.openingPanel) this.openingPanel.style.display = 'flex';
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
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';

            const isRoof = selectedObj && (selectedObj.userData.isRoof || (entity && entity.type === 'roof'));
            if (isRoof) {
                this.onMaterialFaceSelected('top', -1, selectedObj, 0, 'roof');
                return;
            }

            const isProtrusion = !!selectedObj.userData?.isProtrusion || entity.type === 'solid_protrusion' || selectedObj.userData?.widget?.type === 'solid_protrusion';
            const isWall = selectedObj && (selectedObj.userData.isWallSide || selectedObj.userData.isWallMesh || selectedObj.userData.isWallDecor || isProtrusion || entity.type === 'outer' || entity.type === 'inner' || entity.type === 'compound' || entity.type === 'wall' || entity.type === 'arc' || entity.walls || entity.parentArc || entity.type === 'wallDecor');
            const targetToAttach = (isWall && !isProtrusion && selectedObj.parent) ? selectedObj.parent : selectedObj;

            if (this.ctx.interactions.materialGizmo && targetToAttach) {
                this.ctx.interactions.materialGizmo.attach(targetToAttach);
            }

            if (isWall) {
                const side = this.activeFace || selectedObj.userData?.side || selectedObj.userData?.entity?.side || 'front';
                this.activeFace = side;
                const matIdx = side === 'left' ? 1 : (side === 'right' ? 0 : (side === 'top' ? 2 : (side === 'bottom' ? 3 : (side === 'back' ? 5 : 4))));
                const targetMesh = isProtrusion ? selectedObj : (entity.wallMesh3D || (selectedObj.parent && selectedObj.parent.userData?.wallMesh) || (selectedObj.children && selectedObj.children.find(c => c.userData?.isWallMesh)) || selectedObj);
                this.onMaterialFaceSelected(side, -1, targetMesh, matIdx, 'categories');
            } else if (selectedObj) {
                this.onMaterialFaceSelected('main', -1, selectedObj, 0, 'categories');
            } else {
                this.onMaterialFaceSelected('all', -1, null, -1, 'categories');
            }
            return;
        }

        if (mode === 'doorStyle') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnStyle) this.btnStyle.classList.add('active');
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
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.ctx.interactions.vertexSlopeGizmo && selectedObj) {
                this.ctx.interactions.vertexSlopeGizmo.attach(selectedObj);
            }
            return;
        }

        if (mode === 'roof_corners' || mode === 'roof_overhang') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnRoofCorners) this.btnRoofCorners.classList.add('active');
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.ctx.interactions.roofCornerGizmo) this.ctx.interactions.roofCornerGizmo.detach();
            if (this.ctx.interactions.roofOverhangGizmo) this.ctx.interactions.roofOverhangGizmo.detach();
            if (this.ctx.interactions.roofPitchGizmo && selectedObj) {
                this.ctx.interactions.roofPitchGizmo.attach(selectedObj, 'corners');
            }
            return;
        }

        if (mode === 'polygon_edges') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnPolygonEdges) this.btnPolygonEdges.classList.add('active');
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.ctx.interactions.polygonGizmo && selectedObj) {
                this.ctx.interactions.polygonGizmo.attach(selectedObj);
            }
            return;
        }

        if (mode === 'wall_push_pull' || mode === 'pushPull') {
            tc.visible = false;
            tc.enabled = false;
            if (this.btnPushPull) this.btnPushPull.classList.add('active');
            if (this.openingPanel) this.openingPanel.style.display = 'none';
            if (this.materialPanel) this.materialPanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            const wallExt = this.ctx.interactions.wallExtenderGizmo || this.ctx.interactions.wallPushPullGizmo;
            if (wallExt && selectedObj) {
                wallExt.attach(selectedObj);
            }
            return;
        }

        if (mode === 'translate' || mode === 'move' || mode === 'place') {
            if (this.btnMove) this.btnMove.classList.add('active');
            if (this.btnPlace) this.btnPlace.classList.add('active');

            if (isOpening) {
                tc.visible = false;
                tc.enabled = false;
                if (tc.detach) tc.detach();
                if (this.ctx.interactions?.openingGizmo && selectedObj) {
                    this.ctx.interactions.openingGizmo.attach(selectedObj, 'move');
                    this.updateOpeningPanel(selectedObj.userData.entity);
                }
                return;
            }

            const isRoof = selectedObj && (selectedObj.userData.isRoof || (entity && entity.type === 'roof'));
            if (isRoof) {
                tc.visible = false;
                tc.enabled = false;
                if (tc.detach) tc.detach();
                const conf = selectedObj?.userData?.entity?.config || selectedObj?.userData?.entity;
                const isFlat = conf?.roofType === 'flat';
                const isGable = conf?.roofType === 'gable';
                const isHalfGable = conf?.roofType === 'shed' || conf?.roofType === 'half_gable';
                const isCurvedPortal = conf?.roofType === 'curved_portal';
                if (isCurvedPortal) {
                    if (this.ctx.interactions.curvedPortalRoofGizmo) this.ctx.interactions.curvedPortalRoofGizmo.attach(selectedObj, 'move');
                } else if (isFlat) {
                    if (this.ctx.interactions.flatRoofGizmo) this.ctx.interactions.flatRoofGizmo.attach(selectedObj, 'move');
                } else if (isGable) {
                    if (this.ctx.interactions.gableRoofGizmo) this.ctx.interactions.gableRoofGizmo.attach(selectedObj, 'move');
                } else if (isHalfGable) {
                    if (this.ctx.interactions.halfGableRoofGizmo) this.ctx.interactions.halfGableRoofGizmo.attach(selectedObj, 'move');
                } else {
                    if (this.ctx.interactions.roofPitchGizmo) this.ctx.interactions.roofPitchGizmo.attach(selectedObj, 'move');
                }
                return;
            }

            tc.mode = 'translate';
            tc.showTranslate = true; tc.showRotate = false; tc.showScale = false;
            tc.showX = true; tc.showY = false; tc.showZ = true;
            tc.visible = true;
            tc.enabled = true;
            if (selectedObj && tc.attach) tc.attach(selectedObj);
            return;
        } else if (mode === 'scale') {
            tc.mode = 'scale';
            tc.showTranslate = false; tc.showRotate = false; tc.showScale = true;
            tc.showX = true; tc.showY = true; tc.showZ = true;
            if (this.btnScale) this.btnScale.classList.add('active');
        } else if (mode === 'rotateX') {
            tc.mode = 'rotate';
            tc.showTranslate = false; tc.showRotate = true; tc.showScale = false;
            tc.showX = true; tc.showY = false; tc.showZ = false;
            if (this.btnTilt) this.btnTilt.classList.add('active'); // Tilt
        } else if (mode === 'rotateY' || mode === 'spin') {
            tc.visible = false;
            tc.enabled = false;
            if (tc.detach) tc.detach();
            if (this.btnSpin) this.btnSpin.classList.add('active');

            const isRoof = selectedObj && (selectedObj.userData.isRoof || (entity && entity.type === 'roof'));
            if (isRoof) {
                if (this.ctx.interactions?.universalSpinGizmo) {
                    this.ctx.interactions.universalSpinGizmo.detach();
                }
                const conf = selectedObj?.userData?.entity?.config || selectedObj?.userData?.entity;
                const isFlat = conf?.roofType === 'flat';
                const isGable = conf?.roofType === 'gable';
                const isHalfGable = conf?.roofType === 'shed' || conf?.roofType === 'half_gable';
                const isCurvedPortal = conf?.roofType === 'curved_portal';
                if (isCurvedPortal) {
                    if (this.ctx.interactions.curvedPortalRoofGizmo) this.ctx.interactions.curvedPortalRoofGizmo.attach(selectedObj, 'spin');
                } else if (isFlat) {
                    if (this.ctx.interactions.flatRoofGizmo) this.ctx.interactions.flatRoofGizmo.attach(selectedObj, 'spin');
                } else if (isGable) {
                    if (this.ctx.interactions.gableRoofGizmo) this.ctx.interactions.gableRoofGizmo.attach(selectedObj, 'spin');
                } else if (isHalfGable) {
                    if (this.ctx.interactions.halfGableRoofGizmo) this.ctx.interactions.halfGableRoofGizmo.attach(selectedObj, 'spin');
                } else {
                    if (this.ctx.interactions.roofPitchGizmo) this.ctx.interactions.roofPitchGizmo.attach(selectedObj, 'spin');
                }
                return;
            }

            if (isOpening) {
                if (this.ctx.interactions?.universalSpinGizmo) {
                    this.ctx.interactions.universalSpinGizmo.detach();
                }
                return;
            }

            if (this.ctx.interactions?.universalSpinGizmo && selectedObj) {
                this.ctx.interactions.universalSpinGizmo.attach(selectedObj);
            }
            return;
        }

        if (selectedObj && tc.visible && tc.attach) tc.attach(selectedObj);
    }

    updateTransformMenu() {
        if (!this.transformMenu || !this.ctx.interactions?.selectedObject || !this.menuVisible) {
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
        const opD = document.getElementById('gizmo-opening-d');
        const opDR = document.getElementById('gizmo-opening-d-range');
        const dContainer = document.getElementById('gizmo-opening-d-container');
        const flipContainer = document.getElementById('gizmo-opening-flips');
        const typeContainer = document.getElementById('gizmo-opening-type-container');
        const typeSelect = document.getElementById('gizmo-opening-type');

        const w = entity.width || 100;
        let h = entity.height; if (h === undefined) h = (entity.type === 'door') ? 80 : ((entity.type === 'window') ? 45 : 200);
        let e = entity.elevation; if (e === undefined) e = (entity.type === 'window') ? 35 : 0;
        let d = entity.depth !== undefined ? entity.depth : (entity.params?.depth !== undefined ? entity.params.depth : (entity.type === 'niche_recess' ? 6 : 10));
        if (opW && document.activeElement !== opW) opW.value = w.toFixed(1); if (opWR && document.activeElement !== opWR) opWR.value = w.toFixed(1);
        if (opH && document.activeElement !== opH) opH.value = h.toFixed(1); if (opHR && document.activeElement !== opHR) opHR.value = h.toFixed(1);
        if (opE && document.activeElement !== opE) opE.value = e.toFixed(1); if (opER && document.activeElement !== opER) opER.value = e.toFixed(1);
        if (opD && document.activeElement !== opD) opD.value = d.toFixed(1); if (opDR && document.activeElement !== opDR) opDR.value = d.toFixed(1);

        if (dContainer) {
            const hasDepth = entity.type === 'niche_recess' || entity.type === 'sunshade' || entity.type === 'jali_panel' || entity.type === 'elevation_fascia' || entity.type === 'curtain' || entity.type.startsWith('curtain') || entity.type === 'wall_art' || entity.type.startsWith('decor_wall_') || entity.depth !== undefined;
            dContainer.style.display = hasDepth ? 'flex' : 'none';
        }

        if (flipContainer) {
            flipContainer.style.display = (entity.type === 'door' || entity.type === 'window' || entity.type === 'niche_recess' || entity.type === 'jali_panel' || entity.type === 'sunshade' || entity.type === 'curtain' || entity.type.startsWith('curtain') || entity.type === 'wall_art' || entity.type.startsWith('decor_wall_')) ? 'flex' : 'none';
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

    _initRoofSpinPanelEvents() {
        if (!this.roofSpinPanel) return;
        const ccwBtn = document.getElementById('gizmo-roof-spin-ccw90');
        const cwBtn = document.getElementById('gizmo-roof-spin-cw90');
        const flipBtn = document.getElementById('gizmo-roof-flip-ridge');
        const slider = document.getElementById('gizmo-roof-angle-slider');
        const input = document.getElementById('gizmo-roof-angle-input');
        const presets = this.roofSpinPanel.querySelectorAll('.gizmo-roof-angle-preset');

        const getActiveRoof = () => {
            const obj = this.ctx.interactions?.selectedObject;
            return obj?.userData?.entity;
        };

        if (ccwBtn) {
            ccwBtn.onclick = () => {
                const roof = getActiveRoof();
                if (roof) {
                    const current = roof.rotation || 0;
                    this.updateRoofRotation(roof, current - 90);
                }
            };
        }

        if (cwBtn) {
            cwBtn.onclick = () => {
                const roof = getActiveRoof();
                if (roof) {
                    const current = roof.rotation || 0;
                    this.updateRoofRotation(roof, current + 90);
                }
            };
        }

        if (flipBtn) {
            flipBtn.onclick = () => {
                const roof = getActiveRoof();
                if (roof) {
                    const conf = roof.config || roof;
                    const nextAxis = (conf.ridgeAxis === 'y') ? 'x' : 'y';
                    RoofEngine.setRidgeAxis(roof, nextAxis, this.ctx.planner || this.ctx, true);
                    if (this.ctx.interactions?.roofPitchGizmo) this.ctx.interactions.roofPitchGizmo.updateHandlePositions();
                    if (this.ctx.interactions?.flatRoofGizmo) this.ctx.interactions.flatRoofGizmo.updateHandlePositions();
                    if (this.ctx.interactions?.gableRoofGizmo) this.ctx.interactions.gableRoofGizmo.updateHandlePositions();
                    if (this.ctx.interactions?.halfGableRoofGizmo) this.ctx.interactions.halfGableRoofGizmo.updateHandlePositions();
                }
            };
        }

        presets.forEach(p => {
            p.onclick = () => {
                const angle = parseInt(p.getAttribute('data-angle'), 10) || 0;
                const roof = getActiveRoof();
                if (roof) this.updateRoofRotation(roof, angle);
            };
        });

        if (slider) {
            slider.oninput = (e) => {
                const angle = parseInt(e.target.value, 10) || 0;
                const roof = getActiveRoof();
                if (roof) this.updateRoofRotation(roof, angle);
            };
        }

        if (input) {
            input.onchange = (e) => {
                const angle = parseInt(e.target.value, 10) || 0;
                const roof = getActiveRoof();
                if (roof) this.updateRoofRotation(roof, angle);
            };
        }
    }

    updateRoofRotation(roof, newAngle) {
        if (!roof) return;
        RoofEngine.setRotation(roof, newAngle, this.ctx.planner || this.ctx);
        if (this.ctx.interactions?.roofPitchGizmo) {
            this.ctx.interactions.roofPitchGizmo.updateHandlePositions();
        }
        if (this.ctx.interactions?.flatRoofGizmo) {
            this.ctx.interactions.flatRoofGizmo.updateHandlePositions();
        }
        if (this.ctx.interactions?.gableRoofGizmo) {
            this.ctx.interactions.gableRoofGizmo.updateHandlePositions();
        }
        if (this.ctx.interactions?.halfGableRoofGizmo) {
            this.ctx.interactions.halfGableRoofGizmo.updateHandlePositions();
        }
        this.syncRoofSpinPanel(roof);
    }

    syncRoofSpinPanel(roof) {
        if (!this.roofSpinPanel || !roof) return;
        const angle = ((Math.round(roof.rotation || 0) % 360) + 360) % 360;
        const display = document.getElementById('gizmo-roof-angle-display');
        const slider = document.getElementById('gizmo-roof-angle-slider');
        const input = document.getElementById('gizmo-roof-angle-input');
        if (display) display.innerText = `${angle}°`;
        if (slider && document.activeElement !== slider) slider.value = angle;
        if (input && document.activeElement !== input) input.value = angle;
    }

    dispose() {
        if (this._activeDragCleanups) {
            this._activeDragCleanups.forEach(fn => fn());
            this._activeDragCleanups = [];
        }
        if (coreEventBus) {
            coreEventBus.off('InteractionStateChanged', this._onInteractionStateChanged);
        }
        if (this.openingPanel && this.openingPanel.parentNode) this.openingPanel.parentNode.removeChild(this.openingPanel);
        if (this.roofSpinPanel && this.roofSpinPanel.parentNode) this.roofSpinPanel.parentNode.removeChild(this.roofSpinPanel);
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
        if (this.ctx?.interactions?.universalSpinGizmo && this.ctx.interactions.universalSpinGizmo.dispose) {
            this.ctx.interactions.universalSpinGizmo.dispose();
        }
    }
}



