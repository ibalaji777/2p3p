import Konva from 'konva';
import { expandPathWithFillets } from './elevationSegment.geometry.js';
import { renderElevationSegment3D } from './elevationSegment.renderer3d.js';

/**
 * Computes 2D boundary footprint coordinates, inner wall-contact line,
 * outer cantilever edge line, and centerlines for an elevation segment.
 *
 * @param {Object} entity - The elevation segment entity
 * @returns {Object} { P, Q, polyCoords, innerCoords, outerCoords, centerCoords, totalLength }
 */
export function computeElevationSegment2DFootprint(entity) {
    if (!entity || !entity.points || entity.points.length < 2) {
        return null;
    }

    const depth = Math.max(5, entity.depth || 40);

    // 1. Extract distinct 2D baseline vertices from entity.points (mapping 3D (x, z) to 2D (x, y))
    // Filter consecutive duplicate coordinates (< 1 cm apart, e.g. from vertical 3D sprouts)
    const baseNodes = [];
    for (let i = 0; i < entity.points.length; i++) {
        const pt = entity.points[i];
        if (baseNodes.length === 0) {
            baseNodes.push({
                x: pt.x,
                y: pt.z,
                normal: pt.normal ? { x: pt.normal.x, y: pt.normal.z } : null,
                cornerStyle: pt.cornerStyle || 'sharp',
                radius: pt.radius || 0,
                origIndex: i
            });
        } else {
            const prev = baseNodes[baseNodes.length - 1];
            const dist = Math.hypot(pt.x - prev.x, pt.z - prev.y);
            if (dist >= 1.0) {
                baseNodes.push({
                    x: pt.x,
                    y: pt.z,
                    normal: pt.normal ? { x: pt.normal.x, y: pt.normal.z } : null,
                    cornerStyle: pt.cornerStyle || 'sharp',
                    radius: pt.radius || 0,
                    origIndex: i
                });
            }
        }
    }

    const M = baseNodes.length;
    if (M < 2) return null;

    // 2. Compute segment tangents and outward unit normals
    const segmentDirs = [];
    const segmentNorms = [];

    for (let i = 0; i < M - 1; i++) {
        const dx = baseNodes[i + 1].x - baseNodes[i].x;
        const dy = baseNodes[i + 1].y - baseNodes[i].y;
        const len = Math.hypot(dx, dy) || 1;
        const dir = { x: dx / len, y: dy / len };
        segmentDirs.push(dir);

        // Candidate perpendicular unit vectors: (-dy, dx) and (dy, -dx)
        const perp = { x: -dir.y, y: dir.x };

        // Reference normal from start or end node if defined
        const normRef = baseNodes[i].normal || baseNodes[i + 1].normal;
        if (normRef && (Math.abs(normRef.x) > 0.001 || Math.abs(normRef.y) > 0.001)) {
            if (perp.x * normRef.x + perp.y * normRef.y < -0.01) {
                perp.x = -perp.x;
                perp.y = -perp.y;
            }
        }
        segmentNorms.push(perp);
    }

    // 3. Construct outer polyline Q and paired baseline points P
    const Q = [];
    const P = [];

    // Start of segment 0
    const startQ = {
        x: baseNodes[0].x + segmentNorms[0].x * depth,
        y: baseNodes[0].y + segmentNorms[0].y * depth
    };
    Q.push(startQ);
    P.push({ x: baseNodes[0].x, y: baseNodes[0].y });

    // Intermediate corners
    for (let i = 1; i < M - 1; i++) {
        const normIn = segmentNorms[i - 1];
        const normOut = segmentNorms[i];
        const cornerNode = baseNodes[i];

        const isFillet = (cornerNode.cornerStyle === 'fillet');

        if (!isFillet) {
            // Sharp corner: single mitered vertex
            const bisX = normIn.x + normOut.x;
            const bisY = normIn.y + normOut.y;
            const bisLen = Math.hypot(bisX, bisY);
            const normBis = bisLen > 0.001 ? { x: bisX / bisLen, y: bisY / bisLen } : normOut;

            const dot = Math.max(-0.99, Math.min(0.99, normIn.x * normOut.x + normIn.y * normOut.y));
            const angleScale = 1 / Math.sqrt((1 + dot) / 2);
            const safeScale = Math.min(2.5, angleScale);

            Q.push({
                x: cornerNode.x + normBis.x * depth * safeScale,
                y: cornerNode.y + normBis.y * depth * safeScale
            });
            P.push({ x: cornerNode.x, y: cornerNode.y });
        } else {
            // Filleted corner: concentric circular arc rounding the outer corner
            // Center is cornerNode, radius is depth.
            // Arrives at cornerNode + normIn * depth, departs at cornerNode + normOut * depth
            const thetaStart = Math.atan2(normIn.y, normIn.x);
            const thetaEnd = Math.atan2(normOut.y, normOut.x);

            let diff = thetaEnd - thetaStart;
            while (diff > Math.PI) diff -= 2 * Math.PI;
            while (diff < -Math.PI) diff += 2 * Math.PI;

            const SAMPLES = 16;
            for (let k = 0; k <= SAMPLES; k++) {
                const frac = k / SAMPLES;
                const theta = thetaStart + diff * frac;
                const qx = cornerNode.x + Math.cos(theta) * depth;
                const qy = cornerNode.y + Math.sin(theta) * depth;

                Q.push({ x: qx, y: qy });
                // Baseline point is the wall corner itself, ensuring uniform |Q - P| = depth
                P.push({ x: cornerNode.x, y: cornerNode.y });
            }
        }
    }

    // End of last segment (M - 2)
    const lastSegIdx = M - 2;
    const endQ = {
        x: baseNodes[M - 1].x + segmentNorms[lastSegIdx].x * depth,
        y: baseNodes[M - 1].y + segmentNorms[lastSegIdx].y * depth
    };
    Q.push(endQ);
    P.push({ x: baseNodes[M - 1].x, y: baseNodes[M - 1].y });

    // 4. Baseline wall coordinates (inner edge against wall, sharp wall corners)
    const innerCoords = [];
    for (let i = 0; i < M; i++) {
        innerCoords.push(baseNodes[i].x, baseNodes[i].y);
    }

    // 5. Outer edge (cantilever projection)
    const outerCoords = [];
    for (let i = 0; i < Q.length; i++) {
        outerCoords.push(Q[i].x, Q[i].y);
    }

    // 6. Assemble continuous closed polygon: innerCoords (start to end) -> outerCoords (end to start)
    const polyCoords = [];
    for (let i = 0; i < M; i++) {
        polyCoords.push(baseNodes[i].x, baseNodes[i].y);
    }
    for (let i = Q.length - 1; i >= 0; i--) {
        polyCoords.push(Q[i].x, Q[i].y);
    }

    // 7. Centerline coordinates & total path length
    const centerCoords = [];
    for (let i = 0; i < P.length; i++) {
        centerCoords.push({
            x: (P[i].x + Q[i].x) / 2,
            y: (P[i].y + Q[i].y) / 2
        });
    }
    let totalLength = 0;
    for (let i = 0; i < M - 1; i++) {
        totalLength += Math.hypot(baseNodes[i + 1].x - baseNodes[i].x, baseNodes[i + 1].y - baseNodes[i].y);
    }

    return {
        P,
        Q,
        polyCoords,
        innerCoords,
        outerCoords,
        centerCoords,
        totalLength
    };
}

