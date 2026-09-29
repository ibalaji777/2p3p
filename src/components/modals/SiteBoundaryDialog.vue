<template>
  <div class="wizard-overlay" v-if="isOpen">
    <div class="wizard-modal site-dialog-modal">
      <!-- Modal Header -->
      <div class="wizard-header">
        <div class="site-title-wrap">
          <div class="site-modal-icon-badge">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 22L22 2"></path>
              <path d="M2 22h20"></path>
              <path d="M2 22V2"></path>
              <path d="M7 22v-3"></path>
              <path d="M12 22v-5"></path>
              <path d="M17 22v-3"></path>
              <path d="M2 17h3"></path>
              <path d="M2 12h5"></path>
              <path d="M2 7h3"></path>
            </svg>
          </div>
          <div>
            <h3>Plot & Site Boundary</h3>
            <p class="site-modal-subtitle">Set land dimensions, road access, and view buildable setback zone</p>
          </div>
        </div>
        <button @click="close" class="wizard-close site-close-btn" title="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <!-- Modal Body: 2 Columns on Desktop, Stacks on Mobile -->
      <div class="site-modal-body-split">
        <!-- Left Column: Step-by-Step Inputs -->
        <div class="site-controls-col">
          <!-- Step 1: Visual Plot Dimensions (Unified Visual Boundary Box like Resize Plan) -->
          <div class="site-section">
            <div class="section-header-flex">
              <label class="site-label-bold">1. Plot Boundary & Dimensions (ft)</label>
              <div class="plot-presets">
                <button type="button" class="preset-pill" @click="applyPlotPreset(25, 30)">25' × 30' (750 sq ft)</button>
                <button type="button" class="preset-pill" @click="applyPlotPreset(30, 40)">30' × 40' (1200 sq ft)</button>
                <button type="button" class="preset-pill" v-if="currentBuildingAreaSqFt > 0" @click="matchBuildingSize">Match House ({{ currentBuildingAreaSqFt }} sq ft)</button>
              </div>
            </div>

            <!-- Visual Boundary Box with 4 side inputs, center Sq Ft, and Road Facing chips -->
            <div class="visual-boundary-box site-vb-box">
              <div class="vb-compass-line-v"></div>
              <div class="vb-compass-line-h"></div>

              <!-- Top: Front / North Edge -->
              <div class="vb-edge-wrap top">
                <button 
                  type="button" 
                  class="vb-edge-chip" 
                  :class="{ active: roadFrontageIndex === 0 }"
                  @click="setRoadFrontage(0)"
                  title="Click to set Front as Access Road"
                >
                  <svg class="chip-road-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="3"></line><line x1="20" y1="21" x2="20" y2="3"></line><line x1="12" y1="21" x2="12" y2="17"></line><line x1="12" y1="13" x2="12" y2="9"></line><line x1="12" y1="5" x2="12" y2="3"></line></svg>
                  <span>Front / North</span>
                </button>
                <input 
                  class="vb-input-val" 
                  type="number" 
                  step="0.5" 
                  min="5" 
                  v-model.number="sideFrontFt" 
                  @input="onSideDimensionChanged('front')" 
                />
              </div>

              <!-- Bottom: Rear / South Edge -->
              <div class="vb-edge-wrap bottom">
                <input 
                  class="vb-input-val" 
                  type="number" 
                  step="0.5" 
                  min="5" 
                  v-model.number="sideRearFt" 
                  @input="onSideDimensionChanged('rear')" 
                />
                <button 
                  type="button" 
                  class="vb-edge-chip" 
                  :class="{ active: roadFrontageIndex === 2 }"
                  @click="setRoadFrontage(2)"
                  title="Click to set Rear as Access Road"
                >
                  <svg class="chip-road-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="3"></line><line x1="20" y1="21" x2="20" y2="3"></line><line x1="12" y1="21" x2="12" y2="17"></line><line x1="12" y1="13" x2="12" y2="9"></line><line x1="12" y1="5" x2="12" y2="3"></line></svg>
                  <span>Rear / South</span>
                </button>
              </div>

              <!-- Left: West Edge -->
              <div class="vb-edge-wrap left">
                <button 
                  type="button" 
                  class="vb-edge-chip" 
                  :class="{ active: roadFrontageIndex === 3 }"
                  @click="setRoadFrontage(3)"
                  title="Click to set Left as Access Road"
                >
                  <svg class="chip-road-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="3"></line><line x1="20" y1="21" x2="20" y2="3"></line><line x1="12" y1="21" x2="12" y2="17"></line><line x1="12" y1="13" x2="12" y2="9"></line><line x1="12" y1="5" x2="12" y2="3"></line></svg>
                  <span>Left</span>
                </button>
                <input 
                  class="vb-input-val" 
                  type="number" 
                  step="0.5" 
                  min="5" 
                  v-model.number="sideLeftFt" 
                  @input="onSideDimensionChanged('left')" 
                />
              </div>

              <!-- Right: East Edge -->
              <div class="vb-edge-wrap right">
                <input 
                  class="vb-input-val" 
                  type="number" 
                  step="0.5" 
                  min="5" 
                  v-model.number="sideRightFt" 
                  @input="onSideDimensionChanged('right')" 
                />
                <button 
                  type="button" 
                  class="vb-edge-chip" 
                  :class="{ active: roadFrontageIndex === 1 }"
                  @click="setRoadFrontage(1)"
                  title="Click to set Right as Access Road"
                >
                  <svg class="chip-road-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="3"></line><line x1="20" y1="21" x2="20" y2="3"></line><line x1="12" y1="21" x2="12" y2="17"></line><line x1="12" y1="13" x2="12" y2="9"></line><line x1="12" y1="5" x2="12" y2="3"></line></svg>
                  <span>Right</span>
                </button>
              </div>

              <!-- Center: Plot Sq Ft Input -->
              <div class="vb-center-text">
                <input 
                  class="vb-sqft-input" 
                  type="number" 
                  step="10" 
                  min="50" 
                  v-model.number="centerPlotSqFt" 
                  @input="onCenterSqFtChanged" 
                />
                <div class="vb-center-sub">Plot Sq Ft</div>
              </div>
            </div>

            <!-- Optional Corner Angle / Skew (Default 90°) -->
            <div class="corner-angle-row">
              <button 
                type="button" 
                class="angle-toggle-btn" 
                @click="showAngleControl = !showAngleControl"
              >
                <span>{{ showAngleControl ? '▼ Hide' : '▶ Adjust' }} Skew / Corner Angle</span>
                <span class="angle-badge">{{ cornerAngleDeg }}°</span>
              </button>
              <div v-if="showAngleControl" class="angle-input-flex">
                <input 
                  type="range" 
                  v-model.number="cornerAngleDeg" 
                  min="45" 
                  max="135" 
                  step="1" 
                  @input="recalculatePlot" 
                  class="angle-slider"
                />
                <input 
                  type="number" 
                  v-model.number="cornerAngleDeg" 
                  min="45" 
                  max="135" 
                  step="1" 
                  @input="recalculatePlot" 
                  class="angle-num-input"
                />
                <button type="button" class="preset-pill" @click="cornerAngleDeg = 90; recalculatePlot()">Reset 90°</button>
              </div>
            </div>
          </div>

          <!-- Step 2: Setback Margins (ft) -->
          <div class="site-section">
            <div class="section-header-flex">
              <label class="site-label-bold">2. Setbacks / Clearances (ft)</label>
              <div class="setback-presets">
                <button type="button" class="preset-pill" :class="{ active: !enableSetbacks }" @click="setNoSetbacks">No Setback</button>
                <button type="button" class="preset-pill" :class="{ active: enableSetbacks && setbackFrontFt === 10 && setbackRightFt === 5 }" @click="applySetbackPreset(10, 5, 5, 5)">Standard (10'/5')</button>
                <button type="button" class="preset-pill" :class="{ active: enableSetbacks && setbackFrontFt === 5 && setbackRightFt === 3 }" @click="applySetbackPreset(5, 3, 3, 3)">Compact (5'/3')</button>
                <button type="button" class="preset-pill" :class="{ active: enableSetbacks && setbackFrontFt === 0 && setbackRightFt === 0 && setbackRearFt === 0 && setbackLeftFt === 0 }" @click="applySetbackPreset(0, 0, 0, 0)">Zero Lot (0')</button>
              </div>
            </div>

            <div v-if="!enableSetbacks" class="setback-disabled-note">
              <span>Setbacks unconfigured (entire plot boundary is buildable).</span>
              <button type="button" class="preset-pill" @click="applySetbackPreset(10, 5, 5, 5)">Enable Setbacks</button>
            </div>

            <div v-else class="site-grid-4">
              <div class="control-group">
                <label>Front (Road)</label>
                <input type="number" v-model.number="setbackFrontFt" step="0.5" min="0" max="50" @input="recalculatePlot" class="settings-input" />
              </div>
              <div class="control-group">
                <label>Right</label>
                <input type="number" v-model.number="setbackRightFt" step="0.5" min="0" max="50" @input="recalculatePlot" class="settings-input" />
              </div>
              <div class="control-group">
                <label>Rear</label>
                <input type="number" v-model.number="setbackRearFt" step="0.5" min="0" max="50" @input="recalculatePlot" class="settings-input" />
              </div>
              <div class="control-group">
                <label>Left</label>
                <input type="number" v-model.number="setbackLeftFt" step="0.5" min="0" max="50" @input="recalculatePlot" class="settings-input" />
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Interactive Live SVG Plot Preview & Real-Time Metrics -->
        <div class="site-preview-col">
          <div class="preview-card">
            <div class="preview-header">
              <span class="preview-title">📐 Live Plot Preview</span>
              <div class="compass-badge" title="North Direction">
                <span class="compass-arrow">↑</span>
                <span class="compass-n">N</span>
              </div>
            </div>

            <!-- SVG Visual Diagram -->
            <div class="svg-container">
              <svg 
                viewBox="0 0 320 230" 
                class="plot-svg"
              >
                <!-- Background Grid -->
                <defs>
                  <pattern id="plotGrid" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f1f5f9" stroke-width="1" />
                  </pattern>
                </defs>
                <rect width="320" height="230" fill="url(#plotGrid)" rx="8" />

                <!-- Road Strip on Active Road Edge -->
                <g v-if="roadBandPoly">
                  <polygon :points="roadBandPoly" fill="#334155" />
                  <line 
                    :x1="roadCenterline.x1" :y1="roadCenterline.y1" 
                    :x2="roadCenterline.x2" :y2="roadCenterline.y2" 
                    stroke="#fbbf24" stroke-width="2" stroke-dasharray="6,4" 
                  />
                  <text 
                    :x="roadLabelPos.x" :y="roadLabelPos.y" 
                    fill="#ffffff" font-size="9" font-weight="700" 
                    text-anchor="middle" dominant-baseline="middle"
                  >
                    ACCESS ROAD
                  </text>
                </g>

                <!-- Plot Boundary Polygon -->
                <polygon 
                  v-if="plotSvgPoints" 
                  :points="plotSvgPoints" 
                  class="plot-poly"
                />

                <!-- Setback / Buildable Envelope Polygon -->
                <polygon 
                  v-if="envelopeSvgPoints" 
                  :points="envelopeSvgPoints" 
                  class="envelope-poly"
                />

                <!-- Interactive Edges & Dimension Badges -->
                <g 
                  v-for="(edge, idx) in edgeData" 
                  :key="idx" 
                  @click="setRoadFrontage(idx)" 
                  class="edge-interactive-group"
                  :title="`Click to set Edge ${idx} (${edge.name}) as Access Road`"
                >
                  <line 
                    :x1="edge.x1" :y1="edge.y1" :x2="edge.x2" :y2="edge.y2" 
                    class="edge-click-line" 
                    :class="{ 'edge-road': roadFrontageIndex === idx }"
                  />
                  <!-- Dimension Badge -->
                  <g :transform="`translate(${edge.badgeX}, ${edge.badgeY})`">
                    <rect 
                      x="-22" y="-9" width="44" height="18" rx="4" 
                      class="dim-badge-bg" 
                      :class="{ 'dim-road-bg': roadFrontageIndex === idx }" 
                    />
                    <text x="0" y="1" text-anchor="middle" dominant-baseline="middle" class="dim-badge-text">
                      {{ edge.lengthFt }}'
                    </text>
                  </g>
                </g>

                <!-- Buildable Zone Label -->
                <text 
                  v-if="envelopeSvgPoints && envelopeCenter" 
                  :x="envelopeCenter.x" 
                  :y="envelopeCenter.y" 
                  text-anchor="middle" 
                  dominant-baseline="middle" 
                  class="buildable-label"
                >
                  BUILDABLE ZONE
                </text>
              </svg>
            </div>

            <!-- Legend -->
            <div class="preview-legend">
              <span class="legend-item"><span class="legend-swatch plot-swatch"></span> Plot Boundary</span>
              <span class="legend-item"><span class="legend-swatch env-swatch"></span> Buildable Zone</span>
              <span class="legend-item"><span class="legend-swatch road-swatch"></span> Road Edge</span>
            </div>

            <!-- Real-Time Metrics & Assessment -->
            <div class="metrics-summary-box">
              <div class="metric-row">
                <span class="metric-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg>
                  <span>Total Plot Area</span>
                </span>
                <span class="metric-number">{{ calculatedPlotAreaSqFt }} sq ft</span>
              </div>
              <div class="metric-row">
                <span class="metric-title">
                  <span class="metric-status-dot green"></span>
                  <span>Buildable Footprint</span>
                </span>
                <span class="metric-number text-green">{{ calculatedBuildableAreaSqFt }} sq ft</span>
              </div>
              <div class="metric-row" v-if="currentBuildingAreaSqFt > 0">
                <span class="metric-title">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                  <span>Current House</span>
                </span>
                <span class="metric-number">{{ currentBuildingAreaSqFt }} sq ft</span>
              </div>

              <!-- Target House Adaptation Options -->
              <div class="target-adaptation-section" v-if="currentBuildingAreaSqFt > 0">
                <div class="target-row-header">
                  <span class="metric-title bold-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>
                    <span>Target House Size</span>
                  </span>
                  <div class="quick-preset-btns">
                    <button 
                      type="button" 
                      class="mini-pill" 
                      :class="{ active: targetHouseAreaSqFt === calculatedBuildableAreaSqFt && calculatedBuildableAreaSqFt > 0 }"
                      @click="setTargetArea(calculatedBuildableAreaSqFt)"
                      title="Fit exactly to setback envelope"
                    >
                      Fit Envelope
                    </button>
                    <button 
                      type="button" 
                      class="mini-pill" 
                      :class="{ active: targetHouseAreaSqFt === calculatedPlotAreaSqFt && calculatedPlotAreaSqFt > 0 }"
                      @click="setTargetArea(calculatedPlotAreaSqFt)"
                      title="Fit to entire plot boundary"
                    >
                      Fit Plot
                    </button>
                    <button 
                      type="button" 
                      class="mini-pill" 
                      :class="{ active: targetHouseAreaSqFt === currentBuildingAreaSqFt }"
                      @click="setTargetArea(currentBuildingAreaSqFt)"
                      title="Keep current house area"
                    >
                      Current ({{ currentBuildingAreaSqFt }})
                    </button>
                  </div>
                </div>

                <div class="target-input-row">
                  <div class="target-input-wrap">
                    <input 
                      type="number" 
                      v-model.number="targetHouseAreaSqFt" 
                      step="10" 
                      min="50" 
                      :max="calculatedPlotAreaSqFt * 1.5"
                      class="target-area-input" 
                      placeholder="e.g. 690"
                    />
                    <span class="unit-suffix">sq ft</span>
                  </div>

                  <label class="aspect-ratio-toggle" title="Keep proportional width-to-depth ratio">
                    <input type="checkbox" v-model="preserveAspectRatio" />
                    <span>Preserve Aspect</span>
                  </label>
                </div>
              </div>

              <!-- Fit Assessment Banner -->
              <div v-if="validationError" class="fit-banner error">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                <span>{{ validationError }}</span>
              </div>
              <div v-else-if="currentBuildingAreaSqFt > 0" class="fit-banner" :class="fitAssessment.class">
                <span class="fit-icon">
                  <svg v-if="fitAssessment.class === 'success'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                </span>
                <span class="fit-text">{{ fitAssessment.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal Footer Buttons -->
      <div class="wizard-footer site-modal-footer">
        <button v-if="hasSiteOnPlanner" @click="handleClearPlot" class="action-btn clear">Clear Plot</button>
        <button @click="close" class="action-btn secondary">Cancel</button>
        <button 
          @click="handleApplyBoundary" 
          class="action-btn outline-btn" 
          :disabled="Boolean(validationError) || calculatedPlotAreaSqFt <= 0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>Apply Boundary Only</span>
        </button>
        <button 
          @click="handleAdaptBuilding" 
          class="action-btn import primary" 
          :disabled="Boolean(validationError) || calculatedPlotAreaSqFt <= 0"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>Adapt Building to Site</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { SiteEngine } from '../../core/site/SiteEngine.js';
import { SiteGeometryEngine } from '../../core/site/SiteGeometryEngine.js';
import { AdaptBuildingToSiteCommand } from '../../core/commands/AdaptBuildingToSiteCommand.js';

const props = defineProps({
  planner: Object
});

const emit = defineEmits(['close', 'sync']);

const isOpen = ref(false);
const validationError = ref('');

// Side dimensions in feet (Front, Right, Rear, Left)
const sideFrontFt = ref(25.0);
const sideRightFt = ref(30.0);
const sideRearFt = ref(25.0);
const sideLeftFt = ref(30.0);
const centerPlotSqFt = ref(750);

const cornerAngleDeg = ref(90.0);
const showAngleControl = ref(false);

// Setbacks in feet (defaults: Front 10 ft, Sides/Rear 5 ft)
const enableSetbacks = ref(true);
const setbackFrontFt = ref(10.0);
const setbackRightFt = ref(5.0);
const setbackRearFt = ref(5.0);
const setbackLeftFt = ref(5.0);
const roadFrontageIndex = ref(0);

const calculatedPlotAreaSqFt = ref(0);
const calculatedBuildableAreaSqFt = ref(0);
const currentBuildingAreaSqFt = ref(0);
const currentBuildingWidthFt = ref(0);
const currentBuildingDepthFt = ref(0);
const targetHouseAreaSqFt = ref(0);
const preserveAspectRatio = ref(true);

function setTargetArea(val) {
  if (typeof val === 'number' && val > 0) {
    targetHouseAreaSqFt.value = Math.round(val * 10) / 10;
  }
}

const currentVertices = ref([]);
const currentEnvelope = ref([]);

const hasSiteOnPlanner = computed(() => Boolean(props.planner?.site));
const FT_TO_UNITS = 20;
const FT_TO_CM = FT_TO_UNITS; // Backward compatibility alias

function onSideDimensionChanged(changedSide) {
  const f = parseFloat(sideFrontFt.value) || 0;
  const r = parseFloat(sideRearFt.value) || 0;
  const l = parseFloat(sideLeftFt.value) || 0;
  const rt = parseFloat(sideRightFt.value) || 0;

  const avgW = (f + r) / 2;
  const avgD = (l + rt) / 2;
  centerPlotSqFt.value = Math.round(avgW * avgD);

  recalculatePlot();
}

function onCenterSqFtChanged() {
  const targetSqFt = parseFloat(centerPlotSqFt.value) || 0;
  if (targetSqFt <= 0) return;

  const f = parseFloat(sideFrontFt.value) || 0;
  const r = parseFloat(sideRearFt.value) || 0;
  const l = parseFloat(sideLeftFt.value) || 0;
  const rt = parseFloat(sideRightFt.value) || 0;

  let currentW = (f + r) / 2;
  let currentD = (l + rt) / 2;
  if (currentW <= 0 || currentD <= 0) {
    currentW = 25;
    currentD = 30;
  }

  const ratio = (currentW / currentD) || 1.0;
  const newD = Math.sqrt(targetSqFt / ratio);
  const newW = targetSqFt / newD;

  const scaleW = newW / currentW;
  const scaleD = newD / currentD;

  sideFrontFt.value = Math.round(f * scaleW * 10) / 10;
  sideRearFt.value = Math.round(r * scaleW * 10) / 10;
  sideLeftFt.value = Math.round(l * scaleD * 10) / 10;
  sideRightFt.value = Math.round(rt * scaleD * 10) / 10;

  recalculatePlot();
}

function applyPlotPreset(w, d) {
  sideFrontFt.value = w;
  sideRearFt.value = w;
  sideLeftFt.value = d;
  sideRightFt.value = d;
  centerPlotSqFt.value = Math.round(w * d);
  cornerAngleDeg.value = 90;
  recalculatePlot();
}

function matchBuildingSize() {
  if (currentBuildingWidthFt.value > 0 && currentBuildingDepthFt.value > 0) {
    applyPlotPreset(currentBuildingWidthFt.value, currentBuildingDepthFt.value);
  }
}

function setRoadFrontage(idx) {
  roadFrontageIndex.value = idx;
  recalculatePlot();
}

function setNoSetbacks() {
  enableSetbacks.value = false;
  recalculatePlot();
}

function applySetbackPreset(front, right, rear, left) {
  enableSetbacks.value = true;
  setbackFrontFt.value = front;
  setbackRightFt.value = right;
  setbackRearFt.value = rear;
  setbackLeftFt.value = left;
  recalculatePlot();
}

function recalculatePlot() {
  validationError.value = '';

  const L_front = Math.max(1, (sideFrontFt.value || 10) * FT_TO_UNITS);
  const L_right = Math.max(1, (sideRightFt.value || 10) * FT_TO_UNITS);
  const L_rear = Math.max(1, (sideRearFt.value || 10) * FT_TO_UNITS);
  const L_left = Math.max(1, (sideLeftFt.value || 10) * FT_TO_UNITS);

  // Centering: Get existing building center (or canvas stage center)
  let bCx = 800;
  let bCy = 450;
  if (props.planner?.anchors && props.planner.anchors.length > 0) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    props.planner.anchors.forEach(a => {
      const pos = typeof a.position === 'function' ? a.position() : a;
      minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
    });
    if (minX !== Infinity && maxX !== -Infinity) {
      bCx = (minX + maxX) / 2;
      bCy = (minY + maxY) / 2;
    }
  } else if (props.planner?.stage && typeof props.planner.stage.width === 'function') {
    bCx = props.planner.stage.width() / 2;
    bCy = props.planner.stage.height() / 2;
  }

  let vertices = null;

  // Check if orthogonal box (standard rectangle)
  const isRect = Math.abs(L_front - L_rear) < 0.1 && Math.abs(L_left - L_right) < 0.1 && Math.abs((cornerAngleDeg.value || 90) - 90) < 0.1;

  if (isRect) {
    const w = L_front;
    const d = L_left;
    const originX = bCx - (w / 2);
    const originY = bCy - (d / 2);
    vertices = [
      { x: originX, y: originY },
      { x: originX + w, y: originY },
      { x: originX + w, y: originY + d },
      { x: originX, y: originY + d }
    ];
  } else {
    const uncentered = SiteGeometryEngine.constructFromSidesAndAngle({
      sideA: L_front,
      sideB: L_right,
      sideC: L_rear,
      sideD: L_left,
      angleA: cornerAngleDeg.value || 90
    });
    if (uncentered && uncentered.length === 4) {
      const uCx = uncentered.reduce((s, p) => s + p.x, 0) / 4;
      const uCy = uncentered.reduce((s, p) => s + p.y, 0) / 4;
      const shiftX = bCx - uCx;
      const shiftY = bCy - uCy;
      vertices = uncentered.map(p => ({ x: Math.round(p.x + shiftX), y: Math.round(p.y + shiftY) }));
    }
  }

  if (!vertices || vertices.length !== 4) {
    validationError.value = 'Invalid 4-sided plot geometry. Check dimensions and corner angle.';
    calculatedPlotAreaSqFt.value = 0;
    calculatedBuildableAreaSqFt.value = 0;
    currentVertices.value = [];
    currentEnvelope.value = [];
    return;
  }

  const validation = SiteGeometryEngine.validateQuadrilateral(vertices);
  if (!validation.valid) {
    validationError.value = validation.error || 'Invalid plot geometry.';
    calculatedPlotAreaSqFt.value = 0;
    calculatedBuildableAreaSqFt.value = 0;
    currentVertices.value = vertices;
    currentEnvelope.value = [];
    return;
  }

  currentVertices.value = vertices;

  const plotArea = SiteGeometryEngine.getArea(vertices);
  calculatedPlotAreaSqFt.value = Math.round(SiteGeometryEngine.units2ToSqFt(plotArea) * 10) / 10;

  if (!enableSetbacks.value) {
    currentEnvelope.value = vertices;
    const envArea = SiteGeometryEngine.getArea(vertices);
    calculatedBuildableAreaSqFt.value = Math.round(SiteGeometryEngine.units2ToSqFt(envArea) * 10) / 10;
  } else {
    const setbacks = {
      front: (setbackFrontFt.value || 0) * FT_TO_UNITS,
      right: (setbackRightFt.value || 0) * FT_TO_UNITS,
      rear: (setbackRearFt.value || 0) * FT_TO_UNITS,
      left: (setbackLeftFt.value || 0) * FT_TO_UNITS
    };

    const envelope = SiteGeometryEngine.computeBuildableEnvelope(vertices, setbacks);
    if (envelope && envelope.length === 4) {
      currentEnvelope.value = envelope;
      const envArea = SiteGeometryEngine.getArea(envelope);
      calculatedBuildableAreaSqFt.value = Math.round(SiteGeometryEngine.units2ToSqFt(envArea) * 10) / 10;
    } else {
      currentEnvelope.value = [];
      calculatedBuildableAreaSqFt.value = 0;
    }
  }
}

// SVG Coordinate Mapping
const svgBounds = computed(() => {
  if (!currentVertices.value || currentVertices.value.length < 3) return null;
  const pts = currentVertices.value;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  pts.forEach(p => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  });
  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);
  return { minX, maxX, minY, maxY, width, height };
});

