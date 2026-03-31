<template>
  <div class="app-root">
    <header class="top-toolbar">
       <div class="left-tools">
           <button :class="{active: viewMode==='2d'}" @click="switchTo2D">📐 2D Plan</button>
           <button :class="{active: viewMode==='3d'}" @click="switchTo3D">🧊 3D Preview</button>
       </div>
       
       <div class="center-tools" v-if="viewMode==='3d'">
           <div class="tool-group" v-if="viewMode3D !== 'preview'">
               <button :class="{active: mode3D === 'camera'}" @click="set3DMode('camera')">🎥 Camera</button>
               <button :class="{active: mode3D === 'edit'}" @click="set3DMode('edit')">⚙️ Edit Obj</button>
               <button :class="{active: mode3D === 'adjust'}" @click="set3DMode('adjust')">🖐️ Move Obj</button>
           </div>
           <div class="divider" v-if="viewMode3D !== 'preview'"></div>
           <div class="tool-group">
               <button :class="{active: viewMode3D === 'isolate'}" @click="setViewMode3D('isolate')">📏 Isolate Floor</button>
               <button :class="{active: viewMode3D === 'full-edit'}" @click="setViewMode3D('full-edit')">🏢 Full Building</button>
               <button :class="{active: viewMode3D === 'preview'}" @click="setViewMode3D('preview')">👁️ Preview Only</button>
           </div>
       </div>
    </header>

    <div class="main-workspace">
      <LeftSidebar 
        :activeTool="activeTool" 
        @select-tool="setTool" 
        @add-furniture="spawnFurniture"
        @export="saveProject"
        @import="loadProject"
        @clear="clearWorkspace"
      />

      <main class="canvas-container">
        <div class="hint" v-show="viewMode === '2d'">SELECT mode: Click elements to edit. Trace Faded Fills from lower floors perfectly.</div>
        
        <div class="floating-env-toolbar" v-show="viewMode === '3d'">
            <div class="camera-controls">
                <button class="env-icon-btn" @click="setCameraPreset('iso')" title="Isometric View">📷</button>
            <button class="env-icon-btn" @click="setCameraPreset('top')" title="Top View">🔝</button>
            <button class="env-icon-btn" @click="setCameraPreset('front')" title="Front View">⬆️</button>
            <button class="env-icon-btn" @click="setCameraPreset('left')" title="Left View">⬅️</button>
                <button class="env-icon-btn" @click="rotateCamera(-0.1)" title="Rotate Left">↺</button>
                <button class="env-icon-btn" @click="rotateCamera(0.1)" title="Rotate Right">↻</button>
            </div>
            <div class="env-dropdown" @mouseenter="showSky = true" @mouseleave="showSky = false">
                <button class="env-icon-btn">🌤️ Sky</button>
                <div class="env-menu" v-show="showSky">
                    <div v-for="(config, key) in skyRegistry" :key="key" class="env-menu-item" :class="{active: selectedSky === key}" @click="setSky(key)">
                        {{ config.name }}
                    </div>
                </div>
            </div>
            <div class="env-dropdown" @mouseenter="showGround = true" @mouseleave="showGround = false">
                <button class="env-icon-btn">🌱 Ground</button>
                <div class="env-menu" v-show="showGround">
                    <div class="decor-grid">
                        <div v-for="(config, key) in groundRegistry" :key="key" class="decor-item" @click="setGround(key)" :class="{ active: selectedGround === key }">
                            <img :src="config.thumbnail" :alt="config.name" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div class="bottom-right-toolbar">
            <button @click="zoomIn" title="Zoom In">+</button>
            <button @click="zoomOut" title="Zoom Out">-</button>
            <button @click="resetZoom" title="Reset Zoom">⛶</button>
        </div>

        <div ref="canvas2D" class="canvas-host" v-show="viewMode === '2d'"></div>
        <div ref="canvas3D" class="canvas-host canvas-3d" v-show="viewMode === '3d'"></div>
        
        <div class="status-bar" v-if="viewMode === '3d' && viewMode3D !== 'preview'">
            <span v-if="mode3D === 'camera'">🖱️ Left-Click: Rotate Room | Scroll: Zoom</span>
            <span v-else-if="mode3D === 'edit' && selectedType === 'wall'">⚙️ Click a pattern from the gallery to apply it.</span>
            <span v-else-if="mode3D === 'edit'">🖱️ Click a Wall/Obj to edit (Click other floors to switch to them)</span>
            <span v-else-if="mode3D === 'adjust'">🖱️ Click object to pick up, drag to move</span>
        </div>
      </main>

      <aside class="right-sidebar">
        <div class="panel levels-panel">
            <div class="panel-header"><h3>Floor Levels</h3></div>
            <div class="levels-list">
                <div v-for="(level, index) in levels" :key="level.id" 
                     class="level-item" 
                     :class="{ 'active': activeLevelIndex === index }"
                     @click="switchLevel(index)">
                    <span>Floor {{ index + 1 }}</span>
                    <span class="level-indicator" v-if="activeLevelIndex === index">Active</span>
                </div>
            </div>
            <div class="levels-actions">
                <button class="btn-duplicate" @click="addLevel('duplicate')">+ Duplicate Current</button>
                <button class="btn-empty" @click="addLevel('empty')">+ Add Empty Floor</button>
            </div>
        </div>

        <div class="panel properties-panel flex-1">
            <div class="panel-header"><h3>Properties</h3></div>
            
            <div class="props-content" v-if="(viewMode==='3d' || viewMode==='2d') && selectedEntity && viewMode3D !== 'preview'">
                
                <div v-if="selectedType === 'wall'">
                    <h4 class="props-subtitle">{{ selectedWallSide === 'front' ? 'Inner Wall Face' : 'Outer Wall Face' }}</h4>
                    
                    <div v-if="currentFaceDecors.length > 0">
                        <div class="applied-list">
                            <div v-for="decor in currentFaceDecors" :key="decor.id" class="applied-item-wrapper">
                                <div class="applied-item-header" :class="{active: activeDecorId === decor.id}" @click="toggleEditDecor(decor.id)">
                                    <span>{{ wallDecorRegistry[decor.configId]?.name }}</span>
                                    <button class="btn-sm-delete" @click.stop="handleDeleteSpecificDecor(decor)">✕</button>
                                </div>
                                <div class="applied-item-body" v-if="activeDecorId === decor.id">
                                    <div class="faceRow">
                                        <label><input type="checkbox" v-model="decor.faces.left" @change="onDecorUpdate(decor)">L-Edge</label>
                                        <label><input type="checkbox" v-model="decor.faces.right" @change="onDecorUpdate(decor)">R-Edge</label>
                                    </div>
                                    <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="onDecorUpdate(decor)"></div></div>
                                    <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="onDecorUpdate(decor)"></div></div>
                                    <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.width" min="1" max="100" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.width" min="1" max="100" step="1" @input="onDecorUpdate(decor)"></div></div>
                                    <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.height" min="1" max="100" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.height" min="1" max="100" step="1" @input="onDecorUpdate(decor)"></div></div>
                                    <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localX" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.localX" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"></div></div>
                                    <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localY" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.localY" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="decor-gallery" v-if="viewMode === '3d'">
                        <h4 class="props-subtitle">Add Pattern Layer</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="spawnWallPattern(key)">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div v-else-if="selectedType === 'furniture'">
                    <h4 class="props-subtitle">{{ selectedEntity.config?.name || 'Object' }}</h4>
                    <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="syncEngine"><input type="number" v-model.number="selectedEntity.rotation" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.width" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.depth" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.height" @input="syncEngine"></div></div>
                    <button class="hud-delete" @click="handleDelete">Delete Object</button>
                </div>

                <div v-else-if="selectedType === 'roof'">
                    <h4 class="props-subtitle">Roof Properties</h4>
                    <div class="control-group">
                        <select v-model="selectedEntity.config.roofType" @change="syncEngine" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="hip">Hip Roof</option>
                            <option value="flat">Flat Roof</option>
                        </select>
                    </div>
                    <div class="control-group" v-if="selectedEntity.config.roofType === 'hip'"><label>Pitch (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.pitch" min="0" max="60" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.pitch" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Overhang</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.overhang" min="0" max="50" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.overhang" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Elevation Gap</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.wallGap" min="-50" max="100" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.wallGap" @input="syncEngine"></div></div>
                    
                    <div class="decor-gallery">
                        <h4 class="props-subtitle">Roof Material</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="setRoofMaterial(key)" :class="{ active: selectedEntity.config.material === key }">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>

                    <button class="hud-delete" @click="handleDelete">Delete Roof</button>
                </div>
            </div>

            <div class="props-empty" v-else>
                <span v-if="viewMode==='2d'">Properties are edited in 3D Mode. Select an Object to edit sizing here.</span>
                <span v-else-if="viewMode3D==='preview'">Exit Preview Mode to edit.</span>
                <span v-else>Select a wall or object to edit its properties.</span>
            </div>
        </div>
      </aside>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, onMounted, onBeforeUnmount } from 'vue';
