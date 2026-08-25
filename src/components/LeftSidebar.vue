<template>
  <aside
    class="left-sidebar"
    v-show="viewMode === '2d' && (!(isMobile || isTablet) || ((isMobile || isTablet) && mobileMenuOpen && activeMobileTab === 'tools'))"
    :class="{'mobile-panel': isMobile || isTablet}"
  >
    <div class="sidebar-layout">
        <!-- Far-left Icon / Expanded Navigation Dock -->
        <div class="sidebar-dock" :class="{ 'dock-expanded': isDockExpanded && !(isMobile && !isTablet) }">
            <!-- Top Header Row: Expand/Collapse Toggle & Mobile Close -->
            <div class="dock-top-bar">
                <!-- Close Button only on Mobile / Tablet overlays -->
                <button v-if="isMobile || isTablet" class="dock-btn menu-toggle-btn" @click="handleDockToggle" title="Close Menu">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                <!-- Header Text in Expanded Mode -->
                <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-main-title">TOOLS</span>

                <!-- Expand / Collapse Toggle Button (Desktop & Tablet) -->
                <button v-if="!(isMobile && !isTablet)" class="expand-toggle-btn" @click="toggleDockExpand" :title="isDockExpanded ? 'Collapse to icons-only' : 'Expand labels'">
                    <svg v-if="isDockExpanded" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="11 17 6 12 11 7"></polyline><polyline points="18 17 13 12 18 7"></polyline></svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="13 17 18 12 13 7"></polyline><polyline points="6 17 11 12 6 7"></polyline></svg>
                </button>
            </div>

            <!-- 1. Grouped & Organized Tool Categories -->
            <div class="dock-nav-groups">
                <template v-for="(group, gIdx) in groupedNavigation" :key="group.groupLabel">
                    <!-- Subtle divider line in collapsed mode -->
                    <div v-if="gIdx > 0 && !isDockExpanded" class="dock-group-separator"></div>
                    
                    <!-- Group Header text in expanded mode -->
                    <div v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-group-header">{{ group.groupLabel }}</div>
                    
                    <!-- Category Buttons with Active State & Hover Tooltips -->
                    <button v-for="cat in group.items" :key="cat.id" 
                            class="dock-btn nav-item-btn" 
                            :class="{ active: activeCategory === cat.id }" 
                            @click="$emit('toggle-category', cat.id)">
                        
                        <!-- 2. Clean Active State Accent Bar -->
                        <div class="active-accent-bar"></div>

                        <!-- Icon -->
                        <div class="dock-icon-wrapper">
                            <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="cat.icon"></svg>
                        </div>
                        
                        <!-- Full Label (Expanded Mode) -->
                        <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-item-label">{{ cat.name }}</span>
                        
                        <!-- 4. Dark Tooltip on Hover (Collapsed Icons-Only Mode) -->
                        <span v-if="!isDockExpanded && !(isMobile || isTablet)" class="dock-tooltip">{{ cat.name }}</span>
                    </button>
                </template>
            </div>

            <div style="flex: 1;"></div>
            
            <!-- Bottom Project Management & Settings Actions (MORE / SYSTEM) -->
            <div class="dock-bottom-actions">
                <div v-if="!isDockExpanded" class="dock-group-separator"></div>
                <div v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-group-header">MORE</div>

                <!-- Export Project -->
                <button class="dock-btn nav-item-btn" @click="$emit('save-project')">
                    <div class="dock-icon-wrapper">
                        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </div>
                    <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-item-label">Export Project</span>
                    <span v-if="!isDockExpanded && !(isMobile || isTablet)" class="dock-tooltip">Export Project</span>
                </button>

                <!-- Save to Cloud -->
                <button class="dock-btn nav-item-btn" @click="$emit('open-save-popup')" style="color: #8b5cf6;">
                    <div class="dock-icon-wrapper">
                        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
                    </div>
                    <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-item-label">Save to Cloud</span>
                    <span v-if="!isDockExpanded && !(isMobile || isTablet)" class="dock-tooltip">Save to Cloud</span>
                </button>

                <!-- Import Project -->
                <button class="dock-btn nav-item-btn" @click="$emit('trigger-file-input')">
                    <div class="dock-icon-wrapper">
                        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    </div>
                    <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-item-label">Import Project</span>
                    <span v-if="!isDockExpanded && !(isMobile || isTablet)" class="dock-tooltip">Import Project</span>
                </button>

                <!-- Clear Workspace -->
                <button class="dock-btn nav-item-btn" @click="$emit('clear-workspace')" style="color: #ef4444;">
                    <div class="dock-icon-wrapper">
                        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </div>
                    <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-item-label">Clear All</span>
                    <span v-if="!isDockExpanded && !(isMobile || isTablet)" class="dock-tooltip">Clear All</span>
                </button>

                <!-- About & Credits -->
                <button class="dock-btn nav-item-btn" @click="$emit('open-credits-popup')" style="color: #64748b;">
                    <div class="dock-icon-wrapper">
                        <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                    </div>
                    <span v-if="isDockExpanded && !(isMobile && !isTablet)" class="dock-item-label">About & Credits</span>
                    <span v-if="!isDockExpanded && !(isMobile || isTablet)" class="dock-tooltip">About & Credits</span>
                </button>
            </div>
            <input type="file" id="fileInput" @change="$emit('file-uploaded', $event)" style="display: none" accept=".json"/>
        </div>

        <!-- Main Modern Catalog Submenu Drawer Panel -->
        <div class="sidebar-submenu modern-panel" :class="{ 'with-expanded-dock': isDockExpanded && !(isMobile && !isTablet) }" v-if="activeCategoryObj">
            <!-- Header with Title & Close button -->
            <div class="drawer-header">
                <h2 class="drawer-title">{{ activeCategoryObj.name }}</h2>
                <button class="drawer-close-btn" @click="handleClosePanel" title="Close Panel">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            <!-- Top Filter & Search Controls -->
            <div class="panel-controls" v-if="activeToolObj">
                <!-- Interactive Dropdown Chip matching user design -->
                <div class="tool-dropdown-wrapper">
                    <button class="tool-dropdown-pill" @click.stop="toolDropdownOpen = !toolDropdownOpen" :class="{ open: toolDropdownOpen }" title="Select Tool Category">
                        <span class="pill-title">{{ activeToolObj.name }}</span>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" :style="{ transform: toolDropdownOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </button>

                    <!-- Floating Dropdown Popover Menu -->
                    <div class="tool-dropdown-menu" v-if="toolDropdownOpen" @click.stop>
                        <button 
                            v-for="tool in availableTools" 
                            :key="tool.id" 
                            class="dropdown-item-btn" 
                            :class="{ active: activeToolObj.id === tool.id }"
                            @click="selectSubTool(tool); toolDropdownOpen = false"
                        >
                            <span class="item-name">{{ tool.name }}</span>
                            <svg v-if="activeToolObj.id === tool.id" class="check-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.8"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </button>
                    </div>
                </div>

                <!-- Modern Search Bar -->
                <div class="search-input-wrapper">
                    <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input type="text" v-model="catalogSearchQuery" placeholder="Search models..." class="modern-search-input" />
                </div>

                <!-- Horizontal Subcategory Toggle Tabs ([Door] [Window] [Opening]) -->
                <div class="tool-tabs-row" v-if="availableTools.length > 1">
                    <button 
                        v-for="tool in availableTools" 
                        :key="tool.id" 
                        class="tool-tab-btn"
                        :class="{ active: activeToolObj.id === tool.id }"
                        @click="selectSubTool(tool)"
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" v-html="getToolTabIcon(tool.id)"></svg>
                        <span class="tab-label">{{ getShortToolName(tool.id, tool.name) }}</span>
                    </button>
                </div>
            </div>

            <!-- Catalog Content Body -->
            <div class="panel-body" :class="{ 'catalog-mode-body': activeToolObj && isCatalogTool(activeToolObj.id) }">
                <template v-if="activeToolObj && isCatalogTool(activeToolObj.id)">
                    <CatalogGallery 
                        :type="activeToolObj.id" 
                        :modelValue="activePresetId" 
                        :searchQuery="catalogSearchQuery"
                        @update:modelValue="$emit('update:activePresetId', $event)" 
                        @select="$emit('catalog-select', $event)" 
                        @reset-filters="catalogSearchQuery = ''"
                    />
                </template>
                <div v-else-if="activeToolObj" class="action-tool-container">
                    <div class="action-tool-card">
                        <!-- Top Status Badge -->
                        <div class="card-status-badge">
                            <span>{{ getToolDetails(activeToolObj.id, activeToolObj.name).badge }}</span>
                        </div>

                        <!-- Header with Animated Architectural Icon -->
                        <div class="card-hero-header">
                            <div class="action-icon-wrap">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" v-html="getToolDetails(activeToolObj.id, activeToolObj.name).icon"></svg>
                            </div>
                            <div class="card-titles">
                                <span class="card-subtitle">{{ getToolDetails(activeToolObj.id, activeToolObj.name).subtitle }}</span>
                                <h4 class="card-main-title">{{ getToolDetails(activeToolObj.id, activeToolObj.name).title }}</h4>
                            </div>
                        </div>

                        <!-- Overview Description -->
                        <p class="card-description">{{ getToolDetails(activeToolObj.id, activeToolObj.name).description }}</p>

                        <!-- Highlights / Instructions Box -->
                        <div class="card-features-box">
                            <span class="features-header">KEY CAPABILITIES</span>
                            <ul class="features-list">
                                <li v-for="(feat, idx) in getToolDetails(activeToolObj.id, activeToolObj.name).features" :key="idx">
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.6" class="check-bullet"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                    <span>{{ feat }}</span>
                                </li>
                            </ul>
                        </div>

                        <!-- Primary Action Button -->
                        <button class="activate-tool-btn" @click="$emit('tool-click', activeToolObj)">
                            <span>{{ getToolDetails(activeToolObj.id, activeToolObj.name).btnText }}</span>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Fallback Quick-Select Dashboard for Mobile/Tablet when No Category is Active -->
        <div class="sidebar-submenu modern-panel fallback-panel" v-else-if="isMobile || isTablet">
            <div class="drawer-header">
                <h2 class="drawer-title">Tools & Catalogs</h2>
                <button class="drawer-close-btn" @click="$emit('close-mobile-menu')" title="Close Panel">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
            <div class="fallback-content-box">
                <div class="welcome-hero">
                    <div class="hero-icon-circle">
                        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
                    </div>
                    <h3 class="hero-title">Select a Catalog</h3>
                    <p class="hero-desc">Choose a design category from the left navigation icon strip to begin placing walls, doors, windows, and modular furnishings.</p>
                </div>
                <div class="quick-shortcuts-section">
                    <span class="shortcuts-title">POPULAR SHORTCUTS</span>
                    <div class="shortcuts-grid">
                        <button class="shortcut-btn" @click="$emit('toggle-category', 'walls')">
                            <span class="sc-title">Walls & Rooms</span>
                            <span class="sc-desc">Draw boundaries</span>
                        </button>
                        <button class="shortcut-btn" @click="$emit('toggle-category', 'doors_windows')">
                            <span class="sc-title">Doors & Windows</span>
                            <span class="sc-desc">Place frames</span>
                        </button>
                        <button class="shortcut-btn" @click="$emit('toggle-category', 'furniture')">
                            <span class="sc-title">Furniture</span>
                            <span class="sc-desc">Interior seating</span>
                        </button>
                        <button class="shortcut-btn" @click="$emit('toggle-category', 'kitchen')">
                            <span class="sc-title">Modular Kitchen</span>
                            <span class="sc-desc">Counters & sinks</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
  </aside>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import CatalogGallery from './sidebar/CatalogGallery.vue';

const props = defineProps({
  viewMode: String,
  isMobile: Boolean,
  isTablet: Boolean,
  mobileMenuOpen: Boolean,
  activeMobileTab: String,
  activeRightTab: String,
  menuCategories: Array,
  activeCategory: String,
  activeCategoryObj: Object,
  activeTool: String,
  activePresetId: String
});

const emit = defineEmits([
  'close-mobile-menu', 'toggle-category', 'save-project', 'open-save-popup', 
  'trigger-file-input', 'clear-workspace', 'file-uploaded', 'tool-click', 
  'catalog-select', 'update:activePresetId', 'open-credits-popup', 'toggle-menu', 
  'toggle-tab', 'open-layers', 'open-settings'
]);

const catalogSearchQuery = ref('');
const currentToolId = ref(null);
const toolDropdownOpen = ref(false);
const isDockExpanded = ref(false);

const toggleDockExpand = () => {
    isDockExpanded.value = !isDockExpanded.value;
};

const groupedNavigation = computed(() => {
    const cats = props.menuCategories || [];
    const getByIds = (ids) => cats.filter(c => ids.includes(c.id));
    
    return [
        {
            groupLabel: 'CREATE',
            items: getByIds(['tools', 'walls', 'floors', 'outdoor_spaces', 'common'])
        },
        {
            groupLabel: 'BUILD',
            items: getByIds(['doors_windows', 'staircases', 'roof_presets', 'shapes', 'advance_openings'])
        },
        {
            groupLabel: 'FURNISH',
            items: getByIds(['furniture', 'kitchen', 'bathroom', 'electronics'])
        },
        {
            groupLabel: 'UTILITY',
            items: getByIds(['smart_wizard'])
        }
    ].filter(g => g.items.length > 0);
});

const closeToolDropdown = () => {
    if (toolDropdownOpen.value) {
        toolDropdownOpen.value = false;
    }
};

onMounted(() => {
    window.addEventListener('click', closeToolDropdown);
});

onUnmounted(() => {
    window.removeEventListener('click', closeToolDropdown);
});

const handleClosePanel = () => {
    if (props.isMobile || props.isTablet) {
        emit('close-mobile-menu');
    }
    emit('toggle-category', props.activeCategory);
};

const handleDockToggle = () => {
    if (props.isMobile || props.isTablet) {
        emit('close-mobile-menu');
    } else {
        emit('toggle-menu');
    }
};

const availableTools = computed(() => {
    if (!props.activeCategoryObj || !props.activeCategoryObj.tools) return [];
    return props.activeCategoryObj.tools.filter(t => !t.isDivider);
});

watch(() => props.activeCategoryObj, (newObj) => {
    catalogSearchQuery.value = '';
    toolDropdownOpen.value = false;
    if (newObj && newObj.tools) {
        const validTools = newObj.tools.filter(t => !t.isDivider);
        if (validTools.length > 0) {
            const match = validTools.find(t => t.id === props.activeTool);
            currentToolId.value = match ? match.id : validTools[0].id;
        }
    }
}, { immediate: true });

watch(() => props.activeTool, (newTool) => {
    if (newTool && availableTools.value.some(t => t.id === newTool)) {
        currentToolId.value = newTool;
    }
});

const activeToolObj = computed(() => {
    if (!availableTools.value || availableTools.value.length === 0) return null;
    return availableTools.value.find(t => t.id === currentToolId.value) || availableTools.value[0];
});

const selectSubTool = (tool) => {
    currentToolId.value = tool.id;
    emit('tool-click', tool);
};

const isCatalogTool = (toolId) => {
    const catalogTools = [
        'door', 'window', 'skirting', 'sunshade', 'jali_panel', 'curtain', 'wall_art', 'staircase', 'roof', 
        'dormer', 'molding', 'elevation_fascia', 'wall_catalog', 'shape_catalog', 
        'outdoor_spaces', 'outdoor_pavement', 'outdoor_patio', 'outdoor_softscape', 'outdoor_other',
        'adv_opening_catalog', 'railing_catalog', 'furniture_catalog', 'kitchen_catalog', 'bathroom_catalog', 'electronics_catalog', 
        'sink_catalog', 'tap_catalog', 'hood_catalog', 'small_appliance_catalog', 
        'household_appliance_catalog', 'wine_cellar_catalog', 'trash_catalog'
    ];
    return catalogTools.includes(toolId) || toolId.includes('catalog') || toolId.startsWith('outdoor_');
};

const getToolDetails = (toolId, toolName) => {
    if (toolId === 'select') {
        return {
            title: 'Select & Edit Workspace',
            subtitle: 'Interactive Design Mode',
            badge: '🟢 Active Selection',
            icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path>',
            description: 'Click, drag, and customize any wall, opening, or 3D furniture item directly on your architectural canvas.',
            features: [
                'Click any wall, room, or item to reveal parameter gizmos',
                'Drag object handles to reposition, rotate, or scale in real-time',
                'Independent material overrides without altering geometry'
            ],
            btnText: 'Activate Select Mode'
        };
    }
    if (toolId === 'pan') {
        return {
            title: 'Pan Canvas Viewpoint',
            subtitle: 'Navigation & Workspace View',
            badge: '🧭 Navigation Mode',
            icon: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"></path>',
            description: 'Smoothly reposition your 2D design workspace or orbit around your 3D building model without selecting objects.',
            features: [
                'Slide freely across the grid without displacing furniture',
                'Essential for navigating complex multi-room layouts',
                'Quick shortcut: hold down Space bar while in Select mode'
            ],
            btnText: 'Activate Pan Mode'
        };
    }
    if (toolId === 'auto_roof' || toolId === 'roof') {
        return {
            title: 'Automated Roof Generator',
            subtitle: 'Smart Structural Assembly',
            badge: '🏠 Smart Generator',
            icon: '<path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>',
            description: 'Automatically construct miter-cut gables, hips, or custom roofs fitted precisely to your external walls.',
            features: [
                'Auto-detects perimeter wall outlines & calculates overhangs',
                'Independent roof material surfacing (shingles, tiles, slabs)',
                'Non-destructive pitch & elevation modification'
            ],
            btnText: 'Generate Auto Roof'
        };
    }
    if (toolId && (toolId.includes('smart') || toolId.includes('wizard'))) {
        return {
            title: toolName || 'Smart Wizard Assistant',
            subtitle: 'Automated Layout Calibration',
            badge: '✨ Automated Wizard',
            icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
            description: 'Intelligent multi-step wizards to automatically align, balance, and resize room configurations.',
            features: [
                'Facing direction alignment analysis',
                'Proportional wall resizing across connected rooms',
                'Non-destructive architectural recalibration'
            ],
            btnText: 'Launch Wizard'
        };
    }
    if (toolId && toolId.startsWith('outdoor_')) {
        const title = toolName || (toolId === 'outdoor_pavement' ? 'Pavement' : toolId === 'outdoor_patio' ? 'Patio' : toolId === 'outdoor_softscape' ? 'Softscape' : 'Other space');
        return {
            title: `Draw ${title}`,
            subtitle: 'Outdoor Landscape Zone',
            badge: '🌿 Outdoor Zone',
            icon: '<polygon points="12 2 2 8.5 5.8 19 18.2 19 22 8.5 12 2"></polygon><circle cx="12" cy="11" r="2.5"></circle>',
            description: `Draw custom multi-point polygonal ${title.toLowerCase()} areas for pathways, driveways, garden beds, and outdoor living.`,
            features: [
                'Click canvas to place polygon corner vertices',
                'Snap to exterior walls, corners, and property boundaries',
                'Seamless PBR textures (grass, slate, pavers, teak wood)'
            ],
            btnText: `Start Drawing ${title}`
        };
    }
    if (toolId === 'shape_floor_cut') {
        return {
            title: 'Floor Cutout & Stair Holes',
            subtitle: 'Structural Slab Penetrations',
            badge: '🛠️ Slab Cutout',
            icon: '<path d="M19 3H15V7H11V11H7V15H3V21H19Z"></path>',
            description: 'Carve precise custom structural openings, stairwell penetrations, and elevator shafts through floor slabs.',
            features: [
                'Draw customized geometric cutout boundaries on slabs',
                'Essential for multi-floor staircase & atrium openings',
                'Maintains surrounding ceiling & floor material integrity'
            ],
            btnText: 'Activate Floor Cut'
        };
    }
    return {
        title: toolName || 'Architectural Component',
        subtitle: 'Structural CAD Object',
        badge: '🔧 Tool',
        icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path>',
        description: 'Interactive structural object ready to place and customize.',
        features: [
            'CAD-accurate dimensional precision',
            'Full 2D & 3D real-time synchronicity',
            'Customizable materials and heights'
        ],
        btnText: `Select ${toolName || 'Tool'}`
    };
};

const getShortToolName = (toolId, name) => {
    if (toolId === 'door') return 'Doors';
    if (toolId === 'window') return 'Windows';
    if (toolId === 'curtain') return 'Curtains';
    if (toolId === 'wall_art') return 'Wall Art';
    if (toolId === 'skirting') return 'Baseboards';
    if (toolId === 'sunshade') return 'Sunshade';
    if (toolId === 'jali_panel') return 'Jali';
    if (toolId === 'elevation_fascia') return 'Fascia';
    if (toolId === 'molding') return 'Molding';
    if (toolId === 'staircase') return 'Staircase';
    if (toolId === 'roof') return 'Roof';
    if (toolId === 'dormer') return 'Dormer';
    if (toolId === 'wall_catalog') return 'Walls';
    if (toolId === 'compound') return 'Compound';
    if (toolId === 'shape_catalog') return '3D Shapes';
    if (toolId === 'railing_catalog') return 'Railings';
    if (toolId === 'furniture_catalog') return 'Furniture';
    if (toolId === 'kitchen_catalog') return 'Kitchen';
    if (toolId === 'bathroom_catalog') return 'Bathroom';
    if (toolId === 'electronics_catalog') return 'Electronics';
    if (toolId === 'outdoor_pavement') return 'Pavement';
    if (toolId === 'outdoor_patio') return 'Patio';
    if (toolId === 'outdoor_softscape') return 'Softscape';
    if (toolId === 'outdoor_other') return 'Other space';
    return name || 'Tool';
};

const getToolTabIcon = (toolId) => {
    if (toolId === 'outdoor_pavement') {
        return '<polygon points="12 2 2 9 6 20 18 20 22 9 12 2" stroke-width="1.8"></polygon><rect x="9" y="11" width="6" height="5" rx="1"></rect><circle cx="10" cy="16" r="1"></circle><circle cx="14" cy="16" r="1"></circle>';
    }
    if (toolId === 'outdoor_patio') {
        return '<polygon points="12 2 2 9 6 20 18 20 22 9 12 2" stroke-width="1.8"></polygon><path d="M12 7v7M9 10h6M8 14h8"></path>';
    }
    if (toolId === 'outdoor_softscape') {
        return '<polygon points="12 2 2 9 6 20 18 20 22 9 12 2" stroke-width="1.8"></polygon><circle cx="12" cy="10" r="2"></circle><path d="M12 12v4M10 14c2 0 2-2 2-2"></path>';
    }
    if (toolId === 'outdoor_other') {
        return '<polygon points="12 2 2 9 6 20 18 20 22 9 12 2" stroke-width="1.8"></polygon>';
    }
    if (toolId === 'door') {
        return '<path d="M18 20V6a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14"></path><path d="M2 20h20"></path><path d="M14 12v.01"></path>';
    }
    if (toolId === 'window') {
        return '<rect x="3" y="3" width="18" height="18" rx="2"></rect><line x1="3" y1="12" x2="21" y2="12"></line><line x1="12" y1="3" x2="12" y2="21"></line>';
    }
    if (toolId === 'skirting') {
        return '<path d="M3 21h18M3 17h18M3 7v14M21 7v14M3 7c2 0 3-3 6-3h12v3"></path>';
    }
    if (toolId === 'sunshade') {
        return '<path d="M3 10h18l-2-6H5l-2 6z"></path><path d="M6 10v6"></path><path d="M18 10v6"></path><path d="M3 10a3 3 0 0 0 6 0"></path><path d="M9 10a3 3 0 0 0 6 0"></path><path d="M15 10a3 3 0 0 0 6 0"></path>';
    }
    if (toolId === 'jali_panel') {
        return '<rect x="3" y="3" width="18" height="18" rx="1"></rect><path d="M3 9h18M3 15h18M9 3v18M15 3v18"></path>';
    }
    if (toolId === 'elevation_fascia') {
        return '<rect x="3" y="3" width="18" height="18" rx="2" fill="none"></rect><path d="M7 3v18M17 3v18M3 7h18"></path>';
    }
    if (toolId === 'curtain') {
        return '<path d="M3 3h18v2H3zM4 5v16h6V5zm10 0v16h6V5z"></path>';
    }
    if (toolId === 'wall_art') {
        return '<rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>';
    }
    if (toolId === 'adv_opening_catalog') {
        return '<path d="M4 4h16v16H4V4z"></path><path d="M4 12h16"></path><path d="M8 12V4"></path><path d="M16 12V4"></path>';
    }
    if (toolId === 'wall_catalog' || toolId === 'compound') {
        return '<path d="M4 4h16v16H4z"></path><path d="M4 12h16"></path><path d="M12 4v16"></path>';
    }
    if (toolId === 'furniture_catalog') {
        return '<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"></path><path d="M2 13h20v5H2z"></path>';
    }
    if (toolId === 'bathroom_catalog') {
        return '<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><path d="M4 10h16"></path><path d="M6 10V6a2 2 0 0 1 2-2h3a1 1 0 0 1 1 1v1"></path>';
    }
    if (toolId === 'electronics_catalog') {
        return '<rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect><polyline points="17 2 12 7 7 2"></polyline>';
    }
    return '<circle cx="12" cy="12" r="7"></circle><polyline points="12 9 12 12 14 14"></polyline>';
};
</script>

<style scoped>
.left-sidebar {
    width: 68px;
    min-width: 68px;
    max-width: 68px;
    height: 100%;
    z-index: 30;
    pointer-events: auto;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    overflow: visible !important;
    position: relative;
    flex-shrink: 0;
}

.sidebar-layout {
    display: flex;
    height: 100%;
    width: 68px;
    background: transparent;
    overflow: visible !important;
    position: relative;
}

/* 6. MODERN VISUAL STYLE: SOFT BACKGROUND, CURVED CORNERS, CONSISTENT SPACING */
.sidebar-dock {
    width: 68px;
    min-width: 68px;
    height: 100%;
    background: #ffffff;
    border-right: 1px solid #f1f5f9;
    border-top-right-radius: 24px;
    border-bottom-right-radius: 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 10px;
    gap: 8px;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 45;
    box-sizing: border-box;
    position: relative;
    box-shadow: 6px 0 28px rgba(15, 23, 42, 0.05);
    transition: width 0.28s cubic-bezier(0.16, 1, 0.3, 1), padding 0.28s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.28s ease;
}

/* 3. COLLAPSE / EXPAND DOCK STATE */
.sidebar-dock.dock-expanded {
    width: 240px;
    min-width: 240px;
    padding: 16px 14px;
    box-shadow: 14px 0 45px rgba(15, 23, 42, 0.09);
}

/* 5. AUTO HIDE SCROLLBAR */
.sidebar-dock {
    scrollbar-width: thin;
    scrollbar-color: transparent transparent;
    transition: scrollbar-color 0.3s ease;
}
.sidebar-dock:hover {
    scrollbar-color: #cbd5e1 transparent;
}
.sidebar-dock::-webkit-scrollbar {
    width: 5px;
}
.sidebar-dock::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 6px;
    transition: background-color 0.3s ease;
}
.sidebar-dock:hover::-webkit-scrollbar-thumb {
    background: #cbd5e1;
}

