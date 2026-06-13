<template>
  <div class="app-root">
    <header class="top-toolbar">
       <div class="left-tools">
           <button class="tool-btn" :class="{active: viewMode==='2d'}" @click="switchTo2D">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
                   <path d="M15 5l4 4"></path>
                   <path d="M3 21h6v-6"></path>
               </svg>
               <span class="tool-label">2D Plan</span>
           </button>

           <button class="tool-btn" :class="{active: viewMode==='3d'}" @click="switchTo3D">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                   <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                   <line x1="12" y1="22.08" x2="12" y2="12"></line>
               </svg>
               <span class="tool-label">3D Build</span>
           </button>
       </div>
       
       <div class="center-tools" v-if="viewMode==='2d'">
       </div>

       <div class="right-tools" v-if="viewMode==='3d'">
           <div class="tool-group">
               <button class="tool-btn" :class="{active: viewMode3D === 'full-edit'}" @click="togglePreviewMode">
                   <svg v-if="viewMode3D === 'preview'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                   <svg v-else class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                   <span class="tool-label">{{ viewMode3D === 'preview' ? 'Build Mode' : 'Walkthrough' }}</span>
               </button>
           </div>
       </div>
       
       <div class="right-tools" v-if="viewMode==='2d'">
           <button class="tool-btn" @click="undo" :disabled="historyIndex <= 0" title="Undo (Ctrl+Z)">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M3 7v6h6"></path>
                   <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"></path>
               </svg>
               <span class="tool-label">Undo</span>
           </button>
           <button class="tool-btn" @click="redo" :disabled="historyIndex >= historyStack.length - 1" title="Redo (Ctrl+Y)">
               <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                   <path d="M21 7v6h-6"></path>
                   <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"></path>
               </svg>
               <span class="tool-label">Redo</span>
           </button>
       </div>
    </header>

    <div class="main-workspace" @mouseup="debouncedSaveHistory" @touchend="debouncedSaveHistory">
      <LeftSidebar
        :view-mode="viewMode"
        :is-mobile="isMobile"
        :is-tablet="isTablet"
        :mobile-menu-open="mobileMenuOpen"
        :active-mobile-tab="activeMobileTab"
        :menu-categories="menuCategories"
        :active-category="activeCategory"
        :active-category-obj="activeCategoryObj"
        :active-tool="activeTool"
        @close-mobile-menu="mobileMenuOpen = false"
        @toggle-category="toggleCategory"
        @save-project="saveProject"
        @open-save-popup="openSavePopup"
        @trigger-file-input="triggerFileInput"
        @clear-workspace="clearWorkspace"
        @file-uploaded="handleFileUpload"
        @tool-click="handleToolClick"
      />

      <!-- Mobile Left Trigger -->
      <div class="mobile-left-trigger" v-if="(isMobile || isTablet) && viewMode === '2d' && !(mobileMenuOpen && activeMobileTab === 'tools')" @click="toggleMobileTab('tools')" title="Open Tools">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </div>

      <!-- Mobile Bottom Navigation -->
      <div class="mobile-bottom-nav" v-if="isMobile || isTablet">
        <button @click="toggleMobileTab('levels')" :class="{active: activeMobileTab === 'levels' && mobileMenuOpen}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="bottom-nav-icon"><path d="M3 21h18"></path><path d="M5 21V7l8-4v18"></path><path d="M19 21V11l-6-3"></path><path d="M9 9v.01"></path><path d="M9 13v.01"></path><path d="M9 17v.01"></path></svg>
            <span>Floors</span>
        </button>
        <button @click="toggleMobileTab('properties')" :class="{active: activeMobileTab === 'properties' && mobileMenuOpen}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="bottom-nav-icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span>Props</span>
        </button>
        <button @click="toggleMobileTab('layers')" :class="{active: activeMobileTab === 'layers' && mobileMenuOpen}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="bottom-nav-icon"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
            <span>Layers</span>
        </button>
        <button @click="toggleMobileTab('settings')" :class="{active: activeMobileTab === 'settings' && mobileMenuOpen}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="bottom-nav-icon"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Settings</span>
        </button>
      </div>
      
      <main class="canvas-container">
        <div class="hint" :style="{ background: hintData.color }" v-show="viewMode === '2d' && showGuide">{{ hintData.text }}</div>
        
        <div class="floating-advanced-toolbar" v-show="viewMode === '2d'">
            <div class="adv-dropdown">
                <button class="adv-trigger-btn" @click="handleAdvTriggerClick" :class="{active: showAdvancedTools || isAdvancedToolActive}" :title="isAdvancedToolActive ? 'Clear Tool' : 'Advanced Tools'">
                    <span v-if="isAdvancedToolActive" style="color: #fca5a5; font-size: 16px;">✕</span>
                    <span v-else>⚙️</span>
                </button>
                <div class="adv-side-menu" v-show="showAdvancedTools && !isAdvancedToolActive">
                    <button class="adv-round-btn" :class="{active: activeTool === 'split'}" @click="setAdvancedTool('split'); showAdvancedTools=false" title="Split Wall">✂️</button>
                    <button class="adv-round-btn" :class="{active: isWallTrackingEnabled}" @click="toggleWallTracking" title="Toggle Wall Tracking">🔗</button>
                </div>
            </div>
        </div>

        <div class="floating-env-toolbar" v-show="viewMode === '3d'">
            <div class="env-dropdown" @mouseenter="showCamera = true" @mouseleave="showCamera = false">
                <button class="env-icon-btn" title="View Angles"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"></path><rect x="3" y="6" width="12" height="12" rx="2" ry="2"></rect></svg></button>
                <div class="env-menu" v-show="showCamera">
                    <div class="env-menu-item" @click="setCameraPreset('iso'); showCamera = false">Perspective (3D)</div>
                    <div class="env-menu-item" @click="setCameraPreset('top'); showCamera = false">Top (2D Ortho)</div>
                    <div class="env-menu-item" @click="setCameraPreset('front'); showCamera = false">Front</div>
                    <div class="env-menu-item" @click="setCameraPreset('back'); showCamera = false">Back</div>
                    <div class="env-menu-item" @click="setCameraPreset('left'); showCamera = false">Left</div>
                    <div class="env-menu-item" @click="setCameraPreset('right'); showCamera = false">Right</div>
                    <div class="env-menu-item" @click="setCameraPreset('frontLeft'); showCamera = false">Front-Left</div>
                    <div class="env-menu-item" @click="setCameraPreset('frontRight'); showCamera = false">Front-Right</div>
                </div>
            </div>
            <button class="env-icon-btn" @click="rotateCamera(-0.1)" title="Rotate Left">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><polyline points="3 3 3 8 8 8"></polyline></svg>
            </button>
            <button class="env-icon-btn" @click="rotateCamera(0.1)" title="Rotate Right">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"></path><polyline points="21 3 21 8 16 8"></polyline></svg>
            </button>
            <button class="env-icon-btn" :class="{active: isXRayMode}" @click="toggleXRayMode" title="Toggle Transparent/X-Ray Mode">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="12" height="12" rx="2" ry="2"></rect><rect x="9" y="9" width="12" height="12" rx="2" ry="2"></rect></svg>
            </button>
        </div>

        <div class="bottom-right-toolbar">
            <button @click="showGuide = !showGuide" :title="showGuide ? 'Hide Guide' : 'Show Guide'" :style="{ background: showGuide ? 'rgba(59, 130, 246, 0.9)' : '', borderColor: showGuide ? 'rgba(96, 165, 250, 1)' : '' }">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
            </button>
            <button @click="zoomIn" title="Zoom In">+</button>
            <button @click="zoomOut" title="Zoom Out">-</button>
            <button @click="resetZoom" title="Reset Zoom">⛶</button>
        </div>

        <!-- 2D Compass Widget -->
        <div class="compass-widget" v-show="viewMode === '2d' && floorPlanSettings.showCompass">
            <div class="compass-n">N</div>
            <div class="compass-w">W</div>
            <div class="compass-center"></div>
            <div class="compass-e">E</div>
            <div class="compass-s">S</div>
        </div>

        <transition name="fade">
            <div ref="canvas2D" class="canvas-host" v-show="viewMode === '2d'"></div>
        </transition>
        <transition name="fade">
            <div ref="canvas3D" class="canvas-host canvas-3d" v-show="viewMode === '3d'"></div>
        </transition>
        
        <div class="loader-overlay" v-show="viewMode === '3d' && isRebuilding">
            <div class="spinner"></div>
            <span style="font-weight: 600; color: #4b5563;">Loading 3D Scene...</span>
        </div>
        
        <div class="status-bar" v-if="viewMode === '3d' && showGuide">
            <span v-if="viewMode3D === 'preview'">🖱️ Left-Click: Rotate Room | Scroll: Zoom</span>
            <span v-else-if="mode3D === 'edit' && selectedType === 'wall'">⚙️ Click a pattern from the gallery to apply it.</span>
            <span v-else-if="mode3D === 'edit'">🖱️ Click object to select/move, or click wall to add patterns</span>
        </div>
      </main>

      <RightSidebar
        @update:mobileMenuOpen="mobileMenuOpen = $event"
        @update:activeRightTab="activeRightTab = $event"
        @update:selectedSky="selectedSky = $event"
        @update:selectedGround="selectedGround = $event"
        :is-mobile="isMobile"
        :is-tablet="isTablet"
        :mobile-menu-open="mobileMenuOpen"
        :active-mobile-tab="activeMobileTab"
        :view-mode="viewMode"
        :view-mode3D="viewMode3D"
        :levels="levels"
        :active-level-index="activeLevelIndex"
        :all-floors-visible="allFloorsVisible"
        :active-right-tab="activeRightTab"
        :floor-plan-settings="floorPlanSettings"
        :selected-sky="selectedSky"
        :selected-ground="selectedGround"
        :sky-registry="skyRegistry"
        :ground-registry="groundRegistry"
        :selected-type="selectedType"
        :selected-entity="selectedEntity"
        :railing-registry="railingRegistry"
        :selected-wall-side="selectedWallSide"
        :current-face-decors="currentFaceDecors"
        :active-decor-id="activeDecorId"
        :wall-decor-registry="wallDecorRegistry"
        :ui-trigger="uiTrigger"
        :floor-registry="floorRegistry"
        :roof-decor-registry="roofDecorRegistry"
        :layer-items="layerItems"
        @toggle-all-floors="toggleAllFloors"
        @level-visibility-change="onLevelVisibilityChange"
        @switch-level="switchLevel"
        @add-level="addLevel"
        @sync-settings="syncSettings"
        @set-entrance-wall="setEntranceWall"
        @set-sky="setSky"
        @set-ground="setGround"
        @sync-engine="syncEngine"
        @ui-trigger="uiTrigger++"
        @toggle-edit-decor="toggleEditDecor"
        @delete-specific-decor="handleDeleteSpecificDecor"
        @decor-update="onDecorUpdate"
        @spawn-wall-pattern="spawnWallPattern"
        @delete-entity="handleDelete"
        @set-floor-material="setFloorMaterial"
        @set-opening-material="setOpeningMaterial"
        @clear-shape-textures="clearShapeTextures"
        @set-shape-material="setShapeMaterial"
        @add-topology="addTopology"
        @set-roof-material="setRoofMaterial"
        @select-layer-item="selectLayerItem"
        @toggle-layer-visibility="toggleLayerVisibility"
        @remove-layer-item="removeLayerItem"
        @debounced-save-history="debouncedSaveHistory"
      />

      <!-- Wizard Popup -->
      <div class="wizard-overlay" v-if="showWizard">
        <div class="wizard-modal">
          <div class="wizard-header">
            <h3>{{ activeWizardPlugin?.name }}</h3>
            <button @click="showWizard = false" class="wizard-close">✕</button>
          </div>
          <div class="wizard-body">
            <p class="wizard-desc">{{ activeWizardPlugin?.description }}</p>
            <div v-if="wizardError" class="wizard-error">{{ wizardError }}</div>
            
            <div v-for="field in wizardFields" :key="field.name" class="control-group">
              <label v-if="field.label">{{ field.label }}</label>
              
              <div v-if="field.type === 'visual_boundary'" class="visual-boundary-box">
                  <div class="vb-compass-line-v"></div>
                  <div class="vb-compass-line-h"></div>
                  <div class="vb-north">N</div>
                  <div class="vb-south">S</div>
                  <div class="vb-west">W</div>
                  <div class="vb-east">E</div>
                  
                  <input class="vb-input top" type="number" step="0.1" v-model="wizardConfig['targetN']" @input="updateVisualBoundary('targetN')" />
                  <input class="vb-input bottom" type="number" step="0.1" v-model="wizardConfig['targetS']" @input="updateVisualBoundary('targetS')" />
                  <input class="vb-input left" type="number" step="0.1" v-model="wizardConfig['targetW']" @input="updateVisualBoundary('targetW')" />
                  <input class="vb-input right" type="number" step="0.1" v-model="wizardConfig['targetE']" @input="updateVisualBoundary('targetE')" />
                  
                  <div class="vb-center-text">
                      <input class="vb-sqft-input" type="number" step="1" v-model="wizardConfig['targetSqft']" @input="updateVisualBoundary('targetSqft')" />
                      <div style="font-size: 11px; color: #6b7280; margin-top: 4px;">Sq Ft</div>
                  </div>
              </div>

              <select v-else-if="field.type === 'select'" v-model="wizardConfig[field.name]" class="settings-select">
                <option v-for="opt in field.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <input v-else-if="field.type === 'text'" type="text" v-model="wizardConfig[field.name]" class="settings-select" />
              <input v-else-if="field.type === 'number'" type="number" step="0.1" v-model="wizardConfig[field.name]" @input="updateVisualBoundary(field.name)" class="settings-select" />
              <div v-else-if="field.type === 'checkbox'" style="display: flex; align-items: center; gap: 8px;">
                  <input type="checkbox" v-model="wizardConfig[field.name]" class="settings-checkbox" />
                  <span style="font-size: 13px; color: #4b5563;">{{ field.checkboxLabel || field.label }}</span>
              </div>
            </div>
          </div>
          <div class="wizard-footer">
            <button @click="showWizard = false" class="action-btn clear">Cancel</button>
            <button @click="executeWizard" class="action-btn import">Apply</button>
          </div>
        </div>
      </div>

      <!-- Save Popup Overlay -->
      <div class="wizard-overlay" v-if="showSavePopup">
        <div class="wizard-modal">
          <div class="wizard-header">
            <h3>Save Project to Cloud</h3>
            <button @click="showSavePopup = false" class="wizard-close">✕</button>
          </div>
          <div class="wizard-body" style="text-align: center;">
            <div v-if="isSaving" class="wizard-desc">Generating previews and saving... Please wait.</div>
            <div v-if="saveError" class="wizard-error">{{ saveError }}</div>
            <div class="control-group" style="text-align: left;">
              <label>Project Name</label>
              <input type="text" v-model="projectName" class="settings-select" placeholder="Enter project name..." />
            </div>
            <div v-if="Object.keys(previewImages).length > 0" class="decor-grid" style="grid-template-columns: repeat(auto-fit, minmax(90px, 1fr)); gap: 10px;">
                <div class="decor-item" v-for="(imgUrl, key) in previewImages" :key="key">
                    <img :src="imgUrl" style="height: 60px; width: 100%; object-fit: contain; background: #e5e7eb; border-radius: 4px;" />
                    <span style="font-size: 10px; font-weight: bold; text-transform: capitalize; margin-top: 4px; display: block;">{{ key.replace('Preview', '').replace(/([A-Z])/g, ' $1').trim() }}</span>
                </div>
            </div>
          </div>
          <div class="wizard-footer">
            <button @click="showSavePopup = false" class="action-btn clear" :disabled="isSaving">Cancel</button>
            <button @click="confirmSave" class="action-btn import" :disabled="isSaving || !projectName">Save</button>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, shallowRef, onMounted, onBeforeUnmount, watch } from 'vue';
