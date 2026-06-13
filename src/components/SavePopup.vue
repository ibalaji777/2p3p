<template>
  <div class="wizard-overlay" v-if="show">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h3>Save Project to Cloud</h3>
        <button @click="$emit('close')" class="wizard-close">✕</button>
      </div>
      <div class="wizard-body" style="text-align: center;">
        <div v-if="isSaving" class="wizard-desc">Generating previews and saving... Please wait.</div>
        <div v-if="saveError" class="wizard-error">{{ saveError }}</div>
        <div class="control-group" style="text-align: left;">
          <label>Project Name</label>
          <input type="text" :value="projectName" @input="$emit('update:projectName', $event.target.value)" class="settings-select" placeholder="Enter project name..." />
        </div>
        <div v-if="Object.keys(previewImages).length > 0" class="decor-grid" style="grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px;">
            <div class="decor-item" v-for="(imgUrl, key) in previewImages" :key="key">
                <img :src="imgUrl" style="height: 60px; width: 100%; object-fit: contain; background: #e5e7eb; border-radius: 4px;" />
                <span style="font-size: 10px; font-weight: bold; text-transform: capitalize; margin-top: 4px; display: block;">{{ key.replace('Preview', '').replace(/([A-Z])/g, ' $1').trim() }}</span>
            </div>
        </div>
      </div>
      <div class="wizard-footer">
        <button @click="$emit('close')" class="action-btn clear" :disabled="isSaving">Cancel</button>
        <button @click="$emit('save')" class="action-btn import" :disabled="isSaving || !projectName">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  show: Boolean, isSaving: Boolean, saveError: String, projectName: String, previewImages: Object
});
const emit = defineEmits(['close', 'save', 'update:projectName']);
</script>