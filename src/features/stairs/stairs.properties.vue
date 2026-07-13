<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle" v-if="selectedEntity.type && selectedEntity.type.startsWith('stair_v5_')">Staircase (V5) Properties</h4>
        <h4 class="props-subtitle" v-else>Staircase (Legacy) Properties</h4>
        
        <template v-if="selectedEntity.type && selectedEntity.type.startsWith('stair_v5_')">
            <!-- Appearance (Advanced Materials) -->
            <div style="background: #f1f5f9; padding: 12px; border-radius: 8px; margin-bottom: 15px; border: 1px solid #cbd5e1;">
                <h4 class="props-subtitle" style="margin-top: 0;">Appearance</h4>
                <label style="display: flex; align-items: center; gap: 8px; font-weight: 500; font-size: 13px; margin-bottom: 12px;">
                    <input type="checkbox" v-model="selectedEntity.useUnifiedMaterial" @change="$emit('sync-engine')">
                    Use One Material for Entire Stair
                </label>

                <div v-if="selectedEntity.useUnifiedMaterial">
                    <div class="control-group">
                        <label>Primary Material</label>
                        <select v-model="selectedEntity.primaryMaterial" @change="$emit('sync-engine')" class="settings-select">
                            <option value="wood_oak">Oak Wood</option>
                            <option value="wood_walnut">Walnut Wood</option>
                            <option value="wood_natural">Natural Wood</option>
                            <option value="wood_dark">Dark Wood</option>
                            <option value="concrete">Concrete</option>
                            <option value="marble">White Marble</option>
                            <option value="granite">Dark Granite</option>
                            <option value="steel">Black Steel</option>
                            <option value="stainless_steel">Stainless Steel</option>
                            <option value="white_painted">White Painted</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Primary Color</label>
                        <div class="input-wrap" style="justify-content: flex-end;">
                            <input type="color" v-model="selectedEntity.primaryColor" @change="$emit('sync-engine')">
                        </div>
                    </div>
                </div>
                <div v-else>
                    <details style="margin-bottom: 8px; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                        <summary style="font-weight: 500; font-size: 12px; cursor: pointer; outline: none;">Steps (Treads)</summary>
                        <div style="margin-top: 10px;">
                            <div class="control-group">
                                <label>Material</label>
                                <select v-model="selectedEntity.treadMaterial" @change="$emit('sync-engine')" class="settings-select">
                                    <option value="default">Use Primary Material</option>
                                    <option value="wood_oak">Oak Wood</option>
                                    <option value="wood_walnut">Walnut Wood</option>
                                    <option value="concrete">Concrete</option>
                                    <option value="marble">Marble</option>
                                    <option value="granite">Granite</option>
                                    <option value="glass">Glass</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Color Override</label>
                                <div class="input-wrap" style="justify-content: flex-end;">
                                    <input type="color" v-model="selectedEntity.treadColor" @change="$emit('sync-engine')">
                                </div>
                            </div>
                        </div>
                    </details>

                    <details style="margin-bottom: 8px; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                        <summary style="font-weight: 500; font-size: 12px; cursor: pointer; outline: none;">Risers</summary>
                        <div style="margin-top: 10px;">
                            <div class="control-group">
                                <label>Material</label>
                                <select v-model="selectedEntity.riserMaterial" @change="$emit('sync-engine')" class="settings-select">
                                    <option value="default">Use Primary Material</option>
                                    <option value="white_painted">White Painted</option>
                                    <option value="wood_oak">Oak Wood</option>
                                    <option value="concrete">Concrete</option>
                                    <option value="marble">Marble</option>
                                    <option value="none">Open Risers (No Board)</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Color Override</label>
                                <div class="input-wrap" style="justify-content: flex-end;">
                                    <input type="color" v-model="selectedEntity.riserColor" @change="$emit('sync-engine')">
                                </div>
                            </div>
                        </div>
                    </details>

                    <details style="margin-bottom: 8px; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                        <summary style="font-weight: 500; font-size: 12px; cursor: pointer; outline: none;">Landings</summary>
                        <div style="margin-top: 10px;">
                            <div class="control-group">
                                <label>Material</label>
                                <select v-model="selectedEntity.landingMaterial" @change="$emit('sync-engine')" class="settings-select">
                                    <option value="default">Use Tread Material</option>
                                    <option value="wood_oak">Oak Wood</option>
                                    <option value="concrete">Concrete</option>
                                    <option value="marble">Marble</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Color Override</label>
                                <div class="input-wrap" style="justify-content: flex-end;">
                                    <input type="color" v-model="selectedEntity.landingColor" @change="$emit('sync-engine')">
                                </div>
                            </div>
                        </div>
                    </details>

                    <details style="margin-bottom: 8px; background: white; padding: 6px 10px; border-radius: 4px; border: 1px solid #e2e8f0;">
                        <summary style="font-weight: 500; font-size: 12px; cursor: pointer; outline: none;">Structure (Stringers)</summary>
                        <div style="margin-top: 10px;">
                            <div class="control-group">
                                <label>Material</label>
                                <select v-model="selectedEntity.structureMaterial" @change="$emit('sync-engine')" class="settings-select">
                                    <option value="default">Use Primary Material</option>
                                    <option value="steel">Black Steel</option>
                                    <option value="stainless_steel">Stainless Steel</option>
                                    <option value="white_painted">White Painted</option>
                                    <option value="wood_oak">Oak Wood</option>
                                    <option value="concrete">Concrete</option>
                                </select>
                            </div>
                            <div class="control-group">
                                <label>Color Override</label>
                                <div class="input-wrap" style="justify-content: flex-end;">
                                    <input type="color" v-model="selectedEntity.structureColor" @change="$emit('sync-engine')">
                                </div>
                            </div>
                        </div>
                    </details>
                </div>
            </div>

            <!-- Standard Geometry -->
            <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="40" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Step Depth</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stepDepth" min="15" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stepDepth" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Step Height</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stepHeight" min="10" max="30" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stepHeight" @change="$emit('sync-engine')" /></div></div>
            
            <div class="control-group" v-if="selectedEntity.shape === 'straight'">
                <label>Total Steps</label><div class="input-wrap"><input type="number" v-model.number="selectedEntity.totalSteps" min="2" max="50" @input="$emit('sync-engine')"></div>
            </div>
            <template v-else>
                <div class="control-group"><label>Flight 1 Steps</label><div class="input-wrap"><input type="number" v-model.number="selectedEntity.flight1Steps" min="1" max="40" @input="$emit('sync-engine')"></div></div>
                <div class="control-group"><label>Flight 2 Steps</label><div class="input-wrap"><input type="number" v-model.number="selectedEntity.flight2Steps" min="1" max="40" @input="$emit('sync-engine')"></div></div>
                <div class="control-group" v-if="selectedEntity.shape !== 'T'">
                    <label>Turn Direction</label>
                    <select v-model="selectedEntity.turnDirection" @change="$emit('sync-engine')" class="settings-select">
                        <option value="right">Right</option>
                        <option value="left">Left</option>
                    </select>
                </div>
                <div class="control-group"><label>Landing Size</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.landingSize" min="50" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.landingSize" @change="$emit('sync-engine')" /></div></div>
            </template>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

            <!-- End Landings -->
            <h4 class="props-subtitle">End Landings</h4>
            <div class="control-group"><label>Bottom Landing</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hasBottomLanding" @change="$emit('sync-engine')"></div></div>
            <div class="control-group"><label>Top Landing</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.hasTopLanding" @change="$emit('sync-engine')"></div></div>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">

            <!-- Structural Controls -->
            <h4 class="props-subtitle">Structural Controls</h4>
            <div class="control-group">
                <label>Stringer Type</label>
                <select v-model="selectedEntity.stringerType" @change="$emit('sync-engine')" class="settings-select">
                    <option value="solid">Solid Block</option>
                    <option value="mono">Mono Stringer</option>
                    <option value="double">Double Stringer</option>
                    <option value="side">Side Stringer</option>
                    <option value="box">Box Stringer</option>
                </select>
            </div>
            <template v-if="selectedEntity.stringerType !== 'solid'">
                <div class="control-group"><label>Stringer Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stringerWidth" min="2" max="50" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stringerWidth" @change="$emit('sync-engine')" /></div></div>
                <div class="control-group"><label>Stringer Thickness</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.stringerThickness" min="5" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.stringerThickness" @change="$emit('sync-engine')" /></div></div>
                <div class="control-group" v-if="selectedEntity.stringerType === 'double'"><label>Beam Offset</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.beamOffset" min="0" max="100" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.beamOffset" @change="$emit('sync-engine')" /></div></div>
                <div class="control-group"><label>Landing Supports</label><div class="input-wrap" style="justify-content: flex-end;"><input type="checkbox" v-model="selectedEntity.landingSupports" @change="$emit('sync-engine')"></div></div>
            </template>

            <!-- Railings -->
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 15px 0;">
            <h4 class="props-subtitle">Railing Settings</h4>
            
            <div class="control-group">
                <label>Railing Layout</label>
                <select v-model="selectedEntity.railingLayout" @change="$emit('sync-engine')" class="settings-select">
                    <option value="none">None</option>
                    <option value="left">Left Side</option>
                    <option value="right">Right Side</option>
                    <option value="both">Both Sides</option>
                </select>
            </div>

            <div class="control-group" v-if="selectedEntity.railingLayout === 'both'">
                <label>Link Left & Right Railings</label>
                <div class="input-wrap" style="justify-content: flex-end;">
                    <input type="checkbox" v-model="selectedEntity.linkRailings" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing = JSON.parse(JSON.stringify(selectedEntity.leftRailing)); } $emit('sync-engine')">
                </div>
            </div>

            <template v-if="selectedEntity.railingLayout !== 'none'">
                <div v-for="side in (selectedEntity.railingLayout === 'both' ? (selectedEntity.linkRailings ? ['left'] : ['left', 'right']) : [selectedEntity.railingLayout])" :key="side" style="background: #f9fafb; padding: 10px; border-radius: 6px; margin-bottom: 10px; border: 1px solid #e5e7eb;">
                    <h5 style="margin: 0 0 10px 0; font-size: 13px; color: #1e3a8a;">
                        {{ selectedEntity.linkRailings && selectedEntity.railingLayout === 'both' ? 'Shared Railing Properties' : (side === 'left' ? 'Left Railing' : 'Right Railing') }}
                    </h5>
                    
                    <div class="control-group">
                        <label>Railing Type</label>
                        <select :value="selectedEntity[side + 'Railing'].useGlassPanels ? 'glass' : (selectedEntity[side + 'Railing'].useCableRails ? 'cable' : 'baluster')" @change="e => { 
                            const v = e.target.value; 
                            selectedEntity[side + 'Railing'].useGlassPanels = (v === 'glass');
                            selectedEntity[side + 'Railing'].useCableRails = (v === 'cable');
                            if(selectedEntity.linkRailings) { selectedEntity.rightRailing = JSON.parse(JSON.stringify(selectedEntity.leftRailing)); }
                            $emit('sync-engine'); 
                        }" class="settings-select">
                            <option value="baluster">Balusters (Spindles)</option>
                            <option value="glass">Glass Panels</option>
                            <option value="cable">Cable Railings</option>
                        </select>
                    </div>

                    <div class="control-group">
                        <label>Height</label>
                        <div class="input-wrap">
                            <DimensionInput v-model="selectedEntity[side + 'Railing'].height" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.height = selectedEntity.leftRailing.height; } $emit('sync-engine')" />
                        </div>
                    </div>

                    <div class="control-group">
                        <label>Offset from Edge</label>
                        <div class="input-wrap">
                            <DimensionInput v-model="selectedEntity[side + 'Railing'].offset" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.offset = selectedEntity.leftRailing.offset; } $emit('sync-engine')" />
                        </div>
                    </div>
                    
                    <!-- Handrail Settings -->
                    <div class="control-group">
                        <label>Handrail Profile</label>
                        <select v-model="selectedEntity[side + 'Railing'].handrailProfile" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.handrailProfile = selectedEntity.leftRailing.handrailProfile; } $emit('sync-engine')" class="settings-select">
                            <option value="rectangular">Rectangular</option>
                            <option value="round">Round</option>
                        </select>
                    </div>
                    <div class="control-group">
                        <label>Handrail Material</label>
                        <select v-model="selectedEntity[side + 'Railing'].handrailMaterial" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.handrailMaterial = selectedEntity.leftRailing.handrailMaterial; } $emit('sync-engine')" class="settings-select">
                            <option value="default">Use Stair Material</option>
                            <option value="wood">Wood</option>
                            <option value="steel">Steel</option>
                            <option value="aluminum">Aluminum</option>
                            <option value="black_metal">Black Metal</option>
                        </select>
                    </div>

                    <!-- Context Sensitive Settings -->
                    <template v-if="!selectedEntity[side + 'Railing'].useGlassPanels && !selectedEntity[side + 'Railing'].useCableRails">
                        <!-- Balusters -->
                        <div class="control-group">
                            <label>Baluster Shape</label>
                            <select v-model="selectedEntity[side + 'Railing'].balusterShape" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.balusterShape = selectedEntity.leftRailing.balusterShape; } $emit('sync-engine')" class="settings-select">
                                <option value="square">Square</option>
                                <option value="round">Round</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label>Baluster Spacing</label>
                            <div class="input-wrap">
                                <DimensionInput v-model="selectedEntity[side + 'Railing'].balusterSpacing" min="5" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.balusterSpacing = selectedEntity.leftRailing.balusterSpacing; } $emit('sync-engine')" />
                            </div>
                        </div>
                        <div class="control-group">
                            <label>Baluster Material</label>
                            <select v-model="selectedEntity[side + 'Railing'].balusterMaterial" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.balusterMaterial = selectedEntity.leftRailing.balusterMaterial; } $emit('sync-engine')" class="settings-select">
                                <option value="default">Use Stair Material</option>
                                <option value="steel">Steel</option>
                                <option value="wood">Wood</option>
                                <option value="aluminum">Aluminum</option>
                                <option value="black_metal">Black Metal</option>
                            </select>
                        </div>
                    </template>
                    
                    <template v-if="selectedEntity[side + 'Railing'].useGlassPanels">
                        <!-- Glass Panels -->
                        <div class="control-group">
                            <label>Glass Material</label>
                            <select v-model="selectedEntity[side + 'Railing'].panelMaterial" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.panelMaterial = selectedEntity.leftRailing.panelMaterial; } $emit('sync-engine')" class="settings-select">
                                <option value="glass_clear">Clear Glass</option>
                                <option value="glass_frosted">Frosted Glass</option>
                                <option value="glass_tinted">Tinted Glass</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label>Glass Thickness</label>
                            <div class="input-wrap">
                                <DimensionInput v-model="selectedEntity[side + 'Railing'].glassThickness" min="0.5" step="0.5" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.glassThickness = selectedEntity.leftRailing.glassThickness; } $emit('sync-engine')" />
                            </div>
                        </div>
                    </template>

                    <template v-if="selectedEntity[side + 'Railing'].useCableRails">
                        <!-- Cable Rails -->
                        <div class="control-group">
                            <label>Cable Material</label>
                            <select v-model="selectedEntity[side + 'Railing'].cableMaterial" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.cableMaterial = selectedEntity.leftRailing.cableMaterial; } $emit('sync-engine')" class="settings-select">
                                <option value="stainless_steel">Stainless Steel</option>
                                <option value="black_steel">Black Steel</option>
                                <option value="aluminum">Aluminum</option>
                            </select>
                        </div>
                        <div class="control-group">
                            <label>Number of Cables</label>
                            <div class="input-wrap">
                                <input type="number" v-model.number="selectedEntity[side + 'Railing'].cableCount" min="1" max="15" @input="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.cableCount = selectedEntity.leftRailing.cableCount; } $emit('sync-engine')">
                            </div>
                        </div>
                    </template>
                    
                    <!-- Posts Toggles -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 5px; margin-top: 10px;">
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].hasNewelPosts" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.hasNewelPosts = selectedEntity.leftRailing.hasNewelPosts; } $emit('sync-engine')"> Newel Posts</label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].hasCornerPosts" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.hasCornerPosts = selectedEntity.leftRailing.hasCornerPosts; } $emit('sync-engine')"> Corner Posts</label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].hasEndCaps" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.hasEndCaps = selectedEntity.leftRailing.hasEndCaps; } $emit('sync-engine')"> End Caps</label>
                        <label style="display: flex; align-items: center; gap: 5px; font-size: 11px;"><input type="checkbox" v-model="selectedEntity[side + 'Railing'].wallMountedHandrail" @change="if(selectedEntity.linkRailings) { selectedEntity.rightRailing.wallMountedHandrail = selectedEntity.leftRailing.wallMountedHandrail; } $emit('sync-engine')"> Wall Handrail</label>
                    </div>
                </div>
            </template>
        </template>
        <template v-else>
            <div class="control-group"><label>Width</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.width" min="20" max="300" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.width" @change="$emit('sync-engine')" /></div></div>
            <div class="control-group"><label>Length</label><div class="input-wrap"><input type="range" v-model.number="selectedEntity.length" min="20" max="1000" @input="$emit('sync-engine')"><DimensionInput v-model="selectedEntity.length" @change="$emit('sync-engine')" /></div></div>
        </template>

        <button class="hud-delete" style="margin-top: 15px;" @click="$emit('delete-entity')">Delete Staircase</button>
    </div>
</template>

<script setup>
import { defineProps, defineEmits, ref } from 'vue';
import DimensionInput from '../../components/common/DimensionInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'delete-entity'
]);
</script>
