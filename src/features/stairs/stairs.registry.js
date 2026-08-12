import * as THREE from 'three';
import { Stair3DBuilder } from './stairs.renderer3d.js';

export const STAIRCASE_REGISTRY = {
    'staircase': {
        widget: "staircase",
        label: "STAIRCASE",
        events: ["drag_along_wall", "snap_to_corners"],
        defaultConfig: {
            width: 40,
            length: 120,
            height: 120,
            steps: 10,
            stepDepth: 28,
            stepHeight: 17.5,
            direction: 'up',
            shape: 'rectangular',
            innerRadius: 20,
            arrowDirection: 'forward',
            stringerType: 'solid',
            materials: {
                treads: { id: 'wood_oak' },
                stringers: { id: 'wood_oak' },
                risers: { id: 'wood_oak' },
                landings: { id: 'wood_oak' }
            }
        },
        render3D: (sceneGroup, entity, helpers) => {
            const assets = (helpers && helpers.ctx) ? helpers.ctx.assets : { getTexture: () => null };
            const interactables = (helpers && helpers.ctx) ? helpers.ctx.interactables : [];
            
            const stairBuilder = new Stair3DBuilder(assets, interactables, helpers);
            
            const shape = entity.type ? entity.type.split('stair_v5_')[1] : 'straight';
            const dummyStair = { 
                ...entity,
                shape, 
                x: 0, y: 0, elevation: 0, rotation: 0,
                railingLayout: 'none', 
                hasUnderWall: false    
            };
            
            if (dummyStair.steps && !dummyStair.totalSteps) dummyStair.totalSteps = dummyStair.steps;
            if (!dummyStair.totalSteps) dummyStair.totalSteps = 10; 
            if (!dummyStair.flight1Steps) dummyStair.flight1Steps = 5;
            if (!dummyStair.flight2Steps) dummyStair.flight2Steps = 5;
            
            const stairWrapper = new THREE.Group();
            stairBuilder.build([dummyStair], stairWrapper, 0, false, 300);
            
            sceneGroup.add(stairWrapper);
            
            // Center the staircase for the thumbnail view
            const stairBox = new THREE.Box3().setFromObject(stairWrapper);
            const center = stairBox.getCenter(new THREE.Vector3());
            stairWrapper.position.sub(center);
            
            return stairWrapper;
        }
    }
};