/* DOCK TOP BAR & TOGGLES */
.dock-top-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    margin-bottom: 6px;
    position: relative;
    flex-shrink: 0;
}

.sidebar-dock:not(.dock-expanded) .dock-top-bar {
    justify-content: center;
    flex-direction: column;
    gap: 10px;
}

.dock-main-title {
    font-size: 13.5px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: 0.08em;
    padding-left: 6px;
    text-transform: uppercase;
}

.expand-toggle-btn {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.03);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    flex-shrink: 0;
}

.expand-toggle-btn:hover {
    background: #eff6ff;
    color: #2563eb;
    border-color: #bfdbfe;
    transform: scale(1.06);
}

/* 1. GROUPED & ORGANIZED NAVIGATION SECTIONS */
.dock-nav-groups, .dock-bottom-actions {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 3px;
    flex-shrink: 0;
}

.dock-group-separator {
    width: 28px;
    height: 1.5px;
    background: #f1f5f9;
    margin: 6px auto;
    border-radius: 2px;
    transition: all 0.2s ease;
}

.dock-group-header {
    font-size: 10.5px;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 10px 10px 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: none;
}

/* BUTTON STYLING */
.dock-btn {
    width: 100%;
    height: 44px;
    border-radius: 12px;
    border: none;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 0 12px;
    gap: 12px;
    color: #475569;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    position: relative;
    box-sizing: border-box;
    overflow: visible;
    flex-shrink: 0;
}

