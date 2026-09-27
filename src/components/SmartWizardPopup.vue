<template>
  <div class="wizard-overlay" v-if="show">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h3>{{ plugin?.name }}</h3>
        <button @click="show = false" class="wizard-close">✕</button>
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
              
              <input class="vb-input top" type="number" step="0.1" v-model="config['targetN']" @input="updateVisualBoundary('targetN')" />
              <input class="vb-input bottom" type="number" step="0.1" v-model="config['targetS']" @input="updateVisualBoundary('targetS')" />
              <input class="vb-input left" type="number" step="0.1" v-model="config['targetW']" @input="updateVisualBoundary('targetW')" />
              <input class="vb-input right" type="number" step="0.1" v-model="config['targetE']" @input="updateVisualBoundary('targetE')" />
              
              <div class="vb-center-text">
                  <input class="vb-sqft-input" type="number" step="1" v-model="config['targetSqft']" @input="updateVisualBoundary('targetSqft')" />
                  <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Sq Ft</div>
              </div>
          </div>

          <select v-else-if="field.type === 'select'" v-model="config[field.name]" class="settings-select">
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <input v-else-if="field.type === 'text'" type="text" v-model="config[field.name]" class="settings-select" />
          <input v-else-if="field.type === 'number'" type="number" step="0.1" v-model="config[field.name]" @input="updateVisualBoundary(field.name)" class="settings-select" />
          <div v-else-if="field.type === 'checkbox'" style="display: flex; align-items: center; gap: 8px;">
              <input type="checkbox" v-model="config[field.name]" class="settings-checkbox" />
              <span style="font-size: 13px; color: #4b5563;">{{ field.checkboxLabel || field.label }}</span>
          </div>
        </div>
      </div>
      <div class="wizard-footer">
        <button @click="show = false" class="action-btn clear">Cancel</button>
        <button @click="execute" class="action-btn import">Apply</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  wizardManager: Object,
  contextData: Object
});

const emit = defineEmits(['success']);

const show = ref(false);
const plugin = ref(null);
const config = ref({});
const fields = ref([]);
const error = ref('');

const open = (pluginId) => {
    const p = props.wizardManager?.getPlugin(pluginId);
    if (!p) return;
    plugin.value = p;
    config.value = {};
    fields.value = p.getFields ? p.getFields(props.contextData) : [];
    fields.value.forEach(f => {
        if (typeof f.defaultValue === 'object' && f.defaultValue !== null) Object.assign(config.value, f.defaultValue);
        else config.value[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
    });
    show.value = true;
    error.value = '';
};

const updateVisualBoundary = (changedField) => {
    if (changedField === 'targetN' || changedField === 'targetS' || changedField === 'targetE' || changedField === 'targetW') {
        const n = parseFloat(config.value['targetN']) || 0;
        const s = parseFloat(config.value['targetS']) || 0;
        const e = parseFloat(config.value['targetE']) || 0;
        const w = parseFloat(config.value['targetW']) || 0;
        const avgW = (n + s) / 2;
        const avgD = (e + w) / 2;
        config.value['targetSqft'] = Math.round(avgW * avgD);
        config.value['targetWidth'] = avgW.toFixed(1);
        config.value['targetDepth'] = avgD.toFixed(1);
    } else if (changedField === 'targetWidth' || changedField === 'targetDepth') {
        const w = parseFloat(config.value['targetWidth']) || 0;
        const d = parseFloat(config.value['targetDepth']) || 0;
        config.value['targetSqft'] = Math.round(w * d);
        if (changedField === 'targetWidth') {
            config.value['targetN'] = w.toFixed(1);
            config.value['targetS'] = w.toFixed(1);
        }
        if (changedField === 'targetDepth') {
            config.value['targetE'] = d.toFixed(1);
            config.value['targetW'] = d.toFixed(1);
        }
    } else if (changedField === 'targetSqft') {
        const currentSqft = parseFloat(config.value['targetSqft']) || 0;
        if (currentSqft > 0) {
            const n = parseFloat(config.value['targetN']) || 0;
            const s = parseFloat(config.value['targetS']) || 0;
            const e = parseFloat(config.value['targetE']) || 0;
            const w = parseFloat(config.value['targetW']) || 0;
            let currentW = (n + s) / 2;
            let currentD = (e + w) / 2;
            if (currentW <= 0 || currentD <= 0) {
                currentW = parseFloat(config.value['targetWidth']) || 30;
                currentD = parseFloat(config.value['targetDepth']) || 25;
            }
            const ratio = (currentW / currentD) || 1.2;
            const newD = Math.sqrt(currentSqft / ratio);
            const newW = currentSqft / newD;
            const newWStr = newW.toFixed(1);
            const newDStr = newD.toFixed(1);

            config.value['targetN'] = newWStr;
            config.value['targetS'] = newWStr;
            config.value['targetE'] = newDStr;
            config.value['targetW'] = newDStr;
            config.value['targetWidth'] = newWStr;
            config.value['targetDepth'] = newDStr;
        }
    }
};

const execute = async () => {
    if (!plugin.value || !props.wizardManager) return;
    error.value = '';
    const result = await props.wizardManager.executePlugin(plugin.value.id, config.value);
    if (result.success) {
        show.value = false;
        emit('success');
    } else {
        error.value = result.error || 'Failed to execute wizard.';
    }
};

defineExpose({ open });
</script>