<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Elevation Segment</h4>

        <!-- 3D Tool Mode Switcher -->
        <div class="control-group" style="margin-bottom: 12px; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 8px 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
                <label style="font-weight: 700; color: #38bdf8; font-size: 11px; margin: 0;">3D Tool Mode</label>
                <span style="font-size: 10px; color: #94a3b8;">Active Gizmo</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(6, 1fr); gap: 3px;">
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentGizmoMode === 'extrude' || currentGizmoMode === 'stretch' || currentGizmoMode === 'sprout' }"
                        @click="setGizmoMode('extrude')" 
                        style="padding: 5px 1px; font-size: 10px;">
                    ⇥ Extrude
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentGizmoMode === 'perp' }"
                        @click="setGizmoMode('perp')" 
                        style="padding: 5px 1px; font-size: 10px;">
                    ⟂ Perp
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentGizmoMode === 'corners' }"
                        @click="setGizmoMode('corners')" 
                        style="padding: 5px 1px; font-size: 10px;">
                    📐 Corners
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentGizmoMode === 'angle' || currentGizmoMode === 'rotate' }"
                        @click="setGizmoMode('angle')" 
                        style="padding: 5px 1px; font-size: 10px;">
                    ⭮ Angle
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentGizmoMode === 'dims' }"
                        @click="setGizmoMode('dims')" 
                        style="padding: 5px 1px; font-size: 10px;">
                    📏 Dims
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentGizmoMode === 'all' }"
                        @click="setGizmoMode('all')" 
                        style="padding: 5px 1px; font-size: 10px;">
                    🌐 All
                </button>
            </div>
        </div>

        <!-- Segment Arm Inspector (Independent Arms) -->
        <div v-if="numArms > 1" class="control-group" style="margin-bottom: 12px; background: rgba(30, 41, 59, 0.4); border: 1px solid rgba(56, 189, 248, 0.2); border-radius: 8px; padding: 6px 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 5px;">
                <label style="font-weight: 700; color: #38bdf8; font-size: 11px; margin: 0;">Select Arm to Edit</label>
                <span style="font-size: 10px; color: #94a3b8;">Arm {{ activeArmIndex + 1 }} of {{ numArms }}</span>
            </div>
            <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 2px;">
                <button v-for="a in numArms" :key="a"
                        type="button"
                        class="btn-secondary"
                        :class="{ active: activeArmIndex === (a - 1) }"
                        @click="selectArm(a - 1)"
                        style="padding: 4px 8px; font-size: 11px; font-weight: 700; white-space: nowrap;">
                    Arm {{ a }}
                </button>
            </div>
        </div>

        <!-- Arm Length (Independent) -->
        <div class="control-group" v-if="numArms > 1">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="font-weight: 700; color: #fbbf24;">Arm {{ activeArmIndex + 1 }} Length</label>
                <span style="font-size: 10px; color: #94a3b8;">{{ Math.round(armLength) }} cm</span>
            </div>
            <div class="input-wrap">
                <input type="range" v-model.number="armLength" min="20" max="600" step="5">
                <DimensionInput v-model="armLength" />
            </div>
        </div>

        <!-- Width (Drop) -->
        <div class="control-group">
            <label>{{ numArms > 1 ? `Arm ${activeArmIndex + 1} Thickness (Beam Drop)` : 'Thickness (Beam Drop)' }}</label>
            <div class="input-wrap">
                <input type="range" v-model.number="armWidth" min="15" max="250" step="5">
                <DimensionInput v-model="armWidth" />
            </div>
        </div>

        <!-- Depth (Overhang) -->
        <div class="control-group">
            <label>{{ numArms > 1 ? `Arm ${activeArmIndex + 1} Depth (Overhang)` : 'Depth (Overhang)' }}</label>
            <div class="input-wrap">
                <input type="range" v-model.number="armDepth" min="10" max="200" step="5">
                <DimensionInput v-model="armDepth" />
            </div>
        </div>

        <!-- Beam Elevation Height -->
        <div class="control-group">
            <label>Elevation Height (Y)</label>
            <div class="input-wrap">
                <input type="range" v-model.number="currentElevation" min="0" max="400" step="5" @input="updateElevation">
                <DimensionInput v-model="currentElevation" @change="updateElevation" />
            </div>
            <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
                <button type="button" class="btn-xs" @click="setElevationPreset(0)">Floor (0)</button>
                <button type="button" class="btn-xs" @click="setElevationPreset(80)">Sill (80)</button>
                <button type="button" class="btn-xs" @click="setElevationPreset(90)">Mid (90)</button>
                <button type="button" class="btn-xs" @click="setElevationPreset(210)">Lintel (210)</button>
                <button type="button" class="btn-xs" @click="setElevationPreset(270)">Ceiling (270)</button>
            </div>
        </div>

        <!-- Wall-Plane Arm Angle & Perpendicular Snap -->
        <div class="control-group">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="font-weight: 700; color: #38bdf8;">
                    {{ numArms > 1 ? `Arm ${activeArmIndex + 1} Angle (⭮)` : 'Wall-Plane Rotation (⭮)' }}
                </label>
                <span style="font-size: 10px; color: #a855f7; font-weight: 800;">{{ Math.round(armAngle) }}°</span>
            </div>
            <div class="input-wrap">
                <input type="range" v-model.number="armAngle" min="0" max="360" step="5">
                <DimensionInput v-model="armAngle" />
            </div>
            <div style="display: flex; gap: 4px; margin-top: 6px; flex-wrap: wrap;">
                <button type="button" class="btn-xs" @click="setArmAnglePreset(0)">0° Horiz</button>
                <button type="button" class="btn-xs" @click="setArmAnglePreset(45)">45° Diag</button>
                <button type="button" class="btn-xs" @click="setArmAnglePreset(90)">90° Vert</button>
                <button type="button" class="btn-xs" @click="setArmAnglePreset(180)">⇄ 180°</button>
                <button type="button" class="btn-xs" @click="setArmAnglePreset(270)">270°</button>
                <button type="button" class="btn-xs" @click="setArmPerpendicular" style="border-color: #38bdf8; color: #38bdf8; font-weight: 700;">
                    ⟂ Snap 90° Perp
                </button>
            </div>
        </div>

        <!-- Material Selection -->
        <div class="control-group">
            <label>Architectural Material</label>
            <select v-model="selectedEntity.material" @change="updateSegment" class="settings-select">
                <option v-for="(mat, key) in ELEVATION_SEGMENT_MATERIALS" :key="key" :value="key">
                    {{ mat.name }}
                </option>
            </select>
        </div>

        <!-- Under-Soffit Spotlights -->
        <div class="control-group">
            <label>Under-Soffit Lighting</label>
            <div class="input-wrap" style="display: flex; align-items: center; gap: 8px;">
                <input type="checkbox" id="seg-spotlights-check" v-model="selectedEntity.hasSpotlights" @change="updateSegment" style="width: auto;">
                <label for="seg-spotlights-check" style="cursor: pointer; font-size: 11px;">Enable Recessed Downlights</label>
            </div>
        </div>

        <div class="control-group" v-if="selectedEntity.hasSpotlights">
            <label>Downlight Spacing</label>
            <div class="input-wrap">
                <input type="range" v-model.number="selectedEntity.spotlightSpacing" min="40" max="200" step="10" @input="updateSegment">
                <DimensionInput v-model="selectedEntity.spotlightSpacing" @change="updateSegment" />
            </div>
        </div>

        <!-- Bend / Corner Controls -->
        <div class="control-group" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px;">
            <label style="font-weight: 700; color: #38bdf8;">
                Corner & Bend Inspector (Node {{ activeNodeIndex >= 0 ? activeNodeIndex + 1 : 'Selected' }})
            </label>

            <div style="display: flex; gap: 4px; margin-top: 6px;">
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: !currentNode?.cornerStyle || currentNode?.cornerStyle === 'sharp' }"
                        @click="setCorner('sharp')" 
                        style="flex: 1; padding: 6px 2px; font-size: 10px;">
                    📐 Sharp Miter
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentNode?.cornerStyle === 'fillet' }"
                        @click="setCorner('fillet')" 
                        style="flex: 1; padding: 6px 2px; font-size: 10px;">
                    ⚪ Curved Fillet
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: currentNode?.cornerStyle === 'bevel' || currentNode?.cornerStyle === 'chamfer' }"
                        @click="setCorner('bevel')" 
                        style="flex: 1; padding: 6px 2px; font-size: 10px;">
                    ◢ Diagonal Bevel
                </button>
            </div>

            <div v-if="currentNode?.cornerStyle === 'fillet'" style="margin-top: 8px;">
                <label style="font-size: 11px; color: #94a3b8;">Fillet Radius</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="currentRadius" min="5" max="100" step="5" @input="updateRadius">
                    <DimensionInput v-model="currentRadius" @change="updateRadius" />
                </div>
            </div>

            <div v-if="currentNode?.cornerStyle === 'bevel' || currentNode?.cornerStyle === 'chamfer'" style="margin-top: 8px;">
                <label style="font-size: 11px; color: #94a3b8;">Diagonal Chamfer Cut Distance</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="currentRadius" min="5" max="100" step="5" @input="updateRadius">
                    <DimensionInput v-model="currentRadius" @change="updateRadius" />
                </div>
            </div>

            <!-- Split at Selected Node (Independent Editing) -->
            <div v-if="activeNodeIndex >= 1 && activeNodeIndex < ((selectedEntity.points?.length || 0) - 1)" style="margin-top: 10px;">
                <button type="button" 
                        class="btn-secondary" 
                        @click="onSplitNode" 
                        style="width: 100%; padding: 6px; font-size: 11px; border: 1px solid rgba(168, 85, 247, 0.5); color: #d8b4fe; background: rgba(168, 85, 247, 0.15); display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700;">
                    <span>✂️ Split into 2 Segments at Node {{ activeNodeIndex + 1 }}</span>
                </button>
            </div>
        </div>

        <!-- Complex Corner Presets (Phase 2) -->
        <div class="control-group" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="font-weight: 700; color: #38bdf8;">Corner Presets</label>
                <span style="font-size: 10px; color: #94a3b8;">1-Click Shapes</span>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px;">
                <button type="button" class="btn-secondary" @click="applyCornerPreset('square_90', { direction: 'up' })" style="padding: 6px 4px; font-size: 10px;">
                    ┌ 90° Square (Up)
                </button>
                <button type="button" class="btn-secondary" @click="applyCornerPreset('square_90', { direction: 'down' })" style="padding: 6px 4px; font-size: 10px;">
                    └ 90° Square (Down)
                </button>
                <button type="button" class="btn-secondary" @click="applyCornerPreset('diagonal_45', { direction: 'up' })" style="padding: 6px 4px; font-size: 10px;">
                    ◢ 45° Chamfer (Up)
                </button>
                <button type="button" class="btn-secondary" @click="applyCornerPreset('diagonal_45', { direction: 'down' })" style="padding: 6px 4px; font-size: 10px;">
                    ◣ 45° Chamfer (Down)
                </button>
                <button type="button" class="btn-secondary" @click="applyCornerPreset('v_angle', { angleDeg: 60 })" style="padding: 6px 4px; font-size: 10px;">
                    ✓ 60° V-Corner
                </button>
                <button type="button" class="btn-secondary" @click="applyCornerPreset('v_angle', { angleDeg: 120 })" style="padding: 6px 4px; font-size: 10px;">
                    ⌿ 120° Wide Angle
                </button>
            </div>
        </div>

        <!-- Auto-Join Adjacent Segments (Phase 2) -->
        <div class="control-group" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="font-weight: 700; color: #10b981;">🔗 Auto-Join Adjacent Segments</label>
                <span v-if="nearbySegments.length > 0" style="font-size: 10px; color: #10b981; font-weight: 700;">
                    {{ nearbySegments.length }} nearby (≤45cm)
                </span>
                <span v-else style="font-size: 10px; color: #94a3b8;">None within 45cm</span>
            </div>

            <div v-if="nearbySegments.length > 0" style="margin-top: 6px;">
                <div v-for="(item, idx) in nearbySegments" :key="idx" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; padding: 6px 8px; margin-bottom: 6px; display: flex; align-items: center; justify-content: space-between;">
                    <div style="font-size: 11px; color: #f8fafc;">
                        <span>Adjacent Beam</span>
                        <span style="color: #10b981; margin-left: 6px; font-weight: 700;">{{ item.distance }}cm away</span>
                    </div>
                    <button type="button" 
                            class="btn-primary" 
                            @click="onAutoJoin(item.segment)" 
                            style="padding: 4px 8px; font-size: 10px; background: #10b981; font-weight: 700;">
                        🔗 Join Together
                    </button>
                </div>
            </div>
            <div v-else style="background: rgba(15, 23, 42, 0.4); border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 6px 8px; margin-top: 6px; font-size: 10px; color: #94a3b8; text-align: center;">
                Place or stretch endpoints within 45cm of another beam to auto-join.
            </div>
        </div>

        <!-- Sprout New Segment Actions (6 Directions & Perpendicular) -->
        <div class="control-group" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px;">
            <label style="font-weight: 700; color: #10b981;">+ Sprout Connected Segment</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 6px;">
                <button type="button" class="btn-primary" @click="sprout('up')" style="padding: 6px; font-size: 11px;">
                    ↑ Sprout Up
                </button>
                <button type="button" class="btn-primary" @click="sprout('down')" style="padding: 6px; font-size: 11px;">
                    ↓ Sprout Down
                </button>
                <button type="button" class="btn-secondary" @click="sprout('left')" style="padding: 6px; font-size: 11px;">
                    ← Sprout Left
                </button>
                <button type="button" class="btn-secondary" @click="sprout('right')" style="padding: 6px; font-size: 11px;">
                    → Sprout Right
                </button>
                <button type="button" class="btn-secondary" @click="sprout('away_wall')" style="padding: 6px; font-size: 11px; border-color: #06b6d4; color: #06b6d4;">
                    ↗ Out (Away Wall)
                </button>
                <button type="button" class="btn-secondary" @click="sprout('toward_wall')" style="padding: 6px; font-size: 11px; border-color: #f43f5e; color: #f43f5e;">
                    ↙ In (Toward Wall)
                </button>
            </div>
            <div style="margin-top: 6px;">
                <button type="button" class="btn-secondary" @click="sprout('perp')" style="width: 100%; padding: 6px; font-size: 11px; border-color: #38bdf8; color: #38bdf8; font-weight: 700;">
                    ⟂ Sprout 90° Perpendicular
                </button>
            </div>
        </div>

        <!-- Wall-to-Wall Extension & Wrap Studio -->
        <div class="control-group" style="margin-top: 14px; border-top: 1px solid rgba(255,255,255,0.12); padding-top: 10px;">
            <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="font-weight: 700; color: #00f0ff; font-size: 12px;">↳ Wall-to-Wall Extension Studio</label>
                <span style="font-size: 10px; color: #94a3b8;">Multi-Wall L-Bends</span>
            </div>

            <!-- Active Endpoint Selector (Start vs End) with Live Arrow References -->
            <div style="display: flex; gap: 4px; margin-top: 8px;">
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: wrapEndpointIndex === 'start' }"
                        @click="wrapEndpointIndex = 'start'" 
                        style="flex: 1; padding: 6px 4px; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span>◄ Start (Point 1)</span>
                    <span v-if="startCornerStatus?.hasConnectedWall" style="font-size: 9px; padding: 1px 4px; border-radius: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700;">
                        {{ startCornerStatus.turnArrow }} Corner
                    </span>
                </button>
                <button type="button" 
                        class="btn-secondary" 
                        :class="{ active: wrapEndpointIndex === 'end' }"
                        @click="wrapEndpointIndex = 'end'" 
                        style="flex: 1; padding: 6px 4px; font-size: 11px; display: flex; align-items: center; justify-content: center; gap: 4px;">
                    <span>End (Point {{ selectedEntity.points?.length || 2 }}) ►</span>
                    <span v-if="endCornerStatus?.hasConnectedWall" style="font-size: 9px; padding: 1px 4px; border-radius: 4px; background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-weight: 700;">
                        {{ endCornerStatus.turnArrow }} Corner
                    </span>
                </button>
            </div>

            <!-- Visual Turn Arrow Reference Card -->
            <div v-if="cornerStatus?.hasConnectedWall" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9)); border: 1.5px solid #0284c7; border-radius: 8px; padding: 8px 10px; margin-top: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <!-- Vibrant Direction Arrow Badge -->
                    <div style="width: 38px; height: 38px; border-radius: 8px; background: rgba(2, 132, 199, 0.25); border: 2px solid #38bdf8; display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 900; color: #38bdf8; flex-shrink: 0; box-shadow: 0 0 12px rgba(56, 189, 248, 0.4);">
                        {{ cornerStatus.turnArrow }}
                    </div>
                    <!-- Reference Details -->
                    <div style="display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0;">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <span style="color: #38bdf8; font-weight: 700; font-size: 12px; letter-spacing: 0.3px;">
                                {{ cornerStatus.turnLabel }}
                            </span>
                            <span style="font-size: 10px; color: #94a3b8;">
                                {{ cornerStatus.distToCorner }}cm to corner
                            </span>
                        </div>
                        <!-- Wall to Wall Flow -->
                        <div style="display: flex; align-items: center; gap: 4px; font-size: 11px; color: #f8fafc; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            <span style="color: #cbd5e1;">{{ cornerStatus.hostWall?.name || 'Current Wall' }}</span>
                            <span style="color: #38bdf8; font-weight: 900;">{{ cornerStatus.turnArrow }}</span>
                            <span style="color: #10b981;">{{ cornerStatus.adjWall?.name || 'Adjacent Wall' }}</span>
                        </div>
                    </div>
                    <!-- Quick Snap Button -->
                    <button type="button" 
                            class="btn-secondary" 
                            @click="onSnapToCorner" 
                            title="Snap endpoint flush with corner anchor"
                            style="padding: 4px 8px; font-size: 10px; border-color: #38bdf8; color: #38bdf8; white-space: nowrap; height: fit-content; font-weight: 700;">
                        📍 Snap Flush
                    </button>
                </div>
            </div>

            <div v-else style="background: rgba(15, 23, 42, 0.5); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 8px 10px; margin-top: 8px; font-size: 11px; color: #94a3b8; display: flex; align-items: center; gap: 6px;">
                <span>⚪</span> No connected adjacent wall near this endpoint
            </div>

            <!-- Extension Mode (Custom Distance / Full Wall / All Walls) -->
            <div style="margin-top: 10px;">
                <label style="font-size: 11px; color: #94a3b8; font-weight: 600;">Extension Mode</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; margin-top: 4px;">
                    <button type="button" 
                            class="btn-secondary" 
                            :class="{ active: wrapMode === 'distance' }"
                            @click="wrapMode = 'distance'" 
                            style="padding: 5px 2px; font-size: 10px;">
                        📏 Distance
                    </button>
                    <button type="button" 
                            class="btn-secondary" 
                            :class="{ active: wrapMode === 'fullWall' }"
                            @click="wrapMode = 'fullWall'" 
                            style="padding: 5px 2px; font-size: 10px;">
                        ⇥ Full Wall
                    </button>
                    <button type="button" 
                            class="btn-secondary" 
                            :class="{ active: wrapMode === 'allWalls' }"
                            @click="wrapMode = 'allWalls'" 
                            style="padding: 5px 2px; font-size: 10px;">
                        🌐 All Walls
                    </button>
                </div>
            </div>

            <!-- Distance Slider & Input (visible in distance mode) -->
            <div v-if="wrapMode === 'distance'" style="margin-top: 8px;">
                <label style="font-size: 11px; color: #94a3b8;">Wrap Arm Length</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="wrapDistance" min="20" max="400" step="10">
                    <DimensionInput v-model="wrapDistance" />
                </div>
            </div>

            <!-- Corner Style for this Turn -->
            <div style="margin-top: 10px;">
                <label style="font-size: 11px; color: #94a3b8; font-weight: 600;">Corner Geometry for this Turn</label>
                <div style="display: flex; gap: 4px; margin-top: 4px;">
                    <button type="button" 
                            class="btn-secondary" 
                            :class="{ active: wrapCornerStyle === 'sharp' }"
                            @click="wrapCornerStyle = 'sharp'" 
                            style="flex: 1; padding: 5px; font-size: 10px;">
                        📐 Sharp 45°
                    </button>
                    <button type="button" 
                            class="btn-secondary" 
                            :class="{ active: wrapCornerStyle === 'fillet' }"
                            @click="wrapCornerStyle = 'fillet'" 
                            style="flex: 1; padding: 5px; font-size: 10px;">
                        ⚪ Curved Fillet
                    </button>
                </div>
            </div>

            <div v-if="wrapCornerStyle === 'fillet'" style="margin-top: 6px;">
                <label style="font-size: 11px; color: #94a3b8;">Fillet Radius</label>
                <div class="input-wrap">
                    <input type="range" v-model.number="wrapRadius" min="10" max="100" step="5">
                    <DimensionInput v-model="wrapRadius" />
                </div>
            </div>

            <!-- Apply Action Button with Live Arrow Reference -->
            <button type="button" 
                    class="btn-primary" 
                    :disabled="!cornerStatus?.hasConnectedWall"
                    @click="onApplyWrap" 
                    style="padding: 9px; font-size: 11px; background: linear-gradient(135deg, #0284c7, #0369a1); margin-top: 10px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);">
                <span style="font-size: 14px; font-weight: 900;">{{ cornerStatus?.turnArrow || '↳' }}</span>
                <span>
                    {{ wrapMode === 'allWalls' ? '🌐 Wrap All Connected Walls (Loop)' : (wrapMode === 'fullWall' ? `⇥ Extend Full Length onto ${cornerStatus?.adjWall?.name || 'Next Wall'}` : `${cornerStatus?.turnArrow || '↳'} Wrap ${cornerStatus?.turnDirection === 'left' ? 'Left' : 'Right'} onto ${cornerStatus?.adjWall?.name || 'Next Wall'}`) }}
                </span>
            </button>
        </div>

        <!-- Node Actions -->
        <div style="display: flex; gap: 6px; margin-top: 10px;">
            <button type="button" class="btn-secondary" @click="reverseNodes" style="flex: 1; padding: 6px; font-size: 11px;">
                ⇄ Reverse Path
            </button>
            <button type="button" class="btn-secondary" @click="deleteActiveNode" :disabled="(selectedEntity.points?.length || 0) <= 2" style="flex: 1; padding: 6px; font-size: 11px;">
                ✕ Delete Point
            </button>
        </div>

        <!-- Delete Action -->
        <button class="hud-delete" @click="$emit('delete-entity')" style="margin-top: 16px;">
            Delete Elevation Assembly
        </button>
    </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import DimensionInput from '../common/DimensionInput.vue';
