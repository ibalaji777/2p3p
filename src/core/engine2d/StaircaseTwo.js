import Konva from 'konva';
import { WALL_HEIGHT } from '../registry.js';

export class StaircaseTwo {
    constructor(planner, startX, startY, config = {}) {
        this.planner = planner;
        this.type = 'staircase_two';
        this.id = 'stair2_' + Date.now();
        this.x = startX;
        this.y = startY;

        this.config = {
            stairType: config.stairType || 'straight', // straight, l_shape, u_shape, spiral, circular, dog_leg, custom
            width: config.width || 40,
            floorHeight: config.floorHeight || 300,
            stepCount: config.stepCount || 18,
            treadDepth: config.treadDepth || 11,
            riserHeight: config.riserHeight || 7.5,
            rotation: config.rotation || 0,
            direction: config.direction || 'up',
            isMirrored: config.isMirrored || false,
            landing: config.landing || { enabled: true, shape: 'square', width: 40, length: 40 },
            railing: config.railing || { enabled: true, left: true, right: true, style: 'glass' },
            support: config.support || 'none', // beam, column, center_pole, wall
            ...config
        };

        this.group = new Konva.Group({
            x: this.x,
            y: this.y,
            rotation: this.config.rotation,
            draggable: true
        });

        this.previewGroup = new Konva.Group({
            x: this.x,
            y: this.y,
            rotation: this.config.rotation,
            visible: false,
            opacity: 0.5
        });

        this.baseGroup = new Konva.Group();
        this.stepsGroup = new Konva.Group();
        this.labelsGroup = new Konva.Group();
        this.handlesGroup = new Konva.Group({ visible: false });

        this.group.add(this.baseGroup, this.stepsGroup, this.labelsGroup, this.handlesGroup);
        
        if (this.planner.widgetLayer) {
            this.planner.widgetLayer.add(this.previewGroup);
            this.planner.widgetLayer.add(this.group);
        }

        this.stepData3D = [];
        this.validationWarnings = [];
        this.isDragging = false;
        this.isResizing = false;
        this.isRotating = false;

        this.initEvents();
        this.update();
    }

    initEvents() {
        this.group.on('mouseenter', () => {
            if (this.planner.tool === 'select') document.body.style.cursor = 'move';
        });
        this.group.on('mouseleave', () => document.body.style.cursor = 'default');
        
        this.group.on('click tap', (e) => {
            if (this.planner.tool === 'select') {
                this.planner.selectEntity(this, 'staircase_two');
                e.cancelBubble = true;
            }
        });

        this.group.on('dragstart', (e) => {
            this.isDragging = true;
            this.group.moveToTop();
            this.setHighlight(true);
            
            this.updatePreview();
            this.previewGroup.visible(true);
            this.update(true, '#3b82f6'); 
        });

        this.group.on('dragmove', (e) => {
            this.x = this.group.x();
            this.y = this.group.y();
            this.checkSnapping();
            this.planner.syncAll();
        });

        this.group.on('dragend', (e) => {
            this.isDragging = false;
            this.x = this.group.x();
            this.y = this.group.y();
            this.previewGroup.visible(false);
            this.update(true);
            this.planner.syncAll();
        });
    }

    updatePreview() {
        this.previewGroup.destroyChildren();
        const clone = this.baseGroup.clone();
        clone.children.forEach(c => {
            c.stroke('#94a3b8');
            c.fill('rgba(148, 163, 184, 0.2)');
        });
        this.previewGroup.add(clone);
        this.previewGroup.position(this.group.position());
        this.previewGroup.rotation(this.group.rotation());
    }

    validate() {
        this.validationWarnings = [];
        if (this.config.riserHeight > 10) this.validationWarnings.push('Stair Too Steep');
        if (this.config.treadDepth < 9) this.validationWarnings.push('Unsafe Step Depth');
        if (this.config.landing.enabled && this.config.landing.length < this.config.width) {
            this.validationWarnings.push('Landing Too Small');
        }
        return this.validationWarnings.length === 0;
    }

    setHighlight(isActive) {
        this.handlesGroup.visible(isActive);
        this.update(isActive);
        if (isActive) {
            this.group.moveToTop();
        } else {
            this.previewGroup.visible(false);
        }
    }

    checkSnapping() {
        const snapDist = 15;
    }

