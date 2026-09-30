<template>
  <div class="tab-body properties-tab-body">
            
            <div class="props-content" v-if="activeTool && activeTool.startsWith('preset_') && activePresetParams">
                <h4 class="props-subtitle">Preset Configuration</h4>
                <div class="control-group" v-if="'width' in activePresetParams">
                    <label>Width (cm)</label>
                    <DimensionInput v-model="activePresetParams.width" class="settings-input" />
                </div>
                <div class="control-group" v-if="'depth' in activePresetParams">
                    <label>Depth (cm)</label>
                    <DimensionInput v-model="activePresetParams.depth" class="settings-input" />
                </div>
                <div class="control-group" v-if="'wallHeight' in activePresetParams">
                    <label>Wall Height (cm)</label>
                    <DimensionInput v-model="activePresetParams.wallHeight" class="settings-input" />
                </div>
                <div class="control-group" v-if="'elevation' in activePresetParams">
                    <label>Elevation (cm)</label>
                    <DimensionInput v-model="activePresetParams.elevation" class="settings-input" title="Height from the floor level" />
                </div>
                <div class="control-group" v-if="'pitch' in activePresetParams">
                    <label>Roof Pitch (deg)</label>
                    <input type="number" v-model.number="activePresetParams.pitch" class="settings-input" />
                </div>
                <div class="control-group" v-if="'roofType' in activePresetParams">
                    <label>Roof Type</label>
                    <select v-model="activePresetParams.roofType" class="settings-select">
                        <option value="gable">Gable</option>
                        <option value="hip">Hip</option>
                        <option value="flat">Flat</option>
                    </select>
                </div>
                <div class="properties-help-text">
                    Adjust dimensions before placing the preset. Once placed, individual walls and roofs can be edited separately.
                </div>
            </div>

            <div class="props-content" v-else-if="(viewMode==='3d' || viewMode==='2d') && selectedEntity">
            
            <!-- Universal Face Material Editor -->
            <div v-if="selectedEntity.params && selectedEntity.params.isEditingMaterials">
                <button class="btn-secondary full-width" @click="selectedEntity.params.isEditingMaterials = false">← Back to Properties</button>
                <h4 class="props-subtitle">Face Selection</h4>
                <div class="control-group-inline">
                    <label>Apply to All Sides</label>
                    <input type="checkbox" :checked="!selectedEntity.params.materialTarget || selectedEntity.params.materialTarget === 'all'" @change="e => { selectedEntity.params.materialTarget = e.target.checked ? 'all' : 'front'; $emit('sync-engine'); }" class="settings-checkbox">
                </div>
                <div class="control-group" v-if="selectedEntity.params.materialTarget && selectedEntity.params.materialTarget !== 'all'">
                    <label>Target Face</label>
                    <select v-model="selectedEntity.params.materialTarget" class="settings-select">
                        <option value="front">Front Facing</option>
                        <option value="back">Back Facing</option>
                        <option value="left">Left Facing</option>
                        <option value="right">Right Facing</option>
                        <option value="top">Top Facing</option>
                        <option value="bottom">Bottom Facing</option>
                        <option value="sides">All Side Faces</option>
                    </select>
                </div>
                <div class="decor-gallery">
                    <h4 class="props-subtitle">Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('set-shape-material', key)" :class="{ active: isShapeMaterialActive(key) }">
                            <img :src="config.thumbnail" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>
            </div>
            <RailingProperties
                v-else-if="selectedType === 'railing'"
                :entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />
            
            <WallPanel 
                v-else-if="selectedType === 'wall' || selectedType === 'arc'"
                :selected-entity="selectedEntity.type === 'arc' ? (selectedEntity.walls && selectedEntity.walls[0] ? selectedEntity.walls[0] : selectedEntity) : selectedEntity"
                :selected-wall-side="selectedWallSide"
                :current-face-decors="currentFaceDecors"
                :active-decor-id="activeDecorId"
                :wall-decor-registry="wallDecorRegistry"
                :railing-registry="railingRegistry"
                :ui-trigger="uiTrigger"
                :view-mode="viewMode"
                :planner="planner"
                @sync-engine="$emit('sync-engine')"
                @ui-trigger="$emit('ui-trigger')"
                @toggle-edit-decor="$emit('toggle-edit-decor', $event)"
                @delete-specific-decor="$emit('delete-specific-decor', $event)"
                @decor-update="$emit('decor-update', $event)"
                @spawn-wall-pattern="$emit('spawn-wall-pattern', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <div v-else-if="selectedType === 'wallDecor'" class="decor-panel-root">
                <div class="decor-single-card">
                    <div class="decor-single-header">
                        <div class="decor-header-info">
                            <span class="decor-kicker">Material Properties</span>
                            <h4 class="decor-title">{{ wallDecorRegistry[selectedEntity.configId]?.name || 'Wall Pattern Layer' }}</h4>
                        </div>
                    </div>

                    <!-- Edge Returns / Bevels -->
                    <div class="decor-figma-row decor-edge-row" v-if="selectedEntity.faces">
                        <span class="decor-figma-label">Bevel Wrap</span>
                        <div class="decor-edge-chips">
                            <label class="decor-edge-label">
                                <input type="checkbox" v-model="selectedEntity.faces.left" @change="$emit('decor-update', selectedEntity)">
                                <span>Left</span>
                            </label>
                            <label class="decor-edge-label">
                                <input type="checkbox" v-model="selectedEntity.faces.right" @change="$emit('decor-update', selectedEntity)">
                                <span>Right</span>
                            </label>
                        </div>
                    </div>

                    <!-- Card 1: Tiling & Orientation -->
                    <div class="decor-cad-card">
                        <div class="decor-cad-card-header">
                            <span class="decor-cad-card-title">Tiling & Orientation</span>
                        </div>

                        <!-- 1. Tile Size -->
                        <div class="decor-dual-control decor-cad-row">
                            <span class="decor-cad-label">Tile Size</span>
                            <div class="decor-cad-controls">
                                <div class="decor-cad-chips">
                                    <button 
                                        v-for="size in [50, 70, 100, 150]" 
                                        :key="size" 
                                        type="button" 
                                        class="decor-chip tile-chip decor-cad-chip" 
                                        :class="{ active: (selectedEntity.tileSize || 70) === size }"
                                        @click="onDecorTileSizeInput(selectedEntity, size)"
                                    >
                                        {{ size }}
                                    </button>
                                </div>
                                <div class="decor-cad-input-box decor-cad-tilesize-box">
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorTileSize(selectedEntity, -5))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorTileSize(selectedEntity, -5))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorTileSize(selectedEntity, -5))"
                                    >−</button>
                                    <DimensionInput 
                                        :model-value="selectedEntity.tileSize || 70" 
                                        min="10" 
                                        max="500" 
                                        step="5" 
                                        class="decor-cad-dim"
                                        @update:model-value="val => onDecorTileSizeInput(selectedEntity, val)" 
                                    />
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorTileSize(selectedEntity, 5))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorTileSize(selectedEntity, 5))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorTileSize(selectedEntity, 5))"
                                    >+</button>
                                </div>
                                <span class="decor-cad-cell-unit">cm</span>
                            </div>
                            <span class="decor-val-badge sr-only">{{ selectedEntity.tileSize || 70 }} cm</span>
                        </div>

                        <!-- 2. Rotation -->
                        <div class="decor-dual-control decor-cad-row">
                            <span class="decor-cad-label">Rotation</span>
                            <div class="decor-cad-controls">
                                <div class="decor-cad-chips">
                                    <button 
                                        v-for="deg in [0, 45, 90, 180, 270]" 
                                        :key="deg" 
                                        type="button" 
                                        class="decor-chip rot-chip decor-cad-chip" 
                                        :class="{ active: getDecorRotationDeg(selectedEntity) === deg }"
                                        @click="onDecorRotationInput(selectedEntity, deg)"
                                    >
                                        {{ deg }}°
                                    </button>
                                </div>
                                <div class="decor-cad-input-box rot">
                                    <input 
                                        type="number" 
                                        :value="getDecorRotationDeg(selectedEntity)" 
                                        min="0" 
                                        max="360" 
                                        step="1" 
                                        class="decor-cad-num"
                                        title="Rotation (°)"
                                        @input="onDecorRotationInput(selectedEntity, $event.target.value)"
                                    >
                                    <span class="decor-cad-unit-inline">°</span>
                                </div>
                            </div>
                            <span class="decor-val-badge sr-only">{{ getDecorRotationDeg(selectedEntity) }}°</span>
                        </div>

                        <!-- 3. Thickness (Depth) -->
                        <div class="decor-dual-control decor-cad-row">
                            <span class="decor-cad-label">Thickness</span>
                            <div class="decor-cad-controls">
                                <div class="decor-cad-input-box decor-cad-thickness-box">
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorThickness(selectedEntity, -0.1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorThickness(selectedEntity, -0.1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorThickness(selectedEntity, -0.1))"
                                    >−</button>
                                    <DimensionInput 
                                        :model-value="selectedEntity.depth !== undefined ? selectedEntity.depth : 0.2" 
                                        min="0.1" 
                                        max="40" 
                                        step="0.1" 
                                        class="decor-cad-dim"
                                        @update:model-value="val => { selectedEntity.depth = Number(val); triggerDecorUpdate(selectedEntity); }" 
                                    />
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorThickness(selectedEntity, 0.1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorThickness(selectedEntity, 0.1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorThickness(selectedEntity, 0.1))"
                                    >+</button>
                                </div>
                                <span class="decor-cad-cell-unit">cm</span>
                            </div>
                            <span class="decor-val-badge sr-only">{{ selectedEntity.depth || 0.2 }} cm</span>
                        </div>
                    </div>

                    <!-- Card 2: Placement & Bounds -->
                    <div class="decor-cad-card">
                        <div class="decor-cad-card-header">
                            <span class="decor-cad-card-title">Placement & Bounds</span>
                            <div class="decor-cad-actions-inline">
                                <button type="button" class="decor-cad-action-btn" title="Flip Horizontal (Mirror across wall center)" @click="flipDecorH(selectedEntity)">
                                    ⇄ Flip H
                                </button>
                                <button type="button" class="decor-cad-action-btn" title="Flip Face (Move between Inner and Outer face)" @click="flipDecorFace(selectedEntity)">
                                    ⇄ {{ selectedEntity.side === 'front' ? 'To Outer' : 'To Inner' }}
                                </button>
                            </div>
                        </div>

                        <!-- 1-Click Alignment Toolbar -->
                        <div class="decor-cad-align-bar">
                            <div class="decor-cad-align-row">
                                <span class="decor-cad-align-label">H Align</span>
                                <div class="decor-cad-align-group">
                                    <button type="button" class="decor-cad-align-btn" :class="{ active: isDecorAligned(selectedEntity, 'left') }" title="Align Left (Flush against left corner)" @click="alignDecor(selectedEntity, 'left')">
                                        ⫷ Left
                                    </button>
                                    <button type="button" class="decor-cad-align-btn" :class="{ active: isDecorAligned(selectedEntity, 'center') }" title="Center Horizontally" @click="alignDecor(selectedEntity, 'center')">
                                        ⬌ Center
                                    </button>
                                    <button type="button" class="decor-cad-align-btn" :class="{ active: isDecorAligned(selectedEntity, 'right') }" title="Align Right (Flush against right corner)" @click="alignDecor(selectedEntity, 'right')">
                                        Right ⫸
                                    </button>
                                </div>
                            </div>

                            <div class="decor-cad-align-row">
                                <span class="decor-cad-align-label">V Align</span>
                                <div class="decor-cad-align-group">
                                    <button type="button" class="decor-cad-align-btn" :class="{ active: isDecorAligned(selectedEntity, 'floor') }" title="Align to Floor (Bottom touches floor)" @click="alignDecor(selectedEntity, 'floor')">
                                        ▲ Floor
                                    </button>
                                    <button type="button" class="decor-cad-align-btn" :class="{ active: isDecorAligned(selectedEntity, 'middle') }" title="Center Vertically" @click="alignDecor(selectedEntity, 'middle')">
                                        ⬍ Mid
                                    </button>
                                    <button type="button" class="decor-cad-align-btn" :class="{ active: isDecorAligned(selectedEntity, 'top') }" title="Align to Ceiling/Top" @click="alignDecor(selectedEntity, 'top')">
                                        Top ▼
                                    </button>
                                    <button type="button" class="decor-cad-align-btn fill-btn" :class="{ active: isDecorAligned(selectedEntity, 'full') }" title="Full Wall Coverage (100% × 100%)" @click="alignDecor(selectedEntity, 'full')">
                                        ⛶ Full
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="decor-cad-grid-2col">
                            <!-- W (Width) -->
                            <div class="decor-dual-control decor-cad-grid-cell" title="Width: {{ selectedEntity.width !== undefined ? selectedEntity.width : 100 }}% ({{ getDecorWidthCm(selectedEntity) }} cm)">
                                <div class="decor-cad-cell-top">
                                    <span class="decor-cad-cell-label">W</span>
                                    <div class="decor-cad-cell-cm-wrap">
                                        <DimensionInput 
                                            :model-value="getDecorWidthCm(selectedEntity)" 
                                            min="1" 
                                            :max="getDecorWallLength(selectedEntity)" 
                                            step="1" 
                                            class="decor-cad-dim-sub"
                                            @update:model-value="val => onDecorWidthCmInput(selectedEntity, val)" 
                                        />
                                        <span class="decor-cad-sub-unit">cm</span>
                                    </div>
                                </div>
                                <div class="decor-cad-cell-bot">
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorProp(selectedEntity, 'width', -1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorProp(selectedEntity, 'width', -1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorProp(selectedEntity, 'width', $event.shiftKey ? -10 : -1))"
                                    >−</button>
                                    <div class="decor-cad-pct-wrap">
                                        <input 
                                            type="number" 
                                            :value="selectedEntity.width !== undefined ? selectedEntity.width : 100" 
                                            min="1" 
                                            max="100" 
                                            step="1" 
                                            class="decor-cad-pct-input"
                                            @input="onDecorPctInput(selectedEntity, 'width', $event.target.value)" 
                                        />
                                        <span class="decor-cad-pct-unit">%</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorProp(selectedEntity, 'width', 1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorProp(selectedEntity, 'width', 1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorProp(selectedEntity, 'width', $event.shiftKey ? 10 : 1))"
                                    >+</button>
                                </div>
                                <span class="decor-val-badge sr-only">{{ selectedEntity.width !== undefined ? selectedEntity.width : 100 }}% ({{ getDecorWidthCm(selectedEntity) }} cm)</span>
                            </div>

                            <!-- H (Height) -->
                            <div class="decor-dual-control decor-cad-grid-cell" title="Height: {{ selectedEntity.height !== undefined ? selectedEntity.height : 100 }}% ({{ getDecorHeightCm(selectedEntity) }} cm)">
                                <div class="decor-cad-cell-top">
                                    <span class="decor-cad-cell-label">H</span>
                                    <div class="decor-cad-cell-cm-wrap">
                                        <DimensionInput 
                                            :model-value="getDecorHeightCm(selectedEntity)" 
                                            min="1" 
                                            :max="getDecorWallHeight(selectedEntity)" 
                                            step="1" 
                                            class="decor-cad-dim-sub"
                                            @update:model-value="val => onDecorHeightCmInput(selectedEntity, val)" 
                                        />
                                        <span class="decor-cad-sub-unit">cm</span>
                                    </div>
                                </div>
                                <div class="decor-cad-cell-bot">
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorProp(selectedEntity, 'height', -1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorProp(selectedEntity, 'height', -1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorProp(selectedEntity, 'height', $event.shiftKey ? -10 : -1))"
                                    >−</button>
                                    <div class="decor-cad-pct-wrap">
                                        <input 
                                            type="number" 
                                            :value="selectedEntity.height !== undefined ? selectedEntity.height : 100" 
                                            min="1" 
                                            max="100" 
                                            step="1" 
                                            class="decor-cad-pct-input"
                                            @input="onDecorPctInput(selectedEntity, 'height', $event.target.value)" 
                                        />
                                        <span class="decor-cad-pct-unit">%</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorProp(selectedEntity, 'height', 1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorProp(selectedEntity, 'height', 1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorProp(selectedEntity, 'height', $event.shiftKey ? 10 : 1))"
                                    >+</button>
                                </div>
                                <span class="decor-val-badge sr-only">{{ selectedEntity.height !== undefined ? selectedEntity.height : 100 }}% ({{ getDecorHeightCm(selectedEntity) }} cm)</span>
                            </div>

                            <!-- X (Offset X with Reference Toggle) -->
                            <div class="decor-dual-control decor-cad-grid-cell" title="Offset X: {{ selectedEntity.localX !== undefined ? selectedEntity.localX : 50 }}% ({{ getDecorLocalXCm(selectedEntity) }} cm)">
                                <div class="decor-cad-cell-top">
                                    <div class="decor-cad-cell-label-wrap">
                                        <span class="decor-cad-cell-label">X</span>
                                        <button type="button" class="decor-cad-ref-toggle" :title="xRefMode === 'left' ? 'Measuring from Left Corner (Click to switch to Right)' : 'Measuring from Right Corner (Click to switch to Left)'" @click="toggleXRefMode">
                                            {{ xRefMode === 'left' ? '◀ Left' : 'Right ▶' }}
                                        </button>
                                    </div>
                                    <div class="decor-cad-cell-cm-wrap">
                                        <DimensionInput 
                                            :model-value="getDecorRefXCm(selectedEntity)" 
                                            min="0" 
                                            :max="getDecorWallLength(selectedEntity)" 
                                            step="1" 
                                            class="decor-cad-dim-sub"
                                            @update:model-value="val => onDecorRefXCmInput(selectedEntity, val)" 
                                        />
                                        <span class="decor-cad-sub-unit">cm</span>
                                    </div>
                                </div>
                                <div class="decor-cad-cell-bot">
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'x', -1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'x', -1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorRefProp(selectedEntity, 'x', $event.shiftKey ? -10 : -1))"
                                    >−</button>
                                    <div class="decor-cad-pct-wrap">
                                        <input 
                                            type="number" 
                                            :value="getDecorRefXPercent(selectedEntity)" 
                                            min="0" 
                                            max="100" 
                                            step="1" 
                                            class="decor-cad-pct-input"
                                            @input="onDecorRefXPctInput(selectedEntity, $event.target.value)" 
                                        />
                                        <span class="decor-cad-pct-unit">%</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'x', 1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'x', 1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorRefProp(selectedEntity, 'x', $event.shiftKey ? 10 : 1))"
                                    >+</button>
                                </div>
                                <span class="decor-val-badge sr-only">{{ selectedEntity.localX !== undefined ? selectedEntity.localX : 50 }}% ({{ getDecorLocalXCm(selectedEntity) }} cm)</span>
                            </div>

                            <!-- Y (Offset Y with Reference Toggle) -->
                            <div class="decor-dual-control decor-cad-grid-cell" title="Offset Y: {{ selectedEntity.localY !== undefined ? selectedEntity.localY : 50 }}% ({{ getDecorLocalYCm(selectedEntity) }} cm)">
                                <div class="decor-cad-cell-top">
                                    <div class="decor-cad-cell-label-wrap">
                                        <span class="decor-cad-cell-label">Y</span>
                                        <button type="button" class="decor-cad-ref-toggle" :title="yRefMode === 'floor' ? 'Measuring from Floor (Click to switch to Ceiling)' : 'Measuring from Ceiling (Click to switch to Floor)'" @click="toggleYRefMode">
                                            {{ yRefMode === 'floor' ? '▲ Floor' : 'Top ▼' }}
                                        </button>
                                    </div>
                                    <div class="decor-cad-cell-cm-wrap">
                                        <DimensionInput 
                                            :model-value="getDecorRefYCm(selectedEntity)" 
                                            min="0" 
                                            :max="getDecorWallHeight(selectedEntity)" 
                                            step="1" 
                                            class="decor-cad-dim-sub"
                                            @update:model-value="val => onDecorRefYCmInput(selectedEntity, val)" 
                                        />
                                        <span class="decor-cad-sub-unit">cm</span>
                                    </div>
                                </div>
                                <div class="decor-cad-cell-bot">
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'y', -1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'y', -1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorRefProp(selectedEntity, 'y', $event.shiftKey ? -10 : -1))"
                                    >−</button>
                                    <div class="decor-cad-pct-wrap">
                                        <input 
                                            type="number" 
                                            :value="getDecorRefYPercent(selectedEntity)" 
                                            min="0" 
                                            max="100" 
                                            step="1" 
                                            class="decor-cad-pct-input"
                                            @input="onDecorRefYPctInput(selectedEntity, $event.target.value)" 
                                        />
                                        <span class="decor-cad-pct-unit">%</span>
                                    </div>
                                    <button 
                                        type="button" 
                                        class="decor-cad-stepper" 
                                        @mousedown="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'y', 1))"
                                        @mouseup="stopContinuousStep"
                                        @mouseleave="stopContinuousStep"
                                        @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(selectedEntity, 'y', 1))"
                                        @touchend="stopContinuousStep"
                                        @click="onStepperClick(() => stepDecorRefProp(selectedEntity, 'y', $event.shiftKey ? 10 : 1))"
                                    >+</button>
                                </div>
                                <span class="decor-val-badge sr-only">{{ selectedEntity.localY !== undefined ? selectedEntity.localY : 50 }}% ({{ getDecorLocalYCm(selectedEntity) }} cm)</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="decor-gallery">
                    <h4 class="props-subtitle">Change Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="() => { selectedEntity.configId = key; $emit('sync-engine'); }" :class="{ active: selectedEntity.configId === key }">
                            <img :src="config.thumbnail || config.texture" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" @click="$emit('delete-entity')">Delete Pattern</button>
            </div>

            <RoomPanel 
                v-else-if="selectedType === 'room'"
                :selected-entity="selectedEntity"
                :floor-registry="floorRegistry"
                @sync-engine="$emit('sync-engine')"
                @set-floor-material="$emit('set-floor-material', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <StairPanel 
                v-else-if="selectedType === 'stair'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <AdvanceOpeningsPanel 
                v-else-if="selectedType === 'advance_openings'"
                :selected-entity="selectedEntity"
                :wall-decor-registry="wallDecorRegistry"
                :view-mode="viewMode"
                @sync-engine="$emit('sync-engine')"
                @set-opening-material="$emit('set-opening-material', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <WidgetPanel 
                v-else-if="selectedType === 'widget' || selectedType === 'door' || selectedType === 'window'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @sync-door-angle="$emit('sync-door-angle')"
                @delete-entity="$emit('delete-entity')"
            />

            <MoldingPanel 
                v-else-if="selectedType === 'molding'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <ShapePanel
                v-else-if="selectedType === 'shape'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @clear-shape-textures="$emit('clear-shape-textures')"
                @delete-entity="$emit('delete-entity')"
            />
            
            <FurniturePanel
                v-else-if="selectedType === 'furniture'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />
            
            <RoofPanel
                v-else-if="selectedType === 'roof'"
                :selected-entity="selectedEntity"
                :roof-decor-registry="roofDecorRegistry"
                :wall-decor-registry="wallDecorRegistry"
                :calculate-roof-peak-height="calculateRoofPeakHeight"
                :update-roof-pitch-from-height="updateRoofPitchFromHeight"
                @sync-engine="$emit('sync-engine')"
                @set-roof-material="(...args) => $emit('set-roof-material', ...args)"
                @delete-entity="$emit('delete-entity')"
            />

            <RoofAddonPanel
                v-else-if="selectedType === 'roof_addon'"
                :selected-entity="selectedEntity"
                :parent-roof="selectedEntity.parentRoof"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <PresetGroupPanel
                v-else-if="selectedType === 'preset_group'"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <OutdoorZonePanel
                v-else-if="selectedType === 'outdoor_zone' || (selectedEntity && selectedEntity.type === 'outdoor_zone')"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine', $event)"
                @delete-entity="$emit('delete-entity')"
            />

            <PlatformPanel
                v-else-if="selectedType === 'platform' || (selectedEntity && selectedEntity.type === 'platform')"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <FacadeRibbonPanel
                v-else-if="selectedType === 'facade_ribbon' || (selectedEntity && selectedEntity.type === 'facade_ribbon')"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <ElevationSegmentPanel
                v-else-if="selectedType === 'elevation_segment' || (selectedEntity && selectedEntity.type === 'elevation_segment')"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
                @delete-entity="$emit('delete-entity')"
            />

            <CornerPanel
                v-else-if="selectedType === 'anchor' || (selectedEntity && (selectedEntity.isCornerApex || selectedEntity.isCornerFillet))"
                :selected-entity="selectedEntity"
                @sync-engine="$emit('sync-engine')"
            />

            <SitePropertiesPanel
                v-else-if="selectedType === 'site' || (selectedEntity && selectedEntity.type === 'site')"
                :planner="planner"
                @open-site-dialog="$emit('open-site-dialog')"
                @sync-engine="$emit('sync-engine')"
            />
        </div>

        <SitePropertiesPanel
            v-else-if="planner && planner.site"
            :planner="planner"
            @open-site-dialog="$emit('open-site-dialog')"
            @sync-engine="$emit('sync-engine')"
        />

        <div class="props-empty" v-else-if="!activeTool || !activeTool.startsWith('preset_')">
            <span v-if="viewMode==='2d'">Select a wall, door, window, or object on the canvas to edit its properties here.</span>
            <span v-else>Select a wall, door, window, or object to edit its properties.</span>
        </div>
  </div>
</template>

<script setup>
import { ref, onBeforeUnmount } from 'vue';
import WallPanel from '../../features/wall/wall.properties.vue';
import RoomPanel from '../panels/RoomPanel.vue';
import OutdoorZonePanel from '../panels/OutdoorZonePanel.vue';
import AdvanceOpeningsPanel from '../panels/AdvanceOpeningsPanel.vue';
import StairPanel from '../../features/stairs/stairs.properties.vue';
import WidgetPanel from '../panels/WidgetPanel.vue';
import MoldingPanel from '../panels/MoldingPanel.vue';
import ShapePanel from '../panels/ShapePanel.vue';
import FurniturePanel from '../../features/furniture/furniture.properties.vue';
import RoofPanel from '../../features/roof/roof.properties.vue';
import RoofAddonPanel from '../../features/roof/RoofAddonProperties.vue';
import { RoofEngine } from '../../core/roof/index.js';
import { WallEngine } from '../../core/wall/WallEngine.js';
import DimensionInput from '../common/DimensionInput.vue';
import MaterialSizeInput from '../common/MaterialSizeInput.vue';
import { DEFAULT_UNIVERSAL_TILE_SIZE } from '../../core/registries/material.registry.js';

import RailingProperties from '../../features/railing/ui/RailingProperties.vue';
import PresetGroupPanel from '../panels/PresetGroupPanel.vue';
import PlatformPanel from '../panels/PlatformPanel.vue';
import FacadeRibbonPanel from '../panels/FacadeRibbonPanel.vue';
import ElevationSegmentPanel from '../panels/ElevationSegmentPanel.vue';
import CornerPanel from '../panels/CornerPanel.vue';
import SitePropertiesPanel from '../panels/SitePropertiesPanel.vue';

const props = defineProps({
    activeTool: String,
    activePresetParams: Object,
    viewMode: String,
    viewMode3D: String,
    selectedEntity: Object,
    selectedType: String,
    selectedWallSide: String,
    currentFaceDecors: Array,
    activeDecorId: String,
    wallDecorRegistry: Object,
    railingRegistry: Object,
    uiTrigger: Number,
    floorRegistry: Object,
    roofDecorRegistry: Object,
    planner: Object,
    renderer3D: Object
});

const emit = defineEmits([
    'ui-trigger',
    'sync-engine',
    'sync-door-angle',
    'open-site-dialog',
    'delete-entity', 'toggle-edit-decor', 'delete-specific-decor',
    'decor-update', 'spawn-wall-pattern', 'delete-entity', 'set-floor-material',
    'set-opening-material', 'clear-shape-textures', 'set-roof-material', 'set-shape-material'
]);

const calculateRoofPeakHeight = (roof) => {
    return RoofEngine.getPeakHeight(roof);
};

const updateRoofPitchFromHeight = (e, roof) => {
    const targetHeight = parseFloat(e.target.value);
    if (isNaN(targetHeight) || targetHeight <= 0) return;
    RoofEngine.setPeakHeight(roof, targetHeight);
    emit('sync-engine');
};

const generateThumbnail = async () => {
    if (!props.selectedEntity || !props.renderer3D) return;
    try {
        const type = props.selectedEntity.type;
        const params = props.selectedEntity.params || {};
        if (type === 'railing' && props.selectedEntity.configId) {
            params.configId = props.selectedEntity.configId;
        }
        const url = await props.renderer3D.thumbnailGenerator.generate(type, params);
        thumbnailUrl.value = url;
    } catch(e) {console.error(e);}
};

const isShapeMaterialActive = (key) => {
    if (!props.selectedEntity || !props.selectedEntity.params) return false;
    const target = props.selectedEntity.params.materialTarget || 'all';
    if (target === 'all') return props.selectedEntity.params.texture === key;
    return props.selectedEntity.params.faces?.[target] === key;
};

const decorVersion = ref(0);

// Continuous Stepping Support (CAD Press-and-Hold)
let stepTimer = null;
let stepInterval = null;
let mouseDownHandled = false;

const startContinuousStep = (stepFn) => {
    stopContinuousStep();
    mouseDownHandled = true;
    stepFn(); // Instant 0ms response on press
    stepTimer = setTimeout(() => {
        stepInterval = setInterval(() => {
            stepFn(); // Smooth continuous stepping every 60ms
        }, 60);
    }, 280);

    const onMouseUp = () => {
        stopContinuousStep();
        window.removeEventListener('mouseup', onMouseUp);
        window.removeEventListener('touchend', onMouseUp);
        setTimeout(() => { mouseDownHandled = false; }, 50);
    };
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchend', onMouseUp);
};

const stopContinuousStep = () => {
    if (stepTimer) clearTimeout(stepTimer);
    if (stepInterval) clearInterval(stepInterval);
    stepTimer = null;
    stepInterval = null;
};

const onStepperClick = (stepFn) => {
    if (mouseDownHandled) {
        return; // Already stepped on mousedown
    }
    stepFn(); // Handle discrete clicks or synthetic test events
};

onBeforeUnmount(() => {
    stopContinuousStep();
});

const triggerDecorUpdate = (decor) => {
    if (!decor) return;
    decorVersion.value++;
    const parentWall = getDecorParentWall(decor);
    if (parentWall) {
        if (Array.isArray(parentWall.attachedDecor)) {
            parentWall.attachedDecor = [...parentWall.attachedDecor];
        }
        WallEngine.updateDecor(parentWall, decor, {}, false, props.planner);
    }
    const r = props.renderer3D || window.renderer3D || props.planner?.renderer3D || props.planner?.engine3d || window.plannerInstance?.renderer3D || window.engine3d;
    if (r && typeof r.updateWallDecorLive === 'function') {
        r.updateWallDecorLive(decor);
        if (typeof r.requestRender === 'function') r.requestRender();
    }
    emit('decor-update', decor);
    emit('ui-trigger');
};

const getDecorParentWall = (decor) => {
    if (!decor) return null;
    if (decor.parentWall) return decor.parentWall;
    if (decor.wall) return decor.wall;
    if (decor.mesh3D?.userData?.parentWall) return decor.mesh3D.userData.parentWall;
    const walls = props.planner?.walls || props.planner?.value?.walls || window.plannerInstance?.walls;
    if (Array.isArray(walls)) {
        return walls.find(w => (w.attachedDecor || []).some(d => d.id === decor.id || d === decor)) || null;
    }
    return null;
};

const getDecorWallLength = (decor) => {
    const wall = getDecorParentWall(decor);
    if (!wall) return 100;
    if (typeof wall.getLength === 'function') return Math.round(wall.getLength());
    if (wall.length3D !== undefined) return Math.round(wall.length3D);
    const p1 = wall.startAnchor || wall.p1 || { x: wall.startX || 0, y: wall.startY || 0 };
    const p2 = wall.endAnchor || wall.p2 || { x: wall.endX || 0, y: wall.endY || 0 };
    return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y)) || 100;
};

