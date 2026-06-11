import * as THREE from 'three';

/**
 * Advanced Stair System Gizmo (Professional Architectural Stair Builder) V3
 * Features:
 * - Smart Chaining
 * - Landing Integration
 * - Multi-flight param editing
 * - Generative Rotations
 */
export class StairSystemManager {
    constructor(engine) {
        this.engine = engine;
        this.selectionScope = 'flight'; // Valid scopes: 'flight', 'connected', 'system', 'above', 'below'
    }

    bindUI() {
        const bindInput = (idBase, prop, isInt = false) => {
            const el = document.getElementById(`gizmo-${idBase}`);
            const elr = document.getElementById(`gizmo-${idBase}-range`);
            const update = (e) => this.updateStairProp(prop, isInt ? parseInt(e.target.value, 10) : parseFloat(e.target.value));
            if (el) el.addEventListener('input', update);
            if (elr) elr.addEventListener('input', update);
        };

        bindInput('stair-w', 'width');
        bindInput('stair-h', 'stepHeight');
        bindInput('stair-d', 'stepDepth');
        bindInput('stair-c', 'stepCount', true);
        bindInput('landing-l', 'length');
        bindInput('landing-t', 'thickness');

        const scopeSelect = document.getElementById('gizmo-stair-select-scope');
        if (scopeSelect) {
            scopeSelect.addEventListener('change', e => {
                this.setSelectionScope(e.target.value);
            });
        }

        const bindBtn = (id, handler) => { const el = document.getElementById(id); if (el) el.onclick = handler; };
        bindBtn('gizmo-stair-btn-straight', () => this.addTopology('straight'));
        bindBtn('gizmo-stair-btn-lshape', () => this.addTopology('l_shape'));
        bindBtn('gizmo-stair-btn-ushape', () => this.addTopology('u_shape'));
        bindBtn('gizmo-stair-btn-tshape', () => this.addTopology('t_shape'));
        bindBtn('gizmo-stair-btn-yshape', () => this.addTopology('y_shape'));

        const btnDetach = document.getElementById('gizmo-stair-btn-detach');
        if (btnDetach) btnDetach.onclick = () => this.detachSelected();

        const btnDelete = document.getElementById('gizmo-stair-btn-delete');
        if (btnDelete) btnDelete.onclick = () => this.deleteSelected();
    }

    updateStairProp(prop, val) {
        const selected = this.engine.interactions.selectedObject;
        if (selected && selected.userData.entity) {
            const entity = selected.userData.entity;
            const targets = this.getSelectionTargets(entity);
            
            targets.forEach(t => {
                t[prop] = val;
                if (t.mesh3D) t.mesh3D.userData.needsRebuild = true; 
            });

            if (window.plannerInstance && window.plannerInstance.syncAll) {
                window.plannerInstance.syncAll();
            }
            this.updatePanel(entity);
            window.dispatchEvent(new CustomEvent('stair-gizmo-change', { detail: { entity, targets }}));
        }
    }

    setSelectionScope(scope) {
        this.selectionScope = scope;
        const scopeSelect = document.getElementById('gizmo-stair-select-scope');
        if (scopeSelect) scopeSelect.value = scope;
        
        const selected = this.engine.interactions.selectedObject;
        if (selected && selected.userData.entity) {
            this.highlightTargets(selected.userData.entity);
        }
    }

