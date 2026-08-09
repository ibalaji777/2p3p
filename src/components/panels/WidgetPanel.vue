<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">{{ selectedEntity.config?.label || 'DOOR/WINDOW' }} Properties</h4>
        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="400" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'elevation_fascia'"><label>Height (Drop)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="400" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.height" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'window' || selectedEntity.type === 'door'"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="400" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.height" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'window'"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="400" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.elevation" @change="$emit('sync-engine')" /></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'door'"><label>Opening Angle (°)</label><div class="input-wrap"><input type="range" :value="selectedEntity.openAngle || 0" @input="e => { selectedEntity.openAngle = parseInt(e.target.value) || 0; $emit('sync-door-angle'); }" min="0" max="180"><input type="number" :value="selectedEntity.openAngle || 0" @input="e => { selectedEntity.openAngle = parseInt(e.target.value) || 0; $emit('sync-door-angle'); }" min="0" max="180"></div></div>
        <div class="faceRow" v-if="selectedEntity.type !== 'jali_panel' && selectedEntity.type !== 'elevation_fascia' && selectedEntity.type !== 'sunshade'">
            <button class="flip-btn" @click="selectedEntity.facing *= -1; $emit('sync-engine')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 20V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16"/><path d="M2 20h20"/><path d="M14 12v.01"/></svg>
                Flip In/Out
            </button>
            <button class="flip-btn" @click="selectedEntity.side *= -1; $emit('sync-engine')">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M8 8l-4 4 4 4"/><path d="M16 16l4-4-4-4"/></svg>
                Flip L/R
            </button>
        </div>
        <div v-if="selectedEntity.type === 'door'">

            <div class="control-group" v-if="!['pocket', 'folding', 'sliding', 'double_sliding'].includes(selectedEntity.doorType)">
                <label>Add Sidelights</label>
                <div class="input-wrap" style="justify-content: flex-end;">
                    <input type="checkbox" :checked="selectedEntity.hasSidelights" @change="(e) => { selectedEntity.hasSidelights = e.target.checked; if (e.target.checked) { selectedEntity.width = Math.max(selectedEntity.width, selectedEntity.doorType === 'single' ? 100 : 140); } $emit('sync-engine'); }" />
                </div>
            </div>
            <div class="control-group">
                <label>Door Type</label>
                <select :value="selectedEntity.doorType || 'single'" @change="e => { selectedEntity.doorType = e.target.value; $emit('sync-engine'); }">
                    <option value="single">Single Hinged</option>
                    <option value="double">Double Hinged</option>
                    <option value="french">Double French Glass</option>
                    <option value="sliding">Sliding (1 Panel)</option>
                    <option value="double_sliding">Sliding (2 Panels)</option>
                    <option value="pocket">Pocket Door</option>
                    <option value="folding">Bi-fold</option>
                </select>
            </div>
            <div class="control-group">
                <label>Door Shape</label>
                <select :value="selectedEntity.doorShape || 'square'" @change="e => { selectedEntity.doorShape = e.target.value; $emit('sync-engine'); }">
                    <option value="square">Square (Default)</option>
                    <option value="radius">Radius (True Arch)</option>
                    <option value="segment">Segment (Eyebrow)</option>
                    <option value="gothic">Gothic (Pointed)</option>
                </select>
            </div>
            
            <MaterialSlotsPanel :entity="selectedEntity" @sync-engine="$emit('sync-engine')" />
        </div>
        <div v-else-if="selectedEntity.type === 'window'">
            <div class="control-group">
                <label>Window Style</label>
                <select :value="selectedEntity.windowType || 'sliding_std'" @change="e => { selectedEntity.windowType = e.target.value; $emit('sync-engine'); }">
                    <option value="sliding_std">Sliding Window</option>
                    <option value="casement_std">Casement Window</option>
                    <option value="fixed">Fixed Glass Window</option>
                    <option value="traditional">Traditional Paneled Window</option>
                    <option value="louver">Louver / Jalousie Window</option>
                    <option value="bay">Bay Window</option>
                </select>
            </div>
            <div class="control-group">
                <label>Window Shape</label>
                <select :value="selectedEntity.windowShape || selectedEntity.doorShape || 'square'" @change="e => { selectedEntity.windowShape = e.target.value; selectedEntity.doorShape = e.target.value; $emit('sync-engine'); }">
                    <option value="square">Square / Rectangular (Default)</option>
                    <option value="radius">Radius (Arch Top)</option>
                    <option value="segment">Eyebrow Segment</option>
                    <option value="gothic">Gothic Pointed</option>
                </select>
            </div>
            <MaterialSlotsPanel :entity="selectedEntity" @sync-engine="$emit('sync-engine')" />

            <div class="control-group">
                <label>Grill Pattern</label>
                <select :value="selectedEntity.grillePattern || 'grid'" @change="e => { selectedEntity.grillePattern = e.target.value; $emit('sync-engine'); }">
                    <option value="none">No Grill (Clean View)</option>
                    <option value="grid">Standard Grid</option>
                    <option value="diamond">Diamond Lattice</option>
                    <option value="horizontal">Horizontal Security Bars</option>
                    <option value="vertical">Vertical Security Bars</option>
                </select>
            </div>
            
            <div class="control-group" v-if="(selectedEntity.grillePattern || 'grid') !== 'none'">
                <label>Grill Profile</label>
                <select :value="selectedEntity.grilleProfile || 'flat'" @change="e => { selectedEntity.grilleProfile = e.target.value; $emit('sync-engine'); }">
                    <option value="flat">Flat / Box (Rectangular)</option>
                    <option value="round">Round (Steel Rods)</option>
                </select>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'sunshade'">
            <div class="control-group">
                <label>Depth (Projection)</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.depth" min="5" max="100" @input="$emit('sync-engine')">
                    <DimensionInput v-model="selectedEntity.depth" @change="$emit('sync-engine')" />
                </div>
            </div>
            <div class="control-group">
                <label>Sunshade Style</label>
                <select v-model="selectedEntity.chajjaType" @change="$emit('sync-engine')">
                    <option value="concrete_slab">Concrete Slab (RCC)</option>
                    <option value="wooden_pergola">Wooden Pergola</option>
                    <option value="metal_louvers">Metal Louvers</option>
                    <option value="glass_canopy">Glass Canopy</option>
                    <option value="polycarbonate_canopy">Polycarbonate Canopy</option>
                    <option value="metal_canopy">Metal Canopy</option>
                    <option value="curved_rcc">Curved RCC</option>
                    <option value="cantilever_rcc">Cantilever RCC</option>
                    <option value="jali_canopy">Decorative Jali</option>
                    <option value="box_frame">Box Frame</option>
                </select>
            </div>
            
            <div v-if="selectedEntity.chajjaType === 'box_frame'" class="control-group">
                <label>Frame Drop Height (For Window Wrap)</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.frameHeight" min="20" max="300" @input="$emit('sync-engine')">
                    <DimensionInput v-model="selectedEntity.frameHeight" @change="$emit('sync-engine')" />
                </div>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'jali_panel'">
            <div class="control-group">
                <label>Jali Pattern</label>
                <select v-model="selectedEntity.jaliPattern" @change="$emit('sync-engine')">
                    <option value="geometric">Geometric Lattice</option>
                    <option value="islamic">Islamic Star</option>
                    <option value="modern">Modern Slats</option>
                    <option value="kolam">Kolam (Rangoli)</option>
                    <option value="lotus">Lotus Motif</option>
                    <option value="peacock">Peacock (Mayil)</option>
                    <option value="gopuram">Temple Gopuram</option>
                    <option value="ventilation">Geometric Vent Block</option>
                    <option value="mango">Mango Paisley Vine</option>
                    <option value="chettinad">Chettinad Wooden Jali</option>
                </select>
            </div>
            <div class="control-group">
                <label>Pattern Size</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.jaliPatternSize || 20" @input="e => { selectedEntity.jaliPatternSize = parseFloat(e.target.value); $emit('sync-engine'); }" min="5" max="100" step="1">
                    <DimensionInput :modelValue="selectedEntity.jaliPatternSize || 20" @update:modelValue="val => { selectedEntity.jaliPatternSize = val; $emit('sync-engine'); }" min="5" max="100" step="1" />
                </div>
            </div>
            <div class="control-group">
                <label>Material</label>
                <select v-model="selectedEntity.jaliMat" @change="$emit('sync-engine')">
                    <option value="wood">Teak Wood</option>
                    <option value="mdf">White Painted MDF</option>
                    <option value="brass">Brass Finish</option>
                    <option value="wpc">WPC (Wood Plastic)</option>
                    <option value="stone">Sandstone</option>
                    <option value="metal_black">Matte Black Metal</option>
                </select>
            </div>
            <div class="control-group">
                <label>Mounting</label>
                <select v-model="selectedEntity.jaliMount" @change="$emit('sync-engine')">
                    <option value="flush">Flush (Centered)</option>
                    <option value="recessed">Recessed (Inset)</option>
                    <option value="protruding">Protruding (Surface)</option>
                </select>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'elevation_fascia'">
            <div class="control-group">
                <label>Profile Type</label>
                <select v-model="selectedEntity.profileType" @change="$emit('sync-engine')">
                    <option value="c_shape_left">C-Shape (Left)</option>
                    <option value="c_shape_right">C-Shape (Right)</option>
                    <option value="l_shape_left">L-Shape (Left)</option>
                    <option value="l_shape_right">L-Shape (Right)</option>
                    <option value="full_box">Full Box Wrap</option>
                </select>
            </div>
            <div class="control-group" v-if="selectedEntity.profileType !== 'full_box'">
                <label>Top Arm Length</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.topArm !== undefined ? selectedEntity.topArm : selectedEntity.width" @input="e => { selectedEntity.topArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                    <DimensionInput :modelValue="selectedEntity.topArm !== undefined ? selectedEntity.topArm : selectedEntity.width" @update:modelValue="val => { selectedEntity.topArm = val; $emit('sync-engine'); }" />
                </div>
            </div>
            <div class="control-group" v-if="['c_shape_left', 'c_shape_right'].includes(selectedEntity.profileType)">
                <label>Bottom Arm Length</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.bottomArm !== undefined ? selectedEntity.bottomArm : selectedEntity.width" @input="e => { selectedEntity.bottomArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                    <DimensionInput :modelValue="selectedEntity.bottomArm !== undefined ? selectedEntity.bottomArm : selectedEntity.width" @update:modelValue="val => { selectedEntity.bottomArm = val; $emit('sync-engine'); }" />
                </div>
            </div>
            <div class="control-group"><label>Depth (Overhang)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="5" max="150" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.depth" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.thick" min="2" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.thick" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Elevation (Bottom)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.elevation" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group">
                <label>Material</label>
                <select v-model="selectedEntity.fasciaMat" @change="$emit('sync-engine')">
                    <option value="white">White Paint</option>
                    <option value="dark_grey">Dark Grey</option>
                    <option value="stone">Stone Cladding</option>
                    <option value="wood">Wood Panel</option>
                </select>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Object</button>
    </div>
</template>

<script setup>
import DimensionInput from '../common/DimensionInput.vue';
import MaterialCategorySelector from '../common/MaterialCategorySelector.vue';
import MaterialSlotsPanel from '../common/MaterialSlotsPanel.vue';


const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'sync-door-angle',
    'delete-entity'
]);

const getDoorPresetId = () => {
    if (!props.selectedEntity) return '';
    const { doorType, doorStyle } = props.selectedEntity;
    if (doorType === 'single' && doorStyle === 'flat') return 'single';
    if (doorType === 'french' && doorStyle === 'glass_grid') return 'french';
    if (doorType === 'sliding') return 'sliding';
    if (doorType === 'pocket') return 'pocket';
    if (doorType === 'single' && doorStyle === 'classic_4_panel') return 'classic_4';
    return ''; // default/custom
};

const getWindowPresetId = () => {
    if (!props.selectedEntity) return '';
    const { windowType } = props.selectedEntity;
    if (windowType === 'sliding_std') return 'sliding_std';
    if (windowType === 'casement_std') return 'casement_std';
    if (windowType === 'fixed_elevation') return 'fixed_elevation';
    if (windowType === 'bay_box') return 'bay_box';
    if (windowType === 'panoramic_slider') return 'panoramic_slider';
    return ''; // default/custom
};

const handleCatalogSelect = (item) => {
    if (props.selectedEntity) {
        Object.assign(props.selectedEntity, item.params);
        emit('sync-engine');
    }
};
</script>
