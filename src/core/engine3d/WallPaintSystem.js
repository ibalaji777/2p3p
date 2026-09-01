/**
 * WallPaintSystem
 * 
 * Provides Sims 4-style 3D Material & Paint Tooling:
 * 1. Single Face Mode: Paints only the clicked wall face (front or back).
 * 2. Room Loop Mode (Shift+Click / Toggle): Automatically detects the room polygon loop
 *    adjacent to the clicked wall face and paints all interior-facing wall surfaces in that room.
 * 3. Exterior Loop Mode (Alt+Click / Toggle): Detects the entire building perimeter and paints
 *    only exterior facade surfaces of outer walls.
 */

export function resolvePlanner(planner, renderer3D) {
    if (planner && planner.value && planner.value.walls) return planner.value;
    if (planner && planner.walls) return planner;
    if (renderer3D && renderer3D.planner) return renderer3D.planner;
    if (renderer3D && renderer3D.ctx && renderer3D.ctx.planner) return renderer3D.ctx.planner;
    if (typeof window !== 'undefined' && window.plannerInstance) return window.plannerInstance;
    return null;
}

export function isPointInPolygon(pt, poly) {
    if (!poly || poly.length < 3) return false;
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i].x, yi = poly[i].y;
        const xj = poly[j].x, yj = poly[j].y;
        const intersect = ((yi > pt.y) !== (yj > pt.y)) &&
            (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

export function getPolygonArea(path) {
    if (!path || path.length < 3) return 0;
    let sum = 0;
    for (let i = 0; i < path.length; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % path.length];
        sum += (p2.x - p1.x) * (p2.y + p1.y);
    }
    return Math.abs(sum) / 2;
}

export function getDistancePointToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Math.hypot(px - projX, py - projY);
}

export function getDistancePointToPolygon(px, py, path) {
    if (!path || path.length < 2) return Infinity;
    let minDist = Infinity;
    for (let i = 0; i < path.length; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % path.length];
        const d = getDistancePointToSegment(px, py, p1.x, p1.y, p2.x, p2.y);
        if (d < minDist) minDist = d;
    }
    return minDist;
}

export function getWallEndpoints(wall) {
    if (!wall) return null;
    let p1 = null;
    let p2 = null;

    if (wall.startAnchor && wall.endAnchor) {
        p1 = typeof wall.startAnchor.position === 'function' ? wall.startAnchor.position() : { x: wall.startAnchor.x, y: wall.startAnchor.y };
        p2 = typeof wall.endAnchor.position === 'function' ? wall.endAnchor.position() : { x: wall.endAnchor.x, y: wall.endAnchor.y };
    } else if (wall.startX !== undefined && wall.endX !== undefined) {
        p1 = { x: wall.startX, y: wall.startY };
        p2 = { x: wall.endX, y: wall.endY };
    } else if (wall.p1 && wall.p2) {
        p1 = { x: wall.p1.x, y: wall.p1.y };
        p2 = { x: wall.p2.x, y: wall.p2.y };
    }

    if (!p1 || !p2 || isNaN(p1.x) || isNaN(p2.x)) return null;
    return { p1, p2 };
}

export function getRoomsList(plannerInstance, renderer3D) {
    let rooms = [];
    if (plannerInstance) {
        if (Array.isArray(plannerInstance.rooms) && plannerInstance.rooms.length > 0) {
            rooms = plannerInstance.rooms;
        } else if (typeof plannerInstance.detectRooms === 'function') {
            plannerInstance.detectRooms();
            rooms = plannerInstance.rooms || [];
        }
    }
    if (rooms.length === 0 && renderer3D && Array.isArray(renderer3D.rooms) && renderer3D.rooms.length > 0) {
        rooms = renderer3D.rooms;
    }
    return rooms.filter(r => r && !r.isDeleted && !r.isHidden && Array.isArray(r.path) && r.path.length >= 3);
}

export function getAllWallsList(plannerInstance, renderer3D) {
    if (plannerInstance && Array.isArray(plannerInstance.walls) && plannerInstance.walls.length > 0) {
        return plannerInstance.walls;
    }
    if (renderer3D && Array.isArray(renderer3D.walls) && renderer3D.walls.length > 0) {
        return renderer3D.walls;
    }
    return [];
}

/**
 * Finds which room in planner.rooms contains the interior space adjacent to this wall face.
 */
