<template>
  <div class="app-root">
    <TopToolbar
      :view-mode="viewMode"
      :view-mode3D="viewMode3D"
      :history-index="historyIndex"
      :history-length="historyStack.length"
      @switch-2d="switchTo2D"
      @switch-3d="switchTo3D"
      @toggle-preview="togglePreviewMode"
      @undo="undo"
      @redo="redo"
    />

    <div class="main-workspace" @mouseup="debouncedSaveHistory" @touchend="debouncedSaveHistory">
      <LeftSidebar
        :view-mode="viewMode"
        :is-mobile="isMobile"
        :is-tablet="isTablet"
        :mobile-menu-open="mobileMenuOpen"
        :active-mobile-tab="activeMobileTab"
        :menu-categories="menuCategories"
        :active-category="activeCategory"
        :active-category-obj="activeCategoryObj"
        :active-tool="activeTool"
        @close-mobile-menu="mobileMenuOpen = false"
        @toggle-category="toggleCategory"
        @save-project="saveProject"
        @open-save-popup="savePopupRef?.open()"
        @trigger-file-input="triggerFileInput"
        @clear-workspace="clearWorkspace"
        @file-uploaded="handleFileUpload"
        @tool-click="handleToolClick"
      />

      <!-- Mobile Left Trigger -->
      <div class="mobile-left-trigger" v-if="(isMobile || isTablet) && viewMode === '2d' && !(mobileMenuOpen && activeMobileTab === 'tools')" @click="toggleMobileTab('tools')" title="Open Tools">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>

      <!-- Mobile Bottom Navigation -->
      <MobileBottomNav
        :is-mobile="isMobile"
        :is-tablet="isTablet"
        :active-mobile-tab="activeMobileTab"
        :mobile-menu-open="mobileMenuOpen"
        @toggle-tab="toggleMobileTab"
      />
      
      <CanvasWorkspace
        ref="canvasWorkspaceRef"
        :hint-data="hintData"
        :view-mode="viewMode"
        :show-guide="showGuide"
        :show-advanced-tools="showAdvancedTools"
        :is-advanced-tool-active="isAdvancedToolActive"
        :active-tool="activeTool"
        :is-wall-tracking-enabled="isWallTrackingEnabled"
        :show-camera="showCamera"
        :is-xray-mode="isXRayMode"
        :floor-plan-settings="floorPlanSettings"
        :is-rebuilding="isRebuilding"
        :view-mode3D="viewMode3D"
        :mode3D="mode3D"
        :selected-type="selectedType"
        @update:show-guide="showGuide = $event"
        @update:show-advanced-tools="showAdvancedTools = $event"
        @update:show-camera="showCamera = $event"
        @handle-adv-trigger-click="handleAdvTriggerClick"
        @set-advanced-tool="setAdvancedTool"
        @toggle-wall-tracking="toggleWallTracking"
        @set-camera-preset="setCameraPreset"
        @rotate-camera="rotateCamera"
        @toggle-xray-mode="toggleXRayMode"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset-zoom="resetZoom"
      />

      <RightSidebar
        @update:mobileMenuOpen="mobileMenuOpen = $event"
        @update:activeRightTab="activeRightTab = $event"
        @update:selectedSky="selectedSky = $event"
        @update:selectedGround="selectedGround = $event"
        :is-mobile="isMobile"
        :is-tablet="isTablet"
        :mobile-menu-open="mobileMenuOpen"
        :active-mobile-tab="activeMobileTab"
        :view-mode="viewMode"
        :view-mode3D="viewMode3D"
        :levels="levels"
        :active-level-index="activeLevelIndex"
        :all-floors-visible="allFloorsVisible"
        :active-right-tab="activeRightTab"
        :floor-plan-settings="floorPlanSettings"
        :selected-sky="selectedSky"
        :selected-ground="selectedGround"
        :sky-registry="skyRegistry"
        :ground-registry="groundRegistry"
        :selected-type="selectedType"
        :selected-entity="selectedEntity"
        :railing-registry="railingRegistry"
        :selected-wall-side="selectedWallSide"
        :current-face-decors="currentFaceDecors"
        :active-decor-id="activeDecorId"
        :wall-decor-registry="wallDecorRegistry"
        :ui-trigger="uiTrigger"
        :floor-registry="floorRegistry"
        :roof-decor-registry="roofDecorRegistry"
        :layer-items="layerItems"
        @toggle-all-floors="toggleAllFloors"
        @level-visibility-change="onLevelVisibilityChange"
        @switch-level="switchLevel"
        @add-level="addLevel"
        @sync-settings="syncSettings"
        @set-entrance-wall="setEntranceWall"
        @set-sky="setSky"
        @set-ground="setGround"
        @sync-engine="syncEngine"
        @ui-trigger="uiTrigger++"
        @toggle-edit-decor="toggleEditDecor"
        @delete-specific-decor="handleDeleteSpecificDecor"
        @decor-update="onDecorUpdate"
        @spawn-wall-pattern="spawnWallPattern"
        @delete-entity="handleDelete"
        @set-floor-material="setFloorMaterial"
        @set-opening-material="setOpeningMaterial"
        @clear-shape-textures="clearShapeTextures"
        @set-shape-material="setShapeMaterial"
        @set-roof-material="setRoofMaterial"
        @select-layer-item="selectLayerItem"
        @toggle-layer-visibility="toggleLayerVisibility"
        @remove-layer-item="removeLayerItem"
        @debounced-save-history="debouncedSaveHistory"
      />

      <!-- Wizard Popup -->
      <SmartWizardPopup
        ref="wizardPopupRef"
        :wizard-manager="wizardManager"
        :context-data="{ floorPlanSettings, planner, syncSettings, refresh3DScene }"
        @success="debouncedSaveHistory"
      />

      <!-- Save Popup Overlay -->
      <SavePopup
        ref="savePopupRef"
        :server-service="serverService"
        :view-mode="viewMode"
        @refresh-scene="refresh3DScene"
        @saved="debouncedSaveHistory"
      />

    </div>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue';
