<template>
  <div class="right-sidebar">
    <div class="unit-label title">Edit Settings</div>

    <div v-if="type === 'widget'">
      </div>

    <div v-if="type === 'wall'">
      </div>
    
    <div v-if="type === 'room'">
      <div class="unit-label">Floor Material</div>
      <select v-model="entity.configId" @change="onUpdate">
        <option v-for="(val, key) in FLOOR_REGISTRY" :key="key" :value="key">{{ val.name }}</option>
      </select>
    </div>

    <div v-if="type === 'stair' || type === 'stair_node' || type === 'staircase_two'">
      <div class="unit-label">Staircase Type</div>
      <select v-model="entity.config.stairType" @change="onUpdate">
        <option value="straight">Straight</option>
        <option value="l_shape">L-Shape</option>
        <option value="u_shape">U-Shape / Dog-Leg</option>
        <option value="spiral">Spiral</option>
      </select>

      <div class="unit-label">Width</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.config.width" min="20" max="200" @input="onUpdate">
        <input type="number" v-model.number="entity.config.width" class="number-input" @input="onUpdate">
      </div>

      <div class="unit-label">Step Count</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.config.stepCount" min="2" max="60" @input="onUpdate">
        <input type="number" v-model.number="entity.config.stepCount" class="number-input" @input="onUpdate">
      </div>

      <div class="unit-label">Riser Height</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.config.riserHeight" min="5" max="30" step="0.5" @input="onUpdate">
        <input type="number" v-model.number="entity.config.riserHeight" class="number-input" @input="onUpdate">
      </div>

      <div class="unit-label">Tread Depth</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.config.treadDepth" min="5" max="50" step="0.5" @input="onUpdate">
        <input type="number" v-model.number="entity.config.treadDepth" class="number-input" @input="onUpdate">
      </div>

      <div class="unit-label">Rotation (Degrees)</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.config.rotation" min="-180" max="180" @input="onUpdate">
        <input type="number" v-model.number="entity.config.rotation" class="number-input" @input="onUpdate">
      </div>

      <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
        <input type="checkbox" v-model="entity.config.isMirrored" @change="onUpdate">
        <label style="font-size:12px">Mirrored</label>
      </div>

      <hr>
      <div class="unit-label title">Landing Settings</div>
      <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
        <input type="checkbox" v-model="entity.config.landing.enabled" @change="onUpdate">
        <label style="font-size:12px">Enable Landing</label>
      </div>
      <div v-if="entity.config.landing.enabled">
        <div class="unit-label">Landing Length</div>
        <div class="slider-row">
          <input type="range" v-model.number="entity.config.landing.length" min="20" max="200" @input="onUpdate">
          <input type="number" v-model.number="entity.config.landing.length" class="number-input" @input="onUpdate">
        </div>
      </div>

      <hr>
      <div class="unit-label title">Railing Settings</div>
      <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
        <input type="checkbox" v-model="entity.config.railing.enabled" @change="onUpdate">
        <label style="font-size:12px">Enable Railing</label>
      </div>
      
      <div v-if="entity.config.railing.enabled">
        <div class="unit-label">Railing Style</div>
        <select v-model="entity.config.railing.style" @change="onUpdate">
          <option value="modern">Modern</option>
          <option value="glass">Glass</option>
          <option value="steel">Steel</option>
          <option value="wooden">Wooden</option>
          <option value="minimal">Minimal</option>
          <option value="classic">Classic</option>
          <option value="cable">Cable</option>
          <option value="industrial">Industrial</option>
        </select>
        <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
          <input type="checkbox" v-model="entity.config.railing.left" @change="onUpdate">
          <label style="font-size:12px">Left Railing</label>
        </div>
        <div style="display:flex; align-items:center; gap:8px; margin-top:10px;">
          <input type="checkbox" v-model="entity.config.railing.right" @change="onUpdate">
          <label style="font-size:12px">Right Railing</label>
        </div>
      </div>

      <hr>
      <div class="unit-label" style="margin-top:15px">Position (Floor Coordinates)</div>
      <div style="display:flex; gap:10px">
        <div style="flex: 1">
          <span style="font-size:9px; color:#6b7280; display:block; margin-bottom:2px;">Pos X</span>
          <input type="number" :value="Math.round(entity.x || (entity.group && entity.group.x()) || 0)" @input="e => updatePos(e, 'x')">
        </div>
        <div style="flex: 1">
          <span style="font-size:9px; color:#6b7280; display:block; margin-bottom:2px;">Pos Y</span>
          <input type="number" :value="Math.round(entity.y || (entity.group && entity.group.y()) || 0)" @input="e => updatePos(e, 'y')">
        </div>
      </div>

      <hr>
      <button class="btn-danger" @click="deleteEntity">Delete Staircase</button>
    </div>

    <div v-if="type === 'furniture'">
      <div class="unit-label">Width (X)</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.width" min="10" max="400" @input="onUpdate">
        <input type="number" v-model.number="entity.width" class="number-input" @input="onUpdate">
      </div>
      
      <div class="unit-label">Depth (Z)</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.depth" min="10" max="400" @input="onUpdate">
        <input type="number" v-model.number="entity.depth" class="number-input" @input="onUpdate">
      </div>
      
      <div class="unit-label">Height (Y)</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.height" min="10" max="400" @input="onUpdate">
        <input type="number" v-model.number="entity.height" class="number-input" @input="onUpdate">
      </div>

      <div class="unit-label">Rotation (Degrees)</div>
      <div class="slider-row">
        <input type="range" v-model.number="entity.rotation" min="0" max="360" @input="onUpdate">
        <input type="number" v-model.number="entity.rotation" class="number-input" @input="onUpdate">
      </div>

      <div class="unit-label" style="margin-top:15px">Position (Floor Coordinates)</div>
      <div style="display:flex; gap:10px">
        <div style="flex: 1">
          <span style="font-size:9px; color:#6b7280; display:block; margin-bottom:2px;">Pos X</span>
          <input type="number" :value="Math.round(entity.group.x())" @input="e => updatePos(e, 'x')">
        </div>
        <div style="flex: 1">
          <span style="font-size:9px; color:#6b7280; display:block; margin-bottom:2px;">Pos Y</span>
          <input type="number" :value="Math.round(entity.group.y())" @input="e => updatePos(e, 'y')">
        </div>
      </div>

      <hr>
      <button class="btn-danger" @click="deleteEntity">Delete Object</button>
    </div>

  </div>
