<template>
  <aside class="right-sidebar" v-show="!(isMobile || isTablet)" :class="{'mobile-panel': isMobile || isTablet}">
    <div v-if="isMobile || isTablet" class="mobile-close-btn" @click="$emit('update:mobileMenuOpen', false)">✕ Close</div>
    <Teleport to="body" :disabled="!(isMobile || isTablet)">
        <component 
            :is="(isMobile || isTablet) ? MobileBottomSheet : 'div'"
            class="panel levels-panel properties-wrapper"
            :class="{ 'desktop-properties': !(isMobile || isTablet) }"
            :is-visible="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'levels') : true"
            entity-name="Floor Levels"
            entity-icon="🏢"
            @close="$emit('update:mobileMenuOpen', false)"
            v-show="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'levels') : true"
        >
            <div class="panel-header" v-if="!(isMobile || isTablet)"><h3>Floor Levels</h3></div>
        <div class="levels-list">
            <div v-if="viewMode === '3d'" class="level-item" @click="$emit('toggle-all-floors')" style="background: #fafafa; border-bottom: 1px solid #f1f5f9;">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <input type="checkbox" :checked="allFloorsVisible" @change="$emit('toggle-all-floors')" @click.stop title="Toggle All">
                    <span style="font-weight: bold;">Show All</span>
                </div>
            </div>
            <div v-for="(level, index) in levels" :key="level.id" 
                 class="level-item" 
                 :class="{ 'active': activeLevelIndex === index && viewMode === '2d' }"
                 @click="$emit('switch-level', index)">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <input v-if="viewMode === '3d'" type="checkbox" :checked="level.isVisible !== false" @change="(e) => { level.isVisible = e.target.checked; $emit('level-visibility-change'); }" @click.stop title="Toggle Visibility">
                    <span>Floor {{ index + 1 }}</span>
                </div>
                <span class="level-indicator" v-if="activeLevelIndex === index && viewMode === '2d'">Active</span>
            </div>
        </div>
        <div class="levels-actions">
            <button class="btn-duplicate" @click="$emit('add-level', 'duplicate')">+ Duplicate Current</button>
            <button class="btn-empty" @click="$emit('add-level', 'empty')">+ Add Empty Floor</button>
        </div>
        </component>
    </Teleport>

    <div class="panel tabs-panel flex-1" v-show="!(isMobile || isTablet) || ['layers', 'settings'].includes(activeMobileTab)">
        <div class="tabs-header" v-show="!(isMobile || isTablet)">
            <button :class="{active: activeRightTab === 'properties'}" @click="$emit('update:activeRightTab', 'properties')">Properties</button>
            <button :class="{active: activeRightTab === 'layers'}" @click="$emit('update:activeRightTab', 'layers')">Layer List</button>
            <button :class="{active: activeRightTab === 'settings'}" @click="$emit('update:activeRightTab', 'settings')">Settings</button>
        </div>
        
        <Teleport to="body" :disabled="!(isMobile || isTablet)">
            <component 
                :is="(isMobile || isTablet) ? MobileBottomSheet : 'div'"
                class="properties-wrapper"
                :class="{ 'desktop-properties': !(isMobile || isTablet) }"
                :is-visible="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'settings') : true"
                entity-name="Settings"
                entity-icon="⚙️"
                @close="$emit('update:mobileMenuOpen', false)"
                v-show="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'settings') : activeRightTab === 'settings'"
            >
                <SettingsTab
                    :floor-plan-settings="floorPlanSettings"
                    :selected-sky="selectedSky"
                    :selected-ground="selectedGround"
                    :sky-registry="skyRegistry"
                    :ground-registry="groundRegistry"
                    :selected-type="selectedType"
                    @sync-settings="$emit('sync-settings')"
                    @update:selectedSky="$emit('update:selectedSky', $event)"
                    @set-sky="$emit('set-sky', $event)"
                    @update:selectedGround="$emit('update:selectedGround', $event)"
                    @set-ground="$emit('set-ground', $event)"
                />
    </component>
