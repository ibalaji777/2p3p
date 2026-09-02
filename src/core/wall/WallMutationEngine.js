/**
 * WallMutationEngine.js
 * 
 * Single source of truth for all wall state mutations:
 * - Thickness, Height, Elevation, and Top Profiles
 * - Material Assignments & Group Propagations
 * - Anchor & Wall Translation
 * - Single-Sided Pinned Push / Pull & Baseline Room Resizing
 * - Widget & Molding Attachments
 * - Batch Updates
 */

import { WallGeometryEngine } from './WallGeometryEngine.js';

export class WallMutationEngine {
    /**
     * Authoritative thickness setter.
     * @param {Object} wall 
     * @param {number} newThickness 
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static setThickness(wall, newThickness, shouldSync = true, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;
        const thick = Math.max(2, Math.min(200, Number(newThickness) || 20));
        wall.thickness = thick;
        if (wall.config) wall.config.thickness = thick;

        if (wall.parentArc && wall.parentArc.walls && !wall._propagatingArcThickness) {
            wall.parentArc.thickness = thick;
            wall.parentArc.walls.forEach(sibling => {
                if (sibling !== wall) {
                    sibling._propagatingArcThickness = true;
                    this.setThickness(sibling, thick, false, p);
                    sibling._propagatingArcThickness = false;
                }
            });
        }

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }
    }

    /**
     * Authoritative height setter.
     * @param {Object} wall 
     * @param {number} newHeight 
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static setHeight(wall, newHeight, shouldSync = true, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;
        const h = Math.max(10, Math.min(1000, Number(newHeight) || 180));
        wall.height = h;
        if (wall.config) wall.config.height = h;

        if (wall.parentArc && wall.parentArc.walls && !wall._propagatingArcHeight) {
            wall.parentArc.height = h;
            wall.parentArc.walls.forEach(sibling => {
                if (sibling !== wall) {
                    sibling._propagatingArcHeight = true;
                    this.setHeight(sibling, h, false, p);
                    sibling._propagatingArcHeight = false;
                }
            });
        }

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }
    }

    /**
     * Authoritative elevation setter.
     * @param {Object} wall 
     * @param {number} newElevation 
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static setElevation(wall, newElevation, shouldSync = true, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;
        wall.elevation = Number(newElevation) || 0;

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }
    }

    /**
     * Authoritative endpoint positions setter.
     * @param {Object} wall 
     * @param {{x: number, y: number}} startPos 
     * @param {{x: number, y: number}} endPos 
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static setEndpoints(wall, startPos, endPos, shouldSync = true, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;

        if (startPos) {
            if (wall.startAnchor) {
                if (typeof wall.startAnchor.position === 'function') {
                    wall.startAnchor.position(startPos);
                } else {
                    wall.startAnchor.x = startPos.x;
                    wall.startAnchor.y = startPos.y;
                }
            } else {
                wall.startX = startPos.x;
                wall.startY = startPos.y;
            }
        }

        if (endPos) {
            if (wall.endAnchor) {
                if (typeof wall.endAnchor.position === 'function') {
                    wall.endAnchor.position(endPos);
                } else {
                    wall.endAnchor.x = endPos.x;
                    wall.endAnchor.y = endPos.y;
                }
            } else {
                wall.endX = endPos.x;
                wall.endY = endPos.y;
            }
        }

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }
    }

    /**
     * Authoritative top profile setter (slopes, gables).
     * @param {Object} wall 
     * @param {string} profileType - 'normal' | 'gable' | 'single'
     * @param {Object} options - { startHeight, endHeight, peakHeight, flipSlope }
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static setTopProfile(wall, profileType = 'normal', options = {}, shouldSync = true, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;
        wall.topProfileType = profileType;

        if (options.startHeight !== undefined) wall.startHeight = Number(options.startHeight);
        if (options.endHeight !== undefined) wall.endHeight = Number(options.endHeight);
        if (options.peakHeight !== undefined) wall.peakHeight = Number(options.peakHeight);
        if (options.peakPos !== undefined) wall.peakPos = Number(options.peakPos);
        if (options.flipSlope !== undefined) wall.flipSlope = !!options.flipSlope;

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }
    }

    /**
     * Authoritative material assignment.
     * @param {Object} wall 
     * @param {Object} options - { target, key, newMat, activeMatIndex, activeObject, ctx }
     * @param {Object} planner 
     */
    static applyMaterial(wall, options = {}, planner = null) {
        if (!wall) return;
        const { target = 'all', key, newMat, activeMatIndex, activeObject, ctx } = options;
        const p = planner || wall.planner;

        wall.params = wall.params || {};

        if (target === 'top') wall.params.textureTop = key;
        else if (target === 'bottom') wall.params.textureBottom = key;
        else if (target === 'left') wall.params.textureLeft = key;
        else if (target === 'right') wall.params.textureRight = key;
        else if (target === 'front') wall.params.textureFront = key;
        else if (target === 'back') wall.params.textureBack = key;
        else if (target === 'all' || target === 'sides') {
            wall.params.texture = key;
            wall.params.textureSides = key;
            wall.params.textureFront = key;
            wall.params.textureBack = key;
            wall.params.textureLeft = key;
            wall.params.textureRight = key;
            wall.params.textureTop = key;
            wall.params.textureBottom = key;
        }

        // Apply in-place to Three.js mesh if active
        let wallGroup = null;
        if (activeObject) {
            wallGroup = (activeObject.userData?.isWallMesh || activeObject.userData?.isWallSide) ? activeObject.parent : (activeObject.parent?.userData?.isWallGroup ? activeObject.parent : activeObject.parent);
        } else if (wall.mesh3D) {
            wallGroup = wall.mesh3D;
        }

        const wallMesh = wall.wallMesh3D || (wallGroup && (wallGroup.userData?.wallMesh || (wallGroup.children ? wallGroup.children.find(c => c.userData?.isWallMesh || (c.isMesh && !c.userData?.isHitbox && !c.userData?.isWallSide && !c.userData?.isDoor && !c.userData?.isWindow && !c.userData?.isFrame && !c.userData?.isGlass && !c.userData?.isHandle)) : null)));

        if (wallMesh && wallMesh.isMesh && Array.isArray(wallMesh.material)) {
            if (target === 'all' || target === 'sides') {
                for (let idx = 0; idx < 6; idx++) {
                    if (newMat) wallMesh.material[idx] = newMat.clone ? newMat.clone() : newMat;
                }
            } else if (target === 'back') {
                if (newMat) {
                    wallMesh.material[5] = newMat;
                    wallMesh.material[0] = newMat.clone ? newMat.clone() : newMat;
                    wallMesh.material[1] = newMat.clone ? newMat.clone() : newMat;
                }
            } else {
                let wIndex = 4;
                if (target === 'right') wIndex = 0;
                else if (target === 'left') wIndex = 1;
                else if (target === 'top') wIndex = 2;
                else if (target === 'bottom') wIndex = 3;
                else if (target === 'front') wIndex = 4;

                if (newMat) {
                    wallMesh.material[wIndex] = newMat;
                }
            }
        }

        // Propagate material to siblings if part of an arc
        if (wall.parentArc && wall.parentArc.walls && !wall._propagatingArcMaterial) {
            wall.parentArc.params = wall.parentArc.params || {};
            wall.parentArc.params = { ...wall.parentArc.params, ...wall.params };

            wall.parentArc.walls.forEach(siblingWall => {
                if (siblingWall === wall) return;
                siblingWall._propagatingArcMaterial = true;
                this.applyMaterial(siblingWall, { target, key, newMat: newMat ? newMat.clone() : null, activeMatIndex, activeObject: null, ctx }, p);
                siblingWall._propagatingArcMaterial = false;
            });
        }

        if (ctx && typeof ctx.updateMaterialLive === 'function') {
            ctx.updateMaterialLive(wall);
        }
    }