import { 
    ELEVATION_SEGMENT_MATERIALS, 
    sproutBendAtEndpoint, 
    setNodeCornerStyle,
    wrapElevationSegmentToAdjacentWall,
    snapEndpointToWallCorner,
    getEndpointCornerStatus,
    wrapElevationSegmentAllConnectedWalls,
    sproutCornerPreset,
    rotateElevationSegment,
    findNearbyElevationSegments,
    joinElevationSegments,
    splitElevationSegmentAtNode,
    initEntitySegments,
    setSegmentDimensions,
    setSegmentLength,
    getSegmentAngle,
    rotateSegmentArm,
    setSegmentPerpendicular
} from '../../features/elevation/elevationSegment.registry.js';
import { renderElevationSegment3D } from '../../features/elevation/elevationSegment.renderer3d.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);

const activeNodeIndex = ref(0);
const activeArmIndex = ref(0);
const currentGizmoMode = ref('stretch');

const onNodeSelect = (e) => {
    if (e.detail && e.detail.nodeIndex !== undefined) {
        activeNodeIndex.value = e.detail.nodeIndex;
    }
};

const onArmSelect = (e) => {
    if (e.detail && e.detail.armIndex !== undefined) {
        activeArmIndex.value = e.detail.armIndex;
    }
};

