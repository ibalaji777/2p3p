import * as THREE from 'three';
import { ComponentRegistry } from './ComponentRegistry.js';
import { MaterialSlots } from '../constants/materialSlots.js';
import { MaterialFactory } from './MaterialFactory.js';
import { UniversalMaterialManager } from './UniversalMaterialManager.js';
import { FLOOR_REGISTRY, WOOD_REGISTRY, DEFAULT_UNIVERSAL_TILE_SIZE } from '../registries/material.registry.js';

/**
 * Platform3DBuilder
 * 
 * Reusable 3D Geometry and Material Builder for Sims 4-style Platforms.
 * Follows the 3-Layer CAD/BIM Architecture:
 * - Layer 1: Component Registry (Platform selection & hover)
 * - Layer 2: Material Slots (top: floor material, side: platform trim material)
 * - Layer 3: Mesh Registry (O(1) Set<THREE.Mesh>)
 * 
 * In-place update methods guarantee that object identity is preserved
 * without tearing down the scene or resetting the camera.
 */
export class Platform3DBuilder {
    constructor(ctx) {
        this.ctx = ctx;
    }

    /**
     * Builds or updates in-place the 3D representation of a platform.
     * @param {Object} platform - PremiumPlatform instance.
     * @param {THREE.Group} [targetGroup] - Target parent group in scene.
     * @returns {THREE.Group}
     */
    buildPlatform(platform, targetGroup = this.ctx.structureGroup) {
        if (!platform || platform.isDeleted || platform.isHidden) return null;

        let group = platform.mesh3D;
        const isNew = !group;

        if (isNew) {
            group = new THREE.Group();
            group.name = `Platform_${platform.id}`;
            platform.mesh3D = group;
            if (targetGroup) targetGroup.add(group);
        }

        group.position.set(
            platform.x,
            (platform.elevation || 0) + (platform.height < 0 ? platform.height : 0),
            platform.y
        );
        group.rotation.set(0, -platform.rotation * Math.PI / 180, 0);

        group.userData = {
            entity: platform,
            isPlatform: true,
            isFloor: true,
            paintable: true,
            builder: this
        };

        this._constructMeshes(platform, group);

        // Register in interactables if not already present
        if (this.ctx.interactables) {
            group.traverse(child => {
                if (child.isMesh && !this.ctx.interactables.includes(child)) {
                    this.ctx.interactables.push(child);
                }
            });
        }

        return group;
    }

