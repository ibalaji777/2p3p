import * as THREE from 'three';

/**
 * Common procedural geometry helper routines for specialized roof generators.
 */

export function thickenGeometry(v, uv, T) {
    const vNew = [...v];
    const uvNew = [...uv];
    
    // Bottom surface
    for (let i = 0; i < v.length; i += 9) {
        const p0x = v[i], p0y = v[i+1], p0z = v[i+2];
        const p1x = v[i+3], p1y = v[i+4], p1z = v[i+5];
        const p2x = v[i+6], p2y = v[i+7], p2z = v[i+8];
        
        vNew.push(
            p0x, p0y - T, p0z,
            p2x, p2y - T, p2z,
            p1x, p1y - T, p1z
        );
        
        uvNew.push(
            uv[i/3 * 2], uv[i/3 * 2 + 1],
            uv[(i+6)/3 * 2], uv[(i+6)/3 * 2 + 1],
            uv[(i+3)/3 * 2], uv[(i+3)/3 * 2 + 1]
        );
    }
    
    // Fascia Side Walls
    const edges = new Map();
    for (let i = 0; i < v.length; i += 9) {
        const tri = [
            {x: v[i], y: v[i+1], z: v[i+2]},
            {x: v[i+3], y: v[i+4], z: v[i+5]},
            {x: v[i+6], y: v[i+7], z: v[i+8]}
        ];
        for (let j = 0; j < 3; j++) {
            const p1 = tri[j];
            const p2 = tri[(j + 1) % 3];
            const k1 = `${p1.x.toFixed(2)},${p1.y.toFixed(2)},${p1.z.toFixed(2)}`;
            const k2 = `${p2.x.toFixed(2)},${p2.y.toFixed(2)},${p2.z.toFixed(2)}`;
            const key = k1 < k2 ? `${k1}_${k2}` : `${k2}_${k1}`;
            
            if (edges.has(key)) {
                edges.delete(key);
            } else {
                edges.set(key, {p1, p2, k1, k2});
            }
        }
    }
    
    edges.forEach(({p1, p2, k1, k2}) => {
        const p1d = {x: p1.x, y: p1.y - T, z: p1.z};
        const p2d = {x: p2.x, y: p2.y - T, z: p2.z};
        
        const dist = Math.hypot(p2.x - p1.x, p2.z - p1.z) / 100;
        const tUv = T / 100;
        
        vNew.push(
            p1.x, p1.y, p1.z,
            p1d.x, p1d.y, p1d.z,
            p2.x, p2.y, p2.z,
            
            p1d.x, p1d.y, p1d.z,
            p2d.x, p2d.y, p2d.z,
            p2.x, p2.y, p2.z
        );
        
        uvNew.push(
            0, 0,      // p1
            0, tUv,    // p1d
            dist, 0,   // p2
            
            0, tUv,    // p1
            dist, 0,   // p2d
            dist, tUv  // p2
        );
    });
    
    return {v: vNew, uv: uvNew};
}

export function applyRoofGroups(targetGeo, vTopLength, vThickLength, isCustomGlass = false) {
    const topCount = vTopLength / 3;
    const bottomCount = vTopLength / 3;
    const fasciaCount = (vThickLength - 2 * vTopLength) / 3;
    
    if (isCustomGlass) {
        targetGeo.addGroup(0, topCount, 0);
        targetGeo.addGroup(topCount, bottomCount, 0);
        targetGeo.addGroup(topCount + bottomCount, fasciaCount, 1);
    } else {
        targetGeo.addGroup(0, topCount, 0);
        targetGeo.addGroup(topCount, bottomCount + fasciaCount, 1);
    }
}
