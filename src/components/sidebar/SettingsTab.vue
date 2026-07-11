<template>
  <div class="tab-body">
    <div class="props-content">
      <h4 class="props-subtitle">Floor Plan Configuration</h4>
      
      <div class="control-group">
          <label>Entrance Facing</label>
          <select v-model="floorPlanSettings.mainEntranceFacing" @change="$emit('sync-settings')" class="settings-select">
              <option value="north">North</option>
              <option value="south">South</option>
              <option value="east">East</option>
              <option value="west">West</option>
              <option value="north_east">North-East</option>
              <option value="north_west">North-West</option>
              <option value="south_east">South-East</option>
              <option value="south_west">South-West</option>
          </select>
      </div>
      
      <div class="control-group">
          <label>Length Unit</label>
          <select v-model="floorPlanSettings.measurementUnit" @change="$emit('sync-settings')" class="settings-select">
              <option value="ft">Feet (ft)</option>
              <option value="in">Inches (in)</option>
              <option value="feet_inches">Feet & Inches</option>
              <option value="m">Meter (m)</option>
              <option value="cm">Centimeter (cm)</option>
              <option value="mm">Millimeter (mm)</option>
          </select>
      </div>
      
      <div class="control-group">
          <label>Area Unit</label>
          <select v-model="floorPlanSettings.areaUnit" @change="$emit('sync-settings')" class="settings-select">
              <option value="sqft">Square Feet (sqft)</option>
              <option value="sqm">Square Meter (sqm)</option>
              <option value="cent">Cent</option>
              <option value="ground">Ground</option>
              <option value="gunta">Gunta</option>
          </select>
      </div>

      <div class="settings-divider"></div>

      <div class="control-group-inline">
          <label>Show Compass</label>
          <input type="checkbox" v-model="floorPlanSettings.showCompass" @change="$emit('sync-settings')" class="settings-checkbox">
      </div>
      <div class="control-group-inline">
          <label>Show Grid</label>
          <input type="checkbox" v-model="floorPlanSettings.showGrid" @change="$emit('sync-settings')" class="settings-checkbox">
      </div>
      <div class="control-group-inline">
          <label>Dimension Labels</label>
          <input type="checkbox" v-model="floorPlanSettings.showDimensionLabels" @change="$emit('sync-settings')" class="settings-checkbox">
      </div>
      <div class="control-group-inline">
          <label>Diagonal Dimensions</label>
          <input type="checkbox" v-model="floorPlanSettings.showDiagonalDimensions" @change="$emit('sync-settings')" class="settings-checkbox">
      </div>
      <div class="control-group" v-if="floorPlanSettings.showDiagonalDimensions">
          <label>Diagonal Mode</label>
          <select v-model="floorPlanSettings.diagonalMeasurementMode" @change="$emit('sync-settings')" class="settings-select">
              <option value="inner">Inner Corner to Inner Corner</option>
              <option value="outer">Outer Corner to Outer Corner</option>
          </select>
      </div>
      <div class="control-group-inline">
          <label>Workspace Labels</label>
          <input type="checkbox" v-model="floorPlanSettings.showWorkspaceLabels" @change="$emit('sync-settings')" class="settings-checkbox">
      </div>
      <div class="control-group-inline">
          <label>Wall Tracking</label>
          <input type="checkbox" v-model="floorPlanSettings.wallTracking" @change="$emit('sync-settings')" class="settings-checkbox">
      </div>

      <div class="settings-divider"></div>
      <h4 class="props-subtitle">Environment Settings</h4>
      
      <div class="control-group">
          <label>Sky Environment</label>
          <select :value="selectedSky" @change="$emit('update:selectedSky', $event.target.value); $emit('set-sky', $event.target.value)" class="settings-select">
              <option v-for="(config, key) in skyRegistry" :key="key" :value="key">{{ config.name }}</option>
          </select>
      </div>
      <div class="control-group">
          <label>Ground Environment</label>
          <select :value="selectedGround" @change="$emit('update:selectedGround', $event.target.value); $emit('set-ground', $event.target.value)" class="settings-select">
              <option v-for="(config, key) in groundRegistry" :key="key" :value="key">{{ config.name }}</option>
          </select>
      </div>
      
      <div v-if="selectedType === 'wall'" style="margin-top: 20px;">
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
    floorPlanSettings: { type: Object, required: true },
    selectedSky: { type: String, default: null },
    selectedGround: { type: String, default: null },
    skyRegistry: { type: Object, required: true },
    groundRegistry: { type: Object, required: true },
    selectedType: { type: String, default: null }
});

defineEmits(['sync-settings', 'update:selectedSky', 'set-sky', 'update:selectedGround', 'set-ground']);
</script>