const getDecorWallHeight = (decor) => {
    const wall = getDecorParentWall(decor);
    if (!wall) return 280;
    return wall.height !== undefined ? Number(wall.height) : (wall.config?.height || 280);
};

const getDecorWidthCm = (decor) => {
    if (!decor) return 100;
    const pct = decor.width !== undefined ? decor.width : 100;
    const len = getDecorWallLength(decor);
    return Math.round(len * (pct / 100));
};

const onDecorWidthCmInput = (decor, cmVal) => {
    if (!decor) return;
    const len = getDecorWallLength(decor);
    const pct = Number(Math.min(100, Math.max(0.1, (Number(cmVal) / len) * 100)).toFixed(3));
    decor.width = pct;
    triggerDecorUpdate(decor);
};

const getDecorHeightCm = (decor) => {
    if (!decor) return 280;
    const pct = decor.height !== undefined ? decor.height : 100;
    const h = getDecorWallHeight(decor);
    return Math.round(h * (pct / 100));
};

const onDecorHeightCmInput = (decor, cmVal) => {
    if (!decor) return;
    const h = getDecorWallHeight(decor);
    const pct = Number(Math.min(100, Math.max(0.1, (Number(cmVal) / h) * 100)).toFixed(3));
    decor.height = pct;
    triggerDecorUpdate(decor);
};

