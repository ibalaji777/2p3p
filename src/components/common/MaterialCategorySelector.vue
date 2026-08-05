<template>
    <div class="control-group">
        <label>Material Category</label>
        <select v-model="selectedEntity.params.materialCategory" @change="onMaterialCategoryChange" class="settings-select">
            <option value="wood">Wood</option>
            <option value="metal">Metal</option>
            <option value="plastic">Plastic / PVC</option>
            <option value="glass">Glass</option>
            <option value="stone">Stone</option>
            <option value="fabric">Fabric</option>
        </select>
    </div>
</template>

<script setup>
const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits(['sync-engine']);

const onMaterialCategoryChange = () => {
    const categoryDefaults = {
        'wood': 'wood_golden_teak',
        'metal': 'metal_brushed_aluminum',
        'plastic': 'upvc_white',
        'glass': 'clear',
        'stone': 'marble_carrara',
        'fabric': 'fabric_linen_white'
    };
    
    if (!props.selectedEntity.params) {
        props.selectedEntity.params = {};
    }
    
    const cat = props.selectedEntity.params.materialCategory;
    const defaultMat = categoryDefaults[cat] || 'wood_golden_teak';
    
    if (props.selectedEntity.type === 'door') {
        props.selectedEntity.params.doorMat = defaultMat;
    } else if (props.selectedEntity.type === 'window') {
        props.selectedEntity.params.frameMat = defaultMat;
    } else {
        props.selectedEntity.params.texture = defaultMat;
    }
    
    emit('sync-engine');
};
</script>
