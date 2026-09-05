<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle" v-if="selectedEntity.type === 'railing'">Railing Properties</h4>
        <h4 class="props-subtitle" v-else-if="selectedEntity.type === 'foundation'">Foundation Wall (Plinth) Properties</h4>
        <h4 class="props-subtitle" v-else-if="selectedEntity.type === 'half_wall'">Half Wall / Parapet Properties</h4>
        <h4 class="props-subtitle" v-else-if="selectedEntity.type === 'compound'">Compound Wall Properties</h4>
        <h4 class="props-subtitle" v-else-if="selectedEntity.parentArc || selectedEntity.type === 'arc'">Curved Wall Properties</h4>
        <h4 class="props-subtitle" v-else>Wall Properties</h4>
        
        <div class="control-group" v-if="selectedEntity.type === 'compound'">
            <label>Include Floor Slab</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="selectedEntity.hasFloor" @change="onCompoundFloorToggle">
            </div>
        </div>
        
        <div class="control-group">
            <label>Hidden Wall</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="selectedEntity.hidden" @change="$emit('sync-engine')">
            </div>
        </div>
        
        <div class="control-group">
            <label>Thickness</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.thickness" min="1" max="100" step="1" @change="$emit('sync-engine')" />
            </div>
        </div>
        
        <!-- Sims 4 Interactive 3D Wall Operations -->
        <div class="sims4-wall-ops-box" v-if="selectedEntity.type !== 'railing'">
            <div class="ops-header">Sims 4 Wall Operations</div>
            <div class="ops-btn-grid">
                <button class="ops-btn" @click="onSplitWall" title="Split wall into two connected segments">
                    ✂️ Split
                </button>
                <button class="ops-btn" @click="onExtrudeBay" title="Extrude middle section outward (Bay Window)">
                    🏛️ Extrude (+30)
                </button>
                <button class="ops-btn" @click="onRecessNiche" title="Recess middle section inward (Niche Alcove)">
                    🔲 Recess (-20)
                </button>
            </div>
        </div>

        <div class="control-group" v-if="selectedEntity.type !== 'railing'" style="flex-direction: column; align-items: flex-start;">
            <label style="margin-bottom: 8px;">Top Profile Type</label>
            <div style="display: flex; gap: 8px; width: 100%;">
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: (!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal') ? '#e5e7eb' : 'white', borderColor: (!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal') ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.topProfileType = 'normal'; $emit('sync-engine')" title="Normal Wall">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="16" rx="2" ry="2"></rect></svg>
                </button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.topProfileType === 'single' ? '#e5e7eb' : 'white', borderColor: selectedEntity.topProfileType === 'single' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.topProfileType = 'single'; $emit('sync-engine')" title="Single Slope">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16V6l-16 8v8z"></path></svg>
                </button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: selectedEntity.topProfileType === 'gable' ? '#e5e7eb' : 'white', borderColor: selectedEntity.topProfileType === 'gable' ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.topProfileType = 'gable'; $emit('sync-engine')" title="Gable Slope">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16V10L12 4 4 10v12z"></path></svg>
                </button>
            </div>
        </div>

        <div v-if="!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal' || selectedEntity.type === 'railing'" class="control-group">
            <label>Height</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="$emit('sync-engine')">
                <DimensionInput v-model="selectedEntity.height" min="0" max="500" step="1" @change="$emit('sync-engine')" />
            </div>
        </div>

        <div v-if="selectedEntity.type === 'foundation'" class="control-group" style="margin-top: -6px;">
            <label style="font-size: 11px; color: #64748b;">Plinth Presets</label>
            <div style="display: flex; gap: 6px; width: 100%;">
                <button v-for="h in [20, 40, 60, 80]" :key="h" 
                        type="button"
                        class="preset-chip-btn" 
                        :class="{ active: selectedEntity.height === h }"
                        @click="selectedEntity.height = h; $emit('sync-engine')">
                    {{ h }} cm
                </button>
            </div>
        </div>

        <div v-if="selectedEntity.type === 'half_wall'" class="control-group" style="margin-top: -6px;">
            <label style="font-size: 11px; color: #64748b;">Parapet Presets</label>
            <div style="display: flex; gap: 6px; width: 100%;">
                <button v-for="h in [30, 50, 80, 100]" :key="h" 
                        type="button"
                        class="preset-chip-btn" 
                        :class="{ active: selectedEntity.height === h }"
                        @click="selectedEntity.height = h; $emit('sync-engine')">
                    {{ h }} cm
                </button>
            </div>
        </div>

        <template v-else>
            <div class="control-group">
                <label>Start Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.startHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                    <DimensionInput v-model="selectedEntity.startHeight" min="0" max="500" step="1" @change="$emit('sync-engine')" />
                </div>
            </div>
            <div class="control-group" v-if="selectedEntity.topProfileType === 'gable'">
                <label>Peak Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.peakHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                    <DimensionInput v-model="selectedEntity.peakHeight" min="0" max="500" step="1" @change="$emit('sync-engine')" />
                </div>
            </div>
            <div class="control-group">
                <label>End Height</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="selectedEntity.endHeight" min="0" max="500" step="1" @input="$emit('sync-engine')">
                    <DimensionInput v-model="selectedEntity.endHeight" min="0" max="500" step="1" @change="$emit('sync-engine')" />
                </div>
            </div>
            <div class="control-group">
                <label>Slope Direction</label>
                <div style="display: flex; gap: 8px;">
                    <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: !selectedEntity.flipSlope ? '#e5e7eb' : 'white', borderColor: !selectedEntity.flipSlope ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.flipSlope = false; $emit('sync-engine')">Default</button>
                    <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: selectedEntity.flipSlope ? '#e5e7eb' : 'white', borderColor: selectedEntity.flipSlope ? '#9ca3af' : '#d1d5db' }" @click="selectedEntity.flipSlope = true; $emit('sync-engine')">Flipped</button>
                </div>
            </div>
        </template>

        <div v-if="selectedEntity.type === 'railing'">
            <div class="decor-gallery">
                <h4 class="props-subtitle">Railing Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in railingRegistry" :key="key" class="decor-item" @click="selectedEntity.configId = key; $emit('ui-trigger'); $emit('sync-engine')" :class="{ active: (selectedEntity.configId || 'glass_frameless') === key && uiTrigger !== -1 }">
                        <img :src="railingThumbnails[key]" @error="handleImageError" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>
        <div v-else>
            <h4 class="props-subtitle">{{ selectedWallSide === 'front' ? 'Inner Wall Face' : 'Outer Wall Face' }}</h4>

            <!-- Sims 4 Paint Scope Selector (3D View) -->
            <div class="paint-scope-box" v-if="viewMode === '3d'">
                <div class="paint-scope-title">Paint Application Mode:</div>
                <div class="paint-scope-btn-group">
                    <button 
                        class="paint-scope-btn" 
                        :class="{ active: paintScope === 'single' }" 
                        @click="paintScope = 'single'"
                        title="Paint clicked face only"
                    >
                        🧱 Single
                    </button>
                    <button 
                        class="paint-scope-btn" 
                        :class="{ active: paintScope === 'room' }" 
                        @click="paintScope = 'room'"
                        title="Paint all interior walls of this room (Shortcut: Hold Shift)"
                    >
                        🔄 Room (Shift)
                    </button>
                    <button 
                        class="paint-scope-btn" 
                        :class="{ active: paintScope === 'exterior' }" 
                        @click="paintScope = 'exterior'"
                        title="Paint entire exterior facade (Shortcut: Hold Alt)"
                    >
                        🌐 Exterior (Alt)
                    </button>
                </div>
            </div>
            
            <div v-if="currentFaceDecors.length > 0">
                <div class="applied-list">
                    <div v-for="decor in currentFaceDecors" :key="decor.id" class="applied-item-wrapper">
                        <div class="applied-item-header" :class="{active: activeDecorId === decor.id}" @click="$emit('toggle-edit-decor', decor.id)">
                            <span>{{ wallDecorRegistry[decor.configId]?.name }}</span>
                            <button class="btn-sm-delete" @click.stop="$emit('delete-specific-decor', decor)">✕</button>
                        </div>
                        <div class="applied-item-body" v-if="activeDecorId === decor.id">
                            <div class="faceRow" v-if="decor.faces">
                                <label><input type="checkbox" v-model="decor.faces.left" @change="$emit('decor-update', decor)">L-Edge</label>
                                <label><input type="checkbox" v-model="decor.faces.right" @change="$emit('decor-update', decor)">R-Edge</label>
                            </div>
                            <MaterialSizeInput v-model="decor.tileSize" :defaultMax="200" @change="$emit('decor-update', decor)" />
                            <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.width" min="1" max="100" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.width" min="1" max="100" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.height" min="1" max="100" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.height" min="1" max="100" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localX" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.localX" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"></div></div>
                            <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localY" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.localY" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"></div></div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="decor-gallery" v-if="viewMode === '3d'">
                <h4 class="props-subtitle">Add Pattern Layer</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('spawn-wall-pattern', key)">
                        <img :src="config.thumbnail" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete {{ selectedEntity.type === 'railing' ? 'Railing' : ((selectedEntity.parentArc || selectedEntity.type === 'arc') ? 'Curved Wall' : 'Wall') }}</button>
    </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlannerStore } from '../../stores/usePlannerStore.js';