import LeftSidebar from './components/LeftSidebar.vue';
import RightSidebar from './components/RightSidebar.vue';
import TopToolbar from './components/TopToolbar.vue';
import CanvasWorkspace from './components/CanvasWorkspace.vue';
import SmartWizardPopup from './components/SmartWizardPopup.vue';
import SavePopup from './components/SavePopup.vue';
import MobileBottomNav from './components/MobileBottomNav.vue';

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1200);
const isDesktop = computed(() => windowWidth.value >= 1200);
const mobileMenuOpen = ref(true);
const activeMobileTab = ref('tools');

const toggleMobileTab = (tab) => {
    if (activeMobileTab.value === tab && mobileMenuOpen.value) {
        mobileMenuOpen.value = false;
    } else {
        activeMobileTab.value = tab;
        mobileMenuOpen.value = true;
    }
};

watch(activeMobileTab, (newVal) => {
    if (['properties', 'layers', 'settings'].includes(newVal)) {
        activeRightTab.value = newVal;
    }
});

const handleResize = () => {
    windowWidth.value = window.innerWidth;
    if (!isMobile.value && !isTablet.value) mobileMenuOpen.value = false;
    
    if (planner.value) {
        planner.value.resize();
    }
    if (renderer3D.value) {
        renderer3D.value.resize();
    }
};


import { SmartWizardManager } from './core/plugins/SmartWizardManager.js';
import { SmartFacingPlugin } from './core/plugins/SmartFacingPlugin.js';
import { SmartWallResizePlugin } from './core/plugins/SmartWallResizePlugin.js';

import { FloorPlanner, PremiumFurniture } from './core/engine2d/index.js';
import { Preview3D } from './core/engine3d.js'; 
import { WorkspaceControls } from '/src/core/engine3d/WorkspaceControls.js';
import { ServerClass } from './core/ServerClass.js';

import { FileManager } from './core/io.js';
import { WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, FLOOR_REGISTRY, RAILING_REGISTRY } from './core/registry.js';
const wallDecorRegistry = WALL_DECOR_REGISTRY;
const roofDecorRegistry = ROOF_DECOR_REGISTRY;
const skyRegistry = SKY_REGISTRY;
const groundRegistry = GROUND_REGISTRY;
const floorRegistry = FLOOR_REGISTRY;
const railingRegistry = RAILING_REGISTRY;

const wizardPopupRef = ref(null);
const savePopupRef = ref(null);
const wizardManager = shallowRef(null);

const floorPlanSettings = ref({
    mainEntranceFacing: 'north',
    measurementUnit: 'feet_inches',
    areaUnit: 'sqft',
    showCompass: true,
    showGrid: true,
    showDimensionLabels: true,
    showDiagonalDimensions: true,
    diagonalMeasurementMode: 'inner',
    showWorkspaceLabels: true,
    wallTracking: true,
    entranceWallId: null
});

const syncSettings = () => {
    if (planner.value) {
        planner.value.settings = { ...floorPlanSettings.value };
        planner.value.setWallTracking(floorPlanSettings.value.wallTracking);
        isWallTrackingEnabled.value = floorPlanSettings.value.wallTracking;
        planner.value.syncAll();
        debouncedSaveHistory();
    }
};

const setEntranceWall = () => {
    if (selectedType.value === 'wall' && selectedEntity.value) {
        floorPlanSettings.value.entranceWallId = selectedEntity.value;
        syncSettings();
    }
};

const canvasWorkspaceRef = ref(null);
const planner = shallowRef(null);
const renderer3D = shallowRef(null);
const workspaceControls = shallowRef(null);
const serverService = shallowRef(null);

const historyStack = ref([]);
const historyIndex = ref(-1);
const isUndoRedoAction = ref(false);

const viewMode = ref('2d');
const mode3D = ref('edit'); 
const activeTool = ref('select');
const viewMode3D = ref('full-edit'); 

