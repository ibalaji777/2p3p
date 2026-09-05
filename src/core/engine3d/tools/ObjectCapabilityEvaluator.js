/**
 * ObjectCapabilityEvaluator.js
 * Universal Object Capability & Constraint System for 3D Interactions.
 * 
 * Instead of object-specific toolbars, each object exposes standard capabilities:
 * - selectable: Can be selected in Select mode.
 * - material: Supports face/slot-based material painting.
 * - movable: Supports planar translation or baseline movement.
 * - rotatable: Supports Y-axis spin / yaw rotation.
 * - tiltable: Supports X-axis tilt / pitch rotation.
 * - elevatable: Supports vertical axis / elevation adjustments.
 * - pushPullable: Supports wall push/pull operations.
 * - apertureResizable: Supports width/height/depth opening adjustments.
 */

export class ObjectCapabilityEvaluator {
    /**
     * Evaluates capabilities for any 3D entity or mesh.
     * @param {Object|null} entity - Domain entity instance or plain config object.
     * @param {THREE.Object3D|null} mesh - 3D mesh representation.
     * @returns {Object} Capability flags.
     */
    static getCapabilities(entity, mesh = null) {
        // Default capabilities when nothing is selected
        if (!entity && !mesh) {
            return {
                selectable: true,
                material: true,
                movable: false,
                rotatable: false,
                tiltable: false,
                elevatable: false,
                pushPullable: false,
                apertureResizable: false
            };
        }

        const ent = entity || (mesh?.userData?.entity) || {};
        const type = ent.type || mesh?.userData?.type || '';
        const isWallSide = !!mesh?.userData?.isWallSide;
        const isWallMesh = !!mesh?.userData?.isWallMesh || isWallSide;
        const isFurniture = !!mesh?.userData?.isFurniture || type === 'furniture' || type.startsWith('furniture_') || type.startsWith('kitchen_') || type.startsWith('bathroom_') || type.startsWith('sanitary_') || type.startsWith('electronics_');
        const isRoof = !!mesh?.userData?.isRoof || type === 'roof' || !!ent.config?.roofType;
        const isRoofAddon = !!mesh?.userData?.isRoofAddon || !!mesh?.userData?.isRoofSculpture || !!mesh?.userData?.isSkylight || type.startsWith('roof_') || type.startsWith('ridge_') || type.startsWith('finial_') || type.startsWith('chimney_') || type === 'skylight';
        const isStair = !!mesh?.userData?.isStair || type === 'stair' || type.startsWith('stair_') || type === 'staircase';
        const isRailing = !!mesh?.userData?.isRailing || type === 'railing' || type.startsWith('railing_');
        const isShape = !!mesh?.userData?.isShape || type.startsWith('shape_') || type === 'shape';
        const isPlatform = !!mesh?.userData?.isPlatform || type === 'platform';
        const isFloorCut = !!mesh?.userData?.isFloorCutProxy || type === 'shape_floor_cut' || type === 'floor_cut';
        const isRoom = !!mesh?.userData?.isFloor || type === 'room' || type === 'floor' || type === 'outdoor_zone' || type === 'balcony';
        const isSolidProtrusion = !!mesh?.userData?.isProtrusion || type === 'solid_protrusion' || mesh?.userData?.widget?.type === 'solid_protrusion';
        const isOpening = !isSolidProtrusion && (!!mesh?.userData?.isWidget || !!mesh?.userData?.isPattern || ['door', 'window', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type));
        const isWallPlugin = ['sunshade', 'jali_panel', 'curtain', 'wall_art', 'elevation_fascia', 'molding'].includes(type) || type.startsWith('molding_') || type.startsWith('sunshade_') || type.startsWith('jali_') || type.startsWith('curtain_') || type.startsWith('decor_wall_');
        const isWall = (isWallMesh || ['outer', 'inner', 'compound', 'wall', 'wallDecor', 'arc'].includes(type) || ent.startX !== undefined) && !isOpening && !isWallPlugin;

        // 1. Base Walls
        if (isWall) {
            return {
                selectable: true,
                material: true,
                movable: false,
                rotatable: false,
                tiltable: false,
                elevatable: false,
                pushPullable: true,
                apertureResizable: false
            };
        }

        // 2. Openings & Wall Cutouts (Doors, Windows, Niches)
        if (isOpening) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: false,
                tiltable: false,
                elevatable: true,
                pushPullable: false,
                apertureResizable: true
            };
        }

        // 3. Wall Plugins (Sunshades, Jali, Curtains, Wall Art, Moldings, Fascias)
        if (isWallPlugin) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: false,
                tiltable: false,
                elevatable: true,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 4. Solid Wall Protrusions
        if (isSolidProtrusion) {
            return {
                selectable: true,
                material: true,
                movable: false,
                rotatable: false,
                tiltable: false,
                elevatable: false,
                pushPullable: true,
                apertureResizable: false
            };
        }

        // 5. Furniture, Kitchen, Bathroom, Electronics & Models
        if (isFurniture) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: true,
                tiltable: true,
                elevatable: true,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 6. Roofs
        if (isRoof) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: true,
                tiltable: false,
                elevatable: true,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 7. Roof Addons, Skylights & Sculptures
        if (isRoofAddon) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: true,
                tiltable: false,
                elevatable: true,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 8. Stairs & Railings
        if (isStair || isRailing) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: true,
                tiltable: false,
                elevatable: true,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 9. Shapes (Boxes, Cylinders, Prisms)
        if (isShape && !isFloorCut) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: true,
                tiltable: true,
                elevatable: true,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 9b. Platforms (Sims 4 Style)
        if (isPlatform) {
            return {
                selectable: true,
                material: true,
                movable: true,
                rotatable: true,
                tiltable: false,
                elevatable: true,
                pushPullable: false,
                apertureResizable: true
            };
        }

        // 10. Floor Cutout Polygons
        if (isFloorCut) {
            return {
                selectable: true,
                material: false,
                movable: true,
                rotatable: true,
                tiltable: false,
                elevatable: false,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // 11. Rooms, Floors, Slabs & Outdoor Zones
        if (isRoom) {
            return {
                selectable: true,
                material: true,
                movable: false,
                rotatable: false,
                tiltable: false,
                elevatable: false,
                pushPullable: false,
                apertureResizable: false
            };
        }

        // Fallback default capabilities
        return {
            selectable: true,
            material: true,
            movable: true,
            rotatable: true,
            tiltable: false,
            elevatable: true,
            pushPullable: false,
            apertureResizable: false
        };
    }
}
