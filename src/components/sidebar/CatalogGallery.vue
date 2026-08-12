<template>
    <div class="catalog-gallery">
        <!-- Catalog Sub-Section Header (Title + Search + Sort & Filter Controls) -->
        <div class="catalog-header-strip">
            <div class="header-top-row">
                <h3 class="section-title">{{ getCatalogHeaderTitle() }}</h3>
                <div class="header-actions">
                    <!-- Interactive Sort Dropdown Menu -->
                    <div class="header-popover-wrapper">
                        <button class="sort-dropdown-chip" @click.stop="sortMenuOpen = !sortMenuOpen; filterMenuOpen = false" :class="{ active: sortMenuOpen }" title="Sort Models">
                            <span>{{ sortLabel }}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" :style="{ transform: sortMenuOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }"><polyline points="6 9 12 15 18 9"></polyline></svg>
                        </button>

                        <div class="action-popover sort-popover" v-if="sortMenuOpen" @click.stop>
                            <button class="popover-item" :class="{ active: sortOption === 'popular' }" @click="sortOption = 'popular'; sortMenuOpen = false">
                                <span>Popular (Favorites)</span>
                                <svg v-if="sortOption === 'popular'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button class="popover-item" :class="{ active: sortOption === 'name_asc' }" @click="sortOption = 'name_asc'; sortMenuOpen = false">
                                <span>Name (A - Z)</span>
                                <svg v-if="sortOption === 'name_asc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button class="popover-item" :class="{ active: sortOption === 'name_desc' }" @click="sortOption = 'name_desc'; sortMenuOpen = false">
                                <span>Name (Z - A)</span>
                                <svg v-if="sortOption === 'name_desc'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button class="popover-item" :class="{ active: sortOption === 'recent' }" @click="sortOption = 'recent'; sortMenuOpen = false">
                                <span>Newest First</span>
                                <svg v-if="sortOption === 'recent'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                        </div>
                    </div>

                    <!-- Interactive Filter Popover Menu -->
                    <div class="header-popover-wrapper">
                        <button class="filter-icon-btn" @click.stop="filterMenuOpen = !filterMenuOpen; sortMenuOpen = false" :class="{ active: filterMenuOpen || filterOption !== 'all' }" title="Filter Catalog">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" :stroke="(filterMenuOpen || filterOption !== 'all') ? '#2563eb' : 'currentColor'" stroke-width="2"><line x1="4" y1="21" x2="4" y2="14"></line><line x1="4" y1="10" x2="4" y2="3"></line><line x1="12" y1="21" x2="12" y2="12"></line><line x1="12" y1="8" x2="12" y2="3"></line><line x1="20" y1="21" x2="20" y2="16"></line><line x1="20" y1="12" x2="20" y2="3"></line><line x1="1" y1="14" x2="7" y2="14"></line><line x1="9" y1="8" x2="15" y2="8"></line><line x1="17" y1="16" x2="23" y2="16"></line></svg>
                            <span v-if="filterOption !== 'all'" class="filter-active-dot"></span>
                        </button>

                        <div class="action-popover filter-popover" v-if="filterMenuOpen" @click.stop>
                            <div class="popover-header">Filter Catalog</div>
                            <button class="popover-item" :class="{ active: filterOption === 'all' }" @click="filterOption = 'all'; filterMenuOpen = false">
                                <span>All Models</span>
                                <svg v-if="filterOption === 'all'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button class="popover-item" :class="{ active: filterOption === 'favorites' }" @click="filterOption = 'favorites'; filterMenuOpen = false">
                                <span>❤️ Favorites Only</span>
                                <svg v-if="filterOption === 'favorites'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button class="popover-item" :class="{ active: filterOption === 'standard' }" @click="filterOption = 'standard'; filterMenuOpen = false">
                                <span>Standard / Single</span>
                                <svg v-if="filterOption === 'standard'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                            <button class="popover-item" :class="{ active: filterOption === 'wide' }" @click="filterOption = 'wide'; filterMenuOpen = false">
                                <span>Wide / Double & Sliding</span>
                                <svg v-if="filterOption === 'wide'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Integrated Catalog Search Bar -->
            <div class="catalog-search-wrap">
                <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2.2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                <input 
                    type="text" 
                    v-model="localSearchQuery" 
                    :placeholder="'🔍 Search ' + getCatalogHeaderTitle().toLowerCase() + '...'" 
                    class="catalog-search-input"
                />
                <button class="clear-search-btn" v-if="localSearchQuery" @click="localSearchQuery = ''">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Quick Category Filter Chips (Door & Openings) -->
            <div class="category-chips-bar" v-if="props.type === 'door'">
                <button class="chip-btn" :class="{ active: activeCategoryChip === 'all' }" @click="activeCategoryChip = 'all'">All</button>
                <button class="chip-btn" :class="{ active: activeCategoryChip === 'favorites' }" @click="activeCategoryChip = 'favorites'">❤️ Favorites</button>
                <button class="chip-btn" :class="{ active: activeCategoryChip === 'wood' }" @click="activeCategoryChip = 'wood'">Wood</button>
                <button class="chip-btn" :class="{ active: activeCategoryChip === 'glass' }" @click="activeCategoryChip = 'glass'">Glass</button>
                <button class="chip-btn" :class="{ active: activeCategoryChip === 'single' }" @click="activeCategoryChip = 'single'">Single</button>
                <button class="chip-btn" :class="{ active: activeCategoryChip === 'double' }" @click="activeCategoryChip = 'double'">Double</button>
            </div>
        </div>

        <!-- Responsive Product Cards Grid -->
        <div class="products-grid" v-if="filteredItems && filteredItems.length > 0">
            <template v-for="item in filteredItems" :key="item.id">
                <div v-if="item.isDivider" class="catalog-divider">
                    {{ item.name }}
                </div>
                <div v-else 
                     class="product-card" 
                     :class="{ active: modelValue === item.id }"
                     @click="$emit('update:modelValue', item.id); $emit('select', { ...item, toolId: item.toolId || type })">
                     
                    <!-- Top Left Redesigned Category Badge Pill -->
                    <span class="card-badge" v-if="item.badge" :class="getBadgeClass(item.badge)">
                        <template v-if="item.badge === 'BESTSELLER'">★ BESTSELLER</template>
                        <template v-else-if="item.badge === 'POPULAR'">🔵 POPULAR</template>
                        <template v-else-if="item.badge === 'GLASS'">🟢 GLASS</template>
                        <template v-else-if="item.badge === 'WOOD'">🟡 WOOD</template>
                        <template v-else-if="item.badge === 'NEW'">🔷 NEW</template>
                        <template v-else-if="item.badge === 'COMPACT'">🟠 COMPACT</template>
                        <template v-else>{{ item.badge }}</template>
                    </span>

                    <!-- Top Right Circular White Glass Favorite Heart Button -->
                    <button class="favorite-heart-btn" :class="{ 'is-active': isFavorite(item.id) }" @click.stop="toggleFavorite(item.id)" :title="isFavorite(item.id) ? 'Favorited' : 'Add to Favorites'">
                        <svg width="13" height="13" viewBox="0 0 24 24" :fill="isFavorite(item.id) ? '#ef4444' : 'none'" :stroke="isFavorite(item.id) ? '#ef4444' : '#64748b'" stroke-width="2.2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                        </svg>
                    </button>

                    <!-- Pure White Card 3D Thumbnail Canvas Box -->
                    <div class="card-thumb-wrap">
                        <div v-if="!item.image && isGenerating" class="skeleton-shimmer"></div>
                        <img v-else-if="item.image" :src="item.image" :alt="item.name" @error="handleImageError" />
                        <div v-else class="fallback-thumb-box">
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" stroke-width="1.4"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                        </div>
                        
                        <div class="active-badge-dot" v-if="modelValue === item.id">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                    </div>

                    <!-- Product Title & CAD Specifications (6px Extra Left/Right Padding) -->
                    <div class="card-title-wrap">
                        <div class="product-rating" v-if="props.type === 'window' || props.type === 'door'">
                            <span class="star-icon">★★★★☆</span>
                        </div>
                        <span class="product-title">{{ item.name }}</span>
                        
                        <div class="card-meta-line" v-if="item.material || item.specs">
                            <span class="meta-mat">{{ item.material || item.category || 'CAD Model' }}</span>
                            <span class="meta-dot" v-if="item.specs">•</span>
                            <span class="meta-specs" v-if="item.specs">{{ item.specs }}</span>
                        </div>
                        
                        <div class="card-extra-meta" v-if="props.type === 'window' || props.type === 'door'">
                            <span class="meta-tag">{{ props.type === 'window' ? 'Double Glass' : 'Solid Core' }}</span>
                            <span class="meta-tag">{{ props.type === 'window' ? '2 Panel' : 'Prehung' }}</span>
                            <span class="meta-tag text-green">Available</span>
                        </div>
                    </div>
                </div>
            </template>
        </div>

        <!-- No Data / Empty Result Display -->
        <div class="empty-result-box" v-else>
            <div class="empty-icon-circle">
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.6"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
            </div>
            <h4 class="empty-title">No Data Found</h4>
            <p class="empty-subtext">No catalog models match your active search or selected filter option.</p>
            <button class="reset-filter-btn" v-if="effectiveSearchQuery || filterOption !== 'all' || activeCategoryChip !== 'all'" @click="resetSearchAndFilters">
                <span>Reset Filters</span>
            </button>
        </div>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { usePlannerStore } from '../../stores/usePlannerStore.js';