function toSvgPoint(p, padding = 42, svgW = 320, svgH = 230) {
  const b = svgBounds.value;
  if (!b) return { x: 0, y: 0 };
  const availW = svgW - 2 * padding;
  const availH = svgH - 2 * padding;
  const scale = Math.min(availW / b.width, availH / b.height);
  const cx = padding + (availW - b.width * scale) / 2;
  const cy = padding + (availH - b.height * scale) / 2;
  return {
    x: Math.round(cx + (p.x - b.minX) * scale),
    y: Math.round(cy + (p.y - b.minY) * scale)
  };
}

const plotSvgPoints = computed(() => {
  if (!currentVertices.value || currentVertices.value.length < 3) return '';
  return currentVertices.value.map(p => {
    const sp = toSvgPoint(p);
    return `${sp.x},${sp.y}`;
  }).join(' ');
});

const envelopeSvgPoints = computed(() => {
  if (!currentEnvelope.value || currentEnvelope.value.length < 3) return '';
  return currentEnvelope.value.map(p => {
    const sp = toSvgPoint(p);
    return `${sp.x},${sp.y}`;
  }).join(' ');
});

const envelopeCenter = computed(() => {
  if (!currentEnvelope.value || currentEnvelope.value.length < 3) return null;
  const pts = currentEnvelope.value.map(p => toSvgPoint(p));
  return {
    x: Math.round(pts.reduce((s, p) => s + p.x, 0) / pts.length),
    y: Math.round(pts.reduce((s, p) => s + p.y, 0) / pts.length)
  };
});

