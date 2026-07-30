<template>
  <div class="top-toolbar-wrapper">
    <!-- Top Area Indicator (Visible when Header is Hidden during 3D scene interaction) -->
    <div 
      class="top-reveal-chip" 
      :class="{ 'visible': headerState === 'hidden' }"
      @click="revealHeader"
      @touchend.prevent="revealHeader"
      title="Tap top area to show header again"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>

    <!-- Main Floating Premium Header Pill -->
    <header 
      class="floating-header" 
      :class="[
        headerState === 'hidden' ? 'state-hidden' : '',
        headerState === 'mini' ? 'state-mini' : ''
      ]"
    >
      <div class="header-pill">
        <!-- Left group: Mode Switcher Chip -->
        <div class="header-left">
          <div class="mode-switcher-chip" :class="viewMode === '3d' ? 'mode-3d' : 'mode-2d'" @click.stop="toggleMode" title="Toggle Mode">
            <svg v-if="viewMode === '3d'" class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
              <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
              <line x1="12" y1="22.08" x2="12" y2="12"></line>
            </svg>
            <svg v-else class="mode-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
              <path d="M15 5l4 4"></path>
              <path d="M3 21h6v-6"></path>
            </svg>
            <span class="mode-label">{{ viewMode === '3d' ? '3D Build' : '2D Plan' }}</span>
            <svg class="toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M16 3l4 4-4 4"></path>
              <path d="M20 7H4"></path>
              <path d="M8 21l-4-4 4-4"></path>
              <path d="M4 17h16"></path>
            </svg>
          </div>
        </div>

        <!-- Right group: Undo & Redo (Hidden in collapsed/mini state) -->
        <div class="header-actions" v-show="headerState === 'visible'">
          <button class="action-icon-btn" @click="$emit('undo')" :disabled="!canUndo" title="Undo (Ctrl + Z)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7v6h6"></path>
              <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
            </svg>
          </button>
          <button class="action-icon-btn" @click="$emit('redo')" :disabled="!canRedo" title="Redo (Ctrl + Y)">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 7v6h-6"></path>
              <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
            </svg>
          </button>
        </div>

        <!-- Vertical Separator Divider (Only visible when actions are shown) -->
        <div class="header-divider" v-show="headerState === 'visible'"></div>

        <!-- Integrated Premium Collapse/Hide Button -->
        <button 
          class="collapse-circle-btn" 
          @click="hideHeaderInstantly" 
          title="Hide Header Instantly"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>
      </div>
    </header>


  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';

const props = defineProps({
  viewMode: String,
  viewMode3D: String,
  canUndo: Boolean,
  canRedo: Boolean
});

const emit = defineEmits(['switch-2d', 'switch-3d', 'toggle-preview', 'undo', 'redo', 'toggle-menu']);

// 3-state collapsible header: 'visible' | 'mini' | 'hidden'
const headerState = ref('visible');

const toggleMode = () => {
  if (props.viewMode === '2d') {
    emit('switch-3d');
  } else {
    emit('switch-2d');
  }
};

const revealHeader = () => {
  headerState.value = 'visible';
};

const hideHeaderInstantly = () => {
  headerState.value = 'hidden';
};

// Interaction detection for auto-hide in 3D and slight scroll collapse
let isDragging = false;
let startX = 0;
let startY = 0;

const handlePointerDown = (e) => {
  startX = e.clientX;
  startY = e.clientY;
  isDragging = true;
};

const handlePointerMove = (e) => {
  if (!isDragging) return;
  const dx = Math.abs(e.clientX - startX);
  const dy = Math.abs(e.clientY - startY);
  
  // When interacting with the 3D scene canvas (dragging > 15px), auto-hide header completely
  if (props.viewMode === '3d' && (dx > 15 || dy > 15)) {
    if (headerState.value !== 'hidden' && e.clientY > 85) {
      headerState.value = 'hidden';
    }
  }
};

const handlePointerUp = () => {
  isDragging = false;
};