import LeftSidebar from './components/LeftSidebar.vue';
import RightSidebar from './components/RightSidebar.vue';

const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isTablet = computed(() => windowWidth.value >= 768 && windowWidth.value < 1200);
const isDesktop = computed(() => windowWidth.value >= 1200);
const mobileMenuOpen = ref(true);
const activeMobileTab = ref('tools');

const toggleMobileTab = (tab) => {
    if (activeMobileTab.value === tab && mobileMenuOpen.value) {
        mobileMenuOpen.value = false;
    } else {
        activeMobileTab.value = tab;
        mobileMenuOpen.value = true;
    }
};

watch(activeMobileTab, (newVal) => {
    if (['properties', 'layers', 'settings'].includes(newVal)) {
        activeRightTab.value = newVal;
    }
});

const handleResize = () => {
    windowWidth.value = window.innerWidth;
    if (!isMobile.value && !isTablet.value) mobileMenuOpen.value = false;
    
    if (planner.value) {
        planner.value.resize();
    }
    if (renderer3D.value) {
        renderer3D.value.resize();
    }
};


import { SmartWizardManager } from './core/plugins/SmartWizardManager.js';
import { SmartFacingPlugin } from './core/plugins/SmartFacingPlugin.js';
import { SmartWallResizePlugin } from './core/plugins/SmartWallResizePlugin.js';