const getDecorLocalXCm = (decor) => {
    if (!decor) return 50;
    const pct = decor.localX !== undefined ? decor.localX : 50;
    const len = getDecorWallLength(decor);
    return Math.round(len * (pct / 100));
};

const onDecorLocalXCmInput = (decor, cmVal) => {
    if (!decor) return;
    const len = getDecorWallLength(decor);
    const pct = Number(Math.min(100, Math.max(0, (Number(cmVal) / len) * 100)).toFixed(3));
    decor.localX = pct;
    triggerDecorUpdate(decor);
};

const getDecorLocalYCm = (decor) => {
    if (!decor) return 50;
    const pct = decor.localY !== undefined ? decor.localY : 50;
    const h = getDecorWallHeight(decor);
    return Math.round(h * (pct / 100));
};

const onDecorLocalYCmInput = (decor, cmVal) => {
    if (!decor) return;
    const h = getDecorWallHeight(decor);
    const pct = Number(Math.min(100, Math.max(0, (Number(cmVal) / h) * 100)).toFixed(3));
    decor.localY = pct;
    triggerDecorUpdate(decor);
};

const onDecorPctInput = (decor, prop, val) => {
    if (!decor) return;
    const minVal = prop.startsWith('local') ? 0 : 1;
    const num = Number(val);
    decor[prop] = Math.min(100, Math.max(minVal, isNaN(num) ? minVal : num));
    triggerDecorUpdate(decor);
};

