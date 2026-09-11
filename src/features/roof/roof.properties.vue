<template>
    <div class="props-panel-inner" v-if="selectedEntity">
        <h4 class="props-subtitle">Roof Properties</h4>
        <div class="control-group" v-if="roofConfig">
            <label>Auto-Placement</label>
            <div style="display: flex; gap: 8px; justify-content: space-between; margin-bottom: 10px;">
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'inner' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'inner' ? '#9ca3af' : '#d1d5db' }" @click="setAutoPlacementMode('inner')" title="Inner Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="8" y="8" width="8" height="8"></rect></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'center' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'center' ? '#9ca3af' : '#d1d5db' }" @click="setAutoPlacementMode('center')" title="Wall Center Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="4 4"></line></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'outer' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'outer' ? '#9ca3af' : '#d1d5db' }" @click="setAutoPlacementMode('outer')" title="Outer Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></button>
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'flat'">
            <label>Slab Thickness</label>
            <div class="input-wrap">
                <input type="range" :value="roofConfig.thickness !== undefined ? roofConfig.thickness : 15" min="2" max="60" @input="updateThickness($event.target.value)">
                <DimensionInput :modelValue="roofConfig.thickness !== undefined ? roofConfig.thickness : 15" @change="updateThickness($event)" />
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType !== 'flat'"><label>Pitch (°)</label><div class="input-wrap"><input type="range" :value="roofConfig.pitch" min="0" max="75" @input="updatePitch($event.target.value)"><input type="number" :value="roofConfig.pitch" min="0" max="75" @input="updatePitch($event.target.value)"></div></div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType !== 'flat'"><label>Peak Height</label><div class="input-wrap"><DimensionInput :modelValue="calculateRoofPeakHeight(selectedEntity)" @change="(val) => updateRoofPitchFromHeight({ target: { value: val } }, selectedEntity)" /></div></div>
        
        <div class="control-group" v-if="roofConfig && ['gable', 'shed', 'curved', 'gambrel', 'mansard', 'turret_round', 'turret_octagonal', 'turret_hexagonal'].includes(roofConfig.roofType)">
            <label>Curvature / Arch</label>
            <div class="input-wrap">
                <input type="range" :value="roofConfig.curve || 0" min="-50" max="50" @input="updateCurve($event.target.value)">
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">{{ (roofConfig.curve || 0) > 0 ? 'Convex +' + roofConfig.curve : ((roofConfig.curve || 0) < 0 ? 'Pagoda ' + roofConfig.curve : 'Flat 0') }}</span>
            </div>
        </div>

        <div class="control-group" v-if="roofConfig && ['gable', 'shed', 'gambrel'].includes(roofConfig.roofType)">
            <label>Slope / Ridge Axis</label>
            <div style="display: flex; gap: 8px;">
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: (roofConfig.ridgeAxis === 'x' || !roofConfig.ridgeAxis) ? '#e5e7eb' : 'white', borderColor: (roofConfig.ridgeAxis === 'x' || !roofConfig.ridgeAxis) ? '#9ca3af' : '#d1d5db' }" @click="updateRidgeAxis('x')">Horizontal</button>
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: roofConfig.ridgeAxis === 'y' ? '#e5e7eb' : 'white', borderColor: roofConfig.ridgeAxis === 'y' ? '#9ca3af' : '#d1d5db' }" @click="updateRidgeAxis('y')">Vertical</button>
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'shed'">
            <label>Flip High/Low Side</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" :checked="!!roofConfig.flipSlope" @change="updateFlipSlope($event.target.checked)">
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'gable'">
            <label>Auto-Shape Walls</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" :checked="!!roofConfig.autoShapeWalls" @change="updateAutoShapeWalls($event.target.checked)">
            </div>
        </div>
        <div class="control-group" v-if="roofConfig">
            <label>Master Overhang</label>
            <div class="input-wrap">
                <input type="range" :value="roofConfig.overhang !== undefined ? roofConfig.overhang : 8" min="0" max="50" @input="updateMasterOverhang($event.target.value)">
                <DimensionInput :modelValue="roofConfig.overhang !== undefined ? roofConfig.overhang : 8" @change="updateMasterOverhang($event)" />
            </div>
        </div>
        
        <div v-if="roofConfig && roofConfig.overhangs && roofConfig.overhangs.length > 0">
            <div class="control-group" v-for="(o, index) in roofConfig.overhangs" :key="index" style="margin-left: 10px; opacity: 0.9;">
                <label style="font-size: 11px;">Side {{ index + 1 }} Overhang</label>
                <div class="input-wrap">
                    <input type="range" :value="o" min="0" max="50" @input="updateSideOverhang(index, $event.target.value)">
                    <DimensionInput :modelValue="o" @change="updateSideOverhang(index, $event)" />
                </div>
            </div>
        </div>

        <div class="control-group" v-if="roofConfig"><label>Elevation Gap</label><div class="input-wrap"><input type="range" :value="roofConfig.wallGap || 0" min="-50" max="100" @input="updateWallGap($event.target.value)"><DimensionInput :modelValue="roofConfig.wallGap || 0" @change="updateWallGap($event)" /></div></div>
        
        <div class="decor-gallery" v-if="roofConfig && roofConfig.roofType !== 'flat'">
            <MaterialSizeInput :modelValue="selectedEntity.tileSize || selectedEntity.config?.tileSize || 100" :defaultMax="200" @change="updateTileSize($event)" />
            
            <!-- Sims 4 Paint Scope & Per-Slope Toggle -->
            <div style="background: rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-top: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Painting Mode</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="scope-chip" :class="{ active: paintScopeMode === 'single' }" @click="paintScopeMode = 'single'" title="Paint only this selected roof">Single Roof</button>
                        <button class="scope-chip" :class="{ active: paintScopeMode === 'all' }" @click="paintScopeMode = 'all'" title="Paint all roofs on the building (Sims 4 Shift+Click)">All Roofs ⚡</button>
                    </div>
                </div>

                <div v-if="['gable', 'curved', 'shed', 'hip', 'half_hip', 'dutch_gable', 'jerkinhead', 'gambrel', 'mansard'].includes(roofConfig.roofType)" style="border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 6px;">
                    <div style="display: flex; align-items: center; justify-content: space-between;">
                        <label style="font-size: 11px; font-weight: 600; color: #475569; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                            <input type="checkbox" v-model="enablePerSlope" @change="handlePerSlopeToggle">
                            Customize Individual Slopes
                        </label>
                        <span v-if="enablePerSlope" style="font-size: 10px; font-weight: 700; color: #0284c7; background: #e0f2fe; padding: 2px 6px; border-radius: 10px;">Per-Slope Active</span>
                    </div>

                    <div v-if="enablePerSlope" style="display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap;">
                        <template v-if="['gable', 'curved', 'shed'].includes(roofConfig.roofType)">
                            <button class="slope-select-btn" :class="{ active: activeSlopeKey === 'slope1' }" @click="activeSlopeKey = 'slope1'">
                                Slope 1 ({{ (roofConfig.ridgeAxis === 'y') ? 'West' : 'North' }})
                                <span class="slope-mat-indicator" :title="getSlopeMatName('slope1')">{{ getSlopeMatName('slope1') }}</span>
                            </button>
                            <button class="slope-select-btn" :class="{ active: activeSlopeKey === 'slope2' }" @click="activeSlopeKey = 'slope2'">
                                Slope 2 ({{ (roofConfig.ridgeAxis === 'y') ? 'East' : 'South' }})
                                <span class="slope-mat-indicator" :title="getSlopeMatName('slope2')">{{ getSlopeMatName('slope2') }}</span>
                            </button>
                        </template>
                        <template v-else>
                            <button class="slope-select-btn" :class="{ active: activeSlopeKey === 'north' }" @click="activeSlopeKey = 'north'">North</button>
                            <button class="slope-select-btn" :class="{ active: activeSlopeKey === 'south' }" @click="activeSlopeKey = 'south'">South</button>
                            <button class="slope-select-btn" :class="{ active: activeSlopeKey === 'west' }" @click="activeSlopeKey = 'west'">West</button>
                            <button class="slope-select-btn" :class="{ active: activeSlopeKey === 'east' }" @click="activeSlopeKey = 'east'">East</button>
                        </template>
                    </div>
                </div>
            </div>
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; margin-bottom: 6px;">
                <h4 class="props-subtitle" style="margin: 0;">
                    {{ enablePerSlope ? `Select Material for ${activeSlopeLabel}` : 'Roof Material' }}
                </h4>
                <div class="material-filter-chips" style="display: flex; gap: 4px;">
                    <button class="filter-chip" :class="{ active: materialFilter === 'all' }" @click="materialFilter = 'all'">All</button>
                    <button class="filter-chip" :class="{ active: materialFilter === 'tiles' }" @click="materialFilter = 'tiles'">Tiles</button>
                    <button class="filter-chip" :class="{ active: materialFilter === 'glass' }" @click="materialFilter = 'glass'">🪟 Glass</button>
                </div>
            </div>
            <div class="decor-grid">
                <div v-for="(config, key) in filteredRoofDecor" :key="key" class="decor-item" @click="handleMaterialClick(key)" :class="{ active: isMaterialActive(key) }">
                    <img :src="config.thumbnail || config.texture" />
                    <span>{{ config.name }}</span>
                    <span v-if="config.isGlass" class="glass-pill-tag">Glass</span>
                </div>
            </div>

            <!-- Attached Skylights Manager -->
            <div style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                    <h4 class="props-subtitle" style="margin: 0; display: flex; align-items: center; gap: 6px;">
                        <span>🪟 Embedded 3D Skylights</span>
                        <span v-if="attachedSkylights.length" class="skylight-count-badge">{{ attachedSkylights.length }}</span>
                    </h4>
                    <button class="add-skylight-btn" @click="addSkylight">+ Add Skylight</button>
                </div>

                <div v-if="attachedSkylights.length === 0" style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 6px 0;">
                    No skylights on this roof. Click "+ Add Skylight" to insert framed glass roof windows.
                </div>

                <div v-for="(sk, idx) in attachedSkylights" :key="sk.id || idx" class="skylight-card">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: #0f172a;">Glass Inset #{{ idx + 1 }}</span>
                        <button class="delete-skylight-btn" @click="removeSkylight(idx)" title="Remove Skylight">✕ Remove</button>
                    </div>

                    <!-- Coverage Quick Selector matching user request -->
                    <div style="margin-bottom: 8px;">
                        <label class="skylight-label">Coverage Mode</label>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'full_width' }" @click="updateSkylight(sk, { coverage: 'full_width' })" title="Span horizontally across the entire roof width">
                                ↔ Full Width
                            </button>
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'custom' }" @click="updateSkylight(sk, { coverage: 'custom' })" title="Custom width and height dimensions">
                                ⤢ Custom Width
                            </button>
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'full_slope' }" @click="updateSkylight(sk, { coverage: 'full_slope' })" title="Span vertically from roof ridge to eave">
                                ↕ Full Slope
                            </button>
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'full_both' }" @click="updateSkylight(sk, { coverage: 'full_both' })" title="Fully glaze entire roof slope with glass">
                                ⛶ Full Slope & Width
                            </button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                        <div>
                            <label class="skylight-label">Style</label>
                            <select :value="sk.type" class="skylight-select" @change="updateSkylight(sk, { type: $event.target.value })">
                                <option value="skylight_flush_flat">Flush Glass Inset</option>
                                <option value="skylight_velux_frame">Velux Pivot Frame</option>
                                <option value="skylight_pyramid_dome">Pyramid Glass Lantern</option>
                                <option value="skylight_diamond_lattice">Victorian Diamond</option>
                                <option value="skylight_square_grid_inset">Square Atrium Grid</option>
                            </select>
                        </div>
                        <div>
                            <label class="skylight-label">Glass Finish</label>
                            <select :value="sk.material" class="skylight-select" @change="updateSkylight(sk, { material: $event.target.value })">
                                <option value="glass_roof_square_grid">Square Grid Glass</option>
                                <option value="glass_roof_diamond_lattice">Diamond Lattice</option>
                                <option value="glass_roof_hexagonal_honeycomb">Hex Honeycomb</option>
                                <option value="glass_roof_solid_clear">Clear Float Glass</option>
                            </select>
                        </div>
                    </div>

                    <!-- Glass Transparency Slider -->
                    <div style="margin-top: 4px; margin-bottom: 6px; background: rgba(2, 132, 199, 0.04); border: 1px solid #e0f2fe; border-radius: 6px; padding: 6px 8px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 3px;">
                            <label class="skylight-label" style="margin: 0; color: #0369a1; font-weight: 700;">Glass Transparency</label>
                            <span style="font-size: 11px; font-weight: 700; color: #0284c7;">{{ Math.round((sk.transparency !== undefined ? sk.transparency : (sk.transmission !== undefined ? sk.transmission : 0.92)) * 100) }}%</span>
                        </div>
                        <input type="range" :value="sk.transparency !== undefined ? sk.transparency : (sk.transmission !== undefined ? sk.transmission : 0.92)" min="0.10" max="0.99" step="0.02" style="width: 100%;" @input="updateSkylight(sk, { transparency: Number($event.target.value), transmission: Number($event.target.value) })">
                    </div>

                    <!-- Glass Tint Selector -->
                    <div style="margin-bottom: 6px;">
                        <label class="skylight-label">Glass Tint</label>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            <button class="tint-chip" :class="{ active: (sk.tint || '#88ccee') === '#88ccee' }" @click="updateSkylight(sk, { tint: '#88ccee' })" style="background: #bae6fd; color: #0369a1; border: 1px solid #7dd3fc;" title="Architectural Sky Blue">Sky Blue</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#ffffff' || sk.tint === '#dbeafe' }" @click="updateSkylight(sk, { tint: '#dbeafe' })" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;" title="Ultra-Clear Float">Clear</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#64748b' }" @click="updateSkylight(sk, { tint: '#64748b' })" style="background: #64748b; color: #ffffff; border: 1px solid #475569;" title="Smoked Charcoal">Smoked</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#b45309' }" @click="updateSkylight(sk, { tint: '#b45309' })" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;" title="Solar Bronze">Bronze</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#047857' }" @click="updateSkylight(sk, { tint: '#047857' })" style="background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;" title="Emerald Green">Emerald</button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                        <div>
                            <label class="skylight-label">Frame Finish</label>
                            <select :value="sk.frameMaterial" class="skylight-select" @change="updateSkylight(sk, { frameMaterial: $event.target.value })">
                                <option value="metal_dark_steel">Charcoal Steel (#18181b)</option>
                                <option value="bronze">Architectural Bronze</option>
                                <option value="white">Pure White Sash</option>
                            </select>
                        </div>
                        <div>
                            <label class="skylight-label">Glass Finish</label>
                            <select :value="sk.glassRoughness" class="skylight-select" @change="updateSkylight(sk, { glassRoughness: Number($event.target.value) })">
                                <option :value="0.02">Glossy Clear</option>
                                <option :value="0.25">Satin Reflective</option>
                                <option :value="0.55">Frosted Privacy</option>
                            </select>
                        </div>
                    </div>

                    <div v-if="(sk.coverage || 'custom') !== 'full_both'" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                        <div v-if="sk.coverage !== 'full_width'">
                            <label class="skylight-label">Width (cm)</label>
                            <input type="number" :value="sk.width" min="30" max="600" step="5" class="skylight-number" @input="updateSkylight(sk, { width: Number($event.target.value) })">
                        </div>
                        <div v-if="sk.coverage !== 'full_slope'">
                            <label class="skylight-label">Length (cm)</label>
                            <input type="number" :value="sk.length" min="30" max="600" step="5" class="skylight-number" @input="updateSkylight(sk, { length: Number($event.target.value) })">
                        </div>
                    </div>

                    <div v-if="(sk.coverage || 'custom') !== 'full_both'">
                        <label class="skylight-label">Position Along Slope (U: Width / V: Height)</label>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <input v-if="sk.coverage !== 'full_width'" type="range" :value="sk.u !== undefined ? sk.u : 0.5" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Horizontal position along roof width" @input="updateSkylight(sk, { u: Number($event.target.value) })">
                            <input v-if="sk.coverage !== 'full_slope'" type="range" :value="sk.v !== undefined ? sk.v : 0.5" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Vertical position from ridge to eave" @input="updateSkylight(sk, { v: Number($event.target.value) })">
                        </div>
                    </div>
                </div>
            </div>

            <!-- Sims 4 Roof Sculptures & Ridge Decor Manager -->
            <div style="margin-top: 18px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
                <h4 class="props-subtitle" style="margin: 0 0 10px 0; display: flex; align-items: center; justify-content: space-between;">
                    <span style="display: flex; align-items: center; gap: 6px;">
                        <span>🏷️ Roof Sculptures & Ridge Decor</span>
                    </span>
                </h4>

                <!-- 1. WROUGHT IRON RIDGE CRESTING -->
                <div style="background: rgba(15, 23, 42, 0.02); border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: #1e293b;">⚡ Ridge Cresting (Ironwork / Caps)</span>
                        <button class="add-skylight-btn" @click="addCresting">+ Add Cresting</button>
                    </div>

                    <div v-if="attachedCrestings.length === 0" style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 4px 0;">
                        No ridge cresting attached. Click "+ Add Cresting" to run iron lace or metal caps along the ridge.
                    </div>

                    <div v-for="(cr, idx) in attachedCrestings" :key="cr.id || idx" class="skylight-card" style="margin-bottom: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 11px; font-weight: 700; color: #0f172a;">Ridge Strip #{{ idx + 1 }}</span>
                            <button class="delete-skylight-btn" @click="removeCresting(idx)" title="Remove Cresting">✕ Remove</button>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Style</label>
                                <select :value="cr.type" class="skylight-select" @change="updateCresting(cr, { type: $event.target.value })">
                                    <option value="ridge_cresting_victorian_lace">Victorian Lace Iron</option>
                                    <option value="ridge_cresting_gothic_spikes">Gothic Spikes Iron</option>
                                    <option value="ridge_cresting_metal_cap">Modern Standing Seam</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Material / Finish</label>
                                <select :value="cr.material" class="skylight-select" @change="updateCresting(cr, { material: $event.target.value })">
                                    <option value="metal_wrought_iron">Wrought Iron Black</option>
                                    <option value="metal_dark_steel">Charcoal Steel</option>
                                    <option value="metal_bronze">Victorian Bronze</option>
                                    <option value="galvanized_steel">Galvanized Zinc</option>
                                    <option value="copper">Aged Copper</option>
                                    <option value="white_paint">Painted White</option>
                                    <option value="antique_gold">Antique Gold</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
                            <div>
                                <label class="skylight-label">Height: {{ cr.height || (cr.type === 'ridge_cresting_metal_cap' ? 8 : 18) }} cm</label>
                                <input type="range" :value="cr.height || (cr.type === 'ridge_cresting_metal_cap' ? 8 : 18)" min="6" max="35" step="1" style="width: 100%;" @input="updateCresting(cr, { height: Number($event.target.value) })">
                            </div>
                            <div v-if="cr.type !== 'ridge_cresting_metal_cap'">
                                <label class="skylight-label">Spacing: {{ cr.spacing || 22 }} cm</label>
                                <input type="range" :value="cr.spacing || 22" min="10" max="40" step="2" style="width: 100%;" @input="updateCresting(cr, { spacing: Number($event.target.value) })">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. APEX FINIALS & WEATHER VANES -->
                <div style="background: rgba(15, 23, 42, 0.02); border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: #1e293b;">🧭 Apex Finials & Weather Vanes</span>
                        <button class="add-skylight-btn" @click="addFinial">+ Add Finial</button>
                    </div>

                    <div v-if="attachedFinials.length === 0" style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 4px 0;">
                        No finials attached. Click "+ Add Finial" to mount spires, globes, or rooster vanes on roof peaks.
                    </div>

                    <div v-for="(fin, idx) in attachedFinials" :key="fin.id || idx" class="skylight-card" style="margin-bottom: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 11px; font-weight: 700; color: #0f172a;">Apex Ornament #{{ idx + 1 }}</span>
                            <button class="delete-skylight-btn" @click="removeFinial(idx)" title="Remove Finial">✕ Remove</button>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Style</label>
                                <select :value="fin.type" class="skylight-select" @change="updateFinial(fin, { type: $event.target.value })">
                                    <option value="finial_victorian_spire">Victorian Iron Spire</option>
                                    <option value="finial_copper_spire">Copper Turret Spire</option>
                                    <option value="finial_globe_orb">Classical Globe Orb</option>
                                    <option value="finial_weather_rooster">Weather Rooster Vane</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Peak Location</label>
                                <select :value="fin.position" class="skylight-select" @change="updateFinial(fin, { position: $event.target.value })">
                                    <option value="both_apexes">Both Peak Ends</option>
                                    <option value="start_apex">West / North Peak</option>
                                    <option value="end_apex">East / South Peak</option>
                                    <option value="center_apex">Center / Turret Peak</option>
                                    <option value="all_apexes">All Apex Corners</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Finish</label>
                                <select :value="fin.material" class="skylight-select" @change="updateFinial(fin, { material: $event.target.value })">
                                    <option value="metal_wrought_iron">Wrought Iron Black</option>
                                    <option value="copper">Aged Patina Copper</option>
                                    <option value="limestone">Carved Limestone</option>
                                    <option value="metal_bronze">Victorian Bronze</option>
                                    <option value="galvanized_steel">Galvanized Steel</option>
                                    <option value="antique_gold">Antique Gold</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Scale: {{ Math.round((fin.scale || 1.0) * 100) }}%</label>
                                <input type="range" :value="fin.scale || 1.0" min="0.5" max="2.2" step="0.1" style="width: 100%;" @input="updateFinial(fin, { scale: Number($event.target.value) })">
                            </div>
                        </div>

                        <div v-if="fin.type === 'finial_weather_rooster'">
                            <label class="skylight-label">Rooster Direction: {{ Math.round(fin.rotation || 35) }}°</label>
                            <input type="range" :value="fin.rotation || 35" min="0" max="360" step="5" style="width: 100%;" @input="updateFinial(fin, { rotation: Number($event.target.value) })">
                        </div>
                    </div>
                </div>

                <!-- 3. CHIMNEY STACKS -->
                <div style="background: rgba(15, 23, 42, 0.02); border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: #1e293b;">🧱 Chimney Stacks (Slope Snap)</span>
                        <button class="add-skylight-btn" @click="addChimney">+ Add Chimney</button>
                    </div>

                    <div v-if="attachedChimneys.length === 0" style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 4px 0;">
                        No chimney stacks on this roof. Click "+ Add Chimney" to place brick/stone stacks or metal flues.
                    </div>

                    <div v-for="(ch, idx) in attachedChimneys" :key="ch.id || idx" class="skylight-card" style="margin-bottom: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 11px; font-weight: 700; color: #0f172a;">Chimney Stack #{{ idx + 1 }}</span>
                            <button class="delete-skylight-btn" @click="removeChimney(idx)" title="Remove Chimney">✕ Remove</button>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Style</label>
                                <select :value="ch.type" class="skylight-select" @change="updateChimney(ch, { type: $event.target.value })">
                                    <option value="chimney_brick_traditional">Traditional Brick Stack</option>
                                    <option value="chimney_stone_tudor">Tudor Ashlar Stone</option>
                                    <option value="chimney_metal_flue">Modern Metal Flue Pipe</option>
                                    <option value="chimney_double_brick">Double Flue Classical</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Shaft Material</label>
                                <select :value="ch.material" class="skylight-select" @change="updateChimney(ch, { material: $event.target.value })">
                                    <option value="red_brick">Red Brick</option>
                                    <option value="rough_stone">Rustic Stone</option>
                                    <option value="white_brick">White Brick</option>
                                    <option value="metal_dark_steel">Matte Dark Steel</option>
                                    <option value="dark_slate">Dark Slate</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Width (cm)</label>
                                <input type="number" :value="ch.width" min="20" max="150" step="5" class="skylight-number" @input="updateChimney(ch, { width: Number($event.target.value) })">
                            </div>
                            <div>
                                <label class="skylight-label">Depth (cm)</label>
                                <input type="number" :value="ch.depth" min="20" max="150" step="5" class="skylight-number" @input="updateChimney(ch, { depth: Number($event.target.value) })">
                            </div>
                            <div>
                                <label class="skylight-label">Height (cm)</label>
                                <input type="number" :value="ch.height" min="40" max="250" step="5" class="skylight-number" @input="updateChimney(ch, { height: Number($event.target.value) })">
                            </div>
                        </div>

                        <div>
                            <label class="skylight-label">Slope Position (U: Horizontal / V: Pitch)</label>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="range" :value="ch.u !== undefined ? ch.u : 0.5" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Horizontal position along roof width" @input="updateChimney(ch, { u: Number($event.target.value) })">
                                <input type="range" :value="ch.v !== undefined ? ch.v : 0.5" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Position along roof slope" @input="updateChimney(ch, { v: Number($event.target.value) })">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="['gable', 'shed', 'half_hip', 'curved', 'gambrel', 'dutch_gable', 'jerkinhead'].includes(roofConfig.roofType)">
                <h4 class="props-subtitle" style="margin-top: 15px;">Gable Wall Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in wallDecorRegistry" :key="'g'+key" class="decor-item" @click="updateGableMaterial(key)" :class="{ active: roofConfig.gableMaterial === key }">
                        <img :src="config.thumbnail || config.texture" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="decor-gallery" v-if="roofConfig && roofConfig.roofType === 'flat'">
            <MaterialSizeInput :modelValue="selectedEntity.tileSize || selectedEntity.config?.tileSize || 100" :defaultMax="200" @change="updateTileSize($event)" />
            
            <div style="background: rgba(15, 23, 42, 0.04); border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; margin-top: 12px; margin-bottom: 12px;">
                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                    <span style="font-size: 12px; font-weight: 700; color: #1e293b;">Target Surface</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="scope-chip" :class="{ active: flatTargetSlot === 'fascia' }" @click="flatTargetSlot = 'fascia'" title="Perimeter wall-band / fascia slab sides">Perimeter Sides (Wall)</button>
                        <button class="scope-chip" :class="{ active: flatTargetSlot === 'top' }" @click="flatTargetSlot = 'top'" title="Top terrace slab surface">Terrace Top</button>
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px dashed #cbd5e1; padding-top: 8px; margin-top: 6px;">
                    <span style="font-size: 11px; font-weight: 600; color: #475569;">Category</span>
                    <div style="display: flex; gap: 4px;">
                        <button class="filter-chip" :class="{ active: flatCategory === 'wall' }" @click="flatCategory = 'wall'">🧱 Wall Finishes</button>
                        <button class="filter-chip" :class="{ active: flatCategory === 'roof' }" @click="flatCategory = 'roof'">Tiles & Roof</button>
                        <button class="filter-chip" :class="{ active: flatCategory === 'all' }" @click="flatCategory = 'all'">All</button>
                    </div>
                </div>
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; margin-bottom: 6px;">
                <h4 class="props-subtitle" style="margin: 0;">
                    {{ flatTargetSlot === 'fascia' ? 'Perimeter Wall Band Material' : 'Terrace Top Surface Material' }}
                </h4>
            </div>
            <div class="decor-grid">
                <div v-for="(config, key) in filteredFlatMaterials" :key="key" class="decor-item" @click="handleFlatMaterialClick(key)" :class="{ active: isFlatMaterialActive(key) }">
                    <img :src="config.thumbnail || config.texture" />
                    <span>{{ config.name }}</span>
                    <span v-if="config.isGlass" class="glass-pill-tag">Glass</span>
                </div>
            </div>
        </div>

        <button class="hud-delete" @click="$emit('delete-entity')">Delete Roof</button>
    </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import DimensionInput from '../../components/common/DimensionInput.vue';
import MaterialSizeInput from '../../components/common/MaterialSizeInput.vue';
import { RoofEngine } from '../../core/roof/index.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    roofDecorRegistry: { type: Object, required: true },
    wallDecorRegistry: { type: Object, required: true },
    calculateRoofPeakHeight: { type: Function, required: true },
    updateRoofPitchFromHeight: { type: Function, required: true }
});