.sidebar-dock:not(.dock-expanded) .dock-btn {
    width: 44px;
    justify-content: center;
    padding: 0;
    margin: 0 auto;
}

.dock-icon-wrapper {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.dock-icon {
    width: 21px;
    height: 21px;
    stroke: currentColor;
}

.dock-item-label {
    font-size: 13.8px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: inherit;
}

.dock-btn:hover {
    background: #f8fafc;
    color: #0f172a;
}

.sidebar-dock:not(.dock-expanded) .dock-btn:hover {
    transform: translateY(-1px);
}

/* 2. CLEAN ACTIVE STATE WITH BLUE ACCENT BAR */
.active-accent-bar {
    position: absolute;
    left: -2px;
    top: 10px;
    bottom: 10px;
    width: 3.5px;
    border-radius: 4px;
    background: #2563eb;
    opacity: 0;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-dock:not(.dock-expanded) .active-accent-bar {
    left: 2px;
}

.dock-btn.active {
    background: #eff6ff;
    color: #2563eb;
    font-weight: 600;
    box-shadow: 0 4px 14px rgba(37, 99, 235, 0.1);
}

.dock-btn.active .active-accent-bar {
    opacity: 1;
}

/* 4. TOOLTIP ON HOVER (DARK STYLED BOX) */
.dock-tooltip {
    position: absolute;
    left: calc(100% + 14px);
    top: 50%;
    transform: translateY(-50%) translateX(-8px);
    background: #111827;
    color: #ffffff;
    padding: 6.5px 13px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 500;
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    z-index: 1500;
    box-shadow: 0 8px 20px -4px rgba(15, 23, 42, 0.35);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.dock-btn:hover .dock-tooltip {
    opacity: 1;
    transform: translateY(-50%) translateX(0);
}

.dock-separator {
    width: 28px;
    height: 1px;
    background: #e2e8f0;
    margin: 4px auto;
}

.menu-toggle-btn {
    margin-bottom: 2px;
    color: #1e293b;
}

/* MODERN SUBMENU DRAWER PANEL (FLOATING OVERLAY ON DESKTOP & TABLET) */
.sidebar-submenu.modern-panel {
    position: absolute;
    top: 0;
    left: 68px;
    width: 500px;
    background: #ffffff;
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    height: 100%;
    max-height: 100%;
    overflow: hidden;
    box-shadow: 20px 0 45px -5px rgba(15, 23, 42, 0.15), 4px 0 20px -2px rgba(0, 0, 0, 0.08);
    z-index: 40;
    box-sizing: border-box;
    transition: left 0.28s cubic-bezier(0.16, 1, 0.3, 1);
    animation: drawerOverlaySlide 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.sidebar-submenu.modern-panel.with-expanded-dock {
    left: 240px !important;
}

@keyframes drawerOverlaySlide {
    from { opacity: 0; transform: translateX(-16px); }
    to { opacity: 1; transform: translateX(0); }
}

/* TOP HEADER */
.drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px 24px 12px;
    background: #ffffff;
    flex-shrink: 0;
}

.drawer-title {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.02em;
}

.drawer-close-btn {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: none;
    background: transparent;
    color: #64748b;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s;
}

.drawer-close-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
}

/* CONTROLS (PILL, SEARCH, TABS) */
.panel-controls {
    padding: 8px 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: #ffffff;
    border-bottom: 1px solid #f1f5f9;
    flex-shrink: 0;
}

.tool-dropdown-wrapper {
    position: relative;
    display: inline-block;
    align-self: flex-start;
    z-index: 100;
}

.tool-dropdown-pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 7px 16px;
    background: #eff6ff;
    color: #2563eb;
    font-size: 14.5px;
    font-weight: 600;
    border-radius: 20px;
    cursor: pointer;
    border: 1.5px solid #dbeafe;
    transition: all 0.2s;
    outline: none;
}

.tool-dropdown-pill:hover,
.tool-dropdown-pill.open {
    background: #dbeafe;
    border-color: #bfdbfe;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
}

.tool-dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    min-width: 180px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.15), 0 4px 10px -2px rgba(15, 23, 42, 0.08);
    padding: 6px;
    display: flex;
    flex-direction: column;
    gap: 2px;
    animation: fadeInDropdown 0.15s ease-out forwards;
}

