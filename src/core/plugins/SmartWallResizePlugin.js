export const SmartWallResizePlugin = {
    id: 'smart_wall_resize',
    name: 'Smart Wall Resize',
    description: 'Intelligently redesign and resize the house plan. Edit any of the 4 sides independently to reshape the building.',
    
    getFields: (context) => {
        const planner = context.planner?.value;
        const floorPlanSettings = context.floorPlanSettings?.value;
        
        let wallTrackingDefault = true;
        if (floorPlanSettings && floorPlanSettings.wallTracking !== undefined) {
            wallTrackingDefault = floorPlanSettings.wallTracking;
        }

        let currentWidthFt = 40.0;
        let currentDepthFt = 25.0;

        if (planner && planner.anchors && planner.anchors.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            planner.anchors.forEach(a => {
                minX = Math.min(minX, a.x);
                maxX = Math.max(maxX, a.x);
                minY = Math.min(minY, a.y);
                maxY = Math.max(maxY, a.y);
            });
            
            const pxToFt = 1 / 20; // 20 pixels = 1 foot
            const calcW = ((maxX - minX) * pxToFt);
            const calcD = ((maxY - minY) * pxToFt);

            if (calcW > 0 && calcD > 0) {
                currentWidthFt = parseFloat(calcW.toFixed(1));
                currentDepthFt = parseFloat(calcD.toFixed(1));
            }
        }
        
        const currentSqFt = Math.round(currentWidthFt * currentDepthFt);

        return [
            {
                name: '_visual',
                label: '',
                type: 'visual_boundary',
                defaultValue: { targetN: currentWidthFt, targetS: currentWidthFt, targetE: currentDepthFt, targetW: currentDepthFt, targetSqft: currentSqFt }
            },
            {
                name: 'enableWallTracking',
                label: 'Wall Tracking',
                type: 'checkbox',
                defaultValue: wallTrackingDefault
            }
        ];
    },

    validate: async (config, context) => {
        const n = parseFloat(config.targetN);
        const s = parseFloat(config.targetS);
        const e = parseFloat(config.targetE);
        const w = parseFloat(config.targetW);
        if (!n || !s || !e || !w || n <= 0 || s <= 0 || e <= 0 || w <= 0) {
            return { success: false, error: 'All 4 measurements are required and must be positive numbers.' };
        }
        return { success: true };
    },

    execute: async (config, context) => {
        const { planner, syncSettings, floorPlanSettings } = context;
        if (!planner.value || planner.value.anchors.length === 0) return { success: true };

        const targetN = parseFloat(config.targetN) * 20; // ft to px
        const targetS = parseFloat(config.targetS) * 20;
        const targetE = parseFloat(config.targetE) * 20;
        const targetW = parseFloat(config.targetW) * 20;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        planner.value.anchors.forEach(a => {
            minX = Math.min(minX, a.x);
            maxX = Math.max(maxX, a.x);
            minY = Math.min(minY, a.y);
            maxY = Math.max(maxY, a.y);
        });

        const currentW_px = maxX - minX;
        const currentD_px = maxY - minY;

        if (currentW_px === 0 || currentD_px === 0) return { success: true };

        const cx = minX + currentW_px / 2;
        const cy = minY + currentD_px / 2;

        const TL = { x: cx - targetN / 2, y: cy - targetW / 2 };
        const TR = { x: cx + targetN / 2, y: cy - targetE / 2 };
        const BL = { x: cx - targetS / 2, y: cy + targetW / 2 };
        const BR = { x: cx + targetS / 2, y: cy + targetE / 2 };

        const transformPoint = (x, y) => {
            const u = (x - minX) / currentW_px;
            const v = (y - minY) / currentD_px;

            const topX = TL.x + u * (TR.x - TL.x);
            const topY = TL.y + u * (TR.y - TL.y);
            const botX = BL.x + u * (BR.x - BL.x);
            const botY = BL.y + u * (BR.y - BL.y);

            const nx = topX + v * (botX - topX);
            const ny = topY + v * (botY - topY);

            return { x: nx, y: ny };
        };

        const transformGroup = (group, isShape = false) => {
            if (!group) return;
            const pos = group.position();
            const newPos = transformPoint(pos.x, pos.y);
            group.position(newPos);

            if (isShape) {
                const uScale = ( (1 - (pos.y - minY)/currentD_px) * targetN + ((pos.y - minY)/currentD_px) * targetS ) / currentW_px;
                const vScale = ( (1 - (pos.x - minX)/currentW_px) * targetW + ((pos.x - minX)/currentW_px) * targetE ) / currentD_px;
                group.scaleX(group.scaleX() * uScale);
                group.scaleY(group.scaleY() * vScale);
            }
        };

        planner.value.anchors.forEach(a => {
            const np = transformPoint(a.x, a.y);
            if (a.node && typeof a.node.position === 'function') {
                a.node.position(np);
            } else {
                a.x = np.x;
                a.y = np.y;
            }
        });

        if (planner.value.arcs) {
            planner.value.arcs.forEach(arc => {
                arc.pos = transformPoint(arc.pos.x, arc.pos.y);
                if (arc.controlHandle) arc.controlHandle.position(arc.pos);
            });
        }

        planner.value.furniture.forEach(f => {
            transformGroup(f.group);
        });

        if (planner.value.shapes) {
            planner.value.shapes.forEach(s => {
                transformGroup(s.group, true);
            });
        }

        if (planner.value.roofs) {
            planner.value.roofs.forEach(r => {
                if (r.points) {
                    r.points.forEach(p => {
                        const np = transformPoint(p.x, p.y);
                        p.x = np.x;
                        p.y = np.y;
                    });
                }
            });
        }

        if (planner.value.stairs) {
            planner.value.stairs.forEach(s => {
                if (s.type === 'staircase_two') {
                    transformGroup(s.group);
                } else if (s.path) {
                    s.path.forEach(p => {
                        const np = transformPoint(p.x, p.y);
                        p.x = np.x;
                        p.y = np.y;
                    });
                    s.initHandles && s.initHandles();
                }
            });
        }

        planner.value.walls.forEach(w => {
            if (w.poly) {
                w.update(); 
            }
        });

        if (planner.value.arcs) {
            planner.value.arcs.forEach(a => a.rebuild());
        }

        if (config.enableWallTracking !== undefined) {
            if (floorPlanSettings) {
                floorPlanSettings.value.wallTracking = config.enableWallTracking;
            }
            planner.value.setWallTracking(config.enableWallTracking);
        }

        planner.value.syncAll();
        if (syncSettings) syncSettings();
        
        if (context.refresh3DScene) context.refresh3DScene(true);

        return { success: true };
    }
};