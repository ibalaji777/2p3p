<template>
  <div class="common-toolbar-3d-wrapper common-toolbar-3d" v-show="viewMode === '3d' && !isDrawerOpen">
    <div class="common-toolbar-vertical-strip">
      <!-- SELECT TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'select' }"
        @click="selectTool('select')"
        title="Select Tool (Key: V / Esc)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 3l7 18 3-7 7-3L3 3z"></path>
        </svg>
      </button>

      <!-- MATERIAL TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'material', disabled: !canMaterial }"
        @click="selectTool('material')"
        title="Material Painting Tool (Key: B)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path>
          <path d="M12 22.5A8.5 8.5 0 0 0 20.5 14c0-3-2.5-5.5-5.5-8.5"></path>
        </svg>
      </button>

      <div class="toolbar-divider-h"></div>

      <!-- MASTER WALL ARCHITECTURE TOOLS BUTTON WITH FLYOUT SUBMENU -->
      <div class="wall-tools-anchor" ref="wallToolsAnchorRef">
        <button 
          class="tool-btn wall-master-btn" 
          :class="{ active: isWallToolActive }"
          @click="toggleWallMenu"
          title="Wall Architecture Tools (Room, Extender, Vertices, Bay/Niche, Split, Corners)"
        >
          <!-- Dynamic icon reflecting active sub-tool, or default Wall Brick icon -->
          <svg v-if="currentTool === 'room_suite'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <svg v-else-if="currentTool === 'push_pull'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 17l-5-5 5-5M17 7l5 5-5 5M2 12h20"></path>
          </svg>
          <svg v-else-if="currentTool === 'corner'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M3 12h6M15 12h6M12 3v6M12 15v6"></path>
          </svg>
          <svg v-else-if="currentTool === 'extrude_recess'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
            <line x1="12" y1="22.08" x2="12" y2="12"></line>
          </svg>
          <svg v-else-if="currentTool === 'split'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="6" cy="6" r="3"></circle>
            <circle cx="6" cy="18" r="3"></circle>
            <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
            <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
          </svg>
          <svg v-else-if="currentTool === 'wall_corners'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 20V10a6 6 0 0 1 6-6h10"></path>
            <circle cx="4" cy="20" r="2.2" fill="currentColor"></circle>
            <circle cx="20" cy="4" r="2.2" fill="currentColor"></circle>
          </svg>
          <svg v-else-if="currentTool === 'elevation_segment'" class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="2"></rect>
            <path d="M6 12h12M12 9v6"></path>
          </svg>
          <svg v-else class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2"></rect>
            <line x1="3" y1="12" x2="21" y2="12"></line>
            <line x1="9" y1="4" x2="9" y2="12"></line>
            <line x1="15" y1="12" x2="15" y2="20"></line>
          </svg>
          <span class="sub-indicator-badge">›</span>
        </button>

        <!-- FLOATING WALL TOOLS FLYOUT SUBMENU -->
        <div class="wall-tools-flyout" v-show="showWallMenu">
          <div class="flyout-header-row">
            <span class="flyout-header-title">Wall Tools</span>
            <button class="flyout-close-btn" @click.stop="showWallMenu = false" title="Close Submenu">✕</button>
          </div>
          <div class="flyout-items">
            <!-- 1. Room -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'room_suite' || currentTool === 'building_rise' }"
              @click="handleSelectWallTool('room_suite')"
              title="Room & Building Controls (Key: U)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
              <span class="flyout-label">Room</span>
              <kbd class="flyout-badge">U</kbd>
            </button>

            <!-- 2. Extender -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'push_pull' }"
              @click="handleSelectWallTool('push_pull')"
              title="Extender: Wall Thickness & Baseline (Key: E)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M7 17l-5-5 5-5M17 7l5 5-5 5M2 12h20"></path>
              </svg>
              <span class="flyout-label">Extender</span>
              <kbd class="flyout-badge">E</kbd>
            </button>

            <!-- 3. Vertices -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'corner' }"
              @click="handleSelectWallTool('corner')"
              title="Vertices: Height, Slope & Vertices (Key: K)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M3 12h6M15 12h6M12 3v6M12 15v6"></path>
              </svg>
              <span class="flyout-label">Vertices</span>
              <kbd class="flyout-badge">K</kbd>
            </button>

            <!-- 4. Bay/Niche -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'extrude_recess' }"
              @click="handleSelectWallTool('extrude_recess')"
              title="Bay/Niche: Extrude Bay Window or Niche (Key: N)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                <line x1="12" y1="22.08" x2="12" y2="12"></line>
              </svg>
              <span class="flyout-label">Bay/Niche</span>
              <kbd class="flyout-badge">N</kbd>
            </button>

            <!-- 5. Split -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'split' }"
              @click="handleSelectWallTool('split')"
              title="Split: Slice Wall in 3D (Key: X)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <line x1="20" y1="4" x2="8.12" y2="15.88"></line>
                <line x1="14.47" y1="14.48" x2="20" y2="20"></line>
              </svg>
              <span class="flyout-label">Split</span>
              <kbd class="flyout-badge">X</kbd>
            </button>

            <!-- 6. Corners -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'wall_corners' }"
              @click="handleSelectWallTool('wall_corners')"
              title="Wall Corners: Show Corners & Curved Fillets (Key: C)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M4 20V10a6 6 0 0 1 6-6h10"></path>
                <circle cx="4" cy="20" r="2.2" fill="currentColor"></circle>
                <circle cx="20" cy="4" r="2.2" fill="currentColor"></circle>
              </svg>
              <span class="flyout-label">Corners</span>
              <kbd class="flyout-badge">C</kbd>
            </button>

            <!-- 7. Elevation Segment -->
            <button 
              class="flyout-item-btn" 
              :class="{ active: currentTool === 'elevation_segment' }"
              @click="handleSelectWallTool('elevation_segment')"
              title="Elevation Segment: Facade Band, Panel & Trim (Key: J)"
            >
              <svg class="flyout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="6" width="20" height="12" rx="2"></rect>
                <path d="M6 12h12M12 9v6"></path>
              </svg>
              <span class="flyout-label">Elevation</span>
              <kbd class="flyout-badge">J</kbd>
            </button>
          </div>
        </div>
      </div>

      <div class="toolbar-divider-h"></div>

      <!-- MOVE TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'move', disabled: !canMove }"
        @click="selectTool('move')"
        title="Move Object (Key: M / G)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="5 9 2 12 5 15"></polyline>
          <polyline points="9 5 12 2 15 5"></polyline>
          <polyline points="15 19 12 22 9 19"></polyline>
          <polyline points="19 9 22 12 19 15"></polyline>
          <line x1="2" y1="12" x2="22" y2="12"></line>
          <line x1="12" y1="2" x2="12" y2="22"></line>
        </svg>
      </button>

      <!-- SPIN TOOL -->
      <button 
        class="tool-btn" 
        :class="{ active: currentTool === 'spin', disabled: !canSpin }"
        @click="selectTool('spin')"
        title="Spin / Rotate (Key: R)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.5 2v6h-6"></path>
          <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"></path>
        </svg>
      </button>

      <!-- ELEVATION AXIS UP -->
      <button 
        class="tool-btn action-btn" 
        :class="{ disabled: !canElevate }"
        @click="triggerElevate(1)"
        title="Elevate Up (Key: ] / PageUp)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="19" x2="12" y2="5"></line>
          <polyline points="5 12 12 5 19 12"></polyline>
        </svg>
      </button>

      <!-- ELEVATION AXIS DOWN -->
      <button 
        class="tool-btn action-btn" 
        :class="{ disabled: !canElevate }"
        @click="triggerElevate(-1)"
        title="Elevate Down (Key: [ / PageDown)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <polyline points="19 12 12 19 5 12"></polyline>
        </svg>
      </button>

      <div class="toolbar-divider-h"></div>

      <!-- CATALOG / TOOLS DRAWER TOGGLE -->
      <button 
        class="tool-btn catalog-btn" 
        @click="$emit('toggle-catalog')"
        title="Open Catalog & Materials (Key: C)"
      >
        <svg class="tool-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    </div>

    <!-- SHORTCUT & TOUCH CONTROLS POPUP MODAL (TELEPORTED TO BODY) -->
    <Teleport to="body">
      <div class="help-popup-backdrop" v-if="showHelpPopup" @click.self="showHelpPopup = false">
        <div class="help-popup-card">
        <!-- HEADER -->
        <div class="help-popup-header">
          <div class="header-title-row">
            <div class="title-with-badge">
              <svg class="header-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 16v-4"></path>
                <path d="M12 8h.01"></path>
              </svg>
              <h3>3D Scene Controls & Shortcuts</h3>
            </div>
            <button class="close-btn" @click="showHelpPopup = false" title="Close (Esc)">✕</button>
          </div>

          <!-- DEVICE TABS -->
          <div class="device-tabs">
            <button 
              class="device-tab" 
              :class="{ active: activeDeviceTab === 'desktop' }"
              @click="activeDeviceTab = 'desktop'"
            >
              <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
              <span>Desktop (Mouse & Keyboard)</span>
            </button>

            <button 
              class="device-tab" 
              :class="{ active: activeDeviceTab === 'touch' }"
              @click="activeDeviceTab = 'touch'"
            >
              <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
                <line x1="12" y1="18" x2="12.01" y2="18"></line>
              </svg>
              <span>Mobile & Tablet (Touch)</span>
            </button>
          </div>
        </div>

        <!-- BODY -->
        <div class="help-popup-body">
          <!-- DESKTOP CONTENT -->
          <div v-if="activeDeviceTab === 'desktop'" class="guide-sections">
            <!-- 1. OBJECT CONTROLS -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge">Objects</span>
                <h4>Direct Object Manipulation</h4>
              </div>
              <div class="shortcuts-grid">
                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Select Object</strong>
                    <span>Click on any furniture, stair, door, window or wall</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Left Click</kbd>
                    <kbd class="key-chip">V</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Direct Move / Drag</strong>
                    <span>Click & drag directly on the object across the floor</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Drag</kbd>
                    <kbd class="key-chip">M</kbd>
                    <kbd class="key-chip">G</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Smooth Free Move</strong>
                    <span>Hold Alt while dragging to bypass 10cm grid snap</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Alt</kbd>
                    <span>+</span>
                    <kbd class="key-chip">Drag</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>45° Step Rotate</strong>
                    <span>Rotate held or selected object in 45° steps</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Right Click</kbd>
                    <kbd class="key-chip">&lt; ,</kbd>
                    <kbd class="key-chip">&gt; .</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Smooth Drag Spin</strong>
                    <span>Hold Right-Click (or [Spin] Tool) & drag horizontally</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Right Drag</kbd>
                    <kbd class="key-chip">R</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Material Face Paint</strong>
                    <span>Activate paint tool, select texture, click any face</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">B</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Rise Tool (All Walls & Room Lift)</strong>
                    <span>Adjust all wall heights/elevations or lift room</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">U</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Wall Extender (Push/Pull)</strong>
                    <span>Extend wall thickness & baseline push/pull in 3D</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">E</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Wall Vertices & Height</strong>
                    <span>Adjust wall height, slope, baseline elevation & vertices</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">K</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Bay Window & Recessed Niche</strong>
                    <span>Extrude bay window or recessed niche in 3D</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">N</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Split Wall</strong>
                    <span>Slice wall in 3D with interactive laser plane</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">X</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Elevation Segment</strong>
                    <span>Place architectural facade beams, bands & trims</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">J</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Raise / Lower Elevation</strong>
                    <span>Adjust vertical height in 10cm increments</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">]</kbd>
                    <kbd class="key-chip">[</kbd>
                    <kbd class="key-chip">PgUp</kbd>
                    <kbd class="key-chip">PgDn</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Delete Object</strong>
                    <span>Remove currently selected object</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Del</kbd>
                    <kbd class="key-chip">Backspace</kbd>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. CAMERA CONTROLS -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge camera">Camera</span>
                <h4>Scene Navigation</h4>
              </div>
              <div class="shortcuts-grid">
                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Ground-Plane Gliding</strong>
                    <span>Pan smoothly across room in 4 directions</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">W</kbd>
                    <kbd class="key-chip">A</kbd>
                    <kbd class="key-chip">S</kbd>
                    <kbd class="key-chip">D</kbd>
                    <kbd class="key-chip">Arrows</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Turbo Speed Gliding</strong>
                    <span>Fast camera navigation across large buildings</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Shift</kbd>
                    <span>+</span>
                    <kbd class="key-chip">WASD</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Orbit / Rotate View</strong>
                    <span>Rotate 3D camera around focal center</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Right Drag (Empty)</kbd>
                    <kbd class="key-chip">Middle Drag</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>45° Step Orbit</strong>
                    <span>Rotate camera isometrically in 45° increments</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">&lt; ,</kbd>
                    <kbd class="key-chip">&gt; .</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Top-Down View Toggle</strong>
                    <span>Toggle architectural bird's-eye orthogonal view</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">T</kbd>
                  </div>
                </div>

                <div class="shortcut-item">
                  <div class="action-desc">
                    <strong>Undo / Redo</strong>
                    <span>Revert or restore any layout change</span>
                  </div>
                  <div class="keys-container">
                    <kbd class="key-chip">Ctrl + Z</kbd>
                    <kbd class="key-chip">Ctrl + Y</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TOUCH / TABLET / MOBILE CONTENT -->
          <div v-else class="guide-sections">
            <!-- 1. TOUCH OBJECT MANIPULATION -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge touch">Touch</span>
                <h4>Mobile & Tablet Object Gestures</h4>
              </div>
              <div class="touch-cards-grid">
                <div class="touch-card">
                  <div class="gesture-icon-badge">👆</div>
                  <div class="touch-card-info">
                    <strong>Tap to Select</strong>
                    <span>Tap any 3D object (furniture, stair, door, window, wall) to highlight and activate actions.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🖐</div>
                  <div class="touch-card-info">
                    <strong>1-Finger Drag to Move</strong>
                    <span>Touch down directly on the object and slide across the screen to glide it smoothly across the floor.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🔄</div>
                  <div class="touch-card-info">
                    <strong>Spin / Rotate Tool</strong>
                    <span>Tap the <strong>[ Spin ]</strong> button in the top toolbar, then swipe 1 finger horizontally to rotate smoothly in place.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🎨</div>
                  <div class="touch-card-info">
                    <strong>Material Face Painting</strong>
                    <span>Tap <strong>[ Material ]</strong> in the top toolbar, choose a texture from the bottom sheet, and tap directly on any wall face or component slot.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">↕️</div>
                  <div class="touch-card-info">
                    <strong>Raise / Lower Elevation</strong>
                    <span>Tap the <strong>↑</strong> and <strong>↓</strong> buttons on the top toolbar capsule to step object height by 10cm.</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 2. TOUCH CAMERA CONTROLS -->
            <div class="guide-section">
              <div class="section-title">
                <span class="section-badge camera">Camera</span>
                <h4>Touch Camera Navigation</h4>
              </div>
              <div class="touch-cards-grid">
                <div class="touch-card">
                  <div class="gesture-icon-badge">☝️</div>
                  <div class="touch-card-info">
                    <strong>1-Finger Drag (Empty Space)</strong>
                    <span>Drag on empty background to orbit and look around the 3D scene.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">✌️</div>
                  <div class="touch-card-info">
                    <strong>2-Finger Drag (Pan)</strong>
                    <span>Slide two fingers across the screen to pan and glide the camera across the building.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">🤏</div>
                  <div class="touch-card-info">
                    <strong>Pinch to Zoom</strong>
                    <span>Pinch in or spread out with two fingers to zoom smoothly in and out.</span>
                  </div>
                </div>

                <div class="touch-card">
                  <div class="gesture-icon-badge">📐</div>
                  <div class="touch-card-info">
                    <strong>2-Finger Twist</strong>
                    <span>Twist two fingers on the canvas to rotate the isometric angle of the scene.</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- FOOTER -->
        <div class="help-popup-footer">
          <div class="footer-tip">
            <span class="tip-sparkle">💡</span>
            <span v-if="activeDeviceTab === 'desktop'"><strong>Pro Tip:</strong> Press <kbd class="inline-key">?</kbd> or <kbd class="inline-key">H</kbd> anytime to open this shortcut guide.</span>
            <span v-else><strong>Pro Tip:</strong> Hold two fingers down while dragging to glide smoothly through interior rooms.</span>
          </div>
          <button class="footer-done-btn" @click="showHelpPopup = false">Got it</button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { COMMON_TOOLS } from '../../core/engine3d/tools/CommonToolRegistry.js';
import { coreEventBus } from '../../core/EventBus.js';

const props = defineProps({
  viewMode: {
    type: String,
    default: '3d'
  },
  isDesktop: {
    type: Boolean,
    default: true
  },
  controller: {
    type: Object,
    default: null
  },
  isDrawerOpen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['tool-changed', 'elevate']);

const currentTool = ref(COMMON_TOOLS.SELECT);
const selectedEntity = ref(null);
const showHelpPopup = ref(false);
const activeDeviceTab = ref(props.isDesktop ? 'desktop' : 'touch');

const WALL_TOOLS_SET = new Set([
  'room_suite',
  'building_rise',
  'push_pull',
  'corner',
  'extrude_recess',
  'split',
  'wall_corners',
  'elevation_segment'
]);

const showWallMenu = ref(false);
const wallToolsAnchorRef = ref(null);

const isWallToolActive = computed(() => {
  return WALL_TOOLS_SET.has(currentTool.value);
});

const toggleWallMenu = () => {
  showWallMenu.value = !showWallMenu.value;
};

const handleSelectWallTool = (toolId) => {
  selectTool(toolId);
  showWallMenu.value = false;
};

const handleClickOutside = (event) => {
  if (showWallMenu.value && wallToolsAnchorRef.value && !wallToolsAnchorRef.value.contains(event.target)) {
    showWallMenu.value = false;
  }
};

const currentCaps = ref({
  selectable: true,
  material: true,
  movable: false,
  rotatable: false,
  tiltable: false,
  elevatable: false
});

const canMove = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.movable : false;
});

