import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Molding3DBuilder } from './Molding3DBuilder.js';
import { WIDGET_REGISTRY, FURNITURE_REGISTRY, WALL_DECOR_REGISTRY, ROOF_DECOR_REGISTRY, WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, FLOOR_REGISTRY, RAILING_REGISTRY, SKY_REGISTRY, GROUND_REGISTRY, DOOR_MATERIALS, WINDOW_FRAME_MATERIALS, WINDOW_GLASS_MATERIALS } from '../../core/registry';

export class EnvironmentBuilder {
    constructor(ctx) {
        this.ctx = ctx;
        this.moldingBuilder = new Molding3DBuilder();
    }

    setupBaseEnvironment() {
        this.ctx.scene.background = new THREE.Color(0xf3f4f6);
        this.ctx.scene.fog = new THREE.FogExp2(0xf3f4f6, 0.00016);

        const groundGeo = new THREE.PlaneGeometry(10000, 10000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5; // Prevent Z-fighting with room floors
        ground.receiveShadow = true;
        this.ctx.scene.add(ground);
        this.ground = ground;

        const grid = new THREE.GridHelper(5000, 250, 0x000000, 0x000000);
        grid.position.y = -0.4; // Prevent Z-fighting with room floors
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.ctx.scene.add(grid);
        this.grid = grid;

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 500, 0);
        this.ctx.scene.add(hemiLight);
        this.hemiLight = hemiLight;

        const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
        sunLight.position.set(500, 700, 600); // Higher angle for better architectural shadows
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 4096;
        sunLight.shadow.mapSize.height = 4096;
        sunLight.shadow.camera.near = 10;
        sunLight.shadow.camera.far = 2000;
        sunLight.shadow.bias = -0.0003; 
        sunLight.shadow.normalBias = 0.05; // Prevents shadow acne on flat parallel surfaces (like Craftsman steps)
        sunLight.shadow.radius = 1.2; // Crisp, low-noise soft shadows
        const d = 900; // Optimal shadow frustum size
        sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
        this.ctx.scene.add(sunLight);
        this.sunLight = sunLight;
    }

