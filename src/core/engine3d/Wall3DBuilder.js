import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, RAILING_REGISTRY } from '../registry.js';

export class Wall3DBuilder {
    constructor() {
        this.matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        this.matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
    }

    // Abstract method that works for both Active (Konva) and Static (JSON) walls
    buildWallGroup(length, thickness, wallData, startX, startY, angle, wallHeight = WALL_HEIGHT) {
        const wallShape = this._createShape(length, wallData.attachedWidgets, wallHeight);
        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: thickness, bevelEnabled: false });
        wallGeo.translate(0, 0, -thickness / 2);

        let materials = [this.matMain, this.matEdgeDark];
        
        if (wallData.type === 'railing') {
            const configId = wallData.configId || 'glass';
            const rConf = RAILING_REGISTRY[configId];
            if (rConf) {
                let railMat;
                if (rConf.texture) {
                    const tex = new THREE.TextureLoader().load(rConf.texture);
                    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    tex.repeat.set(length / (100 * (rConf.repeat || 1)), wallHeight / (100 * (rConf.repeat || 1)));
                    railMat = new THREE.MeshStandardMaterial({ map: tex, roughness: rConf.roughness || 0.8, side: THREE.DoubleSide });
                } else {
                    railMat = new THREE.MeshStandardMaterial({ 
                        color: rConf.color, roughness: rConf.roughness || 0.3, 
                        metalness: rConf.metalness || 0.1, transparent: rConf.transparent || false, 
                        opacity: rConf.opacity || 1.0, side: THREE.DoubleSide 
                    });
                }
                materials = [railMat, railMat];
            }
        }
        
        const wallMesh = new THREE.Mesh(wallGeo, materials);
        wallMesh.castShadow = true; 
        wallMesh.receiveShadow = true;

        const wallGroup = new THREE.Group();
        wallGroup.position.set(startX, 0, startY);
        wallGroup.rotation.y = -angle;
        wallGroup.add(wallMesh);

        return { wallGroup, wallGeo };
    }

    createHitboxes(length, thickness, wallData, isStatic = false, levelIndex = 0, wallIndex = 0, wallHeight = WALL_HEIGHT) {
        const hitboxes = [];
        
        // Front and Back skins for editing textures
        const skinGeo = new THREE.PlaneGeometry(length - 0.5, wallHeight - 0.5);
        skinGeo.translate(length / 2, wallHeight / 2, 0);

        const hitFront = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.position.set(0, 0, thickness / 2 + 0.1);
        hitFront.userData = { isWallSide: true, side: 'front', entity: wallData };

        const hitBack = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitBack.position.set(0, 0, -thickness / 2 - 0.1);
        hitBack.userData = { isWallSide: true, side: 'back', entity: wallData };

        hitboxes.push(hitFront, hitBack);

        // If it's a static wall, add a volume trigger to catch "Switch Floor" clicks
        if (isStatic) {
            const volGeo = new THREE.BoxGeometry(length, wallHeight, thickness);
            volGeo.translate(length / 2, wallHeight / 2, 0);
            const trigger = new THREE.Mesh(volGeo, new THREE.MeshBasicMaterial({ visible: false }));
            trigger.userData = { isFloorTrigger: true, levelIndex, entityIndex: wallIndex, entityType: 'wall' };
            hitboxes.push(trigger);
        }

        return hitboxes;
    }

    createJoint(x, y, thickness, wallHeight = WALL_HEIGHT) {
        const jointGeo = new THREE.CylinderGeometry(thickness / 2, thickness / 2, wallHeight, 32);
        const jointMesh = new THREE.Mesh(jointGeo, this.matMain);
        jointMesh.position.set(x, wallHeight / 2, y);
        jointMesh.castShadow = true; 
        jointMesh.receiveShadow = true;
        return jointMesh;
    }

    _createShape(length, widgets, wallHeight = WALL_HEIGHT) {
        const wallShape = new THREE.Shape();
        wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, wallHeight); wallShape.lineTo(0, wallHeight); wallShape.lineTo(0, 0);

        if (!widgets) return wallShape;

        widgets.forEach(widg => {
            const hole = new THREE.Path();
            const wCenter = length * widg.t; 
            const halfW = widg.width / 2;
            const type = widg.type || widg.configId; 
            
            if (type === 'door') {
                hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, DOOR_HEIGHT); hole.lineTo(wCenter - halfW, 0); // Doors always go from 0 to DOOR_HEIGHT
            } else if (type === 'window') {
                hole.moveTo(wCenter - halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL); hole.lineTo(wCenter + halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL + WINDOW_HEIGHT); hole.lineTo(wCenter - halfW, WINDOW_SILL); // Windows are relative to WINDOW_SILL
            }
            wallShape.holes.push(hole);
        });
        return wallShape;
    }
}