<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Molding / Cornice Properties</h4>
        <div class="control-group"><label>Length</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="1000" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group"><label>Depth (Thickness)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="1" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.depth" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.heightOffset" min="0" max="500" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.heightOffset" @change="$emit('sync-engine')" /></div></div>
        
        <div class="control-group">
            <label>Placement Side</label>
            <select v-model="selectedEntity.side" @change="selectedEntity.update(); $emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                <option value="left">Left (Inner)</option>
                <option value="right">Right (Outer)</option>
            </select>
        </div>
        <div class="control-group">
            <label>Profile Type</label>
            <select v-model="selectedEntity.profileType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                <option value="flat">Flat Band</option>
                <option value="groove">Groove (Recessed)</option>
                <option value="frame">Frame (Beveled Edge)</option>
                <option value="crown">Cove Crown</option>
                <option value="ogee">Ogee (Cyma) Crown</option>
                <option value="egg_and_dart">Egg and Dart Ornate</option>
                <option value="dentil">Dentil Blocks</option>
                <option value="craftsman">Step / Craftsman</option>
                <option value="layered">Layered Steps</option>
            </select>
        </div>

        <div v-if="selectedEntity.profileType === 'layered'">
            <div class="control-group"><label>Layers</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.layers" min="2" max="10" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.layers" @input="$emit('sync-engine')"></div></div>
        </div>

        <div class="control-group">
            <label>Material</label>
            <select v-model="selectedEntity.material" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                <option value="white_paint">White Paint (Plaster)</option>
                <option value="wall_material">Wall Match</option>
                <option value="wood_dark">Dark Wood</option>
                <option value="black_metal">Black Metal</option>
            </select>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Molding</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
