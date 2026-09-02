import { applyWallPaintWithScope } from '../core/engine3d/WallPaintSystem.js';
import { WallEngine } from '../core/wall/WallEngine.js';

export function useAppMaterials({ 
    selectedEntity, 
    selectedType, 
    selectedWallSide, 
    paintScope,
    planner,
    renderer3D, 
    uiTrigger, 
    activeDecorId,
    updateStaticLevelData, 
    debouncedSaveHistory, 
    syncEngine 
}) {
    const setFloorMaterial = (key) => {
        if (selectedEntity.value && (selectedType.value === 'room' || selectedEntity.value.isRoom || selectedEntity.value.path)) {
            selectedEntity.value.configId = key;
            if (renderer3D.value && typeof renderer3D.value.updateMaterialLive === 'function') {
                renderer3D.value.updateMaterialLive(selectedEntity.value);
            }
            syncEngine('material');
            debouncedSaveHistory();
        }
    };

    const setOpeningMaterial = (key) => {
        if (selectedEntity.value && selectedType.value === 'advance_openings') {
            selectedEntity.value.decorConfigId = key;
            if (renderer3D.value) {
                renderer3D.value.updatePatternLive(selectedEntity.value);
            }
            debouncedSaveHistory();
        }
    };

    const clearShapeTextures = () => {
        if (selectedEntity.value && selectedEntity.value.params) {
            selectedEntity.value.params.texture = '';
            selectedEntity.value.params.textureTop = '';
            selectedEntity.value.params.textureBottom = '';
            selectedEntity.value.params.textureSides = '';
            selectedEntity.value.params.textureLeft = '';
            selectedEntity.value.params.textureRight = '';
            selectedEntity.value.params.textureFront = '';
            selectedEntity.value.params.textureBack = '';
        }
    };

    const isShapeMaterialActive = (key) => {
        if (!selectedEntity.value || !selectedEntity.value.params) return false;
        const target = selectedEntity.value.params.materialTarget || 'all';
        if (target === 'all') return selectedEntity.value.params.texture === key;
        if (target === 'top') return selectedEntity.value.params.textureTop === key;
        if (target === 'sides') return selectedEntity.value.params.textureSides === key;
        if (target === 'left') return selectedEntity.value.params.textureLeft === key;
        if (target === 'right') return selectedEntity.value.params.textureRight === key;
        if (target === 'front') return selectedEntity.value.params.textureFront === key;
        if (target === 'back') return selectedEntity.value.params.textureBack === key;
        if (target === 'bottom') return selectedEntity.value.params.textureBottom === key;
        return false;
    };

    const setShapeMaterial = (key) => {
        if (selectedEntity.value) {
            if (!selectedEntity.value.params) selectedEntity.value.params = {};
            const target = selectedEntity.value.params.materialTarget || 'all';
            
            if (selectedType.value === 'wall' || selectedType.value === 'arc' || selectedEntity.value?.parentArc) {
                const side = (target === 'front' || target === 'back' || target === 'left' || target === 'right') ? target : selectedWallSide.value;
                const arc = selectedEntity.value.parentArc || (selectedType.value === 'arc' ? selectedEntity.value : null);
                if (arc && arc.walls) {
                    const paramKey = side === 'back' ? 'textureBack' : (side === 'left' ? 'textureLeft' : (side === 'right' ? 'textureRight' : 'textureFront'));
                    arc.params = arc.params || {};
                    arc.params[paramKey] = key;
                    if (target === 'all') {
                        arc.params.texture = key;
                        arc.params.textureFront = key;
                        arc.params.textureBack = key;
                        arc.params.textureSides = key;
                    }
                    arc.walls.forEach(w => {
                        WallEngine.applyMaterial(w, { target, key }, planner?.value || planner);
                    });
                    syncEngine('material');
                    return;
                }
                if (renderer3D.value) {
                    const currentScope = paintScope?.value || 'single';
                    if (side === 'left' || side === 'right') {
                        WallEngine.applyMaterial(selectedEntity.value, { target: side, key, ctx: renderer3D.value }, planner?.value || planner);

                        // Sync to connected walls at this corner
                        const anchor = side === 'left' ? selectedEntity.value.startAnchor : selectedEntity.value.endAnchor;
                        const pt = side === 'left' 
                            ? { x: selectedEntity.value.startX ?? selectedEntity.value.p1?.x, y: selectedEntity.value.startY ?? selectedEntity.value.p1?.y } 
                            : { x: selectedEntity.value.endX ?? selectedEntity.value.p2?.x, y: selectedEntity.value.endY ?? selectedEntity.value.p2?.y };
                        const allWalls = (planner?.value || planner)?.walls || [];
                        allWalls.forEach(cw => {
                            if (!cw || cw === selectedEntity.value || cw.type === 'roof' || cw.type === 'furniture' || cw.type === 'room') return;
                            let isCwStart = false;
                            let isCwEnd = false;
                            if (anchor && (cw.startAnchor === anchor || cw.endAnchor === anchor)) {
                                isCwStart = cw.startAnchor === anchor;
                                isCwEnd = cw.endAnchor === anchor;
                            } else if (pt.x !== undefined && pt.y !== undefined) {
                                const cwP1 = { x: cw.startX ?? cw.p1?.x, y: cw.startY ?? cw.p1?.y };
                                const cwP2 = { x: cw.endX ?? cw.p2?.x, y: cw.endY ?? cw.p2?.y };
                                if (cwP1.x !== undefined && Math.hypot(cwP1.x - pt.x, cwP1.y - pt.y) < 5) isCwStart = true;
                                else if (cwP2.x !== undefined && Math.hypot(cwP2.x - pt.x, cwP2.y - pt.y) < 5) isCwEnd = true;
                            }
                            if (isCwStart) {
                                WallEngine.applyMaterial(cw, { target: 'left', key, ctx: renderer3D.value }, planner?.value || planner);
                            }
                            if (isCwEnd) {
                                WallEngine.applyMaterial(cw, { target: 'right', key, ctx: renderer3D.value }, planner?.value || planner);
                            }
                        });

                        uiTrigger.value++;
                    } else if (currentScope === 'room' || currentScope === 'exterior') {
                        const results = applyWallPaintWithScope({
                            wall: selectedEntity.value,
                            side,
                            configId: key,
                            scope: currentScope,
                            planner: planner?.value || planner,
                            renderer3D: renderer3D.value
                        });
                        if (results.length > 0) {
                            activeDecorId.value = results[0].decor.id;
                        }
                        uiTrigger.value++;
                    } else {
                        const decor = renderer3D.value.addWallPattern(selectedEntity.value, key, side);
                        selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
                        activeDecorId.value = decor.id; 
                        uiTrigger.value++; 
                        if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
                    }
                    debouncedSaveHistory();
                }
                return;
            } else if (selectedType.value === 'wallDecor') {
                selectedEntity.value.configId = key;
                syncEngine();
                return;
            }
            
            WallEngine.applyMaterial(selectedEntity.value, { target, key, ctx: renderer3D.value }, planner?.value || planner);

            syncEngine();
        }
    };

    const setRoofMaterial = (key, scope = 'single', slopeKey = null) => {
        const currentScope = scope || paintScope?.value || 'single';
        
        if (currentScope === 'all') {
            const plannerInstance = planner?.value || planner || window.planner?.value || window.planner;
            const roofs = plannerInstance?.roofs || [];
            roofs.forEach(r => {
                if (r.config) {
                    r.config.material = key;
                    if (r.config.slopes) delete r.config.slopes;
                } else {
                    r.material = key;
                }
            });
        } else if (selectedEntity.value && (selectedType.value === 'roof' || selectedEntity.value.type === 'roof' || selectedEntity.value.config?.roofType)) {
            const r = selectedEntity.value;
            r.config = r.config || {};
            if (slopeKey) {
                r.config.slopes = r.config.slopes || {};
                r.config.slopes[slopeKey] = key;
            } else {
                r.config.material = key;
            }
        }
        syncEngine('material');
        debouncedSaveHistory();
    };

    const setRoofFasciaMaterial = (key) => {
        if (selectedEntity.value && (selectedType.value === 'roof' || selectedEntity.value.type === 'roof' || selectedEntity.value.config?.roofType)) {
            selectedEntity.value.config = selectedEntity.value.config || {};
            selectedEntity.value.config.fasciaMaterial = key;
            syncEngine('material');
            debouncedSaveHistory();
        }
    };

    return {
        setFloorMaterial,
        setOpeningMaterial,
        clearShapeTextures,
        isShapeMaterialActive,
        setShapeMaterial,
        setRoofMaterial,
        setRoofFasciaMaterial
    };
}
