<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle" v-if="selectedEntity.type === 'railing'">Railing Properties</h4>
        <h4 class="props-subtitle" v-else>Wall Properties</h4>
        
        <div class="control-group">
            <label>Hidden Wall</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="selectedEntity.hidden" @change="$emit('sync-engine')">
            </div>
        </div>
        
        <div class="control-group">
            <label>Thickness</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="$emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="$emit('sync-engine')">
            </div>
        </div>
        
        <div class="control-group" v-if="selectedEntity.type !== 'railing'" style="flex-direction: column; align-items: flex-start;">
            <label style="margin-bottom: 8px;">Top Profile Type</label>
            <div style="display: flex; gap: 8px; width: 100%;">
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: (!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal') ? '#e5e7eb' : 'white', borderColor: (!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal') ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.topProfileType = 'normal'; $emit('sync-engine')" title="Normal Wall">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="16" rx="2" ry="2"></rect></svg>
                </button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.topProfileType === 'single' ? '#e5e7eb' : 'white', borderColor: selectedEntity.topProfileType === 'single' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.topProfileType = 'single'; $emit('sync-engine')" title="Single Slope">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16V6l-16 8v8z"></path></svg>
                </button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.topProfileType === 'gable' ? '#e5e7eb' : 'white', borderColor: selectedEntity.topProfileType === 'gable' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.topProfileType = 'gable'; $emit('sync-engine')" title="Gable Slope">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16V10L12 4 4 10v12z"></path></svg>
                </button>
            </div>
        </div>

        <div v-if="!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal' || selectedEntity.type === 'railing'" class="control-group">
            <label>Height</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="$emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="$emit('sync-engine')">
            </div>
        </div>

        <template v-else>
            <div class="control-group">
                <label>Start Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.startHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                    <input type="number" v-model.number="selectedEntity.startHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                </div>
            </div>
            <div class="control-group" v-if="selectedEntity.topProfileType === 'gable'">
                <label>Peak Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.peakHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                    <input type="number" v-model.number="selectedEntity.peakHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                </div>
            </div>
            <div class="control-group">
                <label>End Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.endHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                    <input type="number" v-model.number="selectedEntity.endHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                </div>
            </div>
            <div class="control-group">
                <label>Slope Direction</label>
                <div style="display: flex; gap: 8px;">
                    <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: !selectedEntity.flipSlope ? '#e5e7eb' : 'white', borderColor: !selectedEntity.flipSlope ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.flipSlope = false; $emit('sync-engine')">Default</button>
                    <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: selectedEntity.flipSlope ? '#e5e7eb' : 'white', borderColor: selectedEntity.flipSlope ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.flipSlope = true; $emit('sync-engine')">Flipped</button>
                </div>
            </div>
        </template>

        <div v-if="selectedEntity.type === 'railing'">
            <div class="decor-gallery">
                <h4 class="props-subtitle">Railing Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in railingRegistry" :key="key" class="decor-item" @click="selectedEntity.configId = key; $emit('ui-trigger'); $emit('sync-engine')" :class="{ active: (selectedEntity.configId || 'rail_1') === key && uiTrigger !== -1 }">
                        <img :src="config.thumbnail" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>
        <div v-else>
            <h4 class="props-subtitle">{{ selectedWallSide === 'front' ? 'Inner Wall Face' : 'Outer Wall Face' }}</h4>
            
            <div v-if="currentFaceDecors.length > 0">
                <div class="applied-list">
                    <div v-for="decor in currentFaceDecors" :key="decor.id" class="applied-item-wrapper">
                        <div class="applied-item-header" :class="{active: activeDecorId === decor.id}" @click="$emit('toggle-edit-decor', decor.id)">
                            <span>{{ wallDecorRegistry[decor.configId]?.name }}</span>
                            <button class="btn-sm-delete" @click.stop="$emit('delete-specific-decor', decor)">✕</button>
                        </div>
                        <div class="applied-item-body" v-if="activeDecorId === decor.id">
                            <div class="faceRow" v-if="decor.faces">
                                <label><input type="checkbox" v-model="decor.faces.left" @change="$emit('decor-update', decor)">L-Edge</label>
                                <label><input type="checkbox" v-model="decor.faces.right" @change="$emit('decor-update', decor)">R-Edge</label>
                            </div>
                            <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.width" min="1" max="100" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.width" min="1" max="100" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.height" min="1" max="100" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.height" min="1" max="100" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localX" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.localX" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localY" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.localY" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"></div></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="decor-gallery" v-if="viewMode === '3d'">
                <h4 class="props-subtitle">Add Pattern Layer</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('spawn-wall-pattern', key)">
                        <img :src="config.thumbnail" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete {{ selectedEntity.type === 'railing' ? 'Railing' : 'Wall' }}</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    selectedWallSide: { type: String, required: false },
    currentFaceDecors: { type: Array, default: () => [] },
    activeDecorId: { type: String, default: null },
    wallDecorRegistry: { type: Object, required: true },
    railingRegistry: { type: Object, required: true },
    uiTrigger: { type: Number, default: 0 },
    viewMode: { type: String, default: '2d' }
});

const emit = defineEmits([
    'sync-engine',
    'ui-trigger',
    'toggle-edit-decor',
    'delete-specific-decor',
    'decor-update',
    'spawn-wall-pattern',
    'delete-entity'
]);
</script>