const selectedEntity = shallowRef(null);
const selectedType = ref(null);
const selectedWallSide = ref(null); 
const selectedNodeIndex = ref(-1);

const activeCategory = ref('tools');
const menuCategories = ref([
    {
        id: 'common', name: 'Common',
        icon: '<path d="M4 6h16M4 12h16M4 18h16M8 6v12M16 6v12"></path>',
        tools: [
            { id: 'railing', name: 'Draw Railing' }
        ]
    },
    {
        id: 'tools', name: 'General',
        icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path>',
        tools: [
            { id: 'select', name: 'Select & Edit' }
        ]
    },
    {
        id: 'walls', name: 'Walls',
        icon: '<path d="M4 4h16v16H4z"></path><path d="M4 12h16"></path><path d="M12 4v16"></path>',
        tools: [
            { id: 'outer', name: 'Outer Wall' },
            { id: 'inner', name: 'Inner Wall' },
            { id: 'arc', name: 'Curved Wall (Arc)' }
        ]
    },
    {
        id: 'doors_windows', name: 'Doors & Windows',
        icon: '<path d="M4 22h16"></path><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"></path><path d="M14 12h2"></path>',
        tools: [
            { id: 'door', name: 'Add Door' },
            { id: 'window', name: 'Add Window' },
            { id: 'sunshade', name: 'Add Sunshade' },
            { id: 'jali_panel', name: 'Add Jali Panel' }
        ]
    },
    {
        id: 'structures', name: 'Structures',
        icon: '<path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
        tools: [
            
            
            
            { id: 'stair_v4_flight', name: 'Stair Flight (V4)' },
            { id: 'stair_v4_landing', name: 'Landing (V4)' },
            { id: 'stair_v4_landing_curve', name: 'U-Curve Landing (V4)' },
            { id: 'roof', name: 'Draw Roof' },
            { id: 'auto_roof', name: 'Generate Auto-Roof', action: 'auto_roof' }
        ]
    },
    {
        id: 'furniture', name: 'Furniture',
        icon: '<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"></path><path d="M2 13h20v5H2z"></path><path d="M4 18v2"></path><path d="M20 18v2"></path>',
        tools: [
            { id: 'couch_1', name: 'Couch', action: 'furniture' },
            { id: 'chair_ekero', name: 'Chair', action: 'furniture' },
            { id: 'table_dining', name: 'Dining Table', action: 'furniture' }
        ]
    },
    {
        id: 'shapes', name: 'Shapes',
        icon: '<path d="M3 8l4-4 4 4v4H3V8z"></path><circle cx="17" cy="6" r="3"></circle><rect x="14" y="14" width="6" height="6" rx="1"></rect><path d="M3 14h6v6H3z"></path>',
        tools: [
            { id: 'shape_rect', name: 'Box (Rectangle)' },
            { id: 'shape_circle', name: 'Cylinder (Circle)' },
            { id: 'shape_triangle', name: 'Prism (Polygon)' }
        ]
    },
    {
        id: 'smart_wizard', name: 'Smart Wizard',
        icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
        tools: [
            { id: 'smart_facing', name: 'Facing', action: 'wizard' },
            { id: 'smart_wall_resize', name: 'Resize Plan', action: 'wizard' }
        ]
    },
    {
        id: 'advance_openings', name: 'Advanced Openings',
        icon: '<path d="M12 2L2 22h20L12 2z"></path><circle cx="12" cy="14" r="3"></circle>',
        tools: [
            { id: 'arch_opening', name: 'Arch Opening' },
            { id: 'circular_opening', name: 'Circular & Oval' },
            { id: 'custom_shape_opening', name: 'Custom Shape Cut' },
            { id: 'niche_recess', name: 'Niche & Recess' },
            { id: 'pattern_opening', name: 'Pattern Opening' },
            { id: 'boolean_cut', name: 'Boolean Cut' }
        ]
    },
    {
        id: 'architectural_details', name: 'Architectural Details',
        icon: '<path d="M3 21h18v-2H3v2zm6-4h12v-2H9v2zm-6-4h18v-2H3v2zm6-4h12V7H9v2zM3 3v2h18V3H3z"></path>',
        tools: [
            { id: 'molding_band', name: 'Horizontal Band', action: 'molding' },
            { id: 'molding_crown', name: 'Crown Molding', action: 'molding' },
            { id: 'molding_ogee', name: 'Ogee (Cyma) Molding', action: 'molding' },
            { id: 'molding_egg_and_dart', name: 'Egg and Dart Molding', action: 'molding' },
            { id: 'molding_dentil', name: 'Dentil Molding', action: 'molding' },
            { id: 'molding_craftsman', name: 'Step / Craftsman', action: 'molding' },
            { id: 'molding_window', name: 'Window Frame', action: 'molding' },
            { id: 'molding_door', name: 'Door Frame', action: 'molding' },
            { id: 'molding_groove', name: 'Decorative Groove', action: 'molding' },
            { id: 'molding_layered', name: 'Layered Projection', action: 'molding' },
            { id: 'elevation_fascia', name: 'Elevation Fascia (C/L Shape)' }
        ]
    }
]);