const edgeData = computed(() => {
  if (!currentVertices.value || currentVertices.value.length !== 4) return [];
  const pts = currentVertices.value;
  const svgPts = pts.map(p => toSvgPoint(p));
  const cx = svgPts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = svgPts.reduce((s, p) => s + p.y, 0) / 4;
  const lens = [sideFrontFt.value, sideRightFt.value, sideRearFt.value, sideLeftFt.value];
  const names = ['Front', 'Right', 'Rear', 'Left'];

  return svgPts.map((p1, i) => {
    const p2 = svgPts[(i + 1) % 4];
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;

    return {
      name: names[i],
      lengthFt: Math.round((lens[i] || 0) * 10) / 10,
      x1: p1.x, y1: p1.y,
      x2: p2.x, y2: p2.y,
      badgeX: Math.round(mx + ux * 16),
      badgeY: Math.round(my + uy * 16),
      edgeIndex: i
    };
  });
});

// Road band polygon on active road edge
const roadBandPoly = computed(() => {
  const edges = edgeData.value;
  if (!edges || edges.length !== 4) return null;
  const rIdx = roadFrontageIndex.value;
  const e = edges[rIdx];
  if (!e) return null;

  const pts = currentVertices.value.map(p => toSvgPoint(p));
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const mx = (e.x1 + e.x2) / 2;
  const my = (e.y1 + e.y2) / 2;
  const dx = mx - cx;
  const dy = my - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const roadWidth = 22;

  const p1 = { x: e.x1, y: e.y1 };
  const p2 = { x: e.x2, y: e.y2 };
  const p3 = { x: Math.round(e.x2 + ux * roadWidth), y: Math.round(e.y2 + uy * roadWidth) };
  const p4 = { x: Math.round(e.x1 + ux * roadWidth), y: Math.round(e.y1 + uy * roadWidth) };

  return `${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y} ${p4.x},${p4.y}`;
});