const stepDecorProp = (decor, prop, delta) => {
    if (!decor) return;
    const cur = Number(decor[prop] !== undefined ? decor[prop] : (prop.startsWith('local') ? 50 : 100));
    const minVal = prop.startsWith('local') ? 0 : 1;
    const maxVal = 100;
    const nextVal = Math.min(maxVal, Math.max(minVal, Math.round(cur) + delta));
    decor[prop] = nextVal;
    triggerDecorUpdate(decor);
};

// CAD Reference Modes ('left' | 'right', 'floor' | 'ceiling')
const xRefMode = ref('left');
const yRefMode = ref('floor');

const toggleXRefMode = () => {
    xRefMode.value = xRefMode.value === 'left' ? 'right' : 'left';
};

const toggleYRefMode = () => {
    yRefMode.value = yRefMode.value === 'floor' ? 'ceiling' : 'floor';
};

const getDecorRefXPercent = (decor) => {
    if (!decor) return 0;
    const _t = decorVersion.value;
    const w = decor.width !== undefined ? decor.width : 100;
    const localX = decor.localX !== undefined ? decor.localX : 50;
    if (xRefMode.value === 'right') {
        return Math.max(0, Math.round(100 - (localX + w / 2)));
    }
    return Math.max(0, Math.round(localX - w / 2));
};

