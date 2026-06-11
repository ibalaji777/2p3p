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

        const btnLanding = document.getElementById('gizmo-stair-btn-landing');
        if (btnLanding) btnLanding.onclick = () => this.addLandingToSelected();

        const btnFlight = document.getElementById('gizmo-stair-btn-flight');
        if (btnFlight) btnFlight.onclick = () => this.addFlightToSelected();

        const btnRot45 = document.getElementById('gizmo-stair-btn-rot45');
        if (btnRot45) btnRot45.onclick = () => this.rotateStairChain(45);

        const btnRot90 = document.getElementById('gizmo-stair-btn-rot90');
        if (btnRot90) btnRot90.onclick = () => this.rotateStairChain(90);

        const btnRot180 = document.getElementById('gizmo-stair-btn-rot180');
        if (btnRot180) btnRot180.onclick = () => this.rotateStairChain(180);

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

        const btnLanding = document.getElementById('gizmo-stair-btn-landing');
        const btnFlight = document.getElementById('gizmo-stair-btn-flight');
        const btnRot45 = document.getElementById('gizmo-stair-btn-rot45');
        const btnRot90 = document.getElementById('gizmo-stair-btn-rot90');
        const btnRot180 = document.getElementById('gizmo-stair-btn-rot180');
        const btnDetach = document.getElementById('gizmo-stair-btn-detach');

        if (isLanding) {
            if (btnLanding) btnLanding.style.display = 'none';
            if (btnFlight) btnFlight.style.display = 'block';
            if (btnRot45) btnRot45.style.display = 'block';
            if (btnRot90) btnRot90.style.display = 'block';
            if (btnRot180) btnRot180.style.display = 'block';
        } else {
            if (btnLanding) btnLanding.style.display = 'block';
            if (btnFlight) btnFlight.style.display = 'none';
            if (btnRot45) btnRot45.style.display = 'none';
            if (btnRot90) btnRot90.style.display = 'none';
            if (btnRot180) btnRot180.style.display = 'none';
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
        
        const plannerStairs = window.plannerInstance?.planner?.stairs || [];
        const allStairs = (window.plannerInstance?.entities || plannerStairs).filter(e => e.type === 'stair' || e.type === 'stair_landing');
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
    addLandingToSelected() {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const entity = selected.userData.entity;

        if (entity.type !== 'stair') return console.warn("Select a flight to attach landing.");

        const landing = { id: 'stair_landing_' + Math.random().toString(36).substr(2, 9), type: 'stair_landing', systemId: entity.systemId || entity.id, connectedFrom: entity.id, width: entity.width || 100, length: entity.width || 100, thickness: 20, elevation: (entity.elevation || 0) + ((entity.stepCount || 10) * (entity.stepHeight || 17.5)) };
        entity.connectedTo = landing.id;
        
        if (window.plannerInstance && window.plannerInstance.entities) {
            window.plannerInstance.entities.push(landing);
            window.plannerInstance.syncAll();
        } else if (window.plannerInstance && window.plannerInstance.planner) {
            landing.update = function() {}; landing.setHighlight = function() {}; landing.remove = function() { window.plannerInstance.planner.stairs = window.plannerInstance.planner.stairs.filter(s => s !== this); };
            window.plannerInstance.planner.stairs.push(landing);
            window.plannerInstance.syncAll();
        }
    }

    addFlightToSelected() {
        this.rotateStairChain(0);
    }

    rotateStairChain(angle) {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const entity = selected.userData.entity;

        if (entity.type !== 'stair_landing') return console.warn("Select a landing to rotate chain.");

        const plannerStairs = window.plannerInstance?.planner?.stairs || window.plannerInstance?.entities || [];
        const nextNode = plannerStairs.find(s => s.connectedFrom === entity.id);
        
        // If a flight is already attached, simply modify its rotation instead of spawning duplicates!
        if (nextNode) {
            nextNode.rotationOffset = angle;
            if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
            return;
        }

        const newFlight = { id: 'stair_' + Math.random().toString(36).substr(2, 9), type: 'stair', systemId: entity.systemId || entity.id, connectedFrom: entity.id, width: entity.width || 100, stepCount: 10, stepHeight: 17.5, stepDepth: 28.0, rotationOffset: angle, elevation: entity.elevation || 0 };
        entity.connectedTo = newFlight.id;

        if (window.plannerInstance && window.plannerInstance.entities) {
            window.plannerInstance.entities.push(newFlight);
            window.plannerInstance.syncAll();
        } else if (window.plannerInstance && window.plannerInstance.planner) {
            newFlight.update = function() {}; newFlight.setHighlight = function() {}; newFlight.remove = function() { window.plannerInstance.planner.stairs = window.plannerInstance.planner.stairs.filter(s => s !== this); };
            window.plannerInstance.planner.stairs.push(newFlight);
            window.plannerInstance.syncAll();
        }
    }

    deleteSelected() {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const entity = selected.userData.entity;
        
        const targets = this.getSelectionTargets(entity);
        const planner = window.plannerInstance?.planner;
        if (planner) {
            targets.forEach(t => {
                if (t.remove) t.remove();
                else planner.stairs = planner.stairs.filter(s => s !== t);
            });
            planner.selectEntity(null);
            planner.syncAll();
        } else if (window.plannerInstance && window.plannerInstance.entities) {
            targets.forEach(t => { window.plannerInstance.entities = window.plannerInstance.entities.filter(s => s.id !== t.id); });
            window.plannerInstance.syncAll();
        }
        this.engine.setTransformMode('none');
    }

    detachSelected() {
        const selected = this.engine.interactions.selectedObject;
        if (!selected || !selected.userData.entity) return;
        const entity = selected.userData.entity;
        if (entity.connectedFrom) {
            const plannerStairs = window.plannerInstance?.planner?.stairs || window.plannerInstance?.entities || [];
            const parent = plannerStairs.find(s => s.id === entity.connectedFrom);
            if (parent && parent.connectedTo === entity.id) parent.connectedTo = null;
            
            entity.connectedFrom = null;
            entity.rotation = (parent ? parent.absRot * 180 / Math.PI : 0) + (entity.rotationOffset || 0);
            entity.x = entity.absX || 0;
            entity.y = entity.absY || 0;
            entity.elevation = entity.absElev || 0;
            
            const updateSystemId = (node, sysId) => {
                node.systemId = sysId;
                if (node.connectedTo) {
                    const child = plannerStairs.find(c => c.id === node.connectedTo);
                    if (child) updateSystemId(child, sysId);
                }
            };
            updateSystemId(entity, entity.id);
            if (entity.group) entity.group.draggable(true);
            if (window.plannerInstance && window.plannerInstance.syncAll) window.plannerInstance.syncAll();
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