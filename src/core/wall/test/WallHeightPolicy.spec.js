import { describe, it, expect } from 'vitest';
import { WallHeightPolicy } from '../WallHeightPolicy.js';

describe('WallHeightPolicy Unit Tests', () => {
    it('normalizes valid and invalid numeric values', () => {
        expect(WallHeightPolicy.normalize(240)).toBe(240);
        expect(WallHeightPolicy.normalize('300')).toBe(300);
        expect(WallHeightPolicy.normalize(null, 180)).toBe(180);
        expect(WallHeightPolicy.normalize(undefined, 180)).toBe(180);
        expect(WallHeightPolicy.normalize(NaN, 180)).toBe(180);
        expect(WallHeightPolicy.normalize(Infinity, 180)).toBe(180);
        expect(WallHeightPolicy.normalize('invalid_string', 180)).toBe(180);
    });

    it('clamps values within safe architectural bounds [20, 1000]', () => {
        expect(WallHeightPolicy.clamp(10)).toBe(20);
        expect(WallHeightPolicy.clamp(0)).toBe(20);
        expect(WallHeightPolicy.clamp(-50)).toBe(20);
        expect(WallHeightPolicy.clamp(500)).toBe(500);
        expect(WallHeightPolicy.clamp(1200)).toBe(1000);
    });

    it('snaps values to step increments', () => {
        expect(WallHeightPolicy.snap(242, 5)).toBe(240);
        expect(WallHeightPolicy.snap(243, 5)).toBe(245);
        expect(WallHeightPolicy.snap(240, 5)).toBe(240);
        expect(WallHeightPolicy.snap(244.4, 1)).toBe(244);
    });

    it('processes interactive drag input (snap + clamp)', () => {
        expect(WallHeightPolicy.processDragHeight(12, 5)).toBe(20); // 12 -> 10 -> min 20
        expect(WallHeightPolicy.processDragHeight(283, 5)).toBe(285);
        expect(WallHeightPolicy.processDragHeight(1204, 5)).toBe(1000);
    });

    it('validates wall heights correctly', () => {
        expect(WallHeightPolicy.validate(240)).toBe(true);
        expect(WallHeightPolicy.validate(20)).toBe(true);
        expect(WallHeightPolicy.validate(1000)).toBe(true);
        expect(WallHeightPolicy.validate(19)).toBe(false);
        expect(WallHeightPolicy.validate(1001)).toBe(false);
        expect(WallHeightPolicy.validate(NaN)).toBe(false);
        expect(WallHeightPolicy.validate(null)).toBe(false);
        expect(WallHeightPolicy.validate('abc')).toBe(false);
    });

    it('resolves defaults based on wall type and level config', () => {
        expect(WallHeightPolicy.resolveDefault({ type: 'foundation' })).toBe(40);
        expect(WallHeightPolicy.resolveDefault({ type: 'half_wall' })).toBe(80);
        expect(WallHeightPolicy.resolveDefault({ type: 'compound' })).toBe(80);
        expect(WallHeightPolicy.resolveDefault({ type: 'outer' }, { height: 300 })).toBe(300);
        expect(WallHeightPolicy.resolveDefault(null, null)).toBe(180);
    });
});
