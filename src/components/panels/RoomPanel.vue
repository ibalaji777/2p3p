<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Floor Properties</h4>
        <div class="control-group">
            <label>Material Scale</label>
            <div class="input-wrap">
                <input type="range" :value="selectedEntity.materialRepeat || floorRegistry[selectedEntity.configId]?.repeat || 10" @input="e => { selectedEntity.materialRepeat = parseFloat(e.target.value); $emit('sync-engine'); }" min="1" max="100" step="1">
                <input type="number" :value="selectedEntity.materialRepeat || floorRegistry[selectedEntity.configId]?.repeat || 10" @input="e => { selectedEntity.materialRepeat = parseFloat(e.target.value); $emit('sync-engine'); }" min="1" max="100" step="1">
            </div>
        </div>
        <div class="decor-gallery">
            <h4 class="props-subtitle">Floor Material</h4>
            <div class="decor-grid">
                <div v-for="(config, key) in floorRegistry" :key="key" class="decor-item" @click="$emit('set-floor-material', key)" :class="{ active: selectedEntity.configId === key }">
                    <img :src="config.thumbnail" />
                    <span>{{ config.name }}</span>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Floor & Walls</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    floorRegistry: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'set-floor-material',
    'delete-entity'
]);
</script>
