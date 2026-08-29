import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Molding3DBuilder } from './Molding3DBuilder.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
import { Railing3DBuilder } from '../../features/railing/builders/Railing3DBuilder.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, GLASS_REGISTRY, offsetPolygon } from '../../core/registry';
import { DEFAULT_UNIVERSAL_TILE_SIZE } from '../registries/material.registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { UniversalMaterialManager } from './UniversalMaterialManager.js';
import { computeLevelElevations } from './helpers/levelElevations.js';

let _sharedPlasterMaterial = null;
let _plasterUniforms = {
    floorBounceColor: { value: new THREE.Color(0xfaf8ed) },
    bounceIntensity: { value: 0.15 },
    skyColor: { value: new THREE.Color(0xe0eaf5) },
    wallHeight: { value: 300.0 }
};

window.updateFloorBounce = function(color, intensity) {
    if (_plasterUniforms) {
        _plasterUniforms.floorBounceColor.value.copy(color);
        _plasterUniforms.bounceIntensity.value = intensity;
    }
};

window.updateSkyBounce = function(color) {
    if (_plasterUniforms) {
        _plasterUniforms.skyColor.value.copy(color);
    }
};

function getPlasterMaterial() {
    if (_sharedPlasterMaterial) return _sharedPlasterMaterial;
    
    _sharedPlasterMaterial = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.85,
        metalness: 0.05,
        side: THREE.DoubleSide,
        envMapIntensity: 0.8,
        flatShading: false
    });
    return _sharedPlasterMaterial;

    return _sharedPlasterMaterial;
}

export class EnvironmentBuilder {
    constructor(ctx) {
        this.ctx = ctx;
        this.moldingBuilder = new Molding3DBuilder();
        this.stairBuilder = new Stair3DBuilder(ctx.assets, ctx.interactables, ctx.helpers);
    }

    setupBaseEnvironment() {
        this.ctx.scene.background = new THREE.Color(0xf3f4f6);
        this.ctx.scene.fog = new THREE.Fog(0xf3f4f6, 600, 4500); // Linear fog for a seamless architectural horizon

        const groundGeo = new THREE.PlaneGeometry(10000, 10000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5; // Sit cleanly below room floors
        ground.receiveShadow = true;
        this.ctx.scene.add(ground);
        this.ground = ground;

        const grid = new THREE.GridHelper(5000, 250, 0x000000, 0x000000);
        grid.position.y = -0.05; // Positioned below room floor surface (y = 0.05) to eliminate z-fighting
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.ctx.scene.add(grid);
        this.grid = grid;

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x888888, 0.4);
        hemiLight.position.set(0, 500, 0);
        this.ctx.scene.add(hemiLight);
        this.hemiLight = hemiLight;

        const sunLight = new THREE.DirectionalLight(0xffeedd, 2.5);
        sunLight.position.set(-600, 800, -300);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.bias = -0.00005; 
        sunLight.shadow.normalBias = 0.05; // Prevents shadow acne without detaching shadows
        sunLight.shadow.radius = 2; // Extra crisp, low-noise soft shadows
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 3000;
        const d = 1500; // Optimal shadow frustum size
        sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
        this.ctx.scene.add(sunLight);
        this.sunLight = sunLight;

        // Fill Light (Soft sky bounce to subtly reveal interior details without washing out shadows)
        const fillLight = new THREE.DirectionalLight(0xe2e8f0, 0.4);
        fillLight.position.set(400, 300, 600);
        this.ctx.scene.add(fillLight);
        this.fillLight = fillLight;

        // Procedural Sky
        this.sky = new Sky();
        this.sky.scale.setScalar(10000);
        this.ctx.scene.add(this.sky);
        
        const skyUniforms = this.sky.material.uniforms;
        skyUniforms['turbidity'].value = 3;
        skyUniforms['rayleigh'].value = 0.5;
        skyUniforms['mieCoefficient'].value = 0.005;
        skyUniforms['mieDirectionalG'].value = 0.8;
        skyUniforms['sunPosition'].value.copy(sunLight.position);
    }

