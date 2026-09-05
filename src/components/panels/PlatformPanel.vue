<template>
    <div class="props-panel-inner platform-properties-panel">
        <!-- Header / Status Badge -->
        <div class="platform-header-strip">
            <div class="platform-title-row">
                <span class="platform-badge" :class="isSunken ? 'badge-sunken' : 'badge-raised'">
                    {{ stepBadgeText }}
                </span>
                <span class="platform-subtitle">{{ isSunken ? 'Sunken Pit' : 'Raised Platform' }}</span>
            </div>
            <input 
                type="text" 
                v-model="selectedEntity.name" 
                class="platform-name-input"
                placeholder="Platform Name"
                @change="syncPlatform"
            />
        </div>

        <!-- Sims 4 Step Controls: Big Raise & Lower Buttons -->
        <div class="sims4-step-control-section">
            <div class="step-buttons-grid">
                <button 
                    class="step-btn btn-raise" 
                    @click="stepUp"
                    title="Raise Platform by +1 Step (+15cm)"
                >
                    <span class="step-icon">▲</span>
                    <div class="step-btn-text">
                        <span class="step-btn-title">Raise</span>
                        <span class="step-btn-sub">+{{ selectedEntity.stepHeight || 15 }} cm</span>
                    </div>
                </button>
                <button 
                    class="step-btn btn-lower" 
                    @click="stepDown"
                    title="Lower Platform by -1 Step (-15cm)"
                >
                    <span class="step-icon">▼</span>
                    <div class="step-btn-text">
                        <span class="step-btn-title">Lower</span>
                        <span class="step-btn-sub">-{{ selectedEntity.stepHeight || 15 }} cm</span>
                    </div>
                </button>
            </div>
            <div class="step-counter-banner">
                <span class="step-counter-label">Current Height:</span>
                <strong class="step-counter-value">{{ selectedEntity.height }} cm</strong>
                <span class="step-counter-steps">({{ stepCountText }})</span>
            </div>
        </div>

        <!-- Trim Profile Selector (Sims 4 Style) -->
        <div class="control-group-block">
            <label class="section-label">Perimeter Trim & Riser Profile</label>
            <div class="trim-styles-grid">
                <button 
                    v-for="trim in trimOptions" 
                    :key="trim.id"
                    class="trim-style-card"
                    :class="{ active: selectedEntity.trimStyle === trim.id }"
                    @click="setTrimStyle(trim.id)"
                    :title="trim.desc"
                >
                    <span class="trim-icon">{{ trim.icon }}</span>
                    <span class="trim-name">{{ trim.name }}</span>
                </button>
            </div>
        </div>

        <!-- Dimensions -->
        <div class="control-group-block">
            <label class="section-label">Dimensions & Alignment</label>
            
            <template v-if="selectedEntity.shapeType !== 'polygon'">
                <div class="control-group">
                    <label>Width</label>
                    <div class="input-wrap">
                        <input type="range" v-model.number="selectedEntity.width" min="20" max="800" step="5" @input="syncPlatform">
                        <DimensionInput v-model="selectedEntity.width" min="20" max="800" step="5" @change="syncPlatform" />
                    </div>
                </div>

                <div class="control-group">
                    <label>Depth</label>
                    <div class="input-wrap">
                        <input type="range" v-model.number="selectedEntity.depth" min="20" max="800" step="5" @input="syncPlatform">
                        <DimensionInput v-model="selectedEntity.depth" min="20" max="800" step="5" @change="syncPlatform" />
                    </div>
                </div>
            </template>

            <div class="control-group">
                <label>Total Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.height" min="-150" max="300" step="1" @input="syncPlatform">
                    <DimensionInput v-model="selectedEntity.height" min="-150" max="300" step="1" @change="syncPlatform" />
                </div>
            </div>

            <div class="control-group">
                <label>Step Interval</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.stepHeight" min="5" max="40" step="1" @input="syncPlatform">
                    <DimensionInput v-model="selectedEntity.stepHeight" min="5" max="40" step="1" @change="syncPlatform" />
                </div>
            </div>

            <div class="control-group">
                <label>Ground Elevation</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.elevation" min="0" max="400" step="5" @input="syncPlatform">
                    <DimensionInput v-model="selectedEntity.elevation" min="0" max="400" step="5" @change="syncPlatform" />
                </div>
            </div>

            <div class="control-group">
                <label>Rotation</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="currentRotation" min="0" max="360" step="5" @input="onRotationSlider">
                    <input type="number" v-model.number="currentRotation" min="0" max="360" class="mini-num-input" @change="onRotationChange">
                    <button class="btn-icon-rotate" @click="rotate90" title="Rotate 90° Clockwise">
                        ⟳ 90°
                    </button>
                </div>
            </div>
        </div>

        <!-- Dual Material Slots (3-Layer BIM Pipeline) -->
        <div class="control-group-block">
            <div class="slot-tab-header">
                <button 
                    class="slot-tab-btn" 
                    :class="{ active: activeSlot === 'top' }"
                    @click="activeSlot = 'top'"
                >
                    Deck Surface (Top)
                </button>
                <button 
                    class="slot-tab-btn" 
                    :class="{ active: activeSlot === 'side' }"
                    @click="activeSlot = 'side'"
                >
                    Riser & Trim (Sides)
                </button>
            </div>

            <!-- Material Swatches Grid -->
            <div class="material-selection-box">
                <div class="active-slot-summary">
                    <span class="active-slot-label">Editing Slot:</span>
                    <strong class="active-slot-name">{{ activeSlot === 'top' ? 'Top Deck Floor' : 'Perimeter Trim/Riser' }}</strong>
                    <span class="active-slot-id">({{ currentSlotMaterialId }})</span>
                </div>

                <div class="materials-swatches-grid">
                    <button 
                        v-for="mat in currentSlotPresets" 
                        :key="mat.id"
                        class="material-swatch-item"
                        :class="{ active: currentSlotMaterialId === mat.id }"
                        @click="setSlotMaterial(mat.id)"
                        :title="mat.name"
                    >
                        <div class="swatch-preview" :style="{ backgroundColor: mat.colorHex }"></div>
                        <span class="swatch-name">{{ mat.name }}</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Action Buttons -->
        <div class="platform-actions-row">
            <button class="btn-secondary full-width" @click="duplicatePlatform">
                ⧉ Duplicate Platform
            </button>
            <button class="hud-delete full-width" @click="$emit('delete-entity')">
                🗑 Delete Platform
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';
import { PremiumPlatform } from '../../core/engine2d/PremiumPlatform.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);

