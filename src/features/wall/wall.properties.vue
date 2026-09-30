<template>
    <div class="props-panel-inner">
        <!-- Panel Header -->
        <div class="pro-panel-header">
            <div class="pro-title-wrap">
                <div class="pro-title-icon">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                        <line x1="3" y1="9" x2="21" y2="9"/>
                        <line x1="9" y1="21" x2="9" y2="9"/>
                    </svg>
                </div>
                <span class="pro-title-text">{{ panelTitle }}</span>
            </div>
            <span class="pro-id-badge" v-if="selectedEntity?.id">#{{ String(selectedEntity.id).slice(-4) }}</span>
        </div>
        
        <div class="control-group" v-if="selectedEntity.type === 'compound'">
            <label>Include Floor Slab</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="selectedEntity.hasFloor" @change="onCompoundFloorToggle">
            </div>
        </div>
        
        <div class="control-group">
            <label>Hidden Wall</label>
            <div class="input-wrap" style="justify-content: flex-end;">
                <input type="checkbox" v-model="selectedEntity.hidden" @change="$emit('sync-engine')">
            </div>
        </div>
        
        <div class="control-group" v-if="selectedEntity.type !== 'railing'">
            <label>Length (Width)</label>
            <div class="input-wrap">
                <input type="range" :value="currentWallLength" min="10" max="1500" step="1" @input="updateWallLength($event.target.value)">
                <DimensionInput :model-value="currentWallLength" min="10" max="1500" step="1" @update:model-value="updateWallLength($event)" />
            </div>
        </div>
        
        <div class="control-group">
            <label>Thickness</label>
            <div class="input-wrap">
                <input type="range" :value="selectedEntity.thickness" min="1" max="100" step="1" @input="updateThickness($event.target.value)">
                <DimensionInput :model-value="selectedEntity.thickness" min="1" max="100" step="1" @update:model-value="updateThickness($event)" />
            </div>
        </div>

        <div class="control-group profile-group" v-if="selectedEntity.type !== 'railing'">
            <label>Top Profile</label>
            <div class="pro-segmented-grid">
                <button 
                    type="button" 
                    class="pro-profile-btn" 
                    :class="{ active: !selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal' }" 
                    @click="setTopProfile('normal')" 
                    title="Flat Wall"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="6" width="16" height="14" rx="2"/></svg>
                    <span>Flat</span>
                </button>
                <button 
                    type="button" 
                    class="pro-profile-btn" 
                    :class="{ active: selectedEntity.topProfileType === 'single' }" 
                    @click="setTopProfile('single')" 
                    title="Single Slope"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16V6l-16 8v6z"/></svg>
                    <span>Slope</span>
                </button>
                <button 
                    type="button" 
                    class="pro-profile-btn" 
                    :class="{ active: selectedEntity.topProfileType === 'gable' }" 
                    @click="setTopProfile('gable')" 
                    title="Gable Slope"
                >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h16V10L12 4 4 10v10z"/></svg>
                    <span>Gable</span>
                </button>
            </div>
        </div>

        <div v-if="!selectedEntity.topProfileType || selectedEntity.topProfileType === 'normal' || selectedEntity.type === 'railing'" class="control-group">
            <label>Height</label>
            <div class="input-wrap">
                <input type="range" :value="selectedEntity.height" min="0" max="500" step="1" @input="updateHeight($event.target.value)">
                <DimensionInput :model-value="selectedEntity.height" min="0" max="500" step="1" @update:model-value="updateHeight($event)" />
            </div>
        </div>

        <div v-if="selectedEntity.type === 'foundation'" class="control-group preset-row">
            <label>Plinth Presets</label>
            <div class="pro-chip-group">
                <button v-for="h in [20, 40, 60, 80]" :key="h" 
                        type="button"
                        class="pro-chip-btn" 
                        :class="{ active: selectedEntity.height === h }"
                        @click="updateHeight(h)">
                    {{ h }} cm
                </button>
            </div>
        </div>

        <div v-if="selectedEntity.type === 'half_wall'" class="control-group preset-row">
            <label>Parapet Presets</label>
            <div class="pro-chip-group">
                <button v-for="h in [30, 50, 80, 100]" :key="h" 
                        type="button"
                        class="pro-chip-btn" 
                        :class="{ active: selectedEntity.height === h }"
                        @click="updateHeight(h)">
                    {{ h }} cm
                </button>
            </div>
        </div>

        <template v-else-if="selectedEntity.topProfileType && selectedEntity.topProfileType !== 'normal'">
            <div class="control-group">
                <label>Start Height</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.startHeight" min="0" max="500" step="1" @input="updateSlopeProp('startHeight', $event.target.value)">
                    <DimensionInput :model-value="selectedEntity.startHeight" min="0" max="500" step="1" @update:model-value="updateSlopeProp('startHeight', $event)" />
                </div>
            </div>
            <div class="control-group" v-if="selectedEntity.topProfileType === 'gable'">
                <label>Peak Height</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.peakHeight" min="0" max="500" step="1" @input="updateSlopeProp('peakHeight', $event.target.value)">
                    <DimensionInput :model-value="selectedEntity.peakHeight" min="0" max="500" step="1" @update:model-value="updateSlopeProp('peakHeight', $event)" />
                </div>
            </div>
            <div class="control-group">
                <label>End Height</label>
                <div class="input-wrap">
                    <input type="range" :value="selectedEntity.endHeight" min="0" max="500" step="1" @input="updateSlopeProp('endHeight', $event.target.value)">
                    <DimensionInput :model-value="selectedEntity.endHeight" min="0" max="500" step="1" @update:model-value="updateSlopeProp('endHeight', $event)" />
                </div>
            </div>
        </template>

        <!-- Wall Elevation (from floor) -->
        <div class="control-group" v-if="selectedEntity.type !== 'railing'">
            <label>Elevation</label>
            <div class="input-wrap">
                <input type="range" :value="selectedEntity.elevation || 0" min="0" max="500" step="1" @input="updateElevation($event.target.value)">
                <DimensionInput :model-value="selectedEntity.elevation || 0" min="0" max="500" step="1" @update:model-value="updateElevation($event)" />
            </div>
        </div>

        <!-- Wall Coordinates & Spatial Readout (Legacy xyPanel equivalent) -->
        <div class="pro-coords-card" v-if="selectedEntity.type !== 'railing'">
            <div class="pro-coords-header">
                <span class="pro-coords-title">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"/>
                    </svg>
                    Placement & Coordinates
                </span>
                <span class="pro-coords-elev">Z: {{ wallSpatialCoords.elevation }} cm</span>
            </div>
            <div class="pro-coords-grid">
                <div class="pro-coord-item">
                    <span class="pro-coord-label">Center (X, Y)</span>
                    <span class="pro-coord-val">X: {{ wallSpatialCoords.center.x }} cm, Y: {{ wallSpatialCoords.center.y }} cm</span>
                </div>
                <div class="pro-coord-item">
                    <span class="pro-coord-label">Start ➔ End</span>
                    <span class="pro-coord-val">({{ wallSpatialCoords.start.x }}, {{ wallSpatialCoords.start.y }}) ➔ ({{ wallSpatialCoords.end.x }}, {{ wallSpatialCoords.end.y }})</span>
                </div>
            </div>
        </div>

        <div v-if="selectedEntity.type === 'railing'">
            <div class="decor-gallery">
                <h4 class="props-subtitle">Railing Material</h4>
                <div class="decor-grid">
                    <div v-for="(config, key) in railingRegistry" :key="key" class="decor-item" @click="selectedEntity.configId = key; $emit('ui-trigger'); $emit('sync-engine')" :class="{ active: (selectedEntity.configId || 'glass_frameless') === key && uiTrigger !== -1 }">
                        <img :src="railingThumbnails[key]" @error="handleImageError" />
                        <span>{{ config.name }}</span>
                    </div>
                </div>
            </div>
        </div>
        <div v-else class="pro-materials-section">
            <div class="pro-section-divider">
                <span class="pro-divider-label">Wall Materials & Finishes</span>
            </div>

            <!-- Face Selection & Filter Switch with Count Badges -->
            <div class="pro-segmented-switch">
                <button 
                    type="button" 
                    class="pro-switch-btn" 
                    :class="{ active: materialFilterFace === 'all' }"
                    @click="materialFilterFace = 'all'"
                >
                    <span>All</span>
                    <span class="pro-count-badge" v-if="allAppliedMaterials.length > 0">{{ allAppliedMaterials.length }}</span>
                </button>
                <button 
                    type="button" 
                    class="pro-switch-btn" 
                    :class="{ active: materialFilterFace === 'front' }"
                    @click="setFaceFilter('front')"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                    </svg>
                    <span>Inner</span>
                    <span class="pro-count-badge" v-if="innerFaceMaterialsCount > 0">{{ innerFaceMaterialsCount }}</span>
                </button>
                <button 
                    type="button" 
                    class="pro-switch-btn" 
                    :class="{ active: materialFilterFace === 'back' }"
                    @click="setFaceFilter('back')"
                >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="2" y1="12" x2="22" y2="12"/>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                    </svg>
                    <span>Outer</span>
                    <span class="pro-count-badge" v-if="outerFaceMaterialsCount > 0">{{ outerFaceMaterialsCount }}</span>
                </button>
            </div>

            <!-- Paint Scope Selector (3D View) -->
            <div class="pro-scope-card" v-if="viewMode === '3d'">
                <div class="pro-scope-header">
                    <span class="pro-scope-title">Paint Scope (3D View)</span>
                </div>
                <div class="pro-scope-btn-group">
                    <button 
                        type="button"
                        class="pro-scope-btn" 
                        :class="{ active: paintScope === 'single' }" 
                        @click="paintScope = 'single'"
                        title="Paint clicked face only"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                        <span>Single</span>
                    </button>
                    <button 
                        type="button"
                        class="pro-scope-btn" 
                        :class="{ active: paintScope === 'room' }" 
                        @click="paintScope = 'room'"
                        title="Paint all interior walls of this room (Shortcut: Shift)"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
                        <span>Room</span>
                        <kbd class="pro-kbd">Shift</kbd>
                    </button>
                    <button 
                        type="button"
                        class="pro-scope-btn" 
                        :class="{ active: paintScope === 'exterior' }" 
                        @click="paintScope = 'exterior'"
                        title="Paint entire exterior facade (Shortcut: Alt)"
                    >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16V6l-16 8v8z"/></svg>
                        <span>Facade</span>
                        <kbd class="pro-kbd">Alt</kbd>
                    </button>
                </div>
            </div>

            <!-- APPLIED MATERIALS SECTION -->
            <div class="pro-applied-section">
                <div class="pro-section-subhead">
                    <span>Applied Materials ({{ filteredAppliedMaterials.length }})</span>
                    <span v-if="activeEditMatId" class="pro-editing-indicator">Editing Active</span>
                </div>

                <!-- 1. The Applied Materials List -->
                <div class="pro-materials-list" v-if="filteredAppliedMaterials.length > 0">
                    <div 
                        v-for="item in filteredAppliedMaterials" 
                        :key="item.id" 
                        class="pro-mat-list-card"
                        :class="{ 'is-editing': activeEditMatId === item.id }"
                        @click="selectMaterialForEdit(item)"
                    >
                        <div class="pro-mat-list-thumb">
                            <img v-if="item.thumbnail" :src="item.thumbnail" class="pro-mat-thumb" @error="handleImageError" />
                            <div v-else class="pro-mat-thumb-placeholder">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                            </div>
                        </div>

                        <div class="pro-mat-list-info">
                            <div class="pro-mat-list-row">
                                <span class="pro-mat-list-title">{{ item.name }}</span>
                                <span v-if="activeEditMatId === item.id" class="pro-badge-editing">EDITING</span>
                            </div>
                            <div class="pro-mat-list-meta">
                                <span class="pro-mat-badge" :class="item.side">{{ item.sideLabel }}</span>
                                <span class="pro-mat-badge type" :class="item.type">{{ item.type === 'base' ? 'Base Finish' : 'Pattern Layer' }}</span>
                                <span class="pro-mat-list-metric">{{ item.summary }}</span>
                            </div>
                        </div>

                        <div class="pro-mat-list-actions" @click.stop>
                            <button 
                                type="button" 
                                class="pro-btn-action edit"
                                :class="{ active: activeEditMatId === item.id }"
                                :title="activeEditMatId === item.id ? 'Close Properties' : 'Edit Properties'"
                                @click="toggleEditMaterial(item)"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                </svg>
                                <span>{{ activeEditMatId === item.id ? 'Hide' : 'Edit' }}</span>
                            </button>
                            <button 
                                type="button" 
                                class="pro-btn-action delete" 
                                title="Delete this applied material"
                                @click="deleteItem(item)"
                            >
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- 2. Empty State (No Materials Applied) -->
                <div class="pro-empty-card" v-if="filteredAppliedMaterials.length === 0">
                    <div class="pro-empty-icon">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>
                            <circle cx="7.5" cy="10.5" r=".75" fill="currentColor"/>
                            <circle cx="12" cy="7.5" r=".75" fill="currentColor"/>
                            <circle cx="16.5" cy="10.5" r=".75" fill="currentColor"/>
                        </svg>
                    </div>
                    <div class="pro-empty-title">Default Plaster Finish</div>
                    <div class="pro-empty-desc">
                        {{ materialFilterFace === 'all' ? 'No custom materials applied on this wall.' : `No custom materials applied on ${materialFilterFace === 'front' ? 'Inner Face' : 'Outer Face'}.` }}
                    </div>
                    <div class="pro-empty-hint">Use the Global Material tool in 3D to paint this wall.</div>
                </div>

                <!-- 3. PARAMETRIC PROPERTIES INSPECTOR (For the currently edited material) -->
                <div class="pro-inspector-box" v-if="activeEditItem">
                    <div class="pro-inspector-header">
                        <div class="pro-inspector-title-row">
                            <span class="pro-inspector-kicker">Material Properties</span>
                            <span class="pro-inspector-title">{{ activeEditItem.name }}</span>
                        </div>
                        <button type="button" class="pro-inspector-btn-done" @click="activeEditMatId = null">
                            ✓ Done
                        </button>
                    </div>

                    <!-- SUB-CASE A: BASE WALL MATERIAL CONTROLS -->
                    <template v-if="activeEditItem.type === 'base'">
                        <!-- Card 1: Tiling & Orientation -->
                        <div class="pro-cad-card">
                            <div class="pro-cad-card-header">
                                <span class="pro-cad-card-title">Tiling & Orientation</span>
                            </div>

                            <!-- 1. Tile Size -->
                            <div class="pro-cad-row">
                                <span class="pro-cad-label">Tile Size</span>
                                <div class="pro-cad-controls">
                                    <div class="pro-cad-chips">
                                        <button 
                                            v-for="size in [50, 70, 100, 150]" 
                                            :key="size" 
                                            type="button" 
                                            class="pro-cad-chip" 
                                            :class="{ active: currentBaseTileSize === size }"
                                            @click="onBaseTileSizeInput(activeEditItem.side, size)"
                                        >
                                            {{ size }}
                                        </button>
                                    </div>
                                    <div class="pro-cad-input-box">
                                        <DimensionInput 
                                            :model-value="currentBaseTileSize" 
                                            min="10" 
                                            max="300" 
                                            step="5" 
                                            class="pro-cad-dim"
                                            @update:model-value="val => onBaseTileSizeInput(activeEditItem.side, val)" 
                                        />
                                    </div>
                                    <span class="pro-cad-cell-unit">cm</span>
                                </div>
                                <span class="sr-only">{{ currentBaseTileSize }} cm</span>
                            </div>

                            <!-- 2. Rotation -->
                            <div class="pro-cad-row">
                                <span class="pro-cad-label">Rotation</span>
                                <div class="pro-cad-controls">
                                    <div class="pro-cad-chips">
                                        <button 
                                            v-for="deg in [0, 45, 90, 180, 270]" 
                                            :key="deg" 
                                            type="button" 
                                            class="pro-cad-chip pro-track-btn" 
                                            :class="{ active: currentBaseRotationDeg === deg }"
                                            @click="onBaseRotationInput(activeEditItem.side, deg)"
                                        >
                                            {{ deg }}°
                                        </button>
                                    </div>
                                    <div class="pro-cad-input-box rot">
                                        <input 
                                            type="number" 
                                            :value="currentBaseRotationDeg" 
                                            min="0" 
                                            max="360" 
                                            step="1" 
                                            class="pro-cad-num"
                                            @input="onBaseRotationInput(activeEditItem.side, $event.target.value)" 
                                        />
                                        <span class="pro-cad-unit-inline">°</span>
                                    </div>
                                </div>
                                <span class="sr-only">{{ currentBaseRotationDeg }}°</span>
                            </div>

                            <!-- 3. Thickness (Depth) -->
                            <div class="pro-cad-row">
                                <span class="pro-cad-label">Thickness</span>
                                <div class="pro-cad-controls">
                                    <div class="pro-cad-input-box pro-cad-thickness-box">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => onBaseDepthChange(activeEditItem, Math.max(0.1, Number(((activeEditItem.depth || 0.2) - 0.1).toFixed(1)))))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => onBaseDepthChange(activeEditItem, Math.max(0.1, Number(((activeEditItem.depth || 0.2) - 0.1).toFixed(1)))))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => onBaseDepthChange(activeEditItem, Math.max(0.1, Number(((activeEditItem.depth || 0.2) - 0.1).toFixed(1)))))"
                                        >−</button>
                                        <DimensionInput 
                                            :model-value="0.2" 
                                            min="0.1" 
                                            max="40" 
                                            step="0.1" 
                                            class="pro-cad-dim"
                                            @update:model-value="val => onBaseDepthChange(activeEditItem, val)" 
                                        />
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => onBaseDepthChange(activeEditItem, Math.min(40, Number(((activeEditItem.depth || 0.2) + 0.1).toFixed(1)))))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => onBaseDepthChange(activeEditItem, Math.min(40, Number(((activeEditItem.depth || 0.2) + 0.1).toFixed(1)))))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => onBaseDepthChange(activeEditItem, Math.min(40, Number(((activeEditItem.depth || 0.2) + 0.1).toFixed(1)))))"
                                        >+</button>
                                    </div>
                                    <span class="pro-cad-cell-unit">cm</span>
                                </div>
                                <span class="sr-only">0.2 cm</span>
                            </div>
                        </div>

                        <!-- Card 2: Placement & Bounds -->
                        <div class="pro-cad-card">
                            <div class="pro-cad-card-header">
                                <span class="pro-cad-card-title">Placement & Bounds</span>
                            </div>

                            <div class="pro-cad-grid-2col">
                                <!-- W (Width) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Width: 100% ({{ currentWallLength }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <span class="pro-cad-cell-label">W</span>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="currentWallLength" 
                                                min="1" 
                                                :max="currentWallLength" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="val => onBaseDimensionCmChange(activeEditItem, 'width', val)" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'width', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'width', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'width', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                value="100" 
                                                min="1" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @change="onBaseDimensionChange(activeEditItem, 'width', $event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'width', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'width', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'width', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Width 100% ({{ currentWallLength }} cm)</span>
                                </div>

                                <!-- H (Height) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Height: 100% ({{ currentWallHeight }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <span class="pro-cad-cell-label">H</span>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="currentWallHeight" 
                                                min="1" 
                                                :max="currentWallHeight" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="val => onBaseDimensionCmChange(activeEditItem, 'height', val)" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'height', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'height', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'height', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                value="100" 
                                                min="1" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @change="onBaseDimensionChange(activeEditItem, 'height', $event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'height', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'height', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'height', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Height 100% ({{ currentWallHeight }} cm)</span>
                                </div>

                                <!-- X (Offset X) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Offset X: 50% ({{ Math.round(currentWallLength / 2) }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <span class="pro-cad-cell-label">X</span>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="Math.round(currentWallLength / 2)" 
                                                min="0" 
                                                :max="currentWallLength" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="val => onBaseDimensionCmChange(activeEditItem, 'localX', val)" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'localX', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'localX', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'localX', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                value="50" 
                                                min="0" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @change="onBaseDimensionChange(activeEditItem, 'localX', $event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'localX', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'localX', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'localX', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Offset X 50% ({{ Math.round(currentWallLength / 2) }} cm)</span>
                                </div>

                                <!-- Y (Offset Y) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Offset Y: 50% ({{ Math.round(currentWallHeight / 2) }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <span class="pro-cad-cell-label">Y</span>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="Math.round(currentWallHeight / 2)" 
                                                min="0" 
                                                :max="currentWallHeight" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="val => onBaseDimensionCmChange(activeEditItem, 'localY', val)" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'localY', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'localY', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'localY', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                value="50" 
                                                min="0" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @change="onBaseDimensionChange(activeEditItem, 'localY', $event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepBaseProp(activeEditItem, 'localY', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepBaseProp(activeEditItem, 'localY', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepBaseProp(activeEditItem, 'localY', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Offset Y 50% ({{ Math.round(currentWallHeight / 2) }} cm)</span>
                                </div>
                            </div>
                        </div>

                        <!-- Remove Base Material Button -->
                        <button type="button" class="pro-btn-remove-compact" @click="deleteItem(activeEditItem)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                            <span>Remove Material from {{ activeEditItem.sideLabel }}</span>
                        </button>
                    </template>

                    <!-- SUB-CASE B: ATTACHED PATTERN LAYER CONTROLS -->
                    <template v-else-if="activeEditItem.type === 'decor'">
                        <!-- Edge Returns / Bevels -->
                        <div class="pro-figma-row" v-if="activeEditItem.decor.faces">
                            <span class="pro-figma-label">Bevel Wrap</span>
                            <div class="pro-edge-inline">
                                <label class="pro-checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        :checked="!!activeEditItem.decor.faces.left" 
                                        @change="onDecorEdgeChange(activeEditItem.decor, 'left', $event.target.checked)"
                                    >
                                    <span>Left</span>
                                </label>
                                <label class="pro-checkbox-label">
                                    <input 
                                        type="checkbox" 
                                        :checked="!!activeEditItem.decor.faces.right" 
                                        @change="onDecorEdgeChange(activeEditItem.decor, 'right', $event.target.checked)"
                                    >
                                    <span>Right</span>
                                </label>
                            </div>
                        </div>

                        <!-- Card 1: Tiling & Orientation -->
                        <div class="pro-cad-card">
                            <div class="pro-cad-card-header">
                                <span class="pro-cad-card-title">Tiling & Orientation</span>
                            </div>

                            <!-- 1. Tile Size -->
                            <div class="pro-cad-row">
                                <span class="pro-cad-label">Tile Size</span>
                                <div class="pro-cad-controls">
                                    <div class="pro-cad-chips">
                                        <button 
                                            v-for="size in [50, 70, 100, 150]" 
                                            :key="size" 
                                            type="button" 
                                            class="pro-cad-chip" 
                                            :class="{ active: (activeEditItem.decor.tileSize || 70) === size }"
                                            @click="onDecorPropChange(activeEditItem.decor, 'tileSize', size)"
                                        >
                                            {{ size }}
                                        </button>
                                    </div>
                                    <div class="pro-cad-input-box">
                                        <DimensionInput 
                                            :model-value="activeEditItem.decor.tileSize || 70" 
                                            min="10" 
                                            max="300" 
                                            step="5" 
                                            class="pro-cad-dim"
                                            @update:model-value="val => onDecorPropChange(activeEditItem.decor, 'tileSize', val)" 
                                        />
                                    </div>
                                    <span class="pro-cad-cell-unit">cm</span>
                                </div>
                                <span class="sr-only">{{ activeEditItem.decor.tileSize || 70 }} cm</span>
                            </div>

                            <!-- 2. Rotation -->
                            <div class="pro-cad-row">
                                <span class="pro-cad-label">Rotation</span>
                                <div class="pro-cad-controls">
                                    <div class="pro-cad-chips">
                                        <button 
                                            v-for="deg in [0, 45, 90, 180, 270]" 
                                            :key="deg" 
                                            type="button" 
                                            class="pro-cad-chip pro-track-btn" 
                                            :class="{ active: decorRotationDeg === deg }"
                                            @click="onDecorRotationInput(activeEditItem.decor, deg)"
                                        >
                                            {{ deg }}°
                                        </button>
                                    </div>
                                    <div class="pro-cad-input-box rot">
                                        <input 
                                            type="number" 
                                            :value="decorRotationDeg" 
                                            min="0" 
                                            max="360" 
                                            step="1" 
                                            class="pro-cad-num"
                                            @input="onDecorRotationInput(activeEditItem.decor, $event.target.value)" 
                                        />
                                        <span class="pro-cad-unit-inline">°</span>
                                    </div>
                                </div>
                                <span class="sr-only">{{ decorRotationDeg }}°</span>
                            </div>

                            <!-- 3. Thickness (Depth) -->
                            <div class="pro-cad-row">
                                <span class="pro-cad-label">Thickness</span>
                                <div class="pro-cad-controls">
                                    <div class="pro-cad-input-box pro-cad-thickness-box">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => onDecorPropChange(activeEditItem.decor, 'depth', Math.max(0.1, Number(((activeEditItem.decor.depth || 0.2) - 0.1).toFixed(1)))))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => onDecorPropChange(activeEditItem.decor, 'depth', Math.max(0.1, Number(((activeEditItem.decor.depth || 0.2) - 0.1).toFixed(1)))))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => onDecorPropChange(activeEditItem.decor, 'depth', Math.max(0.1, Number(((activeEditItem.decor.depth || 0.2) - 0.1).toFixed(1)))))"
                                        >−</button>
                                        <DimensionInput 
                                            :model-value="activeEditItem.decor.depth || 0.2" 
                                            min="0.1" 
                                            max="40" 
                                            step="0.1" 
                                            class="pro-cad-dim"
                                            @update:model-value="onDecorPropChange(activeEditItem.decor, 'depth', $event)" 
                                        />
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => onDecorPropChange(activeEditItem.decor, 'depth', Math.min(40, Number(((activeEditItem.decor.depth || 0.2) + 0.1).toFixed(1)))))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => onDecorPropChange(activeEditItem.decor, 'depth', Math.min(40, Number(((activeEditItem.decor.depth || 0.2) + 0.1).toFixed(1)))))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => onDecorPropChange(activeEditItem.decor, 'depth', Math.min(40, Number(((activeEditItem.decor.depth || 0.2) + 0.1).toFixed(1)))))"
                                        >+</button>
                                    </div>
                                    <span class="pro-cad-cell-unit">cm</span>
                                </div>
                                <span class="sr-only">{{ activeEditItem.decor.depth || 0.2 }} cm</span>
                            </div>
                        </div>

                        <!-- Card 2: Placement & Bounds -->
                        <div class="pro-cad-card">
                            <div class="pro-cad-card-header">
                                <span class="pro-cad-card-title">Placement & Bounds</span>
                                <div class="pro-cad-actions-inline">
                                    <button type="button" class="pro-cad-action-btn" title="Flip Horizontal (Mirror across wall center)" @click="flipDecorH(activeEditItem.decor)">
                                        ⇄ Flip H
                                    </button>
                                    <button type="button" class="pro-cad-action-btn" title="Flip Face (Move between Inner and Outer face)" @click="flipDecorFace(activeEditItem.decor)">
                                        ⇄ {{ activeEditItem.decor.side === 'front' ? 'To Outer' : 'To Inner' }}
                                    </button>
                                </div>
                            </div>

                            <!-- 1-Click Alignment Toolbar -->
                            <div class="pro-cad-align-bar">
                                <div class="pro-cad-align-row">
                                    <span class="pro-cad-align-label">H Align</span>
                                    <div class="pro-cad-align-group">
                                        <button type="button" class="pro-cad-align-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'left') }" title="Align Left (Flush against left corner)" @click="alignDecor(activeEditItem.decor, 'left')">
                                            ⫷ Left
                                        </button>
                                        <button type="button" class="pro-cad-align-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'center') }" title="Center Horizontally" @click="alignDecor(activeEditItem.decor, 'center')">
                                            ⬌ Center
                                        </button>
                                        <button type="button" class="pro-cad-align-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'right') }" title="Align Right (Flush against right corner)" @click="alignDecor(activeEditItem.decor, 'right')">
                                            Right ⫸
                                        </button>
                                    </div>
                                </div>

                                <div class="pro-cad-align-row">
                                    <span class="pro-cad-align-label">V Align</span>
                                    <div class="pro-cad-align-group">
                                        <button type="button" class="pro-cad-align-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'floor') }" title="Align to Floor (Bottom touches floor)" @click="alignDecor(activeEditItem.decor, 'floor')">
                                            ▲ Floor
                                        </button>
                                        <button type="button" class="pro-cad-align-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'middle') }" title="Center Vertically" @click="alignDecor(activeEditItem.decor, 'middle')">
                                            ⬍ Mid
                                        </button>
                                        <button type="button" class="pro-cad-align-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'top') }" title="Align to Ceiling/Top" @click="alignDecor(activeEditItem.decor, 'top')">
                                            Top ▼
                                        </button>
                                        <button type="button" class="pro-cad-align-btn fill-btn" :class="{ active: isDecorAligned(activeEditItem.decor, 'full') }" title="Full Wall Coverage (100% × 100%)" @click="alignDecor(activeEditItem.decor, 'full')">
                                            ⛶ Full
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="pro-cad-grid-2col">
                                <!-- W (Width) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Width: {{ decorWidthPercent }}% ({{ decorWidthCm }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <span class="pro-cad-cell-label">W</span>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="decorWidthCm" 
                                                min="1" 
                                                :max="currentWallLength" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="onDecorWidthCmChange" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'width', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'width', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorProp(activeEditItem.decor, 'width', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                :value="decorWidthPercent" 
                                                min="1" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @input="onDecorWidthPctChange($event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'width', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'width', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorProp(activeEditItem.decor, 'width', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Width {{ decorWidthPercent }}% ({{ decorWidthCm }} cm)</span>
                                </div>

                                <!-- H (Height) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Height: {{ decorHeightPercent }}% ({{ decorHeightCm }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <span class="pro-cad-cell-label">H</span>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="decorHeightCm" 
                                                min="1" 
                                                :max="currentWallHeight" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="onDecorHeightCmChange" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'height', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'height', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorProp(activeEditItem.decor, 'height', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                :value="decorHeightPercent" 
                                                min="1" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @input="onDecorHeightPctChange($event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'height', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorProp(activeEditItem.decor, 'height', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorProp(activeEditItem.decor, 'height', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Height {{ decorHeightPercent }}% ({{ decorHeightCm }} cm)</span>
                                </div>

                                <!-- X (Offset X with Reference Toggle) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Offset X: {{ decorLocalXPercent }}% ({{ decorLocalXCm }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <div class="pro-cad-cell-label-wrap">
                                            <span class="pro-cad-cell-label">X</span>
                                            <button type="button" class="pro-cad-ref-toggle" :title="xRefMode === 'left' ? 'Measuring from Left Corner (Click to switch to Right)' : 'Measuring from Right Corner (Click to switch to Left)'" @click="toggleXRefMode">
                                                {{ xRefMode === 'left' ? '◀ Left' : 'Right ▶' }}
                                            </button>
                                        </div>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="decorRefXCm" 
                                                min="0" 
                                                :max="currentWallLength" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="onDecorRefXCmChange" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'x', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'x', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorRefProp(activeEditItem.decor, 'x', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                :value="decorRefXPercent" 
                                                min="0" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @input="onDecorRefXPctChange($event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'x', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'x', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorRefProp(activeEditItem.decor, 'x', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Offset X {{ decorLocalXPercent }}% ({{ decorLocalXCm }} cm)</span>
                                </div>

                                <!-- Y (Offset Y with Reference Toggle) -->
                                <div class="pro-dual-input-row pro-cad-grid-cell" title="Offset Y: {{ decorLocalYPercent }}% ({{ decorLocalYCm }} cm)">
                                    <div class="pro-cad-cell-top">
                                        <div class="pro-cad-cell-label-wrap">
                                            <span class="pro-cad-cell-label">Y</span>
                                            <button type="button" class="pro-cad-ref-toggle" :title="yRefMode === 'floor' ? 'Measuring from Floor (Click to switch to Ceiling)' : 'Measuring from Ceiling (Click to switch to Floor)'" @click="toggleYRefMode">
                                                {{ yRefMode === 'floor' ? '▲ Floor' : 'Top ▼' }}
                                            </button>
                                        </div>
                                        <div class="pro-cad-cell-cm-wrap">
                                            <DimensionInput 
                                                :model-value="decorRefYCm" 
                                                min="0" 
                                                :max="currentWallHeight" 
                                                step="1" 
                                                class="pro-cad-dim-sub"
                                                @update:model-value="onDecorRefYCmChange" 
                                            />
                                            <span class="pro-cad-sub-unit">cm</span>
                                        </div>
                                    </div>
                                    <div class="pro-cad-cell-bot">
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'y', -1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'y', -1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorRefProp(activeEditItem.decor, 'y', $event.shiftKey ? -10 : -1))"
                                        >−</button>
                                        <div class="pro-cad-pct-wrap">
                                            <input 
                                                type="number" 
                                                :value="decorRefYPercent" 
                                                min="0" 
                                                max="100" 
                                                step="1" 
                                                class="pro-cad-pct-input"
                                                @input="onDecorRefYPctChange($event.target.value)" 
                                            />
                                            <span class="pro-cad-pct-unit">%</span>
                                        </div>
                                        <button 
                                            type="button" 
                                            class="pro-cad-stepper" 
                                            @mousedown="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'y', 1))"
                                            @mouseup="stopContinuousStep"
                                            @mouseleave="stopContinuousStep"
                                            @touchstart.prevent="startContinuousStep(() => stepDecorRefProp(activeEditItem.decor, 'y', 1))"
                                            @touchend="stopContinuousStep"
                                            @click="onStepperClick(() => stepDecorRefProp(activeEditItem.decor, 'y', $event.shiftKey ? 10 : 1))"
                                        >+</button>
                                    </div>
                                    <span class="sr-only">Offset Y {{ decorLocalYPercent }}% ({{ decorLocalYCm }} cm)</span>
                                </div>
                            </div>
                        </div>

                        <!-- Delete Decor Layer Button -->
                        <button type="button" class="pro-btn-remove-compact" @click="deleteItem(activeEditItem)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                            </svg>
                            <span>Delete Pattern Layer</span>
                        </button>
                    </template>
                </div>
            </div>
        </div>

        <!-- Delete Wall / Railing Button -->
        <button class="pro-btn-danger" @click="$emit('delete-entity')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
            <span>Delete {{ selectedEntity.type === 'railing' ? 'Railing' : ((selectedEntity.parentArc || selectedEntity.type === 'arc') ? 'Curved Wall' : 'Wall') }}</span>
        </button>
    </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { usePlannerStore } from '../../stores/usePlannerStore.js';
import DimensionInput from '../../components/common/DimensionInput.vue';
import MaterialSizeInput from '../../components/common/MaterialSizeInput.vue';
import { WallEngine } from '../../core/wall/WallEngine.js';
import { WallHeightPolicy } from '../../core/wall/WallHeightPolicy.js';
import { MaterialManager } from '../../core/engine3d/MaterialManager.js';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    selectedWallSide: { type: String, required: false },
    currentFaceDecors: { type: Array, default: () => [] },
    activeDecorId: { type: String, default: null },
    wallDecorRegistry: { type: Object, required: true },
    railingRegistry: { type: Object, required: true },
    uiTrigger: { type: Number, default: 0 },
    viewMode: { type: String, default: '2d' },
    planner: { type: Object, required: false }
});

const emit = defineEmits([
    'sync-engine',
    'ui-trigger',
    'toggle-edit-decor',
    'delete-specific-decor',
    'decor-update',
    'spawn-wall-pattern',
    'delete-entity'
]);

const plannerStore = usePlannerStore();
const { paintScope, selectedWallSide: storeWallSide } = storeToRefs(plannerStore);
const railingThumbnails = ref({});

const decorMutationVersion = ref(0);

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

onUnmounted(() => {
    stopContinuousStep();
});

const panelTitle = computed(() => {
    if (!props.selectedEntity) return 'Wall Properties';
    if (props.selectedEntity.type === 'railing') return 'Railing Properties';
    if (props.selectedEntity.type === 'foundation') return 'Plinth Wall Properties';
    if (props.selectedEntity.type === 'half_wall') return 'Parapet Wall Properties';
    if (props.selectedEntity.type === 'compound') return 'Compound Wall Properties';
    if (props.selectedEntity.parentArc || props.selectedEntity.type === 'arc') return 'Curved Wall Properties';
    return 'Wall Properties';
});

const localFace = ref(props.selectedWallSide || 'front');
watch(() => props.selectedWallSide, (newSide) => {
    if (newSide) {
        localFace.value = newSide;
        if (materialFilterFace.value !== 'all') {
            materialFilterFace.value = newSide;
        }
    }
});
watch(() => storeWallSide.value, (newSide) => {
    if (newSide) {
        localFace.value = newSide;
        if (materialFilterFace.value !== 'all') {
            materialFilterFace.value = newSide;
        }
    }
});

const activeFace = computed({
    get: () => localFace.value || 'front',
    set: (side) => {
        localFace.value = side;
        storeWallSide.value = side;
        emit('ui-trigger');
    }
});

const materialFilterFace = ref('all');
const activeEditMatId = ref(null);

watch(() => props.activeDecorId, (newId) => {
    if (newId) {
        activeEditMatId.value = newId;
    }
}, { immediate: true });

const currentWallLength = computed(() => {
    const wall = props.selectedEntity;
    if (!wall) return 100;
    if (typeof wall.getLength === 'function') return Math.round(wall.getLength());
    if (wall.length3D !== undefined) return Math.round(wall.length3D);
    const p1 = wall.startAnchor || wall.p1 || { x: wall.startX || 0, y: wall.startY || 0 };
    const p2 = wall.endAnchor || wall.p2 || { x: wall.endX || 0, y: wall.endY || 0 };
    return Math.round(Math.hypot(p2.x - p1.x, p2.y - p1.y)) || 100;
});

const currentWallHeight = computed(() => {
    const wall = props.selectedEntity;
    if (!wall) return 280;
    return wall.height !== undefined ? Number(wall.height) : (wall.config?.height || 280);
});

const wallSpatialCoords = computed(() => {
    const wall = props.selectedEntity;
    if (!wall) return { start: { x: 0, y: 0 }, end: { x: 0, y: 0 }, center: { x: 0, y: 0 }, elevation: 0 };
    const p1 = wall.startAnchor || wall.p1 || { x: wall.startX || 0, y: wall.startY || 0 };
    const p2 = wall.endAnchor || wall.p2 || { x: wall.endX || 0, y: wall.endY || 0 };
    return {
        start: { x: Math.round(p1.x || 0), y: Math.round(p1.y || 0) },
        end: { x: Math.round(p2.x || 0), y: Math.round(p2.y || 0) },
        center: { x: Math.round(((p1.x || 0) + (p2.x || 0)) / 2), y: Math.round(((p1.y || 0) + (p2.y || 0)) / 2) },
        elevation: Math.round(wall.elevation || 0)
    };
});

const allAppliedMaterials = computed(() => {
    const trigger = (props.uiTrigger || 0) + decorMutationVersion.value;
    const entity = props.selectedEntity;
    if (!entity) return [];
    const list = [];
    const params = entity.params || {};

    // 1. Base Material on Inner Face (front)
    const frontKey = params.textureFront || entity.textureFront || (params.textureSides ? params.textureSides : null) || (params.texture ? params.texture : null) || entity.texture || null;
    if (frontKey && frontKey !== '__default__' && frontKey !== 'default' && frontKey !== '') {
        const resolved = MaterialManager.resolveMaterialConfig(frontKey) || props.wallDecorRegistry?.[frontKey] || null;
        const name = resolved?.name || frontKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const thumb = resolved?.thumbnail || resolved?.texture || null;
        const defSize = resolved?.defaultTileSize || resolved?.tileSize || 70;
        const curSize = params.tileSizeFront || params.tileSize || defSize;
        const curRotRad = params.rotationFront !== undefined ? params.rotationFront : (params.rotation || 0);
        const curRotDeg = Math.round((Number(curRotRad) * 180) / Math.PI) % 360;

        list.push({
            id: 'base_front',
            type: 'base',
            side: 'front',
            sideLabel: 'Inner Face',
            key: frontKey,
            name,
            thumbnail: thumb,
            defaultTileSize: defSize,
            tileSize: Number(curSize),
            rotationDeg: curRotDeg,
            summary: `Tile: ${curSize}cm • ${curRotDeg}°`
        });
    }

    // 2. Base Material on Outer Face (back)
    const backKey = params.textureBack || entity.textureBack || (params.textureSides ? params.textureSides : null) || (params.texture ? params.texture : null) || entity.texture || null;
    if (backKey && backKey !== '__default__' && backKey !== 'default' && backKey !== '') {
        const resolved = MaterialManager.resolveMaterialConfig(backKey) || props.wallDecorRegistry?.[backKey] || null;
        const name = resolved?.name || backKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        const thumb = resolved?.thumbnail || resolved?.texture || null;
        const defSize = resolved?.defaultTileSize || resolved?.tileSize || 70;
        const curSize = params.tileSizeBack || params.tileSize || defSize;
        const curRotRad = params.rotationBack !== undefined ? params.rotationBack : (params.rotation || 0);
        const curRotDeg = Math.round((Number(curRotRad) * 180) / Math.PI) % 360;

        list.push({
            id: 'base_back',
            type: 'base',
            side: 'back',
            sideLabel: 'Outer Face',
            key: backKey,
            name,
            thumbnail: thumb,
            defaultTileSize: defSize,
            tileSize: Number(curSize),
            rotationDeg: curRotDeg,
            summary: `Tile: ${curSize}cm • ${curRotDeg}°`
        });
    }

    // 3. Attached Decor Layers
    if (Array.isArray(entity.attachedDecor)) {
        entity.attachedDecor.forEach((decor, idx) => {
            const side = decor.side || 'front';
            const reg = props.wallDecorRegistry?.[decor.configId] || MaterialManager.resolveMaterialConfig(decor.configId) || {};
            const name = reg.name || decor.configId?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || `Layer ${idx + 1}`;
            const thumb = reg.thumbnail || reg.texture || null;
            const depth = decor.depth !== undefined ? decor.depth : 0.2;
            const w = decor.width !== undefined ? decor.width : 100;
            const h = decor.height !== undefined ? decor.height : 100;
            const lx = decor.localX !== undefined ? decor.localX : 50;
            const ly = decor.localY !== undefined ? decor.localY : 50;

            const wallLen = currentWallLength.value || 100;
            const wallH = currentWallHeight.value || 280;

            const wCm = Math.round(wallLen * (w / 100));
            const hCm = Math.round(wallH * (h / 100));
            const xCm = Math.round(wallLen * (lx / 100));
            const yCm = Math.round(wallH * (ly / 100));

            list.push({
                id: decor.id,
                type: 'decor',
                side: side,
                sideLabel: side === 'back' ? 'Outer Face' : 'Inner Face',
                configId: decor.configId,
                name,
                thumbnail: thumb,
                decor,
                depth,
                tileSize: decor.tileSize || 70,
                width: w,
                height: h,
                widthCm: wCm,
                heightCm: hCm,
                localX: lx,
                localY: ly,
                localXCm: xCm,
                localYCm: yCm,
                faces: decor.faces || { left: false, right: false },
                summary: `${w}% (${wCm}cm) × ${h}% (${hCm}cm) • Offset: (${xCm}, ${yCm})cm • ${depth}cm thick`
            });
        });
    }

    return list;
});

const innerFaceMaterialsCount = computed(() => {
    return allAppliedMaterials.value.filter(m => m.side === 'front').length;
});

const outerFaceMaterialsCount = computed(() => {
    return allAppliedMaterials.value.filter(m => m.side === 'back').length;
});

const filteredAppliedMaterials = computed(() => {
    if (materialFilterFace.value === 'front') {
        return allAppliedMaterials.value.filter(m => m.side === 'front');
    }
    if (materialFilterFace.value === 'back') {
        return allAppliedMaterials.value.filter(m => m.side === 'back');
    }
    return allAppliedMaterials.value;
});

const activeEditItem = computed(() => {
    if (!activeEditMatId.value) return null;
    return allAppliedMaterials.value.find(m => m.id === activeEditMatId.value) || null;
});

const currentBaseTileSize = computed(() => {
    if (!activeEditItem.value || activeEditItem.value.type !== 'base') return 70;
    const side = activeEditItem.value.side;
    const p = props.selectedEntity?.params;
    if (!p) return activeEditItem.value.defaultTileSize || 70;
    const val = (side === 'front') ? (p.tileSizeFront || p.tileSize) : (p.tileSizeBack || p.tileSize);
    return val ? Number(val) : (activeEditItem.value.defaultTileSize || 70);
});

const currentBaseRotationDeg = computed(() => {
    if (!activeEditItem.value || activeEditItem.value.type !== 'base') return 0;
    const side = activeEditItem.value.side;
    const p = props.selectedEntity?.params;
    if (!p) return 0;
    const rad = (side === 'front') ? (p.rotationFront !== undefined ? p.rotationFront : p.rotation) :
                                     (p.rotationBack !== undefined ? p.rotationBack : p.rotation);
    if (rad === undefined || rad === null) return 0;
    return Math.round((Number(rad) * 180) / Math.PI) % 360;
});

const decorWidthPercent = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 100;
    const val = activeEditItem.value.decor.width !== undefined ? activeEditItem.value.decor.width : 100;
    return typeof val === 'number' ? Math.round(val) : 100;
});

const decorWidthCm = computed(() => {
    const rawPct = activeEditItem.value?.decor?.width !== undefined ? activeEditItem.value.decor.width : 100;
    return Math.round((currentWallLength.value || 100) * (rawPct / 100));
});

const onDecorWidthCmChange = (cmVal) => {
    if (!activeEditItem.value?.decor) return;
    const w = currentWallLength.value || 100;
    const pct = Number(Math.min(100, Math.max(0.1, (Number(cmVal) / w) * 100)).toFixed(3));
    onDecorPropChange(activeEditItem.value.decor, 'width', pct);
};

const decorHeightPercent = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 100;
    const val = activeEditItem.value.decor.height !== undefined ? activeEditItem.value.decor.height : 100;
    return typeof val === 'number' ? Math.round(val) : 100;
});

const decorHeightCm = computed(() => {
    const rawPct = activeEditItem.value?.decor?.height !== undefined ? activeEditItem.value.decor.height : 100;
    return Math.round((currentWallHeight.value || 280) * (rawPct / 100));
});

const onDecorHeightCmChange = (cmVal) => {
    if (!activeEditItem.value?.decor) return;
    const h = currentWallHeight.value || 280;
    const pct = Number(Math.min(100, Math.max(0.1, (Number(cmVal) / h) * 100)).toFixed(3));
    onDecorPropChange(activeEditItem.value.decor, 'height', pct);
};

const decorLocalXPercent = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 50;
    const val = activeEditItem.value.decor.localX !== undefined ? activeEditItem.value.decor.localX : 50;
    return typeof val === 'number' ? Math.round(val) : 50;
});

const decorLocalXCm = computed(() => {
    const rawPct = activeEditItem.value?.decor?.localX !== undefined ? activeEditItem.value.decor.localX : 50;
    return Math.round((currentWallLength.value || 100) * (rawPct / 100));
});

const onDecorLocalXCmChange = (cmVal) => {
    if (!activeEditItem.value?.decor) return;
    const w = currentWallLength.value || 100;
    const pct = Number(Math.min(100, Math.max(0, (Number(cmVal) / w) * 100)).toFixed(3));
    onDecorPropChange(activeEditItem.value.decor, 'localX', pct);
};

const decorLocalYPercent = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 50;
    const val = activeEditItem.value.decor.localY !== undefined ? activeEditItem.value.decor.localY : 50;
    return typeof val === 'number' ? Math.round(val) : 50;
});

