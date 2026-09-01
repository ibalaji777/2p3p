import * as THREE from 'three';
import { Skylight3DBuilder } from '../../features/roof/builders/Skylight3DBuilder.js';
import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';
import { RoofSculpture3DBuilder } from '../../features/roof/builders/RoofSculpture3DBuilder.js';

/**
 * RoofPlugin3DPlacementSystem
 * 
 * Direct Sims 4-Style 3D Roof Plugin & Sculpture Placement:
 * 1. Glass & Skylight Addons: Snap onto roof slopes with rectangular aperture void ghost preview.
 * 2. Wrought Iron Ridge Cresting: Snaps along the roof's top ridge lines (Victorian lace, gothic spikes, modern metal caps).
 * 3. Apex Finials & Weather Vanes: Snaps directly to roof apex points, peak ends, and turret pinnacles.
 * 4. Chimney Stacks: Snaps onto roof slopes with slope pitch compensation and vertical alignment.
 */
export class RoofPlugin3DPlacementSystem {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.interactions = interactionSystem;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.skylight3DBuilder = new Skylight3DBuilder(ctx);
        this.sculpture3DBuilder = new RoofSculpture3DBuilder(ctx);

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

        const isSkylight = tool === 'skylight' || tool === 'roof_skylight' || (typeof tool === 'string' && tool.startsWith('skylight')) || preset?.type?.startsWith('skylight') || preset?.toolId === 'skylight';
        const isCresting = tool === 'roof_cresting' || (typeof tool === 'string' && tool.startsWith('ridge_cresting')) || preset?.type?.startsWith('ridge_cresting') || preset?.toolId === 'roof_cresting';
        const isFinial = tool === 'roof_finial' || (typeof tool === 'string' && tool.startsWith('finial_')) || preset?.type?.startsWith('finial_') || preset?.toolId === 'roof_finial';
        const isChimney = tool === 'roof_chimney' || (typeof tool === 'string' && tool.startsWith('chimney_')) || preset?.type?.startsWith('chimney_') || preset?.toolId === 'roof_chimney';
        const isSculpture = tool === 'roof_sculptures' || tool === 'roof_sculpture' || preset?.toolId === 'roof_sculptures';