    /**
     * Constructs or updates top surface mesh and side trim meshes.
     */
    _constructMeshes(platform, group) {
        const absH = Math.max(1, Math.abs(platform.height || 20));
        const isSunken = platform.height < 0;
        const trimStyle = platform.trimStyle || 'flat';

        // 1. Calculate 2D contour points
        const contourPts = this._getContourPoints(platform);
        if (contourPts.length < 3) return;

        // Clean up previous children if needed
        while (group.children.length > 0) {
            const c = group.children[0];
            group.remove(c);
            if (c.geometry) c.geometry.dispose();
        }
        ComponentRegistry.unregisterEntity(platform);

        // 2. Build Top Surface Geometry
        const topShape = new THREE.Shape();
        topShape.moveTo(contourPts[0].x, contourPts[0].y);
        for (let i = 1; i < contourPts.length; i++) {
            topShape.lineTo(contourPts[i].x, contourPts[i].y);
        }
        topShape.closePath();

        const topGeo = new THREE.ShapeGeometry(topShape);
        topGeo.rotateX(-Math.PI / 2); // Lay horizontal
        topGeo.translate(0, isSunken ? 0.05 : absH, 0);

        // Apply physical planar world UVs to top geometry
        this._applyPlanarUVs(topGeo);

        // 3. Build Side Risers / Trim Geometry based on Trim Style
        const sideGeo = this._buildTrimGeometry(contourPts, absH, trimStyle, isSunken);

        // 4. Create or reuse PBR materials
        const matTop = this._resolveMaterial(platform.materials?.top?.id || 'wood_golden_teak', 'floor');
        const matSide = this._resolveMaterial(platform.materials?.side?.id || 'wood_white_oak', 'trim');

        // Top Mesh
        const topMesh = new THREE.Mesh(topGeo, matTop);
        topMesh.name = `Platform_Top_${platform.id}`;
        topMesh.castShadow = true;
        topMesh.receiveShadow = true;
        topMesh.userData = {
            entity: platform,
            materialSlot: 'top',
            isPlatformTop: true,
            isFloor: true,
            paintable: true
        };
        group.add(topMesh);
        ComponentRegistry.registerMesh(platform, 'top', topMesh);

        // Side Riser Mesh
        const sideMesh = new THREE.Mesh(sideGeo, matSide);
        sideMesh.name = `Platform_Side_${platform.id}`;
        sideMesh.castShadow = true;
        sideMesh.receiveShadow = true;
        sideMesh.userData = {
            entity: platform,
            materialSlot: 'side',
            isPlatformSide: true,
            paintable: true
        };
        group.add(sideMesh);
        ComponentRegistry.registerMesh(platform, 'side', sideMesh);

        // 5. Extra Accent for Recessed LED Trim Style
        if (trimStyle === 'recessed_led') {
            const ledGeo = this._buildLEDStripGeometry(contourPts);
            if (ledGeo) {
                const ledMat = new THREE.MeshStandardMaterial({
                    color: 0xfef08a,
                    emissive: new THREE.Color(0xfff566),
                    emissiveIntensity: 1.5,
                    side: THREE.DoubleSide
                });
                const ledMesh = new THREE.Mesh(ledGeo, ledMat);
                ledMesh.name = 'platform_led_strip';
                ledMesh.userData = { isPlatformLED: true };
                ledMesh.raycast = () => {}; // Zero-occlusion
                group.add(ledMesh);
            }
        }
    }

    /**
     * Applies physical world-space UV projection to top geometry.
     */
    _applyPlanarUVs(geo, tileSize = DEFAULT_UNIVERSAL_TILE_SIZE) {
        geo.computeVertexNormals();
        const pos = geo.attributes.position;
        const uvs = geo.attributes.uv;
        const ts = tileSize || 100;

        for (let i = 0; i < pos.count; i++) {
            const vx = pos.getX(i);
            const vz = pos.getZ(i);
            uvs.setXY(i, vx / ts, vz / ts);
        }
        uvs.needsUpdate = true;
    }

    /**
     * Resolves contour points from platform.
     */
    _getContourPoints(platform) {
        if (platform.shapeType === 'rect') {
            const hw = (platform.width || 120) / 2;
            const hd = (platform.depth || 120) / 2;
            return [
                { x: -hw, y: -hd },
                { x: hw, y: -hd },
                { x: hw, y: hd },
                { x: -hw, y: hd }
            ];
        } else if (platform.points && platform.points.length >= 3) {
            return platform.points.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
        }
        return [
            { x: -60, y: -60 },
            { x: 60, y: -60 },
            { x: 60, y: 60 },
            { x: -60, y: 60 }
        ];
    }

    /**
     * Builds perimeter side riser geometry according to Sims 4 trim styles.
     */
    _buildTrimGeometry(pts, height, trimStyle = 'flat', isSunken = false) {
        const n = pts.length;
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        let currentU = 0;
        const ts = DEFAULT_UNIVERSAL_TILE_SIZE || 100;

        // Base profile offsets
        const yBottom = isSunken ? 0 : 0;
        const yTop = isSunken ? height : height;

        // Build quad strips around the perimeter
        for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];

            const dx = p2.x - p1.x;
            const dz = p2.y - p1.y;
            const segLen = Math.hypot(dx, dz);
            if (segLen < 0.01) continue;

            // Unit outward normal
            const nx = dz / segLen;
            const nz = -dx / segLen;
            const outwardSign = isSunken ? -1 : 1; // Inward facing for sunken pits

            const nextU = currentU + segLen;

