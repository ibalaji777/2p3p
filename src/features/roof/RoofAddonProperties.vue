<template>
    <div class="roof-addon-properties">
        <!-- Header -->
        <div class="addon-header">
            <div class="addon-title-wrap">
                <span class="addon-icon">{{ addonIcon }}</span>
                <span class="addon-title">{{ addonTitle }}</span>
            </div>
            <span class="addon-badge">{{ addonBadge }}</span>
        </div>

        <!-- 1. CHIMNEY CONTROLS -->
        <div v-if="isChimney" class="addon-section">
            <h4 class="props-subtitle">Chimney Stack Style</h4>
            <div class="control-group">
                <label>Masonry Style</label>
                <select v-model="entity.type" class="settings-select" @change="onUpdate">
                    <option value="chimney_brick_traditional">Traditional Red Brick (Clay Pot)</option>
                    <option value="chimney_stone_tudor">Tudor Ashlar Stone (Corbelled Cap)</option>
                    <option value="chimney_metal_flue">Modern Industrial Metal Flue</option>
                    <option value="chimney_double_brick">Double Flue Brick Stack</option>
                </select>
            </div>

            <h4 class="props-subtitle">Dimensions (cm)</h4>
            <div class="dim-grid">
                <div class="control-group">
                    <label>Width</label>
                    <input type="number" v-model.number="entity.width" min="20" max="150" step="5" class="settings-input" @input="onUpdate" />
                </div>
                <div class="control-group">
                    <label>Depth</label>
                    <input type="number" v-model.number="entity.depth" min="20" max="150" step="5" class="settings-input" @input="onUpdate" />
                </div>
                <div class="control-group">
                    <label>Height</label>
                    <input type="number" v-model.number="entity.height" min="40" max="250" step="5" class="settings-input" @input="onUpdate" />
                </div>
            </div>

            <h4 class="props-subtitle">Position On Roof</h4>
            <div class="control-group">
                <label>Across Roof Width (U)</label>
                <div class="slider-wrap">
                    <input type="range" v-model.number="entity.u" min="0.05" max="0.95" step="0.01" class="settings-slider" @input="onUpdate" />
                    <span class="slider-val">{{ Math.round((entity.u || 0.75) * 100) }}%</span>
                </div>
            </div>
            <div class="control-group">
                <label>Up/Down Slope (V)</label>
                <div class="slider-wrap">
                    <input type="range" v-model.number="entity.v" min="0.05" max="0.95" step="0.01" class="settings-slider" @input="onUpdate" />
                    <span class="slider-val">{{ Math.round((entity.v || 0.75) * 100) }}%</span>
                </div>
            </div>

            <h4 class="props-subtitle">Materials</h4>
            <div class="control-group">
                <label>Shaft Material</label>
                <select v-model="entity.material" class="settings-select" @change="onUpdate">
                    <option value="red_brick">Traditional Red Brick</option>
                    <option value="rough_stone">Rustic Fieldstone</option>
                    <option value="limestone">Smooth Limestone</option>
                    <option value="metal_dark_steel">Charcoal Dark Steel</option>
                    <option value="white_paint">White Stucco Plaster</option>
                </select>
            </div>
        </div>

        <!-- 3. FINIAL CONTROLS -->
        <div v-else-if="isFinial" class="addon-section">
            <h4 class="props-subtitle">Apex Finial Style</h4>
            <div class="control-group">
                <label>Finial Design</label>
                <select v-model="entity.type" class="settings-select" @change="onUpdate">
                    <option value="finial_victorian_spire">Victorian Gothic Spire</option>
                    <option value="finial_copper_spire">Aged Copper Needle Spire</option>
                    <option value="finial_globe_orb">Classic Stone Globe & Orb</option>
                    <option value="finial_weather_vane_rooster">Weather Vane (Brass Rooster)</option>
                </select>
            </div>

            <h4 class="props-subtitle">Scale & Height</h4>
            <div class="control-group">
                <label>Height (cm)</label>
                <input type="number" v-model.number="entity.height" min="20" max="150" step="5" class="settings-input" @input="onUpdate" />
            </div>

            <h4 class="props-subtitle">Finish Material</h4>
            <div class="control-group">
                <label>Metal / Stone Finish</label>
                <select v-model="entity.material" class="settings-select" @change="onUpdate">
                    <option value="metal_wrought_iron">Black Wrought Iron</option>
                    <option value="copper">Aged Copper Patina</option>
                    <option value="galvanized_steel">Polished Silver Steel</option>
                    <option value="limestone">Limestone</option>
                </select>
            </div>
        </div>

        <!-- 4. CRESTING CONTROLS -->
        <div v-else-if="isCresting" class="addon-section">
            <h4 class="props-subtitle">Ridge Cresting Style</h4>
            <div class="control-group">
                <label>Ironwork Pattern</label>
                <select v-model="entity.type" class="settings-select" @change="onUpdate">
                    <option value="ridge_cresting_victorian_lace">Victorian Lace Ironwork</option>
                    <option value="ridge_cresting_gothic_spikes">Gothic Fleur-de-Lis Spikes</option>
                    <option value="ridge_cresting_metal_cap">Modern Standing Seam Ridge Cap</option>
                </select>
            </div>

            <h4 class="props-subtitle">Height & Spacing</h4>
            <div class="control-group">
                <label>Height (cm)</label>
                <input type="number" v-model.number="entity.height" min="5" max="50" step="2" class="settings-input" @input="onUpdate" />
            </div>

            <h4 class="props-subtitle">Finish Material</h4>
            <div class="control-group">
                <label>Material</label>
                <select v-model="entity.material" class="settings-select" @change="onUpdate">
                    <option value="metal_wrought_iron">Black Wrought Iron</option>
                    <option value="galvanized_steel">Galvanized Steel</option>
                    <option value="copper">Aged Copper</option>
                </select>
            </div>
        </div>

        <!-- 5. SKYLIGHT CONTROLS -->
        <div v-else-if="isSkylight" class="addon-section">
            <h4 class="props-subtitle">Skylight Style</h4>
            <div class="control-group">
                <label>Design</label>
                <select v-model="entity.type" class="settings-select" @change="onUpdate">
                    <option value="skylight_square_grid_inset">Square Grid Glass Inset</option>
                    <option value="skylight_diamond_lattice_inset">Victorian Diamond Lattice</option>
                    <option value="skylight_hexagonal_inset">Futuristic Hex Honeycomb</option>
                    <option value="skylight_solid_clear_inset">Frameless Clear Float Glass</option>
                    <option value="skylight_velux_frame">Velux Pivot Roof Window</option>
                    <option value="skylight_pyramid_dome">Pyramid Solarium Lantern</option>
                </select>
            </div>

            <h4 class="props-subtitle">Dimensions (cm)</h4>
            <div class="dim-grid">
                <div class="control-group">
                    <label>Width</label>
                    <input type="number" v-model.number="entity.width" min="40" max="400" step="10" class="settings-input" @input="onUpdate" />
                </div>
                <div class="control-group">
                    <label>Length</label>
                    <input type="number" v-model.number="entity.length" min="40" max="500" step="10" class="settings-input" @input="onUpdate" />
                </div>
            </div>

            <h4 class="props-subtitle">Position On Slope</h4>
            <div class="control-group">
                <label>Across Roof Width (U)</label>
                <div class="slider-wrap">
                    <input type="range" v-model.number="entity.u" min="0.05" max="0.95" step="0.01" class="settings-slider" @input="onUpdate" />
                    <span class="slider-val">{{ Math.round((entity.u || 0.5) * 100) }}%</span>
                </div>
            </div>
            <div class="control-group">
                <label>Up/Down Slope (V)</label>
                <div class="slider-wrap">
                    <input type="range" v-model.number="entity.v" min="0.05" max="0.95" step="0.01" class="settings-slider" @input="onUpdate" />
                    <span class="slider-val">{{ Math.round((entity.v || 0.5) * 100) }}%</span>
                </div>
            </div>
        </div>

        <!-- Delete Addon Button -->
        <button class="btn-delete-addon" @click="onDelete">
            🗑️ Delete {{ addonCategoryName }}
        </button>
    </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    parentRoof: { type: Object, default: null }
});

