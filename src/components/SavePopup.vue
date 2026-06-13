<template>
  <div class="wizard-overlay" v-if="show">
    <div class="wizard-modal">
      <div class="wizard-header">
        <h3>Save Project to Cloud</h3>
        <button @click="show = false" class="wizard-close">✕</button>
      </div>
      <div class="wizard-body" style="text-align: center;">
        <div v-if="isSaving" class="wizard-desc">Generating previews and saving... Please wait.</div>
        <div v-if="saveError" class="wizard-error">{{ saveError }}</div>
        <div class="control-group" style="text-align: left;">
          <label>Project Name</label>
          <input type="text" v-model="projectName" class="settings-select" placeholder="Enter project name..." />
        </div>
        <div v-if="Object.keys(previewImages).length > 0" class="decor-grid" style="grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px;">
            <div class="decor-item" v-for="(imgUrl, key) in previewImages" :key="key">
                <img :src="imgUrl" style="height: 60px; width: 100%; object-fit: contain; background: #e5e7eb; border-radius: 4px;" />
                <span style="font-size: 10px; font-weight: bold; text-transform: capitalize; margin-top: 4px; display: block;">{{ key.replace('Preview', '').replace(/([A-Z])/g, ' $1').trim() }}</span>
            </div>
        </div>
      </div>
      <div class="wizard-footer">
        <button @click="show = false" class="action-btn clear" :disabled="isSaving">Cancel</button>
        <button @click="confirmSave" class="action-btn import" :disabled="isSaving || !projectName">Save</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  serverService: Object,
  viewMode: String
});

const emit = defineEmits(['saved', 'refresh-scene']);

const show = ref(false);
const projectName = ref('');
const isSaving = ref(false);
const saveError = ref('');
const previewImages = ref({});

const open = async () => {
    show.value = true;
    saveError.value = '';
    projectName.value = `Project ${new Date().toLocaleDateString()}`;
    previewImages.value = {};
    if (props.viewMode === '2d') emit('refresh-scene', true);
    await new Promise(resolve => setTimeout(resolve, 500));
        
        // Force the renderer to catch the correct dimensions before snapshot
        if (props.serverService && props.serverService.renderer3D) props.serverService.renderer3D.resize();
        
    try { previewImages.value = await props.serverService?.generatePreviewImages(); } 
    catch (e) { console.error("Failed to generate previews:", e); }
};

const confirmSave = async () => {
    if (!props.serverService) return;
    isSaving.value = true;
    saveError.value = '';
    try {
        await props.serverService.saveProject(projectName.value);
        show.value = false;
        alert("Project saved successfully!");
        emit('saved');
    } catch (e) { saveError.value = e.message || "Failed to save project."; } 
    finally { isSaving.value = false; }
};

defineExpose({ open });
</script>