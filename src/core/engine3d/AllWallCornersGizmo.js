import * as THREE from 'three';
import { WallEngine } from '../wall/WallEngine.js';

/**
 * AllWallCornersGizmo
 * 
 * Renders interactive 3D corner nodes, vertical guide lines, and angle badges
 * across ALL wall corners in the scene when the Wall Corners tool is active.
 * Clicking any corner node selects that anchor and opens the Corner Interaction Menu HUD.
 */
export class AllWallCornersGizmo extends THREE.Group {
    constructor(ctx) {
        super();
        this.ctx = ctx;
        this.name = 'AllWallCornersGizmo';
        this.visible = false;
        this.isActive = false;

        this.handlesGroup = new THREE.Group();
        this.handlesGroup.name = 'AllWallCorners_Handles';
        this.add(this.handlesGroup);

        this.interactiveMeshes = [];
        this.hoveredMesh = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // Shared materials
        this.matSharp = new THREE.MeshBasicMaterial({ color: 0x00f0ff, depthTest: false, transparent: true, opacity: 0.95 });
        this.matCurved = new THREE.MeshBasicMaterial({ color: 0x10b981, depthTest: false, transparent: true, opacity: 0.95 });
        this.matHover = new THREE.MeshBasicMaterial({ color: 0xfacc15, depthTest: false, transparent: true, opacity: 1.0 });
        this.matRing = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });

        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerMove = this._onPointerMove.bind(this);

        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.addEventListener('pointerdown', this._onPointerDown, { passive: false });
            dom.addEventListener('pointermove', this._onPointerMove, { passive: false });
        }
    }

    show(enabled = true) {
        this.isActive = enabled;
        this.visible = enabled;
        if (enabled) {
            this.rebuild();
        } else {
            this.clearHandles();
        }
        if (this.ctx.requestRender) this.ctx.requestRender();
    }

    clearHandles() {
        while (this.handlesGroup.children.length > 0) {
            const child = this.handlesGroup.children[0];
            this.handlesGroup.remove(child);
            if (child.geometry) child.geometry.dispose();
        }
        this.interactiveMeshes = [];
        this.hoveredMesh = null;
    }

    rebuild() {
        this.clearHandles();
        if (!this.isActive) return;

        const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;
        if (!planner || !planner.anchors || !planner.walls) return;

        const processedAnchors = new Set();

        planner.anchors.forEach(anc => {
            if (anc.isArcIntermediate) return;

            const attachedWalls = planner.walls.filter(w => w.startAnchor === anc || w.endAnchor === anc);
            const isCorner = attachedWalls.length >= 2 || anc.isCornerApex || !!anc.filletData;
            if (!isCorner) return;

            const pos = anc.position ? anc.position() : { x: anc.x || 0, y: anc.y || 0 };
            const key = `${Math.round(pos.x)},${Math.round(pos.y)}`;
            if (processedAnchors.has(key)) return;
            processedAnchors.add(key);

            const cd = WallEngine.getCornerData(planner, anc);
            const isFilleted = cd && cd.isFilleted;
            const angleDeg = cd?.angleDeg;

            // Height & Elevation
            const walls = (cd && cd.walls && cd.walls.length > 0) ? cd.walls : attachedWalls;
            const wallElev = walls.length > 0 
                ? Math.min(...walls.map(w => w.elevation || 0)) 
                : 0;
            const wallH = walls.length > 0 
                ? Math.max(...walls.map(w => w.height !== undefined ? w.height : (w.config?.height || 120))) 
                : 120;

            const baseColor = isFilleted ? 0x10b981 : 0x00f0ff;
            const baseMat = isFilleted ? this.matCurved : this.matSharp;

            // 1. Vertical Beacon Laser Line
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(pos.x, wallElev, pos.y),
                new THREE.Vector3(pos.x, wallElev + wallH, pos.y)
            ]);
            const lineMat = new THREE.LineBasicMaterial({ 
                color: baseColor, 
                linewidth: 2, 
                transparent: true, 
                opacity: 0.85, 
                depthTest: false 
            });
            const lineMesh = new THREE.Line(lineGeo, lineMat);
            lineMesh.renderOrder = 1000;
            this.handlesGroup.add(lineMesh);

            // 2. Bottom Corner Node
            this._addCornerHandle(pos.x, wallElev + 3, pos.y, anc, baseMat, cd);

            // 3. Top Corner Node
            this._addCornerHandle(pos.x, wallElev + wallH - 3, pos.y, anc, baseMat, cd);

            // 4. Floating 3D Angle Badge
            if (angleDeg !== undefined && angleDeg !== null) {
                const badgeSprite = this._createAngleBadgeSprite(isFilleted ? `╭ ${angleDeg}°` : `${angleDeg}°`, isFilleted);
                badgeSprite.position.set(pos.x, wallElev + wallH + 12, pos.y);
                this.handlesGroup.add(badgeSprite);
            }
        });
    }

    _addCornerHandle(x, y, z, anchor, material, cornerData) {
        const group = new THREE.Group();
        group.position.set(x, y, z);
        group.renderOrder = 1005;

        // Generous invisible hit collider for seamless clicks
        const hitGeo = new THREE.SphereGeometry(12, 12, 12);
        const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { isAllWallCornerHandle: true, anchor, defaultMat: material, cornerData };
        group.add(hitMesh);
        this.interactiveMeshes.push(hitMesh);

        // Visible Octahedron Diamond Node
        const geo = new THREE.OctahedronGeometry(5.5);
        const mesh = new THREE.Mesh(geo, material);
        mesh.userData = { isAllWallCornerHandle: true, anchor, defaultMat: material, cornerData };
        mesh.renderOrder = 1005;
        group.add(mesh);
        hitMesh.userData.visualMesh = mesh;

        // Accent Torus Ring
        const ringGeo = new THREE.TorusGeometry(4.5, 1.0, 8, 16);
        ringGeo.rotateX(Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeo, this.matRing);
        ringMesh.renderOrder = 1006;
        group.add(ringMesh);

        this.handlesGroup.add(group);
    }

    _createAngleBadgeSprite(text, isFilleted) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');

        // Background pill
        ctx.fillStyle = isFilleted ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.92)';
        ctx.beginPath();
        const r = 18;
        const x = 14, y = 14, w = 100, h = 36;
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, r);
        } else {
            ctx.rect(x, y, w, h);
        }
        ctx.fill();

        // Border
        ctx.lineWidth = 3;
        ctx.strokeStyle = isFilleted ? '#34d399' : '#00f0ff';
        ctx.stroke();

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(22, 11, 1);
        sprite.renderOrder = 1007;
        return sprite;
    }

    _onPointerMove(e) {
        if (!this.isActive || !this.visible) return;

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            if (this.hoveredMesh !== hit) {
                if (this.hoveredMesh && this.hoveredMesh.userData?.visualMesh) {
                    this.hoveredMesh.userData.visualMesh.material = this.hoveredMesh.userData.defaultMat;
                    this.hoveredMesh.userData.visualMesh.scale.set(1, 1, 1);
                }
                this.hoveredMesh = hit;
                if (hit.userData?.visualMesh) {
                    hit.userData.visualMesh.material = this.matHover;
                    hit.userData.visualMesh.scale.set(1.3, 1.3, 1.3);
                }
                dom.style.cursor = 'pointer';
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        } else if (this.hoveredMesh) {
            if (this.hoveredMesh.userData?.visualMesh) {
                this.hoveredMesh.userData.visualMesh.material = this.hoveredMesh.userData.defaultMat;
                this.hoveredMesh.userData.visualMesh.scale.set(1, 1, 1);
            }
            this.hoveredMesh = null;
            dom.style.cursor = '';
            if (this.ctx.requestRender) this.ctx.requestRender();
        }
    }

    _onPointerDown(e) {
        if (!this.isActive || !this.visible) return;
        if (e.button !== 0) return; // Left click only

        const dom = this.ctx.renderer?.domElement;
        if (!dom) return;
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.ctx.camera);
        const intersects = this.raycaster.intersectObjects(this.interactiveMeshes, false);

        if (intersects.length > 0) {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();

            const hit = intersects[0].object;
            const anchor = hit.userData?.anchor;
            const planner = this.ctx.planner || window.planner?.value || window.plannerInstance;

            if (planner && anchor && typeof planner.selectEntity === 'function') {
                planner.selectEntity(anchor, 'anchor');
                if (this.ctx.cornerFilletGizmo) {
                    this.ctx.cornerFilletGizmo.attach(anchor);
                }
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
        }
    }

    destroy() {
        const dom = this.ctx.renderer?.domElement;
        if (dom) {
            dom.removeEventListener('pointerdown', this._onPointerDown);
            dom.removeEventListener('pointermove', this._onPointerMove);
        }
        this.clearHandles();
    }
}