const getDecorRefXCm = (decor) => {
    if (!decor) return 0;
    const _t = decorVersion.value;
    const w = decor.width !== undefined ? decor.width : 100;
    const localX = decor.localX !== undefined ? decor.localX : 50;
    const wallLen = getDecorWallLength(decor);
    let pct = 0;
    if (xRefMode.value === 'right') {
        pct = Math.max(0, 100 - (localX + w / 2));
    } else {
        pct = Math.max(0, localX - w / 2);
    }
    return Math.round(wallLen * (pct / 100));
};

const onDecorRefXCmInput = (decor, cmVal) => {
    if (!decor) return;
    const wallLen = getDecorWallLength(decor);
    const w = decor.width !== undefined ? decor.width : 100;
    const refPct = Math.max(0, (Number(cmVal) / wallLen) * 100);
    let newLocalX = 50;
    if (xRefMode.value === 'right') {
        newLocalX = 100 - refPct - w / 2;
    } else {
        newLocalX = refPct + w / 2;
    }
    decor.localX = Number(Math.min(100, Math.max(0, newLocalX)).toFixed(3));
    triggerDecorUpdate(decor);
};

const onDecorRefXPctInput = (decor, val) => {
    if (!decor) return;
    const w = decor.width !== undefined ? decor.width : 100;
    const refPct = Math.max(0, Number(val) || 0);
    let newLocalX = 50;
    if (xRefMode.value === 'right') {
        newLocalX = 100 - refPct - w / 2;
    } else {
        newLocalX = refPct + w / 2;
    }
    decor.localX = Number(Math.min(100, Math.max(0, newLocalX)).toFixed(3));
    triggerDecorUpdate(decor);
};