const selectArm = (idx) => {
    activeArmIndex.value = idx;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('elevation-segment-select-arm', {
            detail: { armIndex: idx }
        }));
    }
};

const onGizmoModeChange = (e) => {
    if (e.detail && e.detail.mode) {
        currentGizmoMode.value = e.detail.mode;
    }
};

const setGizmoMode = (mode) => {
    currentGizmoMode.value = mode;
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('elevation-segment-set-mode', {
            detail: { mode }
        }));
    }
};

const refreshTrigger = ref(0);

const onSegmentUpdated = () => {
    refreshTrigger.value++;
};

onMounted(() => {
    if (typeof window !== 'undefined') {
        window.addEventListener('elevation-node-select', onNodeSelect);
        window.addEventListener('elevation-segment-arm-selected', onArmSelect);
        window.addEventListener('elevation-segment-mode-change', onGizmoModeChange);
        window.addEventListener('elevation-segment-updated', onSegmentUpdated);
        const gizmo = window.planner?.app3D?.interactionSystem?.elevationSegmentGizmo || window.app3D?.interactionSystem?.elevationSegmentGizmo;
        if (gizmo?.activeMode) {
            currentGizmoMode.value = gizmo.activeMode;
        }
    }
});

onUnmounted(() => {
    if (typeof window !== 'undefined') {
        window.removeEventListener('elevation-node-select', onNodeSelect);
        window.removeEventListener('elevation-segment-arm-selected', onArmSelect);
        window.removeEventListener('elevation-segment-mode-change', onGizmoModeChange);
        window.removeEventListener('elevation-segment-updated', onSegmentUpdated);
    }
});

