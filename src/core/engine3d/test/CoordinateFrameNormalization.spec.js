import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { EnvironmentBuilder } from '../EnvironmentBuilder.js';
import { VerticalPropagationEngine } from '../../vertical/VerticalPropagationEngine.js';
import { FloorSlabEngine } from '../../floor/FloorSlabEngine.js';

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

describe('Phase 5: Coordinate Frame Normalization & Elevation Dependencies', () => {
    let mockCtx;
    let envBuilder;

    beforeEach(() => {
        mockCtx = {
            scene: new THREE.Scene(),
            structureGroup: new THREE.Group(),
            staticStructureGroup: new THREE.Group(),
            interactables: [],
            assets: {
                getTexture: () => Promise.resolve(new THREE.Texture())
            },
            helpers: {}
        };
        envBuilder = new EnvironmentBuilder(mockCtx);
        envBuilder.setupBaseEnvironment();
    });

    describe('Ground Plane & Substructure Level Visibility', () => {
        it('lowers ground plane and grid when viewing substructure / negative elevation level', () => {
            expect(envBuilder.ground.position.y).toBe(-0.5);
            expect(envBuilder.grid.position.y).toBe(-0.05);

            // Active level is foundation at Y = -40
            envBuilder.updateGroundElevation(-40, -40, { type: 'foundation', height: 40 });
            expect(envBuilder.ground.position.y).toBe(-40.5);
            expect(envBuilder.grid.position.y).toBe(-40.05);

            // Active level is basement at Y = -240
            envBuilder.updateGroundElevation(-240, -240, { type: 'basement', height: 240 });
            expect(envBuilder.ground.position.y).toBe(-240.5);
            expect(envBuilder.grid.position.y).toBe(-240.05);
        });

        it('restores ground plane to -0.5 when returning to ground or upper levels', () => {
            // First lower to foundation
            envBuilder.updateGroundElevation(-40, -40, { type: 'foundation' });
            expect(envBuilder.ground.position.y).toBe(-40.5);

            // Return to ground floor
            envBuilder.updateGroundElevation(0, -40, { type: 'ground', height: 280 });
            expect(envBuilder.ground.position.y).toBe(-0.5);
            expect(envBuilder.grid.position.y).toBe(-0.05);

            // Switch to upper floor at Y = 280
            envBuilder.updateGroundElevation(280, -40, { type: 'upper', height: 280 });
            expect(envBuilder.ground.position.y).toBe(-0.5);
            expect(envBuilder.grid.position.y).toBe(-0.05);
        });
    });

    describe('Deterministic Level Group Elevation Tracking', () => {
        it('positions static floor groups using floorGroup.userData.levelIndex regardless of missing or filtered levels', () => {
            const groupLvl0 = new THREE.Group();
            groupLvl0.userData = { isFloorGroup: true, levelIndex: 0 };

            const groupLvl2 = new THREE.Group();
            groupLvl2.userData = { isFloorGroup: true, levelIndex: 2 }; // Notice levelIndex 1 is skipped (e.g. hidden level)

            mockCtx.staticStructureGroup.add(groupLvl0);
            mockCtx.staticStructureGroup.add(groupLvl2);

            const mockPlanner = {
                engine3d: mockCtx,
                activeLevelIndex: 3,
                levels: [
                    { id: 'lvl_0', elevation: 0, height: 280 },
                    { id: 'lvl_1', elevation: 280, height: 280, isVisible: false },
                    { id: 'lvl_2', elevation: 560, height: 280 },
                    { id: 'lvl_3', elevation: 840, height: 280 }
                ]
            };

            mockCtx.envBuilder = envBuilder;

            VerticalPropagationEngine.sync3DLevelElevations(mockPlanner, mockPlanner.levels);

            // Active structureGroup moved to Level 3 (840)
            expect(mockCtx.structureGroup.position.y).toBe(840);

            // Static floor groups positioned by their exact levelIndex, not sequential array indices
            expect(groupLvl0.position.y).toBe(0);
            expect(groupLvl2.position.y).toBe(560);
        });
    });

    describe('Static Floor Slab Delegation to FloorSlabEngine', () => {
        it('buildStaticFloors delegates room geometry creation to FloorSlabEngine and attaches userData', () => {
            const levelsConfigArray = [
                {
                    id: 'lvl_0',
                    height: 280,
                    data: {
                        rooms: [
                            {
                                id: 'room_ground',
                                configId: 'hardwood',
                                thickness: 2,
                                path: [
                                    { x: 0, y: 0 },
                                    { x: 400, y: 0 },
                                    { x: 400, y: 300 },
                                    { x: 0, y: 300 }
                                ]
                            }
                        ]
                    }
                },
                {
                    id: 'lvl_1',
                    height: 280,
                    data: {}
                }
            ];

            // Build static floors for activeIndex = 1 (Level 1 active, Level 0 is static)
            envBuilder.buildStaticFloors(levelsConfigArray, 1, 'full-edit');

            // Find created static floor group
            expect(mockCtx.interactables.length).toBeGreaterThan(0);
            const floorMesh = mockCtx.interactables.find(m => m.userData?.isFloorTrigger);
            expect(floorMesh).toBeDefined();
            expect(floorMesh.userData.levelIndex).toBe(0);
            expect(floorMesh.geometry).toBeInstanceOf(THREE.ExtrudeGeometry);
        });
    });
});
