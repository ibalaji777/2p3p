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

        <!-- 1. DORMER CONTROLS -->
        <div v-if="isDormer" class="addon-section">
            <h4 class="props-subtitle">Dormer Style</h4>
            <div class="control-group">
                <label>Style Architecture</label>
                <select v-model="entity.type" class="settings-select" @change="onUpdate">
                    <option value="dormer_gable">Gable (A-Frame Classic)</option>
                    <option value="dormer_shed">Shed (Slanted Modern)</option>
                    <option value="dormer_hip">Hip (3-Sided Heritage)</option>
                    <option value="dormer_barrel">Barrel Vault (Semicircular)</option>
                </select>
            </div>

            <h4 class="props-subtitle">Window Assembly Component</h4>
            <div class="window-toggle-box">
                <div class="toggle-row">
                    <span class="toggle-label">Include Window In Dormer</span>
                    <button class="toggle-btn" :class="{ 'active': entity.hasWindow !== false }" @click="toggleWindow">
                        {{ entity.hasWindow !== false ? '✓ Window Active' : '✕ No Window (Solid Wall)' }}
                    </button>
                </div>
                <div v-if="entity.hasWindow !== false" class="window-sub-controls">
                    <div class="control-group">
                        <label>Window Frame Finish</label>
                        <select v-model="entity.frameMaterial" class="settings-select" @change="onUpdate">
                            <option value="white_paint">Clean White Plaster / Vinyl</option>
                            <option value="metal_dark_steel">Charcoal Dark Steel</option>
                            <option value="dark_wood">Dark Stained Oak Wood</option>
                            <option value="metal_bronze">Antique Bronze Metal</option>
                            <option value="galvanized_steel">Galvanized Silver</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Glazing Pane</label>
                        <select v-model="entity.glassMaterial" class="settings-select" @change="onUpdate">
                            <option value="glass">Clear Transparent Float Glass</option>
                            <option value="reflective_glass">Reflective Blue Sky Glass</option>
                            <option value="frosted_glass">Frosted Privacy Glass</option>
                        </select>
                    </div>
                </div>
            </div>

            <h4 class="props-subtitle">Dimensions (cm)</h4>
            <div class="dim-grid">
                <div class="control-group">
                    <label>Width</label>
                    <input type="number" v-model.number="entity.width" min="50" max="300" step="5" class="settings-input" @input="onUpdate" />
                </div>
                <div class="control-group">
                    <label>Height</label>
                    <input type="number" v-model.number="entity.height" min="40" max="200" step="5" class="settings-input" @input="onUpdate" />
                </div>
                <div class="control-group">
                    <label>Depth</label>
                    <input type="number" v-model.number="entity.depth" min="50" max="300" step="5" class="settings-input" @input="onUpdate" />
                </div>
            </div>

            <h4 class="props-subtitle">Position On Roof Slope</h4>
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
                    <span class="slider-val">{{ Math.round((entity.v || 0.3) * 100) }}%</span>
                </div>
            </div>

            <h4 class="props-subtitle">Materials & Siding</h4>
            <div class="control-group">
                <div class="label-row">
                    <label>Cheek Sidewalls & Front</label>
                    <button class="btn-micro-action" @click="matchOuterWall">Match Walls</button>
                </div>
                <select v-model="entity.sidingMaterial" class="settings-select" @change="onUpdate">
                    <option value="wood_siding">White Wood Siding</option>
                    <option value="white_paint">Clean White Wall Plaster</option>
                    <option value="cream_siding">Cream Siding</option>
                    <option value="red_brick">Red Brick Wall</option>
                    <option value="rough_stone">Rustic Stone Wall</option>
                    <option value="dark_wood">Dark Wood Siding</option>
                    <option value="limestone">Limestone Ashlar</option>
                </select>
            </div>
            <div class="control-group">
                <div class="label-row">
                    <label>Dormer Mini Roof Material</label>
                    <button class="btn-micro-action" @click="matchMainRoof">Match Main Roof</button>
                </div>
                <select v-model="entity.roofMaterial" class="settings-select" @change="onUpdate">
                    <option value="">Match Main Roof</option>
                    <option value="terracotta_tiles_roof">Terracotta Clay Tiles</option>
                    <option value="terracotta_red_roof">Terracotta Red Tiles</option>
                    <option value="terracotta_green_roof">Terracotta Green Tiles</option>
                    <option value="grey_slate_roof">Grey Slate Tiles</option>
                    <option value="dark_asphalt_roof">Dark Asphalt Shingles</option>
                    <option value="white_gravel_roof">White Gravel Mineral</option>
                    <option value="blue_ceramic_tiles_roof">Blue Ceramic Tiles</option>
                    <option value="standing_seam_metal">Standing Seam Metal</option>
                    <option value="wood_shake">Cedar Wood Shake</option>
                    <option value="glass_roof_square_grid">Square Grid Glass</option>
                </select>
            </div>
            <div class="control-group">
                <label>Bargeboards / Trim / Fascia</label>
                <select v-model="entity.trimMaterial" class="settings-select" @change="onUpdate">
                    <option value="white_paint">Clean White</option>
                    <option value="metal_dark_steel">Charcoal Dark Steel</option>
                    <option value="dark_wood">Dark Stained Oak</option>
                    <option value="galvanized_steel">Galvanized Silver</option>
                </select>
            </div>
        </div>

        <!-- 2. CHIMNEY CONTROLS -->
        <div v-else-if="isChimney" class="addon-section">
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

