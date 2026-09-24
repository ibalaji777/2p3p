<template>
  <div 
    v-if="isVisible" 
    class="contextual-action-hud-container" 
    :class="{ 'mobile-hud': isMobile, 'tablet-hud': isTablet }"
  >
    <!-- MODE 1: OBJECT SELECTION HUD -->
    <div v-if="hudMode === 'contextual'" class="hud-card contextual-mode">
      <!-- Entity Badge / Title -->
      <div class="hud-entity-badge">
        <span class="entity-icon">{{ entityIcon }}</span>
        <span class="entity-title">{{ entityTitle }}</span>
      </div>

      <div class="hud-divider"></div>

      <!-- Action Buttons -->
      <div class="hud-actions">
        <!-- MOVE ACTION -->
        <button 
          class="hud-btn" 
          :class="{ disabled: !capabilities.movable }"
          :disabled="!capabilities.movable"
          @click="handleAction('move')"
          title="Move Object (Key: M / G)"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="5 9 2 12 5 15"></polyline>
            <polyline points="9 5 12 2 15 5"></polyline>
            <polyline points="15 19 12 22 9 19"></polyline>
            <polyline points="19 9 22 12 19 15"></polyline>
            <line x1="2" y1="12" x2="22" y2="12"></line>
            <line x1="12" y1="2" x2="12" y2="22"></line>
          </svg>
          <span class="btn-label">Move</span>
        </button>

        <!-- SPIN ACTION -->
        <button 
          class="hud-btn" 
          :class="{ disabled: !capabilities.rotatable }"
          :disabled="!capabilities.rotatable"
          @click="handleAction('spin')"
          title="Spin / Rotate (Key: R)"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M21.5 2v6h-6"></path>
            <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
          </svg>
          <span class="btn-label">Spin</span>
        </button>

        <!-- PROPERTIES ACTION -->
        <button 
          class="hud-btn" 
          @click="handleToggleProperties"
          title="Properties & Dimensions"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span class="btn-label">Props</span>
        </button>

        <!-- MATERIAL ACTION -->
        <button 
          v-if="capabilities.material"
          class="hud-btn" 
          @click="handleAction('material')"
          title="Paint Material (Key: B)"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
            <path d="M12 22.5A8.5 8.5 0 0 0 20.5 14c0-3-2.5-5.5-5.5-8.5"></path>
          </svg>
          <span class="btn-label">Paint</span>
        </button>

        <!-- DELETE ACTION -->
        <button 
          class="hud-btn delete-btn" 
          @click="handleAction('delete')"
          title="Delete Object (Key: Del / Backspace)"
        >
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          <span class="btn-label">Delete</span>
        </button>

        <!-- CLOSE / DESELECT BUTTON -->
        <button 
          class="hud-close-btn" 
          @click="handleDeselect"
          title="Deselect (Esc)"
        >
          ✕
        </button>
      </div>
    </div>

    <!-- MODE 2: ACTIVE MOVE ACTION HUD -->
    <div v-else-if="hudMode === 'action_minimal' && activeAction === 'move'" class="hud-card action-mode move-mode">
      <div class="action-header">
        <span class="action-badge move">✥ MOVE</span>
        <div class="action-coords">
          <label>X: <input type="number" :value="liveX" @change="onXChange" class="coord-input" step="10" /></label>
          <label>Z: <input type="number" :value="liveZ" @change="onZChange" class="coord-input" step="10" /></label>
        </div>
      </div>

      <!-- D-Pad Cardinal Step Buttons -->
      <div class="action-dpad">
        <button class="dpad-btn" @click="stepMove(0, -1)" title="Move North (-Z)">▲</button>
        <button class="dpad-btn" @click="stepMove(-1, 0)" title="Move West (-X)">◀</button>
        <button class="dpad-btn" @click="stepMove(1, 0)" title="Move East (+X)">▶</button>
        <button class="dpad-btn" @click="stepMove(0, 1)" title="Move South (+Z)">▼</button>
      </div>

      <!-- Snap Mode Pills -->
      <div class="action-snaps">
        <button 
          v-for="snap in [1, 10, 50, 0]" 
          :key="snap" 
          class="snap-pill" 
          :class="{ active: moveSnapMode === snap }"
          @click="setMoveSnap(snap)"
        >
          {{ snap === 0 ? 'FREE' : snap + 'cm' }}
        </button>
      </div>

      <!-- Commit / Revert -->
      <div class="action-buttons">
        <button class="commit-btn done" @click="handleDone" title="Confirm Move">✓ Done</button>
        <button class="commit-btn cancel" @click="handleCancel" title="Cancel Move">✕</button>
      </div>
    </div>

    <!-- MODE 3: ACTIVE SPIN ACTION HUD -->
    <div v-else-if="hudMode === 'action_minimal' && activeAction === 'spin'" class="hud-card action-mode spin-mode">
      <div class="action-header">
        <span class="action-badge spin">⭮ SPIN</span>
        <div class="spin-angle-box">
          <input type="number" :value="liveAngle" @change="onAngleChange" class="angle-input" min="0" max="360" step="1" />
          <span class="deg-symbol">°</span>
        </div>
      </div>

      <!-- Quick 180 Button -->
      <button class="quick-flip-btn" @click="flip180" title="Rotate 180°">⇄ 180°</button>

      <!-- Snap Mode Pills -->
      <div class="action-snaps">
        <button 
          v-for="snap in [15, 45, 1]" 
          :key="snap" 
          class="snap-pill" 
          :class="{ active: spinSnapMode === snap }"
          @click="setSpinSnap(snap)"
        >
          {{ snap === 1 ? 'FREE' : snap + '°' }}
        </button>
      </div>

      <!-- Commit / Revert -->
      <div class="action-buttons">
        <button class="commit-btn done" @click="handleDone" title="Confirm Spin">✓ Done</button>
        <button class="commit-btn cancel" @click="handleCancel" title="Cancel Spin">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { coreEventBus } from '../../core/EventBus.js';
