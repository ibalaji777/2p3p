import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { PlatformInteractiveSuite } from '../PlatformInteractiveSuite.js';
import { WallInteractiveSuite } from '../WallInteractiveSuite.js';
import { RoomInteractiveSuite } from '../RoomInteractiveSuite.js';
import { Stair3DPlacementSystem } from '../Stair3DPlacementSystem.js';

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
            measureText: () => ({ width: 10 })
        });
    }
});

describe('Interactive Suites Compact HUD & Responsive Tooltip System', () => {
    let mockCtx;
    let domElement;
    let camera;

    beforeEach(() => {
        domElement = document.createElement('div');
        domElement.getBoundingClientRect = () => ({
            left: 0,
            top: 0,
            right: 800,
            bottom: 600,
            width: 800,
            height: 600
        });

        camera = new THREE.PerspectiveCamera(45, 800 / 600, 1, 1000);
        camera.position.set(0, 300, 600);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);

        mockCtx = {
            renderer: { domElement },
            camera,
            scene: new THREE.Scene(),
            controls: { addEventListener: vi.fn(), removeEventListener: vi.fn(), enabled: true },
            requestRender: vi.fn(),
            realtimeUpdate: { markDirty: vi.fn() },
            planner: {
                walls: [],
                rooms: [],
                platforms: [],
                syncAll: vi.fn(),
                debouncedSaveHistory: vi.fn()
            }
        };
    });

    describe('PlatformInteractiveSuite', () => {
        let suite;

        beforeEach(() => {
            suite = new PlatformInteractiveSuite(mockCtx);
        });

        afterEach(() => {
            suite.destroy();
        });

        it('should initialize compact pill HUD with responsive tooltip', () => {
            expect(suite.domHUD).toBeDefined();
            expect(suite.tooltip).toBeDefined();

            suite._showTooltip('Move Platform', 200, 150, 'Drag across grid');
            expect(suite.tooltip.style.display).toBe('block');
            expect(suite.tooltip.innerHTML).toContain('Move Platform');
            expect(suite.tooltip.innerHTML).toContain('Drag across grid');

            suite._hideTooltip();
            expect(suite.tooltip.style.display).toBe('none');

            suite._showMicroFeedback('Trim: Bullnose', 200, 150);
            expect(suite.tooltip.style.display).toBe('block');
            expect(suite.tooltip.innerHTML).toContain('Trim: Bullnose');
        });

        it('should safely clamp HUD coordinates within viewport bounds on update', () => {
            const mockPlatform = {
                id: 'plt_1',
                type: 'platform',
                x: 0,
                y: 0,
                width: 200,
                height: 20,
                trimStyle: 'flat',
                stepHeight: 15,
                rotation: 0,
                planner: mockCtx.planner,
                setHeight: vi.fn(),
                _sync3DTransform: vi.fn()
            };
            const mockGroup = new THREE.Group();
            mockGroup.userData = { entity: mockPlatform };

            suite.attach(mockGroup);
            suite.update();

            const leftPx = parseFloat(suite.domHUD.style.left);
            const topPx = parseFloat(suite.domHUD.style.top);

            expect(leftPx).toBeGreaterThanOrEqual(12);
            expect(leftPx).toBeLessThanOrEqual(800);
            expect(topPx).toBeGreaterThanOrEqual(52);
        });
    });

    describe('WallInteractiveSuite', () => {
        let suite;

        beforeEach(() => {
            suite = new WallInteractiveSuite(mockCtx);
        });

        afterEach(() => {
            suite.dispose();
        });

        it('should initialize compact HUD and confirm bar with tooltips attached', () => {
            expect(suite.domHUD).toBeDefined();
            expect(suite.domConfirmBar).toBeDefined();
            expect(suite.tooltip).toBeDefined();

            suite._showTooltip('Push / Pull Thickness', 100, 200, 'Adjust wall thickness');
            expect(suite.tooltip.style.display).toBe('block');
            expect(suite.tooltip.innerHTML).toContain('Push / Pull Thickness');
            expect(suite.tooltip.innerHTML).toContain('Adjust wall thickness');

            suite._hideTooltip();
            expect(suite.tooltip.style.display).toBe('none');
        });

        it('should clamp HUD at safe top offset to clear app header and viewcube', () => {
            const mockWall = {
                id: 'w_1',
                startX: 0,
                startY: 0,
                endX: 300,
                endY: 0,
                thickness: 20,
                height: 280
            };
            const mockMesh = new THREE.Mesh(new THREE.BoxGeometry(100, 100, 100));
            mockMesh.userData = { entity: mockWall };

            suite.attach(mockMesh, 'menu');

            const leftPx = parseFloat(suite.domHUD.style.left);
            const topPx = parseFloat(suite.domHUD.style.top);

            expect(leftPx).toBeGreaterThan(0);
            expect(topPx).toBeGreaterThanOrEqual(52); // Safe top clearance
            expect(suite.domHUD.style.display).toBe('flex');
        });
    });

    describe('RoomInteractiveSuite', () => {
        let suite;

        beforeEach(() => {
            suite = new RoomInteractiveSuite(mockCtx);
        });

        afterEach(() => {
            suite.dispose();
        });

        it('should initialize compact speech HUD, building rise HUD, and tooltip system', () => {
            expect(suite.domRoomHUD).toBeDefined();
            expect(suite.domBuildingHUD).toBeDefined();
            expect(suite.domTooltip).toBeDefined();

            suite._showTooltip('Wall Height Mode', 300, 250, 'Adjust height of room walls');
            expect(suite.domTooltip.style.display).toBe('block');
            expect(suite.domTooltip.innerHTML).toContain('Wall Height Mode');
            expect(suite.domTooltip.innerHTML).toContain('Adjust height of room walls');

            suite._hideTooltip();
            expect(suite.domTooltip.style.display).toBe('none');
        });

        it('should update HUD position with safe boundary margins and flip below when tight', () => {
            const mockRoom = {
                id: 'room_1',
                cx: 0,
                cy: 0,
                path: [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }],
                elevation: 0,
                platformHeight: 0
            };
            suite.room = mockRoom;
            suite.visible = true;

            suite.updateHUDPosition();

            const leftPx = parseFloat(suite.domRoomHUD.style.left);
            const topPx = parseFloat(suite.domRoomHUD.style.top);

            expect(leftPx).toBeGreaterThanOrEqual(12);
            expect(leftPx).toBeLessThanOrEqual(800);
            expect(topPx).toBeGreaterThanOrEqual(52);
            expect(suite.domRoomHUD.style.display).toBe('flex');
        });

        it('should structure submenus at the bottom instead of side and manage visibility dynamically', () => {
            expect(suite.bottomSubmenuContainer).toBeDefined();
            expect(suite.bottomSubmenuContainer.className).toBe('sms4-room-bottom-submenu');
            expect(suite.roomBadge).toBeDefined();
            expect(suite.heightPills).toBeDefined();
            expect(suite.roomActionsContainer).toBeDefined();

            // Height pills and room actions must reside in bottom submenu
            expect(suite.bottomSubmenuContainer.contains(suite.heightPills)).toBe(true);
            expect(suite.bottomSubmenuContainer.contains(suite.roomActionsContainer)).toBe(true);

            // In room scope with wall mode: both height pills and room actions visible in bottom container
            suite.scopeMode = 'room';
            suite.targetAdjustMode = 'wall';
            suite._updateHUDControls();
            expect(suite.heightPills.style.display).toBe('flex');
            expect(suite.roomActionsContainer.style.display).toBe('flex');
            expect(suite.bottomSubmenuContainer.style.display).toBe('flex');

            // In building scope with wall mode: height pills visible, room actions hidden
            suite.scopeMode = 'building';
            suite.targetAdjustMode = 'wall';
            suite._updateHUDControls();
            expect(suite.heightPills.style.display).toBe('flex');
            expect(suite.roomActionsContainer.style.display).toBe('none');
            expect(suite.bottomSubmenuContainer.style.display).toBe('flex');

            // In building scope with foundation mode: both submenus hidden, bottom container hidden
            suite.scopeMode = 'building';
            suite.targetAdjustMode = 'foundation';
            suite._updateHUDControls();
            expect(suite.heightPills.style.display).toBe('none');
            expect(suite.roomActionsContainer.style.display).toBe('none');
            expect(suite.bottomSubmenuContainer.style.display).toBe('none');
        });

        it('should strictly hide room HUD when in 2D viewMode', () => {
            const mockRoom = {
                id: 'room_2d_test',
                cx: 100,
                cy: 100,
                path: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }, { x: 0, y: 200 }],
                elevation: 0,
                platformHeight: 0
            };
            suite.room = mockRoom;
            suite.visible = true;

            // In 2D viewmode
            mockCtx.viewMode = '2d';
            suite.updateHUDPosition();
            expect(suite.domRoomHUD.style.display).toBe('none');

            suite.update();
            expect(suite.domRoomHUD.style.display).toBe('none');
        });
    });

    describe('Sims 4 Speech HUD Standard Compliance (Wall & Stair Placement)', () => {
        it('should ensure WallInteractiveSuite uses vector SVGs without emojis and borderless close button', () => {
            const suite = new WallInteractiveSuite(mockCtx);
            expect(suite.domHUD).toBeDefined();

            // Verify action buttons have <svg> line art and no emojis
            const buttons = suite.domHUD.querySelectorAll('.sms4-wall-hud-buttons button');
            expect(buttons.length).toBeGreaterThanOrEqual(7);
            buttons.forEach(btn => {
                expect(btn.innerHTML).toContain('<svg');
                expect(btn.textContent).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u); // No emoji Unicode ranges
            });

            // Verify fixed close button is borderless (no border outline, transparent background)
            const closeBtn = suite.domHUD.querySelector('button[title*="Deselect"]');
            expect(closeBtn).toBeDefined();
            expect(closeBtn.style.cssText).not.toContain('solid');
            expect(closeBtn.style.cssText).toContain('background: transparent');

            // Verify confirm bar has vector Done pill and single close button
            expect(suite.domConfirmBar).toBeDefined();
            const doneBtn = suite.domConfirmBar.querySelector('button[title*="Apply"]');
            expect(doneBtn).toBeDefined();
            expect(doneBtn.innerHTML).toContain('<svg');
            expect(doneBtn.textContent).toContain('Done');

            suite.dispose();
        });

        it('should ensure Stair3DPlacementSystem uses vector SVGs and borderless close button', () => {
            const placement = new Stair3DPlacementSystem(mockCtx, {});
            placement.createBadgeDOM();

            const badgeDom = document.getElementById('sms4-stair-placement-badge');
            expect(badgeDom).toBeDefined();

            // Check cancel button is borderless
            const cancelBtn = badgeDom.querySelector('#stair-ui-btn-cancel');
            expect(cancelBtn).toBeDefined();
            expect(cancelBtn.style.cssText).not.toContain('solid');
            expect(cancelBtn.style.cssText).toContain('background: transparent');

            // Check Auto, Rotate, Place buttons contain SVGs
            const autoBtn = badgeDom.querySelector('#stair-ui-btn-auto');
            const rotBtn = badgeDom.querySelector('#stair-ui-btn-rot');
            const placeBtn = badgeDom.querySelector('#stair-ui-btn-place');

            expect(autoBtn.innerHTML).toContain('<svg');
            expect(rotBtn.innerHTML).toContain('<svg');
            expect(placeBtn.innerHTML).toContain('<svg');
            expect(placeBtn.textContent).toContain('Place');

            if (badgeDom.parentElement) {
                badgeDom.parentElement.removeChild(badgeDom);
            }
        });
    });
});