export function getRoomForWallFace(wall, side, plannerInstance, renderer3D) {
    const planner = resolvePlanner(plannerInstance, renderer3D);
    const rooms = getRoomsList(planner, renderer3D);
    if (rooms.length === 0) return null;

    const pts = getWallEndpoints(wall);
    if (!pts) return null;
    const { p1, p2 } = pts;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 1) return null;

    const nx = -dy / len;
    const ny = dx / len;
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const dirSign = side === 'back' ? -1 : 1;

    // Test multiple sample depths into the room (15, 30, 50 units)
    const testDistances = [15, 30, 50, 80];
    const candidateRooms = [];

    for (const dist of testDistances) {
        const samplePoint = {
            x: midX + nx * dirSign * dist,
            y: midY + ny * dirSign * dist
        };
        for (const r of rooms) {
            if (isPointInPolygon(samplePoint, r.path)) {
                if (!candidateRooms.includes(r)) candidateRooms.push(r);
            }
        }
    }

    // Fallback: If no match on dirSign side, test opposite side if wall is an inner partition
    if (candidateRooms.length === 0) {
        for (const dist of testDistances) {
            const oppSample = {
                x: midX - nx * dirSign * dist,
                y: midY - ny * dirSign * dist
            };
            for (const r of rooms) {
                if (isPointInPolygon(oppSample, r.path)) {
                    if (!candidateRooms.includes(r)) candidateRooms.push(r);
                }
            }
        }
    }

    if (candidateRooms.length === 0) return null;

    // Pick the most specific (smallest area) room
    candidateRooms.sort((a, b) => getPolygonArea(a.path) - getPolygonArea(b.path));
    return candidateRooms[0];
}

/**
 * Returns all walls and their interior face side ('front' or 'back') that face INTO a specific room.
 */
export function getRoomWallsAndSides(room, plannerInstance, renderer3D) {
    if (!room || !room.path) return [];
    const planner = resolvePlanner(plannerInstance, renderer3D);
    const walls = getAllWallsList(planner, renderer3D);
    const results = [];

    walls.forEach(w => {
        if (w.hidden || w.type === 'railing') return;
        const pts = getWallEndpoints(w);
        if (!pts) return;
        const { p1, p2 } = pts;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const nx = -dy / len;
        const ny = dx / len;

        // Check if wall is within tolerance of room border
        const distToRoom = getDistancePointToPolygon(midX, midY, room.path);
        if (distToRoom > 45) return;

        // Determine which face points INTO the room
        let insideSide = null;
        for (const dist of [15, 30, 50]) {
            const testFront = { x: midX + nx * dist, y: midY + ny * dist };
            const testBack = { x: midX - nx * dist, y: midY - ny * dist };

            if (isPointInPolygon(testFront, room.path)) {
                insideSide = 'front';
                break;
            } else if (isPointInPolygon(testBack, room.path)) {
                insideSide = 'back';
                break;
            }
        }

        if (insideSide) {
            results.push({ wall: w, side: insideSide });
        }
    });

    return results;
}

/**
 * Returns ONLY genuine exterior walls and their exterior-facing side ('front' or 'back').
 */
export function getExteriorWallsAndSides(plannerInstance, renderer3D) {
    const planner = resolvePlanner(plannerInstance, renderer3D);
    const walls = getAllWallsList(planner, renderer3D);
    const rooms = getRoomsList(planner, renderer3D);
    const results = [];

    walls.forEach(w => {
        if (w.hidden || w.type === 'railing' || w.type === 'inner') return;
        const pts = getWallEndpoints(w);
        if (!pts) return;
        const { p1, p2 } = pts;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.hypot(dx, dy);
        if (len < 1) return;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        const nx = -dy / len;
        const ny = dx / len;

        if (rooms.length > 0) {
            let frontInAnyRoom = false;
            let backInAnyRoom = false;

            for (const dist of [15, 30, 50]) {
                const testFront = { x: midX + nx * dist, y: midY + ny * dist };
                const testBack = { x: midX - nx * dist, y: midY - ny * dist };

                if (rooms.some(r => isPointInPolygon(testFront, r.path))) frontInAnyRoom = true;
                if (rooms.some(r => isPointInPolygon(testBack, r.path))) backInAnyRoom = true;
            }

            // If both sides are inside rooms, this is an interior wall
            if (frontInAnyRoom && backInAnyRoom) return;

            if (!frontInAnyRoom) results.push({ wall: w, side: 'front' });
            if (!backInAnyRoom) results.push({ wall: w, side: 'back' });
        } else {
            // No rooms formed yet: default to 'back' (outer face)
            results.push({ wall: w, side: 'back' });
        }
    });

    return results;
}

/**
 * High-Level Paint Application Handler Supporting:
 * - 'single': Single clicked face
 * - 'room': All interior faces of the room (Shift-Click)
 * - 'exterior': All exterior facade faces of the building (Alt-Click)
 */
