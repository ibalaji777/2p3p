export function useAppScene({
    renderer3D,
    planner,
    selectedSky,
    selectedGround,
    isRebuilding,
    selectedEntity,
    selectedType,
    selectedWallSide,
    saveCurrentLevelState,
    levels,
    activeLevelIndex,
    viewMode3D,
    layerItems,
    debouncedSaveHistory,
    viewMode
}) {
    const updateEnvironment = () => {
        if (renderer3D.value) {
            renderer3D.value.setEnvironment(selectedSky.value, selectedGround.value);
        }
    };

    const setSky = (key) => {
        selectedSky.value = key;
        updateEnvironment();
    };

    const setGround = (key) => {
        selectedGround.value = key;
        updateEnvironment();
    };

    const refresh3DScene = (preserveCamera = true) => {
        if (renderer3D.value) {
            isRebuilding.value = true;
            renderer3D.value.isRebuildingScene = true;
            const prevSel = selectedEntity.value;
            const prevType = selectedType.value;
            const prevSide = selectedWallSide.value;
            const prevMode = renderer3D.value.currentTransformMode;
            
            if (saveCurrentLevelState) saveCurrentLevelState(); 
            const levelsConfigArray = levels.value.map(l => ({ data: l.data, isVisible: l.isVisible !== false }));
            
            renderer3D.value.buildScene(
                planner.value.walls,
                planner.value.rooms,
                planner.value.stairs,
                planner.value.furniture,
                planner.value.roofs,
                planner.value.shapes,
                levelsConfigArray, 
                activeLevelIndex.value, 
                viewMode3D.value, 
                preserveCamera
            ); 

            layerItems.value.forEach(item => {
                if (item.entity.isHidden && item.entity.mesh3D) {
                    item.entity.mesh3D.visible = false;
                }
            });

            if (prevSel) {
                const newMesh = renderer3D.value.interactables.find(m => {
                    if (prevType === 'wall' && m.userData.isWallSide && m.userData.entity === prevSel && m.userData.side === prevSide) return true;
                    if (m.userData && m.userData.entity === prevSel) return true;
                    return false;
                });
                if (newMesh) {
                    renderer3D.value.selectObject(newMesh);
                    if (prevMode && prevMode !== 'none') {
                        renderer3D.value.setTransformMode(prevMode, true);
                    }
                }
                else {
                    renderer3D.value.isRebuildingScene = false;
                    renderer3D.value.showTransformMenu(false);
                }
            }
            renderer3D.value.isRebuildingScene = false;
            
            if (renderer3D.value?.cameraController) {
                renderer3D.value.cameraController.updateCameraBounds();
            }
            
            isRebuilding.value = false;
        }
    };

    const syncEngine = () => {
        if (planner.value) {
            planner.value.syncAll();
            if (selectedType.value === 'room' && selectedEntity.value) {
                const oldCx = selectedEntity.value.cx;
                const oldCy = selectedEntity.value.cy;
                const newRoom = planner.value.rooms.find(r => Math.hypot(r.cx - oldCx, r.cy - oldCy) < 20);
                if (newRoom) {
                    selectedEntity.value = newRoom;
                }
            }
        }
        
        if (viewMode.value === '3d') {
            if (selectedType.value === 'furniture' && selectedEntity.value) {
                renderer3D.value.updateFurnitureLive(selectedEntity.value); 
            } else if (selectedType.value === 'shape' && selectedEntity.value) {
                renderer3D.value.updateShapeLive(selectedEntity.value);
                if (selectedEntity.value.type === 'shape_floor_cut') refresh3DScene(true);
            } else if (['roof', 'room', 'wall', 'widget', 'advance_openings', 'molding', 'wallDecor', 'stair'].includes(selectedType.value)) {
                if (planner.value && planner.value.updateRoofAutoPlacement) planner.value.updateRoofAutoPlacement();
                refresh3DScene(true);
            }
        }
        if (debouncedSaveHistory) debouncedSaveHistory();
    };

    let gizmoSyncTimeout = null;
    const throttledSyncEngine = () => {
        if (gizmoSyncTimeout) return;
        gizmoSyncTimeout = setTimeout(() => {
            syncEngine();
            gizmoSyncTimeout = null;
        }, 50);
    };

    return {
        updateEnvironment,
        setSky,
        setGround,
        refresh3DScene,
        syncEngine,
        throttledSyncEngine
    };
}
