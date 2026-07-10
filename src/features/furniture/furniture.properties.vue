<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">{{ selectedEntity.config?.name || 'Object' }}</h4>
        <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rotation" @input="$emit('sync-engine')"></div></div>
        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.width" @input="$emit('sync-engine')"></div></div>
        <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')"></div></div>
        <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" @input="$emit('sync-engine')"></div></div>
        
        <button class="hud-delete" @click="$emit('delete-entity')">Delete Object</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
