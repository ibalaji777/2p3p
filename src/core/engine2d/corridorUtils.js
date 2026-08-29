/**
 * Utility functions for calculating 2D offset corridors and ribbons for driveways, walkways, and paths.
 */

export function computeCorridorOffsets(points, width) {
    if (!points || points.length < 2) return null;
    const halfW = width / 2;
    const n = points.length;
    
    const segNormals = [];
    for (let i = 0; i < n - 1; i++) {
        const dx = points[i+1].x - points[i].x;
        const dy = points[i+1].y - points[i].y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        segNormals.push({ nx: -uy, ny: ux, ux, uy, len });
    }

    const leftPts = [];
    const rightPts = [];

    // Start point
    leftPts.push({
        x: points[0].x + segNormals[0].nx * halfW,
        y: points[0].y + segNormals[0].ny * halfW
    });
    rightPts.push({
        x: points[0].x - segNormals[0].nx * halfW,
        y: points[0].y - segNormals[0].ny * halfW
    });

    // Intermediate points with miter joint calculation
    for (let i = 1; i < n - 1; i++) {
        const n1 = segNormals[i - 1];
        const n2 = segNormals[i];
        
        let bisectorX = n1.nx + n2.nx;
        let bisectorY = n1.ny + n2.ny;
        const bisectorLen = Math.hypot(bisectorX, bisectorY);
        
        if (bisectorLen < 0.001) {
            bisectorX = n1.nx;
            bisectorY = n1.ny;
        } else {
            bisectorX /= bisectorLen;
            bisectorY /= bisectorLen;
        }

        const dot = bisectorX * n1.nx + bisectorY * n1.ny;
        const miterLength = Math.min(halfW / Math.max(0.15, dot), halfW * 2.5);

        leftPts.push({
            x: points[i].x + bisectorX * miterLength,
            y: points[i].y + bisectorY * miterLength
        });
        rightPts.push({
            x: points[i].x - bisectorX * miterLength,
            y: points[i].y - bisectorY * miterLength
        });
    }

    // End point
    const lastN = segNormals[segNormals.length - 1];
    leftPts.push({
        x: points[n - 1].x + lastN.nx * halfW,
        y: points[n - 1].y + lastN.ny * halfW
    });
    rightPts.push({
        x: points[n - 1].x - lastN.nx * halfW,
        y: points[n - 1].y - lastN.ny * halfW
    });

    return { leftPts, rightPts, segNormals };
}

export function computeCorridorPolygon(points, width) {
    const offsets = computeCorridorOffsets(points, width);
    if (!offsets) return null;
    const { leftPts, rightPts } = offsets;
    const polygon = [...leftPts];
    for (let i = rightPts.length - 1; i >= 0; i--) {
        polygon.push(rightPts[i]);
    }
    return polygon;
}