const canSpin = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.rotatable : false;
});

const canTilt = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.tiltable : false;
});

const canElevate = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.elevatable : false;
});

const canMaterial = computed(() => {
  return selectedEntity.value ? !!currentCaps.value.material : false;
});

const effectiveController = computed(() => {
  return props.controller || (typeof window !== 'undefined' ? (window.renderer3D?.commonTools || window.planner?.engine3d?.commonTools) : null);
});

const selectTool = (toolId) => {
  const ctrl = effectiveController.value;

  if (toolId === 'material') {
    if (!canMaterial.value) {
      coreEventBus.emit('ShowToast', { message: 'Select an object first to paint materials', type: 'info' });
      return;
    }
  }

  if (toolId === 'move') {
    if (!selectedEntity.value) {
      coreEventBus.emit('ShowToast', { message: 'Select an object first', type: 'info' });
      return;
    }
    if (!canMove.value) return;
    if (ctrl?.activateAction) {
      ctrl.activateAction('move');
      return;
    }
  }

  if (toolId === 'spin') {
    if (!selectedEntity.value) {
      coreEventBus.emit('ShowToast', { message: 'Select an object first', type: 'info' });
      return;
    }
    if (!canSpin.value) return;
    if (ctrl?.activateAction) {
      ctrl.activateAction('spin');
      return;
    }
  }

  const toggleableTools = [
    'wall_corners',
    'room_suite',
    'push_pull',
    'corner',
    'extrude_recess',
    'split',
    'elevation_segment'
  ];
  if (currentTool.value === toolId && toggleableTools.includes(toolId)) {
    toolId = 'select';
  }
  currentTool.value = toolId;
  if (ctrl) {
    ctrl.setTool(toolId);
  }
  emit('tool-changed', toolId);
};

