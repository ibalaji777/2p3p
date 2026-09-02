<template>
  <div class="common-toolbar-3d-wrapper" v-show="viewMode === '3d'">
    <div class="common-toolbar-capsule">
      <!-- SELECT TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'select' }"
        @click="selectTool('select')"
        title="Select Tool (Key: V / Esc)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3l7 18 3-7 7-3L3 3z"></path>
        </svg>
        <span class="tool-label">Select</span>
        <span class="hotkey-badge" v-if="isDesktop">V</span>
      </button>

      <!-- MATERIAL TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'material' }"
        @click="selectTool('material')"
        title="Material Painting Tool (Key: B)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
          <path d="M12 22.5A8.5 8.5 0 0 0 20.5 14c0-3-2.5-5.5-5.5-8.5"></path>
        </svg>
        <span class="tool-label">Material</span>
        <span class="hotkey-badge" v-if="isDesktop">B</span>
      </button>

      <div class="toolbar-divider"></div>

      <!-- MOVE TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'move', disabled: !canMove }"
        :disabled="!canMove"
        @click="selectTool('move')"
        title="Move Object (Key: M / G)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="5 9 2 12 5 15"></polyline>
          <polyline points="9 5 12 2 15 5"></polyline>
          <polyline points="15 19 12 22 9 19"></polyline>
          <polyline points="19 9 22 12 19 15"></polyline>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
        <span class="tool-label">Move</span>
        <span class="hotkey-badge" v-if="isDesktop">M</span>
      </button>

      <!-- SPIN TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'spin', disabled: !canSpin }"
        :disabled="!canSpin"
        @click="selectTool('spin')"
        title="Spin / Rotate (Key: R)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6"></path>
          <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
        </svg>
        <span class="tool-label">Spin</span>
        <span class="hotkey-badge" v-if="isDesktop">R</span>
      </button>

      <!-- TILT TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'tilt', disabled: !canTilt }"
        :disabled="!canTilt"
        @click="selectTool('tilt')"
        title="Tilt Pitch (Key: T)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="9"></circle>
          <path d="M3.6 9h16.8"></path>
          <path d="M3.6 15h16.8"></path>
          <path d="M12 3a14.5 14.5 0 0 0 0 18"></path>
        </svg>
        <span class="tool-label">Tilt</span>
        <span class="hotkey-badge" v-if="isDesktop">T</span>
      </button>

      <div class="toolbar-divider"></div>

      <!-- ELEVATION AXIS UP -->
      <button 
        class="tool-btn action-btn" 
        :class="{ disabled: !canElevate }"
        :disabled="!canElevate"
        @click="triggerElevate(1)"
        title="Elevate Up (Key: ] / PageUp)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
        <span class="tool-label">↑</span>
        <span class="hotkey-badge" v-if="isDesktop">]</span>
      </button>

      <!-- ELEVATION AXIS DOWN -->
      <button 
        class="tool-btn action-btn" 
        :class="{ disabled: !canElevate }"
        :disabled="!canElevate"
        @click="triggerElevate(-1)"
        title="Elevate Down (Key: [ / PageDown)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
        <span class="tool-label">↓</span>
        <span class="hotkey-badge" v-if="isDesktop">[</span>
      </button>

      <div class="toolbar-divider"></div>

      <!-- HELP & SHORTCUTS BUTTON -->
      <button 
        class="tool-btn help-btn" 
        :class="{ active: showHelpPopup }"
        @click="showHelpPopup = !showHelpPopup"
        title="Controls & Shortcuts Guide (Key: ? / H)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
          <line x1="12" y1="17" x2="12.01" y2="17"></line>
        </svg>
        <span class="tool-label">Help</span>
        <span class="hotkey-badge" v-if="isDesktop">?</span>
      </button>
    </div>

    <!-- SHORTCUT & TOUCH CONTROLS POPUP MODAL (TELEPORTED TO BODY) -->
    <Teleport to="body">
      <div class="help-popup-backdrop" v-if="showHelpPopup" @click.self="showHelpPopup = false">
        <div class="help-popup-card">
        <!-- HEADER -->
        <div class="help-popup-header">
          <div class="header-title-row">
            <div class="title-with-badge">
              <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <h3>3D Scene Controls & Shortcuts</h3>
            </div>
            <button class="close-btn" @click="showHelpPopup = false" title="Close (Esc)">✕</button>
          </div>

          <!-- DEVICE TABS -->
          <div class="device-tabs">
            <button 
              class="device-tab" 
              :class="{ active: activeDeviceTab === 'desktop' }"
              @click="activeDeviceTab = 'desktop'"
            >
              <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>Desktop (Mouse & Keyboard)</span>
            </button>

            <button 
              class="device-tab" 
              :class="{ active: activeDeviceTab === 'touch' }"
              @click="activeDeviceTab = 'touch'"
            >
              <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <span>Mobile & Tablet (Touch)</span>
            </button>
          </div>
        </div>

        <!-- BODY -->
        <div class="help-popup-body">
          <!-- DESKTOP CONTENT -->
          <div v-if="activeDeviceTab === 'desktop'" class="guide-sections">
            <!-- 1. OBJECT CONTROLS -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge">Objects</span>
                <h4>Direct Object Manipulation (Sims 4 Style)</h4>
              </div>
              <div class="shortcuts-grid">
                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Select Object</strong>
                    <span>Click on any furniture, stair, door, window or wall</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Left Click</kbd>
                    <kbd class="key-chip">V</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Direct Move / Drag</strong>
                    <span>Click & drag directly on the object across the floor</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Drag</kbd>
                    <kbd class="key-chip">M</kbd>
                    <kbd class="key-chip">G</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Smooth Free Move</strong>
                    <span>Hold Alt while dragging to bypass 10cm grid snap</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Alt</kbd>
                    <span>+</span>
                    <kbd class="key-chip">Drag</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>45° Step Rotate</strong>
                    <span>Rotate held or selected object in 45° steps</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Right Click</kbd>
                    <kbd class="key-chip">&lt; ,</kbd>
                    <kbd class="key-chip">&gt; .</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Smooth Drag Spin</strong>
                    <span>Hold Right-Click (or [Spin] Tool) & drag horizontally</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Right Drag</kbd>
                    <kbd class="key-chip">R</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Material Face Paint</strong>
                    <span>Activate paint tool, select texture, click any face</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">B</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Raise / Lower Elevation</strong>
                    <span>Adjust vertical height in 10cm increments</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">]</kbd>
                    <kbd class="key-chip">[</kbd>
                    <kbd class="key-chip">PgUp</kbd>
                    <kbd class="key-chip">PgDn</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Delete Object</strong>
                    <span>Remove currently selected object</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Del</kbd>
                    <kbd class="key-chip">Backspace</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. CAMERA CONTROLS -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge camera">Camera</span>
                <h4>Sims 4 Scene Navigation</h4>
              </div>
              <div class="shortcuts-grid">
                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Ground-Plane Gliding</strong>
                    <span>Pan smoothly across room in 4 directions</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">W</kbd>
                    <kbd class="key-chip">A</kbd>
                    <kbd class="key-chip">S</kbd>
                    <kbd class="key-chip">D</kbd>
                    <kbd class="key-chip">Arrows</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Turbo Speed Gliding</strong>
                    <span>Fast camera navigation across large buildings</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Shift</kbd>
                    <span>+</span>
                    <kbd class="key-chip">WASD</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Orbit / Rotate View</strong>
                    <span>Rotate 3D camera around focal center</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Right Drag (Empty)</kbd>
                    <kbd class="key-chip">Middle Drag</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>45° Step Orbit</strong>
                    <span>Rotate camera isometrically in 45° increments</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">&lt; ,</kbd>
                    <kbd class="key-chip">&gt; .</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Top-Down View Toggle</strong>
                    <span>Toggle architectural bird's-eye orthogonal view</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">T</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Undo / Redo</strong>
                    <span>Revert or restore any layout change</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Ctrl + Z</kbd>
                    <kbd class="key-chip">Ctrl + Y</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TOUCH / TABLET / MOBILE CONTENT -->
          <div v-else class="guide-sections">
            <!-- 1. TOUCH OBJECT MANIPULATION -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge touch">Touch</span>
                <h4>Mobile & Tablet Object Gestures</h4>
              </div>
              <div class="touch-cards-grid">
                <div class="touch-card">
                  <div class="gesture-icon-badge">👆</div>
                  <div class="touch-card-info">
                    <strong>Tap to Select</strong>
                    <span>Tap any 3D object (furniture, stair, door, window, wall) to highlight and activate actions.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🖐</div>
                  <div class="touch-card-info">
                    <strong>1-Finger Drag to Move</strong>
                    <span>Touch down directly on the object and slide across the screen to glide it smoothly across the floor.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🔄</div>
                  <div class="touch-card-info">
                    <strong>Spin / Rotate Tool</strong>
                    <span>Tap the <strong>[ Spin ]</strong> button in the top toolbar, then swipe 1 finger horizontally to rotate smoothly in place.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🎨</div>
                  <div class="touch-card-info">
                    <strong>Material Face Painting</strong>
                    <span>Tap <strong>[ Material ]</strong> in the top toolbar, choose a texture from the bottom sheet, and tap directly on any wall face or component slot.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">↕️</div>
                  <div class="touch-card-info">
                    <strong>Raise / Lower Elevation</strong>
                    <span>Tap the <strong>↑</strong> and <strong>↓</strong> buttons on the top toolbar capsule to step object height by 10cm.</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. TOUCH CAMERA CONTROLS -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge camera">Camera</span>
                <h4>Touch Camera Navigation</h4>
              </div>
              <div class="touch-cards-grid">
                <div class="touch-card">
                  <div class="gesture-icon-badge">☝️</div>
                  <div class="touch-card-info">
                    <strong>1-Finger Drag (Empty Space)</strong>
                    <span>Drag on empty background to orbit and look around the 3D scene.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">✌️</div>
                  <div class="touch-card-info">
                    <strong>2-Finger Drag (Pan)</strong>
                    <span>Slide two fingers across the screen to pan and glide the camera across the building.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🤏</div>
                  <div class="touch-card-info">
                    <strong>Pinch to Zoom</strong>
                    <span>Pinch in or spread out with two fingers to zoom smoothly in and out.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">📐</div>
                  <div class="touch-card-info">
                    <strong>2-Finger Twist</strong>
                    <span>Twist two fingers on the canvas to rotate the isometric angle of the scene.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="help-popup-footer">
          <div class="footer-tip">
            <span class="tip-sparkle">💡</span>
            <span v-if="activeDeviceTab === 'desktop'"><strong>Pro Tip:</strong> Press <kbd class="inline-key">?</kbd> or <kbd class="inline-key">H</kbd> anytime to open this shortcut guide.</span>
            <span v-else><strong>Pro Tip:</strong> Hold two fingers down while dragging to glide smoothly through interior rooms.</span>
          </div>
          <button class="footer-done-btn" @click="showHelpPopup = false">Got it</button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { COMMON_TOOLS } from '../../core/engine3d/tools/CommonToolRegistry.js';
import { coreEventBus } from '../../core/EventBus.js';

const props = defineProps({
  viewMode: {
    type: String,
    default: '3d'
  },
  isDesktop: {
    type: Boolean,
    default: true
  },
  controller: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['tool-changed', 'elevate']);

const currentTool = ref(COMMON_TOOLS.SELECT);
const selectedEntity = ref(null);
const showHelpPopup = ref(false);
const activeDeviceTab = ref(props.isDesktop ? 'desktop' : 'touch');

const currentCaps = ref({
  selectable: true,
  material: true,
  movable: false,
  rotatable: false,
  tiltable: false,
  elevatable: false
});

const canMove = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.movable : true;
});

const canSpin = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.rotatable : true;
});

