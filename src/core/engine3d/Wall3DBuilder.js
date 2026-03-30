import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT } from '../registry.js';

export class Wall3DBuilder {
    constructor() {
        this.matMain = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
        this.matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.8 });
    }

    // Abstract method that works for both Active (Konva) and Static (JSON) walls
    buildWallGroup(length, thickness, widgets, startX, startY, angle) {
        const wallShape = this._createShape(length, widgets);
        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: thickness, bevelEnabled: false });
        wallGeo.translate(0, 0, -thickness / 2);
        
        const wallMesh = new THREE.Mesh(wallGeo, [this.matMain, this.matEdgeDark]);
        wallMesh.castShadow = true; 
        wallMesh.receiveShadow = true;

        const wallGroup = new THREE.Group();
        wallGroup.position.set(startX, 0, startY);
        wallGroup.rotation.y = -angle;
        wallGroup.add(wallMesh);

        return { wallGroup, wallGeo };
    }

    createHitboxes(length, thickness, wallData, isStatic = false, levelIndex = 0, wallIndex = 0) {
        const hitboxes = [];
        
        // Front and Back skins for editing textures
        const skinGeo = new THREE.PlaneGeometry(length - 0.5, WALL_HEIGHT - 0.5);
        skinGeo.translate(length / 2, WALL_HEIGHT / 2, 0);

        const hitFront = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.position.set(0, 0, thickness / 2 + 0.1);
        hitFront.userData = { isWallSide: true, side: 'front', entity: wallData };

        const hitBack = new THREE.Mesh(skinGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitBack.position.set(0, 0, -thickness / 2 - 0.1);
        hitBack.userData = { isWallSide: true, side: 'back', entity: wallData };

        hitboxes.push(hitFront, hitBack);

        // If it's a static wall, add a volume trigger to catch "Switch Floor" clicks
        if (isStatic) {
            const volGeo = new THREE.BoxGeometry(length, WALL_HEIGHT, thickness);
            volGeo.translate(length / 2, WALL_HEIGHT / 2, 0);
            const trigger = new THREE.Mesh(volGeo, new THREE.MeshBasicMaterial({ visible: false }));
            trigger.userData = { isFloorTrigger: true, levelIndex, entityIndex: wallIndex, entityType: 'wall' };
            hitboxes.push(trigger);
        }

        return hitboxes;
    }

    createJoint(x, y, thickness) {
        const jointGeo = new THREE.CylinderGeometry(thickness / 2, thickness / 2, WALL_HEIGHT, 32);
        const jointMesh = new THREE.Mesh(jointGeo, this.matMain);
        jointMesh.position.set(x, WALL_HEIGHT / 2, y);
        jointMesh.castShadow = true; 
        jointMesh.receiveShadow = true;
        return jointMesh;
    }

    _createShape(length, widgets) {
        const wallShape = new THREE.Shape();
        wallShape.moveTo(0, 0); wallShape.lineTo(length, 0); wallShape.lineTo(length, WALL_HEIGHT); wallShape.lineTo(0, WALL_HEIGHT); wallShape.lineTo(0, 0);

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