import { PRESET_REGISTRY } from '../core/engine2d/presetRegistry.js';

export function useAppTools({
    activeTool,
    activePresetParams,
    planner,
    debouncedSaveHistory,
    showAdvancedTools,
    isMobile,
    isTablet,
    mobileMenuOpen,
    wizardPopupRef,
    activeDecorId,
    renderer3D,
    selectedType,
    selectedEntity,
    selectedWallSide,
    uiTrigger,
    updateStaticLevelData,
    activeCategory,
    viewMode,
    refresh3DScene,
    handleDeselect
}) {
    const setTool = (tool, params = undefined) => { 
        if (tool === 'split') {
            const wall = planner.value.walls.find(w => w === planner.value.selectedEntity);
            if (wall) { wall.split(); debouncedSaveHistory(); }
            return;
        }
        activeTool.value = tool; 
        
        if (params !== undefined) {
            activePresetParams.value = params ? JSON.parse(JSON.stringify(params)) : null;
            planner.value.activePresetParams = activePresetParams.value;
        } else if (tool.startsWith('preset_') && PRESET_REGISTRY[tool]) {
            activePresetParams.value = JSON.parse(JSON.stringify(PRESET_REGISTRY[tool].defaultParams));
            planner.value.activePresetParams = activePresetParams.value;
        } else if (tool === 'door' || tool === 'window') {
            if (!activePresetParams.value || (tool === 'door' && !activePresetParams.value.doorType) || (tool === 'window' && !activePresetParams.value.windowType)) {
                if (tool === 'door') {
                    activePresetParams.value = { doorType: 'single', doorStyle: 'flat' };
                } else {
                    activePresetParams.value = { windowType: 'sliding_std' };
                }
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else {
            activePresetParams.value = null;
            planner.value.activePresetParams = null;
        }

        if (planner.value) {
            planner.value.tool = tool; 
            planner.value.finishChain(); 
            planner.value.selectEntity(null); 
            planner.value.updateToolStates(); 
        }
        debouncedSaveHistory();
    };

    const handleToolClick = (tool) => {
        const accordionTools = ['door', 'window', 'sunshade', 'jali_panel', 'curtain', 'wall_art', 'staircase', 'roof', 'dormer', 'molding', 'elevation_fascia', 'wall_catalog', 'shape_catalog', 'adv_opening_catalog', 'railing_catalog', 'furniture_catalog', 'kitchen_catalog', 'bathroom_catalog', 'electronics_catalog', 'sink_catalog', 'tap_catalog', 'hood_catalog', 'small_appliance_catalog', 'household_appliance_catalog', 'trash_catalog'];
        
        if (tool.action === 'furniture') spawnFurniture(tool.id);
        else if (tool.action === 'auto_roof') { if (planner.value) planner.value.addAutoRoof(); }
        else if (tool.action === 'wizard') { wizardPopupRef.value?.open(tool.id); }
        else if (tool.id.startsWith('roof_')) {
            if (planner.value) planner.value.currentRoofToolType = tool.roofType;
            setTool('roof');
        }
        else setTool(tool.id);
        
        if ((isMobile.value || isTablet.value) && !accordionTools.includes(tool.id)) {
            mobileMenuOpen.value = false;
        }
    };

    const toggleCategory = (catId) => {
        if (activeCategory.value === catId) {
            if (isMobile.value || isTablet.value) {
                // Prevent collapsing to an empty view on mobile/tablet; keep active category open
                return;
            }
            activeCategory.value = null; // collapse
        } else {
            activeCategory.value = catId;
            if (planner.value) {
                planner.value.activeCategory = catId;
            }
            
            // Auto-activate default tool for the category
            let defaultTool = 'select';
            if (catId === 'kitchen') defaultTool = 'kitchen_catalog';
            else if (catId === 'bathroom') defaultTool = 'bathroom_catalog';
            else if (catId === 'electronics') defaultTool = 'electronics_catalog';
            else if (catId === 'furniture') defaultTool = 'furniture_catalog';
            else if (catId === 'wall' || catId === 'walls') defaultTool = 'wall_catalog';
            else if (catId === 'doors_windows' || catId === 'door') defaultTool = 'door';
            else if (catId === 'window') defaultTool = 'window';
            else if (catId === 'staircases') defaultTool = 'staircase';
            else if (catId === 'roof_presets') defaultTool = 'roof';
            else if (catId === 'shapes') defaultTool = 'shape_catalog';
            else if (catId === 'advance_openings') defaultTool = 'adv_opening_catalog';
            else if (catId === 'architectural_details') defaultTool = 'molding';
            else if (catId === 'common') defaultTool = 'railing_catalog';
            
            setTool(defaultTool);
        }
    };

    const spawnWallPattern = (configId) => {
        if (renderer3D.value && selectedType.value === 'wall' && selectedEntity.value) {
            if (planner.value) {
                planner.value.executeWithSnapshot(() => {
                    const decor = renderer3D.value.addWallPattern(selectedEntity.value, configId, selectedWallSide.value);
                    selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
                    activeDecorId.value = decor.id; uiTrigger.value++; 
                    if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
                });
                debouncedSaveHistory();
            }
        }
    };

    const spawnFurniture = (configId) => {
        if (planner.value) {
            planner.value.create('furniture', { id: configId });
            debouncedSaveHistory();
        }
    };

    const toggleEditDecor = (decorId) => { 
        activeDecorId.value = activeDecorId.value === decorId ? null : decorId; 
    };

    const handleDelete = () => { 
        if (selectedEntity.value) {
            if (selectedType.value === 'wallDecor') {
                const wall = planner.value.walls.find(w => w.attachedDecor && w.attachedDecor.some(d => d.id === selectedEntity.value.id));
                if (wall) {
                    wall.attachedDecor = wall.attachedDecor.filter(d => d.id !== selectedEntity.value.id);
                    if (wall.isStatic) updateStaticLevelData(wall);
                }
                selectedEntity.value = null;
                selectedType.value = null;
                if (viewMode.value === '3d') refresh3DScene(true);
            } else if (selectedType.value === 'room') {
                selectedEntity.value.isDeleted = true;
                selectedEntity.value = null;
                selectedType.value = null;
                if (viewMode.value === '3d') refresh3DScene(true);
                else if (planner.value) planner.value.syncAll();
            } else {
                if (planner.value) {
                    const id = selectedEntity.value.id || (selectedEntity.value.group && selectedEntity.value.group.id());
                    planner.value.delete(id || selectedEntity.value);
                    selectedEntity.value = null;
                    selectedType.value = null;
                    if (viewMode.value === '3d') refresh3DScene(true);
                    else if (typeof planner.value.syncAll === 'function') planner.value.syncAll();
                }
            }
        }
    };

    const handleDeleteSpecificDecor = (decorObj) => {
        const decor = decorObj || selectedEntity.value;
        if (decor) {
            const wall = decor.mesh3D.userData.parentWall;
            wall.attachedDecor = wall.attachedDecor.filter(d => d !== decor); wall.mesh3D.remove(decor.mesh3D);
            if (selectedEntity.value === wall || selectedEntity.value === decor) wall.attachedDecor = [...wall.attachedDecor]; 
            if (renderer3D.value && renderer3D.value.selectedObject === decor.mesh3D) { 
                renderer3D.value.deselectObject(); 
                if (handleDeselect) handleDeselect(); 
            }
            uiTrigger.value++;
            
            if (wall.isStatic) updateStaticLevelData(wall);
            debouncedSaveHistory();
        }
    };

    return {
        setTool,
        handleToolClick,
        toggleCategory,
        spawnWallPattern,
        spawnFurniture,
        toggleEditDecor,
        handleDelete,
        handleDeleteSpecificDecor
    };
}
