/**
 * src/core/vertical/VerticalPropagationEngine.js
 * 
 * Centralized Authority for Vertical Dependencies and Wall-Rise Propagation.
 * 
 * Manages parametric vertical relationships across the entire building:
 * - Wall -> Level elevation propagation
 * - Level -> Upper-level propagation
 * - Wall -> dependent wall propagation (stacked walls)
 * - Wall -> roof propagation (upward & downward)
 * - Wall -> window/door/aperture propagation
 * - Wall -> molding/trim/fascia dynamic top-anchoring
 * - Floor/platform -> furniture propagation
 * - Platform -> stairs propagation
 * - Host object -> child object propagation
 * - 2D <-> 3D synchronization
 */

import { computeLevelElevations } from '../engine3d/helpers/levelElevations.js';
import { RoofMutationEngine } from '../roof/RoofMutationEngine.js';
import { StairHeightDetector } from '../../features/stairs/StairHeightDetector.js';

export class VerticalPropagationEngine {
    /**
     * Called whenever a wall's height changes.
     * @param {Object} wall - The modified wall entity
     * @param {number} newHeight - The new wall height
     * @param {number} prevHeight - The previous wall height
     * @param {Object} planner - The canonical planner instance
     */
    static onWallHeightChanged(wall, newHeight, prevHeight, planner = null) {
        if (!wall) return;
        wall.height = newHeight;
        const p = planner || wall.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const deltaH = Number(newHeight) - Number(prevHeight);
        if (Math.abs(deltaH) < 0.001) return;

        // 1. Moldings Top/Bottom Re-anchoring
        this.syncWallMoldings(wall, newHeight, deltaH);

        // 2. Openings / Aperture Voids (Windows, Doors, Jali)
        this.syncWallOpenings(wall, newHeight, deltaH);

        // 3. Wall-Surface Attachments (Sunshades, Curtains, Wall Art)
        this.syncWallSurfaceElements(wall, newHeight, deltaH);

        // 4. Attached Roofs Tracking Wall Top
        if (!wall.isAutoGable && !wall.parentRoofId && p && p.roofs && p.roofs.length > 0) {
            RoofMutationEngine.syncRoofsWithWalls([wall], p);
        }

        // 5. Attached Facade Beams / Elevation Segments
        this.syncWallElevationSegments(wall, deltaH, 0, p);

        // 6. Level Height Synchronization (Wall -> Level)
        this.syncLevelHeightFromWalls(wall, p, deltaH);

        // 7. Dependent Upper-Level Walls (Chained Wall -> Wall)
        this.propagateToUpperLevels(wall, deltaH, p);
    }

    /**
     * Called whenever a wall's base elevation changes.
     * @param {Object} wall - The modified wall entity
     * @param {number} newElevation - The new base elevation
     * @param {number} prevElevation - The previous base elevation
     * @param {Object} planner - The canonical planner instance
     */
    static onWallElevationChanged(wall, newElevation, prevElevation, planner = null) {
        if (!wall) return;
        wall.elevation = newElevation;
        const p = planner || wall.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const deltaElev = newElevation - prevElevation;
        if (deltaElev === 0) return;

        // 1. Update 3D Mesh Position Y if present
        if (wall.mesh3D) {
            wall.mesh3D.position.y = newElevation;
        }

        // 2. Attached Roofs Synchronization
        if (!wall.isAutoGable && !wall.parentRoofId && p && p.roofs && p.roofs.length > 0) {
            RoofMutationEngine.syncRoofsWithWalls([wall], p);
        }

        // 3. Attached Facade Beams / Elevation Segments
        this.syncWallElevationSegments(wall, 0, deltaElev, p);

        // 4. Dependent Upper-Level Walls
        this.propagateToUpperLevels(wall, deltaElev, p);
    }

    /**
     * Batch updates multiple walls atomically.
     * @param {Object} planner - The canonical planner instance
     * @param {Array<Object>} walls - The modified walls
     * @param {Object} updates - The applied updates (height, elevation, etc.)
     */
    static onBatchWallsUpdated(planner, walls, updates) {
        if (!walls || walls.length === 0 || !updates) return;
        const p = planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);