const roadCenterline = computed(() => {
  const edges = edgeData.value;
  if (!edges || edges.length !== 4) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  const e = edges[roadFrontageIndex.value];
  if (!e) return { x1: 0, y1: 0, x2: 0, y2: 0 };

  const pts = currentVertices.value.map(p => toSvgPoint(p));
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const mx = (e.x1 + e.x2) / 2;
  const my = (e.y1 + e.y2) / 2;
  const dx = mx - cx;
  const dy = my - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  return {
    x1: Math.round(e.x1 + ux * 11),
    y1: Math.round(e.y1 + uy * 11),
    x2: Math.round(e.x2 + ux * 11),
    y2: Math.round(e.y2 + uy * 11)
  };
});

const roadLabelPos = computed(() => {
  const edges = edgeData.value;
  if (!edges || edges.length !== 4) return { x: 0, y: 0 };
  const e = edges[roadFrontageIndex.value];
  if (!e) return { x: 0, y: 0 };

  const pts = currentVertices.value.map(p => toSvgPoint(p));
  const cx = pts.reduce((s, p) => s + p.x, 0) / 4;
  const cy = pts.reduce((s, p) => s + p.y, 0) / 4;
  const mx = (e.x1 + e.x2) / 2;
  const my = (e.y1 + e.y2) / 2;
  const dx = mx - cx;
  const dy = my - cy;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  return {
    x: Math.round(mx + ux * 11),
    y: Math.round(my + uy * 11)
  };
});

