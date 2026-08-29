import * as THREE from 'three';
import { Wall3DBuilder } from '../../features/wall/wall.renderer3d.js';
import { Railing3DBuilder } from '../../features/railing/builders/Railing3DBuilder.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
import { Roof3DBuilder } from '../../features/roof/builders/Roof3DBuilder.js';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, FLOOR_REGISTRY, WIDGET_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, GLASS_REGISTRY, WALL_DECOR_REGISTRY, offsetPolygon } from '../registry.js';
import { MaterialFactory } from './MaterialFactory.js';
import { UniversalMaterialManager } from './UniversalMaterialManager.js';


export class ActiveFloor {
    constructor(assets, decorManager, interactables, structureGroup, callbacks = {}) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.structureGroup = structureGroup;
        this.assets = assets;
        this.wallBuilder = new Wall3DBuilder();
        // this.railingBuilder removed in favor of static Railing3DBuilder

        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, side: THREE.DoubleSide });
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
    }

    build(walls, rooms, roofs, shapes, stairs = [], activeIndex = 0, targetGroup = this.structureGroup, stairsBelow = [], outdoorZones = []) {
        this._buildSlabs(rooms, stairs, targetGroup, stairsBelow);
        if (outdoorZones && outdoorZones.length > 0) {
            this._buildOutdoorZones(outdoorZones, targetGroup);
        }


        const hasWalls = walls && walls.length > 0;
        let maxWallHeight = WALL_HEIGHT;
        if (hasWalls) {
            maxWallHeight = Math.max(...walls.map(w => w.height || w.config?.height || WALL_HEIGHT));
        }

        this.stairBuilder.build(stairs, targetGroup, activeIndex, false, maxWallHeight);

        if (roofs) this._buildRoofs(roofs, activeIndex, walls, targetGroup, shapes);        
        if (shapes) this._buildShapes(shapes, targetGroup);

        const standardWalls = walls.filter(w => w.type !== 'railing' && !w.hidden);
        const railingWalls = walls.filter(w => w.type === 'railing' && !w.hidden);

        standardWalls.forEach(w => {
            const p1 = w.startAnchor.position(); const p2 = w.endAnchor.position();
            const dx = p2.x - p1.x; const dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz); const angle = Math.atan2(dz, dx);
            w.length3D = length;

            // Generate Wall Mesh
            const wallHeight = w.height || w.config?.height || WALL_HEIGHT;
            const wallThickness = w.thickness || w.config?.thickness || 20;
            const { wallGroup, extraInteractables } = this.wallBuilder.buildWallGroup(length, wallThickness, w, p1.x, p1.y, angle, wallHeight);
            
            if (w.elevation) {
                wallGroup.position.y = w.elevation;
            }
            
            wallGroup.userData = { entity: w };
            w.mesh3D = wallGroup;

            // Render Widgets (Doors & Windows)
            if (w.attachedWidgets) {
                w.attachedWidgets.forEach(widg => {
                    const wCenter = length * widg.t;
                    const widgEntity = {
                        ...widg,
                        x: p1.x + Math.cos(angle) * wCenter,
                        z: p1.y + Math.sin(angle) * wCenter,
                        angle: angle,
                        thick: wallThickness
                    };
                    const type = widg.type || widg.configId;
                    if (WIDGET_REGISTRY[type] && WIDGET_REGISTRY[type].render3D) {
                        WIDGET_REGISTRY[type].render3D(targetGroup, widgEntity, this.helpers);
                    }
                    if (widg.patternMesh3D && this.callbacks.updatePatternLive) {
                        this.callbacks.updatePatternLive(widg);
                    }
                });
            }

            // Generate Hitboxes
            const hitboxes = this.wallBuilder.createHitboxes(length, wallThickness, w, false, 0, 0, wallHeight, p1.x, p1.y, angle);
            hitboxes.forEach(hb => {
                wallGroup.add(hb);
                this.interactables.push(hb);
            });

            if (extraInteractables) extraInteractables.forEach(hb => this.interactables.push(hb));

            targetGroup.add(wallGroup);

            // Load Decors
            if (w.attachedDecor) w.attachedDecor.forEach(decor => this.decorManager.load(w, decor));
        });

        railingWalls.forEach(w => {
            const mesh = Railing3DBuilder.build(w);
            if (w.elevation) mesh.position.y += w.elevation;
            targetGroup.add(mesh);
            this.interactables.push(mesh);
            w.mesh3D = mesh;
        });
    }

    _buildShapes(shapes, targetGroup = this.structureGroup) {
        if (!shapes) return;
        shapes.forEach(shapeData => {
            let geo;
            const w = shapeData.width || 40;
            const d = shapeData.depth || 40;
            const h = shapeData.height || 120;
            const type = shapeData.type || shapeData.shapeType || 'shape_rect';
            
            if (type === 'shape_circle') {
                geo = new THREE.CylinderGeometry(shapeData.params.radius, shapeData.params.radius, h, 32);
            } else if (type === 'shape_polygon' || type === 'shape_triangle') {
                const shape2d = new THREE.Shape();
                if (shapeData.params.points && shapeData.params.points.length >= 3) {
                    const pts = shapeData.params.points;
                    shape2d.moveTo(pts[0].x, pts[0].y);
                    for(let i=1; i<pts.length; i++) shape2d.lineTo(pts[i].x, pts[i].y);
                    shape2d.lineTo(pts[0].x, pts[0].y);
                    geo = new THREE.ExtrudeGeometry(shape2d, { depth: h, bevelEnabled: false });
                    geo.rotateX(Math.PI / 2);
                }
            } else if (type === 'shape_rect') {
                geo = new THREE.BoxGeometry(shapeData.params.width, h, shapeData.params.height);
            }
            // Correctly elevate the shapes to sit flat onto the base plane
            geo.translate(0, h / 2, 0);

            const color = shapeData.params?.fill ? parseInt(shapeData.params.fill.replace('#', '0x')) : 0xfcd34d;
            const matBase = new THREE.MeshStandardMaterial({ color: color, roughness: 0.7 });
            let matSides = matBase.clone();
            let matTop = matBase.clone();
            let matBottom = matBase.clone();
            let matLeft = matBase.clone();
            let matRight = matBase.clone();
            let matFront = matBase.clone();
            let matBack = matBase.clone();

            const applyTex = (mat, texKey) => {
                if (!texKey) return;
                const config = WALL_DECOR_REGISTRY[texKey];
                if (config) {
                    this.assets.getTexture(config).then(tex => {
                        const texClone = tex.clone();
                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                        const tileSize = config.defaultTileSize || 40;
                        const maxDim = Math.max(shapeData.params.width || shapeData.params.radius || 100, h);
                        texClone.repeat.set(maxDim / tileSize, maxDim / tileSize);
                        mat.map = texClone;
                        mat.color.setHex(0xffffff);
                        mat.needsUpdate = true;
                    });
                }
            };

            applyTex(matTop, shapeData.params.textureTop || shapeData.params.texture);
            applyTex(matBottom, shapeData.params.textureBottom || shapeData.params.texture);
            applyTex(matSides, shapeData.params.textureSides || shapeData.params.texture);
            applyTex(matLeft, shapeData.params.textureLeft || shapeData.params.textureSides || shapeData.params.texture);
            applyTex(matRight, shapeData.params.textureRight || shapeData.params.textureSides || shapeData.params.texture);
            applyTex(matFront, shapeData.params.textureFront || shapeData.params.textureSides || shapeData.params.texture);
            applyTex(matBack, shapeData.params.textureBack || shapeData.params.textureSides || shapeData.params.texture);

            let materials;
            if (type === 'shape_rect') {
                materials = [matRight, matLeft, matTop, matBottom, matFront, matBack];
            } else if (type === 'shape_circle') {
                materials = [matSides, matTop, matBottom];
            } else {
                materials = [matTop, matSides];
            }
            
            const mesh = new THREE.Mesh(geo, materials);
            
            const groupX = shapeData.group ? shapeData.group.x() : shapeData.x;
            const groupZ = shapeData.group ? shapeData.group.y() : shapeData.y;
            const rot = shapeData.rotation || 0;
            const elevation = shapeData.elevation || 0;

            mesh.position.set(groupX, elevation, groupZ);
            mesh.rotation.y = -rot * Math.PI / 180;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            // Create invisible hitbox for perfect mouse raycasting & highlighting
            const hitBox = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }));
            hitBox.position.set(0, h / 2, 0);
            hitBox.userData = { isHitbox: true };
            mesh.add(hitBox);

            mesh.userData = { isFurniture: true, entity: shapeData, originalSize: new THREE.Vector3(w, h, d), isShape: true };
            shapeData.mesh3D = mesh;

            this.interactables.push(mesh);
            this.interactables.push(hitBox);
            targetGroup.add(mesh);
        });
    }

    _buildSlabs(rooms, stairs = [], targetGroup = this.structureGroup, stairsBelow = []) {
        if (!rooms) return;

        rooms.forEach(room => {
            if (room.isDeleted || room.isHidden) return;
            const path = room.path;
            if (!path || path.length < 3) return;
            const floorShape = new THREE.Shape();
            floorShape.moveTo(path[0].x, path[0].y);
            for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
            
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
                            if (stair.hasTopLanding) { y -= ls; totalLen += ls; }
                            if (stair.hasBottomLanding) { totalLen += ls; }
                            rects.push({ x: -width/2, y: y, w: width, h: totalLen });
                        } else if (stair.shape === 'L') {
                            let y = 0; let f1Len = l1;
                            if (stair.hasTopLanding) { y -= ls; f1Len += ls; }
                            // Rect 1: Top Landing (if any) + Main Flight (stops at l1)
                            rects.push({ x: -width/2, y: y, w: width, h: f1Len });
                            
                            // Rect 2: Corner Landing + Second Flight
                            const f2X = turn === 'right' ? -width/2 : -width/2 - l2;
                            let f2Len = l2 + width; // includes corner landing
                            let f2Start = f2X;
                            if (stair.hasBottomLanding) {
                                f2Len += ls;
                                if (turn !== 'right') f2Start -= ls;
                            }
                            rects.push({ x: f2Start, y: l1, w: f2Len, h: width });
                        } else if (stair.shape === 'U') {
                            let y = 0; let f1Len = l1;
                            if (stair.hasTopLanding) { y -= ls; f1Len += ls; }
                            // Rect 1: Top Landing + Main Flight (stops at l1)
                            rects.push({ x: -width/2, y: y, w: width, h: f1Len });
                            
                            // Rect 2: The long continuous landing block covering both corner landings
                            const totalW = width * 2 + gw;
                            const landingX = turn === 'right' ? -width/2 : -width/2 - width - gw;
                            rects.push({ x: landingX, y: l1, w: totalW, h: ls });
                            
                            // Rect 3: Second Flight (starts after corner landing)
                            const f2X = turn === 'right' ? width/2 + gw : -width/2 - width - gw;
                            let f2Y = l1 - l2; let f2Len = l2;
                            if (stair.hasBottomLanding) { f2Y -= ls; f2Len += ls; }
                            rects.push({ x: f2X, y: f2Y, w: width, h: f2Len });
                        }
                        
                        const rot = (stair.rotation || 0) * Math.PI / 180;
                        const sx = stair.x;
                        const sy = stair.y;
                        const pad = 1; // Shrink by 1 unit to prevent wall boundary intersection
                        
                        rects.forEach(r => {
                            const cx1 = r.x + pad;
                            const cy1 = r.y + pad;
                            const cx2 = r.x + r.w - pad;
                            const cy2 = r.y + r.h - pad;
                            if (cx2 <= cx1 || cy2 <= cy1) return; 
                            
                            const corners = [
                                { x: cx1, y: cy1 },
                                { x: cx2, y: cy1 },
                                { x: cx2, y: cy2 },
                                { x: cx1, y: cy2 }
                            ];
                            
                            const rotC = corners.map(c => {
                                return {
                                    x: sx + (c.x * Math.cos(rot) - c.y * Math.sin(rot)),
                                    y: sy + (c.x * Math.sin(rot) + c.y * Math.cos(rot))
                                };
                            });
                            
                            const hole = new THREE.Path();
                            hole.moveTo(rotC[0].x, rotC[0].y);
                            hole.lineTo(rotC[1].x, rotC[1].y);
                            hole.lineTo(rotC[2].x, rotC[2].y);
                            hole.lineTo(rotC[3].x, rotC[3].y);
                            hole.lineTo(rotC[0].x, rotC[0].y);
                            floorShape.holes.push(hole);
                        });
                    }
                });
            }
            
            const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 2, bevelEnabled: false });
            floorGeo.rotateX(Math.PI / 2);
            floorGeo.translate(0, 0.2, 0);
            
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

            
            let mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
            const configId = room.configId || 'hardwood';
            const floorConfig = FLOOR_REGISTRY[configId];
            if (floorConfig) {
                const config = { ...floorConfig };
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
            floorMesh.receiveShadow = true;
            floorMesh.userData = { entity: room, isRoom: true };
            this.interactables.push(floorMesh);
            targetGroup.add(floorMesh);
        });
    }

    _buildRoofs(roofs, activeIndex, walls, targetGroup = this.structureGroup, shapes = null) {
        new Roof3DBuilder(this.helpers.ctx).buildRoofs(roofs, activeIndex, walls, targetGroup, shapes);
    }

    _buildOutdoorZones(outdoorZones, targetGroup = this.structureGroup) {
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

                let zoneGeo = null;
                if (isCorridor && centerline && centerline.length >= 2) {
                    // Build mathematically perfect quad-strip ribbon geometry
                    zoneGeo = this._buildCorridorRibbonGeometry(centerline, corridorWidth, height3D);
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

                    // Standard planar UV projection for non-corridor polygon slabs
                    const uvs = zoneGeo.attributes.uv;
                    const pos = zoneGeo.attributes.position;
                    zoneGeo.computeVertexNormals();
                    const norms = zoneGeo.attributes.normal;
                    for (let i = 0; i < uvs.count; i++) {
                        const nx = Math.abs(norms.getX(i));
                        const ny = Math.abs(norms.getY(i));
                        const nz = Math.abs(norms.getZ(i));
                        const vx = pos.getX(i) / 100;
                        const vy = pos.getY(i) / 100;
                        const vz = pos.getZ(i) / 100;

                        if (ny > 0.5) uvs.setXY(i, vx, vz);
                        else if (nx > nz) uvs.setXY(i, vz, vy);
                        else uvs.setXY(i, vx, vy);
                    }
                }

                let mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.7 });
                const configId = zone.configId || (zone.subType === 'softscape' ? 'grass' : (zone.subType === 'patio' ? 'tile_yellow_cotto_squares' : 'tile_yellow_hexagon'));
                
                const floorConfig = FLOOR_REGISTRY[configId] || UniversalMaterialManager.getMaterial(configId);
                if (floorConfig) {
                    const config = { ...floorConfig };
                    if (zone.materialScale) config.tileSize = zone.materialScale;
                    if (isCorridor && centerline && centerline.length >= 2) {
                        config.tileSize = 100; // Exact 1:1 spline UV mapping
                    }
                    MaterialFactory.buildPBRMaterial({
                        material: mat,
                        config: config,
                        ctx: this.ctx || this,
                        dimensions: { width: 100, height: 100 },
                        faceName: 'floor'
                    }).then(() => {
                        if (isCorridor && mat.map) {
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

                if (this.interactables) this.interactables.push(zoneMesh);
                targetGroup.add(zoneMesh);
            } catch (err) {
                console.error("Error building outdoor zone in ActiveFloor:", err);
            }
        });
    }

    _buildCorridorRibbonGeometry(centerline, width, height3D = 0.3) {
        const halfW = width / 2;
        const n = centerline.length;
        if (n < 2) return null;

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
            vDists.push(totalDist / width);
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
            uvs.push(1.0, v);
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
            uvs.push(1.0, v);
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
            uvs.push(0, 0, len / 100, 0, 0, height3D / 100, len / 100, height3D / 100);

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
            uvs.push(0, 0, len / 100, 0, 0, height3D / 100, len / 100, height3D / 100);

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
}