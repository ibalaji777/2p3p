import { onBeforeUnmount } from 'vue';

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

    let isSyncingEngine = false;
    const syncEngine = (updateType = 'geometry', forceRebuild = false) => {
        if (isSyncingEngine) return;
        isSyncingEngine = true;
        try {
            if (planner.value) {
                if (selectedEntity.value && typeof selectedEntity.value.update2D === 'function') {
                    selectedEntity.value.update2D();
                }
                planner.value.syncAll();
                if (selectedType.value === 'room' && selectedEntity.value) {
                    const oldRoom = selectedEntity.value;
                    const newRoom = planner.value.rooms.find(r => Math.hypot(r.cx - oldRoom.cx, r.cy - oldRoom.cy) < 20);
                    if (newRoom) {
                        // Preserve custom UI properties across 2D graph regenerations
                        if (oldRoom.materialScale !== undefined) newRoom.materialScale = oldRoom.materialScale;
                        if (oldRoom.configId !== undefined) newRoom.configId = oldRoom.configId;
                        selectedEntity.value = newRoom;
                    }
                }
            }
            
            if (renderer3D.value && selectedEntity.value) {
                renderer3D.value.updateEntity(selectedEntity.value, updateType);
                if (selectedType.value === 'wall' && planner.value) {
                    const selAnchorId1 = selectedEntity.value.startAnchor?.id;
                    const selAnchorId2 = selectedEntity.value.endAnchor?.id;
                    planner.value.walls.forEach(w => {
                        if (w !== selectedEntity.value && !w.hidden) {
                            if ((selAnchorId1 && (w.startAnchor?.id === selAnchorId1 || w.endAnchor?.id === selAnchorId1)) ||
                                (selAnchorId2 && (w.startAnchor?.id === selAnchorId2 || w.endAnchor?.id === selAnchorId2))) {
                                renderer3D.value.updateWallGeometryLive(w);
                            }
                        }
                    });
                }
                if (['wall', 'roof', 'room', 'stair'].includes(selectedType.value) && planner.value?.updateRoofAutoPlacement) {
                    planner.value.updateRoofAutoPlacement();
                }
            }
            if (debouncedSaveHistory) debouncedSaveHistory();
        } finally {
            isSyncingEngine = false;
        }
    };

    let gizmoSyncTimeout = null;
    const throttledSyncEngine = () => {
        if (gizmoSyncTimeout) return;
        gizmoSyncTimeout = setTimeout(() => {
            syncEngine();
            gizmoSyncTimeout = null;
        }, 50);
    };

    const syncDoorAngle = () => {
        if (viewMode.value === '3d' && selectedType.value === 'widget' && selectedEntity.value && selectedEntity.value.type === 'door') {
            if (renderer3D.value && renderer3D.value.updateDoorAnimationLive) {
                renderer3D.value.updateDoorAnimationLive(selectedEntity.value);
            }
            if (debouncedSaveHistory) debouncedSaveHistory();
        }
    };

    onBeforeUnmount(() => {
        if (gizmoSyncTimeout) clearTimeout(gizmoSyncTimeout);
    });

    return {
        updateEnvironment,
        setSky,
        setGround,
        refresh3DScene,
        syncEngine,
        syncDoorAngle,
        throttledSyncEngine
    };
}
