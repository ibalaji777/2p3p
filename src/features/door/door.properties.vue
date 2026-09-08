<template>
    <div class="door-properties">
        <div class="control-group">
            <label>Opening Angle (°)</label>
            <div class="input-wrap">
                <input 
                    type="range" 
                    :value="entity.openAngle || 0" 
                    @input="e => onAngleInput(e.target.value)" 
                    min="0" 
                    max="180" 
                />
                <input 
                    type="number" 
                    :value="entity.openAngle || 0" 
                    @input="e => onAngleInput(e.target.value)" 
                    min="0" 
                    max="180" 
                />
            </div>
        </div>

        <div class="control-group" v-if="!['pocket', 'folding', 'sliding', 'double_sliding'].includes(entity.doorType)">
            <label>Add Sidelights</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input 
                    type="checkbox" 
                    :checked="entity.hasSidelights" 
                    @change="onSidelightsChange" 
                />
            </div>
        </div>

        <div class="control-group">
            <label>Door Shape</label>
            <select :value="entity.doorShape || 'square'" @change="onShapeChange">
                <option value="square">Square (Default)</option>
                <option value="radius">Radius (True Arch)</option>
                <option value="segment">Segment (Eyebrow)</option>
            </select>
        </div>

        <div class="control-group">
            <label>Door Type</label>
            <select :value="entity.doorType || 'single'" @change="onTypeChange">
                <option value="single">Single Hinged</option>
                <option value="double">Double Hinged</option>
                <option value="french">Double French Glass</option>
                <template v-if="!entity.doorShape || entity.doorShape === 'square'">
                    <option value="sliding">Sliding (1 Panel)</option>
                    <option value="double_sliding">Sliding (2 Panels)</option>
                    <option value="pocket">Pocket Door</option>
                    <option value="folding">Bi-fold</option>
                </template>
            </select>
        </div>

        <MaterialSlotsPanel :entity="entity" @sync-engine="$emit('sync-engine')" />
    </div>
</template>

<script setup>
import MaterialSlotsPanel from '../../components/common/MaterialSlotsPanel.vue';

const props = defineProps({
    entity: {
        type: Object,
        required: true
    }
});

const emit = defineEmits(['sync-engine', 'sync-door-angle']);

function onAngleInput(val) {
    props.entity.openAngle = parseInt(val, 10) || 0;
    emit('sync-door-angle');
}

function onSidelightsChange(e) {
    props.entity.hasSidelights = e.target.checked;
    if (e.target.checked) {
        props.entity.width = Math.max(props.entity.width, props.entity.doorType === 'single' ? 100 : 140);
    }
    emit('sync-engine');
}

function onShapeChange(e) {
    props.entity.doorShape = e.target.value;
    if (e.target.value !== 'square' && ['sliding', 'double_sliding', 'pocket', 'folding'].includes(props.entity.doorType)) {
        props.entity.doorType = 'double';
    }
    emit('sync-engine');
}

function onTypeChange(e) {
    props.entity.doorType = e.target.value;
    emit('sync-engine');
}
</script>

<style scoped>
.door-properties {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.control-group label {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}
select, input[type="number"], input[type="range"] {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
}
select {
    width: 100%;
}
</style>
