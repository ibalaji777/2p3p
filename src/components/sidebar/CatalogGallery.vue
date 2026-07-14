<template>
    <div class="catalog-gallery">
        <div class="catalog-header">
            <h3>{{ type === 'door' ? 'Door Catalog' : type === 'window' ? 'Window Catalog' : type === 'sunshade' ? 'Sunshade Catalog' : type === 'jali_panel' ? 'Jali Panel Catalog' : type === 'staircase' ? 'Staircase Catalog' : type === 'roof' ? 'Roof Catalog' : type === 'dormer' ? 'Dormer Catalog' : type === 'molding' ? 'Molding Catalog' : type === 'elevation_fascia' ? 'Fascia Catalog' : type === 'kitchen_catalog' ? 'Modular Kitchen' : type === 'sink_catalog' ? 'Sink Catalog' : type === 'tap_catalog' ? 'Tap Catalog' : 'Catalog' }}</h3>
            <div class="search-box">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input type="text" v-model="searchQuery" placeholder="Search models..." />
            </div>
        </div>

        <div class="catalog-grid">
            <div class="catalog-item" 
                 v-for="item in filteredItems" 
                 :key="item.id" 
                 :class="{ active: modelValue === item.id }"
                 @click="$emit('update:modelValue', item.id); $emit('select', item)">
                <div class="thumbnail-wrapper">
                    <img :src="item.image" :alt="item.name" @error="handleImageError" />
                    <div class="active-badge" v-if="modelValue === item.id">
                        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                </div>
                <span class="item-name">{{ item.name }}</span>
            </div>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { usePlannerStore } from '../../stores/usePlannerStore.js';

const props = defineProps({
    type: { type: String, required: true },
    modelValue: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'select']);

const searchQuery = ref('');
const plannerStore = usePlannerStore();

const doorCatalog = ref([
    { id: 'single', name: 'Single Hinged Door', image: '', params: { doorType: 'single', doorStyle: 'flat', width: 40 } },
    { id: 'french', name: 'Double French Door', image: '', params: { doorType: 'french', doorStyle: 'glass_grid', width: 80 } },
    { id: 'sliding', name: 'Sliding Glass Door', image: '', params: { doorType: 'sliding', doorStyle: 'glass_bottom_panel', width: 80 } },
    { id: 'pocket', name: 'Pocket Door', image: '', params: { doorType: 'pocket', doorStyle: 'flat', width: 40 } },
    { id: 'classic_4', name: 'Classic 4-Panel', image: '', params: { doorType: 'single', doorStyle: 'classic_4_panel', width: 40 } },
]);

const windowCatalog = ref([
    { id: 'sliding_std', name: 'Standard Sliding', image: '', params: { windowType: 'sliding_std', width: 60 } },
    { id: 'casement_std', name: 'Casement Window', image: '', params: { windowType: 'casement_std', width: 40 } },
    { id: 'fixed_elevation', name: 'Fixed Picture Window', image: '', params: { windowType: 'fixed_elevation', width: 80 } },
    { id: 'bay_box', name: 'Bay Window', image: '', params: { windowType: 'bay_box', width: 80 } },
    { id: 'panoramic_slider', name: 'Panoramic Slider', image: '', params: { windowType: 'panoramic_slider', width: 120 } },
]);

const sunshadeCatalog = ref([
    { id: 'concrete_slab', name: 'Concrete Slab', image: '', params: { chajjaType: 'concrete_slab', width: 60, depth: 40, thick: 4 } },
    { id: 'wooden_pergola', name: 'Wooden Pergola', image: '', params: { chajjaType: 'wooden_pergola', width: 80, depth: 50, thick: 8 } },
    { id: 'metal_louvers', name: 'Metal Louvers', image: '', params: { chajjaType: 'metal_louvers', width: 80, depth: 50, thick: 8 } },
    { id: 'glass_canopy', name: 'Glass Canopy', image: '', params: { chajjaType: 'glass_canopy', width: 60, depth: 40, thick: 3 } },
    { id: 'metal_canopy', name: 'Metal Canopy', image: '', params: { chajjaType: 'metal_canopy', width: 60, depth: 40, thick: 4 } },
    { id: 'curved_rcc', name: 'Curved RCC', image: '', params: { chajjaType: 'curved_rcc', width: 60, depth: 40, thick: 4 } },
]);

const jaliCatalog = ref([
    { id: 'square_grid', name: 'Square Grid', image: '', params: { pattern: 'square_grid', width: 40, height: 40 } },
    { id: 'geometric_honeycomb', name: 'Honeycomb', image: '', params: { pattern: 'geometric_honeycomb', width: 40, height: 40 } },
    { id: 'mughal_star', name: 'Mughal Star', image: '', params: { pattern: 'mughal_star', width: 40, height: 40 } },
    { id: 'floral_vine', name: 'Floral Vine', image: '', params: { pattern: 'floral_vine', width: 40, height: 40 } },
]);