import DimensionInput from '../../components/common/DimensionInput.vue';
import MaterialSizeInput from '../../components/common/MaterialSizeInput.vue';
import { WallReformer } from '../../core/engine2d/WallReformer.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    selectedWallSide: { type: String, required: false },
    currentFaceDecors: { type: Array, default: () => [] },
    activeDecorId: { type: String, default: null },
    wallDecorRegistry: { type: Object, required: true },
    railingRegistry: { type: Object, required: true },
    uiTrigger: { type: Number, default: 0 },
    viewMode: { type: String, default: '2d' }
});

const emit = defineEmits([
    'sync-engine',
    'ui-trigger',
    'toggle-edit-decor',
    'delete-specific-decor',
    'decor-update',
    'spawn-wall-pattern',
    'delete-entity'
]);

const plannerStore = usePlannerStore();
const { paintScope } = storeToRefs(plannerStore);
const railingThumbnails = ref({});

let previousScope = 'single';

const onSplitWall = () => {
    const planner = plannerStore.planner || window.plannerInstance;
    if (!planner || !props.selectedEntity) return;
    const p1 = (props.selectedEntity.startAnchor && typeof props.selectedEntity.startAnchor.position === 'function') ? props.selectedEntity.startAnchor.position() : (props.selectedEntity.startAnchor || { x: props.selectedEntity.startX || 0, y: props.selectedEntity.startY || 0 });
    const p2 = (props.selectedEntity.endAnchor && typeof props.selectedEntity.endAnchor.position === 'function') ? props.selectedEntity.endAnchor.position() : (props.selectedEntity.endAnchor || { x: props.selectedEntity.endX || 0, y: props.selectedEntity.endY || 0 });
    const midPt = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    WallReformer.splitWallAtPoint(planner, props.selectedEntity, midPt);
    emit('sync-engine');
};

