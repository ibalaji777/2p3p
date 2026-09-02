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



    <!-- Sims 4 Common 3D Tools (Persistent Floating Toolbar) -->
    <CommonToolbar3D 
      v-show="viewMode === '3d'"
      :view-mode="viewMode"
      :is-desktop="isDesktop"
      :controller="commonController"
    />

    <div class="bottom-right-toolbar">
        <!-- Sims 4 Wall Visibility Suite (Walls Up / Cutaway / Walls Down) -->
        <div v-show="viewMode === '3d'" class="wall-visibility-pill">
            <button 
                class="vis-btn" 
                :class="{ active: wallCutawayMode === 'walls_up' }" 
                @click="$emit('set-wall-cutaway-mode', 'walls_up')" 
                title="Walls Up (Full 3D Walls - Key: PageUp)"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"></rect>
                    <line x1="3" y1="9" x2="21" y2="9"></line>
                    <line x1="9" y1="21" x2="9" y2="9"></line>
                </svg>
            </button>
            <button 
                class="vis-btn" 
                :class="{ active: wallCutawayMode === 'cutaway' }" 
                @click="$emit('set-wall-cutaway-mode', 'cutaway')" 
                title="Cutaway Mode (Camera Line-of-Sight - Key: End)"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 21h18V12L12 3 3 12v9z"></path>
                    <polyline points="9 21 9 12 15 12 15 21"></polyline>
                </svg>
            </button>
            <button 
                class="vis-btn" 
                :class="{ active: wallCutawayMode === 'walls_down' }" 
                @click="$emit('set-wall-cutaway-mode', 'walls_down')" 
                title="Walls Down (Cutlines / Floor Plan - Key: PageDown)"
            >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="16" width="18" height="5" rx="1"></rect>
                    <path d="M3 16l9-9 9 9"></path>
                </svg>
            </button>
        </div>

        <button v-show="viewMode === '3d'" class="env-icon-btn" :class="{active: isXRayMode}" @click="$emit('toggle-xray-mode')" title="Toggle Transparent/X-Ray Mode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="2" ry="2"></rect><rect x="9" y="9" width="12" height="12" rx="2" ry="2"></rect></svg>
        </button>
        <!-- Sims 4 Build Mode Camera Suite -->
        <button v-show="viewMode === '3d'" @click="$emit('rotate-camera-left')" title="Rotate 45° Left (Key: < / ,)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>
        </button>
        <button v-show="viewMode === '3d'" @click="$emit('set-sims4-view')" title="Sims 4 Isometric View 45°">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
        </button>
        <button v-show="viewMode === '3d'" @click="$emit('rotate-camera-right')" title="Rotate 45° Right (Key: > / .)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
        </button>
        <button v-show="viewMode === '3d'" @click="$emit('set-topdown-view')" title="Top-Down Blueprint View 90° (Key: T)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </button>
        <button v-show="viewMode === '3d'" @click="$emit('reset-camera')" title="Reset Camera View (Home)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </button>
        <button @click="$emit('update:showGuide', !showGuide)" :title="showGuide ? 'Hide Guide' : 'Show Guide'" :style="{ background: showGuide ? 'rgba(59, 130, 246, 0.9)' : '', borderColor: showGuide ? 'rgba(96, 165, 250, 1)' : '' }">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
        <button v-show="viewMode === '2d'" @click="$emit('zoom-in')" title="Zoom In">+</button>
        <button v-show="viewMode === '2d'" @click="$emit('zoom-out')" title="Zoom Out">-</button>
        <button v-show="viewMode === '2d'" @click="$emit('reset-zoom')" title="Reset Zoom">⛶</button>
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
  commonController: { type: Object, default: null }
});

const emit = defineEmits([
  'update:showGuide', 'update:showAdvancedTools', 'handle-adv-trigger-click', 'set-advanced-tool',
  'toggle-wall-tracking', 'toggle-xray-mode', 'set-wall-cutaway-mode', 'zoom-in', 'zoom-out', 'reset-zoom', 'reset-camera'
]);

const canvas2D = ref(null);
const canvas3D = ref(null);

defineExpose({ canvas2D, canvas3D });
</script>