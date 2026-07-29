import { defineStore } from 'pinia';

export const useSettingsStore = defineStore('settings', {
    state: () => ({
        floorPlanSettings: {
            mainEntranceFacing: 'north',
            measurementUnit: 'feet_inches',
            areaUnit: 'sqft',
            materialUnit: 'cm',
            showCompass: true,
            showGrid: true,
            showDimensionLabels: true,
            showDiagonalDimensions: true,
            diagonalMeasurementMode: 'inner',
            showWorkspaceLabels: true,
            wallTracking: true,
            entranceWallId: null
        },
        selectedSky: 'venice_sunset',
        selectedGround: 'grass',
        isWallTrackingEnabled: false
    }),
    actions: {
        updateSetting(key, value) {
            this.floorPlanSettings[key] = value;
        },
        toggleWallTracking() {
            this.isWallTrackingEnabled = !this.isWallTrackingEnabled;
            this.floorPlanSettings.wallTracking = this.isWallTrackingEnabled;
        }
    }
});
