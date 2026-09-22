import {
    createStarterElevationSegment,
    sproutBendAtEndpoint,
    sproutBranchFromNode,
    setNodeCornerStyle,
    ELEVATION_SEGMENT_CONFIG,
    ELEVATION_SEGMENT_MATERIALS
} from '../../features/elevation/elevationSegment.registry.js';
import {
    renderElevationSegment2D,
    syncElevationSegments2D,
    computeElevationSegment2DFootprint,
    computeElevationSegmentSpotlights2D
} from '../../features/elevation/elevationSegment.renderer2d.js';
import { renderElevationSegment3D } from '../../features/elevation/elevationSegment.renderer3d.js';
import { buildElevationSegmentGeometry, expandPathWithFillets } from '../../features/elevation/elevationSegment.geometry.js';

import {
    FACADE_RIBBON_CONFIG,
    FACADE_RIBBON_MATERIALS
} from '../../features/facade/facadeRibbon.registry.js';
import { renderFacadeRibbon3D } from '../../features/facade/facadeRibbon.renderer3d.js';
import { buildRibbon3DGeometry } from '../../features/facade/facadeRibbon.geometry.js';

import {
    FASCIA_TYPES,
    FASCIA_MATERIALS,
    FASCIA_REGISTRY,
    FASCIA_CATALOG
} from '../../features/fascia/fascia.registry.js';
import { renderFascia2D } from '../../features/fascia/fascia.renderer2d.js';
import { renderFascia3D } from '../../features/fascia/fascia.renderer3d.js';
import { WallEngine } from '../wall/WallEngine.js';
import { ThreeLifecycleManager } from '../engine3d/ThreeLifecycleManager.js';

/**
 * ElevationFacadeEngine
 * 
 * Central canonical authority for all exterior elevation elements,
 * facade ribbons, and architectural fascias.
 * 
 * Unifies:
 * 1. Elevation Segments (wall-attached multi-directional beams, bends, branches, spotlights)
 * 2. Facade Ribbons (continuous perimeter architectural bands with 45° miters)
 * 3. Elevation Fascias (pre-profiled C-frames, L-frames, corner wrap towers, terrace returns)
 * 4. Vertical Coordination (syncing elevations when walls rise/fall)
 */
export class ElevationFacadeEngine {

    // ==========================================
    // 1. Elevation Segments Lifecycle & Operations
    // ==========================================

    /**
     * Creates an authoritative Elevation Segment attached to a host wall.
     * 
     * @param {Object} wall - Host wall entity
     * @param {number} localHitX - Horizontal position along the wall
     * @param {number} hitY - Vertical elevation above floor (cm)
     * @param {number} [facing=1] - Face classification (+1 front, -1 back)
     * @param {Object} [options={}] - Config parameters (width, depth, material, etc.)
     * @param {Object} [planner=null] - 2D FloorPlanner instance to attach to
     * @returns {Object} The newly created elevation segment
     */
    static createElevationSegment(wall, localHitX, hitY, facing = 1, options = {}, planner = null) {
        if (!wall) return null;

        const segment = createStarterElevationSegment(wall, localHitX, hitY, facing, options);
        if (!segment) return null;

        if (planner) {
            if (!Array.isArray(planner.elevationSegments)) {
                planner.elevationSegments = [];
            }
            planner.elevationSegments.push(segment);
            if (typeof planner.syncAll === 'function') {
                planner.syncAll();
            } else if (typeof planner.requestDraw === 'function') {
                planner.requestDraw();
            }
        }

        return segment;
    }