const staircaseCatalog = ref([
    { id: 'stair_straight_solid', name: 'Solid Base (Wood)', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'solid', primaryColor: '#8b5a2b' } },
    { id: 'stair_straight_mono', name: 'Mono Stringer (Steel)', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'mono', primaryMaterial: 'steel', primaryColor: '#333333' } },
    { id: 'stair_straight_double', name: 'Double Stringer', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'double', primaryMaterial: 'wood', primaryColor: '#a67b5b' } },
    { id: 'stair_straight_side', name: 'Side Stringers', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'side', primaryMaterial: 'white_painted', primaryColor: '#ffffff' } },
    { id: 'stair_L_concrete', name: 'L-Shape (Solid Concrete)', image: '', toolId: 'staircase', params: { type: 'stair_v5_L', width: 40, length1: 80, length2: 80, height: 120, stringerType: 'solid', primaryMaterial: 'concrete', primaryColor: '#999999' } },
    { id: 'stair_L_mono', name: 'L-Shape (Mono Stringer)', image: '', toolId: 'staircase', params: { type: 'stair_v5_L', width: 40, length1: 80, length2: 80, height: 120, stringerType: 'mono', primaryMaterial: 'steel', primaryColor: '#444444' } },
    { id: 'stair_U_wood', name: 'U-Shape (Classic Box)', image: '', toolId: 'staircase', params: { type: 'stair_v5_U', width: 40, length1: 60, length2: 60, width2: 40, height: 120, stringerType: 'box', primaryColor: '#8b5a2b' } },
    { id: 'stair_T_marble', name: 'T-Shape (Solid Marble)', image: '', toolId: 'staircase', params: { type: 'stair_v5_T', width: 40, length1: 60, length2: 80, height: 120, stringerType: 'solid', primaryMaterial: 'marble', primaryColor: '#f5f5f5' } },
]);

const roofCatalog = ref([
    { id: 'roof_gable', name: 'Gable Roof', image: '', params: { roofType: 'gable', pitch: 30 } },
    { id: 'roof_hip', name: 'Hip Roof', image: '', params: { roofType: 'hip', pitch: 30 } },
    { id: 'roof_flat', name: 'Flat Roof', image: '', params: { roofType: 'flat', thick: 15 } },
]);


const dormerCatalog = ref([
    { id: 'preset_dormer_gable', name: 'Gable Dormer', image: '', params: { type: 'preset_dormer_gable', width: 120, depth: 150, wallHeight: 120, roofType: 'gable', pitch: 35, elevation: 250 } },
    { id: 'preset_dormer_shed', name: 'Shed Dormer', image: '', params: { type: 'preset_dormer_shed', width: 250, depth: 150, wallHeight: 120, roofType: 'flat', pitch: 15, elevation: 250 } },
    { id: 'preset_dormer_hip', name: 'Hip Dormer', image: '', params: { type: 'preset_dormer_hip', width: 120, depth: 150, wallHeight: 120, roofType: 'hip', pitch: 35, elevation: 250 } }
]);

const moldingCatalog = ref([
    { id: 'molding_band', name: 'Horizontal Band', image: '', params: { type: 'molding_band' } },
    { id: 'molding_crown', name: 'Crown Molding', image: '', params: { type: 'molding_crown' } },
    { id: 'molding_ogee', name: 'Ogee (Cyma) Molding', image: '', params: { type: 'molding_ogee' } },
    { id: 'molding_egg_and_dart', name: 'Egg and Dart Molding', image: '', params: { type: 'molding_egg_and_dart' } },
    { id: 'molding_dentil', name: 'Dentil Molding', image: '', params: { type: 'molding_dentil' } },
    { id: 'molding_craftsman', name: 'Step / Craftsman', image: '', params: { type: 'molding_craftsman' } },
    { id: 'molding_window', name: 'Window Frame', image: '', params: { type: 'molding_window' } },
    { id: 'molding_door', name: 'Door Frame', image: '', params: { type: 'molding_door' } },
    { id: 'molding_groove', name: 'Decorative Groove', image: '', params: { type: 'molding_groove' } },
    { id: 'molding_layered', name: 'Layered Projection', image: '', params: { type: 'molding_layered' } }
]);

