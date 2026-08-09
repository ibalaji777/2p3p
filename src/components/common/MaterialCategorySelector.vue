<template>
    <div class="control-group">
        <label>Base Theme (Preset)</label>
        <select v-model="materialCategory" class="settings-select">
            <option v-for="opt in availableOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </select>
    </div>
</template>

<script setup>
import { computed } from 'vue';

import { WOOD_REGISTRY, METAL_REGISTRY, PLASTIC_REGISTRY, GLASS_REGISTRY } from '../../core/registries/material.registry.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits(['sync-engine']);

const materialCategory = computed({
    get: () => {
        if (props.selectedEntity?.params?.materialCategory) {
            return props.selectedEntity.params.materialCategory;
        }
        
        // Robust lookup using the central material registries
        const e = props.selectedEntity;
        const matId = e?.materials?.['leaf']?.id || e?.materials?.['frame']?.id || e?.doorMat || e?.frameMat;
        
        if (matId) {
            if (WOOD_REGISTRY[matId]) return WOOD_REGISTRY[matId].category || 'wood';
            if (METAL_REGISTRY[matId]) return METAL_REGISTRY[matId].group || 'steel';
            if (PLASTIC_REGISTRY[matId]) return PLASTIC_REGISTRY[matId].group || 'pvc';
            if (GLASS_REGISTRY[matId]) return 'glass';
            
            // Fallback for custom/legacy materials that aren't properly registered
            const m = matId.toLowerCase();
            if (m.includes('wood') || m.includes('oak') || m.includes('teak') || m.includes('walnut')) return 'wood';
            if (m.includes('upvc')) return 'upvc';
            if (m.includes('pvc')) return 'pvc';
            if (m.includes('alum')) return 'aluminium';
            if (m.includes('steel') || m.includes('metal')) return 'steel';
            if (m.includes('frp')) return 'frp';
            if (m.includes('wpc')) return 'wpc';
        }
        return 'wood';
    },
    set: (val) => {
        if (!props.selectedEntity.params) {
            props.selectedEntity.params = {};
        }
        props.selectedEntity.params.materialCategory = val;
        onMaterialCategoryChange();
    }
});

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
    
    const cat = props.selectedEntity?.params?.materialCategory;
    const defaultMat = categoryDefaults[cat] || 'wood_golden_teak';
    
    if (!props.selectedEntity.materials) {
        props.selectedEntity.materials = {};
    }

    if (props.selectedEntity.type === 'door') {
        props.selectedEntity.materials['leaf'] = { id: defaultMat };
        props.selectedEntity.materials['frame'] = { id: defaultMat };
    } else if (props.selectedEntity.type === 'window') {
        props.selectedEntity.materials['frame'] = { id: defaultMat };
        props.selectedEntity.materials['glass'] = { id: 'glass_clear' };
    } else {
        props.selectedEntity.materials['custom'] = { id: defaultMat };
    }
    
    emit('sync-engine');
};
</script>
