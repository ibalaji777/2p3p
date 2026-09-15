<template>
    <div class="props-panel-inner corner-panel">
        <h4 class="props-subtitle">Wall Corner Properties</h4>

        <div v-if="cornerData && cornerData.isCorner">
            <div class="corner-info-badge">
                <span class="badge-label">Corner Angle</span>
                <span class="badge-value">{{ cornerData.angleDeg }}°</span>
            </div>

            <div class="control-group" style="flex-direction: column; align-items: flex-start; margin-top: 12px;">
                <label style="margin-bottom: 8px;">Corner Style</label>
                <div class="corner-style-toggle">
                    <button 
                        class="style-btn" 
                        :class="{ active: !cornerData.isFilleted }" 
                        @click="onMakeSharp"
                        title="Standard sharp corner joint"
                    >
                        <span class="btn-icon">◰</span>
                        <span>Sharp Corner</span>
                    </button>
                    <button 
                        class="style-btn" 
                        :class="{ active: cornerData.isFilleted }" 
                        @click="onMakeCurved"
                        title="Modern curved corner joint (Fillet)"
                    >
                        <span class="btn-icon">╭</span>
                        <span>Curved (Modern)</span>
                    </button>
                </div>
            </div>

            <!-- Radius Controls (Shown when curved or when previewing) -->
            <div v-if="cornerData.isFilleted || showCurveSettings" class="curve-settings-section">
                <div class="control-group">
                    <label>Fillet Radius</label>
                    <div class="input-wrap">
                        <input 
                            type="range" 
                            :value="currentRadius" 
                            min="20" 
                            :max="maxRadius" 
                            step="5" 
                            @input="onRadiusInput(Number($event.target.value))"
                        >
                        <DimensionInput 
                            :model-value="currentRadius" 
                            min="20" 
                            :max="maxRadius" 
                            step="5" 
                            @update:model-value="onRadiusInput(Number($event))" 
                        />
                    </div>
                </div>

                <!-- Quick Preset Chips -->
                <div class="control-group" style="margin-top: -4px;">
                    <label style="font-size: 11px; color: #64748b;">Radius Presets</label>
                    <div class="preset-chips-row">
                        <button 
                            v-for="r in presetOptions" 
                            :key="r" 
                            type="button" 
                            class="preset-chip-btn" 
                            :class="{ active: Math.round(currentRadius) === r }" 
                            @click="onRadiusInput(r)"
                        >
                            {{ r }} cm
                        </button>
                    </div>
                </div>

                <div v-if="!cornerData.isFilleted" style="margin-top: 10px;">
                    <button class="btn-primary full-width" @click="onApplyCurve">
                        ✓ Apply Curved Corner
                    </button>
                </div>

                <div v-else style="margin-top: 14px;">
                    <button class="hud-delete" style="width: 100%; border-radius: 6px; padding: 8px 12px;" @click="onMakeSharp">
                        Reset to Sharp Corner (90°)
                    </button>
                </div>
            </div>
        </div>

        <div v-else class="corner-unavailable">
            <p v-if="cornerData && cornerData.isCollinear">
                These walls are straight and collinear (180°). A curved corner requires a joint between intersecting walls.
            </p>
            <p v-else>
                This anchor is connected to {{ cornerData?.wallCount || 0 }} walls. Curved corners apply to joints between 2 walls.
            </p>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';
import { WallEngine } from '../../core/wall/WallEngine.js';
import { usePlannerStore } from '../../stores/usePlannerStore.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits(['sync-engine']);

const plannerStore = usePlannerStore();
const planner = computed(() => plannerStore.planner || props.selectedEntity?.planner || window.planner?.value);

const anchorNode = computed(() => {
    if (!props.selectedEntity) return null;
    if (props.selectedEntity.isCornerApex) return props.selectedEntity;
    if (props.selectedEntity.cornerApexAnchor) return props.selectedEntity.cornerApexAnchor;
    if (props.selectedEntity.isCornerFillet && props.selectedEntity.p1) {
        return (planner.value?.anchors || []).find(a => a.isCornerApex && a.filletData?.arc === props.selectedEntity) || props.selectedEntity.p1;
    }
    return props.selectedEntity;
});

const cornerData = computed(() => {
    if (!planner.value || !anchorNode.value) return null;
    return WallEngine.getCornerData(planner.value, anchorNode.value);
});

const maxRadius = computed(() => {
    return Math.max(50, cornerData.value?.maxRadius || 200);
});

const presetOptions = computed(() => {
    const max = maxRadius.value;
    return [40, 80, 120, 160].filter(r => r <= max);
});

const currentRadius = ref(80);
const showCurveSettings = ref(false);

watch(() => cornerData.value, (cd) => {
    if (cd && cd.isCorner) {
        if (cd.isFilleted && cd.radius) {
            currentRadius.value = Math.round(cd.radius);
            showCurveSettings.value = true;
        } else {
            currentRadius.value = cd.defaultRadius || 80;
        }
    }
}, { immediate: true });

const onMakeCurved = () => {
    if (!cornerData.value?.isFilleted) {
        onApplyCurve();
    }
};

const onApplyCurve = () => {
    if (!planner.value || !anchorNode.value) return;
    const r = currentRadius.value || 80;
    const result = WallEngine.filletCorner(planner.value, anchorNode.value, r);
    if (result && result.success) {
        showCurveSettings.value = true;
        emit('sync-engine');
    }
};

const onRadiusInput = (val) => {
    if (!val || isNaN(val)) return;
    const clamped = Math.max(20, Math.min(maxRadius.value, Number(val)));
    currentRadius.value = clamped;
    if (cornerData.value?.isFilleted) {
        WallEngine.setCornerFilletRadius(planner.value, anchorNode.value, clamped);
        emit('sync-engine');
    }
};

const onMakeSharp = () => {
    if (!planner.value || !anchorNode.value) return;
    WallEngine.unfilletCorner(planner.value, anchorNode.value);
    showCurveSettings.value = false;
    emit('sync-engine');
};
</script>

<style scoped>
.corner-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.corner-info-badge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #f1f5f9;
    padding: 8px 12px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
}

.badge-label {
    font-size: 12px;
    font-weight: 600;
    color: #475569;
}

.badge-value {
    font-size: 13px;
    font-weight: 700;
    color: #0284c7;
}

.corner-style-toggle {
    display: flex;
    gap: 8px;
    width: 100%;
}

.style-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 10px;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    background: white;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    transition: all 0.2s ease;
}

.style-btn:hover {
    background: #f8fafc;
    border-color: #94a3b8;
}

.style-btn.active {
    background: #0ea5e9;
    border-color: #0284c7;
    color: white;
    box-shadow: 0 1px 3px rgba(14, 165, 233, 0.3);
}

.btn-icon {
    font-size: 14px;
    font-weight: bold;
}

.preset-chips-row {
    display: flex;
    gap: 6px;
    width: 100%;
    flex-wrap: wrap;
}

.preset-chip-btn {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    cursor: pointer;
    color: #475569;
    transition: all 0.15s ease;
}

.preset-chip-btn:hover {
    background: #e2e8f0;
}

.preset-chip-btn.active {
    background: #0ea5e9;
    border-color: #0284c7;
    color: white;
}

.corner-unavailable {
    padding: 12px;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    color: #64748b;
    line-height: 1.4;
}
</style>
