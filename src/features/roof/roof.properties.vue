<template>
    <div class="props-panel-inner" v-if="selectedEntity">
        <h4 class="props-subtitle">Roof Properties</h4>
        <div class="control-group" v-if="roofConfig">
            <label>Auto-Placement</label>
            <div style="display: flex; gap: 8px; justify-content: space-between; margin-bottom: 10px;">
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'inner' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'inner' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.autoPlacementMode = 'inner'; $emit('sync-engine')" title="Inner Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="8" y="8" width="8" height="8"></rect></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'center' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'center' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.autoPlacementMode = 'center'; $emit('sync-engine')" title="Wall Center Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="4 4"></line></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'outer' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'outer' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.autoPlacementMode = 'outer'; $emit('sync-engine')" title="Outer Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></button>
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType !== 'flat'"><label>Pitch (°)</label><div class="input-wrap"><input type="range" v-model.number="roofConfig.pitch" min="0" max="75" @input="$emit('sync-engine')"><input type="number" v-model.number="roofConfig.pitch" @input="$emit('sync-engine')"></div></div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType !== 'flat'"><label>Peak Height</label><div class="input-wrap"><DimensionInput :modelValue="calculateRoofPeakHeight(selectedEntity)" @change="(val) => updateRoofPitchFromHeight({ target: { value: val } }, selectedEntity)" /></div></div>
        
        <div class="control-group" v-if="roofConfig && ['gable', 'shed', 'curved', 'gambrel', 'mansard', 'turret_round', 'turret_octagonal', 'turret_hexagonal'].includes(roofConfig.roofType)">
            <label>Curvature / Arch</label>
            <div class="input-wrap">
                <input type="range" v-model.number="roofConfig.curve" min="-50" max="50" @input="$emit('sync-engine')">
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">{{ (roofConfig.curve || 0) > 0 ? 'Convex +' + roofConfig.curve : ((roofConfig.curve || 0) < 0 ? 'Pagoda ' + roofConfig.curve : 'Flat 0') }}</span>
            </div>
        </div>

        <div class="control-group" v-if="roofConfig && ['gable', 'shed', 'gambrel'].includes(roofConfig.roofType)">
            <label>Slope / Ridge Axis</label>
            <div style="display: flex; gap: 8px;">
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: (roofConfig.ridgeAxis === 'x' || !roofConfig.ridgeAxis) ? '#e5e7eb' : 'white', borderColor: (roofConfig.ridgeAxis === 'x' || !roofConfig.ridgeAxis) ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.ridgeAxis = 'x'; roofConfig.manualRidge = true; $emit('sync-engine')">Horizontal</button>
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: roofConfig.ridgeAxis === 'y' ? '#e5e7eb' : 'white', borderColor: roofConfig.ridgeAxis === 'y' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.ridgeAxis = 'y'; roofConfig.manualRidge = true; $emit('sync-engine')">Vertical</button>
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'shed'">
            <label>Flip High/Low Side</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="roofConfig.flipSlope" @change="$emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'gable'">
            <label>Auto-Shape Walls</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="roofConfig.autoShapeWalls" @change="$emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="roofConfig">
            <label>Master Overhang</label>
            <div class="input-wrap">
                <input type="range" v-model.number="roofConfig.overhang" min="0" max="50" @input="roofConfig.overhangs && roofConfig.overhangs.fill(roofConfig.overhang); $emit('sync-engine')">
                <DimensionInput v-model="roofConfig.overhang" @change="roofConfig.overhangs && roofConfig.overhangs.fill(roofConfig.overhang); $emit('sync-engine')" />
            </div>
        </div>
        
        <div v-if="roofConfig && roofConfig.overhangs && roofConfig.overhangs.length > 0">
            <div class="control-group" v-for="(o, index) in roofConfig.overhangs" :key="index" style="margin-left: 10px; opacity: 0.9;">
                <label style="font-size: 11px;">Side {{ index + 1 }} Overhang</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="roofConfig.overhangs[index]" min="0" max="50" @input="$emit('sync-engine')">
                    <DimensionInput v-model="roofConfig.overhangs[index]" @change="$emit('sync-engine')" />
                </div>
            </div>
        </div>

        <div class="control-group" v-if="roofConfig"><label>Elevation Gap</label><div class="input-wrap"><input type="range" v-model.number="roofConfig.wallGap" min="-50" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="roofConfig.wallGap" @change="$emit('sync-engine')" /></div></div>
        
        <div class="decor-gallery" v-if="roofConfig && roofConfig.roofType !== 'flat'">
            <MaterialSizeInput v-model="selectedEntity.tileSize" :defaultMax="200" @change="$emit('sync-engine')" />
            
            <h4 class="props-subtitle">Roof Material</h4>
            <div class="decor-grid">
                <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="$emit('set-roof-material', key)" :class="{ active: roofConfig.material === key }">
                    <img :src="config.thumbnail" />
                    <span>{{ config.name }}</span>
                </div>
            </div>

            <div v-if="['gable', 'shed', 'half_hip', 'curved', 'gambrel', 'dutch_gable', 'jerkinhead'].includes(roofConfig.roofType)">
                <h4 class="props-subtitle" style="margin-top: 15px;">Gable Wall Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in wallDecorRegistry" :key="'g'+key" class="decor-item" @click="roofConfig.gableMaterial = key; $emit('sync-engine')" :class="{ active: roofConfig.gableMaterial === key }">
                        <img :src="config.thumbnail || config.texture" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="decor-gallery" v-if="roofConfig && roofConfig.roofType === 'flat'">
            <MaterialSizeInput v-model="selectedEntity.tileSize" :defaultMax="200" @change="$emit('sync-engine')" />
            
            <h4 class="props-subtitle">Change Material (Roof Texture)</h4>
            <div class="decor-grid">
                <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="() => { selectedEntity.configId = key; if (roofConfig) roofConfig.material = key; $emit('sync-engine'); }" :class="{ active: (selectedEntity.configId === key || roofConfig.material === key) }">
                    <img :src="config.thumbnail || config.texture" />
                    <span>{{ config.name }}</span>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Roof</button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import DimensionInput from '../../components/common/DimensionInput.vue';
import MaterialSizeInput from '../../components/common/MaterialSizeInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    roofDecorRegistry: { type: Object, required: true },
    wallDecorRegistry: { type: Object, required: true },
    calculateRoofPeakHeight: { type: Function, required: true },
    updateRoofPitchFromHeight: { type: Function, required: true }
});

const roofConfig = computed(() => {
    if (!props.selectedEntity) return null;
    if (props.selectedEntity.config) return props.selectedEntity.config;
    return props.selectedEntity;
});

const emit = defineEmits([
    'sync-engine',
    'set-roof-material',
    'delete-entity'
]);
</script>