// Wheel events: slight upward scroll triggers the compact 'mini' collapse state
const handleWheel = (e) => {
  if (e.deltaY < -10 && headerState.value === 'visible') {
    headerState.value = 'mini';
  }
};

// Touch gestures: swipe down from top edge to reveal full header, swipe up to collapse
let touchStartY = 0;
const handleTouchStart = (e) => {
  if (e.touches && e.touches.length > 0) {
    touchStartY = e.touches[0].clientY;
  }
};

const handleTouchMove = (e) => {
  if (e.touches && e.touches.length > 0) {
    const currentY = e.touches[0].clientY;
    const dy = currentY - touchStartY;
    // Swipe down from top area (< 85px) reveals the header
    if ((headerState.value === 'hidden' || headerState.value === 'mini') && touchStartY < 85 && dy > 20) {
      headerState.value = 'visible';
    }
    // Swipe up on header area collapses to mini
    else if (headerState.value === 'visible' && touchStartY < 85 && dy < -15) {
      headerState.value = 'mini';
    }
  }
};

onMounted(() => {
  window.addEventListener('pointerdown', handlePointerDown);
  window.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  window.addEventListener('wheel', handleWheel, { passive: true });
  window.addEventListener('touchstart', handleTouchStart, { passive: true });
  window.addEventListener('touchmove', handleTouchMove, { passive: true });
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handlePointerDown);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerUp);
  window.removeEventListener('wheel', handleWheel);
  window.removeEventListener('touchstart', handleTouchStart);
  window.removeEventListener('touchmove', handleTouchMove);
});
</script>

<style scoped>
.top-toolbar-wrapper {
  position: relative;
  z-index: 1050;
  pointer-events: none;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

/* TOP AREA REVEAL INDICATOR (When header is hidden during scene interaction) */
.top-reveal-chip {
  position: fixed;
  top: 10px;
  left: 50%;
  transform: translateX(-50%) translateY(-25px);
  opacity: 0;
  pointer-events: none;
  width: 54px;
  height: 26px;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 13px;
  box-shadow: 0 6px 20px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(226, 232, 240, 0.9) inset;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  cursor: pointer;
  z-index: 1100;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.top-reveal-chip.visible {
  transform: translateX(-50%) translateY(0);
  opacity: 1;
  pointer-events: auto;
}

.top-reveal-chip:hover {
  background: #ffffff;
  color: #0f172a;
  transform: translateX(-50%) translateY(2px) scale(1.06);
  box-shadow: 0 8px 25px rgba(15, 23, 42, 0.18);
}

/* FLOATING PREMIUM MAIN HEADER */
.floating-header {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%) translateY(0);
  width: calc(100vw - 32px);
  max-width: 480px;
  z-index: 1050;
  pointer-events: auto;
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.floating-header.state-hidden {
  transform: translateX(-50%) translateY(-145%) scale(0.94);
  opacity: 0;
  pointer-events: none;
}

/* MINI COLLAPSED STATE */
.floating-header.state-mini {
  width: auto;
  max-width: max-content;
}

.floating-header.state-mini .header-pill {
  padding: 5px 8px 5px 6px;
  height: 48px;
  gap: 8px;
  border-radius: 24px;
}

.header-pill {
  background: rgba(255, 255, 255, 0.86);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.95);
  box-shadow: 
    0 12px 32px -6px rgba(15, 23, 42, 0.08), 
    0 4px 12px -2px rgba(15, 23, 42, 0.04), 
    0 0 0 1px rgba(226, 232, 240, 0.6) inset;
  border-radius: 26px;
  padding: 6px 10px 6px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 52px; /* Slimmer height for more workspace real estate */
  box-sizing: border-box;
  transition: all 0.35s cubic-bezier(0.16, 1, 0.3, 1);
}

.header-left {
  display: flex;
  align-items: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

/* VERTICAL SEPARATOR DIVIDER */
.header-divider {
  width: 1px;
  height: 22px;
  background: rgba(226, 232, 240, 0.9);
  margin: 0 2px;
  flex-shrink: 0;
}

/* INTEGRATED CIRCULAR COLLAPSE BUTTON */
.collapse-circle-btn {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 1px solid rgba(226, 232, 240, 0.85);
  background: #ffffff;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.collapse-circle-btn:hover {
  background: #f8fafc;
  color: #0f172a;
  transform: scale(1.06) translateY(-1px);
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.12);
  border-color: #cbd5e1;
}

.collapse-circle-btn:active {
  transform: scale(0.96);
}

/* ACTION ICON BUTTONS (Undo & Redo with Soft Rounded Hover State) */
.action-icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #334155;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.action-icon-btn:hover:not(:disabled) {
  background: rgba(241, 245, 249, 0.9);
  color: #0f172a;
  transform: translateY(-1px);
}