import { INTERACTION_STATE } from '../../core/engine3d/tools/CommonInteractionController.js';

const props = defineProps({
  controller: {
    type: Object,
    default: null
  },
  viewMode: {
    type: String,
    default: '3d'
  },
  isMobile: {
    type: Boolean,
    default: false
  },
  isTablet: {
    type: Boolean,
    default: false
  },
  isDesktop: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['toggle-properties']);

// Interaction State
const interactionState = ref(INTERACTION_STATE.IDLE);
const activeAction = ref(null);
const hudMode = ref('none');
const selectedEntity = ref(null);
const capabilities = ref({
  movable: false,
  rotatable: false,
  material: false,
  elevatable: false,
  tiltable: false
});

// Live Coordinates & Rotation
const liveX = ref(0);
const liveZ = ref(0);
const liveAngle = ref(0);
const moveSnapMode = ref(10);
const spinSnapMode = ref(15);

const effectiveController = computed(() => {
  return props.controller || (typeof window !== 'undefined' ? (window.renderer3D?.commonTools || window.planner?.engine3d?.commonTools) : null);
});

const hasInSceneHUD = computed(() => {
  if (props.isDesktop && selectedEntity.value) {
    const ent = selectedEntity.value;
    const type = (ent.type || '').toString().toLowerCase();
    const isStair = type.startsWith('stair') || type.includes('stair') || !!ent.isStair || ent.constructor?.name === 'PremiumStaircase';
    const isPlatform = type.startsWith('platform') || type.includes('platform') || !!ent.isPlatform;
    const isRoom = type.startsWith('room') || type === 'floor' || !!ent.isRoom || !!ent.isFloor;
    const isWall = type === 'wall' || type === 'outer' || type === 'inner' || type === 'arc' || type === 'compound' || type.startsWith('wall') || !!ent.isWall;
    const isRoof = type.startsWith('roof') || type.includes('roof') || !!ent.isRoof;
    if (isStair || isPlatform || isRoom || isWall || isRoof) {
      return true;
    }
  }
  return false;
});

const isVisible = computed(() => {
  if (!selectedEntity.value) return false;
  if (hudMode.value === 'none') return false;
  // In contextual selection mode, do not show duplicate bottom card if entity has an in-scene 3D HUD
  if (hudMode.value === 'contextual' && hasInSceneHUD.value) {
    return false;
  }
  return true;
});

const entityTitle = computed(() => {
  if (!selectedEntity.value) return 'Object';
  const ent = selectedEntity.value;
  if (ent.label) return ent.label;
  if (ent.name) return ent.name;
  const type = (ent.type || '').toString().toLowerCase();
  if (type.startsWith('stair')) return 'Staircase';
  if (type.startsWith('platform')) return 'Platform';
  if (type.startsWith('room') || type === 'floor') return 'Room';
  if (type === 'outer' || type === 'inner' || type === 'wall' || type.startsWith('wall')) return 'Wall';
  if (type === 'door') return 'Door';
  if (type === 'window') return 'Window';
  if (type === 'roof' || type.startsWith('roof')) return 'Roof';
  return ent.type || 'Object';
});

const entityIcon = computed(() => {
  if (!selectedEntity.value) return '📦';
  const ent = selectedEntity.value;
  const type = (ent.type || '').toString().toLowerCase();
  if (type === 'wall' || type === 'outer' || type === 'inner' || type.startsWith('wall')) return '🧱';
  if (type === 'door') return '🚪';
  if (type === 'window') return '🪟';
  if (type.startsWith('stair') || type.includes('stair')) return '🪜';
  if (type.startsWith('roof') || type.includes('roof')) return '🏠';
  if (type.startsWith('room') || type === 'floor') return '📐';
  if (type.startsWith('platform')) return '🟩';
  if (type === 'furniture') return '🛋️';
  return '📦';
});

// Controller Delegation
const handleAction = (actionId) => {
  const ctrl = effectiveController.value;
  if (ctrl) {
    ctrl.activateAction(actionId);
  }
};

const handleToggleProperties = () => {
  emit('toggle-properties');
  const ctrl = effectiveController.value;
  if (ctrl) {
    ctrl.activateAction('properties');
  }
};

const handleDeselect = () => {
  const ctrl = effectiveController.value;
  if (ctrl) {
    ctrl.clearSelection();
  }
};

const handleDone = () => {
  const ctrl = effectiveController.value;
  if (ctrl) {
    ctrl.completeAction();
  }
};

const handleCancel = () => {
  const ctrl = effectiveController.value;
  if (ctrl) {
    ctrl.cancelAction();
  }
};

// D-Pad Stepping for Move Mode
const stepMove = (dx, dz) => {
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalMoveGizmo;
  if (gizmo && typeof gizmo.step === 'function') {
    gizmo.step(dx, dz);
  }
};

const onXChange = (e) => {
  const val = parseFloat(e.target.value) || 0;
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalMoveGizmo;
  if (gizmo && typeof gizmo.setCoordinates === 'function') {
    gizmo.setCoordinates(val, liveZ.value);
  }
};

const onZChange = (e) => {
  const val = parseFloat(e.target.value) || 0;
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalMoveGizmo;
  if (gizmo && typeof gizmo.setCoordinates === 'function') {
    gizmo.setCoordinates(liveX.value, val);
  }
};

const setMoveSnap = (snap) => {
  moveSnapMode.value = snap;
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalMoveGizmo;
  if (gizmo && typeof gizmo.setSnapMode === 'function') {
    gizmo.setSnapMode(snap);
  }
};

// Spin Controls
const onAngleChange = (e) => {
  const val = parseFloat(e.target.value) || 0;
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalSpinGizmo;
  if (gizmo && typeof gizmo.setAngle === 'function') {
    gizmo.setAngle(val);
  }
};

const flip180 = () => {
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalSpinGizmo;
  if (gizmo && typeof gizmo.flip180 === 'function') {
    gizmo.flip180();
  }
};

const setSpinSnap = (snap) => {
  spinSnapMode.value = snap;
  const ctrl = effectiveController.value;
  const gizmo = ctrl?.ctx?.interactions?.universalSpinGizmo;
  if (gizmo && typeof gizmo.setSnapMode === 'function') {
    gizmo.setSnapMode(snap);
  }
};

let unsubs = [];

onMounted(() => {
  // Sync state changes from centralized controller
  unsubs.push(coreEventBus.on('InteractionStateChanged', (state) => {
    if (!state) return;
    interactionState.value = state.state || INTERACTION_STATE.IDLE;
    activeAction.value = state.activeAction || null;
    hudMode.value = state.hudMode || 'none';
    selectedEntity.value = state.selectedEntity || null;
    if (state.capabilities) {
      capabilities.value = { ...state.capabilities };
    }
  }));

  // Sync selection changes directly
  unsubs.push(coreEventBus.on('CommonSelectionChanged', ({ entity, capabilities: caps }) => {
    selectedEntity.value = entity;
    if (caps) {
      capabilities.value = { ...caps };
    }
    if (entity) {
      liveX.value = Math.round(entity.x || 0);
      liveZ.value = Math.round(entity.y || entity.z || 0);
      liveAngle.value = Math.round(entity.rotation || 0);
    }
  }));

  // Sync live Move transformation
  unsubs.push(coreEventBus.on('UniversalMoveChanged', ({ x, z }) => {
    liveX.value = x;
    liveZ.value = z;
  }));

  // Sync live Spin transformation
  unsubs.push(coreEventBus.on('UniversalSpinChanged', ({ angle }) => {
    liveAngle.value = angle;
  }));
});

onBeforeUnmount(() => {
  unsubs.forEach(unsub => unsub());
  unsubs = [];
});
</script>

<style scoped>
.contextual-action-hud-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 995;
  pointer-events: auto;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  user-select: none;
  animation: hud-slide-up 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.mobile-hud {
  bottom: 64px;
  width: calc(100% - 24px);
  max-width: 440px;
}

.tablet-hud {
  bottom: 30px;
}

.hud-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(0, 240, 255, 0.45);
  border-radius: 9999px;
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.2);
  backdrop-filter: blur(14px);
  color: #f1f5f9;
}