import { FloorPlanner, PremiumFurniture, PremiumStairV3 } from './core/engine2d/index.js';
import { Preview3D } from './core/engine3d.js'; 
import { WorkspaceControls } from '/src/core/engine3d/WorkspaceControls.js';
import { ServerClass } from './core/ServerClass.js';

import { FileManager } from './core/io.js';
import { WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, FLOOR_REGISTRY, RAILING_REGISTRY } from './core/registry.js';
const wallDecorRegistry = WALL_DECOR_REGISTRY;
const roofDecorRegistry = ROOF_DECOR_REGISTRY;
const skyRegistry = SKY_REGISTRY;
const groundRegistry = GROUND_REGISTRY;
const floorRegistry = FLOOR_REGISTRY;
const railingRegistry = RAILING_REGISTRY;

const showWizard = ref(false);
const activeWizardPlugin = ref(null);
const wizardConfig = ref({});
const wizardFields = ref([]);
const wizardError = ref('');
let wizardManager = null;

const floorPlanSettings = ref({
    mainEntranceFacing: 'north',
    measurementUnit: 'feet_inches',
    areaUnit: 'sqft',
    showCompass: true,
    showGrid: true,
    showDimensionLabels: true,
    showDiagonalDimensions: true,
    diagonalMeasurementMode: 'inner',
    showWorkspaceLabels: true,
    wallTracking: true,
    entranceWallId: null
});

const syncSettings = () => {
    if (planner.value) {
        planner.value.settings = { ...floorPlanSettings.value };
        planner.value.setWallTracking(floorPlanSettings.value.wallTracking);
        isWallTrackingEnabled.value = floorPlanSettings.value.wallTracking;
        planner.value.syncAll();
        debouncedSaveHistory();
    }
};

const setEntranceWall = () => {
    if (selectedType.value === 'wall' && selectedEntity.value) {
        floorPlanSettings.value.entranceWallId = selectedEntity.value;
        syncSettings();
    }
};

const canvas2D = ref(null);
const canvas3D = ref(null);
const planner = shallowRef(null);
const renderer3D = shallowRef(null);
const workspaceControls = shallowRef(null);
const serverService = shallowRef(null);

const showSavePopup = ref(false);
const projectName = ref('');
const isSaving = ref(false);
const saveError = ref('');
const previewImages = ref({});

const historyStack = ref([]);
const historyIndex = ref(-1);
const isUndoRedoAction = ref(false);

const viewMode = ref('2d');
const mode3D = ref('edit'); 
const activeTool = ref('select');
const viewMode3D = ref('full-edit'); 

const selectedEntity = shallowRef(null);
const selectedType = ref(null);
const selectedWallSide = ref(null); 
const selectedNodeIndex = ref(-1);

const activeCategory = ref('tools');
const menuCategories = ref([
    {
        id: 'common', name: 'Common',
        icon: '<path d="M4 6h16M4 12h16M4 18h16M8 6v12M16 6v12"></path>',
        tools: [
            { id: 'railing', name: 'Draw Railing' }
        ]
    },
    {
        id: 'tools', name: 'General',
        icon: '<path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z"></path><path d="M13 13l6 6"></path>',
        tools: [
            { id: 'select', name: 'Select & Edit' }
        ]
    },
    {
        id: 'walls', name: 'Walls',
        icon: '<path d="M4 4h16v16H4z"></path><path d="M4 12h16"></path><path d="M12 4v16"></path>',
        tools: [
            { id: 'outer', name: 'Outer Wall' },
            { id: 'inner', name: 'Inner Wall' },
            { id: 'arc', name: 'Curved Wall (Arc)' }
        ]
    },
    {
        id: 'doors_windows', name: 'Doors & Windows',
        icon: '<path d="M4 22h16"></path><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18"></path><path d="M14 12h2"></path>',
        tools: [
            { id: 'door', name: 'Add Door' },
            { id: 'window', name: 'Add Window' }
        ]
    },
    {
        id: 'structures', name: 'Structures',
        icon: '<path d="M3 10l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>',
        tools: [
            { id: 'stair', name: 'Draw Stairs' },
            { id: 'staircase_two', name: 'Place Staircase V2' },
            { id: 'stair_v3', name: 'Smart Stair V3' },
            { id: 'stair_landing', name: 'Smart Landing' },
            { id: 'roof', name: 'Draw Roof' },
            { id: 'auto_roof', name: 'Generate Auto-Roof', action: 'auto_roof' }
        ]
    },
    {
        id: 'furniture', name: 'Furniture',
        icon: '<path d="M20 9V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v2"></path><path d="M2 13h20v5H2z"></path><path d="M4 18v2"></path><path d="M20 18v2"></path>',
        tools: [
            { id: 'couch_1', name: 'Couch', action: 'furniture' },
            { id: 'chair_ekero', name: 'Chair', action: 'furniture' },
            { id: 'table_dining', name: 'Dining Table', action: 'furniture' }
        ]
    },
    {
        id: 'shapes', name: 'Shapes',
        icon: '<path d="M3 8l4-4 4 4v4H3V8z"></path><circle cx="17" cy="6" r="3"></circle><rect x="14" y="14" width="6" height="6" rx="1"></rect><path d="M3 14h6v6H3z"></path>',
        tools: [
            { id: 'shape_rect', name: 'Box (Rectangle)' },
            { id: 'shape_circle', name: 'Cylinder (Circle)' },
            { id: 'shape_triangle', name: 'Prism (Polygon)' }
        ]
    },
    {
        id: 'smart_wizard', name: 'Smart Wizard',
        icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>',
        tools: [
            { id: 'smart_facing', name: 'Facing', action: 'wizard' },
            { id: 'smart_wall_resize', name: 'Resize Plan', action: 'wizard' }
        ]
    },
    {
        id: 'advance_openings', name: 'Advanced Openings',
        icon: '<path d="M12 2L2 22h20L12 2z"></path><circle cx="12" cy="14" r="3"></circle>',
        tools: [
            { id: 'arch_opening', name: 'Arch Opening' },
            { id: 'circular_opening', name: 'Circular & Oval' },
            { id: 'custom_shape_opening', name: 'Custom Shape Cut' },
            { id: 'niche_recess', name: 'Niche & Recess' },
            { id: 'pattern_opening', name: 'Pattern Opening' },
            { id: 'boolean_cut', name: 'Boolean Cut' }
        ]
    }
]);

