<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Floor Properties</h4>
        <div class="control-group">
            <label>Tile Size ({{ activeMaterialUnit }})</label>
            <div class="input-wrap">
                <input type="range" v-model="displayValue" min="100" max="5000" step="50">
                <input type="number" v-model.lazy="displayValue" min="100" max="5000" step="50">
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
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { UnitConverter } from '../../core/units/UnitConverter.js';

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
const activeMaterialUnit = computed(() => settingsStore.floorPlanSettings?.materialUnit || 'cm');

// The 3D Engine strictly expects materialScale in Centimeters (cm).
// We must convert cm -> internal inches -> display unit.
const displayValue = computed({
    get() {
        const cmValue = props.selectedEntity.materialScale || props.floorRegistry[props.selectedEntity.configId]?.tileSize || 150;
        const internalInches = cmValue / 2.54;
        return UnitConverter.inchesToDisplay(internalInches, activeMaterialUnit.value);
    },
    set(newDisplayValue) {
        if (isNaN(newDisplayValue)) return;
        const internalInches = UnitConverter.displayToInches(newDisplayValue, activeMaterialUnit.value);
        const cmValue = internalInches * 2.54;
        props.selectedEntity.materialScale = Math.round(cmValue * 10) / 10;
        emit('sync-engine');
    }
});
</script>
