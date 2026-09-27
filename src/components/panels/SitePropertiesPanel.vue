<template>
  <div class="props-panel-inner site-props-panel" v-if="site">
    <div class="site-panel-header">
      <div class="site-header-badge">
        <span class="badge-icon">📐</span>
        <span class="badge-text">Plot Boundary</span>
      </div>
      <button @click="$emit('open-site-dialog')" class="site-edit-btn" title="Edit 4 Sides & Angles">
        ✏️ Edit Geometry
      </button>
    </div>

    <!-- Area & Coverage Summary -->
    <div class="site-metrics-card">
      <div class="metric-col">
        <span class="metric-label">Plot</span>
        <span class="metric-val">{{ metrics?.totalAreaSqFt || 0 }} sq ft</span>
      </div>
      <div class="metric-col">
        <span class="metric-label">Buildable</span>
        <span class="metric-val text-green">{{ metrics?.buildableAreaSqFt || 0 }} sq ft</span>
      </div>
      <div class="metric-col">
        <span class="metric-label">Coverage</span>
        <span class="metric-val">{{ metrics?.coveragePercentage || 0 }}%</span>
      </div>
    </div>

    <!-- Quick Setbacks Editing -->
    <div class="setbacks-header-row">
      <h4 class="props-subtitle">Setback Distances (ft)</h4>
      <button v-if="hasSetbacks" type="button" class="link-btn text-danger" @click="removeSetbacks">Remove</button>
    </div>

    <div v-if="!hasSetbacks" class="no-setbacks-card">
      <p class="no-setbacks-text">No setbacks configured (entire plot is buildable zone).</p>
      <button type="button" class="action-btn outline-btn btn-sm" @click="enableDefaultSetbacks">
        ➕ Add Setbacks
      </button>
    </div>

    <div v-else>
      <div class="control-group">
        <label>Front Setback (Road)</label>
        <div class="input-wrap">
          <input type="range" :value="setbackFrontFt" min="0" max="40" step="0.5" @input="updateSetback('front', $event.target.value)" />
          <span class="slider-val">{{ setbackFrontFt }}'</span>
        </div>
      </div>

      <div class="control-group">
        <label>Rear Setback</label>
        <div class="input-wrap">
          <input type="range" :value="setbackRearFt" min="0" max="30" step="0.5" @input="updateSetback('rear', $event.target.value)" />
          <span class="slider-val">{{ setbackRearFt }}'</span>
        </div>
      </div>

      <div class="control-group">
        <label>Left Setback</label>
        <div class="input-wrap">
          <input type="range" :value="setbackLeftFt" min="0" max="30" step="0.5" @input="updateSetback('left', $event.target.value)" />
          <span class="slider-val">{{ setbackLeftFt }}'</span>
        </div>
      </div>

      <div class="control-group">
        <label>Right Setback</label>
        <div class="input-wrap">
          <input type="range" :value="setbackRightFt" min="0" max="30" step="0.5" @input="updateSetback('right', $event.target.value)" />
          <span class="slider-val">{{ setbackRightFt }}'</span>
        </div>
      </div>
    </div>

    <!-- Road Frontage Edge -->
    <div class="control-group mt-2">
      <label>Road Frontage</label>
      <select :value="site.roadFrontageIndex || 0" @change="updateRoadFrontage($event.target.value)" class="settings-select">
        <option :value="0">🛣️ Front (North Edge)</option>
        <option :value="1">🛣️ Right (East Edge)</option>
        <option :value="2">🛣️ Rear (South Edge)</option>
        <option :value="3">🛣️ Left (West Edge)</option>
      </select>
    </div>

    <!-- Action Buttons -->
    <div class="site-actions-group">
      <button @click="handleAdaptBuilding" class="action-btn import primary full-width">
        ⚡ Adapt Building to Envelope
      </button>

      <div class="site-secondary-btns">
        <button @click="toggleVisibility" class="action-btn secondary flex-1">
          {{ site.visible !== false ? '👁️ Hide' : '👁️ Show' }}
        </button>
        <button @click="handleClearSite" class="action-btn clear flex-1">
          🗑️ Remove
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { SiteEngine } from '../../core/site/SiteEngine.js';
import { AdaptBuildingToSiteCommand } from '../../core/commands/AdaptBuildingToSiteCommand.js';

const props = defineProps({
  planner: Object
});

const emit = defineEmits(['open-site-dialog', 'sync-engine']);

