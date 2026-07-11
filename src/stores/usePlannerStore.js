import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';

export const usePlannerStore = defineStore('planner', () => {
    // Core Engine Instances (shallowRef to prevent deep reactivity overhead)
    const planner = shallowRef(null);
    const renderer3D = shallowRef(null);
    const workspaceControls = shallowRef(null);
    const serverService = shallowRef(null);

    // Editing State
    const isDrawing = ref(false);
    const activeTool = ref('select');
    const activeCategory = ref('tools');
    const mode3D = ref('edit');
    const activePresetParams = ref(null);

    // Selection State
    const selectedEntity = shallowRef(null);
    const selectedType = ref(null);
    const selectedWallSide = ref(null);
    const selectedNodeIndex = ref(-1);

    // Levels / History State
    const levels = ref([{ id: 'level-' + Date.now(), name: 'Floor 1', data: null, isVisible: true }]);
    const activeLevelIndex = ref(0);
    const canUndo = ref(false);
    const canRedo = ref(false);

    // Getters
    const allFloorsVisible = computed(() => levels.value.every(l => l.isVisible !== false));

    // Actions
    const setSelection = (entity, type, nodeIdx = -1, side = null) => {
        selectedEntity.value = entity;
        selectedType.value = type;
        selectedNodeIndex.value = nodeIdx;
        if (side !== null) selectedWallSide.value = side;
    };

    const toggleAllFloors = () => {
        const newState = !allFloorsVisible.value;
        levels.value.forEach(l => { l.isVisible = newState; });
    };

    const updateHistoryState = () => {
        if (planner.value) {
            canUndo.value = planner.value.commandManager ? planner.value.commandManager.canUndo() : false;
            canRedo.value = planner.value.commandManager ? planner.value.commandManager.canRedo() : false;
        }
    };

    return {
        planner,
        renderer3D,
        workspaceControls,
        serverService,
        isDrawing,
        activeTool,
        activeCategory,
        mode3D,
        activePresetParams,
        selectedEntity,
        selectedType,
        selectedWallSide,
        selectedNodeIndex,
        levels,
        activeLevelIndex,
        canUndo,
        canRedo,
        allFloorsVisible,
        setSelection,
        toggleAllFloors,
        updateHistoryState
    };
});