import LeftSidebar from './components/LeftSidebar.vue';

import { FloorPlanner, PremiumFurniture } from './core/engine2d/index.js';
import { Preview3D } from './core/engine3d/index.js'; 
import { WorkspaceControls } from '/src/core/engine3d/WorkspaceControls.js';

import { FileManager } from './core/io';
import { WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY } from './core/registry.js';
const wallDecorRegistry = WALL_DECOR_REGISTRY;
const roofDecorRegistry = ROOF_DECOR_REGISTRY;
const skyRegistry = SKY_REGISTRY;
const groundRegistry = GROUND_REGISTRY;

const canvas2D = ref(null);
const canvas3D = ref(null);
const planner = shallowRef(null);
const renderer3D = shallowRef(null);
const workspaceControls = shallowRef(null);

const viewMode = ref('2d');
const mode3D = ref('edit'); 
const activeTool = ref('select');
const viewMode3D = ref('full-edit'); 

const selectedEntity = shallowRef(null);
const selectedType = ref(null);
const selectedWallSide = ref(null); 
const selectedNodeIndex = ref(-1);

const uiTrigger = ref(0); 
const isPlacing3D = ref(false);
const activeDecorId = ref(null);
const isRebuilding = ref(false);

const levels = ref([{ id: 'level-' + Date.now(), name: 'Floor 1', data: null }]);
const activeLevelIndex = ref(0);

