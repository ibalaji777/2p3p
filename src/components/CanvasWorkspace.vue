<template>
  <main class="canvas-container">
    <div class="hint" :style="{ background: hintData.color }" v-show="showGuide">{{ hintData.text }}</div>
    
    <div class="floating-advanced-toolbar" v-show="viewMode === '2d'">
        <div class="adv-dropdown">
            <button class="adv-trigger-btn" @click="$emit('handle-adv-trigger-click')" :class="{active: showAdvancedTools || isAdvancedToolActive}" :title="isAdvancedToolActive ? 'Clear Tool' : 'Advanced Tools'">
                <span v-if="isAdvancedToolActive" style="color: #fca5a5; font-size: 16px;">✕</span>
                <span v-else>⚙️</span>
            </button>
            <div class="adv-side-menu" v-show="showAdvancedTools && !isAdvancedToolActive">
                <button class="adv-round-btn" :class="{active: activeTool === 'split'}" @click="$emit('set-advanced-tool', 'split'); $emit('update:showAdvancedTools', false)" title="Split Wall">✂️</button>
                <button class="adv-round-btn" :class="{active: isWallTrackingEnabled}" @click="$emit('toggle-wall-tracking')" title="Toggle Wall Tracking">🔗</button>
            </div>
        </div>
    </div>

    <!-- Left Vertical CAD Manipulation Strip (3D Mode) -->
    <CommonToolbar3D 
        :view-mode="viewMode" 
        :is-desktop="isDesktop" 
        :is-drawer-open="isDrawerOpen"
        :controller="commonController" 
        @toggle-catalog="$emit('toggle-catalog')" 
    />

    <!-- Unified Top-Right 3D Camera Controls Bar (Paired with Navigation Cube) -->
    <div v-show="viewMode === '3d'" class="scene-view-bar">
        <!-- 1. Sims 4 Isometric 3D View -->
        <button class="view-bar-btn" @click="$emit('set-sims4-view')" title="Sims 4 Isometric 3D View">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
        </button>

        <!-- 2. Top-Down Blueprint View -->
        <button class="view-bar-btn" @click="$emit('set-topdown-view')" title="Top-Down Blueprint Camera View (Key: T)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
            </svg>
        </button>

        <div class="view-bar-divider"></div>

        <!-- 3. Reset Camera View -->
        <button class="view-bar-btn" @click="$emit('reset-camera')" title="Reset Camera View (Home)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
        </button>

        <!-- 4. Toggle Transparent / X-Ray -->
        <button class="view-bar-btn" :class="{ active: isXRayMode }" @click="$emit('toggle-xray-mode')" title="Toggle Transparent / X-Ray Mode (Key: X)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
            </svg>
        </button>
    </div>

    <!-- 2D View Controls (Zoom Controls in 2D Mode only) -->
    <div v-show="viewMode === '2d'" class="bottom-right-toolbar-2d">
        <button @click="$emit('zoom-in')" title="Zoom In">+</button>
        <button @click="$emit('zoom-out')" title="Zoom Out">-</button>
        <button @click="$emit('reset-zoom')" title="Reset Zoom">⛶</button>
    </div>

    <!-- 2D Compass Widget -->
    <div class="compass-widget" v-show="viewMode === '2d' && floorPlanSettings.showCompass">
        <div class="compass-n">N</div><div class="compass-w">W</div><div class="compass-center"></div><div class="compass-e">E</div><div class="compass-s">S</div>
    </div>

    <div ref="canvas2D" class="canvas-host" :class="{ 'active-canvas': viewMode === '2d', 'inactive-canvas': viewMode !== '2d' }"></div>
    <div ref="canvas3D" class="canvas-host canvas-3d" :class="{ 'active-canvas': viewMode === '3d', 'inactive-canvas': viewMode !== '3d' }"></div>
    
    <div class="loader-overlay" v-show="viewMode === '3d' && isRebuilding">
        <div class="spinner"></div><span style="font-weight: 600; color: #4b5563;">Loading 3D Scene...</span>
    </div>
    
    <div class="status-bar" v-if="viewMode === '3d' && showGuide">
        <span v-if="viewMode3D === 'preview'">🖱️ Left-Click: Rotate Room | Scroll: Zoom</span>
        <span v-else-if="mode3D === 'edit' && selectedType === 'wall'">⚙️ Click a pattern from the gallery to apply it.</span>
        <span v-else-if="mode3D === 'edit'">🖱️ Click object to select/move, or click wall to add patterns</span>
    </div>
  </main>
</template>

<script setup>
import { ref } from 'vue';
import CommonToolbar3D from './common/CommonToolbar3D.vue';

const props = defineProps({
  hintData: Object, viewMode: String, showGuide: Boolean, showAdvancedTools: Boolean, isAdvancedToolActive: Boolean,
  activeTool: String, isWallTrackingEnabled: Boolean, isXRayMode: Boolean, wallCutawayMode: { type: String, default: 'walls_up' }, floorPlanSettings: Object,
  isRebuilding: Boolean, viewMode3D: String, mode3D: String, selectedType: String,
  isDesktop: { type: Boolean, default: true },
  isDrawerOpen: { type: Boolean, default: false },
  commonController: { type: Object, default: null }
});

const emit = defineEmits([
  'update:showGuide', 'update:showAdvancedTools', 'handle-adv-trigger-click', 'set-advanced-tool',
  'toggle-wall-tracking', 'toggle-xray-mode', 'set-wall-cutaway-mode', 'zoom-in', 'zoom-out', 'reset-zoom', 'reset-camera',
  'set-sims4-view', 'set-topdown-view', 'rotate-camera-left', 'rotate-camera-right', 'toggle-catalog'
]);

const cycleWallMode = () => {
  const modes = ['walls_up', 'cutaway', 'walls_down'];
  const nextIdx = (modes.indexOf(props.wallCutawayMode) + 1) % modes.length;
  emit('set-wall-cutaway-mode', modes[nextIdx]);
};

const canvas2D = ref(null);
const canvas3D = ref(null);

defineExpose({ canvas2D, canvas3D });
</script>