const decorLocalYCm = computed(() => {
    const rawPct = activeEditItem.value?.decor?.localY !== undefined ? activeEditItem.value.decor.localY : 50;
    return Math.round((currentWallHeight.value || 280) * (rawPct / 100));
});

const onDecorLocalYCmChange = (cmVal) => {
    if (!activeEditItem.value?.decor) return;
    const h = currentWallHeight.value || 280;
    const pct = Number(Math.min(100, Math.max(0, (Number(cmVal) / h) * 100)).toFixed(3));
    onDecorPropChange(activeEditItem.value.decor, 'localY', pct);
};

const onDecorWidthPctChange = (val) => {
    if (!activeEditItem.value?.decor) return;
    const num = Math.min(100, Math.max(1, Number(val) || 1));
    onDecorPropChange(activeEditItem.value.decor, 'width', num);
};

const onDecorHeightPctChange = (val) => {
    if (!activeEditItem.value?.decor) return;
    const num = Math.min(100, Math.max(1, Number(val) || 1));
    onDecorPropChange(activeEditItem.value.decor, 'height', num);
};

const onDecorLocalXPctChange = (val) => {
    if (!activeEditItem.value?.decor) return;
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    onDecorPropChange(activeEditItem.value.decor, 'localX', num);
};

const onDecorLocalYPctChange = (val) => {
    if (!activeEditItem.value?.decor) return;
    const num = Math.min(100, Math.max(0, Number(val) || 0));
    onDecorPropChange(activeEditItem.value.decor, 'localY', num);
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

const decorRefXPercent = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 0;
    const decor = activeEditItem.value.decor;
    const w = decor.width !== undefined ? decor.width : 100;
    const localX = decor.localX !== undefined ? decor.localX : 50;
    if (xRefMode.value === 'right') {
        const raw = 100 - (localX + w / 2);
        return Math.max(0, Math.round(raw));
    }
    const raw = localX - w / 2;
    return Math.max(0, Math.round(raw));
});

