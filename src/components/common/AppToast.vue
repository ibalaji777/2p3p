<template>
  <div class="app-toast-container" v-if="toastVisible">
    <div class="app-toast-pill" :class="toastType">
      <span class="toast-icon">{{ toastIcon }}</span>
      <span class="toast-text">{{ toastMessage }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { coreEventBus } from '../../core/EventBus.js';

const toastVisible = ref(false);
const toastMessage = ref('');
const toastType = ref('info');
let timeoutId = null;

const toastIcon = computed(() => {
  switch (toastType.value) {
    case 'warning': return '⚠️';
    case 'success': return '✓';
    case 'error': return '✕';
    case 'info':
    default:
      return 'ℹ️';
  }
});

const showToast = ({ message, type = 'info', duration = 2400 }) => {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  toastMessage.value = message || '';
  toastType.value = type || 'info';
  toastVisible.value = true;

  timeoutId = setTimeout(() => {
    toastVisible.value = false;
    timeoutId = null;
  }, duration);
};

let unsub = null;

onMounted(() => {
  unsub = coreEventBus.on('ShowToast', showToast);
});

onBeforeUnmount(() => {
  if (unsub) unsub();
  if (timeoutId) clearTimeout(timeoutId);
});
</script>

<style scoped>
.app-toast-container {
  position: fixed;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 99999;
  pointer-events: none;
  animation: toast-in 0.22s cubic-bezier(0.16, 1, 0.3, 1);
}

.app-toast-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(15, 23, 42, 0.94);
  border: 1px solid rgba(0, 240, 255, 0.45);
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.2);
  color: #f1f5f9;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  font-size: 13px;
  font-weight: 600;
  backdrop-filter: blur(12px);
  user-select: none;
}

.app-toast-pill.warning {
  border-color: rgba(245, 158, 11, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(245, 158, 11, 0.2);
}

.app-toast-pill.error {
  border-color: rgba(239, 68, 68, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(239, 68, 68, 0.2);
}

.app-toast-pill.success {
  border-color: rgba(34, 197, 94, 0.6);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px rgba(34, 197, 94, 0.2);
}

.toast-icon {
  font-size: 14px;
  line-height: 1;
}

.toast-text {
  letter-spacing: 0.2px;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, -10px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0) scale(1);
  }
}
</style>