.mobile-hud .hud-card {
  border-radius: 20px;
  padding: 10px 12px;
  justify-content: space-between;
}

/* Badge */
.hud-entity-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-right: 4px;
}

.entity-icon {
  font-size: 16px;
  line-height: 1;
}

.entity-title {
  font-size: 13px;
  font-weight: 700;
  color: #38bdf8;
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hud-divider {
  width: 1px;
  height: 22px;
  background: rgba(255, 255, 255, 0.15);
}

/* Actions Row */
.hud-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.hud-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  color: #f1f5f9;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  min-height: 34px;
}

.mobile-hud .hud-btn, .tablet-hud .hud-btn {
  min-height: 42px;
  padding: 6px 10px;
}

.hud-btn:hover:not(:disabled) {
  background: rgba(0, 240, 255, 0.15);
  border-color: rgba(0, 240, 255, 0.45);
  color: #00f0ff;
  transform: translateY(-1px);
}

.hud-btn:active:not(:disabled) {
  transform: translateY(0);
}

.hud-btn.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.hud-btn.delete-btn:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.btn-icon {
  width: 15px;
  height: 15px;
}

.hud-close-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 13px;
  cursor: pointer;
  border-radius: 50%;
  margin-left: 2px;
  transition: all 0.15s ease;
}

