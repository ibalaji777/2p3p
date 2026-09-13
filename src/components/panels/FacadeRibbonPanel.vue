<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Continuous Facade Ribbon</h4>

        <!-- Width (Drop) -->
        <div class="control-group">
            <label>Width (Beam Drop)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.width" min="15" max="250" step="5" @input="updateRibbon">
                <DimensionInput v-model="selectedEntity.width" @change="updateRibbon" />
            </div>
        </div>

        <!-- Depth (Overhang) -->
        <div class="control-group">
            <label>Depth (Overhang)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.depth" min="10" max="200" step="5" @input="updateRibbon">
                <DimensionInput v-model="selectedEntity.depth" @change="updateRibbon" />
            </div>
        </div>

        <!-- Elevation Adjustment -->
        <div class="control-group">
            <label>Elevation Offset</label>
            <div class="input-wrap">
                <input type="range" :value="elevationOffset" min="-200" max="200" step="5" @input="onElevationSlider">
                <DimensionInput :modelValue="elevationOffset" @update:modelValue="onElevationInput" />
            </div>
        </div>

        <!-- Material Selection -->
        <div class="control-group">
            <label>Architectural Material</label>
            <select v-model="selectedEntity.material" @change="updateRibbon" class="settings-select">
                <option v-for="(mat, key) in FACADE_RIBBON_MATERIALS" :key="key" :value="key">
                    {{ mat.name }}
                </option>
            </select>
        </div>

        <!-- Under-Soffit Spotlights -->
        <div class="control-group">
            <label>Under-Soffit Lighting</label>
            <div class="input-wrap" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="ribbon-spotlights-check" v-model="selectedEntity.hasSpotlights" @change="updateRibbon" style="width: auto;">
                <label for="ribbon-spotlights-check" style="cursor: pointer; font-size: 11px;">Enable Recessed Puck Downlights</label>
            </div>
        </div>

        <div class="control-group" v-if="selectedEntity.hasSpotlights">
            <label>Downlight Spacing</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.spotlightSpacing" min="40" max="200" step="10" @input="updateRibbon">
                <DimensionInput v-model="selectedEntity.spotlightSpacing" @change="updateRibbon" />
            </div>
        </div>

        <!-- Node & Path Management -->
        <div class="control-group" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px;">
            <label style="font-weight: 700; color: #38bdf8;">Ribbon Nodes ({{ selectedEntity.points?.length || 0 }} Corners)</label>
            
            <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                <button type="button" class="btn-primary" @click="continueDrawing" style="display: flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 10px; font-size: 12px;">
                    <span>+ Continue Drawing (Add Points)</span>
                </button>

                <div style="display: flex; gap: 6px;">
                    <button type="button" class="btn-secondary" @click="reversePoints" style="flex: 1; padding: 6px; font-size: 11px;">
                        ⇄ Reverse Direction
                    </button>
                    <button type="button" class="btn-secondary" @click="deleteLastPoint" :disabled="(selectedEntity.points?.length || 0) <= 2" style="flex: 1; padding: 6px; font-size: 11px;">
                        ✕ Delete Last Point
                    </button>
                </div>
            </div>
        </div>

        <!-- Delete Action -->
        <button class="hud-delete" @click="$emit('delete-entity')" style="margin-top: 16px;">
            Delete Facade Ribbon
        </button>
    </div>
</template>

<script setup>
import { ref } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';
import { FACADE_RIBBON_MATERIALS } from '../../features/facade/facadeRibbon.registry.js';
import { renderFacadeRibbon3D } from '../../features/facade/facadeRibbon.renderer3d.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);

const elevationOffset = ref(0);

const getPlanner = () => {
    return typeof window !== 'undefined' ? (window.plannerInstance || window.planner?.value || window.planner) : null;
};

const updateRibbon = () => {
    emit('sync-engine');
    const planner = getPlanner();
    const ctx = window.renderer3D?.value?.ctx || window.app3dContext;
    if (ctx && ctx.structureGroup && props.selectedEntity) {
        if (props.selectedEntity.mesh3D && props.selectedEntity.mesh3D.parent) {
            props.selectedEntity.mesh3D.parent.remove(props.selectedEntity.mesh3D);
        }
        renderFacadeRibbon3D(ctx.structureGroup, props.selectedEntity, ctx.helpers);
        if (ctx.requestRender) ctx.requestRender('ribbon_updated', 2);
    }
};

const onElevationSlider = (e) => {
    const newOffset = parseFloat(e.target.value) || 0;
    applyElevationDelta(newOffset - elevationOffset.value);
    elevationOffset.value = newOffset;
};

const onElevationInput = (val) => {
    const newOffset = parseFloat(val) || 0;
    applyElevationDelta(newOffset - elevationOffset.value);
    elevationOffset.value = newOffset;
};

const applyElevationDelta = (delta) => {
    if (!props.selectedEntity.points || delta === 0) return;
    props.selectedEntity.points.forEach(p => {
        p.y = Math.round(p.y + delta);
    });
    updateRibbon();
};

const continueDrawing = () => {
    const planner = getPlanner();
    if (!planner) return;
    planner.tool = 'facade_ribbon_draw';
    if (planner.onToolChange) planner.onToolChange('facade_ribbon_draw');

    const ctx = window.renderer3D?.value?.ctx || window.app3dContext;
    const interactions = ctx?.interactions || window.interactionSystem;
    if (interactions && interactions.ribbon3DDrawSystem) {
        interactions.ribbon3DDrawSystem.startDrawingFromRibbon(props.selectedEntity, 'end');
    }
};

const reversePoints = () => {
    if (!props.selectedEntity.points || props.selectedEntity.points.length < 2) return;
    props.selectedEntity.points.reverse();
    updateRibbon();
};

const deleteLastPoint = () => {
    if (!props.selectedEntity.points || props.selectedEntity.points.length <= 2) return;
    props.selectedEntity.points.pop();
    updateRibbon();
};
</script>