const numArms = computed(() => {
    const n = props.selectedEntity?.points?.length || 0;
    return Math.max(1, n - 1);
});

const currentArmDims = computed(() => {
    if (refreshTrigger.value >= 0 && props.selectedEntity) {
        initEntitySegments(props.selectedEntity);
        const curIdx = Math.min(Math.max(0, activeArmIndex.value), numArms.value - 1);
        const seg = props.selectedEntity.segments?.[curIdx] || {};
        const p1 = props.selectedEntity.points?.[curIdx];
        const p2 = props.selectedEntity.points?.[curIdx + 1];
        let len = 100;
        if (p1 && p2) {
            len = Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z));
        }
        return {
            width: seg.width || props.selectedEntity.width || 30,
            depth: seg.depth || props.selectedEntity.depth || 40,
            length: len,
            angle: getSegmentAngle(props.selectedEntity, curIdx)
        };
    }
    return { width: 30, depth: 40, length: 100, angle: 0 };
});

const armWidth = computed({
    get() {
        return currentArmDims.value.width;
    },
    set(val) {
        if (!props.selectedEntity) return;
        const curIdx = Math.min(Math.max(0, activeArmIndex.value), numArms.value - 1);
        setSegmentDimensions(props.selectedEntity, curIdx, { width: val });
        if (curIdx === 0 || numArms.value <= 1) {
            props.selectedEntity.width = val;
        }
        updateSegment();
    }
});

