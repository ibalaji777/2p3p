<template>
  <div class="floating-popover" :class="{ 'maximized': isMaximized }" v-show="isVisible" :style="isMaximized ? {} : { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }">
    <div class="popover-header" @mousedown="startDrag" @touchstart.passive="startDrag" :style="{ cursor: isMaximized ? 'default' : 'move' }">
      <div class="popover-title">
        <span class="icon">{{ entityIcon }}</span>
        <span class="name">{{ entityName }}</span>
      </div>
      <div class="popover-actions" @mousedown.stop @touchstart.stop>
        <button class="icon-btn" @click.stop="toggleMaximize" :title="isMaximized ? 'Minimize' : 'Maximize'">
          <!-- Minimize Icon -->
          <svg v-if="isMaximized" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 14h6v6"></path><path d="M20 10h-6V4"></path><path d="M14 10l7-7"></path><path d="M3 21l7-7"></path>
          </svg>
          <!-- Maximize Icon -->
          <svg v-else viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path>
          </svg>
        </button>
        <button class="icon-btn" @click.stop="$emit('close')" title="Close">
          <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
    <div class="popover-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: true
  },
  entityName: {
    type: String,
    default: 'Properties'
  },
  entityIcon: {
    type: String,
    default: '⚙️'
  }
});

const emit = defineEmits(['close']);

const isMaximized = ref(false);
const toggleMaximize = () => {
  isMaximized.value = !isMaximized.value;
};

// --- Drag Logic ---
const dragOffset = ref({ x: 0, y: 0 });
let isDragging = false;
let startPos = { x: 0, y: 0 };

// Reset position if entity changes or becomes visible
watch(() => props.isVisible, (newVal) => {
    if (newVal && isMaximized.value) {
        isMaximized.value = false; // Reset to default size when reopened
    }
});

const startDrag = (e) => {
  if (isMaximized.value) return; // Prevent drag if maximized
  if (e.target.closest('.icon-btn') || e.target.closest('input')) return;
  isDragging = true;
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  startPos = { 
    x: clientX - dragOffset.value.x, 
    y: clientY - dragOffset.value.y 
  };
  
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('touchmove', onDrag, { passive: false });
  window.addEventListener('mouseup', endDrag);
  window.addEventListener('touchend', endDrag);
};

const onDrag = (e) => {
  if (!isDragging || isMaximized.value) return;
  
  // Prevent default scroll behavior on touch devices while dragging
  if (e.cancelable) e.preventDefault(); 
  
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  
  dragOffset.value = {
    x: clientX - startPos.x,
    y: clientY - startPos.y
  };
};

const endDrag = () => {
  isDragging = false;
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('touchmove', onDrag);
  window.removeEventListener('mouseup', endDrag);
  window.removeEventListener('touchend', endDrag);
};
</script>