const decorRefXCm = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 0;
    const decor = activeEditItem.value.decor;
    const w = decor.width !== undefined ? decor.width : 100;
    const localX = decor.localX !== undefined ? decor.localX : 50;
    const wallLen = currentWallLength.value || 100;
    let pct = 0;
    if (xRefMode.value === 'right') {
        pct = Math.max(0, 100 - (localX + w / 2));
    } else {
        pct = Math.max(0, localX - w / 2);
    }
    return Math.round(wallLen * (pct / 100));
});

const onDecorRefXCmChange = (cmVal) => {
    if (!activeEditItem.value?.decor) return;
    const decor = activeEditItem.value.decor;
    const wallLen = currentWallLength.value || 100;
    const w = decor.width !== undefined ? decor.width : 100;
    const refPct = Math.max(0, (Number(cmVal) / wallLen) * 100);
    let newLocalX = 50;
    if (xRefMode.value === 'right') {
        newLocalX = 100 - refPct - w / 2;
    } else {
        newLocalX = refPct + w / 2;
    }
    newLocalX = Number(Math.min(100, Math.max(0, newLocalX)).toFixed(3));
    onDecorPropChange(decor, 'localX', newLocalX);
};

const onDecorRefXPctChange = (val) => {
    if (!activeEditItem.value?.decor) return;
    const decor = activeEditItem.value.decor;
    const w = decor.width !== undefined ? decor.width : 100;
    const refPct = Math.max(0, Number(val) || 0);
    let newLocalX = 50;
    if (xRefMode.value === 'right') {
        newLocalX = 100 - refPct - w / 2;
    } else {
        newLocalX = refPct + w / 2;
    }
    newLocalX = Number(Math.min(100, Math.max(0, newLocalX)).toFixed(3));
    onDecorPropChange(decor, 'localX', newLocalX);
};