const armDepth = computed({
    get() {
        return currentArmDims.value.depth;
    },
    set(val) {
        if (!props.selectedEntity) return;
        const curIdx = Math.min(Math.max(0, activeArmIndex.value), numArms.value - 1);
        setSegmentDimensions(props.selectedEntity, curIdx, { depth: val });
        if (curIdx === 0 || numArms.value <= 1) {
            props.selectedEntity.depth = val;
        }
        updateSegment();
    }
});

const armLength = computed({
    get() {
        return currentArmDims.value.length;
    },
    set(val) {
        if (!props.selectedEntity) return;
        const curIdx = Math.min(Math.max(0, activeArmIndex.value), numArms.value - 1);
        setSegmentLength(props.selectedEntity, curIdx, val);
        updateSegment();
    }
});

const armAngle = computed({
    get() {
        return currentArmDims.value.angle;
    },
    set(val) {
        if (!props.selectedEntity) return;
        const curIdx = Math.min(Math.max(0, activeArmIndex.value), numArms.value - 1);
        rotateSegmentArm(props.selectedEntity, curIdx, val);
        updateSegment();
    }
});

const setArmPerpendicular = () => {
    if (!props.selectedEntity) return;
    const curIdx = Math.min(Math.max(0, activeArmIndex.value), numArms.value - 1);
    setSegmentPerpendicular(props.selectedEntity, curIdx);
    updateSegment();
    refreshTrigger.value++;
};