const materialFilter = ref('all');
const paintScopeMode = ref('single');
const enablePerSlope = ref(Boolean(props.selectedEntity?.config?.slopes && Object.keys(props.selectedEntity.config.slopes).length > 0));
const activeSlopeKey = ref('slope1');
const flatTargetSlot = ref('fascia');
const flatCategory = ref('wall');

const roofConfig = computed(() => {
    if (!props.selectedEntity) return null;
    if (props.selectedEntity.config) return props.selectedEntity.config;
    return props.selectedEntity;
});

const attachedSkylights = computed(() => {
    if (!roofConfig.value || !Array.isArray(roofConfig.value.skylights)) return [];
    return roofConfig.value.skylights;
});

const attachedCrestings = computed(() => {
    if (!roofConfig.value || !Array.isArray(roofConfig.value.crestings)) return [];
    return roofConfig.value.crestings;
});

const attachedFinials = computed(() => {
    if (!roofConfig.value || !Array.isArray(roofConfig.value.finials)) return [];
    return roofConfig.value.finials;
});

const attachedChimneys = computed(() => {
    if (!roofConfig.value || !Array.isArray(roofConfig.value.chimneys)) return [];
    return roofConfig.value.chimneys;
});

const setAutoPlacementMode = (mode) => {
    RoofEngine.setAutoPlacementMode(props.selectedEntity, mode);
    emit('sync-engine');
};

