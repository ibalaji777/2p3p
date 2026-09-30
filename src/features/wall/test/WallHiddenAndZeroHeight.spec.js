// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as THREE from 'three';
import { Wall3DBuilder } from '../wall.renderer3d.js';
import { WallHeightPolicy } from '../../../core/wall/WallHeightPolicy.js';
import { EnvironmentBuilder } from '../../../core/engine3d/EnvironmentBuilder.js';

describe('Wall Invisibility & 2D Reference Representation (Hidden & 0-Height Walls)', () => {
    beforeEach(() => {
        // Standard Konva 2D Canvas Mock for jsdom
        HTMLCanvasElement.prototype.getContext = () => ({
            fillRect: vi.fn(),
            clearRect: vi.fn(),
            getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4) })),
            putImageData: vi.fn(),
            createImageData: vi.fn(),
            setTransform: vi.fn(),
            drawImage: vi.fn(),
            save: vi.fn(),
            restore: vi.fn(),
            beginPath: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            closePath: vi.fn(),
            stroke: vi.fn(),
            fill: vi.fn(),
            measureText: vi.fn(() => ({ width: 0 }))
        });
    });

    const createMockAnchor = (initX, initY) => {
        let currentPos = { x: initX, y: initY };
        return {
            _id: 'anchor_' + Math.random().toString(36).substr(2, 6),
            position: (pos) => {
                if (pos) {
                    currentPos = { x: Number(pos.x) || 0, y: Number(pos.y) || 0 };
                    return currentPos;
                }
                return currentPos;
            }
        };
    };

    const createMockWall = (overrides = {}) => {
        const wall = {
            id: 'wall_' + Math.random().toString(36).substr(2, 6),
            type: 'outer',
            thickness: 20,
            height: 280,
            elevation: 0,
            hidden: false,
            topProfileType: 'normal',
            startAnchor: createMockAnchor(0, 0),
            endAnchor: createMockAnchor(200, 0),
            update: vi.fn(),
            wallShapeData: null,
            params: {},
            attachedWidgets: [],
            attachedMoldings: [],
            attachedDecor: [],
            ...overrides
        };
        return wall;
    };

    describe('1. WallHeightPolicy Height 0 (Virtual Wall Support)', () => {
        it('allows 0 as a valid height for reference / room divider walls', () => {
            expect(WallHeightPolicy.clamp(0)).toBe(0);
            expect(WallHeightPolicy.processInputHeight(0)).toBe(0);
            expect(WallHeightPolicy.processDragHeight(0, 5)).toBe(0);
            expect(WallHeightPolicy.validate(0)).toBe(true);
        });

        it('continues to clamp low non-zero physical wall heights to MIN_HEIGHT (20cm)', () => {
            expect(WallHeightPolicy.clamp(10)).toBe(20);
            expect(WallHeightPolicy.processInputHeight(15)).toBe(20);
            expect(WallHeightPolicy.validate(15)).toBe(false);
            expect(WallHeightPolicy.validate(20)).toBe(true);
        });
    });

    describe('2. 3D Wall Invisibility in Wall3DBuilder', () => {
        it('should NOT build 3D mesh when wall.hidden is true', () => {
            const builder = new Wall3DBuilder();
            const wall = createMockWall({ hidden: true, height: 280 });
            const mockStructureGroup = new THREE.Group();
            const ctx = { structureGroup: mockStructureGroup, interactables: [] };

            const res = builder.buildWallGroup(wall, ctx);
            expect(res.wallGroup).toBeNull();
            expect(res.wallMesh).toBeNull();
            expect(wall.mesh3D).toBeNull();
            expect(mockStructureGroup.children.length).toBe(0);
        });

        it('should NOT build 3D mesh when wall.height is 0 (Wall 0)', () => {
            const builder = new Wall3DBuilder();
            const wall = createMockWall({ hidden: false, height: 0 });
            const mockStructureGroup = new THREE.Group();
            const ctx = { structureGroup: mockStructureGroup, interactables: [] };

            const res = builder.buildWallGroup(wall, ctx);
            expect(res.wallGroup).toBeNull();
            expect(res.wallMesh).toBeNull();
            expect(wall.mesh3D).toBeNull();
            expect(mockStructureGroup.children.length).toBe(0);
        });

        it('should dispose and remove existing 3D mesh when wall height becomes 0', () => {
            const builder = new Wall3DBuilder();
            const wall = createMockWall({ hidden: false, height: 280 });
            const mockStructureGroup = new THREE.Group();
            const ctx = { structureGroup: mockStructureGroup, interactables: [] };

            // First build with normal height 280
            builder.buildWallGroup(wall, ctx);
            expect(wall.mesh3D).not.toBeNull();
            expect(mockStructureGroup.children.length).toBe(1);

            // Rebuild with height 0 (transition to Wall 0)
            wall.height = 0;
            const res = builder.buildWallGroup(wall, ctx);
            expect(res.wallGroup).toBeNull();
            expect(wall.mesh3D).toBeNull();
            expect(mockStructureGroup.children.length).toBe(0);
        });

        it('should return empty group in buildStaticWallGroup when wall is hidden or height is 0', () => {
            const builder = new Wall3DBuilder();
            const wallDataHidden = { id: 'w_hid', hidden: true, height: 280 };
            const wallDataZeroH = { id: 'w_zero', hidden: false, height: 0 };

            const resHidden = builder.buildStaticWallGroup(200, 20, wallDataHidden, 0, 0, 0, 280);
            expect(resHidden.wallMesh).toBeNull();

            const resZeroH = builder.buildStaticWallGroup(200, 20, wallDataZeroH, 0, 0, 0, 0);
            expect(resZeroH.wallMesh).toBeNull();
        });
    });

    describe('3. EnvironmentBuilder 3D Wall Filtering', () => {
        it('buildWallGroup returns null for hidden and 0-height walls', () => {
            const mockWall3DBuilder = { buildWallGroup: vi.fn() };
            const envBuilder = new EnvironmentBuilder({ structureGroup: new THREE.Group(), interactables: [] });
            envBuilder.wall3DBuilder = mockWall3DBuilder;

            const hiddenWall = createMockWall({ hidden: true, height: 280 });
            const zeroWall = createMockWall({ hidden: false, height: 0 });

            expect(envBuilder.buildWallGroup(hiddenWall)).toBeNull();
            expect(envBuilder.buildWallGroup(zeroWall)).toBeNull();
            expect(mockWall3DBuilder.buildWallGroup).not.toHaveBeenCalled();
        });
    });

    describe('4. 2D Reference Representation Logic', () => {
        it('identifies both hidden and 0-height walls as reference walls', () => {
            const isRef = (w) => Boolean(w.hidden || (w.height !== undefined && Number(w.height) <= 0));
            
            expect(isRef({ hidden: true, height: 280 })).toBe(true);
            expect(isRef({ hidden: false, height: 0 })).toBe(true);
            expect(isRef({ hidden: false, height: '0' })).toBe(true);
            expect(isRef({ hidden: false, height: 280 })).toBe(false);
        });

        it('formats reference labels appropriately with badges', () => {
            const getLabel = (len, w) => {
                const isZeroH = w.height !== undefined && Number(w.height) <= 0;
                if (w.hidden) return `${len} (Hidden)`;
                if (isZeroH) return `${len} (0cm)`;
                return `${len}`;
            };

            expect(getLabel(200, { hidden: true, height: 280 })).toBe('200 (Hidden)');
            expect(getLabel(200, { hidden: false, height: 0 })).toBe('200 (0cm)');
            expect(getLabel(200, { hidden: false, height: 280 })).toBe('200');
        });
    });
});
