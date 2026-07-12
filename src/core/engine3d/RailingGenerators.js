import * as THREE from 'three';
import { RAILING_REGISTRY } from '../registry.js';

/**
 * Builds continuous procedural extrusions along the railing path.
 * If entity.poly exists, it uses the mitered 2D boundaries for clean corners.
 * Otherwise, it falls back to a straight BoxGeometry.
 */
function buildContinuousRail(length, railHeight, thickness, yOffset, entity, material) {
    let geo;
    if (entity.poly && typeof entity.poly.points === 'function') {
        const pts = entity.poly.points();
        if (pts && pts.length === 8) {
            const shape = new THREE.Shape();
            shape.moveTo(pts[0], pts[1]);
            shape.lineTo(pts[2], pts[3]);
            shape.lineTo(pts[4], pts[5]);
            shape.lineTo(pts[6], pts[7]);
            shape.lineTo(pts[0], pts[1]);
            
            geo = new THREE.ExtrudeGeometry(shape, { depth: railHeight, bevelEnabled: false });
            geo.rotateX(Math.PI / 2);
            
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.set(0, yOffset + railHeight, 0);
            mesh.castShadow = true; mesh.receiveShadow = true;
            return mesh;
        }
    }
    
    geo = new THREE.BoxGeometry(length, railHeight, thickness);
    geo.translate(length / 2, yOffset + railHeight / 2, 0);
    const mesh = new THREE.Mesh(geo, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
}

/**
 * Spawns vertical instances (posts or balusters) evenly across the length.
 */
function buildInstancedPosts(length, height, thickness, depth, spacing, material, isMitered, polyPts = null, yOffset = 0) {
    const geo = new THREE.BoxGeometry(thickness, height, depth);
    geo.translate(0, yOffset + (height / 2), 0);
    
    const count = Math.max(2, Math.floor(length / spacing) + 1);
    const actualSpacing = length / (count - 1 || 1);
    
    const instancedMesh = new THREE.InstancedMesh(geo, material, count);
    instancedMesh.castShadow = true; instancedMesh.receiveShadow = true;
    
    const dummy = new THREE.Object3D();
    
    if (isMitered && polyPts) {
        // Find the center vector of the mitered box to place posts along the line
        // Midpoint of start edge
        const startX = (polyPts[0] + polyPts[6]) / 2;
        const startY = (polyPts[1] + polyPts[7]) / 2;
        // Midpoint of end edge
        const endX = (polyPts[2] + polyPts[4]) / 2;
        const endY = (polyPts[3] + polyPts[5]) / 2;
        
        const dx = endX - startX;
        const dy = endY - startY;
        const angle = -Math.atan2(dy, dx);
        
        for (let i = 0; i < count; i++) {
            const t = count === 1 ? 0 : i / (count - 1);
            dummy.position.set(startX + dx * t, 0, startY + dy * t);
            dummy.rotation.y = angle;
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
    } else {
        for (let i = 0; i < count; i++) {
            dummy.position.set(i * actualSpacing, 0, 0);
            dummy.rotation.set(0,0,0);
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);
        }
    }
    
    instancedMesh.instanceMatrix.needsUpdate = true;
    return instancedMesh;
}

const buildGlassRailing = (group, entity, materials) => {
    const length = entity.length3D || entity.width || 100;
    const height = entity.height || entity.config?.height || 40;
    const isMitered = !!(entity.poly && typeof entity.poly.points === 'function');
    const polyPts = isMitered ? entity.poly.points() : null;
    
    const glassMat = materials.glass;
    const metalMat = materials.metal;
    
    // Top Rail (Handrail)
    group.add(buildContinuousRail(length, 3, 5, height - 3, entity, metalMat));
    
    // Bottom Rail
    group.add(buildContinuousRail(length, 3, 5, 2, entity, metalMat));
    
    // Glass Pane
    group.add(buildContinuousRail(length, height - 8, 2, 4, entity, glassMat));
    
    // Posts (Metal)
    group.add(buildInstancedPosts(length, height, 4, 4, 120, metalMat, isMitered, polyPts, 0));
};

// Logic for other railing types removed (to be implemented later)

export const generateRailing3D = (type, group, entity, assetsManager = null) => {
    // 1. Fetch registry config
    let config = {};
    if (entity && entity.config) {
        config = entity.config;
    } else {
        // Fallback if entity.config is missing (e.g. from some preview calls)
        config = RAILING_REGISTRY[type] || {};
    }

    // 2. Setup dynamic materials based on config
    const materials = {
        glass: new THREE.MeshStandardMaterial({ 
            color: config.color !== undefined ? config.color : 0x88ccff, 
            transparent: config.transparent !== undefined ? config.transparent : true, 
            opacity: config.opacity !== undefined ? config.opacity : 0.4, 
            roughness: config.roughness !== undefined ? config.roughness : 0.1, 
            metalness: config.metalness !== undefined ? config.metalness : 0.1, 
            side: THREE.DoubleSide 
        }),
        metal: new THREE.MeshStandardMaterial({ 
            color: config.color !== undefined ? config.color : 0x333333, 
            metalness: config.metalness !== undefined ? config.metalness : 0.8, 
            roughness: config.roughness !== undefined ? config.roughness : 0.3 
        }),
        wood: new THREE.MeshStandardMaterial({ 
            color: config.color !== undefined ? config.color : 0x6e4321, 
            roughness: config.roughness !== undefined ? config.roughness : 0.9 
        })
    };

    // Only build glass railing for now
    buildGlassRailing(group, entity, materials);
};
