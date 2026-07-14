<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">{{ selectedEntity.config?.name || 'Object' }}</h4>
        <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rotation" @input="$emit('sync-engine')"></div></div>
        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="10" max="500" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.depth" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="500" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.height" @change="$emit('sync-engine')" /></div></div>
        <div v-if="isKitchen">
            <h4 class="props-subtitle" style="margin-top: 15px;">Materials</h4>
            <div class="control-group">
                <label>Handle Color</label>
                <div class="input-wrap"><input type="color" v-model="selectedEntity.colorHandle" @change="$emit('sync-engine')" style="width: 100%; height: 30px; padding: 0;"></div>
            </div>
        </div>
        
        <button class="hud-delete" @click="$emit('delete-entity')">Delete Object</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import DimensionInput from '../../components/common/DimensionInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const isKitchen = computed(() => {
    const id = props.selectedEntity.configId || props.selectedEntity.config?.id;
    return id && id.startsWith('kitchen_');
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
