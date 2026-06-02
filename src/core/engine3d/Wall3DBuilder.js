import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, RAILING_REGISTRY } from '../registry.js';

export class Wall3DBuilder {
    constructor() {
        // Procedural noise bump texture for realistic wall finish
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx2d = canvas.getContext('2d');
        const imgData = ctx2d.createImageData(256, 256);
        for (let i = 0; i < imgData.data.length; i += 4) {
            const val = 150 + Math.random() * 50;
            imgData.data[i] = val; imgData.data[i + 1] = val; imgData.data[i + 2] = val; imgData.data[i + 3] = 255;
        }
        ctx2d.putImageData(imgData, 0, 0);
        this.wallBumpTex = new THREE.CanvasTexture(canvas);
        this.wallBumpTex.wrapS = this.wallBumpTex.wrapT = THREE.RepeatWrapping;
        this.wallBumpTex.repeat.set(2, 2);

        this.matMain = new THREE.MeshStandardMaterial({ 
            color: 0xf5f5f0, // Subtle warm off-white cream
            roughness: 0.95, 
            bumpMap: this.wallBumpTex, 
            bumpScale: 0.005 
        });
        this.matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xdddddb, roughness: 0.9 });
        this.matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
    }

    // Abstract method that works for both Active (Konva) and Static (JSON) walls
    buildWallGroup(length, thickness, wallData, startX, startY, angle, wallHeight = WALL_HEIGHT) {
        const wallShape = this._createShape(length, wallData.attachedWidgets, wallHeight);
        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: thickness, bevelEnabled: false, steps: 12 });
        wallGeo.translate(0, 0, -thickness / 2);

        let bbGeo = null;
        if (wallData.type !== 'railing') {
            const bbHeight = 4;
            const bbThick = thickness + 1.2;
            const bbShape = new THREE.Shape();
            bbShape.moveTo(0, 0); bbShape.lineTo(length, 0); bbShape.lineTo(length, bbHeight); bbShape.lineTo(0, bbHeight); bbShape.lineTo(0, 0);
            if (wallData.attachedWidgets) {
                wallData.attachedWidgets.forEach(widg => {
                    if (widg.type === 'door' || widg.configId === 'door') {
                        const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
                        hole.moveTo(wCenter - halfW, 0); hole.lineTo(wCenter + halfW, 0); hole.lineTo(wCenter + halfW, bbHeight); hole.lineTo(wCenter - halfW, bbHeight); hole.lineTo(wCenter - halfW, 0);
                        bbShape.holes.push(hole);
                    }
                });
            }
            bbGeo = new THREE.ExtrudeGeometry(bbShape, { depth: bbThick, bevelEnabled: false, steps: 12 });
            bbGeo.translate(0, 0, -bbThick / 2);
        }

        // ====== MITER JOINT SHEARING ======
        const startProfile = wallData.wallShapeData ? wallData.wallShapeData.startProfile : wallData.startProfile;
        const endProfile = wallData.wallShapeData ? wallData.wallShapeData.endProfile : wallData.endProfile;
        const pts = (wallData.poly && typeof wallData.poly.points === 'function') ? wallData.poly.points() : wallData.pts;
        
        let localSL_x = 0, localSR_x = 0, localEL_x = length, localER_x = length;
        
        if (startProfile && endProfile) {
            const toLocal = (ptX, ptY) => {
                const dx = ptX - startX; const dy = ptY - startY;
                const c = Math.cos(angle); const s = Math.sin(angle);
                return { x: dx * c + dy * s, z: -dx * s + dy * c };
            };
            const startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);
            const endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);

            const interpolateX = (profile, zTarget) => {
                if (profile.length === 1) return profile[0].x;
                if (zTarget <= profile[0].z) return profile[0].x;
                if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
                for (let i = 0; i < profile.length - 1; i++) {
                    const p1 = profile[i]; const p2 = profile[i+1];
                    if (zTarget >= p1.z && zTarget <= p2.z) {
                        if (p2.z === p1.z) return p1.x;
                        const t = (zTarget - p1.z) / (p2.z - p1.z);
                        return p1.x + t * (p2.x - p1.x);
                    }
                }
                return profile[0].x;
            };

            const shearGeo = (geo, isBaseboard = false) => {
                const pos = geo.attributes.position;
                const bbThick = thickness + 1.2;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i);
                    let z = pos.getZ(i);
                    if (isBaseboard) z *= (thickness / bbThick);

                    const sX = interpolateX(startProfileLocal, z);
                    const eX = interpolateX(endProfileLocal, z);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(wallGeo, false);
            if (bbGeo) shearGeo(bbGeo, true);
        } else if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => { return (ptX - startX) * Math.cos(angle) + (ptY - startY) * Math.sin(angle); };
            localSL_x = toLocalX(pts[0], pts[1]); localEL_x = toLocalX(pts[2], pts[3]); localER_x = toLocalX(pts[4], pts[5]); localSR_x = toLocalX(pts[6], pts[7]);

            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i); const z = pos.getZ(i);
                    const tZ = (z + thickness / 2) / thickness;
                    const sX = localSR_x + tZ * (localSL_x - localSR_x); const eX = localER_x + tZ * (localEL_x - localER_x);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(wallGeo);
            if (bbGeo) shearGeo(bbGeo);
        }

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
        
        if (bbGeo) {
            const bbMesh = new THREE.Mesh(bbGeo, this.matBaseboard);
            bbMesh.castShadow = true; bbMesh.receiveShadow = true;
            wallGroup.add(bbMesh);
        }
        wallGroup.add(wallMesh);

        return { wallGroup, wallGeo };
    }

    createHitboxes(length, thickness, wallData, isStatic = false, levelIndex = 0, wallIndex = 0, wallHeight = WALL_HEIGHT, startX = 0, startY = 0, angle = 0) {
        const hitboxes = [];
        
        const skinGeoFront = new THREE.PlaneGeometry(length - 0.5, wallHeight - 0.5);
        skinGeoFront.translate(length / 2, wallHeight / 2, thickness / 2 + 0.1);

        const skinGeoBack = new THREE.PlaneGeometry(length - 0.5, wallHeight - 0.5);
        skinGeoBack.translate(length / 2, wallHeight / 2, -thickness / 2 - 0.1);

        const startProfile = wallData.wallShapeData ? wallData.wallShapeData.startProfile : wallData.startProfile;
        const endProfile = wallData.wallShapeData ? wallData.wallShapeData.endProfile : wallData.endProfile;
        const pts = (wallData.poly && typeof wallData.poly.points === 'function') ? wallData.poly.points() : wallData.pts;
        
        if (startProfile && endProfile) {
            const toLocal = (ptX, ptY) => {
                const dx = ptX - startX; const dy = ptY - startY;
                const c = Math.cos(angle); const s = Math.sin(angle);
                return { x: dx * c + dy * s, z: -dx * s + dy * c };
            };
            const startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);
            const endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);

            const interpolateX = (profile, zTarget) => {
                if (profile.length === 1) return profile[0].x;
                if (zTarget <= profile[0].z) return profile[0].x;
                if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
                for (let i = 0; i < profile.length - 1; i++) {
                    const p1 = profile[i]; const p2 = profile[i+1];
                    if (zTarget >= p1.z && zTarget <= p2.z) {
                        if (p2.z === p1.z) return p1.x;
                        const t = (zTarget - p1.z) / (p2.z - p1.z);
                        return p1.x + t * (p2.x - p1.x);
                    }
                }
                return profile[0].x;
            };

            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i); const z = pos.getZ(i);
                    const sX = interpolateX(startProfileLocal, z);
                    const eX = interpolateX(endProfileLocal, z);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(skinGeoFront); shearGeo(skinGeoBack);
        } else if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => { return (ptX - startX) * Math.cos(angle) + (ptY - startY) * Math.sin(angle); };
            const localSL_x = toLocalX(pts[0], pts[1]), localEL_x = toLocalX(pts[2], pts[3]), localER_x = toLocalX(pts[4], pts[5]), localSR_x = toLocalX(pts[6], pts[7]);
            const shearGeo = (geo) => {
                const pos = geo.attributes.position;
                for (let i = 0; i < pos.count; i++) {
                    const x = pos.getX(i); const z = pos.getZ(i);
                    const tZ = (z + thickness / 2) / thickness;
                    const sX = localSR_x + tZ * (localSL_x - localSR_x); const eX = localER_x + tZ * (localEL_x - localER_x);
                    pos.setX(i, sX + (x / length) * (eX - sX));
                }
                geo.computeVertexNormals();
            };
            shearGeo(skinGeoFront); shearGeo(skinGeoBack);
        }

        const hitFront = new THREE.Mesh(skinGeoFront, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.userData = { isWallSide: true, side: 'front', entity: wallData };

        const hitBack = new THREE.Mesh(skinGeoBack, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
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