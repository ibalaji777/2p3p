<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle" v-if="selectedEntity.type && selectedEntity.type.startsWith('stair_v5_')">Staircase (V5) Properties</h4>
        <h4 class="props-subtitle" v-else>Staircase (Legacy) Properties</h4>
        
        <template v-if="selectedEntity.type && selectedEntity.type.startsWith('stair_v5_')">
            <MaterialSlotsPanel :entity="selectedEntity" @sync-engine="$emit('sync-engine')" />

            <!-- Sims 4 Style Shape Morpher -->
            <div style="margin-bottom: 12px;">
                <label style="display: block; font-size: 11px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase;">Staircase Shape</label>
                <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px;">
                    <button 
                        type="button" 
                        @click="setShape('straight')" 
                        :style="{
                            padding: '6px 2px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: (selectedEntity.shape === 'straight') ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                            background: (selectedEntity.shape === 'straight') ? '#e0f2fe' : '#ffffff',
                            color: (selectedEntity.shape === 'straight') ? '#0369a1' : '#64748b'
                        }"
                    >
                        ─ Straight
                    </button>
                    <button 
                        type="button" 
                        @click="setShape('L')" 
                        :style="{
                            padding: '6px 2px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: (selectedEntity.shape === 'L') ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                            background: (selectedEntity.shape === 'L') ? '#e0f2fe' : '#ffffff',
                            color: (selectedEntity.shape === 'L') ? '#0369a1' : '#64748b'
                        }"
                    >
                        ⌐ L-Turn
                    </button>
                    <button 
                        type="button" 
                        @click="setShape('U')" 
                        :style="{
                            padding: '6px 2px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: (selectedEntity.shape === 'U') ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                            background: (selectedEntity.shape === 'U') ? '#e0f2fe' : '#ffffff',
                            color: (selectedEntity.shape === 'U') ? '#0369a1' : '#64748b'
                        }"
                    >
                        ⊂ U-Turn
                    </button>
                    <button 
                        type="button" 
                        @click="setShape('T')" 
                        :style="{
                            padding: '6px 2px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            border: (selectedEntity.shape === 'T') ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                            background: (selectedEntity.shape === 'T') ? '#e0f2fe' : '#ffffff',
                            color: (selectedEntity.shape === 'T') ? '#0369a1' : '#64748b'
                        }"
                    >
                        ┳ T-Split
                    </button>
                </div>
            </div>

            <!-- Standard Geometry -->
            <div class="control-group">
                <label>Total Height</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.height" min="15" max="600" @input="e => onHeightInput(e.target.value)">
                    <DimensionInput :model-value="selectedEntity.height" @update:model-value="onHeightInput" />
                </div>
            </div>
            
            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                <button 
                    type="button" 
                    @click="autoFitHeight" 
                    style="flex: 1; padding: 6px 10px; background: #ecfdf5; border: 1.5px solid #10b981; color: #059669; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;"
                >
                    ⚡ Auto-Fit Floor Height
                </button>
            </div>

            <div class="control-group">
                <label>Width</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.width" min="40" max="300" @input="e => updateProp('width', Number(e.target.value))">
                    <DimensionInput :model-value="selectedEntity.width" @update:model-value="v => updateProp('width', Number(v))" />
                </div>
            </div>
            <div class="control-group">
                <label>Step Depth</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.stepDepth" min="15" max="50" @input="e => updateProp('stepDepth', Number(e.target.value))">
                    <DimensionInput :model-value="selectedEntity.stepDepth" @update:model-value="v => updateProp('stepDepth', Number(v))" />
                </div>
            </div>
            <div class="control-group">
                <label>Step Height</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.stepHeight" min="10" max="30" @input="e => updateProp('stepHeight', Number(e.target.value))">
                    <DimensionInput :model-value="selectedEntity.stepHeight" @update:model-value="v => updateProp('stepHeight', Number(v))" />
                </div>
            </div>
            
            <div class="control-group" v-if="selectedEntity.shape === 'straight'">
                <label>Total Steps</label>
                <div class="input-wrap">
                    <input type="number" :value="selectedEntity.totalSteps" min="2" max="50" @input="e => updateProp('totalSteps', Number(e.target.value))">
                </div>
            </div>
            <template v-else>
                <div class="control-group">
                    <label>Landing Split</label>
                    <div class="input-wrap">
                        <input 
                            type="range" 
                            :min="2" 
                            :max="Math.max(3, ((Number(selectedEntity.flight1Steps) || 8) + (Number(selectedEntity.flight2Steps) || 7)) - 2)" 
                            :value="selectedEntity.flight1Steps" 
                            @input="e => onFlight1StepsSlider(e.target.value)"
                        >
                        <span style="font-size: 11px; font-weight: 700; color: #64748b; white-space: nowrap;">
                            F1: {{ selectedEntity.flight1Steps }} | F2: {{ selectedEntity.flight2Steps }}
                        </span>
                    </div>
                </div>
                <div class="control-group" v-if="selectedEntity.shape !== 'T'">
                    <label>Turn Direction</label>
                    <div style="display: flex; gap: 6px; align-items: center;">
                        <button 
                            type="button"
                            @click="flipTurnDirection"
                            style="padding: 4px 10px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 11px; font-weight: 700; color: #334155; cursor: pointer;"
                        >
                            ⇄ Flip ({{ selectedEntity.turnDirection === 'right' ? 'Right' : 'Left' }})
                        </button>
                    </div>
                </div>
                <div class="control-group">
                    <label>Landing Size</label>
                    <div class="input-wrap">
                        <input type="range" :value="selectedEntity.landingSize" min="50" max="300" @input="e => updateProp('landingSize', Number(e.target.value))">
                        <DimensionInput :model-value="selectedEntity.landingSize" @update:model-value="v => updateProp('landingSize', Number(v))" />
                    </div>
                </div>
            </template>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

            <!-- End Landings -->
            <h4 class="props-subtitle">End Landings</h4>
            <div class="control-group">
                <label>Bottom Landing</label>
                <div class="input-wrap" style="justify-content: flex-end;">
                    <input type="checkbox" :checked="selectedEntity.hasBottomLanding" @change="e => updateProp('hasBottomLanding', e.target.checked)">
                </div>
            </div>
            <div class="control-group">
                <label>Top Landing</label>
                <div class="input-wrap" style="justify-content: flex-end;">
                    <input type="checkbox" :checked="selectedEntity.hasTopLanding" @change="e => updateProp('hasTopLanding', e.target.checked)">
                </div>
            </div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

            <!-- Structural Controls -->
            <h4 class="props-subtitle">Structural Controls</h4>
            <div class="control-group">
                <label>Stringer Type</label>
                <select :value="selectedEntity.stringerType || 'solid'" @change="e => updateProp('stringerType', e.target.value)" class="settings-select">
                    <option value="solid">Solid Block</option>
                    <option value="mono">Mono Stringer</option>
                    <option value="double">Double Stringer</option>
                    <option value="side">Side Stringer</option>
                    <option value="box">Box Stringer</option>
                </select>
            </div>
            <template v-if="selectedEntity.stringerType !== 'solid'">
                <div class="control-group">
                    <label>Stringer Width</label>
                    <div class="input-wrap">
                        <input type="range" :value="selectedEntity.stringerWidth" min="2" max="50" @input="e => updateProp('stringerWidth', Number(e.target.value))">
                        <DimensionInput :model-value="selectedEntity.stringerWidth" @update:model-value="v => updateProp('stringerWidth', Number(v))" />
                    </div>
                </div>
                <div class="control-group">
                    <label>Stringer Thickness</label>
                    <div class="input-wrap">
                        <input type="range" :value="selectedEntity.stringerThickness" min="5" max="100" @input="e => updateProp('stringerThickness', Number(e.target.value))">
                        <DimensionInput :model-value="selectedEntity.stringerThickness" @update:model-value="v => updateProp('stringerThickness', Number(v))" />
                    </div>
                </div>
                <div class="control-group" v-if="selectedEntity.stringerType === 'double'">
                    <label>Beam Offset</label>
                    <div class="input-wrap">
                        <input type="range" :value="selectedEntity.beamOffset" min="0" max="100" @input="e => updateProp('beamOffset', Number(e.target.value))">
                        <DimensionInput :model-value="selectedEntity.beamOffset" @update:model-value="v => updateProp('beamOffset', Number(v))" />
                    </div>
                </div>
                <div class="control-group">
                    <label>Landing Supports</label>
                    <div class="input-wrap" style="justify-content: flex-end;">
                        <input type="checkbox" :checked="selectedEntity.landingSupports" @change="e => updateProp('landingSupports', e.target.checked)">
                    </div>
                </div>
            </template>

            <!-- Railings -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
            <h4 class="props-subtitle">Railing Settings</h4>
            
            <div class="control-group">
                <label>Railing Layout</label>
                <select :value="selectedEntity.railingLayout || 'both'" @change="e => updateProp('railingLayout', e.target.value)" class="settings-select">
                    <option value="none">None</option>
                    <option value="left">Left Side</option>
                    <option value="right">Right Side</option>
                    <option value="both">Both Sides</option>
                </select>
            </div>

            <div class="control-group" v-if="selectedEntity.railingLayout === 'both'">
                <label>Link Left & Right Railings</label>
                <div class="input-wrap" style="justify-content: flex-end;">
                    <input type="checkbox" :checked="selectedEntity.linkRailings !== false" @change="e => updateProp('linkRailings', e.target.checked)">
                </div>
            </div>

            <template v-if="selectedEntity.railingLayout !== 'none'">
                <div v-for="side in (selectedEntity.railingLayout === 'both' ? (selectedEntity.linkRailings !== false ? ['left'] : ['left', 'right']) : [selectedEntity.railingLayout])" :key="side" style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">
                        {{ selectedEntity.linkRailings !== false && selectedEntity.railingLayout === 'both' ? 'Shared Railing Properties' : (side === 'left' ? 'Left Railing' : 'Right Railing') }}
                    </h5>
                    
                    <div class="control-group">
                        <label>Style</label>
                        <select :value="selectedEntity[side + 'Railing']?.configId || 'stair_baluster_default'" @change="e => updateNestedProp(side + 'Railing', 'configId', e.target.value)" class="settings-select">
                            <option v-for="(config, id) in RAILING_REGISTRY" :key="id" :value="id">
                                {{ config.name }}
                            </option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label>Height</label>
                        <div class="input-wrap">
                            <DimensionInput :model-value="selectedEntity[side + 'Railing']?.height || 60" @update:model-value="v => updateNestedProp(side + 'Railing', 'height', v)" />
                        </div>
                    </div>

                    <div class="control-group">
                        <label>Offset from Edge</label>
                        <div class="input-wrap">
                            <DimensionInput :model-value="selectedEntity[side + 'Railing']?.offset || 5" @update:model-value="v => updateNestedProp(side + 'Railing', 'offset', v)" />
                        </div>
                    </div>
                    
                    <!-- Posts Toggles -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                            <input type="checkbox" :checked="selectedEntity[side + 'Railing']?.hasNewelPosts !== false" @change="e => updateNestedProp(side + 'Railing', 'hasNewelPosts', e.target.checked)"> Newel Posts
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                            <input type="checkbox" :checked="selectedEntity[side + 'Railing']?.hasCornerPosts !== false" @change="e => updateNestedProp(side + 'Railing', 'hasCornerPosts', e.target.checked)"> Corner Posts
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                            <input type="checkbox" :checked="selectedEntity[side + 'Railing']?.hasEndCaps !== false" @change="e => updateNestedProp(side + 'Railing', 'hasEndCaps', e.target.checked)"> End Caps
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;">
                            <input type="checkbox" :checked="Boolean(selectedEntity[side + 'Railing']?.wallMountedHandrail)" @change="e => updateNestedProp(side + 'Railing', 'wallMountedHandrail', e.target.checked)"> Wall Handrail
                        </label>
                    </div>
                </div>
            </template>
        </template>
        <template v-else>
            <div class="control-group">
                <label>Width</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.width" min="20" max="300" @input="e => updateProp('width', Number(e.target.value))">
                    <DimensionInput :model-value="selectedEntity.width" @update:model-value="v => updateProp('width', Number(v))" />
                </div>
            </div>
            <div class="control-group">
                <label>Length</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.length" min="20" max="1000" @input="e => updateProp('length', Number(e.target.value))">
                    <DimensionInput :model-value="selectedEntity.length" @update:model-value="v => updateProp('length', Number(v))" />
                </div>
            </div>
        </template>

        <button class="hud-delete" style="margin-top: 15px;" @click="$emit('delete-entity')">Delete Staircase</button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import MaterialSlotsPanel from '../../components/common/MaterialSlotsPanel.vue';
