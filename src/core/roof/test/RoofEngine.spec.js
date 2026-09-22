import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import { RoofEngine } from '../RoofEngine.js';
import { RoofGeometryEngine } from '../RoofGeometryEngine.js';
import { RoofTopologyEngine } from '../RoofTopologyEngine.js';
import { RoofMutationEngine } from '../RoofMutationEngine.js';
import { RoofSerializer } from '../RoofSerializer.js';
import { DeleteEntityCommand } from '../../commands/DeleteEntityCommand.js';
import { CreateRoofCommand } from '../../commands/CreateRoofCommand.js';
import { UpdatePropertyCommand } from '../../commands/UpdatePropertyCommand.js';
import { ApplyMaterialCommand } from '../../commands/ApplyMaterialCommand.js';

describe('RoofEngine Subsystem', () => {
    let mockPlanner;

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
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                fill: () => {},
                scale: () => {},
                translate: () => {},
                rotate: () => {},
                arc: () => {},
                measureText: () => ({ width: 0 })
            });
        }
    });

    beforeEach(() => {
        mockPlanner = {
            roofs: [],
            walls: [],
            roofLayer: { add: vi.fn() },
            uiLayer: { add: vi.fn() },
            syncAll: vi.fn(),
            selectEntity: vi.fn(),
            debouncedSaveHistory: vi.fn(),
            stage: { batchDraw: vi.fn() },
            envBuilder: { updateRoofLive: vi.fn() }
        };
    });

    describe('RoofGeometryEngine', () => {
        it('cleans duplicate consecutive points and loop closure duplicate', () => {
            const raw = [
                { x: 0, y: 0 },
                { x: 0.2, y: 0.1 }, // duplicate (< 1px)
                { x: 100, y: 0 },
                { x: 100, y: 100 },
                { x: 0, y: 100 },
                { x: 0, y: 0 } // closure duplicate
            ];
            const cleaned = RoofGeometryEngine.cleanPoints(raw);
            expect(cleaned.length).toBe(4);
            expect(cleaned[0]).toEqual({ x: 0, y: 0 });
            expect(cleaned[1]).toEqual({ x: 100, y: 0 });
            expect(cleaned[2]).toEqual({ x: 100, y: 100 });
            expect(cleaned[3]).toEqual({ x: 0, y: 100 });
        });

        it('calculates bounds and centroid accurately', () => {
            const pts = [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 110, y: 120 }, { x: 10, y: 120 }];
            const bounds = RoofGeometryEngine.getBounds(pts);
            expect(bounds.minX).toBe(10);
            expect(bounds.maxX).toBe(110);
            expect(bounds.minY).toBe(20);
            expect(bounds.maxY).toBe(120);
            expect(bounds.width).toBe(100);
            expect(bounds.depth).toBe(100);
            expect(bounds.cx).toBe(60);
            expect(bounds.cy).toBe(70);

            const centroid = RoofGeometryEngine.getCentroid(pts);
            expect(Math.round(centroid.x)).toBe(60);
            expect(Math.round(centroid.y)).toBe(70);
        });

        it('calculates peak height and pitch reversibly', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            // Span = 100 (gable with ridgeAxis 'x' uses depth = 100)
            // halfSpan = 50. At pitch 45 deg, peak height = 50 * tan(45) = 50
            const height = RoofGeometryEngine.getPeakHeight(pts, 45, 'gable', 'x');
            expect(Math.round(height)).toBe(50);

            const pitch = RoofGeometryEngine.getPitchFromHeight(pts, 50, 'gable', 'x');
            expect(pitch).toBe(45);
        });

        it('automatically resolves effective ridge axis based on aspect ratio', () => {
            // Width 300, depth 100 -> ridge axis 'x'
            const wide = [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 100 }, { x: 0, y: 100 }];
            expect(RoofGeometryEngine.getEffectiveRidgeAxis(wide)).toBe('x');

            // Width 100, depth 300 -> ridge axis 'y'
            const tall = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }, { x: 0, y: 300 }];
            expect(RoofGeometryEngine.getEffectiveRidgeAxis(tall)).toBe('y');

            // Manual override preserves explicit axis
            expect(RoofGeometryEngine.getEffectiveRidgeAxis(wide, 'y', true)).toBe('y');
        });
    });

    describe('RoofTopologyEngine & Lifecycle', () => {
        it('creates a roof and registers it to planner', () => {
            const pts = [{ x: 0, y: 0 }, { x: 150, y: 0 }, { x: 150, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, { roofType: 'gable', pitch: 35 }, { elevation: 150, select: true });

            expect(roof).toBeDefined();
            expect(roof.config.roofType).toBe('gable');
            expect(roof.config.pitch).toBe(35);
            expect(roof.elevation).toBe(150);
            expect(mockPlanner.roofs).toContain(roof);
            expect(mockPlanner.selectEntity).toHaveBeenCalledWith(roof, 'roof');
        });

        it('deletes a roof and cascades cleanup', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);
            expect(mockPlanner.roofs.length).toBe(1);

            // Add dummy auto-gable
            const mockGable = { isAutoGable: true, parentRoofId: roof.id, destroy: vi.fn() };
            mockPlanner.walls.push(mockGable);

            RoofEngine.deleteRoof(mockPlanner, roof);
            expect(mockPlanner.roofs.length).toBe(0);
            expect(mockPlanner.syncAll).toHaveBeenCalled();
        });

        it('detects if point is inside roof footprint', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);
            roof.group = { x: () => 0, y: () => 0 };

            expect(RoofEngine.isPointInsideRoof(roof, 50, 50)).toBe(true);
            expect(RoofEngine.isPointInsideRoof(roof, 150, 50)).toBe(false);
        });
    });

    describe('RoofMutationEngine', () => {
        it('updates pitch and peak height in-place', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, { roofType: 'gable', pitch: 30 });

            RoofEngine.setPitch(roof, 40, mockPlanner);
            expect(roof.config.pitch).toBe(40);
            expect(mockPlanner.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);

            RoofEngine.setPeakHeight(roof, 50, mockPlanner);
            expect(roof.config.pitch).toBe(45);
        });

        it('updates overhangs master and per-edge', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            RoofEngine.setOverhang(roof, 15, null, mockPlanner);
            expect(roof.config.overhang).toBe(15);

            RoofEngine.setOverhang(roof, 25, 1, mockPlanner);
            expect(roof.config.overhangs[1]).toBe(25);
            expect(roof.config.overhangs[0]).toBe(15);
        });

        it('updates materials with scope and slopeKey', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const r1 = RoofEngine.createRoof(mockPlanner, pts);
            const r2 = RoofEngine.createRoof(mockPlanner, pts);

            RoofEngine.setMaterial(r1, 'grey_slate_roof', 'single', null, mockPlanner);
            expect(r1.config.material).toBe('grey_slate_roof');
            expect(r2.config.material).not.toBe('grey_slate_roof');

            RoofEngine.setMaterial(r1, 'blue_ceramic_tiles_roof', 'all', null, mockPlanner);
            expect(r1.config.material).toBe('blue_ceramic_tiles_roof');
            expect(r2.config.material).toBe('blue_ceramic_tiles_roof');

            RoofEngine.setMaterial(r1, 'terracotta_red_roof', 'single', 'slope1', mockPlanner);
            expect(r1.config.slopes.slope1).toBe('terracotta_red_roof');
        });

        it('manages skylights and sculptures', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            const skylight = RoofEngine.addSkylight(roof, { width: 90, length: 140 }, mockPlanner);
            expect(roof.config.skylights.length).toBe(1);
            expect(roof.config.skylights[0].width).toBe(90);

            RoofEngine.removeSkylight(roof, skylight.id, mockPlanner);
            expect(roof.config.skylights.length).toBe(0);

            const cresting = RoofEngine.addCresting(roof, { type: 'ridge_cresting_gothic_spikes' }, mockPlanner);
            expect(roof.config.crestings.length).toBe(1);
            RoofEngine.removeCresting(roof, cresting.id, mockPlanner);
            expect(roof.config.crestings.length).toBe(0);
        });

        it('updates position and thickness via RoofEngine', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);
            roof.group = { position: vi.fn(), rotation: vi.fn() };

            RoofEngine.setPosition(roof, 250, 350, mockPlanner);
            expect(roof.x).toBe(250);
            expect(roof.y).toBe(350);
            expect(roof.group.position).toHaveBeenCalledWith({ x: 250, y: 350 });

            RoofEngine.setThickness(roof, 18, mockPlanner);
            expect(roof.config.thickness).toBe(18);
        });

        it('updates fascia and gable materials via RoofEngine', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            RoofEngine.setMaterial(roof, 'wood_oak', 'fascia', 'fascia', mockPlanner);
            expect(roof.config.fasciaMaterial).toBe('wood_oak');

            RoofEngine.setMaterial(roof, 'brick_red', 'gable', 'gable', mockPlanner);
            expect(roof.config.gableMaterial).toBe('brick_red');
        });

        it('removes addons by object reference or id', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            const finial = RoofEngine.addFinial(roof, { type: 'finial_copper_spire' }, mockPlanner);
            expect(roof.config.finials.length).toBe(1);
            RoofEngine.removeFinial(roof, finial, mockPlanner);
            expect(roof.config.finials.length).toBe(0);

            const chimney = RoofEngine.addChimney(roof, { type: 'chimney_brick_traditional' }, mockPlanner);
            expect(roof.config.chimneys.length).toBe(1);
            RoofEngine.removeChimney(roof, chimney, mockPlanner);
            expect(roof.config.chimneys.length).toBe(0);
        });
    });

    describe('RoofSerializer', () => {
        it('serializes and deserializes cleanly with complete fidelity', () => {
            const pts = [{ x: 10, y: 10 }, { x: 210, y: 10 }, { x: 210, y: 110 }, { x: 10, y: 110 }];
            const original = RoofEngine.createRoof(mockPlanner, pts, {
                roofType: 'gable',
                pitch: 42,
                curve: -15,
                overhang: 12,
                material: 'grey_slate_roof',
                ridgeAxis: 'x',
                autoShapeWalls: true
            }, { elevation: 180, rotation: 45 });

            RoofEngine.addSkylight(original, { width: 80, length: 120 }, mockPlanner);

            const serialized = RoofEngine.serialize(original);
            expect(serialized.pitch).toBe(42);
            expect(serialized.curve).toBe(-15);
            expect(serialized.overhang).toBe(12);
            expect(serialized.material).toBe('grey_slate_roof');
            expect(serialized.skylights.length).toBe(1);

            const restored = RoofEngine.deserialize(serialized, mockPlanner);
            expect(restored).toBeDefined();
            expect(restored.config.pitch).toBe(42);
            expect(restored.config.curve).toBe(-15);
            expect(restored.config.overhang).toBe(12);
            expect(restored.config.material).toBe('grey_slate_roof');
            expect(restored.config.skylights.length).toBe(1);
            expect(restored.elevation).toBe(180);
            expect(restored.rotation).toBe(45);
        });
    });

    describe('Architectural Invariants & Lifecycle', () => {
        it('properly disposes 3D meshes, geometries, and materials on deletion', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);

            const disposeGeo = vi.fn();
            const disposeMat = vi.fn();
            const disposeTex = vi.fn();
            const removeFromParent = vi.fn();

            roof.mesh3D = {
                traverse: (cb) => {
                    cb({
                        geometry: { dispose: disposeGeo },
                        material: {
                            dispose: disposeMat,
                            map: { dispose: disposeTex }
                        }
                    });
                },
                parent: { remove: removeFromParent }
            };

            RoofEngine.deleteRoof(mockPlanner, roof);
            expect(disposeGeo).toHaveBeenCalled();
            expect(disposeMat).toHaveBeenCalled();
            expect(disposeTex).toHaveBeenCalled();
            expect(removeFromParent).toHaveBeenCalled();
            expect(mockPlanner.roofs).not.toContain(roof);
        });

        it('supports full undo/redo cycle via DeleteEntityCommand and RoofEngine', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, {
                roofType: 'hip',
                pitch: 35,
                material: 'red_tiles',
                thickness: 15
            }, { elevation: 200, rotation: 90 });

            const roofId = roof.id;
            expect(mockPlanner.roofs.length).toBe(1);

            const cmd = new DeleteEntityCommand(mockPlanner, roofId);
            cmd.execute();
            expect(mockPlanner.roofs.length).toBe(0);

            cmd.undo();
            expect(mockPlanner.roofs.length).toBe(1);
            const restored = mockPlanner.roofs[0];
            expect(restored.id).toBe(roofId);
            expect(restored.config.roofType).toBe('hip');
            expect(restored.config.pitch).toBe(35);
            expect(restored.config.thickness).toBe(15);
            expect(restored.config.material).toBe('red_tiles');
            expect(restored.elevation).toBe(200);
            expect(restored.rotation).toBe(90);
        });

        it('routes roof property updates and undo via UpdatePropertyCommand through RoofEngine', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, { pitch: 25, thickness: 10 });
            const roofId = roof.id;

            const cmd = new UpdatePropertyCommand(mockPlanner, roofId, {
                'config.pitch': 45,
                'config.thickness': 14,
                'config.fasciaMaterial': 'wood_dark'
            }, {
                'config.pitch': 25,
                'config.thickness': 10,
                'config.fasciaMaterial': undefined
            });

            cmd.execute();
            expect(roof.config.pitch).toBe(45);
            expect(roof.config.thickness).toBe(14);
            expect(roof.config.fasciaMaterial).toBe('wood_dark');

            cmd.undo();
            expect(roof.config.pitch).toBe(25);
            expect(roof.config.thickness).toBe(10);
        });

        it('routes roof material painting and undo via ApplyMaterialCommand through RoofEngine', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, { material: 'initial_slate' });
            const roofId = roof.id;

            const cmd = new ApplyMaterialCommand(mockPlanner, roofId, 'all', 'new_tiles', 'initial_slate');
            cmd.execute();
            expect(roof.config.material).toBe('new_tiles');

            cmd.undo();
            expect(roof.config.material).toBe('initial_slate');

            const fasciaCmd = new ApplyMaterialCommand(mockPlanner, roofId, 'fascia', 'fascia_wood', 'default_fascia');
            fasciaCmd.execute();
            expect(roof.config.fasciaMaterial).toBe('fascia_wood');
        });

        it('guarantees 2D renderer update() is pure presentation without modifying model config', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, {
                roofType: 'gable',
                pitch: 30,
                ridgeAxis: 'x',
                manualRidge: true,
                autoShapeWalls: false
            });

            const configBefore = JSON.stringify(roof.config);
            roof.update();
            const configAfter = JSON.stringify(roof.config);
            expect(configBefore).toBe(configAfter);
        });

        it('resolves 3D context and updates 3D live mesh when passed Engine3D context', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, { pitch: 30 });
            
            const mockEngine3D = {
                camera: {},
                scene: {},
                renderer: {},
                envBuilder: { updateRoofLive: vi.fn() },
                requestRender: vi.fn()
            };

            RoofEngine.setPitch(roof, 45, mockEngine3D);
            expect(roof.config.pitch).toBe(45);
            expect(mockEngine3D.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
            expect(mockEngine3D.requestRender).toHaveBeenCalled();

            RoofEngine.setCurve(roof, 20, mockEngine3D);
            expect(roof.config.curve).toBe(20);
            expect(mockEngine3D.envBuilder.updateRoofLive).toHaveBeenCalledTimes(2);

            RoofEngine.setOverhang(roof, 16, null, mockEngine3D);
            expect(roof.config.overhang).toBe(16);
            expect(mockEngine3D.envBuilder.updateRoofLive).toHaveBeenCalledTimes(3);
        });

        it('resolves 3D context through planner.engine3d when passed 2D planner', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            const mockEngine3dInstance = {
                envBuilder: { updateRoofLive: vi.fn() },
                requestRender: vi.fn()
            };
            const custom2dPlanner = {
                roofs: [],
                walls: [],
                engine3d: mockEngine3dInstance,
                stage: { batchDraw: vi.fn() },
                debouncedSaveHistory: vi.fn()
            };
            const roof = RoofEngine.createRoof(custom2dPlanner, pts, { pitch: 30 });

            RoofEngine.setPitch(roof, 38, custom2dPlanner);
            expect(roof.config.pitch).toBe(38);
            expect(mockEngine3dInstance.envBuilder.updateRoofLive).toHaveBeenCalledWith(roof);
            expect(mockEngine3dInstance.requestRender).toHaveBeenCalled();
            expect(custom2dPlanner.stage.batchDraw).toHaveBeenCalled();
        });
    });

    describe('CreateRoofCommand & Compliance Lifecycle', () => {
        it('executes, serializes on undo, and restores cleanly on redo without zombie entity', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            const cmd = new CreateRoofCommand(mockPlanner, pts, { pitch: 35, roofType: 'gable' }, 'cmd_roof_1');

            // 1. Execute
            cmd.execute();
            expect(mockPlanner.roofs.length).toBe(1);
            const created = mockPlanner.roofs[0];
            expect(created.id).toBe('cmd_roof_1');
            expect(created.config.pitch).toBe(35);
            expect(created.config.roofType).toBe('gable');
            expect(cmd.serializedState).toBeTruthy();

            // 2. Undo
            cmd.undo();
            expect(mockPlanner.roofs.length).toBe(0);
            expect(cmd.createdEntity).toBeNull();
            expect(cmd.serializedState).toBeTruthy();

            // 3. Redo
            cmd.execute();
            expect(mockPlanner.roofs.length).toBe(1);
            const redone = mockPlanner.roofs[0];
            expect(redone.id).toBe('cmd_roof_1');
            expect(redone.config.pitch).toBe(35);
            expect(redone.config.roofType).toBe('gable');
            // Pristine entity restored
            expect(redone).toBe(cmd.createdEntity);
        });

        it('mirrors addon properties to roof root and updates properly', () => {
            const pts = [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts, { pitch: 30 });

            // Cresting
            const crest = RoofEngine.addCresting(roof, { type: 'ridge_cresting_victorian_lace' }, mockPlanner);
            expect(roof.config.crestings).toContain(crest);
            expect(roof.crestings).toBe(roof.config.crestings);

            RoofEngine.removeCresting(roof, crest.id, mockPlanner);
            expect(roof.config.crestings.length).toBe(0);
            expect(roof.crestings.length).toBe(0);

            // Finial
            const finial = RoofEngine.addFinial(roof, { type: 'finial_victorian_spire' }, mockPlanner);
            expect(roof.config.finials).toContain(finial);
            expect(roof.finials).toBe(roof.config.finials);

            RoofEngine.removeFinial(roof, finial.id, mockPlanner);
            expect(roof.config.finials.length).toBe(0);
            expect(roof.finials.length).toBe(0);

            // Chimney
            const chim = RoofEngine.addChimney(roof, { width: 50 }, mockPlanner);
            expect(roof.config.chimneys).toContain(chim);
            expect(roof.chimneys).toBe(roof.config.chimneys);

            RoofEngine.removeChimney(roof, chim.id, mockPlanner);
            expect(roof.config.chimneys.length).toBe(0);
            expect(roof.chimneys.length).toBe(0);
        });

        it('supports point inside roof check with translation offset', () => {
            const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
            const roof = RoofEngine.createRoof(mockPlanner, pts);
            RoofEngine.setPosition(roof, 50, 50, mockPlanner);

            expect(RoofEngine.isPointInsideRoof(roof, 100, 100)).toBe(true);
            expect(RoofEngine.isPointInsideRoof(roof, 10, 10)).toBe(false);
        });
    });
});
