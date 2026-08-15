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
            
            const rawType = entity.type || 'stair_v5_straight';
            const extractedShape = (rawType && rawType.includes('stair_v5_')) ? rawType.split('stair_v5_')[1] : (entity.shape || 'straight');
            const shape = extractedShape || 'straight';
            
            // Pure payload pass-through: preserve all exact parameters from the input payload
            const stairPayload = { 
                ...entity,
                type: (rawType && rawType.startsWith('stair_v5_')) ? rawType : `stair_v5_${shape}`,
                shape: shape, 
                x: 0, y: 0, elevation: 0, rotation: 0,
                hasUnderWall: false    
            };
            
            const stairWrapper = new THREE.Group();
            stairBuilder.build([stairPayload], stairWrapper, 0, false, 300);
            
            sceneGroup.add(stairWrapper);
            
            // Center the staircase for the thumbnail view
            const stairBox = new THREE.Box3().setFromObject(stairWrapper);
            const center = stairBox.getCenter(new THREE.Vector3());
            stairWrapper.position.sub(center);
            
            return stairWrapper;
        }
    }
};