const activeSlot = ref('top');

const trimOptions = [
    { id: 'flat', name: 'Modern Riser', icon: '▬', desc: 'Clean flush vertical riser' },
    { id: 'beveled', name: 'Chamfer', icon: '◢', desc: '45-degree chamfered riser bevel' },
    { id: 'bullnose', name: 'Bullnose', icon: '◠', desc: 'Smooth rounded bullnose edge' },
    { id: 'classical', name: 'Classical', icon: '≡', desc: 'Molded architectural profile' },
    { id: 'recessed_led', name: 'LED Reveal', icon: '💡', desc: 'Floating shadow gap with glowing LED' },
    { id: 'stone', name: 'Stone Plinth', icon: '🏛', desc: 'Heavy architectural stone plinth' }
];

const slotPresets = {
    top: [
        { id: 'wood_golden_teak', name: 'Golden Teak', colorHex: '#c4a482' },
        { id: 'wood_white_oak', name: 'White Oak', colorHex: '#d8c8b8' },
        { id: 'wood_dark_walnut', name: 'Dark Walnut', colorHex: '#5c4033' },
        { id: 'marble_nero_marquina', name: 'Nero Marble', colorHex: '#222222' },
        { id: 'stone_travertine_beige', name: 'Travertine', colorHex: '#e5d9c5' },
        { id: 'stone_basalt_lava', name: 'Basalt Lava', colorHex: '#444444' },
        { id: 'tile_gloss_grey', name: 'Polished Tile', colorHex: '#9ca3af' },
        { id: 'white_paint', name: 'White Plaster', colorHex: '#f3f4f6' }
    ],
    side: [
        { id: 'wood_white_oak', name: 'White Oak Riser', colorHex: '#d8c8b8' },
        { id: 'wood_golden_teak', name: 'Teak Riser', colorHex: '#c4a482' },
        { id: 'wood_dark_walnut', name: 'Walnut Riser', colorHex: '#5c4033' },
        { id: 'upvc_white', name: 'White Trim', colorHex: '#ffffff' },
        { id: 'metal_brushed_aluminum', name: 'Brushed Metal', colorHex: '#a0aec0' },
        { id: 'stone_travertine_beige', name: 'Stone Trim', colorHex: '#e5d9c5' },
        { id: 'stone_basalt_lava', name: 'Black Plinth', colorHex: '#2d3748' },
        { id: 'white_paint', name: 'White Paint', colorHex: '#f3f4f6' }
    ]
};

const currentSlotPresets = computed(() => slotPresets[activeSlot.value] || slotPresets.top);

const currentSlotMaterialId = computed(() => {
    const e = props.selectedEntity;
    if (!e || !e.materials) return 'wood_golden_teak';
    return e.materials[activeSlot.value]?.id || (activeSlot.value === 'top' ? 'wood_golden_teak' : 'wood_white_oak');
});

