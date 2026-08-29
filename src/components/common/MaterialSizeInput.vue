<template>
    <div class="control-group">
        <label>{{ label }}</label>
        <div class="input-wrap" :style="{ '--app-unit': `'${activeMaterialUnit}'` }">
            <input type="range" v-model="displayValue" :min="sliderBounds.min" :max="sliderBounds.max" :step="sliderBounds.step">
            <input type="number" v-model.lazy="displayValue">
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { DEFAULT_UNIVERSAL_TILE_SIZE } from '../../core/registries/material.registry.js';

const props = defineProps({
    modelValue: { type: Number, required: false },
    label: { type: String, default: 'Tile Size' },
    defaultMin: { type: Number, default: 1 },
    defaultMax: { type: Number, default: 500 },
    defaultStep: { type: Number, default: 1 },
    fallbackValue: { type: Number, default: DEFAULT_UNIVERSAL_TILE_SIZE }
});

const emit = defineEmits(['update:modelValue', 'change']);

const settingsStore = useSettingsStore();
const activeMaterialUnit = computed(() => settingsStore.floorPlanSettings?.materialUnit || 'cm');

const sliderBounds = computed(() => {
    if (activeMaterialUnit.value === 'mm') {
        return { 
            min: props.defaultMin * 10, 
            max: props.defaultMax * 10, 
            step: props.defaultStep * 10 
        };
    }
    return { 
        min: props.defaultMin, 
        max: props.defaultMax, 
        step: props.defaultStep 
    };
});

const displayValue = computed({
    get() {
        const cmValue = props.modelValue || props.fallbackValue;
        if (activeMaterialUnit.value === 'mm') return Math.round(cmValue * 10);
        return cmValue;
    },
    set(newDisplayValue) {
        if (isNaN(newDisplayValue)) return;
        let cmValue = newDisplayValue;
        if (activeMaterialUnit.value === 'mm') cmValue = newDisplayValue / 10;
        
        const finalValue = Math.round(cmValue * 10) / 10;
        emit('update:modelValue', finalValue);
        emit('change', finalValue);
    }
});
</script>
