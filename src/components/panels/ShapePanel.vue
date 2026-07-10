<template>
    <div class="props-panel-inner">
        <div v-if="!selectedEntity.params.isEditingMaterials">
            <h4 class="props-subtitle">{{ selectedEntity.type === 'shape_rect' ? 'Box' : selectedEntity.type === 'shape_circle' ? 'Cylinder' : 'Prism / Polygon' }} Properties</h4>
            <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rotation" @input="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Height (Thickness)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.height3D" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.height3D" @input="$emit('sync-engine')"></div></div>
            <div v-if="selectedEntity.type === 'shape_rect'">
                <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.width" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.width" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.height" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.height" @input="$emit('sync-engine')"></div></div>
            </div>
            <div v-if="selectedEntity.type === 'shape_circle'">
                <div class="control-group"><label>Radius</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.radius" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.radius" @input="$emit('sync-engine')"></div></div>
            </div>
            <div class="control-group"><label>Color</label><div class="input-wrap"><input type="color" v-model="selectedEntity.params.fill" @input="e => { $emit('clear-shape-textures'); $emit('sync-engine'); }" style="width: 100%; padding: 0;"></div></div>

            <button class="hud-delete" @click="$emit('delete-entity')" style="margin-top: 10px;">Delete Shape</button>
        </div>
    </div>
</template>

<script setup>
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'clear-shape-textures',
    'delete-entity'
]);
</script>
