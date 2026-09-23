
import { TransformEngine } from '../transform/TransformEngine.js';

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
                const curX = typeof e.target.x === 'function' ? e.target.x() : activeDragEntity.group.x();
                const curY = typeof e.target.y === 'function' ? e.target.y() : activeDragEntity.group.y();
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

        if (TransformEngine.isSessionActive() && activeDragEntity) {
            const curX = activeDragEntity.group ? activeDragEntity.group.x() : activeDragEntity.x;
            const curY = activeDragEntity.group ? activeDragEntity.group.y() : activeDragEntity.y;
            TransformEngine.previewMove(activeDragEntity, { absoluteX: curX, absoluteY: curY });
            TransformEngine.commitSession(planner);
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
                        entity.group.position({ x: dragStartPos2D.x, y: dragStartPos2D.y });
                        planner.move(id, endX, endY);
                    }
                }
            }
            activeDragEntity = null;
            dragStartPos2D = null;
        }
        planner.uiLayer.batchDraw();
    });
}
