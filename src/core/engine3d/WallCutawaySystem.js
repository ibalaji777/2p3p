import * as THREE from 'three';

/**
 * WallCutawaySystem
 * 
 * Manages Sims 4-style 3-state Wall Visibility & Dynamic Camera Cutaways:
 * 1. 'walls_up': Full 3D rendering of all walls at full height
 * 2. 'cutaway': Dynamic camera line-of-sight cutaway (camera-facing foreground walls automatically lower to 15cm cutlines)
 * 3. 'walls_down': All walls collapsed to 15cm floor-level profile cutlines for unobstructed room inspection
 */
export class WallCutawaySystem {
    constructor(ctx) {
        this.ctx = ctx;
        this.mode = 'walls_up'; // 'walls_up' | 'cutaway' | 'walls_down'
        this._lastCamPos = new THREE.Vector3();
        this._lastCamTarget = new THREE.Vector3();
    }

    setMode(mode) {
        if (!['walls_up', 'cutaway', 'walls_down'].includes(mode)) return;
        this.mode = mode;
        this.update(true);
        if (this.ctx.requestRender) this.ctx.requestRender('wall_cutaway_mode_change', 2);
    }

    getMode() {
        return this.mode;
    }

    cycleMode() {
        const order = ['walls_up', 'cutaway', 'walls_down'];
        const nextIdx = (order.indexOf(this.mode) + 1) % order.length;
        this.setMode(order[nextIdx]);
        return this.mode;
    }

    update(force = false) {
        if (!this.ctx || !this.ctx.camera) return;

        const cam = this.ctx.camera;
        const controls = this.ctx.controls;
        const target = controls?.target || new THREE.Vector3(0, 0, 0);

        // Check if camera moved significantly or forced
        if (!force && this.mode === 'cutaway') {
            if (this._lastCamPos.distanceToSquared(cam.position) < 4 && this._lastCamTarget.distanceToSquared(target) < 4) {
                return;
            }
        }
        this._lastCamPos.copy(cam.position);
        this._lastCamTarget.copy(target);

        const wallGroups = [];
        if (this.ctx.structureGroup) {
            this.ctx.structureGroup.children.forEach(child => {
                if (child.userData && (child.userData.isWallGroup || child.userData.entity?.startX !== undefined)) {
                    wallGroups.push(child);
                }
            });
        }
        if (this.ctx.staticStructureGroup) {
            this.ctx.staticStructureGroup.children.forEach(child => {
                if (child.userData && (child.userData.isWallGroup || child.userData.entity?.startX !== undefined)) {
                    wallGroups.push(child);
                }
            });
        }

        const camPos = cam.position;
        const camToTarget = new THREE.Vector3().subVectors(target, camPos);
        const camDistToTarget = camToTarget.length();

        wallGroups.forEach(wallGroup => {
            const entity = wallGroup.userData?.entity;
            const wallMesh = wallGroup.userData?.wallMesh || wallGroup.children.find(c => c.userData?.isWallMesh || c.geometry);
            if (!wallMesh) return;

            const wallH = entity?.height !== undefined ? entity.height : (entity?.config?.height || 120);
            const cutlineH = 15; // 15cm low cutline
            const cutRatio = Math.min(1.0, cutlineH / Math.max(1, wallH));

            if (this.mode === 'walls_up') {
                // Restore 100% full height
                wallMesh.scale.y = 1.0;
                wallGroup.children.forEach(child => {
                    if (child !== wallMesh && !child.userData?.isHitbox && child.userData?.isWallSide !== true) {
                        if (child.userData?.isCapMolding) {
                            child.position.y = wallH;
                        }
                        child.visible = true;
                    }
                });
            } else if (this.mode === 'walls_down') {
                // Collapse all walls to low 15cm baseline cutlines
                wallMesh.scale.y = cutRatio;
                wallGroup.children.forEach(child => {
                    if (child !== wallMesh && !child.userData?.isHitbox && child.userData?.isWallSide !== true) {
                        if (child.userData?.moldData && (child.userData.moldData.heightOffset || 0) > 20) {
                            child.visible = false;
                        } else if (child.userData?.isCapMolding) {
                            child.position.y = cutlineH;
                            child.visible = true;
                        } else if (child.userData?.isPattern) {
                            child.visible = false;
                        }
                    }
                });
            } else if (this.mode === 'cutaway') {
                // Dynamic camera-facing cutaway
                const p1 = (entity?.startAnchor && typeof entity.startAnchor.position === 'function')
                    ? entity.startAnchor.position()
                    : (entity?.startAnchor || { x: entity?.startX || 0, y: entity?.startY || 0 });
                const p2 = (entity?.endAnchor && typeof entity.endAnchor.position === 'function')
                    ? entity.endAnchor.position()
                    : (entity?.endAnchor || { x: entity?.endX || 0, y: entity?.endY || 0 });

                const wallMidX = (p1.x + p2.x) / 2;
                const wallMidZ = (p1.y + p2.y) / 2;
                const wallWorldPos = new THREE.Vector3(wallMidX, entity?.elevation || 0, wallMidZ);

                const dx = p2.x - p1.x;
                const dz = p2.y - p1.y;
                const len = Math.hypot(dx, dz);

                let isCut = false;

                if (len > 1) {
                    const nx = -dz / len;
                    const nz = dx / len;

                    const toCamX = camPos.x - wallWorldPos.x;
                    const toCamZ = camPos.z - wallWorldPos.z;
                    const distToCam = Math.hypot(toCamX, toCamZ);

                    const camDirX = camToTarget.x / (camDistToTarget || 1);
                    const camDirZ = camToTarget.z / (camDistToTarget || 1);

                    const isBetween = (distToCam < camDistToTarget + 50);
                    const viewDot = camDirX * nx + camDirZ * nz;

                    if (isBetween && Math.abs(viewDot) > 0.12 && distToCam < camDistToTarget) {
                        isCut = true;
                    }
                }

                if (isCut) {
                    wallMesh.scale.y = cutRatio;
                    wallGroup.children.forEach(child => {
                        if (child !== wallMesh && !child.userData?.isHitbox && child.userData?.isWallSide !== true) {
                            if (child.userData?.moldData && (child.userData.moldData.heightOffset || 0) > 20) {
                                child.visible = false;
                            } else if (child.userData?.isCapMolding) {
                                child.position.y = cutlineH;
                                child.visible = true;
                            } else if (child.userData?.isPattern) {
                                child.visible = false;
                            }
                        }
                    });
                } else {
                    wallMesh.scale.y = 1.0;
                    wallGroup.children.forEach(child => {
                        if (child !== wallMesh && !child.userData?.isHitbox && child.userData?.isWallSide !== true) {
                            if (child.userData?.isCapMolding) {
                                child.position.y = wallH;
                            }
                            child.visible = true;
                        }
                    });
                }
            }
        });
    }
}
