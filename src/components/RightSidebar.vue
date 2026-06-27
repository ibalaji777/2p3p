<template>
  <aside class="right-sidebar" v-show="!(isMobile || isTablet) || ((isMobile || isTablet) && mobileMenuOpen && ['levels', 'properties', 'layers', 'settings'].includes(activeMobileTab))" :class="{'mobile-panel': isMobile || isTablet}">
    <div v-if="isMobile || isTablet" class="mobile-close-btn" @click="$emit('update:mobileMenuOpen', false)">✕ Close</div>
    <div class="panel levels-panel" v-show="!(isMobile || isTablet) || activeMobileTab === 'levels'">
        <div class="panel-header"><h3>Floor Levels</h3></div>
        <div class="levels-list">
            <div v-if="viewMode === '3d'" class="level-item" @click="$emit('toggle-all-floors')" style="background: #fafafa; border-bottom: 1px solid #f1f5f9;">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <input type="checkbox" :checked="allFloorsVisible" @change="$emit('toggle-all-floors')" @click.stop title="Toggle All">
                    <span style="font-weight: bold;">Show All</span>
                </div>
            </div>
            <div v-for="(level, index) in levels" :key="level.id" 
                 class="level-item" 
                 :class="{ 'active': activeLevelIndex === index && viewMode === '2d' }"
                 @click="$emit('switch-level', index)">
                <div style="display:flex; align-items:center; gap: 8px;">
                    <input v-if="viewMode === '3d'" type="checkbox" :checked="level.isVisible !== false" @change="(e) => { level.isVisible = e.target.checked; $emit('level-visibility-change'); }" @click.stop title="Toggle Visibility">
                    <span>Floor {{ index + 1 }}</span>
                </div>
                <span class="level-indicator" v-if="activeLevelIndex === index && viewMode === '2d'">Active</span>
            </div>
        </div>
        <div class="levels-actions">
            <button class="btn-duplicate" @click="$emit('add-level', 'duplicate')">+ Duplicate Current</button>
            <button class="btn-empty" @click="$emit('add-level', 'empty')">+ Add Empty Floor</button>
        </div>
    </div>

    <div class="panel tabs-panel flex-1" v-show="!(isMobile || isTablet) || ['properties', 'layers', 'settings'].includes(activeMobileTab)">
        <div class="tabs-header" v-show="!(isMobile || isTablet)">
            <button :class="{active: activeRightTab === 'properties'}" @click="$emit('update:activeRightTab', 'properties')">Properties</button>
            <button :class="{active: activeRightTab === 'layers'}" @click="$emit('update:activeRightTab', 'layers')">Layer List</button>
            <button :class="{active: activeRightTab === 'settings'}" @click="$emit('update:activeRightTab', 'settings')">Settings</button>
        </div>
        
        <div class="tab-body" v-show="activeRightTab === 'settings'">
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
                    <button class="btn-primary" style="width: 100%;" @click="$emit('set-entrance-wall')">Set Selected Wall as Entrance</button>
                </div>
            </div>
        </div>

        <div class="tab-body" v-show="activeRightTab === 'properties'">
            <div class="props-content" v-if="(viewMode==='3d' || viewMode==='2d') && selectedEntity && viewMode3D !== 'preview'">
            
            <!-- Universal Face Material Editor -->
            <div v-if="selectedEntity.params && selectedEntity.params.isEditingMaterials">
                <button class="btn-secondary" @click="selectedEntity.params.isEditingMaterials = false" style="width: 100%; margin-bottom: 15px;">← Back to Properties</button>
                <h4 class="props-subtitle">Face Selection</h4>
                <div class="control-group-inline" style="margin-bottom: 12px;">
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
            
            <div v-else-if="selectedType === 'wall'">
                <h4 class="props-subtitle" v-if="selectedEntity.type === 'railing'">Railing Properties</h4>
                <h4 class="props-subtitle" v-else>Wall Properties</h4>
                <div class="control-group"><label>Hidden Wall</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hidden" @change="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="$emit('sync-engine')"></div></div>

                <div v-if="selectedEntity.type === 'railing'">
                    <div class="decor-gallery">
                        <h4 class="props-subtitle">Railing Material</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in railingRegistry" :key="key" class="decor-item" @click="selectedEntity.configId = key; $emit('ui-trigger'); $emit('sync-engine')" :class="{ active: (selectedEntity.configId || 'rail_1') === key && uiTrigger !== -1 }">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-else>
                    <h4 class="props-subtitle">{{ selectedWallSide === 'front' ? 'Inner Wall Face' : 'Outer Wall Face' }}</h4>
                    
                    <div v-if="currentFaceDecors.length > 0">
                        <div class="applied-list">
                            <div v-for="decor in currentFaceDecors" :key="decor.id" class="applied-item-wrapper">
                                <div class="applied-item-header" :class="{active: activeDecorId === decor.id}" @click="$emit('toggle-edit-decor', decor.id)">
                                    <span>{{ wallDecorRegistry[decor.configId]?.name }}</span>
                                    <button class="btn-sm-delete" @click.stop="$emit('delete-specific-decor', decor)">✕</button>
                                </div>
                                <div class="applied-item-body" v-if="activeDecorId === decor.id">
                                    <div class="faceRow" v-if="decor.faces">
                                        <label><input type="checkbox" v-model="decor.faces.left" @change="$emit('decor-update', decor)">L-Edge</label>
                                        <label><input type="checkbox" v-model="decor.faces.right" @change="$emit('decor-update', decor)">R-Edge</label>
                                    </div>
                                    <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', decor)"></div></div>
                                    <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', decor)"></div></div>
                                    <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.width" min="1" max="100" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.width" min="1" max="100" step="1" @input="$emit('decor-update', decor)"></div></div>
                                    <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.height" min="1" max="100" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.height" min="1" max="100" step="1" @input="$emit('decor-update', decor)"></div></div>
                                    <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localX" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.localX" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"></div></div>
                                    <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localY" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"><input type="number" v-model.number="decor.localY" min="-10" max="110" step="1" @input="$emit('decor-update', decor)"></div></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    

                    
                    <div class="decor-gallery" v-if="viewMode === '3d'">
                        <h4 class="props-subtitle">Add Pattern Layer</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('spawn-wall-pattern', key)">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" @click="$emit('delete-entity')">Delete {{ selectedEntity.type === 'railing' ? 'Railing' : 'Wall' }}</button>
            </div>

            <div v-else-if="selectedType === 'wallDecor'">
                <h4 class="props-subtitle">Wall Pattern Layer</h4>
                <div class="faceRow" v-if="selectedEntity.faces">
                    <label><input type="checkbox" v-model="selectedEntity.faces.left" @change="$emit('decor-update', selectedEntity)">L-Edge</label>
                    <label><input type="checkbox" v-model="selectedEntity.faces.right" @change="$emit('decor-update', selectedEntity)">R-Edge</label>
                </div>
                <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.tileSize" min="1" max="200" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.depth" min="0.1" max="40" step="0.1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.width" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.height" min="1" max="100" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.localX" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.localX" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.localY" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"><input type="number" v-model.number="selectedEntity.localY" min="-10" max="110" step="1" @input="$emit('decor-update', selectedEntity)"></div></div>
                
                <div class="decor-gallery" style="margin-top: 15px;">
                    <h4 class="props-subtitle">Change Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="() => { selectedEntity.configId = key; $emit('sync-engine'); }" :class="{ active: selectedEntity.configId === key }">
                            <img :src="config.thumbnail || config.texture" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" style="margin-top: 10px;" @click="$emit('delete-entity')">Delete Pattern</button>
            </div>

            <div v-else-if="selectedType === 'arc'">
                <h4 class="props-subtitle">Curved Wall Properties</h4>
                <div class="control-group"><label>Hidden Wall</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hidden" @change="() => { selectedEntity.walls.forEach(w => w.hidden = selectedEntity.hidden); $emit('sync-engine'); }"></div></div>
                <button class="hud-delete" @click="$emit('delete-entity')">Delete Curved Wall</button>
            </div>

            <div v-else-if="selectedType === 'room'">
                <h4 class="props-subtitle">Floor Properties</h4>
                <div class="control-group">
                    <label>Material Scale</label>
                    <div class="input-wrap">
                        <input type="range" :value="selectedEntity.materialRepeat || floorRegistry[selectedEntity.configId]?.repeat || 10" @input="e => { selectedEntity.materialRepeat = parseFloat(e.target.value); $emit('sync-engine'); }" min="1" max="100" step="1">
                        <input type="number" :value="selectedEntity.materialRepeat || floorRegistry[selectedEntity.configId]?.repeat || 10" @input="e => { selectedEntity.materialRepeat = parseFloat(e.target.value); $emit('sync-engine'); }" min="1" max="100" step="1">
                    </div>
                </div>
                <div class="decor-gallery">
                    <h4 class="props-subtitle">Floor Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in floorRegistry" :key="key" class="decor-item" @click="$emit('set-floor-material', key)" :class="{ active: selectedEntity.configId === key }">
                            <img :src="config.thumbnail" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" @click="$emit('delete-entity')">Delete Floor & Walls</button>
            </div>

            <div v-else-if="selectedType === 'advance_openings'">
                <h4 class="props-subtitle">Advanced Opening Properties</h4>
                <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.width" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="300" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" @input="$emit('sync-engine')"></div></div>
                <div class="control-group" v-if="selectedEntity.type === 'niche_recess'"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="1" max="50" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="200" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.elevation" @input="$emit('sync-engine')"></div></div>
                <div v-if="selectedEntity.type === 'pattern_opening'">
                    <div class="control-group">
                        <label>Pattern Style</label>
                        <select v-model="selectedEntity.patternStyle" @change="$emit('sync-engine')" class="settings-select">
                            <option value="grid">Square Grid</option>
                            <option value="diamond">Diamond Lattice</option>
                            <option value="circle">Circular Perforations</option>
                            <option value="cross">Terracotta Cross (Kerala)</option>
                            <option value="hexagon">Honeycomb (Chettinad)</option>
                            <option value="star">Floral Star</option>
                            <option value="slit">Vertical Slits</option>
                            <option value="terracotta">Terracotta Jali (Classic)</option>
                            <option value="arabesque">Geometric Arabesque</option>
                        </select>
                    </div>
                    <div class="control-group"><label>Rows</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rows" min="1" max="20" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rows" @input="$emit('sync-engine')"></div></div>
                    <div class="control-group"><label>Columns</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.cols" min="1" max="20" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.cols" @input="$emit('sync-engine')"></div></div>
                    <div class="control-group"><label>Spacing</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.spacing" min="0" max="50" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.spacing" @input="$emit('sync-engine')"></div></div>
                </div>
                
                <div class="decor-gallery" v-if="viewMode === '3d'">
                    <h4 class="props-subtitle">Opening Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="$emit('set-opening-material', key)" :class="{ active: selectedEntity.decorConfigId === key }">
                            <img :src="config.thumbnail" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" @click="$emit('delete-entity')">Delete Opening</button>
            </div>

            <div v-else-if="selectedType === 'widget'">
                <h4 class="props-subtitle">{{ selectedEntity.config?.label || 'DOOR/WINDOW' }} Properties</h4>
                <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="200" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.width" @input="$emit('sync-engine')"></div></div>
                <div class="control-group" v-if="selectedEntity.type === 'elevation_fascia'"><label>Height (Drop)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="400" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" @input="$emit('sync-engine')"></div></div>
                <div class="faceRow" v-if="selectedEntity.type !== 'jali_panel' && selectedEntity.type !== 'elevation_fascia' && selectedEntity.type !== 'sunshade'">
                    <button class="action-btn clear" style="flex: 1; padding: 4px;" @click="selectedEntity.facing *= -1; $emit('sync-engine')">Flip In/Out</button>
                    <button class="action-btn clear" style="flex: 1; padding: 4px;" @click="selectedEntity.side *= -1; $emit('sync-engine')">Flip L/R</button>
                </div>
                <div v-if="selectedEntity.type === 'door'">
                    <div class="control-group">
                        <label>Door Type</label>
                        <select v-model="selectedEntity.doorType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="single">Single Hinged</option>
                            <option value="double">Double Door</option>
                            <option value="sliding">Sliding</option>
                            <option value="pocket">Pocket</option>
                            <option value="french">French (Glass)</option>
                        </select>
                    </div>
                    <div class="control-group" v-if="selectedEntity.doorType !== 'french'">
                        <label>Panel Style (3D Design)</label>
                        <select v-model="selectedEntity.doorStyle" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="flat">Flat Panel (Default)</option>
                            <option value="classic_4_horizontal">Classic 4-Panel (Horiz)</option>
                            <option value="classic_2_panel">Classic 2-Panel</option>
                            <option value="classic_4_panel">Classic 4-Panel</option>
                            <option value="grid_panel">Grid Panel</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Door Shape (Top)</label>
                        <select v-model="selectedEntity.doorShape" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="square">Square (Default)</option>
                            <option value="radius">Radius (True Arch)</option>
                            <option value="segment">Segment (Eyebrow)</option>
                            <option value="gothic">Gothic (Pointed)</option>
                        </select>
                    </div>
                </div>
                <div v-else-if="selectedEntity.type === 'window'">
                    <div class="control-group">
                        <label>Window Type</label>
                        <select v-model="selectedEntity.windowType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="sliding_std">Standard Sliding</option>
                            <option value="casement_std">Casement / Hinged</option>
                            <option value="fixed_elevation">Fixed Glass</option>
                            <option value="bay_box">Box Bay Window</option>
                        </select>
                    </div>
                </div>
                <div v-else-if="selectedEntity.type === 'sunshade'">
                    <div class="control-group">
                        <label>Depth (Projection)</label>
                        <div class="input-wrap">
                            <input type="range" v-model.number="selectedEntity.depth" min="5" max="100" @input="$emit('sync-engine')">
                            <input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')">
                        </div>
                    </div>
                    <div class="control-group">
                        <label>Sunshade (Chajja) Style</label>
                        <select v-model="selectedEntity.chajjaType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <!-- Existing Styles -->
                            <option value="concrete_slab">Concrete Slab (RCC)</option>
                            <option value="wooden_pergola">Wooden Pergola</option>
                            <option value="metal_louvers">Metal Louvers</option>
                            <option value="glass_canopy">Glass Canopy</option>
                            <!-- New Styles -->
                            <option value="polycarbonate_canopy">Polycarbonate Canopy</option>
                            <option value="metal_canopy">Metal Canopy</option>
                            <option value="curved_rcc">Curved RCC</option>
                            <option value="cantilever_rcc">Cantilever RCC</option>
                            <option value="jali_canopy">Decorative Jali</option>
                            <option value="box_frame">Box Frame</option>
                        </select>
                    </div>
                    
                    <div v-if="selectedEntity.chajjaType === 'box_frame'" class="control-group">
                        <label>Frame Drop Height (For Window Wrap)</label>
                        <div class="input-wrap">
                            <input type="range" v-model.number="selectedEntity.frameHeight" min="20" max="300" @input="$emit('sync-engine')">
                            <input type="number" v-model.number="selectedEntity.frameHeight" @input="$emit('sync-engine')">
                        </div>
                    </div>
                </div>
                <div v-else-if="selectedEntity.type === 'jali_panel'">
                    <div class="control-group">
                        <label>Jali Pattern</label>
                        <select v-model="selectedEntity.jaliPattern" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="geometric">Geometric Lattice</option>
                            <option value="islamic">Islamic Star</option>
                            <option value="modern">Modern Slats</option>
                            <option value="kolam">Kolam (Rangoli)</option>
                            <option value="lotus">Lotus Motif</option>
                            <option value="peacock">Peacock (Mayil)</option>
                            <option value="gopuram">Temple Gopuram</option>
                            <option value="ventilation">Geometric Vent Block</option>
                            <option value="mango">Mango Paisley Vine</option>
                            <option value="chettinad">Chettinad Wooden Jali</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Pattern Size</label>
                        <div class="input-wrap">
                            <input type="range" :value="selectedEntity.jaliPatternSize || 20" @input="e => { selectedEntity.jaliPatternSize = parseFloat(e.target.value); $emit('sync-engine'); }" min="5" max="100" step="1">
                            <input type="number" :value="selectedEntity.jaliPatternSize || 20" @input="e => { selectedEntity.jaliPatternSize = parseFloat(e.target.value); $emit('sync-engine'); }" min="5" max="100" step="1">
                        </div>
                    </div>
                    <div class="control-group">
                        <label>Material</label>
                        <select v-model="selectedEntity.jaliMat" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="wood">Teak Wood</option>
                            <option value="mdf">White Painted MDF</option>
                            <option value="brass">Brass Finish</option>
                            <option value="wpc">WPC (Wood Plastic)</option>
                            <option value="stone">Sandstone</option>
                            <option value="metal_black">Matte Black Metal</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Mounting</label>
                        <select v-model="selectedEntity.jaliMount" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="flush">Flush (Centered)</option>
                            <option value="recessed">Recessed (Inset)</option>
                            <option value="protruding">Protruding (Surface)</option>
                        </select>
                    </div>
                </div>
                <div v-else-if="selectedEntity.type === 'elevation_fascia'">
                    <div class="control-group">
                        <label>Profile Type</label>
                        <select v-model="selectedEntity.profileType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="c_shape_left">C-Shape (Left)</option>
                            <option value="c_shape_right">C-Shape (Right)</option>
                            <option value="l_shape_left">L-Shape (Left)</option>
                            <option value="l_shape_right">L-Shape (Right)</option>
                            <option value="full_box">Full Box Wrap</option>
                        </select>
                    </div>
                    <div class="control-group" v-if="selectedEntity.profileType !== 'full_box'">
                        <label>Top Arm Length</label>
                        <div class="input-wrap">
                            <input type="range" :value="selectedEntity.topArm !== undefined ? selectedEntity.topArm : selectedEntity.width" @input="e => { selectedEntity.topArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                            <input type="number" :value="selectedEntity.topArm !== undefined ? selectedEntity.topArm : selectedEntity.width" @input="e => { selectedEntity.topArm = parseFloat(e.target.value); $emit('sync-engine'); }">
                        </div>
                    </div>
                    <div class="control-group" v-if="['c_shape_left', 'c_shape_right'].includes(selectedEntity.profileType)">
                        <label>Bottom Arm Length</label>
                        <div class="input-wrap">
                            <input type="range" :value="selectedEntity.bottomArm !== undefined ? selectedEntity.bottomArm : selectedEntity.width" @input="e => { selectedEntity.bottomArm = parseFloat(e.target.value); $emit('sync-engine'); }" min="10" max="400">
                            <input type="number" :value="selectedEntity.bottomArm !== undefined ? selectedEntity.bottomArm : selectedEntity.width" @input="e => { selectedEntity.bottomArm = parseFloat(e.target.value); $emit('sync-engine'); }">
                        </div>
                    </div>
                    <div class="control-group"><label>Depth (Overhang)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="5" max="150" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')"></div></div>
                    <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.thick" min="2" max="50" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.thick" @input="$emit('sync-engine')"></div></div>
                    <div class="control-group"><label>Elevation (Bottom)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="300" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.elevation" @input="$emit('sync-engine')"></div></div>
                    <div class="control-group">
                        <label>Material</label>
                        <select v-model="selectedEntity.fasciaMat" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="white">White Paint</option>
                            <option value="dark_grey">Dark Grey</option>
                            <option value="stone">Stone Cladding</option>
                            <option value="wood">Wood Panel</option>
                        </select>
                    </div>
                </div>

                <button class="hud-delete" @click="$emit('delete-entity')">Delete Object</button>
            </div>

            <div v-else-if="selectedType === 'molding'">
                <h4 class="props-subtitle">Molding / Cornice Properties</h4>
                <div class="control-group"><label>Length</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.width" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Depth (Thickness)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="1" max="100" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.heightOffset" min="0" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.heightOffset" @input="$emit('sync-engine')"></div></div>
                
                <div class="control-group">
                    <label>Placement Side</label>
                    <select v-model="selectedEntity.side" @change="selectedEntity.update(); $emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                        <option value="left">Left (Inner)</option>
                        <option value="right">Right (Outer)</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Profile Type</label>
                    <select v-model="selectedEntity.profileType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                        <option value="flat">Flat Band</option>
                        <option value="groove">Groove (Recessed)</option>
                        <option value="frame">Frame (Beveled Edge)</option>
                        <option value="crown">Cove Crown</option>
                        <option value="ogee">Ogee (Cyma) Crown</option>
                        <option value="egg_and_dart">Egg and Dart Ornate</option>
                        <option value="dentil">Dentil Blocks</option>
                        <option value="craftsman">Step / Craftsman</option>
                        <option value="layered">Layered Steps</option>
                    </select>
                </div>

                <div v-if="selectedEntity.profileType === 'layered'">
                    <div class="control-group"><label>Layers</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.layers" min="2" max="10" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.layers" @input="$emit('sync-engine')"></div></div>
                </div>

                <div class="control-group">
                    <label>Material</label>
                    <select v-model="selectedEntity.material" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                        <option value="white_paint">White Paint (Plaster)</option>
                        <option value="wall_material">Wall Match</option>
                        <option value="wood_dark">Dark Wood</option>
                        <option value="black_metal">Black Metal</option>
                    </select>
                </div>


                <button class="hud-delete" @click="$emit('delete-entity')">Delete Molding</button>
            </div>

            <div v-else-if="selectedType === 'shape'">
                <div v-if="!selectedEntity.params.isEditingMaterials">
                    <h4 class="props-subtitle">{{ selectedEntity.type === 'shape_rect' ? 'Box' : selectedEntity.type === 'shape_circle' ? 'Cylinder' : 'Prism / Polygon' }} Properties</h4>
                    <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rotation" @input="$emit('sync-engine')"></div></div>
                    <div class="control-group"><label>Height (Thickness)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.height3D" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.height3D" @input="$emit('sync-engine')"></div></div>
                    <div v-if="selectedEntity.type === 'shape_rect'">
                        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.width" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.width" @input="$emit('sync-engine')"></div></div>
                        <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.height" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.height" @input="$emit('sync-engine')"></div></div>
                    </div>
                    <div v-if="selectedEntity.type === 'shape_circle'">
                        <div class="control-group"><label>Radius</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.radius" min="10" max="1000" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.params.radius" @input="$emit('sync-engine')"></div></div>
                    </div>
                    <div class="control-group"><label>Color</label><div class="input-wrap"><input type="color" v-model="selectedEntity.params.fill" @input="e => { $emit('clear-shape-textures'); $emit('sync-engine'); }" style="width: 100%; padding: 0;"></div></div>

                    <button class="hud-delete" @click="$emit('delete-entity')" style="margin-top: 10px;">Delete Shape</button>
                </div>
            </div>

            <div v-else-if="selectedType === 'furniture'">
                <h4 class="props-subtitle">{{ selectedEntity.config?.name || 'Object' }}</h4>
                <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.rotation" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.width" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.depth" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="500" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.height" @input="$emit('sync-engine')"></div></div>
                

                <button class="hud-delete" @click="$emit('delete-entity')">Delete Object</button>
            </div>

            <div v-else-if="selectedType === 'roof'">
                <h4 class="props-subtitle">Roof Properties</h4>
                <div class="control-group">
                    <select v-model="selectedEntity.config.roofType" @change="$emit('sync-engine')" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                        <option value="hip">Hip Roof</option>
                        <option value="flat">Flat Roof</option>
                    </select>
                </div>
                <div class="control-group" v-if="selectedEntity.config.roofType === 'hip'"><label>Pitch (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.pitch" min="0" max="60" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.config.pitch" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Overhang</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.overhang" min="0" max="50" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.config.overhang" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Elevation Gap</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.wallGap" min="-50" max="100" @input="$emit('sync-engine')"><input type="number" v-model.number="selectedEntity.config.wallGap" @input="$emit('sync-engine')"></div></div>
                
                <div class="decor-gallery">
                    <h4 class="props-subtitle">Roof Material</h4>
                    <div class="decor-grid">
                        <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="$emit('set-roof-material', key)" :class="{ active: selectedEntity.config.material === key }">
                            <img :src="config.thumbnail" />
                            <span>{{ config.name }}</span>
                        </div>
                    </div>
                </div>

                <button class="hud-delete" @click="$emit('delete-entity')">Delete Roof</button>
            </div>
        </div>

        <div class="props-empty" v-else v-show="activeRightTab === 'properties'">
            <span v-if="viewMode==='2d'">Select a wall, door, window, or object on the canvas to edit its properties here.</span>
            <span v-else-if="viewMode3D==='preview'">Exit Preview Mode to edit.</span>
            <span v-else>Select a wall or object to edit its properties.</span>
        </div>
        </div>

        <div class="layers-content" v-show="activeRightTab === 'layers'">
            <div class="layers-list">
                <div v-for="item in layerItems" :key="item.id" class="layer-item" :class="{active: selectedEntity === item.entity}" @click="$emit('select-layer-item', item)">
                    <div class="layer-info">
                        <div class="layer-title-row">
                            <span class="layer-type-icon">{{ getLayerIcon(item.type) }}</span>
                            <span class="layer-name">{{ item.name }}</span>
                        </div>
                        <input type="text" v-model="item.entity.description" @input="$emit('debounced-save-history')" @click.stop @keydown.stop placeholder="Add description..." class="layer-desc-input" />
                    </div>
                    <div class="layer-actions">
                        <button @click.stop="$emit('toggle-layer-visibility', item)" :title="item.entity.isHidden ? 'Show' : 'Hide'">
                            {{ item.entity.isHidden ? '👁️‍🗨️' : '👁️' }}
                        </button>
                        <button @click.stop="$emit('remove-layer-item', item)" title="Delete">🗑️</button>
                    </div>
                </div>
                <div v-if="layerItems.length === 0" class="props-empty">No objects in the current floor.</div>
            </div>
        </div>
    </div>
  </aside>
</template>

<script setup>
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY } from '../core/registry';