const triggerElevate = (direction) => {
  if (!selectedEntity.value) {
    coreEventBus.emit('ShowToast', { message: 'Select an object first', type: 'info' });
    return;
  }
  const ctrl = effectiveController.value;
  if (ctrl) {
    ctrl.handleAxisStep(direction);
  }
  emit('elevate', direction);
};

let unsubs = [];

onMounted(() => {
  unsubs.push(coreEventBus.on('CommonToolChanged', ({ activeTool }) => {
    if (activeTool) currentTool.value = activeTool;
  }));

  unsubs.push(coreEventBus.on('InteractionStateChanged', (state) => {
    if (!state) return;
    if (state.activeAction) {
      currentTool.value = state.activeAction;
    } else if (state.activeTool) {
      currentTool.value = state.activeTool;
    }
    selectedEntity.value = state.selectedEntity || null;
    if (state.capabilities) {
      currentCaps.value = { ...state.capabilities };
    }
  }));

  unsubs.push(coreEventBus.on('CommonSelectionChanged', ({ entity, capabilities }) => {
    selectedEntity.value = entity;
    if (capabilities) {
      currentCaps.value = { ...capabilities };
    } else {
      currentCaps.value = {
        selectable: true,
        material: true,
        movable: !!entity,
        rotatable: !!entity,
        tiltable: !!entity,
        elevatable: !!entity
      };
    }
  }));

  unsubs.push(coreEventBus.on('ToggleCommonHelpModal', () => {
    showHelpPopup.value = !showHelpPopup.value;
  }));

  window.addEventListener('pointerdown', handleClickOutside);
});

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', handleClickOutside);
  unsubs.forEach(unsub => unsub());
  unsubs = [];
});
</script>

