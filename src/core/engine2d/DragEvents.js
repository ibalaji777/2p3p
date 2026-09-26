import { TransformEngine } from '../transform/TransformEngine.js';
import { WallCollisionEngine } from '../wall/WallCollisionEngine.js';

/**
 * Handles all drag-related events for the 2D Engine.
 * @param {Object} planner - The FloorPlanner instance.
 */
export function setupDragEvents(planner) {
    let activeDragEntity = null;
    let dragStartPos2D = null;

    planner.stage.on('dragstart', (e) => {
        if (e.target === planner.stage) {
            planner.stage.container().style.cursor = 'grabbing';
            return;
        }

        if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
            const id = e.target.id() || (e.target.parent && e.target.parent.id());
            const entity = planner.getEntities().find(ent => ent.id === id || (ent.group && ent.group.id() === id));
            if (entity && entity.group) {
                activeDragEntity = entity;
                dragStartPos2D = { id: id, x: entity.group.x(), y: entity.group.y() };
                TransformEngine.startSession(entity, 'move');
            }
        }
    });

    planner.stage.on('dragmove', (e) => {
        if (e.target === planner.stage) return;
        if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
            if ((planner.tool === 'select' || planner.tool === 'pan') && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
                planner.snapAndAlign(e.target);
            }
            if (activeDragEntity && TransformEngine.isSessionActive()) {
                let curX = typeof e.target.x === 'function' ? e.target.x() : activeDragEntity.group.x();
                let curY = typeof e.target.y === 'function' ? e.target.y() : activeDragEntity.group.y();

                if (planner.wallCollisionEnabled !== false && (activeDragEntity.type === 'furniture' || activeDragEntity.totalSteps !== undefined || activeDragEntity.constructor?.name === 'PremiumFurniture')) {
                    const w = Number(activeDragEntity.width) || 80;
                    const d = Number(activeDragEntity.depth || activeDragEntity.length) || 80;
                    const rot = Number(activeDragEntity.rotation) || 0;
                    const res = WallCollisionEngine.resolvePlacement({
                        x: curX,
                        z: curY,
                        rotation: rot,
                        width: w,
                        depth: d,
                        planner,
                        options: {
                            enableCollision: true,
                            enableWallSnap: false,
                            enableWallAlign: false
                        }
                    });
                    if (res && res.isColliding) {
                        curX = res.x;
                        curY = res.z;
                        if (typeof e.target.position === 'function') {
                            e.target.position({ x: curX, y: curY });
                        }
                    }
                }

                TransformEngine.previewMove(activeDragEntity, { absoluteX: curX, absoluteY: curY });
            }
        }
    });

    planner.stage.on('dragend', (e) => {
        if (e.target === planner.stage) planner.stage.container().style.cursor = planner.tool === 'select' ? 'grab' : 'crosshair';
        if (planner.alignmentLines) {
            planner.alignmentLines.destroyChildren();
        }
        if (planner.smartGuides) {
            planner.smartGuides.clear();
        }

        if (activeDragEntity) {
            const curX = activeDragEntity.group ? activeDragEntity.group.x() : activeDragEntity.x;
            const curY = activeDragEntity.group ? activeDragEntity.group.y() : activeDragEntity.y;

            if (TransformEngine.isSessionActive()) {
                TransformEngine.previewMove(activeDragEntity, { absoluteX: curX, absoluteY: curY });
                TransformEngine.commitSession(planner);
            } else if (dragStartPos2D && (Math.abs(curX - dragStartPos2D.x) > 0.001 || Math.abs(curY - dragStartPos2D.y) > 0.001)) {
                TransformEngine.executeDiscreteStep(planner, activeDragEntity, {
                    absolutePosition: { x: curX, y: curY }
                });
            }
            activeDragEntity = null;
            dragStartPos2D = null;
        } else if (dragStartPos2D && (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape')) {
            const id = e.target.id() || (e.target.parent && e.target.parent.id());
            if (dragStartPos2D.id === id) {
                const entity = planner.getEntities().find(ent => ent.id === id || (ent.group && ent.group.id() === id));
                if (entity && entity.group) {
                    const endX = entity.group.x();
                    const endY = entity.group.y();
                    if (Math.abs(endX - dragStartPos2D.x) > 0.001 || Math.abs(endY - dragStartPos2D.y) > 0.001) {
                        TransformEngine.executeDiscreteStep(planner, entity, {
                            absolutePosition: { x: endX, y: endY }
                        });
                    }
                }
            }
            dragStartPos2D = null;
        }
        planner.uiLayer.batchDraw();
    });
}
