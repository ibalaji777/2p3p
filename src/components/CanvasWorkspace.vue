<template>
  <main class="canvas-container">
    <div class="hint" :style="{ background: hintData.color }" v-show="viewMode === '2d' && showGuide">{{ hintData.text }}</div>
    
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



    <div class="bottom-right-toolbar">
        <button v-show="viewMode === '3d'" class="env-icon-btn" :class="{active: isXRayMode}" @click="$emit('toggle-xray-mode')" title="Toggle Transparent/X-Ray Mode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="2" ry="2"></rect><rect x="9" y="9" width="12" height="12" rx="2" ry="2"></rect></svg>
        </button>
        <button v-show="viewMode === '3d'" @click="$emit('reset-camera')" title="Reset Camera View">
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

const props = defineProps({
  hintData: Object, viewMode: String, showGuide: Boolean, showAdvancedTools: Boolean, isAdvancedToolActive: Boolean,
  activeTool: String, isWallTrackingEnabled: Boolean, isXRayMode: Boolean, floorPlanSettings: Object,
  isRebuilding: Boolean, viewMode3D: String, mode3D: String, selectedType: String
});

const emit = defineEmits([
  'update:showGuide', 'update:showAdvancedTools', 'handle-adv-trigger-click', 'set-advanced-tool',
  'toggle-wall-tracking', 'toggle-xray-mode', 'zoom-in', 'zoom-out', 'reset-zoom', 'reset-camera'
]);

const canvas2D = ref(null);
const canvas3D = ref(null);

defineExpose({ canvas2D, canvas3D });
</script>