const activeCategoryObj = computed(() => {
    return menuCategories.value.find(c => c.id === activeCategory.value);
});

const openWizard = (pluginId) => {
    const plugin = wizardManager.getPlugin(pluginId);
    if (!plugin) return;
    activeWizardPlugin.value = plugin;
    wizardConfig.value = {};
    const context = { floorPlanSettings, planner };
    wizardFields.value = plugin.getFields ? plugin.getFields(context) : [];
    wizardFields.value.forEach(f => {
        if (typeof f.defaultValue === 'object' && f.defaultValue !== null) {
            Object.assign(wizardConfig.value, f.defaultValue);
        } else {
            wizardConfig.value[f.name] = f.defaultValue !== undefined ? f.defaultValue : '';
        }
    });
    showWizard.value = true;
    wizardError.value = '';
};

const updateVisualBoundary = (changedField) => {
    if (changedField === 'targetWidth' || changedField === 'targetDepth') {
        const w = parseFloat(wizardConfig.value['targetWidth']) || 0;
        const d = parseFloat(wizardConfig.value['targetDepth']) || 0;
        wizardConfig.value['targetSqft'] = (w * d).toFixed(0);
    } else if (changedField === 'targetSqft') {
        // If they enter sqft directly, scale proportionally based on current aspect ratio
        const currentSqft = parseFloat(wizardConfig.value['targetSqft']) || 0;
        if (currentSqft > 0) {
            const w = parseFloat(wizardConfig.value['targetWidth']) || 1;
            const d = parseFloat(wizardConfig.value['targetDepth']) || 1;
            const ratio = w / d;
            
            const newD = Math.sqrt(currentSqft / ratio);
            const newW = currentSqft / newD;
            
            wizardConfig.value['targetWidth'] = newW.toFixed(1);
            wizardConfig.value['targetDepth'] = newD.toFixed(1);
        }
    }
};

const executeWizard = async () => {
    if (!activeWizardPlugin.value) return;
    wizardError.value = '';
    const result = await wizardManager.executePlugin(activeWizardPlugin.value.id, wizardConfig.value);
    if (result.success) {
        showWizard.value = false;
        debouncedSaveHistory();
    } else {
        wizardError.value = result.error || 'Failed to execute wizard.';
    }
};

const toggleCategory = (catId) => {
    if (activeCategory.value === catId) {
        activeCategory.value = null; // collapse
    } else {
        activeCategory.value = catId;
        if (planner.value) {
            planner.value.activeCategory = catId;
            activeTool.value = 'select';
            planner.value.tool = 'select';
            planner.value.finishChain();
            planner.value.updateToolStates();
            planner.value.selectEntity(null);
        }
    }
};

const uiTrigger = ref(0); 
const isPlacing3D = ref(false);
const activeDecorId = ref(null);
const isRebuilding = ref(false);
const isXRayMode = ref(false);
const showGuide = ref(false);

const toggleXRayMode = () => {
    isXRayMode.value = !isXRayMode.value;
    if (renderer3D.value) {
        renderer3D.value.setXRayMode(isXRayMode.value);
    }
};

const levels = ref([{ id: 'level-' + Date.now(), name: 'Floor 1', data: null, isVisible: true }]);
const activeLevelIndex = ref(0);

const allFloorsVisible = computed(() => levels.value.every(l => l.isVisible !== false));

const toggleAllFloors = () => {
    const newState = !allFloorsVisible.value;
    levels.value.forEach(l => { l.isVisible = newState; });
    if (viewMode.value === '3d') refresh3DScene(true);
};

const onLevelVisibilityChange = () => {
    if (viewMode.value === '3d') refresh3DScene(true);
};

const selectedSky = ref('arch_viz_sunny');
const selectedGround = ref('grass'); // Start with new Grass + Normal map terrain
const showCamera = ref(false);
const showAdvancedTools = ref(false);

const isWallTrackingEnabled = ref(false);
const toggleWallTracking = () => {
    isWallTrackingEnabled.value = !isWallTrackingEnabled.value;
    if (planner.value) {
        planner.value.setWallTracking(isWallTrackingEnabled.value);
    }
};

const activeRightTab = ref('properties');
const layerRefreshTrigger = ref(0);

const layerItems = computed(() => {
    const trigger = layerRefreshTrigger.value;
    if (!planner.value) return [];
    
    const items = [];
    
    if (planner.value.walls) {
        planner.value.walls.forEach((w, i) => {
            if (w.parentArc) return;
            if (w.type === 'railing') {
                items.push({ id: `rail-${i}`, name: `Railing ${i + 1}`, entity: w, type: 'railing' });
            } else {
                items.push({ id: `wall-${i}`, name: w.type === 'inner' ? `Inner Wall ${i + 1}` : `Outer Wall ${i + 1}`, entity: w, type: 'wall' });
            }
        });
    }
    if (planner.value.arcs) {
        planner.value.arcs.forEach((a, i) => {
            items.push({ id: `arc-${i}`, name: `Curved Wall ${i + 1}`, entity: a, type: 'arc' });
        });
    }
    if (planner.value.rooms) {
        planner.value.rooms.forEach((r, i) => {
            if (!r.isDeleted) {
                items.push({ id: `room-${i}`, name: `Room/Floor ${i + 1}`, entity: r, type: 'room' });
            }
        });
    }
    if (planner.value.furniture) {
        planner.value.furniture.forEach((f, i) => {
            items.push({ id: `furn-${i}`, name: f.config?.name || `Furniture ${i + 1}`, entity: f, type: 'furniture' });
        });
    }
    if (planner.value.shapes) {
        planner.value.shapes.forEach((s, i) => {
            let sName = 'Shape';
            if (s.type === 'shape_rect') sName = 'Box';
            if (s.type === 'shape_circle') sName = 'Cylinder';
            if (s.type === 'shape_triangle') sName = 'Prism';
            items.push({ id: `shape-${i}`, name: `${sName} ${i + 1}`, entity: s, type: 'shape' });
        });
    }
    if (planner.value.roofs) {
        planner.value.roofs.forEach((r, i) => {
            items.push({ id: `roof-${i}`, name: `Roof ${i + 1}`, entity: r, type: 'roof' });
        });
    }
    if (planner.value.stairs) {
        planner.value.stairs.forEach((s, i) => {
            items.push({ id: `stair-${i}`, name: `Stair ${i + 1}`, entity: s, type: 'stair' });
        });
    }
    if (planner.value.walls) {
        let wCount = 0;
        planner.value.walls.forEach((w) => {
            if (w.attachedWidgets) {
                w.attachedWidgets.forEach(widget => {
                    if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'niche_recess', 'pattern_opening', 'boolean_cut'].includes(widget.type)) {
                        items.push({ id: `adv-op-${wCount++}`, name: widget.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), entity: widget, type: 'advance_openings' });
                    } else {
                        items.push({ id: `widget-${wCount++}`, name: widget.type === 'door' ? 'Door' : 'Window', entity: widget, type: 'widget' });
                    }
                });
            }
        });
    }
    
    return items;
});

