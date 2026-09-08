<template>
    <div class="window-properties">
        <div class="control-group">
            <label>Window Style</label>
            <select :value="entity.windowType || 'sliding_std'" @change="onTypeChange">
                <option value="sliding_std">Sliding Window</option>
                <option value="casement_std">Casement Window</option>
                <option value="casement_chajja">Casement with Concrete Chajja</option>
                <option value="fixed_elevation">Fixed Elevation Glass</option>
                <option value="modern_split">Modern Asymmetric</option>
                <option value="bay_box">Bay Window (Villa Box)</option>
                <option value="window_seat">Double Picture Window</option>
                <option value="garden_open">Open Garden Window</option>
                <option value="panoramic_slider">Panoramic Slider</option>
                <option value="shutter_double">Double Louvered Shutter</option>
                <option value="louver_vent">Vent / Louver (Bathroom)</option>
                <option value="traditional_indian">Traditional Wooden Shutter</option>
            </select>
        </div>

        <div class="control-group">
            <label>Window Shape</label>
            <select :value="entity.windowShape || entity.doorShape || 'square'" @change="onShapeChange">
                <option value="square">Square / Rectangular (Default)</option>
                <option value="radius">Radius (Arch Top)</option>
                <option value="segment">Eyebrow Segment</option>
                <option value="gothic">Gothic Pointed</option>
            </select>
        </div>

        <MaterialSlotsPanel :entity="entity" @sync-engine="$emit('sync-engine')" />

        <div class="control-group">
            <label>Grill Pattern</label>
            <select :value="entity.grillePattern || 'grid'" @change="onGrillePatternChange">
                <option value="none">No Grill (Clean View)</option>
                <option value="grid">Standard Grid</option>
                <option value="diamond">Diamond Lattice</option>
                <option value="horizontal">Horizontal Security Bars</option>
                <option value="vertical">Vertical Security Bars</option>
            </select>
        </div>
        
        <div class="control-group" v-if="(entity.grillePattern || 'grid') !== 'none'">
            <label>Grill Profile</label>
            <select :value="entity.grilleProfile || 'flat'" @change="onGrilleProfileChange">
                <option value="flat">Flat / Box (Rectangular)</option>
                <option value="round">Round (Steel Rods)</option>
            </select>
        </div>
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

const emit = defineEmits(['sync-engine']);

function onTypeChange(e) {
    props.entity.windowType = e.target.value;
    emit('sync-engine');
}

function onShapeChange(e) {
    props.entity.windowShape = e.target.value;
    props.entity.doorShape = e.target.value;
    emit('sync-engine');
}

function onGrillePatternChange(e) {
    props.entity.grillePattern = e.target.value;
    emit('sync-engine');
}

function onGrilleProfileChange(e) {
    props.entity.grilleProfile = e.target.value;
    emit('sync-engine');
}
</script>

<style scoped>
.window-properties {
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
select {
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f8fafc;
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    width: 100%;
}
</style>
