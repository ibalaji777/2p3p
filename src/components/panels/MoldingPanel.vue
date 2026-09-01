<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">{{ panelTitle }}</h4>
        
        <div class="control-group">
            <label>Length</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.width" min="10" max="1000" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" />
            </div>
        </div>
        
        <div class="control-group">
            <label>Profile Height</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.moldingHeight" min="2" max="60" step="1" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.moldingHeight" min="2" max="60" step="1" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div class="control-group">
            <label>Depth (Thickness)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.depth" min="0.5" max="50" step="0.5" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.depth" min="0.5" max="50" step="0.5" @change="$emit('sync-engine')" />
            </div>
        </div>
        
        <div class="control-group">
            <label>Elevation (from floor)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.heightOffset" min="0" max="500" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.heightOffset" @change="$emit('sync-engine')" />
            </div>
        </div>

        <!-- Quick Elevation Presets -->
        <div class="control-group" style="gap: 6px; display: flex;">
            <button class="btn-secondary" style="flex: 1; padding: 5px 4px; font-size: 10px; font-weight: 600;" @click="selectedEntity.heightOffset = 0; $emit('sync-engine')">
                ⬇ Floor (0 cm)
            </button>
            <button class="btn-secondary" style="flex: 1.2; padding: 5px 4px; font-size: 10px; font-weight: 600;" @click="selectedEntity.heightOffset = 90; $emit('sync-engine')">
                ⬍ Chair Rail (90 cm)
            </button>
            <button class="btn-secondary" style="flex: 1; padding: 5px 4px; font-size: 10px; font-weight: 600;" @click="selectedEntity.heightOffset = Math.max(0, (selectedEntity.wall?.height || 180) - (selectedEntity.moldingHeight || 10)); $emit('sync-engine')">
                ⬆ Ceiling
            </button>
        </div>

        <!-- Sims 4 Scope Batch Apply Actions -->
        <div class="control-group" style="flex-direction: column; gap: 6px; margin-top: 4px;">
            <label style="font-size: 11px; color: #94a3b8;">Sims 4 Scope Actions</label>
            <div style="display: flex; gap: 6px; width: 100%;">
                <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; color: #34d399; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1);" @click="applyToRoom">
                    🏠 Apply to Room Loop
                </button>
                <button class="btn-secondary" style="flex: 1; padding: 6px 8px; font-size: 11px; font-weight: 600; color: #fbbf24; border-color: rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.1);" @click="applyToExterior">
                    🌐 Apply to Exterior
                </button>
            </div>
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
                <optgroup label="Chair Rails & Wall Bands">
                    <option value="chair_rail">Classic Chair Rail (Dado)</option>
                    <option value="picture_rail">Picture Rail Trim</option>
                    <option value="fluted_band">Fluted Architectural Band</option>
                    <option value="double_bead">Double Bead Trim</option>
                    <option value="beveled_trim">Beveled Accent Band</option>
                    <option value="flat">Flat Wall Band (Modern)</option>
                    <option value="frame">Beveled Frame</option>
                    <option value="groove">Recessed Groove</option>
                </optgroup>
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
                <optgroup label="Exterior Architectural Facades">
                    <option value="frieze_exterior">Exterior Architectural Frieze</option>
                    <option value="foundation_trim">Exterior Foundation Plinth</option>
                </optgroup>
            </select>
        </div>

        <div v-if="selectedEntity.profileType === 'layered'">
            <div class="control-group">
                <label>Layers</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.layers" min="2" max="10" @input="$emit('sync-engine')">
                    <input type="number" v-model.number="selectedEntity.layers" @input="$emit('sync-engine')">
                </div>
            </div>
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
                <option value="limestone">Limestone Masonry</option>
                <option value="rough_stone">Rustic Ashlar Stone</option>
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
import { getRoomForWallFace, getRoomWallsAndSides, getExteriorWallsAndSides } from '../../core/engine3d/WallPaintSystem.js';
import { PremiumMolding } from '../../core/engine2d/PremiumMolding.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);

const panelTitle = computed(() => {
    const t = props.selectedEntity?.type || '';
    const p = props.selectedEntity?.profileType || '';
    const elev = props.selectedEntity?.heightOffset || 0;
    if (t.includes('skirting') || p.includes('skirting') || elev === 0) {
        return 'Baseboard / Skirting Properties';
    }
    if (t.includes('crown') || p.includes('crown') || p.includes('frieze') || elev >= 150) {
        return 'Crown Molding & Cornice Properties';
    }
    return 'Wall Trim & Chair Rail Properties';
});

const applyToRoom = () => {
    const mold = props.selectedEntity;
    const wall = mold?.wall;
    if (!wall) return;
    const pl = window.planner?.value || window.planner || mold.planner;
    if (!pl) return;
    const side = mold.side === 'left' ? 'front' : 'back';
    const room = getRoomForWallFace(wall, side, pl);
    if (!room) return;
    const targets = getRoomWallsAndSides(room, pl);
    if (!targets || targets.length === 0) return;

    targets.forEach(t => {
        const targetWall = t.wall;
        const targetSide = t.side;
        const sideVal = targetSide === 'front' ? 'left' : 'right';
        if (!targetWall.attachedMoldings) targetWall.attachedMoldings = [];
        
        targetWall.attachedMoldings = targetWall.attachedMoldings.filter(m => !(m.side === sideVal && Math.abs((m.heightOffset || 0) - (mold.heightOffset || 0)) < 15));

        const p1 = targetWall.startAnchor.position();
        const p2 = targetWall.endAnchor.position();
        const wLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const newMold = new PremiumMolding(pl, targetWall, 0.5, mold.type || 'molding_chair_rail');
        newMold.side = sideVal;
        newMold.width = wLen;
        newMold.moldingHeight = mold.moldingHeight || 8;
        newMold.depth = mold.depth || 2;
        newMold.heightOffset = mold.heightOffset || 0;
        newMold.profileType = mold.profileType || 'chair_rail';
        newMold.material = mold.material || 'white_paint';
        newMold.color = mold.color || '#ffffff';
        newMold.update();
        targetWall.attachedMoldings.push(newMold);
    });

    emit('sync-engine');
};

const applyToExterior = () => {
    const mold = props.selectedEntity;
    if (!mold) return;
    const pl = window.planner?.value || window.planner || mold.planner;
    if (!pl) return;
    const targets = getExteriorWallsAndSides(pl);
    if (!targets || targets.length === 0) return;

    targets.forEach(t => {
        const targetWall = t.wall;
        const targetSide = t.side;
        const sideVal = targetSide === 'front' ? 'left' : 'right';
        if (!targetWall.attachedMoldings) targetWall.attachedMoldings = [];
        
        targetWall.attachedMoldings = targetWall.attachedMoldings.filter(m => !(m.side === sideVal && Math.abs((m.heightOffset || 0) - (mold.heightOffset || 0)) < 15));

        const p1 = targetWall.startAnchor.position();
        const p2 = targetWall.endAnchor.position();
        const wLen = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        const newMold = new PremiumMolding(pl, targetWall, 0.5, mold.type || 'molding_chair_rail');
        newMold.side = sideVal;
        newMold.width = wLen;
        newMold.moldingHeight = mold.moldingHeight || 8;
        newMold.depth = mold.depth || 2;
        newMold.heightOffset = mold.heightOffset || 0;
        newMold.profileType = mold.profileType || 'chair_rail';
        newMold.material = mold.material || 'white_paint';
        newMold.color = mold.color || '#ffffff';
        newMold.update();
        targetWall.attachedMoldings.push(newMold);
    });

    emit('sync-engine');
};
</script>
