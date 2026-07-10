<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Roof Properties</h4>
        <div class="control-group">
            <label>Auto-Placement</label>
            <div style="display: flex; gap: 8px; justify-content: space-between; margin-bottom: 10px;">
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.config.autoPlacementMode === 'inner' ? '#e5e7eb' : 'white', borderColor: selectedEntity.config.autoPlacementMode === 'inner' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.config.autoPlacementMode = 'inner'; $emit('sync-engine')" title="Inner Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="8" y="8" width="8" height="8"></rect></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.config.autoPlacementMode === 'center' ? '#e5e7eb' : 'white', borderColor: selectedEntity.config.autoPlacementMode === 'center' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.config.autoPlacementMode = 'center'; $emit('sync-engine')" title="Wall Center Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="4 4"></line></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.config.autoPlacementMode === 'outer' ? '#e5e7eb' : 'white', borderColor: selectedEntity.config.autoPlacementMode === 'outer' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.config.autoPlacementMode = 'outer'; $emit('sync-engine')" title="Outer Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></button>
            </div>
        </div>
        <div class="control-group" v-if="['hip', 'gable'].includes(selectedEntity.config.roofType)"><label>Pitch (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.pitch" min="0" max="60" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.config.pitch" @input="$emit('sync-engine')"></div></div>
        <div class="control-group" v-if="['hip', 'gable'].includes(selectedEntity.config.roofType)"><label>Peak Height</label><div class="input-wrap"><input type="number" :value="calculateRoofPeakHeight(selectedEntity)" @change="updateRoofPitchFromHeight($event, selectedEntity)"></div></div>
        <div class="control-group" v-if="selectedEntity.config.roofType === 'gable'">
            <label>Ridge Direction</label>
            <div style="display: flex; gap: 8px;">
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: selectedEntity.config.ridgeAxis === 'x' ? '#e5e7eb' : 'white', borderColor: selectedEntity.config.ridgeAxis === 'x' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.config.ridgeAxis = 'x'; selectedEntity.config.manualRidge = true; $emit('sync-engine')">Horizontal</button>
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: selectedEntity.config.ridgeAxis === 'y' ? '#e5e7eb' : 'white', borderColor: selectedEntity.config.ridgeAxis === 'y' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.config.ridgeAxis = 'y'; selectedEntity.config.manualRidge = true; $emit('sync-engine')">Vertical</button>
            </div>
        </div>
        <div class="control-group" v-if="selectedEntity.config.roofType === 'gable'">
            <label>Auto-Shape Walls</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="selectedEntity.config.autoShapeWalls" @change="$emit('sync-engine')">
            </div>
        </div>
        <div class="control-group">
            <label>Master Overhang</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.config.overhang" min="0" max="50" @input="selectedEntity.config.overhangs && selectedEntity.config.overhangs.fill(selectedEntity.config.overhang); $emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.config.overhang" @input="selectedEntity.config.overhangs && selectedEntity.config.overhangs.fill(selectedEntity.config.overhang); $emit('sync-engine')">
            </div>
        </div>
        
        <div v-if="selectedEntity.config.overhangs && selectedEntity.config.overhangs.length > 0">
            <div class="control-group" v-for="(o, index) in selectedEntity.config.overhangs" :key="index" style="margin-left: 10px; opacity: 0.9;">
                <label style="font-size: 11px;">Side {{ index + 1 }} Overhang</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.config.overhangs[index]" min="0" max="50" @input="$emit('sync-engine')">
                    <input type="number" v-model.number="selectedEntity.config.overhangs[index]" @input="$emit('sync-engine')">
                </div>
            </div>
        </div>

        <div class="control-group"><label>Elevation Gap</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.wallGap" min="-50" max="100" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.config.wallGap" @input="$emit('sync-engine')"></div></div>
        
        <div class="decor-gallery" v-if="['hip', 'gable'].includes(selectedEntity.config.roofType)">
            <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('sync-engine')"></div></div>
            
            <h4 class="props-subtitle">Roof Material</h4>
            <div class="decor-grid">
                <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="$emit('set-roof-material', key)" :class="{ active: selectedEntity.config.material === key }">
                    <img :src="config.thumbnail" />
                    <span>{{ config.name }}</span>
                </div>
            </div>

            <div v-if="selectedEntity.config.roofType === 'gable'">
                <h4 class="props-subtitle" style="margin-top: 15px;">Gable Wall Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in wallDecorRegistry" :key="'g'+key" class="decor-item" @click="selectedEntity.config.gableMaterial = key; $emit('sync-engine')" :class="{ active: selectedEntity.config.gableMaterial === key }">
                        <img :src="config.thumbnail || config.texture" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="decor-gallery" v-if="selectedEntity.config.roofType === 'flat'">
            <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('sync-engine')"></div></div>
            
            <h4 class="props-subtitle">Change Material (Roof Texture)</h4>
            <div class="decor-grid">
                <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="() => { selectedEntity.configId = key; $emit('sync-engine'); }" :class="{ active: selectedEntity.configId === key }">
                    <img :src="config.thumbnail || config.texture" />
                    <span>{{ config.name }}</span>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Roof</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    roofDecorRegistry: { type: Object, required: true },
    wallDecorRegistry: { type: Object, required: true },
    calculateRoofPeakHeight: { type: Function, required: true },
    updateRoofPitchFromHeight: { type: Function, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'set-roof-material',
    'delete-entity'
]);
</script>
