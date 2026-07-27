import { EVENTS } from '../registry.js';
import { coreEventBus } from '../EventBus.js';
import * as THREE from 'three';
import { DOOR_TYPES, WINDOW_TYPES, WALL_DECOR_REGISTRY, DOOR_MATERIALS_REGISTRY, DOOR_STYLES_REGISTRY, ROOF_DECOR_REGISTRY, GIZMO_REGISTRY, FABRIC_REGISTRY, FLOOR_REGISTRY, WINDOW_GLASS_MATERIALS, METAL_REGISTRY, STONE_REGISTRY, PLASTIC_REGISTRY, parseCompositeMaterialKey, resolveFabricConfig, getFabricBaseConfig } from '../registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { patternManager } from '../services/pattern/PatternManager.js';
import { PatternTextureBlender } from '../services/pattern/PatternTextureBlender.js';

const WOOD_REGISTRY = DOOR_MATERIALS_REGISTRY;
const GLASS_REGISTRY = WINDOW_GLASS_MATERIALS;
const TILE_REGISTRY = WALL_DECOR_REGISTRY;
const WALL_REGISTRY = WALL_DECOR_REGISTRY;
const ROOF_REGISTRY = ROOF_DECOR_REGISTRY;

export class GizmoManager {
    constructor(ctx) {
        this.ctx = ctx;
        this.container = ctx.container;
        this.menuVisible = false;
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
                .mat-card:hover .mat-sphere {
                    transform: scale(1.06) rotate(3deg);
                }
                .mat-sphere::after {
                    content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%;
                    background: radial-gradient(circle at 32% 24%, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.05) 45%, rgba(0, 0, 0, 0.75) 90%);
                    pointer-events: none;
                }
                .mat-card-title {
                    color: white; font-weight: 600; font-size: 15px; margin-top: 8px; text-align: center;
                    width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                }
                .mat-card-sub {
                    color: #94a3b8; font-size: 12px; margin-top: 2px; text-align: center; width: 100%;
                }
                .mat-card.active-card .mat-card-sub {
                    color: #f97316; font-weight: 600;
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
                      
                      <div class="mat-lib-grid-wrapper">
                          <div id="gizmo-material-grid" class="mat-lib-grid"></div>
                      </div>
                  </div>
              </div>
          `;
        
        // Block pointer events from hitting the 3D scene below when clicking interactive UI elements
        ['pointerdown', 'pointerup', 'wheel', 'touchstart', 'touchend', 'touchmove'].forEach(evt => {
            this.materialPanel.addEventListener(evt, e => {
                if (e.target.closest('.mat-lib-header, .mat-lib-grid-wrapper')) {
                    e.stopPropagation();
                }
            }, { passive: true });
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

    async onMaterialFaceSelected(faceName, subMeshIndex = -1, activeObject = null, activeMatIndex = -1, forcedCategory = null) {
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
        
        let materialCategory = forcedCategory || 'categories';
        if (selectedObj && selectedObj.userData && selectedObj.userData.entity) {
            const type = selectedObj.userData.entity.type;
            if (type !== 'furniture' && !selectedObj.userData.entity.isFurniture) {
                materialCategory = type;
            }
        }
        
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
            
            const getCount = (reg) => reg ? Object.keys(reg).length : 0;
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
            
            const cats = [
                { id: 'wood', title: 'Wood / Veneer', count: getCount(WOOD_REGISTRY) || 24, desc: 'Warm, natural timber grains and high-end polished architectural wood veneers.', iconBg: 'rgba(120, 53, 15, 0.35)', iconColor: '#f59e0b', iconSvg: '<path d="M12 2L6 12h3v8h6v-8h3L12 2z"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #d97706, #78350f 50%, #451a03 90%)', sphereColor: '#78350f', sampleBg: getSampleBg(WOOD_REGISTRY) },
                { id: 'fabric', title: 'Fabric / Decor', count: getCount(FABRIC_REGISTRY) || 18, desc: 'Soft materials and decorative fabrics for furniture, walls and decor.', iconBg: 'rgba(249, 115, 22, 0.25)', iconColor: '#f97316', iconSvg: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h10M7 9h10"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #fdba74, #ea580c 50%, #9a3412 85%, #431407 100%)', sphereColor: '#ea580c', sampleBg: getSampleBg(FABRIC_REGISTRY) },
                { id: 'metal', title: 'Metals', count: getCount(METAL_REGISTRY) || 22, desc: 'Brushed aluminum, polished chrome, structural steel and luxury decorative anodized finishes.', iconBg: 'rgba(100, 116, 139, 0.35)', iconColor: '#94a3b8', iconSvg: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.72 1.05 1.33 1.28H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>', sphereGrad: 'linear-gradient(135deg, #e2e8f0 0%, #64748b 45%, #f8fafc 50%, #334155 100%)', sphereColor: '#94a3b8', sampleBg: getSampleBg(METAL_REGISTRY) },
                { id: 'glass', title: 'Glass', count: getCount(GLASS_REGISTRY) || 12, desc: 'Clear tempered glass, architectural privacy frosting and energy-efficient tinted glazing.', iconBg: 'rgba(6, 182, 212, 0.25)', iconColor: '#06b6d4', iconSvg: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/><line x1="3" y1="12" x2="21" y2="12"/>', sphereGrad: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 15%, rgba(186,230,253,0.65) 45%, rgba(56,189,248,0.4) 75%, rgba(30,41,59,0.7) 100%)', sphereColor: '#06b6d4', sampleBg: 'background: radial-gradient(circle at 30% 25%, rgba(255,255,255,0.98) 0%, rgba(255,255,255,0.6) 15%, rgba(186,230,253,0.65) 45%, rgba(56,189,248,0.4) 75%, rgba(30,41,59,0.7) 100%); border: 1.5px solid rgba(255, 255, 255, 0.9); box-shadow: inset -5px -7px 12px rgba(0,0,0,0.5), inset 3px 3px 8px rgba(255,255,255,0.95), 0 6px 20px rgba(56,189,248,0.35);' },
                { id: 'stone', title: 'Stone / Marble', count: getCount(STONE_REGISTRY) || 28, desc: 'Luxurious Italian marble, rough hewn granites, modern architecture concrete and floor tiles.', iconBg: 'rgba(16, 185, 129, 0.25)', iconColor: '#10b981', iconSvg: '<polygon points="12 2 2 7 12 22 22 7 12 2"/>', sphereGrad: 'radial-gradient(circle at 40% 30%, #cbd5e1, #64748b 55%, #334155 85%, #0f172a 100%)', sphereColor: '#64748b', sampleBg: getSampleBg(STONE_REGISTRY) },
                { id: 'plastic', title: 'Plastics', count: getCount(PLASTIC_REGISTRY) || 15, desc: 'Matte black polycarbonates, glossy PVC trims, lightweight laminates and composite plastics.', iconBg: 'rgba(168, 85, 247, 0.25)', iconColor: '#a855f7', iconSvg: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>', sphereGrad: 'radial-gradient(circle at 35% 30%, #52525b, #27272a 60%, #09090b 100%)', sphereColor: '#27272a', sampleBg: getSampleBg(PLASTIC_REGISTRY) },
                { id: 'leather', title: 'Leather', count: 20, desc: 'Supple aniline leathers, embossed hides, and eco-friendly artificial leather upholstery.', iconBg: 'rgba(180, 83, 9, 0.25)', iconColor: '#d97706', iconSvg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', sphereGrad: 'radial-gradient(circle at 35% 25%, #b45309, #713f12 55%, #422006 90%, #1c0f04 100%)', sphereColor: '#713f12', sampleBg: getSampleBg(FABRIC_REGISTRY) }
            ];
            
            let activeCatId = this._lastSelectedCat || 'fabric';
            let categoryThumbnails = '';
            for (const cat of cats) {
                const isSelected = cat.id === activeCatId;
                const activeClass = isSelected ? ' active-card' : '';
                const sphereStyle = cat.sampleBg ? `${cat.sampleBg}; background-color: ${cat.sphereColor};` : `background-image: ${cat.sphereGrad}; background-color: ${cat.sphereColor};`;
                categoryThumbnails += `
                    <div class="mat-card mat-category-thumb${activeClass}" data-cat="${cat.id}">
                        <div class="mat-card-icon-badge" style="background: ${cat.iconBg}; color: ${cat.iconColor};">
                            <svg style="width: 18px; height: 18px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${cat.iconSvg}</svg>
                        </div>
                        <div class="mat-sphere" style="${sphereStyle}"></div>
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
                    const catObj = cats.find(c => c.id === catId) || cats[1];
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
            return; // Stop here, don't generate regular material thumbs
        }