/**
 * Computes recessed spotlight positions along the centerline of an elevation segment.
 *
 * @param {Object} entity - The elevation segment entity
 * @param {Object} footprint - Result from computeElevationSegment2DFootprint
 * @returns {Array<{x: number, y: number}>} Array of spotlight 2D coordinates
 */
export function computeElevationSegmentSpotlights2D(entity, footprint) {
    if (!entity || !entity.hasSpotlights || !footprint || !footprint.centerCoords) {
        return [];
    }

    const centers = footprint.centerCoords;
    const spacing = Math.max(40, entity.spotlightSpacing || 80);
    const spots = [];

    for (let i = 0; i < centers.length - 1; i++) {
        const c1 = centers[i];
        const c2 = centers[i + 1];
        const dx = c2.x - c1.x;
        const dy = c2.y - c1.y;
        const segLen = Math.hypot(dx, dy);

        if (segLen < 30) continue;

        const count = Math.max(1, Math.floor(segLen / spacing));
        const margin = (segLen - (count - 1) * spacing) / 2;

        for (let j = 0; j < count; j++) {
            const dist = margin + j * spacing;
            const t = dist / segLen;
            spots.push({
                x: c1.x + dx * t,
                y: c1.y + dy * t
            });
        }
    }

    return spots;
}

/**
 * Passive 2D Renderer for Elevation Segments on Konva 2D Floor Plan.
 * Renders the solid band, dashed cantilever overhang line, wall contact line,
 * recessed spotlights, dimension badge, and handles.
 *
 * @param {Konva.Group} group - Konva group container for this entity
 * @param {Object} entity - The elevation segment entity
 * @param {Object} planner - The 2D FloorPlanner instance
 */