const canTilt = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.tiltable : true;
});

const canElevate = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.elevatable : false;
});

const selectTool = (toolId) => {
  currentTool.value = toolId;
  if (props.controller) {
    props.controller.setTool(toolId);
  }
  emit('tool-changed', toolId);
};

const triggerElevate = (direction) => {
  if (props.controller) {
    props.controller.handleAxisStep(direction);
  }
  emit('elevate', direction);
};

let unsubs = [];

onMounted(() => {
  unsubs.push(coreEventBus.on('CommonToolChanged', ({ activeTool }) => {
    if (activeTool) currentTool.value = activeTool;
  }));

  unsubs.push(coreEventBus.on('CommonSelectionChanged', ({ entity, capabilities }) => {
    selectedEntity.value = entity;
    if (capabilities) {
      currentCaps.value = { ...capabilities };
    } else {
      currentCaps.value = {
        selectable: true,
        material: true,
        movable: !!entity,
        rotatable: !!entity,
        tiltable: !!entity,
        elevatable: !!entity
      };
    }
  }));

  unsubs.push(coreEventBus.on('ToggleCommonHelpModal', () => {
    showHelpPopup.value = !showHelpPopup.value;
  }));
});

onBeforeUnmount(() => {
  unsubs.forEach(unsub => unsub());
  unsubs = [];
});
</script>

