import Konva from 'konva';

export class PremiumStaircase {
    constructor(planner, type = 'straight', data = {}) {
        this.planner = planner;
        
        let cleanShape = (data.shape || type || 'straight').toString();
        if (cleanShape.startsWith('stair_v5_')) cleanShape = cleanShape.replace('stair_v5_', '');
        if (cleanShape.startsWith('stair_v4_')) cleanShape = cleanShape.replace('stair_v4_', '');
        if (cleanShape === 'staircase') cleanShape = 'straight';

        this.shape = cleanShape; // 'straight', 'L', 'U', 'T'
        this.type = data.type || `stair_v5_${cleanShape}`;
        this.id = data.id || 'stairv5_' + Math.random().toString(36).substr(2, 9);
        
        // Global transforms
        this.x = data.x || 0;
        this.y = data.y || 0;
        this.rotation = data.rotation || 0;
        this.elevation = data.elevation || 0;
        this.direction = data.direction || 'up'; // 'up' means arrow points to second floor
        this.description = data.description || '';

        // Standard metrics
        this.width = data.width || 60;
        this.stepDepth = data.stepDepth || 18.33;
        this.stepHeight = data.stepHeight || 11.67;
        this.isStatic = data.isStatic || false;

        // End Landings
        this.hasTopLanding = data.hasTopLanding !== undefined ? data.hasTopLanding : false;
        this.hasBottomLanding = data.hasBottomLanding !== undefined ? data.hasBottomLanding : false;
        
        // Structural Properties
        this.stringerType = data.stringerType || 'solid'; // 'solid', 'mono', 'double', 'side', 'box'
        this.stringerWidth = data.stringerWidth || 10;
        this.stringerThickness = data.stringerThickness || 20;
        this.beamOffset = data.beamOffset !== undefined ? data.beamOffset : 25; // Distance from edge for double stringers
        this.landingSupports = data.landingSupports !== undefined ? data.landingSupports : false;

        // Shape specific
        if (this.shape === 'straight') {
            this.totalSteps = data.totalSteps || 15;
            this.flight1Steps = this.totalSteps;
            this.flight2Steps = 0;
        } else if (this.shape === 'L') {
            this.flight1Steps = data.flight1Steps || 8;
            this.flight2Steps = data.flight2Steps || 7;
            this.turnDirection = data.turnDirection || 'right'; // 'left' or 'right'
            this.landingSize = data.landingSize || this.width;
        } else if (this.shape === 'U') {
            this.flight1Steps = data.flight1Steps || 8;
            this.flight2Steps = data.flight2Steps || 7;
            this.turnDirection = data.turnDirection || 'right';
            this.landingSize = data.landingSize || this.width;
            this.gapWidth = data.gapWidth || 20;
        } else if (this.shape === 'T') {
            this.flight1Steps = data.flight1Steps || 8; // Main flight
            this.flight2Steps = data.flight2Steps || 7; // Branch flights
            this.landingSize = data.landingSize || this.width;
        }

        // Materials Configuration
        this.useUnifiedMaterial = data.useUnifiedMaterial !== undefined ? data.useUnifiedMaterial : true;
        this.primaryMaterial = data.primaryMaterial || 'wood_oak';
        this.primaryColor = data.primaryColor || '#8b5a2b';
        
        this.treadMaterial = data.treadMaterial || 'default';
        this.treadColor = data.treadColor || '#8b5a2b';
        
        this.riserMaterial = data.riserMaterial || 'default';
        this.riserColor = data.riserColor || '#8b5a2b';
        
        this.landingMaterial = data.landingMaterial || 'default';
        this.landingColor = data.landingColor || '#8b5a2b';
        
        this.structureMaterial = data.structureMaterial || 'default';
        this.structureColor = data.structureColor || '#8b5a2b';

        // Railings Configuration
        this.railingLayout = data.railingLayout || 'both'; // 'none', 'left', 'right', 'both'
        this.linkRailings = data.linkRailings !== undefined ? data.linkRailings : true;
        
        const defaultRailing = {
            height: 60,
            offset: 5,
            balusterSpacing: 15,
            balusterShape: 'square',
            balusterSize: 4,
            handrailProfile: 'rectangular',
            handrailSize: 3.33,
            hasNewelPosts: true,
            newelSize: 8,
            hasCornerPosts: true,
            hasEndCaps: true,
            useGlassPanels: false,
            glassThickness: 1.5,
            useCableRails: false,
            cableCount: 5,
            cableDiameter: 0.8,
            wallMountedHandrail: false,
            handrailMaterial: 'default',
            balusterMaterial: 'default',
            panelMaterial: 'glass_clear',
            cableMaterial: 'stainless_steel'
        };

        this.leftRailing = data.leftRailing ? JSON.parse(JSON.stringify(data.leftRailing)) : JSON.parse(JSON.stringify(defaultRailing));
        this.rightRailing = data.rightRailing ? JSON.parse(JSON.stringify(data.rightRailing)) : JSON.parse(JSON.stringify(defaultRailing));

        this.group = new Konva.Group({
            x: this.x,
            y: this.y,
            rotation: this.rotation,
            draggable: !this.isStatic,
            id: this.id
        });

        this.contentGroup = new Konva.Group();
        this.handlesGroup = new Konva.Group({ visible: false });
        
        this.group.add(this.contentGroup);
        if (!this.isStatic) this.group.add(this.handlesGroup);
        
        if (this.planner.widgetLayer) {
            this.planner.widgetLayer.add(this.group);
        } else {
            this.planner.furnitureLayer.add(this.group);
        }

        this.initEvents();
        this.initHandles();
        this.update();
    }