const getLayerIcon = (type) => {
    const icons = {
            'wall': '🧱', 'railing': '🪜', 'room': '⬜', 'furniture': '🛋️',
            'shape': '🔳', 'roof': '🏠', 'stair': '📶', 'widget': '🚪', 'arc': '🌙', 'advance_openings': '✂️'
    };
    return icons[type] || '📦';
};

const selectLayerItem = (item) => {
    if (item.entity.isHidden) toggleLayerVisibility(item);
    if (planner.value) planner.value.selectEntity(item.entity, item.type);
};

const toggleLayerVisibility = (item) => {
    const ent = item.entity;
    ent.isHidden = !ent.isHidden;
    
    const group2D = ent.group || ent.wallGroup || ent.visualGroup || ent.poly;
    if (group2D && typeof group2D.visible === 'function') {
        group2D.visible(!ent.isHidden);
    }
    if (ent.labelGroup && typeof ent.labelGroup.visible === 'function') ent.labelGroup.visible(!ent.isHidden);
    if (ent.cutter && typeof ent.cutter.visible === 'function') ent.cutter.visible(!ent.isHidden);
    if (ent.frontHighlight && typeof ent.frontHighlight.visible === 'function') ent.frontHighlight.visible(false);
    if (ent.backHighlight && typeof ent.backHighlight.visible === 'function') ent.backHighlight.visible(false);

    if (planner.value) planner.value.syncAll();
    
    if (ent.mesh3D) ent.mesh3D.visible = !ent.isHidden;
    if (viewMode.value === '3d') refresh3DScene(true);
};

const removeLayerItem = (item) => {
    selectedEntity.value = item.entity;
    selectedType.value = item.type;
    handleDelete();
    layerRefreshTrigger.value++;
};

const saveHistory = () => {
    if (isUndoRedoAction.value) return;
    
    if (planner.value) {
        levels.value[activeLevelIndex.value].data = planner.value.exportState();
    }
    
    const currentState = JSON.stringify({
        levels: levels.value,
        activeLevelIndex: activeLevelIndex.value
    });

    if (historyIndex.value >= 0 && historyStack.value[historyIndex.value] === currentState) {
        return; 
    }

    historyStack.value = historyStack.value.slice(0, historyIndex.value + 1);
    historyStack.value.push(currentState);
    
    if (historyStack.value.length > 50) {
        historyStack.value.shift();
    } else {
        historyIndex.value++;
    }
};

let historyTimeout = null;
const debouncedSaveHistory = () => {
    if (historyTimeout) clearTimeout(historyTimeout);
    historyTimeout = setTimeout(() => {
        saveHistory();
        layerRefreshTrigger.value++;
    }, 500);
};

const undo = () => {
    if (historyIndex.value > 0) {
        isUndoRedoAction.value = true;
        historyIndex.value--;
        restoreHistoryState(historyStack.value[historyIndex.value]);
        setTimeout(() => { isUndoRedoAction.value = false; }, 100);
    }
};

const redo = () => {
    if (historyIndex.value < historyStack.value.length - 1) {
        isUndoRedoAction.value = true;
        historyIndex.value++;
        restoreHistoryState(historyStack.value[historyIndex.value]);
        setTimeout(() => { isUndoRedoAction.value = false; }, 100);
    }
};

const restoreHistoryState = (stateStr) => {
    const state = JSON.parse(stateStr);

    levels.value = state.levels.map(l => ({ ...l, isVisible: l.isVisible !== false }));
    activeLevelIndex.value = state.activeLevelIndex;    
    if (planner.value) {
        if (levels.value[activeLevelIndex.value].data) {
            planner.value.importState(levels.value[activeLevelIndex.value].data);
        } else {
            planner.value.clearAll();
        }
        
        if (activeLevelIndex.value > 0 && levels.value[activeLevelIndex.value - 1].data) {
            planner.value.loadReferenceBackground(levels.value[activeLevelIndex.value - 1].data);
        } else {
            planner.value.clearReferenceBackground();
        }
        
        if (planner.value.settings) {
            Object.assign(floorPlanSettings.value, planner.value.settings);
        }
    }
    
    handleDeselect();
    if (viewMode.value === '3d') {
        refresh3DScene(true);
    } else {
        if (planner.value) planner.value.syncAll();
    }
};

const currentFaceDecors = computed(() => {
    const trigger = uiTrigger.value; 
    if (!selectedEntity.value || !selectedEntity.value.attachedDecor) return [];
    return selectedEntity.value.attachedDecor.filter(d => d.side === selectedWallSide.value);
});

const hintData = computed(() => {
    if (activeTool.value === 'roof') return { text: 'ROOF mode: Click corners to draw a custom roof polygon. Click the start point to finish.', color: '#f59e0b' };
    if (activeTool.value === 'arc') return { text: 'ARC mode: 1. Click Start Point  2. Click End Point  3. Move mouse to set Curvature & Click.', color: '#8b5cf6' };
    if (activeTool.value === 'shape_rect') return { text: 'BOX: Click and drag to draw a box.', color: '#3b82f6' };
    if (activeTool.value === 'shape_circle') return { text: 'CYLINDER: Click center and drag to define radius.', color: '#3b82f6' };
    if (activeTool.value === 'shape_triangle') return { text: 'PRISM: Click 3 points on the grid to create a triangle.', color: '#3b82f6' };
    return { text: 'SELECT mode: Click elements to edit. Trace Faded Fills from lower floors perfectly.', color: 'rgba(17, 24, 39, 0.9)' };
});

onMounted(() => {
    window.addEventListener('resize', handleResize);
    planner.value = new FloorPlanner(canvas2D.value);
    planner.value.activeCategory = activeCategory.value;
    planner.value.loadDefaultHouse();

    wizardManager = new SmartWizardManager({
        get planner() { return planner; },
        get floorPlanSettings() { return floorPlanSettings; },
        syncSettings,
        refresh3DScene
    });
    wizardManager.registerPlugin(SmartFacingPlugin);
    wizardManager.registerPlugin(SmartWallResizePlugin);
    wizardManager.enablePlugins(['smart_facing', 'smart_wall_resize']);
    
    planner.value.onSelectionChange = (entity, type, nodeIdx = -1) => {
        selectedEntity.value = entity; selectedType.value = type; selectedNodeIndex.value = nodeIdx;
        if (viewMode.value === '3d' && renderer3D.value) {
            if (type === 'furniture' && entity && entity.mesh3D) renderer3D.value.selectObject(entity.mesh3D);
            else renderer3D.value.deselectObject();
        }

        if (entity) {
            activeRightTab.value = 'properties';
        }
    };

    planner.value.onToolChange = (toolId) => {
        activeTool.value = toolId;
    };

    renderer3D.value = new Preview3D(canvas3D.value);

    workspaceControls.value = new WorkspaceControls(renderer3D.value, planner.value);
    
    serverService.value = new ServerClass(renderer3D.value, planner.value, () => {
        saveCurrentLevelState();
        return {
            levels: levels.value,
            activeLevelIndex: activeLevelIndex.value
        };
    });
    
    renderer3D.value.onEntitySelect = (entity, type, side = null) => {
        if (isRebuilding.value && !entity) return; // Prevent losing slider focus during rebuilds
        selectedEntity.value = entity; selectedType.value = type; 
        if (type !== 'wallDecor') { selectedWallSide.value = side; activeDecorId.value = null; }

        if (entity) {
            activeRightTab.value = 'properties';
        }
    };
    
    renderer3D.value.onEntityTransform = () => { uiTrigger.value++; };
    renderer3D.value.onRelocateStateChange = (state) => { isPlacing3D.value = state; };
    
    renderer3D.value.onLevelSwitchRequest = (targetIndex, entityIndex, entityType) => { 
        if (viewMode3D.value === 'full-edit') return;

        if (targetIndex !== activeLevelIndex.value) {
            switchLevel(targetIndex);
            
            if (entityType === 'wall' && entityIndex !== undefined) {
                setTimeout(() => {
                    const targetWall = planner.value.walls[entityIndex];
                    if (targetWall && targetWall.mesh3D) {
                        planner.value.selectEntity(targetWall, 'wall');
                        const frontSkin = targetWall.mesh3D.children.find(c => c.userData.side === 'front');
                        if (frontSkin) renderer3D.value.selectObject(frontSkin);
                    }
                }, 100);
            }
        } 
    };

    window.addEventListener('keydown', handleGlobalKeys);
    
    window.addEventListener('opening-gizmo-change', throttledSyncEngine);
    window.addEventListener('opening-gizmo-end', syncEngine);

    setTimeout(() => {
        saveHistory();
    }, 500);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleGlobalKeys);
    window.removeEventListener('opening-gizmo-change', throttledSyncEngine);
    window.removeEventListener('opening-gizmo-end', syncEngine);
});