const isSunken = computed(() => (props.selectedEntity?.height || 0) < 0);

const stepCountText = computed(() => {
    const h = Number(props.selectedEntity?.height) || 0;
    const step = Number(props.selectedEntity?.stepHeight) || 15;
    const count = Math.max(1, Math.round(Math.abs(h) / step));
    if (h === 0) return '0 Steps (Level)';
    return `${count} ${count === 1 ? 'Step' : 'Steps'}`;
});

const stepBadgeText = computed(() => {
    const h = Number(props.selectedEntity?.height) || 0;
    const step = Number(props.selectedEntity?.stepHeight) || 15;
    const count = Math.max(1, Math.round(Math.abs(h) / step));
    if (h > 0) return `▲ +${h}cm (${count} ${count === 1 ? 'Step' : 'Steps'})`;
    if (h < 0) return `▼ ${h}cm (Sunken ${count} ${count === 1 ? 'Step' : 'Steps'})`;
    return `◆ 0cm (Floor Level)`;
});

const currentRotation = computed({
    get: () => {
        const e = props.selectedEntity;
        if (!e) return 0;
        if (e.group && typeof e.group.rotation === 'function') return Math.round(e.group.rotation());
        return Math.round(Number(e.rotation) || 0);
    },
    set: (val) => {
        const e = props.selectedEntity;
        if (!e) return;
        const num = Number(val) || 0;
        e.rotation = num;
        if (e.group && typeof e.group.rotation === 'function') e.group.rotation(num);
        syncPlatform();
    }
});

const onRotationSlider = (e) => {
    currentRotation.value = Number(e.target.value);
};

const onRotationChange = () => {
    syncPlatform();
};

const rotate90 = () => {
    const cur = currentRotation.value;
    currentRotation.value = (cur + 90) % 360;
};

const setTrimStyle = (trimId) => {
    if (!props.selectedEntity) return;
    props.selectedEntity.trimStyle = trimId;
    syncPlatform();
};

const setSlotMaterial = (matId) => {
    const e = props.selectedEntity;
    if (!e) return;
    if (!e.materials) e.materials = {};
    e.materials[activeSlot.value] = { id: matId };
    
    // Also sync 3D live material manager if present
    const pl = e.planner || window.planner?.value || window.planner;
    if (pl && pl.renderer3D && typeof pl.renderer3D.updateMaterialLive === 'function') {
        pl.renderer3D.updateMaterialLive(e);
    }
    syncPlatform();
};

const stepUp = () => {
    const e = props.selectedEntity;
    if (!e) return;
    const step = Number(e.stepHeight) || 15;
    if (typeof e.stepUp === 'function') {
        e.stepUp(step);
    } else {
        e.height = Math.round(((e.height || 0) + step) * 10) / 10;
        syncPlatform();
    }
    emit('sync-engine');
};

const stepDown = () => {
    const e = props.selectedEntity;
    if (!e) return;
    const step = Number(e.stepHeight) || 15;
    if (typeof e.stepDown === 'function') {
        e.stepDown(step);
    } else {
        e.height = Math.round(((e.height || 0) - step) * 10) / 10;
        syncPlatform();
    }
    emit('sync-engine');
};

const syncPlatform = () => {
    const e = props.selectedEntity;
    if (e) {
        if (typeof e.update2D === 'function') e.update2D();
        if (typeof e.update3D === 'function') e.update3D();
        if (e.planner && typeof e.planner.syncAll === 'function') {
            e.planner.syncAll();
        }
    }
    emit('sync-engine');
};

const duplicatePlatform = () => {
    const p = props.selectedEntity;
    if (!p || !p.planner) return;
    const state = typeof p.exportState === 'function' ? p.exportState() : {
        width: p.width,
        depth: p.depth,
        height: p.height,
        stepHeight: p.stepHeight,
        elevation: p.elevation,
        trimStyle: p.trimStyle,
        rotation: p.rotation,
        materials: JSON.parse(JSON.stringify(p.materials || {})),
        shapeType: p.shapeType,
        points: p.points ? JSON.parse(JSON.stringify(p.points)) : null
    };
    state.id = 'platform_' + Math.random().toString(36).substr(2, 9);
    state.x = (p.group && typeof p.group.x === 'function' ? p.group.x() : (p.x || 100)) + 30;
    state.y = (p.group && typeof p.group.y === 'function' ? p.group.y() : (p.y || 100)) + 30;
    
    const newPlat = new PremiumPlatform(p.planner, 'platform', state);
    if (!p.planner.platforms) p.planner.platforms = [];
    p.planner.platforms.push(newPlat);
    p.planner.selectEntity(newPlat, 'platform');
    p.planner.syncAll();
    emit('sync-engine');
};
</script>

