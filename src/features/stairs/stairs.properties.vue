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
            <div class="control-group"><label>Total Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="15" max="600" @input="onHeightChange"><DimensionInput v-model="selectedEntity.height" @change="onHeightChange" /></div></div>
            
            <div style="display: flex; gap: 6px; margin-bottom: 10px;">
                <button 
                    type="button" 
                    @click="autoFitHeight" 
                    style="flex: 1; padding: 6px 10px; background: #ecfdf5; border: 1.5px solid #10b981; color: #059669; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 5px;"
                >
                    ⚡ Auto-Fit Floor Height
                </button>
            </div>

            <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="40" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Step Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stepDepth" min="15" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stepDepth" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Step Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stepHeight" min="10" max="30" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stepHeight" @change="$emit('sync-engine')" /></div></div>
            
            <div class="control-group" v-if="selectedEntity.shape === 'straight'">
                <label>Total Steps</label><div class="input-wrap"><input type="number" v-model.number="selectedEntity.totalSteps" min="2" max="50" @input="$emit('sync-engine')"></div>
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
                <div class="control-group"><label>Landing Size</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.landingSize" min="50" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.landingSize" @change="$emit('sync-engine')" /></div></div>
            </template>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

            <!-- End Landings -->
            <h4 class="props-subtitle">End Landings</h4>
            <div class="control-group"><label>Bottom Landing</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hasBottomLanding" @change="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Top Landing</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hasTopLanding" @change="$emit('sync-engine')"></div></div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

            <!-- Structural Controls -->
            <h4 class="props-subtitle">Structural Controls</h4>
            <div class="control-group">
                <label>Stringer Type</label>
                <select v-model="selectedEntity.stringerType" @change="$emit('sync-engine')" class="settings-select">
                    <option value="solid">Solid Block</option>
                    <option value="mono">Mono Stringer</option>
                    <option value="double">Double Stringer</option>
                    <option value="side">Side Stringer</option>
                    <option value="box">Box Stringer</option>
                </select>
            </div>
            <template v-if="selectedEntity.stringerType !== 'solid'">
                <div class="control-group"><label>Stringer Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stringerWidth" min="2" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stringerWidth" @change="$emit('sync-engine')" /></div></div>
                <div class="control-group"><label>Stringer Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stringerThickness" min="5" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stringerThickness" @change="$emit('sync-engine')" /></div></div>
                <div class="control-group" v-if="selectedEntity.stringerType === 'double'"><label>Beam Offset</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.beamOffset" min="0" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.beamOffset" @change="$emit('sync-engine')" /></div></div>
                <div class="control-group"><label>Landing Supports</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.landingSupports" @change="$emit('sync-engine')"></div></div>
            </template>

            <!-- Railings -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
            <h4 class="props-subtitle">Railing Settings</h4>
            
            <div class="control-group">
                <label>Railing Layout</label>
                <select v-model="selectedEntity.railingLayout" @change="$emit('sync-engine')" class="settings-select">
                    <option value="none">None</option>
                    <option value="left">Left Side</option>
                    <option value="right">Right Side</option>
                    <option value="both">Both Sides</option>
                </select>
            </div>

            <div class="control-group" v-if="selectedEntity.railingLayout === 'both'">
                <label>Link Left & Right Railings</label>
                <div class="input-wrap" style="justify-content: flex-end;">
                    <input type="checkbox" v-model="selectedEntity.linkRailings" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing = JSON.parse(JSON.stringify(selectedEntity.leftRailing)); } $emit('sync-engine')">
                </div>
            </div>

            <template v-if="selectedEntity.railingLayout !== 'none'">
                <div v-for="side in (selectedEntity.railingLayout === 'both' ? (selectedEntity.linkRailings ? ['left'] : ['left', 'right']) : [selectedEntity.railingLayout])" :key="side" style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">
                        {{ selectedEntity.linkRailings && selectedEntity.railingLayout === 'both' ? 'Shared Railing Properties' : (side === 'left' ? 'Left Railing' : 'Right Railing') }}
                    </h5>
                    
                    <div class="control-group">
                        <label>Style</label>
                        <select v-model="selectedEntity[side + 'Railing'].configId" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.configId = selectedEntity.leftRailing.configId; } $emit('sync-engine')" class="settings-select">
                            <option v-for="(config, id) in RAILING_REGISTRY" :key="id" :value="id">
                                {{ config.name }}
                            </option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label>Height</label>
                        <div class="input-wrap">
                            <DimensionInput v-model="selectedEntity[side + 'Railing'].height" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.height = selectedEntity.leftRailing.height; } $emit('sync-engine')" />
                        </div>
                    </div>

                    <div class="control-group">
                        <label>Offset from Edge</label>
                        <div class="input-wrap">
                            <DimensionInput v-model="selectedEntity[side + 'Railing'].offset" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.offset = selectedEntity.leftRailing.offset; } $emit('sync-engine')" />
                        </div>
                    </div>
                    
                    <!-- Custom overrides removed. The chosen Style dictates materials and shapes perfectly. -->
                    
                    <!-- Posts Toggles -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].hasNewelPosts" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.hasNewelPosts = selectedEntity.leftRailing.hasNewelPosts; } $emit('sync-engine')"> Newel Posts</label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].hasCornerPosts" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.hasCornerPosts = selectedEntity.leftRailing.hasCornerPosts; } $emit('sync-engine')"> Corner Posts</label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].hasEndCaps" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.hasEndCaps = selectedEntity.leftRailing.hasEndCaps; } $emit('sync-engine')"> End Caps</label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].wallMountedHandrail" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.wallMountedHandrail = selectedEntity.leftRailing.wallMountedHandrail; } $emit('sync-engine')"> Wall Handrail</label>
                    </div>
                </div>
            </template>
        </template>
        <template v-else>
            <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="20" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Length</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.length" min="20" max="1000" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.length" @change="$emit('sync-engine')" /></div></div>
        </template>

        <button class="hud-delete" style="margin-top: 15px;" @click="$emit('delete-entity')">Delete Staircase</button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import MaterialSlotsPanel from '../../components/common/MaterialSlotsPanel.vue';