const emit = defineEmits(['sync-engine', 'delete-entity']);

const entity = computed(() => props.selectedEntity || {});

const isChimney = computed(() => {
    const t = entity.value.type || entity.value.addonType || '';
    return t.startsWith('chimney_') || t === 'chimney' || entity.value.addonType === 'chimney';
});

const isFinial = computed(() => {
    const t = entity.value.type || entity.value.addonType || '';
    return t.startsWith('finial_') || t === 'finial' || entity.value.addonType === 'finial';
});

const isCresting = computed(() => {
    const t = entity.value.type || entity.value.addonType || '';
    return t.startsWith('ridge_cresting_') || t === 'cresting' || entity.value.addonType === 'cresting';
});

const isSkylight = computed(() => {
    const t = entity.value.type || entity.value.addonType || '';
    return t.startsWith('skylight_') || t === 'skylight' || entity.value.addonType === 'skylight';
});

const addonIcon = computed(() => {
    if (isChimney.value) return '🧱';
    if (isFinial.value) return '🧭';
    if (isCresting.value) return '⚡';
    if (isSkylight.value) return '🪟';
    return '📐';
});

const addonTitle = computed(() => {
    if (isChimney.value) return 'Chimney Stack';
    if (isFinial.value) return 'Apex Finial';
    if (isCresting.value) return 'Ridge Cresting';
    if (isSkylight.value) return 'Roof Skylight';
    return 'Roof Addon';
});