@keyframes fadeInDropdown {
    from { opacity: 0; transform: translateY(-4px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
}

.dropdown-item-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    background: transparent;
    border: none;
    border-radius: 10px;
    color: #334155;
    font-size: 13.5px;
    font-weight: 500;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
    width: 100%;
}

.dropdown-item-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
}

.dropdown-item-btn.active {
    background: #eff6ff;
    color: #2563eb;
    font-weight: 600;
}

.search-input-wrapper {
    position: relative;
    width: 100%;
}

.search-icon {
    position: absolute;
    left: 14px;
    top: 50%;
    transform: translateY(-50%);
    color: #94a3b8;
    pointer-events: none;
}

.modern-search-input {
    width: 100%;
    padding: 12px 14px 12px 42px;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    font-size: 14.5px;
    color: #0f172a;
    background: #ffffff;
    outline: none;
    box-sizing: border-box;
    transition: all 0.2s;
    font-family: 'Inter', sans-serif;
}

.modern-search-input:focus {
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.modern-search-input::placeholder {
    color: #94a3b8;
}

/* HORIZONTAL SUBCATEGORY TABS */
.tool-tabs-row {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    padding-bottom: 0;
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE/Edge */
    -webkit-overflow-scrolling: touch;
}

.tool-tabs-row::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
    width: 0;
    height: 0;
}

