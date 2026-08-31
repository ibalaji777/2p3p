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
        <div class="panel-header" v-if="!(isMobile || isTablet)"><h3>Floor Levels & Sub-Structure</h3></div>
        
        <!-- Underlay Reference Controls (2D Mode Only) -->
        <div v-if="viewMode === '2d' && levels.length > 1" class="underlay-controls-card">
            <div class="underlay-header">
                <div class="underlay-title-wrap">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="underlay-icon">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                        <circle cx="12" cy="12" r="3"></circle>
                    </svg>
                    <span class="underlay-title">Reference Underlay</span>
                </div>
                <span class="underlay-badge">{{ referenceLevelIndex === 'none' ? 'Hidden' : (referenceLevelIndex === 'auto' ? 'Auto' : 'Selected') }}</span>
            </div>
            
            <div class="underlay-row">
                <label class="underlay-label">Underlay</label>
                <select 
                    class="underlay-select" 
                    :value="referenceLevelIndex" 
                    @change="$emit('set-reference-level', $event.target.value === 'auto' || $event.target.value === 'none' ? $event.target.value : Number($event.target.value))"
                >
                    <option value="auto">Auto (Adjacent Floor)</option>
                    <option value="none">None (Hidden)</option>
                    <option 
                        v-for="(lvl, idx) in levels" 
                        :key="lvl.id" 
                        :value="idx"
                        :disabled="idx === activeLevelIndex"
                    >
                        {{ lvl.name || ('Floor ' + (idx + 1)) }} {{ idx === activeLevelIndex ? '(Current)' : '' }}
                    </option>
                </select>
            </div>

            <div class="underlay-row" v-if="referenceLevelIndex !== 'none'">
                <label class="underlay-label">Opacity ({{ Math.round((referenceOpacity || 0.5) * 100) }}%)</label>
                <input 
                    type="range" 
                    min="0.1" 
                    max="1" 
                    step="0.05" 
                    :value="referenceOpacity || 0.5" 
                    @input="$emit('set-reference-opacity', Number($event.target.value))"
                    class="underlay-slider"
                >
            </div>

            <!-- 1-Click Project / Copy Walls Action Button -->
            <div class="underlay-actions" v-if="referenceLevelIndex !== 'none'">
                <button 
                    class="btn-project-walls" 
                    @click="openProjectWallsModal"
                    title="Generate walls into active level using reference underlay geometry"
                >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    <span>Project Walls from Reference</span>
                </button>
            </div>
        </div>

        <div class="levels-list">
            <div v-if="viewMode === '3d'" class="level-item level-show-all-item" @click="$emit('toggle-all-floors')">
                <div class="level-left-col">
                    <input type="checkbox" :checked="allFloorsVisible" @change="$emit('toggle-all-floors')" @click.stop title="Toggle All">
                    <span class="level-name-text font-semibold">Show All Floors</span>
                </div>
            </div>
            
            <div v-for="(level, index) in levels" :key="level.id" class="level-wrapper">
                <div 
                    class="level-item" 
                    :class="{ 'active': activeLevelIndex === index && viewMode === '2d' }"
                    @click="$emit('switch-level', index)"
                >
                    <div class="level-left-col">
                        <input 
                            v-if="viewMode === '3d'" 
                            type="checkbox" 
                            :checked="level.isVisible !== false" 
                            @change="(e) => { level.isVisible = e.target.checked; $emit('level-visibility-change'); }" 
                            @click.stop 
                            title="Toggle Visibility in 3D"
                            class="level-checkbox"
                        >
                        <div class="level-info-col">
                            <div class="level-title-row">
                                <span class="level-name-text">{{ level.name || ('Floor ' + (index + 1)) }}</span>
                                <span class="level-tag" v-if="level.type && level.type !== 'floor'">{{ getLevelTypeName(level.type) }}</span>
                                <span class="level-active-pill" v-if="activeLevelIndex === index && viewMode === '2d'">Active</span>
                            </div>
                            <div class="level-sub-info">
                                <span class="level-dim-info">H: {{ formatLabel(level.height !== undefined ? level.height : 120) }} &nbsp;•&nbsp; Thk: {{ formatLabel(level.defaultWallThickness !== undefined ? level.defaultWallThickness : 9) }}</span>
                                <div 
                                    v-if="level.description && editingLevelId !== level.id" 
                                    class="level-desc-text" 
                                    :title="'Description: ' + level.description + ' (Click to edit)'"
                                    @click.stop="startEditLevel(level, index)"
                                >
                                    <span>{{ level.description }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="level-actions-col">
                        <!-- Edit Floor Details Button -->
                        <button 
                            class="level-action-btn" 
                            :class="{ 'is-editing': editingLevelId === level.id }"
                            :title="level.description ? 'Edit floor: ' + level.description : 'Edit floor details'"
                            @click.stop="toggleEditLevel(level, index)"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>

                        <!-- Delete Floor Level -->
                        <button 
                            class="level-action-btn level-del-btn" 
                            :disabled="levels.length <= 1"
                            :title="levels.length <= 1 ? 'Cannot delete the only floor' : 'Delete floor level'"
                            @click.stop="onDeleteLevel(index)"
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Clean Inline Floor Details Editor -->
                <div v-if="editingLevelId === level.id" class="level-editor-card" @click.stop>
                    <div class="level-editor-header">
                        <span class="level-editor-title">Edit Level Details</span>
                    </div>
                    
                    <div class="level-editor-body">
                        <div class="level-form-group">
                            <label class="level-form-label">Floor Name</label>
                            <input 
                                type="text" 
                                v-model="editLevelName" 
                                placeholder="Floor Name (e.g. Ground Floor)" 
                                class="level-form-input"
                                @keydown.enter="saveLevelEdit(index)"
                                @keydown.esc="cancelLevelEdit"
                            />
                        </div>

                        <div class="level-form-group">
                            <label class="level-form-label">Floor Type</label>
                            <select v-model="editLevelType" class="level-form-select">
                                <option value="foundation">Foundation / Footing</option>
                                <option value="plinth">Plinth Beam</option>
                                <option value="basement">Basement</option>
                                <option value="ground">Ground Floor</option>
                                <option value="floor">Standard Upper Floor</option>
                                <option value="terrace">Terrace / Roof</option>
                            </select>
                        </div>

                        <div class="level-form-row">
                            <div class="level-form-col">
                                <label class="level-form-label">Height ({{ unitSuffix }})</label>
                                <DimensionInput 
                                    v-model="editLevelHeight" 
                                    class="level-form-input"
                                />
                            </div>
                            <div class="level-form-col">
                                <label class="level-form-label">Wall Thk ({{ unitSuffix }})</label>
                                <DimensionInput 
                                    v-model="editLevelWallThickness" 
                                    class="level-form-input"
                                />
                            </div>
                        </div>

                        <div class="level-form-group">
                            <label class="level-form-label">Description / Notes</label>
                            <input 
                                type="text" 
                                v-model="editLevelDesc" 
                                placeholder="e.g. Reinforcement, Grade..." 
                                class="level-form-input"
                                @keydown.enter="saveLevelEdit(index)"
                                @keydown.esc="cancelLevelEdit"
                            />
                        </div>
                    </div>

                    <div class="level-editor-actions">
                        <button class="btn-editor-cancel" @click.stop="cancelLevelEdit">Cancel</button>
                        <button class="btn-editor-save" @click.stop="saveLevelEdit(index)">Save</button>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Clean Sub-Structure & Floor Action Buttons -->
        <div class="levels-actions">
            <div class="levels-add-grid">
                <button class="btn-add-level" @click="$emit('add-level', 'empty', 'floor')" title="Add upper floor level above">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="level-btn-icon">
                        <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
                        <polyline points="2 12 12 17 22 12"></polyline>
                        <polyline points="2 17 12 22 22 17"></polyline>
                    </svg>
                    <span>Upper Floor</span>
                </button>
                <button class="btn-add-level" @click="$emit('add-level', 'empty', 'plinth')" title="Add grade-level structural plinth tie beam">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="level-btn-icon">
                        <rect x="2" y="9" width="20" height="6" rx="1"></rect>
                        <path d="M6 9V5"></path>
                        <path d="M18 9V5"></path>
                        <line x1="2" y1="19" x2="22" y2="19" stroke-dasharray="3 3"></line>
                    </svg>
                    <span>Plinth Beam</span>
                </button>
                <button class="btn-add-level" @click="$emit('add-level', 'empty', 'basement')" title="Add habitable underground basement room floor">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="level-btn-icon">
                        <line x1="2" y1="5" x2="22" y2="5"></line>
                        <path d="M5 5v14h14V5"></path>
                        <path d="M8 8h3v3h3v3h3"></path>
                    </svg>
                    <span>Basement</span>
                </button>
                <button class="btn-add-level" @click="$emit('add-level', 'empty', 'foundation')" title="Add deep structural spread footing foundation">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="level-btn-icon">
                        <path d="M10 3v8H4v8h16v-8h-6V3h-4z"></path>
                        <line x1="2" y1="21" x2="22" y2="21"></line>
                    </svg>
                    <span>Foundation</span>
                </button>
            </div>
            <button class="btn-duplicate-level" @click="$emit('add-level', 'duplicate', 'floor')" title="Duplicate current active floor walls and rooms">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="level-btn-icon">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Duplicate Active Floor</span>
            </button>
        </div>

        <!-- Professional Project Walls Modal Dialog -->
        <div v-if="showProjectModal" class="project-modal-backdrop" @click="showProjectModal = false">
            <div class="project-modal-card" @click.stop>
                <div class="project-modal-header">
                    <div class="project-modal-title-wrap">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        <h4>Project Walls from Reference</h4>
                    </div>
                    <button class="project-modal-close" @click="showProjectModal = false">✕</button>
                </div>
                
                <p class="project-modal-desc">
                    Instantly copy load-bearing walls from the reference underlay into your active level with custom thickness.
                </p>

                <div class="project-modal-fields">
                    <div class="project-modal-field">
                        <label>Target Wall Thickness ({{ unitSuffix }})</label>
                        <DimensionInput v-model="projectThickness" class="project-input" />
                    </div>
                    <div class="project-modal-checkbox">
                        <label>
                            <input type="checkbox" v-model="projectOnlyOuter" />
                            <span>Copy only exterior / perimeter walls (Recommended for Foundation & Plinth)</span>
                        </label>
                    </div>
                </div>

                <div class="project-modal-actions">
                    <button class="btn-project-cancel" @click="showProjectModal = false">Cancel</button>
                    <button class="btn-project-confirm" @click="confirmProjectWalls">Generate Walls</button>
                </div>
            </div>
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
                @sync-door-angle="$emit('sync-door-angle')"
                @ui-trigger="$emit('ui-trigger')"
                @toggle-edit-decor="$emit('toggle-edit-decor', $event)"
                @delete-specific-decor="$emit('delete-specific-decor', $event)"
                @decor-update="$emit('decor-update', $event)"
                @spawn-wall-pattern="$emit('spawn-wall-pattern', $event)"
                @delete-entity="$emit('delete-entity')"
                @set-floor-material="$emit('set-floor-material', $event)"
                @set-opening-material="$emit('set-opening-material', $event)"
                @clear-shape-textures="$emit('clear-shape-textures')"
                @set-roof-material="(...args) => $emit('set-roof-material', ...args)"
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
import DimensionInput from './common/DimensionInput.vue';
import { useDimension } from '../core/units/useDimension.js';

const props = defineProps({
  isMobile: Boolean,
  isTablet: Boolean,
  mobileMenuOpen: Boolean,
  activeMobileTab: String,
  viewMode: String,
  viewMode3D: String,
  levels: Array,
  activeLevelIndex: Number,
  referenceLevelIndex: [String, Number],
  referenceOpacity: Number,
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
  'delete-level',
  'update-level-details',
  'set-reference-level',
  'set-reference-opacity',
  'project-walls',
  'sync-settings',
  'set-entrance-wall',
  'set-sky',
  'set-ground',
  'sync-engine',
  'sync-door-angle',
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

const { formatLabel, unitSuffix } = useDimension();

const editingLevelId = ref(null);
const editLevelName = ref('');
const editLevelDesc = ref('');
const editLevelType = ref('floor');
const editLevelHeight = ref(120);
const editLevelWallThickness = ref(9);

// Project Walls Modal State
const showProjectModal = ref(false);
const projectThickness = ref(18);
const projectOnlyOuter = ref(true);

const getLevelTypeName = (type) => {
    switch (type) {
        case 'foundation': return 'Foundation';
        case 'plinth': return 'Plinth Beam';
        case 'basement': return 'Basement';
        case 'ground': return 'Ground Floor';
        case 'terrace': return 'Terrace';
        default: return 'Upper Floor';
    }
};

const getLevelTypeIcon = (type) => {
    switch (type) {
        case 'foundation': return '🏗️';
        case 'plinth': return '🧱';
        case 'basement': return '🏬';
        case 'ground': return '🏠';
        case 'terrace': return '⛺';
        default: return '🏢';
    }
};

const openProjectWallsModal = () => {
    const activeLvl = props.levels?.[props.activeLevelIndex];
    if (activeLvl?.type === 'foundation') {
        projectThickness.value = 18; // ~45.7 cm
        projectOnlyOuter.value = true;
    } else if (activeLvl?.type === 'plinth') {
        projectThickness.value = 9; // ~23 cm
        projectOnlyOuter.value = true;
    } else {
        projectThickness.value = activeLvl?.defaultWallThickness || 9;
        projectOnlyOuter.value = false;
    }
    showProjectModal.value = true;
};

const confirmProjectWalls = () => {
    showProjectModal.value = false;
    emit('project-walls', {
        thickness: Number(projectThickness.value) || 9,
        onlyOuter: projectOnlyOuter.value
    });
};

const startEditLevel = (level, index) => {
    editingLevelId.value = level.id;
    editLevelName.value = level.name || ('Floor ' + (index + 1));
    editLevelDesc.value = level.description || '';
    editLevelType.value = level.type || 'floor';
    editLevelHeight.value = level.height !== undefined ? level.height : 120;
    editLevelWallThickness.value = level.defaultWallThickness !== undefined ? level.defaultWallThickness : 9;
};

const toggleEditLevel = (level, index) => {
    if (editingLevelId.value === level.id) {
        saveLevelEdit(index);
    } else {
        startEditLevel(level, index);
    }
};

const saveLevelEdit = (index) => {
    emit('update-level-details', {
        index,
        name: editLevelName.value.trim() || ('Floor ' + (index + 1)),
        description: editLevelDesc.value.trim() || undefined,
        type: editLevelType.value,
        height: Number(editLevelHeight.value) || 120,
        defaultWallThickness: Number(editLevelWallThickness.value) || 9
    });
    editingLevelId.value = null;
    emit('debounced-save-history');
};

const cancelLevelEdit = () => {
    editingLevelId.value = null;
};

const onDeleteLevel = (index) => {
    if (props.levels && props.levels.length > 1) {
        emit('delete-level', index);
    }
};

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