.action-icon-btn:active:not(:disabled) {
  transform: translateY(0) scale(0.96);
}

.action-icon-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.mode-switcher-chip {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 20px;
  padding: 6px 14px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #334155;
  font-weight: 600;
  font-size: 14.5px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(226, 232, 240, 0.5) inset;
  box-sizing: border-box;
  white-space: nowrap;
  flex-shrink: 0;
}

.mode-switcher-chip:hover {
  background: #f8fafc;
  border-color: #cbd5e1;
  transform: translateY(-1px);
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
}

.mode-switcher-chip:active {
  transform: translateY(0) scale(0.97);
  background: #f1f5f9;
}

/* 3D Build mode styling (App Brand Blue) */
.mode-switcher-chip.mode-3d {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
  box-shadow: 0 2px 5px rgba(37, 99, 235, 0.06), 0 0 0 1px rgba(191, 219, 254, 0.5) inset;
}

.mode-switcher-chip.mode-3d:hover {
  background: #dbeafe;
  border-color: #93c5fd;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
}

.mode-icon {
  width: 19px;
  height: 19px;
  stroke: #475569;
  stroke-width: 2.2px;
  flex-shrink: 0;
  transition: stroke 0.3s ease;
}

.mode-switcher-chip:hover .mode-icon,
.mode-switcher-chip:hover .toggle-icon {
  stroke: #0f172a;
}

.mode-switcher-chip.mode-3d .mode-icon,
.mode-switcher-chip.mode-3d .toggle-icon {
  stroke: #2563eb;
}

.mode-switcher-chip.mode-3d:hover .mode-icon,
.mode-switcher-chip.mode-3d:hover .toggle-icon {
  stroke: #1d4ed8;
}

.mode-label {
  letter-spacing: 0.15px;
  white-space: nowrap;
  flex-shrink: 0;
}

.toggle-icon {
  margin-left: 4px;
  stroke: #64748b;
  flex-shrink: 0;
  transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), stroke 0.3s ease;
}

/* Subtle satisfying rotation on toggle */
.mode-switcher-chip.mode-3d .toggle-icon {
  transform: rotate(180deg);
}

/* RESPONSIVE BREAKPOINTS (Desktop, Tablet, Mobile) */
@media (min-width: 768px) {
  .floating-header:not(.state-mini) {
    width: auto;
    min-width: 420px;
    max-width: 540px;
  }
  .header-pill {
    padding: 6px 12px 6px 8px;
  }
}

@media (max-width: 640px) {
  .floating-header:not(.state-mini) {
    top: 12px;
    width: calc(100vw - 24px);
    max-width: 420px;
  }
  .header-pill {
    height: 50px;
    padding: 5px 8px 5px 6px;
    gap: 6px;
    border-radius: 25px;
  }
  .header-actions {
    gap: 4px;
  }
  .mode-switcher-chip {
    padding: 5px 12px;
    height: 36px;
    font-size: 13.5px;
    gap: 6px;
  }
  .action-icon-btn {
    width: 36px;
    height: 36px;
  }
  .collapse-circle-btn {
    width: 34px;
    height: 34px;
  }
  .header-divider {
    height: 18px;
    margin: 0;
  }
}
</style>