            // Profile specific geometry
            if (trimStyle === 'beveled' && height > 6) {
                // Beveled: Bottom vertical (height - 3), Chamfered top 45° (3cm)
                const yBevel = yTop - 3;
                const bOffset = 2.5;

                // 2 quads per segment: vertical riser + bevel chamfer
                const baseIdx = vertices.length / 3;

                // Vertices: 0=bot1, 1=bot2, 2=mid1, 3=mid2, 4=top1, 5=top2
                vertices.push(
                    p1.x, yBottom, p1.y,
                    p2.x, yBottom, p2.y,
                    p1.x, yBevel, p1.y,
                    p2.x, yBevel, p2.y,
                    p1.x - nx * bOffset, yTop, p1.y - nz * bOffset,
                    p2.x - nx * bOffset, yTop, p2.y - nz * bOffset
                );

                normals.push(
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign * 0.7, 0.7, nz * outwardSign * 0.7,
                    nx * outwardSign * 0.7, 0.7, nz * outwardSign * 0.7
                );

                uvs.push(
                    currentU / ts, yBottom / ts,
                    nextU / ts, yBottom / ts,
                    currentU / ts, yBevel / ts,
                    nextU / ts, yBevel / ts,
                    currentU / ts, yTop / ts,
                    nextU / ts, yTop / ts
                );

                // Lower quad
                indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
                indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);