        if (updates.height !== undefined) {
            walls.forEach(w => {
                this.syncWallMoldings(w, updates.height, 0);
                this.syncWallOpenings(w, updates.height, 0);
                this.syncWallSurfaceElements(w, updates.height, 0);
            });

            const nonGableWalls = walls.filter(w => !w.isAutoGable && !w.parentRoofId);
            if (p && p.roofs && p.roofs.length > 0 && nonGableWalls.length > 0) {
                RoofMutationEngine.syncRoofsWithWalls(nonGableWalls, p);
            }

            if (walls.length > 0) {
                this.syncLevelHeightFromWalls(walls[0], p, 0);
                this.propagateToUpperLevels(walls[0], updates.height, p);
            }
        }

        if (updates.elevation !== undefined) {
            walls.forEach(w => {
                if (w.mesh3D) w.mesh3D.position.y = updates.elevation;
            });

            const nonGableWalls = walls.filter(w => !w.isAutoGable && !w.parentRoofId);
            if (p && p.roofs && p.roofs.length > 0 && nonGableWalls.length > 0) {
                RoofMutationEngine.syncRoofsWithWalls(nonGableWalls, p);
            }

            if (walls.length > 0) {
                this.propagateToUpperLevels(walls[0], updates.elevation, p);
            }
        }
    }

    /**
     * Called whenever a level's height or elevation changes.
     * @param {Object} level - The modified level configuration object
     * @param {number} newHeight - The new level height
     * @param {number} prevHeight - The previous level height
     * @param {Object} planner - The canonical planner instance
     */
    static onLevelHeightChanged(level, newHeight, prevHeight, planner = null) {
        if (!level) return;
        const p = planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const deltaH = newHeight - prevHeight;

        // 1. Recompute all level elevations
        const levels = p?.levels || [];
        if (levels.length > 0) {
            computeLevelElevations(levels);
        }

        // 2. Synchronize 3D scene active and static structures
        this.sync3DLevelElevations(p, levels);

        // 3. Synchronize Spanning Stairs
        this.syncStairsWithLevels(p, levels);
    }

    /**
     * Called whenever a platform's height or elevation changes.
     * @param {Object} platform - The modified platform entity
     * @param {number} newHeight - The new platform height
     * @param {number} prevHeight - The previous platform height
     * @param {Object} planner - The canonical planner instance
     */
    static onPlatformHeightChanged(platform, newHeight, prevHeight, planner = null) {
        if (!platform) return;
        const p = planner || platform.planner || (typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null);
        const deltaH = newHeight - prevHeight;
        const pElev = Number(platform.elevation) || 0;
        const pTop = pElev + newHeight;

        // 1. Propagate to Furniture resting on this platform
        if (p && p.furniture && Array.isArray(p.furniture)) {
            p.furniture.forEach(f => {
                const isHosted = f.hostPlatformId === platform.id || this.isPointInPlatform(f.x, f.y, platform);
                if (isHosted) {
                    f.hostPlatformId = platform.id;
                    const relElev = f.relativeElevation !== undefined ? Number(f.relativeElevation) : 0;
                    f.elevation = pTop + relElev;
                    if (f.mesh3D) {
                        f.mesh3D.position.y = f.elevation;
                    }
                }
            });
        }

        // 2. Propagate to Stairs connected to this platform
        if (p && p.stairs && Array.isArray(p.stairs)) {
            p.stairs.forEach(s => {
                if (s.hostPlatformId === platform.id || s.targetPlatformId === platform.id) {
                    this.recalculateStairForPlatform(s, platform, pTop);
                }
            });
        }
    }

    /**
     * Dynamic top-anchoring for moldings:
     * Crown moldings, exterior friezes, and top-attached trims derive:
     * heightOffset = Math.max(0, wallHeight - moldingHeight)
     */
    static syncWallMoldings(wall, newHeight, deltaH) {
        if (!wall.attachedMoldings || !Array.isArray(wall.attachedMoldings)) return;

        wall.attachedMoldings.forEach(m => {
            const isCrown = m.anchorMode === 'top' || 
                            m.type === 'molding_crown' || 
                            m.profileType === 'crown' || 
                            m.type === 'molding_frieze_exterior' ||
                            m.profileType === 'frieze_exterior';

            if (isCrown) {
                m.anchorMode = 'top';
                const mH = m.moldingHeight || m.height || 10;
                m.heightOffset = Math.max(0, newHeight - mH);

                if (m.mesh3D && m.mesh3D.userData?.builder) {
                    try {
                        m.mesh3D.userData.builder.updateMoldingGeometry(m);
                    } catch (e) {}
                }
            }
        });
    }

    /**
     * Aperture void clamping for windows, doors, and niches:
     * Ensures windows and openings do not protrude outside wall boundaries when height shrinks.
     */
    static syncWallOpenings(wall, newHeight, deltaH) {
        if (!wall.attachedWidgets || !Array.isArray(wall.attachedWidgets)) return;

        wall.attachedWidgets.forEach(widg => {
            const isTopAnchored = widg.anchorMode === 'top' || widg.type === 'elevation_fascia' || widg.configId === 'elevation_fascia';
            const wH = widg.height !== undefined ? Number(widg.height) : 60;

            if (isTopAnchored) {
                widg.anchorMode = 'top';
                widg.elevation = Math.max(0, newHeight - wH);
            } else {
                const wElev = widg.elevation !== undefined ? Number(widg.elevation) : 0;
                if (wElev + wH > newHeight) {
                    widg.elevation = Math.max(0, newHeight - wH);
                }
            }
        });
    }

    /**
     * Synchronizes attached surface elements (sunshades, curtains, wall art):
     * Maintains lintel / window alignment or ceiling anchoring.
     */
    static syncWallSurfaceElements(wall, newHeight, deltaH) {
        if (!wall.attachedWidgets || !Array.isArray(wall.attachedWidgets)) return;

        wall.attachedWidgets.forEach(widg => {
            const type = widg.type || widg.configId || '';
            const isSunshade = type === 'sunshade' || type.startsWith('sunshade_') || type === 'chajja';
            const isCurtain = type === 'curtain' || type.startsWith('curtain_');

            if (isSunshade && widg.hostWindowId) {
                const hostWin = wall.attachedWidgets.find(w => w.id === widg.hostWindowId);
                if (hostWin) {
                    const winElev = hostWin.elevation !== undefined ? Number(hostWin.elevation) : 0;
                    const winH = hostWin.height !== undefined ? Number(hostWin.height) : 60;
                    widg.elevation = winElev + winH;
                }
            } else if (isCurtain && widg.hostWindowId) {
                const hostWin = wall.attachedWidgets.find(w => w.id === widg.hostWindowId);
                if (hostWin) {
                    const winElev = hostWin.elevation !== undefined ? Number(hostWin.elevation) : 0;
                    const winH = hostWin.height !== undefined ? Number(hostWin.height) : 60;
                    const itemH = widg.height !== undefined ? Number(widg.height) : 95;
                    widg.elevation = Math.max(0, winElev + winH - itemH + 10);
                }
            }
        });
    }

    /**
     * Synchronizes attached facade beams and elevation segments.
     */
    static syncWallElevationSegments(wall, deltaH, deltaElev, planner) {
        if (!planner || !planner.elevationSegments || !Array.isArray(planner.elevationSegments)) return;

        planner.elevationSegments.filter(seg => seg.wallId === wall.id).forEach(seg => {
            if (seg.points) {
                seg.points.forEach(pt => {
                    if (seg.anchorMode === 'top' && deltaH !== 0) pt.y += deltaH;
                    if (deltaElev !== 0) pt.y += deltaElev;
                });
            }
            if (seg.nodes) {
                seg.nodes.forEach(n => {
                    if (seg.anchorMode === 'top' && deltaH !== 0) n.y += deltaH;
                    if (deltaElev !== 0) n.y += deltaElev;
                });
            }
        });
    }

    /**
     * Synchronizes the host level's height from authoritative wall heights.
     */
    static syncLevelHeightFromWalls(wall, planner, deltaH) {
        if (!planner) return;
        const levels = planner.levels || [];
        const activeIdx = planner.activeLevelIndex !== undefined ? planner.activeLevelIndex : 0;
        const activeLvl = levels[activeIdx] || planner.activeLevel;
        if (!activeLvl) return;

        const mainWalls = (planner.walls || []).filter(w => !w.hidden && w.type !== 'railing');
        if (mainWalls.length === 0) return;

        const maxWallH = Math.max(...mainWalls.map(w => Number(w.height) || 0));
        if (maxWallH > 0 && activeLvl.height !== maxWallH) {
            const prevLvlH = Number(activeLvl.height) || 120;
            activeLvl.height = maxWallH;
            this.onLevelHeightChanged(activeLvl, maxWallH, prevLvlH, planner);
        }
    }

    /**
     * Propagates height and elevation changes to dependent upper-level walls and structures.
     */
    static propagateToUpperLevels(sourceWall, deltaH, planner) {
        if (!planner) return;

        // 1. Update any in-memory walls dependent on sourceWall
        const walls = planner.walls || [];
        const levels = planner.levels || [];
        const activeIdx = planner.activeLevelIndex !== undefined ? planner.activeLevelIndex : 0;
        const activeLvl = levels[activeIdx] || planner.activeLevel;
        const activeLvlElev = (activeLvl && activeLvl.elevation !== undefined) ? Number(activeLvl.elevation) : 0;

        for (const w of walls) {
            if (w.parentWallId === sourceWall.id) {
                let sourceLvlElev = 0;
                if (sourceWall.hostLevelId && levels.length > 0) {
                    const sLvl = levels.find(l => l.id === sourceWall.hostLevelId);
                    if (sLvl && sLvl.elevation !== undefined) {
                        sourceLvlElev = Number(sLvl.elevation);
                    }
                }
                const sourceWorldTop = sourceLvlElev + (Number(sourceWall.elevation) || 0) + (Number(sourceWall.height) || 0);
                const isCrossLevel = (w.hostLevelId && sourceWall.hostLevelId && w.hostLevelId !== sourceWall.hostLevelId) || (activeLvlElev > 0);

                if (isCrossLevel && sourceWorldTop >= activeLvlElev) {
                    w.elevation = Math.max(0, sourceWorldTop - activeLvlElev) + (Number(w.relativeElevation) || 0);
                } else {
                    w.elevation = (Number(sourceWall.elevation) || 0) + (Number(sourceWall.height) || 0) + (Number(w.relativeElevation) || 0);
                }

                if (w.mesh3D) w.mesh3D.position.y = w.elevation;
            }
        }

        if (!planner.levels || planner.levels.length <= 1) return;

        // Check for upper levels (index > activeIdx)
        for (let i = activeIdx + 1; i < levels.length; i++) {
            const upperLvl = levels[i];
            if (!upperLvl || !upperLvl.data) continue;

            try {
                const data = typeof upperLvl.data === 'string' ? JSON.parse(upperLvl.data) : upperLvl.data;
                let modified = false;

                if (data.walls && Array.isArray(data.walls)) {
                    data.walls.forEach(uw => {
                        if (uw.parentWallId === sourceWall.id) {
                            // Upper wall rests directly on source wall
                            if (uw.relativeElevation === undefined) uw.relativeElevation = 0;
                            // World elevation updates automatically with level elevation
                            modified = true;
                        }
                    });
                }

                if (modified) {
                    upperLvl.data = typeof upperLvl.data === 'string' ? JSON.stringify(data) : data;
                }
            } catch (e) {}
        }
    }

    /**
     * Synchronizes 3D scene group positions for active and static levels.
     */
    static sync3DLevelElevations(planner, levels, ctx3d = null) {
        if (!planner) return;
        const c3d = ctx3d || planner.engine3d || (typeof window !== 'undefined' ? (window.engine3d || window.renderer3D?.value || window.preview3D) : null);
        if (!c3d) return;

        const levelElevations = computeLevelElevations(levels);
        const activeIdx = planner.activeLevelIndex !== undefined ? planner.activeLevelIndex : 0;

        // 1. Update Active Structure Group position
        const targetY = levelElevations[activeIdx] !== undefined ? levelElevations[activeIdx] : 0;
        if (c3d.structureGroup) {
            c3d.structureGroup.position.y = targetY;
        }

        // 2. Update Ground Elevation if sub-structure levels exist or active level is underground
        const activeLevel = levels[activeIdx] || planner.activeLevel;
        const minElev = Math.min(0, ...levelElevations);
        if (c3d.envBuilder && typeof c3d.envBuilder.updateGroundElevation === 'function') {
            c3d.envBuilder.updateGroundElevation(targetY, minElev, activeLevel);
        }

        // 3. Update Static Floor Groups deterministically via userData.levelIndex
        if (c3d.staticStructureGroup && c3d.staticStructureGroup.children) {
            c3d.staticStructureGroup.children.forEach((floorGroup, idx) => {
                const levelIdx = floorGroup.userData?.levelIndex !== undefined 
                    ? floorGroup.userData.levelIndex 
                    : (idx >= activeIdx ? idx + 1 : idx);
                if (levelElevations[levelIdx] !== undefined) {
                    floorGroup.position.y = levelElevations[levelIdx];
                }
            });
        }

        if (c3d.requestRender) {
            c3d.requestRender('level_elevation_propagated');
        }
    }

    /**
     * Synchronizes spanning stairs between levels when story heights change.
     */
    static syncStairsWithLevels(planner, levels) {
        if (!planner || !planner.stairs || planner.stairs.length === 0) return;
        const activeIdx = planner.activeLevelIndex !== undefined ? planner.activeLevelIndex : 0;
        const levelElevations = computeLevelElevations(levels);

        planner.stairs.forEach(stair => {
            // Check if stair connects to upper floor
            if (levels.length > activeIdx + 1) {
                const curElev = levelElevations[activeIdx] || 0;
                const nextElev = levelElevations[activeIdx + 1] || (curElev + 300);
                const targetHeight = nextElev - curElev;

                if (targetHeight > 10 && Math.abs(stair.height - targetHeight) > 1) {
                    stair.height = targetHeight;
                    const optimal = StairHeightDetector.calculateOptimalSteps(targetHeight, stair.shape);
                    if (optimal) {
                        stair.totalSteps = optimal.totalSteps;
                        stair.stepHeight = optimal.riserHeight;
                    }
                }
            }
        });
    }

    /**
     * Recalculates a stair's height when its host platform changes.
     */
    static recalculateStairForPlatform(stair, platform, platformTop) {
        const stairBase = Number(stair.elevation) || 0;
        const targetH = Math.abs(platformTop - stairBase);
        if (targetH > 4) {
            stair.height = targetH;
            const optimal = StairHeightDetector.calculateOptimalSteps(targetH, stair.shape);
            if (optimal) {
                stair.totalSteps = optimal.totalSteps;
                stair.stepHeight = optimal.riserHeight;
            }
        }
    }

    /**
     * Helper to test if a 2D point (x, y) is inside a platform footprint.
     */
    static isPointInPlatform(x, y, platform) {
        if (!platform) return false;
        if (platform.shapeType === 'rect') {
            const px = platform.x || 0;
            const py = platform.y || 0;
            const hw = (platform.width || 120) / 2;
            const hd = (platform.depth || 120) / 2;
            return x >= px - hw && x <= px + hw && y >= py - hd && y <= py + hd;
        } else if (Array.isArray(platform.points) && platform.points.length >= 3) {
            const px = platform.x || 0;
            const py = platform.y || 0;
            let inside = false;
            const pts = platform.points.map(p => ({ x: px + p.x, y: py + p.y }));
            for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
                const xi = pts[i].x, yi = pts[i].y;
                const xj = pts[j].x, yj = pts[j].y;
                const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }
            return inside;
        }
        return false;
    }

    /**
     * Calculates the authoritative world elevation for any entity based on its host dependency.
     */
    static getEffectiveElevation(entity, planner) {
        if (!entity) return 0;
        let baseElev = 0;

        // Level Host
        if (entity.hostLevelId && planner && planner.levels) {
            const lvl = planner.levels.find(l => l.id === entity.hostLevelId);
            if (lvl && lvl.elevation !== undefined) baseElev = Number(lvl.elevation);
        }

        // Wall Host (widgets, moldings, decor, etc. attached to a wall)
        if (entity.wall) {
            baseElev = (Number(entity.wall.elevation) || 0);
        } else if (entity.wallId && planner && planner.walls) {
            const hostW = planner.walls.find(w => w.id === entity.wallId);
            if (hostW) {
                baseElev = (Number(hostW.elevation) || 0);
            }
        }

        // Platform Host
        if (entity.hostPlatformId && planner && planner.platforms) {
            const plt = planner.platforms.find(p => p.id === entity.hostPlatformId);
            if (plt) {
                baseElev = (Number(plt.elevation) || 0) + (Number(plt.height) || 0);
            }
        }

        // Furniture Host (Stacked furniture)
        if (entity.hostFurnitureId && planner && planner.furniture) {
            const hostF = planner.furniture.find(f => f.id === entity.hostFurnitureId);
            if (hostF) {
                baseElev = (Number(hostF.elevation) || 0) + (Number(hostF.height) || 0);
            }
        }

        // Parent Wall Host
        if (entity.parentWallId && planner && planner.walls) {
            const parentW = planner.walls.find(w => w.id === entity.parentWallId);
            if (parentW) {
                baseElev = (Number(parentW.elevation) || 0) + (Number(parentW.height) || 0);
            }
        }

        const relElev = entity.relativeElevation !== undefined ? Number(entity.relativeElevation) : (Number(entity.elevation) || 0);
        return baseElev + relElev;
    }
}