const decorRefYPercent = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 0;
    const decor = activeEditItem.value.decor;
    const h = decor.height !== undefined ? decor.height : 100;
    const localY = decor.localY !== undefined ? decor.localY : 50;
    if (yRefMode.value === 'ceiling') {
        const raw = 100 - (localY + h / 2);
        return Math.max(0, Math.round(raw));
    }
    const raw = localY - h / 2;
    return Math.max(0, Math.round(raw));
});

const decorRefYCm = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 0;
    const decor = activeEditItem.value.decor;
    const h = decor.height !== undefined ? decor.height : 100;
    const localY = decor.localY !== undefined ? decor.localY : 50;
    const wallH = currentWallHeight.value || 280;
    let pct = 0;
    if (yRefMode.value === 'ceiling') {
        pct = Math.max(0, 100 - (localY + h / 2));
    } else {
        pct = Math.max(0, localY - h / 2);
    }
    return Math.round(wallH * (pct / 100));
});

const onDecorRefYCmChange = (cmVal) => {
    if (!activeEditItem.value?.decor) return;
    const decor = activeEditItem.value.decor;
    const wallH = currentWallHeight.value || 280;
    const h = decor.height !== undefined ? decor.height : 100;
    const refPct = Math.max(0, (Number(cmVal) / wallH) * 100);
    let newLocalY = 50;
    if (yRefMode.value === 'ceiling') {
        newLocalY = 100 - refPct - h / 2;
    } else {
        newLocalY = refPct + h / 2;
    }
    newLocalY = Number(Math.min(100, Math.max(0, newLocalY)).toFixed(3));
    onDecorPropChange(decor, 'localY', newLocalY);
};