const setArmAnglePreset = (deg) => {
    armAngle.value = deg;
};

const currentNode = computed(() => {
    if (!props.selectedEntity?.points) return null;
    const idx = activeNodeIndex.value >= 0 ? activeNodeIndex.value : 0;
    return props.selectedEntity.points[idx] || props.selectedEntity.points[0];
});

const currentRadius = computed({
    get() {
        return currentNode.value?.radius || 25;
    },
    set(val) {
        if (currentNode.value) {
            currentNode.value.radius = val;
        }
    }
});

const currentElevation = computed({
    get() {
        return props.selectedEntity?.points?.[0]?.y !== undefined ? props.selectedEntity.points[0].y : 150;
    },
    set(val) {
        if (!props.selectedEntity?.points || props.selectedEntity.points.length === 0) return;
        const currentY = props.selectedEntity.points[0].y !== undefined ? props.selectedEntity.points[0].y : 150;
        const diffY = val - currentY;
        props.selectedEntity.points.forEach((p, idx) => {
            p.y = (p.y !== undefined ? p.y : currentY) + diffY;
            if (props.selectedEntity.nodes?.[idx]) props.selectedEntity.nodes[idx].y = p.y;
        });
    }
});

const updateElevation = () => {
    updateSegment();
};

const setElevationPreset = (presetY) => {
    currentElevation.value = presetY;
    updateSegment();
};

