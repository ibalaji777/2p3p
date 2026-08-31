import * as THREE from 'three';
import { Skylight3DBuilder } from '../../features/roof/builders/Skylight3DBuilder.js';
import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';

/**
 * RoofPlugin3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Roof Glass & Skylight Placement:
 * 1. Select Glass Addon / Skylight from Side Nav.
 * 2. Hover over any 3D Roof -> Real-time glowing cyan rectangular aperture ghost preview aligns with roof slope and pitch angle.
 * 3. Click Roof -> Instantly drops rectangular glass area / skylight onto the roof slope.
 * 4. Interactive in-place CAD selection with Full Width, Full Slope, and Custom Width coverage controls.
 */
export class RoofPlugin3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.skylight3DBuilder = new Skylight3DBuilder(ctx);

        // Container for Ghost Preview in 3D Scene
        this.ghostGroup = new THREE.Group();
        this.ghostGroup.name = 'RoofPlugin3DPlacement_GhostGroup';
        this.ghostGroup.visible = false;
        this.ghostGroup.raycast = () => {}; // Zero-occlusion
        this.ctx.scene.add(this.ghostGroup);

        // 1. Aperture Cutout Void / Ribbon Mesh
        this.voidMat = new THREE.MeshBasicMaterial({
            color: 0x00f0ff,
            transparent: true,
            opacity: 0.35,
            depthTest: false,
            side: THREE.DoubleSide
        });
        this.voidMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), this.voidMat);
        this.voidMesh.renderOrder = 1005;
        this.voidMesh.raycast = () => {};
        this.ghostGroup.add(this.voidMesh);

        // 2. Aperture Glowing Outline Wireframe
        this.edgeMat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            linewidth: 2,
            depthTest: false,
            transparent: true,
            opacity: 0.95
        });
        this.edgeBox = new THREE.LineSegments(new THREE.BufferGeometry(), this.edgeMat);
        this.edgeBox.renderOrder = 1006;
        this.edgeBox.raycast = () => {};
        this.ghostGroup.add(this.edgeBox);

        // 3. Model Preview Container
        this.modelPreview = new THREE.Group();
        this.modelPreview.raycast = () => {};
        this.ghostGroup.add(this.modelPreview);

        this._createDOMBadge();
    }

    _createDOMBadge() {
        if (typeof document === 'undefined') return;
        this.domBadge = document.createElement('div');
        this.domBadge.className = 'roof-plugin-live-badge';
        this.domBadge.style.cssText = `
            position: fixed;
            display: none;
            pointer-events: none;
            transform: translate(-50%, -100%);
            padding: 6px 14px;
            border-radius: 16px;
            background: rgba(15, 23, 42, 0.94);
            border: 1.5px solid #38bdf8;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.6), 0 0 14px rgba(56, 189, 248, 0.35);
            color: #ffffff;
            font-family: 'Inter', -apple-system, sans-serif;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.4px;
            white-space: nowrap;
            z-index: 99999;
            backdrop-filter: blur(10px);
            user-select: none;
        `;
        const container = this.ctx.renderer?.domElement?.parentElement || document.body;
        container.appendChild(this.domBadge);
    }

    _updateDOMBadge(text, screenPos) {
        if (!this.domBadge) return;
        if (!text || !screenPos) {
            this.domBadge.style.display = 'none';
            return;
        }
        this.domBadge.innerHTML = text;
        this.domBadge.style.left = `${screenPos.x}px`;
        this.domBadge.style.top = `${screenPos.y - 18}px`;
        this.domBadge.style.display = 'block';
    }

    _hideDOMBadge() {
        if (this.domBadge) this.domBadge.style.display = 'none';
    }

    getPlanner() {
        return this.ctx.planner || window.planner?.value || window.planner || (this.ctx.appState && this.ctx.appState.planner) || window.plannerInstance;
    }

    isPlacementTool() {
        const planner = this.getPlanner();
        const tool = planner?.tool || planner?.activeTool || this.ctx?.activeTool;
        const preset = planner?.activePresetParams || this.ctx?.activePresetParams;
        if (!tool && !preset) return false;
        return tool === 'skylight' || tool === 'roof_skylight' || (typeof tool === 'string' && tool.startsWith('skylight')) || preset?.type?.startsWith('skylight') || preset?.toolId === 'skylight';
    }

    updateMouse(e) {
        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.lastClientX = e.clientX;
        this.lastClientY = e.clientY;
    }

    _raycastRoof(e) {
        this.updateMouse(e);
        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);

        const interactables = this.ctx.interactables || [];
        const intersects = this.raycaster.intersectObjects(interactables, true);
        
        for (const hit of intersects) {
            let obj = hit.object;
            while (obj && !obj.userData?.isRoof && obj.parent) {
                obj = obj.parent;
            }
            if (obj && obj.userData?.isRoof) {
                const roof = obj.userData.entity;
                if (roof) {
                    return { hit, roof, roofMesh: obj };
                }
            }
        }
        return null;
    }

    onPointerMove(e) {
        if (!this.isPlacementTool()) {
            this.hideGhost();
            return false;
        }

        const res = this._raycastRoof(e);
        if (!res) {
            this.hideGhost();
            return false;
        }

        const { hit, roof } = res;
        this._renderGhostPreview(hit, roof);
        if (this.ctx.requestRender) this.ctx.requestRender();
        return true;
    }

    onPointerDown(e) {
        if (!this.isPlacementTool()) return false;
        if (e.button !== 0) return false;

        const res = this._raycastRoof(e);
        if (!res) return false;

        const { hit, roof } = res;
        const planner = this.getPlanner();
        const preset = planner?.activePresetParams || {};

        const pts = roof.points || [];
        let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
        pts.forEach(p => {
            ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
            ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
        });
        const bW = ptsMaxX - ptsMinX;
        const bD = ptsMaxY - ptsMinY;

        const hitWorld = hit.point;
        let skX = (ptsMinX + ptsMaxX) / 2;
        let skZ = (ptsMinY + ptsMaxY) / 2;

        if (roof.mesh3D) {
            const localPt = hit.point.clone();
            roof.mesh3D.worldToLocal(localPt);
            skX = localPt.x + (ptsMinX + ptsMaxX) / 2;
            skZ = localPt.z + (ptsMinY + ptsMaxY) / 2;
        } else {
            let groupX = roof.x || 0, groupZ = roof.y || 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            }
            skX = hitWorld.x - groupX;
            skZ = hitWorld.z - groupZ;
        }

        const u = bW > 0 ? Math.max(0.05, Math.min(0.95, (skX - ptsMinX) / bW)) : 0.5;
        const v = bD > 0 ? Math.max(0.05, Math.min(0.95, (skZ - ptsMinY) / bD)) : 0.5;

        const newSkylight = {
            id: `sky_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            type: preset.type || 'skylight_flush_flat',
            material: preset.material || 'glass_roof_square_grid',
            frameMaterial: preset.frameMaterial || 'metal_dark_steel',
            width: preset.width || 120,
            length: preset.length || 180,
            depth: preset.depth || 10,
            u: Number(u.toFixed(3)),
            v: Number(v.toFixed(3)),
            coverage: preset.coverage || 'custom'
        };

        roof.config = roof.config || {};
        roof.config.skylights = roof.config.skylights || [];
        roof.config.skylights.push(newSkylight);

        // In-place CAD rebuild
        if (this.ctx.envBuilder && typeof this.ctx.envBuilder.updateRoofLive === 'function') {
            this.ctx.envBuilder.updateRoofLive(roof);
        } else {
            const builder = new Roof3DBuilder(this.ctx);
            if (roof.mesh3D && roof.mesh3D.parent) {
                roof.mesh3D.parent.remove(roof.mesh3D);
            }
            builder.buildRoofs([roof], 0, false, this.ctx.structureGroup);
        }

        // Select the roof & trigger properties panel update
        if (this.interactions && this.interactions.selectObject && roof.mesh3D) {
            const roofTop = roof.mesh3D.children.find(c => c.userData && c.userData.isRoof);
            if (roofTop) this.interactions.selectObject(roofTop, hit);
        }

        this.hideGhost();
        if (this.ctx.requestRender) this.ctx.requestRender();
        return true;
    }

    _renderGhostPreview(hit, roof) {
        const planner = this.getPlanner();
        const preset = planner?.activePresetParams || {};

        const width = preset.width || 120;
        const length = preset.length || 180;
        const depth = preset.depth || 10;

        const conf = roof.config || roof;
        const pts = roof.points || [];
        let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
        pts.forEach(p => {
            ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
            ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
        });
        const bW = ptsMaxX - ptsMinX;
        const bD = ptsMaxY - ptsMinY;

        const pitchRad = (conf.pitch || 30) * Math.PI / 180;
        let tiltX = 0, tiltZ = 0;

        if (conf.roofType === 'gable' || conf.roofType === 'curved') {
            const axis = conf.ridgeAxis || 'x';
            if (axis === 'x') {
                const cy = (ptsMinY + ptsMaxY) / 2;
                tiltX = hit.point.z >= (roof.y || 0) + cy ? pitchRad : -pitchRad;
            } else {
                const cx = (ptsMinX + ptsMaxX) / 2;
                tiltZ = hit.point.x >= (roof.x || 0) + cx ? -pitchRad : pitchRad;
            }
        } else if (conf.roofType === 'shed') {
            const axis = conf.ridgeAxis || 'x';
            tiltX = (axis === 'x') ? (conf.flipSlope ? -pitchRad : pitchRad) : 0;
            tiltZ = (axis === 'y') ? (conf.flipSlope ? pitchRad : -pitchRad) : 0;
        }

        this.voidMesh.geometry.dispose();
        this.voidMesh.geometry = new THREE.BoxGeometry(width, 2, length);
        this.voidMesh.position.set(0, 1, 0);

        this.edgeBox.geometry.dispose();
        this.edgeBox.geometry = new THREE.EdgesGeometry(this.voidMesh.geometry);
        this.edgeBox.position.copy(this.voidMesh.position);

        this.ghostGroup.position.copy(hit.point);
        this.ghostGroup.rotation.set(tiltX, -(roof.rotation || 0) * Math.PI / 180, tiltZ);
        this.ghostGroup.visible = true;

        if (this.lastClientX && this.lastClientY) {
            this._updateDOMBadge(`🪟 ${preset.name || 'Glass Addon'}: ${width} × ${length} cm`, { x: this.lastClientX, y: this.lastClientY });
        }
    }

    hideGhost() {
        this.ghostGroup.visible = false;
        this._hideDOMBadge();
    }
}
