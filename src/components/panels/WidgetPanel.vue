<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">{{ selectedEntity.config?.label || 'DOOR/WINDOW' }} Properties</h4>
        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="400" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.width" @input="$emit('sync-engine')"></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'elevation_fascia'"><label>Height (Drop)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="400" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" @input="$emit('sync-engine')"></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'window' || selectedEntity.type === 'door'"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="400" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" @input="$emit('sync-engine')"></div></div>
        <div class="control-group" v-if="selectedEntity.type === 'window'"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="400" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.elevation" @input="$emit('sync-engine')"></div></div>
        <div class="faceRow" v-if="selectedEntity.type !== 'jali_panel' && selectedEntity.type !== 'elevation_fascia' && selectedEntity.type !== 'sunshade'">
            <button class="action-btn clear" style="flex: 1; padding: 4px;" @click="selectedEntity.facing *= -1; $emit('sync-engine')">Flip In/Out</button>
            <button class="action-btn clear" style="flex: 1; padding: 4px;" @click="selectedEntity.side *= -1; $emit('sync-engine')">Flip L/R</button>
        </div>
        <div v-if="selectedEntity.type === 'door'">
            <div class="control-group">
                <label>Door Type</label>
                <select v-model="selectedEntity.doorType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                    <option value="single">Single Hinged</option>
                    <option value="double">Double Door</option>
                    <option value="sliding">Sliding</option>
                    <option value="pocket">Pocket</option>
                    <option value="french">French (Glass)</option>
                </select>
            </div>
            <div class="control-group" v-if="!['pocket', 'folding', 'sliding', 'double_sliding'].includes(selectedEntity.doorType)">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 13px; font-weight: 500;">
                    <input type="checkbox" :checked="selectedEntity.hasSidelights" @change="(e) => { selectedEntity.hasSidelights = e.target.checked; if (e.target.checked) { selectedEntity.width = Math.max(selectedEntity.width, selectedEntity.doorType === 'single' ? 100 : 140); } $emit('sync-engine'); }" />
                    Add Sidelights (Side Windows)
                </label>
            </div>
            <div class="control-group" v-if="selectedEntity.doorType !== 'french'">
                <label>Panel Style (3D Design)</label>
                <select v-model="selectedEntity.doorStyle" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                    <option value="flat">Flat Panel (Default)</option>
                    <option value="classic_4_horizontal">Classic 4-Panel (Horiz)</option>
                    <option value="glass_bottom_panel">Glass & Bottom Panel</option>
                    <option value="glass_grid">Glass with Grid</option>
                    <option value="classic_2_panel">Classic 2-Panel</option>
                    <option value="classic_4_panel">Classic 4-Panel</option>
                    <option value="grid_panel">Grid Panel</option>
                </select>
            </div>
            <div class="control-group">
                <label>Door Shape (Top)</label>
                <select v-model="selectedEntity.doorShape" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                    <option value="square">Square (Default)</option>
                    <option value="radius">Radius (True Arch)</option>
                    <option value="segment">Segment (Eyebrow)</option>
                    <option value="gothic">Gothic (Pointed)</option>
                </select>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'window'">
            <div class="control-group">
                <label>Window Type</label>
                <select v-model="selectedEntity.windowType" @change="(e) => { 
                    if (['panoramic_slider', 'modern_split'].includes(selectedEntity.windowType)) selectedEntity.grillePattern = 'none';
                    $emit('sync-engine');
                }" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                    <option value="sliding_std">Standard Sliding</option>
                    <option value="casement_std">Casement / Hinged</option>
                    <option value="fixed_elevation">Fixed Glass</option>
                    <option value="modern_split">Modern Asymmetric</option>
                    <option value="bay_box">Box Bay Window</option>
                    <option value="window_seat">Double Picture Window</option>
                    <option value="garden_open">Open Garden Window</option>
                    <option value="panoramic_slider">Panoramic Slider (3-Pane)</option>
                    <option value="shutter_double">Double Louvered Shutter</option>
                </select>
            </div>
            <div class="control-group">
                <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 13px; font-weight: 500;">
                    <input type="checkbox" :checked="selectedEntity.grillePattern && selectedEntity.grillePattern !== 'none'" @change="(e) => { selectedEntity.grillePattern = e.target.checked ? 'grid' : 'none'; $emit('sync-engine'); }" />
                    Add Window Grill / Bars
                </label>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'sunshade'">
            <div class="control-group">
                <label>Depth (Projection)</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.depth" min="5" max="100" @input="$emit('sync-engine')">
                    <input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')">
                </div>
            </div>
            <div class="control-group">
                <label>Sunshade (Chajja) Style</label>
                <select v-model="selectedEntity.chajjaType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
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
                    <input type="number" v-model.number="selectedEntity.frameHeight" @input="$emit('sync-engine')">
                </div>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'jali_panel'">
            <div class="control-group">
                <label>Jali Pattern</label>
                <select v-model="selectedEntity.jaliPattern" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
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
                    <input type="number" :value="selectedEntity.jaliPatternSize || 20" @input="e => { selectedEntity.jaliPatternSize = parseFloat(e.target.value); $emit('sync-engine'); }" min="5" max="100" step="1">
                </div>
            </div>
            <div class="control-group">
                <label>Material</label>
                <select v-model="selectedEntity.jaliMat" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
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
                <select v-model="selectedEntity.jaliMount" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                    <option value="flush">Flush (Centered)</option>
                    <option value="recessed">Recessed (Inset)</option>
                    <option value="protruding">Protruding (Surface)</option>
                </select>
            </div>
        </div>
        <div v-else-if="selectedEntity.type === 'elevation_fascia'">
            <div class="control-group">
                <label>Profile Type</label>
                <select v-model="selectedEntity.profileType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
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
                    <input type="number" :value="selectedEntity.topArm !== undefined ? selectedEntity.topArm : selectedEntity.width" @input="e => { selectedEntity.topArm = parseFloat(e.target.value); $emit('sync-engine'); }">
                </div>
            </div>
            <div class="control-group" v-if="['c_shape_left', 'c_shape_right'].includes(selectedEntity.profileType)">
                <label>Bottom Arm Length</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.bottomArm !== undefined ? selectedEntity.bottomArm : selectedEntity.width" @input="e => { selectedEntity.bottomArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                    <input type="number" :value="selectedEntity.bottomArm !== undefined ? selectedEntity.bottomArm : selectedEntity.width" @input="e => { selectedEntity.bottomArm = parseFloat(e.target.value); $emit('sync-engine'); }">
                </div>
            </div>
            <div class="control-group"><label>Depth (Overhang)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="5" max="150" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.thick" min="2" max="50" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.thick" @input="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Elevation (Bottom)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="300" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.elevation" @input="$emit('sync-engine')"></div></div>
            <div class="control-group">
                <label>Material</label>
                <select v-model="selectedEntity.fasciaMat" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
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
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
