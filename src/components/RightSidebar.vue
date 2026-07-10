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
                <div class="tab-body">
                    <div class="props-content">
                <h4 class="props-subtitle">Floor Plan Configuration</h4>
                
                <div class="control-group">
                    <label>Entrance Facing</label>
                    <select v-model="floorPlanSettings.mainEntranceFacing" @change="$emit('sync-settings')" class="settings-select">
                        <option value="north">North</option>
                        <option value="south">South</option>
                        <option value="east">East</option>
                        <option value="west">West</option>
                        <option value="north_east">North-East</option>
                        <option value="north_west">North-West</option>
                        <option value="south_east">South-East</option>
                        <option value="south_west">South-West</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Length Unit</label>
                    <select v-model="floorPlanSettings.measurementUnit" @change="$emit('sync-settings')" class="settings-select">
                        <option value="ft">Feet (ft)</option>
                        <option value="in">Inches (in)</option>
                        <option value="feet_inches">Feet & Inches</option>
                        <option value="m">Meter (m)</option>
                        <option value="cm">Centimeter (cm)</option>
                        <option value="mm">Millimeter (mm)</option>
                    </select>
                </div>
                
                <div class="control-group">
                    <label>Area Unit</label>
                    <select v-model="floorPlanSettings.areaUnit" @change="$emit('sync-settings')" class="settings-select">
                        <option value="sqft">Square Feet (sqft)</option>
                        <option value="sqm">Square Meter (sqm)</option>
                        <option value="cent">Cent</option>
                        <option value="ground">Ground</option>
                        <option value="gunta">Gunta</option>
                    </select>
                </div>

                <div class="settings-divider"></div>

                <div class="control-group-inline">
                    <label>Show Compass</label>
                    <input type="checkbox" v-model="floorPlanSettings.showCompass" @change="$emit('sync-settings')" class="settings-checkbox">
                </div>
                <div class="control-group-inline">
                    <label>Show Grid</label>
                    <input type="checkbox" v-model="floorPlanSettings.showGrid" @change="$emit('sync-settings')" class="settings-checkbox">
                </div>
                <div class="control-group-inline">
                    <label>Dimension Labels</label>
                    <input type="checkbox" v-model="floorPlanSettings.showDimensionLabels" @change="$emit('sync-settings')" class="settings-checkbox">
                </div>
                <div class="control-group-inline">
                    <label>Diagonal Dimensions</label>
                    <input type="checkbox" v-model="floorPlanSettings.showDiagonalDimensions" @change="$emit('sync-settings')" class="settings-checkbox">
                </div>
                <div class="control-group" v-if="floorPlanSettings.showDiagonalDimensions">
                    <label>Diagonal Mode</label>
                    <select v-model="floorPlanSettings.diagonalMeasurementMode" @change="$emit('sync-settings')" class="settings-select">
                        <option value="inner">Inner Corner to Inner Corner</option>
                        <option value="outer">Outer Corner to Outer Corner</option>
                    </select>
                </div>
                <div class="control-group-inline">
                    <label>Workspace Labels</label>
                    <input type="checkbox" v-model="floorPlanSettings.showWorkspaceLabels" @change="$emit('sync-settings')" class="settings-checkbox">
                </div>
                <div class="control-group-inline">
                    <label>Wall Tracking</label>
                    <input type="checkbox" v-model="floorPlanSettings.wallTracking" @change="$emit('sync-settings')" class="settings-checkbox">
                </div>

                <div class="settings-divider"></div>
                <h4 class="props-subtitle">Environment Settings</h4>
                
                <div class="control-group">
                    <label>Sky Environment</label>
                    <select :value="selectedSky" @change="$emit('update:selectedSky', $event.target.value); $emit('set-sky', $event.target.value)" class="settings-select">
                        <option v-for="(config, key) in skyRegistry" :key="key" :value="key">{{ config.name }}</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Ground Environment</label>
                    <select :value="selectedGround" @change="$emit('update:selectedGround', $event.target.value); $emit('set-ground', $event.target.value)" class="settings-select">
                        <option v-for="(config, key) in groundRegistry" :key="key" :value="key">{{ config.name }}</option>
                    </select>
                </div>
                
                <div v-if="selectedType === 'wall'" style="margin-top: 20px;">

                </div>
            </div>
        </div>
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
                <div class="tab-body properties-tab-body">
            
            <div class="props-content" v-if="activeTool && activeTool.startsWith('preset_') && activePresetParams">
                <h4 class="props-subtitle">Preset Configuration</h4>
                <div class="control-group" v-if="'width' in activePresetParams">
                    <label>Width (cm)</label>
                    <input type="number" v-model.number="activePresetParams.width" class="settings-input" />
                </div>
                <div class="control-group" v-if="'depth' in activePresetParams">
                    <label>Depth (cm)</label>
                    <input type="number" v-model.number="activePresetParams.depth" class="settings-input" />
                </div>
                <div class="control-group" v-if="'wallHeight' in activePresetParams">
                    <label>Wall Height (cm)</label>
                    <input type="number" v-model.number="activePresetParams.wallHeight" class="settings-input" />
                </div>
                <div class="control-group" v-if="'elevation' in activePresetParams">
                    <label>Elevation (cm)</label>
                    <input type="number" v-model.number="activePresetParams.elevation" class="settings-input" title="Height from the floor level" />
                </div>
                <div class="control-group" v-if="'pitch' in activePresetParams">
                    <label>Roof Pitch (deg)</label>
                    <input type="number" v-model.number="activePresetParams.pitch" class="settings-input" />
                </div>
                <div class="control-group" v-if="'roofType' in activePresetParams">
                    <label>Roof Type</label>
                    <select v-model="activePresetParams.roofType" class="settings-select">
                        <option value="gable">Gable</option>
                        <option value="hip">Hip</option>
                        <option value="flat">Flat</option>
                    </select>
                </div>
                <div class="properties-help-text" style="margin-top: 15px; color: #64748b; font-size: 0.85rem; padding: 10px; background: #f8fafc; border-radius: 6px;">
                    Adjust dimensions before placing the preset. Once placed, individual walls and roofs can be edited separately.
                </div>
            </div>

                        <div class="props-content" v-else-if="(viewMode==='3d' || viewMode==='2d') && selectedEntity && (viewMode === '2d' || viewMode3D !== 'preview')">
            
            <!-- Universal Face Material Editor -->
            <div v-if="selectedEntity.params && selectedEntity.params.isEditingMaterials">
                <button class="btn-secondary" @click="selectedEntity.params.isEditingMaterials = false" style="width: 100%; margin-bottom: 15px;">← Back to Properties</button>
                <h4 class="props-subtitle">Face Selection</h4>
                <div class="control-group-inline" style="margin-bottom: 12px;">
                    <label>Apply to All Sides</label>
                    <input type="checkbox" :checked="!selectedEntity.params.materialTarget || selectedEntity.params.materialTarget === 'all'" @change="e => { selectedEntity.params.materialTarget = e.target.checked ? 'all' : 'front'; $emit('sync-engine'); }" class="settings-checkbox">
                </div>
                <div class="control-group" v-if="selectedEntity.params.materialTarget && selectedEntity.params.materialTarget !== 'all'">
                    <label>Target Face</label>
                    <select v-model="selectedEntity.params.materialTarget" class="settings-select">
                        <option value="front">Front Facing</option>
                        <option value="back">Back Facing</option>
                        <option value="left">Left Facing</option>
                        <option value="right">Right Facing</option>
                        <option value="top">Top Facing</option>
                        <option value="bottom">Bottom Facing</option>
                        <option value="sides">All Side Faces</option>
                    </select>
                </div>
                <div class="decor-gallery">
                    <h4 class="props-subtitle">Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('set-shape-material', key)" :class="{ active: isShapeMaterialActive(key) }">
                            <img :src="config.thumbnail" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>
            </div>
            
            <WallPanel 
                v-else-if="selectedType === 'wall'"
                :selected-entity="selectedEntity"
                :selected-wall-side="selectedWallSide"
                :current-face-decors="currentFaceDecors"
                :active-decor-id="activeDecorId"
                :wall-decor-registry="wallDecorRegistry"
                :railing-registry="railingRegistry"
                :ui-trigger="uiTrigger"
                :view-mode="viewMode"
                @sync-engine="$emit('sync-engine')"
                @ui-trigger="$emit('ui-trigger')"
                @toggle-edit-decor="$emit('toggle-edit-decor', $event)"
                @delete-specific-decor="$emit('delete-specific-decor', $event)"
                @decor-update="$emit('decor-update', $event)"
                @spawn-wall-pattern="$emit('spawn-wall-pattern', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <div v-else-if="selectedType === 'wallDecor'">
                <h4 class="props-subtitle">Wall Pattern Layer</h4>
                <div class="faceRow" v-if="selectedEntity.faces">
                    <label><input type="checkbox" v-model="selectedEntity.faces.left" @change="$emit('decor-update', selectedEntity)">L-Edge</label>
                    <label><input type="checkbox" v-model="selectedEntity.faces.right" @change="$emit('decor-update', selectedEntity)">R-Edge</label>
                </div>
                <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.width" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.height" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.localX" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.localX" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.localY" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.localY" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                
                <div class="decor-gallery" style="margin-top: 15px;">
                    <h4 class="props-subtitle">Change Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="() => { selectedEntity.configId = key; $emit('sync-engine'); }" :class="{ active: selectedEntity.configId === key }">
                            <img :src="config.thumbnail || config.texture" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" style="margin-top: 10px;" @click="$emit('delete-entity')">Delete Pattern</button>
            </div>

            <div v-else-if="selectedType === 'arc'">
                <h4 class="props-subtitle">Curved Wall Properties</h4>
                <div class="control-group"><label>Hidden Wall</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hidden" @change="() => { selectedEntity.walls.forEach(w => w.hidden = selectedEntity.hidden); $emit('sync-engine'); }"></div></div>
                <button class="hud-delete" @click="$emit('delete-entity')">Delete Curved Wall</button>
            </div>

            <RoomPanel 
                v-else-if="selectedType === 'room'"
                :selected-entity="selectedEntity"
                :floor-registry="floorRegistry"
                @sync-engine="$emit('sync-engine')"
                @set-floor-material="$emit('set-floor-material', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <StairPanel 
                v-else-if="selectedType === 'stair'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <AdvanceOpeningsPanel 
                v-else-if="selectedType === 'advance_openings'"
                :selected-entity="selectedEntity"
                :wall-decor-registry="wallDecorRegistry"
                :view-mode="viewMode"
                @sync-engine="$emit('sync-engine')"
                @set-opening-material="$emit('set-opening-material', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <WidgetPanel 
                v-else-if="selectedType === 'widget'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <MoldingPanel 
                v-else-if="selectedType === 'molding'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <ShapePanel
                v-else-if="selectedType === 'shape'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @clear-shape-textures="$emit('clear-shape-textures')"
                @delete-entity="$emit('delete-entity')"
            />
            
            <FurniturePanel
                v-else-if="selectedType === 'furniture'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />
            
            <RoofPanel
                v-else-if="selectedType === 'roof'"
                :selected-entity="selectedEntity"
                :roof-decor-registry="roofDecorRegistry"
                :wall-decor-registry="wallDecorRegistry"
                :calculate-roof-peak-height="calculateRoofPeakHeight"
                :update-roof-pitch-from-height="updateRoofPitchFromHeight"
                @sync-engine="$emit('sync-engine')"
                @set-roof-material="$emit('set-roof-material', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <PresetGroupPanel
                v-else-if="selectedType === 'preset_group'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />
        </div>

        <div class="props-empty" v-else-if="!activeTool || !activeTool.startsWith('preset_')" v-show="activeRightTab === 'properties'">
            <span v-if="viewMode==='2d'">Select a wall, door, window, or object on the canvas to edit its properties here.</span>
            <span v-else-if="viewMode3D==='preview'">Exit Preview Mode to edit.</span>
            <span v-else>Select a wall or object to edit its properties.</span>
        </div>
        </div>
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
                <div class="layers-content">
            <div class="layers-list">
                <div v-for="item in layerItems" :key="item.id" 
                     class="layer-row layer-item" 
                     :class="{active: selectedEntity === item.entity, subitem: item.isSubItem}" 
                     @click="$emit('select-layer-item', item)">
                    
                    <div class="layer-col-eye">
                        <button class="layer-eye-btn" @click.stop="$emit('toggle-layer-visibility', item)">
                            <svg v-if="!item.entity.isHidden" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                            <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                        </button>
                    </div>
                    
                    <div class="layer-col-icon" v-html="item.type === 'preset_group' ? getLayerSvg('folder') : getLayerSvg(item.type, item.name)"></div>
                    
                    <div class="layer-col-name">{{ item.name }}</div>
                    
                    <div class="layer-col-actions" style="position: relative;">
                        <button class="layer-dots-btn" @click.stop="activeLayerDropdown = activeLayerDropdown === item.id ? null : item.id">⋮</button>
                        
                        <!-- Dropdown Menu -->
                        <div v-if="activeLayerDropdown === item.id" class="layer-dropdown" @click.stop>
                            <input type="text" v-model="item.entity.description" @input="$emit('debounced-save-history')" placeholder="Add description..." class="layer-dropdown-input" />
                            <button class="layer-dropdown-del" @click.stop="$emit('remove-layer-item', item); activeLayerDropdown = null;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
                <div v-if="layerItems.length === 0" class="props-empty">No objects in the current floor.</div>
            </div>
                </div>
            </component>
        </Teleport>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed } from 'vue';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY } from '../core/registry';