const getDecorRefYPercent = (decor) => {
    if (!decor) return 0;
    const _t = decorVersion.value;
    const h = decor.height !== undefined ? decor.height : 100;
    const localY = decor.localY !== undefined ? decor.localY : 50;
    if (yRefMode.value === 'ceiling') {
        return Math.max(0, Math.round(100 - (localY + h / 2)));
    }
    return Math.max(0, Math.round(localY - h / 2));
};

const getDecorRefYCm = (decor) => {
    if (!decor) return 0;
    const _t = decorVersion.value;
    const h = decor.height !== undefined ? decor.height : 100;
    const localY = decor.localY !== undefined ? decor.localY : 50;
    const wallH = getDecorWallHeight(decor);
    let pct = 0;
    if (yRefMode.value === 'ceiling') {
        pct = Math.max(0, 100 - (localY + h / 2));
    } else {
        pct = Math.max(0, localY - h / 2);
    }
    return Math.round(wallH * (pct / 100));
};

const onDecorRefYCmInput = (decor, cmVal) => {
    if (!decor) return;
    const wallH = getDecorWallHeight(decor);
    const h = decor.height !== undefined ? decor.height : 100;
    const refPct = Math.max(0, (Number(cmVal) / wallH) * 100);
    let newLocalY = 50;
    if (yRefMode.value === 'ceiling') {
        newLocalY = 100 - refPct - h / 2;
    } else {
        newLocalY = refPct + h / 2;
    }
    decor.localY = Number(Math.min(100, Math.max(0, newLocalY)).toFixed(3));
    triggerDecorUpdate(decor);
};

const onDecorRefYPctInput = (decor, val) => {
    if (!decor) return;
    const h = decor.height !== undefined ? decor.height : 100;
    const refPct = Math.max(0, Number(val) || 0);
    let newLocalY = 50;
    if (yRefMode.value === 'ceiling') {
        newLocalY = 100 - refPct - h / 2;
    } else {
        newLocalY = refPct + h / 2;
    }
    decor.localY = Number(Math.min(100, Math.max(0, newLocalY)).toFixed(3));
    triggerDecorUpdate(decor);
};

const stepDecorRefProp = (decor, axis, delta) => {
    if (!decor) return;
    if (axis === 'x') {
        const curRefPct = getDecorRefXPercent(decor);
        const nextRefPct = Math.max(0, curRefPct + delta);
        onDecorRefXPctInput(decor, nextRefPct);
    } else if (axis === 'y') {
        const curRefPct = getDecorRefYPercent(decor);
        const nextRefPct = Math.max(0, curRefPct + delta);
        onDecorRefYPctInput(decor, nextRefPct);
    }
};

const alignDecor = (decor, target) => {
    if (!decor) return;
    const w = decor.width !== undefined ? decor.width : 100;
    const h = decor.height !== undefined ? decor.height : 100;

    if (target === 'left') {
        decor.localX = Number((w / 2).toFixed(3));
    } else if (target === 'center') {
        decor.localX = 50;
    } else if (target === 'right') {
        decor.localX = Number((100 - w / 2).toFixed(3));
    } else if (target === 'floor') {
        decor.localY = Number((h / 2).toFixed(3));
    } else if (target === 'middle') {
        decor.localY = 50;
    } else if (target === 'top') {
        decor.localY = Number((100 - h / 2).toFixed(3));
    } else if (target === 'full') {
        decor.width = 100;
        decor.height = 100;
        decor.localX = 50;
        decor.localY = 50;
    }
    triggerDecorUpdate(decor);
};

const isDecorAligned = (decor, target) => {
    if (!decor) return false;
    const w = decor.width !== undefined ? decor.width : 100;
    const h = decor.height !== undefined ? decor.height : 100;
    const lx = decor.localX !== undefined ? decor.localX : 50;
    const ly = decor.localY !== undefined ? decor.localY : 50;

    if (target === 'left') return Math.abs(lx - w / 2) < 0.5;
    if (target === 'center') return Math.abs(lx - 50) < 0.5;
    if (target === 'right') return Math.abs(lx - (100 - w / 2)) < 0.5;
    if (target === 'floor') return Math.abs(ly - h / 2) < 0.5;
    if (target === 'middle') return Math.abs(ly - 50) < 0.5;
    if (target === 'top') return Math.abs(ly - (100 - h / 2)) < 0.5;
    if (target === 'full') return w === 100 && h === 100 && Math.abs(lx - 50) < 0.5 && Math.abs(ly - 50) < 0.5;
    return false;
};

const flipDecorH = (decor) => {
    if (!decor) return;
    const curX = decor.localX !== undefined ? decor.localX : 50;
    decor.localX = Number((100 - curX).toFixed(3));
    triggerDecorUpdate(decor);
};

const flipDecorFace = (decor) => {
    if (!decor) return;
    const newSide = decor.side === 'front' ? 'back' : 'front';
    decor.side = newSide;
    const wall = getDecorParentWall(decor);
    if (wall) {
        WallEngine.updateDecor(wall, decor, { side: newSide }, false, props.planner);
    }
    triggerDecorUpdate(decor);
};

const stepDecorThickness = (decor, delta) => {
    if (!decor) return;
    const cur = Number(decor.depth !== undefined ? decor.depth : 0.2);
    const nextVal = Math.min(40, Math.max(0.1, Number((cur + delta).toFixed(1))));
    decor.depth = nextVal;
    triggerDecorUpdate(decor);
};

