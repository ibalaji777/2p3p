<template>
    <div class="material-slots-panel">
        <!-- The preset macro acts as a theme selector -->
        <MaterialCategorySelector :selected-entity="entity" @sync-engine="$emit('sync-engine')" />
        
        <div class="slots-divider">
            <span class="divider-text">Detailed Components</span>
        </div>

        <!-- Dynamically generated material selectors for each active slot -->
        <div v-for="slot in activeSlots" :key="slot.id" class="control-group">
            <label>{{ slot.label }}</label>
            <select :value="getSlotMaterialId(slot.id)" @change="e => setSlotMaterial(slot.id, e.target.value)" class="settings-select">
                <option v-for="opt in slot.options" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
            </select>
        </div>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { MaterialSlots, SLOT_DEFINITIONS } from '../../core/constants/materialSlots.js';
import MaterialCategorySelector from './MaterialCategorySelector.vue';
import { MaterialManager } from '../../core/engine3d/MaterialManager.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';

const props = defineProps({
    entity: { type: Object, required: true }
});

const emit = defineEmits(['sync-engine']);

// Predefined dropdown options for different slot types
const STRUCTURAL_OPTIONS = [
    { id: 'wood_golden_teak', label: 'Golden Teak Wood' },
    { id: 'wood_dark_walnut', label: 'Dark Walnut Wood' },
    { id: 'wood_white_oak', label: 'White Oak Wood' },
    { id: 'wood_mahogany', label: 'Red Mahogany' },
    { id: 'upvc_white', label: 'White uPVC' },
    { id: 'pvc_matte', label: 'Matte White PVC' },
    { id: 'alum_silver', label: 'Silver Aluminium' },
    { id: 'alum_powder', label: 'Black Powder Aluminium' },
    { id: 'steel_ms', label: 'MS Steel' },
    { id: 'wpc', label: 'Wood Plastic Composite' }
];

const GLASS_OPTIONS = [
    { id: 'clear', label: 'Clear Tempered Glass' },
    { id: 'frosted', label: 'Frosted Satin Glass' },
    { id: 'tinted', label: 'Architectural Dark Glass' },
    { id: 'bronze', label: 'Bronze Glass' },
    { id: 'blue_solar', label: 'Blue Reflective Glass' }
];

const HARDWARE_OPTIONS = [
    { id: 'metal_gunmetal_black', label: 'Matte Black' },
    { id: 'metal_brushed_steel', label: 'Brushed Steel' },
    { id: 'metal_brushed_gold', label: 'Brass / Gold' },
    { id: 'metal_rose_bronze', label: 'Antique Bronze' }
];

const SEAL_OPTIONS = [
    { id: 'seal_black', label: 'Black EPDM Rubber' },
    { id: 'seal_grey', label: 'Grey Silicone' },
    { id: 'seal_white', label: 'White Silicone' }
];

const hasGlass = (entity) => {
    if (!entity) return false;
    if (entity.type === 'window') return true;
    if (entity.type === 'door') {
        const type = entity.doorType;
        const style = entity.doorShape || entity.doorStyle;
        const mat = entity.materials?.[MaterialSlots.LEAF]?.id;
        return ['sliding', 'double_sliding', 'french'].includes(type) || 
               style === 'glass_grid' || 
               style === 'glass_bottom_panel' ||
               mat === 'glass_clear' || mat === 'glass';
    }
    return false;
};

// Map slot IDs to their appropriate options
const getOptionsForSlot = (slotId) => {
    if (slotId === MaterialSlots.GLASS) return GLASS_OPTIONS;
    if (slotId === MaterialSlots.HARDWARE) return HARDWARE_OPTIONS;
    if (slotId === MaterialSlots.SEAL) return SEAL_OPTIONS;
    return STRUCTURAL_OPTIONS; // Frame, Leaf, Sashes, Trim, etc.
};

const activeSlots = computed(() => {
    if (!props.entity || !props.entity.type) return [];
    
    // Get the base list of slots for this entity type (e.g. door, window)
    const baseSlots = MaterialManager.assetManifests[props.entity.type] || [];
    
    let filtered = [...baseSlots];
    
    // TRULY DYNAMIC FILTERING (Vue Reactive):
    // Only show material slots that actually exist based on the object's specific configuration.
    
    // 1. Dynamic Glass check
    if (!hasGlass(props.entity)) {
        filtered = filtered.filter(s => s !== MaterialSlots.GLASS);
    }
    
    // 2. Dynamic Window Sashes
    if (props.entity.type === 'window') {
        const wt = props.entity.windowType || '';
        // If it's fixed or louver, it has no sashes at all (just frame and glass)
        if (wt === 'fixed' || wt === 'louver') {
            filtered = filtered.filter(s => s !== MaterialSlots.LEAF);
        }
    }
    
    // 3. Dynamic Door Trim (Only Arched/Gothic doors have physical trim drawn)
    if (props.entity.type === 'door') {
        const shape = props.entity.doorShape || 'square';
        if (shape === 'square') {
            filtered = filtered.filter(s => s !== MaterialSlots.TRIM);
        }
    }
    
    // 4. Remove non-paintable architectural elements dynamically
    filtered = filtered.filter(s => {
        const def = SLOT_DEFINITIONS[s];
        return !def || def.paintable !== false;
    });
    
    return filtered.map(slotId => ({
        id: slotId,
        label: SLOT_DEFINITIONS[slotId]?.label || slotId,
        options: getOptionsForSlot(slotId)
    }));
});

const getSlotMaterialId = (slotId) => {
    return props.entity.materials?.[slotId]?.id || '';
};

const setSlotMaterial = (slotId, matId) => {
    if (!props.entity.materials) {
        props.entity.materials = {};
    }
    props.entity.materials[slotId] = { id: matId };
    emit('sync-engine');
};
</script>

<style scoped>
.material-slots-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.slots-divider {
    display: flex;
    align-items: center;
    text-align: center;
    margin: 8px 0;
}

.slots-divider::before,
.slots-divider::after {
    content: '';
    flex: 1;
    border-bottom: 1px solid var(--border-color);
}

.slots-divider::before {
    margin-right: .5em;
}

.slots-divider::after {
    margin-left: .5em;
}

.divider-text {
    font-size: 11px;
    text-transform: uppercase;
    color: var(--text-muted);
    font-weight: 600;
    letter-spacing: 0.5px;
}
</style>