                // Bevel quad
                indices.push(baseIdx + 2, baseIdx + 3, baseIdx + 4);
                indices.push(baseIdx + 3, baseIdx + 5, baseIdx + 4);

            } else if (trimStyle === 'recessed_led' && height > 6) {
                // Floating platform with 3cm recessed kickboard at base
                const kickH = 3.5;
                const kickRecess = 3.0;
                const baseIdx = vertices.length / 3;

                // Recessed kickboard + Upper overhang
                vertices.push(
                    p1.x - nx * kickRecess, yBottom, p1.y - nz * kickRecess,
                    p2.x - nx * kickRecess, yBottom, p2.y - nz * kickRecess,
                    p1.x - nx * kickRecess, yBottom + kickH, p1.y - nz * kickRecess,
                    p2.x - nx * kickRecess, yBottom + kickH, p2.y - nz * kickRecess,
                    p1.x, yBottom + kickH, p1.y,
                    p2.x, yBottom + kickH, p2.y,
                    p1.x, yTop, p1.y,
                    p2.x, yTop, p2.y
                );

                for (let k = 0; k < 8; k++) {
                    normals.push(nx * outwardSign, 0, nz * outwardSign);
                }

                uvs.push(
                    currentU / ts, 0,
                    nextU / ts, 0,
                    currentU / ts, kickH / ts,
                    nextU / ts, kickH / ts,
                    currentU / ts, kickH / ts,
                    nextU / ts, kickH / ts,
                    currentU / ts, yTop / ts,
                    nextU / ts, yTop / ts
                );

                // Recessed kick quad
                indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
                indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);

                // Upper main quad
                indices.push(baseIdx + 4, baseIdx + 5, baseIdx + 6);
                indices.push(baseIdx + 5, baseIdx + 7, baseIdx + 6);

            } else {
                // Clean Modern Flat Riser (Default & Stone/Classical/Bullnose base)
                const baseIdx = vertices.length / 3;

                vertices.push(
                    p1.x, yBottom, p1.y,
                    p2.x, yBottom, p2.y,
                    p1.x, yTop, p1.y,
                    p2.x, yTop, p2.y
                );

                normals.push(
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign, 0, nz * outwardSign,
                    nx * outwardSign, 0, nz * outwardSign
                );

                uvs.push(
                    currentU / ts, yBottom / ts,
                    nextU / ts, yBottom / ts,
                    currentU / ts, yTop / ts,
                    nextU / ts, yTop / ts
                );

                indices.push(baseIdx, baseIdx + 1, baseIdx + 2);
                indices.push(baseIdx + 1, baseIdx + 3, baseIdx + 2);
            }

            currentU = nextU;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        return geo;
    }

    /**
     * Builds glowing LED accent line geometry along recessed kicker.
     */
    _buildLEDStripGeometry(pts) {
        const n = pts.length;
        const vertices = [];
        const yLED = 3.2;

        for (let i = 0; i < n; i++) {
            const p1 = pts[i];
            const p2 = pts[(i + 1) % n];
            const dx = p2.x - p1.x;
            const dz = p2.y - p1.y;
            const len = Math.hypot(dx, dz);
            if (len < 0.01) continue;
            const nx = dz / len;
            const nz = -dx / len;

            const rx1 = p1.x - nx * 2.8;
            const rz1 = p1.y - nz * 2.8;
            const rx2 = p2.x - nx * 2.8;
            const rz2 = p2.y - nz * 2.8;

            // Thin ribbon strip
            vertices.push(
                rx1, yLED - 0.4, rz1,
                rx2, yLED - 0.4, rz2,
                rx1, yLED + 0.4, rz1,
                rx2, yLED - 0.4, rz2,
                rx2, yLED + 0.4, rz2,
                rx1, yLED + 0.4, rz1
            );
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        return geo;
    }

    /**
     * Resolves PBR Material from registry.
     */
    _resolveMaterial(matId, fallbackType = 'floor') {
        const config = FLOOR_REGISTRY[matId] || WOOD_REGISTRY[matId] || UniversalMaterialManager.getMaterial(matId);
        const mat = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.6,
            metalness: 0.1,
            side: THREE.DoubleSide
        });

        if (config) {
            const cfg = { ...config, tileSize: 100 };
            MaterialFactory.buildPBRMaterial({
                material: mat,
                config: cfg,
                ctx: this.ctx,
                dimensions: { width: 100, height: 100 },
                faceName: fallbackType
            }).then(() => {
                if (mat.map) {
                    mat.map = mat.map.clone();
                    mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
                    mat.map.repeat.set(1.0, 1.0);
                    mat.map.needsUpdate = true;
                }
                if (this.ctx?.requestRender) this.ctx.requestRender('material_loaded', 2);
            });
        } else {
            mat.color.setHex(fallbackType === 'floor' ? 0xd4a373 : 0xf8fafc);
        }

        return mat;
    }

    /* -------------------------------------------------------------------------- */
    /*                         IN-PLACE UPDATE METHODS                            */
    /* -------------------------------------------------------------------------- */

    /**
     * Updates platform geometry in place without recreating meshes.
     */
    updatePlatformGeometry(platform) {
        if (!platform.mesh3D) return;
        const group = platform.mesh3D;

        group.position.set(
            platform.x,
            (platform.elevation || 0) + (platform.height < 0 ? platform.height : 0),
            platform.y
        );
        group.rotation.set(0, -platform.rotation * Math.PI / 180, 0);

        this._constructMeshes(platform, group);

        if (this.ctx?.requestRender) {
            this.ctx.requestRender();
        }
    }

    /**
     * Updates platform materials in place.
     */
    updatePlatformMaterials(platform) {
        if (!platform.mesh3D) return;
        const group = platform.mesh3D;

        group.traverse(child => {
            if (child.userData?.isPlatformTop) {
                child.material = this._resolveMaterial(platform.materials?.top?.id || 'wood_golden_teak', 'floor');
            } else if (child.userData?.isPlatformSide) {
                child.material = this._resolveMaterial(platform.materials?.side?.id || 'wood_white_oak', 'trim');
            }
        });

        if (this.ctx?.requestRender) {
            this.ctx.requestRender();
        }
    }

    updatePlatformMaterial(platform) {
        return this.updatePlatformMaterials(platform);
    }

    /**
     * Updates platform transform in place.
     */
    updatePlatformTransform(platform) {
        if (!platform.mesh3D) return;
        platform.mesh3D.position.set(
            platform.x,
            (platform.elevation || 0) + (platform.height < 0 ? platform.height : 0),
            platform.y
        );
        platform.mesh3D.rotation.set(0, -platform.rotation * Math.PI / 180, 0);
        if (this.ctx?.requestRender) {
            this.ctx.requestRender();
        }
    }
}
