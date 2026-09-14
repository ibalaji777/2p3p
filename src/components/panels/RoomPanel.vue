<template>
    <div class="props-panel-inner">
        <h4 class="props-subtitle">Floor Properties</h4>
        <MaterialSizeInput 
            v-model="selectedEntity.materialScale" 
            :fallbackValue="floorRegistry[selectedEntity.configId]?.tileSize || DEFAULT_UNIVERSAL_TILE_SIZE"
            @change="$emit('sync-engine', 'material')" 
            @update:modelValue="$emit('sync-engine', 'material')"
        />

        <!-- Sims 4 Room Elevation Lift & Wall Height -->
        <div class="control-group" style="margin-top: 12px; flex-direction: column; gap: 8px;">
            <h4 class="props-subtitle" style="margin-bottom: 2px;">Sims 4 Room Elevation & Height</h4>
            
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <label style="font-size: 11px; color: #94a3b8; font-weight: 600;">Room Elevation</label>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <button class="btn-secondary" style="padding: 3px 8px; font-weight: 800;" @click="stepElevation(-15)">▼ -15</button>
                    <span style="font-weight: 700; font-size: 12px; min-width: 50px; text-align: center; color: #10b981;">
                        +{{ Number(selectedEntity.elevation) || 0 }} cm
                    </span>
                    <button class="btn-secondary" style="padding: 3px 8px; font-weight: 800;" @click="stepElevation(15)">▲ +15</button>
                </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
                <label style="font-size: 11px; color: #94a3b8; font-weight: 600;">Room Wall Height</label>
                <div style="display: flex; gap: 4px; width: 100%;">
                    <button class="btn-secondary" style="flex: 1; padding: 5px 2px; font-size: 10px; font-weight: 700;" @click="setWallHeight(240)">Short (240)</button>
                    <button class="btn-secondary" style="flex: 1; padding: 5px 2px; font-size: 10px; font-weight: 700;" @click="setWallHeight(300)">Med (300)</button>
                    <button class="btn-secondary" style="flex: 1; padding: 5px 2px; font-size: 10px; font-weight: 700;" @click="setWallHeight(360)">Tall (360)</button>
                </div>
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
</template>

<script setup>
import { computed } from 'vue';
import { useSettingsStore } from '../../stores/useSettingsStore.js';
import { UnitConverter } from '../../core/units/UnitConverter.js';
import { DEFAULT_UNIVERSAL_TILE_SIZE } from '../../core/registries/material.registry.js';
import MaterialSizeInput from '../common/MaterialSizeInput.vue';

const props = defineProps({
    selectedEntity: { type: Object, required: true },
    floorRegistry: { type: Object, required: true }
});

const emit = defineEmits([
    'sync-engine',
    'set-floor-material',
    'delete-entity'
]);

const settingsStore = useSettingsStore();

import { WallEngine } from '../../core/wall/WallEngine.js';
import { WallHeightPolicy } from '../../core/wall/WallHeightPolicy.js';
import { SnapshotCommand } from '../../core/commands/SnapshotCommand.js';
import { getRoomWallsAndSides } from '../../core/engine3d/WallPaintSystem.js';

const resolvePlanner = () => {
    return window.plannerInstance || window.planner?.value || window.planner;
};

const getBoundingWalls = (room, planner) => {
    if (!room) return [];
    if (Array.isArray(room.walls) && room.walls.length > 0) return room.walls;
    let walls = getRoomWallsAndSides(room, planner)?.map(r => r.wall) || [];
    if (walls.length === 0 && planner?.walls) {
        const nonRailing = planner.walls.filter(w => !w.hidden && w.type !== 'railing');
        if (room.path && room.path.length >= 3) {
            walls = nonRailing.filter(w => {
                const s = typeof w.startAnchor?.position === 'function' ? w.startAnchor.position() : (w.startAnchor || { x: w.startX, y: w.startY });
                const e = typeof w.endAnchor?.position === 'function' ? w.endAnchor.position() : (w.endAnchor || { x: w.endX, y: w.endY });
                if (!s || !e) return false;
                const midX = (s.x + e.x) / 2, midY = (s.y + e.y) / 2;
                return Math.hypot(midX - room.cx, midY - room.cy) < 2000;
            });
        }
        if (walls.length === 0) walls = nonRailing;
    }
    return walls;
};

const stepElevation = (delta) => {
    const curElev = Number(props.selectedEntity.elevation) || 0;
    const newElev = Math.max(0, Math.min(600, curElev + delta));
    props.selectedEntity.elevation = newElev;
    if (props.selectedEntity.mesh3D) props.selectedEntity.mesh3D.position.y = newElev + 0.05;

    const planner = resolvePlanner();
    if (planner) {
        const cmd = planner.commandManager ? new SnapshotCommand(planner) : null;
        const boundingWalls = getBoundingWalls(props.selectedEntity, planner);
        if (boundingWalls.length > 0) {
            WallEngine.batchUpdate(planner, boundingWalls, { elevation: newElev });
        }
        if (planner.detectRooms) planner.detectRooms();
        if (cmd) planner.commandManager.execute(cmd);
    }
    emit('sync-engine', 'elevation');
};

const setWallHeight = (height) => {
    const validH = WallHeightPolicy.processInputHeight(height);
    props.selectedEntity.wallHeight = validH;
    const planner = resolvePlanner();
    if (planner) {
        const cmd = planner.commandManager ? new SnapshotCommand(planner) : null;
        const boundingWalls = getBoundingWalls(props.selectedEntity, planner);
        if (boundingWalls.length > 0) {
            WallEngine.batchUpdate(planner, boundingWalls, { height: validH });
        }
        if (cmd) planner.commandManager.execute(cmd);
    }
    emit('sync-engine', 'height');
};
</script>