.tool-tab-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 11px 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    color: #475569;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-sizing: border-box;
    flex-shrink: 0;
    white-space: nowrap;
}

.tool-tab-btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
    color: #0f172a;
}

.tool-tab-btn.active {
    background: #eff6ff;
    color: #2563eb;
    border-color: #dbeafe;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(37, 99, 235, 0.08);
}

.tab-label {
    white-space: nowrap;
}

/* PANEL BODY (CATALOG GALLERY CONTAINER) */
.panel-body {
    flex: 1 1 0%;
    min-height: 0;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
    background: #f8fafc;
    display: block;
    -webkit-overflow-scrolling: touch;
}

.panel-body.catalog-mode-body {
    display: flex !important;
    flex-direction: column !important;
    overflow: hidden !important;
}


/* NON-CATALOG ACTION TOOLS (SELECT & EDIT, PAN, WIZARDS) */
.action-tool-container {
    padding: 20px 22px 40px;
    width: 100%;
    box-sizing: border-box;
}

.action-tool-card {
    background: #ffffff;
    border-radius: 20px;
    border: 1.5px solid #e2e8f0;
    padding: 22px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 10px 30px -10px rgba(15, 23, 42, 0.08);
    position: relative;
    overflow: hidden;
    transition: all 0.2s;
}