const fitAssessment = computed(() => {
  const bArea = calculatedBuildableAreaSqFt.value;
  const hArea = currentBuildingAreaSqFt.value;
  if (!bArea || bArea <= 0) {
    return {
      class: 'warning',
      icon: '⚠️',
      message: 'Setbacks are too large for this plot. Try reducing setback margins.'
    };
  }
  if (!hArea || hArea <= 0) {
    return {
      class: 'info',
      icon: 'ℹ️',
      message: 'Ready to establish plot boundary. Existing house footprint: 0 sq ft.'
    };
  }
  if (hArea <= bArea) {
    const pct = Math.round((hArea / bArea) * 100);
    return {
      class: 'success',
      icon: '✅',
      message: `House fits inside setback zone! (${pct}% utilization)`
    };
  } else {
    const diff = Math.round((hArea - bArea) * 10) / 10;
    return {
      class: 'warning',
      icon: '⚡',
      message: `House (${hArea} sq ft) exceeds setback zone (${bArea} sq ft) by ${diff} sq ft. Click "Adapt Building to Site" to adjust room spans to fit cleanly!`
    };
  }
});

function open() {
  isOpen.value = true;
  validationError.value = '';

  // Read current building area from planner (inspecting anchors & walls)
  if (props.planner) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

    if (props.planner.anchors && Array.isArray(props.planner.anchors) && props.planner.anchors.length > 0) {
      props.planner.anchors.forEach(a => {
        const pos = typeof a.position === 'function' ? a.position() : a;
        if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
          minX = Math.min(minX, pos.x); maxX = Math.max(maxX, pos.x);
          minY = Math.min(minY, pos.y); maxY = Math.max(maxY, pos.y);
        }
      });
    }

    if (props.planner.walls && Array.isArray(props.planner.walls) && props.planner.walls.length > 0) {
      props.planner.walls.forEach(w => {
        if (w.hidden) return;
        const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
        const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
        if (p1 && typeof p1.x === 'number' && typeof p1.y === 'number') {
          minX = Math.min(minX, p1.x); maxX = Math.max(maxX, p1.x);
          minY = Math.min(minY, p1.y); maxY = Math.max(maxY, p1.y);
        }
        if (p2 && typeof p2.x === 'number' && typeof p2.y === 'number') {
          minX = Math.min(minX, p2.x); maxX = Math.max(maxX, p2.x);
          minY = Math.min(minY, p2.y); maxY = Math.max(maxY, p2.y);
        }
      });
    }

    if (minX !== Infinity && maxX !== -Infinity && maxX > minX && maxY > minY) {
      const w = (maxX - minX);
      const d = (maxY - minY);
      currentBuildingWidthFt.value = Math.round(SiteGeometryEngine.unitsToFt(w) * 10) / 10;
      currentBuildingDepthFt.value = Math.round(SiteGeometryEngine.unitsToFt(d) * 10) / 10;
      currentBuildingAreaSqFt.value = Math.round(SiteGeometryEngine.units2ToSqFt(w * d) * 10) / 10;
    }
  }

  // If site already exists on planner, populate dialog
  if (props.planner?.site?.vertices?.length === 4) {
    const s = props.planner.site;
    const lens = SiteGeometryEngine.getEdgeLengths(s.vertices);
    sideFrontFt.value = Math.round(SiteGeometryEngine.unitsToFt(lens[0]) * 10) / 10;
    sideRightFt.value = Math.round(SiteGeometryEngine.unitsToFt(lens[1]) * 10) / 10;
    sideRearFt.value = Math.round(SiteGeometryEngine.unitsToFt(lens[2]) * 10) / 10;
    sideLeftFt.value = Math.round(SiteGeometryEngine.unitsToFt(lens[3]) * 10) / 10;

    const angles = SiteGeometryEngine.getCornerAngles(s.vertices);
    cornerAngleDeg.value = angles[0] || 90;

    if (s.setbacks === null || s.setbacks === undefined) {
      enableSetbacks.value = false;
    } else {
      enableSetbacks.value = true;
      setbackFrontFt.value = Math.round(SiteGeometryEngine.unitsToFt(s.setbacks.front || 0) * 10) / 10;
      setbackRightFt.value = Math.round(SiteGeometryEngine.unitsToFt(s.setbacks.right || 0) * 10) / 10;
      setbackRearFt.value = Math.round(SiteGeometryEngine.unitsToFt(s.setbacks.rear || 0) * 10) / 10;
      setbackLeftFt.value = Math.round(SiteGeometryEngine.unitsToFt(s.setbacks.left || 0) * 10) / 10;
    }
    roadFrontageIndex.value = s.roadFrontageIndex || 0;
  } else {
    // Default: match building size or default 25' x 30' (750 sq ft)
    if (currentBuildingWidthFt.value > 0 && currentBuildingDepthFt.value > 0) {
      sideFrontFt.value = currentBuildingWidthFt.value;
      sideRearFt.value = currentBuildingWidthFt.value;
      sideLeftFt.value = currentBuildingDepthFt.value;
      sideRightFt.value = currentBuildingDepthFt.value;
    } else {
      sideFrontFt.value = 25.0;
      sideRearFt.value = 25.0;
      sideLeftFt.value = 30.0;
      sideRightFt.value = 30.0;
    }
  }

  const avgW = (sideFrontFt.value + sideRearFt.value) / 2;
  const avgD = (sideLeftFt.value + sideRightFt.value) / 2;
  centerPlotSqFt.value = Math.round(avgW * avgD);

  recalculatePlot();

  // Initialize target house area to buildable footprint or current house area
  if (calculatedBuildableAreaSqFt.value > 0) {
    targetHouseAreaSqFt.value = calculatedBuildableAreaSqFt.value;
  } else if (currentBuildingAreaSqFt.value > 0) {
    targetHouseAreaSqFt.value = currentBuildingAreaSqFt.value;
  }
}