const selectedSky = ref('arch_viz_sunny');
const selectedGround = ref('grass'); // Start with new Grass + Normal map terrain

const showSky = ref(false);
const showGround = ref(false);

const currentFaceDecors = computed(() => {
    const trigger = uiTrigger.value; 
    if (!selectedEntity.value || !selectedEntity.value.attachedDecor) return [];
    return selectedEntity.value.attachedDecor.filter(d => d.side === selectedWallSide.value);
});

onMounted(() => {
    planner.value = new FloorPlanner(canvas2D.value);
    planner.value.loadDefaultHouse();
    
    planner.value.onSelectionChange = (entity, type, nodeIdx = -1) => {
        selectedEntity.value = entity; selectedType.value = type; selectedNodeIndex.value = nodeIdx;
        if (viewMode.value === '3d' && renderer3D.value) {
            if (type === 'furniture' && entity && entity.mesh3D) renderer3D.value.selectObject(entity.mesh3D);
            else renderer3D.value.deselectObject();
        }
    };

    renderer3D.value = new Preview3D(canvas3D.value);

    workspaceControls.value = new WorkspaceControls(renderer3D.value, planner.value);
    
    renderer3D.value.onEntitySelect = (entity, type, side = null) => {
        if (isRebuilding.value && !entity) return; // Prevent losing slider focus during rebuilds
        selectedEntity.value = entity; selectedType.value = type; 
        if (type !== 'wallDecor') { selectedWallSide.value = side; activeDecorId.value = null; }
    };
    
    renderer3D.value.onEntityTransform = () => { uiTrigger.value++; };
    renderer3D.value.onRelocateStateChange = (state) => { isPlacing3D.value = state; };
    
    renderer3D.value.onLevelSwitchRequest = (targetIndex, entityIndex, entityType) => { 
        if (viewMode3D.value === 'full-edit') return;

        if (targetIndex !== activeLevelIndex.value) {
            switchLevel(targetIndex);
            
            if (entityType === 'wall' && entityIndex !== undefined) {
                setTimeout(() => {
                    const targetWall = planner.value.walls[entityIndex];
                    if (targetWall && targetWall.mesh3D) {
                        planner.value.selectEntity(targetWall, 'wall');
                        const frontSkin = targetWall.mesh3D.children.find(c => c.userData.side === 'front');
                        if (frontSkin) renderer3D.value.selectObject(frontSkin);
                    }
                }, 100);
            }
        } 
    };

    window.addEventListener('keydown', handleGlobalKeys);
});