.action-tool-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 16px 36px -10px rgba(15, 23, 42, 0.12);
}

.card-status-badge {
    display: inline-flex;
    align-self: flex-start;
    background: #eff6ff;
    color: #2563eb;
    font-size: 12.5px;
    font-weight: 700;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid #dbeafe;
    letter-spacing: 0.2px;
}

.card-hero-header {
    display: flex;
    align-items: center;
    gap: 16px;
}

.action-icon-wrap {
    width: 62px;
    height: 62px;
    border-radius: 16px;
    background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
    border: 1px solid #bfdbfe;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.08);
}

.card-titles {
    display: flex;
    flex-direction: column;
    gap: 3px;
}

.card-subtitle {
    font-size: 12px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.6px;
}

.card-main-title {
    margin: 0;
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.02em;
}

.card-description {
    margin: 0;
    font-size: 14px;
    color: #475569;
    line-height: 1.55;
}

.card-features-box {
    background: #f8fafc;
    border-radius: 14px;
    border: 1px solid #e2e8f0;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.features-header {
    font-size: 11.5px;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.8px;
}

.features-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.features-list li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    font-size: 13.5px;
    color: #334155;
    line-height: 1.45;
}

.check-bullet {
    flex-shrink: 0;
    margin-top: 2px;
}