const onDecorRefYPctChange = (val) => {
    if (!activeEditItem.value?.decor) return;
    const decor = activeEditItem.value.decor;
    const h = decor.height !== undefined ? decor.height : 100;
    const refPct = Math.max(0, Number(val) || 0);
    let newLocalY = 50;
    if (yRefMode.value === 'ceiling') {
        newLocalY = 100 - refPct - h / 2;
    } else {
        newLocalY = refPct + h / 2;
    }
    newLocalY = Number(Math.min(100, Math.max(0, newLocalY)).toFixed(3));
    onDecorPropChange(decor, 'localY', newLocalY);
};

const stepDecorRefProp = (decor, axis, delta) => {
    if (!decor) return;
    if (axis === 'x') {
        const curRefPct = decorRefXPercent.value;
        const nextRefPct = Math.max(0, curRefPct + delta);
        onDecorRefXPctChange(nextRefPct);
    } else if (axis === 'y') {
        const curRefPct = decorRefYPercent.value;
        const nextRefPct = Math.max(0, curRefPct + delta);
        onDecorRefYPctChange(nextRefPct);
    }
};

const alignDecor = (decor, target) => {
    if (!decor) return;
    const w = decor.width !== undefined ? decor.width : 100;
    const h = decor.height !== undefined ? decor.height : 100;
    const wall = props.selectedEntity;

    if (target === 'left') {
        const newX = Number((w / 2).toFixed(3));
        onDecorPropChange(decor, 'localX', newX);
    } else if (target === 'center') {
        onDecorPropChange(decor, 'localX', 50);
    } else if (target === 'right') {
        const newX = Number((100 - w / 2).toFixed(3));
        onDecorPropChange(decor, 'localX', newX);
    } else if (target === 'floor') {
        const newY = Number((h / 2).toFixed(3));
        onDecorPropChange(decor, 'localY', newY);
    } else if (target === 'middle') {
        onDecorPropChange(decor, 'localY', 50);
    } else if (target === 'top') {
        const newY = Number((100 - h / 2).toFixed(3));
        onDecorPropChange(decor, 'localY', newY);
    } else if (target === 'full') {
        decor.width = 100;
        decor.height = 100;
        decor.localX = 50;
        decor.localY = 50;
        if (wall) {
            WallEngine.updateDecor(wall, decor, { width: 100, height: 100, localX: 50, localY: 50 }, false, props.planner);
        }
        decorMutationVersion.value++;
        const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
        if (renderer && typeof renderer.updateWallDecorLive === 'function') {
            renderer.updateWallDecorLive(decor);
        }
        if (renderer && typeof renderer.requestRender === 'function') {
            renderer.requestRender();
        }
        emit('decor-update', decor);
        emit('ui-trigger');
    }
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
    const newX = Number((100 - curX).toFixed(3));
    onDecorPropChange(decor, 'localX', newX);
};

const flipDecorFace = (decor) => {
    if (!decor) return;
    const wall = props.selectedEntity;
    const newSide = decor.side === 'front' ? 'back' : 'front';
    decor.side = newSide;
    activeFace.value = newSide;
    if (materialFilterFace.value !== 'all') {
        materialFilterFace.value = newSide;
    }
    if (wall) {
        WallEngine.updateDecor(wall, decor, { side: newSide }, false, props.planner);
    }
    decorMutationVersion.value++;
    const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
    if (renderer && typeof renderer.updateWallDecorLive === 'function') {
        renderer.updateWallDecorLive(decor);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender();
    }
    emit('decor-update', decor);
    emit('ui-trigger');
};

const stepDecorProp = (decor, prop, delta) => {
    if (!decor) return;
    const cur = Number(decor[prop] !== undefined ? decor[prop] : (prop.startsWith('local') ? 50 : 100));
    const minVal = prop.startsWith('local') ? 0 : 1;
    const maxVal = 100;
    const nextVal = Math.min(maxVal, Math.max(minVal, Math.round(cur) + delta));
    onDecorPropChange(decor, prop, nextVal);
};

const stepBaseProp = (baseItem, prop, delta) => {
    const cur = prop.startsWith('local') ? 50 : 100;
    const minVal = prop.startsWith('local') ? 0 : 1;
    const nextVal = Math.min(100, Math.max(minVal, Math.round(cur) + delta));
    onBaseDimensionChange(baseItem, prop, nextVal);
};

const decorRotationDeg = computed(() => {
    const _t = decorMutationVersion.value;
    if (!activeEditItem.value?.decor) return 0;
    const rad = activeEditItem.value.decor.rotation || (activeEditItem.value.decor.rotationDeg !== undefined ? (Number(activeEditItem.value.decor.rotationDeg) * Math.PI) / 180 : 0);
    return Math.round((Number(rad) * 180) / Math.PI) % 360;
});