.hud-close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
}

/* Action Mode (Move & Spin) */
.action-mode {
  gap: 12px;
}

.action-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.action-badge {
  font-size: 11px;
  font-weight: 800;
  padding: 4px 8px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.action-badge.move {
  background: rgba(56, 189, 248, 0.2);
  border: 1px solid rgba(56, 189, 248, 0.5);
  color: #38bdf8;
}

.action-badge.spin {
  background: rgba(34, 197, 94, 0.2);
  border: 1px solid rgba(34, 197, 94, 0.5);
  color: #22c55e;
}

.action-coords {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
}

.coord-input {
  width: 44px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
  color: #fff;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  outline: none;
}

.spin-angle-box {
  display: flex;
  align-items: center;
  gap: 2px;
}

.angle-input {
  width: 42px;
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 4px;
  color: #fff;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  outline: none;
}

.deg-symbol {
  font-size: 12px;
  color: #94a3b8;
  font-weight: 700;
}

.quick-flip-btn {
  padding: 4px 8px;
  font-size: 10px;
  font-weight: 700;
  background: rgba(245, 158, 11, 0.15);
  border: 1px solid rgba(245, 158, 11, 0.4);
  color: #fde047;
  border-radius: 6px;
  cursor: pointer;
}

/* D-Pad */
.action-dpad {
  display: flex;
  align-items: center;
  gap: 3px;
}

.dpad-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #38bdf8;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 800;
  cursor: pointer;
}

.dpad-btn:hover {
  background: rgba(56, 189, 248, 0.3);
}

/* Snaps */
.action-snaps {
  display: flex;
  gap: 3px;
  background: rgba(0, 0, 0, 0.35);
  padding: 2px 4px;
  border-radius: 6px;
}

.snap-pill {
  padding: 3px 6px;
  font-size: 9.5px;
  font-weight: 700;
  border-radius: 4px;
  background: transparent;
  color: #94a3b8;
  border: none;
  cursor: pointer;
}

.snap-pill.active {
  background: #00f0ff;
  color: #0f172a;
}

/* Commit / Cancel */
.action-buttons {
  display: flex;
  align-items: center;
  gap: 5px;
}

.commit-btn {
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
}

.commit-btn.done {
  background: #22c55e;
  color: #0f172a;
}

.commit-btn.done:hover {
  background: #4ade80;
}

.commit-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #94a3b8;
}

.commit-btn.cancel:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

@keyframes hud-slide-up {
  from {
    opacity: 0;
    transform: translate(-50%, 14px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}
</style>