.activate-tool-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    margin-top: 4px;
    padding: 14px 24px;
    background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
    color: white;
    border: none;
    border-radius: 14px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 6px 20px -4px rgba(37, 99, 235, 0.4);
    transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.activate-tool-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 25px -4px rgba(37, 99, 235, 0.5);
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
}

/* =========================================================
   TABLET VIEWPORT (< 1024px) - RESPONSIVE SCALING & FONTS
   ========================================================= */
@media (max-width: 1024px) {
    .sidebar-submenu.modern-panel {
        width: 440px;
        max-width: calc(100vw - 68px);
        left: 68px;
    }
    .drawer-header {
        padding: 16px 20px 10px;
    }
    .drawer-title {
        font-size: 18px;
    }
    .panel-controls {
        padding: 8px 20px 14px;
        gap: 12px;
    }
    .modern-search-input {
        font-size: 13.5px;
        padding: 10px 14px 10px 38px;
    }
    .tool-tab-btn {
        font-size: 13px;
        padding: 9px 12px;
    }
    .action-tool-container {
        padding: 16px 18px 20px;
    }
    .action-tool-card {
        padding: 20px 18px;
        gap: 14px;
    }
    .action-icon-wrap {
        width: 54px;
        height: 54px;
        border-radius: 14px;
    }
    .card-main-title {
        font-size: 16.5px;
    }
    .card-description {
        font-size: 13.5px;
    }
    .card-features-box {
        padding: 14px;
    }
    .features-list li {
        font-size: 13px;
    }
    .activate-tool-btn {
        padding: 12px 20px;
        font-size: 14.5px;
    }
}

