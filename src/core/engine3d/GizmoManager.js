import { EVENTS } from '../registry.js';
import { coreEventBus } from '../EventBus.js';
import * as THREE from 'three';
import { DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY, WOOD_REGISTRY, DOOR_STYLES_REGISTRY, ROOF_DECOR_REGISTRY, GIZMO_REGISTRY, FABRIC_REGISTRY, LEATHER_REGISTRY, FLOOR_REGISTRY, GLASS_REGISTRY, METAL_REGISTRY, STONE_REGISTRY, BRICK_REGISTRY, MARBLE_REGISTRY, PLASTIC_REGISTRY, parseCompositeMaterialKey, resolveFabricConfig, getFabricBaseConfig } from '../registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { UniversalMaterialManager } from './UniversalMaterialManager.js';
import { BIMMaterialSystem } from './BIMMaterialSystem.js';
import { glassPreviewRenderer } from './GlassPreviewRenderer.js';
import { marblePreviewRenderer } from './MarblePreviewRenderer.js';
import { patternManager } from '../services/pattern/PatternManager.js';
import { PatternTextureBlender } from '../services/pattern/PatternTextureBlender.js';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { SLOT_DEFINITIONS } from '../constants/materialSlots.js';
const TILE_REGISTRY = WALL_DECOR_REGISTRY;
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

        this.transformMenu = document.createElement('div');
        this.transformMenu.className = 'transform-menu-3d';
        this.transformMenu.style.display = 'none';
        this.transformMenu.style.zIndex = '1000';
        
        this.xyPanel = document.createElement('div');
        this.xyPanel.style.display = 'none';
        this.xyPanel.style.position = 'absolute';
        this.xyPanel.style.bottom = '145px';
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
                    background: radial-gradient(circle at 50% 50%, rgba(15, 23, 42, 0.35) 0%, rgba(9, 9, 11, 0.75) 100%);
                    z-index: 99999; display: flex; flex-direction: column; justify-content: flex-start;
                    padding: 3vh 3.5vw 4vh 3.5vw; box-sizing: border-box;
                    opacity: 0; transition: opacity 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: none;
                }
                .mat-lib-overlay.active {
                    opacity: 1; pointer-events: none;
                }
                .mat-lib-inner {
                    width: 100%; max-width: 1550px; margin: 0 auto; height: auto;
                    display: flex; flex-direction: column; justify-content: flex-start; pointer-events: none;
                }
                .mat-lib-split-container {
                    display: flex; flex-direction: row; align-items: stretch; gap: 20px;
                    width: 100%; box-sizing: border-box;
                }
                .mat-lib-col-left {
                    flex: 1 1 58%; min-width: 0; display: flex; flex-direction: column;
                }
                .mat-lib-col-right {
                    flex: 0 0 42%; max-width: 480px; min-width: 320px; display: flex; flex-direction: column;
                }
                .mat-lib-col-right:empty,
                .mat-lib-col-right > div:empty {
                    display: none;
                }
                @media (max-width: 960px) {
                    .mat-lib-split-container {
                        flex-direction: column; gap: 16px;
                    }
                    .mat-lib-col-left, .mat-lib-col-right {
                        width: 100%; max-width: 100%; flex: none;
                    }
                }
                #gizmo-subgroup-tabs-container, .gizmo-wall-target-bar, .gizmo-decor-chip, .gizmo-slider, .gizmo-input-num {
                    pointer-events: auto !important;
                }
                .mat-lib-header {
                    display: flex; flex-direction: row; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 16px;
                    flex-shrink: 0; pointer-events: auto; position: relative;
                }
                .mat-header-left {
                    display: flex; flex-direction: column; justify-content: center;
                }
                .mat-lib-title-text {
                    font-size: clamp(24px, 3.5vw, 32px); font-weight: 700; color: white; margin: 0 0 6px 0; letter-spacing: 0.5px;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .mat-lib-subtitle-text {
                    font-size: 14px; color: #cbd5e1; font-weight: 500;
                    text-shadow: 0 2px 10px rgba(0,0,0,0.8);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                }
                .mat-lib-grid-wrapper {
                    width: 100%; overflow-x: auto; padding: 4px 4px 16px 4px; pointer-events: auto;
                    scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.2) transparent;
                    -webkit-overflow-scrolling: touch; scroll-behavior: smooth;
                }
                .mat-lib-grid-wrapper::-webkit-scrollbar {
                    height: 6px;
                }
                .mat-lib-grid-wrapper::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.2); border-radius: 99px;
                }
                .mat-lib-grid {
                    display: flex; flex-direction: row; gap: 16px; align-items: stretch; width: max-content; min-width: 100%;
                }
                .mat-card {
                    width: 165px; min-height: 245px; border-radius: 18px;
                    background: linear-gradient(145deg, rgba(39, 39, 42, 0.85) 0%, rgba(24, 24, 27, 0.95) 100%);
                    border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 10px 25px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column; align-items: center; justify-content: space-between;
                    padding: 14px 12px 16px 12px; box-sizing: border-box; cursor: pointer;
                    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative;
                    user-select: none; flex-shrink: 0; touch-action: pan-x;
                }
                .mat-card:hover {
                    transform: translateY(-6px);
                    border-color: rgba(255, 255, 255, 0.25);
                    box-shadow: 0 15px 35px rgba(0,0,0,0.7);
                }
                .mat-card:active {
                    transform: scale(0.96);
                }
                .mat-card.active-card {
                    border: 1px solid #f97316 !important;
                    box-shadow: 0 0 25px rgba(249, 115, 22, 0.3), 0 10px 25px rgba(0,0,0,0.6);
                }
                .mat-card-icon-badge {
                    align-self: flex-start; width: 32px; height: 32px; border-radius: 50%;
                    display: flex; align-items: center; justify-content: center; margin-bottom: 8px;
                    transition: transform 0.2s; flex-shrink: 0;
                }
                .mat-card:hover .mat-card-icon-badge {
                    transform: scale(1.1);
                }
                .mat-sphere {
                    width: 110px; height: 110px; border-radius: 50%; position: relative;
                    margin: 8px 0;
                    box-shadow: 
                        0 15px 25px -5px rgba(0, 0, 0, 0.8),
                        inset -10px -10px 25px rgba(0, 0, 0, 0.75),
                        inset 6px 6px 15px rgba(255, 255, 255, 0.35);
                    overflow: hidden; background-size: cover; background-position: center;
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1); flex-shrink: 0;
                }
                .mat-clear-circle {
                    width: 110px; height: 110px; border-radius: 50%; margin: 8px 0;
                    border: 3px dashed rgba(255,255,255,0.7);
                    display: flex; align-items: center; justify-content: center;
                    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    flex-shrink: 0;
                }
                .mat-card:hover .mat-clear-circle {
                    transform: scale(1.06) rotate(-45deg);
                }
                .mat-card:hover .mat-sphere {
                    transform: scale(1.06) rotate(3deg);
                }
                .mat-sphere::after {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%;
                    background: radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(0, 0, 0, 0.75) 90%);
                    pointer-events: none;
                }
                .mat-card-title {
                    color: white; font-weight: 600; font-size: 14.5px; margin-top: 8px; text-align: center;
                    width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .mat-card-sub {
                    color: #94a3b8; font-size: 12px; margin-top: 2px; text-align: center; width: 100%;
                }
                .mat-card.active-card .mat-card-sub {
                    color: #f97316; font-weight: 600;
                }
                .mat-card.is-glass-card {
                    border-radius: 20px !important;
                    background: linear-gradient(145deg, #242426 0%, #161617 100%) !important;
                    border: 1px solid rgba(255, 255, 255, 0.08) !important;
                }
                .mat-card.is-glass-card.active-card {
                    border-color: #38bdf8 !important;
                    box-shadow: 0 0 25px rgba(56, 189, 248, 0.35), 0 10px 25px rgba(0,0,0,0.6) !important;
                }
                .mat-card.is-glass-card.active-card .mat-card-sub {
                    color: #38bdf8 !important; font-weight: 700 !important;
                }
                .mat-sphere.is-3d-glass {
                    background-size: cover !important;
                    background-position: center !important;
                    background-color: transparent !important;
                    box-shadow: 0 12px 28px -4px rgba(0, 0, 0, 0.75), inset 0 0 20px rgba(56, 189, 248, 0.12) !important;
                }
                .mat-sphere.is-3d-glass::after {
                    display: none !important;
                }

                .mat-card-selected-checkmark {
                    position: absolute; top: 10px; right: 10px; width: 22px; height: 22px; border-radius: 50%;
                    background: #38bdf8; color: #0f172a; display: flex; align-items: center; justify-content: center;
                    font-size: 13px; font-weight: 800; box-shadow: 0 2px 8px rgba(56, 189, 248, 0.5);
                    opacity: 0; transform: scale(0.6); transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                    pointer-events: none;
                }
                .mat-card.active-card .mat-card-selected-checkmark {
                    opacity: 1; transform: scale(1);
                }
                .mat-search-wrapper {
                    display: flex; gap: 12px; align-items: center; flex-shrink: 0;
                }
                .mat-search-pill {
                    background: rgba(24, 24, 27, 0.85); border: 1px solid rgba(255, 255, 255, 0.12);
                    border-radius: 99px; display: flex; align-items: center;
                    padding: 8px 16px; width: 260px; transition: border-color 0.2s, box-shadow 0.2s;
                }
                .mat-search-pill:focus-within {
                    border-color: #f97316; box-shadow: 0 0 15px rgba(249, 115, 22, 0.2);
                }
                .mat-filter-btn {
                    background: rgba(24, 24, 27, 0.85); border: 1px solid rgba(255, 255, 255, 0.12);
                    width: 40px; height: 40px; border-radius: 12px; color: #94a3b8; cursor: pointer;
                    display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                    flex-shrink: 0;
                }
                .mat-filter-btn:hover {
                    background: rgba(255, 255, 255, 0.1); color: white; border-color: rgba(255, 255, 255, 0.3);
                }
                .mat-close-btn {
                    background: rgba(24, 24, 27, 0.85); border: 1px solid rgba(255, 255, 255, 0.15);
                    width: 42px; height: 42px; border-radius: 50%; color: white; cursor: pointer;
                    font-size: 20px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;
                    margin-left: 8px; flex-shrink: 0;
                }
                .mat-close-btn:hover {
                    background: rgba(239, 68, 68, 0.8); border-color: #ef4444; transform: rotate(90deg);
                }
                @media (max-width: 768px) {
                    .mat-lib-overlay { padding: 2vh 3.5vw; }
                    .mat-lib-header { flex-direction: column; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
                    .mat-header-left { padding-right: 54px; width: 100%; box-sizing: border-box; }
                    .mat-search-wrapper { width: 100%; justify-content: space-between; gap: 8px; }
                    .mat-search-pill { flex: 1; width: auto; min-width: 140px; }
                    .mat-close-btn { position: absolute; top: 0; right: 0; margin-left: 0; z-index: 10; }
                    .mat-lib-grid { gap: 12px; }
                    .mat-card { width: 130px; min-height: 205px; padding: 12px 10px; border-radius: 16px; }
                    .mat-sphere { width: 84px; height: 84px; margin: 6px 0; }
                    .mat-card-title { font-size: 13.5px; margin-top: 6px; }
                    .mat-card-sub { font-size: 11px; }
                }
                @media (max-width: 480px) {
                    .mat-lib-overlay { padding: 1.5vh 3vw; }
                    .mat-lib-header { gap: 10px; margin-bottom: 10px; }
                    .mat-lib-title-text { font-size: 22px; margin-bottom: 4px; }
                    .mat-lib-subtitle-text { font-size: 12.5px; }
                    .mat-lib-grid { gap: 10px; }
                    .mat-card { width: 115px; min-height: 185px; padding: 10px 8px; border-radius: 14px; }
                    .mat-sphere { width: 74px; height: 74px; margin: 5px 0; }
                    .mat-card-title { font-size: 12.5px; margin-top: 4px; }
                    .mat-card-sub { font-size: 10.5px; }
                    .mat-search-pill { padding: 6px 12px; font-size: 13px; }
                    .mat-filter-btn { width: 36px; height: 36px; }
                    .mat-close-btn { width: 38px; height: 38px; font-size: 18px; }
                }
            `;
            document.head.appendChild(style);
        }

        this.materialPanel = document.createElement('div');
        this.materialPanel.className = 'mat-lib-overlay';
        this.materialPanel.style.display = 'none';
        
        this.materialPanel.innerHTML = `
              <div class="mat-lib-inner">
                  <div>
                      <div class="mat-lib-header">
                          <div class="mat-header-left">
                              <h2 class="mat-lib-title-text">Material Library</h2>
                              <div class="mat-lib-subtitle-text">
                                  Applying to: <span id="gizmo-material-face-name" style="color: #60a5fa; font-weight: 600; cursor: pointer; text-transform: capitalize;" title="Click to view categories">Select Material Type</span>
                              </div>
                          </div>
                          <div class="mat-search-wrapper">
                              <div class="mat-search-pill">
                                  <svg style="width: 18px; height: 18px; color: #94a3b8; flex-shrink: 0; margin-right: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                  <input id="mat-lib-search-input" type="text" placeholder="Search materials..." style="background: transparent; border: none; color: white; outline: none; width: 100%; font-size: 14px; font-family: inherit;">
                              </div>
                              <button class="mat-filter-btn" title="Filter materials"><svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg></button>
                              <button id="close-material-lib" class="mat-close-btn">&times;</button>
                          </div>
                      </div>
                      
                      <div class="mat-lib-split-container">
                          <!-- Left Side: Material Selection & Gallery -->
                          <div class="mat-lib-col-left">
                              <div class="mat-lib-grid-wrapper">
                                  <div id="gizmo-material-grid" class="mat-lib-grid"></div>
                              </div>
                          </div>

                          <!-- Right Side: Layer & Applied Material Management -->
                          <div class="mat-lib-col-right">
                              <div id="gizmo-subgroup-tabs-container"></div>
                          </div>
                      </div>
                  </div>
              </div>
          `;
        
        // Block pointer events from hitting the 3D scene below when clicking interactive UI elements
        ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'touchstart', 'touchend', 'touchmove'].forEach(evt => {
            this.materialPanel.addEventListener(evt, e => {
                if (e.target.closest('.mat-lib-inner, .mat-lib-header, .mat-lib-grid-wrapper, #gizmo-subgroup-tabs-container, .gizmo-wall-target-bar, .gizmo-decor-chip, .gizmo-decor-card, .gizmo-slider, .gizmo-input-num, input, button')) {
                    e.stopPropagation();
                }
            }, { passive: false });
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

        // Hook up subtitle navigation link
        const faceNameLink = this.materialPanel.querySelector('#gizmo-material-face-name');
        if (faceNameLink) {
            faceNameLink.addEventListener('click', () => {
                if (faceNameLink.textContent.includes('Back') || faceNameLink.textContent !== 'Select Material Type') {
                    this.onMaterialFaceSelected(this.activeFace, this.activeSubMeshIndex, this.activeObject, this.activeMatIndex, 'categories');
                }
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
        this.btnDone.style.bottom = '85px';
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

        this._makePanelDraggable(this.xyPanel);
        this._makePanelDraggable(this.openingPanel);
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
                    
                    if (obj.userData.entity) {
                        const entId = obj.userData.entity.id || (obj.userData.entity.group && obj.userData.entity.group.id());
                        if (entId) {
                            coreEventBus.emit('EntityTransformUpdated3D', { 
                                entity: entId, 
                                x: obj.position.x, 
                                y: obj.position.z, 
                                elevation: newElevation,
                                rotation: -(obj.rotation.y * 180 / Math.PI)
                            });
                        }
                    }
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
                                else registry = ROOF_DECOR_REGISTRY;
                            } else if (selectedObj.userData.isFurniture || selectedObj.userData.entity.type === 'furniture') {
                                registry = Object.assign({}, FABRIC_REGISTRY, WOOD_REGISTRY, WALL_DECOR_REGISTRY, GLASS_REGISTRY);
                            }
                        }
                        const config = registry[texKey] || GLASS_REGISTRY[texKey];
                        this.matNameDisplay.innerText = config ? (config.name || config.label) : (texKey || 'Clear Material');
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
                        if (this.activeObject && realSelectedObj) {
                            const targetKey = this.activeObject.name || this.activeObject.userData?.subMeshKey;
                            if (targetKey) {
                                let foundNewActive = null;
                                realSelectedObj.traverse(child => {
                                    if (child.isMesh && (child.name === targetKey || child.userData?.subMeshKey === targetKey)) {
                                        foundNewActive = child;
                                    }
                                });
                                if (foundNewActive) {
                                    this.activeObject = foundNewActive;
                                }
                            }
                        }
                        
                        const selectedObj = realSelectedObj;
                        if (selectedObj && selectedObj.userData && selectedObj.userData.entity) {
                            const entity = selectedObj.userData.entity;
                            const key = thumb.getAttribute('data-mat');
                            if (!key) return;

                            const isWallEntity = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.startX !== undefined;
                            const isWallDecor = entity.type === 'wallDecor';

                            // 1. Wall and WallDecor Material Management (Material Scope: Selected Face vs Entire Object)
                            if (isWallEntity || isWallDecor) {
                                const wall = isWallDecor ? (entity.mesh3D?.userData?.parentWall || selectedObj?.parent?.userData?.entity || entity) : entity;
                                const side = (this.activeFace === 'back' || selectedObj.userData?.side === 'back' || this.activeObject?.userData?.side === 'back') ? 'back' : 'front';
                                
                                if (this.materialScope === 'entireObject') {
                                    // Entire Object: The whole wall structure itself becomes this material (no layers needed)
                                    wall.params = wall.params || {};
                                    wall.params.texture = key;
                                    wall.params.textureFront = key;
                                    wall.params.textureBack = key;
                                    wall.params.textureSides = key;
                                    wall.params.textureTop = key;
                                    wall.params.textureBottom = key;
                                    if (this.ctx && typeof this.ctx.updateMaterialLive === 'function') {
                                        this.ctx.updateMaterialLive(wall);
                                    }
                                    if (typeof this.ctx.requestRender === 'function') {
                                        this.ctx.requestRender();
                                    }
                                    if (window.plannerInstance && typeof window.plannerInstance.saveHistory === 'function') {
                                        window.plannerInstance.saveHistory();
                                    }
                                    this._renderWallMultiMaterialTabs(wall, selectedObj);
                                    highlightSelectedThumb(key);
                                    return;
                                } else if (this.ctx && typeof this.ctx.addWallPattern === 'function') {
                                    // Selected Face: Add/customize an extruded layer on the active face
                                    const decor = this.ctx.addWallPattern(wall, key, side);
                                    if (wall.attachedDecor) {
                                        wall.attachedDecor = [...wall.attachedDecor];
                                    }
                                    if (decor) {
                                        this.activeDecorId = decor.id;
                                    }
                                    if (typeof this.ctx.requestRender === 'function') {
                                        this.ctx.requestRender();
                                    }
                                    if (window.plannerInstance && typeof window.plannerInstance.saveHistory === 'function') {
                                        window.plannerInstance.saveHistory();
                                    }
                                    this._renderWallMultiMaterialTabs(wall, selectedObj);
                                    highlightSelectedThumb(key);
                                    return;
                                }
                            }

                            // 2. Door / Window / Furniture Entire Object Scope Handling
                            if (this.materialScope === 'entireObject') {
                                if (entity.type === 'door') {
                                    if (!entity.materials) entity.materials = {};
                                    entity.materials.panel = key;
                                    entity.materials.frame = key;
                                    entity.params = entity.params || {};
                                    entity.params.textureFront = key;
                                    entity.params.textureBack = key;
                                    entity.params.frameMat = key;
                                    entity.doorMat = key;
                                    entity.frameMat = key;
                                    if (this.ctx.updateMaterialLive) this.ctx.updateMaterialLive(entity);
                                    if (typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
                                    highlightSelectedThumb(key);
                                    return;
                                } else if (entity.type === 'window') {
                                    if (!entity.materials) entity.materials = {};
                                    entity.materials.frame = key;
                                    entity.params = entity.params || {};
                                    entity.params.frameMat = key;
                                    entity.frameMat = key;
                                    if (this.ctx.updateMaterialLive) this.ctx.updateMaterialLive(entity);
                                    if (typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
                                    highlightSelectedThumb(key);
                                    return;
                                } else if (entity.materials || entity.params) {
                                    if (entity.materials) {
                                        for (const sKey of Object.keys(entity.materials)) {
                                            entity.materials[sKey] = key;
                                        }
                                    }
                                    entity.params = entity.params || {};
                                    entity.params.material = key;
                                    if (entity.params.blocks) {
                                        for (const bKey of Object.keys(entity.params.blocks)) {
                                            entity.params.blocks[bKey].material = key;
                                        }
                                    }
                                    if (this.ctx.updateMaterialLive) this.ctx.updateMaterialLive(entity);
                                    if (typeof this.ctx.requestRender === 'function') this.ctx.requestRender();
                                    highlightSelectedThumb(key);
                                    return;
                                }
                            }

                            entity.params = entity.params || {};
                            const target = this.activeFace || 'front';
                            
                            if (key && FABRIC_REGISTRY[key]) {
                                const currentState = this._getCurrentFabricState(selectedObj);
                                let effectiveKey = key;
                                if (currentState.patternId && FABRIC_REGISTRY[key].supportsPatterns !== false) {
                                    effectiveKey = `${key}::pattern::${currentState.patternId}`;
                                }
                                this._applyFabricCompositeMaterial(effectiveKey, selectedObj);
                                highlightSelectedThumb(key);
                                return;
                            }
                            
                            let targetParams = entity.params;
                            if (this.activeSubMeshIndex !== -1 && entity.materialMode !== 'PROCEDURAL' && entity.materialMode !== 'MONOLITHIC') {
                                entity.params.blocks = entity.params.blocks || {};
                                entity.params.blocks[this.activeSubMeshIndex] = entity.params.blocks[this.activeSubMeshIndex] || {};
                                targetParams = entity.params.blocks[this.activeSubMeshIndex];
                            }
                            
                            const isFrame = this.activeObject && this.activeObject.userData && this.activeObject.userData.isFrame;
                            
                            // Refactored: Delegate to entity.applyMaterial if available (SOLID: OCP)
                            if (typeof entity.applyMaterial === 'function') {
                                const isWallEntity = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.type === 'railing';
                                const targetWallMesh = isWallEntity ? (entity.wallMesh3D || (entity.mesh3D && (entity.mesh3D.userData?.wallMesh || (entity.mesh3D.children ? entity.mesh3D.children.find(c => c.userData?.isWallMesh || (c.isMesh && !c.userData?.isHitbox && !c.userData?.isWallSide && !c.userData?.isDoor && !c.userData?.isWindow && !c.userData?.isFrame && !c.userData?.isGlass && !c.userData?.isHandle)) : null)))) : null;
                                const meshToApply = targetWallMesh || this.activeObject;
                                
                                let newMat = null;
                                let effectiveMatIndex = this.activeMatIndex;
                                if (isWallEntity) {
                                    const FACE_MAP = { right: 0, left: 1, top: 2, bottom: 3, front: 4, back: 5 };
                                    effectiveMatIndex = FACE_MAP[target] !== undefined ? FACE_MAP[target] : (this.activeObject?.userData?.side === 'back' ? 5 : 4);
                                }

                                if (meshToApply && effectiveMatIndex !== undefined && effectiveMatIndex !== -1) {
                                    const mats = Array.isArray(meshToApply.material) ? meshToApply.material : [meshToApply.material];
                                    if (mats[effectiveMatIndex]) {
                                        newMat = mats[effectiveMatIndex].clone();
                                        let registry = WALL_DECOR_REGISTRY;
                                        if (entity.type === 'door' || entity.type === 'window') registry = Object.assign({}, WOOD_REGISTRY, GLASS_REGISTRY);
                                        else if (entity.type === 'roof') registry = ROOF_DECOR_REGISTRY;
                                        
                                        const config = (key && registry[key]) ? registry[key] : (key ? (GLASS_REGISTRY[key] || MARBLE_REGISTRY[key] || STONE_REGISTRY[key] || BRICK_REGISTRY[key] || METAL_REGISTRY[key] || WALL_DECOR_REGISTRY[key]) : null);
                                        if (config) {
                                            MaterialFactory.applyPBRMaterial(meshToApply, config, this.ctx, effectiveMatIndex);
                                        } else {
                                            newMat.map = null;
                                            let fColor = 0xffffff;
                                            if (entity.fasciaMat === 'dark_grey') fColor = 0x333333;
                                            else if (entity.fasciaMat === 'stone') fColor = 0xa8a29e;
                                            else if (entity.fasciaMat === 'wood') fColor = 0x8b5a2b;
                                            newMat.color.setHex(fColor);
                                            if (Array.isArray(meshToApply.material)) {
                                                meshToApply.material[effectiveMatIndex] = newMat;
                                            } else {
                                                meshToApply.material = newMat;
                                            }
                                        }
                                    }
                                }
                                
                                entity.applyMaterial({ target, key, newMat, activeMatIndex: effectiveMatIndex, activeObject: meshToApply, ctx: this.ctx });
                                highlightSelectedThumb(key);
                             } else {
                                 // CAD/BIM Material System for all material types
                                 const targetMeshToUse = this.activeObject || selectedObj;
                                 const descriptor = this.activeDescriptor || BIMMaterialSystem.resolveBIMTarget(
                                     targetMeshToUse,
                                     this.activeMatIndex,
                                     null,
                                     entity
                                 );
                                 BIMMaterialSystem.applyBIMMaterial(descriptor, key, this.ctx);
                                 highlightSelectedThumb(key);
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
        
        let materialCategory = forcedCategory || 'categories';
        
        if (!forcedCategory) {
            if (this.activeDescriptor && this.activeDescriptor.slotName) {
                const slot = this.activeDescriptor.slotName;
                materialCategory = SLOT_DEFINITIONS[slot]?.defaultCategory || 'categories';
            } else if (selectedObj && selectedObj.userData && selectedObj.userData.entity) {
                if (selectedObj.userData.entity.params && selectedObj.userData.entity.params.materialCategory) {
                    materialCategory = selectedObj.userData.entity.params.materialCategory;
                } else {
                    const type = selectedObj.userData.entity.type;
                    if (type !== 'furniture' && !selectedObj.userData.entity.isFurniture) {
                        materialCategory = type;
                    }
                }
            }
        }
        
        // Legacy hardcoded component overrides removed in favor of pure universal inference below.
        
        const gridPanel = document.getElementById('gizmo-material-grid');
        if (gridPanel) {
            gridPanel.style.display = 'flex';
            const wrapper = gridPanel.closest('.mat-lib-grid-wrapper') || gridPanel.parentElement;
            if (wrapper) wrapper.scrollLeft = 0;
        }
        const searchEl = document.getElementById('mat-lib-search-input');
        if (searchEl) searchEl.value = '';
        
        if (materialCategory === 'categories') {
            if (this.matFaceNameDisplay) {
                this.matFaceNameDisplay.innerText = 'Select Material Type';
                this.matFaceNameDisplay.style.textDecoration = 'none';
            }
            
            const getCount = (reg) => reg ? Object.entries(reg).filter(([k, v]) => !v.isAlias).length : 0;
            const getSampleBg = (reg) => {
                if (!reg) return '';
                const keys = Object.keys(reg);
                if (keys.length === 0) return '';
                const val = reg[keys[0]];
                if (val.cssSphere) return val.cssSphere;
                const thumbUrl = val.thumbnail || val.texture || val.map || val.diffuseMap;
                if (thumbUrl) return `background-image: url('${thumbUrl}');`;
                if (val.color) return `background-color: #${val.color.toString(16).padStart(6, '0')};`;
                return '';
            };
            
            const clearGlass3dThumb = glassPreviewRenderer.renderGlassThumbnail('clear', GLASS_REGISTRY.clear);

            const cats = [
                { id: 'stone', title: 'Natural Stone', count: getCount(STONE_REGISTRY), desc: 'Rustic stacked fieldstone, charcoal cleft slate, and Roman travertine limestone.', iconBg: 'rgba(16, 185, 129, 0.25)', iconColor: '#10b981', iconSvg: '<polygon points="12 2 2 7 12 22 22 7 12 2"/>', sphereGrad: 'radial-gradient(circle at 40% 30%, #cbd5e1, #64748b 55%, #334155 85%, #0f172a 100%)', sphereColor: '#64748b', sampleBg: getSampleBg(STONE_REGISTRY) },
                { id: 'brick', title: 'Bricks & Masonry', count: getCount(BRICK_REGISTRY), desc: 'Classic red brick, orange textured, dark burgundy, and rustic masonry.', iconBg: 'rgba(239, 68, 68, 0.25)', iconColor: '#ef4444', iconSvg: '<rect x="2" y="4" width="20" height="16" rx="1"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="4" x2="12" y2="12"/><line x1="7" y1="12" x2="7" y2="20"/><line x1="17" y1="12" x2="17" y2="20"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #f87171, #b91c1c 50%, #7f1d1d 85%, #450a0a 100%)', sphereColor: '#b91c1c', sampleBg: getSampleBg(BRICK_REGISTRY) },
                { id: 'marble', title: 'Marble & Granite', count: getCount(MARBLE_REGISTRY), desc: 'Luxurious Italian Carrara, Nero Marquina black, and polished Calacatta gold marble slabs.', iconBg: 'rgba(236, 72, 153, 0.25)', iconColor: '#ec4899', iconSvg: '<polygon points="12 2 2 7 12 22 22 7 12 2"/>', sphereGrad: 'radial-gradient(circle at 40% 30%, #f1f5f9, #94a3b8 55%, #475569 85%, #0f172a 100%)', sphereColor: '#94a3b8', sampleBg: getSampleBg(MARBLE_REGISTRY) },
                { id: 'wood', title: 'Wood / Veneer', count: getCount(WOOD_REGISTRY), desc: 'Warm, natural timber grains and high-end polished architectural wood veneers.', iconBg: 'rgba(120, 53, 15, 0.35)', iconColor: '#f59e0b', iconSvg: '<path d="M12 2L6 12h3v8h6v-8h3L12 2z"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #d97706, #78350f 50%, #451a03 90%)', sphereColor: '#78350f', sampleBg: getSampleBg(WOOD_REGISTRY) },
                { id: 'wall_decor', title: 'Wall Decor', count: getCount(WALL_DECOR_REGISTRY), desc: 'Exterior plaster, interior paints, and decorative wall textures.', iconBg: 'rgba(59, 130, 246, 0.25)', iconColor: '#3b82f6', iconSvg: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #93c5fd, #2563eb 50%, #1e40af 85%)', sphereColor: '#2563eb', sampleBg: getSampleBg(WALL_DECOR_REGISTRY) },
                { id: 'fabric', title: 'Fabric / Decor', count: getCount(FABRIC_REGISTRY), desc: 'Soft materials and decorative fabrics for furniture, walls and decor.', iconBg: 'rgba(249, 115, 22, 0.25)', iconColor: '#f97316', iconSvg: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h10M7 9h10"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #fdba74, #ea580c 50%, #9a3412 85%, #431407 100%)', sphereColor: '#ea580c', sampleBg: getSampleBg(FABRIC_REGISTRY) },
                { id: 'metal', title: 'Metals', count: getCount(METAL_REGISTRY), desc: 'Brushed aluminum, polished chrome, structural steel and luxury decorative anodized finishes.', iconBg: 'rgba(100, 116, 139, 0.35)', iconColor: '#94a3b8', iconSvg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.72 1.05 1.33 1.28H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>', sphereGrad: 'linear-gradient(135deg, #e2e8f0 0%, #64748b 45%, #f8fafc 50%, #334155 100%)', sphereColor: '#94a3b8', sampleBg: getSampleBg(METAL_REGISTRY) },
                { id: 'glass', title: 'Glass', count: getCount(GLASS_REGISTRY), desc: 'Clear tempered glass, architectural privacy frosting and energy-efficient tinted glazing.', iconBg: 'rgba(6, 182, 212, 0.25)', iconColor: '#06b6d4', iconSvg: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/>', sphereGrad: '', sphereColor: '#06b6d4', sampleBg: `background-image: url('${clearGlass3dThumb}'); background-size: cover; background-position: center;` },
                { id: 'plastic', title: 'Plastics', count: getCount(PLASTIC_REGISTRY), desc: 'Matte black polycarbonates, glossy PVC trims, lightweight laminates and composite plastics.', iconBg: 'rgba(168, 85, 247, 0.25)', iconColor: '#a855f7', iconSvg: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>', sphereGrad: 'radial-gradient(circle at 35% 30%, #52525b, #27272a 60%, #09090b 100%)', sphereColor: '#27272a', sampleBg: getSampleBg(PLASTIC_REGISTRY) },
                { id: 'leather', title: 'Leather', count: getCount(LEATHER_REGISTRY), desc: 'Supple aniline leathers, embossed hides, and eco-friendly artificial leather upholstery.', iconBg: 'rgba(180, 83, 9, 0.25)', iconColor: '#d97706', iconSvg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #b45309, #713f12 55%, #422006 90%, #1c0f04 100%)', sphereColor: '#713f12', sampleBg: getSampleBg(LEATHER_REGISTRY) }
            ];
            
            let activeCatId = this._lastSelectedCat || 'stone';
            let categoryThumbnails = '';
            for (const cat of cats) {
                const isSelected = cat.id === activeCatId;
                const activeClass = isSelected ? ' active-card' : '';
                const is3dGlassClass = cat.id === 'glass' ? ' is-3d-glass' : '';
                const sphereStyle = cat.sampleBg ? `${cat.sampleBg}; background-color: ${cat.sphereColor};` : `background-image: ${cat.sphereGrad}; background-color: ${cat.sphereColor};`;
                categoryThumbnails += `
                    <div class="mat-card mat-category-thumb${activeClass}" data-cat="${cat.id}">
                        <div class="mat-card-icon-badge" style="background: ${cat.iconBg}; color: ${cat.iconColor};">
                            <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cat.iconSvg}</svg>
                        </div>
                        <div class="mat-sphere${is3dGlassClass}" style="${sphereStyle}"></div>
                        <div style="width: 100%;">
                            <div class="mat-card-title">${cat.title}</div>
                            <div class="mat-card-sub">${cat.count} Materials</div>
                        </div>
                    </div>
                `;
            }
            
            if (gridPanel) {
                gridPanel.innerHTML = categoryThumbnails;
                const catThumbs = gridPanel.querySelectorAll('.mat-category-thumb');
                
                const updateCategorySelection = (catId) => {
                    this._lastSelectedCat = catId;
                    const catObj = cats.find(c => c.id === catId) || cats[0];
                    catThumbs.forEach(el => {
                        el.classList.toggle('active-card', el.getAttribute('data-cat') === catId);
                    });
                    if (this.matNameDisplay) this.matNameDisplay.innerText = catObj ? catObj.title : 'Select Material Type';
                };

                catThumbs.forEach(t => {
                    t.addEventListener('click', (e) => {
                        const chosenCat = e.currentTarget.getAttribute('data-cat');
                        this.onMaterialFaceSelected(this.activeFace, this.activeSubMeshIndex, this.activeObject, this.activeMatIndex, chosenCat);
                    });
                });

                updateCategorySelection(activeCatId);
            }
            if (selectedObj?.userData?.entity) {
                this._renderWallMultiMaterialTabs(selectedObj.userData.entity, selectedObj);
            }
            return; // Stop here, don't generate regular material thumbs
        }

        if (this.matFaceNameDisplay) {
            this.matFaceNameDisplay.innerHTML = '← Back to Categories';
            this.matFaceNameDisplay.style.textDecoration = 'underline';
        }

        let decorThumbnails = `
            <div class="mat-card mat-thumb" data-mat="" title="Revert to Default Material">
                <div style="height: 40px; flex-shrink: 0;"></div>
                <div class="mat-clear-circle">
                    <svg style="width: 44px; height: 44px; color: rgba(255, 255, 255, 0.9);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                        <path d="M3 3v5h5" />
                    </svg>
                </div>
                <div style="width: 100%;">
                    <div class="mat-card-title">Clear Material</div>
                    <div class="mat-card-sub" style="color: #94a3b8;">Revert to Default</div>
                </div>
            </div>
        `;
        let registry = null;
        let activeGroup = null;
        const ALL_REGISTRY = Object.assign({}, WOOD_REGISTRY, METAL_REGISTRY, PLASTIC_REGISTRY, GLASS_REGISTRY, STONE_REGISTRY, BRICK_REGISTRY, MARBLE_REGISTRY, FABRIC_REGISTRY, LEATHER_REGISTRY, TILE_REGISTRY, ROOF_REGISTRY, FLOOR_REGISTRY, WALL_REGISTRY);

        // 1. Resolve category based on user selection (takes absolute priority)
        switch (materialCategory) {
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
                
                if (materialCategory === 'glass') {
                    decorThumbnails += `
                        <div class="mat-card mat-thumb is-glass-card" data-mat="${key}" ${groupAttr} title="${label}">
                            <div class="mat-card-selected-checkmark">✓</div>
                            <div class="mat-sphere is-3d-glass" id="mat-thumb-${key}" style="background: radial-gradient(circle at 50% 50%, rgba(56, 189, 248, 0.18) 0%, rgba(56, 189, 248, 0.04) 55%, transparent 75%);"></div>
                            <div style="width: 100%; text-align: center;">
                                <div class="mat-card-title">${label}</div>
                                <div class="mat-card-sub" style="color: #38bdf8; font-weight: 600; letter-spacing: 0.5px;">Glass</div>
                            </div>
                        </div>
                    `;
                } else if (materialCategory === 'marble') {
                    decorThumbnails += `
                        <div class="mat-card mat-thumb is-brick-card" data-mat="${key}" ${groupAttr} title="${label}">
                            <div class="mat-card-selected-checkmark" style="background: #ef4444; color: #ffffff; top: 12px; right: 12px;">✓</div>
                            <div class="mat-sphere" id="mat-thumb-${key}" style="${sphereStyle}"></div>
                            <div style="width: 100%; padding: 4px 2px 2px 2px;">
                                <div class="mat-card-title" style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc;">${label}</div>
                                <div class="mat-card-sub" style="color: #f87171; font-weight: 600; letter-spacing: 0.5px;">Marble & Granite</div>
                            </div>
                        </div>
                    `;
                } else if (materialCategory === 'stone' || materialCategory === 'stones' || registry === STONE_REGISTRY) {
                    decorThumbnails += `
                        <div class="mat-card mat-thumb is-stone-card" data-mat="${key}" ${groupAttr} title="${label}">
                            <div class="mat-card-selected-checkmark" style="background: #10b981; color: #ffffff; top: 12px; right: 12px;">✓</div>
                            <div class="mat-sphere" id="mat-thumb-${key}" style="${sphereStyle}"></div>
                            <div style="width: 100%; padding: 4px 2px 2px 2px;">
                                <div class="mat-card-title" style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc;">${label}</div>
                                <div class="mat-card-sub" style="color: #10b981; font-weight: 600; letter-spacing: 0.5px;">Natural Stone</div>
                            </div>
                        </div>
                    `;
                } else if (materialCategory === 'brick' || materialCategory === 'bricks' || registry === BRICK_REGISTRY) {
                    decorThumbnails += `
                        <div class="mat-card mat-thumb is-brick-card" data-mat="${key}" ${groupAttr} title="${label}">
                            <div class="mat-card-selected-checkmark" style="background: #ef4444; color: #ffffff; top: 12px; right: 12px;">✓</div>
                            <div class="mat-sphere" id="mat-thumb-${key}" style="${sphereStyle}"></div>
                            <div style="width: 100%; padding: 4px 2px 2px 2px;">
                                <div class="mat-card-title" style="font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #f8fafc;">${label}</div>
                                <div class="mat-card-sub" style="color: #f87171; font-weight: 600; letter-spacing: 0.5px;">Brick & Masonry</div>
                            </div>
                        </div>
                    `;
                } else {
                    decorThumbnails += `
                        <div class="mat-card mat-thumb" data-mat="${key}" ${groupAttr} title="${label}">
                            <div class="mat-card-icon-badge" style="background: rgba(249, 115, 22, 0.2); color: #f97316;">
                                <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div class="mat-sphere" id="mat-thumb-${key}" style="${sphereStyle}"></div>
                            <div style="width: 100%;">
                                <div class="mat-card-title">${label}</div>
                                <div class="mat-card-sub">${title}</div>
                            </div>
                        </div>
                    `;
                }
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
                    // Standard 165px Width Fabric Card Launcher when no pattern is applied
                    patternLauncherHtml = `
                        <div class="mat-card" id="card-pattern-customizer-launcher" style="border: 1.5px dashed rgba(168, 85, 247, 0.5); background: linear-gradient(145deg, rgba(26, 16, 38, 0.9) 0%, rgba(15, 11, 26, 0.95) 100%);">
                            <div class="mat-card-icon-badge" style="background: rgba(168, 85, 247, 0.25); color: #c084fc;">
                                ✨
                            </div>
                            <div class="mat-sphere" style="background: radial-gradient(circle at 35% 25%, #c084fc 0%, #7c3aed 55%, #4c1d95 100%); display: flex; align-items: center; justify-content: center; font-size: 32px; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);">
                                🎨
                            </div>
                            <div style="width: 100%; text-align: center;">
                                <div class="mat-card-title" style="color: #c084fc; font-weight: 800;">Pattern Customizer</div>
                                <div class="mat-card-sub" style="margin-bottom: 8px;">Add Motif Overlay</div>
                                <button id="btn-gizmo-open-pattern-popup" ${!supportsPatterns ? 'disabled' : ''} style="width: 100%; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: white; border: none; padding: 7px 0; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: ${supportsPatterns ? 'pointer' : 'not-allowed'}; box-shadow: 0 2px 8px rgba(168,85,247,0.4);">
                                    🎨 Select Pattern
                                </button>
                            </div>
                        </div>
                    `;
                } else {
                    // Standard 165px Width Active Pattern Card when pattern is applied
                    const rawName = state.patternId.replace(/^offline_/, '').replace(/_\d+$/, '').replace(/_/g, ' ').trim();
                    const prettyPatternTitle = rawName ? rawName.replace(/\b\w/g, c => c.toUpperCase()) + ' Motif' : 'Damask Motif';

                    patternLauncherHtml = `
                        <div class="mat-card active-card" id="card-pattern-customizer-applied" style="border: 1.5px solid #a855f7 !important; background: linear-gradient(145deg, rgba(26, 16, 38, 0.95) 0%, rgba(15, 11, 26, 0.98) 100%); position: relative;">
                            <div class="mat-card-icon-badge" style="background: rgba(34, 197, 94, 0.25); color: #4ade80;" title="Pattern Applied">
                                <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div class="mat-sphere" id="pattern-card-thumb-preview" style="background: #0f172a center/cover no-repeat; border: 2px solid rgba(168, 85, 247, 0.6); box-shadow: 0 4px 14px rgba(168, 85, 247, 0.35);"></div>
                            <div style="width: 100%; text-align: center;">
                                <div id="pattern-card-title-text" class="mat-card-title" style="color: #f8fafc; font-weight: 800; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${prettyPatternTitle}</div>
                                <div id="pattern-card-sub-text" class="mat-card-sub" style="color: #c084fc; font-weight: 600; margin-bottom: 8px;">🎨 Applied Pattern</div>
                                <div style="display: flex; gap: 4px; width: 100%;">
                                    <button id="btn-gizmo-open-pattern-popup" ${!supportsPatterns ? 'disabled' : ''} style="flex: 1; background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%); color: white; border: none; padding: 6px 0; border-radius: 6px; font-size: 10px; font-weight: 700; cursor: pointer; box-shadow: 0 2px 6px rgba(168, 85, 247, 0.4);">
                                        🎨 Change
                                    </button>
                                    <button id="btn-gizmo-open-pattern-controls" style="background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.5); color: #c084fc; padding: 6px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;" title="Fine-Tune Pattern Controls (Scale, Rotation, Repeat, Opacity)">
                                        ⚙️
                                    </button>
                                    <button id="btn-gizmo-remove-pattern" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 6px 8px; border-radius: 6px; font-size: 10px; font-weight: 600; cursor: pointer;" title="Remove Pattern Overlay">
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        </div>
                    `;

                    // Asynchronously resolve pattern object and composite texture to update sphere preview thumbnail live
                    (async () => {
                        try {
                            const patObj = await patternManager.getPatternById(state.patternId);
                            const compKey = `${state.baseFabricId}::pattern::${state.patternId}`;
                            const compConfig = await resolveFabricConfig(compKey, this._patternTransformState);
                            
                            const cardThumb = gridElem.querySelector('#pattern-card-thumb-preview');
                            const titleElem = gridElem.querySelector('#pattern-card-title-text');
                            const subElem = gridElem.querySelector('#pattern-card-sub-text');
                            
                            const realThumb = (compConfig && compConfig.texture) ? compConfig.texture : (patObj ? (patObj.thumbnail || patObj.textureUrl) : '');
                            if (cardThumb && realThumb) {
                                cardThumb.style.backgroundImage = `url('${realThumb}')`;
                            }
                            if (titleElem && patObj && patObj.title) {
                                titleElem.innerText = patObj.title;
                            }
                            if (subElem && patObj && patObj.category) {
                                subElem.innerText = `🎨 ${patObj.category} Motif`;
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
                    swatchesHtml += `<div class="mat-thumb wood-swatch" data-mat="color_${c.hex}" title="${c.name}" style="background-color: ${c.hex}; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; border: 1px solid rgba(255,255,255,0.2); transition: transform 0.15s, border-color 0.15s; flex-shrink: 0;" onmouseover="this.style.transform='scale(1.15)'; this.style.borderColor='#fff';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='rgba(255,255,255,0.2)';"></div>`;
                });

                woodCustomizerHtml = `
                    <div class="mat-card" id="card-wood-customizer" style="width: 220px; border: 1.5px solid rgba(245, 158, 11, 0.5); background: linear-gradient(145deg, rgba(39, 26, 16, 0.9) 0%, rgba(26, 16, 11, 0.95) 100%); padding: 12px; display: flex; flex-direction: column; gap: 10px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div class="mat-card-icon-badge" style="background: rgba(245, 158, 11, 0.25); color: #fbbf24; margin-bottom: 0;">🎨</div>
                            <div>
                                <div class="mat-card-title" style="color: #fbbf24; font-weight: 800; margin-top: 0; text-align: left;">Custom Color</div>
                                <div class="mat-card-sub" style="text-align: left;">Solid Wood Finish</div>
                            </div>
                        </div>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-start; margin-top: 4px;">
                            ${swatchesHtml}
                        </div>
                        
                        <div style="margin-top: auto; display: flex; align-items: center; gap: 8px; width: 100%; background: rgba(0,0,0,0.3); padding: 6px 8px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); box-sizing: border-box;">
                            <span style="font-size: 11px; color: #cbd5e1; font-weight: 600;">Custom Hex</span>
                            <input type="color" id="gizmo-wood-color-picker" value="#C8904A" style="width: 100%; height: 24px; border: none; outline: none; background: transparent; cursor: pointer; border-radius: 4px;">
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
                    let tabsButtons = `<button class="gizmo-subgroup-tab ${!activeGroup ? 'active' : ''}" data-target-group="all" style="padding: 6px 12px; margin-right: 8px; border: none; border-radius: 4px; background: ${!activeGroup ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)'}; color: ${!activeGroup ? '#f97316' : '#94a3b8'}; cursor: pointer; font-weight: 600; font-size: 12px; border: 1px solid ${!activeGroup ? 'rgba(249,115,22,0.5)' : 'transparent'};">All</button>`;
                    
                    for (const g of groupsArray) {
                        const isActive = activeGroup === g;
                        tabsButtons += `<button class="gizmo-subgroup-tab ${isActive ? 'active' : ''}" data-target-group="${g}" style="padding: 6px 12px; margin-right: 8px; border: none; border-radius: 4px; background: ${isActive ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.05)'}; color: ${isActive ? '#f97316' : '#94a3b8'}; cursor: pointer; font-weight: 600; font-size: 12px; border: 1px solid ${isActive ? 'rgba(249,115,22,0.5)' : 'transparent'};">${g.toUpperCase()}</button>`;
                    }
                    
                    tabsHtml = `
                        <div class="gizmo-subgroup-tabs-container" style="width: 100%; display: flex; align-items: center; padding: 12px; padding-bottom: 0px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 12px; overflow-x: auto;">
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
                const isWall = selectedObj.userData.entity.type === 'outer' || selectedObj.userData.entity.type === 'inner' || selectedObj.userData.entity.type === 'wall' || selectedObj.userData.entity.type === 'wallDecor' || selectedObj.userData.entity.startX !== undefined;
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
                            t.style.background = 'rgba(255,255,255,0.05)';
                            t.style.color = '#94a3b8';
                            t.style.borderColor = 'transparent';
                        });
                        e.currentTarget.classList.add('active');
                        e.currentTarget.style.background = 'rgba(249,115,22,0.2)';
                        e.currentTarget.style.color = '#f97316';
                        e.currentTarget.style.borderColor = 'rgba(249,115,22,0.5)';
                        
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
                
                if (btnOpen) {
                    btnOpen.addEventListener('click', (e) => {
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
            const isWall = entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.type === 'wallDecor' || entity.startX !== undefined;
            if (isWall && this.materialScope === 'selectedFace') {
                const side = (this.activeFace === 'back' || selectedObj?.userData?.side === 'back' || this.activeObject?.userData?.side === 'back') ? 'back' : 'front';
                const wall = entity.type === 'wallDecor' ? (entity.mesh3D?.userData?.parentWall || selectedObj?.parent?.userData?.entity || entity) : entity;
                const attachedDecors = (wall.attachedDecor || []).filter(d => d.side === side);
                const activeDecor = (attachedDecors || []).find(d => d.id === this.activeDecorId) || attachedDecors[0];
                if (activeDecor) {
                    tex = activeDecor.configId;
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
        const tabsContainerWrapper = this.materialPanel.querySelector('#gizmo-subgroup-tabs-container');
        if (!tabsContainerWrapper) return;
        
        const isWall = entity && (entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.startX !== undefined);
        const isWallDecor = entity && entity.type === 'wallDecor';
        
        if (!isWall && !isWallDecor) {
            tabsContainerWrapper.innerHTML = '';
            return;
        }

        const wall = isWallDecor ? (entity.mesh3D?.userData?.parentWall || selectedObj?.parent?.userData?.entity || entity) : entity;
        const side = (this.activeFace === 'back' || selectedObj?.userData?.side === 'back' || this.activeObject?.userData?.side === 'back') ? 'back' : 'front';
        
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

        // 0. Material Scope Selector (Universal CAD/BIM Standard: Selected Face vs Entire Object)
        const isEntireObject = this.materialScope === 'entireObject';
        const scopeHtml = `
            <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
                <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">
                    Material Scope
                </div>
                <div style="display: flex; gap: 6px; background: rgba(0,0,0,0.5); padding: 3px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12);">
                    <button class="gizmo-scope-btn ${!isEntireObject ? 'active' : ''}" data-scope="selectedFace" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: none; background: ${!isEntireObject ? '#3b82f6' : 'transparent'}; color: ${!isEntireObject ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <span>${!isEntireObject ? '◉' : '○'}</span> Selected Face
                    </button>
                    <button class="gizmo-scope-btn ${isEntireObject ? 'active' : ''}" data-scope="entireObject" style="flex: 1; padding: 6px 8px; border-radius: 6px; border: none; background: ${isEntireObject ? '#3b82f6' : 'transparent'}; color: ${isEntireObject ? 'white' : '#94a3b8'}; cursor: pointer; font-size: 11px; font-weight: 600; transition: all 0.15s; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        <span>${isEntireObject ? '◉' : '○'}</span> Entire Object
                    </button>
                </div>
            </div>
        `;

        // 1. Top Header: Face Selector + Layer Count
        const headerHtml = isEntireObject ? `
            <div style="padding: 6px 10px; background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.25); border-radius: 6px; font-size: 10.5px; color: #93c5fd; line-height: 1.4;">
                🌐 <strong>Entire Object Mode:</strong> Material applies to all sides of the wall simultaneously.
            </div>
        ` : `
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
                                <span>${selectedDecor.tileSize || 70}</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <input type="range" class="gizmo-slider" data-prop="tileSize" data-decor-id="${selectedDecor.id}" min="10" max="300" step="5" value="${selectedDecor.tileSize || 70}" style="flex: 1; accent-color: #3b82f6; cursor: pointer;" />
                                <input type="number" class="gizmo-input-num" data-prop="tileSize" data-decor-id="${selectedDecor.id}" min="10" max="300" step="5" value="${selectedDecor.tileSize || 70}" style="width: 48px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 4px; color: white; padding: 2px 4px; font-size: 10.5px;" />
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
                    wall.attachedDecor = wall.attachedDecor.filter(d => d.id !== decorId);
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
                if (this.transformMenu.style.display !== 'flex') {
                    this._menuPointerDown = false;
                }
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
        
        if (selectedObj) {
            entity = selectedObj.userData.entity || {};
            type = entity.type || '';
            isOpening = selectedObj.userData.isWidget || selectedObj.userData.isPattern || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type);
            const compType = selectedObj?.userData?.entity?.type || '';
            const isStaircaseOrRailing = compType.startsWith('stair_') || compType.startsWith('glass_') || compType.startsWith('metal_') || compType.startsWith('wood_') || compType.startsWith('cable_') || compType === 'staircase' || compType === 'railing';
            supportsFaceMaterials = selectedObj.userData.isShape || selectedObj.userData.isWidget || selectedObj.userData.isMolding || selectedObj.userData.isPattern || selectedObj.userData.isRoof || selectedObj.userData.isStair || isStaircaseOrRailing;
        }

        console.info(`%c[GizmoManager] %cTransform Mode Changed: %c${mode} %c(Target: ${type || 'None'})`, 
            'color: #f59e0b; font-weight: bold;', 'color: #9ca3af;', 'color: #3b82f6; font-weight: bold;', 'color: #6b7280;');


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
                } else if (type === 'window') {
                    activeGizmos = GIZMO_REGISTRY.window || GIZMO_REGISTRY.door;
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
                } else if (selectedObj.userData.isWallSide || selectedObj.userData.isWallMesh || selectedObj.userData.isWallDecor || type === 'outer' || type === 'inner' || type === 'wall' || type === 'wallDecor') {
                    activeGizmos = GIZMO_REGISTRY.wall || ['material'];
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
            if (this.materialPanel) {
                this.materialPanel.classList.remove('active');
                this.materialPanel.style.display = 'none';
            }
            if (this.stylePanel) this.stylePanel.style.display = 'none';
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';
            if (this.btnDone) this.btnDone.style.display = 'none';
            
            if (selectedObj) {
                this.ctx.interactions.setHighlight(selectedObj, true);
                
                // Return camera to normal state when done with gizmo
                try {
                    const settings = useSettingsStore().floorPlanSettings;
                    if (settings.autoFocus !== false && this.ctx.cameraController) {
                        this.ctx.cameraController.focusOnObject(selectedObj, null, settings.autoRotate !== false, 1.0);
                    }
                } catch(e) {}
            }
            tc.detach(); // Completely detach the gizmo to avoid hidden raycast interference
            if (this.ctx.controls) this.ctx.controls.enabled = true;
            
            return;
        }

        tc.showY = true;
        tc.showZ = true;
        // Auto-focus and adjust zoom when entering a gizmo mode
        if (mode !== 'none' && selectedObj) {
            try {
                const settings = useSettingsStore().floorPlanSettings;
                if (settings.autoFocus !== false && this.ctx.cameraController) {
                    // Zoom in close for materials, zoom out wider for move/opening/scale so gizmo handles fit on screen
                    const zoomMult = mode === 'material' ? 1.0 : 1.7;
                    this.ctx.cameraController.focusOnObject(selectedObj, null, settings.autoRotate !== false, zoomMult);
                }
            } catch(e) {
                // Ignore if store not ready
            }
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
            if (this.cornerPanel) this.cornerPanel.style.display = 'none';

            const isWall = selectedObj && (selectedObj.userData.isWallSide || selectedObj.userData.isWallMesh || selectedObj.userData.isWallDecor || entity.type === 'outer' || entity.type === 'inner' || entity.type === 'wall' || entity.type === 'wallDecor');
            const targetToAttach = (isWall && selectedObj.parent) ? selectedObj.parent : selectedObj;

            if (this.ctx.interactions.materialGizmo && targetToAttach) {
                this.ctx.interactions.materialGizmo.attach(targetToAttach);
            }

            if (isWall) {
                const side = selectedObj.userData?.side || selectedObj.userData?.entity?.side || this.activeFace || 'front';
                this.activeFace = side;
                const matIdx = side === 'back' ? 5 : 4;
                const wallMesh = entity.wallMesh3D || (selectedObj.parent && selectedObj.parent.userData?.wallMesh) || selectedObj;
                this.onMaterialFaceSelected(side, -1, wallMesh, matIdx, 'categories');
            } else if (this.materialPanel) {
                this.materialPanel.style.display = 'none'; // HIDDEN initially for multi-face objects, waits for face click
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
            if (this.transformMenu.style.display !== 'flex') {
                this._menuPointerDown = false;
            }
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
            flipContainer.style.display = (entity.type === 'door' || entity.type === 'window' || entity.type === 'jali_panel' || entity.type === 'sunshade' || entity.type === 'curtain' || entity.type.startsWith('curtain') || entity.type === 'wall_art' || entity.type.startsWith('decor_wall_')) ? 'flex' : 'none';
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



