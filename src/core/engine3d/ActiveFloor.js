import * as THREE from 'three';
import { Wall3DBuilder } from '../../features/wall/wall.renderer3d.js';
import { RailingBuilder } from './RailingBuilder.js';
import { Stair3DBuilder } from '../../features/stairs/stairs.renderer3d.js';
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
            
            let baseHeight = roof.elevation !== undefined ? roof.elevation : ((hasWalls || activeIndex === 0) ? maxWallHeight : 0);

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
                let bMinX = Infinity, bMaxX = -Infinity, bMinY = Infinity, bMaxY = -Infinity;
                basePts.forEach(p => {
                    bMinX = Math.min(bMinX, p.x); bMaxX = Math.max(bMaxX, p.x);
                    bMinY = Math.min(bMinY, p.y); bMaxY = Math.max(bMaxY, p.y);
                });
                const bW = bMaxX - bMinX;
                const bD = bMaxY - bMinY;

                const pitch = conf.pitch || 30;
                const axis = conf.ridgeAxis || 'x';
                const maxSpan = axis === 'x' ? bD : bW;
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                let cx = bMinX + bW/2;
                let cy = bMinY + bD/2;

                const v = [], uv = [];
                
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                const shapeGeo = new THREE.ShapeGeometry(shape);
                const pos = shapeGeo.attributes.position;
                
                let rawTriangles = [];
                if (shapeGeo.index) {
                    const idx = shapeGeo.index.array;
                    for (let i = 0; i < idx.length; i += 3) {
                        const a = idx[i], b = idx[i+1], c = idx[i+2];
                        rawTriangles.push([
                            {x: pos.getX(a), y: pos.getY(a)},
                            {x: pos.getX(b), y: pos.getY(b)},
                            {x: pos.getX(c), y: pos.getY(c)}
                        ]);
                    }
                } else {
                    for (let i = 0; i < pos.count; i += 3) {
                        rawTriangles.push([
                            {x: pos.getX(i), y: pos.getY(i)},
                            {x: pos.getX(i+1), y: pos.getY(i+1)},
                            {x: pos.getX(i+2), y: pos.getY(i+2)}
                        ]);
                    }
                }
                
                function splitTriangle(p1, p2, p3, lineVal, isAxisX) {
                    const tPts = [p1, p2, p3];
                    const val = p => isAxisX ? p.y : p.x;
                    const above = tPts.filter(p => val(p) < lineVal);
                    const below = tPts.filter(p => val(p) > lineVal);
                    const on = tPts.filter(p => val(p) === lineVal);

                    if (above.length === 3 || below.length === 3) return [tPts];
                    if (above.length === 2 && on.length === 1) return [tPts];
                    if (below.length === 2 && on.length === 1) return [tPts];
                    if (above.length === 1 && on.length === 2) return [tPts];
                    if (below.length === 1 && on.length === 2) return [tPts];
                    if (on.length === 3) return [tPts];

                    if (on.length === 1) {
                        const pAbove = above[0], pBelow = below[0], pOn = on[0];
                        const t = (lineVal - val(pAbove)) / (val(pBelow) - val(pAbove));
                        const pIntersect = isAxisX ? 
                            { x: pAbove.x + t * (pBelow.x - pAbove.x), y: lineVal } :
                            { x: lineVal, y: pAbove.y + t * (pBelow.y - pAbove.y) };
                        return [
                            [pAbove, pOn, pIntersect],
                            [pBelow, pOn, pIntersect]
                        ];
                    } else {
                        const lone = above.length === 1 ? above[0] : below[0];
                        const pair = above.length === 2 ? above : below;
                        
                        const t1 = (lineVal - val(lone)) / (val(pair[0]) - val(lone));
                        const pI1 = isAxisX ?
                            { x: lone.x + t1 * (pair[0].x - lone.x), y: lineVal } :
                            { x: lineVal, y: lone.y + t1 * (pair[0].y - lone.y) };
                        
                        const t2 = (lineVal - val(lone)) / (val(pair[1]) - val(lone));
                        const pI2 = isAxisX ?
                            { x: lone.x + t2 * (pair[1].x - lone.x), y: lineVal } :
                            { x: lineVal, y: lone.y + t2 * (pair[1].y - lone.y) };
                        
                        return [
                            [lone, pI1, pI2],
                            [pair[0], pI1, pI2],
                            [pair[0], pI2, pair[1]]
                        ];
                    }
                }
                
                let refinedTriangles = [];
                rawTriangles.forEach(tri => {
                    const split = splitTriangle(tri[0], tri[1], tri[2], axis === 'x' ? cy : cx, axis === 'x');
                    refinedTriangles.push(...split);
                });
                
                refinedTriangles.forEach(tri => {
                    for (let i = 0; i < 3; i++) {
                        const pt = tri[i];
                        let rv = 0;
                        if (axis === 'x') {
                            if (pt.y <= cy) rv = (pt.y - bMinY) * Math.tan(pitch * Math.PI / 180);
                            else rv = (bMaxY - pt.y) * Math.tan(pitch * Math.PI / 180);
                        } else {
                            if (pt.x <= cx) rv = (pt.x - bMinX) * Math.tan(pitch * Math.PI / 180);
                            else rv = (bMaxX - pt.x) * Math.tan(pitch * Math.PI / 180);
                        }
                        v.push(pt.x, rv, pt.y);
                        uv.push(pt.x / 100, pt.y / 100);
                    }
                });

                for (let i = 0; i < v.length; i += 9) {
                    const dx1 = v[i+3] - v[i], dz1 = v[i+5] - v[i+2];
                    const dx2 = v[i+6] - v[i], dz2 = v[i+8] - v[i+2];
                    const ny_true = dz1 * dx2 - dx1 * dz2;
                    if (ny_true < 0) { 
                        const tX = v[i+3], tY = v[i+4], tZ = v[i+5];
                        const tU = uv[i/3*2+2], tV = uv[i/3*2+3];
                        v[i+3] = v[i+6]; v[i+4] = v[i+7]; v[i+5] = v[i+8];
                        uv[i/3*2+2] = uv[i/3*2+4]; uv[i/3*2+3] = uv[i/3*2+5];
                        v[i+6] = tX; v[i+7] = tY; v[i+8] = tZ;
                        uv[i/3*2+4] = tU; uv[i/3*2+5] = tV;
                    }
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
                const addGableQuad = (p1, p2, h1, h2) => {
                    gv.push(p1.x, 0, p1.y, p2.x, 0, p2.y, p1.x, h1, p1.y);
                    gv.push(p1.x, h1, p1.y, p2.x, 0, p2.y, p2.x, h2, p2.y);
                    let sc = 1/100;
                    if (axis === 'x') {
                        guv.push(p1.y*sc, 0, p2.y*sc, 0, p1.y*sc, h1*sc);
                        guv.push(p1.y*sc, h1*sc, p2.y*sc, 0, p2.y*sc, h2*sc);
                    } else {
                        guv.push(p1.x*sc, 0, p2.x*sc, 0, p1.x*sc, h1*sc);
                        guv.push(p1.x*sc, h1*sc, p2.x*sc, 0, p2.x*sc, h2*sc);
                    }
                };

                if (conf.autoShapeWalls) {
                    let perimPts = [];
                    for(let i=0; i<basePts.length; i++) {
                        const p1 = basePts[i];
                        const p2 = basePts[(i+1)%basePts.length];
                        perimPts.push(p1);
                        const lineVal = axis === 'x' ? cy : cx;
                        const val1 = axis === 'x' ? p1.y : p1.x;
                        const val2 = axis === 'x' ? p2.y : p2.x;
                        if ((val1 < lineVal && val2 > lineVal) || (val1 > lineVal && val2 < lineVal)) {
                            const t = (lineVal - val1) / (val2 - val1);
                            perimPts.push({
                                x: p1.x + t * (p2.x - p1.x),
                                y: p1.y + t * (p2.y - p1.y)
                            });
                        }
                    }

                    for(let i=0; i<perimPts.length; i++) {
                        const p1 = perimPts[i];
                        const p2 = perimPts[(i+1)%perimPts.length];
                        let h1 = 0, h2 = 0;
                        if (axis === 'x') {
                            h1 = p1.y <= cy ? (p1.y - bMinY) * Math.tan(pitch * Math.PI / 180) : (bMaxY - p1.y) * Math.tan(pitch * Math.PI / 180);
                            h2 = p2.y <= cy ? (p2.y - bMinY) * Math.tan(pitch * Math.PI / 180) : (bMaxY - p2.y) * Math.tan(pitch * Math.PI / 180);
                        } else {
                            h1 = p1.x <= cx ? (p1.x - bMinX) * Math.tan(pitch * Math.PI / 180) : (bMaxX - p1.x) * Math.tan(pitch * Math.PI / 180);
                            h2 = p2.x <= cx ? (p2.x - bMinX) * Math.tan(pitch * Math.PI / 180) : (bMaxX - p2.x) * Math.tan(pitch * Math.PI / 180);
                        }
                        if (h1 > 0.01 || h2 > 0.01) {
                            addGableQuad(p1, p2, h1, h2);
                        }
                    }

                    if (gv.length > 0) {
                        const gGeo = new THREE.BufferGeometry();
                        gGeo.setAttribute("position", new THREE.Float32BufferAttribute(gv, 3));
                        gGeo.setAttribute("uv", new THREE.Float32BufferAttribute(guv, 2));
                        gGeo.computeVertexNormals();

                        const gableMatId = conf.gableMaterial || 'white_plaster_wall';
                        const wallDecor = WALL_DECOR_REGISTRY[gableMatId] || WALL_DECOR_REGISTRY['white_plaster_wall'];
                        let gableMat = new THREE.MeshStandardMaterial({ color: 0xefede5, side: THREE.DoubleSide });
                        if (wallDecor && wallDecor.texture) {
                            const gTex = new THREE.TextureLoader().load(wallDecor.texture);
                            gTex.wrapS = gTex.wrapT = THREE.RepeatWrapping;
                            gTex.repeat.set(100/(wallDecor.scaleRatio || 100), 100/(wallDecor.scaleRatio || 100));
                            gableMat = new THREE.MeshStandardMaterial({ map: gTex, side: THREE.DoubleSide, bumpMap: gTex, bumpScale: 0.015 });
                        }

                        const gableMesh = new THREE.Mesh(gGeo, gableMat);
                        mesh.add(gableMesh);
                    }
                }

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