const updateThickness = (val) => {
    RoofEngine.setThickness(props.selectedEntity, val);
    emit('sync-engine');
};

const updatePitch = (val) => {
    RoofEngine.setPitch(props.selectedEntity, val);
    emit('sync-engine');
};

const updateCurve = (val) => {
    RoofEngine.setCurve(props.selectedEntity, val);
    emit('sync-engine');
};

const updateRidgeAxis = (axis) => {
    RoofEngine.setRidgeAxis(props.selectedEntity, axis, null, true);
    emit('sync-engine');
};

const updateFlipSlope = (checked) => {
    RoofEngine.setFlipSlope(props.selectedEntity, checked);
    emit('sync-engine');
};

const updateAutoShapeWalls = (checked) => {
    RoofEngine.setAutoShapeWalls(props.selectedEntity, checked);
    emit('sync-engine');
};

const updateMasterOverhang = (val) => {
    RoofEngine.setOverhang(props.selectedEntity, val);
    emit('sync-engine');
};

const updateSideOverhang = (index, val) => {
    RoofEngine.setOverhang(props.selectedEntity, val, index);
    emit('sync-engine');
};

const updateWallGap = (val) => {
    RoofEngine.setWallGap(props.selectedEntity, val);
    emit('sync-engine');
};

const updateTileSize = (val) => {
    RoofEngine.setTileSize(props.selectedEntity, val);
    emit('sync-engine');
};