<style scoped>
.common-toolbar-3d-wrapper {
  position: fixed;
  top: 60px;
  left: 14px;
  z-index: 990;
  pointer-events: none;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  user-select: none;
  transition: left 0.28s cubic-bezier(0.16, 1, 0.3, 1);
}

@media (min-width: 768px) {
  .common-toolbar-3d-wrapper {
    left: calc(68px + 14px);
  }
}

.common-toolbar-vertical-strip {
  pointer-events: auto;
  background: rgba(255, 255, 255, 0.94);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(226, 232, 240, 0.9);
  box-shadow: 
    0 8px 24px -4px rgba(15, 23, 42, 0.1),
    0 2px 6px -1px rgba(15, 23, 42, 0.05);
  border-radius: 14px;
  padding: 3px 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 28px;
  box-sizing: border-box;
}

.tool-btn {
  background: transparent;
  border: 1px solid transparent;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #475569;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 0;
  flex-shrink: 0;
}

.tool-btn:hover:not(.disabled):not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
  transform: translateY(-1px);
}

.tool-btn:active:not(.disabled):not(:disabled) {
  transform: translateY(0) scale(0.95);
}

.tool-btn.active {
  background: #2563eb;
  border-color: #3b82f6;
  color: #ffffff;
  box-shadow: 0 1px 4px rgba(37, 99, 235, 0.35);
}