<style scoped>
.common-toolbar-3d-wrapper {
  position: absolute;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1040;
  pointer-events: none;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  user-select: none;
}

.common-toolbar-capsule {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.95);
  box-shadow: 
    0 12px 30px -4px rgba(15, 23, 42, 0.12),
    0 4px 10px -2px rgba(15, 23, 42, 0.05),
    0 0 0 1px rgba(226, 232, 240, 0.7) inset;
  border-radius: 28px;
  padding: 5px 8px;
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.tool-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 20px;
  padding: 6px 12px;
  height: 38px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #334155;
  font-weight: 600;
  font-size: 13.5px;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.tool-btn:hover:not(.disabled):not(:disabled) {
  background: rgba(241, 245, 249, 0.9);
  color: #0f172a;
  transform: translateY(-1px);
}

.tool-btn:active:not(.disabled):not(:disabled) {
  transform: translateY(0) scale(0.96);
}

.tool-btn.active {
  background: #eff6ff;
  border-color: #bfdbfe;
  color: #1d4ed8;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.12), 0 0 0 1px rgba(191, 219, 254, 0.6) inset;
}

.tool-btn.disabled,
.tool-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}

.tool-icon {
  width: 17px;
  height: 17px;
  stroke: currentColor;
  flex-shrink: 0;
}

