<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Elevation Fascia Properties</h4>
        
        <div class="control-group">
            <label>Profile Type</label>
            <select v-model="entity.profileType" @change="$emit('sync-engine')">
                <option value="tower_corner_wrap_left">Tower & Corner Wrap (Left)</option>
                <option value="tower_corner_wrap_right">Tower & Corner Wrap (Right)</option>
                <option value="corner_wrap_left">Corner Wrap (Left)</option>
                <option value="corner_wrap_right">Corner Wrap (Right)</option>
                <option value="c_wrap_terrace_frame">Continuous Terrace Frame</option>
                <option value="c_shape_left">C-Shape (Left)</option>
                <option value="c_shape_right">C-Shape (Right)</option>
                <option value="l_shape_left">L-Shape (Left)</option>
                <option value="l_shape_right">L-Shape (Right)</option>
                <option value="full_box">Full Box Wrap</option>
            </select>
        </div>

        <div class="control-group">
            <label>Width (Front Span)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.width" min="10" max="400" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.width" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group" v-if="entity.profileType?.includes('wrap')">
            <label>Side Return (Wrap Span)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.returnLength" min="10" max="400" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.returnLength" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group" v-if="entity.profileType?.includes('tower') || entity.profileType === 'c_wrap_terrace_frame'">
            <label>Tower Height (To Terrace)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.towerHeight" min="50" max="1000" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.towerHeight" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group" v-if="entity.profileType?.includes('tower') || entity.profileType === 'c_wrap_terrace_frame'">
            <label>Tower Width</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.towerWidth" min="20" max="200" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.towerWidth" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group" v-if="entity.profileType?.includes('wrap') || entity.profileType?.includes('tower')">
            <label>Soffit Spotlights</label>
            <div class="input-wrap" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="fascia-spotlights-check" v-model="entity.hasSpotlights" @change="$emit('sync-engine')" style="width: auto;">
                <label for="fascia-spotlights-check" style="cursor: pointer; font-size: 11px;">Enable Under-Soffit Downlights</label>
            </div>
        </div>

        <div class="control-group" v-if="entity.hasSpotlights && (entity.profileType?.includes('wrap') || entity.profileType?.includes('tower'))">
            <label>Front Spotlights Count</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.spotlightCount" min="1" max="10" @input="$emit('sync-engine')">
                <input type="number" v-model.number="entity.spotlightCount" min="1" max="10" @change="$emit('sync-engine')" style="width: 50px; text-align: center;">
            </div>
        </div>

        <div class="control-group">
            <label>Height (Beam Drop)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.height" min="10" max="400" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.height" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group" v-if="['c_shape_left', 'c_shape_right', 'l_shape_left', 'l_shape_right', 'c_wrap_terrace_frame'].includes(entity.profileType)">
            <label>Top Arm Length</label>
            <div class="input-wrap">
                <input type="range" :value="entity.topArm !== undefined ? entity.topArm : entity.width" @input="e => { entity.topArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                <DimensionInput :modelValue="entity.topArm !== undefined ? entity.topArm : entity.width" @update:modelValue="val => { entity.topArm = val; $emit('sync-engine'); }" />
            </div>
        </div>

        <div class="control-group" v-if="['c_shape_left', 'c_shape_right'].includes(entity.profileType)">
            <label>Bottom Arm Length</label>
            <div class="input-wrap">
                <input type="range" :value="entity.bottomArm !== undefined ? entity.bottomArm : entity.width" @input="e => { entity.bottomArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                <DimensionInput :modelValue="entity.bottomArm !== undefined ? entity.bottomArm : entity.width" @update:modelValue="val => { entity.bottomArm = val; $emit('sync-engine'); }" />
            </div>
        </div>

        <div class="control-group">
            <label>Depth (Overhang)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.depth" min="5" max="150" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.depth" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group">
            <label>Thickness</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.thick" min="2" max="50" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.thick" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group">
            <label>Elevation (Bottom)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="entity.elevation" min="0" max="300" @input="$emit('sync-engine')">
                <DimensionInput v-model="entity.elevation" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group">
            <label>Material Preset</label>
            <select v-model="entity.fasciaMat" @change="$emit('sync-engine')">
                <option value="white">White Paint</option>
                <option value="dark_grey">Dark Grey Composite</option>
                <option value="stone">Stone Cladding</option>
                <option value="wood">Wood Panel</option>
            </select>
        </div>

        <MaterialCategorySelector :selected-entity="entity" @sync-engine="$emit('sync-engine')" />

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Fascia</button>
    </div>
</template>

<script setup>
import DimensionInput from '../../components/common/DimensionInput.vue';
import MaterialCategorySelector from '../../components/common/MaterialCategorySelector.vue';

const props = defineProps({
    entity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