const onDecorRotationInput = (decor, deg) => {
    if (!decor) return;
    const numDeg = Number(deg);
    const rad = (numDeg * Math.PI) / 180;
    decor.rotation = rad;
    decor.rotationDeg = numDeg;

    const wall = props.selectedEntity;
    if (wall) {
        if (Array.isArray(wall.attachedDecor)) {
            wall.attachedDecor = [...wall.attachedDecor];
        }
        WallEngine.updateDecor(wall, decor, { rotation: rad, rotationDeg: numDeg }, false, props.planner);
    }

    decorMutationVersion.value++;

    const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
    if (renderer && typeof renderer.updateWallDecorLive === 'function') {
        renderer.updateWallDecorLive(decor);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender();
    }
    emit('decor-update', decor);
    emit('ui-trigger');
};

const onBaseDepthChange = (baseItem, val) => {
    const wall = props.selectedEntity;
    if (!wall) return;
    if (!wall.attachedDecor) wall.attachedDecor = [];

    const numVal = Number(val);
    if (isNaN(numVal) || numVal <= 0) return;
    const rotDeg = baseItem.rotationDeg !== undefined ? baseItem.rotationDeg : (currentBaseRotationDeg.value || 0);

    let decor = wall.attachedDecor.find(d => d.id === activeEditMatId.value || (d.side === baseItem.side && d.configId === baseItem.key));
    if (decor) {
        decor.depth = numVal;
        WallEngine.updateDecor(wall, decor, { depth: numVal }, false, props.planner);
    } else {
        decor = {
            id: 'decor_' + Date.now(),
            type: 'wallDecor',
            configId: baseItem.key,
            side: baseItem.side,
            depth: numVal,
            tileSize: baseItem.tileSize || currentBaseTileSize.value || 70,
            rotation: (rotDeg * Math.PI) / 180,
            rotationDeg: rotDeg,
            width: 100,
            height: 100,
            localX: 50,
            localY: 50,
            faces: { left: false, right: false }
        };
        WallEngine.attachDecor(wall, decor, false, props.planner);
        activeEditMatId.value = decor.id;
    }

    decorMutationVersion.value++;

    const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
    if (renderer && typeof renderer.updateWallDecorLive === 'function') {
        renderer.updateWallDecorLive(decor);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender();
    }

    emit('decor-update', decor);
    emit('ui-trigger');
};

const onBaseDimensionChange = (baseItem, prop, val) => {
    const wall = props.selectedEntity;
    if (!wall) return;
    if (!wall.attachedDecor) wall.attachedDecor = [];

    const numVal = Number(val);
    const rotDeg = baseItem.rotationDeg !== undefined ? baseItem.rotationDeg : (currentBaseRotationDeg.value || 0);

    let decor = wall.attachedDecor.find(d => d.id === activeEditMatId.value || (d.side === baseItem.side && d.configId === baseItem.key));
    if (decor) {
        decor[prop] = numVal;
        WallEngine.updateDecor(wall, decor, { [prop]: numVal }, false, props.planner);
    } else {
        decor = {
            id: 'decor_' + Date.now(),
            type: 'wallDecor',
            configId: baseItem.key,
            side: baseItem.side,
            depth: 0.2,
            tileSize: baseItem.tileSize || currentBaseTileSize.value || 70,
            rotation: (rotDeg * Math.PI) / 180,
            rotationDeg: rotDeg,
            width: prop === 'width' ? numVal : 100,
            height: prop === 'height' ? numVal : 100,
            localX: prop === 'localX' ? numVal : 50,
            localY: prop === 'localY' ? numVal : 50,
            faces: { left: false, right: false }
        };
        WallEngine.attachDecor(wall, decor, false, props.planner);
        activeEditMatId.value = decor.id;
    }

    decorMutationVersion.value++;

    const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
    if (renderer && typeof renderer.updateWallDecorLive === 'function') {
        renderer.updateWallDecorLive(decor);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender();
    }

    emit('decor-update', decor);
    emit('ui-trigger');
};

const onBaseDimensionCmChange = (baseItem, prop, cmVal) => {
    const wall = props.selectedEntity;
    if (!wall) return;
    const len = currentWallLength.value || 100;
    const h = currentWallHeight.value || 280;
    let pct = 100;
    if (prop === 'width') {
        pct = Number(Math.min(100, Math.max(0.1, (Number(cmVal) / len) * 100)).toFixed(3));
    } else if (prop === 'height') {
        pct = Number(Math.min(100, Math.max(0.1, (Number(cmVal) / h) * 100)).toFixed(3));
    } else if (prop === 'localX') {
        pct = Number(Math.min(100, Math.max(0, (Number(cmVal) / len) * 100)).toFixed(3));
    } else if (prop === 'localY') {
        pct = Number(Math.min(100, Math.max(0, (Number(cmVal) / h) * 100)).toFixed(3));
    }
    onBaseDimensionChange(baseItem, prop, pct);
};

const setFaceFilter = (side) => {
    materialFilterFace.value = side;
    activeFace.value = side;
};

const selectMaterialForEdit = (item) => {
    activeEditMatId.value = item.id;
    activeFace.value = item.side;
    if (item.type === 'decor') {
        emit('toggle-edit-decor', item.id);
    }
};

const toggleEditMaterial = (item) => {
    if (activeEditMatId.value === item.id) {
        activeEditMatId.value = null;
    } else {
        selectMaterialForEdit(item);
    }
};

const onBaseTileSizeInput = (side, val) => {
    const num = Number(val);
    if (isNaN(num) || num <= 0 || !props.selectedEntity) return;
    if (!props.selectedEntity.params) props.selectedEntity.params = {};
    if (side === 'front') {
        props.selectedEntity.params.tileSizeFront = num;
    } else {
        props.selectedEntity.params.tileSizeBack = num;
    }
    props.selectedEntity.params.tileSize = num;

    const arc = props.selectedEntity.parentArc || (props.selectedEntity.walls ? props.selectedEntity : null);
    if (arc && arc.walls) {
        arc.params = arc.params || {};
        if (side === 'front') arc.params.tileSizeFront = num;
        else arc.params.tileSizeBack = num;
        arc.params.tileSize = num;
        arc.walls.forEach(w => {
            w.params = w.params || {};
            if (side === 'front') w.params.tileSizeFront = num;
            else w.params.tileSizeBack = num;
            w.params.tileSize = num;
        });
    }

    const renderer = plannerStore.renderer3D;
    if (renderer && typeof renderer.updateMaterialLive === 'function') {
        renderer.updateMaterialLive(arc || props.selectedEntity);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender('material_updated', 2);
    }
    emit('sync-engine');
};

const onBaseRotationInput = (side, deg) => {
    const rad = (Number(deg) * Math.PI) / 180;
    if (!props.selectedEntity.params) props.selectedEntity.params = {};
    if (side === 'front') {
        props.selectedEntity.params.rotationFront = rad;
    } else {
        props.selectedEntity.params.rotationBack = rad;
    }

    const arc = props.selectedEntity.parentArc || (props.selectedEntity.walls ? props.selectedEntity : null);
    if (arc && arc.walls) {
        arc.params = arc.params || {};
        if (side === 'front') arc.params.rotationFront = rad;
        else arc.params.rotationBack = rad;
        arc.walls.forEach(w => {
            w.params = w.params || {};
            if (side === 'front') w.params.rotationFront = rad;
            else w.params.rotationBack = rad;
        });
    }

    const renderer = plannerStore.renderer3D;
    if (renderer && typeof renderer.updateMaterialLive === 'function') {
        renderer.updateMaterialLive(arc || props.selectedEntity);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender('material_updated', 2);
    }
    emit('sync-engine');
};

const onDecorPropChange = (decor, prop, val) => {
    if (!decor) return;
    const num = Number(val);
    if (isNaN(num)) return;
    decor[prop] = num;

    const wall = props.selectedEntity;
    if (wall) {
        if (Array.isArray(wall.attachedDecor)) {
            wall.attachedDecor = [...wall.attachedDecor];
        }
        WallEngine.updateDecor(wall, decor, { [prop]: num }, false, props.planner);
    }

    decorMutationVersion.value++;

    const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
    if (renderer && typeof renderer.updateWallDecorLive === 'function') {
        renderer.updateWallDecorLive(decor);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender();
    }
    emit('decor-update', decor);
    emit('ui-trigger');
};

const onDecorEdgeChange = (decor, edge, checked) => {
    if (!decor) return;
    if (!decor.faces) decor.faces = { left: false, right: false };
    decor.faces[edge] = !!checked;

    const wall = props.selectedEntity;
    if (wall) {
        if (Array.isArray(wall.attachedDecor)) {
            wall.attachedDecor = [...wall.attachedDecor];
        }
        WallEngine.updateDecor(wall, decor, { faces: { ...decor.faces } }, false, props.planner);
    }

    decorMutationVersion.value++;

    const renderer = plannerStore.renderer3D || window.renderer3D || window.plannerInstance?.renderer3D;
    if (renderer && typeof renderer.updateWallDecorLive === 'function') {
        renderer.updateWallDecorLive(decor);
    }
    if (renderer && typeof renderer.requestRender === 'function') {
        renderer.requestRender();
    }
    emit('decor-update', decor);
    emit('ui-trigger');
};

const deleteBaseMaterial = (side) => {
    const entity = props.selectedEntity;
    if (!entity) return;
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    const renderer = plannerStore.renderer3D;

    const doDelete = () => {
        entity.params = entity.params || {};
        if (side === 'front') {
            entity.params.textureFront = null;
            entity.textureFront = null;
            if (entity.params.tileSizeFront !== undefined) delete entity.params.tileSizeFront;
            if (entity.params.rotationFront !== undefined) delete entity.params.rotationFront;
            if (entity.materials) {
                delete entity.materials.wall_front;
                delete entity.materials.front;
            }
        } else {
            entity.params.textureBack = null;
            entity.textureBack = null;
            if (entity.params.tileSizeBack !== undefined) delete entity.params.tileSizeBack;
            if (entity.params.rotationBack !== undefined) delete entity.params.rotationBack;
            if (entity.materials) {
                delete entity.materials.wall_back;
                delete entity.materials.back;
            }
        }

        const arc = entity.parentArc || (entity.walls ? entity : null);
        if (arc && arc.walls) {
            arc.params = arc.params || {};
            if (side === 'front') arc.params.textureFront = null;
            else arc.params.textureBack = null;
            arc.walls.forEach(w => {
                w.params = w.params || {};
                if (side === 'front') {
                    w.params.textureFront = null;
                    w.textureFront = null;
                } else {
                    w.params.textureBack = null;
                    w.textureBack = null;
                }
                WallEngine.applyMaterial(w, { target: side, key: null, ctx: renderer }, planner);
            });
        } else {
            WallEngine.applyMaterial(entity, { target: side, key: null, ctx: renderer }, planner);
        }

        if (renderer && typeof renderer.updateMaterialLive === 'function') {
            renderer.updateMaterialLive(arc || entity);
        }
        if (renderer && typeof renderer.requestRender === 'function') {
            renderer.requestRender('material_deleted', 2);
        }
    };

    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(doDelete);
    } else {
        doDelete();
    }
    if (activeEditMatId.value === `base_${side}`) {
        activeEditMatId.value = null;
    }
    emit('sync-engine');
    emit('ui-trigger');
};

const deleteFaceMaterial = () => {
    deleteBaseMaterial(activeFace.value);
};

const deleteItem = (item) => {
    if (!item) return;
    if (item.type === 'base') {
        deleteBaseMaterial(item.side);
    } else if (item.type === 'decor') {
        emit('delete-specific-decor', item.decor);
        if (activeEditMatId.value === item.id) {
            activeEditMatId.value = null;
        }
    }
};

let previousScope = 'single';