    setEnvironment(skyKey, groundKey) {
        const skyConfig = SKY_REGISTRY[skyKey];
        if (skyConfig) {
            if (skyConfig.type === 'hdri' && skyConfig.url) {
                const loader = new HDRLoader();
                loader.load(skyConfig.url, (texture) => {
                    if (!this.pmremGenerator && this.ctx.renderer) {
                        this.pmremGenerator = new THREE.PMREMGenerator(this.ctx.renderer);
                        this.pmremGenerator.compileEquirectangularShader();
                    }
                    if (this.pmremGenerator) {
                        const envMap = this.pmremGenerator.fromEquirectangular(texture).texture;
                        this.ctx.scene.environment = envMap;
                        this.ctx.scene.background = envMap; // Use filtered map for background too, or raw texture
                        texture.dispose();
                    } else {
                        texture.mapping = THREE.EquirectangularReflectionMapping;
                        this.ctx.scene.background = texture;
                        this.ctx.scene.environment = texture;
                    }
                    if (this.ctx.requestRender) this.ctx.requestRender();
                });
                if (this.ctx.scene.fog) this.ctx.scene.fog.color.setHex(skyConfig.fogColor || 0xe0eaf5);
            } else if (skyConfig.skyColor) {
                if (this.sky) this.sky.visible = true; // Use procedural sky
                // We keep background null so the sky object is visible
                this.ctx.scene.background = null;
                if (this.ctx.scene.fog) this.ctx.scene.fog.color.setHex(skyConfig.fogColor || skyConfig.skyColor);
                this.ctx.scene.environment = null;
            }
            if (this.hemiLight) {
                this.hemiLight.color.setHex(skyConfig.hemiSky || 0xffffff);
                this.hemiLight.groundColor.setHex(skyConfig.hemiGround || 0x444444);
                this.hemiLight.intensity = skyConfig.hemi || 1.0;
            }
            if (this.sunLight) {
                this.sunLight.color.setHex(skyConfig.sunColor || 0xffffff);
                this.sunLight.intensity = skyConfig.sun || 1.0;
                if (this.sky) {
                    this.sky.material.uniforms['sunPosition'].value.copy(this.sunLight.position);
                }
            }
            if (window.updateSkyBounce) {
                window.updateSkyBounce(new THREE.Color(skyConfig.hemiSky || skyConfig.skyColor || skyConfig.fogColor || 0xffffff));
            }
        }

        const groundConfig = GROUND_REGISTRY[groundKey];
        if (groundConfig && this.ground) {
            if (groundConfig.color) {
                this.ground.material.color.setHex(groundConfig.color);
                this.ground.material.map = null;
                this.ground.material.fog = false; // Disable fog gradient for solid studio bases
                this.ground.material.needsUpdate = true;
                if (this.ctx.requestRender) this.ctx.requestRender();
            }
            if (groundConfig.texture) {
                this.ctx.assets.getTexture(groundConfig).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    texClone.repeat.set(groundConfig.repeat || 100, groundConfig.repeat || 100);
                    this.ground.material.map = texClone;
                    this.ground.material.color.setHex(0xffffff);
                    this.ground.material.fog = true;
                    this.ground.material.needsUpdate = true;
                    if (this.ctx.requestRender) this.ctx.requestRender();
                });
            }
        }
    }

    buildActiveFloor(walls, rooms, shapes, stairs = [], stairsBelow = [], outdoorZones = []) {
        let maxWallHeight = WALL_HEIGHT;
        if (walls && walls.length > 0) {
            const mainWalls = walls.filter(w => !w.parentGroup);
            if (mainWalls.length > 0) maxWallHeight = Math.max(...mainWalls.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
        }
        this.stairBuilder.build(stairs, this.ctx.structureGroup, 0, false, maxWallHeight);
        if (outdoorZones && outdoorZones.length > 0) {
            this.buildOutdoorZones(outdoorZones, this.ctx.structureGroup);
        }

        const matMain = getPlasterMaterial();
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9 });
        const matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });

        const isSubStructure = this.activeLevelConfig?.type === 'plinth' || this.activeLevelConfig?.type === 'foundation';
        const subH = this.activeLevelHeight || (this.activeLevelConfig?.type === 'plinth' ? 18 : 40);

        if (rooms) {
            rooms.forEach(room => {
                try {
                    if (room.isDeleted || room.isHidden) return;
                    const cleanPolygonPts = (p) => {
                        if (!p || p.length < 3) return [];
                        const res = [];
                        for (let i = 0; i < p.length; i++) {
                            const pt = { x: p[i].x, y: p[i].y };
                            if (res.length === 0 || Math.hypot(pt.x - res[res.length - 1].x, pt.y - res[res.length - 1].y) > 0.5) {
                                res.push(pt);
                            }
                        }
                        if (res.length > 2 && Math.hypot(res[res.length - 1].x - res[0].x, res[res.length - 1].y - res[0].y) < 0.5) {
                            res.pop();
                        }
                        return res;
                    };

                    const cleanPath = cleanPolygonPts(room.path);
                    if (cleanPath.length < 3) return;

                    // THREE.Shape outer contour MUST be Counter-Clockwise (CCW)
                    const isOuterCW = THREE.ShapeUtils.isClockWise(cleanPath);
                    const outerPts = isOuterCW ? [...cleanPath].reverse() : cleanPath;

                    const floorShape = new THREE.Shape();
                    floorShape.moveTo(outerPts[0].x, outerPts[0].y);
                    for (let i = 1; i < outerPts.length; i++) floorShape.lineTo(outerPts[i].x, outerPts[i].y);
                    floorShape.closePath();
                    
                    // Auto-hole carving for interior rooms contained inside an outer courtyard / compound floor
                    const getPolyArea = (p) => {
                        if (!p || p.length < 3) return 0;
                        let a = 0;
                        for (let i = 0; i < p.length; i++) {
                            const next = p[(i + 1) % p.length];
                            a += (p[i].x * next.y - next.x * p[i].y);
                        }
                        return Math.abs(a / 2);
                    };

                    const pointInPoly = (p, poly) => {
                        let inside = false;
                        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
                            const xi = poly[i].x, yi = poly[i].y;
                            const xj = poly[j].x, yj = poly[j].y;
                            const intersect = ((yi > p.y) !== (yj > p.y)) && (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
                            if (intersect) inside = !inside;
                        }
                        return inside;
                    };

                    const areaSelf = getPolyArea(cleanPath);
                    let isContainerRoom = false;

                    rooms.forEach(otherRoom => {
                        if (otherRoom === room || otherRoom.isDeleted || otherRoom.isHidden) return;
                        const otherClean = cleanPolygonPts(otherRoom.path);
                        if (otherClean.length < 3) return;

                        const areaOther = getPolyArea(otherClean);

                        // If other room is smaller and its center is inside our polygon, it is an enclosed room
                        if (areaOther < areaSelf * 0.98) {
                            let cx = 0, cy = 0;
                            otherClean.forEach(p => { cx += p.x; cy += p.y; });
                            cx /= otherClean.length;
                            cy /= otherClean.length;

                            if (pointInPoly({ x: cx, y: cy }, cleanPath)) {
                                isContainerRoom = true;
                                // THREE.Shape holes MUST be Clockwise (CW)
                                const isHoleCW = THREE.ShapeUtils.isClockWise(otherClean);
                                const holePts = isHoleCW ? otherClean : [...otherClean].reverse();

                                const hole = new THREE.Path();
                                hole.moveTo(holePts[0].x, holePts[0].y);
                                for (let i = 1; i < holePts.length; i++) {
                                    hole.lineTo(holePts[i].x, holePts[i].y);
                                }
                                hole.closePath();
                                floorShape.holes.push(hole);
                            }
                        }
                    });

                // Auto-cutting for stairs removed as per user request (User relies on manual polygon floor cuts)
                if (shapes) {
                    shapes.forEach(shape => {
                        if (shape.type === 'shape_floor_cut') {
                            const rot = (shape.group ? shape.group.rotation() : (shape.rotation || 0)) * Math.PI / 180;
                            const sx = shape.group ? shape.group.x() : (shape.x || shape.params?.x || 0);
                            const sy = shape.group ? shape.group.y() : (shape.y || shape.params?.y || 0);
                            let pts;
                            if (shape.params?.points && shape.params.points.length >= 3) {
                                pts = shape.params.points;
                            } else {
                                const w = shape.params?.width || shape.width || 100;
                                const h = shape.params?.height || shape.height || 100;
                                pts = [
                                    { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 },
                                    { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }
                                ];
                            }
                            
                            const rotC = pts.map(c => ({
                                x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                                y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                            }));

                            // Bounding overlap check with room
                            let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
                            path.forEach(p => {
                                if (p.x < minRx) minRx = p.x; if (p.x > maxRx) maxRx = p.x;
                                if (p.y < minRy) minRy = p.y; if (p.y > maxRy) maxRy = p.y;
                            });
                            let minHx = Infinity, maxHx = -Infinity, minHy = Infinity, maxHy = -Infinity;
                            rotC.forEach(p => {
                                if (p.x < minHx) minHx = p.x; if (p.x > maxHx) maxHx = p.x;
                                if (p.y < minHy) minHy = p.y; if (p.y > maxHy) maxHy = p.y;
                            });

                            if (!(maxRx < minHx || minRx > maxHx || maxRy < minHy || minRy > maxHy)) {
                                const holeIsCW = THREE.ShapeUtils.isClockWise(rotC);
                                const finalHolePts = holeIsCW ? rotC : [...rotC].reverse();

                                const hole = new THREE.Path();
                                hole.moveTo(finalHolePts[0].x, finalHolePts[0].y);
                                for (let i = 1; i < finalHolePts.length; i++) {
                                    hole.lineTo(finalHolePts[i].x, finalHolePts[i].y);
                                }
                                hole.lineTo(finalHolePts[0].x, finalHolePts[0].y);
                                floorShape.holes.push(hole);
                            }
                        }
                    });
                }
                
                const slabDepth = isSubStructure ? subH : 2;
                const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: slabDepth, bevelEnabled: false });
                floorGeo.rotateX(Math.PI / 2);
                
                const pos = floorGeo.attributes.position;
                const uvs = new Float32Array(pos.count * 2);
                for (let i = 0; i < pos.count; i++) {
                    uvs[i * 2] = pos.getX(i) / 100;
                    uvs[i * 2 + 1] = -pos.getZ(i) / 100;
                }
                floorGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));

                const configId = room.configId || 'hardwood';
                const baseConfig = FLOOR_REGISTRY[configId];
                
                const matFloor = isSubStructure ? getPlasterMaterial() : new THREE.MeshStandardMaterial({ 
                    color: baseConfig?.color || 0xd1d5db, 
                    roughness: baseConfig?.roughness || 0.7
                });
                const floorMesh = new THREE.Mesh(floorGeo, matFloor);
                floorMesh.position.y = isSubStructure ? (subH - 0.01) : 0.05;
                floorMesh.receiveShadow = true;
                floorMesh.userData = { isFloor: true, entity: room };

                if (baseConfig && !isSubStructure) {
                    const config = { ...baseConfig };
                    if (room.materialScale) {
                        config.tileSize = room.materialScale;
                    }
                    MaterialFactory.buildPBRMaterial({
                        material: matFloor,
                        config: config,
                        ctx: this.ctx,
                        dimensions: { width: 100, height: 100 },
                        faceName: 'floor'
                    }).then(() => {
                        if (this.ctx && this.ctx.requestRender) this.ctx.requestRender('material_loaded', 2);
                    });
                }

                this.ctx.interactables.push(floorMesh);
                this.ctx.structureGroup.add(floorMesh);
                room.mesh3D = floorMesh;
                } catch(err) {
                    console.error("Error building individual room 3D floor:", err);
                }
            });
        }

        if (shapes) {
            shapes.forEach(shape => {
                try {
                    if (shape.type === 'shape_floor_cut') {
                        const rot = (shape.group ? shape.group.rotation() : (shape.rotation || 0)) * Math.PI / 180;
                        const sx = shape.group ? shape.group.x() : (shape.x || shape.params?.x || 0);
                        const sy = shape.group ? shape.group.y() : (shape.y || shape.params?.y || 0);
                        let pts;
                        if (shape.params?.points && shape.params.points.length >= 3) {
                            pts = shape.params.points;
                        } else {
                            const w = shape.params?.width || shape.width || 100;
                            const h = shape.params?.height || shape.height || 100;
                            pts = [
                                { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 },
                                { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }
                            ];
                        }

                        const proxyShape = new THREE.Shape();
                        proxyShape.moveTo(pts[0].x, pts[0].y);
                        for (let i = 1; i < pts.length; i++) {
                            proxyShape.lineTo(pts[i].x, pts[i].y);
                        }
                        proxyShape.lineTo(pts[0].x, pts[0].y);
                        
                        const proxyGeo = new THREE.ShapeGeometry(proxyShape);
                        proxyGeo.rotateX(Math.PI / 2);
                        
                        const proxyMat = new THREE.MeshBasicMaterial({
                            color: 0xef4444,
                            side: THREE.DoubleSide,
                            transparent: true,
                            opacity: 0.2,
                            depthWrite: false
                        });
                        const proxyMesh = new THREE.Mesh(proxyGeo, proxyMat);
                        
                        const edgesGeo = new THREE.EdgesGeometry(proxyGeo);
                        const edgesMat = new THREE.LineBasicMaterial({ color: 0xef4444 });
                        const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
                        proxyMesh.add(edgesMesh);
                        
                        proxyMesh.position.set(sx, 0.5, sy);
                        proxyMesh.rotation.y = -rot;
                        const w = shape.params?.width || shape.width || 100;
                        const h = shape.params?.height || shape.height || 100;
                        proxyMesh.userData = { 
                            entity: shape,
                            originalSize: new THREE.Vector3(w, 10, h),
                            isFloorCutProxy: true
                        };
                        this.ctx.interactables.push(proxyMesh);
                        this.ctx.structureGroup.add(proxyMesh);
                        shape.mesh3D = proxyMesh;
                    }
                } catch(err) {
                    console.error("Error building shape floor cut:", err);
                }
            });
        }

        const standardWalls = (walls || []).filter(w => w.type !== 'railing' && !w.hidden);
        const railingWalls = (walls || []).filter(w => w.type === 'railing' && !w.hidden);

        standardWalls.forEach(w => {
            try {
                this.buildWallGroup(w);
            } catch(e) {
                console.error("Error building standard wall 3D:", e);
            }
        });

        try {
            this.buildRailings(railingWalls, standardWalls, shapes);
        } catch(e) {
            console.error("Error building railings 3D:", e);
        }
    }

    buildOutdoorZones(outdoorZones, targetGroup = this.ctx.structureGroup) {
        if (!outdoorZones) return;

        outdoorZones.forEach(zone => {
            try {
                if (!zone || zone.isDeleted || zone.isHidden) return;
                const pts = zone.points || [];
                if (!pts || pts.length < 3) return;

                let cleanPts = [];
                if (typeof pts[0] === 'number') {
                    for (let i = 0; i < pts.length; i += 2) {
                        cleanPts.push({ x: Number(pts[i]) || 0, y: Number(pts[i+1]) || 0 });
                    }
                } else {
                    cleanPts = pts.map(p => ({ x: Number(p.x) || 0, y: Number(p.y) || 0 }));
                }
                if (cleanPts.length < 3) return;

                const posX = zone.group && typeof zone.group.x === 'function' ? zone.group.x() : (Number(zone.x) || 0);
                const posZ = zone.group && typeof zone.group.y === 'function' ? zone.group.y() : (Number(zone.y) || 0);
                const rotY = zone.group && typeof zone.group.rotation === 'function' ? -(zone.group.rotation() || 0) * Math.PI / 180 : -(Number(zone.rotation) || 0) * Math.PI / 180;
                const elevation = Number(zone.elevation) || 0;
                const height3D = Math.max(0.1, Number(zone.height3D) || 0.3);

                const isCorridor = zone.subType === 'driveway' || zone.subType === 'walkway' || Boolean(zone.centerline || zone.params?.centerline);
                const corridorWidth = Number(zone.width || zone.params?.width) || (zone.subType === 'walkway' ? 60 : 160);
                const centerline = zone.centerline || zone.params?.centerline;

                const configId = zone.configId || (zone.subType === 'softscape' ? 'grass' : (zone.subType === 'patio' ? 'tile_yellow_cotto_squares' : 'tile_yellow_hexagon'));
                const floorConfig = FLOOR_REGISTRY[configId] || UniversalMaterialManager.getMaterial(configId);
                const ts = Number(zone.materialScale || floorConfig?.tileSize || floorConfig?.defaultTileSize) || DEFAULT_UNIVERSAL_TILE_SIZE;
                const isRoadCenterline = (configId === 'driveway_black_road');

                let zoneGeo = null;
                if (isCorridor && centerline && centerline.length >= 2) {
                    // Build mathematically perfect quad-strip ribbon geometry with accurate physical texel density
                    zoneGeo = this._buildCorridorRibbonGeometry(centerline, corridorWidth, height3D, ts, isRoadCenterline);
                }

                if (!zoneGeo) {
                    const zoneShape = new THREE.Shape();
                    zoneShape.moveTo(cleanPts[0].x, cleanPts[0].y);
                    for (let i = 1; i < cleanPts.length; i++) {
                        zoneShape.lineTo(cleanPts[i].x, cleanPts[i].y);
                    }
                    zoneShape.closePath();

                    zoneGeo = new THREE.ExtrudeGeometry(zoneShape, { depth: height3D, bevelEnabled: false });
                    zoneGeo.rotateX(Math.PI / 2);
                    zoneGeo.translate(0, height3D, 0);

                    // Standard planar UV projection with true physical scale
                    const uvs = zoneGeo.attributes.uv;
                    const pos = zoneGeo.attributes.position;
                    zoneGeo.computeVertexNormals();
                    const norms = zoneGeo.attributes.normal;
                    for (let i = 0; i < uvs.count; i++) {
                        const nx = Math.abs(norms.getX(i));
                        const ny = Math.abs(norms.getY(i));
                        const nz = Math.abs(norms.getZ(i));
                        const vx = pos.getX(i) / ts;
                        const vy = pos.getY(i) / ts;
                        const vz = pos.getZ(i) / ts;

                        if (ny > 0.5) uvs.setXY(i, vx, vz);
                        else if (nx > nz) uvs.setXY(i, vz, vy);
                        else uvs.setXY(i, vx, vy);
                    }
                }

                let mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 });
                
                if (floorConfig) {
                    const config = { ...floorConfig };
                    config.tileSize = 100; // Geometry already has 1/ts world UVs baked in
                    MaterialFactory.buildPBRMaterial({
                        material: mat,
                        config: config,
                        ctx: this.ctx,
                        dimensions: { width: 100, height: 100 },
                        faceName: 'floor'
                    }).then(() => {
                        if (mat.map) {
                            mat.map = mat.map.clone();
                            mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
                            mat.map.repeat.set(1.0, 1.0);
                            mat.map.offset.set(0.0, 0.0);
                            mat.map.rotation = 0;
                            mat.map.needsUpdate = true;
                        }
                        if (this.ctx && this.ctx.requestRender) this.ctx.requestRender('material_loaded', 2);
                    });
                } else {
                    mat.color.setHex(0x94a3b8);
                }

                const zoneMesh = new THREE.Mesh(zoneGeo, mat);
                zoneMesh.position.set(posX, 0.05 + elevation, posZ);
                zoneMesh.rotation.y = rotY;
                zoneMesh.receiveShadow = true;
                zoneMesh.castShadow = true;
                zoneMesh.userData = { entity: zone, isOutdoorZone: true, isFloor: true, isGroundSurface: true };
                zone.mesh3D = zoneMesh;

                if (this.ctx && this.ctx.interactables) this.ctx.interactables.push(zoneMesh);
                targetGroup.add(zoneMesh);
            } catch (err) {
                console.error("Error building outdoor zone in 3D:", err);
            }
        });
    }

    _buildCorridorRibbonGeometry(centerline, width, height3D = 0.3, tileSize = DEFAULT_UNIVERSAL_TILE_SIZE, isRoadCenterline = false) {
        const halfW = width / 2;
        const n = centerline.length;
        if (n < 2) return null;

        const uScale = isRoadCenterline ? 1.0 : (width / tileSize);
        const vStep = isRoadCenterline ? width : tileSize;

        const segNormals = [];
        for (let i = 0; i < n - 1; i++) {
            const dx = centerline[i+1].x - centerline[i].x;
            const dy = centerline[i+1].y - centerline[i].y;
            const len = Math.hypot(dx, dy) || 1;
            const ux = dx / len;
            const uy = dy / len;
            segNormals.push({ nx: -uy, ny: ux, ux, uy, len });
        }

        const leftPts = [];
        const rightPts = [];

        // Start point
        leftPts.push({
            x: centerline[0].x + segNormals[0].nx * halfW,
            y: centerline[0].y + segNormals[0].ny * halfW
        });
        rightPts.push({
            x: centerline[0].x - segNormals[0].nx * halfW,
            y: centerline[0].y - segNormals[0].ny * halfW
        });

        // Intermediate points with miter joint calculation
        for (let i = 1; i < n - 1; i++) {
            const n1 = segNormals[i - 1];
            const n2 = segNormals[i];
            
            let bisectorX = n1.nx + n2.nx;
            let bisectorY = n1.ny + n2.ny;
            const bisectorLen = Math.hypot(bisectorX, bisectorY);
            
            if (bisectorLen < 0.001) {
                bisectorX = n1.nx;
                bisectorY = n1.ny;
            } else {
                bisectorX /= bisectorLen;
                bisectorY /= bisectorLen;
            }

            const dot = bisectorX * n1.nx + bisectorY * n1.ny;
            const miterLength = Math.min(halfW / Math.max(0.15, dot), halfW * 2.5);

            leftPts.push({
                x: centerline[i].x + bisectorX * miterLength,
                y: centerline[i].y + bisectorY * miterLength
            });
            rightPts.push({
                x: centerline[i].x - bisectorX * miterLength,
                y: centerline[i].y - bisectorY * miterLength
            });
        }

        // End point
        const lastN = segNormals[segNormals.length - 1];
        leftPts.push({
            x: centerline[n - 1].x + lastN.nx * halfW,
            y: centerline[n - 1].y + lastN.ny * halfW
        });
        rightPts.push({
            x: centerline[n - 1].x - lastN.nx * halfW,
            y: centerline[n - 1].y - lastN.ny * halfW
        });

        const positions = [];
        const normals = [];
        const uvs = [];
        const indices = [];

        // Calculate cumulative V distances
        const vDists = [0];
        let totalDist = 0;
        for (let i = 0; i < n - 1; i++) {
            const dx = centerline[i+1].x - centerline[i].x;
            const dy = centerline[i+1].y - centerline[i].y;
            totalDist += Math.hypot(dx, dy);
            vDists.push(totalDist / vStep);
        }

        // 1. TOP SURFACE (Y = height3D)
        const topStartIndex = positions.length / 3;
        for (let i = 0; i < n; i++) {
            const v = vDists[i];
            positions.push(leftPts[i].x, height3D, leftPts[i].y);
            normals.push(0, 1, 0);
            uvs.push(0.0, v);

            positions.push(rightPts[i].x, height3D, rightPts[i].y);
            normals.push(0, 1, 0);
            uvs.push(uScale, v);
        }

        for (let i = 0; i < n - 1; i++) {
            const i0 = topStartIndex + i * 2;
            const i1 = topStartIndex + i * 2 + 1;
            const i2 = topStartIndex + (i + 1) * 2;
            const i3 = topStartIndex + (i + 1) * 2 + 1;

            // Correct CCW winding for upward facing (+Y) normal towards the sun
            indices.push(i0, i2, i1);
            indices.push(i1, i2, i3);
        }

        // 2. BOTTOM SURFACE (Y = 0)
        const botStartIndex = positions.length / 3;
        for (let i = 0; i < n; i++) {
            const v = vDists[i];
            positions.push(leftPts[i].x, 0, leftPts[i].y);
            normals.push(0, -1, 0);
            uvs.push(0.0, v);

            positions.push(rightPts[i].x, 0, rightPts[i].y);
            normals.push(0, -1, 0);
            uvs.push(uScale, v);
        }

        for (let i = 0; i < n - 1; i++) {
            const i0 = botStartIndex + i * 2;
            const i1 = botStartIndex + i * 2 + 1;
            const i2 = botStartIndex + (i + 1) * 2;
            const i3 = botStartIndex + (i + 1) * 2 + 1;

            // Correct CW winding for downward facing (-Y) normal
            indices.push(i0, i1, i2);
            indices.push(i1, i3, i2);
        }

        // 3. LEFT SIDE WALLS
        for (let i = 0; i < n - 1; i++) {
            const pA = leftPts[i], pB = leftPts[i+1];
            const dx = pB.x - pA.x, dy = pB.y - pA.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, nz = dx / len;

            const idx = positions.length / 3;
            positions.push(pA.x, 0, pA.y);
            positions.push(pB.x, 0, pB.y);
            positions.push(pA.x, height3D, pA.y);
            positions.push(pB.x, height3D, pB.y);

            for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
            uvs.push(0, 0, len / tileSize, 0, 0, height3D / tileSize, len / tileSize, height3D / tileSize);

            indices.push(idx, idx + 1, idx + 2);
            indices.push(idx + 1, idx + 3, idx + 2);
        }

        // 4. RIGHT SIDE WALLS
        for (let i = 0; i < n - 1; i++) {
            const pA = rightPts[i], pB = rightPts[i+1];
            const dx = pB.x - pA.x, dy = pB.y - pA.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = dy / len, nz = -dx / len;

            const idx = positions.length / 3;
            positions.push(pA.x, 0, pA.y);
            positions.push(pB.x, 0, pB.y);
            positions.push(pA.x, height3D, pA.y);
            positions.push(pB.x, height3D, pB.y);

            for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
            uvs.push(0, 0, len / tileSize, 0, 0, height3D / tileSize, len / tileSize, height3D / tileSize);

            indices.push(idx, idx + 2, idx + 1);
            indices.push(idx + 1, idx + 2, idx + 3);
        }

        // 5. START CAP
        {
            const pL = leftPts[0], pR = rightPts[0];
            const dx = pR.x - pL.x, dy = pR.y - pL.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = dy / len, nz = -dx / len;

            const idx = positions.length / 3;
            positions.push(pL.x, 0, pL.y);
            positions.push(pR.x, 0, pR.y);
            positions.push(pL.x, height3D, pL.y);
            positions.push(pR.x, height3D, pR.y);

            for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
            uvs.push(0, 0, len / 100, 0, 0, height3D / 100, len / 100, height3D / 100);

            indices.push(idx, idx + 2, idx + 1);
            indices.push(idx + 1, idx + 2, idx + 3);
        }

        // 6. END CAP
        {
            const pL = leftPts[n - 1], pR = rightPts[n - 1];
            const dx = pR.x - pL.x, dy = pR.y - pL.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, nz = dx / len;

            const idx = positions.length / 3;
            positions.push(pL.x, 0, pL.y);
            positions.push(pR.x, 0, pR.y);
            positions.push(pL.x, height3D, pL.y);
            positions.push(pR.x, height3D, pR.y);

            for (let k = 0; k < 4; k++) normals.push(nx, 0, nz);
            uvs.push(0, 0, len / 100, 0, 0, height3D / 100, len / 100, height3D / 100);

            indices.push(idx, idx + 1, idx + 2);
            indices.push(idx + 1, idx + 3, idx + 2);
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        return geo;
    }

    buildWallGroup(w) {
        const matMain = getPlasterMaterial();
        const p1 = (w.startAnchor && typeof w.startAnchor.position === 'function') ? w.startAnchor.position() : (w.startAnchor || { x: w.startX || 0, y: w.startY || 0 });
        const p2 = (w.endAnchor && typeof w.endAnchor.position === 'function') ? w.endAnchor.position() : (w.endAnchor || { x: w.endX || 0, y: w.endY || 0 });
        const dx = p2.x - p1.x, dz = p2.y - p1.y;
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        w.length3D = length;

        const defaultH = this.activeLevelHeight || Number(this.activeLevelConfig?.height) || WALL_HEIGHT;
        const defaultThk = Number(this.activeLevelConfig?.defaultWallThickness) || (w.type === 'compound' ? 12 : (w.type === 'outer' ? 20 : 10));
        let h = w.height !== undefined ? w.height : (w.config?.height || (w.type === 'compound' ? 80 : defaultH));
        if (this.activeLevelConfig?.type === 'plinth' || this.activeLevelConfig?.type === 'foundation') {
            h = defaultH;
            w.height = h;
            if (w.config) w.config.height = h;
        }
        let t = w.thickness !== undefined ? w.thickness : (w.config?.thickness || defaultThk);
        if ((this.activeLevelConfig?.type === 'plinth' || this.activeLevelConfig?.type === 'foundation') && !w.thickness) {
            t = defaultThk;
            w.thickness = t;
            if (w.config) w.config.thickness = t;
        }
        
        // Compute mm early so holes and patterns can inherit painted materials
        let mm = [matMain, matMain, matMain, matMain, matMain, matMain];
        if (this.ctx.helpers && this.ctx.helpers.getFaceMaterials) {
            mm = this.ctx.helpers.getFaceMaterials(w, matMain, { width: length, height: h }).box;
        }
        const wallBottom = -1;
        const wallShape = new THREE.Shape();
        const type = w.topProfileType || 'normal';
        const startH = w.startHeight !== undefined ? w.startHeight : h;
        const endH = w.endHeight !== undefined ? w.endHeight : h;
        const peakH = w.peakHeight !== undefined ? w.peakHeight : h;
        const maxH = Math.max(startH, endH, peakH, h);

        wallShape.moveTo(0, wallBottom);
        wallShape.lineTo(length, wallBottom);
        if (type === 'single') {
            wallShape.lineTo(length, endH);
            wallShape.lineTo(0, startH);
        } else if (type === 'gable') {
            wallShape.lineTo(length, endH);
            wallShape.lineTo(length / 2, peakH);
            wallShape.lineTo(0, startH);
        } else {
            wallShape.lineTo(length, h);
            wallShape.lineTo(0, h);
        }
        wallShape.lineTo(0, wallBottom);

        const wallGroup = new THREE.Group();
        const elev = w.elevation || 0;
        wallGroup.position.set(p1.x, elev, p1.y);
        wallGroup.rotation.y = -angle;
        wallGroup.userData = { entity: w };
        w.mesh3D = wallGroup;

        const extraMeshes = [];
        (w.attachedWidgets || []).forEach(widg => {
            const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
            let hasHole = false;
            const type = widg.type || widg.configId;
            
            if (type === 'door') {
                let dh = widg.height !== undefined ? widg.height : DOOR_HEIGHT;
                let elev = widg.elevation !== undefined ? widg.elevation : 0;
                let cutElev = (elev <= 0.1) ? wallBottom : elev;
                
                const shapeType = widg.doorShape || widg.windowShape || widg.params?.doorShape || widg.params?.windowShape || widg.config?.doorShape || widg.config?.windowShape || widg.shape || (widg.configId === 'entry_arched_double' ? 'radius' : 'square');
                hole.moveTo(wCenter - halfW, cutElev);
                hole.lineTo(wCenter + halfW, cutElev);
                
                if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                    const straightH = Math.max(0, dh - halfW);
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    if (halfW > 0) hole.absarc(wCenter, elev + straightH, halfW, 0, Math.PI, false);
                } else if (shapeType === 'segment') {
                    const rise = widg.width * 0.15;
                    const straightH = Math.max(0, dh - rise);
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    hole.quadraticCurveTo(wCenter, elev + dh + rise*0.5, wCenter - halfW, elev + straightH);
                } else if (shapeType === 'gothic') {
                    const straightH = Math.max(0, dh - (widg.width * 0.7));
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    hole.quadraticCurveTo(wCenter + halfW * 0.2, elev + dh, wCenter, elev + dh);
                    hole.quadraticCurveTo(wCenter - halfW * 0.2, elev + dh, wCenter - halfW, elev + straightH);
                } else {
                    hole.lineTo(wCenter + halfW, elev + dh);
                    hole.lineTo(wCenter - halfW, elev + dh);
                }
                
                hole.lineTo(wCenter - halfW, cutElev);
                hasHole = true;
            } else if (type === 'window' || type === 'jali_panel') {
                let dh = widg.height !== undefined ? widg.height : (type === 'window' ? WINDOW_HEIGHT : 100);
                let elev = widg.elevation !== undefined ? widg.elevation : (type === 'window' ? WINDOW_SILL : 0);
                let cutElev = (elev <= 0.1) ? wallBottom : elev;
                const shapeType = widg.windowShape || widg.doorShape || widg.params?.windowShape || widg.params?.doorShape || widg.config?.windowShape || widg.config?.doorShape || widg.shape || 'square';
                
                hole.moveTo(wCenter - halfW, cutElev);
                hole.lineTo(wCenter + halfW, cutElev);
                if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                    const straightH = Math.max(0, dh - halfW);
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    if (halfW > 0) hole.absarc(wCenter, elev + straightH, halfW, 0, Math.PI, false);
                } else if (shapeType === 'segment') {
                    const rise = widg.width * 0.15;
                    const straightH = Math.max(0, dh - rise);
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    hole.quadraticCurveTo(wCenter, elev + dh + rise*0.5, wCenter - halfW, elev + straightH);
                } else if (shapeType === 'gothic') {
                    const straightH = Math.max(0, dh - (widg.width * 0.7));
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    hole.quadraticCurveTo(wCenter + halfW * 0.2, elev + dh, wCenter, elev + dh);
                    hole.quadraticCurveTo(wCenter - halfW * 0.2, elev + dh, wCenter - halfW, elev + straightH);
                } else {
                    hole.lineTo(wCenter + halfW, elev + dh);
                    hole.lineTo(wCenter - halfW, elev + dh);
                }
                hole.lineTo(wCenter - halfW, cutElev);
                hasHole = true;
            } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type)) {
                let elev = widg.elevation || 0;
                let h_opening = widg.height || 200;
                elev = Math.max(0, Math.min(elev, maxH));
                h_opening = Math.max(0, Math.min(h_opening, maxH - elev));
                let cutElev = (elev <= 0.1) ? wallBottom : elev;
                
                if (type === 'arch_opening') {
                    const radius = halfW;
                    const straightH = Math.max(0, h_opening - radius);
                                    hole.moveTo(wCenter - halfW, cutElev);
                                    hole.lineTo(wCenter + halfW, cutElev);
                    hole.lineTo(wCenter + halfW, elev + straightH);
                    if (radius > 0) hole.absarc(wCenter, elev + straightH, radius, 0, Math.PI, false);
                                    hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;
                } else if (type === 'circular_opening') {
                    hole.moveTo(wCenter + halfW, elev + h_opening / 2);
                    hole.absellipse(wCenter, elev + h_opening / 2, halfW, h_opening / 2, 0, Math.PI * 2, false, 0);
                    hasHole = true;
                } else if (type === 'custom_shape_opening') {
                                    hole.moveTo(wCenter, cutElev);
                    hole.lineTo(wCenter + halfW, elev + h_opening / 2);
                    hole.lineTo(wCenter, elev + h_opening);
                    hole.lineTo(wCenter - halfW, elev + h_opening / 2);
                                    hole.lineTo(wCenter, cutElev);
                    hasHole = true;
                } else if (type === 'pattern_opening') {
                                    hole.moveTo(wCenter - halfW, cutElev);
                                    hole.lineTo(wCenter + halfW, cutElev);
                    hole.lineTo(wCenter + halfW, elev + h_opening);
                    hole.lineTo(wCenter - halfW, elev + h_opening);
                                    hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;

                    const patternShape = new THREE.Shape();
                    patternShape.moveTo(wCenter - halfW, elev);
                    patternShape.lineTo(wCenter + halfW, elev);
                    patternShape.lineTo(wCenter + halfW, elev + h_opening);
                    patternShape.lineTo(wCenter - halfW, elev + h_opening);
                    patternShape.lineTo(wCenter - halfW, elev);

                    const rows = widg.rows || 4, cols = widg.cols || 4, spacing = widg.spacing !== undefined ? widg.spacing : 5;
                    const style = widg.patternStyle || 'grid';
                    const pW = (widg.width - spacing * (cols + 1)) / cols;
                    const pH = (h_opening - spacing * (rows + 1)) / rows;
                    if (pW > 0 && pH > 0) {
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                const px = (wCenter - halfW) + spacing + c * (pW + spacing);
                                const py = elev + spacing + r * (pH + spacing);
                                const pPath = new THREE.Path();
                                const cx = px + pW/2, cy = py + pH/2;
                                if (style === 'diamond') {
                                    pPath.moveTo(cx, py); pPath.lineTo(px + pW, cy); pPath.lineTo(cx, py + pH); pPath.lineTo(px, cy); pPath.lineTo(cx, py);
                                } else if (style === 'circle') {
                                    pPath.moveTo(cx + Math.min(pW, pH)/2, cy); pPath.absarc(cx, cy, Math.min(pW, pH)/2, 0, Math.PI * 2, false);
                                } else if (style === 'cross') {
                                    const w1 = pW*0.2, h1 = pH*0.8, w2 = pW*0.8, h2 = pH*0.2;
                                    pPath.moveTo(cx-w1/2, cy-h1/2); pPath.lineTo(cx+w1/2, cy-h1/2); pPath.lineTo(cx+w1/2, cy-h2/2); pPath.lineTo(cx+w2/2, cy-h2/2); pPath.lineTo(cx+w2/2, cy+h2/2); pPath.lineTo(cx+w1/2, cy+h2/2); pPath.lineTo(cx+w1/2, cy+h1/2); pPath.lineTo(cx-w1/2, cy+h1/2); pPath.lineTo(cx-w1/2, cy+h2/2); pPath.lineTo(cx-w2/2, cy+h2/2); pPath.lineTo(cx-w2/2, cy-h2/2); pPath.lineTo(cx-w1/2, cy-h2/2); pPath.lineTo(cx-w1/2, cy-h1/2);
                                } else if (style === 'hexagon') {
                                    const rad = Math.min(pW, pH)/2; for (let i = 0; i < 6; i++) { const a = (i*Math.PI)/3; const hx = cx + rad*Math.cos(a), hy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(hx,hy); else pPath.lineTo(hx,hy); } pPath.lineTo(cx+rad, cy);
                                } else if (style === 'star') {
                                    const rOut = Math.min(pW, pH)/2, rIn = rOut*0.3; for (let i = 0; i < 8; i++) { const a = (i*Math.PI)/4; const rad = i%2===0 ? rOut : rIn; const sx = cx + rad*Math.cos(a), sy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(sx,sy); else pPath.lineTo(sx,sy); } pPath.lineTo(cx+rOut, cy);
                                } else if (style === 'slit') {
                                    const slitW = pW*0.3, slitH = pH*0.9; pPath.moveTo(cx-slitW/2, cy-slitH/2); pPath.lineTo(cx+slitW/2, cy-slitH/2); pPath.lineTo(cx+slitW/2, cy+slitH/2); pPath.lineTo(cx-slitW/2, cy+slitH/2); pPath.lineTo(cx-slitW/2, cy-slitH/2);
                                } else if (style === 'terracotta') {
                                    const hw = pW * 0.495, hh = pH * 0.495;
                                    const ch = new THREE.Path();
                                    ch.absellipse(cx, cy, hw * 0.44, hh * 0.44, 0, Math.PI * 2, false);
                                    patternShape.holes.push(ch);

                                    [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(a => {
                                         const cos = Math.cos(a), sin = Math.sin(a);
                                         const rot = (x, y) => ({ x: cx + (x * cos - y * sin), y: cy + (x * sin + y * cos) });
                                         const p = new THREE.Path();
                                         const tip = rot(0, hh * 0.95);
                                         const cr = rot(hw * 0.18, hh * 0.72);
                                         const br = rot(hw * 0.22, hw * 0.51);
                                         const bl = rot(-hw * 0.22, hw * 0.51);
                                         const cl = rot(-hw * 0.18, hh * 0.72);
                                         const midRing = rot(0, hw * 0.49);

                                         p.moveTo(tip.x, tip.y);
                                         p.quadraticCurveTo(cr.x, cr.y, br.x, br.y);
                                         p.quadraticCurveTo(midRing.x, midRing.y, bl.x, bl.y);
                                         p.quadraticCurveTo(cl.x, cl.y, tip.x, tip.y);
                                         p.closePath();
                                         patternShape.holes.push(p);
                                    });

                                    [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(a => {
                                         const cos = Math.cos(a), sin = Math.sin(a);
                                         const rot = (x, y) => ({ x: cx + (x * cos - y * sin), y: cy + (x * sin + y * cos) });
                                         const p = new THREE.Path();
                                         const p1 = rot(hw * 0.12, hh * 0.95);
                                         const p2 = rot(hw * 0.95, hh * 0.95);
                                         const p3 = rot(hw * 0.95, hh * 0.12);
                                         const pCtrl = rot(hw * 0.42, hh * 0.42);

                                         p.moveTo(p1.x, p1.y);
                                         p.lineTo(p2.x, p2.y);
                                         p.lineTo(p3.x, p3.y);
                                         p.quadraticCurveTo(pCtrl.x, pCtrl.y, p1.x, p1.y);
                                         p.closePath();
                                         patternShape.holes.push(p);
                                    });
                                    continue;
                                } else if (style === 'arabesque') {
                                    const rOut = Math.min(pW, pH)/2, rIn = rOut*0.55; for (let i = 0; i < 16; i++) { const a = (i*Math.PI)/8; const rad = i%2===0 ? rOut : rIn; const sx = cx + rad*Math.cos(a), sy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(sx,sy); else pPath.lineTo(sx,sy); }
                                } else {
                                    pPath.moveTo(px, py); pPath.lineTo(px + pW, py); pPath.lineTo(px + pW, py + pH); pPath.lineTo(px, py + pH); pPath.lineTo(px, py);
                                }
                                pPath.closePath();
                                patternShape.holes.push(pPath);
                            }
                        }
                    }
                    
                    const patternGeo = new THREE.ExtrudeGeometry(patternShape, { depth: t, bevelEnabled: false });
                    patternGeo.translate(0, 0, -t / 2);
                    const patternMat = mm[4].clone(); // inherit wall material
                    const patternMesh = new THREE.Mesh(patternGeo, patternMat);
                    patternMesh.castShadow = true; patternMesh.receiveShadow = true;
                    
                    const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, t + 4);
                    hitBoxGeo.translate(wCenter, elev + h_opening / 2, 0);
                    const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                    hitBox.userData = { isHitbox: true };
                    
                    const patternGroup = new THREE.Group();
                    patternGroup.add(patternMesh, hitBox);
                    patternGroup.userData = { isPattern: true, entity: widg };
                    widg.patternMesh3D = patternGroup;
                    widg.patternMat3D = patternMat;
                    
                    this.ctx.updatePatternLive(widg);
                    extraMeshes.push(patternGroup);
                    if (this.ctx.viewMode3D !== 'preview') this.ctx.interactables.push(hitBox);

                } else {
                hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, elev + h_opening); hole.lineTo(wCenter - halfW, elev + h_opening); hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;
                }

                if (type === 'niche_recess') {
                    const depth = widg.depth || 10;
                    const recessThickness = Math.max(0.5, t - depth);
                    const nicheGeo = new THREE.BoxGeometry(widg.width, h_opening, recessThickness);
                    const zOffset = (widg.facing === -1) ? (t/2 - recessThickness/2) : (-t/2 + recessThickness/2);
                    nicheGeo.translate(wCenter, elev + h_opening/2, zOffset);
                    const nicheMesh = new THREE.Mesh(nicheGeo, mm[4]); // inherit wall material
                    nicheMesh.castShadow = true; nicheMesh.receiveShadow = true;
                    extraMeshes.push(nicheMesh);
                }
            }
            if (hasHole) wallShape.holes.push(hole);

                            if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                                widg.x = p1.x + Math.cos(angle) * wCenter;
                                widg.z = p1.y + Math.sin(angle) * wCenter;
                                widg.angle = angle;
                                widg.thick = t;
                                widg.wall = w;
                                
                                widg.localX = wCenter;
                                
                                const widgetGroup = WIDGET_REGISTRY[type].render3D(wallGroup, widg, this.ctx.helpers);
                                if (widgetGroup) {
                                    widg.mesh3D = widgetGroup;
                                    this.ctx.interactables.push(widgetGroup);
                                }
                            }
        });

        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: t, bevelEnabled: false });
        wallGeo.translate(0, 0, -t / 2);
        
        // ====== MITER JOINT SHEARING ======
        const pts = typeof w.poly?.points === 'function' ? w.poly.points() : null;
        let localSL_x = 0, localSR_x = 0, localEL_x = length, localER_x = length;
        if (pts && pts.length === 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - p1.x;
                const dy_pt = ptY - p1.y;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            localSL_x = toLocalX(pts[0], pts[1]);
            localEL_x = toLocalX(pts[2], pts[3]);
            localER_x = toLocalX(pts[4], pts[5]);
            localSR_x = toLocalX(pts[6], pts[7]);
        }

        const shearGeo = (geo) => {
            const pos = geo.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const z = pos.getZ(i);
                const tZ = (z + t / 2) / t;
                const startX = localSR_x + tZ * (localSL_x - localSR_x);
                const endX = localER_x + tZ * (localEL_x - localER_x);
                
                if (x <= 0.1) {
                    pos.setX(i, startX);
                } else if (x >= length - 0.1) {
                    pos.setX(i, endX);
                } else {
                    pos.setX(i, x);
                }
            }
            geo.computeVertexNormals();
        };

        if (pts && pts.length === 8) {
            shearGeo(wallGeo);
        }

        // ====== MULTI-MATERIAL AND UV FIX FOR EXTRUDED WALLS ======
        let finalWallGeo = wallGeo.index ? wallGeo.toNonIndexed() : wallGeo.clone();
        finalWallGeo.clearGroups();
        const pos = finalWallGeo.attributes.position;
        const norm = finalWallGeo.attributes.normal;
        let uvs = finalWallGeo.attributes.uv;
        if (!uvs || uvs.count !== pos.count) {
            uvs = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
            finalWallGeo.setAttribute('uv', uvs);
        }
        
        finalWallGeo.computeVertexNormals();

        const aWallLength = new Float32Array(pos.count);
        aWallLength.fill(length);
        finalWallGeo.setAttribute('aWallLength', new THREE.BufferAttribute(aWallLength, 1));

        const aWallHeight = new Float32Array(pos.count);
        aWallHeight.fill(maxH);
        finalWallGeo.setAttribute('aWallHeight', new THREE.BufferAttribute(aWallHeight, 1));

        for (let i = 0; i < pos.count; i += 3) {
            const vAx = pos.getX(i), vAy = pos.getY(i), vAz = pos.getZ(i);
            const vBx = pos.getX(i+1), vBy = pos.getY(i+1), vBz = pos.getZ(i+1);
            const vCx = pos.getX(i+2), vCy = pos.getY(i+2), vCz = pos.getZ(i+2);

            const abX = vBx - vAx, abY = vBy - vAy, abZ = vBz - vAz;
            const acX = vCx - vAx, acY = vCy - vAy, acZ = vCz - vAz;
            const crX = abY * acZ - abZ * acY;
            const crY = abZ * acX - abX * acZ;
            const crZ = abX * acY - abY * acX;
            const len = Math.hypot(crX, crY, crZ);
            
            const nx = len > 1e-6 ? crX / len : 0;
            const ny = len > 1e-6 ? crY / len : 0;
            const nz = len > 1e-6 ? crZ / len : 0;
            const absX = Math.abs(nx);
            const absY = Math.abs(ny);
            const absZ = Math.abs(nz);
            
            let groupIdx = 0;
            if (absX > absY && absX > absZ) groupIdx = nx > 0 ? 0 : 1;
            else if (absY > absX && absY > absZ) groupIdx = ny > 0 ? 2 : 3;
            else groupIdx = nz > 0 ? 4 : 5;
            
            finalWallGeo.addGroup(i, 3, groupIdx);
            
            for (let vIdx = i; vIdx < i + 3; vIdx++) {
                const vx = pos.getX(vIdx), vy = pos.getY(vIdx), vz = pos.getZ(vIdx);
                if (groupIdx <= 1) uvs.setXY(vIdx, vz, vy);
                else if (groupIdx <= 3) uvs.setXY(vIdx, vx, vz);
                else uvs.setXY(vIdx, vx, vy);
            }
        }

        const wallMesh = new THREE.Mesh(finalWallGeo, mm);
        wallMesh.castShadow = true; wallMesh.receiveShadow = true;
        wallMesh.userData = { isWallMesh: true, entity: w };
        w.wallMesh3D = wallMesh;
        wallGroup.userData = { entity: w, isWallGroup: true, wallMesh: wallMesh };
        
        // EdgesGeometry removed to prevent Z-fighting with flush door/window frames

        const skinFrontGeo = new THREE.ShapeGeometry(wallShape);
        skinFrontGeo.translate(0, 0, t / 2 + 0.1);
        if (pts && pts.length === 8) shearGeo(skinFrontGeo);
        const hitFront = new THREE.Mesh(skinFrontGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.userData = { isWallSide: true, side: 'front', entity: w };

        const skinBackGeo = new THREE.ShapeGeometry(wallShape);
        skinBackGeo.rotateY(Math.PI);
        skinBackGeo.translate(length, 0, -t / 2 - 0.1);
        if (pts && pts.length === 8) shearGeo(skinBackGeo);
        const hitBack = new THREE.Mesh(skinBackGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitBack.userData = { isWallSide: true, side: 'back', entity: w };

        if (w.attachedMoldings) {
            w.attachedMoldings.forEach((mold, idx) => {
                const mMesh = this.moldingBuilder.buildMolding(mold, length, t, this.ctx.helpers);
                mMesh.userData.entity = mold;
                mMesh.userData.moldData = mold;
                if (pts && pts.length === 8) {
                    if (mMesh.isGroup && mMesh.children.length > 0 && mMesh.children[0].geometry) {
                        shearGeo(mMesh.children[0].geometry);
                    } else if (mMesh.geometry) {
                        shearGeo(mMesh.geometry);
                    }
                }
                extraMeshes.push(mMesh);
                this.ctx.interactables.push(mMesh);
            });
        }

        wallGroup.add(wallMesh, hitFront, hitBack, ...extraMeshes);
        this.ctx.interactables.push(hitFront, hitBack);
        this.ctx.structureGroup.add(wallGroup);

        if (w.attachedDecor) w.attachedDecor.forEach(decor => this.ctx.decorManager.load(w, decor));
    }

    buildRailings(railingWalls, standardWalls, shapes) {
        railingWalls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            w.length3D = length;

            let h = w.height !== undefined ? w.height : (w.config?.height || 0);
            let underlyingWall = null;
            
            // Auto-detect if this railing sits directly on top of a standard wall
            if (standardWalls) {
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                for (let sw of standardWalls) {
                    const sp1 = sw.startAnchor.position(), sp2 = sw.endAnchor.position();
                    const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                    const lenSq = C * C + D * D;
                    if (lenSq !== 0) {
                        const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                        if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                            underlyingWall = sw;
                            h = sw.height !== undefined ? sw.height : (sw.config?.height || WALL_HEIGHT);
                            break;
                        }
                    }
                }
            }

            if (!underlyingWall && shapes) {
                const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
                for (let s of shapes) {
                    if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                    let pts = []; 
                    if (s.type === 'shape_rect') { 
                        const sw = s.params.width; const sh = s.params.height; 
                        pts = [ {x: -sw/2, y: -sh/2}, {x: sw/2, y: -sh/2}, {x: sw/2, y: sh/2}, {x: -sw/2, y: sh/2} ]; 
                    } else { 
                        pts = s.params.points; 
                    }
                    if (!pts || !s.group) continue;

                    const transform = s.group.getTransform();
                    for (let i = 0; i < pts.length; i++) {
                        const sp1 = transform.point(pts[i]); 
                        const sp2 = transform.point(pts[(i + 1) % pts.length]);
                        const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                        const lenSq = C * C + D * D;
                        if (lenSq !== 0) {
                            const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                            if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                                h = s.params.height3D !== undefined ? s.params.height3D : 100;
                                underlyingWall = true;
                                break;
                            }
                        }
                    }
                    if (underlyingWall) break;
                }
            }

            const t = Math.max(1, w.thickness !== undefined ? w.thickness : (w.config?.thickness || 4));

            const configId = w.configId || 'rail_1';
            const config = RAILING_REGISTRY[configId] || RAILING_REGISTRY['rail_1'];
            
            const wallGroup = new THREE.Group();
            wallGroup.position.set(0, 0, 0);

            let hitGeo;
            let isMitered = false;
            const pts = (w.poly && typeof w.poly.points === 'function') ? w.poly.points() : w.pts;
            
            // The 3D selection mesh must encompass the curb (h) + the railing physical size (40)
            const totalH = h + 40;

            // Use the exact mitered 2D boundaries for extrusion if available
            if (pts && pts.length === 8) {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0], pts[1]);
                shape.lineTo(pts[2], pts[3]);
                shape.lineTo(pts[4], pts[5]);
                shape.lineTo(pts[6], pts[7]);
                shape.lineTo(pts[0], pts[1]);
                hitGeo = new THREE.ExtrudeGeometry(shape, { depth: totalH, bevelEnabled: false });
                hitGeo.rotateX(Math.PI / 2);
                isMitered = true;
            }
            
            if (!isMitered) {
                hitGeo = new THREE.BoxGeometry(length, totalH, 10);
                hitGeo.translate(length / 2, totalH / 2, 0);
            }

            const hitMesh = new THREE.Mesh(hitGeo, new THREE.MeshBasicMaterial({ visible: false }));
            if (isMitered) {
                hitMesh.position.set(0, totalH, 0);
            } else {
                hitMesh.position.set(p1.x, 0, p1.y);
                hitMesh.rotation.y = -Math.atan2(dz, dx);
            }
            hitMesh.userData = { isWallSide: true, side: 'front', entity: w };
            wallGroup.add(hitMesh);
            this.ctx.interactables.push(hitMesh);

            this.ctx.structureGroup.add(wallGroup);
            w.mesh3D = wallGroup;

            const buildBaseWall = (baseH, useColor = true) => {
                if (baseH <= 0) return;
                if (underlyingWall && baseH === h) return; // Skip building redundant curb to prevent Z-fighting
                let geo;
                if (isMitered) {
                    const shape = new THREE.Shape();
                    shape.moveTo(pts[0], pts[1]);
                    shape.lineTo(pts[2], pts[3]);
                    shape.lineTo(pts[4], pts[5]);
                    shape.lineTo(pts[6], pts[7]);
                    shape.lineTo(pts[0], pts[1]);
                    geo = new THREE.ExtrudeGeometry(shape, { depth: baseH, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2); 
                } else {
                    geo = new THREE.BoxGeometry(length, baseH, t);
                    geo.translate(length / 2, baseH / 2, 0);
                }
                
                const mat = new THREE.MeshStandardMaterial({ 
                    color: useColor ? (config?.color || 0xcccccc) : 0xcccccc, 
                    transparent: useColor ? (config?.transparent || false) : false, 
                    opacity: useColor ? (config?.opacity || 1) : 1 
                });
                const mesh = new THREE.Mesh(geo, mat);
                
                if (isMitered) {
                    mesh.position.set(0, baseH, 0);
                } else {
                    mesh.position.set(p1.x, 0, p1.y);
                    mesh.rotation.y = -Math.atan2(dz, dx);
                }
                mesh.castShadow = true; mesh.receiveShadow = true;
                wallGroup.add(mesh);
            };

            if (config && config.model) {
                console.log(`[3D Engine] Requesting model build for Railing config: ${configId}`);
                this.ctx.assets.getModel(config).then(model => {
                    console.log(`[3D Engine] Model successfully received by Railing builder for: ${configId}`);
                    const clone = model.clone();
                    
                    // Safely force matrix update so BoundingBox detects correct size
                    clone.updateMatrixWorld(true);
                    
                    const initialBox = new THREE.Box3().setFromObject(clone);
                    const initialSize = initialBox.getSize(new THREE.Vector3());
                    const center = initialBox.getCenter(new THREE.Vector3());

                    if (initialSize.y === 0 || initialSize.x === 0) {
                        buildBaseWall(totalH, true);
                        return;
                    }

                    buildBaseWall(h, false); // Base physical curb/wall beneath the railing

                    const RAILING_TARGET_HEIGHT = 40;
                    const scaleFactor = RAILING_TARGET_HEIGHT / initialSize.y;

                    const translationMat = new THREE.Matrix4().makeTranslation(-center.x, -initialBox.min.y, -center.z);
                    const scaleMat = new THREE.Matrix4().makeScale(scaleFactor, scaleFactor, scaleFactor);

                    const meshes = [];
                    clone.traverse(child => { if (child.isMesh) meshes.push(child); });

                    // Force geometry matrix baking to eliminate nested model transform sinking bugs
                    meshes.forEach(child => {
                        child.geometry = child.geometry.clone();
                        child.geometry.applyMatrix4(child.matrixWorld);
                        child.geometry.applyMatrix4(translationMat);
                        child.geometry.applyMatrix4(scaleMat);
                        child.geometry.computeBoundingBox();
                        child.geometry.computeBoundingSphere();
                        
                        if (child.material) {
                            child.material.side = THREE.DoubleSide;
                            child.material.needsUpdate = true;
                        }
                        child.castShadow = true; child.receiveShadow = true;
                    });

                    clone.traverse(child => {
                        child.position.set(0, 0, 0);
                        child.rotation.set(0, 0, 0);
                        child.scale.set(1, 1, 1);
                        child.updateMatrix();
                    });
                    clone.updateMatrixWorld(true);

                    const currentRailingLength = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3()).x;
                    
                    const edge = {
                        start: new THREE.Vector3(p1.x, h, p1.y),
                        end: new THREE.Vector3(p2.x, h, p2.y)
                    };
                    const edgeVector = new THREE.Vector3().subVectors(edge.end, edge.start);
                    const edgeLength = edgeVector.length();
                    const direction = edgeVector.clone().normalize();

                    const count = Math.floor(edgeLength / currentRailingLength);
                    let stretchScale = 1;
                    let actualCount = count;

                    if (count === 0) {
                        stretchScale = edgeLength / currentRailingLength;
                        actualCount = 1;
                    } else {
                        stretchScale = (edgeLength / count) / currentRailingLength;
                    }
                    
                    for (let i = 0; i < actualCount; i++) {
                        const inst = clone.clone();
                        inst.scale.set(stretchScale, 1, 1);

                        const segmentLength = (currentRailingLength * stretchScale);
                        const offsetDistance = (i * segmentLength) + (segmentLength / 2);

                        const position = edge.start.clone().add(direction.clone().multiplyScalar(offsetDistance));
                        position.y = h; // Lift railing to sit on top of underlying wall
                        inst.position.copy(position);

                        const target = position.clone().add(direction);
                        inst.lookAt(target);
                        inst.rotateY(-Math.PI / 2);

                        wallGroup.add(inst);
                    }                }).catch(e => {
                    console.error(`[3D Engine] Failed to load railing model from ${config.model}:`, e);
                    // Use procedural builder as fallback for failed model load
                    const parametricRailing = Railing3DBuilder.build(w);
                    if (parametricRailing) {
                        parametricRailing.position.y = h; // sit on curb
                        wallGroup.add(parametricRailing);
                    }
                    buildBaseWall(totalH, true);
                });
            } else {
                // Procedural generation
                const parametricRailing = Railing3DBuilder.build(w);
                if (parametricRailing) {
                    parametricRailing.position.y = h; // sit on curb
                    wallGroup.add(parametricRailing);
                }
                buildBaseWall(h, false); // Build the base curb if h > 0
            }
        });
    }

    buildStaticFloors(levelsConfigArray, activeIndex, viewMode3D, stairs = []) {
        const isPreview = viewMode3D === 'preview';
        const levelElevations = computeLevelElevations(levelsConfigArray);

        levelsConfigArray.forEach((levelConfig, index) => {
            if (index === activeIndex) return; 
            if (!levelConfig || !levelConfig.data) return;
            if (levelConfig.isVisible === false) return;

            try {
                const data = JSON.parse(levelConfig.data);
                const floorGroup = new THREE.Group();
                floorGroup.position.y = levelElevations[index] !== undefined ? levelElevations[index] : (index * WALL_HEIGHT);

                if (data.stairs) {
                    let maxWallHeight2 = WALL_HEIGHT;
                    if (data.walls && data.walls.length > 0) {
                        const mainWalls2 = data.walls.filter(w => !w.parentGroup);
                        if (mainWalls2.length > 0) maxWallHeight2 = Math.max(...mainWalls2.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
                    }
                    this.stairBuilder.build(data.stairs, floorGroup, index, true, maxWallHeight2);
                }

                const matMain = getPlasterMaterial();
                const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9 });
                const matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });

                const isStaticSub = levelConfig?.type === 'plinth' || levelConfig?.type === 'foundation';
                const subH = Number(levelConfig?.height) || (levelConfig?.type === 'plinth' ? 18 : 40);
                if (data.rooms) {
                    data.rooms.forEach(room => {
                        if (room.isDeleted || room.isHidden) return;
                        const path = room.path;
                        if (!path || path.length < 3) return;
                        const floorShape = new THREE.Shape();
                        floorShape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                        
                        let stairsBelow = [];
                        if (index > 0 && levelsConfigArray[index - 1] && levelsConfigArray[index - 1].data) {
                            try {
                                const prevData = JSON.parse(levelsConfigArray[index - 1].data);
                                if (prevData.stairs) stairsBelow = prevData.stairs;
                            } catch (e) {}
                        }
                        
                        if (stairsBelow && stairsBelow.length > 0) {
                            stairsBelow.forEach(stair => {
                                if (stair.type && stair.type.startsWith('stair_v5_')) {
                                    const width = Number(stair.width) || 100;
                                    const sd = Number(stair.stepDepth) || 28;
                                    const ls = Number(stair.landingSize) || width;
                                    const f1 = Number(stair.flight1Steps) || 6;
                                    const f2 = Number(stair.flight2Steps) || 6;
                                    const l1 = f1 * sd;
                                    const l2 = f2 * sd;
                                    const turn = stair.turnDirection || 'right';
                                    const gw = Number(stair.gapWidth) || 20;

                                    const rects = []; 

                                    if (stair.shape === 'straight') {
                                        const totalL = (Number(stair.totalSteps) || 12) * sd;
                                        let y = 0; let totalLen = totalL;
                                        if (stair.hasBottomLanding) { y -= ls; totalLen += ls; }
                                        if (stair.hasTopLanding) { totalLen += ls; }
                                        rects.push({ x: -width/2, y: y, w: width, h: totalLen });
                                    } else if (stair.shape === 'L') {
                                        let y = 0; let f1Len = l1;
                                        if (stair.hasBottomLanding) { y -= ls; f1Len += ls; }
                                        rects.push({ x: -width/2, y: y, w: width, h: f1Len });
                                        
                                        const f2X = turn === 'right' ? -width/2 : -width/2 - l2;
                                        let f2Len = l2 + width;
                                        let f2Start = f2X;
                                        if (stair.hasTopLanding) {
                                            f2Len += ls;
                                            if (turn !== 'right') f2Start -= ls;
                                        }
                                        rects.push({ x: f2Start, y: l1, w: f2Len, h: width });
                                    } else if (stair.shape === 'U') {
                                        let y = 0; let f1Len = l1;
                                        if (stair.hasBottomLanding) { y -= ls; f1Len += ls; }
                                        rects.push({ x: -width - gw/2, y: y, w: width, h: f1Len });

                                        const midY = l1;
                                        rects.push({ x: -width - gw/2, y: midY, w: width * 2 + gw, h: ls });

                                        const f2Len = l2;
                                        rects.push({ x: gw/2, y: midY - f2Len, w: width, h: f2Len });
                                    }
                                    
                                    const sAngle = (stair.rotation || 0) * Math.PI / 180;
                                    const sX = stair.x || 0;
                                    const sY = stair.y || 0;
                                    
                                    rects.forEach(r => {
                                        const corners = [
                                            { x: r.x, y: r.y },
                                            { x: r.x + r.w, y: r.y },
                                            { x: r.x + r.w, y: r.y + r.h },
                                            { x: r.x, y: r.y + r.h }
                                        ];
                                        
                                        const rotC = corners.map(c => ({
                                            x: sX + (c.x * Math.cos(sAngle) - c.y * Math.sin(sAngle)),
                                            y: sY + (c.x * Math.sin(sAngle) + c.y * Math.cos(sAngle))
                                        }));

                                        let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
                                        path.forEach(p => {
                                            minRx = Math.min(minRx, p.x); maxRx = Math.max(maxRx, p.x);
                                            minRy = Math.min(minRy, p.y); maxRy = Math.max(maxRy, p.y);
                                        });

                                        const overlaps = rotC.some(c => c.x >= minRx && c.x <= maxRx && c.y >= minRy && c.y <= maxRy);

                                        if (overlaps) {
                                            const hole = new THREE.Path();
                                            hole.moveTo(rotC[0].x, rotC[0].y);
                                            hole.lineTo(rotC[1].x, rotC[1].y);
                                            hole.lineTo(rotC[2].x, rotC[2].y);
                                            hole.lineTo(rotC[3].x, rotC[3].y);
                                            hole.lineTo(rotC[0].x, rotC[0].y);
                                            floorShape.holes.push(hole);
                                        }
                                    });
                                }
                            });
                        }

                        if (data.shapes) {
                            data.shapes.forEach(shape => {
                                if (shape.type === 'shape_floor_cut') {
                                    const rot = (shape.rotation || 0) * Math.PI / 180;
                                    const sx = shape.x || shape.params?.x || 0;
                                    const sy = shape.y || shape.params?.y || 0;
                                    let pts;
                                    if (shape.params?.points && shape.params.points.length >= 3) {
                                        pts = shape.params.points;
                                    } else {
                                        const w = shape.params?.width || shape.width || 100;
                                        const h = shape.params?.height || shape.height || 100;
                                        pts = [
                                            { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 },
                                            { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }
                                        ];
                                    }
                                    
                                    const rotC = pts.map(c => ({
                                        x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                                        y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                                    }));

                                    let minRx = Infinity, maxRx = -Infinity, minRy = Infinity, maxRy = -Infinity;
                                    path.forEach(p => {
                                        minRx = Math.min(minRx, p.x); maxRx = Math.max(maxRx, p.x);
                                        minRy = Math.min(minRy, p.y); maxRy = Math.max(maxRy, p.y);
                                    });

                                    const overlaps = rotC.some(c => c.x >= minRx && c.x <= maxRx && c.y >= minRy && c.y <= maxRy);

                                    if (overlaps) {
                                        const hole = new THREE.Path();
                                        hole.moveTo(rotC[0].x, rotC[0].y);
                                        hole.lineTo(rotC[1].x, rotC[1].y);
                                        hole.lineTo(rotC[2].x, rotC[2].y);
                                        hole.lineTo(rotC[3].x, rotC[3].y);
                                        hole.lineTo(rotC[0].x, rotC[0].y);
                                        floorShape.holes.push(hole);
                                    }
                                }
                            });
                        }

                        const slabDepth = isStaticSub ? subH : 2;
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: slabDepth, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        
                        const pos = floorGeo.attributes.position;
                        const uvs = new Float32Array(pos.count * 2);
                        for (let i = 0; i < pos.count; i++) {
                            uvs[i * 2] = pos.getX(i) / 100;
                            uvs[i * 2 + 1] = -pos.getZ(i) / 100;
                        }
                        floorGeo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
                        
                        const configId = room.configId || 'hardwood';
                        const config = FLOOR_REGISTRY[configId];
                        
                        const matFloor = isStaticSub ? getPlasterMaterial() : new THREE.MeshStandardMaterial({ 
                            color: config?.color || 0xd1d5db, 
                            roughness: config?.roughness || 0.7 
                        });
                        const floorMesh = new THREE.Mesh(floorGeo, matFloor);
                        floorMesh.position.y = isStaticSub ? (subH - 0.01) : 0.05;
                        floorMesh.receiveShadow = true;
                        
                        if (config && config.texture && !isStaticSub) {
                            this.ctx.assets.getTexture(config).then(tex => {
                                const texClone = tex.clone();
                                texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                                const { repeatX, repeatY } = MaterialFactory.calculateTexelDensity({ width: 100, height: 100 }, config);
                                texClone.repeat.set(repeatX, repeatY);
                                matFloor.map = texClone;
                                matFloor.needsUpdate = true;
                            });
                        }
                        
                        if (!isPreview) {
                            floorMesh.userData = { isFloorTrigger: true, levelIndex: index };
                            this.ctx.interactables.push(floorMesh);
                        }
                        floorGroup.add(floorMesh);
                    });
                } else if (data.roomPaths) {
                    data.roomPaths.forEach(path => {
                        const floorShape = new THREE.Shape();
                        floorShape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                        
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 2, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }));
                        floorMesh.position.y = 0.05;
                        floorMesh.receiveShadow = true;
                        
                        if (!isPreview) {
                            floorMesh.userData = { isFloorTrigger: true, levelIndex: index };
                            this.ctx.interactables.push(floorMesh);
                        }
                        floorGroup.add(floorMesh);
                    });
                }

                if (data.walls) {
                    data.walls.forEach((w, wallIndex) => {
                        const dx = w.endX - w.startX;
                        const dz = w.endY - w.startY;
                        const length = Math.hypot(dx, dz);
                        const angle = Math.atan2(dz, dx);
                        
                        // MOCK PremiumWall DATA FOR DecorManager TO WORK SEAMLESSLY
                        w.config = { thickness: w.thickness };
                        w.length3D = length;
                        w.attachedWidgets = w.widgets ? w.widgets.map(wd => ({ ...wd, type: wd.configId })) : [];
                        w.attachedDecor = w.decors || [];
                        w.isStatic = true;
                        w.levelIndex = index;
                        w.wallIndex = wallIndex;
                        
                        let h = w.height !== undefined ? w.height : (w.config?.height || (w.type === 'railing' ? 0 : WALL_HEIGHT));
                        let underlyingWall = null;
                        
                        if (w.type === 'railing') {
                            const midX = (w.startX + w.endX) / 2, midY = (w.startY + w.endY) / 2;
                            for (let sw of data.walls) {
                                if (sw.type === 'railing') continue;
                                const C = sw.endX - sw.startX, D = sw.endY - sw.startY;
                                const lenSq = C * C + D * D;
                                if (lenSq !== 0) {
                                    const param = Math.max(0, Math.min(1, ((midX - sw.startX)*C + (midY - sw.startY)*D)/lenSq));
                                    if (Math.hypot(midX - (sw.startX + param*C), midY - (sw.startY + param*D)) < 5) {
                                        underlyingWall = sw;
                                        h = sw.height !== undefined ? sw.height : (sw.config?.height || WALL_HEIGHT);
                                        break;
                                    }
                                }
                            }
                            
                            if (!underlyingWall && data.shapes) {
                                for (let s of data.shapes) {
                                    if (s.type !== 'shape_rect' && s.type !== 'shape_polygon') continue;
                                    let pts = [];
                                    if (s.type === 'shape_rect') { 
                                        const sw = s.params.width; const sh = s.params.height; 
                                        pts = [ {x: -sw/2, y: -sh/2}, {x: sw/2, y: -sh/2}, {x: sw/2, y: sh/2}, {x: -sw/2, y: sh/2} ]; 
                                    } else { 
                                        pts = s.params.points; 
                                    }
                                    if (!pts) continue;

                                    const rad = (s.rotation || 0) * Math.PI / 180;
                                    const cos = Math.cos(rad), sin = Math.sin(rad);
                                    const sx = s.scaleX || 1, sy = s.scaleY || 1;
                                    const cx = s.x || 0, cy = s.y || 0;

                                    for (let i = 0; i < pts.length; i++) {
                                        const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
                                        const sp1 = { x: cx + (p1.x * sx * cos - p1.y * sy * sin), y: cy + (p1.x * sx * sin + p1.y * sy * cos) };
                                        const sp2 = { x: cx + (p2.x * sx * cos - p2.y * sy * sin), y: cy + (p2.x * sx * sin + p2.y * sy * cos) };

                                        const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                                        const lenSq = C * C + D * D;
                                        if (lenSq !== 0) {
                                            const param = Math.max(0, Math.min(1, ((midX - sp1.x) * C + (midY - sp1.y) * D) / lenSq));
                                            if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                                                underlyingWall = true;
                                                h = s.params !== undefined && s.params.height3D !== undefined ? s.params.height3D : 100;
                                                break;
                                            }
                                        }
                                    }
                                    if (underlyingWall) break;
                                }
                            }
                        }
                        
                        const totalH = w.type === 'railing' ? h + 40 : h;
                        const startY = (w.type === 'railing' && underlyingWall && h > 0) ? h : 0;
                        const wallBottom = w.type === 'railing' ? startY : -1;
                        
                        // Compute mm early so holes and patterns can inherit painted materials
                        let mm = [matMain, matMain, matMain, matMain, matMain, matMain];
                        if (this.ctx.helpers && this.ctx.helpers.getFaceMaterials) {
                            mm = this.ctx.helpers.getFaceMaterials(w, matMain, { width: length, height: totalH }).box;
                        }
                        const wallShape = new THREE.Shape();
                        const type = w.topProfileType || 'normal';
                        const startH = w.startHeight !== undefined ? w.startHeight : totalH;
                        const endH = w.endHeight !== undefined ? w.endHeight : totalH;
                        const peakH = w.peakHeight !== undefined ? w.peakHeight : totalH;
                        const maxH = Math.max(startH, endH, peakH, totalH);

                        wallShape.moveTo(0, wallBottom);
                        wallShape.lineTo(length, wallBottom);
                        if (type === 'single') {
                            wallShape.lineTo(length, endH);
                            wallShape.lineTo(0, startH);
                        } else if (type === 'gable') {
                            wallShape.lineTo(length, endH);
                            wallShape.lineTo(length / 2, peakH);
                            wallShape.lineTo(0, startH);
                        } else {
                            wallShape.lineTo(length, totalH);
                            wallShape.lineTo(0, totalH);
                        }
                        wallShape.lineTo(0, wallBottom);

                        const wallGroup = new THREE.Group();
                        wallGroup.position.set(w.startX, 0, w.startY);
                        wallGroup.rotation.y = -angle;
                        wallGroup.userData = { entity: w };
                        w.mesh3D = wallGroup;

                        const extraMeshes = [];
                        if (w.attachedWidgets) {
                            w.attachedWidgets.forEach(widg => {
                                const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
                                const maxH = totalH; // totalH is the wall height (h)
                                let hasHole = false;
                                const type = widg.type || widg.configId;
                                
                                if (type === 'door') {
                                    let dh = widg.height !== undefined ? widg.height : DOOR_HEIGHT;
                                    let elev = widg.elevation !== undefined ? widg.elevation : 0;
                                    dh = Math.min(dh, maxH - elev);
                                    let cutElev = (elev <= 0.1) ? wallBottom : elev;
                                    
                                    const shapeType = widg.doorShape || widg.windowShape || widg.params?.doorShape || widg.params?.windowShape || widg.config?.doorShape || widg.config?.windowShape || widg.shape || (widg.configId === 'entry_arched_double' ? 'radius' : 'square');
                                    hole.moveTo(wCenter - halfW, cutElev);
                                    hole.lineTo(wCenter + halfW, cutElev);
                                    
                                    if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                                        const straightH = Math.max(0, dh - halfW);
                                        hole.lineTo(wCenter + halfW, elev + straightH);
                                        if (halfW > 0) hole.absarc(wCenter, elev + straightH, halfW, 0, Math.PI, false);
                                    } else if (shapeType === 'segment') {
                                        const rise = widg.width * 0.15;
                                        const straightH = Math.max(0, dh - rise);
                                        hole.lineTo(wCenter + halfW, elev + straightH);
                                        hole.quadraticCurveTo(wCenter, elev + dh + rise*0.5, wCenter - halfW, elev + straightH);
                                    } else if (shapeType === 'gothic') {
                                        const straightH = Math.max(0, dh - (widg.width * 0.7));
                                        hole.lineTo(wCenter + halfW, elev + straightH);
                                        hole.quadraticCurveTo(wCenter + halfW * 0.2, elev + dh, wCenter, elev + dh);
                                        hole.quadraticCurveTo(wCenter - halfW * 0.2, elev + dh, wCenter - halfW, elev + straightH);
                                    } else {
                                        hole.lineTo(wCenter + halfW, elev + dh);
                                        hole.lineTo(wCenter - halfW, elev + dh);
                                    }
                                    
                                    hole.lineTo(wCenter - halfW, cutElev);
                                    hasHole = true;
                                } else if (type === 'window' || type === 'jali_panel') {
                                    let dh = widg.height !== undefined ? widg.height : (type === 'window' ? WINDOW_HEIGHT : 100);
                                    let elev = widg.elevation !== undefined ? widg.elevation : (type === 'window' ? WINDOW_SILL : 0);
                                    dh = Math.min(dh, maxH - elev);
                                    let cutElev = (elev <= 0.1) ? wallBottom : elev;
                                    const shapeType = widg.windowShape || widg.doorShape || widg.params?.windowShape || widg.params?.doorShape || widg.config?.windowShape || widg.config?.doorShape || widg.shape || 'square';
                                    
                                    hole.moveTo(wCenter - halfW, cutElev);
                                    hole.lineTo(wCenter + halfW, cutElev);
                                    if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                                        const straightH = Math.max(0, dh - halfW);
                                        hole.lineTo(wCenter + halfW, elev + straightH);
                                        if (halfW > 0) hole.absarc(wCenter, elev + straightH, halfW, 0, Math.PI, false);
                                    } else if (shapeType === 'segment') {
                                        const rise = widg.width * 0.15;
                                        const straightH = Math.max(0, dh - rise);
                                        hole.lineTo(wCenter + halfW, elev + straightH);
                                        hole.quadraticCurveTo(wCenter, elev + dh + rise*0.5, wCenter - halfW, elev + straightH);
                                    } else if (shapeType === 'gothic') {
                                        const straightH = Math.max(0, dh - (widg.width * 0.7));
                                        hole.lineTo(wCenter + halfW, elev + straightH);
                                        hole.quadraticCurveTo(wCenter + halfW * 0.2, elev + dh, wCenter, elev + dh);
                                        hole.quadraticCurveTo(wCenter - halfW * 0.2, elev + dh, wCenter - halfW, elev + straightH);
                                    } else {
                                        hole.lineTo(wCenter + halfW, elev + dh);
                                        hole.lineTo(wCenter - halfW, elev + dh);
                                    }
                                    hole.lineTo(wCenter - halfW, cutElev);
                                    hasHole = true;
                                } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type)) {
                                    let elev = widg.elevation || 0;
                                    let h_opening = widg.height || 200;
                                    elev = Math.max(0, Math.min(elev, maxH));
                                    h_opening = Math.max(0, Math.min(h_opening, maxH - elev));
                                    let cutElev = (elev <= 0.1) ? wallBottom : elev;    if (h_opening > 0) {
                                        if (type === 'arch_opening') {
                                            const radius = halfW;
                                            const straightH = Math.max(0, h_opening - radius);
                                            hole.moveTo(wCenter - halfW, cutElev);
                                            hole.lineTo(wCenter + halfW, cutElev);
                                            hole.lineTo(wCenter + halfW, elev + straightH);
                                            if (radius > 0) hole.absarc(wCenter, elev + straightH, radius, 0, Math.PI, false);
                                            hole.lineTo(wCenter - halfW, elev);
                                            hasHole = true;
                                        } else if (type === 'circular_opening') {
                                            hole.moveTo(wCenter + halfW, elev + h_opening / 2);
                                            hole.absellipse(wCenter, elev + h_opening / 2, halfW, h_opening / 2, 0, Math.PI * 2, false, 0);
                                            hasHole = true;
                                        } else if (type === 'custom_shape_opening') {
                                            hole.moveTo(wCenter, elev);
                                            hole.lineTo(wCenter + halfW, elev + h_opening / 2);
                                            hole.lineTo(wCenter, elev + h_opening);
                                            hole.lineTo(wCenter - halfW, elev + h_opening / 2);
                                            hole.lineTo(wCenter, elev);
                                            hasHole = true;
                                        } else if (type === 'pattern_opening') {
                                            hole.moveTo(wCenter - halfW, elev);
                                            hole.lineTo(wCenter + halfW, elev);
                                            hole.lineTo(wCenter + halfW, elev + h_opening);
                                            hole.lineTo(wCenter - halfW, elev + h_opening);
                                            hole.lineTo(wCenter - halfW, elev);
                                            hasHole = true;

                                            const patternShape = new THREE.Shape();
                                            patternShape.moveTo(wCenter - halfW, elev);
                                            patternShape.lineTo(wCenter + halfW, elev);
                                            patternShape.lineTo(wCenter + halfW, elev + h_opening);
                                            patternShape.lineTo(wCenter - halfW, elev + h_opening);
                                            patternShape.lineTo(wCenter - halfW, elev);

                                            const rows = widg.rows || 4, cols = widg.cols || 4, spacing = widg.spacing !== undefined ? widg.spacing : 5;
                                            const style = widg.patternStyle || 'grid';
                                            const pW = (widg.width - spacing * (cols + 1)) / cols;
                                            const pH = (h_opening - spacing * (rows + 1)) / rows;
                                            if (pW > 0 && pH > 0) {
                                                for (let r = 0; r < rows; r++) {
                                                    for (let c = 0; c < cols; c++) {
                                                        const px = (wCenter - halfW) + spacing + c * (pW + spacing);
                                                        const py = elev + spacing + r * (pH + spacing);
                                                        const pPath = new THREE.Path();
                                                        const cx = px + pW/2, cy = py + pH/2;
                                                        if (style === 'diamond') {
                                                            pPath.moveTo(cx, py); pPath.lineTo(px + pW, cy); pPath.lineTo(cx, py + pH); pPath.lineTo(px, cy); pPath.lineTo(cx, py);
                                                        } else if (style === 'circle') {
                                                            pPath.moveTo(cx + Math.min(pW, pH)/2, cy); pPath.absarc(cx, cy, Math.min(pW, pH)/2, 0, Math.PI * 2, false);
                                                        } else if (style === 'cross') {
                                                            const w1 = pW*0.2, h1 = pH*0.8, w2 = pW*0.8, h2 = pH*0.2;
                                                            pPath.moveTo(cx-w1/2, cy-h1/2); pPath.lineTo(cx+w1/2, cy-h1/2); pPath.lineTo(cx+w1/2, cy-h2/2); pPath.lineTo(cx+w2/2, cy-h2/2); pPath.lineTo(cx+w2/2, cy+h2/2); pPath.lineTo(cx+w1/2, cy+h2/2); pPath.lineTo(cx+w1/2, cy+h1/2); pPath.lineTo(cx-w1/2, cy+h1/2); pPath.lineTo(cx-w1/2, cy+h2/2); pPath.lineTo(cx-w2/2, cy+h2/2); pPath.lineTo(cx-w2/2, cy-h2/2); pPath.lineTo(cx-w1/2, cy-h2/2); pPath.lineTo(cx-w1/2, cy-h1/2);
                                                        } else if (style === 'hexagon') {
                                                            const rad = Math.min(pW, pH)/2; for (let i = 0; i < 6; i++) { const a = (i*Math.PI)/3; const hx = cx + rad*Math.cos(a), hy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(hx,hy); else pPath.lineTo(hx,hy); } pPath.lineTo(cx+rad, cy);
                                                        } else if (style === 'star') {
                                                            const rOut = Math.min(pW, pH)/2, rIn = rOut*0.3; for (let i = 0; i < 8; i++) { const a = (i*Math.PI)/4; const rad = i%2===0 ? rOut : rIn; const sx = cx + rad*Math.cos(a), sy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(sx,sy); else pPath.lineTo(sx,sy); } pPath.lineTo(cx+rOut, cy);
                                                        } else if (style === 'slit') {
                                                            const slitW = pW*0.3, slitH = pH*0.9; pPath.moveTo(cx-slitW/2, cy-slitH/2); pPath.lineTo(cx+slitW/2, cy-slitH/2); pPath.lineTo(cx+slitW/2, cy+slitH/2); pPath.lineTo(cx-slitW/2, cy+slitH/2); pPath.lineTo(cx-slitW/2, cy-slitH/2);
                                                        } else if (style === 'terracotta') {
                                                         const hw = pW * 0.495, hh = pH * 0.495;
                                                         const ch = new THREE.Path();
                                                         ch.absellipse(cx, cy, hw * 0.44, hh * 0.44, 0, Math.PI * 2, false);
                                                         patternShape.holes.push(ch);

                                                         [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(a => {
                                                             const cos = Math.cos(a), sin = Math.sin(a);
                                                             const rot = (x, y) => ({ x: cx + (x * cos - y * sin), y: cy + (x * sin + y * cos) });
                                                             const p = new THREE.Path();
                                                             const tip = rot(0, hh * 0.95);
                                                             const cr = rot(hw * 0.18, hh * 0.72);
                                                             const br = rot(hw * 0.22, hw * 0.51);
                                                             const bl = rot(-hw * 0.22, hw * 0.51);
                                                             const cl = rot(-hw * 0.18, hh * 0.72);
                                                             const midRing = rot(0, hw * 0.49);

                                                             p.moveTo(tip.x, tip.y);
                                                             p.quadraticCurveTo(cr.x, cr.y, br.x, br.y);
                                                             p.quadraticCurveTo(midRing.x, midRing.y, bl.x, bl.y);
                                                             p.quadraticCurveTo(cl.x, cl.y, tip.x, tip.y);
                                                             p.closePath();
                                                             patternShape.holes.push(p);
                                                         });

                                                         [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].forEach(a => {
                                                             const cos = Math.cos(a), sin = Math.sin(a);
                                                             const rot = (x, y) => ({ x: cx + (x * cos - y * sin), y: cy + (x * sin + y * cos) });
                                                             const p = new THREE.Path();
                                                             const p1 = rot(hw * 0.12, hh * 0.95);
                                                             const p2 = rot(hw * 0.95, hh * 0.95);
                                                             const p3 = rot(hw * 0.95, hh * 0.12);
                                                             const pCtrl = rot(hw * 0.42, hh * 0.42);

                                                             p.moveTo(p1.x, p1.y);
                                                             p.lineTo(p2.x, p2.y);
                                                             p.lineTo(p3.x, p3.y);
                                                             p.quadraticCurveTo(pCtrl.x, pCtrl.y, p1.x, p1.y);
                                                             p.closePath();
                                                             patternShape.holes.push(p);
                                                         });
                                                         continue;
                                                        } else if (style === 'arabesque') {
                                                            const rOut = Math.min(pW, pH)/2, rIn = rOut*0.55; for (let i = 0; i < 16; i++) { const a = (i*Math.PI)/8; const rad = i%2===0 ? rOut : rIn; const sx = cx + rad*Math.cos(a), sy = cy + rad*Math.sin(a); if (i===0) pPath.moveTo(sx,sy); else pPath.lineTo(sx,sy); }
                                                        } else {
                                                            pPath.moveTo(px, py); pPath.lineTo(px + pW, py); pPath.lineTo(px + pW, py + pH); pPath.lineTo(px, py + pH); pPath.lineTo(px, py);
                                                        }
                                                        pPath.closePath();
                                                        patternShape.holes.push(pPath);
                                                    }
                                                }
                                            }
                                            const patternGeo = new THREE.ExtrudeGeometry(patternShape, { depth: w.thickness, bevelEnabled: false });
                                            patternGeo.translate(0, 0, -w.thickness / 2);
                                            const patternMat = mm[4].clone(); // inherit wall material
                                            const patternMesh = new THREE.Mesh(patternGeo, patternMat);
                                            patternMesh.castShadow = true; patternMesh.receiveShadow = true;
                                            
                                            const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, w.thickness + 4);
                                            hitBoxGeo.translate(wCenter, elev + h_opening / 2, 0);
                                            const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                                            hitBox.userData = { isHitbox: true };
                                            const patternGroup = new THREE.Group();
                                            patternGroup.add(patternMesh, hitBox);
                                            patternGroup.userData = { isPattern: true, entity: widg };
                                            widg.patternMesh3D = patternGroup;
                                            widg.patternMat3D = patternMat;
                                            
                                            this.ctx.updatePatternLive(widg);
                                            extraMeshes.push(patternGroup);
                                            if (!isPreview) this.ctx.interactables.push(hitBox);

                                        } else {
                                        hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, elev + h_opening); hole.lineTo(wCenter - halfW, elev + h_opening); hole.lineTo(wCenter - halfW, cutElev);
                                            hasHole = true;
                                        }
                                        
                                        if (type === 'niche_recess') {
                                            const depth = widg.depth || 10;
                                            const recessThickness = Math.max(0.5, w.thickness - depth);
                                            const nicheGeo = new THREE.BoxGeometry(widg.width, h_opening, recessThickness);
                                            const zOffset = (widg.facing === -1) ? (w.thickness/2 - recessThickness/2) : (-w.thickness/2 + recessThickness/2);
                                            nicheGeo.translate(wCenter, elev + h_opening/2, zOffset);
                                            const nicheMesh = new THREE.Mesh(nicheGeo, mm[4]); // inherit wall material
                                            nicheMesh.castShadow = true; nicheMesh.receiveShadow = true;
                                            extraMeshes.push(nicheMesh);
                                        }
                                    }
                                }
                                if (hasHole) wallShape.holes.push(hole);

                                if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                                    widg.x = w.startX + Math.cos(angle) * wCenter;
                                    widg.z = w.startY + Math.sin(angle) * wCenter;
                                    widg.angle = angle;
                                    widg.thick = w.thickness;
                                    widg.wall = w;
                                    
                                    widg.localX = wCenter;
                                    
                                    const widgetGroup = WIDGET_REGISTRY[type].render3D(wallGroup, widg, this.ctx.helpers);
                                    if (widgetGroup) {
                                        widg.mesh3D = widgetGroup;
                                        this.ctx.interactables.push(widgetGroup);
                                    }
                                }
                            });
                        }
                        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: w.thickness, bevelEnabled: false });
                        wallGeo.translate(0, 0, -w.thickness / 2);
                        
                        // ====== MITER JOINT SHEARING ======
                        let localSL_x = 0, localSR_x = 0, localEL_x = length, localER_x = length;
                        if (w.pts && w.pts.length === 8) {
                            const toLocalX = (ptX, ptY) => {
                                const dx_pt = ptX - w.startX;
                                const dy_pt = ptY - w.startY;
                                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
                            };
                            localSL_x = toLocalX(w.pts[0], w.pts[1]);
                            localEL_x = toLocalX(w.pts[2], w.pts[3]);
                            localER_x = toLocalX(w.pts[4], w.pts[5]);
                            localSR_x = toLocalX(w.pts[6], w.pts[7]);

                        const shearGeo = (geo, geomThickness = w.thickness) => {
                            const pos = geo.attributes.position;
                            for (let i = 0; i < pos.count; i++) {
                                const x = pos.getX(i);
                                const z = pos.getZ(i);
                                const tZ = Math.max(0, Math.min(1, (z + geomThickness / 2) / geomThickness));
                                const startX = localSR_x + tZ * (localSL_x - localSR_x);
                                const endX = localER_x + tZ * (localEL_x - localER_x);
                                
                                if (x <= 0.1) {
                                    pos.setX(i, startX);
                                } else if (x >= length - 0.1) {
                                    pos.setX(i, endX);
                                } else {
                                    pos.setX(i, x);
                                }
                            }
                            geo.computeVertexNormals();
                        };
                        shearGeo(wallGeo, w.thickness);
                        }
                        // ==================================
                        
                        // Fix for multi-material mapping on static walls
                        let finalWallGeo = wallGeo.index ? wallGeo.toNonIndexed() : wallGeo.clone();
                        finalWallGeo.clearGroups();
                        const finalPos = finalWallGeo.attributes.position;
                        const finalNorm = finalWallGeo.attributes.normal;
                        const finalUvs = finalWallGeo.attributes.uv;
                        
                        finalWallGeo.computeVertexNormals();

                        for (let i = 0; i < finalPos.count; i += 3) {
                            const vAx = finalPos.getX(i), vAy = finalPos.getY(i), vAz = finalPos.getZ(i);
                            const vBx = finalPos.getX(i+1), vBy = finalPos.getY(i+1), vBz = finalPos.getZ(i+1);
                            const vCx = finalPos.getX(i+2), vCy = finalPos.getY(i+2), vCz = finalPos.getZ(i+2);

                            const abX = vBx - vAx, abY = vBy - vAy, abZ = vBz - vAz;
                            const acX = vCx - vAx, acY = vCy - vAy, acZ = vCz - vAz;
                            const crX = abY * acZ - abZ * acY;
                            const crY = abZ * acX - abX * acZ;
                            const crZ = abX * acY - abY * acX;
                            const len = Math.hypot(crX, crY, crZ);
                            
                            const nx = len > 1e-6 ? crX / len : 0;
                            const ny = len > 1e-6 ? crY / len : 0;
                            const nz = len > 1e-6 ? crZ / len : 0;
                            const absX = Math.abs(nx);
                            const absY = Math.abs(ny);
                            const absZ = Math.abs(nz);
                            
                            let groupIdx = 0;
                            if (absX > absY && absX > absZ) groupIdx = nx > 0 ? 0 : 1;
                            else if (absY > absX && absY > absZ) groupIdx = ny > 0 ? 2 : 3;
                            else groupIdx = nz > 0 ? 4 : 5;
                            
                            finalWallGeo.addGroup(i, 3, groupIdx);
                            
                            for (let vIdx = i; vIdx < i + 3; vIdx++) {
                                const vx = finalPos.getX(vIdx), vy = finalPos.getY(vIdx), vz = finalPos.getZ(vIdx);
                                if (groupIdx <= 1) finalUvs.setXY(vIdx, vz, vy);
                                else if (groupIdx <= 3) finalUvs.setXY(vIdx, vx, vz);
                                else finalUvs.setXY(vIdx, vx, vy);
                            }
                        }

                        const wallMesh = new THREE.Mesh(finalWallGeo, mm);
                        wallMesh.castShadow = true; wallMesh.receiveShadow = true;
                        wallMesh.userData = { isWallMesh: true, entity: w };
                        w.wallMesh3D = wallMesh;
                        wallGroup.userData = { entity: w, isWallGroup: true, wallMesh: wallMesh };
                        
                        // EdgesGeometry removed to prevent Z-fighting

                        if (w.moldings) {
                            w.moldings.forEach(mold => {
                                const mMesh = this.moldingBuilder.buildMolding(mold, length, w.thickness, this.ctx.helpers);
                                extraMeshes.push(mMesh);
                                if (!isPreview) this.ctx.interactables.push(mMesh);
                            });
                        }

                        wallGroup.add(wallMesh, ...extraMeshes);
                        
                        if (!isPreview && viewMode3D === 'full-edit') {
                            // CREATE HITBOXES FOR DIRECT SELECTION IN FULL-BUILDING VIEW
                            const shearSkin = (geo) => {
                                const pos = geo.attributes.position;
                                for (let i = 0; i < pos.count; i++) {
                                    const x = pos.getX(i);
                                    const z = pos.getZ(i);
                                    const tZ = Math.max(0, Math.min(1, (z + w.thickness / 2) / w.thickness));
                                    const startX = localSR_x + tZ * (localSL_x - localSR_x);
                                    const endX = localER_x + tZ * (localEL_x - localER_x);
                                    const tX = x / length;
                                    pos.setX(i, startX + tX * (endX - startX));
                                }
                                geo.computeVertexNormals();
                            };
                            
                            const skinFrontGeo = new THREE.PlaneGeometry(length - 0.5, totalH - 0.5);
                            skinFrontGeo.translate(length / 2, totalH / 2, w.thickness / 2 + 0.1);
                            if (w.pts && w.pts.length === 8) shearSkin(skinFrontGeo);
                            const hitFront = new THREE.Mesh(skinFrontGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
                            hitFront.userData = { isWallSide: true, side: 'front', entity: w };

                            const skinBackGeo = new THREE.PlaneGeometry(length - 0.5, totalH - 0.5);
                            skinBackGeo.translate(length / 2, totalH / 2, -w.thickness / 2 - 0.1);
                            if (w.pts && w.pts.length === 8) shearSkin(skinBackGeo);
                            const hitBack = new THREE.Mesh(skinBackGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
                            hitBack.userData = { isWallSide: true, side: 'back', entity: w };

                            wallGroup.add(hitFront, hitBack);
                            this.ctx.interactables.push(hitFront, hitBack);
                        } else if (!isPreview) {
                            // FALLBACK TRIGGER TO SWITCH LEVELS
                            const hitBox = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial({ visible: false }));
                            hitBox.userData = { isFloorTrigger: true, levelIndex: index, entityIndex: wallIndex, entityType: 'wall' };
                            wallGroup.add(hitBox);
                            this.ctx.interactables.push(hitBox);
                        }

                        floorGroup.add(wallGroup);

                        // LOAD DECORS VIA MANAGER
                        if (w.attachedDecor) {
                            w.attachedDecor.forEach(decor => this.ctx.decorManager.load(w, decor));
                        }
                    });
                }

                if (data.roofs) {
                    this.buildRoofs(data.roofs, index, data.walls, floorGroup);
                }

                if (data.furniture) {
                    data.furniture.forEach(furn => {
                        if (this.ctx.furnitureManager) {
                            this.ctx.furnitureManager.load(furn, floorGroup);
                        }
                    });
                }

                this.ctx.staticStructureGroup.add(floorGroup);
            } catch (e) { console.error("Error parsing static floor", e); }
        });
    }

    buildRoofs(roofs, activeIndex, walls, targetGroup, shapes = null) {
        const shapeList = shapes || this.ctx?.shapes || this.ctx?.planner?.shapes || [];
        new Roof3DBuilder(this.ctx).buildRoofs(roofs, activeIndex, walls, targetGroup, shapeList);
    }
    
    updateRoofLive(roof) {
        if (!roof || !roof.mesh3D) return;
        
        const oldMesh = roof.mesh3D.children.find(c => c.userData && c.userData.isRoof);
        if (!oldMesh) return;
        
        // Generate a new temporary roof group using the existing buildRoofs logic
        const tempTarget = new THREE.Group();
        this.buildRoofs([roof], this.ctx.activeIndex || 0, this.ctx.walls || [], tempTarget, this.ctx.shapes || this.ctx.planner?.shapes || []);
        
        if (tempTarget.children.length === 0) return;
        const tempRoofGroup = tempTarget.children[0];
        const newMesh = tempRoofGroup.children.find(c => c.userData && c.userData.isRoof);
        
        if (newMesh) {
            // Swap geometry
            if (oldMesh.geometry) oldMesh.geometry.dispose();
            oldMesh.geometry = newMesh.geometry;
            
            // Swap children (e.g. gableMesh)
            while(oldMesh.children.length > 0) {
                const child = oldMesh.children[0];
                oldMesh.remove(child);
                if (child.geometry) child.geometry.dispose();
            }
            
            while(newMesh.children.length > 0) {
                oldMesh.add(newMesh.children[0]);
            }
        }
    }

    buildShapes(shapes) {
        if (!shapes) return;
        shapes.forEach(shape => {
            const h = shape.params.height3D || 100;
            let geo;

            if (shape.type === 'shape_rect') {
                geo = new THREE.BoxGeometry(shape.params.width, h, shape.params.height);
                geo.translate(0, h / 2, 0);
            } else if (shape.type === 'shape_circle') {
                geo = new THREE.CylinderGeometry(shape.params.radius, shape.params.radius, h, 32);
                geo.translate(0, h / 2, 0);
            } else if (shape.type === 'shape_triangle' || shape.type === 'shape_polygon') {
                const shape2d = new THREE.Shape();
                if (shape.params.points && shape.params.points.length >= 3) {
                    const pts = shape.params.points;
                    
                    shape2d.moveTo(pts[0].x, pts[0].y);
                    for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                    shape2d.lineTo(pts[0].x, pts[0].y);
                    
                    geo = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2);
                    geo.translate(0, h, 0);
                }
            }
            
            if (!geo) return;

            if (shape.params.vertexElevations && shape.params.vertexElevations.some(v => v !== 0)) {
                let corners = [];
                if (shape.type === 'shape_rect') {
                    const w2 = (shape.params.width || 100) / 2;
                    const d2 = (shape.params.height || 100) / 2;
                    corners = [ { x: -w2, z: -d2 }, { x: w2, z: -d2 }, { x: w2, z: d2 }, { x: -w2, z: d2 } ];
                } else if (shape.type === 'shape_polygon' || shape.type === 'shape_triangle') {
                    if (shape.params.points) corners = shape.params.points.map(p => ({ x: p.x, z: p.y }));
                }

                if (corners.length > 0 && corners.length === shape.params.vertexElevations.length) {
                    const pos = geo.attributes.position;
                    for (let i = 0; i < pos.count; i++) {
                        let vy = pos.getY(i);
                        if (vy > h - 1) {
                            let vx = pos.getX(i);
                            let vz = pos.getZ(i);
                            let minD = Infinity;
                            let minIdx = -1;
                            for (let c = 0; c < corners.length; c++) {
                                let dx = vx - corners[c].x;
                                let dz = vz - corners[c].z;
                                let dist = dx*dx + dz*dz;
                                if (dist < minD) {
                                    minD = dist;
                                    minIdx = c;
                                }
                            }
                            if (minIdx !== -1) {
                                pos.setY(i, vy + shape.params.vertexElevations[minIdx]);
                            }
                        }
                    }
                    pos.needsUpdate = true;
                    geo.computeVertexNormals();
                }
            }

            const color = shape.params.fill ? parseInt(shape.params.fill.replace('#', '0x')) : 0x38bdf8;
            const matBase = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
            let materials;
            if (this.ctx.helpers && this.ctx.helpers.getFaceMaterials) {
                const mm = this.ctx.helpers.getFaceMaterials(shape, matBase, { width: shape.params.width || shape.params.radius || 100, height: h });
                if (shape.type === 'shape_rect') {
                    materials = mm.box;
                } else if (shape.type === 'shape_circle') {
                    materials = [mm.extrude[1], mm.extrude[0], mm.extrude[0]]; // sides, top, bottom
                } else {
                    materials = mm.extrude;
                }
            } else {
                materials = matBase;
            }

            const mesh = new THREE.Mesh(geo, materials);
            mesh.position.set(shape.group ? shape.group.x() : shape.x, shape.elevation || 0, shape.group ? shape.group.y() : shape.y);
            mesh.rotation.y = -(shape.rotation || 0) * Math.PI / 180;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { isFurniture: true, entity: shape, isShape: true };
            this.ctx.interactables.push(mesh);
            this.ctx.structureGroup.add(mesh);
            shape.mesh3D = mesh;
        });
    }
}