export function renderElevationSegment2D(group, entity, planner) {
    if (!group || !entity) return;

    const footprint = computeElevationSegment2DFootprint(entity);
    if (!footprint) {
        group.destroyChildren();
        return;
    }

    // Retrieve or initialize sub-nodes inside the Konva group
    let fillPoly = group.findOne('.elev-fill-poly');
    let wallLine = group.findOne('.elev-wall-line');
    let outerDashed = group.findOne('.elev-outer-dashed');
    let endLine0 = group.findOne('.elev-end-line-0');
    let endLine1 = group.findOne('.elev-end-line-1');
    let spotsGroup = group.findOne('.elev-spots-group');
    let badgeGroup = group.findOne('.elev-badge-group');
    let handlesGroup = group.findOne('.elev-handles-group');

    const isSelected = planner?.selectedEntity === entity;

    // 1. Solid Band Footprint Polygon
    if (!fillPoly) {
        fillPoly = new Konva.Line({
            name: 'elev-fill-poly',
            closed: true,
            listening: true
        });
        group.add(fillPoly);
    }

    fillPoly.points(footprint.polyCoords);
    fillPoly.fill(isSelected ? 'rgba(56, 189, 248, 0.45)' : 'rgba(56, 189, 248, 0.28)');
    fillPoly.stroke(isSelected ? '#0284c7' : '#38bdf8');
    fillPoly.strokeWidth(isSelected ? 2 : 1);

    // 2. Solid Inner Line against Wall Face
    if (!wallLine) {
        wallLine = new Konva.Line({
            name: 'elev-wall-line',
            stroke: '#0369a1',
            strokeWidth: 2.5,
            lineCap: 'round',
            lineJoin: 'round',
            listening: false
        });
        group.add(wallLine);
    }
    wallLine.points(footprint.innerCoords);

    // 3. Dashed Outer Cantilever Edge Line
    if (!outerDashed) {
        outerDashed = new Konva.Line({
            name: 'elev-outer-dashed',
            stroke: '#0284c7',
            strokeWidth: 1.5,
            dash: [6, 4],
            lineCap: 'round',
            lineJoin: 'round',
            listening: false
        });
        group.add(outerDashed);
    }
    outerDashed.points(footprint.outerCoords);

    // 4. End Caps
    const P = footprint.P;
    const Q = footprint.Q;

    if (!endLine0) {
        endLine0 = new Konva.Line({
            name: 'elev-end-line-0',
            stroke: '#0284c7',
            strokeWidth: 1.5,
            listening: false
        });
        group.add(endLine0);
    }
    endLine0.points([P[0].x, P[0].y, Q[0].x, Q[0].y]);

    if (!endLine1) {
        endLine1 = new Konva.Line({
            name: 'elev-end-line-1',
            stroke: '#0284c7',
            strokeWidth: 1.5,
            listening: false
        });
        group.add(endLine1);
    }
    const lastIdx = P.length - 1;
    endLine1.points([P[lastIdx].x, P[lastIdx].y, Q[lastIdx].x, Q[lastIdx].y]);

    // 5. Recessed Spotlight Indicators
    if (!spotsGroup) {
        spotsGroup = new Konva.Group({ name: 'elev-spots-group', listening: false });
        group.add(spotsGroup);
    }
    spotsGroup.destroyChildren();

    if (entity.hasSpotlights) {
        const spots = computeElevationSegmentSpotlights2D(entity, footprint);
        spots.forEach(pt => {
            // Glow circle
            const glow = new Konva.Circle({
                x: pt.x,
                y: pt.y,
                radius: 5,
                fill: 'rgba(253, 224, 71, 0.45)',
                stroke: 'transparent'
            });
            // Core bulb
            const bulb = new Konva.Circle({
                x: pt.x,
                y: pt.y,
                radius: 2.5,
                fill: '#fde047',
                stroke: '#ca8a04',
                strokeWidth: 1
            });
            spotsGroup.add(glow, bulb);
        });
    }

    // 6. Dimension & Elevation Badge
    if (!badgeGroup) {
        badgeGroup = new Konva.Group({ name: 'elev-badge-group', listening: false });
        const bgRect = new Konva.Rect({
            name: 'badge-bg',
            fill: '#ffffff',
            stroke: '#94a3b8',
            strokeWidth: 1,
            cornerRadius: 4,
            opacity: 0.92
        });
        const badgeText = new Konva.Text({
            name: 'badge-text',
            fontSize: 10,
            fontFamily: 'sans-serif',
            fontStyle: 'bold',
            fill: '#0369a1',
            align: 'center'
        });
        badgeGroup.add(bgRect, badgeText);
        group.add(badgeGroup);
    }

    if (footprint.centerCoords && footprint.centerCoords.length >= 2) {
        const midIdx = Math.floor((footprint.centerCoords.length - 1) / 2);
        const cA = footprint.centerCoords[midIdx];
        const cB = footprint.centerCoords[midIdx + 1] || cA;
        const midX = (cA.x + cB.x) / 2;
        const midY = (cA.y + cB.y) / 2;

        const elevY = entity.points[0]?.y !== undefined ? Math.round(entity.points[0].y) : 150;
        const lenCm = Math.round(footprint.totalLength || 0);
        const textStr = `${lenCm} cm | Y:${elevY}`;

        const badgeText = badgeGroup.findOne('.badge-text');
        const bgRect = badgeGroup.findOne('.badge-bg');

        if (badgeText && bgRect) {
            badgeText.text(textStr);
            const padX = 6;
            const padY = 3;
            const tw = badgeText.width();
            const th = badgeText.height();

            bgRect.width(tw + padX * 2);
            bgRect.height(th + padY * 2);
            bgRect.x(- (tw + padX * 2) / 2);
            bgRect.y(- (th + padY * 2) / 2);

            badgeText.x(- tw / 2);
            badgeText.y(- th / 2);

            badgeGroup.position({ x: midX, y: midY });
            badgeGroup.visible(isSelected || planner?.tool === 'elevation_segment');
        }
    }

    // 7. Interactive Start & End Extension Handles (visible when selected)
    if (!handlesGroup) {
        handlesGroup = new Konva.Group({ name: 'elev-handles-group' });
        group.add(handlesGroup);
    }

    handlesGroup.visible(isSelected);

    if (isSelected) {
        setupExtensionHandles(handlesGroup, entity, footprint, planner);
    }
}