.tool-label {
  letter-spacing: 0.2px;
}

.hotkey-badge {
  font-size: 10px;
  font-weight: 700;
  color: #64748b;
  background: rgba(0, 0, 0, 0.05);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 6px;
  padding: 1px 5px;
  margin-left: 2px;
  line-height: 1.2;
}

.tool-btn.active .hotkey-badge {
  color: #1d4ed8;
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.2);
}

.help-btn {
  color: #475569;
}

.help-btn:hover {
  color: #0284c7;
  background: #f0f9ff;
}

.help-btn.active {
  background: #e0f2fe;
  border-color: #7dd3fc;
  color: #0369a1;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(226, 232, 240, 0.9);
  margin: 0 2px;
  flex-shrink: 0;
}

/* HELP POPUP BACKDROP & MODAL */
.help-popup-backdrop {
  position: fixed;
  inset: 0;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  animation: fadeInBackdrop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 20px;
  box-sizing: border-box;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.help-popup-card {
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 25px 50px -12px rgba(15, 23, 42, 0.25),
    0 0 0 1px rgba(226, 232, 240, 0.8);
  border-radius: 20px;
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleInCard 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.help-popup-header {
  padding: 18px 22px 14px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
}

.header-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 22px;
  height: 22px;
  color: #0284c7;
}

.title-with-badge h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.close-btn {
  background: #f1f5f9;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.device-tabs {
  display: flex;
  gap: 8px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
}

.device-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 14px;
  background: transparent;
  border: none;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.device-tab.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.tab-icon {
  width: 16px;
  height: 16px;
}

.help-popup-body {
  padding: 20px 22px;
  overflow-y: auto;
  max-height: calc(85vh - 180px);
}

.guide-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.section-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 6px;
  background: #e0f2fe;
  color: #0369a1;
}

.section-badge.camera {
  background: #fef3c7;
  color: #b45309;
}

.section-badge.touch {
  background: #f3e8ff;
  color: #7e22ce;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.shortcut-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.action-desc {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-desc strong {
  font-size: 12.5px;
  color: #1e293b;
}

.action-desc span {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
}

.keys-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.key-chip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.touch-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.touch-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.gesture-icon-badge {
  font-size: 22px;
  background: #ffffff;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.touch-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.touch-card-info strong {
  font-size: 13px;
  color: #0f172a;
}

.touch-card-info span {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.help-popup-footer {
  padding: 14px 22px;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}

.tip-sparkle {
  font-size: 15px;
}

.inline-key {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
  border-radius: 4px;
  padding: 1px 5px;
  font-weight: 700;
  font-size: 10.5px;
  color: #1e293b;
}

.footer-done-btn {
  background: #0284c7;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
}

.footer-done-btn:hover {
  background: #0369a1;
  transform: translateY(-1px);
}

@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleInCard {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* RESPONSIVE DESIGN */
@media (max-width: 768px) {
  .common-toolbar-3d-wrapper {
    top: 68px;
    max-width: calc(100vw - 20px);
  }

  .common-toolbar-capsule {
    padding: 4px 6px;
    gap: 4px;
    border-radius: 24px;
    overflow-x: auto;
    scrollbar-width: none;
  }

  .common-toolbar-capsule::-webkit-scrollbar {
    display: none;
  }

  .tool-btn {
    padding: 5px 8px;
    height: 34px;
    font-size: 12px;
    gap: 4px;
  }

  .tool-icon {
    width: 15px;
    height: 15px;
  }

  .hotkey-badge {
    display: none;
  }

  .shortcuts-grid {
    grid-template-columns: 1fr;
  }

  .help-popup-card {
    max-height: 90vh;
  }
}

@media (max-width: 480px) {
  .common-toolbar-3d-wrapper {
    top: 64px;
  }

  .tool-label {
    display: none;
  }

  .tool-btn {
    padding: 6px 8px;
    height: 32px;
  }

  .device-tab span {
    font-size: 12px;
  }
}
</style>
