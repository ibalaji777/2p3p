/**
 * RoofEngine.js
 * 
 * THE SINGLE AUTHORITATIVE PUBLIC FAÇADE FOR THE ROOF SYSTEM.
 * 
 * Orchestrates:
 * - Canonical Roof State (planner.roofs[])
 * - Canonical Geometry (RoofGeometryEngine)
 * - Canonical Topology & Lifecycle (RoofTopologyEngine)
 * - Canonical Mutations (RoofMutationEngine)
 * - Canonical Serialization (RoofSerializer)
 * - 2D & 3D Synchronization
 */

import { RoofGeometryEngine } from './RoofGeometryEngine.js';
import { RoofTopologyEngine } from './RoofTopologyEngine.js';
import { RoofMutationEngine } from './RoofMutationEngine.js';
import { RoofSerializer } from './RoofSerializer.js';

export class RoofEngine {
    // ==========================================
    // 1. GEOMETRY AUTHORITY
    // ==========================================
    static cleanPoints(points) {
        return RoofGeometryEngine.cleanPoints(points);
    }

    static getBounds(pointsOrRoof, offset) {
        const pts = Array.isArray(pointsOrRoof) ? pointsOrRoof : pointsOrRoof?.points;
        return RoofGeometryEngine.getBounds(pts, offset);
    }

    static getCentroid(pointsOrRoof) {
        const pts = Array.isArray(pointsOrRoof) ? pointsOrRoof : pointsOrRoof?.points;
        return RoofGeometryEngine.getCentroid(pts);
    }

    static getEffectiveRidgeAxis(pointsOrRoof, explicitAxis, manualRidge) {
        const pts = Array.isArray(pointsOrRoof) ? pointsOrRoof : pointsOrRoof?.points;
        return RoofGeometryEngine.getEffectiveRidgeAxis(pts, explicitAxis, manualRidge);
    }

    static getPeakHeight(pointsOrRoof, pitch, roofType, ridgeAxis) {
        return RoofGeometryEngine.getPeakHeight(pointsOrRoof, pitch, roofType, ridgeAxis);
    }

    static getPitchFromHeight(pointsOrRoof, peakHeight, roofType, ridgeAxis) {
        return RoofGeometryEngine.getPitchFromHeight(pointsOrRoof, peakHeight, roofType, ridgeAxis);
    }

    static getOffsetEaves(pointsOrRoof, overhangs) {
        const pts = Array.isArray(pointsOrRoof) ? pointsOrRoof : pointsOrRoof?.points;
        return RoofGeometryEngine.getOffsetEaves(pts, overhangs);
    }

    static getUpperWallCutouts(roof, walls) {
        return RoofGeometryEngine.getUpperWallCutouts(roof, walls);
    }

    // ==========================================
    // 2. TOPOLOGY & LIFECYCLE AUTHORITY
    // ==========================================
    static createRoof(planner, points, config = {}, options = {}) {
        return RoofTopologyEngine.createRoof(planner, points, config, options);
    }

    static deleteRoof(planner, roof) {
        return RoofTopologyEngine.deleteRoof(planner, roof);
    }

    static duplicateRoof(planner, roof, offset = { x: 30, y: 30 }) {
        return RoofTopologyEngine.duplicateRoof(planner, roof, offset);
    }

    static isPointInsideRoof(roof, x, y) {
        return RoofTopologyEngine.isPointInsideRoof(roof, x, y);
    }

    // ==========================================
    // 3. MUTATION AUTHORITY
    // ==========================================
    static setPitch(roof, pitch, planner = null) {
        RoofMutationEngine.setPitch(roof, pitch, planner);
    }

    static setPeakHeight(roof, peakHeight, planner = null) {
        RoofMutationEngine.setPeakHeight(roof, peakHeight, planner);
    }

    static setOverhang(roof, overhang, edgeIndex = null, planner = null) {
        RoofMutationEngine.setOverhang(roof, overhang, edgeIndex, planner);
    }

    static setRoofType(roof, roofType, planner = null) {
        RoofMutationEngine.setRoofType(roof, roofType, planner);
    }

    static setPoints(roof, points, planner = null) {
        RoofMutationEngine.setPoints(roof, points, planner);
    }

    static setPosition(roof, x, y, planner = null) {
        RoofMutationEngine.setPosition(roof, x, y, planner);
    }