function close() {
  isOpen.value = false;
  emit('close');
}

function getSiteConfig() {
  return {
    vertices: currentVertices.value,
    setbacks: enableSetbacks.value ? {
      front: (setbackFrontFt.value || 0) * FT_TO_UNITS,
      right: (setbackRightFt.value || 0) * FT_TO_UNITS,
      rear: (setbackRearFt.value || 0) * FT_TO_UNITS,
      left: (setbackLeftFt.value || 0) * FT_TO_UNITS
    } : null,
    roadFrontages: [roadFrontageIndex.value],
    roadFrontageIndex: roadFrontageIndex.value
  };
}

function applyBoundaryInternal() {
  if (!currentVertices.value || currentVertices.value.length !== 4 || !props.planner) return false;
  const cfg = getSiteConfig();
  SiteEngine.createSite(props.planner, cfg.vertices, {
    setbacks: cfg.setbacks,
    roadFrontages: cfg.roadFrontages,
    roadFrontageIndex: cfg.roadFrontageIndex
  });
  return true;
}

function handleApplyBoundary() {
  if (!applyBoundaryInternal()) return;
  emit('sync');
  close();
}

function handleAdaptBuilding() {
  if (!currentVertices.value || currentVertices.value.length !== 4 || !props.planner) return;

  const chosenTargetArea = (targetHouseAreaSqFt.value && targetHouseAreaSqFt.value > 0)
    ? targetHouseAreaSqFt.value
    : (calculatedBuildableAreaSqFt.value > 0 ? calculatedBuildableAreaSqFt.value : undefined);

  const siteConfig = getSiteConfig();

  const cmd = new AdaptBuildingToSiteCommand(props.planner, {
    siteConfig,
    targetAreaSqFt: chosenTargetArea,
    preserveAspectRatio: preserveAspectRatio.value !== false,
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

  emit('sync');
  close();
}

function handleClearPlot() {
  if (props.planner) {
    SiteEngine.clearSite(props.planner);
  }
  emit('sync');
  close();
}

defineExpose({ open, close });
</script>

<style scoped>
.site-dialog-modal {
  max-width: 860px;
  width: min(860px, calc(100vw - 24px));
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-sizing: border-box;
  margin: auto;
}

.site-close-btn {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #94a3b8;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
}

.site-close-btn:hover {
  background: #fee2e2;
  color: #ef4444;
}

.site-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.site-modal-icon-badge {
  font-size: 24px;
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #eff6ff;
  border-radius: 10px;
  border: 1px solid #bfdbfe;
  flex-shrink: 0;
}

.site-modal-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 2px 0 0;
}

.site-modal-body-split {
  display: grid;
  grid-template-columns: 1.15fr 0.95fr;
  gap: 20px;
  padding: 18px 24px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  box-sizing: border-box;
}

.site-controls-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.site-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.site-label-bold {
  font-size: 13px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: 0.2px;
}

.section-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.section-hint {
  font-size: 11px;
  color: #64748b;
}

/* Visual Boundary Box (Resize-Plan Style) */
.site-vb-box {
  position: relative;
  height: 220px;
  border: 2px dashed #93c5fd;
  border-radius: 12px;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 18px 24px;
}

.vb-compass-line-v {
  position: absolute;
  top: -10px;
  bottom: -10px;
  left: 50%;
  border-left: 1px dashed #cbd5e1;
  z-index: 1;
  pointer-events: none;
}

.vb-compass-line-h {
  position: absolute;
  left: -10px;
  right: -10px;
  top: 50%;
  border-top: 1px dashed #cbd5e1;
  z-index: 1;
  pointer-events: none;
}

.vb-edge-wrap {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 6px;
  z-index: 5;
}

.vb-edge-wrap.top {
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  flex-direction: column;
}

.vb-edge-wrap.bottom {
  bottom: -18px;
  left: 50%;
  transform: translateX(-50%);
  flex-direction: column;
}

.vb-edge-wrap.left {
  left: -20px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
}

.vb-edge-wrap.right {
  right: -20px;
  top: 50%;
  transform: translateY(-50%);
  flex-direction: column;
}

.vb-edge-chip {
  padding: 3px 8px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.chip-road-icon {
  flex-shrink: 0;
}

.vb-edge-chip:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
}

.vb-edge-chip.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #1d4ed8;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.3);
}