const props = defineProps({
  isMobile: Boolean,
  isTablet: Boolean,
  mobileMenuOpen: Boolean,
  activeMobileTab: String,
  viewMode: String,
  viewMode3D: String,
  levels: Array,
  activeLevelIndex: Number,
  allFloorsVisible: Boolean,
  activeRightTab: String,
  floorPlanSettings: Object,
  selectedSky: String,
  selectedGround: String,
  skyRegistry: Object,
  groundRegistry: Object,
  selectedType: String,
  selectedEntity: Object,
  railingRegistry: Object,
  selectedWallSide: String,
  currentFaceDecors: Array,
  activeDecorId: String,
  wallDecorRegistry: Object,
  uiTrigger: Number,
  floorRegistry: Object,
  roofDecorRegistry: Object,
  layerItems: Array
});

const emit = defineEmits([
  'update:mobileMenuOpen',
  'update:activeRightTab',
  'update:selectedSky',
  'update:selectedGround',
  'toggle-all-floors',
  'level-visibility-change',
  'switch-level',
  'add-level',
  'sync-settings',
  'set-entrance-wall',
  'set-sky',
  'set-ground',
  'sync-engine',
  'ui-trigger',
  'toggle-edit-decor',
  'delete-specific-decor',
  'decor-update',
  'spawn-wall-pattern',
  'delete-entity',
  'set-floor-material',
  'set-opening-material',
  'clear-shape-textures',
  'set-shape-material',
  'set-roof-material',
  'select-layer-item',
  'toggle-layer-visibility',
  'remove-layer-item',
  'debounced-save-history'
]);

const getLayerIcon = (type) => {
    const icons = {
            'wall': '🧱', 'railing': '🪜', 'room': '⬜', 'furniture': '🛋️',
            'shape': '🔳', 'roof': '🏠', 'stair': '📶', 'widget': '🚪', 'arc': '🌙', 'advance_openings': '✂️'
    };
    return icons[type] || '📦';
};

const isShapeMaterialActive = (key) => {
    if (!props.selectedEntity || !props.selectedEntity.params) return false;
    const target = props.selectedEntity.params.materialTarget || 'all';
    if (target === 'all') return props.selectedEntity.params.texture === key;
    if (target === 'top') return props.selectedEntity.params.textureTop === key;
    if (target === 'sides') return props.selectedEntity.params.textureSides === key;
    if (target === 'left') return props.selectedEntity.params.textureLeft === key;
    if (target === 'right') return props.selectedEntity.params.textureRight === key;
    if (target === 'front') return props.selectedEntity.params.textureFront === key;
    if (target === 'back') return props.selectedEntity.params.textureBack === key;
    if (target === 'bottom') return props.selectedEntity.params.textureBottom === key;
    return false;
};
</script>