onBeforeUnmount(() => window.removeEventListener('keydown', handleGlobalKeys));

const handleGlobalKeys = (e) => {
    if (viewMode.value === '3d') {
        if (e.key === 'Delete' || e.key === 'Backspace') { 
            if (selectedType.value === 'furniture') handleDelete(); 
        }
        if (e.key === 'Escape' && renderer3D.value) renderer3D.value.cancelRelocation();
    } else if (viewMode.value === '2d') {
        if (e.key === 'Delete' || e.key === 'Backspace') if (selectedType.value === 'roof' || selectedType.value === 'furniture') handleDelete();
    }
};

const saveCurrentLevelState = () => { if (planner.value) levels.value[activeLevelIndex.value].data = planner.value.exportState(); };

const updateStaticLevelData = (staticWall) => {
    const levelIdx = staticWall.levelIndex;
    if (levelIdx === undefined || !levels.value[levelIdx]) return;
    
    const levelData = JSON.parse(levels.value[levelIdx].data);
    const targetWall = levelData.walls[staticWall.wallIndex];
    
    if (targetWall) {
        targetWall.decors = staticWall.attachedDecor.map(d => ({
            id: d.id, configId: d.configId, side: d.side,
            localX: d.localX, localY: d.localY, localZ: d.localZ,
            width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize,
            faces: { front: d.faces?.front, back: d.faces?.back, left: d.faces?.left, right: d.faces?.right }
        }));
        levels.value[levelIdx].data = JSON.stringify(levelData);
    }
};

const switchLevel = (index) => {
    if (index === activeLevelIndex.value) return; 
    saveCurrentLevelState();
    planner.value.clearReferenceBackground();
    handleDeselect();

    activeLevelIndex.value = index;
    const targetData = levels.value[index].data;
    if (targetData) planner.value.importState(targetData); else planner.value.clearAll(); 

    if (index > 0) {
        const referenceData = levels.value[index - 1].data;
        if (referenceData) planner.value.loadReferenceBackground(referenceData);
    }
    
    if (viewMode.value === '3d') refresh3DScene(true); 
};

const addLevel = (type) => {
    saveCurrentLevelState();
    const newIndex = levels.value.length;
    levels.value.push({ id: 'level-' + Date.now(), name: `Floor ${newIndex + 1}`, data: type === 'duplicate' ? levels.value[activeLevelIndex.value].data : null });
    switchLevel(newIndex);
};

const switchTo2D = () => {
    if(renderer3D.value) renderer3D.value.deselectObject();
    planner.value.syncAll();
    viewMode.value = '2d';
};

const switchTo3D = () => {
    planner.value.finishChain();
    saveCurrentLevelState();
    viewMode.value = '3d';
    if (viewMode3D.value === 'preview') mode3D.value = 'camera';
    else mode3D.value = 'edit'; 
    setTimeout(() => {
        if (renderer3D.value) {
            renderer3D.value.resize();
            updateEnvironment();
            renderer3D.value.setInteractionMode(mode3D.value); 
            refresh3DScene(false); 
        }
    }, 100);
};

const setViewMode3D = (mode) => {
    viewMode3D.value = mode; handleDeselect();
    if (mode === 'preview') set3DMode('camera'); 
    refresh3DScene(true); 
};

const updateEnvironment = () => {
    if (renderer3D.value) {
        renderer3D.value.setEnvironment(selectedSky.value, selectedGround.value);
    }
};

const setSky = (key) => {
    selectedSky.value = key;
    updateEnvironment();
    showSky.value = false;
};

