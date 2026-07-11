import { storeToRefs } from 'pinia';
import { usePlannerStore } from '../stores/usePlannerStore.js';
import { useUIStore } from '../stores/useUIStore.js';
import { useSettingsStore } from '../stores/useSettingsStore.js';

export function useHistory(dependencies) {
    const plannerStore = usePlannerStore();
    const uiStore = useUIStore();
    const settingsStore = useSettingsStore();

    const { planner, levels, activeLevelIndex } = storeToRefs(plannerStore);
    const { layerRefreshTrigger, viewMode } = storeToRefs(uiStore);
    const { floorPlanSettings } = storeToRefs(settingsStore);

    const { refresh3DScene, handleDeselect } = dependencies || {};

    const saveHistory = () => {
        if (planner.value) {
            levels.value[activeLevelIndex.value].data = planner.value.exportState();
        }
    };

    let historyTimeout = null;
    const debouncedSaveHistory = () => {
        if (historyTimeout) clearTimeout(historyTimeout);
        historyTimeout = setTimeout(() => {
            saveHistory();
            layerRefreshTrigger.value++;
        }, 500);
    };

    const undo = () => {
        if (planner.value) planner.value.undo();
    };

    const redo = () => {
        if (planner.value) planner.value.redo();
    };

    // Deprecated in Phase 5: Kept for reference but not used for general mutation
    const restoreHistoryState = (stateStr) => {
        const state = JSON.parse(stateStr);

        levels.value = state.levels.map(l => ({ ...l, isVisible: l.isVisible !== false }));
        activeLevelIndex.value = state.activeLevelIndex;    
        if (planner.value) {
            if (levels.value[activeLevelIndex.value].data) {
                planner.value.importState(levels.value[activeLevelIndex.value].data);
            } else {
                planner.value.clearAll();
            }
            
            if (activeLevelIndex.value > 0 && levels.value[activeLevelIndex.value - 1].data) {
                planner.value.loadReferenceBackground(levels.value[activeLevelIndex.value - 1].data);
            } else {
                planner.value.clearReferenceBackground();
            }
            
            if (planner.value.settings) {
                Object.assign(floorPlanSettings.value, planner.value.settings);
            }
        }
        
        if (handleDeselect) handleDeselect();
        if (viewMode.value === '3d') {
            if (refresh3DScene) refresh3DScene(true);
        } else {
            if (planner.value) planner.value.syncAll();
        }
    };

    return {
        saveHistory,
        debouncedSaveHistory,
        undo,
        redo,
        restoreHistoryState
    };
}
