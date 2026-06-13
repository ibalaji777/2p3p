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

    <div class="floating-env-toolbar" v-show="viewMode === '3d'">
        <div class="env-dropdown" @mouseenter="$emit('update:showCamera', true)" @mouseleave="$emit('update:showCamera', false)">
            <button class="env-icon-btn" title="View Angles"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"></path><rect x="3" y="6" width="12" height="12" rx="2" ry="2"></rect></svg></button>
            <div class="env-menu" v-show="showCamera">
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'iso'); $emit('update:showCamera', false)">Perspective (3D)</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'top'); $emit('update:showCamera', false)">Top (2D Ortho)</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'front'); $emit('update:showCamera', false)">Front</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'back'); $emit('update:showCamera', false)">Back</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'left'); $emit('update:showCamera', false)">Left</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'right'); $emit('update:showCamera', false)">Right</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'frontLeft'); $emit('update:showCamera', false)">Front-Left</div>
                <div class="env-menu-item" @click="$emit('set-camera-preset', 'frontRight'); $emit('update:showCamera', false)">Front-Right</div>
            </div>
        </div>
        <button class="env-icon-btn" @click="$emit('rotate-camera', -0.1)" title="Rotate Left">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
        </button>
        <button class="env-icon-btn" @click="$emit('rotate-camera', 0.1)" title="Rotate Right">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><polyline points="21 3 21 8 16 8"></polyline></svg>
        </button>
        <button class="env-icon-btn" :class="{active: isXRayMode}" @click="$emit('toggle-xray-mode')" title="Toggle Transparent/X-Ray Mode">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="2" ry="2"></rect><rect x="9" y="9" width="12" height="12" rx="2" ry="2"></rect></svg>
        </button>
    </div>

    <div class="bottom-right-toolbar">
        <button @click="$emit('update:showGuide', !showGuide)" :title="showGuide ? 'Hide Guide' : 'Show Guide'" :style="{ background: showGuide ? 'rgba(59, 130, 246, 0.9)' : '', borderColor: showGuide ? 'rgba(96, 165, 250, 1)' : '' }">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </button>
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

const props = defineProps({
  hintData: Object, viewMode: String, showGuide: Boolean, showAdvancedTools: Boolean, isAdvancedToolActive: Boolean,
  activeTool: String, isWallTrackingEnabled: Boolean, showCamera: Boolean, isXRayMode: Boolean, floorPlanSettings: Object,
  isRebuilding: Boolean, viewMode3D: String, mode3D: String, selectedType: String
});

const emit = defineEmits([
  'update:showGuide', 'update:showAdvancedTools', 'update:showCamera', 'handle-adv-trigger-click', 'set-advanced-tool',
  'toggle-wall-tracking', 'set-camera-preset', 'rotate-camera', 'toggle-xray-mode', 'zoom-in', 'zoom-out', 'reset-zoom'
]);

const canvas2D = ref(null);
const canvas3D = ref(null);

defineExpose({ canvas2D, canvas3D });
</script>