import { RAILING_REGISTRY } from '../railing/registry/railing.registry.js';
import DimensionInput from '../../components/common/DimensionInput.vue';
import { StairHeightDetector } from './StairHeightDetector.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);

const onHeightChange = () => {
    if (!props.selectedEntity) return;
    const h = Number(props.selectedEntity.height) || 300;
    const optimal = StairHeightDetector.calculateOptimalSteps(h, props.selectedEntity.shape);
    props.selectedEntity.totalSteps = optimal.totalSteps;
    props.selectedEntity.flight1Steps = optimal.flight1Steps;
    props.selectedEntity.flight2Steps = optimal.flight2Steps;
    props.selectedEntity.stepHeight = optimal.stepHeight;
    emit('sync-engine');
};

const setShape = (newShape) => {
    if (!props.selectedEntity || props.selectedEntity.shape === newShape) return;
    if (typeof props.selectedEntity.setShape === 'function') {
        props.selectedEntity.setShape(newShape);
    } else {
        props.selectedEntity.shape = newShape;
        props.selectedEntity.type = `stair_v5_${newShape}`;
        if (newShape === 'straight') {
            props.selectedEntity.totalSteps = (props.selectedEntity.flight1Steps || 8) + (props.selectedEntity.flight2Steps || 7);
            props.selectedEntity.flight1Steps = props.selectedEntity.totalSteps;
            props.selectedEntity.flight2Steps = 0;
        } else {
            const total = props.selectedEntity.totalSteps || ((props.selectedEntity.flight1Steps || 8) + (props.selectedEntity.flight2Steps || 7)) || 15;
            props.selectedEntity.flight1Steps = Math.max(2, Math.ceil(total / 2));
            props.selectedEntity.flight2Steps = Math.max(2, total - props.selectedEntity.flight1Steps);
            props.selectedEntity.totalSteps = props.selectedEntity.flight1Steps + props.selectedEntity.flight2Steps;
            if (!props.selectedEntity.turnDirection) props.selectedEntity.turnDirection = 'right';
            if (!props.selectedEntity.landingSize) props.selectedEntity.landingSize = props.selectedEntity.width || 100;
        }
    }
    emit('sync-engine');
};

const flipTurnDirection = () => {
    if (!props.selectedEntity) return;
    if (typeof props.selectedEntity.flipTurnDirection === 'function') {
        props.selectedEntity.flipTurnDirection();
    } else {
        props.selectedEntity.turnDirection = props.selectedEntity.turnDirection === 'right' ? 'left' : 'right';
    }
    emit('sync-engine');
};

const autoFitHeight = () => {
    if (!props.selectedEntity) return;
    const planner = window.planner?.value || window.planner || props.selectedEntity.planner;
    if (!planner) return;
    const detection = StairHeightDetector.detect({
        x: props.selectedEntity.x || 0,
        z: props.selectedEntity.y || 0,
        elevation: props.selectedEntity.elevation || 0,
        rotation: props.selectedEntity.rotation || 0,
        preset: props.selectedEntity,
        planner,
        isCenterAnchored: false
    });
    if (detection.hasTarget) {
        props.selectedEntity.height = detection.detectedHeight;
        props.selectedEntity.totalSteps = detection.optimalSteps;
        props.selectedEntity.flight1Steps = detection.flight1Steps;
        props.selectedEntity.flight2Steps = detection.flight2Steps;
        props.selectedEntity.stepHeight = detection.stepHeight;
        if (typeof props.selectedEntity.update === 'function') props.selectedEntity.update();
        emit('sync-engine');
    }
};

const onFlight1StepsSlider = (val) => {
    if (!props.selectedEntity) return;
    const total = (Number(props.selectedEntity.flight1Steps) || 8) + (Number(props.selectedEntity.flight2Steps) || 7);
    const newF1 = Math.max(2, Math.min(total - 2, Number(val)));
    props.selectedEntity.flight1Steps = newF1;
    props.selectedEntity.flight2Steps = total - newF1;
    if (typeof props.selectedEntity.update === 'function') props.selectedEntity.update();
    emit('sync-engine');
};
</script>