</Teleport>

        <Teleport to="body" :disabled="!(isMobile || isTablet)">
            <component 
                :is="(isMobile || isTablet) ? MobileBottomSheet : 'div'"
                class="properties-wrapper"
                :class="{ 'desktop-properties': !(isMobile || isTablet) }"
                :is-visible="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'properties') : true"
                :entity-name="dynamicEntityName"
                :entity-icon="dynamicEntityIcon"
                @close="$emit('update:mobileMenuOpen', false)"
                v-show="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'properties') : activeRightTab === 'properties'"
            >
            <PropertiesTab
                :active-tool="activeTool"
                :active-preset-params="activePresetParams"
                :view-mode="viewMode"
                :view-mode3-d="viewMode3D"
                :selected-entity="selectedEntity"
                :selected-type="selectedType"
                :selected-wall-side="selectedWallSide"
                :current-face-decors="currentFaceDecors"
                :active-decor-id="activeDecorId"
                :wall-decor-registry="wallDecorRegistry"
                :railing-registry="railingRegistry"
                :ui-trigger="uiTrigger"
                :floor-registry="floorRegistry"
                :roof-decor-registry="roofDecorRegistry"
                @sync-engine="$emit('sync-engine')"
                @ui-trigger="$emit('ui-trigger')"
                @toggle-edit-decor="$emit('toggle-edit-decor', $event)"
                @delete-specific-decor="$emit('delete-specific-decor', $event)"
                @decor-update="$emit('decor-update', $event)"
                @spawn-wall-pattern="$emit('spawn-wall-pattern', $event)"
                @delete-entity="$emit('delete-entity')"
                @set-floor-material="$emit('set-floor-material', $event)"
                @set-opening-material="$emit('set-opening-material', $event)"
                @clear-shape-textures="$emit('clear-shape-textures')"
                @set-roof-material="$emit('set-roof-material', $event)"
                @set-shape-material="$emit('set-shape-material', $event)"
            />
            </component>
        </Teleport>

        <Teleport to="body" :disabled="!(isMobile || isTablet)">
            <component 
                :is="(isMobile || isTablet) ? MobileBottomSheet : 'div'"
                class="properties-wrapper"
                :class="{ 'desktop-properties': !(isMobile || isTablet) }"
                :is-visible="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'layers') : true"
                entity-name="Layer List"
                entity-icon="🗂️"
                @close="$emit('update:mobileMenuOpen', false)"
                v-show="(isMobile || isTablet) ? (mobileMenuOpen && activeMobileTab === 'layers') : activeRightTab === 'layers'"
            >
                <LayersTab
                    :layer-items="layerItems"
                    :selected-entity="selectedEntity"
                    @select-layer-item="$emit('select-layer-item', $event)"
                    @toggle-layer-visibility="$emit('toggle-layer-visibility', $event)"
                    @remove-layer-item="$emit('remove-layer-item', $event)"
                    @debounced-save-history="$emit('debounced-save-history')"
                />
            </component>
        </Teleport>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY } from '../core/registry';
import MobileBottomSheet from './MobileBottomSheet.vue';
import SmartWizardPopup from './SmartWizardPopup.vue';
import SettingsTab from './sidebar/SettingsTab.vue';
import LayersTab from './sidebar/LayersTab.vue';
import PropertiesTab from './sidebar/PropertiesTab.vue';

const props = defineProps({
  isMobile: Boolean,
  isTablet: Boolean,
  mobileMenuOpen: Boolean,
  activeMobileTab: String,
  viewMode: String,
  viewMode3D: String,
  levels: Array,
  activeLevelIndex: Number,
  allFloorsVisible: Boolean,
  activeRightTab: String,
  floorPlanSettings: Object,
  selectedSky: String,
  selectedGround: String,
  skyRegistry: Object,
  groundRegistry: Object,
  selectedType: String,
  selectedEntity: Object,
  railingRegistry: Object,
  selectedWallSide: String,
  currentFaceDecors: Array,
  activeDecorId: String,
  wallDecorRegistry: Object,
  uiTrigger: Number,
  floorRegistry: Object,
  roofDecorRegistry: Object,
  layerItems: Array,
  activeTool: String,
  activePresetParams: Object
});

const emit = defineEmits([
  'update:mobileMenuOpen', 'update:activeMobileTab',
  'update:activeRightTab',
  'update:selectedSky',
  'update:selectedGround',
  'toggle-all-floors',
  'level-visibility-change',
  'switch-level',
  'add-level',
  'sync-settings',
  'set-entrance-wall',
  'set-sky',
  'set-ground',
  'sync-engine',
  'ui-trigger',
  'toggle-edit-decor',
  'delete-specific-decor',
  'decor-update',
  'spawn-wall-pattern',
  'delete-entity',
  'set-floor-material',
  'set-opening-material',
  'clear-shape-textures',
  'set-shape-material',
  'set-roof-material',
  'set-roof-fascia-material',
  'select-layer-item',
  'toggle-layer-visibility',
  'remove-layer-item',
  'debounced-save-history'
]);