    /**
     * Safely deletes an Elevation Segment, cleaning up 2D display nodes and 3D meshes.
     * 
     * @param {Object} planner - 2D FloorPlanner instance
     * @param {Object|string} segmentOrId - Elevation segment entity or ID
     * @param {Object} [preview3D=null] - 3D engine instance
     */
    static deleteElevationSegment(planner, segmentOrId, preview3D = null) {
        if (!planner) return;

        const segmentId = typeof segmentOrId === 'object' ? segmentOrId?.id : segmentOrId;
        const segment = typeof segmentOrId === 'object' ? segmentOrId : (planner.elevationSegments || []).find(s => s.id === segmentId);

        if (!segment) return;

        // 1. Clean up 2D Konva display group
        if (segment.group) {
            try {
                if (typeof segment.group.destroyChildren === 'function') segment.group.destroyChildren();
                if (typeof segment.group.destroy === 'function') segment.group.destroy();
            } catch (e) {}
            segment.group = null;
        }

        // 2. Clean up 3D meshes and interactables
        if (preview3D || segment.mesh3D) {
            ThreeLifecycleManager.disposeEntity(segment, preview3D);
        }

        // 3. Remove from planner authoritative array
        if (Array.isArray(planner.elevationSegments)) {
            planner.elevationSegments = planner.elevationSegments.filter(s => s !== segment && s.id !== segmentId);
        }

        // 4. Clear selection if deleted
        if (planner.selectedEntity === segment || planner.selectedEntity?.id === segmentId) {
            planner.selectEntity(null);
        }

        // 5. Trigger redraw
        if (typeof planner.syncAll === 'function') {
            planner.syncAll();
        } else if (typeof planner.requestDraw === 'function') {
            planner.requestDraw();
        }
        if (preview3D?.requestRender) {
            preview3D.requestRender('elevation_segment_deleted');
        }
    }

    /**
     * Sprouts a new connected segment from an endpoint (creates a bend).
     */
    static sproutBend(segment, nodeIndex, direction, distance = 120) {
        return sproutBendAtEndpoint(segment, nodeIndex, direction, distance);
    }

    /**
     * Sprouts a T-branch from an internal node.
     */
    static sproutBranch(segment, nodeIndex, direction, distance = 120) {
        return sproutBranchFromNode(segment, nodeIndex, direction, distance);
    }

    /**
     * Moves a node by relative delta (dx, dy, dz).
     */
    static moveNode(segment, nodeIndex, dx = 0, dy = 0, dz = 0) {
        if (!segment) return;
        if (segment.points && segment.points[nodeIndex]) {
            segment.points[nodeIndex].x += dx;
            segment.points[nodeIndex].y += dy;
            segment.points[nodeIndex].z += dz;
        }
        if (segment.nodes && segment.nodes[nodeIndex]) {
            segment.nodes[nodeIndex].x += dx;
            segment.nodes[nodeIndex].y += dy;
            segment.nodes[nodeIndex].z += dz;
        }
    }

    /**
     * Deletes an internal node or terminal branch.
     */
    static deleteNode(segment, nodeIndex) {
        if (!segment || !segment.points || segment.points.length <= 2) return;
        segment.points.splice(nodeIndex, 1);
        if (segment.nodes) segment.nodes.splice(nodeIndex, 1);
    }

    /**
     * Sets corner style ('sharp' | 'fillet') and corner radius.
     */
    static setCornerStyle(segment, nodeIndex, cornerStyle = 'sharp', radius = 0) {
        return setNodeCornerStyle(segment, nodeIndex, cornerStyle, radius);
    }

    /**
     * Sets cross-section beam width (thickness/drop).
     */
    static setWidth(segment, width) {
        if (segment) segment.width = width;
    }

    /**
     * Sets cantilever projection depth from wall.
     */
    static setDepth(segment, depth) {
        if (segment) segment.depth = depth;
    }

    /**
     * Sets architectural material key.
     */
    static setMaterial(segment, material) {
        if (segment) segment.material = material;
    }

    /**
     * Toggles recessed under-soffit puck lights.
     */
    static toggleSpotlights(segment, hasSpotlights = true, spacing = 80) {
        if (segment) {
            segment.hasSpotlights = hasSpotlights;
            segment.spotlightSpacing = spacing;
        }
    }

    /**
     * Reconciles 2D Konva visual shapes with planner.elevationSegments.
     */
    static syncElevationSegments2D(planner) {
        return syncElevationSegments2D(planner);
    }

    /**
     * Renders a single elevation segment on 2D Konva context.
     */
    static renderElevationSegment2D(context, shape, params) {
        return renderElevationSegment2D(context, shape, params);
    }

    /**
     * Generates swept 3D mesh with miters, fillets, and spotlights.
     */
    static renderElevationSegment3D(segment, ctx) {
        return renderElevationSegment3D(segment, ctx);
    }

