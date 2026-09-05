import * as THREE from 'three';
import { PLATFORM_TRIM_STYLES } from '../engine2d/PremiumPlatform.js';

/**
 * PlatformInteractiveSuite
 * 
 * Central coordinator managing Sims 4-style 3D interactive editing for platforms:
 * 1. Floating 3D HUD Toolbar directly hovering over the selected platform:
 *    - ▲ Raise Platform (+15cm / +1 Step)
 *    - ▼ Lower Platform (-15cm / -1 Step)
 *    - Live Step Count & Height badge
 *    - Quick Trim Style selector (Clean, Beveled, Bullnose, Molded, LED Reveal, Stone)
 *    - Rotate 90°
 *    - Duplicate
 *    - Delete (✕)
 * 2. In-Scene 3D Vertical Height Arrow Handle:
 *    - Interactive vertical drag handle to adjust height smoothly or in step snaps directly in 3D.
 */
export class PlatformInteractiveSuite extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'PlatformInteractiveSuite';

        this.target = null; // THREE.Mesh or THREE.Group of selected platform
        this.platform = null; // PremiumPlatform instance

        // 3D Height Arrow Handle
        this.heightHandleGroup = new THREE.Group();
        this.heightHandleGroup.name = 'Platform_HeightHandleGroup';
        this.heightHandleGroup.visible = false;
        this.add(this.heightHandleGroup);

        this._create3DHeightHandle();
        this._createDOMHUD();

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.isDraggingHeight = false;
        this.dragStartY = 0;
        this.initialHeight = 20;

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
            dom.addEventListener('pointerup', this._onPointerUp, { passive: false });
        }
    }

    _create3DHeightHandle() {
        // Vertical Arrow (Emerald Green)
        const shaftGeo = new THREE.CylinderGeometry(1.8, 1.8, 16, 16);
        shaftGeo.translate(0, 8, 0);
        const headGeo = new THREE.ConeGeometry(5, 12, 16);
        headGeo.translate(0, 22, 0);

        this.matHandle = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false });
        this.matHandleHover = new THREE.MeshBasicMaterial({ color: 0x34d399, depthTest: false });

        const shaftMesh = new THREE.Mesh(shaftGeo, this.matHandle);
        shaftMesh.renderOrder = 1010;
        const headMesh = new THREE.Mesh(headGeo, this.matHandle);
        headMesh.renderOrder = 1010;

        // Invisible generous hit cylinder for easy picking
        const hitGeo = new THREE.CylinderGeometry(10, 10, 30, 12);
        hitGeo.translate(0, 15, 0);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isPlatformHeightHandle: true };

        this.heightHandleGroup.add(shaftMesh, headMesh, hitMesh);
    }

    _createDOMHUD() {
        if (typeof document === 'undefined') return;

        this.domHUD = document.createElement('div');
        this.domHUD.className = 'sims4-platform-3d-hud';
        this.domHUD.style.cssText = `
            position: absolute;
            display: none;
            flex-direction: column;
            align-items: center;
            gap: 6px;
            pointer-events: auto;
            transform: translate(-50%, -100%);
            z-index: 9999;
            user-select: none;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            filter: drop-shadow(0 12px 28px rgba(0,0,0,0.6));
        `;

        // Inner HUD Container
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            background: rgba(15, 23, 42, 0.96);
            border: 2px solid #f59e0b;
            border-radius: 30px;
            padding: 5px 10px;
            box-shadow: 0 0 20px rgba(245, 158, 11, 0.35);
            backdrop-filter: blur(12px);
        `;

        // 1. Raise Button (▲)
        const btnRaise = document.createElement('button');
        btnRaise.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="18 15 12 9 6 15"></polyline>
            </svg>
            <span style="font-size:12px;font-weight:800;margin-left:2px;">+15</span>
        `;
        btnRaise.title = 'Raise Platform (+15cm / 1 Step)';
        this._styleHUDButton(btnRaise, '#10b981', 'rgba(16, 185, 129, 0.25)');
        btnRaise.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                this.platform.raisePlatform(15);
                this.update();
            }
        };

        // 2. Lower Button (▼)
        const btnLower = document.createElement('button');
        btnLower.innerHTML = `
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
            <span style="font-size:12px;font-weight:800;margin-left:2px;">-15</span>
        `;
        btnLower.title = 'Lower Platform (-15cm / 1 Step)';
        this._styleHUDButton(btnLower, '#f59e0b', 'rgba(245, 158, 11, 0.25)');
        btnLower.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                this.platform.lowerPlatform(15);
                this.update();
            }
        };

        // 3. Step Info Badge
        this.hudBadge = document.createElement('div');
        this.hudBadge.style.cssText = `
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            padding: 4px 10px;
            background: rgba(30, 41, 59, 0.85);
            border-radius: 16px;
            white-space: nowrap;
            letter-spacing: 0.3px;
            border: 1px solid rgba(255, 255, 255, 0.15);
        `;
        this.hudBadge.textContent = 'Platform: 20cm (1 Step)';

        // 4. Trim Profile Dropdown / Switcher Button
        const btnTrim = document.createElement('button');
        btnTrim.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
            </svg>
            <span style="font-size:11px;font-weight:700;margin-left:3px;">Trim</span>
        `;
        btnTrim.title = 'Change Platform Trim Profile';
        this._styleHUDButton(btnTrim, '#38bdf8', 'rgba(56, 189, 248, 0.2)');
        btnTrim.onclick = (e) => {
            e.stopPropagation();
            this._cycleTrimStyle();
        };

        // 5. Rotate 90° Button
        const btnRotate = document.createElement('button');
        btnRotate.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="23 4 23 10 17 10"></polyline>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
        `;
        btnRotate.title = 'Rotate Platform 90°';
        this._styleHUDButton(btnRotate, '#a855f7', 'rgba(168, 85, 247, 0.2)');
        btnRotate.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                this.platform.rotation = (this.platform.rotation + 90) % 360;
                if (this.platform.group) this.platform.group.rotation(this.platform.rotation);
                this.platform._sync3DTransform();
                if (this.platform.planner?.syncAll) this.platform.planner.syncAll();
                if (this.platform.planner?.debouncedSaveHistory) this.platform.planner.debouncedSaveHistory();
                this.update();
            }
        };

        // 6. Delete Button (✕)
        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = `✕`;
        btnDelete.title = 'Delete Platform';
        this._styleHUDButton(btnDelete, '#ef4444', 'rgba(239, 68, 68, 0.25)');
        btnDelete.style.fontWeight = '800';
        btnDelete.onclick = (e) => {
            e.stopPropagation();
            if (this.platform) {
                const planner = this.platform.planner;
                this.detach();
                this.platform.destroy();
                if (planner) {
                    planner.selectEntity(null);
                    if (planner.syncAll) planner.syncAll();
                    if (planner.debouncedSaveHistory) planner.debouncedSaveHistory();
                }
            }
        };

        container.appendChild(btnRaise);
        container.appendChild(btnLower);
        container.appendChild(this.hudBadge);
        container.appendChild(btnTrim);
        container.appendChild(btnRotate);
        container.appendChild(btnDelete);

        this.domHUD.appendChild(container);
        document.body.appendChild(this.domHUD);
    }

    _styleHUDButton(btn, color, bg) {
        btn.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            height: 32px;
            padding: 0 10px;
            border-radius: 16px;
            border: 1.5px solid ${color};
            background: ${bg};
            color: #ffffff;
            cursor: pointer;
            transition: all 0.12s ease;
            outline: none;
        `;
        btn.onmouseenter = () => {
            btn.style.transform = 'scale(1.08)';
            btn.style.boxShadow = `0 0 12px ${color}`;
        };
        btn.onmouseleave = () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = 'none';
        };
    }

    _cycleTrimStyle() {
        if (!this.platform) return;
        const styles = Object.keys(PLATFORM_TRIM_STYLES);
        const curIdx = styles.indexOf(this.platform.trimStyle || 'flat');
        const nextStyle = styles[(curIdx + 1) % styles.length];
        this.platform.setTrimStyle(nextStyle);
        this.update();
    }

    attach(object) {
        if (!object) return;
        this.target = object;
        this.platform = object.userData?.entity || (object.parent?.userData?.entity) || null;

        if (!this.platform || this.platform.type !== 'platform') {
            this.detach();
            return;
        }

        this.visible = true;
        this.heightHandleGroup.visible = true;
        if (this.domHUD) this.domHUD.style.display = 'flex';

        this.update();
    }

    detach() {
        this.target = null;
        this.platform = null;
        this.visible = false;
        this.heightHandleGroup.visible = false;
        this.isDraggingHeight = false;
        if (this.domHUD) this.domHUD.style.display = 'none';
    }

    update() {
        if (!this.platform || !this.target || !this.ctx.camera || !this.ctx.renderer) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        const absH = Math.max(1, Math.abs(this.platform.height || 20));
        const cy = (this.platform.elevation || 0) + (this.platform.height < 0 ? 0 : absH);

        // Position 3D height handle on top center of platform
        this.heightHandleGroup.position.set(this.platform.x, cy, this.platform.y);

        // Update DOM Badge
        if (this.hudBadge) {
            const trimName = PLATFORM_TRIM_STYLES[this.platform.trimStyle]?.name || 'Clean';
            this.hudBadge.innerHTML = `<strong>${this.platform.getStepLabel()}</strong> • <span style="color:#38bdf8;">${trimName}</span>`;
        }

        // Project top center to screen coordinates for floating HUD
        const worldPos = new THREE.Vector3(this.platform.x, cy + 28, this.platform.y);
        const v = worldPos.clone().project(this.ctx.camera);

        // Behind camera check
        if (v.z > 1) {
            if (this.domHUD) this.domHUD.style.display = 'none';
            return;
        }

        const rect = this.ctx.renderer.domElement.getBoundingClientRect();
        const screenX = ((v.x + 1) / 2) * rect.width + rect.left;
        const screenY = ((-v.y + 1) / 2) * rect.height + rect.top;

        if (this.domHUD) {
            this.domHUD.style.left = `${screenX}px`;
            this.domHUD.style.top = `${screenY - 12}px`;
            this.domHUD.style.display = 'flex';
        }

        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    _onPointerDown(e) {
        if (!this.platform || !this.heightHandleGroup.visible) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom || !this.ctx.camera) return;
        const rect = dom.getBoundingClientRect();

        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const hits = this.raycaster.intersectObjects(this.heightHandleGroup.children, true);

        if (hits.length > 0) {
            e.stopPropagation();
            this.isDraggingHeight = true;
            this.dragStartY = e.clientY;
            this.initialHeight = this.platform.height || 20;
            if (dom.setPointerCapture) dom.setPointerCapture(e.pointerId);
        }
    }

    _onPointerMove(e) {
        if (this.isDraggingHeight && this.platform) {
            e.stopPropagation();
            const deltaY = this.dragStartY - e.clientY; // Upward drag = positive height
            const stepH = this.platform.stepHeight || 15;
            const newHeight = this.initialHeight + (deltaY * 0.5);

            // Snap to steps if within 4cm of integer step
            const nearestStep = Math.round(newHeight / stepH) * stepH;
            const finalH = Math.abs(newHeight - nearestStep) < 4 ? nearestStep : Math.round(newHeight);

            this.platform.setHeight(finalH);
            this.update();
            return;
        }

        // Update floating HUD position during camera orbit/pan
        if (this.platform && this.visible) {
            this.update();
        }
    }

    _onPointerUp(e) {
        if (this.isDraggingHeight) {
            e.stopPropagation();
            this.isDraggingHeight = false;
            const dom = this.ctx.renderer?.domElement;
            if (dom && dom.releasePointerCapture && e.pointerId) {
                try { dom.releasePointerCapture(e.pointerId); } catch(err) {}
            }
            if (this.platform?.planner?.debouncedSaveHistory) {
                this.platform.planner.debouncedSaveHistory();
            }
            this.update();
        }
    }

    destroy() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
            dom.removeEventListener('pointerup', this._onPointerUp);
        }
        if (this.domHUD && this.domHUD.parentElement) {
            this.domHUD.parentElement.removeChild(this.domHUD);
        }
    }
}