const activeLayerDropdown = ref(null);

const dynamicEntityName = computed(() => {
    if (props.activeTool && props.activeTool.startsWith('preset_')) return 'Preset Settings';
    if (!props.selectedEntity) return 'Properties';
    
    const type = props.selectedType;
    if (type === 'wall') {
        if (props.selectedEntity.type === 'railing') return 'Railing';
        return 'Wall';
    }
    if (type === 'door') return 'Door';
    if (type === 'window') return 'Window';
    if (type === 'room') return 'Room / Floor';
    if (type === 'stair') return 'Staircase';
    if (type === 'furniture') return props.selectedEntity?.config?.name || 'Furniture';
    if (type === 'roof') return 'Roof';
    if (type === 'shape') return 'Shape';
    if (type === 'wallDecor') return 'Wall Pattern';
    if (type === 'arc') return 'Curved Wall';
    if (type === 'advance_openings') return 'Opening';
    if (type === 'widget') return 'Feature';
    return 'Properties';
});

const dynamicEntityIcon = computed(() => {
    if (props.activeTool && props.activeTool.startsWith('preset_')) return '⚙️';
    if (!props.selectedEntity) return '📦';
    
    const type = props.selectedType;
    if (type === 'wall') {
        if (props.selectedEntity.type === 'railing') return '🪜';
        return '🧱';
    }
    if (type === 'door') return '🚪';
    if (type === 'window') return '🪟';
    if (type === 'room') return '⬜';
    if (type === 'stair') return '📶';
    if (type === 'furniture') return '🛋️';
    if (type === 'roof') return '🏠';
    if (type === 'shape') return '🔳';
    if (type === 'wallDecor') return '🎨';
    if (type === 'arc') return '🌙';
    if (type === 'advance_openings' || type === 'widget') return '✂️';
    return '📦';
});

const calculateRoofPeakHeight = (roof) => {
    if (!roof || !roof.points || roof.points.length < 3) return 0;
    const conf = roof.config || roof;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    roof.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const W = maxX - minX, D = maxY - minY;
    const axis = conf.ridgeAxis || 'x';
    const maxSpan = (conf.roofType === 'gable' && axis === 'x') ? D : (conf.roofType === 'gable' ? W : Math.min(W, D));
    const pitch = conf.pitch || 30;
    return parseFloat((Math.tan(pitch * Math.PI / 180) * (maxSpan / 2)).toFixed(2));
};

const updateRoofPitchFromHeight = (e, roof) => {
    const targetHeight = parseFloat(e.target.value);
    if (isNaN(targetHeight) || targetHeight <= 0) return;
    if (!roof || !roof.points || roof.points.length < 3) return;
    const conf = roof.config || roof;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    roof.points.forEach(p => { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); });
    const W = maxX - minX, D = maxY - minY;
    const axis = conf.ridgeAxis || 'x';
    const maxSpan = (conf.roofType === 'gable' && axis === 'x') ? D : (conf.roofType === 'gable' ? W : Math.min(W, D));
    const newPitch = Math.atan(targetHeight / (maxSpan / 2)) * 180 / Math.PI;
    conf.pitch = newPitch;
    emit('sync-engine');
};

const isShapeMaterialActive = (key) => {
    if (!props.selectedEntity || !props.selectedEntity.params) return false;
    const target = props.selectedEntity.params.materialTarget || 'all';
    if (target === 'all') return props.selectedEntity.params.texture === key;
    if (target === 'top') return props.selectedEntity.params.textureTop === key;
    if (target === 'sides') return props.selectedEntity.params.textureSides === key;
    if (target === 'left') return props.selectedEntity.params.textureLeft === key;
    if (target === 'right') return props.selectedEntity.params.textureRight === key;
    if (target === 'front') return props.selectedEntity.params.textureFront === key;
    if (target === 'back') return props.selectedEntity.params.textureBack === key;
    if (target === 'bottom') return props.selectedEntity.params.textureBottom === key;
    return false;
};
</script>