const stepDecorTileSize = (decor, delta) => {
    if (!decor) return;
    const cur = Number(decor.tileSize !== undefined ? decor.tileSize : 70);
    const nextVal = Math.min(500, Math.max(10, cur + delta));
    decor.tileSize = nextVal;
    triggerDecorUpdate(decor);
};

const getDecorRotationDeg = (decor) => {
    if (!decor) return 0;
    const rad = decor.rotation || (decor.rotationDeg !== undefined ? (Number(decor.rotationDeg) * Math.PI) / 180 : 0);
    return Math.round((Number(rad) * 180) / Math.PI) % 360;
};

const onDecorRotationInput = (decor, deg) => {
    if (!decor) return;
    const numDeg = Number(deg) || 0;
    const rad = (numDeg * Math.PI) / 180;
    decor.rotation = rad;
    decor.rotationDeg = numDeg;
    triggerDecorUpdate(decor);
};

const onDecorTileSizeInput = (decor, val) => {
    if (!decor) return;
    const num = Number(val);
    if (isNaN(num) || num <= 0) return;
    decor.tileSize = num;
    triggerDecorUpdate(decor);
};
</script>

<style scoped>
.properties-tab-body {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    background: #ffffff;
}

.props-content {
    flex: 1;
    min-height: 0;
    height: auto;
    max-height: 100%;
    overflow-y: auto;
    overflow-x: hidden;
    background: #ffffff;
    box-sizing: border-box;
    -webkit-overflow-scrolling: touch;
}

.decor-panel-root {
    padding: 10px 12px;
    box-sizing: border-box;
}

.decor-single-card {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 10px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    box-sizing: border-box;
    width: 100%;
    margin-bottom: 12px;
}

.decor-single-header {
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 6px;
    margin-bottom: 2px;
}

.decor-header-info {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.decor-kicker {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #2563eb;
}

.decor-title {
    font-size: 11.5px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
}

.decor-panel :deep(input::-webkit-outer-spin-button),
.decor-panel :deep(input::-webkit-inner-spin-button) {
    -webkit-appearance: none !important;
    margin: 0 !important;
}
.decor-panel :deep(input[type=number]) {
    -moz-appearance: textfield !important;
}

.decor-figma-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    min-height: 28px;
    box-sizing: border-box;
    width: 100%;
}

.decor-figma-label {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    flex-shrink: 0;
    min-width: 48px;
    display: flex;
    align-items: baseline;
    gap: 3px;
}

.decor-figma-label label {
    margin: 0;
    font-size: 10px;
    font-weight: 600;
    color: #475569;
}

.decor-val-badge {
    font-size: 9px;
    font-weight: 600;
    color: #2563eb;
    background: #eff6ff;
    padding: 1px 4px;
    border-radius: 4px;
    border: 1px solid #dbeafe;
}

.decor-chips-row {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.decor-chip {
    padding: 2px 4px;
    font-size: 9.5px;
    font-weight: 600;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s ease;
    line-height: 1.2;
    text-align: center;
}

.decor-chip:hover {
    color: #0f172a;
    border-color: #cbd5e1;
    background: #f1f5f9;
}

.decor-chip.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    font-weight: 700;
}

.decor-figma-grow {
    flex: 1;
}

.decor-dual-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    justify-content: flex-end;
}

.decor-pct-input-wrap,
.decor-dim-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    box-sizing: border-box;
    transition: border-color 0.15s;
}

.decor-pct-input-wrap:focus-within,
.decor-dim-input-wrap:focus-within {
    border-color: #2563eb;
    background: #ffffff;
}

.decor-pct-input-wrap {
    width: 52px;
    flex-shrink: 0;
}

.decor-pct-input-wrap.rot {
    width: 44px;
}

.decor-dim-input-wrap {
    width: 56px;
    flex-shrink: 0;
}

.decor-pct-input-wrap input[type="number"],
.decor-dim-input-wrap :deep(input),
.decor-dual-inputs :deep(input) {
    width: 100%;
    height: 24px;
    padding: 2px 14px 2px 4px;
    font-size: 10.5px;
    font-weight: 600;
    color: #0f172a;
    background: transparent;
    border: none;
    outline: none;
    text-align: right;
    box-sizing: border-box;
}

.decor-pct-suffix {
    position: absolute;
    right: 4px;
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    pointer-events: none;
}

.decor-dim-input {
    width: 56px !important;
}

.decor-divider {
    height: 1px;
    background: #f1f5f9;
    margin: 4px 0;
}

/* Figma-Style 2x2 Grid for Pattern Layer */
.decor-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
}

.decor-figma-grid-cell {
    display: flex;
    align-items: center;
    gap: 3px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 2px 4px;
    min-height: 26px;
    box-sizing: border-box;
    position: relative;
    transition: all 0.15s ease;
}

.decor-figma-grid-cell:focus-within {
    border-color: #2563eb;
    background: #ffffff;
    box-shadow: 0 0 0 1px #2563eb;
}

.decor-cell-prefix {
    font-size: 9.5px;
    font-weight: 700;
    color: #64748b;
    background: #e2e8f0;
    padding: 2px 4px;
    border-radius: 3px;
    line-height: 1;
    flex-shrink: 0;
    user-select: none;
}

.decor-cell-input-box {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    position: relative;
}

.decor-cell-dim,
.decor-cell-input-box :deep(input) {
    width: 100% !important;
    height: 22px !important;
    padding: 1px 16px 1px 2px !important;
    font-size: 11px !important;
    font-weight: 600 !important;
    color: #0f172a !important;
    background: transparent !important;
    border: none !important;
    outline: none !important;
    text-align: right !important;
    box-sizing: border-box !important;
}

.decor-cell-unit {
    position: absolute;
    right: 2px;
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    pointer-events: none;
}

.decor-edge-chips {
    display: flex;
    align-items: center;
    gap: 10px;
}

.decor-edge-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    margin: 0;
}

/* Option C: CAD Compact Micro-Cards */
.decor-cad-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 6px 7px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    box-sizing: border-box;
    width: 100%;
    margin-top: 4px;
}

.decor-cad-card-header {
    display: flex;
    align-items: center;
    padding-bottom: 2px;
    border-bottom: 1px solid #edf2f7;
}

.decor-cad-card-title {
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #94a3b8;
}

/* CAD Single-line Rows */
.decor-cad-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 22px;
    width: 100%;
    box-sizing: border-box;
}

.decor-cad-label {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    flex-shrink: 0;
    min-width: 52px;
}

.decor-cad-controls {
    display: flex;
    align-items: center;
    gap: 3px;
    justify-content: flex-end;
    flex: 1;
    min-width: 0;
}

.decor-cad-chips {
    display: flex;
    align-items: center;
    gap: 1px;
}

.decor-cad-chip {
    padding: 2px 4px !important;
    font-size: 9px !important;
    font-weight: 600 !important;
    color: #64748b !important;
    background: #ffffff !important;
    border: 1px solid #cbd5e1 !important;
    border-radius: 3px !important;
    cursor: pointer;
    line-height: 1.2 !important;
    transition: all 0.12s ease;
    min-width: 20px;
    text-align: center;
}

.decor-cad-chip:hover {
    border-color: #94a3b8 !important;
    color: #0f172a !important;
    background: #f1f5f9 !important;
}