const currentRotation = computed({
    get() {
        if (refreshTrigger.value >= 0 && props.selectedEntity) {
            return props.selectedEntity.rotation || 0;
        }
        return 0;
    },
    set(val) {
        if (!props.selectedEntity) return;
        const targetDeg = ((val % 360) + 360) % 360;
        rotateElevationSegment(props.selectedEntity, targetDeg);
        updateSegment();
    }
});

const onRotationInput = () => {
    updateSegment();
};

const setRotationPreset = (deg) => {
    currentRotation.value = deg;
};

const updateSegment = () => {
    if (!props.selectedEntity) return;

    // Strict in-place geometry update (preserves stable mesh & gizmo reference)
    if (props.selectedEntity.mesh3D) {
        const planner = window.planner?.value || window.planner;
        const helpers = window.app3D?.helpers || planner?.app3D?.helpers || null;
        renderElevationSegment3D(null, props.selectedEntity, helpers);
        const gizmo = planner?.app3D?.interactionSystem?.elevationSegmentGizmo || window.app3D?.interactionSystem?.elevationSegmentGizmo;
        if (gizmo && gizmo.visible) {
            gizmo.updateHandles();
        }
    }

    emit('sync-engine');
    const planner = window.planner?.value || window.planner;
    if (planner?.debouncedSaveHistory) planner.debouncedSaveHistory();
};

const setCorner = (style) => {
    const idx = activeNodeIndex.value >= 0 ? activeNodeIndex.value : 0;
    setNodeCornerStyle(props.selectedEntity, idx, style, currentRadius.value);
    updateSegment();
};

const updateRadius = () => {
    const idx = activeNodeIndex.value >= 0 ? activeNodeIndex.value : 0;
    setNodeCornerStyle(props.selectedEntity, idx, 'fillet', currentRadius.value);
    updateSegment();
};

const sprout = (direction) => {
    const n = props.selectedEntity.points?.length || 0;
    const idx = (activeNodeIndex.value === 0) ? 0 : (n - 1);
    sproutBendAtEndpoint(props.selectedEntity, idx, direction, props.selectedEntity.defaultSproutDist || 120);
    activeNodeIndex.value = (idx === 0) ? 0 : (props.selectedEntity.points.length - 1);
    updateSegment();
};

const applyCornerPreset = (presetType, options = {}) => {
    const n = props.selectedEntity.points?.length || 0;
    const idx = (activeNodeIndex.value === 0) ? 0 : (n - 1);
    const res = sproutCornerPreset(props.selectedEntity, idx, presetType, {
        distance: 100,
        ...options
    });
    if (res) {
        activeNodeIndex.value = (idx === 0) ? 0 : (props.selectedEntity.points.length - 1);
        updateSegment();
        refreshTrigger.value++;
    }
};

const nearbySegments = computed(() => {
    if (refreshTrigger.value < 0) return [];
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity) return [];
    return findNearbyElevationSegments(planner, props.selectedEntity, 45);
});

const onAutoJoin = (otherSegment) => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity || !otherSegment) return;
    const merged = joinElevationSegments(planner, props.selectedEntity, otherSegment, 45);
    if (merged) {
        updateSegment();
        refreshTrigger.value++;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('elevation-segment-updated', { detail: { entity: merged } }));
        }
    }
};

