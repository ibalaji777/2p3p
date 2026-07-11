import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/useUIStore.js';
import { usePlannerStore } from '../stores/usePlannerStore.js';

export function useLevelManager(dependencies) {
    const uiStore = useUIStore();
    const plannerStore = usePlannerStore();
    
    const { viewMode } = storeToRefs(uiStore);
    const { planner, levels, activeLevelIndex } = storeToRefs(plannerStore);

    const { handleDeselect, refresh3DScene, saveHistory } = dependencies;

    const saveCurrentLevelState = () => { 
        if (planner.value) levels.value[activeLevelIndex.value].data = planner.value.exportState(); 
    };

    const updateStaticLevelData = (staticWall) => {
        const levelIdx = staticWall.levelIndex;
        if (levelIdx === undefined || !levels.value[levelIdx]) return;
        
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

    const switchLevel = (index) => {
        if (index === activeLevelIndex.value) return; 
        saveCurrentLevelState();
        planner.value.clearReferenceBackground();
        handleDeselect();

        activeLevelIndex.value = index;
        const targetData = levels.value[index].data;
        if (targetData) planner.value.importState(targetData); else planner.value.clearAll(); 

        if (index > 0) {
            const referenceData = levels.value[index - 1].data;
            if (referenceData) planner.value.loadReferenceBackground(referenceData);
        }
        
        if (viewMode.value === '3d') refresh3DScene(true); 
        saveHistory();
    };

    const addLevel = (type) => {
        saveCurrentLevelState();
        const newIndex = levels.value.length;
        levels.value.push({ id: 'level-' + Date.now(), name: `Floor ${newIndex + 1}`, data: type === 'duplicate' ? levels.value[activeLevelIndex.value].data : null, isVisible: true });
        switchLevel(newIndex);
        saveHistory();
    };

    return {
        saveCurrentLevelState,
        updateStaticLevelData,
        switchLevel,
        addLevel
    };
}