<style scoped>
.platform-properties-panel {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 2px 0;
}

.platform-header-strip {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px;
    background: rgba(245, 158, 11, 0.08);
    border: 1px solid rgba(245, 158, 11, 0.25);
    border-radius: 8px;
}

.platform-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.platform-badge {
    font-size: 11px;
    font-weight: 700;
    padding: 3px 8px;
    border-radius: 9999px;
    letter-spacing: 0.02em;
}

.badge-raised {
    background: #10b981;
    color: #ffffff;
}

.badge-sunken {
    background: #f59e0b;
    color: #ffffff;
}

.platform-subtitle {
    font-size: 11px;
    font-weight: 600;
    color: #94a3b8;
    text-transform: uppercase;
}

.platform-name-input {
    width: 100%;
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 13px;
    font-weight: 600;
    box-sizing: border-box;
}

.platform-name-input:focus {
    outline: none;
    border-color: #f59e0b;
}

/* Sims 4 Step Control Section */
.sims4-step-control-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: #0f172a;
    border: 1px solid #1e293b;
    border-radius: 8px;
    padding: 10px;
}

.step-buttons-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}

.step-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 8px;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-raise {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2), rgba(5, 150, 105, 0.35));
    border-color: rgba(16, 185, 129, 0.5);
    color: #34d399;
}

.btn-raise:hover {
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.35), rgba(5, 150, 105, 0.5));
    border-color: #10b981;
    transform: translateY(-1px);
}

.btn-lower {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.35));
    border-color: rgba(245, 158, 11, 0.5);
    color: #fbbf24;
}

.btn-lower:hover {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.35), rgba(217, 119, 6, 0.5));
    border-color: #f59e0b;
    transform: translateY(-1px);
}

.step-icon {
    font-size: 16px;
    font-weight: 900;
}

.step-btn-text {
    display: flex;
    flex-direction: column;
    text-align: left;
}

.step-btn-title {
    font-size: 12px;
    font-weight: 700;
    line-height: 1.2;
}

.step-btn-sub {
    font-size: 10px;
    opacity: 0.85;
}

.step-counter-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    font-size: 11px;
}

.step-counter-label {
    color: #94a3b8;
}

.step-counter-value {
    color: #f8fafc;
    font-size: 12px;
}

.step-counter-steps {
    color: #f59e0b;
    font-weight: 600;
}

/* Control Group Blocks */
.control-group-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    padding-top: 10px;
}

.section-label {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}

/* Trim Profiles */
.trim-styles-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 6px;
}

.trim-style-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    cursor: pointer;
    color: #cbd5e1;
    transition: all 0.15s ease;
}

.trim-style-card:hover {
    border-color: #64748b;
    background: #334155;
}

.trim-style-card.active {
    border-color: #f59e0b;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
}

.trim-icon {
    font-size: 16px;
}

.trim-name {
    font-size: 9.5px;
    font-weight: 600;
    text-align: center;
    line-height: 1.1;
}

/* Dual Material Slots */
.slot-tab-header {
    display: flex;
    gap: 4px;
    background: #0f172a;
    padding: 3px;
    border-radius: 6px;
}

.slot-tab-btn {
    flex: 1;
    padding: 6px 4px;
    font-size: 11px;
    font-weight: 600;
    background: transparent;
    border: none;
    color: #94a3b8;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.slot-tab-btn.active {
    background: #3b82f6;
    color: #ffffff;
}

.material-selection-box {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid #1e293b;
    border-radius: 6px;
    padding: 8px;
}

.active-slot-summary {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
}

.active-slot-label {
    color: #94a3b8;
}

.active-slot-name {
    color: #f8fafc;
}

.active-slot-id {
    color: #64748b;
    font-size: 10px;
}

.materials-swatches-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 6px;
}

.material-swatch-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 6px;
    padding: 6px 4px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.material-swatch-item:hover {
    border-color: #64748b;
}

.material-swatch-item.active {
    border-color: #3b82f6;
    background: rgba(59, 130, 246, 0.15);
}

.swatch-preview {
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.2);
}

.swatch-name {
    font-size: 9px;
    color: #cbd5e1;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
}

.mini-num-input {
    width: 50px;
    background: #1e293b;
    border: 1px solid #334155;
    color: #f8fafc;
    border-radius: 4px;
    padding: 4px;
    font-size: 11px;
    text-align: center;
}

.btn-icon-rotate {
    background: #334155;
    border: 1px solid #475569;
    color: #f8fafc;
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}

.btn-icon-rotate:hover {
    background: #475569;
}

.platform-actions-row {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
}
</style>
