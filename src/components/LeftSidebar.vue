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
                <h3>{{ activeCategoryObj.name }}</h3>
            </div>
            <div class="submenu-content">
                <template v-for="(tool, idx) in activeCategoryObj.tools" :key="tool.id || idx">
                    <div v-if="tool.isDivider" class="submenu-divider">{{ tool.name }}</div>
                    <button v-else
                        class="child-card-btn"
                        :class="{ active: activeTool === tool.id && !tool.action }"
                        @click="$emit('tool-click', tool)">
                        {{ tool.name }}
                    </button>
                </template>
            </div>
        </div>
    </div>
  </aside>
</template>

<script setup>
const props = defineProps({
  viewMode: String,
  isMobile: Boolean,
  isTablet: Boolean,
  mobileMenuOpen: Boolean,
  activeMobileTab: String,
  menuCategories: Array,
  activeCategory: String,
  activeCategoryObj: Object,
  activeTool: String
});

const emit = defineEmits(['close-mobile-menu', 'toggle-category', 'save-project', 'open-save-popup', 'trigger-file-input', 'clear-workspace', 'file-uploaded', 'tool-click']);
</script>