/**
 * Sets up 2D interactive extension drag handles at the start and end endpoints.
 */
function setupExtensionHandles(handlesGroup, entity, footprint, planner) {
    handlesGroup.destroyChildren();
    if (!entity.points || entity.points.length < 2) return;

    const n = entity.points.length;
    const P = footprint.P;
    const Q = footprint.Q;
    const lastPIdx = P.length - 1;

    // Endpoint handles: start (index 0) and end (index n-1)
    [
        { ptIdx: 0, isStart: true, neighborIdx: 1, pPt: P[0], qPt: Q[0] },
        { ptIdx: n - 1, isStart: false, neighborIdx: n - 2, pPt: P[lastPIdx], qPt: Q[lastPIdx] }
    ].forEach(({ ptIdx, isStart, neighborIdx, pPt, qPt }) => {
        const pMid = {
            x: (pPt.x + qPt.x) / 2,
            y: (pPt.y + qPt.y) / 2
        };

        const handle = new Konva.Circle({
            x: pMid.x,
            y: pMid.y,
            radius: 6,
            fill: '#0284c7',
            stroke: '#ffffff',
            strokeWidth: 2,
            draggable: true,
            hitStrokeWidth: 14,
            name: `elev-handle-${ptIdx}`
        });

        handle.on('mouseenter', () => {
            if (planner?.stage) planner.stage.container().style.cursor = 'ew-resize';
        });
        handle.on('mouseleave', () => {
            if (planner?.stage) planner.stage.container().style.cursor = 'default';
        });

        handle.on('dragstart', (e) => {
            e.cancelBubble = true;
        });

        handle.on('dragmove', (e) => {
            e.cancelBubble = true;
            const stage = planner?.stage;
            const pos = planner?.getPointerPos ? planner.getPointerPos() : (stage ? stage.getPointerPosition() : null);
            if (!pos) return;

            // Project pointer position onto the segment line from neighbor
            const pNeighbor = { x: entity.points[neighborIdx].x, y: entity.points[neighborIdx].z };
            const pCurrent = { x: entity.points[ptIdx].x, y: entity.points[ptIdx].z };

            const dx = pCurrent.x - pNeighbor.x;
            const dy = pCurrent.y - pNeighbor.y;
            const segLen = Math.hypot(dx, dy) || 1;
            const ux = dx / segLen;
            const uy = dy / segLen;

            // Distance from neighbor along unit vector
            const dot = (pos.x - pNeighbor.x) * ux + (pos.y - pNeighbor.y) * uy;
            const minLen = 20; // Minimum segment length in cm
            const newLen = Math.max(minLen, dot);

            const newX = Math.round(pNeighbor.x + ux * newLen);
            const newY = Math.round(pNeighbor.y + uy * newLen);

            // Update entity point in world coords (3D X is 2D X, 3D Z is 2D Y)
            entity.points[ptIdx].x = newX;
            entity.points[ptIdx].z = newY;

            if (entity.nodes && entity.nodes[ptIdx]) {
                entity.nodes[ptIdx].x = newX;
                entity.nodes[ptIdx].z = newY;
            }

            // In-place live update
            if (entity.update2D) entity.update2D();

            // Re-render 3D live if mesh3D is present
            if (entity.mesh3D && planner?.app3D) {
                renderElevationSegment3D(null, entity, planner.app3D.helpers);
                const gizmo = planner.app3D.interactionSystem?.elevationSegmentGizmo;
                if (gizmo && gizmo.visible) gizmo.updateHandles();
            }
        });

        handle.on('dragend', (e) => {
            e.cancelBubble = true;
            if (planner?.syncAll) planner.syncAll();
            if (planner?.debouncedSaveHistory) planner.debouncedSaveHistory();
        });

        handlesGroup.add(handle);
    });
}