        if (this.matFaceNameDisplay) {
            this.matFaceNameDisplay.innerHTML = '← Back to Categories';
            this.matFaceNameDisplay.style.textDecoration = 'underline';
        }

        let title = 'Materials';
        if (materialCategory === 'wood' || materialCategory === 'door' || materialCategory === 'window' || materialCategory === 'wood_metal') title = 'Wood / Veneer';
        else if (materialCategory === 'metal') title = 'Metals';
        else if (materialCategory === 'glass') title = 'Glass';
        else if (materialCategory === 'stone') title = 'Stone';
        else if (materialCategory === 'tile') title = 'Tiles';
        else if (materialCategory === 'fabric') title = 'Fabric / Decor';
        else if (materialCategory === 'plastic') title = 'Plastics';
        else if (materialCategory === 'leather') title = 'Leather';
        else if (materialCategory === 'floor' || materialCategory === 'outer' || materialCategory === 'inner' || materialCategory === 'roof') {
            title = (materialCategory.charAt(0).toUpperCase() + materialCategory.slice(1)).replace(/_/g, ' ') + ' Materials';
        }

        let decorThumbnails = `
            <div class="mat-card mat-thumb" data-mat="" title="Clear Material">
                <div class="mat-card-icon-badge" style="background: rgba(255,255,255,0.1); color: #94a3b8;">
                    <svg style="width: 16px; height: 16px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                </div>
                <div class="mat-sphere" style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.3);"></div>
                <div style="width: 100%;">
                    <div class="mat-card-title">Clear Material</div>
                    <div class="mat-card-sub">Default</div>
                </div>
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
        else if (materialCategory === 'fabric' || materialCategory === 'leather') registry = FABRIC_REGISTRY;
        else if (materialCategory === 'floor') registry = FLOOR_REGISTRY;
        else if (materialCategory === 'wall' || materialCategory === 'outer' || materialCategory === 'inner') registry = WALL_REGISTRY;

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
                decorThumbnails += `
                    <div class="mat-card mat-thumb" data-mat="${key}" title="${label}">
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
        