const updateWallLength = (newLengthVal) => {
    const wall = props.selectedEntity;
    const newL = Number(newLengthVal);
    if (!wall || isNaN(newL) || newL < 10) return;
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    const p1 = wall.startAnchor ? { x: wall.startAnchor.x, y: wall.startAnchor.y } : (wall.p1 ? { x: wall.p1.x, y: wall.p1.y } : { x: wall.startX || 0, y: wall.startY || 0 });
    const p2 = wall.endAnchor ? { x: wall.endAnchor.x, y: wall.endAnchor.y } : (wall.p2 ? { x: wall.p2.x, y: wall.p2.y } : { x: wall.endX || 0, y: wall.endY || 0 });
    const currentL = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (currentL < 0.001) return;
    const dir = { x: (p2.x - p1.x) / currentL, y: (p2.y - p1.y) / currentL };
    const newP2 = { x: p1.x + dir.x * newL, y: p1.y + dir.y * newL };
    
    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(() => {
            WallEngine.setEndpoints(wall, p1, newP2, true, planner);
        });
    } else {
        WallEngine.setEndpoints(wall, p1, newP2, true, planner);
    }
    emit('sync-engine');
};

const updateElevation = (val) => {
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    const num = Number(val);
    if (isNaN(num) || !props.selectedEntity) return;
    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(() => {
            WallEngine.setElevation(props.selectedEntity, num, false, planner);
        });
    } else {
        WallEngine.setElevation(props.selectedEntity, num, false, planner);
    }
    emit('sync-engine');
};

const updateThickness = (val) => {
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    const num = Number(val);
    if (isNaN(num) || num <= 0 || !props.selectedEntity) return;
    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(() => {
            WallEngine.setThickness(props.selectedEntity, num, false, planner);
        });
    } else {
        WallEngine.setThickness(props.selectedEntity, num, false, planner);
    }
    emit('sync-engine');
};

const updateHeight = (val) => {
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    const num = Number(val);
    if (isNaN(num) || !props.selectedEntity) return;
    const validH = WallHeightPolicy.processInputHeight(num);
    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(() => {
            WallEngine.setHeight(props.selectedEntity, validH, false, planner);
        });
    } else {
        WallEngine.setHeight(props.selectedEntity, validH, false, planner);
    }
    emit('sync-engine');
};

const setTopProfile = (profileType) => {
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    if (!props.selectedEntity) return;
    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(() => {
            WallEngine.setTopProfile(props.selectedEntity, profileType, {}, false, planner);
        });
    } else {
        WallEngine.setTopProfile(props.selectedEntity, profileType, {}, false, planner);
    }
    emit('sync-engine');
};

const updateSlopeProp = (prop, val) => {
    const planner = plannerStore.planner?.value || plannerStore.planner || window.plannerInstance;
    const num = Number(val);
    if (isNaN(num) || !props.selectedEntity) return;
    const validH = WallHeightPolicy.processInputHeight(num);
    if (planner && typeof planner.executeWithSnapshot === 'function') {
        planner.executeWithSnapshot(() => {
            WallEngine.batchUpdate(planner, [props.selectedEntity], { [prop]: validH }, false);
        });
    } else {
        WallEngine.batchUpdate(planner, [props.selectedEntity], { [prop]: validH }, false);
    }
    emit('sync-engine');
};

const handleKeyDown = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'Shift' && paintScope.value !== 'room') {
        previousScope = paintScope.value;
        paintScope.value = 'room';
    } else if (e.key === 'Alt' && paintScope.value !== 'exterior') {
        previousScope = paintScope.value;
        paintScope.value = 'exterior';
    }
};

const handleKeyUp = (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    if (e.key === 'Shift' || e.key === 'Alt') {
        paintScope.value = previousScope || 'single';
    }
};

onMounted(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
});

onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown);
    window.removeEventListener('keyup', handleKeyUp);
});

const onCompoundFloorToggle = () => {
    const val = !!props.selectedEntity.hasFloor;
    const planner = plannerStore.planner;
    if (planner && planner.walls) {
        planner.walls.forEach(w => {
            if (w.type === 'compound') {
                w.hasFloor = val;
            }
        });
    }
    emit('sync-engine');
};

const generateThumbnails = async () => {
    const renderer = plannerStore.renderer3D;
    if (!renderer || !renderer.thumbnailGenerator) return;
    
    for (const key in props.railingRegistry) {
        if (!railingThumbnails.value[key]) {
            try {
                await new Promise(r => setTimeout(r, 10));
                const dataUrl = await renderer.thumbnailGenerator.generate(key, props.railingRegistry[key]);
                if (dataUrl) railingThumbnails.value[key] = dataUrl;
            } catch(e) {
                console.error("Failed to generate railing thumbnail for", key, e);
            }
        }
    }
};

const handleImageError = (e) => {
    e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='1' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'%3E%3C/rect%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'%3E%3C/circle%3E%3Cpolyline points='21 15 16 10 5 21'%3E%3C/polyline%3E%3C/svg%3E";
};

watch(() => props.selectedEntity, (newVal) => {
    if (newVal && newVal.type === 'railing') {
        generateThumbnails();
    }
}, { immediate: true });

watch(() => plannerStore.renderer3D, (newRenderer) => {
    if (newRenderer && props.selectedEntity && props.selectedEntity.type === 'railing') {
        generateThumbnails();
    }
});
</script>

<style scoped>
.props-panel-inner {
    display: flex;
    flex-direction: column;
    width: 100%;
    box-sizing: border-box;
}

/* 1. Header (Aligned to 16px gutter) */
.pro-panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-bottom: 1px solid #f1f5f9;
    background: #ffffff;
    box-sizing: border-box;
}

.pro-title-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
}

.pro-title-icon {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    background: #eff6ff;
    color: #2563eb;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.pro-title-text {
    font-size: 13px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.2px;
}

.pro-id-badge {
    font-size: 10.5px;
    font-weight: 600;
    color: #94a3b8;
    background: #f8fafc;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #e2e8f0;
    font-family: monospace;
}

/* 2. Top Profile Segmented Grid (Aligned to 16px gutter) */
.profile-group {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
    padding: 10px 16px 12px 16px !important;
    box-sizing: border-box;
}

.profile-group label {
    margin: 0 !important;
    font-size: 12px !important;
    font-weight: 500 !important;
    color: #1e293b !important;
}

.pro-segmented-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    gap: 3px;
    box-sizing: border-box;
    width: 100%;
}

.pro-profile-btn {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 6px 2px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.pro-profile-btn:hover {
    color: #0f172a;
}

.pro-profile-btn.active {
    background: #ffffff;
    color: #2563eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
    font-weight: 700;
}

/* 3. Preset Chips (Aligned to 140px right control box) */
.preset-row {
    padding: 8px 16px;
    box-sizing: border-box;
}

.preset-row label {
    font-size: 11.5px;
    color: #64748b;
}

.pro-chip-group {
    display: flex;
    gap: 4px;
    width: 140px;
    flex: 0 0 140px;
    height: 28px;
    box-sizing: border-box;
}

.pro-chip-btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 2px;
    height: 100%;
    font-size: 10.5px;
    font-weight: 600;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: center;
}

.pro-chip-btn:hover {
    background: #f1f5f9;
    color: #0f172a;
    border-color: #cbd5e1;
}

.pro-chip-btn.active {
    background: #eff6ff;
    color: #2563eb;
    border-color: #93c5fd;
    font-weight: 700;
}

/* 4. Materials Section Container (Strict 16px Gutter) */
.pro-materials-section {
    padding: 0 16px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
}

.pro-section-divider {
    margin: 16px 0 12px 0;
    padding-top: 12px;
    border-top: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
}

.pro-divider-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
}

/* 5. Face Switcher Segmented Control (3 columns: All, Inner, Outer) */
.pro-segmented-switch {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    gap: 3px;
    margin-bottom: 12px;
    box-sizing: border-box;
    width: 100%;
}

.pro-switch-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 7px 6px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: #64748b;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
}

.pro-switch-btn:hover {
    color: #0f172a;
}

.pro-switch-btn.active {
    background: #ffffff;
    color: #0f172a;
    font-weight: 700;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04);
}

.pro-switch-btn.active svg {
    color: #2563eb;
}

.pro-count-badge {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 999px;
    background: #e2e8f0;
    color: #475569;
}

.pro-switch-btn.active .pro-count-badge {
    background: #eff6ff;
    color: #2563eb;
}

.pro-editing-indicator {
    font-size: 9.5px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 1px 6px;
    border-radius: 4px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
}

/* 6. Paint Scope Card */
.pro-scope-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    box-sizing: border-box;
    width: 100%;
}

.pro-scope-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.pro-scope-title {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
}

.pro-scope-btn-group {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 4px;
}

.pro-scope-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 6px 4px;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    background: #ffffff;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
}

.pro-scope-btn:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    color: #0f172a;
}

.pro-scope-btn.active {
    background: #eff6ff;
    border-color: #3b82f6;
    color: #1d4ed8;
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(59, 130, 246, 0.1);
}

.pro-kbd {
    font-size: 9px;
    font-family: inherit;
    font-weight: 700;
    color: #94a3b8;
    background: #f1f5f9;
    padding: 1px 4px;
    border-radius: 3px;
    border: 1px solid #cbd5e1;
    margin-left: 2px;
}

.pro-scope-btn.active .pro-kbd {
    background: #dbeafe;
    color: #2563eb;
    border-color: #bfdbfe;
}

/* 7. Applied Materials Section & List */
.pro-applied-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
    box-sizing: border-box;
}

.pro-section-subhead {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 2px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #64748b;
}

.pro-materials-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    margin-bottom: 4px;
}

.pro-mat-list-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.15s ease;
    box-sizing: border-box;
    width: 100%;
}

.pro-mat-list-card:hover {
    border-color: #cbd5e1;
    background: #f8fafc;
}

.pro-mat-list-card.is-editing {
    border-color: #3b82f6;
    background: #f0f7ff;
    box-shadow: 0 0 0 1px #3b82f6;
}

.pro-mat-list-thumb {
    width: 36px;
    height: 36px;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid #e2e8f0;
    background: #ffffff;
}

.pro-mat-list-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.pro-mat-list-row {
    display: flex;
    align-items: center;
    gap: 6px;
}

.pro-mat-list-title {
    font-size: 12px;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.pro-badge-editing {
    font-size: 8.5px;
    font-weight: 800;
    background: #2563eb;
    color: #ffffff;
    padding: 1px 4px;
    border-radius: 3px;
    letter-spacing: 0.4px;
}

.pro-mat-list-meta {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
}

.pro-mat-badge {
    font-size: 9.5px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    background: #f1f5f9;
    color: #475569;
}

.pro-mat-badge.front {
    background: #eff6ff;
    color: #1d4ed8;
}

.pro-mat-badge.back {
    background: #fef3c7;
    color: #b45309;
}

.pro-mat-badge.type.base {
    background: #f1f5f9;
    color: #334155;
}

.pro-mat-badge.type.decor {
    background: #f5f3ff;
    color: #6d28d9;
}

.pro-mat-list-metric {
    font-size: 10px;
    color: #64748b;
    margin-left: 2px;
}

.pro-mat-list-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
}

.pro-btn-action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
    background: #ffffff;
    color: #475569;
    cursor: pointer;
    transition: all 0.15s ease;
}

.pro-btn-action:hover {
    background: #f1f5f9;
    color: #0f172a;
}

.pro-btn-action.edit.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}

.pro-btn-action.delete {
    padding: 5px;
    color: #ef4444;
    border-color: #fee2e2;
}

.pro-btn-action.delete:hover {
    background: #fee2e2;
    color: #dc2626;
    border-color: #fca5a5;
}

/* Parametric Properties Inspector Box */
.pro-inspector-box {
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-top: 6px;
    margin-bottom: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    box-sizing: border-box;
    width: 100%;
}

.pro-inspector-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 6px;
    margin-bottom: 2px;
}