.decor-cad-chip.active {
    background: #2563eb !important;
    border-color: #2563eb !important;
    color: #ffffff !important;
    font-weight: 700 !important;
}

.decor-cad-input-box {
    position: relative;
    display: flex;
    align-items: center;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 4px;
    height: 22px;
    width: 44px;
    flex-shrink: 0;
    box-sizing: border-box;
    transition: border-color 0.15s;
    overflow: hidden;
}

.decor-cad-input-box.rot {
    width: 38px;
    display: flex;
    align-items: center;
}

.decor-cad-input-box.decor-cad-thickness-box {
    width: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.decor-cad-input-box.decor-cad-tilesize-box {
    width: 66px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.decor-cad-input-box:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37,99,235,0.15);
}

.decor-cad-dim,
.decor-cad-num,
.decor-cad-input-box :deep(input) {
    width: 100% !important;
    height: 20px !important;
    padding: 0 2px !important;
    font-size: 10px !important;
    font-weight: 600 !important;
    color: #0f172a !important;
    background: transparent !important;
    border: none !important;
    outline: none !important;
    text-align: right !important;
    box-sizing: border-box !important;
    -moz-appearance: textfield !important;
}

.decor-cad-input-box :deep(input::-webkit-outer-spin-button),
.decor-cad-input-box :deep(input::-webkit-inner-spin-button),
.decor-cad-cell-input :deep(input::-webkit-outer-spin-button),
.decor-cad-cell-input :deep(input::-webkit-inner-spin-button),
.decor-cad-num::-webkit-outer-spin-button,
.decor-cad-num::-webkit-inner-spin-button {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.decor-cad-num,
.decor-cad-input-box :deep(input[type=number]),
.decor-cad-cell-input :deep(input[type=number]) {
    -moz-appearance: textfield !important;
}

.decor-cad-unit-inline {
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    padding-right: 3px;
    flex-shrink: 0;
    line-height: 1;
}

.decor-cad-cell-unit {
    font-size: 9px !important;
    font-weight: 600 !important;
    color: #94a3b8 !important;
    margin-left: 2px !important;
    line-height: 1 !important;
    flex-shrink: 0 !important;
    user-select: none !important;
}

/* CAD 2x2 Grid (Placement & Bounds) */
.decor-cad-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    width: 100%;
    box-sizing: border-box;
}

.decor-cad-grid-cell {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 2px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    padding: 3px 5px;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
    min-height: 44px;
}

.decor-cad-grid-cell:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37,99,235,0.15);
}

.decor-cad-cell-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.decor-cad-cell-label {
    font-size: 9.5px;
    font-weight: 700;
    color: #475569;
}

.decor-cad-cell-cm-wrap {
    display: flex;
    align-items: center;
    gap: 1px;
}

.decor-cad-dim-sub,
.decor-cad-cell-cm-wrap :deep(input) {
    width: 38px !important;
    height: 14px !important;
    padding: 0 1px !important;
    font-size: 9px !important;
    font-weight: 500 !important;
    color: #64748b !important;
    background: transparent !important;
    border: none !important;
    outline: none !important;
    text-align: right !important;
    box-sizing: border-box !important;
    -moz-appearance: textfield !important;
}

.decor-cad-dim-sub:focus,
.decor-cad-cell-cm-wrap :deep(input:focus) {
    color: #0f172a !important;
    font-weight: 700 !important;
}

.decor-cad-dim-sub::-webkit-outer-spin-button,
.decor-cad-dim-sub::-webkit-inner-spin-button,
.decor-cad-cell-cm-wrap :deep(input::-webkit-outer-spin-button),
.decor-cad-cell-cm-wrap :deep(input::-webkit-inner-spin-button) {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.decor-cad-sub-unit {
    font-size: 8px;
    font-weight: 500;
    color: #94a3b8;
}

.decor-cad-cell-bot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2px;
    width: 100%;
    background: #f8fafc;
    border-radius: 4px;
    padding: 1px 2px;
    border: 1px solid #f1f5f9;
    box-sizing: border-box;
}

.decor-cad-pct-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
}

.decor-cad-pct-input {
    width: 26px !important;
    height: 18px !important;
    padding: 0 !important;
    font-size: 11px !important;
    font-weight: 700 !important;
    color: #0f172a !important;
    background: transparent !important;
    border: none !important;
    outline: none !important;
    text-align: right !important;
    box-sizing: border-box !important;
    -moz-appearance: textfield !important;
}

.decor-cad-pct-input::-webkit-outer-spin-button,
.decor-cad-pct-input::-webkit-inner-spin-button {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.decor-cad-pct-unit {
    font-size: 9px;
    font-weight: 600;
    color: #2563eb;
    margin-left: 1px;
}

.decor-cad-stepper {
    width: 16px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 3px;
    color: #64748b;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    padding: 0;
    flex-shrink: 0;
    line-height: 1;
    transition: all 0.12s ease;
    user-select: none;
}

.decor-cad-stepper:hover {
    color: #2563eb;
    border-color: #2563eb;
    background: #eff6ff;
}

.decor-cad-stepper:active {
    color: #ffffff;
    background: #2563eb;
    border-color: #2563eb;
}

/* CAD Header Action Buttons (Flip H, Flip Face) */
.decor-cad-actions-inline {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
}

.decor-cad-action-btn {
    padding: 1px 5px;
    font-size: 8.5px;
    font-weight: 600;
    color: #475569;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    cursor: pointer;
    line-height: 1.3;
    transition: all 0.12s ease;
    white-space: nowrap;
}

.decor-cad-action-btn:hover {
    border-color: #2563eb;
    color: #2563eb;
    background: #eff6ff;
}

/* CAD 1-Click Alignment Toolbar */
.decor-cad-align-bar {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
    background: #f1f5f9;
    border-radius: 4px;
    margin-bottom: 4px;
    box-sizing: border-box;
}

.decor-cad-align-row {
    display: flex;
    align-items: center;
    gap: 4px;
}

.decor-cad-align-label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #64748b;
    min-width: 38px;
    flex-shrink: 0;
}

.decor-cad-align-group {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
}

.decor-cad-align-btn {
    flex: 1;
    padding: 2px 3px;
    font-size: 8.5px;
    font-weight: 600;
    color: #475569;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
    line-height: 1.3;
    transition: all 0.12s ease;
}

.decor-cad-align-btn:hover {
    border-color: #2563eb;
    color: #2563eb;
    background: #eff6ff;
}

.decor-cad-align-btn.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    font-weight: 700;
}

.decor-cad-align-btn.fill-btn {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #1e293b;
    font-weight: 700;
}

.decor-cad-align-btn.fill-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}

/* CAD Reference Mode Toggle in Cell Label */
.decor-cad-cell-label-wrap {
    display: flex;
    align-items: center;
    gap: 3px;
}

.decor-cad-ref-toggle {
    padding: 0 3px;
    font-size: 7.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    color: #2563eb;
    background: #eff6ff;
    border: 1px solid #bfdbfe;
    border-radius: 3px;
    cursor: pointer;
    line-height: 1.4;
    transition: all 0.12s ease;
    white-space: nowrap;
}

.decor-cad-ref-toggle:hover {
    background: #2563eb;
    color: #ffffff;
    border-color: #2563eb;
}

.sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
}
</style>