    update(isActive = null, customColor = null) {
        if (isActive === null) {
            isActive = (this.planner.selectedEntity === this);
        }
        this.baseGroup.destroyChildren();
        this.stepsGroup.destroyChildren();
        this.labelsGroup.destroyChildren();
        
        if (!this.isResizing && !this.isRotating) {
            this.handlesGroup.destroyChildren();
        } else if (!isActive) {
            this.handlesGroup.destroyChildren();
        }

        this.stepData3D = [];

        this.validate();
        this.group.rotation(this.config.rotation);

        let strokeColor = isActive ? '#4f46e5' : '#8b5a2b';
        if (customColor) strokeColor = customColor;
        let warningColor = this.validationWarnings.length > 0 ? '#ef4444' : strokeColor;

        switch (this.config.stairType) {
            case 'straight':
                this.buildStraightStair(warningColor, isActive);
                break;
            case 'l_shape':
                this.buildLShapeStair(warningColor, isActive);
                break;
            case 'u_shape':
            case 'dog_leg':
                this.buildUShapeStair(warningColor, isActive);
                break;
            case 'spiral':
            case 'circular':
                this.buildSpiralStair(warningColor, isActive);
                break;
            default:
                this.buildStraightStair(warningColor, isActive);
                break;
        }

        if (isActive && this.validationWarnings.length > 0) {
            this.labelsGroup.add(new Konva.Text({
                x: 0, y: -20,
                text: "⚠️ " + this.validationWarnings.join(', '),
                fontSize: 10, fill: '#ef4444', fontStyle: 'bold'
            }));
        }

        if (isActive) {
            if (!this.isResizing && !this.isRotating) {
                this.addHandles();
            }
        }
    }

    buildStraightStair(color, isActive) {
        const w = this.config.width;
        const hw = w / 2;
        const l = this.config.stepCount * this.config.treadDepth;

        this.baseGroup.add(new Konva.Rect({
            x: -hw, y: 0, width: w, height: l,
            stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.1)' : 'rgba(139, 90, 43, 0.1)'
        }));

        let currY = 0;
        let currH = 0;
        for (let i = 0; i < this.config.stepCount; i++) {
            this.stepsGroup.add(new Konva.Line({
                points: [-hw, currY, hw, currY],
                stroke: '#9ca3af', strokeWidth: 1,
                dash: i > this.config.stepCount / 2 ? [4, 4] : []
            }));
            
            this.stepData3D.push({
                type: 'step', x: this.x, y: currH, z: this.y + currY + this.config.treadDepth/2,
                w: w, d: this.config.treadDepth, h: this.config.riserHeight, angle: this.config.rotation * Math.PI / 180
            });
            currY += this.config.treadDepth;
            currH += this.config.riserHeight;
        }

        this.drawDirectionArrow(0, 5, 0, Math.min(l - 5, 40));

        if (this.config.railing.enabled) {
            if (this.config.railing.left) this.stepsGroup.add(new Konva.Line({ points: [-hw + 2, 0, -hw + 2, l], stroke: '#374151', strokeWidth: 2 }));
            if (this.config.railing.right) this.stepsGroup.add(new Konva.Line({ points: [hw - 2, 0, hw - 2, l], stroke: '#374151', strokeWidth: 2 }));
        }

