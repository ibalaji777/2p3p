<template>
  <div class="app-root" :style="{ '--app-unit': `'${displayUnit}'` }">
    <TopToolbar
      :view-mode="viewMode"
      :view-mode3D="viewMode3D"
      :can-undo="canUndo"
      :can-redo="canRedo"
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
        :active-preset-id="activePresetId"
        @close-mobile-menu="mobileMenuOpen = false"
        @toggle-category="toggleCategory"
        @save-project="saveProject"
        @open-save-popup="savePopupRef?.open()"
        @trigger-file-input="triggerFileInput"
        @clear-workspace="clearWorkspace"
        @file-uploaded="handleFileUpload"
        @tool-click="handleToolClick"
        @update:activePresetId="activePresetId = $event"
        @catalog-select="handleCatalogSelect"
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
        :is-xray-mode="isXRayMode"
        :floor-plan-settings="floorPlanSettings"
        :is-rebuilding="isRebuilding"
        :view-mode3D="viewMode3D"
        :mode3D="mode3D"
        :selected-type="selectedType"
        @update:show-guide="showGuide = $event"
        @update:show-advanced-tools="showAdvancedTools = $event"
        @handle-adv-trigger-click="handleAdvTriggerClick"
        @set-advanced-tool="setAdvancedTool"
        @toggle-wall-tracking="toggleWallTracking"
        @toggle-xray-mode="toggleXRayMode"
        @zoom-in="zoomIn"
        @zoom-out="zoomOut"
        @reset-zoom="resetZoom"
        @reset-camera="resetCamera"
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
        :active-tool="activeTool"
        :active-preset-params="activePresetParams"
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
        @set-roof-fascia-material="setRoofFasciaMaterial"
        @select-layer-item="selectLayerItem"
        @toggle-layer-visibility="toggleLayerVisibility"
        @remove-layer-item="removeLayerItem"
        @debounced-save-history="debouncedSaveHistory"
      />

      <!-- Mobile Drawing Controls -->
      <div v-if="isMobile && isDrawing" class="mobile-drawing-controls">
          <button @click.stop="cancelDrawing" class="mobile-control-btn cancel-btn">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
              </svg>
              <span>Cancel</span>
          </button>
          <button @click.stop="finishDrawing" class="mobile-control-btn finish-btn">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
              </svg>
              <span>Finish</span>
          </button>
      </div>

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

import { storeToRefs } from 'pinia';
import { useUIStore } from './stores/useUIStore.js';
import { usePlannerStore } from './stores/usePlannerStore.js';
import { useSettingsStore } from './stores/useSettingsStore.js';
import { useHistory } from './composables/useHistory.js';
import { useKeyboardShortcuts } from './composables/useKeyboardShortcuts.js';
import { useLevelManager } from './composables/useLevelManager.js';

const uiStore = useUIStore();
const plannerStore = usePlannerStore();
const settingsStore = useSettingsStore();

const { windowWidth, mobileMenuOpen, activeMobileTab, viewMode, viewMode3D, activeRightTab, showLeftSidebar, uiTrigger, isPlacing3D, activeDecorId, isRebuilding, isXRayMode, showGuide, showAdvancedTools, layerRefreshTrigger, isMobile, isTablet, isDesktop } = storeToRefs(uiStore);
const { planner, renderer3D, workspaceControls, serverService, isDrawing, activeTool, activeCategory, mode3D, activePresetParams, activePresetId, selectedEntity, selectedType, selectedWallSide, selectedNodeIndex, levels, activeLevelIndex, canUndo, canRedo, allFloorsVisible } = storeToRefs(plannerStore);
const { floorPlanSettings, selectedSky, selectedGround, isWallTrackingEnabled } = storeToRefs(settingsStore);

const displayUnit = computed(() => {
    switch (floorPlanSettings.value.measurementUnit) {
        case 'feet_inches': return 'in';
        case 'ft': return 'ft';
        case 'in': return 'in';
        case 'm': return 'm';
        case 'cm': return 'cm';
        case 'mm': default: return 'mm';
    }
});

const handleCatalogSelect = (item) => {
    if (planner.value) {
        planner.value.activePresetParams = { ...item.params };
        activePresetParams.value = { ...item.params };
        
        if (item.toolId) {
            setTool(item.toolId, item.params);
        }
    }
    if (isMobile.value || isTablet.value) {
        mobileMenuOpen.value = false;
    }
};

const toggleMobileTab = (tabId) => {
    if (tabId === '3d') {
        planner.value.finishChain();
        saveCurrentLevelState();
        viewMode.value = '3d';
        activeMobileTab.value = '3d';
        mobileMenuOpen.value = false;
        
        setTimeout(() => {
            if (renderer3D.value) {
                renderer3D.value.resize();
                updateEnvironment();
                renderer3D.value.setInteractionMode(mode3D.value);
                refresh3DScene(false);
            }
        }, 100);
    } else {
        if (activeMobileTab.value === tabId && mobileMenuOpen.value) {
            mobileMenuOpen.value = false;
        } else {
            activeMobileTab.value = tabId;
            mobileMenuOpen.value = true;
        }
    }
};

