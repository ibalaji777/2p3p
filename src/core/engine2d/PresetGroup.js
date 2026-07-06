
import Konva from 'konva';
import { autoAlign } from './presetRegistry.js';

export class PresetGroup {
    constructor(planner, typeId, params, origin, rotation = 0) {
        this.id = Date.now().toString(36) + Math.random().toString(36).substring(2);
        this.planner = planner;
        this.typeId = typeId;
        this.params = { ...params };
        this.origin = { ...origin };
        this.rotation = rotation;
        this.isDeleted = false;

        this.walls = [];
        this.roofs = [];
        this.anchors = [];

        // UI for Selection and Dragging
        this.uiGroup = new Konva.Group({
            x: this.origin.x,
            y: this.origin.y,
            draggable: true,
            visible: true // Always visible so it catches events
        });

        // Add a bounding box (approximate, updated on select)
        this.boundingBox = new Konva.Rect({
            x: -this.params.width / 2,
            y: -this.params.depth / 2,
            width: this.params.width,
            height: this.params.depth,
            stroke: '#3b82f6',
            strokeWidth: 2,
            dash: [5, 5],
            fill: 'rgba(59, 130, 246, 0.1)',
            visible: false // Hidden by default
        });
        
        // Invisible hit area for catching events when deselected
        this.hitArea = new Konva.Rect({
            x: -this.params.width / 2,
            y: -this.params.depth / 2,
            width: this.params.width,
            height: this.params.depth,
            fill: 'rgba(0,0,0,0)' // Transparent but hittable
        });
        
        // Move Handle Icon
        this.moveHandle = new Konva.Circle({
            x: 0,
            y: 0,
            radius: 15,
            fill: '#38bdf8',
            stroke: 'white',
            strokeWidth: 2,
            shadowColor: 'black',
            shadowBlur: 4,
            shadowOpacity: 0.3,
            visible: false
        });

        this.uiGroup.add(this.hitArea);
        this.uiGroup.add(this.boundingBox);
        this.uiGroup.add(this.moveHandle);
        this.planner.uiLayer.add(this.uiGroup);

        // Drag events to move children
        this.uiGroup.on('dragstart', (e) => {
            this.dragStartOrigin = { x: this.origin.x, y: this.origin.y };
            this.dragStartGroupPos = { x: this.uiGroup.x(), y: this.uiGroup.y() };
            // Capture initial positions of all children
            this.childStarts = {
                anchors: this.anchors.map(a => ({ id: a.id, x: a.x, y: a.y })),
                roofs: this.roofs.map(r => ({ id: r.id, x: r.group.x(), y: r.group.y() }))
            };
            
            // Hide the move icon during drag for clearer view
            this.moveHandle.visible(false);
            
            if (this.planner.stage) this.planner.stage.container().style.cursor = 'grabbing';
        });

        this.uiGroup.on('dragmove', (e) => {
            const dx = this.uiGroup.x() - this.dragStartGroupPos.x;
            const dy = this.uiGroup.y() - this.dragStartGroupPos.y;
            
            this.origin.x = this.dragStartOrigin.x + dx;
            this.origin.y = this.dragStartOrigin.y + dy;

            this.regenerate();
        });

        this.uiGroup.on('dragend', (e) => {
            this.moveHandle.visible(true);
            if (this.planner.stage) this.planner.stage.container().style.cursor = 'grab';
            
            // Snap to grid if enabled (can just update origin and regenerate to be perfectly snapped)
            const snapX = this.planner.snap(this.origin.x);
            const snapY = this.planner.snap(this.origin.y);
            this.origin.x = snapX;
            this.origin.y = snapY;
            this.regenerate();
            this.planner.syncAll();
        });
        
        // Let mousedown bubble up normally so Konva's native dragging works!
        // But handle click/tap to ensure it gets selected if clicked directly
        this.uiGroup.on('click tap', (e) => {
            if (this.planner.tool === 'select') {
                e.cancelBubble = true;
                this.planner.selectEntity(this, 'preset_group');
                this.planner.syncAll();
            }
        });
    }

    setHighlight(bool) {
        this.boundingBox.visible(bool);
        this.moveHandle.visible(bool);
        this.uiGroup.x(this.origin.x);
        this.uiGroup.y(this.origin.y);
        
        if (bool) {
            this.uiGroup.moveToTop();
        }
        
        // Update bounding box size in case it changed
        const w = this.params.width || 100;
        const d = this.params.depth || 100;
        this.boundingBox.width(w);
        this.boundingBox.height(d);
        this.boundingBox.x(-w / 2);
        this.boundingBox.y(-d / 2);
        
        this.hitArea.width(w);
        this.hitArea.height(d);
        this.hitArea.x(-w / 2);
        this.hitArea.y(-d / 2);

        this.walls.forEach(w => w.setHighlight(bool));
        this.roofs.forEach(r => r.setHighlight(bool));
    }

    regenerate() {
        // Recalculate auto-alignment (elevation, rotation) for current position
        const alignData = autoAlign(this.planner, this.origin, this.params.elevation || 0, this.params.depth || 0);

        // Generate/update children with fresh alignment data
        const generator = this.planner.presetRegistry[this.typeId];
        if (generator) {
            generator.generate(this.planner, this.origin, this.params, alignData, this);
        }

        // Keep highlight state active if it was
        if (this.planner.selectedEntity === this) {
            this.setHighlight(true);
        }

        this.planner.mainLayer.batchDraw();
        this.planner.uiLayer.batchDraw();
        this.planner.syncAll();
    }

    remove() {
        if (this.isDeleted) return;
        this.isDeleted = true;
        this.uiGroup.destroy();
        this.walls.forEach(w => this.planner.deleteEntity(w, false));
        this.roofs.forEach(r => this.planner.deleteEntity(r, false));
        this.anchors.forEach(a => {
            this.planner.anchors = this.planner.anchors.filter(anchor => anchor !== a);
            if (a.node) a.node.destroy();
        });
    }

    export() {
        return {
            id: this.id,
            typeId: this.typeId,
            params: { ...this.params },
            origin: { ...this.origin },
            rotation: this.rotation,
            // We store the IDs of children so we can re-link them on import
            wallIds: this.walls.map(w => w.id),
            roofIds: this.roofs.map(r => r.id),
            anchorIds: this.anchors.map(a => a.id)
        };
    }
}
