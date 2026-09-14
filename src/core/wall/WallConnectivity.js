/**
 * WallConnectivity
 * 
 * Centralized authority for querying wall connectivity, room boundaries,
 * and scope resolution (single wall, room scope, building scope).
 */
export const WallConnectivity = {
    /**
     * Resolves the room containing a given wall, if any.
     * @param {Object} wall 
     * @param {Object} planner 
     * @returns {Object|null}
     */
    getRoomForWall(wall, planner) {
        if (!wall || !planner || !Array.isArray(planner.rooms)) return null;

        // 1. Direct room.walls reference
        for (const r of planner.rooms) {
            if (Array.isArray(r.walls) && r.walls.includes(wall)) {
                return r;
            }
        }

        // 2. Geometric matching against room perimeter segments
        const s = typeof wall.startAnchor?.position === 'function' ? wall.startAnchor.position() : (wall.startAnchor || { x: wall.startX, y: wall.startY });
        const e = typeof wall.endAnchor?.position === 'function' ? wall.endAnchor.position() : (wall.endAnchor || { x: wall.endX, y: wall.endY });
        if (!s || !e) return null;

        const wallMidX = (s.x + e.x) / 2;
        const wallMidY = (s.y + e.y) / 2;
        const wallLen = Math.hypot(e.x - s.x, e.y - s.y);

        for (const r of planner.rooms) {
            const path = r.path;
            if (!Array.isArray(path) || path.length < 3) continue;

            for (let i = 0; i < path.length; i++) {
                const p1 = path[i];
                const p2 = path[(i + 1) % path.length];
                const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);
                const segMidX = (p1.x + p2.x) / 2;
                const segMidY = (p1.y + p2.y) / 2;

                if (Math.hypot(wallMidX - segMidX, wallMidY - segMidY) < 15 && Math.abs(wallLen - segLen) < 20) {
                    return r;
                }
            }
        }

        return null;
    },

    /**
     * Retrieves all walls that bound the room containing the target wall.
     * @param {Object} wall 
     * @param {Object} planner 
     * @returns {Array<Object>}
     */
    getConnectedRoomWalls(wall, planner) {
        if (!wall) return [];
        if (!planner || !planner.walls) return [wall];

        const room = this.getRoomForWall(wall, planner);
        if (!room) return [wall];

        const allWalls = planner.walls.filter(w => !w.hidden && w.type !== 'railing' && !w.isDeleted);
        
        // If room has cached walls
        if (Array.isArray(room.walls) && room.walls.length > 0) {
            const valid = room.walls.filter(w => allWalls.includes(w));
            if (valid.length > 0 && valid.includes(wall)) return valid;
        }

        // Geometric search for all walls bounding this room
        const path = room.path;
        if (!Array.isArray(path) || path.length < 3) return [wall];

        const roomWalls = [];
        for (let i = 0; i < path.length; i++) {
            const p1 = path[i];
            const p2 = path[(i + 1) % path.length];
            const segMidX = (p1.x + p2.x) / 2;
            const segMidY = (p1.y + p2.y) / 2;
            const segLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

            let bestWall = null;
            let bestDist = Infinity;

            for (const w of allWalls) {
                const ws = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                const we = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                if (!ws || !we) continue;

                const wMidX = (ws.x + we.x) / 2;
                const wMidY = (ws.y + we.y) / 2;
                const wLen = Math.hypot(we.x - ws.x, we.y - ws.y);

                const d = Math.hypot(wMidX - segMidX, wMidY - segMidY);
                if (d < 25 && Math.abs(wLen - segLen) < 30 && d < bestDist) {
                    bestDist = d;
                    bestWall = w;
                }
            }

            if (bestWall && !roomWalls.includes(bestWall)) {
                roomWalls.push(bestWall);
            }
        }

        return roomWalls.includes(wall) ? roomWalls : [wall];
    },

    /**
     * Resolves target walls for an operation based on scope.
     * @param {Object} wall - Primary wall
     * @param {'wall'|'room'|'building'|'connected'} scope 
     * @param {Object} planner 
     * @returns {Array<Object>}
     */
    getScopeWalls(wall, scope = 'wall', planner) {
        if (!wall) return [];
        const p = planner || wall.planner || window.planner?.value || window.plannerInstance;
        if (!p || !p.walls) return [wall];

        switch (scope) {
            case 'building': {
                const bldgWalls = p.walls.filter(w => !w.hidden && w.type !== 'railing' && !w.isDeleted);
                return bldgWalls.length > 0 ? bldgWalls : [wall];
            }
            case 'room': {
                return this.getConnectedRoomWalls(wall, p);
            }
            case 'connected': {
                // All walls sharing start/end anchors
                const a1 = wall.startAnchor;
                const a2 = wall.endAnchor;
                const connected = p.walls.filter(w => 
                    !w.hidden && w.type !== 'railing' && !w.isDeleted &&
                    (w === wall || (a1 && (w.startAnchor === a1 || w.endAnchor === a1)) || (a2 && (w.startAnchor === a2 || w.endAnchor === a2)))
                );
                return connected.length > 0 ? connected : [wall];
            }
            case 'wall':
            default:
                return [wall];
        }
    }
};