const updateGableMaterial = (key) => {
    RoofEngine.setMaterial(props.selectedEntity, key, 'gable', 'gable');
    emit('sync-engine');
};

const filteredFlatMaterials = computed(() => {
    if (flatCategory.value === 'wall') {
        return props.wallDecorRegistry || {};
    }
    if (flatCategory.value === 'roof') {
        return filteredRoofDecor.value || {};
    }
    return Object.assign({}, props.wallDecorRegistry, filteredRoofDecor.value);
});

const isFlatMaterialActive = (key) => {
    if (flatTargetSlot.value === 'fascia') {
        const cur = roofConfig.value?.fasciaMaterial || 'white_plaster_wall';
        return cur === key;
    } else {
        const cur = props.selectedEntity?.configId || roofConfig.value?.material || 'white_plaster_wall';
        return cur === key;
    }
};

const handleFlatMaterialClick = (key) => {
    const slot = flatTargetSlot.value;
    if (slot === 'fascia') {
        RoofEngine.setMaterial(props.selectedEntity, key, 'fascia', 'fascia');
    } else {
        RoofEngine.setMaterial(props.selectedEntity, key, 'single', null);
    }
    emit('sync-engine');
};

const updateSkylight = (sk, params) => {
    RoofEngine.updateAddon(props.selectedEntity, 'skylight', sk.id || sk, params);
    emit('sync-engine');
};