        return isSkylight || isCresting || isFinial || isChimney || isSculpture;
    }

    getToolCategory() {
        const planner = this.getPlanner();
        const tool = planner?.tool || planner?.activeTool || this.ctx?.activeTool;
        const preset = planner?.activePresetParams || this.ctx?.activePresetParams;
        const type = preset?.type || '';

        if (tool === 'roof_cresting' || type.startsWith('ridge_cresting') || preset?.sculptureCategory === 'cresting') return 'cresting';
        if (tool === 'roof_finial' || type.startsWith('finial_') || preset?.sculptureCategory === 'finial') return 'finial';
        if (tool === 'roof_chimney' || type.startsWith('chimney_') || preset?.sculptureCategory === 'chimney') return 'chimney';
        if (tool === 'skylight' || tool === 'roof_skylight' || type.startsWith('skylight') || preset?.toolId === 'skylight') return 'skylight';
        return 'skylight';
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

        const interactables = (this.ctx.interactables && this.ctx.interactables.length > 0)
            ? this.ctx.interactables
            : (this.ctx.structureGroup ? this.ctx.structureGroup.children : []);
        let intersects = this.raycaster.intersectObjects(interactables, true);

        if (intersects.length === 0 && this.ctx.structureGroup) {
            intersects = this.raycaster.intersectObjects(this.ctx.structureGroup.children, true);
        }
        
        for (const hit of intersects) {
            let obj = hit.object;
            while (obj) {
                if (obj.userData?.isRoof || (obj.userData?.entity && (obj.userData.entity.type === 'roof' || obj.userData.entity.roofType))) {
                    const roof = obj.userData.entity;
                    if (roof) {
                        return { hit, roof, roofMesh: obj };
                    }
                }
                obj = obj.parent;
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
            return true;
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
        const cat = this.getToolCategory();

        roof.config = roof.config || {};

        const pts = roof.points || [];
        let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
        pts.forEach(p => {
            ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
            ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
        });
        const bW = ptsMaxX - ptsMinX;
        const bD = ptsMaxY - ptsMinY;

        let localHitX = (ptsMinX + ptsMaxX) / 2;
        let localHitZ = (ptsMinY + ptsMaxY) / 2;

        if (roof.mesh3D) {
            const localPt = hit.point.clone();
            roof.mesh3D.worldToLocal(localPt);
            localHitX = localPt.x + (ptsMinX + ptsMaxX) / 2;
            localHitZ = localPt.z + (ptsMinY + ptsMaxY) / 2;
        } else {
            let groupX = roof.x || 0, groupZ = roof.y || 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            }
            localHitX = hit.point.x - groupX;
            localHitZ = hit.point.z - groupZ;
        }

        const u = bW > 0 ? Math.max(0.05, Math.min(0.95, (localHitX - ptsMinX) / bW)) : 0.5;
        const v = bD > 0 ? Math.max(0.05, Math.min(0.95, (localHitZ - ptsMinY) / bD)) : 0.5;

        if (cat === 'cresting') {
            // WROUGHT IRON RIDGE CRESTING
            const newCresting = {
                id: `crest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                type: preset.type || 'ridge_cresting_victorian_lace',
                material: preset.material || 'metal_wrought_iron',
                height: preset.height || (preset.type === 'ridge_cresting_metal_cap' ? 8 : 18),
                spacing: preset.spacing || (preset.type === 'ridge_cresting_gothic_spikes' ? 16 : 22),
                segmentIndex: 0
            };
            roof.config.crestings = roof.config.crestings || roof.crestings || [];
            roof.config.crestings.push(newCresting);
            roof.crestings = roof.config.crestings;
        } else if (cat === 'finial') {
            // APEX FINIAL / WEATHER VANE
            const roofBuilder = new Roof3DBuilder(this.ctx);
            const apexes = roofBuilder.getRoofApexPoints(roof);
            let closestPos = 'both_apexes';

            if (apexes.length > 0) {
                const cx = (ptsMinX + ptsMaxX) / 2;
                const cz = (ptsMinY + ptsMaxY) / 2;
                const hitRoofLocal = new THREE.Vector3(localHitX - cx, 0, localHitZ - cz);

                let minD = Infinity;
                let closestApex = apexes[0];
                apexes.forEach(ap => {
                    const d = hitRoofLocal.distanceTo(new THREE.Vector3(ap.x, 0, ap.z));
                    if (d < minD) {
                        minD = d;
                        closestApex = ap;
                    }
                });

                if (closestApex.id === 'center') closestPos = 'center_apex';
                else if (closestApex.id === 'start') closestPos = 'start_apex';
                else if (closestApex.id === 'end') closestPos = 'end_apex';
                else closestPos = closestApex.id || 'both_apexes';
            }

            const newFinial = {
                id: `fin_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                type: preset.type || 'finial_victorian_spire',
                material: preset.material || (preset.type === 'finial_copper_spire' ? 'copper' : 'metal_wrought_iron'),
                height: preset.height || 45,
                scale: preset.scale || 1.0,
                position: closestPos
            };
            roof.config.finials = roof.config.finials || roof.finials || [];
            roof.config.finials.push(newFinial);
            roof.finials = roof.config.finials;
        } else if (cat === 'chimney') {
            // CHIMNEY STACK
            const newChimney = {
                id: `chim_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
                type: preset.type || 'chimney_brick_traditional',
                material: preset.material || (preset.type === 'chimney_stone_tudor' ? 'rough_stone' : (preset.type === 'chimney_metal_flue' ? 'metal_dark_steel' : 'red_brick')),
                width: preset.width || (preset.type === 'chimney_metal_flue' ? 24 : 45),
                depth: preset.depth || (preset.type === 'chimney_metal_flue' ? 24 : 45),
                height: preset.height || (preset.type === 'chimney_metal_flue' ? 110 : 90),
                u: Number(u.toFixed(3)),
                v: Number(v.toFixed(3))
            };
            roof.config.chimneys = roof.config.chimneys || roof.chimneys || [];
            roof.config.chimneys.push(newChimney);
            roof.chimneys = roof.config.chimneys;
        } else {
            // SKYLIGHT / GLASS ADDON
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
            roof.config.skylights = roof.config.skylights || roof.skylights || [];
            roof.config.skylights.push(newSkylight);
            roof.skylights = roof.config.skylights;
        }

        // In-place CAD rebuild
        if (this.ctx.envBuilder && typeof this.ctx.envBuilder.updateRoofLive === 'function') {
            this.ctx.envBuilder.updateRoofLive(roof);
        } else {
            const builder = new Roof3DBuilder(this.ctx);
            if (roof.mesh3D && roof.mesh3D.parent) {
                roof.mesh3D.parent.remove(roof.mesh3D);
            }
            const wallList = (this.ctx.walls && this.ctx.walls.length > 0) ? this.ctx.walls : (this.ctx.planner?.walls || []);
            builder.buildRoofs([roof], 0, wallList, this.ctx.structureGroup);
        }

        // Save history if available
        if (planner?.debouncedSaveHistory) {
            planner.debouncedSaveHistory();
        }

        this.hideGhost();
        if (this.ctx.requestRender) this.ctx.requestRender();
        return true;
    }

    _renderGhostPreview(hit, roof) {
        const planner = this.getPlanner();
        const preset = planner?.activePresetParams || {};
        const cat = this.getToolCategory();

        const conf = roof.config || roof;
        const pts = roof.points || [];
        let ptsMinX = Infinity, ptsMaxX = -Infinity, ptsMinY = Infinity, ptsMaxY = -Infinity;
        pts.forEach(p => {
            ptsMinX = Math.min(ptsMinX, p.x); ptsMaxX = Math.max(ptsMaxX, p.x);
            ptsMinY = Math.min(ptsMinY, p.y); ptsMaxY = Math.max(ptsMaxY, p.y);
        });
        const bW = ptsMaxX - ptsMinX;
        const bD = ptsMaxY - ptsMinY;
        const cx = (ptsMinX + ptsMaxX) / 2;
        const cz = (ptsMinY + ptsMaxY) / 2;

        const pitchRad = (conf.pitch || 30) * Math.PI / 180;
        const roofBuilder = new Roof3DBuilder(this.ctx);

        if (cat === 'cresting') {
            // RIDGE CRESTING GHOST PREVIEW
            const segments = roofBuilder.getRoofRidgeSegments(roof);
            if (segments.length > 0) {
                const targetSeg = segments[0];
                const height = preset.height || (preset.type === 'ridge_cresting_metal_cap' ? 8 : 18);
                const len = targetSeg.length;

                this.voidMesh.geometry.dispose();
                this.voidMesh.geometry = new THREE.BoxGeometry(6, height, len);
                this.voidMesh.position.set(0, height / 2, 0);

                this.edgeBox.geometry.dispose();
                this.edgeBox.geometry = new THREE.EdgesGeometry(this.voidMesh.geometry);
                this.edgeBox.position.copy(this.voidMesh.position);

                let roofWorldPos = new THREE.Vector3(0, 0, 0);
                if (roof.mesh3D) {
                    roofWorldPos.copy(roof.mesh3D.position);
                } else {
                    let groupX = roof.x || 0, groupZ = roof.y || 0;
                    roofWorldPos.set(groupX + cx, 120, groupZ + cz);
                }

                // Place along the top ridge line
                const segCenterLocal = new THREE.Vector3(targetSeg.center.x, targetSeg.center.y, targetSeg.center.z);
                const rotY = -(roof.rotation || 0) * Math.PI / 180;
                segCenterLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

                this.ghostGroup.position.copy(roofWorldPos).add(segCenterLocal);
                this.ghostGroup.rotation.set(0, rotY + targetSeg.angleY, 0);
                this.ghostGroup.visible = true;

                if (this.lastClientX && this.lastClientY) {
                    this._updateDOMBadge(`🏷️ ${preset.name || 'Ridge Cresting'}: ${Math.round(len)} cm (Ridge)`, { x: this.lastClientX, y: this.lastClientY });
                }
                return;
            }
        } else if (cat === 'finial') {
            // APEX FINIAL GHOST PREVIEW
            const apexes = roofBuilder.getRoofApexPoints(roof);
            if (apexes.length > 0) {
                let localHitX = (ptsMinX + ptsMaxX) / 2;
                let localHitZ = (ptsMinY + ptsMaxY) / 2;
                if (roof.mesh3D) {
                    const localPt = hit.point.clone();
                    roof.mesh3D.worldToLocal(localPt);
                    localHitX = localPt.x + cx;
                    localHitZ = localPt.z + cz;
                }
                const hitRoofLocal = new THREE.Vector3(localHitX - cx, 0, localHitZ - cz);

                let closestApex = apexes[0];
                let minD = Infinity;
                apexes.forEach(ap => {
                    const d = hitRoofLocal.distanceTo(new THREE.Vector3(ap.x, 0, ap.z));
                    if (d < minD) {
                        minD = d;
                        closestApex = ap;
                    }
                });

                const finH = preset.height || 45;
                this.voidMesh.geometry.dispose();
                this.voidMesh.geometry = new THREE.CylinderGeometry(1.5, 4, finH, 12);
                this.voidMesh.position.set(0, finH / 2, 0);

                this.edgeBox.geometry.dispose();
                this.edgeBox.geometry = new THREE.EdgesGeometry(this.voidMesh.geometry);
                this.edgeBox.position.copy(this.voidMesh.position);

                let roofWorldPos = new THREE.Vector3(0, 0, 0);
                if (roof.mesh3D) {
                    roofWorldPos.copy(roof.mesh3D.position);
                } else {
                    let groupX = roof.x || 0, groupZ = roof.y || 0;
                    roofWorldPos.set(groupX + cx, 120, groupZ + cz);
                }

                const apLocal = new THREE.Vector3(closestApex.x, closestApex.y, closestApex.z);
                const rotY = -(roof.rotation || 0) * Math.PI / 180;
                apLocal.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);

                this.ghostGroup.position.copy(roofWorldPos).add(apLocal);
                this.ghostGroup.rotation.set(0, rotY, 0);
                this.ghostGroup.visible = true;

                if (this.lastClientX && this.lastClientY) {
                    this._updateDOMBadge(`🧭 ${preset.name || 'Apex Finial'} @ ${closestApex.label || 'Peak'}`, { x: this.lastClientX, y: this.lastClientY });
                }
                return;
            }
        } else if (cat === 'chimney') {
            // CHIMNEY STACK GHOST PREVIEW
            const width = preset.width || 45;
            const depth = preset.depth || 45;
            const height = preset.height || 90;

            this.voidMesh.geometry.dispose();
            this.voidMesh.geometry = new THREE.BoxGeometry(width, height, depth);
            this.voidMesh.position.set(0, height / 2 - 15, 0);

            this.edgeBox.geometry.dispose();
            this.edgeBox.geometry = new THREE.EdgesGeometry(this.voidMesh.geometry);
            this.edgeBox.position.copy(this.voidMesh.position);

            this.ghostGroup.position.copy(hit.point);
            this.ghostGroup.rotation.set(0, -(roof.rotation || 0) * Math.PI / 180, 0);
            this.ghostGroup.visible = true;

            if (this.lastClientX && this.lastClientY) {
                this._updateDOMBadge(`🧱 ${preset.name || 'Chimney Stack'}: ${width} × ${depth} cm`, { x: this.lastClientX, y: this.lastClientY });
            }
            return;
        }

        // SKYLIGHT GHOST PREVIEW
        const width = preset.width || 120;
        const length = preset.length || 180;

        let tiltX = 0, tiltZ = 0;
        if (conf.roofType === 'gable' || conf.roofType === 'curved') {
            const axis = conf.ridgeAxis || 'x';
            if (axis === 'x') {
                const cyVal = (ptsMinY + ptsMaxY) / 2;
                tiltX = hit.point.z >= (roof.y || 0) + cyVal ? pitchRad : -pitchRad;
            } else {
                const cxVal = (ptsMinX + ptsMaxX) / 2;
                tiltZ = hit.point.x >= (roof.x || 0) + cxVal ? -pitchRad : pitchRad;
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
