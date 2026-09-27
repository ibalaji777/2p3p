import { describe, it, expect } from 'vitest';
import { DesignIntentAnalyzer, ENTITY_ROLE } from '../DesignIntentAnalyzer.js';

describe('DesignIntentAnalyzer', () => {
    it('classifies BIM entities correctly into fixed, adaptable, and derived', () => {
        // Fixed entities
        expect(DesignIntentAnalyzer.classifyEntity({ type: 'door', width: 90, height: 210 })).toBe(ENTITY_ROLE.FIXED);
        expect(DesignIntentAnalyzer.classifyEntity({ type: 'window', width: 120, height: 120 })).toBe(ENTITY_ROLE.FIXED);
        expect(DesignIntentAnalyzer.classifyEntity({ type: 'stair', treadDepth: 25 })).toBe(ENTITY_ROLE.FIXED);
        expect(DesignIntentAnalyzer.classifyEntity({ type: 'furniture', catalogId: 'sofa_3seater' })).toBe(ENTITY_ROLE.FIXED);

        // Adaptable entities
        expect(DesignIntentAnalyzer.classifyEntity({ x: 100, y: 200 })).toBe(ENTITY_ROLE.ADAPTABLE);
        expect(DesignIntentAnalyzer.classifyEntity({ thickness: 20, startAnchor: {} })).toBe(ENTITY_ROLE.ADAPTABLE);

        // Derived entities
        expect(DesignIntentAnalyzer.classifyEntity({ type: 'roof', isRoof: true })).toBe(ENTITY_ROLE.DERIVED);
        expect(DesignIntentAnalyzer.classifyEntity({ isSlab: true })).toBe(ENTITY_ROLE.DERIVED);
    });

    it('calculates building bounds and area correctly from anchors', () => {
        const mockPlanner = {
            anchors: [
                { x: 100, y: 100 },
                { x: 1100, y: 100 },
                { x: 1100, y: 1000 },
                { x: 100, y: 1000 }
            ]
        };

        const bounds = DesignIntentAnalyzer.getBuildingBounds(mockPlanner);
        expect(bounds.minX).toBe(100);
        expect(bounds.maxX).toBe(1100);
        expect(bounds.minY).toBe(100);
        expect(bounds.maxY).toBe(1000);
        expect(bounds.width).toBe(1000);
        expect(bounds.depth).toBe(900);
        expect(bounds.cx).toBe(600);
        expect(bounds.cy).toBe(550);
        expect(bounds.areaCm2).toBe(900000);
        expect(bounds.areaSqFt).toBeCloseTo(2250, 1);
    });

    it('detects sloped roof topologies vs flat concrete roofs', () => {
        const flatPlanner = {
            roofs: [{ type: 'flat' }]
        };
        expect(DesignIntentAnalyzer.hasSlopedRoofs(flatPlanner)).toBe(false);

        const gablePlanner = {
            roofs: [{ type: 'gable' }]
        };
        expect(DesignIntentAnalyzer.hasSlopedRoofs(gablePlanner)).toBe(true);

        const hipPlanner = {
            roofs: [{ type: 'hip' }]
        };
        expect(DesignIntentAnalyzer.hasSlopedRoofs(hipPlanner)).toBe(true);
    });

    it('calculates safe opening clearances and prevents miter clipping', () => {
        // Wall is 300 cm, door is 90 cm, clearance is 10 cm
        // Minimum distance from wall start: 45 + 10 = 55 cm -> tMin = 55 / 300 = ~0.183
        // Maximum distance from wall start: 300 - 55 = 245 cm -> tMax = 245 / 300 = ~0.817

        // Case 1: Door at t = 0.5 (middle) -> stays 0.5
        const res1 = DesignIntentAnalyzer.calculateSafeOpeningT(300, 90, 0.5, 10);
        expect(res1.fits).toBe(true);
        expect(res1.clampedT).toBe(0.5);

        // Case 2: Door near start at t = 0.05 -> clamped to tMin
        const res2 = DesignIntentAnalyzer.calculateSafeOpeningT(300, 90, 0.05, 10);
        expect(res2.fits).toBe(true);
        expect(res2.clampedT).toBeCloseTo(55 / 300, 3);

        // Case 3: Door near end at t = 0.95 -> clamped to tMax
        const res3 = DesignIntentAnalyzer.calculateSafeOpeningT(300, 90, 0.95, 10);
        expect(res3.fits).toBe(true);
        expect(res3.clampedT).toBeCloseTo(245 / 300, 3);

        // Case 4: Wall shrunk to 100 cm (smaller than 90 + 20 = 110 cm) -> does not fit
        const res4 = DesignIntentAnalyzer.calculateSafeOpeningT(100, 90, 0.5, 10);
        expect(res4.fits).toBe(false);
    });

    it('performs comprehensive architectural analysis', () => {
        const mockWall = {
            widgets: [
                { type: 'door', width: 90, height: 210, elevation: 0, t: 0.5 }
            ]
        };

        const mockPlanner = {
            walls: [mockWall],
            anchors: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 500 }, { x: 0, y: 500 }],
            roofs: [{ type: 'flat' }],
            rooms: [
                { name: 'Living Room', path: [] },
                { name: 'Bathroom', path: [] }
            ],
            furniture: [{ id: 'f1', type: 'furniture' }],
            stairs: [{ id: 's1', type: 'stair' }]
        };

        const analysis = DesignIntentAnalyzer.analyze(mockPlanner);
        expect(analysis.wallCount).toBe(1);
        expect(analysis.anchorCount).toBe(4);
        expect(analysis.openings.length).toBe(1);
        expect(analysis.openings[0].isDoor).toBe(true);
        expect(analysis.openings[0].width).toBe(90);
        expect(analysis.hasSlopedRoofs).toBe(false);
        expect(analysis.rooms.find(r => r.name === 'Living Room').isSecondary).toBe(false);
        expect(analysis.rooms.find(r => r.name === 'Bathroom').isSecondary).toBe(true);
    });
});