const setGround = (key) => {
    selectedGround.value = key;
    updateEnvironment();
    showGround.value = false;
};

const zoomIn = () => {
    if (viewMode.value === '2d') workspaceControls.value?.zoomIn2D();
    else workspaceControls.value?.zoomIn3D();
};

const zoomOut = () => {
    if (viewMode.value === '2d') workspaceControls.value?.zoomOut2D();
    else workspaceControls.value?.zoomOut3D();
};

const resetZoom = () => {
    if (viewMode.value === '2d') workspaceControls.value?.resetZoom2D();
    // 3D reset can be more complex, often handled by `refresh3DScene`
};

const setCameraPreset = (preset) => {
    workspaceControls.value?.setCameraPosition(preset);
};

const rotateCamera = (angle) => {
    workspaceControls.value?.rotateCamera(angle);
};

const set3DMode = (mode) => { mode3D.value = mode; if (renderer3D.value) renderer3D.value.setInteractionMode(mode); };
const handleDeselect = () => {
    if (renderer3D.value) renderer3D.value.deselectObject();
    selectedEntity.value = null; selectedType.value = null; selectedWallSide.value = null; activeDecorId.value = null;
};
const setTool = (tool) => { activeTool.value = tool; planner.value.tool = tool; planner.value.finishChain(); planner.value.updateToolStates(); planner.value.selectEntity(null); };
const toggleEditDecor = (decorId) => { activeDecorId.value = activeDecorId.value === decorId ? null : decorId; };

const spawnWallPattern = (configId) => {
    if (renderer3D.value && selectedType.value === 'wall' && selectedEntity.value) {
        const decor = renderer3D.value.addWallPattern(selectedEntity.value, configId, selectedWallSide.value);
        selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
        activeDecorId.value = decor.id; uiTrigger.value++; 
        
        if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
    }
};

const spawnFurniture = (configId) => {
    const center = { x: planner.value.stage.width() / 2, y: planner.value.stage.height() / 2 };
    const item = new PremiumFurniture(planner.value, center.x, center.y, configId);
    planner.value.furniture.push(item); planner.value.selectEntity(item, 'furniture'); planner.value.syncAll();
};

const syncEngine = () => {
    if (viewMode.value === '2d') {
        planner.value.syncAll();
    } else if (viewMode.value === '3d' && selectedType.value === 'furniture') {
        renderer3D.value.updateFurnitureLive(selectedEntity.value); 
    } else if (viewMode.value === '3d' && selectedType.value === 'roof') {
        refresh3DScene(true);
    }
};

const setRoofMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'roof') {
        selectedEntity.value.config.material = key;
        syncEngine();
    }
};

const onDecorUpdate = (decor) => { 
    if (renderer3D.value) renderer3D.value.updateWallDecorLive(decor); 
    if (selectedEntity.value?.isStatic) updateStaticLevelData(selectedEntity.value);
};

const handleDelete = () => { 
    if (selectedEntity.value) {
        if (selectedType.value === 'furniture') {
            if (viewMode.value === '3d' && renderer3D.value.selectedObject?.userData.entity === selectedEntity.value) {
                renderer3D.value.structureGroup.remove(renderer3D.value.selectedObject); 
                renderer3D.value.deselectObject();
            }
            selectedEntity.value.remove(); 
            selectedEntity.value = null; 
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'roof') {
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
        }
    }
};

const handleDeleteSpecificDecor = (decorObj) => {
    const decor = decorObj || selectedEntity.value;
    if (decor) {
        const wall = decor.mesh3D.userData.parentWall;
        wall.attachedDecor = wall.attachedDecor.filter(d => d !== decor); wall.mesh3D.remove(decor.mesh3D);
        if (selectedEntity.value === wall || selectedEntity.value === decor) wall.attachedDecor = [...wall.attachedDecor]; 
        if (renderer3D.value && renderer3D.value.selectedObject === decor.mesh3D) { renderer3D.value.deselectObject(); handleDeselect(); }
        uiTrigger.value++;
        
        if (wall.isStatic) updateStaticLevelData(wall);
    }
};