const handleGlobalKeys = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        if (e.shiftKey) redo(); else undo();
        e.preventDefault(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        redo(); e.preventDefault(); return;
    }

    if (viewMode.value === '3d') {
        if (e.key === 'Delete' || e.key === 'Backspace') { 
            if (selectedType.value === 'furniture') { handleDelete(); debouncedSaveHistory(); }
        }
        if (e.key === 'Escape' && renderer3D.value) renderer3D.value.cancelRelocation();
    } else if (viewMode.value === '2d') {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selectedType.value === 'roof' || selectedType.value === 'furniture' || selectedType.value === 'widget' || selectedType.value === 'advance_openings' || selectedType.value === 'shape' || selectedType.value === 'wall' || selectedType.value === 'arc' || selectedType.value === 'room') { handleDelete(); debouncedSaveHistory(); }
        }
        if (e.key === 'Escape') {
            setTool('select');
            toggleCategory('tools');
        }
    }
};

const saveCurrentLevelState = () => { if (planner.value) levels.value[activeLevelIndex.value].data = planner.value.exportState(); };

const updateStaticLevelData = (staticWall) => {
    const levelIdx = staticWall.levelIndex;
    if (levelIdx === undefined || !levels.value[levelIdx]) return;
    
    const levelData = JSON.parse(levels.value[levelIdx].data);
    const targetWall = levelData.walls[staticWall.wallIndex];
    
    if (targetWall) {
        targetWall.decors = staticWall.attachedDecor.map(d => ({
            id: d.id, configId: d.configId, side: d.side,
            localX: d.localX, localY: d.localY, localZ: d.localZ,
            width: d.width, height: d.height, depth: d.depth, tileSize: d.tileSize,
            faces: { front: d.faces?.front, back: d.faces?.back, left: d.faces?.left, right: d.faces?.right }
        }));
        levels.value[levelIdx].data = JSON.stringify(levelData);
    }
};

const switchLevel = (index) => {
    if (index === activeLevelIndex.value) return; 
    saveCurrentLevelState();
    planner.value.clearReferenceBackground();
    handleDeselect();

    activeLevelIndex.value = index;
    const targetData = levels.value[index].data;
    if (targetData) planner.value.importState(targetData); else planner.value.clearAll(); 

    if (index > 0) {
        const referenceData = levels.value[index - 1].data;
        if (referenceData) planner.value.loadReferenceBackground(referenceData);
    }
    
    if (viewMode.value === '3d') refresh3DScene(true); 
    saveHistory();
};

const addLevel = (type) => {
    saveCurrentLevelState();
    const newIndex = levels.value.length;
    levels.value.push({ id: 'level-' + Date.now(), name: `Floor ${newIndex + 1}`, data: type === 'duplicate' ? levels.value[activeLevelIndex.value].data : null, isVisible: true });
    switchLevel(newIndex);
    saveHistory();
};

const switchTo2D = () => {
    if(renderer3D.value) renderer3D.value.deselectObject();
    planner.value.syncAll();
    viewMode.value = '2d';
};

const switchTo3D = () => {
    planner.value.finishChain();
    saveCurrentLevelState();
    viewMode.value = '3d';
    if (viewMode3D.value === 'preview') mode3D.value = 'camera';
    else mode3D.value = 'edit'; 
    setTimeout(() => {
        if (renderer3D.value) {
            renderer3D.value.resize();
            updateEnvironment();
            renderer3D.value.setInteractionMode(mode3D.value); 
            refresh3DScene(false); 
        }
    }, 100);
};

const setViewMode3D = (mode) => {
    viewMode3D.value = mode; handleDeselect();
    if (mode === 'preview') set3DMode('camera'); 
    refresh3DScene(true); 
};

const togglePreviewMode = () => {
    if (viewMode3D.value === 'preview') {
        setViewMode3D('full-edit');
        set3DMode('edit');
    } else {
        setViewMode3D('preview');
    }
};

const updateEnvironment = () => {
    if (renderer3D.value) {
        renderer3D.value.setEnvironment(selectedSky.value, selectedGround.value);
    }
};

const setSky = (key) => {
    selectedSky.value = key;
    updateEnvironment();
};

const setGround = (key) => {
    selectedGround.value = key;
    updateEnvironment();
};

const zoomIn = () => {
    if (viewMode.value === '2d') workspaceControls.value?.zoomIn2D();
    else workspaceControls.value?.zoomIn3D();
};

const zoomOut = () => {
    if (viewMode.value === '2d') workspaceControls.value?.zoomOut2D();
    else workspaceControls.value?.zoomOut3D();
};

const resetZoom = () => {
    if (viewMode.value === '2d') workspaceControls.value?.resetZoom2D();
    // 3D reset can be more complex, often handled by `refresh3DScene`
};

const setCameraPreset = (preset) => {
    workspaceControls.value?.setCameraPosition(preset);
};

const rotateCamera = (angle) => {
    workspaceControls.value?.rotateCamera(angle);
};

const set3DMode = (mode) => { mode3D.value = mode; if (renderer3D.value) renderer3D.value.setInteractionMode(mode); };
const handleDeselect = () => {
    if (renderer3D.value) renderer3D.value.deselectObject();
    selectedEntity.value = null; selectedType.value = null; selectedWallSide.value = null; activeDecorId.value = null;
};
const setTool = (tool) => { 
    activeTool.value = tool; planner.value.tool = tool; planner.value.finishChain(); planner.value.updateToolStates(); planner.value.selectEntity(null); 
};
const isAdvancedToolActive = computed(() => ['split'].includes(activeTool.value));
const handleAdvTriggerClick = () => {
    if (isAdvancedToolActive.value) {
        setTool('select');
        showAdvancedTools.value = false;
    } else {
        showAdvancedTools.value = !showAdvancedTools.value;
    }
};
const setAdvancedTool = (tool) => {
    activeTool.value = tool;
    if (planner.value) {
        planner.value.tool = tool;
        planner.value.finishChain();
        planner.value.updateToolStates();
    }
};
const handleToolClick = (tool) => {
    if (tool.action === 'furniture') spawnFurniture(tool.id);
    else if (tool.action === 'auto_roof') { if (planner.value) planner.value.addAutoRoof(); }
    else if (tool.action === 'wizard') { openWizard(tool.id); }
    else setTool(tool.id);
    
    if (isMobile.value || isTablet.value) {
        mobileMenuOpen.value = false;
    }
};

