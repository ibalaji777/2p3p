import * as THREE from 'three';
import { Wall3DBuilder } from './Wall3DBuilder.js';
import { RailingBuilder } from './RailingBuilder.js';
import { Stair3DBuilder } from './Stair3DBuilder.js';
import { WALL_HEIGHT, ROOF_DECOR_REGISTRY, FLOOR_REGISTRY, WIDGET_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS, WALL_DECOR_REGISTRY, offsetPolygon } from '../registry.js';


export class ActiveFloor {
    constructor(assets, decorManager, interactables, structureGroup, callbacks = {}) {
        this.decorManager = decorManager;
        this.interactables = interactables;
        this.structureGroup = structureGroup;
        this.assets = assets;
        this.wallBuilder = new Wall3DBuilder();
        this.railingBuilder = new RailingBuilder(assets, interactables, structureGroup);
        this.stairBuilder = new Stair3DBuilder(assets, interactables);
        this.matFloor = new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7, side: THREE.DoubleSide });
        this.callbacks = callbacks;
        
        this.helpers = {
            getDynamicMaterial: (matId, category) => {
                let conf;
                if (category === 'door') conf = DOOR_MATERIALS[matId] || DOOR_MATERIALS.wood;
                else if (category === 'window_frame') conf = WINDOW_FRAME_MATERIALS[matId] || WINDOW_FRAME_MATERIALS.alum_powder;
                else if (category === 'window_glass') conf = WINDOW_GLASS_MATERIALS[matId] || WINDOW_GLASS_MATERIALS.clear;
                
                if (!conf) return new THREE.MeshStandardMaterial();
                
                if (conf.transmission) {
                    return new THREE.MeshPhysicalMaterial({
                        color: conf.color,
                        roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                        metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                        transmission: conf.transmission,
                        ior: conf.ior || 1.5,
                        transparent: true
                    });
                }
                return new THREE.MeshStandardMaterial({
                    color: conf.color,
                    roughness: conf.roughness !== undefined ? conf.roughness : 0.5,
                    metalness: conf.metalness !== undefined ? conf.metalness : 0.1,
                    transparent: conf.transparent || false,
                    opacity: conf.opacity !== undefined ? conf.opacity : 1
                });
            }
        };
    }

    build(walls, rooms, roofs, shapes, stairs = [], activeIndex = 0, targetGroup = this.structureGroup, stairsBelow = []) {
        this._buildSlabs(rooms, stairs, targetGroup, stairsBelow);


        const hasWalls = walls && walls.length > 0;
        let maxWallHeight = WALL_HEIGHT;
        if (hasWalls) {
            maxWallHeight = Math.max(...walls.map(w => w.height || w.config?.height || WALL_HEIGHT));
        }

        this.stairBuilder.build(stairs, targetGroup, activeIndex, false, maxWallHeight);

        if (roofs) this._buildRoofs(roofs, activeIndex, hasWalls, maxWallHeight, targetGroup);        
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

        this.railingBuilder.build(railingWalls, standardWalls, targetGroup);
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
            
            let mat = this.matFloor;
            const configId = room.configId || 'hardwood';
            const floorConfig = FLOOR_REGISTRY[configId];
            if (floorConfig && floorConfig.texture) {
                const tex = new THREE.TextureLoader().load(floorConfig.texture);
                tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                const repeatScale = room.materialRepeat || floorConfig.repeat || 1;
                // Use a default size for calculating UV repeat if not specified, 100 is typically 1 unit in 3D
                tex.repeat.set(1 / (100 * repeatScale), 1 / (100 * repeatScale));
                mat = new THREE.MeshStandardMaterial({ map: tex, roughness: floorConfig.roughness !== undefined ? floorConfig.roughness : 0.8, color: floorConfig.color || 0xffffff, side: THREE.DoubleSide });
            } else if (floorConfig && floorConfig.color) {
                mat = new THREE.MeshStandardMaterial({ color: floorConfig.color, roughness: floorConfig.roughness !== undefined ? floorConfig.roughness : 0.8, side: THREE.DoubleSide });
            }

            const floorMesh = new THREE.Mesh(floorGeo, mat);
            floorMesh.receiveShadow = true;
            floorMesh.userData = { entity: room, isRoom: true };
            this.interactables.push(floorMesh);
            targetGroup.add(floorMesh);
        });
    }

    _buildRoofs(roofs, activeIndex, hasWalls, maxWallHeight = WALL_HEIGHT, targetGroup = this.structureGroup) {
        roofs.forEach(roof => {
            const basePts = roof.points || [];
            if (basePts.length < 3) return;

            const conf = roof.config || roof;
            const overhangs = conf.overhangs ? conf.overhangs : (conf.overhang || 0);
            const pts = offsetPolygon(basePts, overhangs);

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });

            const wallGap = conf.wallGap || 0;
            
            const W = maxX - minX;
            const D = maxY - minY;
            
            // Auto-detect: if no walls exist here, roof mathematically caps the floor below
            const baseHeight = (hasWalls || activeIndex === 0) ? maxWallHeight : 0;
            const h = baseHeight + wallGap + 0.5; // +0.5 prevents z-fighting with top of the walls

            const decor = ROOF_DECOR_REGISTRY[conf.material] || ROOF_DECOR_REGISTRY['concrete_flat'];
            const tex = new THREE.TextureLoader().load(decor.texture);
            tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
            const repeatScale = decor.repeat || 1;
            tex.repeat.set(W / (100 * repeatScale), D / (100 * repeatScale));
            const mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide });

            let mesh;
            if (conf.roofType === 'flat') {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                shape.lineTo(pts[0].x, pts[0].y);
                
                const geo = new THREE.ExtrudeGeometry(shape, { depth: conf.thickness || 2, bevelEnabled: false });
                geo.rotateX(Math.PI / 2);
                geo.translate(0, conf.thickness || 2, 0); // Flat roofs rest perfectly flush
                
                // UV Fix for Flat Roof (ExtrudeGeometry) - World Space Projection
                const uvs = geo.attributes.uv;
                const pos = geo.attributes.position;
                geo.computeVertexNormals();
                const norms = geo.attributes.normal;
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

                const matId = roof.configId || conf.material;
                let flatMat = new THREE.MeshStandardMaterial({ 
                    color: 0xefede5, // Match wall exactly
                    roughness: 0.98,
                    metalness: 0.02,
                    bumpScale: 0.015
                });
                
                if (matId && ROOF_DECOR_REGISTRY[matId]) {
                    const decorConf = ROOF_DECOR_REGISTRY[matId];
                    const tex = new THREE.TextureLoader().load(decorConf.texture);
                    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
                    const baseSize = roof.tileSize || 100;
                    const tSize = baseSize * (decorConf.scaleRatio || 1);
                    tex.repeat.set(100 / tSize, 100 / tSize);
                    flatMat = new THREE.MeshStandardMaterial({ map: tex });
                }

                mesh = new THREE.Mesh(geo, flatMat);
            } else if (conf.roofType === 'gable') {
                const pitch = conf.pitch || 30;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? D : W;
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                let cx = minX + W/2;
                let cy = minY + D/2;

                const v = [], uv = [];
                const addTriangle = (p0, p1, p2) => {
                    v.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                    uv.push(0, 0, 1, 0, 0.5, 1);
                };
                const addQuad = (p0, p1, p2, p3) => {
                    addTriangle(p0, p1, p2);
                    addTriangle(p0, p2, p3);
                };

                const C0 = {x: minX, y: 0, z: minY};
                const C1 = {x: maxX, y: 0, z: minY};
                const C2 = {x: maxX, y: 0, z: maxY};
                const C3 = {x: minX, y: 0, z: maxY};

                if (axis === 'x') {
                    const R0 = {x: minX, y: rh, z: cy};
                    const R1 = {x: maxX, y: rh, z: cy};
                    addQuad(C1, C0, R0, R1); // Front
                    addQuad(C3, C2, R1, R0); // Back
                } else {
                    const R0 = {x: cx, y: rh, z: minY};
                    const R1 = {x: cx, y: rh, z: maxY};
                    addQuad(C0, C3, R1, R0); // Left
                    addQuad(C2, C1, R0, R1); // Right
                }

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
                geo.computeVertexNormals();
                mesh = new THREE.Mesh(geo, mat);
                
                const gableMatId = conf.gableMaterial || 'white_plaster_wall';
                const wallDecor = WALL_DECOR_REGISTRY[gableMatId] || WALL_DECOR_REGISTRY['white_plaster_wall'];
                let gableMat = new THREE.MeshStandardMaterial({ color: 0xefede5 });
                if (wallDecor && wallDecor.texture) {
                    const gTex = new THREE.TextureLoader().load(wallDecor.texture);
                    gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
                    gTex.repeat.set(100/(wallDecor.scaleRatio || 100), 100/(wallDecor.scaleRatio || 100));
                    gableMat = new THREE.MeshStandardMaterial({ map: gTex, side: THREE.DoubleSide, bumpMap: gTex, bumpScale: 0.015 });
                }

                const gv = [], guv = [];
                const addGableTri = (p0, p1, p2) => {
                    gv.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
                    let sc = 1/100;
                    if (axis === 'x') guv.push(p0.z*sc, p0.y*sc, p1.z*sc, p1.y*sc, p2.z*sc, p2.y*sc);
                    else guv.push(p0.x*sc, p0.y*sc, p1.x*sc, p1.y*sc, p2.x*sc, p2.y*sc);
                };

                if (axis === 'x') {
                    const R0 = {x: minX, y: rh, z: cy};
                    const R1 = {x: maxX, y: rh, z: cy};
                    addGableTri(C0, C3, R0); // Left
                    addGableTri(C2, C1, R1); // Right
                } else {
                    const R0 = {x: cx, y: rh, z: minY};
                    const R1 = {x: cx, y: rh, z: maxY};
                    addGableTri(C1, C0, R0); // Front
                    addGableTri(C3, C2, R1); // Back
                }
                
                const gGeo = new THREE.BufferGeometry();
                gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                gGeo.computeVertexNormals();
                const gableMesh = new THREE.Mesh(gGeo, gableMat);
                mesh.add(gableMesh);

            } else {
                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(W, D);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                
                // Calculate Polygon Mathematical Centroid
                let cx = 0, cy = 0, signedArea = 0;
                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let a = p0.x * p1.y - p1.x * p0.y;
                    signedArea += a;
                    cx += (p0.x + p1.x) * a;
                    cy += (p0.y + p1.y) * a;
                }
                signedArea *= 0.5;
                if (signedArea !== 0) { cx /= (6.0 * signedArea); cy /= (6.0 * signedArea); } 
                else { cx = minX + W/2; cy = minY + D/2; }

                const top = [cx, rh, cy];
                const v = [], uv = [];
                
                // Build perfectly sealed triangles with upward facing normals
                for (let i = 0; i < pts.length; i++) {
                    let p0 = pts[i], p1 = pts[(i + 1) % pts.length];
                    let dx1 = p1.x - p0.x, dz1 = p1.y - p0.y;
                    let dx2 = top[0] - p0.x, dz2 = top[2] - p0.y;
                    let ny = dx1 * dz2 - dz1 * dx2; 
                    
                    if (ny < 0) { v.push(p1.x, 0, p1.y, p0.x, 0, p0.y, ...top); } 
                    else { v.push(p0.x, 0, p0.y, p1.x, 0, p1.y, ...top); }
                    uv.push(0, 0, 1, 0, 0.5, 1);
                }

                const geo = new THREE.BufferGeometry();
                geo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
                geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
                geo.computeVertexNormals();
                mesh = new THREE.Mesh(geo, mat);
            }

            const roofGroup = new THREE.Group();
            let groupX = 0, groupZ = 0;
            if (roof.group && typeof roof.group.x === 'function') {
                groupX = roof.group.x();
                groupZ = roof.group.y();
            } else if (roof.x !== undefined) {
                groupX = roof.x;
                groupZ = roof.y;
            }
            roofGroup.position.set(groupX, h, groupZ); // Account for 2D dragging
            
            let rot = roof.rotation || 0;
            roofGroup.rotation.y = -rot * Math.PI / 180;
            
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData = { isRoof: true, entity: roof }; 
            this.interactables.push(mesh);
            
            roofGroup.add(mesh);
            targetGroup.add(roofGroup);
            roof.mesh3D = roofGroup;
        });
    }
}