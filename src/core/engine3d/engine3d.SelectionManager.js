import * as THREE from 'three';

export class SelectionManager {
    constructor(ctx, interactionSystem) {
        this.ctx = ctx;
        this.system = interactionSystem;
    }

    select(object) {
        if (object.userData.isWallSide) {
            return this.selectWall(object);
        } else if (object.userData.isFurniture || object.userData.isWallDecor || object.userData.isFloor || object.userData.isWidget || object.userData.isMolding || object.userData.isRoof || object.userData.isPattern || object.userData.isStair || object.userData.isFloorCutProxy) {
            return this.selectBasic(object);
        } else {
            if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
            return null;
        }
    }

    selectWall(object) {
        const type = 'wall'; 
        const side = object.userData.side;
        const wallGroup = object.parent;
        const w = wallGroup.userData.entity;
        
        wallGroup.add(this.system.wallHighlight);
        
        let maxDepth = 0;
        if (w.attachedDecor) w.attachedDecor.forEach(d => { if (d.side === side && d.depth > maxDepth) maxDepth = d.depth; });
        
        const isRailing = w.type === 'railing';
        let currentH = w.height !== undefined ? w.height : (w.config?.height || (isRailing ? 0 : 300));
        
        if (isRailing && this.ctx.planner) {
            const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
            const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
            const midX = (p1.x + p2.x) / 2, midY = (p1.y + p2.y) / 2;
            let foundSupport = false;
            for (let sw of this.ctx.planner.walls) {
                if (sw.type === 'railing') continue;
                const sp1 = sw.startAnchor ? sw.startAnchor.position() : {x: sw.startX, y: sw.startY};
                const sp2 = sw.endAnchor ? sw.endAnchor.position() : {x: sw.endX, y: sw.endY};
                const C = sp2.x - sp1.x, D = sp2.y - sp1.y;
                const lenSq = C * C + D * D;
                if (lenSq !== 0) {
                    const param = Math.max(0, Math.min(1, ((midX - sp1.x)*C + (midY - sp1.y)*D)/lenSq));
                    if (Math.hypot(midX - (sp1.x + param*C), midY - (sp1.y + param*D)) < 5) {
                        currentH = sw.height !== undefined ? sw.height : (sw.config?.height || 300);
                        foundSupport = true;
                        break;
                    }
                }
            }

            if (!foundSupport && this.ctx.planner.shapes) {
                for (let s of this.ctx.planner.shapes) {
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
                                currentH = s.params.height3D !== undefined ? s.params.height3D : 100;
                                foundSupport = true;
                                break;
                            }
                        }
                    }
                    if (foundSupport) break;
                }
            }
        }

        const currentT = w.thickness !== undefined ? w.thickness : (w.config?.thickness || (isRailing ? 4 : 8));
        const totalH = isRailing ? currentH + 40 : currentH;
        
        const profileType = w.topProfileType || 'normal';
        const startH = w.startHeight !== undefined ? w.startHeight : totalH;
        const endH = w.endHeight !== undefined ? w.endHeight : totalH;
        const peakH = w.peakHeight !== undefined ? w.peakHeight : totalH;

        const hlWidth = w.length3D + (maxDepth * 2) + 0.5;
        const hlHeight = totalH + 0.5;
        const halfW = hlWidth / 2;

        const shape = new THREE.Shape();
        shape.moveTo(-halfW, -hlHeight/2);
        shape.lineTo(halfW, -hlHeight/2);
        
        if (profileType === 'single') {
            shape.lineTo(halfW, endH - (totalH/2) + 0.5);
            shape.lineTo(-halfW, startH - (totalH/2) + 0.5);
        } else if (profileType === 'gable') {
            shape.lineTo(halfW, endH - (totalH/2) + 0.5);
            shape.lineTo(0, peakH - (totalH/2) + 0.5);
            shape.lineTo(-halfW, startH - (totalH/2) + 0.5);
        } else {
            shape.lineTo(halfW, hlHeight/2);
            shape.lineTo(-halfW, hlHeight/2);
        }
        shape.lineTo(-halfW, -hlHeight/2);

        w.attachedWidgets.forEach(widg => {
            const type = widg.type || widg.configId;
            const isOpening = ['door', 'window', 'jali_panel', 'arch_opening', 'circular_opening', 'custom_shape_opening', 'pattern_opening', 'boolean_cut', 'niche_recess'].includes(type);
            if (!isOpening) return;

            const wCenter = w.length3D * widg.t; const halfW = widg.width / 2; const cx = w.length3D / 2; const cy = totalH / 2;
            const hx_min = (wCenter - halfW) - cx; const hx_max = (wCenter + halfW) - cx;
            
            let elev = widg.elevation; if (elev === undefined) elev = (type === 'window') ? 35 : 0;
            let h_opening = widg.height; if (h_opening === undefined) h_opening = (type === 'door') ? 80 : ((type === 'window') ? 45 : 200);
            elev = Math.max(0, Math.min(elev, currentH));
            h_opening = Math.max(0, Math.min(h_opening, currentH - elev));
            const w_y_min = elev; const w_y_max = elev + h_opening;

            if (w_y_max > w_y_min) {
                const hy_min = w_y_min - cy; const hy_max = w_y_max - cy;
                const hole = new THREE.Path();
                const hCenter = wCenter - cx;
                
                if (type === 'arch_opening') {
                    const radius = halfW;
                    const straightH = Math.max(0, (hy_max - hy_min) - radius);
                    hole.moveTo(hx_min, hy_min);
                    hole.lineTo(hx_max, hy_min);
                    hole.lineTo(hx_max, hy_min + straightH);
                    if (radius > 0) hole.absarc(hCenter, hy_min + straightH, radius, 0, Math.PI, false);
                    hole.lineTo(hx_min, hy_min);
                    shape.holes.push(hole);
                } else if (type === 'circular_opening') {
                    hole.moveTo(hx_max, hy_min + (hy_max - hy_min)/2);
                    hole.absellipse(hCenter, hy_min + (hy_max - hy_min)/2, halfW, (hy_max - hy_min)/2, 0, Math.PI * 2, false, 0);
                    shape.holes.push(hole);
                } else if (type === 'custom_shape_opening') {
                    hole.moveTo(hCenter, hy_min);
                    hole.lineTo(hx_max, hy_min + (hy_max - hy_min)/2);
                    hole.lineTo(hCenter, hy_max);
                    hole.lineTo(hx_min, hy_min + (hy_max - hy_min)/2);
                    hole.lineTo(hCenter, hy_min);
                    shape.holes.push(hole);
                } else {
                    hole.moveTo(hx_min, hy_min); hole.lineTo(hx_max, hy_min); hole.lineTo(hx_max, hy_max); hole.lineTo(hx_min, hy_max); hole.lineTo(hx_min, hy_min);
                    shape.holes.push(hole);
                }
            }
        });

        this.system.wallHighlight.geometry.dispose();
        this.system.wallHighlight.geometry = new THREE.ShapeGeometry(shape);
        this.system.wallHighlight.scale.set(1, 1, 1);

        const zOffset = side === 'front' ? (currentT / 2 + maxDepth + 0.15) : (-currentT / 2 - maxDepth - 0.15);
        
        // ====== MITER JOINT SHEARING FOR HIGHLIGHT ======
        const startProfile = w.wallShapeData ? w.wallShapeData.startProfile : w.startProfile;
        const endProfile = w.wallShapeData ? w.wallShapeData.endProfile : w.endProfile;
        const pts = (w.poly && typeof w.poly.points === 'function') ? w.poly.points() : w.pts;
        
        if (startProfile && endProfile && !isRailing) {
            const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
            const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            const toLocal = (ptX, ptY) => {
                const dx = ptX - p1.x; const dy = ptY - p1.y;
                const c = Math.cos(angle); const s = Math.sin(angle);
                return { x: dx * c + dy * s, z: -dx * s + dy * c };
            };
            const startProfileLocal = startProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);
            const endProfileLocal = endProfile.map(p => toLocal(p.x, p.y)).sort((a,b) => a.z - b.z);

            const interpolateX = (profile, zTarget) => {
                if (profile.length === 1) return profile[0].x;
                if (zTarget <= profile[0].z) return profile[0].x;
                if (zTarget >= profile[profile.length - 1].z) return profile[profile.length - 1].x;
                for (let j = 0; j < profile.length - 1; j++) {
                    const pr1 = profile[j]; const pr2 = profile[j+1];
                    if (zTarget >= pr1.z && zTarget <= pr2.z) {
                        if (pr2.z === pr1.z) return pr1.x;
                        const tr = (zTarget - pr1.z) / (pr2.z - pr1.z);
                        return pr1.x + tr * (pr2.x - pr1.x);
                    }
                }
                return profile[0].x;
            };

            const pos = this.system.wallHighlight.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const wallX = (w.length3D / 2) + vx; 
                
                const startX = interpolateX(startProfileLocal, zOffset);
                const endX = interpolateX(endProfileLocal, zOffset);
                
                let shearedWallX = wallX;
                if (wallX <= 0.1) {
                    shearedWallX = startX;
                } else if (wallX >= w.length3D - 0.1) {
                    shearedWallX = endX;
                }
                
                pos.setX(i, shearedWallX - w.length3D / 2);
            }
            this.system.wallHighlight.geometry.computeVertexNormals();
            this.system.wallHighlight.geometry.computeBoundingBox();
            this.system.wallHighlight.geometry.computeBoundingSphere();
        } else if (pts && pts.length === 8 && !isRailing) {
            const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
            const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            const toLocalX = (ptX, ptY) => {
                const dx_pt = ptX - p1.x;
                const dy_pt = ptY - p1.y;
                return dx_pt * Math.cos(angle) + dy_pt * Math.sin(angle);
            };
            const localSL_x = toLocalX(pts[0], pts[1]);
            const localEL_x = toLocalX(pts[2], pts[3]);
            const localER_x = toLocalX(pts[4], pts[5]);
            const localSR_x = toLocalX(pts[6], pts[7]);
            
            const pos = this.system.wallHighlight.geometry.attributes.position;
            for (let i = 0; i < pos.count; i++) {
                const vx = pos.getX(i);
                const wallX = (w.length3D / 2) + vx; 
                const tZ = (zOffset + currentT/2) / currentT;
                const startX = localSR_x + tZ * (localSL_x - localSR_x);
                const endX = localER_x + tZ * (localEL_x - localER_x);
                
                let shearedWallX = wallX;
                if (wallX <= 0.1) {
                    shearedWallX = startX;
                } else if (wallX >= w.length3D - 0.1) {
                    shearedWallX = endX;
                }
                
                pos.setX(i, shearedWallX - w.length3D / 2);
            }
            this.system.wallHighlight.geometry.computeVertexNormals();
            this.system.wallHighlight.geometry.computeBoundingBox();
            this.system.wallHighlight.geometry.computeBoundingSphere();
        }
        
        if (isRailing) {
            const p1 = w.startAnchor ? w.startAnchor.position() : {x: w.startX, y: w.startY};
            const p2 = w.endAnchor ? w.endAnchor.position() : {x: w.endX, y: w.endY};
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            
            this.system.wallHighlight.position.set(p1.x, totalH / 2, p1.y);
            this.system.wallHighlight.rotation.set(0, -angle, 0);
            this.system.wallHighlight.translateX(w.length3D / 2);
            this.system.wallHighlight.translateZ(zOffset);
        } else {
            this.system.wallHighlight.position.set(w.length3D / 2, totalH / 2, zOffset);
            this.system.wallHighlight.rotation.set(0, 0, 0); 
        }
        this.system.wallHighlight.visible = true;
        if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
        
        return { type, side };
    }

    selectBasic(object) {
        let type = null;
        if (object.userData.isShape || object.userData.isFloorCutProxy) type = 'shape';
        else if (object.userData.isFurniture) type = 'furniture';
        else if (object.userData.isWallDecor) type = 'wallDecor';
        else if (object.userData.isFloor) type = 'room';
        else if (object.userData.isWidget) type = 'widget';
        else if (object.userData.isMolding) type = 'molding';
        else if (object.userData.isRoof) type = 'roof';
        else if (object.userData.isPattern) type = 'advance_openings';
        else if (object.userData.isStair) type = 'stair';
        
        this.system.setHighlight(object, true);
            
        if (['furniture', 'shape', 'widget', 'molding', 'advance_openings', 'wallDecor', 'roof', 'stair'].includes(type)) {
            if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(true);
            if (object.userData.isFloorCutProxy && this.ctx.setTransformMode) {
                this.ctx.setTransformMode('polygon_edges', true);
            }
        } else {
            if (this.ctx.showTransformMenu) this.ctx.showTransformMenu(false);
        }
        
        return { type, side: null };
    }
}
