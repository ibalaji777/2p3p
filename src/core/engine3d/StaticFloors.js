import * as THREE from 'three';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, FLOOR_REGISTRY, WIDGET_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, GLASS_REGISTRY, WALL_DECOR_REGISTRY, offsetPolygon } from '../registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { UniversalMaterialManager } from './UniversalMaterialManager.js';
import { Wall3DBuilder } from '../../features/wall/wall.renderer3d.js';
import { Railing3DBuilder } from '../../features/railing/builders/Railing3DBuilder.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';
import { computeLevelElevations } from './helpers/levelElevations.js';

export class StaticFloors {
    constructor(assets, decorManager, interactables, callbacks = {}) {
        this.assets = assets;
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.wallBuilder = new Wall3DBuilder();

        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, side: THREE.DoubleSide });
        this.matFloor.userData = { isShared: true };
        this.callbacks = callbacks;
        
        this.materialClonesRegistry = new Map();
        this.helpers = {
            ctx: this,
            getDynamicMaterial: (matId, category) => {
                let conf = UniversalMaterialManager.getMaterial(matId);
                if (!conf) return new THREE.MeshStandardMaterial();
                
                let dims = { width: 100, height: 100 };
                let mat = conf.transmission ? new THREE.MeshPhysicalMaterial() : new THREE.MeshStandardMaterial();
                if (conf.color !== undefined) {
                    try { mat.color = new THREE.Color(conf.color); } catch (e) {}
                }
                if (conf.roughness !== undefined) mat.roughness = conf.roughness;
                if (conf.metalness !== undefined) mat.metalness = conf.metalness;

                const registerClone = (baseMat, clonedMat) => {
                    if (!this.materialClonesRegistry) this.materialClonesRegistry = new Map();
                    let list = this.materialClonesRegistry.get(baseMat);
                    if (!list) {
                        list = [];
                        this.materialClonesRegistry.set(baseMat, list);
                    }
                    if (Array.isArray(list)) list.push(clonedMat);
                    else if (list && typeof list.add === 'function') list.add(clonedMat);
                };

                const origClone = mat.clone.bind(mat);
                mat.clone = () => {
                    const cloned = origClone();
                    registerClone(mat, cloned);
                    return cloned;
                };

                const pbrPromise = MaterialFactory.buildPBRMaterial({
                    material: mat,
                    config: conf,
                    ctx: this,
                    dimensions: dims,
                    faceName: category
                }).then(() => {
                    if (this.materialClonesRegistry && this.materialClonesRegistry.has(mat)) {
                        this.materialClonesRegistry.get(mat).forEach(clone => {
                            try {
                                clone.copy(mat);
                                clone.needsUpdate = true;
                            } catch (e) {}
                        });
                    }
                });

                if (!mat.userData) mat.userData = {};
                mat.userData.readyPromise = pbrPromise;
                
                return mat;
            }
        };
        this.stairBuilder = new Stair3DBuilder(assets, interactables, this.helpers);
        this.roofBuilder = new Roof3DBuilder(this.helpers.ctx);
    }

    build(levelsConfigArray, activeIndex, viewMode3D, stairs = [], staticStructureGroup) {
        const isPreview = viewMode3D === 'preview';
        const levelElevations = computeLevelElevations(levelsConfigArray);

        levelsConfigArray.forEach((levelConfig, index) => {
            if (index === activeIndex || !levelConfig || !levelConfig.data) return;
            if (levelConfig.isVisible === false) return;

            try {
                const data = typeof levelConfig.data === 'string' ? JSON.parse(levelConfig.data) : levelConfig.data;
                const floorGroup = new THREE.Group();
                floorGroup.position.y = levelElevations[index] !== undefined ? levelElevations[index] : (index * WALL_HEIGHT);

                if (data.stairs) {
                    const maxWallHeight2 = (data.walls && data.walls.length > 0) ? Math.max(...data.walls.map(w => w.height || w.config?.height || WALL_HEIGHT)) : WALL_HEIGHT;
                    this.stairBuilder.build(data.stairs, floorGroup, index, true, maxWallHeight2);
                }

                // Build Slabs
                const isSub = levelConfig?.type === 'plinth' || levelConfig?.type === 'foundation';
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
                                const prevData = typeof levelsConfigArray[index - 1].data === 'string' ? JSON.parse(levelsConfigArray[index - 1].data) : levelsConfigArray[index - 1].data;
                                if (prevData.stairs) stairsBelow = prevData.stairs;
                            } catch (e) {}
                        }
                        
                        if (data.shapes) {
                            data.shapes.forEach(shape => {
                                if (shape.type === 'shape_floor_cut') {
                                    const rot = (shape.rotation || 0) * Math.PI / 180;
                                    const sx = shape.x || shape.params?.x || 0;
                                    const sy = shape.y || shape.params?.y || 0;
                                    let pts;
                                    if (shape.params?.points) {
                                        pts = shape.params.points;
                                    } else {
                                        const w = shape.params?.width || shape.width || 100;
                                        const h = shape.params?.height || shape.height || 100;
                                        pts = [
                                            { x: -w/2, y: -h/2 }, { x: w/2, y: -h/2 },
                                            { x: w/2, y: h/2 }, { x: -w/2, y: h/2 }
                                        ];
                                    }
                                    
                                    const rotC = pts.map(c => {
                                        return {
                                            x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                                            y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                                        };
                                    });
                                    
                                    const hole = new THREE.Path();
                                    hole.moveTo(rotC[0].x, rotC[0].y);
                                    for (let i = 1; i < rotC.length; i++) {
                                        hole.lineTo(rotC[i].x, rotC[i].y);
                                    }
                                    hole.lineTo(rotC[0].x, rotC[0].y);
                                    floorShape.holes.push(hole);
                                }
                            });
                        }
                        
                        const slabDepth = isSub ? subH : 2;
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: slabDepth, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        floorGeo.translate(0, isSub ? (subH - 0.01) : 0.2, 0);
                        
                        // UV Fix for Floor (ExtrudeGeometry) - World Space Projection
                        const uvs = floorGeo.attributes.uv;
                        const pos = floorGeo.attributes.position;
                        floorGeo.computeVertexNormals();
                        const norms = floorGeo.attributes.normal;
                        for (let i = 0; i < uvs.count; i++) {
                            const nx = Math.abs(norms.getX(i));
                            const ny = Math.abs(norms.getY(i));
                            const nz = Math.abs(norms.getZ(i));
                            const vx = pos.getX(i) / 100;
                            const vy = pos.getY(i) / 100;
                            const vz = pos.getZ(i) / 100;
                            
                            if (ny > 0.5) uvs.setXY(i, vx, vz); // Top/Bottom
                            else if (nx > nz) uvs.setXY(i, vz, vy); // Side X
                            else uvs.setXY(i, vx, vy); // Side Z
                        }

                        let mat = new THREE.MeshStandardMaterial({ 
                            color: isSub ? 0xffffff : 0xffffff, 
                            roughness: isSub ? 0.85 : 0.7, 
                            metalness: isSub ? 0.05 : 0, 
                            side: THREE.DoubleSide 
                        });
                        const configId = room.configId || 'hardwood';
                        const baseConfig = FLOOR_REGISTRY[configId];
                        
                        if (baseConfig && !isSub) {
                            const config = { ...baseConfig };
                            if (room.materialScale) config.tileSize = room.materialScale;
                            MaterialFactory.buildPBRMaterial({
                                material: mat,
                                config: config,
                                ctx: this.ctx,
                                dimensions: { width: 100, height: 100 },
                                faceName: 'floor'
                            }).then(() => {
                                if (this.ctx && this.ctx.requestRender) this.ctx.requestRender('material_loaded', 2);
                            });
                        } else {
                            mat.color.setHex(0xd1d5db);
                        }

                        const floorMesh = new THREE.Mesh(floorGeo, mat);
                        const roomElev = Number(room.elevation) || 0;
                        floorMesh.position.y = isSub ? (subH - 0.01) : (roomElev + 0.05);
                        floorMesh.receiveShadow = true;
                        
                        if (!isPreview) {
                            floorMesh.userData = { isFloorTrigger: true, levelIndex: index };
                            this.interactables.push(floorMesh);
                        }
                        floorGroup.add(floorMesh);
                    });
                }

                // Build Walls
                if (data.walls) {
                    
                    const standardWalls = data.walls.filter(w => w.type !== 'railing' && !w.hidden);
                    const railingWalls = data.walls.filter(w => w.type === 'railing' && !w.hidden);

                    standardWalls.forEach((w, wallIndex) => {
                        const dx = w.endX - w.startX; const dz = w.endY - w.startY;
                        const length = Math.hypot(dx, dz); const angle = Math.atan2(dz, dx);
                        
                        const defaultLevelH = levelConfig?.height || WALL_HEIGHT;
                        const defaultLevelThk = levelConfig?.defaultWallThickness || (w.type === 'compound' ? 12 : (w.type === 'outer' ? 20 : 10));
                        const wallHeight = w.height || w.config?.height || defaultLevelH;
                        const wallThk = w.thickness || w.config?.thickness || defaultLevelThk;
                        // Mock Data for Managers
                        w.config = { thickness: wallThk, height: wallHeight }; w.length3D = length; w.attachedWidgets = w.widgets || []; w.attachedDecor = w.decors || []; w.isStatic = true; w.levelIndex = index; w.wallIndex = wallIndex;
                        const { wallGroup, extraInteractables } = this.wallBuilder.buildWallGroup(length, wallThk, w, w.startX, w.startY, angle, wallHeight);
                        wallGroup.userData = { entity: w };
                        w.mesh3D = wallGroup;

                        // Render Widgets (Doors & Windows)
                        if (w.attachedWidgets) {
                            w.attachedWidgets.forEach(widg => {
                                const wCenter = length * widg.t;
                                const widgEntity = {
                                    ...widg,
                                    x: w.startX + Math.cos(angle) * wCenter,
                                    z: w.startY + Math.sin(angle) * wCenter,
                                    angle: angle,
                                    thick: w.thickness
                                };
                                const type = widg.type || widg.configId;
                                if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                                    WIDGET_REGISTRY[type].render3D(floorGroup, widgEntity, this.helpers);
                                }
                                if (widg.patternMesh3D && this.callbacks.updatePatternLive) {
                                    this.callbacks.updatePatternLive(widg);
                                }
                            });
                        }

                        if (!isPreview) {
                            const hitboxes = this.wallBuilder.createHitboxes(length, w.thickness, w, true, index, wallIndex, wallHeight, w.startX, w.startY, angle);
                            hitboxes.forEach(hb => {
                                // Only add Face hitboxes if in full-edit mode. Otherwise, just add the volume trigger.
                                if (viewMode3D === 'full-edit' || hb.userData.isFloorTrigger) {
                                    wallGroup.add(hb);
                                    this.interactables.push(hb);
                                }
                            });

                            if (extraInteractables) extraInteractables.forEach(hb => this.interactables.push(hb));
                        }

                        floorGroup.add(wallGroup);
                        if (w.attachedDecor) w.attachedDecor.forEach(decor => this.decorManager.load(w, decor));
                    });

                    // const railingBuilder = new RailingBuilder(this.assets, this.interactables, floorGroup);
                    railingWalls.forEach(w => {
                        const mesh = Railing3DBuilder.build(w);
                        if (w.elevation) mesh.position.y += w.elevation;
                        floorGroup.add(mesh);
                        this.interactables.push(mesh);
                    });
                }
                
                // Build Roofs via centralized Roof3DBuilder
                if (data.roofs && data.roofs.length > 0) {
                    this.roofBuilder.buildRoofs(data.roofs, index, data.walls, floorGroup, data.shapes);
                }

                this.target.add(floorGroup);
            } catch (e) {
                console.error("Failed to build static floor level", index, e);
            }
        });
    }
}