import { RAILING_REGISTRY } from '../railing/registry/railing.registry.js';
import DimensionInput from '../../components/common/DimensionInput.vue';
import { StairEngine } from '../../core/stairs/StairEngine.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);

const getPlanner = () => {
    return window.planner?.value || window.planner || props.selectedEntity?.planner;
};

const updateProp = (key, val) => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    StairEngine.batchUpdate(planner, props.selectedEntity, { [key]: val });
    emit('sync-engine');
};

const updateNestedProp = (parentKey, propKey, val) => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    StairEngine.batchUpdate(planner, props.selectedEntity, { [`${parentKey}.${propKey}`]: val });
    emit('sync-engine');
};

const onHeightInput = (val) => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    StairEngine.setHeight(planner, props.selectedEntity, Number(val));
    emit('sync-engine');
};

const onHeightChange = () => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    StairEngine.setHeight(planner, props.selectedEntity, props.selectedEntity.height);
    emit('sync-engine');
};

const setShape = (newShape) => {
    if (!props.selectedEntity || props.selectedEntity.shape === newShape) return;
    const planner = getPlanner();
    StairEngine.setShape(planner, props.selectedEntity, newShape);
    emit('sync-engine');
};

const flipTurnDirection = () => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    StairEngine.flipTurnDirection(planner, props.selectedEntity);
    emit('sync-engine');
};

const autoFitHeight = () => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    if (!planner) return;
    const changed = StairEngine.autoFitHeight(planner, props.selectedEntity);
    if (changed) {
        emit('sync-engine');
    }
};

const onFlight1StepsSlider = (val) => {
    if (!props.selectedEntity) return;
    const planner = getPlanner();
    StairEngine.setFlightSteps(planner, props.selectedEntity, Number(val));
    emit('sync-engine');
};
</script>
