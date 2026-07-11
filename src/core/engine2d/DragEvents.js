
/**
 * Handles all drag-related events for the 2D Engine.
 * @param {Object} planner - The FloorPlanner instance.
 */
export function setupDragEvents(planner) {
 
        planner.stage.on('dragstart', (e) => {
            if (e.target === planner.stage) planner.stage.container().style.cursor = 'grabbing';
        });
        
        planner.stage.on('dragmove', (e) => {
            if (e.target === planner.stage) return;
            if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                if ((planner.tool === 'select' || planner.tool === 'pan') && !e.target.isWallPoly && !e.target.isStairNodeHandle && !(e.target.name() && e.target.name().includes('anchor'))) {
                    planner.snapAndAlign(e.target);
                }
            }
        });

        let dragStartData2D = null;
        
        planner.stage.on('dragstart', (e) => {
            if (e.target === planner.stage) {
                planner.stage.container().style.cursor = 'grabbing';
            } else if (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape') {
                const id = e.target.id() || (e.target.parent && e.target.parent.id());
                const entity = planner.getEntities().find(ent => ent.id === id || (ent.group && ent.group.id() === id));
                if (entity && entity.group) {
                    dragStartData2D = { id: id, x: entity.group.x(), y: entity.group.y() };
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
            
            if (dragStartData2D && (e.target.nodeType === 'Group' || e.target.nodeType === 'Shape')) {
                const id = e.target.id() || (e.target.parent && e.target.parent.id());
                if (dragStartData2D.id === id) {
                    const entity = planner.getEntities().find(ent => ent.id === id || (ent.group && ent.group.id() === id));
                    if (entity && entity.group) {
                        const endX = entity.group.x();
                        const endY = entity.group.y();
                        if (Math.abs(endX - dragStartData2D.x) > 0.001 || Math.abs(endY - dragStartData2D.y) > 0.001) {
                            // Revert the 2D position temporarily so the Command executes the change
                            entity.group.position({ x: dragStartData2D.x, y: dragStartData2D.y });
                            planner.move(id, endX, endY);
                        }
                    }
                }
                dragStartData2D = null;
            }
            planner.uiLayer.batchDraw();
        });

}
