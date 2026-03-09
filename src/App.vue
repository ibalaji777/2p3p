<template>
  <div class="app-container">
    <LeftSidebar 
      :activeTool="activeTool" 
      @select-tool="setTool" 
      @toggle-3d="toggle3D"
      @add-furniture="spawnFurniture"
      @export="saveProject"
      @import="loadProject"
    />

    <div class="canvas-wrapper">
      <div class="hint" v-show="viewMode === '2d'">SELECT mode: Click elements to edit dimensions and properties.</div>
      <div ref="canvas2D" class="canvas-host" v-show="viewMode === '2d'"></div>
      
      <div ref="canvas3D" class="canvas-host canvas-3d" v-show="viewMode === '3d'">
        <button class="btn-close-3d" @click="viewMode = '2d'">← Back to 2D Plan</button>
      </div>
    </div>

    <RightSidebar 
      v-if="selectedEntity && viewMode === '2d'" 
      :entity="selectedEntity" 
      :type="selectedType" 
      :nodeIndex="selectedNodeIndex"
      @sync="syncEngine"
      @delete="handleDelete"
    />
  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, nextTick } from 'vue';
import LeftSidebar from './components/LeftSidebar.vue';
import RightSidebar from './components/RightSidebar.vue';
import { FloorPlanner, PremiumFurniture } from './core/engine2d';
import { Preview3D } from './core/engine3d';
import { FileManager } from './core/io';
import { DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from './core/registry';

window.DOOR_MATERIALS = DOOR_MATERIALS;
window.WINDOW_FRAME_MATERIALS = WINDOW_FRAME_MATERIALS;
window.WINDOW_GLASS_MATERIALS = WINDOW_GLASS_MATERIALS;

const canvas2D = ref(null);
const canvas3D = ref(null);

const planner = shallowRef(null);
const renderer3D = shallowRef(null);

const viewMode = ref('2d');
const activeTool = ref('select');
const selectedEntity = shallowRef(null);
const selectedType = ref(null);
const selectedNodeIndex = ref(-1);

onMounted(() => {
    planner.value = new FloorPlanner(canvas2D.value);
    planner.value.onSelectionChange = (entity, type, nodeIdx = -1) => {
        selectedEntity.value = entity;
        selectedType.value = type;
        selectedNodeIndex.value = nodeIdx;
    };
    renderer3D.value = new Preview3D(canvas3D.value);
});

const setTool = (tool) => {
    activeTool.value = tool;
    planner.value.tool = tool;
    planner.value.finishChain();
    planner.value.updateToolStates();
    planner.value.selectEntity(null);
};

const spawnFurniture = (configId) => {
    const center = { x: planner.value.stage.width() / 2, y: planner.value.stage.height() / 2 };
    const item = new PremiumFurniture(planner.value, center.x, center.y, configId);
    planner.value.furniture.push(item);
    planner.value.selectEntity(item, 'furniture');
    planner.value.syncAll();
};

const syncEngine = () => planner.value.syncAll();
const handleDelete = () => { if (selectedEntity.value) selectedEntity.value.remove(); };

const toggle3D = async () => {
    planner.value.finishChain();
    planner.value.deselectAll();
    viewMode.value = '3d';
    await nextTick();
    renderer3D.value.resize();
    renderer3D.value.buildScene(planner.value.walls, planner.value.roomPaths, planner.value.stairs, planner.value.furniture); 
};

const saveProject = () => FileManager.exportJSON(planner.value);
const loadProject = (json) => FileManager.importJSON(planner.value, json);
</script>

<style>
body { margin: 0; font-family: 'Inter', sans-serif; background: #f3f4f6; overflow: hidden; }
.app-container { display: flex; height: 100vh; overflow: hidden; }
.canvas-wrapper { flex: 1; position: relative; background: #fff; }
.canvas-host { position: absolute; top: 0; left: 0; width: 100%; height: 100%; outline: none; }
.canvas-3d { background: #e5e7eb; z-index: 50; }
.btn-close-3d { position: absolute; top: 20px; left: 20px; padding: 10px 20px; background: #111827; color: white; border: none; border-radius: 6px; font-weight: bold; cursor: pointer; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
.hint { position: absolute; bottom: 20px; left: 20px; background: rgba(17, 24, 39, 0.9); color: white; padding: 10px 15px; border-radius: 6px; font-size: 12px; pointer-events: none; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
</style>