    updatePanel(entity) {
        if (!entity) return;
        const isLanding = entity.type === 'stair_landing';
        
        const fControls = document.getElementById('gizmo-stair-flight-controls');
        const lControls = document.getElementById('gizmo-stair-landing-controls');
        if (fControls) fControls.style.display = isLanding ? 'none' : 'flex';
        if (lControls) lControls.style.display = isLanding ? 'flex' : 'none';

        const updateVal = (idBase, val) => {
            const el = document.getElementById(`gizmo-${idBase}`);
            const elr = document.getElementById(`gizmo-${idBase}-range`);
            if (el && document.activeElement !== el) el.value = val;
            if (elr && document.activeElement !== elr) elr.value = val;
        };

        const btnStraight = document.getElementById('gizmo-stair-btn-straight');
        const btnLShape = document.getElementById('gizmo-stair-btn-lshape');
        const btnUShape = document.getElementById('gizmo-stair-btn-ushape');
        const btnTShape = document.getElementById('gizmo-stair-btn-tshape');
        const btnYShape = document.getElementById('gizmo-stair-btn-yshape');
        const btnDetach = document.getElementById('gizmo-stair-btn-detach');

        if (isLanding) {
            if (btnStraight) btnStraight.style.display = 'none';
            if (btnLShape) btnLShape.style.display = 'none';
            if (btnUShape) btnUShape.style.display = 'none';
            if (btnTShape) btnTShape.style.display = 'none';
            if (btnYShape) btnYShape.style.display = 'none';
        } else {
            if (btnStraight) btnStraight.style.display = 'block';
            if (btnLShape) btnLShape.style.display = 'block';
            if (btnUShape) btnUShape.style.display = 'block';
            if (btnTShape) btnTShape.style.display = 'block';
            if (btnYShape) btnYShape.style.display = 'block';
        }

        if (isLanding) {
            updateVal('landing-l', (entity.length || 100).toFixed(1));
            updateVal('landing-t', (entity.thickness || 20).toFixed(1));
        } else {
            updateVal('stair-w', (entity.width || 100).toFixed(1));
            updateVal('stair-h', (entity.stepHeight || 17.5).toFixed(1));
            updateVal('stair-d', (entity.stepDepth || 28.0).toFixed(1));
            updateVal('stair-c', entity.stepCount || 10);
        }
        
        if (btnDetach) btnDetach.style.display = entity.connectedFrom ? 'block' : 'none';
        
        this.highlightTargets(entity);
    }

    getSelectionTargets(entity) {
        if (this.selectionScope === 'flight') return [entity];
        
        const allStairs = entity.planner ? entity.planner.stairs : [];
        const systemId = entity.systemId || entity.id; 
        
        if (this.selectionScope === 'system') {
            return allStairs.filter(e => e.systemId === systemId);
        } else if (this.selectionScope === 'connected') {
            return allStairs.filter(e => e.systemId === systemId && (e.connectedTo === entity.id || entity.connectedTo === e.id || e.id === entity.id));
        } else if (this.selectionScope === 'above') {
            return allStairs.filter(e => e.systemId === systemId && (e.elevation >= entity.elevation));
        } else if (this.selectionScope === 'below') {
            return allStairs.filter(e => e.systemId === systemId && (e.elevation <= entity.elevation));
        }
        
        return [entity];
    }

    highlightTargets(baseEntity) {
        const targets = this.getSelectionTargets(baseEntity);
        
        this.engine.scene.traverse(child => {
            if (child.isMesh && child.userData.isHighlightClone) {
                child.parent.remove(child);
            }
        });
        
        // Re-apply highlight to target selection
        targets.forEach(t => {
            if (t.mesh3D && t.id !== baseEntity.id) {
                this.engine.interactions.setHighlight(t.mesh3D, true, 0x3b82f6); 
            }
        });
        
        if (baseEntity.mesh3D) {
            this.engine.interactions.setHighlight(baseEntity.mesh3D, true); 
        }
    }

    // V3 Advanced Features
    addTopology(type) {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const baseEntity = selected.userData.entity;
        const planner = baseEntity.planner || window.plannerInstance?.planner;
        if (!planner) return;

        if (baseEntity.type !== 'stair') return console.warn("Select a flight to construct topology.");
        
        const w = baseEntity.width || 100;
        let lWidth = w, lLength = w, aOffsetX = 0;
        
        if (type === 'u_shape') { lWidth = w * 2.2; lLength = w; aOffsetX = -w * 0.6; }
        if (type === 't_shape') { lWidth = w * 3; lLength = w; }
        if (type === 'y_shape') { lWidth = w * 3; lLength = w * 1.5; }
        
        const parentLanding = { 
            id: 'stair_landing_' + Math.random().toString(36).substr(2, 9), type: 'stair_landing', 
            systemId: baseEntity.systemId || baseEntity.id, connectedFrom: baseEntity.id, 
            attachEdge: 'top', attachOffsetX: aOffsetX, attachOffsetY: 0, width: lWidth, length: lLength, thickness: 20, 
            elevation: (baseEntity.absElev || baseEntity.elevation || 0) + ((baseEntity.stepCount || 10) * (baseEntity.stepHeight || 17.5)) 
        };
        this.injectEntity(parentLanding, planner);
        
        if (type === 'straight') {
            this.spawnFlight(parentLanding, 'top', 0, 0, 0, planner);
        } else if (type === 'l_shape') {
            this.spawnFlight(parentLanding, 'right', 0, 0, 0, planner);
        } else if (type === 'u_shape') {
            this.spawnFlight(parentLanding, 'bottom', w * 0.6, 0, 0, planner);
        } else if (type === 't_shape') {
            this.spawnFlight(parentLanding, 'left', 0, 0, 0, planner);
            this.spawnFlight(parentLanding, 'right', 0, 0, 0, planner);
        } else if (type === 'y_shape') {
            this.spawnFlight(parentLanding, 'top', -w * 0.6, 0, -45, planner);
            this.spawnFlight(parentLanding, 'top', w * 0.6, 0, 45, planner);
        }
        if (planner.syncAll) planner.syncAll();
    }