const toggleEditDecor = (decorId) => { activeDecorId.value = activeDecorId.value === decorId ? null : decorId; };

const spawnWallPattern = (configId) => {
    if (renderer3D.value && selectedType.value === 'wall' && selectedEntity.value) {
        const decor = renderer3D.value.addWallPattern(selectedEntity.value, configId, selectedWallSide.value);
        selectedEntity.value.attachedDecor = [...selectedEntity.value.attachedDecor];
        activeDecorId.value = decor.id; uiTrigger.value++; 
        
        if (selectedEntity.value.isStatic) updateStaticLevelData(selectedEntity.value);
        debouncedSaveHistory();
    }
};

const spawnFurniture = (configId) => {
    const center = { x: planner.value.stage.width() / 2, y: planner.value.stage.height() / 2 };
    const item = new PremiumFurniture(planner.value, center.x, center.y, configId);
    planner.value.furniture.push(item); planner.value.selectEntity(item, 'furniture'); planner.value.syncAll();
    debouncedSaveHistory();
};

const syncEngine = () => {
    if (viewMode.value === '2d') {
        planner.value.syncAll();
    } else if (viewMode.value === '3d' && selectedType.value === 'furniture' && selectedEntity.value) {
        renderer3D.value.updateFurnitureLive(selectedEntity.value); 
    } else if (viewMode.value === '3d' && selectedType.value === 'shape' && selectedEntity.value) {
        renderer3D.value.updateShapeLive(selectedEntity.value);
    } else if (viewMode.value === '3d' && (selectedType.value === 'roof' || selectedType.value === 'room' || selectedType.value === 'wall' || selectedType.value === 'widget' || selectedType.value === 'advance_openings')) {
        refresh3DScene(true);
    }
    debouncedSaveHistory();
};

let gizmoSyncTimeout = null;
const throttledSyncEngine = () => {
    if (gizmoSyncTimeout) return;
    gizmoSyncTimeout = setTimeout(() => {
        syncEngine();
        gizmoSyncTimeout = null;
    }, 50);
};

const setRoofMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'roof') {
        selectedEntity.value.config.material = key;
        syncEngine();
    }
};

const setFloorMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'room') {
        selectedEntity.value.configId = key;
        syncEngine();
    }
};

const setOpeningMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'advance_openings') {
        selectedEntity.value.decorConfigId = key;
        if (renderer3D.value) {
            renderer3D.value.updatePatternLive(selectedEntity.value);
        }
        debouncedSaveHistory();
    }
};

const clearShapeTextures = () => {
    if (selectedEntity.value && selectedEntity.value.params) {
        selectedEntity.value.params.texture = '';
        selectedEntity.value.params.textureTop = '';
        selectedEntity.value.params.textureBottom = '';
        selectedEntity.value.params.textureSides = '';
        selectedEntity.value.params.textureLeft = '';
        selectedEntity.value.params.textureRight = '';
        selectedEntity.value.params.textureFront = '';
        selectedEntity.value.params.textureBack = '';
    }
};

const isShapeMaterialActive = (key) => {
    if (!selectedEntity.value || !selectedEntity.value.params) return false;
    const target = selectedEntity.value.params.materialTarget || 'all';
    if (target === 'all') return selectedEntity.value.params.texture === key;
    if (target === 'top') return selectedEntity.value.params.textureTop === key;
    if (target === 'sides') return selectedEntity.value.params.textureSides === key;
    if (target === 'left') return selectedEntity.value.params.textureLeft === key;
    if (target === 'right') return selectedEntity.value.params.textureRight === key;
    if (target === 'front') return selectedEntity.value.params.textureFront === key;
    if (target === 'back') return selectedEntity.value.params.textureBack === key;
    if (target === 'bottom') return selectedEntity.value.params.textureBottom === key;
    return false;
};

const setShapeMaterial = (key) => {
    if (selectedEntity.value && selectedType.value === 'shape') {
        const target = selectedEntity.value.params.materialTarget || 'all';
        if (target === 'all') {
            selectedEntity.value.params.texture = key;
            selectedEntity.value.params.textureTop = key;
            selectedEntity.value.params.textureBottom = key;
            selectedEntity.value.params.textureSides = key;
            selectedEntity.value.params.textureLeft = key;
            selectedEntity.value.params.textureRight = key;
            selectedEntity.value.params.textureFront = key;
            selectedEntity.value.params.textureBack = key;
        } else if (target === 'top') selectedEntity.value.params.textureTop = key;
        else if (target === 'bottom') selectedEntity.value.params.textureBottom = key;
        else if (target === 'sides') {
            selectedEntity.value.params.textureSides = key;
            selectedEntity.value.params.textureLeft = key;
            selectedEntity.value.params.textureRight = key;
            selectedEntity.value.params.textureFront = key;
            selectedEntity.value.params.textureBack = key;
        }
        else if (target === 'left') selectedEntity.value.params.textureLeft = key;
        else if (target === 'right') selectedEntity.value.params.textureRight = key;
        else if (target === 'front') selectedEntity.value.params.textureFront = key;
        else if (target === 'back') selectedEntity.value.params.textureBack = key;
        syncEngine();
    }
};

const onDecorUpdate = (decor) => { 
    if (renderer3D.value) renderer3D.value.updateWallDecorLive(decor); 
    if (selectedEntity.value?.isStatic) updateStaticLevelData(selectedEntity.value);
    debouncedSaveHistory();
};

const addTopology = (type) => {
    if (!selectedEntity.value) return;
    const baseEntity = selectedEntity.value;
    const plannerInstance = planner.value;
    if (!plannerInstance) return;

    if (baseEntity.type === 'stair_landing') {
        spawnFlight(baseEntity, type === 'straight' ? 'top' : type === 'l_shape' ? 'right' : type === 'u_shape' ? 'left' : 'bottom', 0, 0, type === 't_shape' ? 180 : 0, plannerInstance);
        plannerInstance.syncAll();
        debouncedSaveHistory();
        return;
    }

    if (baseEntity.type !== 'stair') return;
    
    const w = baseEntity.width || 100;
    let lWidth = w, lLength = w, aOffsetX = 0;
    
    if (type === 'u_shape') { lWidth = w * 2.2; lLength = w; aOffsetX = -w * 0.6; }
    if (type === 't_shape') { lWidth = w * 3; lLength = w; }
    if (type === 'y_shape') { lWidth = w * 3; lLength = w * 1.5; }
    
    const parentLanding = { 
        id: 'stair_landing_' + Math.random().toString(36).substr(2, 9), type: 'stair_landing', 
        systemId: baseEntity.systemId || baseEntity.id, connectedFrom: baseEntity.id, 
        attachEdge: 'top', attachOffsetX: aOffsetX, attachOffsetY: 0, width: lWidth, length: lLength, thickness: 20, 
        elevation: (baseEntity.absElev || baseEntity.elevation || 0) + ((baseEntity.stepCount || 10) * (baseEntity.stepHeight || 17.5)) 
    };
    injectEntity(parentLanding, plannerInstance);
    
    if (type === 'straight') spawnFlight(parentLanding, 'top', 0, 0, 0, plannerInstance);
    else if (type === 'l_shape') spawnFlight(parentLanding, 'right', 0, 0, 0, plannerInstance);
    else if (type === 'u_shape') spawnFlight(parentLanding, 'bottom', w * 0.6, 0, 0, plannerInstance);
    else if (type === 't_shape') { spawnFlight(parentLanding, 'left', 0, 0, 0, plannerInstance); spawnFlight(parentLanding, 'right', 0, 0, 0, plannerInstance); }
    else if (type === 'y_shape') { spawnFlight(parentLanding, 'top', -w * 0.6, 0, -45, plannerInstance); spawnFlight(parentLanding, 'top', w * 0.6, 0, 45, plannerInstance); }
    
    plannerInstance.syncAll();
    debouncedSaveHistory();
};