const addSkylight = () => {
    RoofEngine.addSkylight(props.selectedEntity, {
        type: 'skylight_velux_frame',
        material: 'glass_roof_square_grid',
        frameMaterial: 'metal_dark_steel',
        width: 80,
        length: 120,
        depth: 10,
        u: 0.5,
        v: 0.5
    });
    emit('sync-engine');
};

const removeSkylight = (idx) => {
    RoofEngine.removeSkylight(props.selectedEntity, idx);
    emit('sync-engine');
};

const updateCresting = (cr, params) => {
    RoofEngine.updateAddon(props.selectedEntity, 'cresting', cr.id || cr, params);
    emit('sync-engine');
};

const addCresting = () => {
    RoofEngine.addCresting(props.selectedEntity, {
        type: 'ridge_cresting_victorian_lace',
        material: 'metal_wrought_iron',
        height: 18,
        spacing: 22
    });
    emit('sync-engine');
};

const removeCresting = (idx) => {
    RoofEngine.removeCresting(props.selectedEntity, idx);
    emit('sync-engine');
};

const updateFinial = (fin, params) => {
    RoofEngine.updateAddon(props.selectedEntity, 'finial', fin.id || fin, params);
    emit('sync-engine');
};

const addFinial = () => {
    RoofEngine.addFinial(props.selectedEntity, {
        type: 'finial_victorian_spire',
        position: 'both_apexes',
        material: 'metal_wrought_iron',
        scale: 1.0
    });
    emit('sync-engine');
};

