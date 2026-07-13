<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Advanced Opening Properties</h4>
        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.height" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'niche_recess'"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="1" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.depth" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="200" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.elevation" @change="$emit('sync-engine')" /></div></div>
        <div v-if="selectedEntity.type === 'pattern_opening'">
            <div class="control-group">
                <label>Pattern Style</label>
                <select v-model="selectedEntity.patternStyle" @change="$emit('sync-engine')" class="settings-select">
                    <option value="grid">Square Grid</option>
                    <option value="diamond">Diamond Lattice</option>
                    <option value="circle">Circular Perforations</option>
                    <option value="cross">Terracotta Cross (Kerala)</option>
                    <option value="hexagon">Honeycomb (Chettinad)</option>
                    <option value="star">Floral Star</option>
                    <option value="slit">Vertical Slits</option>
                    <option value="terracotta">Terracotta Jali (Classic)</option>
                    <option value="arabesque">Geometric Arabesque</option>
                </select>
            </div>
            <div class="control-group"><label>Rows</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rows" min="1" max="20" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rows" @input="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Columns</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.cols" min="1" max="20" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.cols" @input="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Spacing</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.spacing" min="0" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.spacing" @change="$emit('sync-engine')" /></div></div>
        </div>
        
        <div class="decor-gallery" v-if="viewMode === '3d'">
            <h4 class="props-subtitle">Opening Material</h4>
            <div class="decor-grid">
                <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('set-opening-material', key)" :class="{ active: selectedEntity.decorConfigId === key }">
                    <img :src="config.thumbnail" />
                    <span>{{ config.name }}</span>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Opening</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    wallDecorRegistry: { type: Object, required: true },
    viewMode: { type: String, default: '2d' }
});

const emit = defineEmits([
    'sync-engine',
    'set-opening-material',
    'delete-entity'
]);
</script>