export function applyWallPaintWithScope({ wall, side, configId, scope = 'single', planner, renderer3D }) {
    if (!wall || !configId || !renderer3D) return [];

    const appliedDecors = [];
    const actualPlanner = resolvePlanner(planner, renderer3D);

    if (scope === 'room') {
        const room = getRoomForWallFace(wall, side, actualPlanner, renderer3D);
        if (room) {
            const targets = getRoomWallsAndSides(room, actualPlanner, renderer3D);
            targets.forEach(t => {
                const decor = renderer3D.addWallPattern(t.wall, configId, t.side);
                t.wall.params = t.wall.params || {};
                t.wall.params[t.side === 'back' ? 'textureBack' : 'textureFront'] = configId;
                if (typeof renderer3D.updateMaterialLive === 'function') {
                    renderer3D.updateMaterialLive(t.wall);
                }
                if (decor) appliedDecors.push({ wall: t.wall, decor });
            });
            if (typeof renderer3D.requestRender === 'function') renderer3D.requestRender();
            return appliedDecors;
        }
    } else if (scope === 'exterior') {
        const targets = getExteriorWallsAndSides(actualPlanner, renderer3D);
        targets.forEach(t => {
            const decor = renderer3D.addWallPattern(t.wall, configId, t.side);
            t.wall.params = t.wall.params || {};
            t.wall.params[t.side === 'back' ? 'textureBack' : 'textureFront'] = configId;
            if (typeof renderer3D.updateMaterialLive === 'function') {
                renderer3D.updateMaterialLive(t.wall);
            }
            if (decor) appliedDecors.push({ wall: t.wall, decor });
        });
        if (typeof renderer3D.requestRender === 'function') renderer3D.requestRender();
        return appliedDecors;
    }

    // Fallback: Single Face Mode
    if (side === 'left' || side === 'right') {
        wall.params = wall.params || {};
        const paramKey = side === 'left' ? 'textureLeft' : 'textureRight';
        wall.params[paramKey] = configId;
        if (typeof renderer3D.updateMaterialLive === 'function') {
            renderer3D.updateMaterialLive(wall);
        }

        // Sync to connected walls at this corner
        const anchor = side === 'left' ? wall.startAnchor : wall.endAnchor;
        const pt = side === 'left' 
            ? { x: wall.startX ?? wall.p1?.x, y: wall.startY ?? wall.p1?.y } 
            : { x: wall.endX ?? wall.p2?.x, y: wall.endY ?? wall.p2?.y };
        const allWalls = actualPlanner?.walls || [];
        allWalls.forEach(cw => {
            if (!cw || cw === wall || cw.type === 'roof' || cw.type === 'furniture' || cw.type === 'room') return;
            let isCwStart = false;
            let isCwEnd = false;
            if (anchor && (cw.startAnchor === anchor || cw.endAnchor === anchor)) {
                isCwStart = cw.startAnchor === anchor;
                isCwEnd = cw.endAnchor === anchor;
            } else if (pt.x !== undefined && pt.y !== undefined) {
                const cwP1 = { x: cw.startX ?? cw.p1?.x, y: cw.startY ?? cw.p1?.y };
                const cwP2 = { x: cw.endX ?? cw.p2?.x, y: cw.endY ?? cw.p2?.y };
                if (cwP1.x !== undefined && Math.hypot(cwP1.x - pt.x, cwP1.y - pt.y) < 5) isCwStart = true;
                else if (cwP2.x !== undefined && Math.hypot(cwP2.x - pt.x, cwP2.y - pt.y) < 5) isCwEnd = true;
            }
            if (isCwStart) {
                cw.params = cw.params || {};
                cw.params.textureLeft = configId;
                if (typeof renderer3D.updateMaterialLive === 'function') renderer3D.updateMaterialLive(cw);
            }
            if (isCwEnd) {
                cw.params = cw.params || {};
                cw.params.textureRight = configId;
                if (typeof renderer3D.updateMaterialLive === 'function') renderer3D.updateMaterialLive(cw);
            }
        });

        if (typeof renderer3D.requestRender === 'function') renderer3D.requestRender();
        return [{ wall }];
    }

    const decor = renderer3D.addWallPattern(wall, configId, side || 'front');
    wall.params = wall.params || {};
    const paramKey = (side === 'back') ? 'textureBack' : 'textureFront';
    wall.params[paramKey] = configId;
    if (typeof renderer3D.updateMaterialLive === 'function') {
        renderer3D.updateMaterialLive(wall);
    }
    if (typeof renderer3D.requestRender === 'function') renderer3D.requestRender();
    if (decor) appliedDecors.push({ wall, decor });
    return appliedDecors;
}
