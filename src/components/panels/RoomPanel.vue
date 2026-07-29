<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Floor Properties</h4>
        <MaterialSizeInput 
            v-model="selectedEntity.materialScale" 
            :fallbackValue="floorRegistry[selectedEntity.configId]?.tileSize || 150"
            @change="$emit('sync-engine')" 
        />
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
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { UnitConverter } from '../../core/units/UnitConverter.js';
import MaterialSizeInput from '../common/MaterialSizeInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    floorRegistry: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'set-floor-material',
    'delete-entity'
]);

const settingsStore = useSettingsStore();
</script>
