import { storeToRefs } from 'pinia';
import { useUIStore } from '../stores/useUIStore.js';
import { usePlannerStore } from '../stores/usePlannerStore.js';

export function useKeyboardShortcuts(dependencies) {
    const uiStore = useUIStore();
    const plannerStore = usePlannerStore();
    
    const { viewMode } = storeToRefs(uiStore);
    const { selectedType, renderer3D } = storeToRefs(plannerStore);

    const { undo, redo, handleDelete, debouncedSaveHistory, setTool, toggleCategory } = dependencies;

    const handleGlobalKeys = (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            if (e.shiftKey) redo(); else undo();
            e.preventDefault(); return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            redo(); e.preventDefault(); return;
        }

        if (viewMode.value === '3d') {
            if (e.key === 'Delete' || e.key === 'Backspace') { 
                if (selectedType.value === 'furniture' || selectedType.value === 'stair' ) { handleDelete(); debouncedSaveHistory(); }
            }
            if (e.key === 'Escape' && renderer3D.value) renderer3D.value.cancelRelocation();
        } else if (viewMode.value === '2d') {
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selectedType.value === 'roof' || selectedType.value === 'furniture' || selectedType.value === 'widget' || selectedType.value === 'molding' || selectedType.value === 'advance_openings' || selectedType.value === 'shape' || selectedType.value === 'wall' || selectedType.value === 'arc' || selectedType.value === 'room' || selectedType.value === 'stair' ) { handleDelete(); debouncedSaveHistory(); }
            }
            if (e.key === 'Escape') {
                setTool('select');
                toggleCategory('tools');
            }
        }
    };

    return {
        handleGlobalKeys
    };
}
