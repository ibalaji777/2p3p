<template>
    <div class="props-panel-inner">
        <h3 class="props-title">Preset Group</h3>
        <div class="control-group" v-if="selectedEntity.params.elevation !== undefined">
            <label>Elevation</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.params.elevation" min="0" max="600" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.params.elevation" min="0" max="600" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="selectedEntity.params.width !== undefined">
            <label>Width</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.params.width" min="50" max="1000" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.params.width" min="50" max="1000" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="selectedEntity.params.depth !== undefined">
            <label>Depth</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.params.depth" min="50" max="1000" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.params.depth" min="50" max="1000" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="selectedEntity.params.wallHeight !== undefined">
            <label>Wall Height</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.params.wallHeight" min="0" max="400" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.params.wallHeight" min="0" max="400" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="selectedEntity.params.pitch !== undefined">
            <label>Roof Pitch</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.params.pitch" min="0" max="60" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
                <input type="number" v-model.number="selectedEntity.params.pitch" min="0" max="60" step="1" @input="selectedEntity.regenerate(); $emit('sync-engine')">
            </div>
        </div>
        
        <button class="hud-delete" style="margin-top: 15px;" @click="$emit('delete-entity')">Delete Group</button>
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
