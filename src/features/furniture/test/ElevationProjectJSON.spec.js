import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { FURNITURE_REGISTRY, RAILING_REGISTRY, COMMON_MATERIALS, STONE_REGISTRY, WOOD_REGISTRY } from '../../../core/registry.js';

describe('Luxury Modern Villa Elevation Project JSON Integrity', () => {
    const jsonPath = path.resolve(process.cwd(), 'public/building_planner_elevation_project.json');

    it('should exist and parse into a valid project structure', () => {
        expect(fs.existsSync(jsonPath), `File not found at ${jsonPath}`).toBe(true);
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const project = JSON.parse(raw);

        expect(project.version).toBe('2.0.0');
        expect(project.levels).toBeDefined();
        expect(project.levels.length).toBe(3);
        expect(project.activeLevelIndex).toBe(0);
    });

    it('should validate Level 0 (Ground Floor - Carport, Porch, Monolith)', () => {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const project = JSON.parse(raw);
        const level0 = project.levels[0];
        expect(level0.id).toBe('level_0_ground');
        expect(level0.height).toBe(120);

        const data = JSON.parse(level0.data);
        expect(data.anchors.length).toBeGreaterThan(5);
        expect(data.walls.length).toBeGreaterThan(8);
        expect(data.rooms.length).toBeGreaterThan(2);
        expect(data.furniture.length).toBeGreaterThanOrEqual(3);

        // Verify official catalog plants present around porch and tower
        const monstera = data.furniture.filter(f => f.configId === 'decor_plant_monstera');
        const snake = data.furniture.find(f => f.configId === 'decor_plant_snake');
        expect(monstera.length).toBeGreaterThanOrEqual(2);
        expect(snake, 'Missing snake plant').toBeDefined();
        expect(FURNITURE_REGISTRY['decor_plant_monstera']).toBeDefined();
        expect(FURNITURE_REGISTRY['decor_plant_snake']).toBeDefined();

        // Verify main pivot entrance door and floor-to-ceiling windows
        const entranceWall = data.walls.find(w => w.id === 'gf_wall_entrance_front');
        expect(entranceWall).toBeDefined();
        expect(entranceWall.widgets.some(w => w.doorStyle === 'entry_grand_panel')).toBe(true);
        expect(entranceWall.widgets.some(w => w.type === 'window')).toBe(true);

        // Verify stone monolith tower wall
        const stoneTowerWall = data.walls.find(w => w.id === 'gf_wall_stone_tower_front');
        expect(stoneTowerWall).toBeDefined();
        expect(stoneTowerWall.params.textureFront).toBe('stone_slate_charcoal');
    });

    it('should validate Level 1 (First Floor - Balconies & Protruding Box Frame)', () => {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const project = JSON.parse(raw);
        const level1 = project.levels[1];
        expect(level1.id).toBe('level_1_first');

        const data = JSON.parse(level1.data);
        expect(data.walls.length).toBeGreaterThan(8);

        // Verify glass-and-wood railings
        const railings = data.walls.filter(w => w.type === 'railing');
        expect(railings.length).toBeGreaterThanOrEqual(3);
        railings.forEach(r => {
            expect(r.configId).toBe('glass_wood_modern');
            expect(RAILING_REGISTRY[r.configId]).toBeDefined();
        });

        // Verify protruding white box frame
        const boxFrameLeft = data.walls.find(w => w.id === 'ff_wall_box_frame_left');
        const boxFrameRear = data.walls.find(w => w.id === 'ff_wall_box_rear');
        const boxFrameBeam = data.walls.find(w => w.id === 'ff_beam_box_frame_top');
        expect(boxFrameLeft).toBeDefined();
        expect(boxFrameRear).toBeDefined();
        expect(boxFrameBeam).toBeDefined();

        // Verify sliding glass doors and walnut accent panel
        expect(boxFrameRear.widgets.some(w => w.doorStyle === 'patio_multi_slide')).toBe(true);
        expect(boxFrameRear.widgets.some(w => w.materials?.leaf?.id === 'wood_siding_walnut')).toBe(true);

        // Verify catalog plant on first-floor balcony
        const balconyPlant = data.furniture.find(f => f.configId === 'decor_plant_monstera');
        expect(balconyPlant).toBeDefined();
    });

    it('should validate Level 2 (Roof Level - Floating Cantilevered Cap & Terrace)', () => {
        const raw = fs.readFileSync(jsonPath, 'utf8');
        const project = JSON.parse(raw);
        const level2 = project.levels[2];
        expect(level2.id).toBe('level_2_roof');

        const data = JSON.parse(level2.data);
        // Verify crisp white roof cap over stone tower
        const capWalls = data.walls.filter(w => w.id.startsWith('rf_cap_'));
        expect(capWalls.length).toBe(4);
        capWalls.forEach(w => {
            expect(w.params.textureFront).toBe('upvc_white');
        });

        // Verify rooftop terrace and center roof coverage
        expect(data.rooms.length).toBeGreaterThanOrEqual(2);
        expect(data.furniture.length).toBeGreaterThanOrEqual(3);
    });
});
