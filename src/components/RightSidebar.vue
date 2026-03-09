<template>
  <div class="right-sidebar">
    <div class="unit-label title">Settings</div>

    <div v-if="type === 'widget'">
      <div class="unit-label">Width</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.width" min="20" max="150" @input="onUpdate">
        <span>{{ entity.width }}</span>
      </div>

      <div v-if="entity.type === 'door'">
        <div class="unit-label">Door Type</div>
        <select v-model="entity.doorType" @change="onUpdate">
          <option v-for="(val, key) in DOOR_TYPES" :key="key" :value="key">{{ val.label }}</option>
        </select>
        <div class="unit-label">Material</div>
        <select v-model="entity.doorMat" @change="onUpdate">
          <option v-for="(val, key) in DOOR_MATERIALS" :key="key" :value="key">{{ val.label }}</option>
        </select>
      </div>

      <div v-if="entity.type === 'window'">
        <div class="unit-label">Window Type</div>
        <select v-model="entity.windowType" @change="onUpdate">
          <option v-for="(val, key) in WINDOW_TYPES" :key="key" :value="key">{{ val.label }}</option>
        </select>
        <div class="unit-label">Frame Material</div>
        <select v-model="entity.frameMat" @change="onUpdate">
          <option v-for="(val, key) in WINDOW_FRAME_MATERIALS" :key="key" :value="key">{{ val.label }}</option>
        </select>
        <div class="unit-label">Glass Type</div>
        <select v-model="entity.glassMat" @change="onUpdate">
          <option v-for="(val, key) in WINDOW_GLASS_MATERIALS" :key="key" :value="key">{{ val.label }}</option>
        </select>
        <div class="unit-label">Grille Pattern</div>
        <select v-model="entity.grillePattern" @change="onUpdate">
          <option v-for="(val, key) in WINDOW_GRILLE_PATTERNS" :key="key" :value="key">{{ val.label }}</option>
        </select>
      </div>

      <div v-if="entity.hasEvent('hinge_flip')" class="swing-controls">
        <hr>
        <div class="unit-label">Swing Controls</div>
        <button class="btn-action" @click="flip('facing')">Flip In / Out</button>
        <button class="btn-action" style="margin-top:8px" @click="flip('side')">Hinge Left / Right</button>
      </div>
      
      <hr>
      <button class="btn-danger" @click="deleteEntity">Delete Opening</button>
    </div>

    <div v-if="type === 'wall'">
      <div class="unit-label">Length</div>
      <div class="length-display">{{ Math.round(entity.getLength()) }} px</div>
      <hr>
      <button class="btn-danger" @click="deleteEntity">Delete Wall</button>
    </div>
    
    <div v-if="type === 'stair' || type === 'stair_node'">
      <div class="unit-label">Stair Width</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.config.width" min="20" max="150" @input="onStairUpdate">
        <span>{{ entity.config.width }}</span>
      </div>
      
      <div v-if="type === 'stair_node'">
        <div class="unit-label">Landing Shape</div>
        <select v-model="entity.path[nodeIndex].shape" @change="onStairUpdate">
          <option value="flat">Flat Polygon</option>
          <option value="circular">Circular</option>
        </select>
      </div>
      <hr>
      <button class="btn-danger" @click="deleteEntity">Delete Staircase</button>
    </div>

    <div v-if="type === 'furniture'">
      <div class="unit-label">Width (X)</div>
      <input type="range" v-model.number="entity.width" min="20" max="200" @input="onUpdate">
      
      <div class="unit-label">Depth (Z)</div>
      <input type="range" v-model.number="entity.depth" min="20" max="200" @input="onUpdate">
      
      <div class="unit-label">Height (Y)</div>
      <input type="range" v-model.number="entity.height" min="20" max="200" @input="onUpdate">

      <div class="unit-label">Rotation</div>
      <input type="range" v-model.number="entity.rotation" min="0" max="360" @input="onUpdate">

      <div class="unit-label" style="margin-top:15px">Position (Room Coordinates)</div>
      <div style="display:flex; gap:10px">
        <input type="number" :value="Math.round(entity.group.x())" @input="e => updatePos(e, 'x')">
        <input type="number" :value="Math.round(entity.group.y())" @input="e => updatePos(e, 'y')">
      </div>

      <hr>
      <button class="btn-danger" @click="deleteEntity">Delete Furniture</button>
    </div>

  </div>
</template>

<script setup>
import { DOOR_TYPES, DOOR_MATERIALS, WINDOW_TYPES, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS, WINDOW_GRILLE_PATTERNS } from '../core/registry';

const props = defineProps(['entity', 'type', 'nodeIndex']);
const emit = defineEmits(['sync', 'delete']);

const onUpdate = () => { if (props.entity && props.entity.update) props.entity.update(); emit('sync'); };
const onStairUpdate = () => { if (props.entity && props.entity.update) props.entity.update(true); emit('sync'); };

const flip = (prop) => { props.entity[prop] *= -1; onUpdate(); };
const deleteEntity = () => emit('delete');

const updatePos = (e, axis) => {
    const val = parseFloat(e.target.value);
    if(isNaN(val)) return;
    if(axis === 'x') props.entity.group.x(val);
    if(axis === 'y') props.entity.group.y(val);
    onUpdate();
};
</script>

<style scoped>
.right-sidebar { width: 240px; background: #fff; border-left: 1px solid #e5e7eb; padding: 20px; display: flex; flex-direction: column; gap: 15px; z-index: 10; box-shadow: -2px 0 10px rgba(0,0,0,0.05); overflow-y: auto; }
.title { font-size: 14px; color: #111827; margin-bottom: 0px; }
.unit-label { font-size: 10px; color: #9ca3af; margin-top: 10px; margin-bottom: 5px; text-transform: uppercase; font-weight: bold; }
select, input[type="range"], input[type="number"] { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 12px; box-sizing: border-box; }
.slider-row { display: flex; gap: 10px; align-items: center; }
.slider-row span { font-size: 11px; font-weight: bold; color: #4f46e5; width: 40px; text-align: right; }
hr { width: 100%; border: 0; border-top: 1px solid #eee; margin: 10px 0; }
.btn-action { width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; border: 1px solid #e5e7eb; background: white; font-size: 12px; }
.btn-danger { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #fecaca; font-weight: bold; background: #fee2e2; color: #dc2626; cursor: pointer; }
.length-display { font-size: 14px; font-weight: bold; margin-bottom: 10px; }
</style>