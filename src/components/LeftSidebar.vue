<template>
  <aside
    class="left-sidebar"
    v-show="viewMode === '2d' && (!(isMobile || isTablet) || ((isMobile || isTablet) && mobileMenuOpen && activeMobileTab === 'tools'))"
    :class="{'mobile-panel': isMobile || isTablet}"
  >
    <div v-if="isMobile || isTablet" class="mobile-close-btn" @click="$emit('close-mobile-menu')">✕ Close</div>
    <div class="sidebar-layout">
        <div class="sidebar-dock">
            <button v-for="cat in menuCategories" :key="cat.id" class="dock-btn" :class="{ active: activeCategory === cat.id }" @click="$emit('toggle-category', cat.id)" :title="cat.name">
                <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" v-html="cat.icon"></svg>
            </button>
            
            <div style="flex: 1;"></div>
            
            <button class="dock-btn" @click="$emit('save-project')" title="Export Project">
                <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
            <button class="dock-btn" @click="$emit('open-save-popup')" title="Save to Cloud" style="color: #8b5cf6;">
                <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
            </button>
            <button class="dock-btn" @click="$emit('trigger-file-input')" title="Import Project">
                <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            </button>
            <button class="dock-btn" @click="$emit('clear-workspace')" title="Clear All" style="color: #ef4444;">
                <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <input type="file" id="fileInput" @change="$emit('file-uploaded', $event)" style="display: none" accept=".json"/>
        </div>

        <div class="sidebar-submenu" v-if="activeCategoryObj">
            <div class="submenu-header">
                <h3 style="flex: 1; margin: 0;">{{ activeCategoryObj.name }}</h3>
            </div>
            <div class="submenu-content">
                <template v-for="(tool, idx) in activeCategoryObj.tools" :key="tool.id || idx">
                    <div v-if="tool.isDivider" class="submenu-divider">{{ tool.name }}</div>
                    <button v-else
                        class="child-card-btn"
                        :class="{ active: isToolActive(tool.id) && !tool.action, 'has-accordion': ['door', 'window', 'sunshade', 'jali_panel', 'staircase', 'roof', 'dormer', 'molding', 'elevation_fascia', 'wall_catalog', 'shape_catalog', 'adv_opening_catalog', 'railing_catalog', 'furniture_catalog', 'kitchen_catalog', 'sink_catalog', 'tap_catalog', 'hood_catalog', 'small_appliance_catalog', 'household_appliance_catalog', 'wine_cellar_catalog', 'trash_catalog'].includes(tool.id) }"
                        @click="$emit('tool-click', tool)"
                        style="display: flex; align-items: center; justify-content: space-between;">
                        <span>{{ tool.name }}</span>
                        <svg v-if="['door', 'window', 'sunshade', 'jali_panel', 'staircase', 'roof', 'dormer', 'molding', 'elevation_fascia', 'wall_catalog', 'shape_catalog', 'adv_opening_catalog', 'railing_catalog', 'furniture_catalog', 'kitchen_catalog', 'sink_catalog', 'tap_catalog', 'hood_catalog', 'small_appliance_catalog', 'household_appliance_catalog', 'wine_cellar_catalog', 'trash_catalog'].includes(tool.id)" 
                             class="chevron" 
                             :style="{ transform: isToolActive(tool.id) ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)', opacity: isToolActive(tool.id) ? '1' : '0.5' }"
                             viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="9 18 15 12 9 6"></polyline>
                        </svg>
                    </button>
                    
                    <div v-if="['door', 'window', 'sunshade', 'jali_panel', 'staircase', 'roof', 'dormer', 'molding', 'elevation_fascia', 'wall_catalog', 'shape_catalog', 'adv_opening_catalog', 'railing_catalog', 'furniture_catalog', 'kitchen_catalog', 'sink_catalog', 'tap_catalog', 'hood_catalog', 'small_appliance_catalog', 'household_appliance_catalog', 'wine_cellar_catalog', 'trash_catalog'].includes(tool.id) && isToolActive(tool.id)" class="catalog-accordion">
                        <CatalogGallery :type="tool.id" :modelValue="activePresetId" @update:modelValue="$emit('update:activePresetId', $event)" @select="$emit('catalog-select', $event)" />
                    </div>
                </template>
            </div>
        </div>
    </div>
  </aside>
</template>

<script setup>
import CatalogGallery from './sidebar/CatalogGallery.vue';

const props = defineProps({
  viewMode: String,
  isMobile: Boolean,
  isTablet: Boolean,
  mobileMenuOpen: Boolean,
  activeMobileTab: String,
  menuCategories: Array,
  activeCategory: String,
  activeCategoryObj: Object,
  activeTool: String,
  activePresetId: String
});

const emit = defineEmits(['close-mobile-menu', 'toggle-category', 'save-project', 'open-save-popup', 'trigger-file-input', 'clear-workspace', 'file-uploaded', 'tool-click', 'catalog-select', 'update:activePresetId']);

const isToolActive = (toolId) => {
    if (props.activeTool === toolId) return true;
    const mapping = {
        'wall_catalog': ['outer', 'inner', 'arc'],
        'shape_catalog': ['shape_rect', 'shape_circle', 'shape_triangle'],
        'adv_opening_catalog': ['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'],
        'railing_catalog': ['railing'],
        'furniture_catalog': ['furniture'],
        'kitchen_catalog': ['kitchen'],
        'sink_catalog': ['sink'],
        'tap_catalog': ['tap']
    };
    if (mapping[toolId] && mapping[toolId].includes(props.activeTool)) return true;
    return false;
};
</script>

<style scoped>
.catalog-accordion {
    padding: 0;
    height: 450px;
    flex-shrink: 0;
    overflow: hidden;
    background: #f8fafc;
    border-radius: 6px;
    margin: 5px 0 15px 0;
    border: 1px solid #e2e8f0;
}
</style>