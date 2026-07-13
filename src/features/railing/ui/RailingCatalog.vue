<template>
  <div class="railing-catalog p-4">
    <h3 class="text-lg font-bold mb-4 text-gray-800">Railing Styles</h3>
    <div class="grid grid-cols-2 gap-4">
      <div 
        v-for="(config, id) in registry" 
        :key="id"
        class="border rounded-lg p-3 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
        :class="{ 'border-blue-500 bg-blue-50': modelValue === id }"
        @click="selectStyle(id)"
      >
        <div class="text-sm font-medium text-gray-700">{{ config.name }}</div>
        <div class="text-xs text-gray-500 mt-1">
          H: {{ config.height }}" | {{ config.glass ? 'Glass' : (config.cable ? 'Cable' : 'Balusters') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { RAILING_REGISTRY } from '../registry/railing.registry.js';

const props = defineProps({
  modelValue: {
    type: String,
    default: 'glass_stainless'
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const registry = RAILING_REGISTRY;

const selectStyle = (id) => {
  emit('update:modelValue', id);
  emit('change', id);
};
</script>

<style scoped>
/* Scoped styles if needed */
</style>