const onSplitNode = () => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity || activeNodeIndex.value < 1) return;
    const res = splitElevationSegmentAtNode(planner, props.selectedEntity, activeNodeIndex.value);
    if (res) {
        activeNodeIndex.value = 0;
        updateSegment();
        refreshTrigger.value++;
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('elevation-segment-updated', { detail: { entity: res.segA } }));
        }
    }
};

// Extension Studio State
const wrapEndpointIndex = ref('end'); // 'start' | 'end'
const wrapMode = ref('distance'); // 'distance' | 'fullWall' | 'allWalls'
const wrapDistance = ref(120);
const wrapCornerStyle = ref('sharp'); // 'sharp' | 'fillet'
const wrapRadius = ref(30);

const targetEndpointNodeIndex = computed(() => {
    const n = props.selectedEntity?.points?.length || 0;
    return (wrapEndpointIndex.value === 'start') ? 0 : Math.max(0, n - 1);
});

const cornerStatus = computed(() => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity) return null;
    return getEndpointCornerStatus(props.selectedEntity, targetEndpointNodeIndex.value, planner);
});

const startCornerStatus = computed(() => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity) return null;
    return getEndpointCornerStatus(props.selectedEntity, 0, planner);
});

const endCornerStatus = computed(() => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity) return null;
    const n = props.selectedEntity?.points?.length || 0;
    return getEndpointCornerStatus(props.selectedEntity, Math.max(0, n - 1), planner);
});

const onSnapToCorner = () => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity) return;
    const res = snapEndpointToWallCorner(props.selectedEntity, targetEndpointNodeIndex.value, planner);
    if (res) {
        updateSegment();
    }
};

const onApplyWrap = () => {
    const planner = window.planner?.value || window.planner;
    if (!planner || !props.selectedEntity) return;

    if (wrapMode.value === 'allWalls') {
        const count = wrapElevationSegmentAllConnectedWalls(props.selectedEntity, planner, {
            cornerStyle: wrapCornerStyle.value,
            radius: wrapRadius.value
        });
        if (count > 0) {
            updateSegment();
        }
        return;
    }

    const res = wrapElevationSegmentToAdjacentWall(props.selectedEntity, targetEndpointNodeIndex.value, planner, {
        distance: wrapDistance.value,
        fullWall: wrapMode.value === 'fullWall',
        cornerStyle: wrapCornerStyle.value,
        radius: wrapRadius.value
    });

    if (res) {
        const n = props.selectedEntity.points?.length || 0;
        activeNodeIndex.value = (targetEndpointNodeIndex.value === 0) ? 0 : (n - 1);
        updateSegment();
    }
};

const wrapToAdjacentWall = () => {
    onApplyWrap();
};

const reverseNodes = () => {
    if (!props.selectedEntity.points) return;
    props.selectedEntity.points.reverse();
    if (props.selectedEntity.nodes) props.selectedEntity.nodes.reverse();
    updateSegment();
};

const deleteActiveNode = () => {
    if (!props.selectedEntity.points || props.selectedEntity.points.length <= 2) return;
    const idx = activeNodeIndex.value >= 0 ? activeNodeIndex.value : (props.selectedEntity.points.length - 1);
    props.selectedEntity.points.splice(idx, 1);
    if (props.selectedEntity.nodes) props.selectedEntity.nodes.splice(idx, 1);
    activeNodeIndex.value = Math.max(0, idx - 1);
    updateSegment();
};
</script>

<style scoped>
.props-panel-inner {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.props-subtitle {
    margin: 0 0 4px 0;
    font-size: 13px;
    font-weight: 700;
    color: #38bdf8;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.control-group label {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
}
.input-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}
.settings-select {
    width: 100%;
    background: #1e293b;
    color: #f8fafc;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
}
.btn-primary {
    background: #0284c7;
    color: #ffffff;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
}
.btn-primary:hover {
    background: #0369a1;
}
.btn-secondary {
    background: #1e293b;
    color: #cbd5e1;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}
.btn-secondary:hover {
    background: #334155;
    color: #ffffff;
}
.btn-secondary.active {
    background: #38bdf8;
    color: #0f172a;
    border-color: #38bdf8;
}
.hud-delete {
    background: rgba(239, 68, 68, 0.15);
    color: #ef4444;
    border: 1px solid rgba(239, 68, 68, 0.35);
    border-radius: 6px;
    padding: 7px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
}
.hud-delete:hover {
    background: #ef4444;
    color: #ffffff;
}
.btn-xs {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 10px;
    padding: 3px 6px;
    cursor: pointer;
    transition: all 0.15s ease;
}
.btn-xs:hover {
    background: rgba(56, 189, 248, 0.2);
    border-color: #38bdf8;
    color: #38bdf8;
}
</style>