        if (isActive) {
            this.labelsGroup.add(new Konva.Text({ x: hw + 5, y: l / 2, text: `${l.toFixed(1)}`, fontSize: 10, fill: '#6b7280', rotation: 90 }));
            this.labelsGroup.add(new Konva.Text({ x: 0, y: l + 5, text: `W: ${w.toFixed(1)}`, fontSize: 10, fill: '#6b7280', align: 'center', offsetX: 15 }));
        }
    }

    buildLShapeStair(color, isActive) {
        const w = this.config.width;
        const hw = w / 2;
        const f1Steps = Math.floor(this.config.stepCount / 2);
        const f2Steps = this.config.stepCount - f1Steps;
        const f1Len = f1Steps * this.config.treadDepth;
        const f2Len = f2Steps * this.config.treadDepth;
        const lDepth = this.config.landing.enabled ? this.config.landing.length : w;
        const m = this.config.isMirrored ? -1 : 1;

        this.baseGroup.add(new Konva.Rect({ x: -hw, y: 0, width: w, height: f1Len, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.1)' : 'rgba(139, 90, 43, 0.1)' }));
        
        const lX = -hw;
        const lY = f1Len;
        this.baseGroup.add(new Konva.Rect({ x: lX, y: lY, width: w, height: lDepth, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.2)' : 'rgba(139, 90, 43, 0.3)' }));
        
        const f2X = this.config.isMirrored ? lX - f2Len : lX + w;
        this.baseGroup.add(new Konva.Rect({ x: f2X, y: lY, width: f2Len, height: w, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.1)' : 'rgba(139, 90, 43, 0.1)' }));

        let currY = 0;
        for (let i = 0; i < f1Steps; i++) {
            this.stepsGroup.add(new Konva.Line({ points: [-hw, currY, hw, currY], stroke: '#9ca3af', strokeWidth: 1 }));
            currY += this.config.treadDepth;
        }

        let currX = this.config.isMirrored ? lX : lX + w;
        for (let i = 0; i < f2Steps; i++) {
            this.stepsGroup.add(new Konva.Line({ points: [currX, lY, currX, lY + w], stroke: '#9ca3af', strokeWidth: 1, dash: [4, 4] }));
            currX += this.config.treadDepth * m;
        }
        
        this.drawDirectionArrow(0, 5, 0, f1Len + lDepth/2);
    }

    buildUShapeStair(color, isActive) {
        const w = this.config.width;
        const hw = w / 2;
        const gap = 10;
        const fSteps = Math.floor(this.config.stepCount / 2);
        const fLen = fSteps * this.config.treadDepth;
        const lDepth = this.config.landing.enabled ? this.config.landing.length : w;

        this.baseGroup.add(new Konva.Rect({ x: -w - gap/2, y: 0, width: w, height: fLen, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.1)' : 'rgba(139, 90, 43, 0.1)' }));
        this.baseGroup.add(new Konva.Rect({ x: -w - gap/2, y: fLen, width: w * 2 + gap, height: lDepth, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.2)' : 'rgba(139, 90, 43, 0.3)' }));
        this.baseGroup.add(new Konva.Rect({ x: gap/2, y: 0, width: w, height: fLen, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.1)' : 'rgba(139, 90, 43, 0.1)' }));

        let currY = 0;
        for (let i = 0; i < fSteps; i++) {
            this.stepsGroup.add(new Konva.Line({ points: [-w - gap/2, currY, -gap/2, currY], stroke: '#9ca3af', strokeWidth: 1 }));
            currY += this.config.treadDepth;
        }

        currY = fLen;
        for (let i = 0; i < fSteps; i++) {
            this.stepsGroup.add(new Konva.Line({ points: [gap/2, currY, w + gap/2, currY], stroke: '#9ca3af', strokeWidth: 1, dash: [4, 4] }));
            currY -= this.config.treadDepth;
        }
        
        this.drawDirectionArrow(-hw - gap/2, 5, -hw - gap/2, fLen + lDepth/2);
    }

    buildSpiralStair(color, isActive) {
        const rOut = this.config.width;
        const rIn = rOut * 0.2;
        this.baseGroup.add(new Konva.Circle({ x: 0, y: 0, radius: rOut, stroke: color, strokeWidth: 2, fill: isActive ? 'rgba(79, 70, 229, 0.1)' : 'rgba(139, 90, 43, 0.1)' }));
        this.baseGroup.add(new Konva.Circle({ x: 0, y: 0, radius: rIn, stroke: color, strokeWidth: 2, fill: '#fff' }));
        
        const steps = this.config.stepCount;
        const angle = (Math.PI * 2 * 0.8) / steps;
        for (let i = 0; i < steps; i++) {
            const a = i * angle;
            this.stepsGroup.add(new Konva.Line({
                points: [Math.cos(a)*rIn, Math.sin(a)*rIn, Math.cos(a)*rOut, Math.sin(a)*rOut],
                stroke: '#9ca3af', strokeWidth: 1, dash: i > steps/2 ? [4,4] : []
            }));
        }
        
        if (this.config.support === 'center_pole') {
            this.baseGroup.add(new Konva.Circle({ x: 0, y: 0, radius: rIn * 0.5, fill: '#374151' }));
        }
    }

    drawDirectionArrow(sx, sy, ex, ey) {
        this.stepsGroup.add(new Konva.Arrow({
            points: [sx, sy, ex, ey],
            fill: '#111827', stroke: '#111827', strokeWidth: 2, pointerLength: 6, pointerWidth: 6
        }));
        this.labelsGroup.add(new Konva.Text({
            x: sx, y: sy - 15, text: this.config.direction === 'up' ? "UP ↑" : "DOWN ↓",
            fontSize: 10, fontStyle: 'bold', fill: '#111827'
        }));
    }

    addHandles() {
        const rotHandleGroup = new Konva.Group({ x: 0, y: -35, draggable: true });
        this.handlesGroup.add(new Konva.Line({ points: [0, 0, 0, -35], stroke: '#3b82f6', strokeWidth: 2, dash: [4, 4] }));
        rotHandleGroup.add(new Konva.Circle({ x: 0, y: 0, radius: 20, fill: 'transparent' }));
        const rotHandle = new Konva.Circle({ x: 0, y: 0, radius: 10, fill: '#ffffff', stroke: '#3b82f6', strokeWidth: 3 });
        rotHandleGroup.add(rotHandle);
        rotHandleGroup.add(new Konva.Path({
            x: -6, y: -6,
            data: 'M10.14,1.16a11,11,0,0,0-9,8.92M1.16,10.14a11,11,0,0,0,8.92,9M10.14,1.16v4.3m0-4.3h-4.3',
            stroke: '#3b82f6', strokeWidth: 1.5,
            scale: { x: 0.6, y: 0.6 }
        }));

        rotHandleGroup.on('mouseenter', () => document.body.style.cursor = 'grab');
        rotHandleGroup.on('mouseleave', () => document.body.style.cursor = 'move');
        rotHandleGroup.on('dragstart', (e) => {
            e.cancelBubble = true;
            this.isRotating = true;
            document.body.style.cursor = 'grabbing';
            this.update(true, '#f59e0b');
        });
        rotHandleGroup.on('dragmove', (e) => {
            e.cancelBubble = true;
            const pos = this.group.getAbsolutePosition();
            const pointer = this.planner.stage?.getPointerPosition() || this.planner.layer?.getStage()?.getPointerPosition();
            if (pointer) {
                const angle = Math.atan2(pointer.y - pos.y, pointer.x - pos.x) + Math.PI / 2;
                this.config.rotation = (angle * 180 / Math.PI);
                this.group.rotation(this.config.rotation);
                rotHandleGroup.position({ x: 0, y: -35 });
                this.updatePreview();
                this.planner.syncAll();
            }
        });
        rotHandleGroup.on('dragend', (e) => {
            e.cancelBubble = true;
            this.isRotating = false;
            document.body.style.cursor = 'move';
            this.update(true);
            this.planner.syncAll();
        });
        this.handlesGroup.add(rotHandleGroup);
        
        const isSpiral = ['spiral', 'circular'].includes(this.config.stairType);
        
        if (!isSpiral) {
            let fLen = this.config.stairType === 'straight' ? 
                this.config.stepCount * this.config.treadDepth : 
                Math.floor(this.config.stepCount / 2) * this.config.treadDepth;

            const resizeHandleGroup = new Konva.Group({
                x: 0, y: fLen, draggable: true
            });

            resizeHandleGroup.add(new Konva.Circle({ x: 0, y: 0, radius: 15, fill: 'transparent' }));
            resizeHandleGroup.add(new Konva.Rect({
                x: -8, y: -4, width: 16, height: 8, fill: '#ffffff', stroke: '#10b981', strokeWidth: 2, cornerRadius: 2
            }));

            resizeHandleGroup.on('mouseenter', () => document.body.style.cursor = 'ns-resize');
            resizeHandleGroup.on('mouseleave', () => document.body.style.cursor = 'move');
            resizeHandleGroup.on('dragstart', (e) => {
                e.cancelBubble = true;
                this.isResizing = true;
                this.update(true, '#10b981');
            });
            resizeHandleGroup.on('dragmove', (e) => {
                e.cancelBubble = true;
                const newY = resizeHandleGroup.y();
                let newFlightSteps = Math.round(newY / this.config.treadDepth);
                if (newFlightSteps < 2) newFlightSteps = 2;
                
                let newSteps = this.config.stairType === 'straight' ? newFlightSteps : newFlightSteps * 2;
                if (newSteps > 40) newSteps = 40;
                
                if (newSteps !== this.config.stepCount) {
                    this.config.stepCount = newSteps;
                    this.update(true, '#10b981');
                    this.planner.syncAll();
                }
                
                let updatedFLen = this.config.stairType === 'straight' ? 
                    this.config.stepCount * this.config.treadDepth : 
                    Math.floor(this.config.stepCount / 2) * this.config.treadDepth;
                    
                resizeHandleGroup.position({ x: 0, y: updatedFLen });
            });
            resizeHandleGroup.on('dragend', (e) => {
                e.cancelBubble = true;
                this.isResizing = false;
                this.update(true);
                this.planner.syncAll();
            });
            this.handlesGroup.add(resizeHandleGroup);
            
            const w = this.config.width;
            const widthHandleGroup = new Konva.Group({
                x: w/2, y: fLen/2, draggable: true
            });
            widthHandleGroup.add(new Konva.Circle({ x: 0, y: 0, radius: 15, fill: 'transparent' }));
            widthHandleGroup.add(new Konva.Rect({
                x: -4, y: -8, width: 8, height: 16, fill: '#ffffff', stroke: '#8b5cf6', strokeWidth: 2, cornerRadius: 2
            }));

            widthHandleGroup.on('mouseenter', () => document.body.style.cursor = 'ew-resize');
            widthHandleGroup.on('mouseleave', () => document.body.style.cursor = 'move');
            widthHandleGroup.on('dragstart', (e) => {
                e.cancelBubble = true;
                this.isResizing = true;
                this.update(true, '#8b5cf6');
            });
            widthHandleGroup.on('dragmove', (e) => {
                e.cancelBubble = true;
                const newX = widthHandleGroup.x();
                let newWidth = Math.round(newX * 2);
                if (newWidth < 20) newWidth = 20;
                if (newWidth > 150) newWidth = 150;
                
                if (newWidth !== this.config.width) {
                    this.config.width = newWidth;
                    this.update(true, '#8b5cf6');
                    this.planner.syncAll();
                }
                
                let updatedFLen = this.config.stairType === 'straight' ? 
                    this.config.stepCount * this.config.treadDepth : 
                    Math.floor(this.config.stepCount / 2) * this.config.treadDepth;
                
                widthHandleGroup.position({ x: this.config.width/2, y: updatedFLen/2 });
            });
            widthHandleGroup.on('dragend', (e) => {
                e.cancelBubble = true;
                this.isResizing = false;
                this.update(true);
                this.planner.syncAll();
            });
            this.handlesGroup.add(widthHandleGroup);
        }

        const buttonsGroup = new Konva.Group({ x: this.config.width/2 + 25, y: -10 });
        
        const convertBtn = new Konva.Label({ x: 0, y: 0, opacity: 0.9 });
        convertBtn.add(new Konva.Tag({ fill: '#10b981', cornerRadius: 4, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.2, shadowOffset: { x: 1, y: 1 } }));
        convertBtn.add(new Konva.Text({ text: '🔄 Cycle Type', padding: 6, fill: 'white', fontSize: 11, fontStyle: 'bold' }));
        convertBtn.on('mouseenter', () => document.body.style.cursor = 'pointer');
        convertBtn.on('mouseleave', () => document.body.style.cursor = 'move');
        convertBtn.on('click tap', (e) => {
            e.cancelBubble = true;
            const types = ['straight', 'l_shape', 'u_shape', 'spiral'];
            let idx = types.indexOf(this.config.stairType);
            this.config.stairType = types[(idx + 1) % types.length];
            this.update(true);
            this.planner.syncAll();
        });
        buttonsGroup.add(convertBtn);
        
        const mirrorBtn = new Konva.Label({ x: 0, y: 30, opacity: 0.9 });
        mirrorBtn.add(new Konva.Tag({ fill: '#8b5cf6', cornerRadius: 4, shadowColor: 'black', shadowBlur: 4, shadowOpacity: 0.2, shadowOffset: { x: 1, y: 1 } }));
        mirrorBtn.add(new Konva.Text({ text: '◨ Mirror', padding: 6, fill: 'white', fontSize: 11, fontStyle: 'bold' }));
        mirrorBtn.on('mouseenter', () => document.body.style.cursor = 'pointer');
        mirrorBtn.on('mouseleave', () => document.body.style.cursor = 'move');
        mirrorBtn.on('click tap', (e) => {
            e.cancelBubble = true;
            this.config.isMirrored = !this.config.isMirrored;
            this.update(true);
            this.planner.syncAll();
        });
        buttonsGroup.add(mirrorBtn);

        this.handlesGroup.add(buttonsGroup);
    }

    export() {
        return {
            type: 'staircase_two',
            x: this.x,
            y: this.y,
            config: this.config
        };
    }

    remove() {
        this.previewGroup.destroy();
        this.group.destroy();
        this.planner.stairs = this.planner.stairs.filter(s => s !== this);
        this.planner.selectEntity(null);
        this.planner.syncAll();
    }
}