    spawnFlight(parent, edge, offX, offY, rotOffset, planner) {
        const newFlight = { 
            id: 'stair_' + Math.random().toString(36).substr(2, 9), type: 'stair', 
            systemId: parent.systemId || parent.id, connectedFrom: parent.id, 
            attachEdge: edge, attachOffsetX: offX, attachOffsetY: offY, width: 100, 
            stepCount: 10, stepHeight: 17.5, stepDepth: 28.0, rotationOffset: rotOffset, 
            elevation: parent.absElev || parent.elevation || 0 
        };
        if (parent.connectedFrom) { const gp = planner.stairs.find(s => s.id === parent.connectedFrom); if (gp) newFlight.width = gp.width || 100; }
        this.injectEntity(newFlight, planner);
    }
    
    injectEntity(ent, planner) {
        ent.update = function() {}; ent.setHighlight = function() {}; ent.remove = function() { planner.stairs = planner.stairs.filter(s => s !== this); };
        planner.stairs.push(ent);
    }

    deleteSelected() {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const entity = selected.userData.entity;
        
        const targets = this.getSelectionTargets(entity);
        const planner = entity.planner || window.plannerInstance?.planner;
        if (planner) {
            targets.forEach(t => {
                if (t.remove) t.remove();
                else planner.stairs = planner.stairs.filter(s => s !== t);
            });
            planner.selectEntity(null);
            planner.syncAll();
        }
        this.engine.setTransformMode('none');
    }

    detachSelected() {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const entity = selected.userData.entity;
        if (entity.connectedFrom) {
            const planner = entity.planner || window.plannerInstance?.planner;
            if (!planner) return;
            const parent = planner.stairs.find(s => s.id === entity.connectedFrom);
            if (parent && parent.connectedTo === entity.id) parent.connectedTo = null;
            
            entity.connectedFrom = null;
            entity.rotation = (parent ? parent.absRot * 180 / Math.PI : 0) + (entity.rotationOffset || 0);
            entity.x = entity.absX || 0;
            entity.y = entity.absY || 0;
            entity.elevation = entity.absElev || 0;
            
            const updateSystemId = (node, sysId) => {
                node.systemId = sysId;
                const children = planner.stairs.filter(c => c.connectedFrom === node.id);
                children.forEach(c => updateSystemId(c, sysId));
            };
            updateSystemId(entity, entity.id);
            if (entity.group) entity.group.draggable(true);
            if (planner.syncAll) planner.syncAll();
            this.updatePanel(entity);
        }
    }

    // Allows users / UI to spawn a new root stair system into the environment
    createNewStairSystem(x = 0, y = 0, elevation = 0, rotation = 0) {
        const rootId = 'stair_' + Math.random().toString(36).substr(2, 9);
        const stair = {
            id: rootId,
            type: 'stair',
            systemId: rootId,
            x: x,
            y: y,
            elevation: elevation,
            rotation: rotation,
            width: 100,
            stepCount: 10,
            stepHeight: 17.5,
            stepDepth: 28.0
        };
        if (window.plannerInstance && window.plannerInstance.entities) {
            window.plannerInstance.entities.push(stair);
            window.plannerInstance.syncAll();
        } else if (window.plannerInstance && window.plannerInstance.planner) {
            stair.update = function() {}; stair.setHighlight = function() {}; stair.remove = function() { window.plannerInstance.planner.stairs = window.plannerInstance.planner.stairs.filter(s => s !== this); };
            window.plannerInstance.planner.stairs.push(stair);
            window.plannerInstance.syncAll();
        }
    }
}