    initEvents() {
        if (this.isStatic) return;

        this.group.on('mouseenter', () => { if (this.planner.tool === 'select') document.body.style.cursor = 'move'; });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');

        this.group.on('click tap', (e) => {
            if (this.planner.tool === 'select') {
                e.cancelBubble = true;
                this.planner.selectEntity(this, 'stair');
            }
        });

        this.group.on('dragstart', (e) => {
            this.planner.selectEntity(this, 'stair');
        });

        this.group.on('dragend', (e) => {
            this.x = this.group.x();
            this.y = this.group.y();
            this.planner.syncAll();
        });
    }

    initHandles() {
        // Landing slider handle
        this.landingSlider = new Konva.Circle({ radius: 8, fill: '#f59e0b', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
        this.landingSlider.on('mouseenter', () => document.body.style.cursor = 'ns-resize');
        this.landingSlider.on('mouseleave', () => document.body.style.cursor = 'default');
        
        this.landingSlider.on('dragmove', (e) => {
            e.cancelBubble = true;
            this.handleLandingDrag();
        });
        this.landingSlider.on('dragend', (e) => {
            e.cancelBubble = true;
            this.planner.syncAll();
        });

        this.rotHandle = new Konva.Circle({ radius: 8, fill: '#3b82f6', stroke: 'white', strokeWidth: 2, draggable: true, visible: false });
        this.rotHandle.on('mouseenter', () => document.body.style.cursor = 'crosshair');
        this.rotHandle.on('mouseleave', () => document.body.style.cursor = 'default');
        this.rotHandle.on('dragmove', (e) => {
            e.cancelBubble = true;
            const pos = this.planner.stage.getPointerPosition();
            if (!pos) return;
            const groupPos = this.group.getAbsolutePosition();
            const angleRad = Math.atan2(pos.y - groupPos.y, pos.x - groupPos.x);
            let newRot = (angleRad * 180 / Math.PI) - 90;
            this.rotation = Math.round(newRot / 15) * 15;
            this.group.rotation(this.rotation);
            this.planner.syncAll();
        });

        this.handlesGroup.add(this.landingSlider, this.rotHandle);
    }

    handleLandingDrag() {
        if (this.shape === 'straight') return;
        
        let localY = this.landingSlider.y();
        if (localY < this.stepDepth * 2) localY = this.stepDepth * 2;
        
        const totalStepsBefore = this.flight1Steps + this.flight2Steps;
        const newFlight1Steps = Math.round(localY / this.stepDepth);
        
        if (newFlight1Steps >= 2 && newFlight1Steps <= totalStepsBefore - 2) {
            this.flight1Steps = newFlight1Steps;
            this.flight2Steps = totalStepsBefore - this.flight1Steps;
            this.update();
        } else {
            this.updateHandles();
        }
    }

    update() {
        this.contentGroup.destroyChildren();
        
        if (this.shape === 'straight') this.drawStraight();
        else if (this.shape === 'L') this.drawLShape();
        else if (this.shape === 'U') this.drawUShape();
        else if (this.shape === 'T') this.drawTShape();

        this.drawRailings();
        this.drawArrow();
        this.updateHandles();
    }

    drawRailings() {
        if (!this.railingLayout || this.railingLayout === 'none') return;

        const railingGroup = new Konva.Group();
        const hasLeft = this.railingLayout === 'left' || this.railingLayout === 'both';
        const hasRight = this.railingLayout === 'right' || this.railingLayout === 'both';

        const offsetLeft = Number(this.leftRailing?.offset) || 5;
        const offsetRight = Number(this.rightRailing?.offset) || 5;

        const drawRailingLine = (points) => {
            if (!points || points.length < 4) return;

            // Sleek architectural handrail line
            railingGroup.add(new Konva.Line({
                points,
                stroke: '#1e293b',
                strokeWidth: 2.2,
                lineCap: 'round',
                lineJoin: 'round'
            }));

            // Subtle inner handrail highlight line
            railingGroup.add(new Konva.Line({
                points,
                stroke: '#94a3b8',
                strokeWidth: 1.0,
                lineCap: 'round',
                lineJoin: 'round'
            }));

            // Draw newel post circles at start, turn vertices, and end
            for (let i = 0; i < points.length; i += 2) {
                const px = points[i];
                const py = points[i + 1];
                railingGroup.add(new Konva.Circle({
                    x: px, y: py, radius: 3.2, fill: '#1e293b', stroke: '#ffffff', strokeWidth: 1.0
                }));
            }
        };

        if (this.shape === 'straight') {
            const length = this.flight1Steps * this.stepDepth;
            const startY = this.hasTopLanding ? -this.landingSize : 0;
            const endY = this.hasBottomLanding ? length + this.landingSize : length;

            if (hasLeft) {
                const lx = -this.width / 2 + offsetLeft;
                drawRailingLine([lx, startY, lx, endY]);
            }
            if (hasRight) {
                const rx = this.width / 2 - offsetRight;
                drawRailingLine([rx, startY, rx, endY]);
            }
        } else if (this.shape === 'L') {
            const l1 = this.flight1Steps * this.stepDepth;
            const l2 = this.flight2Steps * this.stepDepth;
            const startY = this.hasTopLanding ? -this.landingSize : 0;

            if (this.turnDirection === 'right') {
                const f2EndX = this.width / 2 + l2 + (this.hasBottomLanding ? this.landingSize : 0);
                if (hasLeft) {
                    const lx = -this.width / 2 + offsetLeft;
                    const ly = l1 + this.landingSize - offsetLeft;
                    drawRailingLine([lx, startY, lx, ly, f2EndX, ly]);
                }
                if (hasRight) {
                    const rx = this.width / 2 - offsetRight;
                    const ry = l1 + offsetRight;
                    drawRailingLine([rx, startY, rx, ry, f2EndX, ry]);
                }
            } else { // Left turn
                const f2StartX = -this.width / 2 - l2 - (this.hasBottomLanding ? this.landingSize : 0);
                if (hasLeft) {
                    const lx = -this.width / 2 + offsetLeft;
                    const ly = l1 + offsetLeft;
                    drawRailingLine([lx, startY, lx, ly, f2StartX, ly]);
                }
                if (hasRight) {
                    const rx = this.width / 2 - offsetRight;
                    const ry = l1 + this.landingSize - offsetRight;
                    drawRailingLine([rx, startY, rx, ry, f2StartX, ry]);
                }
            }
        } else if (this.shape === 'U') {
            const l1 = this.flight1Steps * this.stepDepth;
            const l2 = this.flight2Steps * this.stepDepth;
            const startY = this.hasTopLanding ? -this.landingSize : 0;
            const endY2 = l1 - l2 - (this.hasBottomLanding ? this.landingSize : 0);

            if (this.turnDirection === 'right') {
                const f2X = this.width / 2 + this.gapWidth;
                if (hasLeft) {
                    const lx = -this.width / 2 + offsetLeft;
                    const ly = l1 + this.landingSize - offsetLeft;
                    const rx = f2X + this.width - offsetLeft;
                    drawRailingLine([lx, startY, lx, ly, rx, ly, rx, endY2]);
                }
                if (hasRight) {
                    const rx = this.width / 2 - offsetRight;
                    const ry = l1 + offsetRight;
                    const lx = f2X + offsetRight;
                    drawRailingLine([rx, startY, rx, ry, lx, ry, lx, endY2]);
                }
            } else { // Left turn
                const f2X = -this.width / 2 - this.width - this.gapWidth;
                if (hasRight) {
                    const rx = this.width / 2 - offsetRight;
                    const ry = l1 + this.landingSize - offsetRight;
                    const lx = f2X + offsetRight;
                    drawRailingLine([rx, startY, rx, ry, lx, ry, lx, endY2]);
                }
                if (hasLeft) {
                    const lx = -this.width / 2 + offsetLeft;
                    const ly = l1 + offsetLeft;
                    const rx = f2X + this.width - offsetLeft;
                    drawRailingLine([lx, startY, lx, ly, rx, ly, rx, endY2]);
                }
            }
        } else if (this.shape === 'T') {
            const l1 = this.flight1Steps * this.stepDepth;
            const l2 = this.flight2Steps * this.stepDepth;
            const startY = this.hasTopLanding ? -this.landingSize : 0;
            const leftEndX = -this.width / 2 - l2 - (this.hasBottomLanding ? this.landingSize : 0);
            const rightEndX = this.width / 2 + l2 + (this.hasBottomLanding ? this.landingSize : 0);

            if (hasLeft) {
                const lx = -this.width / 2 + offsetLeft;
                const ly = l1 + offsetLeft;
                drawRailingLine([lx, startY, lx, ly, leftEndX, ly]);
            }
            if (hasRight) {
                const rx = this.width / 2 - offsetRight;
                const ry = l1 + offsetRight;
                drawRailingLine([rx, startY, rx, ry, rightEndX, ry]);
            }
        }

        this.contentGroup.add(railingGroup);
    }

    drawFlightSteps(x, y, width, length, stepCount, isVertical) {
        const stringerType = this.stringerType || 'solid';
        const sWidth = Math.max(6, Number(this.stringerWidth) || 10);
        const fillColor = (this.primaryColor && this.primaryColor !== '#ffffff') ? this.primaryColor : '#8b5a2b';
        const strokeColor = 'rgba(30, 41, 59, 0.45)';
        const stepStrokeColor = 'rgba(30, 41, 59, 0.3)';

        // 1. Base footprint fill & outline according to stringerType
        if (stringerType === 'solid' || stringerType === 'box') {
            this.contentGroup.add(new Konva.Rect({
                x, y,
                width: isVertical ? width : length,
                height: isVertical ? length : width,
                stroke: strokeColor,
                strokeWidth: 1.5,
                fill: fillColor,
                opacity: 0.75
            }));
        } else {
            this.contentGroup.add(new Konva.Rect({
                x, y,
                width: isVertical ? width : length,
                height: isVertical ? length : width,
                stroke: strokeColor,
                strokeWidth: 1.2,
                fill: '#f8fafc',
                opacity: 0.4
            }));
        }

        // 2. Render Stringer Beams in 2D
        if (stringerType === 'mono') {
            if (isVertical) {
                const bx = x + width / 2 - sWidth / 2;
                this.contentGroup.add(new Konva.Rect({ x: bx, y, width: sWidth, height: length, fill: '#334155', opacity: 0.85 }));
            } else {
                const by = y + width / 2 - sWidth / 2;
                this.contentGroup.add(new Konva.Rect({ x, y: by, width: length, height: sWidth, fill: '#334155', opacity: 0.85 }));
            }
        } else if (stringerType === 'double') {
            const offset = Math.min(width * 0.25, Number(this.beamOffset) || 12);
            if (isVertical) {
                this.contentGroup.add(new Konva.Rect({ x: x + offset, y, width: sWidth, height: length, fill: '#334155', opacity: 0.85 }));
                this.contentGroup.add(new Konva.Rect({ x: x + width - offset - sWidth, y, width: sWidth, height: length, fill: '#334155', opacity: 0.85 }));
            } else {
                this.contentGroup.add(new Konva.Rect({ x, y: y + offset, width: length, height: sWidth, fill: '#334155', opacity: 0.85 }));
                this.contentGroup.add(new Konva.Rect({ x, y: y + width - offset - sWidth, width: length, height: sWidth, fill: '#334155', opacity: 0.85 }));
            }
        } else if (stringerType === 'side') {
            if (isVertical) {
                this.contentGroup.add(new Konva.Rect({ x, y, width: sWidth, height: length, fill: '#334155', opacity: 0.85 }));
                this.contentGroup.add(new Konva.Rect({ x: x + width - sWidth, y, width: sWidth, height: length, fill: '#334155', opacity: 0.85 }));
            } else {
                this.contentGroup.add(new Konva.Rect({ x, y, width: length, height: sWidth, fill: '#334155', opacity: 0.85 }));
                this.contentGroup.add(new Konva.Rect({ x, y: y + width - sWidth, width: length, height: sWidth, fill: '#334155', opacity: 0.85 }));
            }
        }

        // 3. Step divider lines across the flight
        const stepSize = length / stepCount;
        for (let i = 1; i < stepCount; i++) {
            if (isVertical) {
                this.contentGroup.add(new Konva.Line({ points: [x, y + i * stepSize, x + width, y + i * stepSize], stroke: stepStrokeColor, strokeWidth: 1.0 }));
            } else {
                this.contentGroup.add(new Konva.Line({ points: [x + i * stepSize, y, x + i * stepSize, y + width], stroke: stepStrokeColor, strokeWidth: 1.0 }));
            }
        }
    }

    drawEndLanding(x, y, width, length) {
        const fillColor = (this.primaryColor && this.primaryColor !== '#ffffff') ? this.primaryColor : '#8b5a2b';
        this.contentGroup.add(new Konva.Rect({ x, y, width, height: length, stroke: '#0f172a', strokeWidth: 2, fill: fillColor, opacity: 0.55 }));
    }

    drawStraight() {
        const length = this.flight1Steps * this.stepDepth;
        let startY = 0;
        if (this.hasTopLanding) {
            this.drawEndLanding(-this.width/2, -this.landingSize, this.width, this.landingSize);
        }
        
        this.drawFlightSteps(-this.width/2, 0, this.width, length, this.flight1Steps, true);
        
        if (this.hasBottomLanding) {
            this.drawEndLanding(-this.width/2, length, this.width, this.landingSize);
        }
    }

    drawLShape() {
        const l1 = this.flight1Steps * this.stepDepth;
        const l2 = this.flight2Steps * this.stepDepth;
        
        if (this.hasTopLanding) {
            this.drawEndLanding(-this.width/2, -this.landingSize, this.width, this.landingSize);
        }
        
        this.drawFlightSteps(-this.width/2, 0, this.width, l1, this.flight1Steps, true);
        
        this.contentGroup.add(new Konva.Rect({ x: -this.width/2, y: l1, width: this.width, height: this.landingSize, stroke: '#3b82f6', strokeWidth: 2, fill: '#1e3a8a', opacity: 0.4 }));
        
        const f2X = this.turnDirection === 'right' ? this.width/2 : -this.width/2 - l2;
        this.drawFlightSteps(f2X, l1, this.width, l2, this.flight2Steps, false);
        
        if (this.hasBottomLanding) {
            const bx = this.turnDirection === 'right' ? f2X + l2 : f2X - this.landingSize;
            this.drawEndLanding(bx, l1, this.landingSize, this.width);
        }
    }

    drawUShape() {
        const l1 = this.flight1Steps * this.stepDepth;
        const l2 = this.flight2Steps * this.stepDepth;
        
        if (this.hasTopLanding) {
            this.drawEndLanding(-this.width/2, -this.landingSize, this.width, this.landingSize);
        }
        
        this.drawFlightSteps(-this.width/2, 0, this.width, l1, this.flight1Steps, true);
        
        const totalW = this.width * 2 + this.gapWidth;
        const landingX = this.turnDirection === 'right' ? -this.width/2 : -this.width/2 - this.width - this.gapWidth;
        this.contentGroup.add(new Konva.Rect({ x: landingX, y: l1, width: totalW, height: this.landingSize, stroke: '#3b82f6', strokeWidth: 2, fill: '#1e3a8a', opacity: 0.4 }));
        
        const f2X = this.turnDirection === 'right' ? this.width/2 + this.gapWidth : -this.width/2 - this.width - this.gapWidth;
        this.drawFlightSteps(f2X, l1 - l2, this.width, l2, this.flight2Steps, true);
        
        if (this.hasBottomLanding) {
            this.drawEndLanding(f2X, l1 - l2 - this.landingSize, this.width, this.landingSize);
        }
    }

    drawTShape() {
        const l1 = this.flight1Steps * this.stepDepth;
        const l2 = this.flight2Steps * this.stepDepth;
        
        if (this.hasTopLanding) {
            this.drawEndLanding(-this.width/2, -this.landingSize, this.width, this.landingSize);
        }
        
        this.drawFlightSteps(-this.width/2, 0, this.width, l1, this.flight1Steps, true);
        
        const totalW = l2 * 2 + this.width;
        this.contentGroup.add(new Konva.Rect({ x: -this.width/2 - l2, y: l1, width: totalW, height: this.landingSize, stroke: '#3b82f6', strokeWidth: 2, fill: '#1e3a8a', opacity: 0.4 }));
        
        this.drawFlightSteps(-this.width/2 - l2, l1, this.width, l2, this.flight2Steps, false);
        this.drawFlightSteps(this.width/2, l1, this.width, l2, this.flight2Steps, false);
        
        if (this.hasBottomLanding) {
            this.drawEndLanding(-this.width/2 - l2 - this.landingSize, l1, this.landingSize, this.width);
            this.drawEndLanding(this.width/2 + l2, l1, this.landingSize, this.width);
        }
    }

    drawArrow() {
        const arrowGroup = new Konva.Group();
        const arrow = new Konva.Arrow({ stroke: '#3b82f6', fill: '#3b82f6', strokeWidth: 3, pointerLength: 8, pointerWidth: 8, hitStrokeWidth: 25 });
        
        const l1 = (this.shape === 'straight' ? this.totalSteps : this.flight1Steps) * this.stepDepth;
        if (this.direction === 'up') {
            arrow.points([0, 10, 0, l1 - 10]);
        } else {
            arrow.points([0, l1 - 10, 0, 10]);
        }
        
        arrowGroup.add(arrow);
        
        if (!this.isStatic) {
            arrowGroup.on('mouseenter', () => { document.body.style.cursor = 'pointer'; arrow.stroke('#2563eb'); arrow.fill('#2563eb'); this.planner.stage.batchDraw(); });
            arrowGroup.on('mouseleave', () => { document.body.style.cursor = 'default'; arrow.stroke('#3b82f6'); arrow.fill('#3b82f6'); this.planner.stage.batchDraw(); });
            arrowGroup.on('click tap', (e) => {
                if (this.planner.tool === 'select') {
                    e.cancelBubble = true;
                    this.direction = this.direction === 'up' ? 'down' : 'up';
                    this.update();
                    this.planner.syncAll();
                }
            });
        }
        
        this.contentGroup.add(arrowGroup);
    }

    updateHandles() {
        if (this.isStatic) return;
        const l1 = this.flight1Steps * this.stepDepth;
        
        if (this.shape !== 'straight') {
            this.landingSlider.position({ x: 0, y: l1 });
            this.landingSlider.show();
        } else {
            this.landingSlider.hide();
        }
        
        this.rotHandle.position({ x: 0, y: -30 });
        this.rotHandle.show();
    }

    setHighlight(isActive) {
        if (this.isStatic) return;
        this.handlesGroup.visible(isActive);
        if (isActive) this.group.moveToTop();
        if (isActive) this.handlesGroup.moveToTop();
        this.planner.stage.batchDraw();
    }

    remove() {
        this.group.destroy();
        this.planner.stairs = this.planner.stairs.filter(s => s.id !== this.id);
        if (this.planner.selectedEntity === this) this.planner.selectEntity(null);
    }
}