/**
 * Creates and initializes a Konva Group for an elevation segment with selection
 * and hover listeners.
 *
 * @param {Object} entity - The elevation segment entity
 * @param {Object} planner - The 2D FloorPlanner instance
 * @returns {Konva.Group}
 */
export function createElevationSegment2DGroup(entity, planner) {
    const group = new Konva.Group({
        id: entity.id,
        name: 'elevation_segment_group',
        draggable: false,
        listening: true
    });

    group.on('mouseenter', () => {
        if (planner?.tool === 'select' || planner?.tool === 'elevation_segment') {
            if (planner?.stage) planner.stage.container().style.cursor = 'pointer';
        }
    });

    group.on('mouseleave', () => {
        if (planner?.stage) planner.stage.container().style.cursor = 'default';
    });

    group.on('click tap', (e) => {
        if (planner?.tool === 'select' || planner?.tool === 'elevation_segment') {
            e.cancelBubble = true;
            if (e.evt) e.evt.stopPropagation();
            if (planner.selectEntity) {
                planner.selectEntity(entity, 'elevation_segment');
            }
        }
    });

    entity.group2D = group;
    entity.group = group;

    const requestRedraw = () => {
        const layer = group.getLayer() || planner?.mainLayer || planner?.stage;
        if (layer && typeof layer.batchDraw === 'function') {
            layer.batchDraw();
        }
    };

    // Attach in-place update methods to entity
    entity.update2D = () => {
        renderElevationSegment2D(group, entity, planner);
        requestRedraw();
    };

    entity.setHighlight = (isHighlighted) => {
        renderElevationSegment2D(group, entity, planner);
        requestRedraw();
    };

    entity.update = () => {
        if (entity.update2D) entity.update2D();
    };

    renderElevationSegment2D(group, entity, planner);
    return group;
}

/**
 * Centralized synchronizer for all elevation segments in FloorPlanner.
 * Reconciles planner.elevationSegments with planner.widgetLayer.
 *
 * @param {Object} planner - The 2D FloorPlanner instance
 */
export function syncElevationSegments2D(planner) {
    if (!planner || !planner.widgetLayer) return;

    const segments = planner.elevationSegments || [];
    const validGroupIds = new Set();

    segments.forEach(seg => {
        if (!seg || seg.isDeleted || seg.isHidden) return;
        validGroupIds.add(seg.id);

        if (!seg.group2D || seg.group2D.parent !== planner.widgetLayer) {
            if (seg.group2D) {
                seg.group2D.destroy();
                seg.group2D = null;
            }
            const group = createElevationSegment2DGroup(seg, planner);
            planner.widgetLayer.add(group);
        } else {
            // Update existing group in-place
            renderElevationSegment2D(seg.group2D, seg, planner);
        }
    });

    // Cleanup orphaned elevation segment groups from widgetLayer
    const children = [...planner.widgetLayer.getChildren()];
    children.forEach(child => {
        if (child.name() === 'elevation_segment_group') {
            if (!validGroupIds.has(child.id())) {
                child.destroy();
            }
        }
    });
}
