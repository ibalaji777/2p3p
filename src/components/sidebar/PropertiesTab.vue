<template>
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

        <div class="props-empty" v-else-if="!activeTool || !activeTool.startsWith('preset_')">
            <span v-if="viewMode==='2d'">Select a wall, door, window, or object on the canvas to edit its properties here.</span>
            <span v-else-if="viewMode3D==='preview'">Exit Preview Mode to edit.</span>
            <span v-else>Select a wall or object to edit its properties.</span>
        </div>
  </div>
</template>

<script setup>
import WallPanel from '../../features/wall/wall.properties.vue';
import RoomPanel from '../panels/RoomPanel.vue';
import AdvanceOpeningsPanel from '../panels/AdvanceOpeningsPanel.vue';
import StairPanel from '../../features/stairs/stairs.properties.vue';
import WidgetPanel from '../panels/WidgetPanel.vue';
import MoldingPanel from '../panels/MoldingPanel.vue';
import ShapePanel from '../panels/ShapePanel.vue';
import FurniturePanel from '../../features/furniture/furniture.properties.vue';
import RoofPanel from '../../features/roof/roof.properties.vue';
import PresetGroupPanel from '../panels/PresetGroupPanel.vue';

const props = defineProps({
    activeTool: String,
    activePresetParams: Object,
    viewMode: String,
    viewMode3D: String,
    selectedEntity: Object,
    selectedType: String,
    selectedWallSide: String,
    currentFaceDecors: Array,
    activeDecorId: String,
    wallDecorRegistry: Object,
    railingRegistry: Object,
    uiTrigger: Number,
    floorRegistry: Object,
    roofDecorRegistry: Object
});

const emit = defineEmits([
    'sync-engine', 'ui-trigger', 'toggle-edit-decor', 'delete-specific-decor',
    'decor-update', 'spawn-wall-pattern', 'delete-entity', 'set-floor-material',
    'set-opening-material', 'clear-shape-textures', 'set-roof-material', 'set-shape-material'
]);

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
    return props.selectedEntity.params.faces?.[target] === key;
};
</script>
