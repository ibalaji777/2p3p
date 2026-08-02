import { globalShapeMirror } from './ShapeMirrorEngine.js';
import { coreEventBus } from '../EventBus.js';
import { usePlannerStore } from '../../stores/usePlannerStore.js';

class UniversalSyncManager {
    constructor() {
        this.ctx3d = null;
        this.ctx2d = null;
        this.isSyncing = false;
        
        // Listen to 3D object added/updated events to regenerate footprints
        coreEventBus.on('EntityGeometryUpdated', (data) => this.handle3DGeometryUpdate(data));
        coreEventBus.on('EntityTransformUpdated3D', (data) => this.handle3DTransformUpdate(data));
        
        // Listen to 2D transform updates (drag, rotate)
        coreEventBus.on('EntityTransformUpdated2D', (data) => this.handle2DTransformUpdate(data));

        // Subscribe to Central State changes
        this.setupStateObserver();
    }

    init(ctx3d, ctx2d) {
        this.ctx3d = ctx3d;
        this.ctx2d = ctx2d;
    }

    setupStateObserver() {
        // Defer to avoid initialization order issues
        setTimeout(() => {
            const store = usePlannerStore();
            // We can watch for version changes to sync down to renderers
            // But for now, we intercept the event bus and route to store.
        }, 100);
    }

    /**
     * Recomputes the 2D footprint from the 3D entity geometry and updates the 2D representation
     */
    handle3DGeometryUpdate({ entity, object3D }) {
        if (this.isSyncing) return;
        if (!object3D || !entity) return;
        
        const cacheKey = `${entity.id || entity.configId || 'furn'}_${entity.version || 0}`;
        const footprint = globalShapeMirror.extractFootprint(object3D, cacheKey, true, entity.width, entity.depth);
        const svgPath = globalShapeMirror.pointsToSvg(footprint);
        
        if (svgPath && this.ctx2d) {
            // Find the 2D entity by id or direct entity reference
            let entity2d = this.find2DEntity(entity.id);
            if (!entity2d && this.ctx2d.furniture) {
                entity2d = this.ctx2d.furniture.find(f => f === entity || (entity.id && f.id === entity.id));
            }
            
            if (entity2d && entity2d.body && typeof entity2d.body.data === 'function') {
                entity2d.body.data(svgPath);
                entity2d.body.scaleX(1);
                entity2d.body.scaleY(1);
                entity2d.body.x(entity.width / 2);
                entity2d.body.y(entity.depth / 2);
                entity2d.body.offsetX(0);
                entity2d.body.offsetY(0);
                entity2d.hasDynamicFootprint = true;
                
                if (typeof entity2d.update === 'function') entity2d.update();
                if (this.ctx2d.syncAll) this.ctx2d.syncAll();
                if (entity2d.group && entity2d.group.getLayer()) entity2d.group.getLayer().batchDraw();
            }
        }
    }

    handle3DTransformUpdate({ entity, x, y, rotation, scaleX, scaleY }) {
        if (this.isSyncing) return;
        this.isSyncing = true;
        
        const entity2d = this.find2DEntity(entity?.id || entity);
        if (entity2d && entity2d.group) {
            if (x !== undefined) entity2d.group.x(x);
            if (y !== undefined) entity2d.group.y(y);
            if (rotation !== undefined) {
                entity2d.rotation = rotation;
                entity2d.group.rotation(rotation);
            }
            if (typeof entity2d.update === 'function') entity2d.update();
            if (this.ctx2d && this.ctx2d.syncAll) this.ctx2d.syncAll();
            
            // Route through store to maintain SSOT
            const store = usePlannerStore();
            store.updateEntityTransform(entity2d.id || entity, x, y, rotation, arguments[0].elevation);
        }
        
        this.isSyncing = false;
    }

    handle2DTransformUpdate({ id, x, y, rotation }) {
        if (this.isSyncing) return;
        this.isSyncing = true;

        // PHASE 1.1: Route updates through the central store first
        const store = usePlannerStore();
        store.updateEntityTransform(id, x, y, rotation);
        
        // 3D is now synced reactively via useAppScene.js watching plannerStore.sceneGraphState.version
        
        this.isSyncing = false;
    }

    find2DEntity(id) {
        if (!this.ctx2d || !id) return null;
        let found = null;
        ['furniture', 'walls', 'stairs', 'roofs', 'balconies', 'arcs', 'shapes'].forEach(list => {
            if (!found && this.ctx2d[list]) {
                found = this.ctx2d[list].find(e => e.id === id || e === id);
            }
        });
        return found;
    }
}

export const globalSyncManager = new UniversalSyncManager();
