import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import * as THREE from 'three';
import { WallFactory } from '../../wall/wall.factory.js';
import { WALL_REGISTRY } from '../../wall/wall.registry.js';
import { WallSerializer } from '../../wall/wall.serializer.js';
import { PremiumWall } from '../../wall/wall.renderer2d.js';
import { Railing } from '../objects/Railing.js';
import { Railing3DBuilder } from '../builders/Railing3DBuilder.js';
import { RAILING_REGISTRY, getRailingConfig } from '../registry/railing.registry.js';
import { PathGenerator } from '../generators/PathGenerator.js';
import { UniversalRailingGenerator } from '../generators/UniversalRailingGenerator.js';
import { ComponentRegistry } from '../../../core/engine3d/ComponentRegistry.js';

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
            clip: () => {}
        });
    }
});

describe('Railing Subsystem - Centralized Architecture', () => {
    let mockPlanner;
    let a1, a2;

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
                    position: () => ({ x, y }),
                    show: () => {},
                    hide: () => {}
                };
                anchors.push(newA);
                return newA;
            },
            syncAll: () => {}
        };

        a1 = mockPlanner.getOrCreateAnchor(0, 0);
        a2 = mockPlanner.getOrCreateAnchor(100, 0);
    });

    describe('1. Canonical Railing Wall Creation via WallFactory', () => {
        it('should create a PremiumWall with type railing and default configId', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                addToPlanner: true
            });

            expect(railing).toBeInstanceOf(PremiumWall);
            expect(railing.type).toBe('railing');
            expect(railing.configId).toBe('glass_stainless');
            expect(mockPlanner.walls).toContain(railing);
            expect(railing.getLength()).toBe(100);
        });

        it('should accept custom configId during creation', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                configId: 'metal_vertical',
                addToPlanner: true
            });

            expect(railing.type).toBe('railing');
            expect(railing.configId).toBe('metal_vertical');
        });

        it('should respect thickness and elevation parameters', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                thickness: 3,
                elevation: 40,
                addToPlanner: false
            });

            expect(railing.thickness).toBe(3);
            expect(railing.elevation).toBe(40);
        });
    });

    describe('2. Backward Compatibility via Railing Adapter Class', () => {
        it('should instantiate Railing as an extension of PremiumWall', () => {
            const legacyRailing = new Railing(mockPlanner, a1, a2);

            expect(legacyRailing).toBeInstanceOf(PremiumWall);
            expect(legacyRailing.type).toBe('railing');
            expect(legacyRailing.configId).toBe('glass_stainless');
            expect(typeof legacyRailing.getLength).toBe('function');
            expect(legacyRailing.getLength()).toBe(100);
        });

        it('should update configuration and dimensions via setConfig', () => {
            const legacyRailing = new Railing(mockPlanner, a1, a2);
            legacyRailing.setConfig('wood_classic');

            expect(legacyRailing.configId).toBe('wood_classic');
            expect(legacyRailing.config.name).toBe('Classic Wood Balusters');
            expect(legacyRailing.thickness).toBe(RAILING_REGISTRY['wood_classic'].thickness);
            expect(legacyRailing.height).toBe(RAILING_REGISTRY['wood_classic'].height);
        });
    });

    describe('3. Canonical Serialization & Deserialization Pipeline', () => {
        it('should serialize railing wall properties accurately', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                configId: 'glass_wood_modern',
                elevation: 100,
                thickness: 2,
                addToPlanner: true
            });

            const serialized = WallSerializer.serialize(railing);

            expect(serialized.type).toBe('railing');
            expect(serialized.configId).toBe('glass_wood_modern');
            expect(serialized.elevation).toBe(100);
            expect(serialized.thickness).toBe(2);
            expect(serialized.startX).toBe(0);
            expect(serialized.endX).toBe(100);
        });

        it('should deserialize serialized data back into a valid canonical railing', () => {
            const original = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                configId: 'cable_stainless',
                elevation: 50,
                addToPlanner: true
            });

            const serialized = WallSerializer.serialize(original);

            const anchorMap = new Map();
            anchorMap.set(serialized.startAnchorId, a1);
            anchorMap.set(serialized.endAnchorId, a2);

            const restored = WallSerializer.deserialize(serialized, mockPlanner, anchorMap);

            expect(restored).toBeInstanceOf(PremiumWall);
            expect(restored.type).toBe('railing');
            expect(restored.configId).toBe('cable_stainless');
            expect(restored.elevation).toBe(50);
            expect(restored.startAnchor).toBe(a1);
            expect(restored.endAnchor).toBe(a2);
        });
    });

    describe('4. 3D Procedural Railing Generation & BIM Slots', () => {
        it('should build 3D mesh group for glass railing preset', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                configId: 'glass_stainless',
                addToPlanner: true
            });

            const group = Railing3DBuilder.build(railing);

            expect(group).toBeInstanceOf(THREE.Group);
            expect(group.children.length).toBeGreaterThan(0);

            const slots = [];
            group.traverse(child => {
                if (child.isMesh && child.userData.materialSlot) {
                    slots.push(child.userData.materialSlot);
                }
            });

            expect(slots).toContain('handrail');
            expect(slots).toContain('glass');
        });

        it('should build 3D mesh group for metal baluster preset', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                configId: 'metal_vertical',
                addToPlanner: true
            });

            const group = Railing3DBuilder.build(railing);

            expect(group).toBeInstanceOf(THREE.Group);
            expect(group.children.length).toBeGreaterThan(0);

            const slots = [];
            group.traverse(child => {
                if (child.isMesh && child.userData.materialSlot) {
                    slots.push(child.userData.materialSlot);
                }
            });

            expect(slots).toContain('handrail');
            expect(slots).toContain('balusters');
        });

        it('should build 3D mesh group for cable railing preset', () => {
            const railing = WallFactory.createWall(mockPlanner, {
                startAnchor: a1,
                endAnchor: a2,
                type: 'railing',
                configId: 'cable_stainless',
                addToPlanner: true
            });

            const group = Railing3DBuilder.build(railing);

            expect(group).toBeInstanceOf(THREE.Group);
            expect(group.children.length).toBeGreaterThan(0);

            const slots = [];
            group.traverse(child => {
                if (child.isMesh && child.userData.materialSlot) {
                    slots.push(child.userData.materialSlot);
                }
            });

            expect(slots).toContain('handrail');
            expect(slots).toContain('balusters');
        });
    });

    describe('5. Path Normalization & Sloped Stair Railing', () => {
        it('should normalize linear 3D paths correctly', () => {
            const start = new THREE.Vector3(0, 0, 0);
            const end = new THREE.Vector3(100, 50, 0);
            const path = PathGenerator.normalizeLinear(start, end);

            expect(path.type).toBe('linear');
            expect(path.length).toBeCloseTo(Math.hypot(100, 50));
            expect(path.direction.x).toBeGreaterThan(0);
        });

        it('should generate sloped railings with sheared balusters for stairs', () => {
            const start = new THREE.Vector3(0, 0, 0);
            const end = new THREE.Vector3(100, 50, 0);
            const config = RAILING_REGISTRY['metal_vertical'];

            const group = Railing3DBuilder.build3D(start, end, config);

            expect(group).toBeInstanceOf(THREE.Group);
            expect(group.children.length).toBeGreaterThan(0);
        });
    });
});