    /**
     * Builds swept BufferGeometry for an elevation segment.
     */
    static buildElevationSegmentGeometry(segment) {
        return buildElevationSegmentGeometry(segment);
    }

    /**
     * Extracts pure serializable JSON representation of an elevation segment.
     */
    static serializeElevationSegment(segment) {
        if (!segment) return null;
        return {
            id: segment.id,
            type: 'elevation_segment',
            wallId: segment.wallId || null,
            wallFacing: segment.wallFacing !== undefined ? segment.wallFacing : 1,
            width: segment.width || 30,
            depth: segment.depth || 40,
            material: segment.material || 'wood',
            hasSpotlights: segment.hasSpotlights === true,
            spotlightSpacing: segment.spotlightSpacing || 80,
            points: (segment.points || []).map(p => ({
                x: p.x,
                y: p.y,
                z: p.z,
                normal: p.normal ? { x: p.normal.x, y: p.normal.y, z: p.normal.z } : { x: 0, y: 0, z: 1 },
                cornerStyle: p.cornerStyle || 'sharp',
                radius: p.radius || 0
            })),
            nodes: (segment.nodes || []).map(n => ({
                id: n.id,
                x: n.x,
                y: n.y,
                z: n.z,
                normal: n.normal ? { x: n.normal.x, y: n.normal.y, z: n.normal.z } : { x: 0, y: 0, z: 1 },
                cornerStyle: n.cornerStyle || 'sharp',
                radius: n.radius || 0
            })),
            segments: (segment.segments || []).map(s => ({
                id: s.id,
                startNodeId: s.startNodeId,
                endNodeId: s.endNodeId
            })),
            branches: (segment.branches || []).map(b => ({
                id: b.id,
                parentNodeId: b.parentNodeId,
                branchStartNodeId: b.branchStartNodeId,
                nodes: (b.nodes || []).map(bn => ({ ...bn }))
            }))
        };
    }

    /**
     * Deserializes an elevation segment from JSON and attaches to planner.
     */
    static deserializeElevationSegment(planner, data) {
        if (!data || data.type !== 'elevation_segment') return null;

        const segment = {
            id: data.id || ('elevation_segment_' + Date.now()),
            type: 'elevation_segment',
            wallId: data.wallId || null,
            wallFacing: data.wallFacing !== undefined ? data.wallFacing : 1,
            width: data.width || 30,
            depth: data.depth || 40,
            material: data.material || 'wood',
            hasSpotlights: data.hasSpotlights === true,
            spotlightSpacing: data.spotlightSpacing || 80,
            points: Array.isArray(data.points) ? data.points.map(p => ({ ...p })) : [],
            nodes: Array.isArray(data.nodes) ? data.nodes.map(n => ({ ...n })) : [],
            segments: Array.isArray(data.segments) ? data.segments.map(s => ({ ...s })) : [],
            branches: Array.isArray(data.branches) ? data.branches.map(b => ({ ...b })) : []
        };

        if (planner) {
            if (!Array.isArray(planner.elevationSegments)) {
                planner.elevationSegments = [];
            }
            planner.elevationSegments.push(segment);
        }

        return segment;
    }

    // ==========================================
    // 2. Facade Ribbons API
    // ==========================================

    /**
     * Gets facade ribbon default configuration and metadata.
     */
    static getFacadeRibbonConfig() {
        return FACADE_RIBBON_CONFIG;
    }

    /**
     * Gets available facade ribbon material presets.
     */
    static getFacadeRibbonMaterials() {
        return FACADE_RIBBON_MATERIALS;
    }

    /**
     * Sweeps continuous 3D ribbon geometry along perimeter paths.
     */
    static renderFacadeRibbon3D(path, options = {}, ctx = null) {
        return renderFacadeRibbon3D(path, options, ctx);
    }

    /**
     * Builds extruded 3D ribbon geometry with 45° miters.
     */
    static buildFacadeRibbonGeometry(points, options = {}) {
        return buildRibbon3DGeometry(points, options);
    }

    // ==========================================
    // 3. Elevation Fascias API
    // ==========================================

    /**
     * Gets available fascia profile types.
     */
    static getFasciaTypes() {
        return FASCIA_TYPES;
    }

    /**
     * Gets available fascia material presets.
     */
    static getFasciaMaterials() {
        return FASCIA_MATERIALS;
    }