    /**
     * Translates an entire wall by (dx, dy).
     * @param {Object} wall 
     * @param {number} dx 
     * @param {number} dy 
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static moveWall(wall, dx, dy, shouldSync = true, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;

        const p1 = WallGeometryEngine.getAnchorPosition(wall.startAnchor);
        const p2 = WallGeometryEngine.getAnchorPosition(wall.endAnchor);

        this.setEndpoints(wall, { x: p1.x + dx, y: p1.y + dy }, { x: p2.x + dx, y: p2.y + dy }, shouldSync, p);
    }

    /**
     * Authoritative anchor movement method.
     * Updates anchor position and automatically synchronizes all connected walls.
     * @param {Object} anchor 
     * @param {{x: number, y: number}} newPosition 
     * @param {Object} planner 
     * @param {boolean} shouldSync 
     */
    static moveAnchor(anchor, newPosition, planner, shouldSync = true) {
        if (!anchor || !newPosition) return;
        const p = planner || anchor.planner;

        if (typeof anchor.position === 'function') {
            anchor.position(newPosition);
        } else {
            anchor.x = newPosition.x;
            anchor.y = newPosition.y;
            if (anchor.lastValidPos) anchor.lastValidPos = { ...newPosition };
        }

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }
    }

    /**
     * Executes CAD-grade Push / Pull operations with single-sided pinned opposite face semantics.
     * @param {Object} wall 
     * @param {string} side - 'front' | 'back'
     * @param {number} distance - Distance in cm (+ is pull outward, - is push inward)
     * @param {Object} options - { mode: 'thickness'|'baseline'|'subregion', initialThickness, initialStart, initialEnd, bounds }
     * @param {Object} planner 
     */
    static pushPull(wall, side, distance, options = {}, planner = null) {
        if (!wall) return;
        const p = planner || wall.planner;
        const {
            mode = 'thickness',
            initialThickness = (Number(wall.thickness) || 20),
            initialStart,
            initialEnd
        } = options;

        const centerline = WallGeometryEngine.getCenterline(wall);
        let normal = centerline.normal;
        if (side === 'back') {
            normal = { x: -normal.x, y: -normal.y };
        }

        const startPos = initialStart || centerline.p1;
        const endPos = initialEnd || centerline.p2;

        if (mode === 'baseline') {
            // BASELINE MOVE: Shifts the entire wall perpendicularly (Room resizing)
            const shiftX = normal.x * distance;
            const shiftY = normal.y * distance;

            this.setEndpoints(wall, { x: startPos.x + shiftX, y: startPos.y + shiftY }, { x: endPos.x + shiftX, y: endPos.y + shiftY }, true, p);
        } else {
            // THICKNESS ADJUSTMENT: Single-sided with opposite face pinned
            const newThick = Math.max(5, Math.min(120, initialThickness + distance));
            const actualDelta = newThick - initialThickness;
            const shift = actualDelta / 2;

            const shiftX = normal.x * shift;
            const shiftY = normal.y * shift;

            wall.thickness = newThick;
            if (wall.config) wall.config.thickness = newThick;

            this.setEndpoints(wall, { x: startPos.x + shiftX, y: startPos.y + shiftY }, { x: endPos.x + shiftX, y: endPos.y + shiftY }, true, p);
        }
    }

    /**
     * Convenience wrapper for outward pull.
     */
    static pull(wall, side, distance, options = {}, planner = null) {
        this.pushPull(wall, side, Math.abs(distance), options, planner);
    }

    /**
     * Convenience wrapper for inward push.
     */
    static push(wall, side, distance, options = {}, planner = null) {
        this.pushPull(wall, side, -Math.abs(distance), options, planner);
    }

    /**
     * Batch updates multiple walls efficiently.
     * @param {Object} planner 
     * @param {Array<Object>} walls 
     * @param {Object} updates - { thickness, height, elevation, params }
     */
    static batchUpdate(planner, walls = [], updates = {}) {
        if (!walls || walls.length === 0) return;

        walls.forEach(w => {
            if (updates.thickness !== undefined) {
                w.thickness = Number(updates.thickness);
                if (w.config) w.config.thickness = Number(updates.thickness);
            }
            if (updates.height !== undefined) {
                w.height = Number(updates.height);
                if (w.config) w.config.height = Number(updates.height);
            }
            if (updates.elevation !== undefined) {
                w.elevation = Number(updates.elevation);
            }
            if (updates.topProfileType !== undefined) {
                w.topProfileType = updates.topProfileType;
            }
            if (updates.startHeight !== undefined) {
                w.startHeight = Number(updates.startHeight);
            }
            if (updates.endHeight !== undefined) {
                w.endHeight = Number(updates.endHeight);
            }
            if (updates.peakHeight !== undefined) {
                w.peakHeight = Number(updates.peakHeight);
            }
            if (updates.peakPos !== undefined) {
                w.peakPos = Number(updates.peakPos);
            }
            if (updates.flipSlope !== undefined) {
                w.flipSlope = !!updates.flipSlope;
            }
            if (updates.params) {
                w.params = { ...(w.params || {}), ...updates.params };
            }
        });

        if (planner && typeof planner.syncAll === 'function') {
            planner.syncAll();
            if (planner.update3D) planner.update3D();
        }
    }

    /**
     * Attaches a widget to a wall.
     */
    static attachWidget(wall, widget, shouldSync = true, planner = null) {
        if (!wall || !widget) return;
        const p = planner || wall.planner;
        if (!wall.attachedWidgets) wall.attachedWidgets = [];
        if (!wall.attachedWidgets.includes(widget)) {
            wall.attachedWidgets.push(widget);
            widget.wall = wall;
        }
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Removes an attached widget.
     */
    static removeWidget(wall, widgetOrId, shouldSync = true, planner = null) {
        if (!wall || !wall.attachedWidgets) return;
        const p = planner || wall.planner;
        const id = typeof widgetOrId === 'string' ? widgetOrId : widgetOrId?.id;
        wall.attachedWidgets = wall.attachedWidgets.filter(w => (id ? w.id !== id : w !== widgetOrId));
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Attaches a molding to a wall.
     */
    static attachMolding(wall, molding, shouldSync = true, planner = null) {
        if (!wall || !molding) return;
        const p = planner || wall.planner;
        if (!wall.attachedMoldings) wall.attachedMoldings = [];
        if (!wall.attachedMoldings.includes(molding)) {
            wall.attachedMoldings.push(molding);
            molding.wall = wall;
        }
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Removes an attached molding.
     */
    static removeMolding(wall, moldingOrId, shouldSync = true, planner = null) {
        if (!wall || !wall.attachedMoldings) return;
        const p = planner || wall.planner;
        const id = typeof moldingOrId === 'string' ? moldingOrId : moldingOrId?.id;
        wall.attachedMoldings = wall.attachedMoldings.filter(m => (id ? m.id !== id : m !== moldingOrId));
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }
}