const onExtrudeBay = () => {
    const planner = plannerStore.planner || window.plannerInstance;
    if (!planner || !props.selectedEntity) return;
    WallReformer.extrudeWallSegment(planner, props.selectedEntity, 0.25, 0.75, 30);
    emit('sync-engine');
};

const onRecessNiche = () => {
    const planner = plannerStore.planner || window.plannerInstance;
    if (!planner || !props.selectedEntity) return;
    WallReformer.extrudeWallSegment(planner, props.selectedEntity, 0.25, 0.75, -20);
    emit('sync-engine');
};

const handleKeyDown = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'Shift' && paintScope.value !== 'room') {
        previousScope = paintScope.value;
        paintScope.value = 'room';
    } else if (e.key === 'Alt' && paintScope.value !== 'exterior') {
        previousScope = paintScope.value;
        paintScope.value = 'exterior';
    }
};

const handleKeyUp = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'Shift' || e.key === 'Alt') {
        paintScope.value = previousScope || 'single';
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
});

const onCompoundFloorToggle = () => {
    const val = !!props.selectedEntity.hasFloor;
    const planner = plannerStore.planner;
    if (planner && planner.walls) {
        planner.walls.forEach(w => {
            if (w.type === 'compound') {
                w.hasFloor = val;
            }
        });
    }
    emit('sync-engine');
};

