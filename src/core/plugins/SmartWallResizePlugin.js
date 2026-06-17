export const SmartWallResizePlugin = {
    id: 'smart_wall_resize',
    name: 'Smart Wall Resize',
    description: 'Advanced Adaptive Engine: Intelligently redesigns interior/exterior layouts, preserving room connectivity, circulation, and object scale.',
    
    getFields: (context) => {
        const planner = context.planner?.value;
        const floorPlanSettings = context.floorPlanSettings?.value;
        
        let wallTrackingDefault = true;
        if (floorPlanSettings && floorPlanSettings.wallTracking !== undefined) {
            wallTrackingDefault = floorPlanSettings.wallTracking;
        }

        let currentWidthFt = 40.0;
        let currentDepthFt = 25.0;

        if (planner && planner.anchors && planner.anchors.length > 0) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            planner.anchors.forEach(a => {
                minX = Math.min(minX, a.x);
                maxX = Math.max(maxX, a.x);
                minY = Math.min(minY, a.y);
                maxY = Math.max(maxY, a.y);
            });
            
            const pxToFt = 1 / 20;
            const calcW = ((maxX - minX) * pxToFt);
            const calcD = ((maxY - minY) * pxToFt);

            if (calcW > 0 && calcD > 0) {
                currentWidthFt = parseFloat(calcW.toFixed(1));
                currentDepthFt = parseFloat(calcD.toFixed(1));
            }
        }
        
        const currentSqFt = Math.round(currentWidthFt * currentDepthFt);

        return [
            {
                name: '_visual',
                label: '',
                type: 'visual_boundary',
                defaultValue: { targetN: currentWidthFt, targetS: currentWidthFt, targetE: currentDepthFt, targetW: currentDepthFt, targetSqft: currentSqFt }
            },
            {
                name: 'enableWallTracking',
                label: 'Wall Tracking',
                type: 'checkbox',
                defaultValue: wallTrackingDefault
            }
        ];
    },

    validate: async (config, context) => {
        const n = parseFloat(config.targetN);
        const s = parseFloat(config.targetS);
        const e = parseFloat(config.targetE);
        const w = parseFloat(config.targetW);
        if (!n || !s || !e || !w || n <= 0 || s <= 0 || e <= 0 || w <= 0) {
            return { success: false, error: 'All 4 boundary measurements must be positive valid numbers.' };
        }
        return { success: true };
    },

    execute: async (config, context) => {
        const { planner, syncSettings, floorPlanSettings } = context;
        if (!planner.value || planner.value.anchors.length === 0) return { success: true };

        // Advanced Adaptive Redesign Engine
        class AdaptiveArchitectureEngine {
            constructor(plan, config) {
                this.planner = plan;
                this.config = config;
                this.ftToPx = 20;
                
                this.targetN = parseFloat(config.targetN) * this.ftToPx;
                this.targetS = parseFloat(config.targetS) * this.ftToPx;
                this.targetE = parseFloat(config.targetE) * this.ftToPx;
                this.targetW = parseFloat(config.targetW) * this.ftToPx;

                this.bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
                this.objectConstraints = new Map();
                
                // Original matrix to map points globally if wall attachment isn't found
                this.matrix = null;
            }

            run() {
                this.phase1_analyzeArchitecture();
                if (this.bounds.currentW === 0 || this.bounds.currentD === 0) return;
                
                this.phase2_calculateDeformationMatrix();
                this.phase3_rebalanceStructuralNodes();
                this.phase4_smartRelocateObjects();
                this.phase5_adaptStaircases();
                this.phase6_finalizeRedesign();
            }

            phase1_analyzeArchitecture() {
                // Determine existing footprint and hierarchy
                this.planner.anchors.forEach(a => {
                    this.bounds.minX = Math.min(this.bounds.minX, a.x);
                    this.bounds.maxX = Math.max(this.bounds.maxX, a.x);
                    this.bounds.minY = Math.min(this.bounds.minY, a.y);
                    this.bounds.maxY = Math.max(this.bounds.maxY, a.y);
                });

                this.bounds.currentW = this.bounds.maxX - this.bounds.minX;
                this.bounds.currentD = this.bounds.maxY - this.bounds.minY;
                this.bounds.cx = this.bounds.minX + this.bounds.currentW / 2;
                this.bounds.cy = this.bounds.minY + this.bounds.currentD / 2;

                const cacheConstraint = (obj, pos, rotation, isStairPathNode = false) => {
                    if (!pos) return;
                    let constraint = { origPos: { ...pos }, origRot: rotation || 0, isStairPathNode };
                    
                    if (this.planner.walls && this.planner.walls.length > 0) {
                        let minDist = Infinity;
                        let bestWall = null;
                        
                        this.planner.walls.forEach(w => {
                            if (!w.startAnchor || !w.endAnchor) return;
                            const A = w.startAnchor.position ? w.startAnchor.position() : w.startAnchor;
                            const B = w.endAnchor.position ? w.endAnchor.position() : w.endAnchor;
                            
                            const dx = B.x - A.x;
                            const dy = B.y - A.y;
                            const lenSq = dx * dx + dy * dy;
                            
                            let t = 0;
                            if (lenSq !== 0) {
                                t = ((pos.x - A.x) * dx + (pos.y - A.y) * dy) / lenSq;
                                t = Math.max(0, Math.min(1, t));
                            }
                            
                            const projX = A.x + t * dx;
                            const projY = A.y + t * dy;
                            
                            const distSq = (pos.x - projX) ** 2 + (pos.y - projY) ** 2;
                            if (distSq < minDist) {
                                minDist = distSq;
                                const wallAngle = Math.atan2(dy, dx);
                                
                                const len = Math.sqrt(lenSq);
                                const dirX = len > 0 ? dx / len : 0;
                                const dirY = len > 0 ? dy / len : 0;
                                
                                const vX = pos.x - projX;
                                const vY = pos.y - projY;
                                
                                // Local perpendicular distance (positive = right side of wall vector, negative = left side)
                                const localY = vX * (-dirY) + vY * dirX;
                                
                                // Normalized position along wall length
                                const tNorm = t; 
                                
                                let relAngle = constraint.origRot - (wallAngle * 180 / Math.PI);
                                
                                bestWall = {
                                    wall: w,
                                    t: tNorm,
                                    localY: localY,
                                    relAngle: relAngle,
                                    wallAngle: wallAngle * 180 / Math.PI
                                };
                            }
                        });
                        
                        if (bestWall) {
                            constraint.nearestWall = bestWall;
                        }
                    }
                    
                    this.objectConstraints.set(obj, constraint);
                };

                if (this.planner.furniture) {
                    this.planner.furniture.forEach(f => {
                        cacheConstraint(f, f.group.position(), f.rotation !== undefined ? f.rotation : f.group.rotation());
                    });
                }
                
                if (this.planner.stairs) {
                    this.planner.stairs.forEach(s => {
                        if (s.group) {
                            cacheConstraint(s, s.group.position(), s.rotation !== undefined ? s.rotation : s.group.rotation());
                        } else if (s.path) {
                            s.path.forEach(p => {
                                cacheConstraint(p, p, 0, true);
                            });
                        }
                    });
                }
                
                if (this.planner.shapes) {
                    this.planner.shapes.forEach(s => {
                        if (s.group) cacheConstraint(s, s.group.position(), s.rotation !== undefined ? s.rotation : s.group.rotation());
                    });
                }
            }

            phase2_calculateDeformationMatrix() {
                // Establishes target architectural quadrilateral
                const { cx, cy } = this.bounds;
                this.matrix = {
                    TL: { x: cx - this.targetN / 2, y: cy - this.targetW / 2 },
                    TR: { x: cx + this.targetN / 2, y: cy - this.targetE / 2 },
                    BL: { x: cx - this.targetS / 2, y: cy + this.targetW / 2 },
                    BR: { x: cx + this.targetS / 2, y: cy + this.targetE / 2 }
                };
            }

            transformPoint(x, y) {
                // Non-linear spatial mapping (Bilinear Interpolation)
                // Ensures rooms stay connected while adapting to irregular layouts
                const u = (x - this.bounds.minX) / this.bounds.currentW;
                const v = (y - this.bounds.minY) / this.bounds.currentD;

                const topX = this.matrix.TL.x + u * (this.matrix.TR.x - this.matrix.TL.x);
                const topY = this.matrix.TL.y + u * (this.matrix.TR.y - this.matrix.TL.y);
                const botX = this.matrix.BL.x + u * (this.matrix.BR.x - this.matrix.BL.x);
                const botY = this.matrix.BL.y + u * (this.matrix.BR.y - this.matrix.BL.y);

                return {
                    x: topX + v * (botX - topX),
                    y: topY + v * (botY - topY)
                };
            }

            getLocalTransform(origX, origY) {
                const eps = 1.0;
                const p0 = this.transformPoint(origX, origY);
                const px = this.transformPoint(origX + eps, origY);
                const py = this.transformPoint(origX, origY + eps);
                
                const J11 = (px.x - p0.x) / eps;
                const J21 = (px.y - p0.y) / eps;
                const J12 = (py.x - p0.x) / eps;
                const J22 = (py.y - p0.y) / eps;
                
                // Rotation angle from polar decomposition of Jacobian J
                const angleRad = Math.atan2(J21 - J12, J11 + J22);
                
                // Scale in local axes
                const scaleX = Math.hypot(J11, J21);
                const scaleY = Math.hypot(J12, J22);
                
                return {
                    pos: p0,
                    angleDeg: angleRad * (180 / Math.PI),
                    scaleX: scaleX,
                    scaleY: scaleY,
                    avgScale: (scaleX + scaleY) / 2
                };
            }
            
            getRelocatedTransform(obj, fallbackT) {
                const constraint = this.objectConstraints.get(obj);
                if (!constraint || !constraint.nearestWall) return fallbackT;

                const nw = constraint.nearestWall;
                const w = nw.wall;
                if (!w.startAnchor || !w.endAnchor) return fallbackT;
                
                const A = w.startAnchor.position ? w.startAnchor.position() : w.startAnchor;
                const B = w.endAnchor.position ? w.endAnchor.position() : w.endAnchor;
                
                const dx = B.x - A.x;
                const dy = B.y - A.y;
                const len = Math.hypot(dx, dy);
                
                const dirX = len > 0 ? dx / len : 0;
                const dirY = len > 0 ? dy / len : 0;
                
                // Calculate proportional scale to maintain relative ratios
                const scaleX = this.targetN / this.bounds.currentW;
                const scaleY = this.targetW / this.bounds.currentD;
                const avgScale = (scaleX + scaleY) / 2;
                
                // Reconstruct exact point relative to the wall
                const projX = A.x + nw.t * dx;
                const projY = A.y + nw.t * dy;
                
                // Add scaled local perpendicular offset
                const scaledLocalY = nw.localY * avgScale;
                const newX = projX + scaledLocalY * (-dirY);
                const newY = projY + scaledLocalY * dirX;
                
                const newWallAngle = Math.atan2(dy, dx) * 180 / Math.PI;
                const newRot = newWallAngle + nw.relAngle;
                
                const deltaRot = newWallAngle - nw.wallAngle;
                
                return {
                    pos: { x: newX, y: newY },
                    angleDeg: deltaRot,
                    absAngle: newRot,
                    scaleX: fallbackT.scaleX,
                    scaleY: fallbackT.scaleY,
                    avgScale: fallbackT.avgScale
                };
            }

            phase3_rebalanceStructuralNodes() {
                // Intelligently maps wall anchors to new layout bounds
                this.planner.anchors.forEach(a => {
                    const np = this.transformPoint(a.x, a.y);
                    if (a.node && typeof a.node.position === 'function') a.node.position(np);
                    else { a.x = np.x; a.y = np.y; }
                });

                if (this.planner.arcs) {
                    this.planner.arcs.forEach(arc => {
                        arc.pos = this.transformPoint(arc.pos.x, arc.pos.y);
                        if (arc.controlHandle) arc.controlHandle.position(arc.pos);
                    });
                }
            }

            phase4_smartRelocateObjects() {
                // Relocate furniture proportionally and adapt local scale and rotation based on constraints
                if (!this.planner.furniture) return;
                
                this.planner.furniture.forEach(f => {
                    const constraint = this.objectConstraints.get(f);
                    if (!constraint) return;
                    
                    const orig = constraint.origPos;
                    const fallbackT = this.getLocalTransform(orig.x, orig.y);
                    const t = this.getRelocatedTransform(f, fallbackT);
                    
                    f.group.position(t.pos);

                    if (f.rotation === undefined) f.rotation = f.group.rotation();
                    
                    if (t.absAngle !== undefined) {
                        f.rotation = t.absAngle;
                    } else {
                        f.rotation += t.angleDeg;
                    }
                    f.group.rotation(f.rotation);

                    // Exact scale to preserve full visual layout
                    if (f.width !== undefined) f.width *= t.avgScale;
                    if (f.depth !== undefined) f.depth *= t.avgScale;
                    
                    if (f.update) f.update();
                });
            }

            phase5_adaptStaircases() {
                // Adapt staircases scaling, position and path nodes based on nearest wall structure
                if (!this.planner.stairs) return;
                
                this.planner.stairs.forEach(s => {
                    if (s.group) {
                        const constraint = this.objectConstraints.get(s);
                        if (!constraint) return;
                        
                        const orig = constraint.origPos;
                        const fallbackT = this.getLocalTransform(orig.x, orig.y);
                        const t = this.getRelocatedTransform(s, fallbackT);
                        
                        s.group.position(t.pos);

                        if (s.rotation === undefined) s.rotation = s.group.rotation();
                        if (t.absAngle !== undefined) {
                            s.rotation = t.absAngle;
                        } else {
                            s.rotation += t.angleDeg;
                        }
                        s.group.rotation(s.rotation);

                        if (s.width !== undefined) s.width *= t.avgScale;
                        if (s.length !== undefined) s.length *= t.avgScale;
                        if (s.depth !== undefined) s.depth *= t.avgScale;
                        else {
                            s.group.scaleX(s.group.scaleX() * t.avgScale);
                            s.group.scaleY(s.group.scaleY() * t.avgScale);
                        }
                        
                        if (s.update) s.update();
                    } else if (s.path) {
                        s.path.forEach(p => {
                            const constraint = this.objectConstraints.get(p);
                            if (constraint) {
                                const orig = constraint.origPos;
                                const fallbackT = this.getLocalTransform(orig.x, orig.y);
                                const t = this.getRelocatedTransform(p, fallbackT);
                                p.x = t.pos.x;
                                p.y = t.pos.y;
                            } else {
                                const np = this.transformPoint(p.x, p.y);
                                p.x = np.x;
                                p.y = np.y;
                            }
                        });
                        if (s.initHandles) s.initHandles();
                        if (s.update) s.update();
                    }
                });
            }

            phase6_finalizeRedesign() {
                const scaleX = this.targetN / this.bounds.currentW;
                const scaleY = this.targetW / this.bounds.currentD;
                const avgScale = (scaleX + scaleY) / 2;

                // Adapt widgets (doors/windows)
                if (this.planner.walls) {
                    this.planner.walls.forEach(w => {
                        if (w.attachedWidgets) {
                            w.attachedWidgets.forEach(widget => {
                                if (widget.width !== undefined) widget.width *= avgScale;
                                if (widget.update) widget.update();
                            });
                        }
                        if (w.poly) w.update(); 
                    });
                }

                if (this.planner.arcs) {
                    this.planner.arcs.forEach(a => a.rebuild());
                }

                // Adapt balconies structural points
                if (this.planner.balconies) {
                    this.planner.balconies.forEach(b => {
                        if (b.vertices) {
                            b.vertices.forEach(v => {
                                const np = this.transformPoint(v.x, v.y);
                                v.x = np.x;
                                v.y = np.y;
                            });
                        }
                        if (b.update) b.update();
                    });
                }
                
                // Adapt generic 2D shapes (annotations/bounds)
                if (this.planner.shapes) {
                    this.planner.shapes.forEach(s => {
                        const constraint = this.objectConstraints.get(s);
                        if (!constraint) return;
                        
                        const orig = constraint.origPos;
                        
                        if (s.type === 'shape_polygon' && s.params && s.params.points) {
                            const transform = s.group.getTransform();
                            const newWorldPoints = s.params.points.map(p => {
                                const worldPt = transform.point(p);
                                return this.transformPoint(worldPt.x, worldPt.y);
                            });
                            
                            let cx = 0, cy = 0;
                            newWorldPoints.forEach(p => { cx += p.x; cy += p.y; });
                            cx /= newWorldPoints.length;
                            cy /= newWorldPoints.length;
                            
                            s.group.position({ x: cx, y: cy });
                            s.rotation = 0;
                            s.group.rotation(0);
                            s.group.scale({ x: 1, y: 1 });
                            s.params.points = newWorldPoints.map(p => ({ x: p.x - cx, y: p.y - cy }));
                        } else {
                            const fallbackT = this.getLocalTransform(orig.x, orig.y);
                            const t = this.getRelocatedTransform(s, fallbackT);
                            
                            s.group.position(t.pos);
                            
                            if (t.absAngle !== undefined) {
                                s.rotation = t.absAngle;
                            } else {
                                s.rotation = (s.rotation !== undefined ? s.rotation : s.group.rotation()) + t.angleDeg;
                            }
                            s.group.rotation(s.rotation);
                            
                            if (s.type === 'shape_rect') {
                                if (s.params.width) s.params.width *= t.scaleX;
                                if (s.params.height) s.params.height *= t.scaleY;
                            } else if (s.type === 'shape_circle') {
                                if (s.params.radius) s.params.radius *= t.avgScale;
                            } else {
                                s.group.scaleX(s.group.scaleX() * t.scaleX);
                                s.group.scaleY(s.group.scaleY() * t.scaleY);
                            }
                        }
                        
                        if (s.update) s.update();
                        if (s.rebuildHandles) s.rebuildHandles();
                    });
                }

                // Adapt roof structural points
                if (this.planner.roofs) {
                    this.planner.roofs.forEach(r => {
                        if (r.points) {
                            r.points.forEach(p => {
                                const np = this.transformPoint(p.x, p.y);
                                p.x = np.x;
                                p.y = np.y;
                            });
                        }
                        if (r.update) r.update();
                    });
                }
            }
        }

        // Initialize and execute the redesign engine
        const engine = new AdaptiveArchitectureEngine(planner.value, config);
        engine.run();

        // Apply Global Settings Post-Redesign
        if (config.enableWallTracking !== undefined) {
            if (floorPlanSettings) floorPlanSettings.value.wallTracking = config.enableWallTracking;
            planner.value.setWallTracking(config.enableWallTracking);
        }

        // Validate and sync to visual engines
        planner.value.syncAll();
        if (syncSettings) syncSettings();
        if (context.refresh3DScene) context.refresh3DScene(true);

        return { success: true };
    }
};