const refresh3DScene = (preserveCamera = true) => {
    if (renderer3D.value) {
        isRebuilding.value = true;
        const prevSel = selectedEntity.value;
        const prevType = selectedType.value;
        const prevSide = selectedWallSide.value;
        
        saveCurrentLevelState(); 
        const levelsJsonArray = levels.value.map(l => l.data);
        
        renderer3D.value.buildScene(
            planner.value.walls, 
            planner.value.roomPaths,
            planner.value.stairs, 
            planner.value.furniture, 
            planner.value.roofs,
            levelsJsonArray, 
            activeLevelIndex.value, 
            viewMode3D.value, 
            preserveCamera
        ); 

        if (prevSel) {
            const newMesh = renderer3D.value.interactables.find(m => {
                if (prevType === 'wall' && m.userData.isWallSide && m.userData.entity === prevSel && m.userData.side === prevSide) return true;
                if (m.userData && m.userData.entity === prevSel) return true;
                return false;
            });
            if (newMesh) {
                renderer3D.value.selectObject(newMesh);
            }
        }
        
        if (workspaceControls.value) {
            workspaceControls.value.updateCameraBounds();
        }
        
        isRebuilding.value = false;
    }
};

const saveProject = () => FileManager.exportJSON(planner.value);
const loadProject = (json) => FileManager.importJSON(planner.value, json);

const clearWorkspace = () => {
    if (confirm('Are you sure you want to clear the workspace? All unsaved progress will be lost.')) {
        levels.value = [{ id: 'level-' + Date.now(), name: 'Floor 1', data: null }];
        activeLevelIndex.value = 0;
        planner.value.clearAll();
        planner.value.clearReferenceBackground();
        handleDeselect();
        if (viewMode.value === '3d') refresh3DScene(true);
    }
};
</script>

<style>
body { margin: 0; font-family: 'Inter', sans-serif; background: #f8fafc; overflow: hidden; }
.app-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; width: 100vw; }

