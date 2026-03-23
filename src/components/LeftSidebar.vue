<template>
  <div class="left-sidebar">
    <div class="tool" :class="{ active: activeTool === 'select' }" @click="$emit('select-tool', 'select')">
      SELECT<br>Adjust
    </div>

    <div class="unit-section">
      <div class="unit-label">Build Walls</div>
      <div class="toolbar-group">
        <div v-for="(config, key) in WALL_REGISTRY" :key="key" class="tool" :class="{ active: activeTool === key }" @click="$emit('select-tool', key)">
          {{ config.label }}
        </div>
      </div>
    </div>

    <div class="unit-section">
      <div class="unit-label">Openings</div>
      <div class="toolbar-group">
        <div v-for="(config, key) in WIDGET_REGISTRY" :key="key" class="tool" :class="{ active: activeTool === key }" @click="$emit('select-tool', key)">
          {{ config.label }}
        </div>
      </div>
    </div>

    <div class="unit-section">
      <div class="unit-label">Furniture Catalog</div>
      <div class="catalog-grid">
        <div v-for="(item, key) in FURNITURE_REGISTRY" :key="key" class="catalog-item" @click="$emit('add-furniture', key)">
          <img :src="item.preview" :alt="item.name">
          <span>{{ item.name }}</span>
        </div>
      </div>
    </div>

    <div class="unit-section">
      <div class="unit-label">Circulation</div>
      <div class="toolbar-group">
        <div class="tool" :class="{ active: activeTool === 'stair' }" @click="$emit('select-tool', 'stair')">Draw Path Stair<br><span style="font-size:8px; font-weight:normal">(Click pts, Esc to finish)</span></div>
      </div>
    </div>

    <div class="unit-section">
      <div class="unit-label">Roofing</div>
      <div class="toolbar-group">
        <div class="tool" :class="{ active: activeTool === 'roof' }" @click="$emit('select-tool', 'roof')">Draw Hip Roof<br><span style="font-size:8px; font-weight:normal">(Trace Outer Walls)</span></div>
      </div>
    </div>

    <div class="unit-section">
      <div class="unit-label">Views</div>
      <button class="btn-toggle" @click="$emit('toggle-3d')">3D PREVIEW</button>
    </div>

    <div class="unit-section">
      <div class="unit-label">File</div>
      <button class="btn-primary" @click="$emit('export')" style="margin-bottom: 8px;">SAVE JSON</button>
      <button class="btn-secondary" @click="triggerFileInput" style="margin-bottom: 8px;">LOAD JSON</button>
      <button class="btn-danger" @click="$emit('clear')">CLEAR WORKSPACE</button>
      <input type="file" ref="fileInput" style="display:none" accept=".json" @change="handleFileUpload">
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { WALL_REGISTRY, WIDGET_REGISTRY, FURNITURE_REGISTRY } from '../core/registry.js';

defineProps(['activeTool']);
const emit = defineEmits(['select-tool', 'toggle-3d', 'export', 'import', 'add-furniture', 'clear']);

const fileInput = ref(null);
const triggerFileInput = () => fileInput.value.click();
const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { try { emit('import', JSON.parse(event.target.result)); } catch(err) { alert("Failed to read file."); } fileInput.value.value = ""; };
    reader.readAsText(file);
};
</script>

<style scoped>
.left-sidebar { width: 140px; background: #fff; border-right: 1px solid #e5e7eb; padding: 15px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; z-index: 10; box-shadow: 2px 0 10px rgba(0,0,0,0.05); }
.toolbar-group { display: flex; flex-direction: column; gap: 8px; }
.tool { height: 45px; border: 1px solid #e5e7eb; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 11px; background: white; text-align: center; color: #6b7280; transition: 0.2s; }
.tool.active { background: #111827; color: white; border-color: #111827; font-weight: bold; }
.unit-section { margin-top: 5px; padding-top: 10px; border-top: 1px solid #eee; }
.unit-label { font-size: 10px; color: #9ca3af; margin-bottom: 5px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.5px; }
button { width: 100%; padding: 10px; border-radius: 6px; font-size: 12px; cursor: pointer; transition: 0.2s; font-weight: bold; }
.btn-toggle { background: #4f46e5; color: white; border: none; }
.btn-toggle:hover { background: #4338ca; }
.btn-primary { background: #111827; color: white; border: none; }
.btn-primary:hover { background: #374151; }
.btn-secondary { background: #f9fafb; color: #111827; border: 1px solid #e5e7eb; }
.btn-danger { background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; }
.btn-danger:hover { background: #ef4444; color: white; }
.catalog-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.catalog-item { cursor: pointer; border: 1px solid #e5e7eb; border-radius: 6px; padding: 4px; text-align: center; transition: 0.2s; }
.catalog-item:hover { border-color: #4f46e5; background: #f3f4f6; }
.catalog-item img { width: 100%; height: 40px; object-fit: cover; border-radius: 4px; }
.catalog-item span { font-size: 9px; font-weight: bold; color: #4b5563; display: block; margin-top: 4px; }
</style>