const activeCategoryObj = computed(() => {
    return menuCategories.value.find(c => c.id === activeCategory.value);
});

const toggleCategory = (catId) => {
    if (activeCategory.value === catId) {
        activeCategory.value = null; // collapse
    } else {
        activeCategory.value = catId;
        if (planner.value) {
            planner.value.activeCategory = catId;
            activeTool.value = 'select';
            planner.value.tool = 'select';
            planner.value.finishChain();
            planner.value.updateToolStates();
            planner.value.selectEntity(null);
        }
    }
};

const uiTrigger = ref(0); 
const isPlacing3D = ref(false);
const activeDecorId = ref(null);
const isRebuilding = ref(false);
const isXRayMode = ref(false);
const showGuide = ref(false);

const toggleXRayMode = () => {
    isXRayMode.value = !isXRayMode.value;
    if (renderer3D.value) {
        renderer3D.value.setXRayMode(isXRayMode.value);
    }
};

const levels = ref([{ id: 'level-' + Date.now(), name: 'Floor 1', data: null, isVisible: true }]);
const activeLevelIndex = ref(0);

const allFloorsVisible = computed(() => levels.value.every(l => l.isVisible !== false));

const toggleAllFloors = () => {
    const newState = !allFloorsVisible.value;
    levels.value.forEach(l => { l.isVisible = newState; });
    if (viewMode.value === '3d') refresh3DScene(true);
};

const onLevelVisibilityChange = () => {
    if (viewMode.value === '3d') refresh3DScene(true);
};

const selectedSky = ref('arch_viz_sunny');
const selectedGround = ref('grass'); // Start with new Grass + Normal map terrain
const showCamera = ref(false);
const showAdvancedTools = ref(false);

const isWallTrackingEnabled = ref(false);
const toggleWallTracking = () => {
    isWallTrackingEnabled.value = !isWallTrackingEnabled.value;
    if (planner.value) {
        planner.value.setWallTracking(isWallTrackingEnabled.value);
    }
};

const activeRightTab = ref('properties');
const layerRefreshTrigger = ref(0);

const layerItems = computed(() => {
    const trigger = layerRefreshTrigger.value;
    if (!planner.value) return [];
    
    const items = [];
    
    if (planner.value.walls) {
        planner.value.walls.forEach((w, i) => {
            if (w.parentArc) return;
            if (w.type === 'railing') {
                items.push({ id: `rail-${i}`, name: `Railing ${i + 1}`, entity: w, type: 'railing' });
            } else {
                items.push({ id: `wall-${i}`, name: w.type === 'inner' ? `Inner Wall ${i + 1}` : `Outer Wall ${i + 1}`, entity: w, type: 'wall' });
            }
        });
    }
    if (planner.value.arcs) {
        planner.value.arcs.forEach((a, i) => {
            items.push({ id: `arc-${i}`, name: `Curved Wall ${i + 1}`, entity: a, type: 'arc' });
        });
    }
    if (planner.value.rooms) {
        planner.value.rooms.forEach((r, i) => {
            if (!r.isDeleted) {
                items.push({ id: `room-${i}`, name: `Room/Floor ${i + 1}`, entity: r, type: 'room' });
            }
        });
    }
    if (planner.value.furniture) {
        planner.value.furniture.forEach((f, i) => {
            items.push({ id: `furn-${i}`, name: f.config?.name || `Furniture ${i + 1}`, entity: f, type: 'furniture' });
        });
    }
    if (planner.value.shapes) {
        planner.value.shapes.forEach((s, i) => {
            let sName = 'Shape';
            if (s.type === 'shape_rect') sName = 'Box';
            if (s.type === 'shape_circle') sName = 'Cylinder';
            if (s.type === 'shape_triangle') sName = 'Prism';
            items.push({ id: `shape-${i}`, name: `${sName} ${i + 1}`, entity: s, type: 'shape' });
        });
    }
    if (planner.value.roofs) {
        planner.value.roofs.forEach((r, i) => {
            items.push({ id: `roof-${i}`, name: `Roof ${i + 1}`, entity: r, type: 'roof' });
        });
    }
    if (planner.value.stairs) {
        planner.value.stairs.forEach((s, i) => {
            items.push({ id: `stair-${i}`, name: `Stair ${i + 1}`, entity: s, type: 'stair' });
        });
    }
    if (planner.value.walls) {
        let wCount = 0;
        planner.value.walls.forEach((w) => {
            if (w.attachedWidgets) {
                w.attachedWidgets.forEach(widget => {
                    if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(widget.type)) {
                        items.push({ id: `adv-op-${wCount++}`, name: widget.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), entity: widget, type: 'advance_openings' });
                    } else {
                        items.push({ id: `widget-${wCount++}`, name: widget.type === 'door' ? 'Door' : 'Window', entity: widget, type: 'widget' });
                    }
                });
            }
        });
    }
    
    return items;
});