.pro-inspector-title-row {
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.pro-inspector-kicker {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #2563eb;
}

.pro-inspector-title {
    font-size: 11.5px;
    font-weight: 700;
    color: #0f172a;
}

.pro-inspector-btn-done {
    padding: 3px 8px;
    border-radius: 4px;
    border: none;
    background: #eff6ff;
    color: #2563eb;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.15s ease;
}

.pro-inspector-btn-done:hover {
    background: #2563eb;
    color: #ffffff;
}

/* Figma-Style Compact Single-Card Inspector */
.pro-inspector-box :deep(input::-webkit-outer-spin-button),
.pro-inspector-box :deep(input::-webkit-inner-spin-button) {
    -webkit-appearance: none !important;
    margin: 0 !important;
}
.pro-inspector-box :deep(input[type=number]) {
    -moz-appearance: textfield !important;
}

.pro-figma-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    min-height: 28px;
    box-sizing: border-box;
    width: 100%;
}

.pro-figma-label {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    flex-shrink: 0;
    min-width: 48px;
    display: flex;
    align-items: baseline;
    gap: 3px;
}

.pro-edge-inline {
    display: flex;
    align-items: center;
    gap: 12px;
}

.pro-checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: #475569;
    cursor: pointer;
    margin: 0;
    user-select: none;
}

.pro-checkbox-label input[type="checkbox"] {
    margin: 0;
    cursor: pointer;
    accent-color: #2563eb;
    width: 13px;
    height: 13px;
}

.pro-fsubtext {
    font-size: 9px;
    font-weight: 500;
    color: #2563eb;
}

.pro-figma-chips {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
}

.pro-fchip {
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
}

.pro-fchip:hover {
    color: #0f172a;
    border-color: #cbd5e1;
    background: #f1f5f9;
}

.pro-fchip.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    font-weight: 700;
}

.pro-figma-grow {
    flex: 1;
}

.pro-figma-dual-inputs {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
    justify-content: flex-end;
}

.pro-finput-box {
    position: relative;
    display: flex;
    align-items: center;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 5px;
    box-sizing: border-box;
    transition: border-color 0.15s;
}

.pro-finput-box:focus-within {
    border-color: #2563eb;
    background: #ffffff;
}

.pro-finput-box.pct {
    width: 52px;
    flex-shrink: 0;
}

.pro-finput-box.dim {
    width: 56px;
    flex-shrink: 0;
}

.pro-finput-box.rot {
    width: 44px;
    flex-shrink: 0;
}

.pro-fnum-input,
.pro-fdim-input,
.pro-finput-box :deep(input) {
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

.pro-funit {
    position: absolute;
    right: 4px;
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    pointer-events: none;
}

.pro-figma-divider {
    height: 1px;
    background: #f1f5f9;
    margin: 4px 0;
}

/* Figma-Style 2x2 Grid of Single Inputs */
.pro-figma-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    width: 100%;
    box-sizing: border-box;
}

.pro-figma-grid-cell {
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

.pro-figma-grid-cell:focus-within {
    border-color: #2563eb;
    background: #ffffff;
    box-shadow: 0 0 0 1px #2563eb;
}

.pro-cell-prefix {
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

.pro-cell-input-box {
    display: flex;
    align-items: center;
    flex: 1;
    min-width: 0;
    position: relative;
}

.pro-cell-dim,
.pro-cell-input-box :deep(input) {
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

.pro-cell-unit {
    position: absolute;
    right: 2px;
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    pointer-events: none;
}

/* Option C: CAD Compact Micro-Cards */
.pro-cad-card {
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

.pro-cad-card-header {
    display: flex;
    align-items: center;
    padding-bottom: 2px;
    border-bottom: 1px solid #edf2f7;
}

.pro-cad-card-title {
    font-size: 8.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: #94a3b8;
}

/* CAD Single-line Rows */
.pro-cad-row {
    display: flex;
    align-items: center;
    gap: 4px;
    min-height: 22px;
    width: 100%;
    box-sizing: border-box;
}

.pro-cad-label {
    font-size: 10px;
    font-weight: 600;
    color: #475569;
    flex-shrink: 0;
    min-width: 52px;
}

.pro-cad-controls {
    display: flex;
    align-items: center;
    gap: 3px;
    justify-content: flex-end;
    flex: 1;
    min-width: 0;
}

.pro-cad-chips {
    display: flex;
    align-items: center;
    gap: 1px;
}

.pro-cad-chip {
    padding: 2px 4px;
    font-size: 9px;
    font-weight: 600;
    color: #64748b;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 3px;
    cursor: pointer;
    line-height: 1.2;
    transition: all 0.12s ease;
    min-width: 20px;
    text-align: center;
}

.pro-cad-chip:hover {
    border-color: #94a3b8;
    color: #0f172a;
    background: #f1f5f9;
}

.pro-cad-chip.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    font-weight: 700;
}

.pro-cad-input-box {
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

.pro-cad-input-box.rot {
    width: 38px;
    display: flex;
    align-items: center;
}

.pro-cad-input-box.pro-cad-thickness-box {
    width: 60px;
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.pro-cad-input-box:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37,99,235,0.15);
}

.pro-cad-dim,
.pro-cad-num,
.pro-cad-input-box :deep(input) {
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

.pro-cad-input-box :deep(input::-webkit-outer-spin-button),
.pro-cad-input-box :deep(input::-webkit-inner-spin-button),
.pro-cad-num::-webkit-outer-spin-button,
.pro-cad-num::-webkit-inner-spin-button {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.pro-cad-unit-inline {
    font-size: 9px;
    font-weight: 600;
    color: #94a3b8;
    padding-right: 3px;
    flex-shrink: 0;
    line-height: 1;
}

.pro-cad-cell-unit {
    font-size: 9px !important;
    font-weight: 600 !important;
    color: #94a3b8 !important;
    margin-left: 2px !important;
    line-height: 1 !important;
    flex-shrink: 0 !important;
    user-select: none !important;
}

/* CAD 2x2 Grid (Placement & Bounds) */
.pro-cad-grid-2col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    width: 100%;
    box-sizing: border-box;
}

.pro-cad-grid-cell {
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

.pro-cad-grid-cell:focus-within {
    border-color: #2563eb;
    box-shadow: 0 0 0 1px rgba(37,99,235,0.15);
}

.pro-cad-cell-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.pro-cad-cell-label {
    font-size: 9.5px;
    font-weight: 700;
    color: #475569;
}

.pro-cad-cell-cm-wrap {
    display: flex;
    align-items: center;
    gap: 1px;
}

.pro-cad-dim-sub,
.pro-cad-cell-cm-wrap :deep(input) {
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

.pro-cad-dim-sub:focus,
.pro-cad-cell-cm-wrap :deep(input:focus) {
    color: #0f172a !important;
    font-weight: 700 !important;
}

.pro-cad-dim-sub::-webkit-outer-spin-button,
.pro-cad-dim-sub::-webkit-inner-spin-button,
.pro-cad-cell-cm-wrap :deep(input::-webkit-outer-spin-button),
.pro-cad-cell-cm-wrap :deep(input::-webkit-inner-spin-button) {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.pro-cad-sub-unit {
    font-size: 8px;
    font-weight: 500;
    color: #94a3b8;
}

.pro-cad-cell-bot {
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

.pro-cad-pct-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    min-width: 0;
}

.pro-cad-pct-input {
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

.pro-cad-pct-input::-webkit-outer-spin-button,
.pro-cad-pct-input::-webkit-inner-spin-button {
    -webkit-appearance: none !important;
    margin: 0 !important;
}

.pro-cad-pct-unit {
    font-size: 9px;
    font-weight: 600;
    color: #2563eb;
    margin-left: 1px;
}

.pro-cad-stepper {
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

.pro-cad-stepper:hover {
    color: #2563eb;
    border-color: #2563eb;
    background: #eff6ff;
}

.pro-cad-stepper:active {
    color: #ffffff;
    background: #2563eb;
    border-color: #2563eb;
}

/* CAD Header Action Buttons (Flip H, Flip Face) */
.pro-cad-actions-inline {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-left: auto;
}

.pro-cad-action-btn {
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

.pro-cad-action-btn:hover {
    border-color: #2563eb;
    color: #2563eb;
    background: #eff6ff;
}

/* CAD 1-Click Alignment Toolbar */
.pro-cad-align-bar {
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: 4px;
    background: #f1f5f9;
    border-radius: 4px;
    margin-bottom: 4px;
    box-sizing: border-box;
}

.pro-cad-align-row {
    display: flex;
    align-items: center;
    gap: 4px;
}

.pro-cad-align-label {
    font-size: 8px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    color: #64748b;
    min-width: 38px;
    flex-shrink: 0;
}

.pro-cad-align-group {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1;
}

.pro-cad-align-btn {
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

.pro-cad-align-btn:hover {
    border-color: #2563eb;
    color: #2563eb;
    background: #eff6ff;
}

.pro-cad-align-btn.active {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
    font-weight: 700;
}

.pro-cad-align-btn.fill-btn {
    background: #f8fafc;
    border-color: #94a3b8;
    color: #1e293b;
    font-weight: 700;
}

.pro-cad-align-btn.fill-btn:hover {
    background: #2563eb;
    border-color: #2563eb;
    color: #ffffff;
}

/* CAD Reference Mode Toggle in Cell Label */
.pro-cad-cell-label-wrap {
    display: flex;
    align-items: center;
    gap: 3px;
}

.pro-cad-ref-toggle {
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

.pro-cad-ref-toggle:hover {
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

.pro-edge-inline {
    display: flex;
    align-items: center;
    gap: 12px;
}

.pro-btn-remove-compact {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    padding: 5px 8px;
    border-radius: 5px;
    border: 1px solid #fee2e2;
    background: #ffffff;
    color: #ef4444;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    margin-top: 4px;
    width: 100%;
}

.pro-btn-remove-compact:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
}

.pro-track-btn {
    /* Kept for test compatibility and preset buttons */
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.pro-track-btn:hover {
    color: #0f172a;
}

.pro-track-btn.active {
    background: #ffffff;
    color: #2563eb;
    font-weight: 700;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

/* 8. Empty State Card (Aligned to 16px gutter) */
.pro-empty-card {
    padding: 20px 16px;
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    text-align: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    box-sizing: border-box;
    width: 100%;
}

.pro-empty-icon {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: #f1f5f9;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #94a3b8;
}

.pro-empty-title {
    font-size: 12px;
    font-weight: 700;
    color: #334155;
}

.pro-empty-desc {
    font-size: 11px;
    color: #64748b;
}

.pro-empty-hint {
    font-size: 10px;
    color: #94a3b8;
    font-style: italic;
}

/* 9. Delete Button (Aligned to 16px gutter) */
.pro-btn-danger {
    margin: 16px 16px 24px 16px;
    width: calc(100% - 32px);
    padding: 9px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #ef4444;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.15s ease;
    box-sizing: border-box;
}

.pro-btn-danger:hover {
    background: #fee2e2;
    border-color: #fca5a5;
    color: #dc2626;
}

/* 10. Placement & Spatial Coordinates Card */
.pro-coords-card {
    margin: 8px 16px 12px 16px;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-sizing: border-box;
    width: calc(100% - 32px);
}

.pro-coords-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e2e8f0;
    padding-bottom: 6px;
}

.pro-coords-title {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    color: #475569;
}

.pro-coords-title svg {
    color: #2563eb;
}

.pro-coords-elev {
    font-size: 10px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 2px 6px;
    border-radius: 4px;
    border: 1px solid #dbeafe;
}

.pro-coords-grid {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.pro-coord-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 10.5px;
}

.pro-coord-label {
    color: #64748b;
    font-weight: 600;
}

.pro-coord-val {
    color: #0f172a;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    font-size: 10.5px;
}

/* Dual Unit Input Controls (alias for test compatibility) */
.pro-dual-input-row {
    /* Style handled by .pro-figma-grid-cell */
}
</style>