const removeFinial = (idx) => {
    RoofEngine.removeFinial(props.selectedEntity, idx);
    emit('sync-engine');
};

const updateChimney = (ch, params) => {
    RoofEngine.updateAddon(props.selectedEntity, 'chimney', ch.id || ch, params);
    emit('sync-engine');
};

const addChimney = () => {
    RoofEngine.addChimney(props.selectedEntity, {
        type: 'chimney_brick_traditional',
        material: 'red_brick',
        width: 60,
        depth: 60,
        height: 120,
        u: 0.75,
        v: 0.75
    });
    emit('sync-engine');
};

const removeChimney = (idx) => {
    RoofEngine.removeChimney(props.selectedEntity, idx);
    emit('sync-engine');
};

const activeSlopeLabel = computed(() => {
    if (['gable', 'curved', 'shed'].includes(roofConfig.value?.roofType)) {
        return activeSlopeKey.value === 'slope1' ? 'Slope 1' : 'Slope 2';
    }
    return activeSlopeKey.value.toUpperCase();
});

const getSlopeMatName = (slope) => {
    const sl = roofConfig.value?.slopes;
    const key = sl?.[slope] || roofConfig.value?.material || 'Default';
    return props.roofDecorRegistry?.[key]?.name || key;
};

const handlePerSlopeToggle = () => {
    if (!roofConfig.value) return;
    if (enablePerSlope.value) {
        const initialSlopes = roofConfig.value.slopes || {
            slope1: roofConfig.value.material || 'terracotta_tiles_roof',
            slope2: roofConfig.value.material || 'terracotta_tiles_roof'
        };
        RoofEngine.batchUpdate(props.selectedEntity, { slopes: initialSlopes });
    } else {
        RoofEngine.batchUpdate(props.selectedEntity, { slopes: null });
    }
    emit('sync-engine');
};

