import { PRESET_REGISTRY } from './presetRegistry.js';

/**
 * Handles click/tap selection logic.
 * @param {Object} planner - The FloorPlanner instance.
 */
export function setupSelectionEvents(planner) {
        planner.stage.on("click tap", (e) => {
            if (planner.gestureManager && planner.gestureManager.isActive()) return;
            let pos = planner.getPointerPos(e) || planner.lastRawTouchPos;
            if (!pos) return;
            let snapPos = { x: planner.snap(pos.x), y: planner.snap(pos.y) };

            if (planner.tool.startsWith('preset_') && PRESET_REGISTRY[planner.tool] && planner.activePresetParams) {
                const preset = PRESET_REGISTRY[planner.tool];
                const alignData = autoAlign(planner, snapPos, planner.activePresetParams.elevation, planner.activePresetParams.depth);
                const group = preset.generate(planner, snapPos, planner.activePresetParams, alignData);
                planner.syncAll();
                planner.updateToolStates();
                planner.tool = 'select';
                if (planner.presetPreview) { planner.presetPreview.visible(false); }
                if (planner.onToolChange) planner.onToolChange('select');
                if (group) {
                    planner.selectEntity(group, 'preset_group');
                }
                return;
            }

            const isTouch = e.evt && (e.evt.changedTouches || e.evt.pointerType === 'touch');
            const isWallTool = ['outer', 'inner', 'railing', 'roof'].includes(planner.tool);

            if (isTouch && isWallTool && planner.mobileDrawState === 'ChainWaiting') {
                const scale = planner.stage.scaleX() || 1;
                const activeSnapDist = 20 / scale;
                let tappedEntity = false;

                // Don't treat a tap on the lastAnchor (red handle) as a room closure
                if (planner.lastAnchor && Math.hypot(pos.x - planner.lastAnchor.x, pos.y - planner.lastAnchor.y) < activeSnapDist * 2) {
                    return; 
                }

                if (planner.startAnchor && Math.hypot(pos.x - planner.startAnchor.x, pos.y - planner.startAnchor.y) < activeSnapDist * 3) {
                    tappedEntity = true;
                } else if (planner.anchors.some(a => a !== planner.lastAnchor && Math.hypot(a.x - pos.x, a.y - pos.y) < activeSnapDist * 1.5)) {
                    tappedEntity = true;
                } else {
                    for (let w of planner.walls) {
                        let proj = planner.getClosestPointOnSegment(pos, w.startAnchor.position(), w.endAnchor.position());
                        if (Math.hypot(pos.x - proj.x, pos.y - proj.y) < activeSnapDist) {
                            tappedEntity = true; break;
                        }
                    }
                }

                let isTap = planner.lastTouchDownPos && Math.hypot(pos.x - planner.lastTouchDownPos.x, pos.y - planner.lastTouchDownPos.y) < 10 / scale;
                if (tappedEntity || isTap) {
                    planner._executePointerDownLogic(e, pos, true);
                    planner.preview?.destroy(); planner.preview = null;
                    planner.hideInfoBadge();
                    planner.hideSnapGlow();
                    if (planner.smartGuides) planner.smartGuides.clear();
                    if (planner.drawing) {
                        planner.mobileDrawState = 'ChainWaiting';
                    } else {
                        planner.mobileDrawState = 'Idle';
                    }
                    planner.uiLayer.batchDraw();
                    return;
                }
            }
        });

}
