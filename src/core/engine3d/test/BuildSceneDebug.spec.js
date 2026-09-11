import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import fs from 'fs';
import path from 'path';
import { EnvironmentBuilder } from '../EnvironmentBuilder.js';
import { AssetManager } from '../AssetManager.js';
import { FurnitureManager } from '../../../features/furniture/furniture.renderer3d.js';
import { DecorManager } from '../DecorManager.js';

describe('BuildScene Debug Test', () => {
    it('should build full scene for building_planner_elevation_project.json without throwing', () => {
        const jsonPath = path.resolve(process.cwd(), 'public/building_planner_elevation_project.json');

        const jsonStr = fs.readFileSync(jsonPath, 'utf8');
        const project = JSON.parse(jsonStr);

        const scene = new THREE.Scene();
        const structureGroup = new THREE.Group();
        const staticStructureGroup = new THREE.Group();
        scene.add(structureGroup);
        scene.add(staticStructureGroup);

        const mockCtx = {
            scene,
            structureGroup,
            staticStructureGroup,
            interactables: [],
            helpers: {
                ctx: null,
                getDynamicMaterial: () => new THREE.MeshStandardMaterial(),
                getFaceMaterials: () => ({
                    box: Array(6).fill(new THREE.MeshStandardMaterial()),
                    extrude: [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()]
                })
            },
            assets: new AssetManager(),
            furnitureManager: null,
            decorManager: null,
            updatePatternLive: () => {},
            requestRender: () => {}
        };
        mockCtx.helpers.ctx = mockCtx;
        mockCtx.furnitureManager = new FurnitureManager(mockCtx);
        mockCtx.decorManager = new DecorManager(mockCtx);

        const envBuilder = new EnvironmentBuilder(mockCtx);

        const levelsConfigArray = project.levels.map(l => ({
            id: l.id,
            name: l.name,
            type: l.type,
            height: l.height,
            defaultWallThickness: l.defaultWallThickness,
            data: l.data,
            isVisible: l.isVisible !== false
        }));

        const level0Data = typeof project.levels[0].data === 'string' ? JSON.parse(project.levels[0].data) : project.levels[0].data;

        console.log('Testing buildActiveFloor...');
        try {
            envBuilder.buildActiveFloor(
                level0Data.walls || [],
                level0Data.rooms || [],
                level0Data.shapes || [],
                level0Data.stairs || [],
                [],
                []
            );
            console.log('buildActiveFloor SUCCEEDED! Children:', structureGroup.children.length);
        } catch (err) {
            console.error('buildActiveFloor FAILED:', err);
            throw err;
        }

        console.log('Testing buildStaticFloors in preview mode...');
        try {
            envBuilder.buildStaticFloors(levelsConfigArray, 0, 'preview', []);
            console.log('buildStaticFloors SUCCEEDED! Children:', staticStructureGroup.children.length);
        } catch (err) {
            console.error('buildStaticFloors FAILED:', err);
            throw err;
        }
    });
});