const isMaterialActive = (key) => {
    if (!roofConfig.value) return false;
    if (enablePerSlope.value && roofConfig.value.slopes) {
        return roofConfig.value.slopes[activeSlopeKey.value] === key;
    }
    return roofConfig.value.material === key;
};

const handleMaterialClick = (key) => {
    if (enablePerSlope.value && paintScopeMode.value !== 'all') {
        emit('set-roof-material', key, 'single', activeSlopeKey.value);
    } else {
        emit('set-roof-material', key, paintScopeMode.value);
    }
};

const filteredRoofDecor = computed(() => {
    if (!props.roofDecorRegistry) return {};
    if (materialFilter.value === 'glass') {
        const out = {};
        for (const [k, v] of Object.entries(props.roofDecorRegistry)) {
            if (v.isGlass || v.category === 'glass' || k.startsWith('glass_roof_')) {
                out[k] = v;
            }
        }
        return out;
    }
    if (materialFilter.value === 'tiles') {
        const out = {};
        for (const [k, v] of Object.entries(props.roofDecorRegistry)) {
            if (!v.isGlass && v.category !== 'glass' && !k.startsWith('glass_roof_')) {
                out[k] = v;
            }
        }
        return out;
    }
    return props.roofDecorRegistry;
});

const emit = defineEmits([
    'sync-engine',
    'set-roof-material',
    'delete-entity'
]);
</script>

