<template>
  <div class="props-panel-inner" v-if="entity">
    <h4 class="props-subtitle">Railing Properties</h4>
    
    <div class="control-group">
      <label>Style</label>
      <select 
        v-model="entity.configId" 
        @change="onConfigChange"
        class="settings-select"
      >
        <option v-for="(config, id) in registry" :key="id" :value="id">
          {{ config.name }}
        </option>
      </select>
    </div>

    <div class="control-group">
      <label>Height</label>
      <div class="input-wrap">
        <input 
          type="range" 
          v-model.number="entity.height" 
          min="10" max="80" step="1" 
          @input="onPropertyChange"
        />
        <DimensionInput 
          v-model="entity.height" 
          @change="onPropertyChange"
        />
      </div>
    </div>

    <div class="control-group">
      <label>Thickness</label>
      <div class="input-wrap">
        <input 
          type="range" 
          v-model.number="entity.thickness" 
          min="0.5" max="10" step="0.5" 
          @input="onPropertyChange"
        />
        <DimensionInput 
          v-model="entity.thickness" 
          @change="onPropertyChange"
        />
      </div>
    </div>
    
    <div class="control-group" v-if="entity.config && entity.config.post">
      <label>Post Spacing</label>
      <div class="input-wrap">
        <input 
          type="range" 
          v-model.number="entity.config.post.spacing" 
          min="12" max="120" step="1" 
          @input="onPropertyChange"
        />
        <DimensionInput 
          v-model="entity.config.post.spacing" 
          @change="onPropertyChange"
        />
      </div>
    </div>
    
    <button 
      @click="deleteRailing"
      class="hud-delete"
      style="margin-top: 15px;"
    >
      Delete Railing
    </button>
  </div>
  <div v-else class="props-panel-inner" style="color: #64748b; padding: 20px; text-align: center;">
    Select a railing to edit its properties.
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { RAILING_REGISTRY } from '../registry/railing.registry.js';
import DimensionInput from '../../../components/common/DimensionInput.vue';

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