watch(activeMobileTab, (newVal) => {
    if (['properties', 'layers', 'settings'].includes(newVal)) {
        activeRightTab.value = newVal;
    }
});

const handleResize = () => {
    uiStore.handleResize();
    
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
import { WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, FLOOR_REGISTRY, RAILING_REGISTRY, EVENTS } from './core/registry.js';
import { coreEventBus } from './core/EventBus.js';
import { getMenuCategories } from './core/config/menuCategories.js';
import { useAppMaterials } from './composables/useAppMaterials.js';
import { useAppTools } from './composables/useAppTools.js';
import { useAppScene } from './composables/useAppScene.js';
const wallDecorRegistry = WALL_DECOR_REGISTRY;
const roofDecorRegistry = ROOF_DECOR_REGISTRY;
const skyRegistry = SKY_REGISTRY;
const groundRegistry = GROUND_REGISTRY;
const floorRegistry = FLOOR_REGISTRY;
const railingRegistry = RAILING_REGISTRY;

const wizardPopupRef = ref(null);
const savePopupRef = ref(null);
const wizardManager = shallowRef(null);

// Removed local floorPlanSettings as it is now in SettingsStore

const syncSettings = () => {
    if (planner.value) {
        planner.value.settings = { ...floorPlanSettings.value };
        planner.value.setWallTracking(floorPlanSettings.value.wallTracking);
        isWallTrackingEnabled.value = floorPlanSettings.value.wallTracking;
        planner.value.syncAll();
        debouncedSaveHistory();
    }
    if (renderer3D.value?.navigationCube) {
        renderer3D.value.navigationCube.setEntranceFacing(floorPlanSettings.value.mainEntranceFacing);
    }
};

const setEntranceWall = () => {
    if (selectedType.value === 'wall' && selectedEntity.value) {
        floorPlanSettings.value.entranceWallId = selectedEntity.value;
        syncSettings();
    }
};

const canvasWorkspaceRef = ref(null);

const finishDrawing = () => { 
    if (planner.value) {
        planner.value.finishChain(); 
        planner.value.tool = 'select';
        planner.value.updateToolStates();
        if (planner.value.onToolChange) planner.value.onToolChange('select');
        if (planner.value.lastDrawnEntity) {
            planner.value.selectEntity(planner.value.lastDrawnEntity, 'wall');
        }
    } 
};
const cancelDrawing = () => { 
    if (planner.value) {
        planner.value.cancelChain(); 
        planner.value.tool = 'select';
        planner.value.updateToolStates();
        if (planner.value.onToolChange) planner.value.onToolChange('select');
    } 
};

const toggleXRayMode = () => {
    isXRayMode.value = !isXRayMode.value;
    if (renderer3D.value) {
        renderer3D.value.setXRayMode(isXRayMode.value);
    }
};

const onLevelVisibilityChange = () => {
    if (viewMode.value === '3d') refresh3DScene(true);
};

const toggleWallTracking = () => {
    settingsStore.toggleWallTracking();
    if (planner.value) {
        planner.value.setWallTracking(isWallTrackingEnabled.value);
    }
};

// Menu categories
const menuCategories = ref(getMenuCategories());



const activeCategoryObj = computed(() => {
    return menuCategories.value.find(c => c.id === activeCategory.value);
});



const toggleAllFloors = () => {
    plannerStore.toggleAllFloors();
    if (viewMode.value === '3d') refresh3DScene(true);
};

// Other state extracted to stores

const layerItems = computed(() => {
    const trigger = layerRefreshTrigger.value;
    if (!planner.value) return [];
    
    const items = [];
    
    if (planner.value.walls) {
        planner.value.walls.forEach((w, i) => {
            if (w.parentArc || w.parentGroup) return;
            if (w.type === 'railing') {
                items.push({ id: `rail-${i}`, name: `Railing ${i + 1}`, entity: w, type: 'railing' });
            } else if (w.isAutoGable) {
                items.push({ id: `wall-${i}`, name: `Gable Wall ${i + 1}`, entity: w, type: 'wall' });
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
            if (r.parentGroup) return;
            items.push({ id: `roof-${i}`, name: `Roof ${i + 1}`, entity: r, type: 'roof' });
        });
    }
    if (planner.value.presetGroups) {
        planner.value.presetGroups.forEach((g, i) => {
            items.push({ id: `presetGrp-${i}`, name: g.name || `Preset Group ${i + 1}`, entity: g, type: 'preset_group' });
            
            if (g.walls) {
                g.walls.forEach((w, wi) => {
                    items.push({ id: `presetGrp-${i}-wall-${wi}`, name: `↳ Wall ${wi + 1}`, entity: w, type: 'wall', isSubItem: true });
                });
            }
            if (g.roofs) {
                g.roofs.forEach((r, ri) => {
                    items.push({ id: `presetGrp-${i}-roof-${ri}`, name: `↳ Roof ${ri + 1}`, entity: r, type: 'roof', isSubItem: true });
                });
            }
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
    
    if (item.type === 'preset_group') {
        if (ent.walls) ent.walls.forEach(w => {
            w.isHidden = ent.isHidden;
            if (w.wallGroup) w.wallGroup.visible(!w.isHidden);
            if (w.poly) w.poly.visible(!w.isHidden);
            if (w.mesh3D) w.mesh3D.visible = !w.isHidden;
        });
        if (ent.roofs) ent.roofs.forEach(r => {
            r.isHidden = ent.isHidden;
            if (r.group) r.group.visible(!r.isHidden);
            if (r.mesh3D) r.mesh3D.visible = !r.isHidden;
        });
    }
    
    const group2D = ent.group || ent.wallGroup || ent.visualGroup || ent.poly || ent.uiGroup;
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

const { saveHistory, debouncedSaveHistory, undo, redo, restoreHistoryState } = useHistory({ refresh3DScene: (b) => refresh3DScene(b), handleDeselect: () => handleDeselect() });

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
    if (activeTool.value === 'shape_floor_cut') return { text: 'FLOOR CUT: Click and drag to draw a hole in the floor slab.', color: '#ef4444' };
    if (activeTool.value === 'shape_circle') return { text: 'CYLINDER: Click center and drag to define radius.', color: '#3b82f6' };
    if (activeTool.value === 'shape_triangle') return { text: 'PRISM: Click 3 points on the grid to create a triangle.', color: '#3b82f6' };
    if (activeTool.value === 'furniture' || activeTool.value.startsWith('furn_')) return { text: 'FURNITURE mode: Click anywhere on the floor to place the item.', color: '#ec4899' };
    
    const isTouch = isMobile.value || isTablet.value;
    if (activeTool.value.startsWith('molding_')) return { text: isTouch ? 'MOLDING mode: Tap near any wall edge to place molding precisely.' : 'MOLDING mode: Hover near any wall edge (glows blue), then click to place.', color: '#0ea5e9' };
    if (activeTool.value.startsWith('door') || activeTool.value.startsWith('window') || activeTool.value === 'arch_opening' || activeTool.value === 'sunshade') return { text: isTouch ? 'OPENING mode: Tap near any wall edge to place.' : 'OPENING mode: Hover near any wall edge (glows blue), then click to place.', color: '#0ea5e9' };
    
    if (activeTool.value === 'wall' || activeTool.value === 'outer' || activeTool.value === 'inner') return { text: 'WALL mode: Click to start drawing a wall. Click again to place corners. Press ESC to finish.', color: '#3b82f6' };
    
    return { text: 'SELECT mode: Click elements to edit. Trace Faded Fills from lower floors perfectly.', color: 'rgba(17, 24, 39, 0.9)' };
});
let eventBusUnsubscribers = [];

onMounted(() => {
    window.addEventListener('resize', handleResize);
    planner.value = new FloorPlanner(canvasWorkspaceRef.value.canvas2D);
    window.planner = planner.value; // Expose for Automation API testing
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

    planner.value.onDrawingChange = (drawing) => {
        isDrawing.value = drawing;
    };

    renderer3D.value = new Preview3D(canvasWorkspaceRef.value.canvas3D);
    if (renderer3D.value?.navigationCube) {
        renderer3D.value.navigationCube.setEntranceFacing(floorPlanSettings.value.mainEntranceFacing);
    }

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

        if (entity && !isRebuilding.value) {
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
    
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.OPENING_GIZMO_CHANGE, throttledSyncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.ROOF_CORNER_GIZMO_CHANGE, throttledSyncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.ROOF_OVERHANG_GIZMO_CHANGE, throttledSyncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.SCENE_CHANGED, syncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.ENTITY_REMOVED, syncEngine));
    
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.HISTORY_CHANGED, () => {
        if (planner.value && planner.value.commandManager) {
            canUndo.value = planner.value.commandManager.undoStack.length > 0;
            canRedo.value = planner.value.commandManager.redoStack.length > 0;
            debouncedSaveHistory(); 
        }
    }));

    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.OPENING_GIZMO_END, syncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.ROOF_CORNER_GIZMO_END, syncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.ROOF_OVERHANG_GIZMO_END, syncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.VERTEX_SLOPE_GIZMO_END, syncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.POLYGON_GIZMO_END, syncEngine));
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.MATERIAL_GIZMO_APPLY, syncEngine));
    
    eventBusUnsubscribers.push(coreEventBus.on(EVENTS.MATERIAL_GIZMO_SELECT, (data) => {
        if (selectedEntity.value && selectedEntity.value.params) {
            selectedEntity.value.params.materialTarget = data.face;
            uiTrigger.value++;
        }
    }));

    setTimeout(() => {
        saveHistory();
    }, 500);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleGlobalKeys);
    
    // Clean up all EventBus listeners properly to avoid memory leaks
    eventBusUnsubscribers.forEach(unsubscribe => unsubscribe());
    eventBusUnsubscribers = [];
    
    // Clean up 3D engine components
    if (renderer3D.value && renderer3D.value.dispose) {
        renderer3D.value.dispose();
    }
    
    // Clean up workspace controls
    if (workspaceControls.value && workspaceControls.value.dispose) {
        workspaceControls.value.dispose();
    }
    
    // Clean up 2D engine
    if (planner.value && planner.value.dispose) {
        planner.value.dispose();
    }
});