<style scoped>
.scope-chip {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
}
.scope-chip:hover {
    background: #f1f5f9;
}
.scope-chip.active {
    background: #6366f1;
    color: #ffffff;
    border-color: #6366f1;
    box-shadow: 0 1px 3px rgba(99, 102, 241, 0.3);
}
.slope-select-btn {
    flex: 1;
    padding: 5px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #334155;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    transition: all 0.15s ease;
}
.slope-select-btn:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}
.slope-select-btn.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
    box-shadow: 0 0 0 1px #3b82f6;
}
.slope-mat-indicator {
    font-size: 9px;
    color: #64748b;
    font-weight: 500;
    max-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.add-skylight-btn {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 6px;
    background: #0284c7;
    color: #ffffff;
    border: none;
    cursor: pointer;
    transition: all 0.15s ease;
}
.add-skylight-btn:hover {
    background: #0369a1;
}
.skylight-count-badge {
    background: #0284c7;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
}
.skylight-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 8px;
    margin-bottom: 8px;
}
.skylight-label {
    font-size: 10px;
    font-weight: 600;
    color: #64748b;
    display: block;
    margin-bottom: 2px;
}
.skylight-select, .skylight-number {
    width: 100%;
    padding: 3px 6px;
    font-size: 11px;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    background: #ffffff;
    color: #1e293b;
}
.coverage-btn {
    padding: 5px 6px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 5px;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    text-align: center;
    transition: all 0.15s ease;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.coverage-btn:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
}
.coverage-btn.active {
    background: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
    box-shadow: 0 1px 3px rgba(2, 132, 199, 0.35);
}
.delete-skylight-btn {
    background: transparent;
    border: none;
    color: #ef4444;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
}
.delete-skylight-btn:hover {
    background: #fee2e2;
}
.filter-chip {
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 500;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
    background: #f8fafc;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s ease;
}
.filter-chip:hover {
    background: #e2e8f0;
    color: #1e293b;
}
.filter-chip.active {
    background: #0284c7;
    color: #ffffff;
    border-color: #0284c7;
}
.glass-pill-tag {
    position: absolute;
    top: 3px;
    right: 3px;
    font-size: 9px;
    font-weight: 700;
    background: rgba(14, 165, 233, 0.85);
    color: #ffffff;
    padding: 1px 4px;
    border-radius: 4px;
    letter-spacing: 0.3px;
    pointer-events: none;
}
.decor-item {
    position: relative;
}
.tint-chip {
    padding: 3px 8px;
    font-size: 10px;
    font-weight: 600;
    border-radius: 10px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.tint-chip.active {
    box-shadow: 0 0 0 2px #0284c7;
    font-weight: 700;
}
</style>
