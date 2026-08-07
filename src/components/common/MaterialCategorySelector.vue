<template>
    <div class="control-group">
        <label>Material Category</label>
        <select v-model="selectedEntity.params.materialCategory" @change="onMaterialCategoryChange" class="settings-select">
            <option v-for="opt in availableOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits(['sync-engine']);

const availableOptions = computed(() => {
    const type = props.selectedEntity?.type;
    
    if (type === 'door') {
        return [
            { value: 'wood', label: 'Wood' },
            { value: 'wpc', label: 'WPC' },
            { value: 'pvc', label: 'PVC' },
            { value: 'upvc', label: 'uPVC' },
            { value: 'steel', label: 'Steel' },
            { value: 'aluminium', label: 'Aluminium' },
            { value: 'frp', label: 'Fiberglass (FRP)' },
            { value: 'glass', label: 'Glass' }
        ];
    } else if (type === 'window') {
        return [
            { value: 'wood', label: 'Wood' },
            { value: 'upvc', label: 'uPVC' },
            { value: 'pvc', label: 'PVC' },
            { value: 'aluminium', label: 'Aluminium' },
            { value: 'steel', label: 'Steel' },
            { value: 'glass', label: 'Glass' }
        ];
    } else if (type === 'wall' || type === 'wallDecor' || type === 'floor') {
        return [
            { value: 'stone', label: 'Stone' },
            { value: 'glass', label: 'Glass' },
            { value: 'wood', label: 'Wood' }
        ];
    } else {
        // Generic components: Furniture, Shapes, Widgets, etc.
        return [
            { value: 'wood', label: 'Wood' },
            { value: 'metal', label: 'Metal' },
            { value: 'plastic', label: 'Plastic' },
            { value: 'glass', label: 'Glass' },
            { value: 'stone', label: 'Stone' },
            { value: 'fabric', label: 'Fabric' }
        ];
    }
});

const onMaterialCategoryChange = () => {
    const categoryDefaults = {
        'wood': 'wood_golden_teak',
        'wpc': 'wpc',
        'pvc': 'pvc_matte',
        'upvc': 'upvc_white',
        'steel': 'steel_ms',
        'aluminium': 'alum_silver',
        'frp': 'frp',
        'glass': 'glass_clear',
        
        // Legacy fallback support for previously assigned categories
        'metal': 'metal_brushed_aluminum',
        'plastic': 'upvc_white',
        'stone': 'marble_calacatta_gold',
        'fabric': 'caban_neutral'
    };
    
    if (!props.selectedEntity.params) {
        props.selectedEntity.params = {};
    }
    
    const cat = props.selectedEntity.params.materialCategory;
    const defaultMat = categoryDefaults[cat] || 'wood_golden_teak';
    
    if (props.selectedEntity.type === 'door') {
        props.selectedEntity.doorMat = defaultMat;
        props.selectedEntity.params.doorMat = defaultMat;
    } else if (props.selectedEntity.type === 'window') {
        props.selectedEntity.frameMat = defaultMat;
        props.selectedEntity.params.frameMat = defaultMat;
    } else {
        props.selectedEntity.texture = defaultMat;
        props.selectedEntity.params.texture = defaultMat;
    }
    
    emit('sync-engine');
};
</script>
