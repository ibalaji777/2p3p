<template>
  <div class="railing-properties p-4" v-if="entity">
    <h3 class="text-lg font-bold mb-4 text-gray-800">Railing Properties</h3>
    
    <div class="space-y-4">
      <!-- Style Selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-1">Style</label>
        <select 
          v-model="entity.configId" 
          @change="onConfigChange"
          class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
        >
          <option v-for="(config, id) in registry" :key="id" :value="id">
            {{ config.name }}
          </option>
        </select>
      </div>

      <!-- Dimensions -->
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Height (in)</label>
          <input 
            type="number" 
            v-model.number="entity.height" 
            @change="onPropertyChange"
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Thickness (in)</label>
          <input 
            type="number" 
            v-model.number="entity.thickness" 
            @change="onPropertyChange"
            class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
          />
        </div>
      </div>
      
      <!-- Component Settings dynamically generated based on active config -->
      <div v-if="entity.config && entity.config.post" class="pt-2 border-t">
        <label class="block text-sm font-medium text-gray-700 mb-1">Post Spacing (in)</label>
        <input 
          type="number" 
          v-model.number="entity.config.post.spacing" 
          @change="onPropertyChange"
          class="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
        />
      </div>
      
      <div class="mt-6 flex justify-end">
        <button 
          @click="deleteRailing"
          class="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
        >
          Delete Railing
        </button>
      </div>
    </div>
  </div>
  <div v-else class="p-4 text-gray-500">
    Select a railing to edit its properties.
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RAILING_REGISTRY } from '../registry/railing.registry.js';

const props = defineProps({
  entity: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['sync-engine', 'delete-entity']);

const registry = RAILING_REGISTRY;

const onConfigChange = () => {
  if (props.entity && typeof props.entity.setConfig === 'function') {
    props.entity.setConfig(props.entity.configId);
  }
  emit('sync-engine');
};

const onPropertyChange = () => {
  if (props.entity && props.entity.update2D) {
    props.entity.update2D();
  }
  emit('sync-engine');
};

const deleteRailing = () => {
  emit('delete-entity');
};
</script>