    setEnvironment(skyKey, groundKey) {
        const skyConfig = SKY_REGISTRY[skyKey];
        if (skyConfig) {
            if (skyConfig.skyColor) {
                this.ctx.scene.background = new THREE.Color(skyConfig.skyColor);
                if (this.ctx.scene.fog) this.ctx.scene.fog.color.setHex(skyConfig.fogColor || skyConfig.skyColor);
            }
            if (this.hemiLight) {
                this.hemiLight.color.setHex(skyConfig.hemiSky || 0xffffff);
                this.hemiLight.groundColor.setHex(skyConfig.hemiGround || 0x444444);
                this.hemiLight.intensity = skyConfig.hemi || 1.0;
            }
            if (this.sunLight) {
                this.sunLight.color.setHex(skyConfig.sunColor || 0xffffff);
                this.sunLight.intensity = skyConfig.sun || 1.0;
            }
        }

        const groundConfig = GROUND_REGISTRY[groundKey];
        if (groundConfig && this.ground) {
            if (groundConfig.color) {
                this.ground.material.color.setHex(groundConfig.color);
                this.ground.material.map = null;
                this.ground.material.needsUpdate = true;
            }
            if (groundConfig.texture) {
                this.ctx.assets.getTexture(groundConfig).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    texClone.repeat.set(groundConfig.repeat || 100, groundConfig.repeat || 100);
                    this.ground.material.map = texClone;
                    this.ground.material.color.setHex(0xffffff);
                    this.ground.material.needsUpdate = true;
                });
            }
        }
    }

    buildActiveFloor(walls, rooms, shapes, stairs = []) {
        const matMain = new THREE.MeshStandardMaterial({ 
            color: 0xf3f2ec, // Warm off-white
            roughness: 1.0, // Perfectly matte plaster, no shine
            metalness: 0.0,
            flatShading: true // Preserves sharp corners
        });
        const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9 });
        const matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });

        if (rooms) {
            rooms.forEach(room => {
                const path = room.path;
                if (!path || path.length < 3) return;

                const floorShape = new THREE.Shape();
                floorShape.moveTo(path[0].x, path[0].y);
                for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                
                const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
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
                
                const matFloor = new THREE.MeshStandardMaterial({ color: config?.color || 0xd1d5db, roughness: config?.roughness || 0.7 });
                const floorMesh = new THREE.Mesh(floorGeo, matFloor);
                floorMesh.position.y = 0;
                floorMesh.receiveShadow = true;
                floorMesh.userData = { isFloor: true, entity: room };

                if (config && config.texture) {
                    this.ctx.assets.getTexture(config).then(tex => {
                        const texClone = tex.clone();
                        texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                        const repeat = room.materialRepeat || config.repeat || 10;
                        texClone.repeat.set(1 / repeat, 1 / repeat);
                        matFloor.map = texClone;
                        matFloor.needsUpdate = true;
                    });
                }

                this.ctx.interactables.push(floorMesh);
                this.ctx.structureGroup.add(floorMesh);
                room.mesh3D = floorMesh;
            });
        }

        const standardWalls = walls.filter(w => w.type !== 'railing' && !w.hidden);
        const railingWalls = walls.filter(w => w.type === 'railing' && !w.hidden);

        standardWalls.forEach(w => {
            const p1 = w.startAnchor.position(), p2 = w.endAnchor.position();
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            const length = Math.hypot(dx, dz);
            const angle = Math.atan2(dz, dx);
            w.length3D = length;

            const h = w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT);
            const t = w.thickness !== undefined ? w.thickness : (w.config?.thickness || 8);
            
            // Compute mm early so holes and patterns can inherit painted materials
            let mm = [matMain, matMain, matMain, matMain, matMain, matMain];
            if (this.ctx.helpers && this.ctx.helpers.getFaceMaterials) {
                mm = this.ctx.helpers.getFaceMaterials(w, matMain, { width: length, height: h }).box;
                
                // Inherit painted material for newly generated hole faces and wall edges if not explicitly painted
                const p = w.params || {};
                const fallbackMat = p.textureFront ? mm[4] : (p.textureBack ? mm[5] : mm[4]);
                if (!p.textureRight && !p.textureSides && !p.texture) mm[0] = fallbackMat;
                if (!p.textureLeft && !p.textureSides && !p.texture) mm[1] = fallbackMat;
                if (!p.textureTop && !p.textureSides && !p.texture) mm[2] = fallbackMat;
                if (!p.textureBottom && !p.textureSides && !p.texture) mm[3] = fallbackMat;
            }

            const wallBottom = -1;
            const wallShape = new THREE.Shape();
            wallShape.moveTo(0, wallBottom); wallShape.lineTo(length, wallBottom); wallShape.lineTo(length, h); wallShape.lineTo(0, h); wallShape.lineTo(0, wallBottom);

            const extraMeshes = [];
            w.attachedWidgets.forEach(widg => {
                const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
                let hasHole = false;
                const type = widg.type || widg.configId;
                
                if (type === 'door') {
                    let dh = widg.height !== undefined ? widg.height : DOOR_HEIGHT;
                    let elev = widg.elevation !== undefined ? widg.elevation : 0;
                    let cutElev = (elev <= 0.1) ? wallBottom : elev;
                    hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, elev + dh); hole.lineTo(wCenter - halfW, elev + dh); hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;
                } else if (type === 'window' || type === 'jali_panel') {
                    let dh = widg.height !== undefined ? widg.height : (type === 'window' ? WINDOW_HEIGHT : 100);
                    let elev = widg.elevation !== undefined ? widg.elevation : (type === 'window' ? WINDOW_SILL : 0);
                    let cutElev = (elev <= 0.1) ? wallBottom : elev;
                    hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, elev + dh); hole.lineTo(wCenter - halfW, elev + dh); hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;
                } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type)) {
                    let elev = widg.elevation || 0;
                    let h_opening = widg.height || 200;
                    elev = Math.max(0, Math.min(elev, h));
                    h_opening = Math.max(0, Math.min(h_opening, h - elev));
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
                                        const pr = Math.min(pW, pH) / 4; pPath.moveTo(cx + pr, cy - pr); pPath.absarc(cx + pr, cy, pr, -Math.PI/2, Math.PI/2, false); pPath.absarc(cx, cy + pr, pr, 0, Math.PI, false); pPath.absarc(cx - pr, cy, pr, Math.PI/2, 3*Math.PI/2, false); pPath.absarc(cx, cy - pr, pr, Math.PI, 2*Math.PI, false);
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
                                    const widgetGroup = WIDGET_REGISTRY[type].render3D(this.ctx.structureGroup, widg, this.ctx.helpers);
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
                    const tX = x / length;
                    pos.setX(i, startX + tX * (endX - startX));
                }
                geo.computeVertexNormals();
            };

            if (pts && pts.length === 8) {
                shearGeo(wallGeo);
            }
            // ====== MULTI-MATERIAL AND UV FIX FOR EXTRUDED WALLS ======
            let finalWallGeo = wallGeo.toNonIndexed();
            finalWallGeo.clearGroups();
            const pos = finalWallGeo.attributes.position;
            const norm = finalWallGeo.attributes.normal;
            const uvs = finalWallGeo.attributes.uv;
            
            finalWallGeo.computeVertexNormals();

            for (let i = 0; i < pos.count; i += 3) {
                const nx = norm.getX(i) + norm.getX(i+1) + norm.getX(i+2);
                const ny = norm.getY(i) + norm.getY(i+1) + norm.getY(i+2);
                const nz = norm.getZ(i) + norm.getZ(i+1) + norm.getZ(i+2);
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
            
            // Add subtle architectural edges for corner visibility
            const edgesGeo = new THREE.EdgesGeometry(wallGeo, 15);
            const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 });
            const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
            wallMesh.add(edgesMesh);

            const skinFrontGeo = new THREE.PlaneGeometry(length - 0.5, h - 0.5);
            skinFrontGeo.translate(length / 2, h / 2, t / 2 + 0.1);
            if (pts && pts.length === 8) shearGeo(skinFrontGeo);
            const hitFront = new THREE.Mesh(skinFrontGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitFront.userData = { isWallSide: true, side: 'front', entity: w };

            const skinBackGeo = new THREE.PlaneGeometry(length - 0.5, h - 0.5);
            skinBackGeo.translate(length / 2, h / 2, -t / 2 - 0.1);
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

            const wallGroup = new THREE.Group();
            wallGroup.position.set(p1.x, 0, p1.y);
            wallGroup.rotation.y = -angle;
            wallGroup.add(wallMesh, hitFront, hitBack, ...extraMeshes);
            wallGroup.userData = { entity: w };
            w.mesh3D = wallGroup;

            this.ctx.interactables.push(hitFront, hitBack);
            this.ctx.structureGroup.add(wallGroup);

            if (w.attachedDecor) w.attachedDecor.forEach(decor => this.ctx.decorManager.load(w, decor));
        });

        this.buildRailings(railingWalls, standardWalls, shapes);
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
                    buildBaseWall(totalH, true);
                });
            } else {
                buildBaseWall(totalH, true);
            }
        });
    }

    buildStaticFloors(levelsConfigArray, activeIndex, viewMode3D, stairs = []) {
        levelsConfigArray.forEach((levelConfig, index) => {
            if (index === activeIndex) return; 
            if (!levelConfig || !levelConfig.data) return;
            if (levelConfig.isVisible === false) return;

            try {
                const data = JSON.parse(levelConfig.data);
                const floorGroup = new THREE.Group();
                floorGroup.position.y = index * WALL_HEIGHT;

                const isPreview = viewMode3D === 'preview';
            const matMain = new THREE.MeshStandardMaterial({ 
                color: 0xf3f2ec, // Warm off-white
                roughness: 1.0, // Perfectly matte plaster
                metalness: 0.0,
                flatShading: true // Preserves sharp corners
            });
            const matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xeaeaea, roughness: 0.9 });
            const matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });

                if (data.rooms) {
                    data.rooms.forEach(room => {
                        const path = room.path;
                        if (!path || path.length < 3) return;
                        const floorShape = new THREE.Shape();
                        floorShape.moveTo(path[0].x, path[0].y);
                        for (let i = 1; i < path.length; i++) floorShape.lineTo(path[i].x, path[i].y);
                        
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
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
                        
                        const matFloor = new THREE.MeshStandardMaterial({ color: config?.color || 0xd1d5db, roughness: config?.roughness || 0.7 });
                        const floorMesh = new THREE.Mesh(floorGeo, matFloor);
                        floorMesh.position.y = 0;
                        floorMesh.receiveShadow = true;
                        
                        if (config && config.texture) {
                            this.ctx.assets.getTexture(config).then(tex => {
                                const texClone = tex.clone();
                                texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                                const repeat = room.materialRepeat || config.repeat || 10;
                                texClone.repeat.set(1 / repeat, 1 / repeat);
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
                        
                        const floorGeo = new THREE.ExtrudeGeometry(floorShape, { depth: 10, bevelEnabled: false });
                        floorGeo.rotateX(Math.PI / 2);
                        const floorMesh = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 0.7 }));
                        floorMesh.position.y = 0;
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
                            
                            // Inherit painted material for newly generated hole faces and wall edges if not explicitly painted
                            const p = w.params || {};
                            const fallbackMat = p.textureFront ? mm[4] : (p.textureBack ? mm[5] : mm[4]);
                            if (!p.textureRight && !p.textureSides && !p.texture) mm[0] = fallbackMat;
                            if (!p.textureLeft && !p.textureSides && !p.texture) mm[1] = fallbackMat;
                            if (!p.textureTop && !p.textureSides && !p.texture) mm[2] = fallbackMat;
                            if (!p.textureBottom && !p.textureSides && !p.texture) mm[3] = fallbackMat;
                        }

                        const wallShape = new THREE.Shape();
                        wallShape.moveTo(0, wallBottom); wallShape.lineTo(length, wallBottom); wallShape.lineTo(length, totalH); wallShape.lineTo(0, totalH); wallShape.lineTo(0, wallBottom);
                        
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
                                    hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, elev + dh); hole.lineTo(wCenter - halfW, elev + dh); hole.lineTo(wCenter - halfW, cutElev);
                                    hasHole = true;
                                } else if (type === 'window' || type === 'jali_panel') {
                                    let dh = widg.height !== undefined ? widg.height : (type === 'window' ? WINDOW_HEIGHT : 100);
                                    let elev = widg.elevation !== undefined ? widg.elevation : (type === 'window' ? WINDOW_SILL : 0);
                                    dh = Math.min(dh, maxH - elev);
                                    let cutElev = (elev <= 0.1) ? wallBottom : elev;
                                    hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, elev + dh); hole.lineTo(wCenter - halfW, elev + dh); hole.lineTo(wCenter - halfW, cutElev);
                                    hasHole = true;
                                } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type)) {
                                    let elev = widg.elevation || 0;
                                    let h_opening = widg.height || 200;
                                    elev = Math.max(0, Math.min(elev, maxH));
                                    h_opening = Math.max(0, Math.min(h_opening, maxH - elev));
                                    if (h_opening > 0) {
                                        if (type === 'arch_opening') {
                                            const radius = halfW;
                                            const straightH = Math.max(0, h_opening - radius);
                                            hole.moveTo(wCenter - halfW, elev);
                                            hole.lineTo(wCenter + halfW, elev);
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
                                                        const pr = Math.min(pW, pH) / 4; pPath.moveTo(cx + pr, cy - pr); pPath.absarc(cx + pr, cy, pr, -Math.PI/2, Math.PI/2, false); pPath.absarc(cx, cy + pr, pr, 0, Math.PI, false); pPath.absarc(cx - pr, cy, pr, Math.PI/2, 3*Math.PI/2, false); pPath.absarc(cx, cy - pr, pr, Math.PI, 2*Math.PI, false);
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
                                    const widgetGroup = WIDGET_REGISTRY[type].render3D(floorGroup, widg, this.ctx.helpers);
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
                                const tX = x / length;
                                pos.setX(i, startX + tX * (endX - startX));
                            }
                            geo.computeVertexNormals();
                        };
                        shearGeo(wallGeo, w.thickness);
                        }
                        // ==================================
                        
                        // Fix for multi-material mapping on static walls
                        let finalWallGeo = wallGeo.toNonIndexed();
                        finalWallGeo.clearGroups();
                        const finalPos = finalWallGeo.attributes.position;
                        const finalNorm = finalWallGeo.attributes.normal;
                        const finalUvs = finalWallGeo.attributes.uv;
                        
                        finalWallGeo.computeVertexNormals();

                        for (let i = 0; i < finalPos.count; i += 3) {
                            const nx = finalNorm.getX(i) + finalNorm.getX(i+1) + finalNorm.getX(i+2);
                            const ny = finalNorm.getY(i) + finalNorm.getY(i+1) + finalNorm.getY(i+2);
                            const nz = finalNorm.getZ(i) + finalNorm.getZ(i+1) + finalNorm.getZ(i+2);
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
                        
                        const edgesGeo = new THREE.EdgesGeometry(wallGeo, 15);
                        const edgesMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.1 });
                        const edgesMesh = new THREE.LineSegments(edgesGeo, edgesMat);
                        wallMesh.add(edgesMesh);

                        if (w.moldings) {
                            w.moldings.forEach(mold => {
                                const mMesh = this.moldingBuilder.buildMolding(mold, length, w.thickness, this.ctx.helpers);
                                extraMeshes.push(mMesh);
                                if (!isPreview) this.ctx.interactables.push(mMesh);
                            });
                        }

                        const wallGroup = new THREE.Group();
                        wallGroup.position.set(w.startX, 0, w.startY);
                        wallGroup.rotation.y = -angle;
                        wallGroup.userData = { entity: w };
                        w.mesh3D = wallGroup;
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

                this.ctx.staticStructureGroup.add(floorGroup);
            } catch (e) { console.error("Error parsing static floor", e); }
        });
    }

    buildRoofs(roofs, activeIndex, walls, targetGroup) {
        if (!roofs || roofs.length === 0) return;
        
        const hasWalls = walls && walls.length > 0;
        let maxWallHeight = WALL_HEIGHT;
        if (hasWalls) {
            maxWallHeight = Math.max(...walls.map(w => w.height !== undefined ? w.height : (w.config?.height || WALL_HEIGHT)));
        }

        roofs.forEach(roof => {
            const pts = roof.points || [];
            if (pts.length < 3) return;

            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            pts.forEach(p => {
                minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
                minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
            });

            const conf = roof.config || roof; 
            const wallGap = conf.wallGap || 0;
            
            const W = maxX - minX;
            const D = maxY - minY;
            
            const baseHeight = (hasWalls || activeIndex === 0) ? maxWallHeight : 0;
            const h = baseHeight + wallGap + 0.5;

            const decor = ROOF_DECOR_REGISTRY[conf.material] || ROOF_DECOR_REGISTRY['asphalt_shingles'];
            const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });

            if (decor && decor.texture) {
                this.ctx.assets.getTexture(decor).then(tex => {
                    const texClone = tex.clone();
                    texClone.wrapS = texClone.wrapT = THREE.RepeatWrapping;
                    const repeatScale = decor.repeat || 1;
                    texClone.repeat.set(W / (100 * repeatScale), D / (100 * repeatScale));
                    mat.map = texClone;
                    mat.needsUpdate = true;
                });
            }

            let mesh;
            if (conf.roofType === 'flat') {
                const shape = new THREE.Shape();
                shape.moveTo(pts[0].x, pts[0].y);
                for (let i = 1; i < pts.length; i++) shape.lineTo(pts[i].x, pts[i].y);
                shape.lineTo(pts[0].x, pts[0].y);
                
                const geo = new THREE.ExtrudeGeometry(shape, { depth: conf.thickness || 2, bevelEnabled: false });
                geo.rotateX(Math.PI / 2);
                geo.translate(0, conf.thickness || 2, 0); 
                mesh = new THREE.Mesh(geo, mat);
            } else {
                const pitch = conf.pitch || 30;
                const maxSpan = Math.min(W, D);
                const rh = Math.tan(pitch * Math.PI / 180) * (maxSpan / 2);
                
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
            roofGroup.position.set(groupX, h, groupZ);
            
            let rot = roof.rotation || 0;
            roofGroup.rotation.y = -rot * Math.PI / 180;

            mesh.castShadow = true;
            mesh.receiveShadow = true;
            
            if (this.ctx.viewMode3D !== 'preview' && targetGroup === this.ctx.structureGroup) {
                mesh.userData = { isFurniture: true, entity: roof }; 
                this.ctx.interactables.push(mesh);
            }
            
            roofGroup.add(mesh);
            targetGroup.add(roofGroup);
            roof.mesh3D = roofGroup;
        });
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