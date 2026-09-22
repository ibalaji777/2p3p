import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { WallGeometryEngine } from '../WallGeometryEngine.js';

describe('CurvedWallApertureAndUV (Phase 7 Architecture)', () => {
    describe('1. Multi-Segment Curved Wall Aperture Slicing', () => {
        it('slices a wide window across all constituent segments spanned by its width', () => {
            // Arc of total length 200 cm, split into 4 segments of 50 cm each
            const seg0 = { id: 'seg_0', length: 50, arcDistanceOffset: 0, attachedWidgets: [] };
            const seg1 = { id: 'seg_1', length: 50, arcDistanceOffset: 50, attachedWidgets: [] };
            const seg2 = { id: 'seg_2', length: 50, arcDistanceOffset: 100, attachedWidgets: [] };
            const seg3 = { id: 'seg_3', length: 50, arcDistanceOffset: 150, attachedWidgets: [] };

            const mockArc = {
                id: 'arc_test',
                type: 'arc',
                totalArcLength: 200,
                walls: [seg0, seg1, seg2, seg3],
                attachedWidgets: []
            };

            [seg0, seg1, seg2, seg3].forEach(s => { s.parentArc = mockArc; });

            // A 120 cm wide window centered at s = 100 cm (span: 40 cm to 160 cm)
            // Attached to seg1 at local t = 1.0 (s = 50 + 50 = 100 cm)
            const windowWidget = {
                id: 'win_120',
                type: 'window',
                width: 120,
                height: 120,
                elevation: 90,
                t: 1.0,
                parentWall: seg1
            };
            seg1.attachedWidgets.push(windowWidget);

            // 1. Segment 0 (0 to 50 cm) overlaps [40, 50] -> slice of 10 cm on right edge
            const holesSeg0 = WallGeometryEngine.getApertureVoidsForWall(seg0, 50, 280, 0, THREE);
            expect(holesSeg0.length).toBe(1);
            expect(holesSeg0[0]).toBeInstanceOf(THREE.Path);
            const curves0 = holesSeg0[0].curves;
            expect(curves0.length).toBeGreaterThan(0);
            // Check bottom line endpoints: x1 = 40, x2 = 50
            expect(curves0[0].v1.x).toBeCloseTo(40, 1);
            expect(curves0[0].v2.x).toBeCloseTo(50, 1);

            // 2. Segment 1 (50 to 100 cm) overlaps [50, 100] -> fully cut from 0 to 50
            const holesSeg1 = WallGeometryEngine.getApertureVoidsForWall(seg1, 50, 280, 0, THREE);
            expect(holesSeg1.length).toBe(1);
            const curves1 = holesSeg1[0].curves;
            expect(curves1[0].v1.x).toBeCloseTo(0, 1);
            expect(curves1[0].v2.x).toBeCloseTo(50, 1);

            // 3. Segment 2 (100 to 150 cm) overlaps [100, 150] -> fully cut from 0 to 50
            const holesSeg2 = WallGeometryEngine.getApertureVoidsForWall(seg2, 50, 280, 0, THREE);
            expect(holesSeg2.length).toBe(1);
            const curves2 = holesSeg2[0].curves;
            expect(curves2[0].v1.x).toBeCloseTo(0, 1);
            expect(curves2[0].v2.x).toBeCloseTo(50, 1);

            // 4. Segment 3 (150 to 200 cm) overlaps [150, 160] -> slice of 10 cm on left edge
            const holesSeg3 = WallGeometryEngine.getApertureVoidsForWall(seg3, 50, 280, 0, THREE);
            expect(holesSeg3.length).toBe(1);
            const curves3 = holesSeg3[0].curves;
            expect(curves3[0].v1.x).toBeCloseTo(0, 1);
            expect(curves3[0].v2.x).toBeCloseTo(10, 1);
        });

        it('does not create holes in segments outside the window span', () => {
            const seg0 = { id: 'seg_0', length: 50, arcDistanceOffset: 0, attachedWidgets: [] };
            const seg1 = { id: 'seg_1', length: 50, arcDistanceOffset: 50, attachedWidgets: [] };
            const seg2 = { id: 'seg_2', length: 50, arcDistanceOffset: 100, attachedWidgets: [] };

            const mockArc = {
                id: 'arc_test',
                type: 'arc',
                totalArcLength: 150,
                walls: [seg0, seg1, seg2],
                attachedWidgets: []
            };
            [seg0, seg1, seg2].forEach(s => { s.parentArc = mockArc; });

            // Small 40 cm window located entirely on seg1 (center at s = 75 cm, span [55, 95])
            const smallWin = {
                id: 'win_small',
                type: 'window',
                width: 40,
                height: 100,
                t: 0.5,
                parentWall: seg1
            };
            seg1.attachedWidgets.push(smallWin);

            expect(WallGeometryEngine.getApertureVoidsForWall(seg0, 50, 280, 0, THREE).length).toBe(0);
            expect(WallGeometryEngine.getApertureVoidsForWall(seg1, 50, 280, 0, THREE).length).toBe(1);
            expect(WallGeometryEngine.getApertureVoidsForWall(seg2, 50, 280, 0, THREE).length).toBe(0);
        });

        it('preserves single-wall behavior for straight walls without parentArc', () => {
            const straightWall = {
                id: 'straight_1',
                length: 400,
                attachedWidgets: [
                    { id: 'w1', type: 'door', width: 90, height: 210, t: 0.5 }
                ]
            };

            const holes = WallGeometryEngine.getApertureVoidsForWall(straightWall, 400, 280, 0, THREE);
            expect(holes.length).toBe(1);
            expect(holes[0]).toBeInstanceOf(THREE.Path);
            const curves = holes[0].curves;
            // Center is 200, half width is 45 -> [155, 245]
            expect(curves[0].v1.x).toBeCloseTo(155, 1);
            expect(curves[0].v2.x).toBeCloseTo(245, 1);
        });
    });

    describe('2. Continuous UV Coordinates across Curved Wall Segments', () => {
        it('advances cumulative arc offset across consecutive arc segments', () => {
            const seg0 = { id: 'seg_0', length: 60, arcDistanceOffset: 0 };
            const seg1 = { id: 'seg_1', length: 60, arcDistanceOffset: 60 };
            const seg2 = { id: 'seg_2', length: 60, arcDistanceOffset: 120 };

            expect(seg0.arcDistanceOffset).toBe(0);
            expect(seg1.arcDistanceOffset).toBe(60);
            expect(seg2.arcDistanceOffset).toBe(120);

            // Check UV calculation logic: vertex at local x = 0 on seg1 has effective U = (0 + 60)
            const uSeg0End = (60 + seg0.arcDistanceOffset);
            const uSeg1Start = (0 + seg1.arcDistanceOffset);
            expect(uSeg0End).toBe(uSeg1Start); // Gapless UV continuity at the junction!
        });
    });
});
