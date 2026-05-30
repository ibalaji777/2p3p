export const SmartFacingPlugin = {
    id: 'smart_facing',
    name: 'Smart Facing Wizard',
    description: 'Change the house entrance facing direction without redesigning the building. Rotates the entire structure automatically.',
    
    getFields: (context) => [
        {
            name: 'currentFacing',
            label: 'Current Entrance Facing',
            type: 'select',
            options: [
                { value: 'north', label: 'North' },
                { value: 'south', label: 'South' },
                { value: 'east', label: 'East' },
                { value: 'west', label: 'West' }
            ],
            defaultValue: context.floorPlanSettings?.value?.mainEntranceFacing || 'north'
        },
        {
            name: 'targetFacing',
            label: 'Target Entrance Facing',
            type: 'select',
            options: [
                { value: 'north', label: 'North' },
                { value: 'south', label: 'South' },
                { value: 'east', label: 'East' },
                { value: 'west', label: 'West' }
            ],
            defaultValue: 'north'
        }
    ],

    validate: async (config, context) => {
        if (!config.currentFacing || !config.targetFacing) {
            return { success: false, error: 'Missing required facing parameters.' };
        }
        if (config.currentFacing === config.targetFacing) {
            return { success: false, error: 'Target facing is the same as current facing.' };
        }
        return { success: true };
    },

    execute: async (config, context) => {
        const { currentFacing, targetFacing } = config;
        const { planner, syncSettings, floorPlanSettings } = context;

        const angles = { 'north': 0, 'east': 90, 'south': 180, 'west': 270 };
        const currentAngle = angles[currentFacing] || 0;
        const targetAngle = angles[targetFacing] || 0;
        
        let rotationDiff = targetAngle - currentAngle;
        rotationDiff = rotationDiff % 360;
        if (rotationDiff < 0) rotationDiff += 360;
        
        if (rotationDiff === 0) {
            floorPlanSettings.value.mainEntranceFacing = targetFacing;
            if (syncSettings) syncSettings();
            return { success: true };
        }

        if (floorPlanSettings.value.houseRotation === undefined) {
            floorPlanSettings.value.houseRotation = 0;
        }

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        if (planner.value && planner.value.walls.length > 0) {
            planner.value.walls.forEach(w => {
                minX = Math.min(minX, w.startAnchor.x, w.endAnchor.x);
                maxX = Math.max(maxX, w.startAnchor.x, w.endAnchor.x);
                minY = Math.min(minY, w.startAnchor.y, w.endAnchor.y);
                maxY = Math.max(maxY, w.startAnchor.y, w.endAnchor.y);
            });
        }
        
        let cx = 0;
        let cy = 0;
        if (minX !== Infinity) {
            cx = minX + (maxX - minX) / 2;
            cy = minY + (maxY - minY) / 2;
        }

        // Set pivot if we don't have one, or if rotation was 0
        if (floorPlanSettings.value.houseRotation === 0) {
            floorPlanSettings.value.housePivotX = cx;
            floorPlanSettings.value.housePivotY = cy;
        }

        floorPlanSettings.value.houseRotation = (floorPlanSettings.value.houseRotation + rotationDiff) % 360;
        floorPlanSettings.value.mainEntranceFacing = targetFacing;
        
        if (syncSettings) syncSettings();
        if (context.refresh3DScene) context.refresh3DScene(true);

        return { success: true };
    }
};