const elevationFasciaCatalog = ref([
    { id: 'fascia_c_left', name: 'C-Shape (Left)', image: '', params: { type: 'elevation_fascia', profileType: 'c_shape_left' } },
    { id: 'fascia_c_right', name: 'C-Shape (Right)', image: '', params: { type: 'elevation_fascia', profileType: 'c_shape_right' } },
    { id: 'fascia_l_left', name: 'L-Shape (Left)', image: '', params: { type: 'elevation_fascia', profileType: 'l_shape_left' } },
    { id: 'fascia_l_right', name: 'L-Shape (Right)', image: '', params: { type: 'elevation_fascia', profileType: 'l_shape_right' } },
    { id: 'fascia_box', name: 'Full Box Frame', image: '', params: { type: 'elevation_fascia', profileType: 'full_box' } }
]);

const advanceOpeningsCatalog = ref([
    { id: 'adv_arch', name: 'Arch Opening', image: '', toolId: 'arch_opening', params: { type: 'arch_opening' } },
    { id: 'adv_circ', name: 'Circular & Oval', image: '', toolId: 'circular_opening', params: { type: 'circular_opening' } },
    { id: 'adv_custom', name: 'Custom Shape Cut', image: '', toolId: 'custom_shape_opening', params: { type: 'custom_shape_opening' } },
    { id: 'adv_niche', name: 'Niche & Recess', image: '', toolId: 'niche_recess', params: { type: 'niche_recess' } },
    { id: 'adv_pattern', name: 'Pattern Opening', image: '', toolId: 'pattern_opening', params: { type: 'pattern_opening' } },
    { id: 'adv_boolean', name: 'Boolean Cut', image: '', toolId: 'boolean_cut', params: { type: 'boolean_cut' } }
]);

const shapesCatalog = ref([
    { id: 'shape_box', name: 'Box (Rectangle)', image: '', toolId: 'shape_rect', params: { type: 'shape_rect' } },
    { id: 'shape_cyl', name: 'Cylinder (Circle)', image: '', toolId: 'shape_circle', params: { type: 'shape_circle' } },
    { id: 'shape_prism', name: 'Prism (Polygon)', image: '', toolId: 'shape_triangle', params: { type: 'shape_triangle' } }
]);

const wallsCatalog = ref([
    { id: 'wall_outer', name: 'Outer Wall', image: '', toolId: 'outer', params: { type: 'outer' } },
    { id: 'wall_inner', name: 'Inner Wall', image: '', toolId: 'inner', params: { type: 'inner' } },
    { id: 'wall_arc', name: 'Curved Wall (Arc)', image: '', toolId: 'arc', params: { type: 'arc' } }
]);

const railingCatalog = ref([
    { id: 'glass_stainless', name: 'Glass & Steel', image: '', toolId: 'railing', params: { type: 'glass_stainless' } },
    { id: 'glass_frameless', name: 'Frameless', image: '', toolId: 'railing', params: { type: 'glass_frameless' } },
    { id: 'metal_vertical', name: 'Vertical Metal', image: '', toolId: 'railing', params: { type: 'metal_vertical' } },
    { id: 'cable_stainless', name: 'Cable', image: '', toolId: 'railing', params: { type: 'cable_stainless' } },
    { id: 'wood_classic', name: 'Wood', image: '', toolId: 'railing', params: { type: 'wood_classic' } }
]);

const furnitureCatalog = ref([
    { id: 'bench', name: 'Bench', image: '', toolId: 'furniture', params: { type: 'table_dining' } }
]);

const kitchenCatalog = ref([
    { id: 'kitchen_straight', name: 'Straight Kitchen', image: '', toolId: 'kitchen', params: { type: 'kitchen_straight', width: 240, height: 90, depth: 60 } },
    { id: 'kitchen_l_shape', name: 'L-Shape Kitchen', image: '', toolId: 'kitchen', params: { type: 'kitchen_l_shape', width: 240, height: 90, depth: 240 } },
    { id: 'kitchen_u_shape', name: 'U-Shape Kitchen', image: '', toolId: 'kitchen', params: { type: 'kitchen_u_shape', width: 240, height: 90, depth: 240 } },
    { id: 'kitchen_straight_upper', name: 'Straight Upper Cabinets', image: '', toolId: 'kitchen', params: { type: 'kitchen_straight_upper', width: 240, height: 70, depth: 35 } },
    { id: 'kitchen_l_shape_upper', name: 'L-Shape Upper Cabinets', image: '', toolId: 'kitchen', params: { type: 'kitchen_l_shape_upper', width: 240, height: 70, depth: 240 } },
    { id: 'kitchen_u_shape_upper', name: 'U-Shape Upper Cabinets', image: '', toolId: 'kitchen', params: { type: 'kitchen_u_shape_upper', width: 240, height: 70, depth: 240 } }
]);

