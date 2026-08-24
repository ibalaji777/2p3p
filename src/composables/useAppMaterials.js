export function useAppMaterials({ 
    selectedEntity, 
    selectedType, 
    selectedWallSide, 
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
                const side = (target === 'front' || target === 'back') ? target : selectedWallSide.value;
                const arc = selectedEntity.value.parentArc || (selectedType.value === 'arc' ? selectedEntity.value : null);
                if (arc && arc.walls) {
                    const paramKey = side === 'back' ? 'textureBack' : 'textureFront';
                    arc.params = arc.params || {};
                    arc.params[paramKey] = key;
                    if (target === 'all') {
                        arc.params.texture = key;
                        arc.params.textureFront = key;
                        arc.params.textureBack = key;
                        arc.params.textureSides = key;
                    }
                    arc.walls.forEach(w => {
                        w.params = w.params || {};
                        w.params[paramKey] = key;
                        if (target === 'all') {
                            w.params.texture = key;
                            w.params.textureFront = key;
                            w.params.textureBack = key;
                            w.params.textureSides = key;
                        }
                    });
                    syncEngine('material');
                    return;
                }
                if (renderer3D.value) {
                    const decor = renderer3D.value.addWallPattern(selectedEntity.value, key, side);
                    selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
                    activeDecorId.value = decor.id; 
                    uiTrigger.value++; 
                    if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
                    debouncedSaveHistory();
                }
                return;
            } else if (selectedType.value === 'wallDecor') {
                selectedEntity.value.configId = key;
                syncEngine();
                return;
            }
            
            if (target === 'all') {
                selectedEntity.value.params.texture = key;
                selectedEntity.value.params.textureTop = key;
                selectedEntity.value.params.textureBottom = key;
                selectedEntity.value.params.textureSides = key;
                selectedEntity.value.params.textureLeft = key;
                selectedEntity.value.params.textureRight = key;
                selectedEntity.value.params.textureFront = key;
                selectedEntity.value.params.textureBack = key;
            } else if (target === 'top') selectedEntity.value.params.textureTop = key;
            else if (target === 'bottom') selectedEntity.value.params.textureBottom = key;
            else if (target === 'sides') {
                selectedEntity.value.params.textureSides = key;
                selectedEntity.value.params.textureLeft = key;
                selectedEntity.value.params.textureRight = key;
                selectedEntity.value.params.textureFront = key;
                selectedEntity.value.params.textureBack = key;
            }
            else if (target === 'left') selectedEntity.value.params.textureLeft = key;
            else if (target === 'right') selectedEntity.value.params.textureRight = key;
            else if (target === 'front') selectedEntity.value.params.textureFront = key;
            else if (target === 'back') selectedEntity.value.params.textureBack = key;

            if (selectedEntity.value.parentArc) {
                selectedEntity.value.parentArc.params = { ...(selectedEntity.value.parentArc.params || {}), ...selectedEntity.value.params };
                if (selectedEntity.value.parentArc.walls) {
                    selectedEntity.value.parentArc.walls.forEach(w => {
                        w.params = { ...(w.params || {}), ...selectedEntity.value.params };
                    });
                }
            } else if (selectedEntity.value.type === 'arc' && selectedEntity.value.walls) {
                selectedEntity.value.params = { ...(selectedEntity.value.params || {}) };
                selectedEntity.value.walls.forEach(w => {
                    w.params = { ...(w.params || {}), ...selectedEntity.value.params };
                });
            }

            syncEngine();
        }
    };

    const setRoofMaterial = (key) => {
        if (selectedEntity.value && selectedType.value === 'roof') {
            selectedEntity.value.config.material = key;
            syncEngine();
        }
    };

    const setRoofFasciaMaterial = (key) => {
        if (selectedEntity.value && selectedType.value === 'roof') {
            selectedEntity.value.config.fasciaMaterial = key;
            syncEngine();
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