.tool-btn.disabled {
  opacity: 0.45;
  color: #94a3b8;
  cursor: not-allowed;
  pointer-events: auto;
}

.tool-btn:disabled {
  opacity: 0.45;
  color: #94a3b8;
  cursor: not-allowed;
  pointer-events: none;
}

.tool-icon {
  width: 13px;
  height: 13px;
  stroke: currentColor;
  flex-shrink: 0;
}

.toolbar-divider-h {
  width: 14px;
  height: 1px;
  background: rgba(226, 232, 240, 0.9);
  margin: 1px 0;
  flex-shrink: 0;
}

/* WALL MASTER BUTTON & FLYOUT SUBMENU */
.wall-tools-anchor {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.wall-master-btn {
  position: relative;
}

.sub-indicator-badge {
  position: absolute;
  right: 1px;
  bottom: 0px;
  font-size: 8px;
  font-weight: 800;
  line-height: 1;
  color: inherit;
  opacity: 0.8;
  pointer-events: none;
}

.wall-tools-flyout {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  background: rgba(255, 255, 255, 0.98);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(226, 232, 240, 0.95);
  box-shadow: 
    0 12px 30px -4px rgba(15, 23, 42, 0.16),
    0 4px 10px -2px rgba(15, 23, 42, 0.08);
  border-radius: 12px;
  padding: 6px;
  min-width: 165px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  gap: 3px;
  animation: flyoutSlideIn 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes flyoutSlideIn {
  from {
    opacity: 0;
    transform: translateX(-6px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateX(0) scale(1);
  }
}

.flyout-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 3px 6px 5px;
  border-bottom: 1px solid rgba(226, 232, 240, 0.8);
}

.flyout-header-title {
  font-size: 11px;
  font-weight: 700;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.flyout-close-btn {
  background: transparent;
  border: none;
  font-size: 11px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px 5px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.flyout-close-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.flyout-items {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.flyout-item-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 8px;
  border-radius: 8px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
  transition: all 0.15s ease;
  min-height: 34px;
  box-sizing: border-box;
}

.flyout-item-btn:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.flyout-item-btn.active {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
  font-weight: 600;
}

.flyout-icon {
  width: 15px;
  height: 15px;
  stroke: currentColor;
  flex-shrink: 0;
}

.flyout-label {
  flex: 1;
  font-size: 12px;
  white-space: nowrap;
}

.flyout-badge {
  font-size: 10px;
  font-weight: 600;
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  padding: 1px 5px;
  border-radius: 4px;
  font-family: inherit;
}

.flyout-item-btn.active .flyout-badge {
  background: #dbeafe;
  border-color: #bfdbfe;
  color: #1d4ed8;
}

.catalog-btn {
  color: #2563eb;
}

.catalog-btn:hover {
  background: #eff6ff;
  color: #1d4ed8;
}

.help-btn:hover {
  color: #0284c7;
  background: #f0f9ff;
}

.help-btn.active {
  background: #e0f2fe;
  border-color: #7dd3fc;
  color: #0369a1;
}

.toolbar-divider {
  width: 1px;
  height: 20px;
  background: rgba(226, 232, 240, 0.9);
  margin: 0 2px;
  flex-shrink: 0;
}

/* HELP POPUP BACKDROP & MODAL */
.help-popup-backdrop {
  position: fixed;
  inset: 0;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 99999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  animation: fadeInBackdrop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  padding: 20px;
  box-sizing: border-box;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.help-popup-card {
  background: rgba(255, 255, 255, 0.97);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.8);
  box-shadow: 
    0 25px 50px -12px rgba(15, 23, 42, 0.25),
    0 0 0 1px rgba(226, 232, 240, 0.8);
  border-radius: 20px;
  width: 100%;
  max-width: 680px;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: scaleInCard 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.help-popup-header {
  padding: 18px 22px 14px;
  border-bottom: 1px solid #f1f5f9;
  background: #fafbfc;
}

.header-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.title-with-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  width: 22px;
  height: 22px;
  color: #0284c7;
}

.title-with-badge h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.close-btn {
  background: #f1f5f9;
  border: none;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  color: #64748b;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.device-tabs {
  display: flex;
  gap: 8px;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 12px;
}

.device-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 14px;
  background: transparent;
  border: none;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
  cursor: pointer;
  transition: all 0.2s;
}

.device-tab.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
}

.tab-icon {
  width: 16px;
  height: 16px;
}

.help-popup-body {
  padding: 20px 22px;
  overflow-y: auto;
  max-height: calc(85vh - 180px);
}

.guide-sections {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.guide-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-title h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
}

.section-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 2px 7px;
  border-radius: 6px;
  background: #e0f2fe;
  color: #0369a1;
}

.section-badge.camera {
  background: #fef3c7;
  color: #b45309;
}

.section-badge.touch {
  background: #f3e8ff;
  color: #7e22ce;
}

.shortcuts-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.shortcut-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 9px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.action-desc {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-desc strong {
  font-size: 12.5px;
  color: #1e293b;
}

.action-desc span {
  font-size: 11px;
  color: #64748b;
  line-height: 1.3;
}

.keys-container {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.key-chip {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
  border-radius: 6px;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  color: #334155;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.touch-cards-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.touch-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.gesture-icon-badge {
  font-size: 22px;
  background: #ffffff;
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid #e2e8f0;
  flex-shrink: 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.touch-card-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.touch-card-info strong {
  font-size: 13px;
  color: #0f172a;
}

.touch-card-info span {
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.help-popup-footer {
  padding: 14px 22px;
  border-top: 1px solid #f1f5f9;
  background: #fafbfc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.footer-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}

.tip-sparkle {
  font-size: 15px;
}

.inline-key {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-bottom: 2px solid #94a3b8;
  border-radius: 4px;
  padding: 1px 5px;
  font-weight: 700;
  font-size: 10.5px;
  color: #1e293b;
}

.footer-done-btn {
  background: #0284c7;
  color: white;
  border: none;
  border-radius: 10px;
  padding: 7px 18px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
}

.footer-done-btn:hover {
  background: #0369a1;
  transform: translateY(-1px);
}

@keyframes fadeInBackdrop {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleInCard {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

/* RESPONSIVE DESIGN */
@media (max-width: 768px) {
  .common-toolbar-3d-wrapper {
    top: 64px;
    left: 10px;
    max-width: calc(100vw - 20px);
  }

  .common-toolbar-vertical-strip {
    padding: 3px 2px;
    gap: 2px;
    border-radius: 14px;
    width: 28px;
    max-height: calc(100vh - 140px);
    overflow-y: auto;
    scrollbar-width: none;
    touch-action: manipulation;
  }

  .common-toolbar-vertical-strip::-webkit-scrollbar {
    display: none;
  }

  .tool-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
  }

  .tool-icon {
    width: 13px;
    height: 13px;
  }

  .shortcuts-grid {
    grid-template-columns: 1fr;
  }

  .help-popup-card {
    max-height: 90vh;
  }
}

@media (max-width: 480px) {
  .common-toolbar-3d-wrapper {
    top: 60px;
    left: 8px;
  }

  .tool-btn {
    width: 24px;
    height: 24px;
    padding: 0;
    border-radius: 50%;
  }

  .tool-icon {
    width: 13px;
    height: 13px;
  }

  .device-tab span {
    font-size: 12px;
  }
}
</style>