import MobileBottomSheet from './MobileBottomSheet.vue';
import WallPanel from './panels/WallPanel.vue';
import RoomPanel from './panels/RoomPanel.vue';
import AdvanceOpeningsPanel from './panels/AdvanceOpeningsPanel.vue';
import StairPanel from './panels/StairPanel.vue';
import WidgetPanel from './panels/WidgetPanel.vue';
import MoldingPanel from './panels/MoldingPanel.vue';
import ShapePanel from './panels/ShapePanel.vue';
import FurniturePanel from './panels/FurniturePanel.vue';
import RoofPanel from './panels/RoofPanel.vue';
import PresetGroupPanel from './panels/PresetGroupPanel.vue';

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

const getLayerSvg = (type, name = '') => {
    let resolvedType = type;
    const n = name.toLowerCase();
    if (type === 'widget' || type === 'advance_openings') {
        if (n.includes('window')) resolvedType = 'window';
        else resolvedType = 'door';
    }

    const defaultSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
    const svgs = {
        'folder': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>`,
        'wall': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v16h16v-4H8V4z"></path></svg>`,
        'arc': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20 A 16 16 0 0 1 20 4 v 4 A 12 12 0 0 0 8 20 H 4 z"></path></svg>`,
        'railing': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6v12 M20 6v12 M4 10h16 M4 14h16"></path></svg>`,
        'roof': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12l10-9 10 9 M4 10v10h16V10"></path></svg>`,
        'door': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="2" width="16" height="20" rx="2"></rect><path d="M14 12v.01"></path></svg>`,
        'window': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 12h18 M12 3v18"></path></svg>`,
        'room': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18 M9 21V9"></path></svg>`,
        'floor': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><path d="M3 9h18 M9 21V9"></path></svg>`,
        'shape': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
        'stair': `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4v-4h4v-4h4v-4h4"></path></svg>`
    };
    return svgs[resolvedType] || defaultSvg;
};

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