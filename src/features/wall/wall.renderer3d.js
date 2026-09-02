import * as THREE from 'three';
import { WALL_HEIGHT, DOOR_HEIGHT, WINDOW_SILL, WINDOW_HEIGHT, RAILING_REGISTRY, WIDGET_REGISTRY } from '../../core/registry.js';
import { MaterialFactory } from '../../core/engine3d/MaterialFactory.js';
import { Molding3DBuilder } from '../../core/engine3d/Molding3DBuilder.js';
import { WallGeometryEngine } from '../../core/wall/WallGeometryEngine.js';

export function getPlasterMaterial() {
    return new THREE.MeshStandardMaterial({ 
        color: 0xefede5,
        roughness: 0.9,
        metalness: 0.0,
        envMapIntensity: 0.08
    });
}

/**
 * Wall3DBuilder
 * 
 * Canonical, single-source-of-truth 3D Wall Builder for both Active and Static floors.
 */
export class Wall3DBuilder {
    constructor() {
        this.matMain = getPlasterMaterial();
        this.matMain.userData = { isShared: true };
        this.matEdgeDark = new THREE.MeshStandardMaterial({ color: 0xdddddb, roughness: 0.9 });
        this.matEdgeDark.userData = { isShared: true };
        this.matBaseboard = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, metalness: 0.1 });
        this.matBaseboard.userData = { isShared: true };
        this.moldingBuilder = new Molding3DBuilder();
    }

    /**
     * Builds the complete 3D wall group for an active wall entity.
     * @param {Object} w - The active PremiumWall instance.
     * @param {Object} ctx - The Engine3D context (contains helpers, interactables, structureGroup, decorManager, etc.).
     * @param {Object} options - Additional build options (activeLevelHeight, activeLevelConfig, etc.).
     */
    buildWallGroup(arg1, arg2 = {}, arg3 = {}, arg4, arg5, arg6, arg7, arg8) {
        let w, ctx = {}, options = {};
        if (typeof arg1 === 'number') {
            // Called with signature: (length, wallThickness, w, startX, startY, angle, wallHeight, ctx)
            w = arg3;
            ctx = (typeof arg8 === 'object' && arg8) ? arg8 : (typeof arg2 === 'object' && arg2 && !arg2.thickness ? arg2 : (this.ctx || {}));
            options = {
                length: arg1,
                wallThickness: arg2,
                startX: arg4,
                startY: arg5,
                angle: arg6,
                wallHeight: arg7
            };
        } else {
            // Called with signature: (w, ctx, options)
            w = arg1;
            ctx = arg2 || this.ctx || {};
            options = arg3 || {};
        }

        if (!w) return { wallGroup: new THREE.Group(), wallMesh: null, extraInteractables: [] };

        // Cleanly remove previous 3D wall mesh and its children before rebuilding with cutouts
        if (w.mesh3D) {
            if (w.mesh3D.parent) {
                w.mesh3D.parent.remove(w.mesh3D);
            } else if (ctx.structureGroup) {
                ctx.structureGroup.remove(w.mesh3D);
            }
            w.mesh3D.traverse(c => {
                if (c.geometry) c.geometry.dispose();
            });
            w.mesh3D = null;
        }

        const matMain = getPlasterMaterial();
        const p1 = WallGeometryEngine.getAnchorPosition(w.startAnchor || { x: w.startX, y: w.startY });
        const startX = options.startX !== undefined ? options.startX : p1.x;
        const startY = options.startY !== undefined ? options.startY : p1.y;
        
        let length, angle;
        if (options.length !== undefined) {
            length = options.length;
            angle = options.angle !== undefined ? options.angle : 0;
        } else {
            const p2 = WallGeometryEngine.getAnchorPosition(w.endAnchor || { x: w.endX, y: w.endY });
            const dx = p2.x - p1.x, dz = p2.y - p1.y;
            length = Math.hypot(dx, dz);
            angle = Math.atan2(dz, dx);
        }
        w.length3D = length;

        const activeLevelConfig = options.activeLevelConfig || ctx.activeLevelConfig;
        const activeLevelHeight = options.activeLevelHeight || ctx.activeLevelHeight;

        const defaultH = activeLevelHeight || Number(activeLevelConfig?.height) || WALL_HEIGHT;
        const defaultThk = Number(activeLevelConfig?.defaultWallThickness) || (w.type === 'compound' ? 12 : (w.type === 'outer' ? 20 : 10));
        let h = options.wallHeight !== undefined ? options.wallHeight : (w.height !== undefined ? w.height : (w.config?.height || (w.type === 'compound' ? 80 : defaultH)));
        if (activeLevelConfig?.type === 'plinth' || activeLevelConfig?.type === 'foundation') {
            h = defaultH;
        }
        let t = options.wallThickness !== undefined ? options.wallThickness : (w.thickness !== undefined ? w.thickness : (w.config?.thickness || defaultThk));
        if ((activeLevelConfig?.type === 'plinth' || activeLevelConfig?.type === 'foundation') && !w.thickness) {
            t = defaultThk;
        }

        // Compute multi-materials (Right 0, Left 1, Top 2, Bottom 3, Front 4, Back 5)
        let mm = [matMain, matMain, matMain, matMain, matMain, matMain];
        if (ctx.helpers && ctx.helpers.getFaceMaterials) {
            mm = ctx.helpers.getFaceMaterials(w, matMain, { width: length, height: h }).box;
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
        wallGroup.position.set(startX, elev, startY);
        wallGroup.rotation.y = -angle;
        wallGroup.userData = { entity: w };
        w.mesh3D = wallGroup;

        const extraMeshes = [];
        (w.attachedWidgets || []).forEach(widg => {
            const hole = new THREE.Path(), wCenter = length * widg.t, halfW = widg.width / 2;
            let hasHole = false;
            const wType = (widg.type === 'window' || widg.windowType || (widg.config && widg.config.widget === 'window') || widg.configId === 'window') ? 'window' :
                          (widg.type === 'door' || widg.doorType || (widg.config && widg.config.widget === 'door') || widg.configId === 'door') ? 'door' :
                          (widg.type || widg.configId);

            if (wType === 'door') {
                let dh = widg.height !== undefined ? widg.height : DOOR_HEIGHT;
                let wElev = widg.elevation !== undefined ? widg.elevation : 0;
                let cutElev = (wElev <= 0.1) ? wallBottom : wElev;

                const shapeType = widg.doorShape || widg.windowShape || widg.params?.doorShape || widg.params?.windowShape || widg.config?.doorShape || widg.config?.windowShape || widg.shape || (widg.configId === 'entry_arched_double' ? 'radius' : 'square');
                hole.moveTo(wCenter - halfW, cutElev);
                hole.lineTo(wCenter + halfW, cutElev);

                if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                    const straightH = Math.max(0, dh - halfW);
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    if (halfW > 0) hole.absarc(wCenter, wElev + straightH, halfW, 0, Math.PI, false);
                } else if (shapeType === 'segment') {
                    const rise = widg.width * 0.15;
                    const straightH = Math.max(0, dh - rise);
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    hole.quadraticCurveTo(wCenter, wElev + dh + rise * 0.5, wCenter - halfW, wElev + straightH);
                } else if (shapeType === 'gothic') {
                    const straightH = Math.max(0, dh - (widg.width * 0.7));
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    hole.quadraticCurveTo(wCenter + halfW * 0.2, wElev + dh, wCenter, wElev + dh);
                    hole.quadraticCurveTo(wCenter - halfW * 0.2, wElev + dh, wCenter - halfW, wElev + straightH);
                } else {
                    hole.lineTo(wCenter + halfW, wElev + dh);
                    hole.lineTo(wCenter - halfW, wElev + dh);
                }

                hole.lineTo(wCenter - halfW, cutElev);
                hasHole = true;
            } else if (wType === 'window' || wType === 'jali_panel') {
                let dh = widg.height !== undefined ? widg.height : (wType === 'window' ? WINDOW_HEIGHT : 100);
                let wElev = widg.elevation !== undefined ? widg.elevation : (wType === 'window' ? WINDOW_SILL : 0);
                let cutElev = (wElev <= 0.1) ? wallBottom : wElev;
                const shapeType = widg.windowShape || widg.doorShape || widg.params?.windowShape || widg.params?.doorShape || widg.config?.windowShape || widg.config?.doorShape || widg.shape || 'square';

                hole.moveTo(wCenter - halfW, cutElev);
                hole.lineTo(wCenter + halfW, cutElev);
                if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched') {
                    const straightH = Math.max(0, dh - halfW);
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    if (halfW > 0) hole.absarc(wCenter, wElev + straightH, halfW, 0, Math.PI, false);
                } else if (shapeType === 'segment') {
                    const rise = widg.width * 0.15;
                    const straightH = Math.max(0, dh - rise);
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    hole.quadraticCurveTo(wCenter, wElev + dh + rise * 0.5, wCenter - halfW, wElev + straightH);
                } else if (shapeType === 'gothic') {
                    const straightH = Math.max(0, dh - (widg.width * 0.7));
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    hole.quadraticCurveTo(wCenter + halfW * 0.2, wElev + dh, wCenter, wElev + dh);
                    hole.quadraticCurveTo(wCenter - halfW * 0.2, wElev + dh, wCenter - halfW, wElev + straightH);
                } else {
                    hole.lineTo(wCenter + halfW, wElev + dh);
                    hole.lineTo(wCenter - halfW, wElev + dh);
                }
                hole.lineTo(wCenter - halfW, cutElev);
                hasHole = true;
            } else if (['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess', 'opening'].includes(wType)) {
                let wElev = widg.elevation || 0;
                let h_opening = widg.height || (wType === 'arch_opening' || wType === 'opening' ? DOOR_HEIGHT : 60);
                wElev = Math.max(0, Math.min(wElev, maxH));
                h_opening = Math.max(0, Math.min(h_opening, maxH - wElev));
                let cutElev = (wElev <= 0.1) ? wallBottom : wElev;

                if (wType === 'arch_opening') {
                    const radius = halfW;
                    const straightH = Math.max(0, h_opening - radius);
                    hole.moveTo(wCenter - halfW, cutElev);
                    hole.lineTo(wCenter + halfW, cutElev);
                    hole.lineTo(wCenter + halfW, wElev + straightH);
                    if (radius > 0) hole.absarc(wCenter, wElev + straightH, radius, 0, Math.PI, false);
                    hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;
                } else if (wType === 'circular_opening') {
                    hole.moveTo(wCenter + halfW, wElev + h_opening / 2);
                    hole.absellipse(wCenter, wElev + h_opening / 2, halfW, h_opening / 2, 0, Math.PI * 2, false, 0);
                    hasHole = true;
                } else if (wType === 'custom_shape_opening') {
                    hole.moveTo(wCenter, cutElev);
                    hole.lineTo(wCenter + halfW, wElev + h_opening / 2);
                    hole.lineTo(wCenter, wElev + h_opening);
                    hole.lineTo(wCenter - halfW, wElev + h_opening / 2);
                    hole.lineTo(wCenter, cutElev);
                    hasHole = true;
                } else if (wType === 'pattern_opening') {
                    hole.moveTo(wCenter - halfW, cutElev);
                    hole.lineTo(wCenter + halfW, cutElev);
                    hole.lineTo(wCenter + halfW, wElev + h_opening);
                    hole.lineTo(wCenter - halfW, wElev + h_opening);
                    hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;

                    const patternShape = new THREE.Shape();
                    patternShape.moveTo(wCenter - halfW, wElev);
                    patternShape.lineTo(wCenter + halfW, wElev);
                    patternShape.lineTo(wCenter + halfW, wElev + h_opening);
                    patternShape.lineTo(wCenter - halfW, wElev + h_opening);
                    patternShape.lineTo(wCenter - halfW, wElev);

                    const rows = widg.rows || 4, cols = widg.cols || 4, spacing = widg.spacing !== undefined ? widg.spacing : 5;
                    const style = widg.patternStyle || 'grid';
                    const pW = (widg.width - spacing * (cols + 1)) / cols;
                    const pH = (h_opening - spacing * (rows + 1)) / rows;
                    if (pW > 0 && pH > 0) {
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                const px = (wCenter - halfW) + spacing + c * (pW + spacing);
                                const py = wElev + spacing + r * (pH + spacing);
                                const pPath = new THREE.Path();
                                const cx = px + pW / 2, cy = py + pH / 2;
                                if (style === 'diamond') {
                                    pPath.moveTo(cx, py); pPath.lineTo(px + pW, cy); pPath.lineTo(cx, py + pH); pPath.lineTo(px, cy); pPath.lineTo(cx, py);
                                } else if (style === 'circle') {
                                    pPath.moveTo(cx + Math.min(pW, pH) / 2, cy); pPath.absarc(cx, cy, Math.min(pW, pH) / 2, 0, Math.PI * 2, false);
                                } else if (style === 'cross') {
                                    const w1 = pW * 0.2, h1 = pH * 0.8, w2 = pW * 0.8, h2 = pH * 0.2;
                                    pPath.moveTo(cx - w1 / 2, cy - h1 / 2); pPath.lineTo(cx + w1 / 2, cy - h1 / 2); pPath.lineTo(cx + w1 / 2, cy - h2 / 2); pPath.lineTo(cx + w2 / 2, cy - h2 / 2); pPath.lineTo(cx + w2 / 2, cy + h2 / 2); pPath.lineTo(cx + w1 / 2, cy + h2 / 2); pPath.lineTo(cx + w1 / 2, cy + h1 / 2); pPath.lineTo(cx - w1 / 2, cy + h1 / 2); pPath.lineTo(cx - w1 / 2, cy + h2 / 2); pPath.lineTo(cx - w2 / 2, cy + h2 / 2); pPath.lineTo(cx - w2 / 2, cy - h2 / 2); pPath.lineTo(cx - w1 / 2, cy - h2 / 2); pPath.lineTo(cx - w1 / 2, cy - h1 / 2);
                                } else if (style === 'hexagon') {
                                    const rad = Math.min(pW, pH) / 2; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; const hx = cx + rad * Math.cos(a), hy = cy + rad * Math.sin(a); if (i === 0) pPath.moveTo(hx, hy); else pPath.lineTo(hx, hy); } pPath.lineTo(cx + rad, cy);
                                } else if (style === 'star') {
                                    const rOut = Math.min(pW, pH) / 2, rIn = rOut * 0.3; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; const rad = i % 2 === 0 ? rOut : rIn; const sx = cx + rad * Math.cos(a), sy = cy + rad * Math.sin(a); if (i === 0) pPath.moveTo(sx, sy); else pPath.lineTo(sx, sy); } pPath.lineTo(cx + rOut, cy);
                                } else if (style === 'slit') {
                                    const slitW = pW * 0.3, slitH = pH * 0.9; pPath.moveTo(cx - slitW / 2, cy - slitH / 2); pPath.lineTo(cx + slitW / 2, cy - slitH / 2); pPath.lineTo(cx + slitW / 2, cy + slitH / 2); pPath.lineTo(cx - slitW / 2, cy + slitH / 2); pPath.lineTo(cx - slitW / 2, cy - slitH / 2);
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
                                        const p1_rot = rot(hw * 0.12, hh * 0.95);
                                        const p2_rot = rot(hw * 0.95, hh * 0.95);
                                        const p3_rot = rot(hw * 0.95, hh * 0.12);
                                        const pCtrl = rot(hw * 0.42, hh * 0.42);

                                        p.moveTo(p1_rot.x, p1_rot.y);
                                        p.lineTo(p2_rot.x, p2_rot.y);
                                        p.lineTo(p3_rot.x, p3_rot.y);
                                        p.quadraticCurveTo(pCtrl.x, pCtrl.y, p1_rot.x, p1_rot.y);
                                        p.closePath();
                                        patternShape.holes.push(p);
                                    });
                                    continue;
                                } else if (style === 'arabesque') {
                                    const rOut = Math.min(pW, pH) / 2, rIn = rOut * 0.55; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; const rad = i % 2 === 0 ? rOut : rIn; const sx = cx + rad * Math.cos(a), sy = cy + rad * Math.sin(a); if (i === 0) pPath.moveTo(sx, sy); else pPath.lineTo(sx, sy); }
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
                    const patternMat = mm[4].clone();
                    const patternMesh = new THREE.Mesh(patternGeo, patternMat);
                    patternMesh.castShadow = true; patternMesh.receiveShadow = true;

                    const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, t + 4);
                    hitBoxGeo.translate(wCenter, wElev + h_opening / 2, 0);
                    const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                    hitBox.userData = { isHitbox: true };

                    const patternGroup = new THREE.Group();
                    patternGroup.add(patternMesh, hitBox);
                    patternGroup.userData = { isPattern: true, entity: widg };
                    widg.patternMesh3D = patternGroup;
                    widg.patternMat3D = patternMat;

                    if (ctx.updatePatternLive) ctx.updatePatternLive(widg);
                    extraMeshes.push(patternGroup);
                    if (ctx.viewMode3D !== 'preview' && ctx.interactables) ctx.interactables.push(hitBox);

                } else if (wType === 'solid_protrusion') {
                    hasHole = false;
                } else {
                    hole.moveTo(wCenter - halfW, cutElev); hole.lineTo(wCenter + halfW, cutElev); hole.lineTo(wCenter + halfW, wElev + h_opening); hole.lineTo(wCenter - halfW, wElev + h_opening); hole.lineTo(wCenter - halfW, cutElev);
                    hasHole = true;
                }

                if (wType === 'niche_recess') {
                    const depth = widg.depth || 10;
                    const recessThickness = Math.max(0.5, t - depth);
                    const nicheGeo = new THREE.BoxGeometry(widg.width, h_opening, recessThickness);
                    const zOffset = (widg.facing === -1) ? (t / 2 - recessThickness / 2) : (-t / 2 + recessThickness / 2);
                    nicheGeo.translate(wCenter, wElev + h_opening / 2, zOffset);
                    const nicheMesh = new THREE.Mesh(nicheGeo, mm[4]);
                    nicheMesh.castShadow = true; nicheMesh.receiveShadow = true;
                    extraMeshes.push(nicheMesh);
                } else if (wType === 'solid_protrusion') {
                    const depth = widg.depth || 10;
                    const protrusionGeo = new THREE.BoxGeometry(widg.width, h_opening, depth);
                    const facing = widg.facing || 1;
                    const zOffset = (facing === 1) ? (t / 2 + depth / 2) : (-t / 2 - depth / 2);
                    protrusionGeo.translate(wCenter, wElev + h_opening / 2, zOffset);

                    // 6-Face Material Array: [Right, Left, Top, Bottom, Front, Back]
                    const defaultMat = (facing === 1) ? mm[4] : mm[5];
                    const pParams = widg.params || {};
                    const getMat = (key) => key ? MaterialFactory.getMaterial(key, 'wall') : defaultMat;

                    const matRight = getMat(pParams.textureRight || pParams.textureSides || (facing === 1 ? w.params?.textureRight : w.params?.textureLeft));
                    const matLeft = getMat(pParams.textureLeft || pParams.textureSides || (facing === 1 ? w.params?.textureLeft : w.params?.textureRight));
                    const matTop = getMat(pParams.textureTop || w.params?.textureTop);
                    const matBottom = getMat(pParams.textureBottom || w.params?.textureBottom);
                    const matFront = getMat(pParams.textureFront || (facing === 1 ? w.params?.textureFront : w.params?.textureBack));
                    const matBack = getMat(pParams.textureBack || (facing === 1 ? w.params?.textureBack : w.params?.textureFront));

                    const protrusionMats = [matRight, matLeft, matTop, matBottom, matFront, matBack];
                    const protrusionMesh = new THREE.Mesh(protrusionGeo, protrusionMats);
                    protrusionMesh.castShadow = true;
                    protrusionMesh.receiveShadow = true;
                    protrusionMesh.userData = { 
                        isWidget: true, 
                        isWallSide: true, 
                        isProtrusion: true, 
                        parentWall: w, 
                        entity: w, 
                        widget: widg 
                    };
                    extraMeshes.push(protrusionMesh);
                    if (ctx.viewMode3D !== 'preview' && ctx.interactables) {
                        ctx.interactables.push(protrusionMesh);
                    }
                }
            }
            if (hasHole) wallShape.holes.push(hole);

            if (WIDGET_REGISTRY[wType] && WIDGET_REGISTRY[wType].render3D) {
                widg.x = p1.x + Math.cos(angle) * wCenter;
                widg.z = p1.y + Math.sin(angle) * wCenter;
                widg.angle = angle;
                widg.thick = t;
                widg.wall = w;
                widg.localX = wCenter;

                const widgetGroup = WIDGET_REGISTRY[wType].render3D(wallGroup, widg, ctx.helpers);
                if (widgetGroup) {
                    widg.mesh3D = widgetGroup;
                    if (ctx.interactables) ctx.interactables.push(widgetGroup);
                }
            }
        });

        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: t, bevelEnabled: false, steps: 12 });
        wallGeo.translate(0, 0, -t / 2);

        // ====== MITER JOINT SHEARING ======
        const startProfile = w.wallShapeData?.startProfile || w.startProfile;
        const endProfile = w.wallShapeData?.endProfile || w.endProfile;
        const pts = typeof w.poly?.points === 'function' ? w.poly.points() : (w.pts || null);
        const hasStartCap = w.wallShapeData?.hasStartCap ?? (w.startAnchor ? (w.startAnchor.connectedWalls ? w.startAnchor.connectedWalls.length <= 1 : true) : true);
        const hasEndCap = w.wallShapeData?.hasEndCap ?? (w.endAnchor ? (w.endAnchor.connectedWalls ? w.endAnchor.connectedWalls.length <= 1 : true) : true);

        const toLocal = (ptX, ptY) => {
            const dx_pt = ptX - p1.x;
            const dy_pt = ptY - p1.y;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return { x: dx_pt * c + dy_pt * s, z: -dx_pt * s + dy_pt * c };
        };

        const toLocalX = (ptX, ptY) => {
            const dx_pt = ptX - p1.x;
            const dy_pt = ptY - p1.y;
            return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
        };

        const sTrueL = w.wallShapeData?.startData?.trueCorners?.[0] || (pts && pts.length >= 8 ? { x: pts[0], y: pts[1] } : null);
        const sTrueR = w.wallShapeData?.startData?.trueCorners?.[1] || (pts && pts.length >= 8 ? { x: pts[6], y: pts[7] } : null);
        const eTrueL = w.wallShapeData?.endData?.trueCorners?.[0] || (pts && pts.length >= 8 ? { x: pts[2], y: pts[3] } : null);
        const eTrueR = w.wallShapeData?.endData?.trueCorners?.[1] || (pts && pts.length >= 8 ? { x: pts[4], y: pts[5] } : null);

        let startProfileLocal = null;
        let endProfileLocal = null;

        if (!hasStartCap && startProfile && startProfile.length > 0) {
            startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
        } else if (!hasStartCap && sTrueL && sTrueR) {
            const sL_x = toLocalX(sTrueL.x, sTrueL.y);
            const sR_x = toLocalX(sTrueR.x, sTrueR.y);
            startProfileLocal = [{ x: sR_x, z: -t / 2 }, { x: sL_x, z: t / 2 }];
        } else {
            startProfileLocal = [{ x: 0, z: -t / 2 }, { x: 0, z: t / 2 }];
        }

        if (!hasEndCap && endProfile && endProfile.length > 0) {
            endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
        } else if (!hasEndCap && eTrueL && eTrueR) {
            const eL_x = toLocalX(eTrueL.x, eTrueL.y);
            const eR_x = toLocalX(eTrueR.x, eTrueR.y);
            endProfileLocal = [{ x: eR_x, z: -t / 2 }, { x: eL_x, z: t / 2 }];
        } else {
            endProfileLocal = [{ x: length, z: -t / 2 }, { x: length, z: t / 2 }];
        }

        const interpolateX = (profile, zTarget) => {
            if (!profile || profile.length === 0) return 0;
            if (profile.length === 1) return profile[0].x;
            if (zTarget <= profile[0].z) return profile[0].x;
            if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
            for (let i = 0; i < profile.length - 1; i++) {
                const pA = profile[i];
                const pB = profile[i + 1];
                if (zTarget >= pA.z && zTarget <= pB.z) {
                    const dz = pB.z - pA.z;
                    if (Math.abs(dz) < 1e-6) return pA.x;
                    const factor = (zTarget - pA.z) / dz;
                    return pA.x + factor * (pB.x - pA.x);
                }
            }
            return profile[profile.length - 1].x;
        };

        const shearGeo = (geo) => {
            const posAttr = geo.attributes.position;
            if (!posAttr) return;
            for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const z = posAttr.getZ(i);
                const sX = interpolateX(startProfileLocal, z);
                const eX = interpolateX(endProfileLocal, z);

                if (x <= 0.1) {
                    posAttr.setX(i, sX);
                } else if (x >= length - 0.1) {
                    posAttr.setX(i, eX);
                } else {
                    posAttr.setX(i, x);
                }
            }
            geo.computeVertexNormals();
            posAttr.needsUpdate = true;
        };

        shearGeo(wallGeo);

        // ====== MULTI-MATERIAL AND UV FIX FOR EXTRUDED WALLS ======
        let finalWallGeo = wallGeo.index ? wallGeo.toNonIndexed() : wallGeo.clone();
        finalWallGeo.clearGroups();
        const pos = finalWallGeo.attributes.position;
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
            const vBx = pos.getX(i + 1), vBy = pos.getY(i + 1), vBz = pos.getZ(i + 1);
            const vCx = pos.getX(i + 2), vCy = pos.getY(i + 2), vCz = pos.getZ(i + 2);

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
            if (absY > absX && absY > absZ) {
                groupIdx = ny > 0 ? 2 : 3;
            } else if (absX > absY && absX > absZ) {
                groupIdx = nx > 0 ? 0 : 1;
            } else {
                groupIdx = nz > 0 ? 4 : 5;
            }

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

        const skinFrontGeo = new THREE.ShapeGeometry(wallShape);
        skinFrontGeo.translate(0, 0, t / 2 + 0.1);
        shearGeo(skinFrontGeo);
        const hitFront = new THREE.Mesh(skinFrontGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.userData = { isWallSide: true, side: 'front', entity: w };

        const skinBackGeo = new THREE.ShapeGeometry(wallShape);
        skinBackGeo.translate(0, 0, -t / 2 - 0.1);
        shearGeo(skinBackGeo);
        const hitBack = new THREE.Mesh(skinBackGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitBack.userData = { isWallSide: true, side: 'back', entity: w };

        const extraHitboxes = [];
        if (startProfileLocal && startProfileLocal.length >= 2) {
            const startHitGeo = new THREE.BufferGeometry();
            const hitVerts = [];
            for (let i = 0; i < startProfileLocal.length - 1; i++) {
                const p1_p = startProfileLocal[i];
                const p2_p = startProfileLocal[i + 1];
                const dx_seg = p2_p.x - p1_p.x;
                const dz_seg = p2_p.z - p1_p.z;
                const segLen = Math.hypot(dx_seg, dz_seg);
                let nx = 0, nz = 0;
                if (segLen > 1e-6) {
                    nx = -dz_seg / segLen;
                    nz = dx_seg / segLen;
                }
                const off = 0.2;
                const p1x = p1_p.x + nx * off;
                const p1z = p1_p.z + nz * off;
                const p2x = p2_p.x + nx * off;
                const p2z = p2_p.z + nz * off;

                hitVerts.push(
                    p1x, wallBottom, p1z,
                    p2x, wallBottom, p2z,
                    p2x, maxH, p2z,
                    p1x, wallBottom, p1z,
                    p2x, maxH, p2z,
                    p1x, maxH, p1z
                );
            }
            startHitGeo.setAttribute('position', new THREE.Float32BufferAttribute(hitVerts, 3));
            startHitGeo.computeVertexNormals();
            const hitStart = new THREE.Mesh(startHitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitStart.userData = { isWallSide: true, side: 'left', entity: w };
            extraHitboxes.push(hitStart);
        }

        if (endProfileLocal && endProfileLocal.length >= 2) {
            const endHitGeo = new THREE.BufferGeometry();
            const hitVerts = [];
            for (let i = 0; i < endProfileLocal.length - 1; i++) {
                const p1_p = endProfileLocal[i];
                const p2_p = endProfileLocal[i + 1];
                const dx_seg = p2_p.x - p1_p.x;
                const dz_seg = p2_p.z - p1_p.z;
                const segLen = Math.hypot(dx_seg, dz_seg);
                let nx = 0, nz = 0;
                if (segLen > 1e-6) {
                    nx = dz_seg / segLen;
                    nz = -dx_seg / segLen;
                }
                const off = 0.2;
                const p1x = p1_p.x + nx * off;
                const p1z = p1_p.z + nz * off;
                const p2x = p2_p.x + nx * off;
                const p2z = p2_p.z + nz * off;

                hitVerts.push(
                    p1x, wallBottom, p1z,
                    p2x, wallBottom, p2z,
                    p2x, maxH, p2z,
                    p1x, wallBottom, p1z,
                    p2x, maxH, p2z,
                    p1x, maxH, p1z
                );
            }
            endHitGeo.setAttribute('position', new THREE.Float32BufferAttribute(hitVerts, 3));
            endHitGeo.computeVertexNormals();
            const hitEnd = new THREE.Mesh(endHitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitEnd.userData = { isWallSide: true, side: 'right', entity: w };
            extraHitboxes.push(hitEnd);
        }

        if (w.attachedMoldings) {
            w.attachedMoldings.forEach((mold) => {
                const mMesh = this.moldingBuilder.buildMolding(mold, length, t, ctx.helpers, w);
                mMesh.userData.entity = mold;
                mMesh.userData.moldData = mold;
                if (mMesh.isGroup && mMesh.children.length > 0) {
                    mMesh.children.forEach(c => {
                        if (c.geometry) shearGeo(c.geometry);
                    });
                } else if (mMesh.geometry) {
                    shearGeo(mMesh.geometry);
                }
                extraMeshes.push(mMesh);
                if (ctx.interactables) ctx.interactables.push(mMesh);
            });
        }

        wallGroup.add(wallMesh, hitFront, hitBack, ...extraHitboxes, ...extraMeshes);
        if (ctx.interactables) ctx.interactables.push(hitFront, hitBack, ...extraHitboxes);
        if (ctx.structureGroup) ctx.structureGroup.add(wallGroup);

        if (w.attachedDecor && ctx.decorManager) {
            w.attachedDecor.forEach(decor => ctx.decorManager.load(w, decor));
        }

        const extraInteractables = [hitFront, hitBack, ...extraHitboxes];
        return { wallGroup, wallMesh, wallGeo: finalWallGeo, extraInteractables, hitboxes: extraInteractables };
    }

    /**
     * Legacy & Static Level Wall Group Builder
     */
    buildStaticWallGroup(length, thickness, wallData, startX, startY, angle, wallHeight = WALL_HEIGHT, ctx = null) {
        const extraMeshes = [];
        const extraInteractables = [];
        const wallShape = this._createShape(length, wallData.attachedWidgets, wallHeight, thickness, extraMeshes, extraInteractables, wallData);
        const wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: thickness, bevelEnabled: false, steps: 12 });
        wallGeo.translate(0, 0, -thickness / 2);

        const startProfile = wallData.wallShapeData ? wallData.wallShapeData.startProfile : wallData.startProfile;
        const endProfile = wallData.wallShapeData ? wallData.wallShapeData.endProfile : wallData.endProfile;
        const pts = (wallData.poly && typeof wallData.poly.points === 'function') ? wallData.poly.points() : wallData.pts;
        const hasStartCap = wallData.wallShapeData?.hasStartCap ?? (wallData.startAnchor ? (wallData.startAnchor.connectedWalls ? wallData.startAnchor.connectedWalls.length <= 1 : true) : true);
        const hasEndCap = wallData.wallShapeData?.hasEndCap ?? (wallData.endAnchor ? (wallData.endAnchor.connectedWalls ? wallData.endAnchor.connectedWalls.length <= 1 : true) : true);

        const toLocal = (ptX, ptY) => {
            const dx = ptX - startX;
            const dy = ptY - startY;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return { x: dx * c + dy * s, z: -dx * s + dy * c };
        };

        let startProfileLocal = null;
        let endProfileLocal = null;

        if (!hasStartCap && startProfile && startProfile.length > 0) {
            startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
        } else if (!hasStartCap && pts && pts.length >= 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - startX;
                const dy_pt = ptY - startY;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            const sL_x = toLocalX(pts[0], pts[1]);
            const sR_x = toLocalX(pts[6], pts[7]);
            startProfileLocal = [{ x: sR_x, z: -thickness / 2 }, { x: sL_x, z: thickness / 2 }];
        } else {
            startProfileLocal = [{ x: 0, z: -thickness / 2 }, { x: 0, z: thickness / 2 }];
        }

        if (!hasEndCap && endProfile && endProfile.length > 0) {
            endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
        } else if (!hasEndCap && pts && pts.length >= 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - startX;
                const dy_pt = ptY - startY;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            const eL_x = toLocalX(pts[2], pts[3]);
            const eR_x = toLocalX(pts[4], pts[5]);
            endProfileLocal = [{ x: eR_x, z: -thickness / 2 }, { x: eL_x, z: thickness / 2 }];
        } else {
            endProfileLocal = [{ x: length, z: -thickness / 2 }, { x: length, z: thickness / 2 }];
        }

        const interpolateX = (profile, zTarget) => {
            if (!profile || profile.length === 0) return 0;
            if (profile.length === 1) return profile[0].x;
            if (zTarget <= profile[0].z) return profile[0].x;
            if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
            for (let i = 0; i < profile.length - 1; i++) {
                const pA = profile[i];
                const pB = profile[i + 1];
                if (zTarget >= pA.z && zTarget <= pB.z) {
                    const dz = pB.z - pA.z;
                    if (Math.abs(dz) < 1e-6) return pA.x;
                    const factor = (zTarget - pA.z) / dz;
                    return pA.x + factor * (pB.x - pA.x);
                }
            }
            return profile[profile.length - 1].x;
        };

        const shearGeo = (geo) => {
            const posAttr = geo.attributes.position;
            if (!posAttr) return;
            for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const z = posAttr.getZ(i);
                const sX = interpolateX(startProfileLocal, z);
                const eX = interpolateX(endProfileLocal, z);
                
                if (x <= 0.1) {
                    posAttr.setX(i, sX);
                } else if (x >= length - 0.1) {
                    posAttr.setX(i, eX);
                } else {
                    posAttr.setX(i, x);
                }
            }
            geo.computeVertexNormals();
            posAttr.needsUpdate = true;
        };
        shearGeo(wallGeo);

        let finalWallGeo = wallGeo.index ? wallGeo.toNonIndexed() : wallGeo.clone();
        finalWallGeo.clearGroups();
        const pos = finalWallGeo.attributes.position;
        let uvs = finalWallGeo.attributes.uv;
        if (!uvs || uvs.count !== pos.count) {
            uvs = new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2);
            finalWallGeo.setAttribute('uv', uvs);
        }

        finalWallGeo.computeVertexNormals();

        for (let i = 0; i < pos.count; i += 3) {
            const vAx = pos.getX(i), vAy = pos.getY(i), vAz = pos.getZ(i);
            const vBx = pos.getX(i + 1), vBy = pos.getY(i + 1), vBz = pos.getZ(i + 1);
            const vCx = pos.getX(i + 2), vCy = pos.getY(i + 2), vCz = pos.getZ(i + 2);

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
            if (absY > absX && absY > absZ) {
                groupIdx = ny > 0 ? 2 : 3;
            } else if (absX > absY && absX > absZ) {
                groupIdx = nx > 0 ? 0 : 1;
            } else {
                groupIdx = nz > 0 ? 4 : 5;
            }
            
            finalWallGeo.addGroup(i, 3, groupIdx);
            
            for (let vIdx = i; vIdx < i + 3; vIdx++) {
                const vx = pos.getX(vIdx), vy = pos.getY(vIdx), vz = pos.getZ(vIdx);
                if (groupIdx <= 1) uvs.setXY(vIdx, vz, vy);
                else if (groupIdx <= 3) uvs.setXY(vIdx, vx, vz);
                else uvs.setXY(vIdx, vx, vy);
            }
        }
        uvs.needsUpdate = true;

        let materials = [this.matMain, this.matMain, this.matMain, this.matMain, this.matMain, this.matMain];
        if (ctx && ctx.helpers && ctx.helpers.getFaceMaterials) {
            materials = ctx.helpers.getFaceMaterials(wallData, this.matMain, { width: length, height: wallHeight }).box;
        }

        const wallMesh = new THREE.Mesh(finalWallGeo, materials);
        wallMesh.castShadow = true; 
        wallMesh.receiveShadow = true;

        const wallGroup = new THREE.Group();
        wallGroup.position.set(startX, 0, startY);
        wallGroup.rotation.y = -angle;
        wallGroup.add(wallMesh, ...extraMeshes);

        return { wallGroup, wallMesh, wallGeo: finalWallGeo, extraInteractables };
    }

    createHitboxes(length, thickness, wallData, isStatic = false, levelIndex = 0, wallIndex = 0, wallHeight = WALL_HEIGHT, startX = 0, startY = 0, angle = 0) {
        const hitboxes = [];
        
        const baseShape = this._createShape(length, null, wallHeight, thickness, null, null, wallData);
        const skinGeoFront = new THREE.ShapeGeometry(baseShape);
        skinGeoFront.translate(0, 0, thickness / 2 + 0.1);

        const skinGeoBack = new THREE.ShapeGeometry(baseShape);
        skinGeoBack.translate(0, 0, -thickness / 2 - 0.1);

        const startProfile = wallData.wallShapeData ? wallData.wallShapeData.startProfile : wallData.startProfile;
        const endProfile = wallData.wallShapeData ? wallData.wallShapeData.endProfile : wallData.endProfile;
        const pts = (wallData.poly && typeof wallData.poly.points === 'function') ? wallData.poly.points() : wallData.pts;
        const hasStartCap = wallData.wallShapeData?.hasStartCap ?? (wallData.startAnchor ? (wallData.startAnchor.connectedWalls ? wallData.startAnchor.connectedWalls.length <= 1 : true) : true);
        const hasEndCap = wallData.wallShapeData?.hasEndCap ?? (wallData.endAnchor ? (wallData.endAnchor.connectedWalls ? wallData.endAnchor.connectedWalls.length <= 1 : true) : true);

        const toLocal = (ptX, ptY) => {
            const dx = ptX - startX;
            const dy = ptY - startY;
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return { x: dx * c + dy * s, z: -dx * s + dy * c };
        };

        let startProfileLocal = null;
        let endProfileLocal = null;

        if (!hasStartCap && startProfile && startProfile.length > 0) {
            startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
        } else if (!hasStartCap && pts && pts.length >= 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - startX;
                const dy_pt = ptY - startY;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            const sL_x = toLocalX(pts[0], pts[1]);
            const sR_x = toLocalX(pts[6], pts[7]);
            startProfileLocal = [{ x: sR_x, z: -thickness / 2 }, { x: sL_x, z: thickness / 2 }];
        } else {
            startProfileLocal = [{ x: 0, z: -thickness / 2 }, { x: 0, z: thickness / 2 }];
        }

        if (!hasEndCap && endProfile && endProfile.length > 0) {
            endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a, b) => a.z - b.z);
        } else if (!hasEndCap && pts && pts.length >= 8) {
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - startX;
                const dy_pt = ptY - startY;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            const eL_x = toLocalX(pts[2], pts[3]);
            const eR_x = toLocalX(pts[4], pts[5]);
            endProfileLocal = [{ x: eR_x, z: -thickness / 2 }, { x: eL_x, z: thickness / 2 }];
        } else {
            endProfileLocal = [{ x: length, z: -thickness / 2 }, { x: length, z: thickness / 2 }];
        }

        const interpolateX = (profile, zTarget) => {
            if (!profile || profile.length === 0) return 0;
            if (profile.length === 1) return profile[0].x;
            if (zTarget <= profile[0].z) return profile[0].x;
            if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
            for (let i = 0; i < profile.length - 1; i++) {
                const pA = profile[i];
                const pB = profile[i + 1];
                if (zTarget >= pA.z && zTarget <= pB.z) {
                    const dz = pB.z - pA.z;
                    if (Math.abs(dz) < 1e-6) return pA.x;
                    const factor = (zTarget - pA.z) / dz;
                    return pA.x + factor * (pB.x - pA.x);
                }
            }
            return profile[profile.length - 1].x;
        };

        const shearGeo = (geo) => {
            const posAttr = geo.attributes.position;
            if (!posAttr) return;
            for (let i = 0; i < posAttr.count; i++) {
                const x = posAttr.getX(i);
                const z = posAttr.getZ(i);
                const sX = interpolateX(startProfileLocal, z);
                const eX = interpolateX(endProfileLocal, z);
                
                if (x <= 0.1) {
                    posAttr.setX(i, sX);
                } else if (x >= length - 0.1) {
                    posAttr.setX(i, eX);
                } else {
                    posAttr.setX(i, x);
                }
            }
            geo.computeVertexNormals();
            posAttr.needsUpdate = true;
        };
        shearGeo(skinGeoFront);
        shearGeo(skinGeoBack);

        const hitFront = new THREE.Mesh(skinGeoFront, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitFront.userData = { isWallSide: true, side: 'front', entity: wallData };

        const hitBack = new THREE.Mesh(skinGeoBack, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
        hitBack.userData = { isWallSide: true, side: 'back', entity: wallData };

        const extraHitboxes = [];
        if (startProfileLocal && startProfileLocal.length >= 2) {
            const startHitGeo = new THREE.BufferGeometry();
            const hitVerts = [];
            for (let i = 0; i < startProfileLocal.length - 1; i++) {
                const p1_p = startProfileLocal[i];
                const p2_p = startProfileLocal[i + 1];
                const dx_seg = p2_p.x - p1_p.x;
                const dz_seg = p2_p.z - p1_p.z;
                const segLen = Math.hypot(dx_seg, dz_seg);
                let nx = 0, nz = 0;
                if (segLen > 1e-6) {
                    nx = -dz_seg / segLen;
                    nz = dx_seg / segLen;
                }
                const off = 0.2;
                const p1x = p1_p.x + nx * off;
                const p1z = p1_p.z + nz * off;
                const p2x = p2_p.x + nx * off;
                const p2z = p2_p.z + nz * off;

                hitVerts.push(
                    p1x, 0, p1z,
                    p2x, 0, p2z,
                    p2x, wallHeight, p2z,
                    p1x, 0, p1z,
                    p2x, wallHeight, p2z,
                    p1x, wallHeight, p1z
                );
            }
            startHitGeo.setAttribute('position', new THREE.Float32BufferAttribute(hitVerts, 3));
            startHitGeo.computeVertexNormals();
            const hitStart = new THREE.Mesh(startHitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitStart.userData = { isWallSide: true, side: 'left', entity: wallData };
            extraHitboxes.push(hitStart);
        }

        if (endProfileLocal && endProfileLocal.length >= 2) {
            const endHitGeo = new THREE.BufferGeometry();
            const hitVerts = [];
            for (let i = 0; i < endProfileLocal.length - 1; i++) {
                const p1_p = endProfileLocal[i];
                const p2_p = endProfileLocal[i + 1];
                const dx_seg = p2_p.x - p1_p.x;
                const dz_seg = p2_p.z - p1_p.z;
                const segLen = Math.hypot(dx_seg, dz_seg);
                let nx = 0, nz = 0;
                if (segLen > 1e-6) {
                    nx = dz_seg / segLen;
                    nz = -dx_seg / segLen;
                }
                const off = 0.2;
                const p1x = p1_p.x + nx * off;
                const p1z = p1_p.z + nz * off;
                const p2x = p2_p.x + nx * off;
                const p2z = p2_p.z + nz * off;

                hitVerts.push(
                    p1x, 0, p1z,
                    p2x, 0, p2z,
                    p2x, wallHeight, p2z,
                    p1x, 0, p1z,
                    p2x, wallHeight, p2z,
                    p1x, wallHeight, p1z
                );
            }
            endHitGeo.setAttribute('position', new THREE.Float32BufferAttribute(hitVerts, 3));
            endHitGeo.computeVertexNormals();
            const hitEnd = new THREE.Mesh(endHitGeo, new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide }));
            hitEnd.userData = { isWallSide: true, side: 'right', entity: wallData };
            extraHitboxes.push(hitEnd);
        }

        hitboxes.push(hitFront, hitBack, ...extraHitboxes);

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

    _createShape(length, widgets, wallHeight = WALL_HEIGHT, thickness = 20, extraMeshes = null, extraInteractables = null, wallData = {}) {
        const wallBottom = -1;
        const wallShape = new THREE.Shape();
        
        const type = wallData.topProfileType || 'normal';
        const startH = wallData.startHeight !== undefined ? wallData.startHeight : wallHeight;
        const endH = wallData.endHeight !== undefined ? wallData.endHeight : wallHeight;
        const peakH = wallData.peakHeight !== undefined ? wallData.peakHeight : wallHeight;
        const maxH = Math.max(startH, endH, peakH, wallHeight);

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
            wallShape.lineTo(length, wallHeight);
            wallShape.lineTo(0, wallHeight);
        }
        wallShape.lineTo(0, wallBottom);

        if (!widgets) return wallShape;

        widgets.forEach(widg => {
            const hole = new THREE.Path();
            const wCenter = length * widg.t; 
            const halfW = widg.width / 2;
            const wType = widg.type || widg.configId; 
            
            if (wType === 'elevation_fascia' || wType === 'niche_recess' || wType === 'solid_protrusion') return;
            
            let h_opening = widg.height;
            if (h_opening === undefined) h_opening = (wType === 'door' || wType === 'arch_opening' || wType === 'opening') ? DOOR_HEIGHT : ((wType === 'window') ? WINDOW_HEIGHT : 60);
            let elev = widg.elevation;
            if (elev === undefined) elev = (wType === 'window') ? WINDOW_SILL : 0;
            
            let cutElev = (elev <= 0.1) ? wallBottom : elev;
            elev = Math.max(0, Math.min(elev, maxH));
            h_opening = Math.max(0, Math.min(h_opening, maxH - elev));

            const xMin = wCenter - halfW;
            const xMax = wCenter + halfW;
            const yMax = elev + h_opening;
            const yMid = elev + h_opening / 2;

            const shapeType = widg.doorShape || widg.windowShape || widg.params?.doorShape || widg.params?.windowShape || widg.config?.doorShape || widg.config?.windowShape || widg.shape || (widg.configId === 'entry_arched_double' || wType === 'arch_opening' ? 'radius' : 'square');

            if (shapeType === 'radius' || shapeType === 'arch' || shapeType === 'arched' || wType === 'arch_opening') {
                const radius = halfW;
                const straightH = Math.max(0, h_opening - radius);
                hole.moveTo(xMin, cutElev);
                hole.lineTo(xMax, cutElev);
                hole.lineTo(xMax, elev + straightH);
                if (radius > 0) hole.absarc(wCenter, elev + straightH, radius, 0, Math.PI, false);
                else hole.lineTo(xMin, elev + straightH);
                hole.lineTo(xMin, cutElev);
            } else if (shapeType === 'segment') {
                const rise = widg.width * 0.15;
                const straightH = Math.max(0, h_opening - rise);
                hole.moveTo(xMin, cutElev);
                hole.lineTo(xMax, cutElev);
                hole.lineTo(xMax, elev + straightH);
                hole.quadraticCurveTo(wCenter, elev + h_opening + rise * 0.5, xMin, elev + straightH);
                hole.lineTo(xMin, cutElev);
            } else if (shapeType === 'gothic') {
                const straightH = Math.max(0, h_opening - (widg.width * 0.7));
                hole.moveTo(xMin, cutElev);
                hole.lineTo(xMax, cutElev);
                hole.lineTo(xMax, elev + straightH);
                hole.quadraticCurveTo(wCenter + halfW * 0.2, elev + h_opening, wCenter, elev + h_opening);
                hole.quadraticCurveTo(wCenter - halfW * 0.2, elev + h_opening, xMin, elev + straightH);
                hole.lineTo(xMin, cutElev);
            } else if (wType === 'circular_opening') {
                hole.moveTo(xMax, yMid);
                hole.absellipse(wCenter, yMid, halfW, h_opening / 2, 0, Math.PI * 2, false, 0);
            } else if (wType === 'custom_shape_opening') {
                hole.moveTo(wCenter, cutElev);
                hole.lineTo(xMax, yMid);
                hole.lineTo(wCenter, yMax);
                hole.lineTo(xMin, yMid);
                hole.lineTo(wCenter, cutElev);
            } else {
                hole.moveTo(xMin, cutElev); 
                hole.lineTo(xMax, cutElev); 
                hole.lineTo(xMax, yMax); 
                hole.lineTo(xMin, yMax); 
                hole.lineTo(xMin, cutElev);
            }
            wallShape.holes.push(hole);

            if (extraMeshes && ['arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(wType)) {
                const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, thickness + 4);
                hitBoxGeo.translate(0, h_opening / 2, 0);
                const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                hitBox.userData = { isHitbox: true };
                
                const group = new THREE.Group();
                group.position.set(wCenter, elev, 0);
                group.userData = { isPattern: true, entity: widg };
                widg.patternMesh3D = group;

                if (wType === 'pattern_opening') {
                    const patternShape = new THREE.Shape();
                    patternShape.moveTo(-halfW, 0);
                    patternShape.lineTo(halfW, 0);
                    patternShape.lineTo(halfW, h_opening);
                    patternShape.lineTo(-halfW, h_opening);
                    patternShape.lineTo(-halfW, 0);

                    const rows = widg.rows || 4, cols = widg.cols || 4, spacing = widg.spacing !== undefined ? widg.spacing : 5;
                    const style = widg.patternStyle || 'grid';
                    const pW = (widg.width - spacing * (cols + 1)) / cols;
                    const pH = (h_opening - spacing * (rows + 1)) / rows;
                    if (pW > 0 && pH > 0) {
                        for (let r = 0; r < rows; r++) {
                            for (let c = 0; c < cols; c++) {
                                const px = -halfW + spacing + c * (pW + spacing);
                                const py = spacing + r * (pH + spacing);
                                const pPath = new THREE.Path();
                                const cx = px + pW / 2, cy = py + pH / 2;
                                if (style === 'diamond') {
                                    pPath.moveTo(cx, py); pPath.lineTo(px + pW, cy); pPath.lineTo(cx, py + pH); pPath.lineTo(px, cy); pPath.lineTo(cx, py);
                                } else if (style === 'circle') {
                                    pPath.moveTo(cx + Math.min(pW, pH) / 2, cy); pPath.absarc(cx, cy, Math.min(pW, pH) / 2, 0, Math.PI * 2, false);
                                } else if (style === 'cross') {
                                    const w1 = pW * 0.2, h1 = pH * 0.8, w2 = pW * 0.8, h2 = pH * 0.2;
                                    pPath.moveTo(cx - w1 / 2, cy - h1 / 2); pPath.lineTo(cx + w1 / 2, cy - h1 / 2); pPath.lineTo(cx + w1 / 2, cy - h2 / 2); pPath.lineTo(cx + w2 / 2, cy - h2 / 2); pPath.lineTo(cx + w2 / 2, cy + h2 / 2); pPath.lineTo(cx + w1 / 2, cy + h2 / 2); pPath.lineTo(cx + w1 / 2, cy + h1 / 2); pPath.lineTo(cx - w1 / 2, cy + h1 / 2); pPath.lineTo(cx - w1 / 2, cy + h2 / 2); pPath.lineTo(cx - w2 / 2, cy + h2 / 2); pPath.lineTo(cx - w2 / 2, cy - h2 / 2); pPath.lineTo(cx - w1 / 2, cy - h2 / 2); pPath.lineTo(cx - w1 / 2, cy - h1 / 2);
                                } else if (style === 'hexagon') {
                                    const rad = Math.min(pW, pH) / 2; for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; const hx = cx + rad * Math.cos(a), hy = cy + rad * Math.sin(a); if (i === 0) pPath.moveTo(hx, hy); else pPath.lineTo(hx, hy); } pPath.lineTo(cx + rad, cy);
                                } else if (style === 'star') {
                                    const rOut = Math.min(pW, pH) / 2, rIn = rOut * 0.3; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; const rad = i % 2 === 0 ? rOut : rIn; const sx = cx + rad * Math.cos(a), sy = cy + rad * Math.sin(a); if (i === 0) pPath.moveTo(sx, sy); else pPath.lineTo(sx, sy); } pPath.lineTo(cx + rOut, cy);
                                } else if (style === 'slit') {
                                    const slitW = pW * 0.3, slitH = pH * 0.9; pPath.moveTo(cx - slitW / 2, cy - slitH / 2); pPath.lineTo(cx + slitW / 2, cy - slitH / 2); pPath.lineTo(cx + slitW / 2, cy + slitH / 2); pPath.lineTo(cx - slitW / 2, cy + slitH / 2); pPath.lineTo(cx - slitW / 2, cy - slitH / 2);
                                } else if (style === 'terracotta') {
                                    const pr = Math.min(pW, pH) / 4; pPath.moveTo(cx + pr, cy - pr); pPath.absarc(cx + pr, cy, pr, -Math.PI / 2, Math.PI / 2, false); pPath.absarc(cx, cy + pr, pr, 0, Math.PI, false); pPath.absarc(cx - pr, cy, pr, Math.PI / 2, 3 * Math.PI / 2, false); pPath.absarc(cx, cy - pr, pr, Math.PI, 2 * Math.PI, false);
                                } else if (style === 'arabesque') {
                                    const rOut = Math.min(pW, pH) / 2, rIn = rOut * 0.55; for (let i = 0; i < 16; i++) { const a = (i * Math.PI) / 8; const rad = i % 2 === 0 ? rOut : rIn; const sx = cx + rad * Math.cos(a), sy = cy + rad * Math.sin(a); if (i === 0) pPath.moveTo(sx, sy); else pPath.lineTo(sx, sy); }
                                } else {
                                    pPath.moveTo(px, py); pPath.lineTo(px + pW, py); pPath.lineTo(px + pW, py + pH); pPath.lineTo(px, py + pH); pPath.lineTo(px, py);
                                }
                                pPath.closePath();
                                patternShape.holes.push(pPath);
                            }
                        }
                    }

                    const patternGeo = new THREE.ExtrudeGeometry(patternShape, { depth: thickness, bevelEnabled: false });
                    patternGeo.translate(0, 0, -thickness / 2);
                    const patternMat = this.matMain.clone();
                    const patternMesh = new THREE.Mesh(patternGeo, patternMat);
                    patternMesh.castShadow = true; patternMesh.receiveShadow = true;
                    
                    const hitBoxGeo = new THREE.BoxGeometry(widg.width, h_opening, thickness + 4);
                    hitBoxGeo.translate(wCenter, elev + h_opening / 2, 0);
                    const hitBox = new THREE.Mesh(hitBoxGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
                    hitBox.userData = { isHitbox: true };
                    
                    const patternGroup = new THREE.Group();
                    patternGroup.add(patternMesh, hitBox);
                    patternGroup.userData = { isPattern: true, entity: widg };
                    widg.patternMesh3D = patternGroup;
                    widg.patternMat3D = patternMat;
                    
                    extraMeshes.push(patternGroup);
                    if (extraInteractables) extraInteractables.push(hitBox);
                }
                
                if (wType === 'niche_recess') {
                    const depth = widg.depth || 10;
                    const recessThickness = Math.max(0.5, thickness - depth);
                    const nicheGeo = new THREE.BoxGeometry(widg.width, h_opening, recessThickness);
                    const zOffset = (widg.facing === -1) ? (thickness / 2 - recessThickness / 2) : (-thickness / 2 + recessThickness / 2);
                    nicheGeo.translate(wCenter, elev + h_opening / 2, zOffset);
                    const nicheMesh = new THREE.Mesh(nicheGeo, this.matMain);
                    nicheMesh.castShadow = true; nicheMesh.receiveShadow = true;
                    extraMeshes.push(nicheMesh);
                }
            }
        });
        return wallShape;
    }
}