.vb-input-val {
  width: 68px;
  text-align: center;
  padding: 4px 6px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 700;
  border: 2px solid #3b82f6;
  color: #1e3a8a;
  background: #ffffff;
  outline: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.15s ease;
}

.vb-input-val:focus {
  border-color: #1d4ed8;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
}

.vb-center-text {
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  z-index: 4;
}

.vb-sqft-input {
  width: 90px;
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  color: #1e40af;
  border: none;
  background: transparent;
  border-bottom: 2px dashed #3b82f6;
  outline: none;
  transition: border-color 0.15s ease;
}

.vb-sqft-input:focus {
  border-bottom-color: #1d4ed8;
}

.vb-center-sub {
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  margin-top: 3px;
}

.plot-presets {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.corner-angle-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}

.angle-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.angle-toggle-btn:hover {
  color: #1e293b;
}

.angle-badge {
  background: #e2e8f0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  color: #334155;
}

.angle-input-flex {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: #f1f5f9;
  border-radius: 6px;
}

.angle-slider {
  flex: 1;
}

.angle-num-input {
  width: 50px;
  padding: 2px 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}

.site-grid-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

/* Road Facing Buttons */
.road-facing-chips {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.road-chip {
  padding: 8px 4px;
  background: #f8fafc;
  border: 1.5px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.road-chip:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
}

.road-chip.active {
  background: #334155;
  color: #ffffff;
  border-color: #1e293b;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

/* Setback Presets */
.setback-presets {
  display: flex;
  gap: 6px;
}

.preset-pill {
  font-size: 11px;
  padding: 3px 8px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-pill:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.preset-pill.active {
  background: #2563eb;
  color: #ffffff;
  border-color: #1d4ed8;
}

.setback-disabled-note {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
  border-radius: 6px;
  font-size: 12px;
  color: #64748b;
}

/* Right Column: Preview */
.site-preview-col {
  display: flex;
  flex-direction: column;
}

.preview-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 14px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-title {
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
}

.compass-badge {
  display: flex;
  align-items: center;
  gap: 2px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  padding: 2px 8px;
  font-size: 11px;
  font-weight: 700;
  color: #0284c7;
}

.svg-container {
  width: 100%;
  aspect-ratio: 320 / 230;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.plot-svg {
  width: 100%;
  height: 100%;
  display: block;
}

.plot-poly {
  fill: #f8fafc;
  stroke: #3b82f6;
  stroke-width: 2.5;
  stroke-linejoin: round;
}

.envelope-poly {
  fill: rgba(34, 197, 94, 0.12);
  stroke: #16a34a;
  stroke-width: 2;
  stroke-dasharray: 5,4;
  stroke-linejoin: round;
}

.edge-click-line {
  stroke: transparent;
  stroke-width: 12;
  cursor: pointer;
}

.edge-interactive-group:hover .dim-badge-bg {
  stroke: #3b82f6;
  stroke-width: 1.5;
}

.dim-badge-bg {
  fill: #ffffff;
  stroke: #cbd5e1;
  stroke-width: 1;
}

.dim-road-bg {
  fill: #fbbf24;
  stroke: #d97706;
}

.dim-badge-text {
  font-size: 10px;
  font-weight: 700;
  fill: #0f172a;
}

.buildable-label {
  font-size: 10px;
  font-weight: 800;
  fill: #15803d;
  letter-spacing: 0.5px;
}

.preview-legend {
  display: flex;
  justify-content: space-around;
  font-size: 11px;
  color: #64748b;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 5px;
}

.legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.plot-swatch {
  background: #3b82f6;
}

.env-swatch {
  background: #16a34a;
}

.road-swatch {
  background: #334155;
}

/* Metrics Box */
.metrics-summary-box {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 12px;
}

.metric-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.metric-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.metric-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  flex-shrink: 0;
}

.metric-status-dot.green {
  background: #10b981;
  box-shadow: 0 0 6px rgba(16, 185, 129, 0.4);
}

.metric-number {
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.metric-number.text-green {
  color: #16a34a;
}

.fit-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 11px;
  line-height: 1.4;
  font-weight: 600;
  margin-top: 4px;
}

.fit-banner.success {
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  color: #166534;
}

.fit-banner.warning {
  background: #fefce8;
  border: 1px solid #fef08a;
  color: #854d0e;
}

.fit-banner.error {
  background: #fef2f2;
  border: 1px solid #fecaca;
  color: #991b1b;
}

.fit-icon {
  font-size: 14px;
  line-height: 1;
}

/* Target House Adaptation Controls */
.target-adaptation-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px dashed #cbd5e1;
}

.target-row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
}

.bold-title {
  color: #1e293b;
  font-weight: 700;
}

.quick-preset-btns {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.mini-pill {
  padding: 2px 7px;
  font-size: 10px;
  font-weight: 600;
  border-radius: 4px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: all 0.15s ease;
}

.mini-pill:hover {
  background: #f1f5f9;
  border-color: #94a3b8;
  color: #1e293b;
}

.mini-pill.active {
  background: #eff6ff;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.target-input-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.target-input-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  width: 140px;
}

.target-area-input {
  width: 100%;
  padding: 5px 38px 5px 8px;
  font-size: 13px;
  font-weight: 700;
  color: #0f172a;
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  border-radius: 6px;
  outline: none;
  transition: border-color 0.15s ease;
}

.target-area-input:focus {
  border-color: #2563eb;
}

.unit-suffix {
  position: absolute;
  right: 8px;
  font-size: 10px;
  font-weight: 600;
  color: #64748b;
  pointer-events: none;
}

.aspect-ratio-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  cursor: pointer;
  user-select: none;
}

/* Footer */
.site-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 24px;
  border-top: 1px solid #e2e8f0;
}