        const gridElem = this.materialPanel.querySelector('#gizmo-material-grid');
        if (gridElem) {
            let patternLauncherHtml = '';
            if (materialCategory === 'fabric') {
                const state = this._getCurrentFabricState(selectedObj);
                const fabricConf = FABRIC_REGISTRY[state.baseFabricId] || {};
                const supportsPatterns = fabricConf.supportsPatterns !== false;
                const patternText = state.patternId ? `✨ Active Pattern: ${state.patternId} (Applied across plain fabrics)` : 'Add decorative pattern overlay';
                
                patternLauncherHtml = `
                    <div id="fabric-pattern-bar" style="width: 100%; margin-bottom: 12px; padding: 10px 14px; background: rgba(30, 41, 59, 0.9); border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 10px; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; box-shadow: 0 4px 15px rgba(0,0,0,0.35);">
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <div style="width: 34px; height: 34px; border-radius: 8px; background: linear-gradient(135deg, rgba(168,85,247,0.3), rgba(124,58,237,0.3)); display: flex; align-items: center; justify-content: center; font-size: 18px;">✨</div>
                            <div>
                                <div style="font-size: 13px; font-weight: 700; color: #f8fafc;">Pattern Customizer</div>
                                <div id="fabric-pattern-status-text" style="font-size: 11px; color: ${state.patternId ? '#c084fc' : '#94a3b8'}; font-weight: ${state.patternId ? '600' : '400'};">${patternText}</div>
                            </div>
                        </div>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <button id="btn-gizmo-remove-pattern" style="display: ${state.patternId ? 'inline-block' : 'none'}; background: rgba(239, 68, 68, 0.2); color: #fca5a5; border: 1px solid rgba(239, 68, 68, 0.4); padding: 6px 12px; border-radius: 6px; font-size: 12px; font-weight: 600; cursor: pointer;">✖ Remove</button>
                            <button id="btn-gizmo-open-pattern-popup" ${!supportsPatterns ? 'disabled' : ''} style="background: ${supportsPatterns ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : 'rgba(100,116,139,0.4)'}; color: white; border: none; padding: 7px 14px; border-radius: 6px; font-size: 12px; font-weight: 700; cursor: ${supportsPatterns ? 'pointer' : 'not-allowed'}; box-shadow: 0 2px 10px rgba(168,85,247,0.4); display: flex; align-items: center; gap: 6px;">
                                🎨 Select Pattern
                            </button>
                        </div>
                    </div>
                `;
            }
            
            gridElem.innerHTML = patternLauncherHtml + decorThumbnails;
            
            if (materialCategory === 'fabric') {
                const btnOpen = gridElem.querySelector('#btn-gizmo-open-pattern-popup');
                const btnRemove = gridElem.querySelector('#btn-gizmo-remove-pattern');
                if (btnOpen) {
                    btnOpen.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this._openPatternPopupModal(selectedObj);
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
        }
        
        if (selectedObj && selectedObj.userData.entity) {
            const entity = selectedObj.userData.entity;
            const p = entity.params || {};
            let targetParams = p;
            if (this.activeSubMeshIndex !== -1 && p.blocks && p.blocks[this.activeSubMeshIndex] && entity.materialMode !== 'PROCEDURAL' && entity.materialMode !== 'MONOLITHIC') {
                targetParams = p.blocks[this.activeSubMeshIndex];
            }
            
            let tex = targetParams.texture || targetParams.textureFront || null;
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
                    const baseConf = FABRIC_REGISTRY[parsedTex.baseFabricId] || (registry ? registry[tex] : null);
                    this.matNameDisplay.innerText = baseConf ? baseConf.name : 'Selected Material';
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
            previewWrap.innerHTML = `<div style="color: #a855f7; font-size: 13px; font-weight: 600;">Synthesizing fabric texture blend...</div>`;
            
            const baseTex = baseFabric.texture || baseFabric.thumbnail || '';
            const blendedUrl = await PatternTextureBlender.blend(baseTex, pat.textureUrl, { blendMode: 'multiply', patternOpacity: 0.9, size: 256 });
            
            previewWrap.innerHTML = `
                <div style="display: flex; align-items: center; gap: 16px;">
                    <div style="width: 68px; height: 68px; border-radius: 10px; border: 2px solid #c084fc; background: url('${blendedUrl}') center/cover no-repeat; box-shadow: 0 4px 12px rgba(0,0,0,0.5);"></div>
                    <div>
                        <div style="font-size: 11px; font-weight: 700; color: #c084fc; letter-spacing: 0.5px; text-transform: uppercase;">Real-time Blend Preview</div>
                        <div style="font-size: 16px; font-weight: 700; color: #f8fafc;">${pat.title} on ${baseFabric.name || state.baseFabricId}</div>
                        <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">License: ${pat.license} (${pat.attribution})</div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <button id="btn-apply-pattern-now" style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 9px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; border: none; cursor: pointer; box-shadow: 0 4px 12px rgba(16,185,129,0.3); transition: 0.2s;">✔ Apply to 3D Model</button>
                    <button id="btn-dismiss-preview" style="background: rgba(255,255,255,0.1); color: #cbd5e1; padding: 9px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;">Cancel</button>
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
        
        const config = await resolveFabricConfig(matKey);
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

            if (typeof entity.applyMaterial === 'function') {
                if (this.activeObject && this.activeMatIndex !== undefined && this.activeMatIndex !== -1) {
                    MaterialFactory.applyPBRMaterial(this.activeObject, config, this.ctx, this.activeMatIndex);
                }
                entity.applyMaterial({ target, key: matKey, activeMatIndex: this.activeMatIndex, activeObject: this.activeObject, ctx: this.ctx });
            } else {
                if (entity.type === 'door') {
                    if (isFrame) entity.frameMat = matKey;
                    else {
                        if (target === 'top') targetParams.textureTop = matKey;
                        else if (target === 'bottom') targetParams.textureBottom = matKey;
                        else if (target === 'left') targetParams.textureLeft = matKey;
                        else if (target === 'right') targetParams.textureRight = matKey;
                        else if (target === 'front') targetParams.textureFront = matKey;
                        else if (target === 'back') targetParams.textureBack = matKey;
                        else entity.doorMat = matKey;
                    }
                } else if (isFurnitureMat) {
                    entity.params.materialOverrides = entity.params.materialOverrides || {};
                    const meshName = (this.activeObject && this.activeObject.name) ? this.activeObject.name : '';
                    if (meshName) {
                        entity.params.materialOverrides[meshName] = matKey;
                    }
                } else {
                    if (target === 'top') targetParams.textureTop = matKey;
                    else if (target === 'bottom') targetParams.textureBottom = matKey;
                    else if (target === 'left') targetParams.textureLeft = matKey;
                    else if (target === 'right') targetParams.textureRight = matKey;
                    else if (target === 'front') targetParams.textureFront = matKey;
                    else if (target === 'back') targetParams.textureBack = matKey;
                }
                
                const isValidMatIndex = this.activeMatIndex !== undefined && this.activeMatIndex !== -1;
                if (this.activeObject && (isValidMatIndex || isFurnitureMat)) {
                    const matIndexToUse = isValidMatIndex ? this.activeMatIndex : -1;
                    MaterialFactory.applyPBRMaterial(this.activeObject, config, this.ctx, matIndexToUse);
                }
                
                if (entity.supportsLiveMaterialPipeline) {
                    if (this.ctx.updateMaterialLive) {
                        this.ctx.updateMaterialLive(entity);
                    } else if (this.ctx.updateShapeLive) {
                        this.ctx.updateShapeLive(entity);
                    }
                }
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
            if (this.materialPanel) {
                this.materialPanel.classList.remove('active');
                this.materialPanel.style.display = 'none';
            }
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



