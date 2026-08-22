<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">{{ isSkirting ? 'Baseboard / Skirting Properties' : 'Molding / Cornice Properties' }}</h4>
        
        <div class="control-group"><label>Length</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="1000" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
        
        <div class="control-group">
            <label>Profile Height</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.moldingHeight" min="2" max="60" step="1" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.moldingHeight" min="2" max="60" step="1" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group"><label>Depth (Thickness)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="0.5" max="50" step="0.5" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.depth" min="0.5" max="50" step="0.5" @change="$emit('sync-engine')" /></div></div>
        
        <div class="control-group">
            <label>Elevation (from floor)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.heightOffset" min="0" max="500" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.heightOffset" @change="$emit('sync-engine')" />
            </div>
        </div>

        <!-- Quick Elevation Presets -->
        <div class="control-group" style="gap: 8px;">
            <button class="btn-secondary" style="flex: 1; padding: 5px 8px; font-size: 11px;" @click="selectedEntity.heightOffset = 0; $emit('sync-engine')">
                ⬇ Floor (0 cm)
            </button>
            <button class="btn-secondary" style="flex: 1; padding: 5px 8px; font-size: 11px;" @click="selectedEntity.heightOffset = (selectedEntity.wall?.height || 180) - (selectedEntity.moldingHeight || 10); $emit('sync-engine')">
                ⬆ Ceiling
            </button>
        </div>
        
        <div class="control-group">
            <label>Placement Side</label>
            <select v-model="selectedEntity.side" @change="selectedEntity.update ? selectedEntity.update() : null; $emit('sync-engine')">
                <option value="left">Left (Inner Face)</option>
                <option value="right">Right (Outer Face)</option>
            </select>
        </div>

        <div class="control-group">
            <label>Profile Type</label>
            <select v-model="selectedEntity.profileType" @change="$emit('sync-engine')">
                <optgroup label="Baseboards & Skirting">
                    <option value="skirting_flat">Flat Modern Baseboard</option>
                    <option value="skirting_beveled">Chamfered / Beveled Baseboard</option>
                    <option value="skirting_torus">Torus / Bullnose Skirting</option>
                    <option value="skirting_ogee">Classic Ogee Victorian</option>
                    <option value="skirting_craftsman">Stepped Craftsman Skirting</option>
                    <option value="skirting_shadow">Shadow Gap / Reglet Skirting</option>
                    <option value="skirting_scotia">Scotia Cove Baseboard</option>
                    <option value="skirting_shoe">Quarter Round Shoe Trim</option>
                </optgroup>
                <optgroup label="Crown & Cornice Moldings">
                    <option value="crown">Cove Crown</option>
                    <option value="ogee">Ogee (Cyma) Crown</option>
                    <option value="egg_and_dart">Egg and Dart Ornate</option>
                    <option value="dentil">Dentil Blocks</option>
                    <option value="craftsman">Step / Craftsman</option>
                    <option value="layered">Layered Steps</option>
                </optgroup>
                <optgroup label="Wall Bands & Trims">
                    <option value="flat">Flat Wall Band</option>
                    <option value="frame">Beveled Frame</option>
                    <option value="groove">Recessed Groove</option>
                </optgroup>
            </select>
        </div>

        <div v-if="selectedEntity.profileType === 'layered'">
            <div class="control-group"><label>Layers</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.layers" min="2" max="10" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.layers" @input="$emit('sync-engine')"></div></div>
        </div>

        <div class="control-group">
            <label>Material Preset</label>
            <select v-model="selectedEntity.material" @change="$emit('sync-engine')">
                <option value="white_paint">White Paint (Plaster)</option>
                <option value="wall_material">Wall Match</option>
                <option value="wood_dark">Dark Wood (Walnut)</option>
                <option value="wood_white_oak">White Oak</option>
                <option value="wood_golden_teak">Golden Teak</option>
                <option value="black_metal">Black Metal (Reglet)</option>
            </select>
        </div>

        <div class="control-group">
            <label>Color</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="color" v-model="selectedEntity.color" @input="$emit('sync-engine')">
            </div>
        </div>

        <MaterialCategorySelector :selected-entity="selectedEntity" @sync-engine="$emit('sync-engine')" />

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Component</button>
    </div>
</template>

<script setup>
import { computed } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';
import MaterialCategorySelector from '../common/MaterialCategorySelector.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const isSkirting = computed(() => {
    const t = props.selectedEntity?.type || '';
    const p = props.selectedEntity?.profileType || '';
    return t.includes('skirting') || p.includes('skirting') || props.selectedEntity?.heightOffset === 0;
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