const generateThumbnails = async () => {
    const renderer = plannerStore.renderer3D;
    if (!renderer || !renderer.thumbnailGenerator) return;
    
    for (const key in props.railingRegistry) {
        if (!railingThumbnails.value[key]) {
            try {
                await new Promise(r => setTimeout(r, 10));
                const dataUrl = await renderer.thumbnailGenerator.generate(key, props.railingRegistry[key]);
                if (dataUrl) railingThumbnails.value[key] = dataUrl;
            } catch(e) {
                console.error("Failed to generate railing thumbnail for", key, e);
            }
        }
    }
};

const handleImageError = (e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
};

watch(() => props.selectedEntity, (newVal) => {
    if (newVal && newVal.type === 'railing') {
        generateThumbnails();
    }
}, { immediate: true });

watch(() => plannerStore.renderer3D, (newRenderer) => {
    if (newRenderer && props.selectedEntity && props.selectedEntity.type === 'railing') {
        generateThumbnails();
    }
});
</script>

<style scoped>
.paint-scope-box {
    margin: 12px 0 16px 0;
    padding: 10px 12px;
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 8px;
}

.paint-scope-title {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #94a3b8;
    margin-bottom: 8px;
}

.paint-scope-btn-group {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
}

.paint-scope-btn {
    padding: 6px 4px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    background: rgba(15, 23, 42, 0.7);
    border: 1px solid rgba(255, 255, 255, 0.12);
    color: #cbd5e1;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    text-align: center;
}

.paint-scope-btn:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: #ffffff;
}

.paint-scope-btn.active {
    background: #0ea5e9;
    border-color: #38bdf8;
    color: #ffffff;
    box-shadow: 0 0 12px rgba(14, 165, 233, 0.45);
}

.sims4-wall-ops-box {
    margin: 10px 0 14px 0;
    padding: 10px 12px;
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
}

.ops-header {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475569;
    margin-bottom: 8px;
}

.ops-btn-grid {
    display: grid;
    grid-template-columns: 1fr 1.2fr 1.2fr;
    gap: 6px;
}

.ops-btn {
    padding: 7px 4px;
    font-size: 11px;
    font-weight: 700;
    border-radius: 6px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    color: #1e293b;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
    white-space: nowrap;
}

.ops-btn:hover {
    background: #0ea5e9;
    border-color: #0284c7;
    color: #ffffff;
    box-shadow: 0 2px 8px rgba(14, 165, 233, 0.35);
}

.preset-chip-btn {
    flex: 1;
    padding: 4px 6px;
    font-size: 11px;
    font-weight: 600;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #f8fafc;
    color: #334155;
    cursor: pointer;
    transition: all 0.15s;
    text-align: center;
}

.preset-chip-btn:hover {
    background: #e2e8f0;
    border-color: #94a3b8;
}

.preset-chip-btn.active {
    background: #0284c7;
    color: white;
    border-color: #0284c7;
}
</style>
