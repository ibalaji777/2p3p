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

        <!-- Corridor / Path Width & Alignment Controls -->
        <template v-if="isCorridorPath">
            <h4 class="props-subtitle">Path Geometry & Centerline</h4>

            <div class="control-group">
                <label>Path Width</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.width || (selectedEntity.subType === 'walkway' ? 60 : 160)" min="20" max="600" step="5" @input="handleWidthInput">
                    <DimensionInput :modelValue="selectedEntity.width || (selectedEntity.subType === 'walkway' ? 60 : 160)" @update:modelValue="handleWidthChange" />
                </div>
            </div>

            <div class="width-presets-row">
                <button 
                    v-for="preset in widthPresets" 
                    :key="preset.val" 
                    class="preset-chip-btn" 
                    :class="{ active: Math.abs((selectedEntity.width || 0) - preset.val) < 2 }"
                    @click="applyWidthPreset(preset.val)"
                >
                    {{ preset.label }}
                </button>
            </div>

            <div class="path-actions-group" v-if="canStraighten">
                <button class="path-btn straighten-btn" @click="handleStraightenPath" title="Remove all corner bends and convert into a direct straight path">
                    <span class="btn-icon">⚡</span> Straighten Path (Direct Line)
                </button>
                <button class="path-btn reverse-btn" @click="handleReversePath" title="Reverse path start and end points">
                    <span class="btn-icon">🔄</span> Reverse Direction
                </button>
            </div>

            <div class="path-help-tip">
                <span class="tip-icon">💡</span>
                <span><b>Path Editing:</b> Drag blue node circles to reposition turns. <b>Double-click</b> any turn circle to remove that bend! Drag '+' circles to add new bends.</span>
            </div>
        </template>

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

const isCorridorPath = computed(() => {
    return Boolean(props.selectedEntity && (
        props.selectedEntity.subType === 'driveway' || 
        props.selectedEntity.subType === 'walkway' || 
        (props.selectedEntity.centerline && props.selectedEntity.centerline.length >= 2) ||
        props.selectedEntity.width
    ));
});

const canStraighten = computed(() => {
    return Boolean(props.selectedEntity && props.selectedEntity.centerline && props.selectedEntity.centerline.length > 2);
});

const widthPresets = computed(() => [
    { label: '3 ft (90 cm)', val: 60 },
    { label: '4 ft (120 cm)', val: 80 },
    { label: '6 ft (180 cm)', val: 120 },
    { label: '8 ft (240 cm)', val: 160 },
    { label: '10 ft (300 cm)', val: 200 },
    { label: '12 ft (360 cm)', val: 240 }
]);

const applyWidthPreset = (val) => {
    if (props.selectedEntity && typeof props.selectedEntity.setWidth === 'function') {
        props.selectedEntity.setWidth(val);
    } else {
        props.selectedEntity.width = val;
    }
    emit('sync-engine', 'geometry');
};

const handleWidthInput = (e) => {
    const val = Number(e.target.value);
    if (props.selectedEntity && typeof props.selectedEntity.setWidth === 'function') {
        props.selectedEntity.setWidth(val);
    } else {
        props.selectedEntity.width = val;
    }
    emit('sync-engine', 'geometry');
};

const handleWidthChange = (val) => {
    if (props.selectedEntity && typeof props.selectedEntity.setWidth === 'function') {
        props.selectedEntity.setWidth(Number(val));
    } else {
        props.selectedEntity.width = Number(val);
    }
    emit('sync-engine', 'geometry');
};

const handleStraightenPath = () => {
    if (props.selectedEntity && typeof props.selectedEntity.straightenPath === 'function') {
        props.selectedEntity.straightenPath();
    }
    emit('sync-engine', 'geometry');
};

const handleReversePath = () => {
    if (props.selectedEntity && typeof props.selectedEntity.reversePath === 'function') {
        props.selectedEntity.reversePath();
    }
    emit('sync-engine', 'geometry');
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

.width-presets-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
}

.preset-chip-btn {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    color: #334155;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.preset-chip-btn:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
}

.preset-chip-btn.active {
    background: #0284c7;
    border-color: #0284c7;
    color: #ffffff;
}

.path-actions-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 10px 0 14px 0;
}

.path-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s ease;
}

.straighten-btn {
    background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
    color: #ffffff;
    box-shadow: 0 2px 4px rgba(2, 132, 199, 0.25);
}

.straighten-btn:hover {
    background: linear-gradient(135deg, #0369a1 0%, #075985 100%);
}

.reverse-btn {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #475569;
}

.reverse-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
}

.path-help-tip {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 8px 10px;
    font-size: 11.5px;
    color: #166534;
    line-height: 1.4;
    margin-bottom: 14px;
}

.tip-icon {
    font-size: 14px;
    flex-shrink: 0;
}
</style>
