<template>
  <div class="mobile-bottom-nav-wrapper" v-if="isMobile || isTablet">
    <!-- COLLAPSED STATE: [ 88 Show All ] ( ^ ) -->
    <div
      v-if="isCollapsed"
      class="nav-capsule collapsed-capsule"
      @click="isCollapsed = false"
      title="Show All Menus"
    >
      <button class="show-all-pill">
        <svg class="grid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="3" width="7" height="7" rx="1.5"></rect>
          <rect x="3" y="14" width="7" height="7" rx="1.5"></rect>
          <rect x="14" y="14" width="7" height="7" rx="1.5"></rect>
        </svg>
        <span>Show All</span>
      </button>

      <button class="circular-action-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
    </div>

    <!-- EXPANDED STATE: [ Floors ] [ Props ] [ Layers ] [ Settings ] ( v ) -->
    <div v-else class="nav-capsule expanded-capsule">
      <div class="pills-scroll-group">
        <!-- Floors Pill -->
        <div class="pill-wrapper">
          <button
            class="nav-pill"
            :class="{ active: activeMobileTab === 'levels' && mobileMenuOpen }"
            @click="handleTabClick('levels')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon">
              <path d="M3 21h18"></path>
              <path d="M5 21V7l8-4v18"></path>
              <path d="M19 21V11l-6-3"></path>
              <path d="M9 9v.01"></path>
              <path d="M9 13v.01"></path>
              <path d="M9 17v.01"></path>
            </svg>
            <span>Floors</span>
          </button>
          <div v-if="activeMobileTab === 'levels' && mobileMenuOpen" class="active-dot"></div>
        </div>

        <!-- Props (Furniture/Sofa) Pill -->
        <div class="pill-wrapper">
          <button
            class="nav-pill"
            :class="{ active: activeMobileTab === 'properties' && mobileMenuOpen }"
            @click="handleTabClick('properties')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon">
              <path d="M20 9V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v3"></path>
              <path d="M2 11v5a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H6v-2a2 2 0 0 0-4 0z"></path>
              <path d="M4 18v2"></path>
              <path d="M20 18v2"></path>
            </svg>
            <span>Props</span>
          </button>
          <div v-if="activeMobileTab === 'properties' && mobileMenuOpen" class="active-dot"></div>
        </div>

        <!-- Layers Pill -->
        <div class="pill-wrapper">
          <button
            class="nav-pill"
            :class="{ active: activeMobileTab === 'layers' && mobileMenuOpen }"
            @click="handleTabClick('layers')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
            <span>Layers</span>
          </button>
          <div v-if="activeMobileTab === 'layers' && mobileMenuOpen" class="active-dot"></div>
        </div>

        <!-- Settings Pill -->
        <div class="pill-wrapper">
          <button
            class="nav-pill"
            :class="{ active: activeMobileTab === 'settings' && mobileMenuOpen }"
            @click="handleTabClick('settings')"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="pill-icon">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            <span>Settings</span>
          </button>
          <div v-if="activeMobileTab === 'settings' && mobileMenuOpen" class="active-dot"></div>
        </div>
      </div>

      <!-- Right Circular Collapse Button -->
      <button class="circular-action-btn" @click.stop="isCollapsed = true" title="Collapse Menu">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  isMobile: Boolean,
  isTablet: Boolean,
  activeMobileTab: String,
  mobileMenuOpen: Boolean
});
const emit = defineEmits(['toggle-tab']);

const isCollapsed = ref(false);

const handleTabClick = (tabId) => {
  emit('toggle-tab', tabId);
};
</script>

<style scoped>
.mobile-bottom-nav-wrapper {
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2100;
  pointer-events: none;
  display: flex;
  justify-content: center;
  width: auto;
  max-width: calc(100vw - 20px);
}

/* FREE-FLOATING CHIPS CONTAINER (No Outer Background!) */
.nav-capsule {
  pointer-events: none;
  background: transparent;
  border: none;
  box-shadow: none;
  padding: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  box-sizing: border-box;
  max-width: calc(100vw - 12px);
}

/* COLLAPSED CAPSULE & SHOW ALL PILL */
.collapsed-capsule {
  gap: 8px;
}

