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
        <button class="btn-close-3d" @click="close3D">← Back to 2D Plan</button>
        
        <div class="mode-toggle-3d">
            <button :class="{active: mode3D === 'camera'}" @click="set3DMode('camera')">🎥 Camera Angle</button>
            <button :class="{active: mode3D === 'edit'}" @click="set3DMode('edit')">⚙️ Edit Object</button>
            <button :class="{active: mode3D === 'adjust'}" @click="set3DMode('adjust')">🖐️ Adjustment</button>
        </div>

        <div class="status-bar">
            <span v-if="mode3D === 'camera'">🖱️ Left-Click: Rotate Room | Scroll: Zoom</span>
            <span v-else-if="mode3D === 'edit' && selectedEntity">⚙️ Use panel to adjust width, height, and rotation</span>
            <span v-else-if="mode3D === 'edit'">🖱️ Click an object to edit its properties</span>
            <span v-else-if="mode3D === 'adjust' && isPlacing3D">🖱️ Move mouse to preview • <strong>Click floor to drop</strong> • (ESC to cancel)</span>
            <span v-else-if="mode3D === 'adjust'">🖱️ Click object to pick up, click floor to drop</span>
        </div>

        <div class="floating-hud" v-if="mode3D === 'edit' && selectedType === 'furniture' && selectedEntity">
            <div class="hud-header">
                <h3>Edit Properties</h3>
                <button class="btn-close-hud" @click="handleDeselect">✕</button>
            </div>
            <span class="hud-type">{{ selectedEntity.config.name }}</span>

            <div class="hud-controls" :key="uiTrigger">
                <div class="control-group">
                    <label>Rotation (°)</label>
                    <div class="input-wrap">
                        <input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="syncEngine">
                        <input type="number" v-model.number="selectedEntity.rotation" @input="syncEngine">
                    </div>
                </div>
                <div class="control-group">
                    <label>Width</label>
                    <div class="input-wrap">
                        <input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="syncEngine">
                        <input type="number" v-model.number="selectedEntity.width" @input="syncEngine">
                    </div>
                </div>
                <div class="control-group">
                    <label>Depth</label>
                    <div class="input-wrap">
                        <input type="range" v-model.number="selectedEntity.depth" min="10" max="500" @input="syncEngine">
                        <input type="number" v-model.number="selectedEntity.depth" @input="syncEngine">
                    </div>
                </div>
                <div class="control-group">
                    <label>Height</label>
                    <div class="input-wrap">
                        <input type="range" v-model.number="selectedEntity.height" min="10" max="500" @input="syncEngine">
                        <input type="number" v-model.number="selectedEntity.height" @input="syncEngine">
                    </div>
                </div>
            </div>

            <button class="hud-delete" @click="handleDelete">Delete Object (Del)</button>
        </div>
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
import { ref, shallowRef, onMounted, onBeforeUnmount } from 'vue';
import LeftSidebar from './components/LeftSidebar.vue';
import RightSidebar from './components/RightSidebar.vue';
import { FloorPlanner, PremiumFurniture } from './core/engine2d';
import { Preview3D } from './core/engine3d';
import { FileManager } from './core/io';

const canvas2D = ref(null);
const canvas3D = ref(null);
const planner = shallowRef(null);
const renderer3D = shallowRef(null);

const viewMode = ref('2d');
const mode3D = ref('adjust'); // Default to Adjust so user can arrange room immediately
const activeTool = ref('select');

const selectedEntity = shallowRef(null);
const selectedType = ref(null);
const selectedNodeIndex = ref(-1);

const uiTrigger = ref(0); 
const isPlacing3D = ref(false);

onMounted(() => {
    planner.value = new FloorPlanner(canvas2D.value);
    
    planner.value.onSelectionChange = (entity, type, nodeIdx = -1) => {
        selectedEntity.value = entity;
        selectedType.value = type;
        selectedNodeIndex.value = nodeIdx;
        
        if (viewMode.value === '3d' && renderer3D.value) {
            if (type === 'furniture' && entity && entity.mesh3D) {
                renderer3D.value.selectObject(entity.mesh3D);
            } else {
                renderer3D.value.deselectObject();
            }
        }
    };

    renderer3D.value = new Preview3D(canvas3D.value);
    
    renderer3D.value.onFurnitureSelect = (entity) => {
        selectedEntity.value = entity;
        selectedType.value = entity ? 'furniture' : null;
        if (entity) planner.value.selectEntity(entity, 'furniture');
    };
    
    renderer3D.value.onFurnitureTransform = () => {
        uiTrigger.value++; 
    };

    renderer3D.value.onRelocateStateChange = (state) => {
        isPlacing3D.value = state;
    };

    window.addEventListener('keydown', handleGlobalKeys);
});

onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeys));