</template>

<script setup>
import { FLOOR_REGISTRY } from '../core/registry.js';
const props = defineProps(['entity', 'type', 'nodeIndex']);
const emit = defineEmits(['sync', 'delete']);

const onUpdate = () => { 
    if (props.entity && props.entity.update) props.entity.update(); 
    emit('sync'); // Triggers live 3D sync
};

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
.right-sidebar { width: 260px; background: #fff; border-left: 1px solid #e5e7eb; padding: 20px; display: flex; flex-direction: column; gap: 15px; z-index: 10; box-shadow: -2px 0 10px rgba(0,0,0,0.05); overflow-y: auto; }
.title { font-size: 14px; color: #111827; margin-bottom: 0px; }
.unit-label { font-size: 10px; color: #9ca3af; margin-top: 10px; margin-bottom: 5px; text-transform: uppercase; font-weight: bold; }
select, input[type="range"], input[type="number"] { width: 100%; padding: 8px; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 12px; box-sizing: border-box; }
.slider-row { display: flex; gap: 10px; align-items: center; }
.number-input { width: 60px; font-weight: bold; color: #4f46e5; background: #f3f4f6; text-align: center; }
hr { width: 100%; border: 0; border-top: 1px solid #eee; margin: 10px 0; }
.btn-action { width: 100%; padding: 8px; border-radius: 6px; cursor: pointer; border: 1px solid #e5e7eb; background: white; font-size: 12px; }
.btn-danger { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #fecaca; font-weight: bold; background: #fee2e2; color: #dc2626; cursor: pointer; transition: 0.2s; }
.btn-danger:hover { background: #fca5a5; color: #b91c1c; }
</style>