.action-btn.outline-btn {
  background: #ffffff;
  border: 1.5px solid #cbd5e1;
  color: #1e293b;
  font-weight: 600;
}

.action-btn.outline-btn:hover:not(:disabled) {
  background: #f8fafc;
  border-color: #94a3b8;
}

.action-btn.primary {
  background: #2563eb;
  color: #ffffff;
  font-weight: 700;
}

.action-btn.primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Responsive */
@media (max-width: 768px) {
  .site-dialog-modal {
    width: calc(100vw - 16px);
    max-height: calc(100vh - 20px);
    border-radius: 14px;
  }
  .site-modal-body-split {
    grid-template-columns: 1fr;
    padding: 14px 16px;
    gap: 16px;
  }
  .site-modal-footer {
    padding: 10px 16px;
  }
}

@media (max-width: 640px) {
  .wizard-header {
    padding: 10px 12px;
  }
  .site-title-wrap {
    gap: 8px;
  }
  .site-modal-icon-badge {
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }
  .site-modal-icon-badge svg {
    width: 16px;
    height: 16px;
  }
  .wizard-header h3 {
    font-size: 14px;
  }
  .site-modal-subtitle {
    font-size: 11px;
    line-height: 1.3;
  }
  .site-modal-body-split {
    padding: 10px 12px;
    gap: 12px;
  }
  .section-header-flex {
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    width: 100%;
  }
  .site-label-bold {
    font-size: 12px;
  }
  .plot-presets, .setback-presets {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    width: 100%;
  }
  .preset-pill {
    font-size: 10.5px;
    padding: 3px 7px;
    white-space: normal;
  }
  /* Constrain the visual boundary box so side handles don't stick out off-screen */
  .site-vb-box {
    margin: 18px 36px;
    height: 190px;
  }
  .vb-input-val {
    width: 50px;
    font-size: 11px;
    padding: 2px 4px;
    border-width: 1.5px;
  }
  .vb-edge-chip {
    font-size: 9.5px;
    padding: 2px 5px;
  }
  .vb-sqft-input {
    font-size: 18px;
    width: 70px;
  }
  .vb-center-sub {
    font-size: 10px;
  }
  /* Responsive Grids: 2 columns instead of 4 */
  .site-grid-4 {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .road-facing-chips {
    grid-template-columns: repeat(2, 1fr);
    gap: 6px;
  }
  .control-group label {
    font-size: 11px;
  }
  .settings-input {
    font-size: 12px;
    padding: 5px 8px;
  }
  /* Footer buttons wrap cleanly */
  .site-modal-footer {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 10px 12px;
    justify-content: stretch;
  }
  .site-modal-footer .action-btn {
    flex: 1 1 calc(50% - 6px);
    min-width: 0;
    font-size: 11px;
    padding: 8px 8px;
    justify-content: center;
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }
  .site-modal-footer .action-btn.primary {
    flex-basis: 100%;
  }
}
</style>
