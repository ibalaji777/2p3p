import { PRESET_REGISTRY } from '../core/engine2d/presetRegistry.js';
import { FURNITURE_REGISTRY } from '../features/furniture/furniture.registry.js';
import { applyWallPaintWithScope } from '../core/engine3d/WallPaintSystem.js';

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
    paintScope,
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
        } else if (tool === 'room_box') {
            if (!activePresetParams.value || activePresetParams.value.type !== 'room_box') {
                activePresetParams.value = { type: 'room_box', thickness: 16, height: 120 };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'foundation' || tool === 'foundation_wall') {
            if (!activePresetParams.value || activePresetParams.value.type !== 'foundation') {
                activePresetParams.value = { type: 'foundation', thickness: 24, height: 40, material: 'stone_ashlar_grey' };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'foundation_box') {
            if (!activePresetParams.value || activePresetParams.value.type !== 'foundation_box') {
                activePresetParams.value = { type: 'foundation_box', thickness: 24, height: 40, material: 'stone_ashlar_grey' };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'half_wall') {
            if (!activePresetParams.value || activePresetParams.value.type !== 'half_wall') {
                activePresetParams.value = { type: 'half_wall', thickness: 10, height: 50, material: 'white_paint' };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'outer' || tool === 'wall') {
            if (!activePresetParams.value || activePresetParams.value.type !== 'outer') {
                activePresetParams.value = { type: 'outer', thickness: 16, height: 120 };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'door' || tool.startsWith('door_')) {
            if (!activePresetParams.value || !activePresetParams.value.doorType) {
                activePresetParams.value = { doorType: 'single', doorStyle: 'flat' };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'window' || tool.startsWith('window_')) {
            if (!activePresetParams.value || !activePresetParams.value.windowType) {
                activePresetParams.value = { windowType: 'sliding_std' };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'skirting' || tool === 'molding' || tool === 'wall_trim' || tool.startsWith('molding_') || tool.startsWith('skirting_') || tool.startsWith('trim_') || tool.startsWith('chair_rail') || tool.startsWith('picture_rail')) {
            if (!activePresetParams.value || (!activePresetParams.value.profileType && !activePresetParams.value.type?.startsWith('molding_'))) {
                if (tool === 'skirting' || tool.startsWith('skirting_')) {
                    activePresetParams.value = { type: 'molding_skirting_flat', profileType: 'skirting_flat', heightOffset: 0, moldingHeight: 12, depth: 2, material: 'white_paint' };
                } else if (tool === 'molding' || tool.includes('crown')) {
                    activePresetParams.value = { type: 'molding_crown', profileType: 'crown', heightOffset: 170, moldingHeight: 10, depth: 5, material: 'white_paint' };
                } else {
                    activePresetParams.value = { type: 'molding_chair_rail', profileType: 'chair_rail', heightOffset: 90, moldingHeight: 8, depth: 2.5, material: 'white_paint' };
                }
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'elevation_fascia' || tool.startsWith('fascia_')) {
            if (!activePresetParams.value || activePresetParams.value.type !== 'elevation_fascia') {
                activePresetParams.value = { type: 'elevation_fascia', profileType: 'c_shape_left', width: 100, height: 120, depth: 40, thick: 10, elevation: 0, fasciaMat: 'white' };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'sunshade' || tool.startsWith('sunshade_') || tool === 'chajja') {
            if (!activePresetParams.value || (activePresetParams.value.type !== 'sunshade' && !activePresetParams.value.chajjaType)) {
                activePresetParams.value = { type: 'sunshade', chajjaType: 'concrete_slab', width: 60, depth: 30, thick: 4, elevation: 80 };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'jali_panel' || tool.startsWith('jali_')) {
            if (!activePresetParams.value || (activePresetParams.value.type !== 'jali_panel' && !activePresetParams.value.jaliPattern)) {
                activePresetParams.value = { type: 'jali_panel', pattern: 'geometric_islamic', width: 60, height: 80, depth: 2, elevation: 40 };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'curtain' || tool.startsWith('curtain_')) {
            if (!activePresetParams.value || (activePresetParams.value.type !== 'curtain' && !activePresetParams.value.curtainType)) {
                activePresetParams.value = { type: 'curtain', curtainType: 'drapes_double', width: 80, height: 95, depth: 8, elevation: 45 };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'wall_art' || tool.startsWith('decor_wall_') || tool.startsWith('decor_photo_')) {
            if (!activePresetParams.value || (activePresetParams.value.type !== 'wall_art' && !activePresetParams.value.artType)) {
                activePresetParams.value = { type: 'wall_art', artType: 'modern_canvas', width: 50, height: 35, depth: 3, elevation: 45 };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'skylight' || tool.startsWith('skylight_')) {
            if (!activePresetParams.value || !activePresetParams.value.type?.startsWith('skylight_')) {
                activePresetParams.value = {
                    type: 'skylight_flush_flat',
                    material: 'glass_roof_square_grid',
                    frameMaterial: 'metal_dark_steel',
                    width: 120,
                    length: 180,
                    depth: 10,
                    coverage: 'custom'
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'roof_cresting' || tool.startsWith('ridge_cresting_')) {
            if (!activePresetParams.value || !activePresetParams.value.type?.startsWith('ridge_cresting_')) {
                activePresetParams.value = {
                    type: 'ridge_cresting_victorian_lace',
                    sculptureCategory: 'cresting',
                    material: 'metal_wrought_iron',
                    height: 18,
                    spacing: 22
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'roof_finial' || tool.startsWith('finial_')) {
            if (!activePresetParams.value || !activePresetParams.value.type?.startsWith('finial_')) {
                activePresetParams.value = {
                    type: 'finial_victorian_spire',
                    sculptureCategory: 'finial',
                    material: 'metal_wrought_iron',
                    height: 45,
                    scale: 1.0
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'roof_chimney' || tool.startsWith('chimney_')) {
            if (!activePresetParams.value || !activePresetParams.value.type?.startsWith('chimney_')) {
                activePresetParams.value = {
                    type: 'chimney_brick_traditional',
                    sculptureCategory: 'chimney',
                    material: 'red_brick',
                    capMaterial: 'limestone',
                    potMaterial: 'terracotta_clay',
                    width: 45,
                    depth: 45,
                    height: 90
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'roof_sculptures' || tool === 'roof_sculpture') {
            if (!activePresetParams.value) {
                activePresetParams.value = {
                    type: 'ridge_cresting_victorian_lace',
                    sculptureCategory: 'cresting',
                    material: 'metal_wrought_iron',
                    height: 18,
                    spacing: 22
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'staircase' || tool.startsWith('stair_')) {
            if (!activePresetParams.value) {
                activePresetParams.value = {
                    type: 'stair_v5_straight',
                    shape: 'straight',
                    width: 100,
                    length: 330,
                    height: 300,
                    totalSteps: 12,
                    stepDepth: 28,
                    stepHeight: 17.5,
                    stringerType: 'solid',
                    primaryColor: '#8b5a2b',
                    materials: {
                        treads: { id: 'wood_golden_teak' },
                        risers: { id: 'wood_golden_teak' },
                        stringers: { id: 'wood_white_oak' },
                        landings: { id: 'wood_golden_teak' }
                    }
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'platform' || tool.startsWith('platform_') || tool === 'platform_catalog') {
            if (!activePresetParams.value || activePresetParams.value.type !== 'platform') {
                activePresetParams.value = {
                    type: 'platform',
                    shapeType: tool === 'platform_polygon' ? 'polygon' : 'rect',
                    width: 120,
                    depth: 120,
                    height: 20,
                    stepHeight: 15,
                    elevation: 0,
                    trimStyle: 'flat',
                    materials: {
                        top: { id: 'wood_golden_teak' },
                        side: { id: 'wood_white_oak' }
                    }
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (FURNITURE_REGISTRY && (FURNITURE_REGISTRY[tool] || tool === 'furniture' || tool === 'kitchen' || tool === 'bathroom' || tool === 'electronics' || tool.startsWith('furniture_') || tool.startsWith('kitchen_') || tool.startsWith('bathroom_') || tool.startsWith('sanitary_') || tool.startsWith('electronics_'))) {
            const config = (FURNITURE_REGISTRY && FURNITURE_REGISTRY[tool]) ? FURNITURE_REGISTRY[tool] : {};
            if (!activePresetParams.value) {
                activePresetParams.value = {
                    type: tool,
                    id: tool,
                    width: config.default?.width || 100,
                    depth: config.default?.depth || 100,
                    height: config.default?.height || 80,
                    elevation: config.default?.elevation || 0,
                    materials: config.default?.materials || null
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool && (tool.startsWith('shape_') || tool === 'shape_catalog')) {
            if (!activePresetParams.value || activePresetParams.value.type !== tool) {
                activePresetParams.value = {
                    type: tool,
                    height3D: 100,
                    fill: '#f0f4f8',
                    stroke: '#9ca3af'
                };
                planner.value.activePresetParams = activePresetParams.value;
            }
        } else if (tool === 'adv_opening_catalog' || ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut', 'opening'].includes(tool)) {
            const opType = (tool === 'adv_opening_catalog') ? 'arch_opening' : tool;
            if (!activePresetParams.value || activePresetParams.value.type !== opType) {
                const isPassage = opType === 'arch_opening' || opType === 'opening';
                activePresetParams.value = {
                    type: opType,
                    width: opType === 'circular_opening' ? 40 : 50,
                    height: isPassage ? 80 : (opType === 'circular_opening' ? 40 : 60),
                    depth: opType === 'niche_recess' ? 6 : 10,
                    elevation: isPassage ? 0 : 40
                };
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
        const accordionTools = ['door', 'window', 'skirting', 'sunshade', 'jali_panel', 'curtain', 'wall_art', 'staircase', 'roof', 'molding', 'elevation_fascia', 'wall_catalog', 'shape_catalog', 'adv_opening_catalog', 'railing_catalog', 'furniture_catalog', 'kitchen_catalog', 'bathroom_catalog', 'electronics_catalog', 'sink_catalog', 'tap_catalog', 'hood_catalog', 'small_appliance_catalog', 'household_appliance_catalog', 'trash_catalog', 'floors', 'outdoor_spaces', 'outdoor_pavement', 'outdoor_patio', 'outdoor_softscape', 'outdoor_other', 'platform_catalog', 'platform', 'platform_rect', 'platform_polygon'];
        
        if (tool.action === 'furniture') {
            if (viewMode.value === '3d') {
                const config = (FURNITURE_REGISTRY && FURNITURE_REGISTRY[tool.id]) || {};
                const params = {
                    type: tool.id,
                    id: tool.id,
                    width: config.default?.width || 100,
                    depth: config.default?.depth || 100,
                    height: config.default?.height || 80,
                    elevation: config.default?.elevation || 0,
                    materials: config.default?.materials || null
                };
                setTool(tool.id, params);
            } else {
                spawnFurniture(tool.id);
            }
        }
        else if (tool.action === 'auto_roof') { if (planner.value) planner.value.addAutoRoof(); }
        else if (tool.action === 'wizard') { wizardPopupRef.value?.open(tool.id); }
        else if (tool.id.startsWith('roof_')) {
            const roofType = tool.roofType || tool.id.replace('roof_', '');
            const params = { toolId: 'roof', roofType, pitch: 30, material: 'terracotta_tiles_roof' };
            if (planner.value) {
                planner.value.currentRoofToolType = roofType;
                planner.value.activePresetParams = params;
            }
            activePresetParams.value = params;
            setTool('roof', params);
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
            else if (catId === 'floors' || catId === 'floor' || catId === 'outdoor_spaces') defaultTool = 'outdoor_pavement';
            else if (catId === 'platforms' || catId === 'platform') defaultTool = 'platform_rect';
            else if (catId === 'common') defaultTool = 'railing_catalog';
            
            setTool(defaultTool);
        }
    };

    const spawnWallPattern = (configId, scopeOverride = null) => {
        if (renderer3D.value && (selectedType.value === 'wall' || selectedType.value === 'arc' || selectedEntity.value?.parentArc) && selectedEntity.value) {
            if (planner.value) {
                planner.value.executeWithSnapshot(() => {
                    const currentScope = scopeOverride || paintScope?.value || 'single';
                    const arc = selectedEntity.value.parentArc || (selectedType.value === 'arc' ? selectedEntity.value : null);
                    
                    if (arc && arc.walls) {
                        const paramKey = selectedWallSide.value === 'back' ? 'textureBack' : 'textureFront';
                        arc.params = arc.params || {};
                        arc.params[paramKey] = configId;
                        arc.walls.forEach(w => {
                            w.params = w.params || {};
                            w.params[paramKey] = configId;
                        });
                        syncEngine('material');
                    } else if (currentScope === 'room' || currentScope === 'exterior') {
                        const results = applyWallPaintWithScope({
                            wall: selectedEntity.value,
                            side: selectedWallSide.value,
                            configId,
                            scope: currentScope,
                            planner: planner.value,
                            renderer3D: renderer3D.value
                        });
                        if (results.length > 0) {
                            activeDecorId.value = results[0].decor.id;
                        }
                        uiTrigger.value++;
                    } else {
                        const decor = renderer3D.value.addWallPattern(selectedEntity.value, configId, selectedWallSide.value);
                        selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
                        activeDecorId.value = decor.id;
                        uiTrigger.value++; 
                        if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
                    }
                });
                debouncedSaveHistory();
            }
        }
    };

    const spawnFurniture = (configId) => {
        if (planner.value) {
            planner.value.create('furniture', { id: configId });
            planner.value.tool = 'select';
            planner.value.activePresetParams = null;
            if (typeof planner.value.updateToolStates === 'function') {
                planner.value.updateToolStates();
            }
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
                    const targetEntity = selectedEntity.value.parentArc || selectedEntity.value;
                    const id = targetEntity.id || (targetEntity.group && typeof targetEntity.group.id === 'function' && targetEntity.group.id());
                    planner.value.delete(id || targetEntity);
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
