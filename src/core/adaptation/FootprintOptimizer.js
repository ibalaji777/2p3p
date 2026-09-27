/**
 * src/core/adaptation/FootprintOptimizer.js
 * 
 * Computes optimal linear transformation parameters to fit an existing building footprint
 * into a target buildable envelope, preserving right angles, physical proportions,
 * and architectural alignment.
 * 
 * Eliminates bilinear shearing and naive uniform scaling in favor of
 * piecewise-linear monotonic span redistribution.
 */

import { SiteGeometryEngine } from '../site/SiteGeometryEngine.js';

export class FootprintOptimizer {
    /**
     * Calculates the optimal transformation to map building bounds into the buildable envelope.
     * 
     * @param {Object} origBounds - { minX, maxX, minY, maxY, width, depth, areaCm2, areaSqFt, cx, cy }
     * @param {Array<{x: number, y: number}>|null} buildableEnvelope - Polygon vertices of the buildable envelope (or null for building-only)
     * @param {Object} [options={}] - Optimization parameters
     * @param {number} [options.targetAreaSqFt] - Explicit target area in sq ft (e.g. 860)
     * @param {boolean} [options.preserveAspectRatio=true] - Keep W/D ratio invariant
     * @param {boolean} [options.alignRoadFrontage=true] - Align front facade towards front setback
     * @param {number} [options.roadFrontageIndex=0] - Index of road frontage edge
     * @param {number} [options.safetyMarginCm=0] - Buffer distance inside envelope
     * @param {Array<{x: number, y: number}>} [options.plotVertices] - Outer plot boundary vertices
     * @param {Object} [options.spans] - Analyzed wall spans { xSpans, ySpans, xLines, yLines }
     * @param {Object} [options.footprint] - Building footprint polygon
     * @returns {Object|null} Transformation specification
     */
    static optimize(origBounds, buildableEnvelope = null, options = {}) {
        if (!origBounds || origBounds.width <= 0 || origBounds.depth <= 0) {
            return null;
        }

        const {
            targetAreaSqFt,
            preserveAspectRatio = true,
            alignRoadFrontage = false,
            roadFrontageIndex = 0,
            roadFrontages = null,
            placementMode = null,
            safetyMarginCm = 0,
            plotVertices,
            spans = null,
            footprint = null
        } = options;

        const hasEnvelope = Boolean(buildableEnvelope && Array.isArray(buildableEnvelope) && buildableEnvelope.length >= 3);

        // 1. Calculate buildable envelope AABB and centroid if envelope exists
        let envMinX = 0, envMaxX = 0, envMinY = 0, envMaxY = 0;
        let envW = 0, envD = 0, envCx = origBounds.cx, envCy = origBounds.cy;
        let envelopeAreaUnits2 = 0;
        let envelopeAreaSqFt = 0;

        if (hasEnvelope) {
            const envXs = buildableEnvelope.map(p => p.x);
            const envYs = buildableEnvelope.map(p => p.y);
            envMinX = Math.min(...envXs) + safetyMarginCm;
            envMaxX = Math.max(...envXs) - safetyMarginCm;
            envMinY = Math.min(...envYs) + safetyMarginCm;
            envMaxY = Math.max(...envYs) - safetyMarginCm;

            envW = Math.max(10, envMaxX - envMinX);
            envD = Math.max(10, envMaxY - envMinY);
            envCx = envMinX + envW / 2;
            envCy = envMinY + envD / 2;

            envelopeAreaUnits2 = SiteGeometryEngine.getArea(buildableEnvelope);
            envelopeAreaSqFt = SiteGeometryEngine.units2ToSqFt(envelopeAreaUnits2);
        }

        // 2. Compute base target scaling factors
        const currentBuildingAreaSqFt = (footprint && footprint.areaSqFt > 0) 
            ? footprint.areaSqFt 
            : origBounds.areaSqFt;
        const currentBuildingAreaUnits2 = SiteGeometryEngine.sqFtToUnits2(currentBuildingAreaSqFt);

        let scaleX = 1.0;
        let scaleY = 1.0;

        if (targetAreaSqFt && currentBuildingAreaSqFt > 0) {
            const targetUnits2 = SiteGeometryEngine.sqFtToUnits2(targetAreaSqFt);
            const areaRatio = targetUnits2 / currentBuildingAreaUnits2;
            const linearScale = Math.sqrt(areaRatio);
            scaleX = linearScale;
            scaleY = linearScale;

            if (hasEnvelope) {
                const maxScaleX = envW / origBounds.width;
                const maxScaleY = envD / origBounds.depth;
                if (preserveAspectRatio) {
                    const uniformCap = Math.min(maxScaleX, maxScaleY);
                    if (scaleX > uniformCap) {
                        scaleX = uniformCap;
                        scaleY = uniformCap;
                    }
                } else {
                    scaleX = Math.min(scaleX, maxScaleX);
                    scaleY = Math.min(scaleY, maxScaleY);
                }
            }
        } else if (hasEnvelope) {
            // No explicit target area: scale to fit inside envelope capacity
            const maxScaleX = envW / origBounds.width;
            const maxScaleY = envD / origBounds.depth;

            if (preserveAspectRatio) {
                const uniformCap = Math.min(maxScaleX, maxScaleY);
                scaleX = uniformCap;
                scaleY = uniformCap;
            } else {
                scaleX = maxScaleX;
                scaleY = maxScaleY;
            }
        }

        // 3. Span Redistribution Solver (Architectural Room Adaptation)
        // If analyzed spans exist and targetAreaSqFt was requested with reduction:
        const xSpans = spans?.xSpans || [];
        const ySpans = spans?.ySpans || [];
        const hasStructuredSpans = xSpans.length > 1 || ySpans.length > 1;

        let adaptedW = origBounds.width * scaleX;
        let adaptedD = origBounds.depth * scaleY;

        let xIntervals = null;
        let yIntervals = null;

        if (hasStructuredSpans && targetAreaSqFt && scaleX < 1.0) {
            // Solve X spans redistribution
            const deltaWNeeded = origBounds.width * (1.0 - scaleX);
            let totalReducibleX = 0;
            xSpans.forEach(s => {
                const reducible = Math.max(0, s.length - s.minLen);
                totalReducibleX += reducible * s.elasticity;
            });

            if (totalReducibleX > 0) {
                xIntervals = xSpans.map(s => {
                    const reducible = Math.max(0, s.length - s.minLen);
                    const reduction = Math.min(reducible, (deltaWNeeded * (reducible * s.elasticity)) / totalReducibleX);
                    const newLen = Math.max(s.minLen, s.length - reduction);
                    return {
                        origStart: s.start,
                        origEnd: s.end,
                        origLen: s.length,
                        newLen
                    };
                });
                adaptedW = xIntervals.reduce((sum, int) => sum + int.newLen, 0);
            }

            // Solve Y spans redistribution
            const deltaDNeeded = origBounds.depth * (1.0 - scaleY);
            let totalReducibleY = 0;
            ySpans.forEach(s => {
                const reducible = Math.max(0, s.length - s.minLen);
                totalReducibleY += reducible * s.elasticity;
            });

            if (totalReducibleY > 0) {
                yIntervals = ySpans.map(s => {
                    const reducible = Math.max(0, s.length - s.minLen);
                    const reduction = Math.min(reducible, (deltaDNeeded * (reducible * s.elasticity)) / totalReducibleY);
                    const newLen = Math.max(s.minLen, s.length - reduction);
                    return {
                        origStart: s.start,
                        origEnd: s.end,
                        origLen: s.length,
                        newLen
                    };
                });
                adaptedD = yIntervals.reduce((sum, int) => sum + int.newLen, 0);
            }
        }

        // 4. Position the building: within envelope or centered at existing location
        const activeRoadFrontages = (roadFrontages && Array.isArray(roadFrontages) && roadFrontages.length > 0)
            ? roadFrontages.map(Number)
            : [Number(roadFrontageIndex) || 0];

        let effectivePlacementMode = placementMode;
        if (!effectivePlacementMode) {
            effectivePlacementMode = alignRoadFrontage ? 'road_frontage' : 'preserve_offset';
        }

        const computeTargetCenter = (curW, curD) => {
            let cx = hasEnvelope ? envCx : origBounds.cx;
            let cy = hasEnvelope ? envCy : origBounds.cy;

            if (hasEnvelope && effectivePlacementMode === 'preserve_offset') {
                const origSlackX = envW - origBounds.width;
                const origSlackY = envD - origBounds.depth;
                if (origSlackX > 1 && origSlackY > 1) {
                    const tx = Math.max(0, Math.min(1, (origBounds.minX - envMinX) / origSlackX));
                    const ty = Math.max(0, Math.min(1, (origBounds.minY - envMinY) / origSlackY));

                    const newSlackX = Math.max(0, envW - curW);
                    const newSlackY = Math.max(0, envD - curD);

                    cx = (envMinX + tx * newSlackX) + curW / 2;
                    cy = (envMinY + ty * newSlackY) + curD / 2;
                } else {
                    cx = envCx;
                    cy = envCy;
                }
            } else if (hasEnvelope && effectivePlacementMode === 'road_frontage') {
                activeRoadFrontages.forEach(rIdx => {
                    if (rIdx === 0 && curD <= envD) {
                        cy = envMinY + curD / 2;
                    } else if (rIdx === 1 && curW <= envW) {
                        cx = envMaxX - curW / 2;
                    } else if (rIdx === 2 && curD <= envD) {
                        cy = envMaxY - curD / 2;
                    } else if (rIdx === 3 && curW <= envW) {
                        cx = envMinX + curW / 2;
                    }
                });
            }

            // Plot-Boundary Clamping: Guarantee building center stays inside outer plot boundary
            if (plotVertices && Array.isArray(plotVertices) && plotVertices.length >= 3) {
                const plotXs = plotVertices.map(p => p.x);
                const plotYs = plotVertices.map(p => p.y);
                const plotMinX = Math.min(...plotXs);
                const plotMaxX = Math.max(...plotXs);
                const plotMinY = Math.min(...plotYs);
                const plotMaxY = Math.max(...plotYs);

                const halfW = curW / 2;
                const halfD = curD / 2;

                if (cx - halfW < plotMinX) cx = plotMinX + halfW;
                if (cx + halfW > plotMaxX) cx = plotMaxX - halfW;
                if (cy - halfD < plotMinY) cy = plotMinY + halfD;
                if (cy + halfD > plotMaxY) cy = plotMaxY - halfD;
            }

            return { cx, cy };
        };

        const initialCenter = computeTargetCenter(adaptedW, adaptedD);
        let targetCx = initialCenter.cx;
        let targetCy = initialCenter.cy;

        // 5. Inscription check inside polygon (for slanted/trapezoid/irregular envelopes)
        if (hasEnvelope && buildableEnvelope && buildableEnvelope.length >= 3) {
            const checkCornersInside = (cx, cy, w, d) => {
                const hW = w / 2;
                const hD = d / 2;
                const corners = [
                    { x: cx - hW, y: cy - hD },
                    { x: cx + hW, y: cy - hD },
                    { x: cx + hW, y: cy + hD },
                    { x: cx - hW, y: cy + hD }
                ];
                return corners.every(c => SiteGeometryEngine.isPointInsidePolygon(c, buildableEnvelope, 0.5));
            };

            const findValidPlacement = (curW, curD) => {
                const baseCenter = computeTargetCenter(curW, curD);
                if (checkCornersInside(baseCenter.cx, baseCenter.cy, curW, curD)) {
                    return baseCenter;
                }

                const minCx = envMinX + curW / 2;
                const maxCx = envMaxX - curW / 2;
                const minCy = envMinY + curD / 2;
                const maxCy = envMaxY - curD / 2;

                const isPinnedY = effectivePlacementMode === 'road_frontage' && (activeRoadFrontages.includes(0) || activeRoadFrontages.includes(2));
                const isPinnedX = effectivePlacementMode === 'road_frontage' && (activeRoadFrontages.includes(1) || activeRoadFrontages.includes(3));

                const sampleT = [0.5, 0.55, 0.45, 0.6, 0.4, 0.65, 0.35, 0.7, 0.3, 0.75, 0.25, 0.8, 0.2, 0.85, 0.15, 0.9, 0.1, 0.95, 0.05, 1.0, 0.0];

                for (const tx of sampleT) {
                    const testX = (maxCx >= minCx && !isPinnedX) ? (minCx + (maxCx - minCx) * tx) : baseCenter.cx;
                    if (isPinnedY) {
                        if (checkCornersInside(testX, baseCenter.cy, curW, curD)) {
                            return { cx: testX, cy: baseCenter.cy };
                        }
                    } else {
                        for (const ty of sampleT) {
                            const testY = (maxCy >= minCy) ? (minCy + (maxCy - minCy) * ty) : baseCenter.cy;
                            if (checkCornersInside(testX, testY, curW, curD)) {
                                return { cx: testX, cy: testY };
                            }
                        }
                    }
                }
                return null;
            };

            let validPlacement = findValidPlacement(adaptedW, adaptedD);
            let iteration = 0;
            const maxIterations = 80;

            while (!validPlacement && iteration < maxIterations && scaleX > 0.05 && scaleY > 0.05) {
                scaleX *= 0.97;
                scaleY *= 0.97;
                adaptedW = origBounds.width * scaleX;
                adaptedD = origBounds.depth * scaleY;
                validPlacement = findValidPlacement(adaptedW, adaptedD);
                iteration++;
            }

            if (validPlacement) {
                targetCx = validPlacement.cx;
                targetCy = validPlacement.cy;
            } else {
                const fallbackCenter = computeTargetCenter(adaptedW, adaptedD);
                targetCx = fallbackCenter.cx;
                targetCy = fallbackCenter.cy;
            }

            // Sync redistributed spans if intervals were previously calculated
            if (xIntervals && xIntervals.length > 0) {
                const curTotW = xIntervals.reduce((sum, int) => sum + int.newLen, 0);
                if (curTotW > 0 && Math.abs(curTotW - adaptedW) > 1e-3) {
                    const factor = adaptedW / curTotW;
                    xIntervals.forEach(int => { int.newLen *= factor; });
                }
            }
            if (yIntervals && yIntervals.length > 0) {
                const curTotD = yIntervals.reduce((sum, int) => sum + int.newLen, 0);
                if (curTotD > 0 && Math.abs(curTotD - adaptedD) > 1e-3) {
                    const factor = adaptedD / curTotD;
                    yIntervals.forEach(int => { int.newLen *= factor; });
                }
            }
        }

        // Compute adapted area
        const adaptedAreaUnits2 = (footprint && !footprint.isRectangular)
            ? (footprint.areaUnits2 * (adaptedW / origBounds.width) * (adaptedD / origBounds.depth))
            : (adaptedW * adaptedD);
        const adaptedAreaSqFt = SiteGeometryEngine.units2ToSqFt(adaptedAreaUnits2);

        // 6. Construct Axis-Aligned Matrix (strictly preserves 90° orthogonality, NO SHEARING)
        const halfW = adaptedW / 2;
        const halfD = adaptedD / 2;
        const matrix = {
            TL: { x: targetCx - halfW, y: targetCy - halfD },
            TR: { x: targetCx + halfW, y: targetCy - halfD },
            BR: { x: targetCx + halfW, y: targetCy + halfD },
            BL: { x: targetCx - halfW, y: targetCy + halfD }
        };

        const origMinX = origBounds.minX;
        const origMinY = origBounds.minY;
        const origW = origBounds.width;
        const origD = origBounds.depth;

        // Build piecewise-linear mapping tables if spans were redistributed
        let xMappingTable = null;
        if (xIntervals && xIntervals.length > 0) {
            let currentTargetX = targetCx - halfW;
            xMappingTable = xIntervals.map(int => {
                const startX = currentTargetX;
                const endX = startX + int.newLen;
                currentTargetX = endX;
                return {
                    origStart: int.origStart,
                    origEnd: int.origEnd,
                    targetStart: startX,
                    targetEnd: endX
                };
            });
        }

        let yMappingTable = null;
        if (yIntervals && yIntervals.length > 0) {
            let currentTargetY = targetCy - halfD;
            yMappingTable = yIntervals.map(int => {
                const startY = currentTargetY;
                const endY = startY + int.newLen;
                currentTargetY = endY;
                return {
                    origStart: int.origStart,
                    origEnd: int.origEnd,
                    targetStart: startY,
                    targetEnd: endY
                };
            });
        }

        // 7. Point Transformation Function: Orthogonal piecewise-linear or axis-aligned linear mapping
        const transformPoint = (pt) => {
            if (!pt) return { x: 0, y: 0 };

            let newX;
            if (xMappingTable && xMappingTable.length > 0) {
                // Find matching span
                const span = xMappingTable.find(s => pt.x >= s.origStart - 1e-4 && pt.x <= s.origEnd + 1e-4) ||
                    (pt.x < xMappingTable[0].origStart ? xMappingTable[0] : xMappingTable[xMappingTable.length - 1]);
                const spanOrigW = span.origEnd - span.origStart;
                const t = spanOrigW > 0 ? (pt.x - span.origStart) / spanOrigW : 0;
                newX = span.targetStart + t * (span.targetEnd - span.targetStart);
            } else {
                const u = origW > 0 ? (pt.x - origMinX) / origW : 0;
                newX = (targetCx - halfW) + u * adaptedW;
            }

            let newY;
            if (yMappingTable && yMappingTable.length > 0) {
                const span = yMappingTable.find(s => pt.y >= s.origStart - 1e-4 && pt.y <= s.origEnd + 1e-4) ||
                    (pt.y < yMappingTable[0].origStart ? yMappingTable[0] : yMappingTable[yMappingTable.length - 1]);
                const spanOrigD = span.origEnd - span.origStart;
                const t = spanOrigD > 0 ? (pt.y - span.origStart) / spanOrigD : 0;
                newY = span.targetStart + t * (span.targetEnd - span.targetStart);
            } else {
                const v = origD > 0 ? (pt.y - origMinY) / origD : 0;
                newY = (targetCy - halfD) + v * adaptedD;
            }

            return {
                x: newX,
                y: newY
            };
        };

        return {
            scaleX,
            scaleY,
            matrix,
            adaptedWidth: Math.round(adaptedW * 10) / 10,
            adaptedDepth: Math.round(adaptedD * 10) / 10,
            adaptedAreaSqFt: Math.round(adaptedAreaSqFt * 10) / 10,
            envelopeAreaSqFt: Math.round(envelopeAreaSqFt * 10) / 10,
            targetCenter: { x: targetCx, y: targetCy },
            origCenter: { x: origBounds.cx, y: origBounds.cy },
            adaptedBounds: {
                minX: targetCx - halfW,
                maxX: targetCx + halfW,
                minY: targetCy - halfD,
                maxY: targetCy + halfD,
                width: adaptedW,
                depth: adaptedD
            },
            transformPoint
        };
    }
}