const isDormer = computed(() => {
    const t = entity.value.type || entity.value.addonType || '';
    return t.startsWith('dormer_') || t === 'dormer' || entity.value.addonType === 'dormer';
});

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
    if (isDormer.value) return '🏠';
    if (isChimney.value) return '🧱';
    if (isFinial.value) return '🧭';
    if (isCresting.value) return '⚡';
    if (isSkylight.value) return '🪟';
    return '📐';
});

const addonTitle = computed(() => {
    if (isDormer.value) return 'Roof Dormer';
    if (isChimney.value) return 'Chimney Stack';
    if (isFinial.value) return 'Apex Finial';
    if (isCresting.value) return 'Ridge Cresting';
    if (isSkylight.value) return 'Roof Skylight';
    return 'Roof Addon';
});

const addonCategoryName = computed(() => {
    if (isDormer.value) return 'Dormer';
    if (isChimney.value) return 'Chimney';
    if (isFinial.value) return 'Finial';
    if (isCresting.value) return 'Cresting';
    if (isSkylight.value) return 'Skylight';
    return 'Element';
});

const addonBadge = computed(() => {
    if (isDormer.value) return 'SIMS 4 DORMER';
    if (isChimney.value) return 'MASONRY';
    if (isFinial.value) return 'PEAK SCULPTURE';
    if (isCresting.value) return 'RIDGE IRONWORK';
    if (isSkylight.value) return 'GLASS INSET';
    return 'ADDON';
});

function toggleWindow() {
    if (entity.value.hasWindow === undefined) {
        entity.value.hasWindow = false;
    } else {
        entity.value.hasWindow = !entity.value.hasWindow;
    }
    onUpdate();
}

function matchMainRoof() {
    const pRoof = props.parentRoof || entity.value.parentRoof;
    const mat = pRoof?.config?.material || pRoof?.material || '';
    entity.value.roofMaterial = mat;
    onUpdate();
}

function matchOuterWall() {
    const pRoof = props.parentRoof || entity.value.parentRoof;
    const planner = pRoof?.planner;
    let wallMat = 'wood_siding';
    if (planner?.walls) {
        const outerWall = planner.walls.find(w => w.type === 'outer' && (w.materialFront || w.material));
        if (outerWall) wallMat = outerWall.materialFront || outerWall.material;
    }
    entity.value.sidingMaterial = wallMat;
    onUpdate();
}

function onUpdate() {
    emit('sync-engine');
}

function onDelete() {
    // Remove addon from parent roof array if parent roof exists
    const pRoof = props.parentRoof || entity.value.parentRoof;
    if (pRoof) {
        const conf = pRoof.config || pRoof;
        if (isDormer.value && Array.isArray(conf.dormers)) {
            const idx = conf.dormers.indexOf(entity.value);
            if (idx !== -1) conf.dormers.splice(idx, 1);
        } else if (isChimney.value && Array.isArray(conf.chimneys)) {
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
