import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { PremiumPlatform, PLATFORM_TRIM_STYLES } from '../../engine2d/PremiumPlatform.js';
import { Platform3DBuilder } from '../Platform3DBuilder.js';
import { ComponentRegistry } from '../ComponentRegistry.js';

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

describe('Sims 4 Platform Engine & 3D BIM Pipeline', () => {
    let mockPlanner;
    let builder;

    beforeEach(() => {
        ComponentRegistry.slotRegistry.clear();
        ComponentRegistry.componentRegistry.clear();

        mockPlanner = {
            platforms: [],
            stage: {
                width: () => 1000,
                height: () => 1000
            },
            viewMode: '2d',
            syncAll: () => {},
            selectEntity: () => {},
            renderer3D: {
                updateMaterialLive: () => {}
            }
        };

        builder = new Platform3DBuilder({
            getDynamicMaterial: (matKey, type) => {
                return new THREE.MeshStandardMaterial({ name: matKey || 'default' });
            }
        });
    });

    describe('1. Platform Entity Initialization & Step Operations', () => {
        it('should initialize default rectangular platform with 1 step (+20cm)', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 120,
                depth: 120,
                height: 20,
                stepHeight: 15
            });

            expect(platform.type).toBe('platform');
            expect(platform.width).toBe(120);
            expect(platform.depth).toBe(120);
            expect(platform.height).toBe(20);
            expect(platform.stepHeight).toBe(15);
            expect(platform.trimStyle).toBe('flat');
            expect(platform.getStepCount()).toBe(1);
            expect(platform.isSunken).toBe(false);
            expect(platform.getStepBadgeText()).toContain('▲ +20cm');
        });

        it('should raise platform by step increment (+15cm)', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                height: 20,
                stepHeight: 15
            });

            platform.stepUp(15);
            expect(platform.height).toBe(35);
            expect(platform.getStepCount()).toBe(2);
            expect(platform.isSunken).toBe(false);
            expect(platform.getStepBadgeText()).toContain('▲ +35cm (2 Steps)');
        });

        it('should lower platform into negative sunken conversation pit', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                height: 10,
                stepHeight: 15
            });

            platform.stepDown(15);
            expect(platform.height).toBe(-5);
            expect(platform.isSunken).toBe(true);
            expect(platform.getStepBadgeText()).toContain('▼ -5cm (1 Step Down)');

            platform.stepDown(15);
            expect(platform.height).toBe(-20);
            expect(platform.getStepBadgeText()).toContain('▼ -20cm (1 Step Down)');

            platform.stepDown(15);
            expect(platform.height).toBe(-35);
            expect(platform.getStepBadgeText()).toContain('▼ -35cm (2 Steps Down)');
        });

        it('should support polygonal platform points', () => {
            const polyPoints = [
                { x: 0, y: 0 },
                { x: 100, y: 0 },
                { x: 120, y: 80 },
                { x: 50, y: 120 },
                { x: -20, y: 60 }
            ];

            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                shapeType: 'polygon',
                points: polyPoints,
                height: 30
            });

            expect(platform.shapeType).toBe('polygon');
            expect(platform.points.length).toBe(5);
            expect(platform.getStepCount()).toBe(2);
        });
    });

    describe('2. 3D Geometry Generation & All 6 Trim Profiles', () => {
        it('should build 3D group with top deck and riser meshes for flat trim', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 140,
                depth: 100,
                height: 30,
                trimStyle: 'flat'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeInstanceOf(THREE.Group);
            expect(platform.mesh3D).toBe(group);

            const topMesh = group.children.find(c => c.userData.isPlatformTop);
            const sideMesh = group.children.find(c => c.userData.isPlatformSide);

            expect(topMesh).toBeDefined();
            expect(sideMesh).toBeDefined();
            expect(topMesh.userData.materialSlot).toBe('top');
            expect(sideMesh.userData.materialSlot).toBe('side');
        });

        it('should generate beveled chamfer trim geometry', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 120,
                depth: 120,
                height: 25,
                trimStyle: 'beveled'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();
            const sideMesh = group.children.find(c => c.userData.isPlatformSide);
            expect(sideMesh).toBeDefined();
            expect(sideMesh.geometry).toBeDefined();
        });

        it('should generate bullnose rounded edge geometry', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 120,
                depth: 120,
                height: 25,
                trimStyle: 'bullnose'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();
            const topMesh = group.children.find(c => c.userData.isPlatformTop);
            expect(topMesh).toBeDefined();
        });

        it('should generate classical molded profile geometry', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 160,
                depth: 140,
                height: 40,
                trimStyle: 'classical'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();
            const sideMesh = group.children.find(c => c.userData.isPlatformSide);
            expect(sideMesh).toBeDefined();
        });

        it('should generate recessed_led with glowing LED strip mesh', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 150,
                depth: 150,
                height: 20,
                trimStyle: 'recessed_led'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();

            const ledMesh = group.children.find(c => c.name === 'platform_led_strip');
            expect(ledMesh).toBeDefined();
            expect(ledMesh.material.emissive).toBeDefined();
        });

        it('should generate heavy stone plinth trim geometry', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                width: 200,
                depth: 160,
                height: 35,
                trimStyle: 'stone'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();
            const sideMesh = group.children.find(c => c.userData.isPlatformSide);
            expect(sideMesh).toBeDefined();
        });

        it('should build polygonal 3D platform geometry correctly', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                shapeType: 'polygon',
                points: [
                    { x: -50, y: -50 },
                    { x: 50, y: -50 },
                    { x: 70, y: 0 },
                    { x: 50, y: 50 },
                    { x: -50, y: 50 }
                ],
                height: 25,
                trimStyle: 'flat'
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();
            const topMesh = group.children.find(c => c.userData.isPlatformTop);
            expect(topMesh).toBeDefined();
        });
    });

    describe('3. 3-Layer ComponentRegistry Architecture & Dual Material Slots', () => {
        it('should register top and side slots in ComponentRegistry', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                id: 'plat_bim_test_1',
                width: 120,
                depth: 120,
                height: 20,
                materials: {
                    top: { id: 'wood_golden_teak' },
                    side: { id: 'wood_white_oak' }
                }
            });

            const group = builder.buildPlatform(platform);
            expect(group).toBeDefined();

            const topMeshes = ComponentRegistry.getMeshesForSlot('plat_bim_test_1', 'top');
            const sideMeshes = ComponentRegistry.getMeshesForSlot('plat_bim_test_1', 'side');

            expect(topMeshes.length).toBeGreaterThanOrEqual(1);
            expect(sideMeshes.length).toBeGreaterThanOrEqual(1);
        });

        it('should update platform materials live without destroying identity', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                id: 'plat_mat_update_1',
                width: 120,
                depth: 120,
                height: 20,
                materials: {
                    top: { id: 'wood_golden_teak' },
                    side: { id: 'wood_white_oak' }
                }
            });

            const group = builder.buildPlatform(platform);
            const originalGroupId = group.id;

            // Change material slot
            platform.materials.top = { id: 'marble_nero_marquina' };
            builder.updatePlatformMaterial(platform);

            // Group reference must remain identical (CAD rule)
            expect(platform.mesh3D.id).toBe(originalGroupId);
        });
    });

    describe('4. CAD In-Place Geometry Updates', () => {
        it('should update platform geometry in place when height changes', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                id: 'plat_inplace_1',
                width: 120,
                depth: 120,
                height: 20,
                trimStyle: 'flat'
            });

            const initialGroup = builder.buildPlatform(platform);
            const initialGroupId = initialGroup.id;

            // Raise platform
            platform.height = 45;
            builder.updatePlatformGeometry(platform);

            // Verify group identity remained stable
            expect(platform.mesh3D.id).toBe(initialGroupId);

            // Verify position Y updated
            expect(platform.mesh3D.position.y).toBe(platform.elevation);
        });
    });

    describe('5. State Export & Serialization', () => {
        it('should serialize platform state with all CAD parameters', () => {
            const platform = new PremiumPlatform(mockPlanner, 'platform', {
                id: 'plat_serial_1',
                width: 150,
                depth: 130,
                height: 35,
                stepHeight: 15,
                elevation: 10,
                trimStyle: 'bullnose',
                rotation: 45,
                materials: {
                    top: { id: 'wood_dark_walnut' },
                    side: { id: 'upvc_white' }
                }
            });

            const state = platform.exportState();
            expect(state.id).toBe('plat_serial_1');
            expect(state.type).toBe('platform');
            expect(state.width).toBe(150);
            expect(state.depth).toBe(130);
            expect(state.height).toBe(35);
            expect(state.stepHeight).toBe(15);
            expect(state.elevation).toBe(10);
            expect(state.trimStyle).toBe('bullnose');
            expect(state.rotation).toBe(45);
            expect(state.materials.top.id).toBe('wood_dark_walnut');
            expect(state.materials.side.id).toBe('upvc_white');
        });
    });
});