const sortOption = ref('popular');
const sortMenuOpen = ref(false);
const filterMenuOpen = ref(false);
const filterOption = ref('all');
const localSearchQuery = ref('');
const activeCategoryChip = ref('all');

const sortLabel = computed(() => {
    switch (sortOption.value) {
        case 'name_asc': return 'Name (A-Z)';
        case 'name_desc': return 'Name (Z-A)';
        case 'recent': return 'Newest';
        case 'popular':
        default: return 'Popular';
    }
});

const getBadgeClass = (badgeText) => {
    if (!badgeText) return '';
    const b = badgeText.toUpperCase();
    if (b.includes('BESTSELLER')) return 'bestseller-gold';
    if (b.includes('POPULAR')) return 'popular-blue';
    if (b.includes('GLASS')) return 'glass-green';
    if (b.includes('WOOD')) return 'wood-yellow';
    if (b.includes('NEW')) return 'new-cyan';
    if (b.includes('COMPACT')) return 'compact-orange';
    return 'default-badge';
};

const closeHeaderMenus = () => {
    sortMenuOpen.value = false;
    filterMenuOpen.value = false;
};
onMounted(() => {
    window.addEventListener('click', closeHeaderMenus);
});
onUnmounted(() => {
    window.removeEventListener('click', closeHeaderMenus);
});

const props = defineProps({
    type: { type: String, required: true },
    modelValue: { type: String, default: '' },
    searchQuery: { type: String, default: '' }
});

const emit = defineEmits(['update:modelValue', 'select', 'reset-filters']);

const effectiveSearchQuery = computed(() => {
    return (localSearchQuery.value || props.searchQuery || '').trim().toLowerCase();
});

const resetSearchAndFilters = () => {
    filterOption.value = 'all';
    localSearchQuery.value = '';
    activeCategoryChip.value = 'all';
    emit('reset-filters');
};

const plannerStore = usePlannerStore();

// Initialize default door items as favorited
const favoritesMap = ref({
    'single': true, 'french': true, 'sliding': true, 
    'pocket': true, 'classic_4': true, 'modern_flush': true,
    'sliding_std': true, 'casement_std': true, 'panoramic_slider': true
});

const isFavorite = (itemId) => !!favoritesMap.value[itemId];
const toggleFavorite = (itemId) => {
    favoritesMap.value[itemId] = !favoritesMap.value[itemId];
};

const getCatalogHeaderTitle = () => {
    const map = {
        'door': 'Door Catalog',
        'window': 'Window Catalog',
        'sunshade': 'Sunshade & Openings Catalog',
        'jali_panel': 'Jali Panel Catalog',
        'staircase': 'Staircase Catalog',
        'roof': 'Roof Catalog',
        'dormer': 'Dormer Catalog',
        'molding': 'Molding Catalog',
        'elevation_fascia': 'Fascia Catalog',
        'kitchen_catalog': 'Modular Kitchen',
        'sink_catalog': 'Sink Catalog',
        'tap_catalog': 'Tap Catalog',
        'hood_catalog': 'Hood Catalog',
        'small_appliance_catalog': 'Small Appliances',
        'household_appliance_catalog': 'Household Appliances',
        'wine_cellar_catalog': 'Wine Cellars',
        'trash_catalog': 'Trash Cans',
        'wall_catalog': 'Walls Catalog',
        'shape_catalog': '3D Shapes Catalog',
        'adv_opening_catalog': 'Advanced Openings',
        'railing_catalog': 'Railings Catalog',
        'furniture_catalog': 'Furniture Catalog',
        'bathroom_catalog': 'Bathroom & Sanitary Catalog',
        'electronics_catalog': 'TVs & Electronics Catalog'
    };
    return map[props.type] || 'Product Catalog';
};

const doorCatalog = ref([
    { id: 'single', name: 'Single Hinged Door', badge: 'WOOD', material: 'Solid Teak Wood', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'flat', width: 40, materialCategory: 'wood', materials: { leaf: { id: 'wood_golden_teak' }, frame: { id: 'wood_golden_teak' } } } },
    { id: 'french', name: 'Double French Door', badge: 'GLASS', material: 'Glass & Solid Oak', specs: '1800 × 2100 mm', category: 'double', image: '', params: { doorType: 'french', doorStyle: 'glass_grid', width: 80, materialCategory: 'wood', materials: { leaf: { id: 'wood_golden_teak' }, frame: { id: 'wood_golden_teak' }, glass: { id: 'clear' } } } },
    { id: 'sliding', name: 'Sliding Glass Door', badge: 'GLASS', material: 'Aluminium & Glass', specs: '1800 × 2100 mm', category: 'glass', image: '', params: { doorType: 'sliding', doorStyle: 'glass_bottom_panel', width: 80, materialCategory: 'aluminium', materials: { leaf: { id: 'alum_silver' }, frame: { id: 'alum_silver' }, glass: { id: 'clear' } } } },
    { id: 'pocket', name: 'Pocket Door', badge: 'COMPACT', material: 'Natural Teak', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'pocket', doorStyle: 'flat', width: 40, materialCategory: 'wood', materials: { leaf: { id: 'wood_golden_teak' }, frame: { id: 'wood_golden_teak' } } } },
    { id: 'classic_4', name: 'Classic 4-Panel Door', badge: 'WOOD', material: 'White American Oak', specs: '900 × 2100 mm', category: 'wood', image: '', params: { doorType: 'single', doorStyle: 'classic_4_panel', width: 40, materialCategory: 'wood', materials: { leaf: { id: 'wood_white_oak' }, frame: { id: 'wood_white_oak' } } } },
    { id: 'modern_flush', name: 'Modern Flush Door', badge: 'WOOD', material: 'American Walnut', specs: '900 × 2100 mm', category: 'wood', image: '', params: { doorType: 'single', doorStyle: 'modern_flush', width: 40, materialCategory: 'wood', materials: { leaf: { id: 'wood_dark_walnut' }, frame: { id: 'wood_dark_walnut' } } } },
    { id: 'door_wpc', name: 'WPC Door', badge: 'WPC', material: 'Wood Plastic Composite', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'classic_4_horizontal', width: 40, materialCategory: 'wpc', materials: { leaf: { id: 'wood_golden_teak' }, frame: { id: 'wood_golden_teak' } } } },
    { id: 'door_upvc', name: 'uPVC Door', badge: 'uPVC', material: 'Rigid uPVC', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'glass_bottom_panel', width: 40, materialCategory: 'upvc', materials: { leaf: { id: 'upvc_white' }, frame: { id: 'upvc_white' } } } },
    { id: 'door_pvc', name: 'PVC Door', badge: 'PVC', material: 'Matte White PVC', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'classic_2_panel', width: 40, materialCategory: 'pvc', materials: { leaf: { id: 'pvc_matte' }, frame: { id: 'pvc_matte' } } } },
    { id: 'door_aluminium', name: 'Aluminium Door', badge: 'ALUMINIUM', material: 'Silver Aluminium', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'glass_grid', width: 40, materialCategory: 'aluminium', materials: { leaf: { id: 'alum_silver' }, frame: { id: 'alum_silver' } } } },
    { id: 'door_steel', name: 'Steel Door', badge: 'STEEL', material: 'Light Smooth Steel', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'grid_panel', width: 40, materialCategory: 'steel', materials: { leaf: { id: 'metal_light_steel' }, frame: { id: 'metal_light_steel' } } } },
    { id: 'door_glass', name: 'Frameless Glass Door', badge: 'GLASS', material: 'Tempered Glass', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'flat', width: 40, materialCategory: 'glass', materials: { leaf: { id: 'glass_clear' }, frame: { id: 'glass_clear' } } } },
    { id: 'door_frp', name: 'FRP Door', badge: 'FRP', material: 'Fiber Reinforced Plastic', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'classic_4_panel', width: 40, materialCategory: 'frp', materials: { leaf: { id: 'frp' }, frame: { id: 'frp' } } } },
    { id: 'door_composite', name: 'Composite Door', badge: 'COMPOSITE', material: 'Composite Panel', specs: '900 × 2100 mm', category: 'single', image: '', params: { doorType: 'single', doorStyle: 'classic_4_horizontal', width: 40, materialCategory: 'composite', materials: { leaf: { id: 'composite' }, frame: { id: 'composite' } } } },
]);