const getLayerIcon = (type) => {
    const icons = {
            'wall': '🧱', 'railing': '🪜', 'room': '⬜', 'furniture': '🛋️',
            'shape': '🔳', 'roof': '🏠', 'stair': '📶', 'widget': '🚪', 'arc': '🌙', 'advance_openings': '✂️'
    };
    return icons[type] || '📦';
};

const selectLayerItem = (item) => {
    if (item.entity.isHidden) toggleLayerVisibility(item);
    if (planner.value) planner.value.selectEntity(item.entity, item.type);
};

const toggleLayerVisibility = (item) => {
    const ent = item.entity;
    ent.isHidden = !ent.isHidden;
    
    const group2D = ent.group || ent.wallGroup || ent.visualGroup || ent.poly;
    if (group2D && typeof group2D.visible === 'function') {
        group2D.visible(!ent.isHidden);
    }
    if (ent.labelGroup && typeof ent.labelGroup.visible === 'function') ent.labelGroup.visible(!ent.isHidden);
    if (ent.cutter && typeof ent.cutter.visible === 'function') ent.cutter.visible(!ent.isHidden);
    if (ent.frontHighlight && typeof ent.frontHighlight.visible === 'function') ent.frontHighlight.visible(false);
    if (ent.backHighlight && typeof ent.backHighlight.visible === 'function') ent.backHighlight.visible(false);

    if (planner.value) planner.value.syncAll();
    
    if (ent.mesh3D) ent.mesh3D.visible = !ent.isHidden;
    if (viewMode.value === '3d') refresh3DScene(true);
};

const removeLayerItem = (item) => {
    selectedEntity.value = item.entity;
    selectedType.value = item.type;
    handleDelete();
    layerRefreshTrigger.value++;
};

const saveHistory = () => {
    if (isUndoRedoAction.value) return;
    
    if (planner.value) {
        levels.value[activeLevelIndex.value].data = planner.value.exportState();
    }
    
    const currentState = JSON.stringify({
        levels: levels.value,
        activeLevelIndex: activeLevelIndex.value
    });

    if (historyIndex.value >= 0 && historyStack.value[historyIndex.value] === currentState) {
        return; 
    }

    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
    historyStack.value.push(currentState);
    
    if (historyStack.value.length > 50) {
        historyStack.value.shift();
    } else {
        historyIndex.value++;
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
    if (historyIndex.value > 0) {
        isUndoRedoAction.value = true;
        historyIndex.value--;
        restoreHistoryState(historyStack.value[historyIndex.value]);
        setTimeout(() => { isUndoRedoAction.value = false; }, 100);
    }
};

const redo = () => {
    if (historyIndex.value < historyStack.value.length - 1) {
        isUndoRedoAction.value = true;
        historyIndex.value++;
        restoreHistoryState(historyStack.value[historyIndex.value]);
        setTimeout(() => { isUndoRedoAction.value = false; }, 100);
    }
};

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
    
    handleDeselect();
    if (viewMode.value === '3d') {
        refresh3DScene(true);
    } else {
        if (planner.value) planner.value.syncAll();
    }
};

const currentFaceDecors = computed(() => {
    const trigger = uiTrigger.value; 
    if (!selectedEntity.value || !selectedEntity.value.attachedDecor) return [];
    return selectedEntity.value.attachedDecor.filter(d => d.side === selectedWallSide.value);
});

const hintData = computed(() => {
    if (activeTool.value === 'split') return { text: 'SPLIT mode: Click on a wall to split it into two independent segments.', color: '#10b981' };
    if (activeTool.value === 'roof') return { text: 'ROOF mode: Click corners to draw a custom roof polygon. Click the start point to finish.', color: '#f59e0b' };
    if (activeTool.value === 'arc') return { text: 'ARC mode: 1. Click Start Point  2. Click End Point  3. Move mouse to set Curvature & Click.', color: '#8b5cf6' };
    if (activeTool.value === 'shape_rect') return { text: 'BOX: Click and drag to draw a box.', color: '#3b82f6' };
    if (activeTool.value === 'shape_circle') return { text: 'CYLINDER: Click center and drag to define radius.', color: '#3b82f6' };
    if (activeTool.value === 'shape_triangle') return { text: 'PRISM: Click 3 points on the grid to create a triangle.', color: '#3b82f6' };
    if (activeTool.value === 'furniture' || activeTool.value.startsWith('furn_')) return { text: 'FURNITURE mode: Click anywhere on the floor to place the item.', color: '#ec4899' };
    
    const isTouch = isMobile.value || isTablet.value;
    if (activeTool.value.startsWith('molding_')) return { text: isTouch ? 'MOLDING mode: Tap near any wall edge to place molding precisely.' : 'MOLDING mode: Hover near any wall edge (glows blue), then click to place.', color: '#0ea5e9' };
    if (activeTool.value.startsWith('door') || activeTool.value.startsWith('window') || activeTool.value === 'arch_opening' || activeTool.value === 'sunshade') return { text: isTouch ? 'OPENING mode: Tap near any wall edge to place.' : 'OPENING mode: Hover near any wall edge (glows blue), then click to place.', color: '#0ea5e9' };
    
    if (activeTool.value === 'wall' || activeTool.value === 'outer' || activeTool.value === 'inner') return { text: 'WALL mode: Click to start drawing a wall. Click again to place corners. Press ESC to finish.', color: '#3b82f6' };
    
    return { text: 'SELECT mode: Click elements to edit. Trace Faded Fills from lower floors perfectly.', color: 'rgba(17, 24, 39, 0.9)' };
});