const handleGlobalKeys = (e) => {
    if (viewMode.value === '3d' && selectedType.value === 'furniture') {
        if (e.key === 'Delete' || e.key === 'Backspace') handleDelete();
        
        // Escape cancels placement
        if (e.key === 'Escape' && renderer3D.value) {
            renderer3D.value.cancelRelocation();
        }
    }
};

const set3DMode = (mode) => {
    mode3D.value = mode;
    if (renderer3D.value) renderer3D.value.setInteractionMode(mode);
};

const handleDeselect = () => {
    if (renderer3D.value) renderer3D.value.deselectObject();
    selectedEntity.value = null;
    selectedType.value = null;
};

const close3D = () => {
    if (renderer3D.value) renderer3D.value.deselectObject();
    planner.value.syncAll(); 
    viewMode.value = '2d';
};

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

const syncEngine = () => {
    if (viewMode.value === '2d') {
        planner.value.syncAll();
    } else if (viewMode.value === '3d') {
        planner.value.syncAll(); 
        if (selectedEntity.value && selectedType.value === 'furniture') {
            renderer3D.value.updateFurnitureLive(selectedEntity.value); 
        }
    }
};

const handleDelete = () => { 
    if (selectedEntity.value) {
        if (viewMode.value === '3d' && renderer3D.value.selectedObject?.userData.entity === selectedEntity.value) {
            renderer3D.value.structureGroup.remove(renderer3D.value.selectedObject);
            renderer3D.value.deselectObject();
        }
        selectedEntity.value.remove(); 
        selectedEntity.value = null;
        selectedType.value = null;
    }
};

const toggle3D = () => {
    planner.value.finishChain();
    viewMode.value = '3d';
    
    mode3D.value = 'adjust'; 

    setTimeout(() => {
        if (renderer3D.value) {
            renderer3D.value.resize();
            renderer3D.value.setInteractionMode('adjust'); 
            
            renderer3D.value.buildScene(
                planner.value.walls, 
                planner.value.roomPaths, 
                planner.value.stairs, 
                planner.value.furniture, 
                selectedEntity.value 
            ); 
        }
    }, 100); 
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

/* --- 3D TOP TOGGLE BAR --- */
.mode-toggle-3d {
    position: absolute;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    background: rgba(17, 24, 39, 0.85);
    backdrop-filter: blur(10px);
    padding: 6px;
    border-radius: 8px;
    z-index: 100;
    box-shadow: 0 4px 15px rgba(0,0,0,0.2);
}
.mode-toggle-3d button {
    padding: 10px 20px;
    background: transparent;
    border: none;
    color: #9ca3af;
    font-weight: bold;
    font-size: 13px;
    border-radius: 6px;
    cursor: pointer;
    transition: 0.2s;
}
.mode-toggle-3d button.active {
    background: #3b82f6;
    color: white;
}

/* --- DYNAMIC STATUS BAR --- */
.status-bar {
    position: absolute;
    bottom: 30px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(17, 24, 39, 0.9);
    color: white;
    padding: 12px 25px;
    border-radius: 30px;
    font-size: 13px;
    font-weight: bold;
    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
    z-index: 100;
    pointer-events: none;
}

/* PROFESSIONAL FLOATING 3D HUD */
.floating-hud {
    position: absolute;
    top: 20px; 
    right: 20px;
    width: 280px;
    background: rgba(17, 24, 39, 0.95); 
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 20px;
    color: white;
    z-index: 100;
    box-shadow: 0 10px 25px rgba(0,0,0,0.4);
    display: flex;
    flex-direction: column;
    gap: 15px;
    animation: fadeIn 0.2s ease-out;
}
@keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.hud-header { display: flex; justify-content: space-between; align-items: center; }
.hud-header h3 { margin: 0; font-size: 14px; font-weight: bold; color: #f3f4f6; }
.btn-close-hud { background: transparent; border: none; color: #9ca3af; cursor: pointer; font-size: 16px; transition: 0.2s; }
.btn-close-hud:hover { color: white; }
.hud-type { font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-top:-5px; display:block;}

.hud-controls { display: flex; flex-direction: column; gap: 12px; }
.control-group label { font-size: 11px; color: #d1d5db; font-weight: bold; margin-bottom: 4px; display: block; }
.input-wrap { display: flex; gap: 10px; align-items: center; }
.input-wrap input[type="range"] { flex: 1; accent-color: #3b82f6; cursor: pointer; }
.input-wrap input[type="number"] { width: 60px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2); color: white; border-radius: 4px; padding: 5px; text-align: center; font-size: 12px; font-weight: bold; }
.input-wrap input[type="number"]:focus { outline: none; border-color: #3b82f6; }

.hud-delete { background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #fca5a5; padding: 10px; border-radius: 8px; font-weight: bold; cursor: pointer; transition: 0.2s; margin-top: 5px; }
.hud-delete:hover { background: #ef4444; color: white; }
</style>