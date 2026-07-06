import { PremiumWall } from './PremiumWall.js';
import { Anchor } from './Anchor.js';
import { PremiumHipRoof } from './PremiumHipRoof.js';
import { PresetGroup } from './PresetGroup.js';

// --- Math Helpers ---

function pointInPolygon(point, vs) {
    let x = point.x, y = point.y;
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i].x, yi = vs[i].y;
        let xj = vs[j].x, yj = vs[j].y;
        let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

function getClosestPointOnSegment(p, p1, p2) {
    const l2 = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
    if (l2 === 0) return p1;
    let t = ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    return { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
}

function getClosestEdgeAndDistance(point, polygon) {
    let minDist = Infinity;
    let closestEdge = null;
    let closestP1 = null, closestP2 = null;

    for (let i = 0; i < polygon.length; i++) {
        let p1 = polygon[i];
        let p2 = polygon[(i + 1) % polygon.length];
        let proj = getClosestPointOnSegment(point, p1, p2);
        let dist = Math.hypot(point.x - proj.x, point.y - proj.y);
        
        if (dist < minDist) {
            minDist = dist;
            closestEdge = proj;
            closestP1 = p1;
            closestP2 = p2;
        }
    }
    return { dist: minDist, p1: closestP1, p2: closestP2 };
}

export function autoAlign(planner, point, defaultElevation = 0, depth = 0) {
    let result = { elevation: defaultElevation, rotation: 0, isOnRoof: false, roofPitch: 0 };
    
    // Find if we are inside any roof
    for (let roof of planner.roofs) {
        if (!roof.points || roof.points.length < 3 || roof.parentGroup) continue;
        if (pointInPolygon(point, roof.points)) {
            // Found parent roof!
            result.isOnRoof = true;
            result.roofPitch = roof.config.pitch || 30;
            
            // Get base elevation of the house (only main walls, not preset/dormer walls)
            let baseElev = 0;
            if (planner.walls && planner.walls.length > 0) {
                const mainWalls = planner.walls.filter(w => !w.parentGroup);
                if (mainWalls.length > 0) {
                    baseElev = Math.max(...mainWalls.map(w => w.height || 0));
                } else {
                    baseElev = 280; // fallback
                }
            } else {
                baseElev = 280; // default wall height fallback
            }

            // Find closest edge to determine slope direction and distance
            const { dist, p1, p2 } = getClosestEdgeAndDistance(point, roof.points);
            
            // Calculate height at the FRONT of the dormer (closest to edge) so it doesn't float
            // pitch is in degrees, we need tan(pitch) * distance. Distance to front is dist - depth/2
            const addedHeight = Math.max(0, dist - depth / 2) * Math.tan(result.roofPitch * Math.PI / 180);
            result.elevation = baseElev;
            result.addedHeight = addedHeight;
            
            // Calculate rotation facing outward from the edge
            // Edge direction: p1 -> p2
            const edgeAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            // Normal facing outward (since polygons are usually clockwise, outward is -90 deg)
            // Konva rotation is clockwise.
            // Let's set rotation so local +Y faces the edge (downward slope)
            result.rotation = (edgeAngle + Math.PI / 2) * 180 / Math.PI;
            break;
        }
    }
    return result;
}

// --- Generator ---

function createRectangularStructure(planner, origin, w, d, wallHeight, roofType, pitch, elevation = 0, rotationDeg = 0, parentGroup = null) {
    const hw = w / 2;
    const hd = d / 2;
    // Define local points counter-clockwise so Three.js ShapeGeometry reliably triangulates it
    let localPts = [
        { x: -hw, y: -hd }, // Top-Left
        { x: -hw, y: hd },  // Bottom-Left
        { x: hw, y: hd },   // Bottom-Right
        { x: hw, y: -hd }   // Top-Right
    ];

    // Apply rotation for absolute wall positions
    const rad = rotationDeg * Math.PI / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    
    const rotatedPts = localPts.map(p => {
        return {
            x: origin.x + (p.x * cos - p.y * sin),
            y: origin.y + (p.x * sin + p.y * cos)
        };
    });

    // Create or Update Anchors
    let anchors = [];
    if (parentGroup && parentGroup.anchors && parentGroup.anchors.length === 4) {
        anchors = parentGroup.anchors;
        rotatedPts.forEach((p, i) => {
            anchors[i].node.position({ x: p.x, y: p.y });
            anchors[i].lastValidPos = { x: p.x, y: p.y };
        });
    } else {
        anchors = rotatedPts.map(p => {
            const a = new Anchor(planner, p.x, p.y);
            if (parentGroup) {
                a.parentGroup = parentGroup;
                parentGroup.anchors.push(a);
            }
            planner.anchors.push(a);
            return a;
        });
    }

    // Create or Update Walls
    let walls = [];
    if (parentGroup && parentGroup.walls && parentGroup.walls.length === 4) {
        walls = parentGroup.walls;
        walls.forEach((wall) => {
            wall.height = wallHeight;
            wall.elevation = elevation;
        });
    } else {
        for (let i = 0; i < 4; i++) {
            const a1 = anchors[i];
            const a2 = anchors[(i + 1) % 4];
            const wall = new PremiumWall(planner, a1, a2, 'outer');
            wall.height = wallHeight;
            wall.thickness = 10; // Thinner walls for dormers/presets
            wall.elevation = elevation;
            if (parentGroup) {
                wall.parentGroup = parentGroup;
                parentGroup.walls.push(wall);
            }
            planner.walls.push(wall);
            walls.push(wall);
        }
    }

    // Expand roof points by half-thickness (5) so the roof exactly covers the outer edges of the walls
    const roofExpand = 5; 
    let roofPts = [
        { x: -hw - roofExpand, y: -hd - roofExpand },
        { x: -hw - roofExpand, y: hd + roofExpand },
        { x: hw + roofExpand, y: hd + roofExpand },
        { x: hw + roofExpand, y: -hd - roofExpand }
    ];

    let roof = null;
    if (parentGroup && parentGroup.roofs && parentGroup.roofs.length === 1) {
        roof = parentGroup.roofs[0];
        roof.group.position({ x: origin.x, y: origin.y });
        roof.rotation = rotationDeg;
        roof.elevation = elevation + wallHeight;
        // Basic heuristics for roof types (don't override manually set styles when just updating)
        if (roofType === 'gable') {
            roof.config.ridgeAxis = 'y';
            roof.config.autoShapeWalls = true;
        }
    } else {
        roof = new PremiumHipRoof(planner, roofPts);
        roof.group.position({ x: origin.x, y: origin.y });
        roof.rotation = rotationDeg;
        roof.config.roofType = roofType;
        roof.config.pitch = pitch;
        roof.elevation = elevation + wallHeight;
        // Basic heuristics for roof types
        if (roofType === 'gable') {
            roof.config.gableMaterial = 'white_plaster_wall';
            roof.config.ridgeAxis = 'y'; // Since default dormer faces down, Y-axis is typically depth (ridge runs front-to-back)
            roof.config.autoShapeWalls = true;
        }
        if (parentGroup) {
            roof.parentGroup = parentGroup;
            parentGroup.roofs.push(roof);
        }
        planner.roofs.push(roof);
    }

    return { anchors, walls, roofs: [roof] };
}

function drawRectIcon(ctx, w, d) {
    ctx.beginPath();
    ctx.rect(-w/2, -d/2, w, d);
    ctx.stroke();
}

export const PRESET_REGISTRY = {
    preset_dormer_gable: {
        name: 'Gable Dormer', category: 'Dormers',
        defaultParams: { width: 120, depth: 150, wallHeight: 120, roofType: 'gable', pitch: 35, elevation: 250 },
        icon2d: (ctx, w, d) => {
            drawRectIcon(ctx, w, d);
            ctx.beginPath(); ctx.moveTo(0, -d/2); ctx.lineTo(0, d/2); ctx.stroke(); // ridge
        },
        generate: (planner, origin, p, autoAlignData, parentGroup = null) => {
            const elev = autoAlignData?.isOnRoof ? autoAlignData.elevation : p.elevation;
            const rot = autoAlignData?.rotation || 0;
            const extraHeight = autoAlignData?.addedHeight || 0;
            
            if (!parentGroup) {
                if (!planner.presetGroups) planner.presetGroups = [];
                parentGroup = new PresetGroup(planner, 'preset_dormer_gable', p, origin, rot);
                planner.presetGroups.push(parentGroup);
            }
            
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight + extraHeight, p.roofType, p.pitch, elev, rot, parentGroup);
            
            if (planner.tool === 'select') planner.selectEntity(parentGroup, 'preset_group');
            return parentGroup;
        }
    },
    preset_dormer_shed: {
        name: 'Shed Dormer', category: 'Dormers',
        defaultParams: { width: 250, depth: 150, wallHeight: 120, roofType: 'flat', pitch: 15, elevation: 250 },
        icon2d: (ctx, w, d) => { drawRectIcon(ctx, w, d); },
        generate: (planner, origin, p, autoAlignData, parentGroup = null) => {
            const elev = autoAlignData?.isOnRoof ? autoAlignData.elevation : p.elevation;
            const rot = autoAlignData?.rotation || 0;
            const extraHeight = autoAlignData?.addedHeight || 0;
            
            if (!parentGroup) {
                if (!planner.presetGroups) planner.presetGroups = [];
                parentGroup = new PresetGroup(planner, 'preset_dormer_shed', p, origin, rot);
                planner.presetGroups.push(parentGroup);
            }
            
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight + extraHeight, p.roofType, p.pitch, elev, rot, parentGroup);
            
            if (planner.tool === 'select') planner.selectEntity(parentGroup, 'preset_group');
            return parentGroup;
        }
    },
    preset_dormer_hip: {
        name: 'Hip Dormer', category: 'Dormers',
        defaultParams: { width: 150, depth: 150, wallHeight: 120, roofType: 'hip', pitch: 35, elevation: 250 },
        icon2d: (ctx, w, d) => {
            drawRectIcon(ctx, w, d);
            ctx.beginPath(); ctx.moveTo(-w/2, 0); ctx.lineTo(w/2, 0); ctx.stroke();
        },
        generate: (planner, origin, p, autoAlignData, parentGroup = null) => {
            const elev = autoAlignData?.isOnRoof ? autoAlignData.elevation : p.elevation;
            const rot = autoAlignData?.rotation || 0;
            const extraHeight = autoAlignData?.addedHeight || 0;
            
            if (!parentGroup) {
                if (!planner.presetGroups) planner.presetGroups = [];
                parentGroup = new PresetGroup(planner, 'preset_dormer_hip', p, origin, rot);
                planner.presetGroups.push(parentGroup);
            }
            
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight + extraHeight, p.roofType, p.pitch, elev, rot, parentGroup);
            
            if (planner.tool === 'select') planner.selectEntity(parentGroup, 'preset_group');
            return parentGroup;
        }
    },
    
    // Roof Additions
    preset_porch_roof: {
        name: 'Porch Roof', category: 'Roof Additions',
        defaultParams: { width: 300, depth: 150, wallHeight: 250, roofType: 'flat', pitch: 10, elevation: 0 },
        icon2d: (ctx, w, d) => { drawRectIcon(ctx, w, d); },
        generate: (planner, origin, p, autoAlignData, parentGroup = null) => {
            const rot = autoAlignData?.rotation || 0; // Porches might optionally align to walls, but let's just pass rot
            
            if (!parentGroup) {
                if (!planner.presetGroups) planner.presetGroups = [];
                parentGroup = new PresetGroup(planner, 'preset_porch_roof', p, origin, rot);
                planner.presetGroups.push(parentGroup);
            }
            
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight, p.roofType, p.pitch, p.elevation, rot, parentGroup);
            
            if (planner.tool === 'select') planner.selectEntity(parentGroup, 'preset_group');
            return parentGroup;
        }
    },
    preset_carport: {
        name: 'Carport Roof', category: 'Roof Additions',
        defaultParams: { width: 350, depth: 550, wallHeight: 250, roofType: 'flat', pitch: 5, elevation: 0 },
        icon2d: (ctx, w, d) => { drawRectIcon(ctx, w, d); },
        generate: (planner, origin, p, autoAlignData, parentGroup = null) => {
            const rot = autoAlignData?.rotation || 0;
            
            if (!parentGroup) {
                if (!planner.presetGroups) planner.presetGroups = [];
                parentGroup = new PresetGroup(planner, 'preset_carport', p, origin, rot);
                planner.presetGroups.push(parentGroup);
            }
            
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight, p.roofType, p.pitch, p.elevation, rot, parentGroup);
            
            if (planner.tool === 'select') planner.selectEntity(parentGroup, 'preset_group');
            return parentGroup;
        }
    },

    // Garages
    preset_garage_detached: {
        name: 'Detached Garage', category: 'Garages',
        defaultParams: { width: 400, depth: 600, wallHeight: 250, roofType: 'gable', pitch: 30, elevation: 0 },
        icon2d: (ctx, w, d) => {
            drawRectIcon(ctx, w, d);
            ctx.beginPath(); ctx.moveTo(0, -d/2); ctx.lineTo(0, d/2); ctx.stroke();
        },
        generate: (planner, origin, p, autoAlignData, parentGroup = null) => {
            const rot = autoAlignData?.rotation || 0;
            
            if (!parentGroup) {
                if (!planner.presetGroups) planner.presetGroups = [];
                parentGroup = new PresetGroup(planner, 'preset_garage_detached', p, origin, rot);
                planner.presetGroups.push(parentGroup);
            }
            
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight, p.roofType, p.pitch, p.elevation, rot, parentGroup);
            
            if (planner.tool === 'select') planner.selectEntity(parentGroup, 'preset_group');
            return parentGroup;
        }
    },

    // Extensions
    preset_extension_rear: {
        name: 'Rear Extension', category: 'Extensions',
        defaultParams: { width: 400, depth: 300, wallHeight: 250, roofType: 'flat', pitch: 5, elevation: 0 },
        icon2d: (ctx, w, d) => { drawRectIcon(ctx, w, d); },
        generate: (planner, origin, p, autoAlignData) => {
            const rot = autoAlignData?.rotation || 0;
            createRectangularStructure(planner, origin, p.width, p.depth, p.wallHeight, p.roofType, p.pitch, p.elevation, rot);
        }
    }
};

export const PRESET_CATEGORIES = {};
for (const [id, preset] of Object.entries(PRESET_REGISTRY)) {
    if (!PRESET_CATEGORIES[preset.category]) {
        PRESET_CATEGORIES[preset.category] = [];
    }
    PRESET_CATEGORIES[preset.category].push({ id, ...preset });
}