const FT_TO_UNITS = 20;

const site = computed(() => props.planner?.site || null);

const metrics = computed(() => {
  if (!props.planner) return null;
  return SiteEngine.getMetrics(props.planner);
});

const hasSetbacks = computed(() => {
  return site.value?.setbacks !== null && site.value?.setbacks !== undefined;
});

const setbackFrontFt = computed(() => {
  if (!hasSetbacks.value || site.value?.setbacks?.front === undefined) return 0;
  return Math.round((site.value.setbacks.front / FT_TO_UNITS) * 10) / 10;
});
const setbackRearFt = computed(() => {
  if (!hasSetbacks.value || site.value?.setbacks?.rear === undefined) return 0;
  return Math.round((site.value.setbacks.rear / FT_TO_UNITS) * 10) / 10;
});
const setbackLeftFt = computed(() => {
  if (!hasSetbacks.value || site.value?.setbacks?.left === undefined) return 0;
  return Math.round((site.value.setbacks.left / FT_TO_UNITS) * 10) / 10;
});
const setbackRightFt = computed(() => {
  if (!hasSetbacks.value || site.value?.setbacks?.right === undefined) return 0;
  return Math.round((site.value.setbacks.right / FT_TO_UNITS) * 10) / 10;
});

function enableDefaultSetbacks() {
  if (!props.planner) return;
  SiteEngine.setSetbacks(props.planner, {
    front: 10 * FT_TO_UNITS,
    rear: 5 * FT_TO_UNITS,
    left: 5 * FT_TO_UNITS,
    right: 5 * FT_TO_UNITS
  });
  emit('sync-engine');
}

function removeSetbacks() {
  if (!props.planner) return;
  SiteEngine.setSetbacks(props.planner, null);
  emit('sync-engine');
}

function updateSetback(side, valueFt) {
  if (!props.planner) return;
  const units = Number(valueFt) * FT_TO_UNITS;
  SiteEngine.setSetbacks(props.planner, { [side]: units });
  emit('sync-engine');
}

function updateRoadFrontage(edgeIndex) {
  if (!props.planner || !site.value) return;
  SiteEngine.setOrientation(props.planner, site.value.orientation || 0, Number(edgeIndex));
  emit('sync-engine');
}

function toggleVisibility() {
  if (!site.value) return;
  site.value.visible = site.value.visible === false ? true : false;
  SiteEngine.sync(props.planner);
  emit('sync-engine');
}

function handleAdaptBuilding() {
  if (!props.planner) return;
  const buildableArea = metrics.value?.buildableAreaSqFt;
  const cmd = new AdaptBuildingToSiteCommand(props.planner, {
    targetAreaSqFt: buildableArea > 0 ? buildableArea : undefined,
    preserveAspectRatio: true,
    alignRoadFrontage: true
  });

  if (props.planner.commandManager) {
    if (typeof props.planner.commandManager.execute === 'function') {
      props.planner.commandManager.execute(cmd);
    } else if (typeof props.planner.commandManager.executeCommand === 'function') {
      props.planner.commandManager.executeCommand(cmd);
    } else {
      cmd.execute();
    }
  } else {
    cmd.execute();
  }
  emit('sync-engine');
}

function handleClearSite() {
  if (!props.planner) return;
  SiteEngine.clearSite(props.planner);
  emit('sync-engine');
}
</script>

<style scoped>
.setbacks-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
}
.link-btn {
  background: none;
  border: none;
  font-size: 11px;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}
.text-danger {
  color: #ef4444;
}
.no-setbacks-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
}
.no-setbacks-text {
  font-size: 12px;
  color: #64748b;
  margin: 0;
}
.btn-sm {
  font-size: 11px;
  padding: 4px 8px;
}
.site-props-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}
.site-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.site-header-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 14px;
  color: #1e293b;
}
.site-edit-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.site-edit-btn:hover {
  background: #e2e8f0;
}
.site-metrics-card {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
}
.metric-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
.metric-label {
  font-size: 10px;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 600;
}
.metric-val {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}
.text-green {
  color: #16a34a;
}
.slider-val {
  font-size: 12px;
  font-weight: 600;
  min-width: 32px;
  text-align: right;
  color: #475569;
}
.site-actions-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}
.site-secondary-btns {
  display: flex;
  gap: 8px;
}
.flex-1 {
  flex: 1;
}
.full-width {
  width: 100%;
}
</style>