/* TOP TOOLBAR */
.top-toolbar {
    display: flex; justify-content: space-between; align-items: center;
    background: #111827; padding: 10px 20px; color: white;
    border-bottom: 1px solid #1f2937; z-index: 1000;
}
.left-tools, .center-tools, .tool-group { display: flex; align-items: center; gap: 8px; }
.top-toolbar button {
    background: #374151; border: none; color: #d1d5db; padding: 8px 16px;
    border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; transition: 0.2s;
}
.top-toolbar button:hover { background: #4b5563; color: white; }
.top-toolbar button.active { background: #3b82f6; color: white; box-shadow: 0 0 10px rgba(59, 130, 246, 0.4); }
.divider { width: 1px; height: 20px; background: #4b5563; margin: 0 5px; }

/* MAIN WORKSPACE */
.main-workspace { display: flex; flex: 1; overflow: hidden; }

/* CANVAS CONTAINER */
.canvas-container { flex: 1; position: relative; background: #fff; overflow: hidden; height: 100%; width: 100%; }
.canvas-host { position: absolute; top: 0; left: 0; width: 100%; height: 100%; outline: none; }
.canvas-3d { background: #e5e7eb; }
.hint { position: absolute; top: 20px; left: 20px; background: rgba(17, 24, 39, 0.9); color: white; padding: 10px 15px; border-radius: 6px; font-size: 12px; pointer-events: none; z-index: 100; }
.status-bar { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(17, 24, 39, 0.9); color: white; padding: 12px 25px; border-radius: 30px; font-size: 13px; font-weight: bold; z-index: 100; pointer-events: none; }

/* DOCKED RIGHT SIDEBAR */
.right-sidebar {
    width: 320px; background: #f8fafc; border-left: 1px solid #e5e7eb;
    display: flex; flex-direction: column; overflow: hidden;
}
.panel { display: flex; flex-direction: column; border-bottom: 1px solid #e5e7eb; }
.panel.flex-1 { flex: 1; border-bottom: none; overflow: hidden; }
.panel-header { background: #f1f5f9; padding: 12px 15px; border-bottom: 1px solid #e5e7eb; }
.panel-header h3 { margin: 0; font-size: 14px; color: #374151; font-weight: bold; }

/* LEVELS PANEL */
.levels-list { padding: 10px; display: flex; flex-direction: column; gap: 5px; max-height: 150px; overflow-y: auto; }
.level-item { padding: 10px; background: #fff; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 13px; color: #4b5563; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: 0.2s; }
.level-item:hover { background: #f9fafb; }
.level-item.active { background: #eff6ff; border-color: #3b82f6; color: #1d4ed8; font-weight: bold; }
.level-indicator { font-size: 10px; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; }
.levels-actions { padding: 10px; display: flex; flex-direction: column; gap: 8px; background: #f8fafc; border-top: 1px solid #e5e7eb; }
.btn-duplicate { background: #10b981; color: white; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; }
.btn-empty { background: transparent; color: #6b7280; border: 1px dashed #9ca3af; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; }

/* PROPERTIES PANEL */
.props-content { padding: 15px; overflow-y: auto; height: 100%; }
.props-empty { padding: 30px 15px; text-align: center; color: #9ca3af; font-size: 13px; font-style: italic; }
.props-subtitle { font-size: 13px; color: #111827; margin: 0 0 10px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }

/* PROPERTY CONTROLS */
.control-group { margin-bottom: 10px; }
.control-group label { font-size: 11px; color: #4b5563; font-weight: bold; margin-bottom: 4px; display: block; }
.input-wrap { display: flex; gap: 10px; align-items: center; }
.input-wrap input[type="range"] { flex: 1; accent-color: #3b82f6; cursor: pointer; }
.input-wrap input[type="number"] { width: 60px; border: 1px solid #d1d5db; border-radius: 4px; padding: 4px; text-align: center; font-size: 12px; }

.applied-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
.applied-item-wrapper { border: 1px solid #d1d5db; border-radius: 6px; overflow: hidden; }
.applied-item-header { display: flex; justify-content: space-between; padding: 8px 10px; background: #f3f4f6; cursor: pointer; font-size: 12px; font-weight: bold; color: #374151; }
.applied-item-header.active { background: #bfdbfe; color: #1e3a8a; }
.applied-item-body { padding: 10px; background: #fff; border-top: 1px solid #e5e7eb; }
.btn-sm-delete { background: transparent; border: none; color: #ef4444; cursor: pointer; font-weight: bold; }

.faceRow { display: flex; gap: 12px; margin-bottom: 10px; }
.faceRow label { font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: #4b5563; }

.decor-gallery { margin-top: 15px; }
.decor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.decor-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px; cursor: pointer; text-align: center; background: #fff; transition: 0.2s; }
.decor-item:hover, .decor-item.active { border-color: #3b82f6; background: #eff6ff; }
.decor-item img { width: 100%; height: 50px; object-fit: cover; border-radius: 4px; margin-bottom: 4px; }
.decor-item span { font-size: 10px; color: #4b5563; font-weight: bold; }
.hud-delete { background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; width: 100%; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; margin-top: 10px; }
.hud-delete:hover { background: #ef4444; color: white; }

.floating-env-toolbar { position: absolute; top: 20px; right: 20px; display: flex; gap: 10px; z-index: 100; }
.env-dropdown { position: relative; }
.env-icon-btn { background: rgba(17, 24, 39, 0.8); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; backdrop-filter: blur(4px); transition: 0.2s; }
.env-icon-btn:hover { background: rgba(17, 24, 39, 1); box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
.env-menu { position: absolute; top: 100%; right: 0; margin-top: 5px; background: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); padding: 10px; width: 240px; display: flex; flex-direction: column; gap: 5px; }
.env-menu-item { padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; color: #374151; transition: 0.2s; }
.env-menu-item:hover { background: #f3f4f6; }
.env-menu-item.active { background: #eff6ff; color: #1d4ed8; }
.camera-controls { display: flex; gap: 8px; }

.bottom-right-toolbar { position: absolute; bottom: 20px; right: 20px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
.bottom-right-toolbar button { width: 40px; height: 40px; background: rgba(17, 24, 39, 0.8); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; cursor: pointer; font-size: 20px; font-weight: bold; backdrop-filter: blur(4px); transition: 0.2s; display: flex; align-items: center; justify-content: center; }
.bottom-right-toolbar button:hover { background: rgba(17, 24, 39, 1); }
</style>