const spawnFlight = (parent, edge, offX, offY, rotOffset, plannerInstance) => {
    const newFlight = { 
        id: 'stair_' + Math.random().toString(36).substr(2, 9), type: 'stair', 
        systemId: parent.systemId || parent.id, connectedFrom: parent.id, 
        attachEdge: edge, attachOffsetX: offX, attachOffsetY: offY, width: 100, 
        stepCount: 10, stepHeight: 17.5, stepDepth: 28.0, rotationOffset: rotOffset, 
        elevation: parent.absElev || parent.elevation || 0 
    };
    if (parent.connectedFrom) { const gp = plannerInstance.stairs.find(s => s.id === parent.connectedFrom); if (gp) newFlight.width = gp.width || 100; }
    injectEntity(newFlight, plannerInstance);
};

const injectEntity = (ent, plannerInstance) => {
    
    if (PremiumStairV3) {
        const stairV3 = new PremiumStairV3(plannerInstance, ent);
        plannerInstance.stairs.push(stairV3);
    } else {
        ent.update = function() {}; ent.setHighlight = function() {}; ent.remove = function() { plannerInstance.stairs = plannerInstance.stairs.filter(s => s !== this); };
        plannerInstance.stairs.push(ent);
    }
};

const handleDelete = () => { 
    if (selectedEntity.value) {
        if (selectedType.value === 'furniture') {
            if (viewMode.value === '3d' && renderer3D.value.selectedObject?.userData.entity === selectedEntity.value) {
                renderer3D.value.structureGroup.remove(renderer3D.value.selectedObject); 
                renderer3D.value.deselectObject();
            }
            selectedEntity.value.remove(); 
            selectedEntity.value = null; 
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'roof') {
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'shape') {
            if (viewMode.value === '3d' && renderer3D.value.selectedObject?.userData.entity === selectedEntity.value) {
                renderer3D.value.structureGroup.remove(renderer3D.value.selectedObject);
                renderer3D.value.deselectObject();
            }
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'widget' || selectedType.value === 'advance_openings' || selectedType.value === 'wall' || selectedType.value === 'arc') {
            selectedEntity.value.remove();
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
        } else if (selectedType.value === 'room') {
            selectedEntity.value.isDeleted = true;
            selectedEntity.value = null;
            selectedType.value = null;
            if (viewMode.value === '3d') refresh3DScene(true);
            else if (planner.value) planner.value.syncAll();
        }
        debouncedSaveHistory();
    }
};

const handleDeleteSpecificDecor = (decorObj) => {
    const decor = decorObj || selectedEntity.value;
    if (decor) {
        const wall = decor.mesh3D.userData.parentWall;
        wall.attachedDecor = wall.attachedDecor.filter(d => d !== decor); wall.mesh3D.remove(decor.mesh3D);
        if (selectedEntity.value === wall || selectedEntity.value === decor) wall.attachedDecor = [...wall.attachedDecor]; 
        if (renderer3D.value && renderer3D.value.selectedObject === decor.mesh3D) { renderer3D.value.deselectObject(); handleDeselect(); }
        uiTrigger.value++;
        
        if (wall.isStatic) updateStaticLevelData(wall);
        debouncedSaveHistory();
    }
};

const refresh3DScene = (preserveCamera = true) => {
    if (renderer3D.value) {
        isRebuilding.value = true;
        renderer3D.value.isRebuildingScene = true;
        const prevSel = selectedEntity.value;
        const prevType = selectedType.value;
        const prevSide = selectedWallSide.value;
        const prevMode = renderer3D.value.currentTransformMode;
        
        saveCurrentLevelState(); 
        const levelsConfigArray = levels.value.map(l => ({ data: l.data, isVisible: l.isVisible !== false }));
        
        renderer3D.value.buildScene(
            planner.value.walls,
            planner.value.rooms,
            planner.value.stairs,
            planner.value.furniture,
            planner.value.roofs,
            planner.value.shapes,
            levelsConfigArray, 
            activeLevelIndex.value, 
            viewMode3D.value, 
            preserveCamera
        ); 

        layerItems.value.forEach(item => {
            if (item.entity.isHidden && item.entity.mesh3D) {
                item.entity.mesh3D.visible = false;
            }
        });

        if (prevSel) {
            const newMesh = renderer3D.value.interactables.find(m => {
                if (prevType === 'wall' && m.userData.isWallSide && m.userData.entity === prevSel && m.userData.side === prevSide) return true;
                if (m.userData && m.userData.entity === prevSel) return true;
                return false;
            });
            if (newMesh) {
                renderer3D.value.selectObject(newMesh);
                if (prevMode && prevMode !== 'none') {
                    renderer3D.value.setTransformMode(prevMode, true);
                }
            }
            else {
                renderer3D.value.isRebuildingScene = false;
                renderer3D.value.showTransformMenu(false);
            }
        }
        renderer3D.value.isRebuildingScene = false;
        
        if (workspaceControls.value) {
            workspaceControls.value.updateCameraBounds();
        }
        
        isRebuilding.value = false;
    }
};

const saveProject = () => {
    saveCurrentLevelState();
    const projectData = {
        levels: levels.value,
        activeLevelIndex: activeLevelIndex.value
    };
    FileManager.exportJSON(projectData);
};
const loadProject = (jsonStr) => {
    try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.levels && parsed.activeLevelIndex !== undefined) {
            levels.value = parsed.levels;
            activeLevelIndex.value = parsed.activeLevelIndex;
            planner.value.importState(levels.value[activeLevelIndex.value].data);
            planner.value.syncAll();
            
            if (planner.value.settings) {
                Object.assign(floorPlanSettings.value, planner.value.settings);
            }
            
            // Clear history when loading new project
            historyStack.value = [];
            historyIndex.value = -1;
            setTimeout(() => saveHistory(), 200);
        } else {
            // Fallback for single floor plans or old exports
            FileManager.importJSON(planner.value, jsonStr);
        }
    } catch(e) {
        console.error(e);
        alert("Failed to load project file.");
    }
};

const triggerFileInput = () => document.getElementById('fileInput').click();
const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            loadProject(e.target.result);
            setTimeout(() => saveHistory(), 200);
        };
        reader.readAsText(file);
    }
    event.target.value = '';
};

const clearWorkspace = () => {
    if (confirm('Are you sure you want to clear the workspace? All unsaved progress will be lost.')) {
        levels.value = [{ id: 'level-' + Date.now(), name: 'Floor 1', data: null, isVisible: true }];
        activeLevelIndex.value = 0;
        planner.value.clearAll();
        planner.value.clearReferenceBackground();
        handleDeselect();
        if (viewMode.value === '3d') refresh3DScene(true);
        saveHistory();
    }
};

const openSavePopup = async () => {
    showSavePopup.value = true;
    saveError.value = '';
    projectName.value = `Project ${new Date().toLocaleDateString()}`;
    previewImages.value = {};
    
    if (viewMode.value === '2d') {
        refresh3DScene(true);
    }
    
    // Give the 3D renderer a moment to build geometry and compile shaders
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
        previewImages.value = await serverService.value.generatePreviewImages();
    } catch (e) {
        console.error("Failed to generate previews:", e);
    }
};

const confirmSave = async () => {
    isSaving.value = true;
    saveError.value = '';
    try {
        await serverService.value.saveProject(projectName.value);
        showSavePopup.value = false;
        alert("Project saved successfully!");
    } catch (e) {
        saveError.value = e.message || "Failed to save project.";
    } finally {
        isSaving.value = false;
    }
};
</script>

<style src="./workspace.css"></style>