/* =========================================================
   MOBILE VIEWPORT (<= 640px) - COMPACT FONTS & LAYOUT FIT
   ========================================================= */
@media (max-width: 640px) {
    .left-sidebar.mobile-panel {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        bottom: 0 !important;
        width: 100vw !important;
        height: 100vh !important;
        max-width: 100vw !important;
        background: #ffffff;
        z-index: 2000;
        display: flex;
        flex-direction: row;
        overflow: hidden !important;
    }
    .sidebar-layout {
        width: 100%;
        height: 100%;
        position: static !important;
        overflow: hidden !important;
    }
    .sidebar-dock {
        width: 56px;
        min-width: 56px;
        padding: 10px 4px;
        gap: 6px;
        position: static !important;
        border-radius: 0 !important;
        box-shadow: none;
    }
    .dock-btn {
        width: 40px;
        height: 40px;
        border-radius: 10px;
    }
    .dock-icon {
        width: 20px;
        height: 20px;
    }
    .sidebar-submenu.modern-panel {
        position: static !important;
        left: auto !important;
        width: calc(100vw - 56px) !important;
        max-width: calc(100vw - 56px) !important;
        border-right: none;
        box-shadow: none;
        padding-bottom: 0;
    }
    .drawer-header {
        padding: 14px 14px 8px;
    }
    .drawer-title {
        font-size: 16.5px;
    }
    .drawer-close-btn {
        width: 30px;
        height: 30px;
    }
    .panel-controls {
        padding: 6px 14px 10px;
        gap: 10px;
    }
    .tool-dropdown-pill {
        font-size: 12.5px;
        padding: 4px 10px;
    }
    .modern-search-input {
        font-size: 12.5px;
        padding: 9px 12px 9px 36px;
        border-radius: 12px;
    }
    .search-icon {
        left: 12px;
        width: 16px;
        height: 16px;
    }
    .tool-tabs-row {
        gap: 8px;
    }
    .tool-tab-btn {
        padding: 8px 12px;
        font-size: 12.5px;
        border-radius: 10px;
        gap: 6px;
    }
    .action-tool-container {
        padding: 12px 14px 16px;
    }
    .action-tool-card {
        padding: 16px 14px;
        border-radius: 16px;
        gap: 12px;
    }
    .card-status-badge {
        font-size: 11px;
        padding: 4px 10px;
    }
    .card-hero-header {
        gap: 12px;
    }
    .action-icon-wrap {
        width: 48px;
        height: 48px;
        border-radius: 12px;
    }
    .action-icon-wrap svg {
        width: 24px;
        height: 24px;
    }
    .card-subtitle {
        font-size: 11.5px;
    }
    .card-main-title {
        font-size: 15.5px;
    }
    .card-description {
        font-size: 12.5px;
        line-height: 1.45;
    }
    .card-features-box {
        padding: 12px;
        border-radius: 12px;
        gap: 8px;
    }
    .features-header {
        font-size: 10.5px;
    }
    .features-list {
        gap: 8px;
    }
    .features-list li {
        font-size: 12px;
        gap: 8px;
    }
    .activate-tool-btn {
        padding: 12px 16px;
        font-size: 13.5px;
        border-radius: 12px;
    }
}

/* =========================================================
   FALLBACK MOBILE QUICK-SELECT DASHBOARD
   ========================================================= */
.fallback-panel {
    display: flex;
    flex-direction: column;
    background: #ffffff;
    height: 100%;
}

.fallback-content-box {
    padding: 24px 20px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 28px;
    flex: 1;
}

.welcome-hero {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    background: #f8fafc;
    padding: 24px 18px;
    border-radius: 18px;
    border: 1px solid #e2e8f0;
    gap: 12px;
}

.hero-icon-circle {
    width: 60px;
    height: 60px;
    border-radius: 20px;
    background: #eff6ff;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 4px;
    box-shadow: 0 6px 16px -3px rgba(37, 99, 235, 0.15);
}

.hero-title {
    margin: 0;
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
}

.hero-desc {
    margin: 0;
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
}

.quick-shortcuts-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.shortcuts-title {
    font-size: 11px;
    font-weight: 700;
    color: #94a3b8;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding-left: 4px;
}

.shortcuts-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(135px, 1fr));
    gap: 12px;
}

.shortcut-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 16px 14px;
    background: #ffffff;
    border: 1.5px solid #e2e8f0;
    border-radius: 14px;
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
    gap: 4px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
}

.shortcut-btn:hover, .shortcut-btn:active {
    border-color: #3b82f6;
    background: #eff6ff;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px -4px rgba(37, 99, 235, 0.12);
}

.sc-title {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
}

.sc-desc {
    font-size: 11.5px;
    color: #64748b;
    font-weight: 500;
}
</style>