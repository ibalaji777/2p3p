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
      <aside class="left-sidebar" v-show="viewMode === '2d' && (!(isMobile || isTablet) || ((isMobile || isTablet) && mobileMenuOpen && activeMobileTab === 'tools'))" :class="{'mobile-panel': isMobile || isTablet}">
        <div v-if="isMobile || isTablet" class="mobile-close-btn" @click="mobileMenuOpen = false">✕ Close</div>
        <div class="sidebar-layout">
            <div class="sidebar-dock">
                <button v-for="cat in menuCategories" :key="cat.id" class="dock-btn" :class="{ active: activeCategory === cat.id }" @click="toggleCategory(cat.id)" :title="cat.name">
                    <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" v-html="cat.icon"></svg>
                </button>
                
                <div style="flex: 1;"></div>
                
                <button class="dock-btn" @click="saveProject" title="Export Project">
                    <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                </button>
                <button class="dock-btn" @click="openSavePopup" title="Save to Cloud" style="color: #8b5cf6;">
                    <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path></svg>
                </button>
                <button class="dock-btn" @click="triggerFileInput" title="Import Project">
                    <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                </button>
                <button class="dock-btn" @click="clearWorkspace" title="Clear All" style="color: #ef4444;">
                    <svg class="dock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
                <input type="file" id="fileInput" @change="handleFileUpload" style="display: none" accept=".json"/>
            </div>

            <div class="sidebar-submenu" v-if="activeCategoryObj">
                <div class="submenu-header">
                    <h3>{{ activeCategoryObj.name }}</h3>
                </div>
                <div class="submenu-content">
                    <button v-for="tool in activeCategoryObj.tools" :key="tool.id"
                        class="child-card-btn"
                        :class="{ active: activeTool === tool.id && !tool.action }"
                        @click="handleToolClick(tool)">
                        {{ tool.name }}
                    </button>
                </div>
            </div>
        </div>
      </aside>

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

      <aside class="right-sidebar" v-show="!(isMobile || isTablet) || ((isMobile || isTablet) && mobileMenuOpen && ['levels', 'properties', 'layers', 'settings'].includes(activeMobileTab))" :class="{'mobile-panel': isMobile || isTablet}">
        <div v-if="isMobile || isTablet" class="mobile-close-btn" @click="mobileMenuOpen = false">✕ Close</div>
        <div class="panel levels-panel" v-show="!(isMobile || isTablet) || activeMobileTab === 'levels'">
            <div class="panel-header"><h3>Floor Levels</h3></div>
            <div class="levels-list">
                <div v-if="viewMode === '3d'" class="level-item" @click="toggleAllFloors" style="background: #fafafa; border-bottom: 1px solid #f1f5f9;">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <input type="checkbox" :checked="allFloorsVisible" @change="toggleAllFloors" @click.stop title="Toggle All">
                        <span style="font-weight: bold;">Show All</span>
                    </div>
                </div>
                <div v-for="(level, index) in levels" :key="level.id" 
                     class="level-item" 
                     :class="{ 'active': activeLevelIndex === index && viewMode === '2d' }"
                     @click="switchLevel(index)">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        <input v-if="viewMode === '3d'" type="checkbox" :checked="level.isVisible !== false" @change="(e) => { level.isVisible = e.target.checked; onLevelVisibilityChange(); }" @click.stop title="Toggle Visibility">
                        <span>Floor {{ index + 1 }}</span>
                    </div>
                    <span class="level-indicator" v-if="activeLevelIndex === index && viewMode === '2d'">Active</span>
                </div>
            </div>
            <div class="levels-actions">
                <button class="btn-duplicate" @click="addLevel('duplicate')">+ Duplicate Current</button>
                <button class="btn-empty" @click="addLevel('empty')">+ Add Empty Floor</button>
            </div>
        </div>

        <div class="panel tabs-panel flex-1" v-show="!(isMobile || isTablet) || ['properties', 'layers', 'settings'].includes(activeMobileTab)">
            <div class="tabs-header" v-show="!(isMobile || isTablet)">
                <button :class="{active: activeRightTab === 'properties'}" @click="activeRightTab = 'properties'">Properties</button>
                <button :class="{active: activeRightTab === 'layers'}" @click="activeRightTab = 'layers'">Layer List</button>
                <button :class="{active: activeRightTab === 'settings'}" @click="activeRightTab = 'settings'">Settings</button>
            </div>
            
            <div class="tab-body" v-show="activeRightTab === 'settings'">
                <div class="props-content">
                    <h4 class="props-subtitle">Floor Plan Configuration</h4>
                    
                    <div class="control-group">
                        <label>Entrance Facing</label>
                        <select v-model="floorPlanSettings.mainEntranceFacing" @change="syncSettings" class="settings-select">
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
                        <select v-model="floorPlanSettings.measurementUnit" @change="syncSettings" class="settings-select">
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
                        <select v-model="floorPlanSettings.areaUnit" @change="syncSettings" class="settings-select">
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
                        <input type="checkbox" v-model="floorPlanSettings.showCompass" @change="syncSettings" class="settings-checkbox">
                    </div>
                    <div class="control-group-inline">
                        <label>Show Grid</label>
                        <input type="checkbox" v-model="floorPlanSettings.showGrid" @change="syncSettings" class="settings-checkbox">
                    </div>
                    <div class="control-group-inline">
                        <label>Dimension Labels</label>
                        <input type="checkbox" v-model="floorPlanSettings.showDimensionLabels" @change="syncSettings" class="settings-checkbox">
                    </div>
                    <div class="control-group-inline">
                        <label>Diagonal Dimensions</label>
                        <input type="checkbox" v-model="floorPlanSettings.showDiagonalDimensions" @change="syncSettings" class="settings-checkbox">
                    </div>
                    <div class="control-group" v-if="floorPlanSettings.showDiagonalDimensions">
                        <label>Diagonal Mode</label>
                        <select v-model="floorPlanSettings.diagonalMeasurementMode" @change="syncSettings" class="settings-select">
                            <option value="inner">Inner Corner to Inner Corner</option>
                            <option value="outer">Outer Corner to Outer Corner</option>
                        </select>
                    </div>
                    <div class="control-group-inline">
                        <label>Workspace Labels</label>
                        <input type="checkbox" v-model="floorPlanSettings.showWorkspaceLabels" @change="syncSettings" class="settings-checkbox">
                    </div>
                    <div class="control-group-inline">
                        <label>Wall Tracking</label>
                        <input type="checkbox" v-model="floorPlanSettings.wallTracking" @change="syncSettings" class="settings-checkbox">
                    </div>

                    <div class="settings-divider"></div>
                    <h4 class="props-subtitle">Environment Settings</h4>
                    
                    <div class="control-group">
                        <label>Sky Environment</label>
                        <select v-model="selectedSky" @change="setSky(selectedSky)" class="settings-select">
                            <option v-for="(config, key) in skyRegistry" :key="key" :value="key">{{ config.name }}</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Ground Environment</label>
                        <select v-model="selectedGround" @change="setGround(selectedGround)" class="settings-select">
                            <option v-for="(config, key) in groundRegistry" :key="key" :value="key">{{ config.name }}</option>
                        </select>
                    </div>
                    
                    <div v-if="selectedType === 'wall'" style="margin-top: 20px;">
                        <button class="btn-primary" style="width: 100%;" @click="setEntranceWall">Set Selected Wall as Entrance</button>
                    </div>
                </div>
            </div>

            <div class="tab-body" v-show="activeRightTab === 'properties'">
                <div class="props-content" v-if="(viewMode==='3d' || viewMode==='2d') && selectedEntity && viewMode3D !== 'preview'">
                
                <div v-if="selectedType === 'wall'">
                    <h4 class="props-subtitle" v-if="selectedEntity.type === 'railing'">Railing Properties</h4>
                    <h4 class="props-subtitle" v-else>Wall Properties</h4>
                    <div class="control-group"><label>Hidden Wall</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hidden" @change="syncEngine"></div></div>
                    <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="syncEngine"><input type="number" v-model.number="selectedEntity.thickness" min="1" max="100" step="1" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="syncEngine"><input type="number" v-model.number="selectedEntity.height" min="0" max="500" step="1" @input="syncEngine"></div></div>

                    <div v-if="selectedEntity.type === 'railing'">
                        <div class="decor-gallery">
                            <h4 class="props-subtitle">Railing Material</h4>
                            <div class="decor-grid">
                                <div v-for="(config, key) in railingRegistry" :key="key" class="decor-item" @click="selectedEntity.configId = key; uiTrigger++; syncEngine()" :class="{ active: (selectedEntity.configId || 'rail_1') === key && uiTrigger !== -1 }">
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
                                    <div class="applied-item-header" :class="{active: activeDecorId === decor.id}" @click="toggleEditDecor(decor.id)">
                                        <span>{{ wallDecorRegistry[decor.configId]?.name }}</span>
                                        <button class="btn-sm-delete" @click.stop="handleDeleteSpecificDecor(decor)">✕</button>
                                    </div>
                                    <div class="applied-item-body" v-if="activeDecorId === decor.id">
                                        <div class="faceRow">
                                            <label><input type="checkbox" v-model="decor.faces.left" @change="onDecorUpdate(decor)">L-Edge</label>
                                            <label><input type="checkbox" v-model="decor.faces.right" @change="onDecorUpdate(decor)">R-Edge</label>
                                        </div>
                                        <div class="control-group"><label>Tile Size</label><div class="input-wrap"><input type="range" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.tileSize" min="1" max="200" step="1" @input="onDecorUpdate(decor)"></div></div>
                                        <div class="control-group"><label>Thickness</label><div class="input-wrap"><input type="range" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.depth" min="0.1" max="40" step="0.1" @input="onDecorUpdate(decor)"></div></div>
                                        <div class="control-group"><label>Width (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.width" min="1" max="100" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.width" min="1" max="100" step="1" @input="onDecorUpdate(decor)"></div></div>
                                        <div class="control-group"><label>Height (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.height" min="1" max="100" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.height" min="1" max="100" step="1" @input="onDecorUpdate(decor)"></div></div>
                                        <div class="control-group"><label>X Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localX" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.localX" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"></div></div>
                                        <div class="control-group"><label>Y Offset (%)</label><div class="input-wrap"><input type="range" v-model.number="decor.localY" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"><input type="number" v-model.number="decor.localY" min="-10" max="110" step="1" @input="onDecorUpdate(decor)"></div></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="decor-gallery" v-if="viewMode === '3d'">
                            <h4 class="props-subtitle">Add Pattern Layer</h4>
                            <div class="decor-grid">
                                <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="spawnWallPattern(key)">
                                    <img :src="config.thumbnail" />
                                    <span>{{ config.name }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button class="hud-delete" @click="handleDelete">Delete {{ selectedEntity.type === 'railing' ? 'Railing' : 'Wall' }}</button>
                </div>

                <div v-else-if="selectedType === 'arc'">
                    <h4 class="props-subtitle">Curved Wall Properties</h4>
                    <div class="control-group"><label>Hidden Wall</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hidden" @change="() => { selectedEntity.walls.forEach(w => w.hidden = selectedEntity.hidden); syncEngine(); }"></div></div>
                    <button class="hud-delete" @click="handleDelete">Delete Curved Wall</button>
                </div>

                <div v-else-if="selectedType === 'room'">
                    <h4 class="props-subtitle">Floor Properties</h4>
                    <div class="control-group">
                        <label>Material Scale</label>
                        <div class="input-wrap">
                            <input type="range" :value="selectedEntity.materialRepeat || floorRegistry[selectedEntity.configId]?.repeat || 10" @input="e => { selectedEntity.materialRepeat = parseFloat(e.target.value); syncEngine(); }" min="1" max="100" step="1">
                            <input type="number" :value="selectedEntity.materialRepeat || floorRegistry[selectedEntity.configId]?.repeat || 10" @input="e => { selectedEntity.materialRepeat = parseFloat(e.target.value); syncEngine(); }" min="1" max="100" step="1">
                        </div>
                    </div>
                    <div class="decor-gallery">
                        <h4 class="props-subtitle">Floor Material</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in floorRegistry" :key="key" class="decor-item" @click="setFloorMaterial(key)" :class="{ active: selectedEntity.configId === key }">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>

                    <button class="hud-delete" @click="handleDelete">Delete Floor & Walls</button>
                </div>

                <div v-else-if="selectedType === 'advance_openings'">
                    <h4 class="props-subtitle">Advanced Opening Properties</h4>
                    <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.width" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="300" @input="syncEngine"><input type="number" v-model.number="selectedEntity.height" @input="syncEngine"></div></div>
                    <div class="control-group" v-if="selectedEntity.type === 'niche_recess'"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="1" max="50" @input="syncEngine"><input type="number" v-model.number="selectedEntity.depth" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Elevation (from floor)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.elevation" min="0" max="200" @input="syncEngine"><input type="number" v-model.number="selectedEntity.elevation" @input="syncEngine"></div></div>
                    <div v-if="selectedEntity.type === 'pattern_opening'">
                        <div class="control-group">
                            <label>Pattern Style</label>
                            <select v-model="selectedEntity.patternStyle" @change="syncEngine" class="settings-select">
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
                        <div class="control-group"><label>Rows</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rows" min="1" max="20" @input="syncEngine"><input type="number" v-model.number="selectedEntity.rows" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Columns</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.cols" min="1" max="20" @input="syncEngine"><input type="number" v-model.number="selectedEntity.cols" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Spacing</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.spacing" min="0" max="50" @input="syncEngine"><input type="number" v-model.number="selectedEntity.spacing" @input="syncEngine"></div></div>
                    </div>
                    
                    <div class="decor-gallery" v-if="viewMode === '3d'">
                        <h4 class="props-subtitle">Opening Material</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in wallDecorRegistry" :key="key" class="decor-item" @click="setOpeningMaterial(key)" :class="{ active: selectedEntity.decorConfigId === key }">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>

                    <button class="hud-delete" @click="handleDelete">Delete Opening</button>
                </div>

                <div v-else-if="selectedType === 'widget'">
                    <h4 class="props-subtitle">{{ selectedEntity.config?.label || 'DOOR/WINDOW' }} Properties</h4>
                    <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="200" @input="syncEngine"><input type="number" v-model.number="selectedEntity.width" @input="syncEngine"></div></div>
                    <div class="faceRow">
                        <button class="action-btn clear" style="flex: 1; padding: 4px;" @click="selectedEntity.facing *= -1; syncEngine()">Flip In/Out</button>
                        <button class="action-btn clear" style="flex: 1; padding: 4px;" @click="selectedEntity.side *= -1; syncEngine()">Flip L/R</button>
                    </div>
                    <div v-if="selectedEntity.type === 'door'">
                        <div class="control-group">
                            <label>Door Type</label>
                            <select v-model="selectedEntity.doorType" @change="syncEngine" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                                <option value="single">Single Hinged</option>
                                <option value="double">Double Door</option>
                                <option value="sliding">Sliding</option>
                                <option value="pocket">Pocket</option>
                                <option value="french">French (Glass)</option>
                            </select>
                        </div>
                    </div>
                    <div v-else-if="selectedEntity.type === 'window'">
                        <div class="control-group">
                            <label>Window Type</label>
                            <select v-model="selectedEntity.windowType" @change="syncEngine" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                                <option value="sliding_std">Standard Sliding</option>
                                <option value="casement_std">Casement / Hinged</option>
                                <option value="fixed_elevation">Fixed Glass</option>
                                <option value="bay_box">Box Bay Window</option>
                            </select>
                        </div>
                    </div>
                    <button class="hud-delete" @click="handleDelete">Delete Object</button>
                </div>

                <div v-else-if="selectedType === 'shape'">
                    <h4 class="props-subtitle">{{ selectedEntity.type === 'shape_rect' ? 'Box' : selectedEntity.type === 'shape_circle' ? 'Cylinder' : 'Prism / Polygon' }} Properties</h4>
                    <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="syncEngine"><input type="number" v-model.number="selectedEntity.rotation" @input="syncEngine"></div></div>
                    <div class="control-group"><label>3D Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.height3D" min="10" max="1000" @input="syncEngine"><input type="number" v-model.number="selectedEntity.params.height3D" @input="syncEngine"></div></div>
                    <div v-if="selectedEntity.type === 'shape_rect'">
                        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.width" min="10" max="1000" @input="syncEngine"><input type="number" v-model.number="selectedEntity.params.width" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.height" min="10" max="1000" @input="syncEngine"><input type="number" v-model.number="selectedEntity.params.height" @input="syncEngine"></div></div>
                    </div>
                    <div v-if="selectedEntity.type === 'shape_circle'">
                        <div class="control-group"><label>Radius</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.params.radius" min="10" max="1000" @input="syncEngine"><input type="number" v-model.number="selectedEntity.params.radius" @input="syncEngine"></div></div>
                    </div>
                    <div class="control-group"><label>Color</label><div class="input-wrap"><input type="color" v-model="selectedEntity.params.fill" @input="syncEngine" style="width: 100%; padding: 0;"></div></div>
                    <button class="hud-delete" @click="handleDelete">Delete Shape</button>
                </div>

                <div v-else-if="selectedType === 'stair' || selectedType === 'staircase_two'">
                    <h4 class="props-subtitle">Staircase Properties</h4>
                    <div v-if="selectedType === 'staircase_two'">
                        <div class="control-group">
                            <label>Stair Type</label>
                            <select v-model="selectedEntity.config.stairType" @change="syncEngine" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                                <option value="straight">Straight</option>
                                <option value="l_shape">L-Shape</option>
                                <option value="u_shape">U-Shape</option>
                                <option value="spiral">Spiral</option>
                            </select>
                        </div>
                        <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.rotation" min="0" max="360" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.rotation" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.width" min="20" max="200" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.width" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Step Count</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.stepCount" min="3" max="40" step="1" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.stepCount" min="3" max="40" step="1" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Tread Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.treadDepth" min="5" max="30" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.treadDepth" @input="syncEngine"></div></div>
                        <div class="control-group"><label>Riser Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.riserHeight" min="4" max="15" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.riserHeight" @input="syncEngine"></div></div>
                        
                        <div class="control-group" style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" v-model="selectedEntity.config.isMirrored" @change="syncEngine">
                            <label style="margin-bottom:0">Mirrored Layout</label>
                        </div>

                        <hr style="margin: 15px 0; border:0; border-top:1px solid #d1d5db;">
                        <h4 class="props-subtitle" style="margin-top:0">Landing Settings</h4>
                        <div class="control-group" style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" v-model="selectedEntity.config.landing.enabled" @change="syncEngine">
                            <label style="margin-bottom:0">Enable Landing</label>
                        </div>
                        <div class="control-group" v-if="selectedEntity.config.landing.enabled"><label>Landing Length</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.landing.length" min="20" max="200" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.landing.length" @input="syncEngine"></div></div>

                        <hr style="margin: 15px 0; border:0; border-top:1px solid #d1d5db;">
                        <h4 class="props-subtitle" style="margin-top:0">Railing Settings</h4>
                        <div class="control-group" style="display:flex; align-items:center; gap:8px;">
                            <input type="checkbox" v-model="selectedEntity.config.railing.enabled" @change="syncEngine">
                            <label style="margin-bottom:0">Enable Railings</label>
                        </div>
                        <div v-if="selectedEntity.config.railing.enabled">
                            <div class="control-group">
                                <label>Railing Style</label>
                                <select v-model="selectedEntity.config.railing.style" @change="syncEngine" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                                    <option value="modern">Modern</option>
                                    <option value="glass">Glass</option>
                                    <option value="steel">Steel</option>
                                    <option value="wooden">Wooden</option>
                                    <option value="minimal">Minimal</option>
                                    <option value="classic">Classic</option>
                                    <option value="cable">Cable</option>
                                    <option value="industrial">Industrial</option>
                                </select>
                            </div>
                            <div class="control-group" style="display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" v-model="selectedEntity.config.railing.left" @change="syncEngine">
                                <label style="margin-bottom:0">Left Railing</label>
                            </div>
                            <div class="control-group" style="display:flex; align-items:center; gap:8px;">
                                <input type="checkbox" v-model="selectedEntity.config.railing.right" @change="syncEngine">
                                <label style="margin-bottom:0">Right Railing</label>
                            </div>
                        </div>
                    </div>
                    <button class="hud-delete" @click="handleDelete" style="margin-top: 15px;">Delete Stairs</button>
                </div>

                <div v-else-if="selectedType === 'furniture'">
                    <h4 class="props-subtitle">{{ selectedEntity.config?.name || 'Object' }}</h4>
                    <div class="control-group"><label>Rotation (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.rotation" min="0" max="360" @input="syncEngine"><input type="number" v-model.number="selectedEntity.rotation" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.width" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.depth" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.depth" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.height" min="10" max="500" @input="syncEngine"><input type="number" v-model.number="selectedEntity.height" @input="syncEngine"></div></div>
                    
                    <button class="hud-delete" @click="handleDelete">Delete Object</button>
                </div>

                <div v-else-if="selectedType === 'roof'">
                    <h4 class="props-subtitle">Roof Properties</h4>
                    <div class="control-group">
                        <select v-model="selectedEntity.config.roofType" @change="syncEngine" style="width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; font-size: 12px; margin-bottom: 10px;">
                            <option value="hip">Hip Roof</option>
                            <option value="flat">Flat Roof</option>
                        </select>
                    </div>
                    <div class="control-group" v-if="selectedEntity.config.roofType === 'hip'"><label>Pitch (°)</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.pitch" min="0" max="60" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.pitch" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Overhang</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.overhang" min="0" max="50" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.overhang" @input="syncEngine"></div></div>
                    <div class="control-group"><label>Elevation Gap</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.config.wallGap" min="-50" max="100" @input="syncEngine"><input type="number" v-model.number="selectedEntity.config.wallGap" @input="syncEngine"></div></div>
                    
                    <div class="decor-gallery">
                        <h4 class="props-subtitle">Roof Material</h4>
                        <div class="decor-grid">
                            <div v-for="(config, key) in roofDecorRegistry" :key="key" class="decor-item" @click="setRoofMaterial(key)" :class="{ active: selectedEntity.config.material === key }">
                                <img :src="config.thumbnail" />
                                <span>{{ config.name }}</span>
                            </div>
                        </div>
                    </div>

                    <button class="hud-delete" @click="handleDelete">Delete Roof</button>
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
                    <div v-for="item in layerItems" :key="item.id" class="layer-item" :class="{active: selectedEntity === item.entity}" @click="selectLayerItem(item)">
                        <div class="layer-info">
                            <div class="layer-title-row">
                                <span class="layer-type-icon">{{ getLayerIcon(item.type) }}</span>
                                <span class="layer-name">{{ item.name }}</span>
                            </div>
                            <input type="text" v-model="item.entity.description" @input="debouncedSaveHistory" @click.stop @keydown.stop placeholder="Add description..." class="layer-desc-input" />
                        </div>
                        <div class="layer-actions">
                            <button @click.stop="toggleLayerVisibility(item)" :title="item.entity.isHidden ? 'Show' : 'Hide'">
                                {{ item.entity.isHidden ? '👁️‍🗨️' : '👁️' }}
                            </button>
                            <button @click.stop="removeLayerItem(item)" title="Delete">🗑️</button>
                        </div>
                    </div>
                    <div v-if="layerItems.length === 0" class="props-empty">No objects in the current floor.</div>
                </div>
            </div>
        </div>
      </aside>

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

import { FloorPlanner, PremiumFurniture } from './core/engine2d/index.js';
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
    
    setTimeout(() => {
        saveHistory();
    }, 500);
});

onBeforeUnmount(() => {
    window.removeEventListener('resize', handleResize);
    window.removeEventListener('keydown', handleGlobalKeys);
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

const onDecorUpdate = (decor) => { 
    if (renderer3D.value) renderer3D.value.updateWallDecorLive(decor); 
    if (selectedEntity.value?.isStatic) updateStaticLevelData(selectedEntity.value);
    debouncedSaveHistory();
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
        const prevSel = selectedEntity.value;
        const prevType = selectedType.value;
        const prevSide = selectedWallSide.value;
        
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
            }
        }
        
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

<style>
/* Fix for mobile blue highlight on tap/hold */
* {
    -webkit-tap-highlight-color: transparent;
}
body, .app-root, .main-workspace, .canvas-container, canvas {
    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}
input, textarea, select {
    -webkit-user-select: auto;
    -khtml-user-select: auto;
    -moz-user-select: auto;
    -ms-user-select: auto;
    user-select: auto;
}

body { margin: 0; font-family: 'Inter', sans-serif; background: #f8fafc; overflow: hidden; }
.app-root { display: flex; flex-direction: column; height: 100vh; overflow: hidden; width: 100vw; }

/* TOP TOOLBAR */
.top-toolbar {
    display: flex; justify-content: space-between; align-items: center;
    background: #ffffff; padding: 8px 20px; color: #111827;
    border-bottom: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05); z-index: 1000;
    flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;
}
.top-toolbar::-webkit-scrollbar { display: none; }
.left-tools, .center-tools, .right-tools, .tool-group { display: flex; align-items: stretch; gap: 4px; flex-shrink: 0; }
.right-tools { margin-left: auto; }
.divider { width: 1px; height: 32px; background: #e5e7eb; margin: auto 12px; }

.tool-btn {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: transparent; border: none; color: #111827; padding: 6px 16px;
    border-radius: 8px; cursor: pointer; transition: all 0.2s ease;
    min-width: 64px;
}
.tool-btn:hover { background: #f8fafc; }
.tool-btn.active {
    background: #eff6ff; color: #2563eb; border-bottom: 2px solid #2563eb;
    border-bottom-left-radius: 0; border-bottom-right-radius: 0;
}
.tool-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.tool-icon { width: 22px; height: 22px; margin-bottom: 4px; stroke: currentColor; }
.tool-label { font-size: 11px; font-weight: 700; font-family: 'Inter', sans-serif; letter-spacing: 0.2px; }

/* MAIN WORKSPACE */
.main-workspace { display: flex; flex: 1; overflow: hidden; }

/* CANVAS CONTAINER */
.canvas-container { flex: 1; position: relative; background: #fff; overflow: hidden; height: 100%; width: 100%; }
.canvas-host { position: absolute; top: 0; left: 0; width: 100%; height: 100%; outline: none; }
.canvas-3d { background: #e5e7eb; }
.hint { position: absolute; top: 20px; left: 20px; background: rgba(17, 24, 39, 0.9); color: white; padding: 10px 15px; border-radius: 6px; font-size: 12px; pointer-events: none; z-index: 100; }
.status-bar { position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); background: rgba(17, 24, 39, 0.9); color: white; padding: 12px 25px; border-radius: 30px; font-size: 13px; font-weight: bold; z-index: 100; pointer-events: none; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

.loader-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,0.8); z-index: 50; display: flex; flex-direction: column; align-items: center; justify-content: center; backdrop-filter: blur(2px); transition: opacity 0.3s; }
.spinner {
    width: 40px; height: 40px; border: 4px solid #e5e7eb; border-top-color: #3b82f6;
    border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 10px;
}
@keyframes spin { 100% { transform: rotate(360deg); } }

/* DOCKED LEFT SIDEBAR */
.left-sidebar {
    width: auto; background: #ffffff; border-right: 1px solid #e5e7eb;
    display: flex; flex-direction: column; height: 100%; overflow: hidden;
    box-shadow: none; z-index: 10;
}

.sidebar-layout { display: flex; flex: 1; height: 100%; min-height: 0; }
.sidebar-dock {
    width: 60px; background: #ffffff;
    display: flex; flex-direction: column; padding: 12px 0; align-items: center; gap: 8px;
    border-right: 1px solid #e5e7eb; flex-shrink: 0; overflow-y: auto;
}
.dock-btn {
    width: 44px; height: 44px; border-radius: 8px; border: none; background: transparent; cursor: pointer;
    display: flex; align-items: center; justify-content: center; color: #4b5563; transition: 0.2s; flex-shrink: 0;
}
.dock-btn:hover { background: #f1f5f9; color: #111827; }
.dock-btn.active { background: #eff6ff; color: #2563eb; }
.dock-icon { width: 22px; height: 22px; stroke: currentColor; }

.sidebar-submenu { width: 180px; background: #fafafa; display: flex; flex-direction: column; }
.submenu-header { padding: 16px; border-bottom: 1px solid #e5e7eb; }
.submenu-header h3 { margin: 0; font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.5px; text-transform: uppercase; }
.submenu-content { padding: 12px; display: flex; flex-direction: column; gap: 4px; overflow-y: auto; }

.child-card-btn {
    padding: 8px 12px; text-align: left; background: transparent; border: none;
    border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 500; color: #4b5563; transition: all 0.2s ease;
    display: flex; align-items: center; gap: 8px;
}
.child-card-btn:hover { background: #f1f5f9; color: #111827; }
.child-card-btn.active { background: #eff6ff; color: #2563eb; font-weight: 600; }

.action-btn { padding: 8px 12px; border: none; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600; transition: 0.2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
.action-btn.export { background: #111827; color: white; }
.action-btn.export:hover { background: #374151; }
.action-btn.import { background: #ffffff; color: #111827; border: 1px solid #d1d5db; }
.action-btn.import:hover { background: #f3f4f6; border-color: #9ca3af; }
.action-btn.clear { background: #ffffff; color: #ef4444; border: 1px solid #fecaca; }
.action-btn.clear:hover { background: #fef2f2; border-color: #f87171; }

.right-sidebar {
    width: 320px; background: #f8fafc; border-left: 1px solid #e5e7eb;
    display: flex; flex-direction: column; overflow: hidden;
}
.panel { display: flex; flex-direction: column; border-bottom: 1px solid #e5e7eb; }
.panel.flex-1 { flex: 1; border-bottom: none; overflow: hidden; }
.panel-header { padding: 16px 20px; background: #ffffff; border-bottom: 1px solid #e5e7eb; }
.panel-header h3 { margin: 0; font-size: 12px; font-weight: 700; color: #6b7280; letter-spacing: 0.5px; text-transform: uppercase; }

/* LEVELS PANEL */
.levels-list { padding: 0; display: flex; flex-direction: column; max-height: 150px; overflow-y: auto; background: #ffffff; }
.level-item { padding: 12px 20px; background: #ffffff; border: none; border-bottom: 1px solid #f1f5f9; border-radius: 0; font-size: 13px; color: #374151; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background-color 0.2s; }
.level-item:hover { background: #f8fafc; }
.level-item.active { background: #f8fafc; color: #2563eb; font-weight: 600; border-left: 3px solid #3b82f6; padding-left: 17px; }
.level-indicator { font-size: 10px; background: #3b82f6; color: white; padding: 2px 6px; border-radius: 4px; }
.levels-actions { padding: 16px 20px; display: flex; flex-direction: column; gap: 8px; background: #fafafa; border-top: 1px solid #e5e7eb; }
.btn-duplicate { background: #111827; color: white; border: none; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; }
.btn-duplicate:hover { background: #374151; }
.btn-empty { background: #ffffff; color: #111827; border: 1px solid #d1d5db; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; transition: 0.2s; }
.btn-empty:hover { background: #f3f4f6; border-color: #9ca3af; }

/* PROPERTIES PANEL */
.props-content { padding: 20px; overflow-y: auto; height: 100%; background: #ffffff; }
.props-empty { padding: 40px 20px; text-align: center; color: #9ca3af; font-size: 13px; font-style: italic; background: #ffffff; height: 100%; display: flex; justify-content: center; align-items: center; }
.props-subtitle { font-size: 11px; font-weight: 700; color: #6b7280; margin: 0 0 12px 0; border-bottom: 1px solid #f1f5f9; padding-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }

.tabs-header { display: flex; background: #f8fafc; border-bottom: 1px solid #e5e7eb; }
.tabs-header button { flex: 1; padding: 14px 10px; background: transparent; border: none; border-bottom: 2px solid transparent; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; transition: 0.2s; }
.tabs-header button.active { color: #2563eb; border-bottom-color: #2563eb; background: #ffffff; }
.tabs-header button:hover:not(.active) { color: #111827; background: #f1f5f9; }

.tab-body { display: flex; flex-direction: column; flex: 1; overflow: hidden; background: #ffffff; }

.layers-content { padding: 0; display: flex; flex-direction: column; flex: 1; overflow: hidden; background: #ffffff; }
.layers-list { flex: 1; overflow-y: auto; padding: 0; display: flex; flex-direction: column; gap: 0; }
.layer-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; background: #ffffff; border: none; border-bottom: 1px solid #f1f5f9; border-radius: 0; cursor: pointer; transition: 0.2s; }
.layer-item:hover { background: #f8fafc; }
.layer-item.active { background: #f8fafc; border-left: 3px solid #3b82f6; padding-left: 17px; }
.layer-info { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; flex: 1; overflow: hidden; }
.layer-title-row { display: flex; align-items: center; gap: 8px; width: 100%; }
.layer-type-icon { font-size: 14px; }
.layer-name { font-size: 12px; color: #374151; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.layer-actions { display: flex; gap: 4px; }
.layer-actions button { width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; background: transparent; border: none; border-radius: 4px; cursor: pointer; transition: 0.2s; opacity: 0.6; }
.layer-actions button:hover { background: #e5e7eb; opacity: 1; }
.layer-item.active .layer-actions button { opacity: 1; }

.layer-desc-input { width: 100%; border: 1px solid transparent; background: transparent; font-size: 11px; color: #6b7280; padding: 4px; border-radius: 4px; transition: 0.2s; box-sizing: border-box; }
.layer-desc-input:hover, .layer-desc-input:focus { border-color: #cbd5e1; background: #fff; outline: none; color: #1f2937; }
.layer-item.active .layer-desc-input { color: #1e3a8a; }
.layer-item.active .layer-desc-input:hover, .layer-item.active .layer-desc-input:focus { background: #fff; border-color: #93c5fd; }

/* PROPERTY CONTROLS */
.control-group { margin-bottom: 10px; }
.control-group label { font-size: 11px; color: #4b5563; font-weight: bold; margin-bottom: 4px; display: block; }
.input-wrap { display: flex; gap: 10px; align-items: center; }
.input-wrap input[type="range"] { flex: 1; accent-color: #3b82f6; cursor: pointer; }
.input-wrap input[type="number"] { width: 60px; border: 1px solid #d1d5db; border-radius: 4px; padding: 4px; text-align: center; font-size: 12px; }

.settings-select { width: 100%; padding: 6px; border: 1px solid #d1d5db; border-radius: 4px; background-color: #fff; font-size: 12px; color: #374151; cursor: pointer; outline: none; transition: 0.2s; }
.settings-select:hover, .settings-select:focus { border-color: #3b82f6; }
.settings-divider { height: 1px; background: #e5e7eb; margin: 15px 0; }
.control-group-inline { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.control-group-inline label { font-size: 11px; color: #4b5563; font-weight: bold; margin: 0; }
.settings-checkbox { accent-color: #3b82f6; cursor: pointer; width: 16px; height: 16px; margin: 0; }

.applied-list { display: flex; flex-direction: column; gap: 4px; margin-bottom: 15px; }
.applied-item-wrapper { border: none; border-bottom: 1px solid #f1f5f9; border-radius: 0; overflow: hidden; }
.applied-item-header { display: flex; justify-content: space-between; padding: 10px 0; background: #ffffff; cursor: pointer; font-size: 13px; font-weight: 600; color: #374151; transition: 0.2s; }
.applied-item-header:hover { color: #111827; }
.applied-item-header.active { color: #2563eb; }
.applied-item-body { padding: 10px 0; background: #ffffff; border-top: none; }
.btn-sm-delete { background: transparent; border: none; color: #ef4444; cursor: pointer; font-weight: bold; }

.faceRow { display: flex; gap: 12px; margin-bottom: 10px; }
.faceRow label { font-size: 11px; display: flex; align-items: center; gap: 4px; cursor: pointer; color: #4b5563; }

.decor-gallery { margin-top: 15px; }
.decor-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.decor-item { border: 1px solid #e5e7eb; border-radius: 6px; padding: 6px; cursor: pointer; text-align: center; background: #fff; transition: 0.2s; }
.decor-item:hover, .decor-item.active { border-color: #3b82f6; background: #eff6ff; }
.decor-item img { width: 100%; height: 50px; object-fit: cover; border-radius: 4px; margin-bottom: 4px; }
.decor-item span { font-size: 10px; color: #4b5563; font-weight: bold; }
.hud-delete { background: #ffffff; color: #ef4444; border: 1px solid #fecaca; width: 100%; padding: 10px; border-radius: 6px; font-weight: 600; cursor: pointer; margin-top: 15px; transition: 0.2s; }
.hud-delete:hover { background: #fef2f2; border-color: #f87171; }

.floating-env-toolbar { position: absolute; top: 20px; right: 20px; display: flex; flex-direction: column; gap: 10px; z-index: 100; }
.floating-advanced-toolbar { position: absolute; top: 20px; right: 20px; z-index: 100; }
.adv-dropdown { position: relative; display: flex; align-items: center; }
.adv-trigger-btn { width: 44px; height: 44px; border-radius: 50%; background: rgba(17, 24, 39, 0.8); color: white; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 4px 10px rgba(0,0,0,0.3); cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; transition: 0.3s; z-index: 101; position: relative; backdrop-filter: blur(4px); }
.adv-trigger-btn:hover, .adv-trigger-btn.active { background: rgba(17, 24, 39, 1); border-color: rgba(255,255,255,0.4); transform: scale(1.05); }
.adv-side-menu { position: absolute; right: 100%; top: 50%; transform: translateY(-50%); margin-right: 12px; display: flex; gap: 8px; background: rgba(17, 24, 39, 0.8); padding: 6px; border-radius: 30px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); animation: slideInRight 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); backdrop-filter: blur(4px); }
@keyframes slideInRight { from { opacity: 0; transform: translate(20px, -50%) scale(0.9); } to { opacity: 1; transform: translate(0, -50%) scale(1); } }
.adv-round-btn { width: 36px; height: 36px; border-radius: 50%; background: transparent; color: white; border: 1px solid transparent; cursor: pointer; font-size: 16px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
.adv-round-btn:hover { background: rgba(255,255,255,0.1); transform: scale(1.1); }
.adv-round-btn.active { background: #ffffff; color: #111827; border-color: #ffffff; }
.env-dropdown { position: relative; }
.env-icon-btn { background: rgba(17, 24, 39, 0.8); color: white; border: 1px solid rgba(255,255,255,0.2); padding: 8px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; backdrop-filter: blur(4px); transition: 0.2s; white-space: nowrap; display: flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; }
.env-icon-btn:hover { background: rgba(17, 24, 39, 1); box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
.env-icon-btn.active { background: rgba(59, 130, 246, 0.9); border-color: rgba(96, 165, 250, 1); box-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
.env-menu { position: absolute; top: 100%; right: 0; margin-top: 5px; background: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); padding: 10px; width: 240px; max-width: calc(100vw - 40px); max-height: 60vh; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; z-index: 1000; }
.env-menu::before { content: ''; position: absolute; top: -10px; left: 0; right: 0; height: 10px; }
.env-menu-item { padding: 8px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold; color: #374151; transition: 0.2s; }
.env-menu-item:hover { background: #f3f4f6; }
.env-menu-item.active { background: #eff6ff; color: #1d4ed8; }

.bottom-right-toolbar { position: absolute; bottom: 15px; right: 15px; display: flex; flex-direction: column; gap: 8px; z-index: 100; }
.bottom-right-toolbar button { width: 40px; height: 40px; background: rgba(17, 24, 39, 0.8); color: white; border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; cursor: pointer; font-size: 20px; font-weight: bold; backdrop-filter: blur(4px); transition: 0.2s; display: flex; align-items: center; justify-content: center; }
.bottom-right-toolbar button:hover { background: rgba(17, 24, 39, 1); }

/* COMPASS WIDGET */
.compass-widget { position: absolute; bottom: 20px; left: 20px; width: 60px; height: 60px; background: rgba(17, 24, 39, 0.8); border-radius: 50%; border: 2px solid rgba(255,255,255,0.2); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: center; justify-content: center; pointer-events: none; }
.compass-center { width: 8px; height: 8px; background: white; border-radius: 50%; }
.compass-n { position: absolute; top: 4px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: #ef4444; }
.compass-s { position: absolute; bottom: 4px; left: 50%; transform: translateX(-50%); font-size: 10px; font-weight: bold; color: #9ca3af; }
.compass-w { position: absolute; left: 6px; top: 50%; transform: translateY(-50%); font-size: 10px; font-weight: bold; color: #9ca3af; }
.compass-e { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 10px; font-weight: bold; color: #9ca3af; }

/* TRANSFORM MENU 3D */
.transform-menu-3d {
    position: absolute;
    width: 120px;
    height: 120px;
    border-radius: 50%;
    pointer-events: none;
    z-index: 100;
}
.transform-menu-btn {
    position: absolute;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(17, 24, 39, 0.85);
    color: white;
    border: 1px solid rgba(255,255,255,0.2);
    cursor: pointer;
    font-size: 10px;
    font-weight: bold;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    pointer-events: auto;
    transition: 0.2s;
    backdrop-filter: blur(4px);
    text-align: center;
    line-height: 1.1;
    box-shadow: 0 4px 10px rgba(0,0,0,0.3);
}
.transform-menu-btn:hover {
    background: rgba(37, 99, 235, 0.9);
    transform: scale(1.1);
}
.transform-menu-btn.active {
    background: rgba(59, 130, 246, 1);
    border-color: #93c5fd;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.6);
}

/* WIZARD MODAL */
.wizard-overlay {
    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.5); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center; z-index: 2000;
}
.wizard-modal {
    background: white; border-radius: 12px; width: 400px; max-width: 90%;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden;
}
.wizard-header {
    background: #f8fafc; padding: 15px 20px; border-bottom: 1px solid #e5e7eb;
    display: flex; justify-content: space-between; align-items: center;
}
.wizard-header h3 { margin: 0; font-size: 16px; color: #1f2937; }
.wizard-close { background: transparent; border: none; font-size: 18px; cursor: pointer; color: #6b7280; }
.wizard-close:hover { color: #ef4444; }
.wizard-body { padding: 20px; display: flex; flex-direction: column; gap: 15px; }
.wizard-desc { margin: 0; font-size: 13px; color: #4b5563; line-height: 1.4; }
.wizard-error { background: #fee2e2; color: #b91c1c; padding: 10px; border-radius: 6px; font-size: 12px; font-weight: bold; border: 1px solid #fca5a5; }
.wizard-footer {
    padding: 15px 20px; background: #f8fafc; border-top: 1px solid #e5e7eb;
    display: flex; justify-content: flex-end; gap: 10px;
}
.wizard-btn {
    background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
    border: none; color: white !important; padding: 8px 16px;
    border-radius: 6px; font-weight: bold; font-size: 13px; cursor: pointer; transition: 0.2s; box-shadow: 0 4px 10px rgba(99, 102, 241, 0.3);
}
.wizard-btn:hover {
    background: linear-gradient(135deg, #4f46e5, #7c3aed) !important; transform: translateY(-1px);
}
.visual-boundary-box {
    position: relative; height: 180px; border: 2px dashed #9ca3af; border-radius: 8px; margin: 40px;
    background: #f1f5f9; display: flex; align-items: center; justify-content: center;
}
.vb-compass-line-v { position: absolute; top: -20px; bottom: -20px; left: 50%; border-left: 1px dashed #cbd5e1; z-index: 1; pointer-events: none; }
.vb-compass-line-h { position: absolute; left: -30px; right: -30px; top: 50%; border-top: 1px dashed #cbd5e1; z-index: 1; pointer-events: none; }

.vb-north, .vb-south, .vb-east, .vb-west {
    position: absolute; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 900; z-index: 10; padding: 0; box-sizing: border-box; letter-spacing: 0;
}
.vb-north { top: -45px; left: 50%; transform: translateX(-50%); color: white; background: #ef4444; border: none; box-shadow: 0 2px 5px rgba(239, 68, 68, 0.4); }
.vb-south { bottom: -45px; left: 50%; transform: translateX(-50%); color: #6b7280; background: #ffffff; border: 2px solid #e5e7eb; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.vb-east { right: -65px; top: 50%; transform: translateY(-50%); color: #6b7280; background: #ffffff; border: 2px solid #e5e7eb; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
.vb-west { left: -65px; top: 50%; transform: translateY(-50%); color: #6b7280; background: #ffffff; border: 2px solid #e5e7eb; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }

.vb-input { position: absolute; background: white; width: 60px; text-align: center; padding: 4px 6px; border-radius: 4px; font-size: 13px; font-weight: bold; border: 2px solid #3b82f6; color: #1d4ed8; outline: none; transition: 0.2s; z-index: 5; }
.vb-input:focus { box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.3); }
.vb-input:disabled { border: 1px solid #d1d5db; color: #6b7280; background: #f3f4f6; }
.vb-input.top { top: -14px; left: 50%; transform: translateX(-50%); }
.vb-input.bottom { bottom: -14px; left: 50%; transform: translateX(-50%); }
.vb-input.left { left: -30px; top: 50%; transform: translateY(-50%); }
.vb-input.right { right: -30px; top: 50%; transform: translateY(-50%); }

.vb-center-text { text-align: center; display: flex; flex-direction: column; align-items: center; }
.vb-sqft-input { width: 80px; text-align: center; font-size: 20px; font-weight: bold; color: #1e40af; border: none; background: transparent; border-bottom: 2px dashed #93c5fd; outline: none; transition: 0.2s; }
.vb-sqft-input:focus { border-bottom-color: #1e40af; }

/* RESPONSIVE LAYOUT */

@media (max-width: 1199px) {
    .main-workspace { flex-direction: column; padding-bottom: 60px; position: relative; }
    
    .mobile-left-trigger {
        position: fixed;
        left: 0;
        top: 50%;
        transform: translateY(-50%);
        background: #ffffff;
        color: #4b5563;
        border: 1px solid #e5e7eb;
        border-left: none;
        padding: 12px 4px;
        border-radius: 0 8px 8px 0;
        z-index: 1000;
        cursor: pointer;
        box-shadow: 2px 0 8px rgba(0,0,0,0.05);
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .mobile-left-trigger svg {
        width: 24px;
        height: 24px;
    }

    .mobile-panel { 
        position: absolute !important; 
        z-index: 2000 !important; 
        box-shadow: 0 0 20px rgba(0,0,0,0.2) !important; 
    }
    
    .left-sidebar.mobile-panel { 
        left: 0 !important; 
        top: 0 !important; 
        bottom: 60px !important; 
            width: max-content !important; 
        height: calc(100% - 60px) !important; 
        background: #ffffff !important; 
    }
    
    .right-sidebar.mobile-panel { 
        right: 0 !important; 
        top: 0 !important; 
        bottom: 60px !important; 
        width: 320px !important; 
        height: calc(100% - 60px) !important; 
        background: #f8fafc !important; 
    }

    .mobile-bottom-nav { position: fixed; bottom: 0; left: 0; width: 100%; height: 60px; background: #ffffff; display: flex; justify-content: space-around; align-items: center; z-index: 2100; border-top: 1px solid #e5e7eb; padding: 4px; box-sizing: border-box; }
    .mobile-bottom-nav button { flex: 1; height: 100%; background: transparent; border: none; color: #6b7280; display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: 10px; gap: 4px; cursor: pointer; font-weight: 600; transition: 0.2s; border-radius: 8px; }
    .mobile-bottom-nav button:hover { background: #f8fafc; color: #111827; }
    .mobile-bottom-nav button.active { color: #2563eb; background: #eff6ff; }
    .bottom-nav-icon { width: 22px; height: 22px; }
    .mobile-close-btn { background: #f8fafc; padding: 15px; text-align: right; font-weight: bold; color: #ef4444; border-bottom: 1px solid #e5e7eb; cursor: pointer; font-size: 14px; display: block; }
    
    .levels-panel { flex: 1; border-bottom: none; }
    .levels-list { max-height: none; }

    .env-dropdown { position: static; }
}

@media (max-width: 767px) {
    .left-sidebar.mobile-panel { 
        width: 100% !important; 
        left: 0 !important; 
        top: 0 !important; 
        bottom: 60px !important; 
        height: calc(100% - 60px) !important; 
    }
    
    .right-sidebar.mobile-panel { 
        width: 100% !important; 
        left: 0 !important; 
        top: auto !important; 
        bottom: 60px !important; 
        height: 60% !important; 
        border-top: 1px solid #e5e7eb !important;
        border-radius: 16px 16px 0 0 !important;
        background: #ffffff !important;
    }

    .top-toolbar { padding: 6px 10px; gap: 8px; justify-content: flex-start; }
    .left-tools, .center-tools, .right-tools { flex-wrap: nowrap; justify-content: flex-start; width: auto; gap: 6px; }
    .tool-btn { padding: 4px 8px; min-width: max-content; flex-shrink: 0; }
    .tool-icon { width: 18px; height: 18px; }
    .tool-label { font-size: 9px; }
    .floating-advanced-toolbar { top: 10px; right: 10px; }
    .floating-env-toolbar { top: 10px; right: 10px; flex-wrap: wrap; justify-content: flex-end; }
    .bottom-right-toolbar { bottom: 70px; right: 10px; }
    .compass-widget { bottom: 80px; left: 10px; width: 40px; height: 40px; }
    .compass-n, .compass-s, .compass-e, .compass-w { font-size: 8px; }
    .compass-center { width: 6px; height: 6px; }
    .status-bar { bottom: 80px; font-size: 11px; padding: 8px 15px; width: 90%; text-align: center; }
}
</style>