const addonCategoryName = computed(() => {
    if (isChimney.value) return 'Chimney';
    if (isFinial.value) return 'Finial';
    if (isCresting.value) return 'Cresting';
    if (isSkylight.value) return 'Skylight';
    return 'Element';
});

const addonBadge = computed(() => {
    if (isChimney.value) return 'MASONRY';
    if (isFinial.value) return 'PEAK SCULPTURE';
    if (isCresting.value) return 'RIDGE IRONWORK';
    if (isSkylight.value) return 'GLASS INSET';
    return 'ADDON';
});

function onUpdate() {
    emit('sync-engine');
}

function onDelete() {
    // Remove addon from parent roof array if parent roof exists
    const pRoof = props.parentRoof || entity.value.parentRoof;
    if (pRoof) {
        const conf = pRoof.config || pRoof;
        if (isChimney.value && Array.isArray(conf.chimneys)) {
            const idx = conf.chimneys.indexOf(entity.value);
            if (idx !== -1) conf.chimneys.splice(idx, 1);
        } else if (isFinial.value && Array.isArray(conf.finials)) {
            const idx = conf.finials.indexOf(entity.value);
            if (idx !== -1) conf.finials.splice(idx, 1);
        } else if (isCresting.value && Array.isArray(conf.crestings)) {
            const idx = conf.crestings.indexOf(entity.value);
            if (idx !== -1) conf.crestings.splice(idx, 1);
        } else if (isSkylight.value && Array.isArray(conf.skylights)) {
            const idx = conf.skylights.indexOf(entity.value);
            if (idx !== -1) conf.skylights.splice(idx, 1);
        }
    }
    emit('delete-entity');
    emit('sync-engine');
}
</script>

<style scoped>
.roof-addon-properties {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 10px 0;
}

.addon-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: #0f172a;
    border-radius: 8px;
    color: white;
}

.addon-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.addon-icon {
    font-size: 16px;
}

.addon-title {
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.3px;
}

.addon-badge {
    font-size: 9px;
    font-weight: 800;
    padding: 2px 6px;
    border-radius: 4px;
    background: #22c55e;
    color: #0f172a;
    letter-spacing: 0.5px;
}

.addon-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.props-subtitle {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
    margin: 4px 0 2px 0;
    letter-spacing: 0.5px;
}

.control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.control-group label {
    font-size: 11px;
    font-weight: 600;
    color: #334155;
}

.btn-micro-action {
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    color: #2563eb;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
}

.btn-micro-action:hover {
    background: #2563eb;
    color: white;
}

.window-toggle-box {
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.toggle-label {
    font-size: 11px;
    font-weight: 600;
    color: #1e293b;
}

.toggle-btn {
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 4px;
    border: 1px solid #cbd5e1;
    background: #e2e8f0;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
}

.toggle-btn.active {
    background: #dcfce7;
    border-color: #86efac;
    color: #15803d;
}

.window-sub-controls {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px solid #e2e8f0;
    padding-top: 6px;
}

.dim-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
}

.settings-input,
.settings-select {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    background: #f8fafc;
    color: #0f172a;
    outline: none;
    box-sizing: border-box;
}

.settings-input:focus,
.settings-select:focus {
    border-color: #3b82f6;
    background: white;
}

.slider-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.settings-slider {
    flex: 1;
    cursor: pointer;
}

.slider-val {
    font-size: 11px;
    font-weight: 700;
    color: #475569;
    min-width: 32px;
    text-align: right;
}

.btn-delete-addon {
    width: 100%;
    padding: 9px;
    background: #fee2e2;
    color: #ef4444;
    border: 1px solid #fca5a5;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: 8px;
}

.btn-delete-addon:hover {
    background: #ef4444;
    color: white;
}
</style>
