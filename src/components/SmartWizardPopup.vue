<template>
  <div class="wizard-overlay" v-if="show">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h3>{{ plugin?.name }}</h3>
        <button @click="$emit('close')" class="wizard-close">✕</button>
      </div>
      <div class="wizard-body">
        <p class="wizard-desc">{{ plugin?.description }}</p>
        <div v-if="error" class="wizard-error">{{ error }}</div>
        
        <div v-for="field in fields" :key="field.name" class="control-group">
          <label v-if="field.label">{{ field.label }}</label>
          
          <div v-if="field.type === 'visual_boundary'" class="visual-boundary-box">
              <div class="vb-compass-line-v"></div>
              <div class="vb-compass-line-h"></div>
              <div class="vb-north">N</div>
              <div class="vb-south">S</div>
              <div class="vb-west">W</div>
              <div class="vb-east">E</div>
              
              <input class="vb-input top" type="number" step="0.1" v-model="config['targetN']" @input="$emit('update-boundary', 'targetN')" />
              <input class="vb-input bottom" type="number" step="0.1" v-model="config['targetS']" @input="$emit('update-boundary', 'targetS')" />
              <input class="vb-input left" type="number" step="0.1" v-model="config['targetW']" @input="$emit('update-boundary', 'targetW')" />
              <input class="vb-input right" type="number" step="0.1" v-model="config['targetE']" @input="$emit('update-boundary', 'targetE')" />
              
              <div class="vb-center-text">
                  <input class="vb-sqft-input" type="number" step="1" v-model="config['targetSqft']" @input="$emit('update-boundary', 'targetSqft')" />
                  <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Sq Ft</div>
              </div>
          </div>

          <select v-else-if="field.type === 'select'" v-model="config[field.name]" class="settings-select">
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <input v-else-if="field.type === 'text'" type="text" v-model="config[field.name]" class="settings-select" />
          <input v-else-if="field.type === 'number'" type="number" step="0.1" v-model="config[field.name]" @input="$emit('update-boundary', field.name)" class="settings-select" />
          <div v-else-if="field.type === 'checkbox'" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" v-model="config[field.name]" class="settings-checkbox" />
              <span style="font-size: 13px; color: #4b5563;">{{ field.checkboxLabel || field.label }}</span>
          </div>
        </div>
      </div>
      <div class="wizard-footer">
        <button @click="$emit('close')" class="action-btn clear">Cancel</button>
        <button @click="$emit('execute')" class="action-btn import">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show: Boolean, plugin: Object, config: Object, fields: Array, error: String
});
const emit = defineEmits(['close', 'execute', 'update-boundary']);
</script>