.show-all-pill {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: #1c201f;
  border: 1px solid rgba(255, 255, 255, 0.5);
  border-radius: 24px;
  padding: 6px 18px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.show-all-pill:hover {
  background: #ffffff;
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}

.show-all-pill:active {
  transform: translateY(0) scale(0.96);
}

.grid-icon {
  width: 18px;
  height: 18px;
  stroke: #1c201f;
  flex-shrink: 0;
}

/* EXPANDED CAPSULE & PILLS SCROLL GROUP */
.pills-scroll-group {
  display: flex;
  align-items: center;
  gap: 6px;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
  padding-bottom: 2px;
}

.pills-scroll-group::-webkit-scrollbar {
  display: none;
}

.pill-wrapper {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex-shrink: 0;
}

/* INDIVIDUAL TRANSPARENT CHIPS (Shows only background without solid color tint) */
.nav-pill {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.65);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  color: #1c201f;
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: 24px;
  padding: 6px 15px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 7px;
  font-family: inherit;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  user-select: none;
}

.nav-pill:hover:not(.active) {
  background: #ffffff;
  color: #0f172a;
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.18);
}

.nav-pill:active:not(.active) {
  transform: translateY(0) scale(0.96);
}

/* SELECTED / ACTIVE STATE WITH FRAMED WHITE PILL & BLUE TEXT */
.nav-pill.active {
  background: #ffffff;
  color: #0056fb;
  font-weight: 700;
  border: 3px solid rgba(255, 255, 255, 0.65);
  padding: 4px 13px; /* Compensates cleanly for the thick framed border */
  box-shadow: 0 6px 16px rgba(0, 86, 251, 0.25);
}

.pill-icon {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  flex-shrink: 0;
  transition: all 0.2s;
}

/* BLUE INDICATOR DOT BENEATH SELECTED PILL */
.active-dot {
  position: absolute;
  bottom: -7px;
  left: 50%;
  transform: translateX(-50%);
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #0056fb;
  box-shadow: 0 0 6px #0056fb;
  pointer-events: none;
}

/* CIRCULAR WHITE ACTION BUTTON (WITH BLUE ARROW) */
.circular-action-btn {
  pointer-events: auto;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.18);
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.circular-action-btn:hover {
  transform: scale(1.08) translateY(-2px);
  box-shadow: 0 8px 20px rgba(0, 86, 251, 0.3);
  background: #ffffff;
}

.circular-action-btn:active {
  transform: scale(0.95);
}

.circular-action-btn svg {
  width: 19px;
  height: 19px;
  stroke: #0056fb;
}

/* TABLET & STANDARD MOBILE TUNING (FITS 100% CLEAN WITHOUT CROPPING) */
@media (max-width: 768px) {
  .nav-capsule {
    gap: 5px;
  }
  .pills-scroll-group {
    gap: 5px;
  }
  .nav-pill {
    padding: 5px 11px;
    height: 36px;
    font-size: 12.5px;
    gap: 5px;
    border-radius: 20px;
  }
  .nav-pill.active {
    border-width: 2.5px;
    padding: 4px 9px;
  }
  .pill-icon {
    width: 15px;
    height: 15px;
  }
  .show-all-pill {
    padding: 5px 15px;
    height: 36px;
    font-size: 13.5px;
    border-radius: 20px;
  }
  .circular-action-btn {
    width: 36px;
    height: 36px;
  }
  .circular-action-btn svg {
    width: 17px;
    height: 17px;
  }
  .active-dot {
    bottom: -5px;
    width: 4.5px;
    height: 4.5px;
  }
}

/* ULTRA-NARROW MOBILE VIEWPORTS (e.g. 320px - 360px) */
@media (max-width: 380px) {
  .nav-capsule {
    gap: 4px;
  }
  .pills-scroll-group {
    gap: 4px;
  }
  .nav-pill {
    padding: 4px 9px;
    height: 34px;
    font-size: 11.5px;
    gap: 4px;
  }
  .nav-pill.active {
    border-width: 2px;
    padding: 3px 8px;
  }
  .pill-icon {
    width: 14px;
    height: 14px;
  }
  .circular-action-btn {
    width: 34px;
    height: 34px;
  }
}
</style>