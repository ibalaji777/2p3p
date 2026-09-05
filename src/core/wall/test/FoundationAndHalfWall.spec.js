import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { WALL_REGISTRY } from '../../../features/wall/wall.registry.js';
import { getMenuCategories } from '../../config/menuCategories.js';
import { WallEngine } from '../WallEngine.js';
import { WallReformer } from '../../engine2d/WallReformer.js';

beforeAll(() => {
    if (typeof HTMLCanvasElement !== 'undefined') {
        HTMLCanvasElement.prototype.getContext = () => ({
            clearRect: () => {},
            fillRect: () => {},
            getImageData: () => ({ data: new Uint8ClampedArray(4) }),
            putImageData: () => {},
            createImageData: () => ({ data: new Uint8ClampedArray(4) }),
            setTransform: () => {},
            drawImage: () => {},
            save: () => {},
            fillText: () => {},
            restore: () => {},
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            closePath: () => {},
            stroke: () => {},
            fill: () => {},
            measureText: () => ({ width: 50 }),
            transform: () => {},
            rect: () => {},
            clip: () => {},
        });
    }
});

describe('Foundation & Half-Wall Architecture (Sims 4)', () => {
    let mockPlanner;

    beforeEach(() => {
        const anchors = [];
        const walls = [];

        mockPlanner = {
            walls,
            anchors,
            wallLayer: { add: () => {} },
            uiLayer: { add: () => {}, batchDraw: () => {} },
            mainLayer: { batchDraw: () => {} },
            stage: { batchDraw: () => {} },
            getOrCreateAnchor: (x, y) => {
                let existing = anchors.find(a => Math.hypot(a.x - x, a.y - y) < 2.0);
                if (existing) return existing;
                const newA = {
                    x, y,
                    position: function(p) {
                        if (p) { this.x = p.x; this.y = p.y; return this; }
                        return { x: this.x, y: this.y };
                    },
                    getConnectedWalls: () => walls.filter(w => w.startAnchor === newA || w.endAnchor === newA)
                };
                anchors.push(newA);
                return newA;
            },
            recalculateWallsGeometry: () => {
                walls.forEach(w => WallEngine.recalculateGeometry(w));
            }
        };
    });

    describe('WALL_REGISTRY Configuration', () => {
        it('should have foundation wall registered with 240mm thickness and 40cm height', () => {
            const config = WALL_REGISTRY['foundation'];
            expect(config).toBeDefined();
            expect(config.type).toBe('foundation');
            expect(config.thickness).toBe(24);
            expect(config.height).toBe(40);
            expect(config.material).toBe('stone_ashlar_grey');
            expect(config.events).toContain('proximity_highlight');
        });

        it('should have foundation_box registered with 240mm thickness and 40cm height', () => {
            const config = WALL_REGISTRY['foundation_box'];
            expect(config).toBeDefined();
            expect(config.type).toBe('foundation_box');
            expect(config.thickness).toBe(24);
            expect(config.height).toBe(40);
            expect(config.material).toBe('stone_ashlar_grey');
        });

        it('should have half_wall registered with 100mm thickness and 50cm height', () => {
            const config = WALL_REGISTRY['half_wall'];
            expect(config).toBeDefined();
            expect(config.type).toBe('half_wall');
            expect(config.thickness).toBe(10);
            expect(config.height).toBe(50);
            expect(config.events).toContain('proximity_highlight');
        });

        it('should provide 3D renderers for preview thumbnail generation', () => {
            const scene = new THREE.Group();
            expect(typeof WALL_REGISTRY['foundation'].render3D).toBe('function');
            const foundMesh = WALL_REGISTRY['foundation'].render3D(scene, {}, {});
            expect(foundMesh).toBeDefined();

            expect(typeof WALL_REGISTRY['foundation_box'].render3D).toBe('function');
            const foundBoxGroup = WALL_REGISTRY['foundation_box'].render3D(scene, {}, {});
            expect(foundBoxGroup).toBeDefined();

            expect(typeof WALL_REGISTRY['half_wall'].render3D).toBe('function');
            const halfWallGroup = WALL_REGISTRY['half_wall'].render3D(scene, {}, {});
            expect(halfWallGroup).toBeDefined();
        });
    });

    describe('Menu Categories & Tool Organization', () => {
        it('should house foundation and half_wall directly under walls category', () => {
            const categories = getMenuCategories();
            const wallsCat = categories.find(c => c.id === 'walls');
            expect(wallsCat).toBeDefined();
            expect(wallsCat.name).toContain('Walls');
            expect(wallsCat.icon).toContain('<polygon points="12 3 21 7 12 11 3 7"');

            const toolIds = wallsCat.tools.filter(t => !t.isDivider).map(t => t.id);
            expect(toolIds).toContain('outer');
            expect(toolIds).toContain('room_box');
            expect(toolIds).toContain('foundation');
            expect(toolIds).toContain('foundation_box');
            expect(toolIds).toContain('half_wall');
            expect(toolIds).toContain('compound');
            expect(toolIds).toContain('arc');
            expect(toolIds).toContain('wall_trim');
            expect(toolIds).toContain('skirting');
            expect(toolIds).toContain('wall_catalog');
        });
    });

    describe('Wall Creation & Parametric Attributes', () => {
        it('should instantiate foundation wall through WallEngine with default plinth parameters', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(300, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2, type: 'foundation' });
            expect(wall).toBeDefined();
            expect(wall.type).toBe('foundation');
            expect(wall.thickness).toBe(24);
            expect(wall.height).toBe(40);
            expect(wall.fillColor).toBe('#cbd5e1');
            expect(wall.strokeColor).toBe('#475569');
        });

        it('should instantiate half_wall through WallEngine with default parapet parameters', () => {
            const a1 = mockPlanner.getOrCreateAnchor(0, 0);
            const a2 = mockPlanner.getOrCreateAnchor(300, 0);
            const wall = WallEngine.createWall(mockPlanner, { startAnchor: a1, endAnchor: a2, type: 'half_wall' });
            expect(wall).toBeDefined();
            expect(wall.type).toBe('half_wall');
            expect(wall.thickness).toBe(10);
            expect(wall.height).toBe(50);
            expect(wall.fillColor).toBe('#f8fafc');
            expect(wall.strokeColor).toBe('#94a3b8');
        });

        it('should instantiate 4 interconnected foundation walls for foundation box', () => {
            const roomSegments = [
                { p1: { x: 0, y: 0 }, p2: { x: 400, y: 0 } },
                { p1: { x: 400, y: 0 }, p2: { x: 400, y: 300 } },
                { p1: { x: 400, y: 300 }, p2: { x: 0, y: 300 } },
                { p1: { x: 0, y: 300 }, p2: { x: 0, y: 0 } }
            ];

            const created = WallReformer.reformAndAddWallSegments(mockPlanner, roomSegments, 'foundation', {
                height: 40,
                thickness: 24,
                params: { material: 'stone_ashlar_grey' }
            });

            expect(created).toBeDefined();
            expect(created.length).toBe(4);
            created.forEach(w => {
                expect(w.type).toBe('foundation');
                expect(w.height).toBe(40);
                expect(w.thickness).toBe(24);
            });
        });

        it('should form walls on top of existing foundation box without skipping or deleting foundation', () => {
            const roomSegments = [
                { p1: { x: 0, y: 0 }, p2: { x: 400, y: 0 } },
                { p1: { x: 400, y: 0 }, p2: { x: 400, y: 300 } },
                { p1: { x: 400, y: 300 }, p2: { x: 0, y: 300 } },
                { p1: { x: 0, y: 300 }, p2: { x: 0, y: 0 } }
            ];

            // 1. Create foundation walls at elevation 0
            const fWalls = WallReformer.reformAndAddWallSegments(mockPlanner, roomSegments, 'foundation', {
                height: 40,
                thickness: 24,
                elevation: 0,
                params: { material: 'stone_ashlar_grey' }
            });
            expect(fWalls.length).toBe(4);
            expect(mockPlanner.walls.length).toBe(4);

            // 2. Build room box directly on top of the foundation (elevation 40)
            const roomWalls = WallReformer.reformAndAddWallSegments(mockPlanner, roomSegments, 'outer', {
                height: 120,
                thickness: 16,
                elevation: 40
            });

            expect(roomWalls).toBeDefined();
            expect(roomWalls.length).toBe(4);
            expect(mockPlanner.walls.length).toBe(8); // 4 foundation walls + 4 outer walls

            roomWalls.forEach(w => {
                expect(w.type).toBe('outer');
                expect(w.elevation).toBe(40);
                expect(w.height).toBe(120);
                expect(w.thickness).toBe(16);
            });

            // Verify foundation walls were untouched and preserved underneath
            const foundations = mockPlanner.walls.filter(w => w.type === 'foundation');
            expect(foundations.length).toBe(4);
            foundations.forEach(f => {
                expect(f.elevation).toBe(0);
                expect(f.height).toBe(40);
            });
        });

        it('should auto-elevate walls drawn on top of foundation walls when elevation is not explicitly set', () => {
            const roomSegments = [
                { p1: { x: 0, y: 0 }, p2: { x: 400, y: 0 } },
                { p1: { x: 400, y: 0 }, p2: { x: 400, y: 300 } },
                { p1: { x: 400, y: 300 }, p2: { x: 0, y: 300 } },
                { p1: { x: 0, y: 300 }, p2: { x: 0, y: 0 } }
            ];

            // 1. Create foundation walls
            WallReformer.reformAndAddWallSegments(mockPlanner, roomSegments, 'foundation', {
                height: 40,
                thickness: 24,
                elevation: 0
            });

            // 2. Add outer walls without passing elevation (e.g. from 2D room_box tool)
            const roomWalls = WallReformer.reformAndAddWallSegments(mockPlanner, roomSegments, 'outer', {
                height: 120,
                thickness: 16
            });

            expect(roomWalls.length).toBe(4);
            roomWalls.forEach(w => {
                expect(w.type).toBe('outer');
                expect(w.elevation).toBe(40); // Auto-elevated to foundation top
            });
        });
    });
});