const sinkCatalog = ref([
    { id: 'sink_standard', name: 'Standard Metal Sink', image: '', toolId: 'furniture', params: { type: 'sink_standard', elevation: 90 } },
    { id: 'sink_double', name: 'Double Basin Sink', image: '', toolId: 'furniture', params: { type: 'sink_double', elevation: 90 } },
    { id: 'sink_farmhouse', name: 'Farmhouse Sink', image: '', toolId: 'furniture', params: { type: 'sink_farmhouse', elevation: 90 } }
]);

const tapCatalog = ref([
    { id: 'tap_modern', name: 'Modern Curved Faucet', image: '', toolId: 'furniture', params: { type: 'tap_modern', elevation: 90 } },
    { id: 'tap_industrial', name: 'Industrial Pull-Down', image: '', toolId: 'furniture', params: { type: 'tap_industrial', elevation: 90 } },
    { id: 'tap_classic', name: 'Classic Two-Handle', image: '', toolId: 'furniture', params: { type: 'tap_classic', elevation: 90 } }
]);

const items = computed(() => {
    if (props.type === 'door') return doorCatalog.value;
    if (props.type === 'window') return windowCatalog.value;
    if (props.type === 'sunshade') return sunshadeCatalog.value;
    if (props.type === 'jali_panel') return jaliCatalog.value;
    if (props.type === 'staircase') return staircaseCatalog.value;
    if (props.type === 'roof') return roofCatalog.value;
    if (props.type === 'dormer') return dormerCatalog.value;
    if (props.type === 'molding') return moldingCatalog.value;
    if (props.type === 'elevation_fascia') return elevationFasciaCatalog.value;
    if (props.type === 'adv_opening_catalog') return advanceOpeningsCatalog.value;
    if (props.type === 'shape_catalog') return shapesCatalog.value;
    if (props.type === 'wall_catalog') return wallsCatalog.value;
    if (props.type === 'railing_catalog') return railingCatalog.value;
    if (props.type === 'furniture_catalog') return furnitureCatalog.value;
    if (props.type === 'kitchen_catalog') return kitchenCatalog.value;
    if (props.type === 'sink_catalog') return sinkCatalog.value;
    if (props.type === 'tap_catalog') return tapCatalog.value;
    return [];
});

const filteredItems = computed(() => {
    if (!searchQuery.value) return items.value;
    const q = searchQuery.value.toLowerCase();
    return items.value.filter(i => i.name.toLowerCase().includes(q));
});

let isGenerating = false;
const generateThumbnails = async () => {
    if (isGenerating) return;
    isGenerating = true;
    try {
        const renderer = plannerStore.renderer3D;
        if (!renderer || !renderer.thumbnailGenerator) return;

        const list = items.value;
        for (const item of list) {
            if (!item.image) {
                try {
                    await new Promise(r => setTimeout(r, 10));
                    const genType = (item.params && item.params.type) ? item.params.type : (item.toolId ? item.toolId : props.type);
                    const dataUrl = await renderer.thumbnailGenerator.generate(genType, item.params);
                    if (dataUrl) item.image = dataUrl;
                } catch (err) {
                    console.error("Failed to generate thumbnail for", item.name, err);
                }
            }
        }
    } finally {
        isGenerating = false;
    }
};

watch(() => plannerStore.renderer3D, (newRenderer) => {
    if (newRenderer) {
        generateThumbnails();
    }
}, { immediate: true });

watch(() => props.type, () => {
    generateThumbnails();
});

const handleImageError = (e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
};
</script>

<style scoped>
.catalog-gallery {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: #f8fafc;
    border-radius: 8px;
    overflow: hidden;
}

.catalog-header {
    padding: 12px;
    background: white;
    border-bottom: 1px solid #e2e8f0;
}

.catalog-header h3 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #1e293b;
    font-weight: 600;
}

.search-box {
    position: relative;
    display: flex;
    align-items: center;
}

.search-icon {
    position: absolute;
    left: 8px;
    width: 14px;
    height: 14px;
    color: #94a3b8;
}

.search-box input {
    width: 100%;
    padding: 8px 8px 8px 28px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    outline: none;
    transition: border-color 0.2s;
}

.search-box input:focus {
    border-color: #3b82f6;
}

.catalog-grid {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    align-content: start;
}

.catalog-item {
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 6px;
    transition: transform 0.2s;
}

.catalog-item:hover .thumbnail-wrapper {
    border-color: #93c5fd;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.thumbnail-wrapper {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    border-radius: 8px;
    border: 2px solid transparent;
    background: white;
    overflow: hidden;
    transition: all 0.2s;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
}

.thumbnail-wrapper img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.catalog-item.active .thumbnail-wrapper {
    border-color: #3b82f6;
}

.active-badge {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    background: #3b82f6;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
}

.active-badge svg {
    width: 12px;
    height: 12px;
}

.item-name {
    font-size: 11px;
    color: #475569;
    text-align: center;
    line-height: 1.2;
    font-weight: 500;
}
</style>