const { handleGlobalKeys } = useKeyboardShortcuts({ undo, redo, handleDelete: () => handleDelete(), debouncedSaveHistory, setTool: (t) => setTool(t), toggleCategory: (c) => toggleCategory(c) });

const { saveCurrentLevelState, updateStaticLevelData, switchLevel, addLevel } = useLevelManager({ handleDeselect: () => handleDeselect(), refresh3DScene: (b) => refresh3DScene(b), saveHistory });

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

const resetCamera = () => {
    if (viewMode.value === '3d' && renderer3D.value?.cameraController) {
        renderer3D.value.cameraController.resetCamera();
    }
};



const set3DMode = (mode) => { mode3D.value = mode; if (renderer3D.value) renderer3D.value.setInteractionMode(mode); };
const handleDeselect = () => {
    if (renderer3D.value) renderer3D.value.deselectObject();
    selectedEntity.value = null; selectedType.value = null; selectedWallSide.value = null; activeDecorId.value = null;
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

















// ==========================================
// 6. HOTKEYS & MOVEMENT
// ========================================== 



















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

const onDecorUpdate = (decor) => { throttledSyncEngine(); };

const {
    updateEnvironment,
    setSky,
    setGround,
    refresh3DScene,
    syncEngine,
    throttledSyncEngine
} = useAppScene({
    renderer3D,
    planner,
    selectedSky,
    selectedGround,
    isRebuilding,
    selectedEntity,
    selectedType,
    selectedWallSide,
    saveCurrentLevelState: () => saveCurrentLevelState(),
    levels,
    activeLevelIndex,
    viewMode3D,
    layerItems,
    debouncedSaveHistory: () => debouncedSaveHistory(),
    viewMode
});

const {
    setTool,
    handleToolClick,
    toggleCategory,
    spawnWallPattern,
    spawnFurniture,
    toggleEditDecor,
    handleDelete,
    handleDeleteSpecificDecor
} = useAppTools({
    activeTool,
    activePresetParams,
    planner,
    debouncedSaveHistory: () => debouncedSaveHistory(),
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
    updateStaticLevelData: (w) => updateStaticLevelData(w),
    activeCategory,
    viewMode,
    refresh3DScene: (b) => refresh3DScene(b),
    handleDeselect: () => handleDeselect()
});

const {
    setFloorMaterial,
    setOpeningMaterial,
    clearShapeTextures,
    isShapeMaterialActive,
    setShapeMaterial,
    setRoofMaterial,
    setRoofFasciaMaterial
} = useAppMaterials({
    selectedEntity,
    selectedType,
    selectedWallSide,
    renderer3D,
    uiTrigger,
    activeDecorId,
    updateStaticLevelData: (w) => updateStaticLevelData(w),
    debouncedSaveHistory: () => debouncedSaveHistory(),
    syncEngine: () => syncEngine()
});

</script>

<style src="./workspace.css"></style>

<style scoped>
.mobile-drawing-controls {
    position: absolute;
    bottom: 90px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 16px;
    z-index: 1000;
    pointer-events: auto;
}

.mobile-control-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    font-family: 'Inter', sans-serif;
    border-radius: 30px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
    transition: transform 0.1s, background-color 0.2s;
    background-color: rgba(31, 41, 55, 0.95);
    color: white;
}

.mobile-control-btn svg {
    width: 18px;
    height: 18px;
}

.mobile-control-btn:active {
    transform: scale(0.92);
}

.cancel-btn {
    color: #fca5a5;
}

.cancel-btn:hover {
    background-color: rgba(220, 38, 38, 0.9);
    color: white;
}

.finish-btn {
    color: #93c5fd;
}

.finish-btn:hover {
    background-color: rgba(37, 99, 235, 0.9);
    color: white;
}
</style>