onMounted(() => {
    window.addEventListener('resize', handleResize);
    planner.value = new FloorPlanner(canvasWorkspaceRef.value.canvas2D);
    planner.value.activeCategory = activeCategory.value;
    planner.value.loadDefaultHouse();

    wizardManager.value = new SmartWizardManager({
        get planner() { return planner; },
        get floorPlanSettings() { return floorPlanSettings; },
        syncSettings,
        refresh3DScene
    });
    wizardManager.value.registerPlugin(SmartFacingPlugin);
    wizardManager.value.registerPlugin(SmartWallResizePlugin);
    wizardManager.value.enablePlugins(['smart_facing', 'smart_wall_resize']);
    
    planner.value.onSelectionChange = (entity, type, nodeIdx = -1) => {
        selectedEntity.value = entity; selectedType.value = type; selectedNodeIndex.value = nodeIdx;
        if (viewMode.value === '3d' && renderer3D.value) {
            if (type === 'furniture' && entity && entity.mesh3D) renderer3D.value.selectObject(entity.mesh3D);
            else renderer3D.value.deselectObject();
        }

        if (entity) {
            activeRightTab.value = 'properties';
        }
    };

    planner.value.onToolChange = (toolId) => {
        activeTool.value = toolId;
    };

    renderer3D.value = new Preview3D(canvasWorkspaceRef.value.canvas3D);

    workspaceControls.value = new WorkspaceControls(renderer3D.value, planner.value);
    
    serverService.value = new ServerClass(renderer3D.value, planner.value, () => {
        saveCurrentLevelState();
        return {
            levels: levels.value,
            activeLevelIndex: activeLevelIndex.value
        };
    });
    
    renderer3D.value.onEntitySelect = (entity, type, side = null) => {
        if (isRebuilding.value && !entity) return; // Prevent losing slider focus during rebuilds
        selectedEntity.value = entity; selectedType.value = type; 
        if (type !== 'wallDecor') { selectedWallSide.value = side; activeDecorId.value = null; }

        if (entity) {
            activeRightTab.value = 'properties';
        }
    };
    
    renderer3D.value.onEntityTransform = () => { uiTrigger.value++; };
    renderer3D.value.onRelocateStateChange = (state) => { isPlacing3D.value = state; };
    
    renderer3D.value.onLevelSwitchRequest = (targetIndex, entityIndex, entityType) => { 
        if (viewMode3D.value === 'full-edit') return;

        if (targetIndex !== activeLevelIndex.value) {
            switchLevel(targetIndex);
            
            if (entityType === 'wall' && entityIndex !== undefined) {
                setTimeout(() => {
                    const targetWall = planner.value.walls[entityIndex];
                    if (targetWall && targetWall.mesh3D) {
                        planner.value.selectEntity(targetWall, 'wall');
                        const frontSkin = targetWall.mesh3D.children.find(c => c.userData.side === 'front');
                        if (frontSkin) renderer3D.value.selectObject(frontSkin);
                    }
                }, 100);
            }
        } 
    };

    window.addEventListener('keydown', handleGlobalKeys);
    
    window.addEventListener('opening-gizmo-change', throttledSyncEngine);
    window.addEventListener('opening-gizmo-end', syncEngine);
    window.addEventListener('vertex-slope-gizmo-end', syncEngine);
    
    window.addEventListener('material-gizmo-select', (e) => {
        if (selectedEntity.value && selectedEntity.value.params) {
            selectedEntity.value.params.materialTarget = e.detail.face;
            uiTrigger.value++;
        }
    });

    setTimeout(() => {
        saveHistory();
    }, 500);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleGlobalKeys);
    window.removeEventListener('opening-gizmo-change', throttledSyncEngine);
    window.removeEventListener('opening-gizmo-end', syncEngine);
    window.removeEventListener('vertex-slope-gizmo-end', syncEngine);
});

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

const saveCurrentLevelState = () => { if (planner.value) levels.value[activeLevelIndex.value].data = planner.value.exportState(); };

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

watch(() => selectedEntity.value?.params?.isEditingMaterials, (newVal) => {
    if (renderer3D.value) {
        if (newVal) {
            renderer3D.value.setTransformMode('material');
        } else {
            renderer3D.value.setTransformMode('none');
        }
    }
});

const switchTo2D = () => {
    if(renderer3D.value) renderer3D.value.deselectObject();
    planner.value.syncAll();
    viewMode.value = '2d';
};