const windowCatalog = ref([
    { id: 'sliding_std', name: 'Standard Sliding', badge: 'POPULAR', material: 'Aluminium Frame', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'aluminium', materials: { frame: { id: 'alum_silver' }, leaf: { id: 'alum_silver' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'casement_std', name: 'Casement Window', badge: 'CLASSIC', material: 'White Vinyl', specs: '900 × 1200 mm', category: 'casement', image: '', params: { windowType: 'casement_std', width: 40, materialCategory: 'upvc', materials: { frame: { id: 'upvc_white' }, leaf: { id: 'upvc_white' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'fixed_elevation', name: 'Fixed Picture Window', badge: 'MODERN', material: 'Clear Glass', specs: '1800 × 1500 mm', category: 'fixed', image: '', params: { windowType: 'fixed_elevation', width: 80, materialCategory: 'aluminium', materials: { frame: { id: 'alum_silver' }, leaf: { id: 'alum_silver' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'bay_box', name: 'Bay Window', badge: 'ARCHITECTURAL', material: 'Solid Wood Frame', specs: '1800 × 1500 mm', category: 'bay', image: '', params: { windowType: 'bay_box', width: 80, materialCategory: 'wood', materials: { frame: { id: 'wood_golden_teak' }, leaf: { id: 'wood_golden_teak' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'panoramic_slider', name: 'Panoramic Slider', badge: 'PREMIUM', material: 'Slim Steel Frame', specs: '2400 × 1800 mm', category: 'sliding', image: '', params: { windowType: 'panoramic_slider', width: 120, materialCategory: 'steel', materials: { frame: { id: 'metal_light_steel' }, leaf: { id: 'metal_light_steel' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_wood', name: 'Wood Window', badge: 'WOOD', material: 'Solid Teak Wood', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'wood', materials: { frame: { id: 'wood_golden_teak' }, leaf: { id: 'wood_golden_teak' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_wpc', name: 'WPC Window', badge: 'WPC', material: 'Wood Plastic Composite', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'wpc', materials: { frame: { id: 'wood_golden_teak' }, leaf: { id: 'wood_golden_teak' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_upvc', name: 'uPVC Window', badge: 'uPVC', material: 'Rigid uPVC', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'upvc', materials: { frame: { id: 'upvc_white' }, leaf: { id: 'upvc_white' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_pvc', name: 'PVC Window', badge: 'PVC', material: 'Matte White PVC', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'pvc', materials: { frame: { id: 'upvc_white' }, leaf: { id: 'upvc_white' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_aluminium', name: 'Aluminium Window', badge: 'ALUMINIUM', material: 'Silver Aluminium', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'aluminium', materials: { frame: { id: 'alum_silver' }, leaf: { id: 'alum_silver' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_steel', name: 'Steel Window', badge: 'STEEL', material: 'Light Smooth Steel', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'steel', materials: { frame: { id: 'metal_light_steel' }, leaf: { id: 'metal_light_steel' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_glass', name: 'Frameless Glass Window', badge: 'GLASS', material: 'Tempered Glass', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'glass', materials: { frame: { id: 'glass_clear' }, leaf: { id: 'glass_clear' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_frp', name: 'FRP Window', badge: 'FRP', material: 'Fiber Reinforced Plastic', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'frp', materials: { frame: { id: 'upvc_white' }, leaf: { id: 'upvc_white' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
    { id: 'win_composite', name: 'Composite Window', badge: 'COMPOSITE', material: 'Composite Panel', specs: '1200 × 1200 mm', category: 'sliding', image: '', params: { windowType: 'sliding_std', width: 60, materialCategory: 'composite', materials: { frame: { id: 'alum_black' }, leaf: { id: 'alum_black' }, glass: { id: 'clear' }, hardware: { id: 'metal_gunmetal_black' }, seal: { id: 'seal_black' } , grille: { id: 'metal_matte_black' } } } },
]);

const sunshadeCatalog = ref([
    { id: 'concrete_slab', name: 'Concrete Slab', badge: 'STD', material: 'Reinforced RCC', specs: '1500 × 1000 mm', image: '', params: { chajjaType: 'concrete_slab', materials: { frame: { id: 'concrete' } }, width: 60, depth: 40, thick: 4 } },
    { id: 'wooden_pergola', name: 'Wooden Pergola', badge: 'WOOD', material: 'Teak Wood Rafters', specs: '2000 × 1250 mm', image: '', params: { chajjaType: 'wooden_pergola', materials: { frame: { id: 'concrete' } }, width: 80, depth: 50, thick: 8 } },
    { id: 'metal_louvers', name: 'Metal Louvers', badge: 'MODERN', material: 'Anodized Steel', specs: '2000 × 1250 mm', image: '', params: { chajjaType: 'metal_louvers', materials: { frame: { id: 'concrete' } }, width: 80, depth: 50, thick: 8 } },
    { id: 'glass_canopy', name: 'Glass Canopy', badge: 'GLASS', material: 'Tempered Glass', specs: '1500 × 1000 mm', image: '', params: { chajjaType: 'glass_canopy', materials: { frame: { id: 'concrete' } }, width: 60, depth: 40, thick: 3 } },
    { id: 'metal_canopy', name: 'Metal Canopy', badge: 'SLIM', material: 'Sheet Metal', specs: '1500 × 1000 mm', image: '', params: { chajjaType: 'metal_canopy', materials: { frame: { id: 'concrete' } }, width: 60, depth: 40, thick: 4 } },
    { id: 'curved_rcc', name: 'Curved RCC', badge: 'CLASSIC', material: 'Curved Concrete', specs: '1500 × 1000 mm', image: '', params: { chajjaType: 'curved_rcc', materials: { frame: { id: 'concrete' } }, width: 60, depth: 40, thick: 4 } },
]);

const jaliCatalog = ref([
    { id: 'square_grid', name: 'Square Grid', badge: 'GRID', material: 'MDF / PVC', specs: '1000 × 1000 mm', image: '', params: { pattern: 'square_grid', materials: { frame: { id: 'wood_teak' } }, width: 40, height: 40 } },
    { id: 'geometric_honeycomb', name: 'Honeycomb', badge: 'MODERN', material: 'CNC Cut Metal', specs: '1000 × 1000 mm', image: '', params: { pattern: 'geometric_honeycomb', materials: { frame: { id: 'wood_teak' } }, width: 40, height: 40 } },
    { id: 'mughal_star', name: 'Mughal Star', badge: 'HERITAGE', material: 'Carved Wood', specs: '1000 × 1000 mm', image: '', params: { pattern: 'mughal_star', materials: { frame: { id: 'wood_teak' } }, width: 40, height: 40 } },
    { id: 'floral_vine', name: 'Floral Vine', badge: 'DECORATIVE', material: 'Brass Finish', specs: '1000 × 1000 mm', image: '', params: { pattern: 'floral_vine', materials: { frame: { id: 'wood_teak' } }, width: 40, height: 40 } },
]);

const staircaseCatalog = ref([
    { id: 'stair_straight_solid', name: 'Solid Base (Wood)', badge: 'WOOD', material: 'Teak Wood Steps', specs: '1000 × 3000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'solid', primaryColor: '#8b5a2b' } },
    { id: 'stair_straight_mono', name: 'Mono Stringer (Steel)', badge: 'STEEL', material: 'Black Powder Steel', specs: '1000 × 3000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'mono', primaryMaterial: 'steel', primaryColor: '#333333' } },
    { id: 'stair_straight_double', name: 'Double Stringer', badge: 'CLASSIC', material: 'Oak & Steel', specs: '1000 × 3000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'double', primaryMaterial: 'wood', primaryColor: '#a67b5b' } },
    { id: 'stair_straight_side', name: 'Side Stringers', badge: 'MODERN', material: 'White Painted', specs: '1000 × 3000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_straight', width: 40, length: 120, height: 120, steps: 10, stringerType: 'side', primaryMaterial: 'white_painted', primaryColor: '#ffffff' } },
    { id: 'stair_L_concrete', name: 'L-Shape (Concrete)', badge: 'SOLID', material: 'Cast Concrete', specs: '2000 × 2000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_L', width: 40, length1: 80, length2: 80, height: 120, stringerType: 'solid', primaryMaterial: 'concrete', primaryColor: '#999999' } },
    { id: 'stair_L_mono', name: 'L-Shape (Mono)', badge: 'STEEL', material: 'Industrial Steel', specs: '2000 × 2000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_L', width: 40, length1: 80, length2: 80, height: 120, stringerType: 'mono', primaryMaterial: 'steel', primaryColor: '#444444' } },
    { id: 'stair_U_wood', name: 'U-Shape (Box)', badge: 'WOOD', material: 'Solid Oak', specs: '1500 × 1500 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_U', width: 40, length1: 60, length2: 60, width2: 40, height: 120, stringerType: 'box', primaryColor: '#8b5a2b' } },
    { id: 'stair_T_marble', name: 'T-Shape (Marble)', badge: 'LUXURY', material: 'White Carrara Marble', specs: '2000 × 2000 mm', image: '', toolId: 'staircase', params: { type: 'stair_v5_T', width: 40, length1: 60, length2: 80, height: 120, stringerType: 'solid', primaryMaterial: 'marble', primaryColor: '#f5f5f5' } },
]);

const roofCatalog = ref([
    { id: 'roof_gable', name: 'Gable Roof', badge: 'CLASSIC', material: 'Terracotta Tiles', specs: '30° Pitch', image: '', params: { roofType: 'gable', pitch: 30 } },
    { id: 'roof_hip', name: 'Hip Roof', badge: 'POPULAR', material: 'Asphalt Shingles', specs: '30° Pitch', image: '', params: { roofType: 'hip', pitch: 30 } },
    { id: 'roof_flat', name: 'Flat Roof', badge: 'MODERN', material: 'Concrete Deck', specs: '150 mm Slab', image: '', params: { roofType: 'flat', thick: 15 } },
]);

const dormerCatalog = ref([
    { id: 'preset_dormer_gable', name: 'Gable Dormer', badge: 'CLASSIC', material: 'Wood Siding', specs: '35° Pitch', image: '', params: { type: 'preset_dormer_gable', width: 120, depth: 150, wallHeight: 120, roofType: 'gable', pitch: 35, elevation: 250 } },
    { id: 'preset_dormer_shed', name: 'Shed Dormer', badge: 'MODERN', material: 'Metal Roof', specs: '15° Pitch', image: '', params: { type: 'preset_dormer_shed', width: 250, depth: 150, wallHeight: 120, roofType: 'flat', pitch: 15, elevation: 250 } },
    { id: 'preset_dormer_hip', name: 'Hip Dormer', badge: 'HERITAGE', material: 'Tile Roof', specs: '35° Pitch', image: '', params: { type: 'preset_dormer_hip', width: 120, depth: 150, wallHeight: 120, roofType: 'hip', pitch: 35, elevation: 250 } }
]);

const moldingCatalog = ref([
    { id: 'molding_band', name: 'Horizontal Band', badge: 'FLAT', material: 'Painted Plaster', image: '', params: { type: 'molding_band', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_crown', name: 'Crown Molding', badge: 'CLASSIC', material: 'Carved Wood', image: '', params: { type: 'molding_crown', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_ogee', name: 'Ogee (Cyma)', badge: 'PROFILE', material: 'Polyurethane', image: '', params: { type: 'molding_ogee', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_egg_and_dart', name: 'Egg and Dart', badge: 'DECORATIVE', material: 'Gypsum Plaster', image: '', params: { type: 'molding_egg_and_dart', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_dentil', name: 'Dentil Molding', badge: 'HERITAGE', material: 'Cast Stone', image: '', params: { type: 'molding_dentil', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_craftsman', name: 'Step / Craftsman', badge: 'MODERN', material: 'Hardwood', image: '', params: { type: 'molding_craftsman', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_window', name: 'Window Frame', badge: 'TRIM', material: 'White Vinyl', image: '', params: { type: 'molding_window', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_door', name: 'Door Frame', badge: 'TRIM', material: 'Oak Trim', image: '', params: { type: 'molding_door', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_groove', name: 'Decorative Groove', badge: 'RECESSED', material: 'Grooved Panel', image: '', params: { type: 'molding_groove', materials: { frame: { id: 'white_paint' } } } },
    { id: 'molding_layered', name: 'Layered Projection', badge: 'LAYERED', material: 'Composite', image: '', params: { type: 'molding_layered', materials: { frame: { id: 'white_paint' } } } }
]);

const elevationFasciaCatalog = ref([
    { id: 'fascia_c_left', name: 'C-Shape (Left)', badge: 'FACADE', material: 'Aluminium Composite', image: '', params: { type: 'elevation_fascia', profileType: 'c_shape_left' } },
    { id: 'fascia_c_right', name: 'C-Shape (Right)', badge: 'FACADE', material: 'Aluminium Composite', image: '', params: { type: 'elevation_fascia', profileType: 'c_shape_right' } },
    { id: 'fascia_l_left', name: 'L-Shape (Left)', badge: 'CORNER', material: 'Anodized Steel', image: '', params: { type: 'elevation_fascia', profileType: 'l_shape_left' } },
    { id: 'fascia_l_right', name: 'L-Shape (Right)', badge: 'CORNER', material: 'Anodized Steel', image: '', params: { type: 'elevation_fascia', profileType: 'l_shape_right' } },
    { id: 'fascia_box', name: 'Full Box Frame', badge: 'BOX', material: 'Powder-Coated Metal', image: '', params: { type: 'elevation_fascia', profileType: 'full_box' } }
]);

const advanceOpeningsCatalog = ref([
    { id: 'adv_arch', name: 'Arch Opening', badge: 'ARCH', material: 'Wall Cutout', image: '', toolId: 'arch_opening', params: { type: 'arch_opening' } },
    { id: 'adv_circ', name: 'Circular & Oval', badge: 'CIRCULAR', material: 'Wall Cutout', image: '', toolId: 'circular_opening', params: { type: 'circular_opening' } },
    { id: 'adv_custom', name: 'Custom Shape Cut', badge: 'FREEFORM', material: 'Wall Cutout', image: '', toolId: 'custom_shape_opening', params: { type: 'custom_shape_opening' } },
    { id: 'adv_niche', name: 'Niche & Recess', badge: 'NICHE', material: 'Wall Recess', image: '', toolId: 'niche_recess', params: { type: 'niche_recess' } },
    { id: 'adv_pattern', name: 'Pattern Opening', badge: 'GRID', material: 'Pattern Cutout', image: '', toolId: 'pattern_opening', params: { type: 'pattern_opening' } },
    { id: 'adv_boolean', name: 'Boolean Cut', badge: 'BOOLEAN', material: 'CSG Cutout', image: '', toolId: 'boolean_cut', params: { type: 'boolean_cut' } }
]);

const shapesCatalog = ref([
    { id: 'shape_box', name: 'Box (Rectangle)', badge: '3D', material: 'Solid Box', image: '', toolId: 'shape_rect', params: { type: 'shape_rect' } },
    { id: 'shape_cyl', name: 'Cylinder (Circle)', badge: '3D', material: 'Cylinder', image: '', toolId: 'shape_circle', params: { type: 'shape_circle' } },
    { id: 'shape_prism', name: 'Prism (Polygon)', badge: '3D', material: 'Triangular Prism', image: '', toolId: 'shape_triangle', params: { type: 'shape_triangle' } }
]);

const wallsCatalog = ref([
    { id: 'wall_outer', name: 'Outer Wall', badge: 'STRUCTURAL', material: 'Brick & Plaster', specs: '230 mm Thick', image: '', toolId: 'outer', params: { type: 'outer' } },
    { id: 'wall_inner', name: 'Inner Wall', badge: 'PARTITION', material: 'Gypsum / Brick', specs: '115 mm Thick', image: '', toolId: 'inner', params: { type: 'inner' } },
    { id: 'wall_arc', name: 'Curved Wall (Arc)', badge: 'CURVED', material: 'Reinforced Concrete', specs: '230 mm Arc', image: '', toolId: 'arc', params: { type: 'arc' } }
]);

const railingCatalog = ref([
    { id: 'glass_stainless', name: 'Glass & Steel', badge: 'MODERN', material: 'Tempered Glass & Steel', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'glass_stainless' } },
    { id: 'glass_frameless', name: 'Frameless', badge: 'LUXURY', material: 'Clear Toughened Glass', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'glass_frameless' } },
    { id: 'metal_vertical', name: 'Vertical Metal', badge: 'MINIMAL', material: 'Black Powder Steel', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'metal_vertical' } },
    { id: 'cable_stainless', name: 'Cable', badge: 'SLIM', material: 'Tension Cable', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'cable_stainless' } },
    { id: 'wood_classic', name: 'Wood', badge: 'CLASSIC', material: 'Carved Wood Balusters', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'wood_classic' } },
    { id: 'stair_baluster_default', name: 'Block Balusters', badge: 'ROBUST', material: 'Solid Wood & Metal', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'stair_baluster_default' } },
    { id: 'stair_glass_default', name: 'Glass Wedge', badge: 'CLEAN', material: 'Thick Glass Panel', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'stair_glass_default' } },
    { id: 'stair_cable_default', name: 'Heavy Cable', badge: 'INDUSTRIAL', material: 'Tension Steel Cables', specs: '1000 mm High', image: '', toolId: 'railing', params: { type: 'stair_cable_default' } }
]);

const furnitureCatalog = ref([
    { isDivider: true, id: 'div_sofas', name: 'Sofas & Couches' },
    { id: 'sofa_3seater', name: 'Modern 3-Seater Sofa', badge: 'POPULAR', material: 'Grey Fabric', specs: '2200 × 900 mm', image: '', toolId: 'furniture', params: { type: 'sofa_3seater' } },
    { id: 'sofa_l_shape', name: 'L-Shape Sectional', badge: 'LARGE', material: 'Charcoal Linen', specs: '2800 × 1800 mm', image: '', toolId: 'furniture', params: { type: 'sofa_l_shape' } },
    { id: 'sofa_chesterfield', name: 'Chesterfield Sofa', badge: 'LUXURY', material: 'Brown Tufted Leather', specs: '2400 × 950 mm', image: '', toolId: 'furniture', params: { type: 'sofa_chesterfield' } },
    { id: 'sofa_office', name: 'Office Sofa', badge: 'COMPACT', material: 'Black Leatherette', specs: '1800 × 850 mm', image: '', toolId: 'furniture', params: { type: 'sofa_office' } },
    { id: 'sofa_modern_1', name: 'Modern Velvet Sofa 1', badge: 'MODERN', material: 'Plush Blue Velvet', specs: '2100 × 900 mm', image: '', toolId: 'furniture', params: { type: 'sofa_modern_1' } },
    { id: 'sofa_modern_2', name: 'Modern Fabric Sofa 2', badge: 'MINIMAL', material: 'Warm Beige Fabric', specs: '2000 × 900 mm', image: '', toolId: 'furniture', params: { type: 'sofa_modern_2' } },
    { id: 'sofa_modern_3', name: 'Modern Studio Sofa 3', badge: 'NEW', material: 'Neutral Grey Weave', specs: '2200 × 950 mm', image: '', toolId: 'furniture', params: { type: 'sofa_modern_3' } },
    { id: 'sofa_patricia', name: 'Patricia Designer Sofa', badge: 'DESIGNER', material: 'Bouclé Fabric', specs: '2300 × 1000 mm', image: '', toolId: 'furniture', params: { type: 'sofa_patricia' } },
    { id: 'sofa_fabric', name: 'Comfort Fabric Sofa', badge: 'SOFT', material: 'Textured Linen', specs: '2100 × 950 mm', image: '', toolId: 'furniture', params: { type: 'sofa_fabric' } },
    { id: 'sofa_sheen_wood', name: 'Sheen Wood Leather Sofa', badge: 'LEATHER', material: 'Walnut & Saddle Leather', specs: '2000 × 900 mm', image: '', toolId: 'furniture', params: { type: 'sofa_sheen_wood' } },

    { isDivider: true, id: 'div_beds', name: 'Beds & Bedroom Furniture' },
    { id: 'bed_modern_1', name: 'Modern Upholstered Bed 1', badge: 'QUEEN', material: 'Grey Fabric Headboard', specs: '1600 × 2000 mm', image: '', toolId: 'furniture', params: { type: 'bed_modern_1' } },
    { id: 'bed_modern_3', name: 'Modern Luxury Bed 3', badge: 'KING', material: 'Tufted Linen Headboard', specs: '1800 × 2000 mm', image: '', toolId: 'furniture', params: { type: 'bed_modern_3' } },
    { id: 'bed_traditional_wooden', name: 'Traditional Wooden Cot', badge: 'WOOD', material: 'Solid Teak Timber', specs: '1200 × 2000 mm', image: '', toolId: 'furniture', params: { type: 'bed_traditional_wooden' } },

    { isDivider: true, id: 'div_dining', name: 'Dining Tables & Sets' },
    { id: 'dining_modern_1', name: 'Modern Dining Table 1', badge: 'WOOD', material: 'Teak & Steel Legs', specs: '1800 × 900 mm', image: '', toolId: 'furniture', params: { type: 'dining_modern_1' } },
    { id: 'dining_modern_2', name: 'Modern Dining Table 2', badge: 'MARBLE', material: 'White Marble Top', specs: '2000 × 1000 mm', image: '', toolId: 'furniture', params: { type: 'dining_modern_2' } },
    { id: 'dining_wooden_set_1', name: 'Wooden Dining Set 1', badge: '6 SEATER', material: 'Solid Oak & Chairs', specs: '1800 × 900 mm', image: '', toolId: 'furniture', params: { type: 'dining_wooden_set_1' } },
    { id: 'dining_wooden_set_2', name: 'Wooden Dining Set 2', badge: '4 SEATER', material: 'Natural Walnut', specs: '1600 × 900 mm', image: '', toolId: 'furniture', params: { type: 'dining_wooden_set_2' } },
    { id: 'dining_tables_set', name: 'Contemporary Dining Suite', badge: 'POPULAR', material: 'Smoked Glass & Leather', specs: '2000 × 1000 mm', image: '', toolId: 'furniture', params: { type: 'dining_tables_set' } },
    { id: 'dining_old_table_set', name: 'Rustic Farmhouse Dining Set', badge: 'RUSTIC', material: 'Reclaimed Timber', specs: '1500 × 1500 mm', image: '', toolId: 'furniture', params: { type: 'dining_old_table_set' } },

    { isDivider: true, id: 'div_chairs', name: 'Chairs & Seating' },
    { id: 'chair_basket_swing', name: 'Basket Swing Chair', badge: 'OUTDOOR', material: 'Woven Rattan & Cushion', specs: '800 × 1200 mm', image: '', toolId: 'furniture', params: { type: 'chair_basket_swing' } },
    { id: 'chair_modern_1', name: 'Modern Lounge Chair 1', badge: 'MINIMAL', material: 'Black Metal & Linen', specs: '500 × 900 mm', image: '', toolId: 'furniture', params: { type: 'chair_modern_1' } },
    { id: 'chair_modern_2', name: 'Modern Dining Chair 2', badge: 'WOOD', material: 'Oak & Molded Shell', specs: '500 × 900 mm', image: '', toolId: 'furniture', params: { type: 'chair_modern_2' } },
    { id: 'chair_piano_set', name: 'Grand Piano with Bench', badge: 'LUXURY', material: 'Black Gloss Lacquer', specs: '1400 × 1100 mm', image: '', toolId: 'furniture', params: { type: 'chair_piano_set' } },
    { id: 'chair_rounded', name: 'Rounded Accent Chair', badge: 'SOFT', material: 'Velvet Upholstery', specs: '600 × 800 mm', image: '', toolId: 'furniture', params: { type: 'chair_rounded' } },
    { id: 'chair_rustic', name: 'Rustic Armchair', badge: 'VINTAGE', material: 'Distressed Leather', specs: '500 × 900 mm', image: '', toolId: 'furniture', params: { type: 'chair_rustic' } },
    { id: 'chair_sofa', name: 'Single Sofa Armchair', badge: 'COMFY', material: 'High-Density Foam', specs: '800 × 900 mm', image: '', toolId: 'furniture', params: { type: 'chair_sofa' } },

    { isDivider: true, id: 'div_tv_stands_furn', name: 'TV Stands & Media Units' },
    { id: 'tv_stand_reclaimed', name: 'Reclaimed Wood TV Stand', badge: 'RUSTIC', material: 'Solid Reclaimed Oak', specs: '1600 × 500 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_reclaimed', elevation: 0 } },
    { id: 'tv_stand_retro', name: 'Retro Mid-Century TV Stand', badge: 'RETRO', material: 'Walnut & Tapered Legs', specs: '1500 × 550 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_retro', elevation: 0 } },
    { id: 'tv_stand_small', name: 'Compact Small TV Stand', badge: 'COMPACT', material: 'White & Light Wood', specs: '1000 × 450 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_small', elevation: 0 } },
    { id: 'tv_stand_wooden_bench', name: 'Wooden Media Bench Table', badge: 'WOOD', material: 'Natural Teak Bench', specs: '1800 × 450 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_wooden_bench', elevation: 0 } },
    { id: 'tv_stand_modern_mraz', name: 'Modern Minimalist TV Stand', badge: 'SLIM', material: 'Matte Grey & Steel', specs: '1500 × 500 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_modern_mraz', elevation: 0 } },
    { id: 'tv_stand_classic', name: 'Classic Entertainment Unit', badge: 'CLASSIC', material: 'Mahogany & Drawers', specs: '1600 × 600 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_classic', elevation: 0 } },

    { isDivider: true, id: 'div_other', name: 'Other Furniture & Accents' },
    { id: 'bench', name: 'Entryway Wooden Bench', badge: 'BENCH', material: 'Solid Wood', specs: '1200 × 45 mm', image: '', toolId: 'furniture', params: { type: 'bench' } },
    { id: 'furniture_barstool', name: 'Scandinavian Bar Stool', badge: 'STOOL', material: 'Walnut & Brass', specs: '400 × 750 mm', image: '', toolId: 'furniture', params: { type: 'furniture_barstool' } },
    { id: 'lighting_pendant', name: 'Ribbed Brass Pendant Light', badge: 'LIGHTING', material: 'Brass & Frosted Glass', specs: 'Pendant Lamp', image: '', toolId: 'furniture', params: { type: 'lighting_pendant', elevation: 180 } }
]);

const kitchenCatalog = ref([
    { id: 'kitchen_straight', name: 'Straight Kitchen', badge: 'BASE', material: 'Laminate & Quartz', specs: '2400 × 900 mm', image: '', toolId: 'kitchen', params: { type: 'kitchen_straight', width: 240, height: 90, depth: 60 } },
    { id: 'kitchen_l_shape', name: 'L-Shape Kitchen', badge: 'CORNER', material: 'Matte Acrylic & Granite', specs: '2400 × 2400 mm', image: '', toolId: 'kitchen', params: { type: 'kitchen_l_shape', width: 240, height: 90, depth: 240 } },
    { id: 'kitchen_u_shape', name: 'U-Shape Kitchen', badge: 'PREMIUM', material: 'Shaker Wood & Marble', specs: '2400 × 2400 mm', image: '', toolId: 'kitchen', params: { type: 'kitchen_u_shape', width: 240, height: 90, depth: 240 } },
    { id: 'kitchen_straight_shaker', name: 'Classic Shaker Kitchen', badge: 'CLASSIC', material: 'Antique White Shaker', specs: '2400 × 900 mm', image: '', toolId: 'kitchen', params: { type: 'kitchen_straight_shaker', width: 240, height: 90, depth: 60 } },
    { id: 'kitchen_island', name: 'Kitchen Island', badge: 'ISLAND', material: 'Waterfall Marble', specs: '2400 × 1200 mm', image: '', toolId: 'kitchen', params: { type: 'kitchen_island', width: 240, height: 90, depth: 120 } },
    { id: 'kitchen_tall_pantry', name: 'Tall Pantry Cabinet', badge: 'TALL', material: 'Walnut & Brass Handles', specs: '600 × 2100 mm', image: '', toolId: 'kitchen', params: { type: 'kitchen_tall_pantry', width: 60, height: 210, depth: 60 } }
]);

const sinkCatalog = ref([
    { isDivider: true, id: 'div_sinks_modern', name: 'Designer 3D Sinks & Basins' },
    { id: 'sink_kitchen_modern', name: 'Modern Kitchen Sink', badge: 'WORKSTATION', material: 'Gunmetal Stainless', specs: '600 × 450 mm', image: '', toolId: 'furniture', params: { type: 'sink_kitchen_modern', elevation: 90 } },
    { id: 'sink_kohler_double', name: 'Kohler Double-Bowl Sink', badge: 'DOUBLE', material: 'Brushed Stainless', specs: '800 × 450 mm', image: '', toolId: 'furniture', params: { type: 'sink_kohler_double', elevation: 90 } },
    { id: 'sink_farmhouse', name: 'Farmhouse Sink', badge: 'APRON', material: 'Matte Black Ceramic', specs: '750 × 500 mm', image: '', toolId: 'furniture', params: { type: 'sink_farmhouse', elevation: 90 } }
]);

const tapCatalog = ref([
    { isDivider: true, id: 'div_taps_modern', name: 'Designer 3D Taps & Faucets' },
    { id: 'tap_modern', name: 'Modern Curved Faucet', badge: 'CHROME', material: 'Polished Chrome', specs: '350 mm High', image: '', toolId: 'furniture', params: { type: 'tap_modern', elevation: 90 } },
    { id: 'tap_industrial', name: 'Industrial Pull-Down', badge: 'PULLOUT', material: 'Brushed Nickel', specs: '450 mm High', image: '', toolId: 'furniture', params: { type: 'tap_industrial', elevation: 90 } },
    { id: 'tap_classic', name: 'Classic Two-Handle', badge: 'BRASS', material: 'Antique Brass', specs: '250 mm High', image: '', toolId: 'furniture', params: { type: 'tap_classic', elevation: 90 } }
]);

const hoodCatalog = ref([
    { id: 'hood_chimney', name: 'Chimney Hood', badge: 'STAINLESS', material: 'Stainless & Glass', specs: '900 mm Wide', image: '', toolId: 'furniture', params: { type: 'hood_chimney', elevation: 150 } }
]);

const smallApplianceCatalog = ref([
    { id: 'app_microwave', name: 'Microwave', badge: 'DIGITAL', material: 'Stainless Steel', specs: '500 × 300 mm', image: '', toolId: 'furniture', params: { type: 'app_microwave', elevation: 90 } },
    { id: 'app_toaster', name: 'Toaster', badge: 'CREAM', material: 'Glossy Cream & Chrome', specs: '2-Slice Slot', image: '', toolId: 'furniture', params: { type: 'app_toaster', elevation: 90 } }
]);

const householdApplianceCatalog = ref([
    { id: 'app_fridge', name: 'Double-Door Fridge', badge: 'FRENCH DOOR', material: 'Dark Stainless Steel', specs: '900 × 1800 mm', image: '', toolId: 'furniture', params: { type: 'app_fridge', elevation: 0 } },
    { id: 'app_oven', name: 'Built-in Oven', badge: 'BUILT-IN', material: 'Black Metal & Glass', specs: '600 × 600 mm', image: '', toolId: 'furniture', params: { type: 'app_oven', elevation: 90 } },
    { id: 'app_dishwasher', name: 'Dishwasher', badge: 'INTEGRATED', material: 'Stainless Steel', specs: '600 × 850 mm', image: '', toolId: 'furniture', params: { type: 'app_dishwasher', elevation: 0 } },
    { id: 'cooktop_induction', name: 'Induction Cooktop', badge: 'CERAMIC', material: 'Schott Ceran Glass', specs: '600 × 500 mm', image: '', toolId: 'furniture', params: { type: 'cooktop_induction', elevation: 90 } }
]);

const trashCatalog = ref([
    { id: 'trash_pedal', name: 'Stainless Pedal Bin', badge: 'PEDAL', material: 'Brushed Stainless', specs: '30 Liters', image: '', toolId: 'furniture', params: { type: 'trash_pedal', elevation: 0 } },
    { id: 'trash_recycle', name: 'Dual Recycle Bin', badge: 'DUAL', material: 'Stainless & Black', specs: '50 Liters', image: '', toolId: 'trash_recycle', params: { type: 'trash_recycle', elevation: 0 } },
    { id: 'trash_pullout', name: 'Cabinet Pull-out', badge: 'PULLOUT', material: 'In-Cabinet Bin', specs: 'Dual 20L', image: '', toolId: 'trash_pullout', params: { type: 'trash_pullout', elevation: 0 } }
]);

const bathroomCatalog = ref([
    { isDivider: true, id: 'div_toilets', name: 'Toilets & Water Closets' },
    { id: 'toilet_modern', name: 'Modern Ceramic Toilet', badge: 'CERAMIC', material: 'Vitreous China', specs: '360 × 650 mm', image: '', toolId: 'furniture', params: { type: 'toilet_modern', elevation: 0 } },
    { id: 'toilet_compact', name: 'Compact Wall-Hung Toilet', badge: 'WALL-HUNG', material: 'White Ceramic', specs: '360 × 520 mm', image: '', toolId: 'furniture', params: { type: 'toilet_compact', elevation: 0 } },
    { id: 'toilet_vaal', name: 'Vaal Premium Toilet', badge: 'PREMIUM', material: 'Polished Ceramic', specs: '360 × 650 mm', image: '', toolId: 'furniture', params: { type: 'toilet_vaal', elevation: 0 } },

    { isDivider: true, id: 'div_vanities', name: 'Basins & Vanity Units' },
    { id: 'vanity_unit_modern', name: 'Modern Bathroom Vanity Suite', badge: 'VANITY', material: 'Oak & Integrated Basin', specs: '1200 × 850 mm', image: '', toolId: 'furniture', params: { type: 'vanity_unit_modern', elevation: 0 } },
    { id: 'basin_cobra', name: 'Cobra VAA Basin', badge: 'BASIN', material: 'White Porcelain', specs: '600 × 450 mm', image: '', toolId: 'furniture', params: { type: 'basin_cobra', elevation: 80 } },
    { id: 'sink_compact_basin', name: 'Compact Minimalist Basin', badge: 'COMPACT', material: 'Ceramic Basin', specs: '500 × 400 mm', image: '', toolId: 'furniture', params: { type: 'sink_compact_basin', elevation: 90 } },
    { id: 'sink_steel_stainless', name: 'Stainless Steel Basin', badge: 'STEEL', material: 'Brushed Steel', specs: '600 × 450 mm', image: '', toolId: 'furniture', params: { type: 'sink_steel_stainless', elevation: 90 } }
]);

const electronicsCatalog = ref([
    { isDivider: true, id: 'div_tvs', name: 'TVs & Display Screens' },
    { id: 'tv_modern_flat', name: 'Modern Flat TV', badge: '4K OLED', material: 'Slim Frame Screen', specs: '55 Inch', image: '', toolId: 'furniture', params: { type: 'tv_modern_flat', elevation: 90 } },
    { id: 'tv_wall_mounted', name: 'Wall Mounted TV Screen', badge: 'WALL MOUNT', material: 'Ultra-Thin OLED', specs: '65 Inch', image: '', toolId: 'furniture', params: { type: 'tv_wall_mounted', elevation: 110 } },
    { id: 'monitor_tv_lowpoly', name: 'Desktop Monitor TV', badge: 'MONITOR', material: 'Matte Black Panel', specs: '32 Inch', image: '', toolId: 'furniture', params: { type: 'monitor_tv_lowpoly', elevation: 75 } },
    { id: 'tv_living_room', name: 'Livingroom Widescreen TV', badge: '75 INCH', material: 'Smart TV Screen', specs: '75 Inch', image: '', toolId: 'furniture', params: { type: 'tv_living_room', elevation: 90 } },

    { isDivider: true, id: 'div_tv_stands_elec', name: 'TV Stands & Media Benches' },
    { id: 'tv_stand_reclaimed', name: 'Reclaimed Wood TV Stand', badge: 'RUSTIC', material: 'Solid Reclaimed Oak', specs: '1600 × 500 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_reclaimed', elevation: 0 } },
    { id: 'tv_stand_retro', name: 'Retro Mid-Century TV Stand', badge: 'RETRO', material: 'Walnut & Tapered Legs', specs: '1500 × 550 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_retro', elevation: 0 } },
    { id: 'tv_stand_small', name: 'Compact Small TV Stand', badge: 'COMPACT', material: 'White & Light Wood', specs: '1000 × 450 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_small', elevation: 0 } },
    { id: 'tv_stand_wooden_bench', name: 'Wooden Media Bench Table', badge: 'WOOD', material: 'Natural Teak Bench', specs: '1800 × 450 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_wooden_bench', elevation: 0 } },
    { id: 'tv_stand_modern_mraz', name: 'Modern Minimalist TV Stand', badge: 'SLIM', material: 'Matte Grey & Steel', specs: '1500 × 500 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_modern_mraz', elevation: 0 } },
    { id: 'tv_stand_classic', name: 'Classic Entertainment Unit', badge: 'CLASSIC', material: 'Mahogany & Drawers', specs: '1600 × 600 mm', image: '', toolId: 'furniture', params: { type: 'tv_stand_classic', elevation: 0 } }
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
    if (props.type === 'hood_catalog') return hoodCatalog.value;
    if (props.type === 'small_appliance_catalog') return smallApplianceCatalog.value;
    if (props.type === 'household_appliance_catalog') return householdApplianceCatalog.value;
    if (props.type === 'trash_catalog') return trashCatalog.value;
    if (props.type === 'bathroom_catalog') return bathroomCatalog.value;
    if (props.type === 'electronics_catalog') return electronicsCatalog.value;
    return [];
});

const filteredItems = computed(() => {
    let list = [...items.value];
    
    // 1. Text Search Query Filter
    const q = effectiveSearchQuery.value;
    if (q) {
        list = list.filter(i => i.isDivider || i.name.toLowerCase().includes(q) || (i.material && i.material.toLowerCase().includes(q)) || (i.specs && i.specs.toLowerCase().includes(q)));
    }
    
    // 2. Quick Category Chip Filter
    if (activeCategoryChip.value === 'favorites') {
        list = list.filter(i => i.isDivider || favoritesMap.value[i.id]);
    } else if (activeCategoryChip.value === 'wood') {
        list = list.filter(i => i.isDivider || (i.material && i.material.toLowerCase().includes('wood')) || (i.category === 'wood'));
    } else if (activeCategoryChip.value === 'glass') {
        list = list.filter(i => i.isDivider || (i.material && i.material.toLowerCase().includes('glass')) || (i.category === 'glass'));
    } else if (activeCategoryChip.value === 'single') {
        list = list.filter(i => i.isDivider || (i.params && i.params.doorType === 'single') || (i.category === 'single'));
    } else if (activeCategoryChip.value === 'double') {
        list = list.filter(i => i.isDivider || (i.params && (i.params.doorType === 'french' || i.params.doorType === 'double')) || (i.category === 'double'));
    }

    // 3. Functional Category Filter Popover
    if (filterOption.value === 'favorites') {
        list = list.filter(i => i.isDivider || favoritesMap.value[i.id]);
    } else if (filterOption.value === 'standard') {
        list = list.filter(i => i.isDivider || (i.params && (i.params.width <= 60 || i.params.doorStyle === 'flat' || i.params.windowType === 'casement_std' || i.params.doorType === 'single')));
    } else if (filterOption.value === 'wide') {
        list = list.filter(i => i.isDivider || (i.params && (i.params.width > 60 || i.params.doorType === 'french' || i.params.doorType === 'sliding' || i.params.windowType === 'panoramic_slider')));
    }

    // 4. Functional Sort
    const dividers = list.filter(i => i.isDivider);
    const nonDividers = list.filter(i => !i.isDivider);
    
    if (sortOption.value === 'name_asc') {
        nonDividers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOption.value === 'name_desc') {
        nonDividers.sort((a, b) => b.name.localeCompare(a.name));
    } else if (sortOption.value === 'recent') {
        nonDividers.reverse();
    } else {
        nonDividers.sort((a, b) => {
            const favA = favoritesMap.value[a.id] ? 1 : 0;
            const favB = favoritesMap.value[b.id] ? 1 : 0;
            return favB - favA;
        });
    }
    
    if (nonDividers.length === 0) return [];
    if (dividers.length === 0) return nonDividers;
    return list.map(item => item.isDivider ? item : nonDividers.shift()).filter(Boolean);
});

const isGenerating = ref(false);
let currentGenerationId = 0;
const generateThumbnails = async () => {
    const genId = ++currentGenerationId;
    isGenerating.value = true;
    try {
        const renderer = plannerStore.renderer3D;
        if (!renderer || !renderer.thumbnailGenerator) return;

        const list = items.value;
        for (const item of list) {
            if (genId !== currentGenerationId) break;
            if (!item.image && !item.isDivider) {
                try {
                    await new Promise(r => setTimeout(r, 10));
                    if (genId !== currentGenerationId) break;
                    const genType = (item.params && item.params.type) ? item.params.type : (item.toolId ? item.toolId : props.type);
                    const dataUrl = await renderer.thumbnailGenerator.generate(genType, item.params);
                    if (genId !== currentGenerationId) break;
                    if (dataUrl) item.image = dataUrl;
                } catch (err) {
                    console.error("Failed to generate thumbnail for", item.name, err);
                }
            }
        }
    } finally {
        if (genId === currentGenerationId) {
            isGenerating.value = false;
        }
    }
};

watch(() => plannerStore.renderer3D, (newRenderer) => {
    if (newRenderer) {
        generateThumbnails();
    }
}, { immediate: true });

watch(() => props.type, () => {
    localSearchQuery.value = '';
    activeCategoryChip.value = 'all';
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
    flex: 1 1 0%;
    height: 100%;
    width: 100%;
    min-height: 0;
    min-width: 0;
    background: #f8fafc;
    overflow: hidden;
    font-family: 'Inter', system-ui, sans-serif;
}

/* SUB-SECTION HEADER & SEARCH BAR */
.catalog-header-strip {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 18px 8px;
    background: transparent;
    flex-shrink: 0;
}

.header-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.section-title {
    margin: 0;
    font-size: 15.5px;
    color: #0f172a;
    font-weight: 700;
    letter-spacing: -0.01em;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
}

/* INLINE CATALOG SEARCH BAR */
.catalog-search-wrap {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
}

.search-icon {
    position: absolute;
    left: 12px;
    pointer-events: none;
    display: flex;
    align-items: center;
}

.catalog-search-input {
    width: 100%;
    height: 38px;
    padding: 0 32px 0 36px;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 12px;
    font-size: 13px;
    color: #1e293b;
    outline: none;
    transition: all 0.2s;
    box-sizing: border-box;
}

.catalog-search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.clear-search-btn {
    position: absolute;
    right: 8px;
    background: transparent;
    border: none;
    color: #94a3b8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2px;
}

.clear-search-btn:hover {
    color: #0f172a;
}

/* QUICK CATEGORY FILTER CHIPS */
.category-chips-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
}
.category-chips-bar::-webkit-scrollbar {
    display: none;
}

.chip-btn {
    flex-shrink: 0;
    padding: 4px 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    font-size: 11.5px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    transition: all 0.18s ease;
}

.chip-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
}

.chip-btn.active {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
    font-weight: 600;
}

.header-popover-wrapper {
    position: relative;
    display: inline-block;
    z-index: 110;
}

.action-popover {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 175px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.08);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: fadeInMenu 0.15s ease-out forwards;
}

@keyframes fadeInMenu {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.popover-header {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 6px 12px 4px;
}

.popover-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: #334155;
    font-size: 12.5px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
}

.popover-item:hover {
    background: #f1f5f9;
    color: #0f172a;
}

.popover-item.active {
    background: #eff6ff;
    color: #2563eb;
    font-weight: 600;
}

.sort-dropdown-chip {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 5px 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 20px;
    color: #475569;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
}

.sort-dropdown-chip:hover,
.sort-dropdown-chip.active {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
}

.filter-icon-btn {
    position: relative;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}

.filter-icon-btn:hover,
.filter-icon-btn.active {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
}

.filter-active-dot {
    position: absolute;
    top: -2px;
    right: -2px;
    width: 8px;
    height: 8px;
    background: #2563eb;
    border-radius: 50%;
    border: 2px solid #ffffff;
}

/* PRODUCTS GRID (3 COLUMNS FOR DESKTOP CATALOG) */
.products-grid {
    flex: 1 1 0%;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 16px 18px 32px;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 24px;
    align-content: start;
    -webkit-overflow-scrolling: touch;
}

.catalog-divider {
    grid-column: 1 / -1;
    font-size: 12.5px;
    font-weight: 700;
    color: #64748b;
    margin-top: 10px;
    margin-bottom: 2px;
    padding-bottom: 5px;
    border-bottom: 1px solid #e2e8f0;
    letter-spacing: -0.01em;
}

/* PURE WHITE PRODUCT CARD DESIGN */
.product-card {
    position: relative;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 16px;
    padding: 8px 6px 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 4px 18px rgba(15, 23, 42, 0.05);
    user-select: none;
    box-sizing: border-box;
}

/* HOVER ANIMATION: 6px LIFT + SLIGHT IMAGE ROTATION */
.product-card:hover {
    transform: translateY(-6px) scale(1.02);
    border-color: #3b82f6;
    box-shadow: 0 16px 36px -4px rgba(15, 23, 42, 0.12), 0 4px 14px -2px rgba(37, 99, 235, 0.08);
}

.product-card.active {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.18), 0 8px 20px -4px rgba(37, 99, 235, 0.15);
}

/* REDESIGNED HARMONIZED CATEGORY BADGE PILLS */
.card-badge {
    position: absolute;
    top: 9px;
    left: 9px;
    z-index: 6;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 8.5px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    pointer-events: none;
}

/* GOLD ★ BESTSELLER BADGE (GOLD FILL, WHITE TEXT, PILL SHAPE) */
.card-badge.bestseller-gold {
    background: #f59e0b;
    color: #ffffff;
    border: none;
    border-radius: 999px;
    padding: 3px 8px;
    box-shadow: 0 2px 6px rgba(245, 158, 11, 0.35);
}

/* CONSISTENT HARMONIZED COLORS FOR OTHER BADGES (SOFT NO-BORDER) */
.card-badge.popular-blue { background: #eff6ff; color: #3b82f6; border: none; }
.card-badge.glass-green { background: #f0fdf4; color: #22c55e; border: none; }
.card-badge.wood-yellow { background: #fefce8; color: #eab308; border: none; }
.card-badge.new-cyan { background: #ecfeff; color: #06b6d4; border: none; }
.card-badge.compact-orange { background: #fff7ed; color: #f97316; border: none; }
.card-badge.default-badge { background: #f8fafc; color: #64748b; border: none; }

/* CIRCULAR WHITE GLASS FAVORITE HEART BUTTON */
.favorite-heart-btn {
    position: absolute;
    top: 9px;
    right: 9px;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(226, 232, 240, 0.6);
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    z-index: 6;
    transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.favorite-heart-btn svg {
    transition: all 0.2s;
}

.favorite-heart-btn:hover {
    transform: scale(1.1);
    background: #ffffff;
    box-shadow: 0 3px 8px rgba(239, 68, 68, 0.15);
    border-color: #fca5a5;
}

.favorite-heart-btn:hover svg {
    fill: #fecaca;
    stroke: #ef4444;
}

.favorite-heart-btn.is-active {
    animation: heartPulse 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.favorite-heart-btn.is-active svg {
    fill: #ef4444;
}

@keyframes heartPulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.28); }
    100% { transform: scale(1); }
}

/* PURE WHITE CARD 3D THUMBNAIL CANVAS (CENTERED, TRANSPARENT) */
.card-thumb-wrap {
    width: 100%;
    height: 130px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    margin-bottom: 4px;
    position: relative;
    border-radius: 12px;
    background: #ffffff;
}

.card-thumb-wrap img {
    max-width: 90%;
    max-height: 115px;
    height: 100%;
    object-fit: contain;
    margin: 0 auto;
    display: block;
    filter: drop-shadow(0 4px 8px rgba(15, 23, 42, 0.08));
    transition: transform 0.32s cubic-bezier(0.16, 1, 0.3, 1);
}

/* INTERACTIVE THUMBNAIL ZOOM ON HOVER */
.product-card:hover .card-thumb-wrap img {
    transform: scale(1.08);
}

/* SKELETON SHIMMER PLACEHOLDER */
.skeleton-shimmer {
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, #f8fafc 0%, #e2e8f0 50%, #f8fafc 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
}

.fallback-thumb-box {
    width: 64px;
    height: 64px;
    border-radius: 12px;
    background: #f8fafc;
    display: flex;
    align-items: center;
    justify-content: center;
}

.active-badge-dot {
    position: absolute;
    bottom: 6px;
    right: 6px;
    width: 20px;
    height: 20px;
    background: #2563eb;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(37, 99, 235, 0.4);
}

/* PRODUCT TITLE & METADATA LINE (6px EXTRA LEFT/RIGHT PADDING) */
.card-title-wrap {
    width: 100%;
    text-align: left;
    padding: 8px 6px 4px;
    box-sizing: border-box;
    border-top: 1px solid #f1f5f9;
}

.product-rating {
    font-size: 11px;
    color: #fbbf24;
    margin-bottom: 3px;
    letter-spacing: 1px;
}

.product-title {
    font-size: 13px;
    color: #0f172a;
    font-weight: 700;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}

.card-meta-line {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 4px;
    font-size: 11px;
    color: #64748b;
    margin-top: 5px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.card-extra-meta {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-top: 8px;
}

.meta-tag {
    font-size: 9.5px;
    font-weight: 600;
    color: #475569;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
}

.meta-tag.text-green {
    color: #16a34a;
    background: #f0fdf4;
}

.meta-mat {
    font-weight: 600;
    color: #475569;
}
.meta-dot {
    color: #cbd5e1;
}
.meta-specs {
    color: #64748b;
}

/* NO DATA DISPLAY */
.empty-result-box {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
    text-align: center;
    box-sizing: border-box;
    animation: fadeInEmpty 0.25s ease-out;
}

@keyframes fadeInEmpty {
    from { opacity: 0; transform: scale(0.96); }
    to { opacity: 1; transform: scale(1); }
}

.empty-icon-circle {
    width: 76px;
    height: 76px;
    border-radius: 50%;
    background: #f1f5f9;
    border: 1.5px dashed #cbd5e1;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 16px;
    color: #64748b;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.empty-title {
    margin: 0 0 6px;
    font-size: 16px;
    font-weight: 700;
    color: #1e293b;
    letter-spacing: -0.01em;
}

.empty-subtext {
    margin: 0 0 20px;
    font-size: 13px;
    color: #64748b;
    max-width: 240px;
    line-height: 1.45;
}

.reset-filter-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 9px 18px;
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #dbeafe;
    border-radius: 12px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
}

.reset-filter-btn:hover {
    background: #dbeafe;
    border-color: #bfdbfe;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.16);
}

/* RESPONSIVE BREAKPOINTS */
@media (max-width: 1024px) {
    .catalog-header-strip {
        padding: 12px 14px 6px;
    }
    .products-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
        padding: 8px 14px 20px;
    }
    .card-thumb-wrap {
        height: 115px;
    }
}

@media (max-width: 640px) {
    .products-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
        padding: 6px 10px 24px;
    }
    .card-thumb-wrap {
        height: 100px;
    }
    .product-title {
        font-size: 11px;
    }
}
</style>
