import * as THREE from 'three';
import { MaterialSlots, ComponentTypes } from '../../core/constants/materialSlots.js';
import { ComponentRegistry } from '../../core/engine3d/ComponentRegistry.js';
import { BIMComponentBuilder } from '../../core/engine3d/BIMComponentBuilder.js';
import { calculateFasciaAssembly, createBlockGeometry, createInnerFilletGeometry } from './fascia.geometry.js';
import { FASCIA_MATERIALS } from './fascia.registry.js';

/**
 * Builds and renders a 3D Elevation Fascia assembly with standard CAD/BIM Material Slots.
 */
export const renderFascia3D = (sceneGroup, entity, helpers) => {
    const builder = new BIMComponentBuilder(entity, helpers);
    const fasciaGroup = builder.group;

    const baseElev = entity.elevation || 0;
    const width = entity.width || 100;
    const height = entity.height || 120;
    const depth = entity.depth || 40;

    if (entity.localX !== undefined) {
        fasciaGroup.position.set(entity.localX, baseElev, 0);
        fasciaGroup.rotation.y = 0;
    } else {
        fasciaGroup.position.set(entity.x || 0, baseElev, entity.z || 0);
        fasciaGroup.rotation.y = -(entity.angle || 0);
    }

    const assembly = calculateFasciaAssembly(entity);
    entity.computedPts = assembly.computedPts;
    entity.computedZOffset = assembly.zOffset;

    let defaultColor = 0xffffff;
    if (entity.fasciaMat === 'dark_grey') defaultColor = 0x333333;
    else if (entity.fasciaMat === 'stone') defaultColor = 0xa8a29e;
    else if (entity.fasciaMat === 'wood') defaultColor = 0x8b5a2b;

    const fallbackMat = new THREE.MeshStandardMaterial({ color: defaultColor, roughness: 0.7 });

    // Render Blocks
    assembly.blocks.forEach((blk, idx) => {
        const geo = createBlockGeometry(blk.w, blk.h, blk.d, blk.radii);
        const slotName = blk.slot || MaterialSlots.FASCIA_FRAME;
        
        let materials = fallbackMat;
        if (helpers && helpers.getFaceMaterials) {
            const multiMat = helpers.getFaceMaterials(entity, fallbackMat, { width: blk.w, height: blk.h });
            materials = [multiMat.box[0], multiMat.box[1], multiMat.box[2], multiMat.box[3], multiMat.box[4], multiMat.box[5]];
        }

        const mesh = new THREE.Mesh(geo, materials);
        mesh.position.set(blk.x, blk.y + blk.h / 2, blk.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            entity,
            materialSlot: slotName,
            componentId: `${entity.id || 'fascia'}_${slotName}`,
            componentType: ComponentTypes.FASCIA || 'fascia'
        };

        ComponentRegistry.registerMesh(entity, slotName, mesh, {
            componentId: `${entity.id || 'fascia'}_${slotName}`,
            componentType: ComponentTypes.FASCIA || 'fascia'
        });

        fasciaGroup.add(mesh);
    });

    // Render Inner Fillets
    assembly.fillets.forEach((fillet) => {
        const geo = createInnerFilletGeometry(fillet.r, fillet.d, fillet.quad);
        if (!geo) return;

        const slotName = MaterialSlots.FASCIA_FRONT;
        let materials = fallbackMat;
        if (helpers && helpers.getFaceMaterials) {
            const multiMat = helpers.getFaceMaterials(entity, fallbackMat, { width: fillet.r, height: fillet.r });
            materials = [multiMat.box[0], multiMat.box[1], multiMat.box[2], multiMat.box[3], multiMat.box[4], multiMat.box[5]];
        }

        const mesh = new THREE.Mesh(geo, materials);
        mesh.position.set(fillet.x, fillet.y, fillet.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            entity,
            materialSlot: slotName,
            componentId: `${entity.id || 'fascia'}_${slotName}`,
            componentType: ComponentTypes.FASCIA || 'fascia'
        };

        ComponentRegistry.registerMesh(entity, slotName, mesh, {
            componentId: `${entity.id || 'fascia'}_${slotName}`,
            componentType: ComponentTypes.FASCIA || 'fascia'
        });

        fasciaGroup.add(mesh);
    });

    // Selection Hitbox
    const hitboxGeo = new THREE.BoxGeometry(width + 10, height + 10, depth + 20);
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    const hitboxMesh = new THREE.Mesh(hitboxGeo, hitboxMat);
    hitboxMesh.position.set(0, height / 2, assembly.zOffset);
    hitboxMesh.userData = { isHitbox: true, entity };
    fasciaGroup.add(hitboxMesh);

    fasciaGroup.userData = {
        isWidget: true,
        entity,
        componentType: ComponentTypes.FASCIA || 'fascia'
    };

    if (sceneGroup) {
        sceneGroup.add(fasciaGroup);
    }
    return fasciaGroup;
};