const switchTo3D = () => {
    planner.value.finishChain();
    saveCurrentLevelState();
    viewMode.value = '3d';
    if (viewMode3D.value === 'preview') mode3D.value = 'camera';
    else mode3D.value = 'edit'; 
    setTimeout(() => {
        if (renderer3D.value) {
            renderer3D.value.resize();
            updateEnvironment();
            renderer3D.value.setInteractionMode(mode3D.value); 
            refresh3DScene(false); 
        }
    }, 100);
};

const setViewMode3D = (mode) => {
    viewMode3D.value = mode; handleDeselect();
    if (mode === 'preview') set3DMode('camera'); 
    refresh3DScene(true); 
};

const togglePreviewMode = () => {
    if (viewMode3D.value === 'preview') {
        setViewMode3D('full-edit');
        set3DMode('edit');
    } else {
        setViewMode3D('preview');
    }
};

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

const zoomIn = () => {
    if (viewMode.value === '2d') workspaceControls.value?.zoomIn2D();
    else workspaceControls.value?.zoomIn3D();
};

const zoomOut = () => {
    if (viewMode.value === '2d') workspaceControls.value?.zoomOut2D();
    else workspaceControls.value?.zoomOut3D();
};

const resetZoom = () => {
    if (viewMode.value === '2d') workspaceControls.value?.resetZoom2D();
    // 3D reset can be more complex, often handled by `refresh3DScene`
};

const setCameraPreset = (preset) => {
    workspaceControls.value?.setCameraPosition(preset);
};

const rotateCamera = (angle) => {
    workspaceControls.value?.rotateCamera(angle);
};

const set3DMode = (mode) => { mode3D.value = mode; if (renderer3D.value) renderer3D.value.setInteractionMode(mode); };
const handleDeselect = () => {
    if (renderer3D.value) renderer3D.value.deselectObject();
    selectedEntity.value = null; selectedType.value = null; selectedWallSide.value = null; activeDecorId.value = null;
};
const setTool = (tool) => { 
    activeTool.value = tool; planner.value.tool = tool; planner.value.finishChain(); planner.value.selectEntity(null); planner.value.updateToolStates(); 
};
const isAdvancedToolActive = computed(() => ['split'].includes(activeTool.value));
const handleAdvTriggerClick = () => {
    if (isAdvancedToolActive.value) {
        setTool('select');
        showAdvancedTools.value = false;
    } else {
        showAdvancedTools.value = !showAdvancedTools.value;
    }
};
const setAdvancedTool = (tool) => {
    activeTool.value = tool;
    if (planner.value) {
        planner.value.tool = tool;
        planner.value.finishChain();
        planner.value.updateToolStates();
    }
};
const handleToolClick = (tool) => {
    if (tool.action === 'furniture') spawnFurniture(tool.id);
    else if (tool.action === 'auto_roof') { if (planner.value) planner.value.addAutoRoof(); }
    else if (tool.action === 'wizard') { wizardPopupRef.value?.open(tool.id); }
    else setTool(tool.id);
    
    if (isMobile.value || isTablet.value) {
        mobileMenuOpen.value = false;
    }
};

const toggleEditDecor = (decorId) => { activeDecorId.value = activeDecorId.value === decorId ? null : decorId; };

const spawnWallPattern = (configId) => {
    if (renderer3D.value && selectedType.value === 'wall' && selectedEntity.value) {
        const decor = renderer3D.value.addWallPattern(selectedEntity.value, configId, selectedWallSide.value);
        selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
        activeDecorId.value = decor.id; uiTrigger.value++; 
        
        if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
        debouncedSaveHistory();
    }
};

const spawnFurniture = (configId) => {
    const center = { x: planner.value.stage.width() / 2, y: planner.value.stage.height() / 2 };
    const item = new PremiumFurniture(planner.value, center.x, center.y, configId);
    planner.value.furniture.push(item); planner.value.selectEntity(item, 'furniture'); planner.value.syncAll();
    debouncedSaveHistory();
};

const syncEngine = () => {
    if (viewMode.value === '2d') {
        planner.value.syncAll();
    } else if (viewMode.value === '3d' && selectedType.value === 'furniture' && selectedEntity.value) {
        renderer3D.value.updateFurnitureLive(selectedEntity.value); 
    } else if (viewMode.value === '3d' && selectedType.value === 'shape' && selectedEntity.value) {
        renderer3D.value.updateShapeLive(selectedEntity.value);
    } else if (viewMode.value === '3d' && (selectedType.value === 'roof' || selectedType.value === 'room' || selectedType.value === 'wall' || selectedType.value === 'widget' || selectedType.value === 'advance_openings' || selectedType.value === 'molding' || selectedType.value === 'wallDecor' || selectedType.value === 'stair')) {
        refresh3DScene(true);
    }
    debouncedSaveHistory();
};

let gizmoSyncTimeout = null;
const throttledSyncEngine = () => {
    if (gizmoSyncTimeout) return;
    gizmoSyncTimeout = setTimeout(() => {
        syncEngine();
        gizmoSyncTimeout = null;
    }, 50);
};

const setRoofMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'roof') {
        selectedEntity.value.config.material = key;
        syncEngine();
    }
};

// ==========================================
// 6. HOTKEYS & MOVEMENT
// ========================================== 

const setFloorMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'room') {
        selectedEntity.value.configId = key;
        syncEngine();
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
        
        if (selectedType.value === 'wall') {
            const side = (target === 'front' || target === 'back') ? target : selectedWallSide.value;
            if (renderer3D.value) {
                const decor = renderer3D.value.addWallPattern(selectedEntity.value, key, side);
                selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
                activeDecorId.value = decor.id; uiTrigger.value++; 
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
        syncEngine();
    }
};

const onDecorUpdate = (decor) => { 
    if (renderer3D.value) renderer3D.value.updateWallDecorLive(decor); 
    if (selectedEntity.value?.isStatic) updateStaticLevelData(selectedEntity.value);
    debouncedSaveHistory();
};

const handleDelete = () => { 
    if (selectedEntity.value) {
        if (selectedType.value === 'furniture') {
            if (viewMode.value === '3d' && renderer3D.value.selectedObject?.userData.entity === selectedEntity.value) {
                renderer3D.value.structureGroup.remove(renderer3D.value.selectedObject); 
                renderer3D.value.deselectObject();
            }
            selectedEntity.value.remove(); 
            selectedEntity.value = null; 
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'roof') {
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'shape') {
            if (viewMode.value === '3d' && renderer3D.value.selectedObject?.userData.entity === selectedEntity.value) {
                renderer3D.value.structureGroup.remove(renderer3D.value.selectedObject);
                renderer3D.value.deselectObject();
            }
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'widget' || selectedType.value === 'molding' || selectedType.value === 'advance_openings' || selectedType.value === 'wall' || selectedType.value === 'arc' || selectedType.value === 'stair' ) {
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'wallDecor') {
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
        }
        debouncedSaveHistory();
    }
};

const handleDeleteSpecificDecor = (decorObj) => {
    const decor = decorObj || selectedEntity.value;
    if (decor) {
        const wall = decor.mesh3D.userData.parentWall;
        wall.attachedDecor = wall.attachedDecor.filter(d => d !== decor); wall.mesh3D.remove(decor.mesh3D);
        if (selectedEntity.value === wall || selectedEntity.value === decor) wall.attachedDecor = [...wall.attachedDecor]; 
        if (renderer3D.value && renderer3D.value.selectedObject === decor.mesh3D) { renderer3D.value.deselectObject(); handleDeselect(); }
        uiTrigger.value++;
        
        if (wall.isStatic) updateStaticLevelData(wall);
        debouncedSaveHistory();
    }
};

const refresh3DScene = (preserveCamera = true) => {
    if (renderer3D.value) {
        isRebuilding.value = true;
        renderer3D.value.isRebuildingScene = true;
        const prevSel = selectedEntity.value;
        const prevType = selectedType.value;
        const prevSide = selectedWallSide.value;
        const prevMode = renderer3D.value.currentTransformMode;
        
        saveCurrentLevelState(); 
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
        
        if (workspaceControls.value) {
            workspaceControls.value.updateCameraBounds();
        }
        
        isRebuilding.value = false;
    }
};

const saveProject = () => {
    saveCurrentLevelState();
    const projectData = {
        levels: levels.value,
        activeLevelIndex: activeLevelIndex.value
    };
    FileManager.exportJSON(projectData);
};
const loadProject = (jsonStr) => {
    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.levels && parsed.activeLevelIndex !== undefined) {
            levels.value = parsed.levels;
            activeLevelIndex.value = parsed.activeLevelIndex;
            planner.value.importState(levels.value[activeLevelIndex.value].data);
            planner.value.syncAll();
            
            if (planner.value.settings) {
                Object.assign(floorPlanSettings.value, planner.value.settings);
            }
            
            // Clear history when loading new project
            historyStack.value = [];
            historyIndex.value = -1;
            setTimeout(() => saveHistory(), 200);
        } else {
            // Fallback for single floor plans or old exports
            FileManager.importJSON(planner.value, jsonStr);
        }
    } catch(e) {
        console.error(e);
        alert("Failed to load project file.");
    }
};

const triggerFileInput = () => document.getElementById('fileInput').click();
const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            loadProject(e.target.result);
            setTimeout(() => saveHistory(), 200);
        };
        reader.readAsText(file);
    }
    event.target.value = '';
};

const clearWorkspace = () => {
    if (confirm('Are you sure you want to clear the workspace? All unsaved progress will be lost.')) {
        levels.value = [{ id: 'level-' + Date.now(), name: 'Floor 1', data: null, isVisible: true }];
        activeLevelIndex.value = 0;
        planner.value.clearAll();
        planner.value.clearReferenceBackground();
        handleDeselect();
        if (viewMode.value === '3d') refresh3DScene(true);
        saveHistory();
    }
};
</script>

<style src="./workspace.css"></style>