    /**
     * Gets the full fascia widget registry configuration.
     */
    static getFasciaRegistry() {
        return FASCIA_REGISTRY;
    }

    /**
     * Gets the authoritative catalog presets for UI galleries.
     */
    static getFasciaCatalog() {
        return FASCIA_CATALOG;
    }

    /**
     * Creates an authoritative elevation_fascia widget attached to a host wall.
     * Routes through WallEngine.createWidget to guarantee single source of truth.
     * 
     * @param {Object} planner - 2D FloorPlanner instance
     * @param {Object} wall - Host wall
     * @param {number} t - Relative position along wall length [0..1]
     * @param {string} profileType - One of FASCIA_TYPES keys
     * @param {Object} [options={}] - Fascia options (width, height, depth, returnLength, etc.)
     * @returns {Object} The created fascia widget
     */
    static createFascia(planner, wall, t = 0.5, profileType = 'c_shape_left', options = {}) {
        if (!wall) return null;

        const widgetOptions = {
            profileType,
            width: options.width || 100,
            height: options.height || 120,
            depth: options.depth || 40,
            thick: options.thick || 10,
            elevation: options.elevation !== undefined ? options.elevation : (wall.elevation || 0),
            fasciaMat: options.fasciaMat || 'white',
            facing: options.facing !== undefined ? options.facing : 1,
            returnLength: options.returnLength || 120,
            towerHeight: options.towerHeight || 350,
            towerWidth: options.towerWidth || 60,
            towerDepth: options.towerDepth || 40,
            hasSpotlights: options.hasSpotlights !== undefined ? options.hasSpotlights : true,
            spotlightCount: options.spotlightCount || 4,
            ...options
        };

        return WallEngine.createWidget(planner, wall, t, 'elevation_fascia', widgetOptions);
    }

    /**
     * Renders 2D footprint for an elevation fascia widget.
     */
    static renderFascia2D(context, shape, params) {
        return renderFascia2D(context, shape, params);
    }

    /**
     * Generates 3D multi-part extruded fascia geometry.
     */
    static renderFascia3D(entity, ctx) {
        return renderFascia3D(entity, ctx);
    }

    // ==========================================
    // 4. Vertical Coordination
    // ==========================================

    /**
     * Synchronizes elevation segments attached to a wall when wall height/elevation changes.
     * 
     * @param {Object} wall - The modified host wall
     * @param {Object} planner - FloorPlanner instance
     * @param {Object} [preview3D=null] - 3D engine instance
     */
    static syncSegmentsWithWall(wall, planner, preview3D = null, deltaH = 0, deltaElev = 0) {
        if (!wall || !planner || !Array.isArray(planner.elevationSegments)) return;

        const segments = planner.elevationSegments.filter(seg => seg.wallId === wall.id);
        if (segments.length === 0) return;

        const wallElevation = wall.elevation || 0;
        const wallHeight = wall.height || 120;
        const wallTop = wallElevation + wallHeight;

        segments.forEach(seg => {
            let delta = 0;
            if (deltaH !== 0 || deltaElev !== 0) {
                if (seg.anchorMode === 'top' && deltaH !== 0) delta += deltaH;
                if (deltaElev !== 0) delta += deltaElev;
            } else if (seg._lastSyncedWallTop !== undefined && seg._lastSyncedWallTop !== wallTop) {
                delta = wallTop - seg._lastSyncedWallTop;
            }

            if (delta !== 0) {
                if (Array.isArray(seg.points)) {
                    seg.points.forEach(p => { p.y += delta; });
                }
                if (Array.isArray(seg.nodes)) {
                    seg.nodes.forEach(n => { n.y += delta; });
                }
                if (Array.isArray(seg.branches)) {
                    seg.branches.forEach(b => {
                        if (Array.isArray(b.nodes)) {
                            b.nodes.forEach(bn => { bn.y += delta; });
                        }
                    });
                }
            }
            seg._lastSyncedWallTop = wallTop;

            // Live update 3D mesh if preview3D is available
            if (preview3D && seg.mesh3D) {
                renderElevationSegment3D(seg, preview3D);
            }
        });

        if (preview3D?.requestRender) {
            preview3D.requestRender('elevation_segments_wall_sync');
        }
    }
}
