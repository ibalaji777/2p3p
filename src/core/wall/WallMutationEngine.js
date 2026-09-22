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
import { isFloorAnchoredDoor } from './WallEngine.js';
import { WallHeightPolicy } from './WallHeightPolicy.js';
import { WallTopologyEngine } from './WallTopologyEngine.js';
import { RoofMutationEngine } from '../roof/RoofMutationEngine.js';
import { VerticalPropagationEngine } from '../vertical/VerticalPropagationEngine.js';
import { PremiumWidget } from '../engine2d/PremiumWidget.js';
import { advance_openings } from '../engine2d/advance_openings.js';

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
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const minThk = wall.config?.minThickness !== undefined ? Number(wall.config.minThickness) : 6;
        const maxThk = wall.config?.maxThickness !== undefined ? Number(wall.config.maxThickness) : 200;
        const thick = Math.max(minThk, Math.min(maxThk, Number(newThickness) || minThk));
        wall.thickness = thick;
        if (wall.config) wall.config.thickness = thick;

        if (wall.walls && Array.isArray(wall.walls) && !wall._propagatingArcThickness) {
            wall.thickness = thick;
            wall.walls.forEach(seg => {
                seg._propagatingArcThickness = true;
                this.setThickness(seg, thick, false, p);
                seg._propagatingArcThickness = false;
            });
        }

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
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const minH = wall.config?.minHeight !== undefined ? Number(wall.config.minHeight) : WallHeightPolicy.MIN_HEIGHT;
        const maxH = wall.config?.maxHeight !== undefined ? Number(wall.config.maxHeight) : WallHeightPolicy.MAX_HEIGHT;
        const prevH = wall.height !== undefined ? Number(wall.height) : (wall.config?.height || WallHeightPolicy.DEFAULT_HEIGHT);
        const h = WallHeightPolicy.clamp(newHeight, minH, maxH);
        const deltaH = h - prevH;
        wall.height = h;
        if (wall.config) wall.config.height = h;

        if (wall.topProfileType === 'single' || wall.topProfileType === 'gable') {
            if (wall.startHeight !== undefined) wall.startHeight = Math.max(minH, wall.startHeight + deltaH);
            if (wall.endHeight !== undefined) wall.endHeight = Math.max(minH, wall.endHeight + deltaH);
            if (wall.topProfileType === 'gable' && wall.peakHeight !== undefined) {
                wall.peakHeight = Math.max(minH, wall.peakHeight + deltaH);
            }
        } else {
            if (wall.startHeight !== undefined) wall.startHeight = h;
            if (wall.endHeight !== undefined) wall.endHeight = h;
            if (wall.peakHeight !== undefined) wall.peakHeight = h;
        }

        if (wall.walls && Array.isArray(wall.walls) && !wall._propagatingArcHeight) {
            wall.height = h;
            wall.walls.forEach(seg => {
                seg._propagatingArcHeight = true;
                this.setHeight(seg, h, false, p);
                seg._propagatingArcHeight = false;
            });
        }

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

        if (!wall.isAutoGable && !wall.parentRoofId && p && p.roofs && p.roofs.length > 0) {
            RoofMutationEngine.syncRoofsWithWalls([wall], p);
        }

        VerticalPropagationEngine.onWallHeightChanged(wall, h, prevH, p);

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
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const prevElev = wall.elevation !== undefined ? Number(wall.elevation) : 0;
        const elev = Number(newElevation) || 0;
        wall.elevation = elev;

        if (wall.walls && Array.isArray(wall.walls) && !wall._propagatingArcElevation) {
            wall.walls.forEach(seg => {
                seg._propagatingArcElevation = true;
                this.setElevation(seg, elev, false, p);
                seg._propagatingArcElevation = false;
            });
        }

        if (wall.parentArc && wall.parentArc.walls && !wall._propagatingArcElevation) {
            wall.parentArc.elevation = elev;
            wall.parentArc.walls.forEach(sibling => {
                if (sibling !== wall) {
                    sibling._propagatingArcElevation = true;
                    this.setElevation(sibling, elev, false, p);
                    sibling._propagatingArcElevation = false;
                }
            });
        }

        if (!wall.isAutoGable && !wall.parentRoofId && p && p.roofs && p.roofs.length > 0) {
            RoofMutationEngine.syncRoofsWithWalls([wall], p);
        }

        VerticalPropagationEngine.onWallElevationChanged(wall, elev, prevElev, p);

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
        wall.wallShapeData = null;
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
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        wall.topProfileType = profileType;

        if (options.startHeight !== undefined) wall.startHeight = Number(options.startHeight);
        if (options.endHeight !== undefined) wall.endHeight = Number(options.endHeight);
        if (options.peakHeight !== undefined) wall.peakHeight = Number(options.peakHeight);
        if (options.peakPos !== undefined) wall.peakPos = Number(options.peakPos);
        if (options.flipSlope !== undefined) wall.flipSlope = !!options.flipSlope;

        if (wall.walls && Array.isArray(wall.walls) && !wall._propagatingArcTopProfile) {
            wall.walls.forEach(seg => {
                seg._propagatingArcTopProfile = true;
                this.setTopProfile(seg, profileType, options, false, p);
                seg._propagatingArcTopProfile = false;
            });
        }

        if (wall.parentArc && wall.parentArc.walls && !wall._propagatingArcTopProfile) {
            wall.parentArc.topProfileType = profileType;
            if (options.startHeight !== undefined) wall.parentArc.startHeight = Number(options.startHeight);
            if (options.endHeight !== undefined) wall.parentArc.endHeight = Number(options.endHeight);
            if (options.peakHeight !== undefined) wall.parentArc.peakHeight = Number(options.peakHeight);
            if (options.peakPos !== undefined) wall.parentArc.peakPos = Number(options.peakPos);
            if (options.flipSlope !== undefined) wall.parentArc.flipSlope = !!options.flipSlope;

            wall.parentArc.walls.forEach(sibling => {
                if (sibling !== wall) {
                    sibling._propagatingArcTopProfile = true;
                    this.setTopProfile(sibling, profileType, options, false, p);
                    sibling._propagatingArcTopProfile = false;
                }
            });
        }

        if (!wall.isAutoGable && !wall.parentRoofId && p && p.roofs && p.roofs.length > 0) {
            RoofMutationEngine.syncRoofsWithWalls([wall], p);
        }

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

        if (wall.isAutoGable && wall.parentRoofId && p?.roofs) {
            const parentRoof = p.roofs.find(r => r.id === wall.parentRoofId);
            if (parentRoof) {
                parentRoof.config = parentRoof.config || {};
                parentRoof.config.gableMaterial = key;
            }
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

        // Propagate material to siblings or constituent walls if part of an arc
        const arcWalls = (wall.parentArc && wall.parentArc.walls) 
            ? wall.parentArc.walls 
            : (wall.walls && Array.isArray(wall.walls) ? wall.walls : null);
        const arcEntity = wall.parentArc || (wall.walls ? wall : null);

        if (arcEntity) {
            arcEntity.params = arcEntity.params || {};
            arcEntity.params = { ...arcEntity.params, ...wall.params };
        }

        if (arcWalls && !wall._propagatingArcMaterial) {
            arcWalls.forEach(siblingWall => {
                if (siblingWall === wall) return;
                siblingWall._propagatingArcMaterial = true;
                this.applyMaterial(siblingWall, { target, key, newMat: newMat ? (newMat.clone ? newMat.clone() : newMat) : null, activeMatIndex, activeObject: null, ctx }, p);
                siblingWall._propagatingArcMaterial = false;
            });
        }

        if (ctx && typeof ctx.updateMaterialLive === 'function') {
            ctx.updateMaterialLive(wall);
            if (arcEntity && arcEntity !== wall) {
                ctx.updateMaterialLive(arcEntity);
            }
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
        wall.wallShapeData = null;
        const p = planner || wall.planner;

        if (wall.type === 'arc' || (wall.p1 && wall.p2 && wall.pos)) {
            if (typeof wall.move === 'function') {
                wall.move(dx, dy);
            } else {
                if (wall.p1) {
                    const pos1 = typeof wall.p1.position === 'function' ? wall.p1.position() : { x: wall.p1.x, y: wall.p1.y };
                    if (typeof wall.p1.position === 'function') wall.p1.position({ x: pos1.x + dx, y: pos1.y + dy });
                    else { wall.p1.x += dx; wall.p1.y += dy; }
                }
                if (wall.p2) {
                    const pos2 = typeof wall.p2.position === 'function' ? wall.p2.position() : { x: wall.p2.x, y: wall.p2.y };
                    if (typeof wall.p2.position === 'function') wall.p2.position({ x: pos2.x + dx, y: pos2.y + dy });
                    else { wall.p2.x += dx; wall.p2.y += dy; }
                }
                if (wall.pos) {
                    wall.pos.x += dx;
                    wall.pos.y += dy;
                }
                if (typeof wall.rebuild === 'function') wall.rebuild();
            }
            if (shouldSync && p && typeof p.syncAll === 'function') {
                p.syncAll();
                if (p.update3D) p.update3D();
            }
            return;
        }

        if (wall.parentArc) {
            this.moveWall(wall.parentArc, dx, dy, shouldSync, p);
            return;
        }

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

        if (p && p.walls) {
            p.walls.forEach(w => {
                if (w.startAnchor === anchor || w.endAnchor === anchor) {
                    w.wallShapeData = null;
                }
            });
        }

        // Maintain connected filleted corners with dynamic safe radius clamping & tangent re-projection
        if (p && p.anchors) {
            const affectedApexes = p.anchors.filter(a => {
                if (!a.isCornerApex || !a.filletData) return false;
                const fd = a.filletData;
                return (fd.w1 && (fd.w1.startAnchor === anchor || fd.w1.endAnchor === anchor)) ||
                       (fd.w2 && (fd.w2.startAnchor === anchor || fd.w2.endAnchor === anchor)) ||
                       a === anchor;
            });

            affectedApexes.forEach(apex => {
                const fd = apex.filletData;
                const w1 = fd.w1;
                const w2 = fd.w2;
                if (!w1 || !w2) return;

                const pC = apex.position ? apex.position() : { x: apex.x, y: apex.y };
                const other1 = fd.origEndpoint1 === 'start' ? w1.endAnchor : (w1.startAnchor === fd.a1 ? w1.endAnchor : w1.startAnchor);
                const other2 = fd.origEndpoint2 === 'start' ? w2.endAnchor : (w2.startAnchor === fd.a2 ? w2.endAnchor : w2.startAnchor);
                const p1 = WallGeometryEngine.getAnchorPosition(other1);
                const p2 = WallGeometryEngine.getAnchorPosition(other2);

                const l1 = Math.hypot(p1.x - pC.x, p1.y - pC.y);
                const l2 = Math.hypot(p2.x - pC.x, p2.y - pC.y);
                const minL = Math.min(l1, l2);

                if (minL < 25) {
                    // Automatically collapse to sharp corner if wall length is too small to sustain a curve
                    WallTopologyEngine.unfilletCorner(p, apex);
                } else {
                    const v1 = { x: p1.x - pC.x, y: p1.y - pC.y };
                    const v2 = { x: p2.x - pC.x, y: p2.y - pC.y };
                    const dot = Math.max(-0.9999, Math.min(0.9999, (v1.x * v2.x + v1.y * v2.y) / (l1 * l2)));
                    const theta = Math.acos(dot);
                    const deltaPhi = Math.PI - theta;
                    const tanHalf = Math.tan(deltaPhi / 2);
                    const maxSafeR = tanHalf > 0.01 ? (minL * 0.80) / tanHalf : 200;
                    const clampedR = Math.max(20, Math.min(fd.radius || 50, Math.round(maxSafeR / 5) * 5));

                    WallTopologyEngine.filletCorner(p, apex, clampedR);
                }
            });
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
     * @param {Object} options - { mode: 'thickness'|'baseline'|'subregion', initialThickness, initialStart, initialEnd, initialArcPos, bounds }
     * @param {Object} planner 
     */
    static pushPull(wall, side, distance, options = {}, planner = null) {
        if (!wall) return;
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const {
            mode = 'thickness',
            initialThickness = (Number(wall.thickness) || 20),
            initialStart,
            initialEnd,
            initialArcPos
        } = options;

        const shouldSync = options.shouldSync !== undefined ? options.shouldSync : true;

        const arcEntity = wall.type === 'arc' || (wall.walls && Array.isArray(wall.walls)) ? wall : (wall.parentArc || null);

        if (arcEntity) {
            if (mode === 'baseline') {
                // Shift arc control apex along chord normal
                const p1Pos = typeof arcEntity.p1.position === 'function' ? arcEntity.p1.position() : arcEntity.p1;
                const p2Pos = typeof arcEntity.p2.position === 'function' ? arcEntity.p2.position() : arcEntity.p2;
                const chordDx = p2Pos.x - p1Pos.x;
                const chordDy = p2Pos.y - p1Pos.y;
                const chordLen = Math.hypot(chordDx, chordDy);
                let normal = { x: 0, y: 1 };
                if (chordLen > 1e-4) {
                    normal = { x: -chordDy / chordLen, y: chordDx / chordLen };
                }
                if (side === 'back') {
                    normal = { x: -normal.x, y: -normal.y };
                }

                const basePos = initialArcPos || arcEntity.pos;
                arcEntity.pos = {
                    x: basePos.x + normal.x * distance,
                    y: basePos.y + normal.y * distance
                };
                arcEntity.rebuild();
                if (shouldSync && p && typeof p.syncAll === 'function') {
                    p.syncAll();
                    if (p.update3D) p.update3D();
                }
            } else {
                // THICKNESS ADJUSTMENT FOR CURVED WALL:
                // Expand thickness uniformly across all arc segments
                const baseMin = arcEntity.config?.minThickness !== undefined ? Number(arcEntity.config.minThickness) : 6;
                const minThick = options.minThickness !== undefined ? options.minThickness : Math.max(baseMin, initialThickness);
                const maxThick = options.maxThickness !== undefined ? options.maxThickness : (Number(arcEntity.config?.maxThickness) || 200);

                const newThick = Math.max(minThick, Math.min(maxThick, initialThickness + distance));
                arcEntity.thickness = newThick;
                this.setThickness(arcEntity, newThick, shouldSync, p);
            }
            return;
        }

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

            this.setEndpoints(wall, { x: startPos.x + shiftX, y: startPos.y + shiftY }, { x: endPos.x + shiftX, y: endPos.y + shiftY }, shouldSync, p);
        } else {
            // THICKNESS ADJUSTMENT: Single-sided with opposite face pinned
            // In CAD/BIM, pulling a wall face expands thickness outward (+distance).
            // Pushing inward cannot collapse the wall below its starting baseline or canonical minimum thickness.
            const baseMin = wall.config?.minThickness !== undefined ? Number(wall.config.minThickness) : 6;
            const minThick = options.minThickness !== undefined ? options.minThickness : Math.max(baseMin, initialThickness);
            const maxThick = options.maxThickness !== undefined ? options.maxThickness : (Number(wall.config?.maxThickness) || 200);

            const newThick = Math.max(minThick, Math.min(maxThick, initialThickness + distance));
            const actualDelta = newThick - initialThickness;
            const shift = actualDelta / 2;

            const shiftX = normal.x * shift;
            const shiftY = normal.y * shift;

            wall.thickness = newThick;
            if (wall.config) wall.config.thickness = newThick;

            this.setEndpoints(wall, { x: startPos.x + shiftX, y: startPos.y + shiftY }, { x: endPos.x + shiftX, y: endPos.y + shiftY }, shouldSync, p);
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
     * @param {boolean} shouldSync - If true, triggers planner.syncAll() and update3D(). Default is true.
     */
    static batchUpdate(planner, walls = [], updates = {}, shouldSync = true) {
        if (!walls || walls.length === 0) return;

        this.batchMutateOnly(walls, updates, planner);

        if (planner && planner.roofs && planner.roofs.length > 0) {
            if (updates.height !== undefined || updates.elevation !== undefined || updates.startHeight !== undefined || updates.endHeight !== undefined || updates.peakHeight !== undefined || updates.topProfileType !== undefined) {
                RoofMutationEngine.syncRoofsWithWalls(walls, planner);
            }
        }

        if (shouldSync && planner && typeof planner.syncAll === 'function') {
            planner.syncAll();
            if (planner.update3D) planner.update3D();
        }
    }

    /**
     * Mutates wall data properties in-place without triggering planner.syncAll() or 2D redraw.
     * Ideal for live interactive dragging (60 FPS performance).
     * @param {Array<Object>} walls 
     * @param {Object} updates 
     * @param {Object} [planner]
     */
    static batchMutateOnly(walls = [], updates = {}, planner = null) {
        if (!walls || walls.length === 0) return;
        const p = planner || walls[0]?.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);

        walls.forEach(w => {
            w.wallShapeData = null;
            if (updates.thickness !== undefined) {
                const thick = Number(updates.thickness);
                w.thickness = thick;
                if (w.config) w.config.thickness = thick;
            }
            if (updates.height !== undefined) {
                const prevH = w.height !== undefined ? Number(w.height) : (w.config?.height || WallHeightPolicy.DEFAULT_HEIGHT);
                const h = WallHeightPolicy.clamp(updates.height);
                const deltaH = h - prevH;
                w.height = h;
                if (w.config) w.config.height = h;
                if (w.topProfileType === 'single' || w.topProfileType === 'gable') {
                    if (w.startHeight !== undefined) w.startHeight = Math.max(WallHeightPolicy.MIN_HEIGHT, w.startHeight + deltaH);
                    if (w.endHeight !== undefined) w.endHeight = Math.max(WallHeightPolicy.MIN_HEIGHT, w.endHeight + deltaH);
                    if (w.topProfileType === 'gable' && w.peakHeight !== undefined) {
                        w.peakHeight = Math.max(WallHeightPolicy.MIN_HEIGHT, w.peakHeight + deltaH);
                    }
                } else {
                    if (w.startHeight !== undefined) w.startHeight = h;
                    if (w.endHeight !== undefined) w.endHeight = h;
                    if (w.peakHeight !== undefined) w.peakHeight = h;
                }
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

        VerticalPropagationEngine.onBatchWallsUpdated(p, walls, updates);
    }

    /**
     * Authoritative widget creator and factory.
     * @param {Object} planner
     * @param {Object} wall
     * @param {number} t - Distance or normalized ratio along wall
     * @param {string} configId - Widget type or identifier
     * @param {Object} options - Parameter overrides and initial configuration
     * @returns {Object}
     */
    static createWidget(planner, wall, t = 0.5, configId = 'door', options = {}) {
        if (!wall) return null;
        const p = planner || wall.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);

        let normalizedT = Number(t);
        if (isNaN(normalizedT)) normalizedT = 0.5;
        if (normalizedT > 1 && typeof wall.getLength === 'function') {
            const len = wall.getLength();
            if (len > 0) normalizedT = normalizedT / len;
        }
        normalizedT = Math.max(0, Math.min(1, normalizedT));

        const type = configId || options.type || options.configId || 'door';
        const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(type);

        let widget = null;
        if (isAdvancedOpening && typeof advance_openings !== 'undefined') {
            widget = new advance_openings(p, wall, normalizedT, type);
        } else {
            widget = new PremiumWidget(p, wall, normalizedT, type);
        }

        const wallThick = wall.thickness || wall.config?.thickness || 20;
        widget.thick = wallThick;
        widget.wallThick = wallThick;
        widget.wall = wall;
        widget.parentWall = wall;
        widget.parentWallId = wall.id;

        if (options && typeof options === 'object') {
            const { wall: _w, parentWall: _pw, attach: _att, shouldSync: _ss, ...cleanOptions } = options;
            Object.assign(widget, cleanOptions);
        }

        if (isFloorAnchoredDoor(widget)) {
            widget.elevation = 0;
        }

        if (typeof widget.update === 'function') {
            widget.update();
        }

        if (options.attach !== false) {
            this.attachWidget(wall, widget, !!options.shouldSync, p);
        }

        return widget;
    }

    /**
     * Authoritative widget serializer.
     * Extracts canonical JSON representation.
     * @param {Object} widget
     * @returns {Object|null}
     */
    static serializeWidget(widget) {
        if (!widget) return null;
        if (typeof widget.serialize === 'function') {
            const data = widget.serialize();
            if (widget.id && !data.id) data.id = widget.id;
            if (widget.parentWallId && !data.parentWallId) data.parentWallId = widget.parentWallId;
            if (isFloorAnchoredDoor(widget)) data.elevation = 0;
            return data;
        }
        return {
            id: widget.id,
            t: widget.t,
            type: widget.type || widget.configId,
            configId: widget.configId || widget.type,
            width: widget.width,
            height: widget.height,
            depth: widget.depth,
            elevation: isFloorAnchoredDoor(widget) ? 0 : widget.elevation,
            thick: widget.thick,
            facing: widget.facing,
            side: widget.side,
            profileType: widget.profileType,
            fasciaMat: widget.fasciaMat,
            topArm: widget.topArm,
            bottomArm: widget.bottomArm,
            sunshadeType: widget.sunshadeType,
            pattern: widget.pattern,
            jaliMount: widget.jaliMount,
            doorType: widget.doorType,
            doorShape: widget.doorShape || widget.params?.doorShape,
            doorStyle: widget.doorStyle || widget.params?.doorStyle,
            doorMat: widget.doorMat,
            windowType: widget.windowType,
            windowShape: widget.windowShape || widget.params?.windowShape,
            frameMat: widget.frameMat,
            glassMat: widget.glassMat,
            grillePattern: widget.grillePattern,
            grilleProfile: widget.grilleProfile,
            patternStyle: widget.patternStyle,
            rows: widget.rows,
            cols: widget.cols,
            spacing: widget.spacing,
            decorConfigId: widget.decorConfigId,
            description: widget.description,
            anchorMode: widget.anchorMode || 'bottom',
            parentWallId: widget.parentWallId || widget.wall?.id,
            materials: widget.materials ? JSON.parse(JSON.stringify(widget.materials)) : undefined,
            params: widget.params ? JSON.parse(JSON.stringify(widget.params)) : undefined
        };
    }

    /**
     * Authoritative widget deserializer.
     * Restores widget on the host wall.
     * @param {Object} planner
     * @param {Object} wall
     * @param {Object} widData
     * @returns {Object|null}
     */
    static deserializeWidget(planner, wall, widData) {
        if (!wall || !widData) return null;
        const p = planner || wall.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const configId = widData.type || widData.configId || 'door';
        const t = widData.t !== undefined ? widData.t : 0.5;

        const isAdvancedOpening = ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(configId);
        let widget = null;
        if (isAdvancedOpening && typeof advance_openings !== 'undefined') {
            widget = new advance_openings(p, wall, t, configId);
        } else {
            widget = new PremiumWidget(p, wall, t, configId);
        }

        const { wall: _w, parentWall: _pw, ...cleanData } = widData;
        Object.assign(widget, cleanData);
        widget.wall = wall;
        widget.parentWall = wall;
        widget.parentWallId = wall.id;

        if (isFloorAnchoredDoor(widget)) {
            widget.elevation = 0;
        }

        if (typeof widget.update === 'function') {
            widget.update();
        }

        return widget;
    }

    /**
     * Authoritative widget deleter.
     * Removes from wall, destroys display nodes, and cleans up.
     * @param {Object} planner
     * @param {Object} wall
     * @param {Object|string} widgetOrId
     * @param {boolean} shouldSync
     */
    static deleteWidget(planner, wall, widgetOrId, shouldSync = true) {
        if (!wall) return;
        const p = planner || wall.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const widget = typeof widgetOrId === 'object' ? widgetOrId : (wall.attachedWidgets || []).find(w => w.id === widgetOrId);

        this.removeWidget(wall, widgetOrId, false, p);

        if (widget) {
            if (typeof widget.remove === 'function') {
                widget.remove();
            } else if (typeof widget.destroy === 'function') {
                widget.destroy();
            }
        }

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Attaches a widget to a wall.
     */
    static attachWidget(wall, widget, shouldSync = true, planner = null) {
        if (!wall || !widget) return;
        wall.wallShapeData = null;
        if (isFloorAnchoredDoor(widget)) {
            widget.elevation = 0;
        }
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
        wall.wallShapeData = null;
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
        wall.wallShapeData = null;
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
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const id = typeof moldingOrId === 'string' ? moldingOrId : moldingOrId?.id;
        wall.attachedMoldings = wall.attachedMoldings.filter(m => (id ? m.id !== id : m !== moldingOrId));
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Attaches a decor element (wall art, panel, etc.) to a wall.
     */
    static attachDecor(wall, decor, shouldSync = true, planner = null) {
        if (!wall || !decor) return;
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        if (!wall.attachedDecor) wall.attachedDecor = [];
        if (!wall.attachedDecor.includes(decor)) {
            wall.attachedDecor.push(decor);
            decor.wall = wall;
        }
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Removes an attached decor element.
     */
    static removeDecor(wall, decorOrId, shouldSync = true, planner = null) {
        if (!wall || !wall.attachedDecor) return;
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const id = typeof decorOrId === 'string' ? decorOrId : decorOrId?.id;
        wall.attachedDecor = wall.attachedDecor.filter(d => (id ? d.id !== id : d !== decorOrId));
        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
        }
    }

    /**
     * Adds a solid protrusion feature to a host wall.
     * @param {Object} wall - The host wall entity.
     * @param {Object} options - { width, height, elevation, depth, t, facing, params }
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     * @returns {Object} The created protrusion widget object
     */
    static addSolidProtrusion(wall, options = {}, shouldSync = true, planner = null) {
        if (!wall) return null;
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const {
            id = 'protrusion_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            width = 50,
            height = (wall.height !== undefined ? wall.height : (wall.config?.height || 120)),
            elevation = 0,
            depth = 20,
            t = 0.5,
            facing = 1,
            params = {}
        } = options;

        const protrusionWidget = {
            id,
            type: 'solid_protrusion',
            configId: 'solid_protrusion',
            width: Number(width),
            height: Number(height),
            elevation: Number(elevation),
            depth: Number(depth),
            t: Number(t),
            thick: (wall.thickness !== undefined ? wall.thickness : (wall.config?.thickness || 20)),
            facing: Number(facing),
            wall: wall,
            params: { ...params }
        };

        if (!wall.attachedWidgets) wall.attachedWidgets = [];
        wall.attachedWidgets.push(protrusionWidget);

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }

        return protrusionWidget;
    }

    /**
     * Updates an existing solid protrusion feature in place on its host wall.
     * @param {Object} wall - The host wall entity.
     * @param {Object|string} protrusionOrId - The protrusion widget object or its ID.
     * @param {Object} updates - { width, height, elevation, depth, t, facing, params }
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     * @returns {Object|null} The updated protrusion widget object
     */
    static updateSolidProtrusion(wall, protrusionOrId, updates = {}, shouldSync = true, planner = null) {
        if (!wall || !wall.attachedWidgets) return null;
        wall.wallShapeData = null;
        const p = planner || wall.planner;
        const targetWidget = typeof protrusionOrId === 'string'
            ? wall.attachedWidgets.find(w => w.id === protrusionOrId)
            : protrusionOrId;

        if (!targetWidget) return null;

        if (updates.width !== undefined) targetWidget.width = Number(updates.width);
        if (updates.height !== undefined) targetWidget.height = Number(updates.height);
        if (updates.elevation !== undefined) targetWidget.elevation = Number(updates.elevation);
        if (updates.depth !== undefined) targetWidget.depth = Number(updates.depth);
        if (updates.t !== undefined) targetWidget.t = Number(updates.t);
        if (updates.facing !== undefined) targetWidget.facing = Number(updates.facing);
        if (updates.params) {
            targetWidget.params = { ...(targetWidget.params || {}), ...updates.params };
        }

        if (typeof targetWidget.update === 'function') {
            try { targetWidget.update(); } catch (e) {}
        }

        if (shouldSync && p && typeof p.syncAll === 'function') {
            p.syncAll();
            if (p.update3D) p.update3D();
        }

        return targetWidget;
    }

    /**
     * Removes a solid protrusion feature from a host wall.
     * @param {Object} wall - The host wall entity.
     * @param {Object|string} protrusionOrId - The protrusion widget object or its ID.
     * @param {boolean} shouldSync 
     * @param {Object} planner 
     */
    static removeSolidProtrusion(wall, protrusionOrId, shouldSync = true, planner = null) {
        return this.removeWidget(wall, protrusionOrId, shouldSync, planner);
    }
}
