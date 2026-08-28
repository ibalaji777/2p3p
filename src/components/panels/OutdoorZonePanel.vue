<template>
    <div class="props-panel-inner">
        <div class="zone-hero-banner" :class="selectedEntity.subType || 'pavement'">
            <div class="zone-type-badge">
                <span class="zone-badge-icon">{{ getZoneIcon(selectedEntity.subType) }}</span>
                <span class="zone-badge-text">{{ getZoneTitle(selectedEntity.subType) }}</span>
            </div>
            <div class="zone-area-chip">
                {{ areaFormatted }}
            </div>
        </div>

        <h4 class="props-subtitle">Zone Configuration</h4>

        <div class="control-group">
            <label>Zone Type</label>
            <div class="input-wrap">
                <select :value="selectedEntity.subType || 'pavement'" @change="handleTypeChange" class="settings-select">
                    <option value="pavement">Pavement (Driveway/Walkway)</option>
                    <option value="patio">Patio (Deck/Terrace)</option>
                    <option value="softscape">Softscape (Garden/Lawn)</option>
                    <option value="other_space">Other space (Custom Area)</option>
                </select>
            </div>
        </div>

        <div class="control-group">
            <label>Label Name</label>
            <div class="input-wrap">
                <input type="text" v-model="selectedEntity.name" @input="handleUpdate" class="settings-input" />
            </div>
        </div>

        <div class="control-group">
            <label>Slab Thickness (Height)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.height3D" min="0.1" max="20" step="0.1" @input="handleUpdate">
                <DimensionInput v-model="selectedEntity.height3D" @change="handleUpdate" />
            </div>
        </div>

        <div class="control-group">
            <label>Elevation Offset</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.elevation" min="-50" max="200" @input="handleUpdate">
                <DimensionInput v-model="selectedEntity.elevation" @change="handleUpdate" />
            </div>
        </div>

        <h4 class="props-subtitle">Surface Material</h4>
        <MaterialSizeInput 
            v-model="selectedEntity.materialScale" 
            :fallbackValue="200"
            @change="$emit('sync-engine', 'material')" 
            @update:modelValue="$emit('sync-engine', 'material')"
        />

        <div class="decor-gallery">
            <div class="decor-grid">
                <div 
                    v-for="(config, key) in availableMaterials" 
                    :key="key" 
                    class="decor-item" 
                    @click="setZoneMaterial(key)" 
                    :class="{ active: selectedEntity.configId === key }"
                >
                    <img :src="config.thumbnail" />
                    <span>{{ config.name }}</span>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Outdoor Zone</button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';
import MaterialSizeInput from '../common/MaterialSizeInput.vue';
import { FLOOR_REGISTRY, STONE_REGISTRY, WOOD_REGISTRY, GROUND_REGISTRY } from '../../core/registries/material.registry.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits(['sync-engine', 'delete-entity']);

const areaFormatted = computed(() => {
    if (props.selectedEntity && typeof props.selectedEntity.getFormattedArea === 'function') {
        return props.selectedEntity.getFormattedArea();
    }
    return '';
});

const availableMaterials = computed(() => {
    return {
        ...FLOOR_REGISTRY,
        ...STONE_REGISTRY,
        ...WOOD_REGISTRY,
        ...GROUND_REGISTRY
    };
});

const getZoneTitle = (subType) => {
    const titles = {
        driveway: 'Driveway Zone',
        walkway: 'Walkway Path',
        pavement: 'Pavement Zone',
        patio: 'Patio & Deck',
        softscape: 'Softscape & Garden',
        other_space: 'Outdoor Space'
    };
    return titles[subType] || 'Outdoor Zone';
};

const getZoneIcon = (subType) => {
    const icons = {
        driveway: '🚗',
        walkway: '🚶',
        pavement: '🛣️',
        patio: '⛱️',
        softscape: '🌸',
        other_space: '⬟'
    };
    return icons[subType] || '🌿';
};

const handleTypeChange = (e) => {
    const newType = e.target.value;
    if (props.selectedEntity && typeof props.selectedEntity.setSubType === 'function') {
        props.selectedEntity.setSubType(newType);
    } else {
        props.selectedEntity.subType = newType;
    }
    emit('sync-engine', 'geometry');
};

const handleUpdate = () => {
    if (props.selectedEntity && typeof props.selectedEntity.updateGeometry === 'function') {
        props.selectedEntity.updateGeometry();
    }
    emit('sync-engine', 'geometry');
};

const setZoneMaterial = (matKey) => {
    props.selectedEntity.configId = matKey;
    if (props.selectedEntity.params) {
        props.selectedEntity.params.material = matKey;
    }
    emit('sync-engine', 'material');
};
</script>

<style scoped>
.zone-hero-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    border-radius: 12px;
    margin-bottom: 14px;
    background: #1e293b;
    color: #ffffff;
}

.zone-hero-banner.pavement {
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    border-left: 4px solid #64748b;
}

.zone-hero-banner.patio {
    background: linear-gradient(135deg, #2d1d0f 0%, #78350f 100%);
    border-left: 4px solid #f59e0b;
}

.zone-hero-banner.softscape {
    background: linear-gradient(135deg, #062e1c 0%, #166534 100%);
    border-left: 4px solid #22c55e;
}

.zone-hero-banner.other_space {
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-left: 4px solid #06b6d4;
}

.zone-type-badge {
    display: flex;
    align-items: center;
    gap: 8px;
}

.zone-badge-icon {
    font-size: 18px;
}

.zone-badge-text {
    font-size: 13.5px;
    font-weight: 700;
}

.zone-area-chip {
    padding: 4px 10px;
    background: rgba(255, 255, 255, 0.15);
    backdrop-filter: blur(8px);
    border-radius: 20px;
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
}
</style>