    static setRotation(roof, angleDeg, planner = null) {
        RoofMutationEngine.setRotation(roof, angleDeg, planner);
    }

    static setElevation(roof, elevation, planner = null) {
        RoofMutationEngine.setElevation(roof, elevation, planner);
    }

    static setThickness(roof, thickness, planner = null) {
        RoofMutationEngine.setThickness(roof, thickness, planner);
    }

    static setRidgeAxis(roof, axis, planner = null, isManual = true) {
        RoofMutationEngine.setRidgeAxis(roof, axis, planner, isManual);
    }

    static setCurve(roof, curve, planner = null) {
        RoofMutationEngine.setCurve(roof, curve, planner);
    }

    static setWallGap(roof, wallGap, planner = null) {
        RoofMutationEngine.setWallGap(roof, wallGap, planner);
    }

    static setCornerRadius(roof, radius, planner = null) {
        RoofMutationEngine.setCornerRadius(roof, radius, planner);
    }

    static setWallSide(roof, side, enabled, planner = null) {
        RoofMutationEngine.setWallSide(roof, side, enabled, planner);
    }

    static setWallSides(roof, sidesObj, planner = null) {
        RoofMutationEngine.setWallSides(roof, sidesObj, planner);
    }

    static setWallDropHeight(roof, height, planner = null) {
        RoofMutationEngine.setWallDropHeight(roof, height, planner);
    }

    static setSpotlights(roof, enabled, planner = null) {
        RoofMutationEngine.setSpotlights(roof, enabled, planner);
    }

    static setFlipSlope(roof, flipSlope, planner = null) {
        RoofMutationEngine.setFlipSlope(roof, flipSlope, planner);
    }

    static setAutoPlacementMode(roof, mode, planner = null) {
        RoofMutationEngine.setAutoPlacementMode(roof, mode, planner);
    }

    static setTileSize(roof, tileSize, planner = null) {
        RoofMutationEngine.setTileSize(roof, tileSize, planner);
    }

    static setMaterial(roof, materialKey, scope = 'single', slopeKey = null, planner = null) {
        RoofMutationEngine.setMaterial(roof, materialKey, scope, slopeKey, planner);
    }

    static setAutoShapeWalls(roof, enabled, planner = null) {
        RoofMutationEngine.setAutoShapeWalls(roof, enabled, planner);
    }

    static updateAddon(roof, addonType, idOrIndex, params, planner = null) {
        return RoofMutationEngine.updateAddon(roof, addonType, idOrIndex, params, planner);
    }

    static batchUpdate(roof, updates, planner = null) {
        RoofMutationEngine.batchUpdate(roof, updates, planner);
    }

    static addSkylight(roof, params, planner = null) {
        return RoofMutationEngine.addSkylight(roof, params, planner);
    }

    static removeSkylight(roof, idOrIndex, planner = null) {
        RoofMutationEngine.removeSkylight(roof, idOrIndex, planner);
    }

    static addCresting(roof, params, planner = null) {
        return RoofMutationEngine.addCresting(roof, params, planner);
    }

    static removeCresting(roof, idOrIndex, planner = null) {
        RoofMutationEngine.removeCresting(roof, idOrIndex, planner);
    }

    static addFinial(roof, params, planner = null) {
        return RoofMutationEngine.addFinial(roof, params, planner);
    }

    static removeFinial(roof, idOrIndex, planner = null) {
        RoofMutationEngine.removeFinial(roof, idOrIndex, planner);
    }

    static addChimney(roof, params, planner = null) {
        return RoofMutationEngine.addChimney(roof, params, planner);
    }

    static removeChimney(roof, idOrIndex, planner = null) {
        RoofMutationEngine.removeChimney(roof, idOrIndex, planner);
    }

    static syncGableWalls(roof, planner) {
        RoofMutationEngine.syncGableWalls(roof, planner);
    }

    static notifyRoofUpdated(roof, planner, aspect = 'geometry') {
        RoofMutationEngine.notifyRoofUpdated(roof, planner, aspect);
    }

    // ==========================================
    // 4. SERIALIZATION AUTHORITY
    // ==========================================
    static serialize(roof) {
        return RoofSerializer.serialize(roof);
    }

    static deserialize(rData, planner, options = {}) {
        return RoofSerializer.deserialize(rData, planner, options);
    }
}
