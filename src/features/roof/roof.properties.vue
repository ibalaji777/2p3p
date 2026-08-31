<template>
    <div class="props-panel-inner" v-if="selectedEntity">
        <h4 class="props-subtitle">Roof Properties</h4>
        <div class="control-group" v-if="roofConfig">
            <label>Auto-Placement</label>
            <div style="display: flex; gap: 8px; justify-content: space-between; margin-bottom: 10px;">
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'inner' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'inner' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.autoPlacementMode = 'inner'; $emit('sync-engine')" title="Inner Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><rect x="8" y="8" width="8" height="8"></rect></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'center' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'center' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.autoPlacementMode = 'center'; $emit('sync-engine')" title="Wall Center Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="4 4"></line></svg></button>
                <button style="flex: 1; padding: 6px; display: flex; align-items: center; justify-content: center; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer; transition: all 0.2s;" :style="{ background: roofConfig.autoPlacementMode === 'outer' ? '#e5e7eb' : 'white', borderColor: roofConfig.autoPlacementMode === 'outer' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.autoPlacementMode = 'outer'; $emit('sync-engine')" title="Outer Edge Detection"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"></path></svg></button>
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType !== 'flat'"><label>Pitch (°)</label><div class="input-wrap"><input type="range" v-model.number="roofConfig.pitch" min="0" max="75" @input="$emit('sync-engine')"><input type="number" v-model.number="roofConfig.pitch" @input="$emit('sync-engine')"></div></div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType !== 'flat'"><label>Peak Height</label><div class="input-wrap"><DimensionInput :modelValue="calculateRoofPeakHeight(selectedEntity)" @change="(val) => updateRoofPitchFromHeight({ target: { value: val } }, selectedEntity)" /></div></div>
        
        <div class="control-group" v-if="roofConfig && ['gable', 'shed', 'curved', 'gambrel', 'mansard', 'turret_round', 'turret_octagonal', 'turret_hexagonal'].includes(roofConfig.roofType)">
            <label>Curvature / Arch</label>
            <div class="input-wrap">
                <input type="range" v-model.number="roofConfig.curve" min="-50" max="50" @input="$emit('sync-engine')">
                <span style="font-size: 12px; color: #64748b; font-weight: 600;">{{ (roofConfig.curve || 0) > 0 ? 'Convex +' + roofConfig.curve : ((roofConfig.curve || 0) < 0 ? 'Pagoda ' + roofConfig.curve : 'Flat 0') }}</span>
            </div>
        </div>

        <div class="control-group" v-if="roofConfig && ['gable', 'shed', 'gambrel'].includes(roofConfig.roofType)">
            <label>Slope / Ridge Axis</label>
            <div style="display: flex; gap: 8px;">
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: (roofConfig.ridgeAxis === 'x' || !roofConfig.ridgeAxis) ? '#e5e7eb' : 'white', borderColor: (roofConfig.ridgeAxis === 'x' || !roofConfig.ridgeAxis) ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.ridgeAxis = 'x'; roofConfig.manualRidge = true; $emit('sync-engine')">Horizontal</button>
                <button style="flex: 1; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background: white; cursor: pointer;" :style="{ background: roofConfig.ridgeAxis === 'y' ? '#e5e7eb' : 'white', borderColor: roofConfig.ridgeAxis === 'y' ? '#9ca3af' : '#d1d5db' }" @click="roofConfig.ridgeAxis = 'y'; roofConfig.manualRidge = true; $emit('sync-engine')">Vertical</button>
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'shed'">
            <label>Flip High/Low Side</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="roofConfig.flipSlope" @change="$emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="roofConfig && roofConfig.roofType === 'gable'">
            <label>Auto-Shape Walls</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="roofConfig.autoShapeWalls" @change="$emit('sync-engine')">
            </div>
        </div>
        <div class="control-group" v-if="roofConfig">
            <label>Master Overhang</label>
            <div class="input-wrap">
                <input type="range" v-model.number="roofConfig.overhang" min="0" max="50" @input="roofConfig.overhangs && roofConfig.overhangs.fill(roofConfig.overhang); $emit('sync-engine')">
                <DimensionInput v-model="roofConfig.overhang" @change="roofConfig.overhangs && roofConfig.overhangs.fill(roofConfig.overhang); $emit('sync-engine')" />
            </div>
        </div>
        
        <div v-if="roofConfig && roofConfig.overhangs && roofConfig.overhangs.length > 0">
            <div class="control-group" v-for="(o, index) in roofConfig.overhangs" :key="index" style="margin-left: 10px; opacity: 0.9;">
                <label style="font-size: 11px;">Side {{ index + 1 }} Overhang</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="roofConfig.overhangs[index]" min="0" max="50" @input="$emit('sync-engine')">
                    <DimensionInput v-model="roofConfig.overhangs[index]" @change="$emit('sync-engine')" />
                </div>
            </div>
        </div>

        <div class="control-group" v-if="roofConfig"><label>Elevation Gap</label><div class="input-wrap"><input type="range" v-model.number="roofConfig.wallGap" min="-50" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="roofConfig.wallGap" @change="$emit('sync-engine')" /></div></div>
        
        <div class="decor-gallery" v-if="roofConfig && roofConfig.roofType !== 'flat'">
            <MaterialSizeInput v-model="selectedEntity.tileSize" :defaultMax="200" @change="$emit('sync-engine')" />
            
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
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'full_width' }" @click="sk.coverage = 'full_width'; $emit('sync-engine')" title="Span horizontally across the entire roof width">
                                ↔ Full Width
                            </button>
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'custom' }" @click="sk.coverage = 'custom'; $emit('sync-engine')" title="Custom width and height dimensions">
                                ⤢ Custom Width
                            </button>
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'full_slope' }" @click="sk.coverage = 'full_slope'; $emit('sync-engine')" title="Span vertically from roof ridge to eave">
                                ↕ Full Slope
                            </button>
                            <button class="coverage-btn" :class="{ active: (sk.coverage || 'custom') === 'full_both' }" @click="sk.coverage = 'full_both'; $emit('sync-engine')" title="Fully glaze entire roof slope with glass">
                                ⛶ Full Slope & Width
                            </button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                        <div>
                            <label class="skylight-label">Style</label>
                            <select v-model="sk.type" class="skylight-select" @change="$emit('sync-engine')">
                                <option value="skylight_flush_flat">Flush Glass Inset</option>
                                <option value="skylight_velux_frame">Velux Pivot Frame</option>
                                <option value="skylight_pyramid_dome">Pyramid Glass Lantern</option>
                                <option value="skylight_diamond_lattice">Victorian Diamond</option>
                                <option value="skylight_square_grid_inset">Square Atrium Grid</option>
                            </select>
                        </div>
                        <div>
                            <label class="skylight-label">Glass Finish</label>
                            <select v-model="sk.material" class="skylight-select" @change="$emit('sync-engine')">
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
                        <input type="range" v-model.number="sk.transparency" min="0.10" max="0.99" step="0.02" style="width: 100%;" @input="sk.transmission = sk.transparency; $emit('sync-engine')">
                    </div>

                    <!-- Glass Tint Selector -->
                    <div style="margin-bottom: 6px;">
                        <label class="skylight-label">Glass Tint</label>
                        <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                            <button class="tint-chip" :class="{ active: (sk.tint || '#88ccee') === '#88ccee' }" @click="sk.tint = '#88ccee'; $emit('sync-engine')" style="background: #bae6fd; color: #0369a1; border: 1px solid #7dd3fc;" title="Architectural Sky Blue">Sky Blue</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#ffffff' || sk.tint === '#dbeafe' }" @click="sk.tint = '#dbeafe'; $emit('sync-engine')" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1;" title="Ultra-Clear Float">Clear</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#64748b' }" @click="sk.tint = '#64748b'; $emit('sync-engine')" style="background: #64748b; color: #ffffff; border: 1px solid #475569;" title="Smoked Charcoal">Smoked</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#b45309' }" @click="sk.tint = '#b45309'; $emit('sync-engine')" style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;" title="Solar Bronze">Bronze</button>
                            <button class="tint-chip" :class="{ active: sk.tint === '#047857' }" @click="sk.tint = '#047857'; $emit('sync-engine')" style="background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;" title="Emerald Green">Emerald</button>
                        </div>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                        <div>
                            <label class="skylight-label">Frame Finish</label>
                            <select v-model="sk.frameMaterial" class="skylight-select" @change="$emit('sync-engine')">
                                <option value="metal_dark_steel">Charcoal Steel (#18181b)</option>
                                <option value="bronze">Architectural Bronze</option>
                                <option value="white">Pure White Sash</option>
                            </select>
                        </div>
                        <div>
                            <label class="skylight-label">Glass Finish</label>
                            <select v-model="sk.glassRoughness" class="skylight-select" @change="$emit('sync-engine')">
                                <option :value="0.02">Glossy Clear</option>
                                <option :value="0.25">Satin Reflective</option>
                                <option :value="0.55">Frosted Privacy</option>
                            </select>
                        </div>
                    </div>

                    <div v-if="(sk.coverage || 'custom') !== 'full_both'" style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                        <div v-if="sk.coverage !== 'full_width'">
                            <label class="skylight-label">Width (cm)</label>
                            <input type="number" v-model.number="sk.width" min="30" max="600" step="5" class="skylight-number" @input="$emit('sync-engine')">
                        </div>
                        <div v-if="sk.coverage !== 'full_slope'">
                            <label class="skylight-label">Length (cm)</label>
                            <input type="number" v-model.number="sk.length" min="30" max="600" step="5" class="skylight-number" @input="$emit('sync-engine')">
                        </div>
                    </div>

                    <div v-if="(sk.coverage || 'custom') !== 'full_both'">
                        <label class="skylight-label">Position Along Slope (U: Width / V: Height)</label>
                        <div style="display: flex; gap: 6px; align-items: center;">
                            <input v-if="sk.coverage !== 'full_width'" type="range" v-model.number="sk.u" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Horizontal position along roof width" @input="$emit('sync-engine')">
                            <input v-if="sk.coverage !== 'full_slope'" type="range" v-model.number="sk.v" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Vertical position from ridge to eave" @input="$emit('sync-engine')">
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
                                <select v-model="cr.type" class="skylight-select" @change="$emit('sync-engine')">
                                    <option value="ridge_cresting_victorian_lace">Victorian Lace Iron</option>
                                    <option value="ridge_cresting_gothic_spikes">Gothic Spikes Iron</option>
                                    <option value="ridge_cresting_metal_cap">Modern Standing Seam</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Material / Finish</label>
                                <select v-model="cr.material" class="skylight-select" @change="$emit('sync-engine')">
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
                                <input type="range" v-model.number="cr.height" min="6" max="35" step="1" style="width: 100%;" @input="$emit('sync-engine')">
                            </div>
                            <div v-if="cr.type !== 'ridge_cresting_metal_cap'">
                                <label class="skylight-label">Spacing: {{ cr.spacing || 22 }} cm</label>
                                <input type="range" v-model.number="cr.spacing" min="10" max="40" step="2" style="width: 100%;" @input="$emit('sync-engine')">
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
                                <select v-model="fin.type" class="skylight-select" @change="$emit('sync-engine')">
                                    <option value="finial_victorian_spire">Victorian Iron Spire</option>
                                    <option value="finial_copper_spire">Copper Turret Spire</option>
                                    <option value="finial_globe_orb">Classical Globe Orb</option>
                                    <option value="finial_weather_rooster">Weather Rooster Vane</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Peak Location</label>
                                <select v-model="fin.position" class="skylight-select" @change="$emit('sync-engine')">
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
                                <select v-model="fin.material" class="skylight-select" @change="$emit('sync-engine')">
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
                                <input type="range" v-model.number="fin.scale" min="0.5" max="2.2" step="0.1" style="width: 100%;" @input="$emit('sync-engine')">
                            </div>
                        </div>

                        <div v-if="fin.type === 'finial_weather_rooster'">
                            <label class="skylight-label">Rooster Direction: {{ Math.round(fin.rotation || 35) }}°</label>
                            <input type="range" v-model.number="fin.rotation" min="0" max="360" step="5" style="width: 100%;" @input="$emit('sync-engine')">
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
                                <select v-model="ch.type" class="skylight-select" @change="$emit('sync-engine')">
                                    <option value="chimney_brick_traditional">Traditional Brick Stack</option>
                                    <option value="chimney_stone_tudor">Tudor Ashlar Stone</option>
                                    <option value="chimney_metal_flue">Modern Metal Flue Pipe</option>
                                    <option value="chimney_double_brick">Double Flue Classical</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Shaft Material</label>
                                <select v-model="ch.material" class="skylight-select" @change="$emit('sync-engine')">
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
                                <input type="number" v-model.number="ch.width" min="20" max="150" step="5" class="skylight-number" @input="$emit('sync-engine')">
                            </div>
                            <div>
                                <label class="skylight-label">Depth (cm)</label>
                                <input type="number" v-model.number="ch.depth" min="20" max="150" step="5" class="skylight-number" @input="$emit('sync-engine')">
                            </div>
                            <div>
                                <label class="skylight-label">Height (cm)</label>
                                <input type="number" v-model.number="ch.height" min="40" max="250" step="5" class="skylight-number" @input="$emit('sync-engine')">
                            </div>
                        </div>

                        <div>
                            <label class="skylight-label">Slope Position (U: Horizontal / V: Pitch)</label>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="range" v-model.number="ch.u" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Horizontal position along roof width" @input="$emit('sync-engine')">
                                <input type="range" v-model.number="ch.v" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Position along roof slope" @input="$emit('sync-engine')">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. ATTACHED 3D ROOF DORMERS -->
                <div style="background: rgba(15, 23, 42, 0.02); border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px 10px; margin-bottom: 10px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                        <span style="font-size: 11px; font-weight: 700; color: #1e293b;">🏠 Roof Dormers (Sims 4 Style)</span>
                        <button class="add-skylight-btn" @click="addDormer">+ Add Dormer</button>
                    </div>

                    <div v-if="attachedDormers.length === 0" style="font-size: 11px; color: #94a3b8; font-style: italic; padding: 4px 0;">
                        No dormers on this roof. Click "+ Add Dormer" or use the left sidebar Dormer tool to snap dormers onto roof slopes.
                    </div>

                    <div v-for="(dor, idx) in attachedDormers" :key="dor.id || idx" class="skylight-card" style="margin-bottom: 6px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                            <span style="font-size: 11px; font-weight: 700; color: #0f172a;">Dormer #{{ idx + 1 }}</span>
                            <button class="delete-skylight-btn" @click="removeDormer(idx)" title="Remove Dormer">✕ Remove</button>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Dormer Type</label>
                                <select v-model="dor.type" class="skylight-select" @change="$emit('sync-engine')">
                                    <option value="dormer_gable">Gable (A-Frame)</option>
                                    <option value="dormer_shed">Shed (Slanted)</option>
                                    <option value="dormer_eyebrow">Eyebrow (Wave Arch)</option>
                                    <option value="dormer_hip">Hip (3-Sided)</option>
                                    <option value="dormer_barrel">Barrel Vault</option>
                                </select>
                            </div>
                            <div>
                                <label class="skylight-label">Cheek / Siding Material</label>
                                <select v-model="dor.sidingMaterial" class="skylight-select" @change="$emit('sync-engine')">
                                    <option value="wood_siding">Wood Siding (White)</option>
                                    <option value="white_paint">Clean White Plaster</option>
                                    <option value="cream_siding">Cream Siding</option>
                                    <option value="red_brick">Red Brick</option>
                                    <option value="rough_stone">Rustic Stone</option>
                                    <option value="dark_wood">Dark Wood</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; margin-bottom: 6px;">
                            <div>
                                <label class="skylight-label">Width (cm)</label>
                                <input type="number" v-model.number="dor.width" min="50" max="250" step="5" class="skylight-number" @input="$emit('sync-engine')">
                            </div>
                            <div>
                                <label class="skylight-label">Height (cm)</label>
                                <input type="number" v-model.number="dor.height" min="40" max="180" step="5" class="skylight-number" @input="$emit('sync-engine')">
                            </div>
                            <div>
                                <label class="skylight-label">Depth (cm)</label>
                                <input type="number" v-model.number="dor.depth" min="50" max="250" step="5" class="skylight-number" @input="$emit('sync-engine')">
                            </div>
                        </div>

                        <div>
                            <label class="skylight-label">Slope Position (U: Along Width / V: Up/Down Slope)</label>
                            <div style="display: flex; gap: 6px; align-items: center;">
                                <input type="range" v-model.number="dor.u" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Position along roof width" @input="$emit('sync-engine')">
                                <input type="range" v-model.number="dor.v" min="0.05" max="0.95" step="0.02" style="flex: 1;" title="Position up/down roof slope" @input="$emit('sync-engine')">
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="['gable', 'shed', 'half_hip', 'curved', 'gambrel', 'dutch_gable', 'jerkinhead'].includes(roofConfig.roofType)">
                <h4 class="props-subtitle" style="margin-top: 15px;">Gable Wall Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in wallDecorRegistry" :key="'g'+key" class="decor-item" @click="roofConfig.gableMaterial = key; $emit('sync-engine')" :class="{ active: roofConfig.gableMaterial === key }">
                        <img :src="config.thumbnail || config.texture" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>

        <div class="decor-gallery" v-if="roofConfig && roofConfig.roofType === 'flat'">
            <MaterialSizeInput v-model="selectedEntity.tileSize" :defaultMax="200" @change="$emit('sync-engine')" />
            
            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 10px; margin-bottom: 6px;">
                <h4 class="props-subtitle" style="margin: 0;">Change Material (Roof Texture)</h4>
                <div class="material-filter-chips" style="display: flex; gap: 4px;">
                    <button class="filter-chip" :class="{ active: materialFilter === 'all' }" @click="materialFilter = 'all'">All</button>
                    <button class="filter-chip" :class="{ active: materialFilter === 'tiles' }" @click="materialFilter = 'tiles'">Tiles</button>
                    <button class="filter-chip" :class="{ active: materialFilter === 'glass' }" @click="materialFilter = 'glass'">🪟 Glass</button>
                </div>
            </div>
            <div class="decor-grid">
                <div v-for="(config, key) in filteredRoofDecor" :key="key" class="decor-item" @click="() => { selectedEntity.configId = key; if (roofConfig) roofConfig.material = key; $emit('sync-engine'); }" :class="{ active: (selectedEntity.configId === key || roofConfig.material === key) }">
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

const roofConfig = computed(() => {
    if (!props.selectedEntity) return null;
    if (props.selectedEntity.config) return props.selectedEntity.config;
    return props.selectedEntity;
});

const attachedSkylights = computed(() => {
    if (!roofConfig.value) return [];
    if (!Array.isArray(roofConfig.value.skylights)) {
        roofConfig.value.skylights = [];
    }
    return roofConfig.value.skylights;
});

const attachedCrestings = computed(() => {
    if (!roofConfig.value) return [];
    if (!Array.isArray(roofConfig.value.crestings)) {
        roofConfig.value.crestings = [];
    }
    return roofConfig.value.crestings;
});

const attachedFinials = computed(() => {
    if (!roofConfig.value) return [];
    if (!Array.isArray(roofConfig.value.finials)) {
        roofConfig.value.finials = [];
    }
    return roofConfig.value.finials;
});

const attachedChimneys = computed(() => {
    if (!roofConfig.value) return [];
    if (!Array.isArray(roofConfig.value.chimneys)) {
        roofConfig.value.chimneys = [];
    }
    return roofConfig.value.chimneys;
});

const attachedDormers = computed(() => {
    if (!roofConfig.value) return [];
    if (!Array.isArray(roofConfig.value.dormers)) {
        roofConfig.value.dormers = [];
    }
    return roofConfig.value.dormers;
});

const addCresting = () => {
    if (!roofConfig.value) return;
    roofConfig.value.crestings = roofConfig.value.crestings || [];
    roofConfig.value.crestings.push({
        id: `crest_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        type: 'ridge_cresting_victorian_lace',
        material: 'metal_wrought_iron',
        height: 18,
        spacing: 22,
        segmentIndex: 0
    });
    emit('sync-engine');
};

const removeCresting = (idx) => {
    if (!roofConfig.value || !roofConfig.value.crestings) return;
    roofConfig.value.crestings.splice(idx, 1);
    emit('sync-engine');
};

const addFinial = () => {
    if (!roofConfig.value) return;
    roofConfig.value.finials = roofConfig.value.finials || [];
    roofConfig.value.finials.push({
        id: `fin_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        type: 'finial_victorian_spire',
        material: 'metal_wrought_iron',
        height: 45,
        scale: 1.0,
        position: 'both_apexes'
    });
    emit('sync-engine');
};

const removeFinial = (idx) => {
    if (!roofConfig.value || !roofConfig.value.finials) return;
    roofConfig.value.finials.splice(idx, 1);
    emit('sync-engine');
};

const addChimney = () => {
    if (!roofConfig.value) return;
    roofConfig.value.chimneys = roofConfig.value.chimneys || [];
    roofConfig.value.chimneys.push({
        id: `chim_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        type: 'chimney_brick_traditional',
        material: 'red_brick',
        capMaterial: 'limestone',
        potMaterial: 'terracotta_clay',
        width: 45,
        depth: 45,
        height: 90,
        u: 0.75,
        v: 0.75
    });
    emit('sync-engine');
};

const removeChimney = (idx) => {
    if (!roofConfig.value || !roofConfig.value.chimneys) return;
    roofConfig.value.chimneys.splice(idx, 1);
    emit('sync-engine');
};

const addDormer = () => {
    if (!roofConfig.value) return;
    roofConfig.value.dormers = roofConfig.value.dormers || [];
    roofConfig.value.dormers.push({
        id: `dor_${Date.now()}_${Math.floor(Math.random()*1000)}`,
        type: 'dormer_gable',
        sidingMaterial: 'wood_siding',
        trimMaterial: 'white_paint',
        roofMaterial: roofConfig.value.material || 'dark_slate',
        width: 100,
        height: 85,
        depth: 120,
        pitch: 35,
        u: 0.5,
        v: 0.35
    });
    emit('sync-engine');
};

const removeDormer = (idx) => {
    if (!roofConfig.value || !roofConfig.value.dormers) return;
    roofConfig.value.dormers.splice(idx, 1);
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
        roofConfig.value.slopes = roofConfig.value.slopes || {
            slope1: roofConfig.value.material || 'terracotta_tiles_roof',
            slope2: roofConfig.value.material || 'terracotta_tiles_roof'
        };
    } else {
        delete roofConfig.value.slopes;
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

const addSkylight = () => {
    if (!roofConfig.value) return;
    roofConfig.value.skylights = roofConfig.value.skylights || [];
    roofConfig.value.skylights.push({
        id: `sky_${Date.now()}_${Math.floor(Math.random()*1000)}`,
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
    if (!roofConfig.value || !roofConfig.value.skylights) return;
    roofConfig.value.skylights.splice(idx, 1);
    emit('sync-engine');
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
