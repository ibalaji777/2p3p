import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/useUIStore.js';
import { usePlannerStore } from '../stores/usePlannerStore.js';
import { WallEngine } from '../core/wall/WallEngine.js';

export function useLevelManager(dependencies) {
    const uiStore = useUIStore();
    const plannerStore = usePlannerStore();
    
    const { viewMode } = storeToRefs(uiStore);
    const { planner, levels, activeLevelIndex, referenceLevelIndex, referenceOpacity } = storeToRefs(plannerStore);

    const { handleDeselect, refresh3DScene, saveHistory } = dependencies;

    const saveCurrentLevelState = () => { 
        if (planner.value && levels.value[activeLevelIndex.value]) {
            levels.value[activeLevelIndex.value].data = planner.value.exportState(); 
        }
    };

    const updateStaticLevelData = (staticWall) => {
        const levelIdx = staticWall.levelIndex;
        if (levelIdx === undefined || !levels.value[levelIdx] || !levels.value[levelIdx].data) return;
        
        const levelData = JSON.parse(levels.value[levelIdx].data);
        const targetWall = levelData.walls[staticWall.wallIndex];
        
        if (targetWall) {
            targetWall.decors = staticWall.attachedDecor.map(d => ({
                id: d.id, configId: d.configId, side: d.side,
                localX: d.localX, localY: d.localY, localZ: d.localZ,
                width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize,
                faces: { front: d.faces?.front, back: d.faces?.back, left: d.faces?.left, right: d.faces?.right }
            }));
            levels.value[levelIdx].data = JSON.stringify(levelData);
        }
    };

    const getEffectiveReferenceIndex = () => {
        if (referenceLevelIndex.value === 'none') return -1;
        if (typeof referenceLevelIndex.value === 'number' && referenceLevelIndex.value >= 0 && referenceLevelIndex.value < levels.value.length) {
            if (referenceLevelIndex.value !== activeLevelIndex.value) return referenceLevelIndex.value;
        }
        // 'auto' mode
        if (activeLevelIndex.value > 0) {
            return activeLevelIndex.value - 1;
        } else if (levels.value.length > 1) {
            // When on lowest floor (e.g. Foundation / Basement), reference the floor above!
            return 1;
        }
        return -1;
    };

    const refreshReferenceOverlay = () => {
        if (!planner.value) return;
        const refIdx = getEffectiveReferenceIndex();
        if (refIdx >= 0 && levels.value[refIdx] && levels.value[refIdx].data) {
            planner.value.loadReferenceBackground(levels.value[refIdx].data, {
                opacity: referenceOpacity.value,
                strokeColor: '#3b82f6',
                fillColor: '#dbeafe'
            });
        } else {
            planner.value.clearReferenceBackground();
        }
    };

    const setReferenceLevelIndex = (val) => {
        referenceLevelIndex.value = val;
        refreshReferenceOverlay();
    };

    const setReferenceOpacity = (opacity) => {
        referenceOpacity.value = Number(opacity) || 0.5;
        if (planner.value && planner.value.setReferenceOpacity) {
            planner.value.setReferenceOpacity(referenceOpacity.value);
        } else {
            refreshReferenceOverlay();
        }
    };

    const switchLevel = (index) => {
        if (index === activeLevelIndex.value) return; 
        saveCurrentLevelState();
        handleDeselect();

        activeLevelIndex.value = index;
        const activeLvl = levels.value[index];
        if (planner.value) {
            planner.value.activeLevel = activeLvl;
            planner.value.activeLevelConfig = activeLvl;
        }
        const targetData = activeLvl?.data;
        if (targetData) {
            planner.value.importState(targetData);
        } else {
            planner.value.clearAll(); 
        }

        // Sync walls on plinth/foundation to level height
        if (activeLvl && planner.value && planner.value.walls) {
            if (activeLvl.type === 'plinth' || activeLvl.type === 'foundation') {
                const targetH = Number(activeLvl.height) || (activeLvl.type === 'plinth' ? 18 : 40);
                WallEngine.batchUpdate(planner.value, planner.value.walls, { height: targetH });
            }
        }

        refreshReferenceOverlay();
        
        if (viewMode.value === '3d') refresh3DScene(true); 
        saveHistory();
    };

    const addLevel = (type = 'empty', levelType = 'floor') => {
        saveCurrentLevelState();
        
        let name = '';
        let height = 120; // 10 ft / 304.8 cm
        let thickness = 9; // 9 in / 22.86 cm
        
        if (levelType === 'foundation') {
            name = 'Foundation';
            height = 40; // ~3.33 ft / 100 cm
            thickness = 18; // 1.5 ft / 45 cm
        } else if (levelType === 'plinth') {
            name = 'Plinth Beam';
            height = 18; // 1.5 ft / 45 cm
            thickness = 9; // 9 in / 23 cm
        } else if (levelType === 'basement') {
            name = 'Basement';
            height = 120; // 10 ft / 304.8 cm
            thickness = 9; // 9 in / 23 cm
        } else if (levelType === 'ground') {
            name = 'Ground Floor';
            height = 120; // 10 ft / 304.8 cm
            thickness = 9; // 9 in / 23 cm
        } else {
            const floorCount = levels.value.filter(l => !['foundation', 'plinth', 'basement'].includes(l.type)).length;
            name = `Floor ${floorCount + 1}`;
            height = 120;
            thickness = 9;
        }
        
        const newLevel = {
            id: 'level-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
            name,
            type: levelType,
            height,
            defaultWallThickness: thickness,
            data: type === 'duplicate' ? levels.value[activeLevelIndex.value]?.data : null,
            isVisible: true
        };

        // Determine logical insertion index
        let insertIndex = levels.value.length;
        if (levelType === 'foundation') {
            insertIndex = 0;
        } else if (levelType === 'basement') {
            const fIdx = levels.value.findIndex(l => l.type === 'foundation');
            insertIndex = fIdx !== -1 ? fIdx + 1 : 0;
        } else if (levelType === 'plinth') {
            const subIndices = levels.value.map((l, i) => (['foundation', 'basement'].includes(l.type) ? i : -1)).filter(i => i !== -1);
            insertIndex = subIndices.length > 0 ? Math.max(...subIndices) + 1 : 0;
        }

        levels.value.splice(insertIndex, 0, newLevel);
        switchLevel(insertIndex);
        saveHistory();
    };

    const deleteLevel = (index) => {
        if (levels.value.length <= 1) return;
        
        saveCurrentLevelState();
        const currentActive = activeLevelIndex.value;
        
        // Remove level from array
        levels.value.splice(index, 1);
        
        // Determine new active index
        let newActive = currentActive;
        if (currentActive === index) {
            newActive = Math.min(index, levels.value.length - 1);
        } else if (currentActive > index) {
            newActive = currentActive - 1;
        }
        
        activeLevelIndex.value = newActive;
        
        if (planner.value) {
            planner.value.activeLevel = levels.value[newActive];
            planner.value.activeLevelConfig = levels.value[newActive];
            handleDeselect();
            const targetData = levels.value[newActive]?.data;
            if (targetData) planner.value.importState(targetData); else planner.value.clearAll();
            refreshReferenceOverlay();
        }
        
        if (viewMode.value === '3d') refresh3DScene(true);
        saveHistory();
    };

    const updateLevelDetails = ({ index, name, description, height, defaultWallThickness, type }) => {
        if (levels.value[index]) {
            const lvl = levels.value[index];
            if (name !== undefined) lvl.name = name;
            if (description !== undefined) lvl.description = description;
            if (height !== undefined) {
                lvl.height = Number(height);
                // Update walls on active level
                if (index === activeLevelIndex.value && planner.value && planner.value.walls) {
                    WallEngine.batchUpdate(planner.value, planner.value.walls, { height: Number(height) });
                } else if (lvl.data) {
                    try {
                        const parsed = JSON.parse(lvl.data);
                        if (parsed.walls) {
                            parsed.walls.forEach(w => {
                                w.height = Number(height);
                                if (w.config) w.config.height = Number(height);
                            });
                            lvl.data = JSON.stringify(parsed);
                        }
                    } catch(e) {}
                }
            }
            if (defaultWallThickness !== undefined) {
                lvl.defaultWallThickness = Number(defaultWallThickness);
                if (index === activeLevelIndex.value && planner.value && planner.value.walls) {
                    WallEngine.batchUpdate(planner.value, planner.value.walls, { thickness: Number(defaultWallThickness) });
                } else if (lvl.data) {
                    try {
                        const parsed = JSON.parse(lvl.data);
                        if (parsed.walls) {
                            parsed.walls.forEach(w => {
                                w.thickness = Number(defaultWallThickness);
                                if (w.config) w.config.thickness = Number(defaultWallThickness);
                            });
                            lvl.data = JSON.stringify(parsed);
                        }
                    } catch(e) {}
                }
            }
            if (type !== undefined) lvl.type = type;
            if (planner.value && index === activeLevelIndex.value) {
                planner.value.activeLevel = lvl;
                planner.value.activeLevelConfig = lvl;
            }
            saveCurrentLevelState();
            saveHistory();
            if (viewMode.value === '3d') refresh3DScene(true);
        }
    };

    const projectWallsFromReference = (options = {}) => {
        const refIdx = getEffectiveReferenceIndex();
        if (refIdx < 0 || !levels.value[refIdx] || !levels.value[refIdx].data || !planner.value) return false;
        
        try {
            const refState = JSON.parse(levels.value[refIdx].data);
            if (!refState.walls || refState.walls.length === 0) return false;
            
            saveCurrentLevelState();
            
            const activeLvl = levels.value[activeLevelIndex.value];
            const targetThickness = options.thickness || activeLvl?.defaultWallThickness || (activeLvl?.type === 'foundation' ? 18 : (activeLvl?.type === 'plinth' ? 9 : 9));
            const onlyOuter = options.onlyOuter ?? (activeLvl?.type === 'foundation' || activeLvl?.type === 'plinth');
            
            let currentExport = planner.value.exportState();
            let currentData = currentExport ? JSON.parse(currentExport) : { walls: [], rooms: [], stairs: [], shapes: [] };
            if (!currentData.walls) currentData.walls = [];
            
            const wallsToProject = refState.walls.filter(w => {
                if (onlyOuter) {
                    return w.type === 'outer' || !w.type;
                }
                return true;
            });
            
            if (wallsToProject.length === 0) return false;

            const targetHeight = activeLvl?.height !== undefined ? Number(activeLvl.height) : (activeLvl?.type === 'plinth' ? 18 : (activeLvl?.type === 'foundation' ? 40 : 120));

            wallsToProject.forEach(w => {
                currentData.walls.push({
                    id: 'wall-' + Date.now() + '-' + Math.random().toString(36).substr(2, 6),
                    startX: w.startX,
                    startY: w.startY,
                    endX: w.endX,
                    endY: w.endY,
                    thickness: targetThickness,
                    type: 'outer',
                    height: targetHeight,
                    windows: [],
                    doors: [],
                    decors: []
                });
            });
            
            planner.value.importState(JSON.stringify(currentData));
            if (planner.value && planner.value.walls) {
                WallEngine.batchUpdate(planner.value, planner.value.walls, { height: targetHeight });
            }
            saveCurrentLevelState();
            saveHistory();
            if (viewMode.value === '3d') refresh3DScene(true);
            return true;
        } catch (e) {
            console.error("Failed to project walls from reference:", e);
            return false;
        }
    };

    return {
        saveCurrentLevelState,
        updateStaticLevelData,
        getEffectiveReferenceIndex,
        refreshReferenceOverlay,
        setReferenceLevelIndex,
        setReferenceOpacity,
        switchLevel,
        addLevel,
        deleteLevel,
        updateLevelDetails,
        projectWallsFromReference
    };
}
