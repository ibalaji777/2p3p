import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export class MeasurementRenderer extends THREE.Group {
    constructor() {
        super();
        this.name = 'MeasurementRenderer';
        this.renderOrder = 999;
        
        const accentColor = 0x3b82f6; // CAD blue

        // 1. Measurement Line (Line2 for thickness)
        this.lineGeo = new LineGeometry();
        this.lineMat = new LineMaterial({
            color: accentColor,
            linewidth: 1.5, // in pixels
            resolution: new THREE.Vector2(window.innerWidth, window.innerHeight), // must update on resize
            dashed: false,
            depthTest: false,
            transparent: true,
            opacity: 0.6
        });
        this.line = new Line2(this.lineGeo, this.lineMat);
        this.line.renderOrder = 999;
        this.add(this.line);

        // 2. Extension Lines
        this.ext1Geo = new LineGeometry();
        this.ext1 = new Line2(this.ext1Geo, this.lineMat);
        this.ext1.renderOrder = 999;
        this.add(this.ext1);

        this.ext2Geo = new LineGeometry();
        this.ext2 = new Line2(this.ext2Geo, this.lineMat);
        this.ext2.renderOrder = 999;
        this.add(this.ext2);

        // 3. Arrow Heads
        const arrowGeo = new THREE.ConeGeometry(2, 6, 8);
        arrowGeo.translate(0, 3, 0); // Origin at the tip
        arrowGeo.rotateX(Math.PI / 2); // Point along Z axis by default
        
        const arrowMat = new THREE.MeshBasicMaterial({ 
            color: accentColor, 
            depthTest: false, 
            transparent: true,
            opacity: 0.8
        });
        
        this.arrow1 = new THREE.Mesh(arrowGeo, arrowMat);
        this.arrow1.renderOrder = 999;
        this.add(this.arrow1);
        
        this.arrow2 = new THREE.Mesh(arrowGeo, arrowMat);
        this.arrow2.renderOrder = 999;
        this.add(this.arrow2);

        // 4. CSS2D Label
        this.labelDiv = document.createElement('div');
        this.labelDiv.className = 'dimension-label-cad';
        this.label = new CSS2DObject(this.labelDiv);
        this.add(this.label);
    }

    /**
     * Updates the measurement visuals.
     * @param {THREE.Vector3} start - Start point of the measurement line
     * @param {THREE.Vector3} end - End point of the measurement line
     * @param {string} text - The dimension text
     * @param {THREE.Vector3} [extStart1] - If using extension lines, the point on the object for start
     * @param {THREE.Vector3} [extStart2] - If using extension lines, the point on the object for end
     */
    update(start, end, text, extStart1 = null, extStart2 = null) {
        // Update Line
        this.lineGeo.setPositions([
            start.x, start.y, start.z,
            end.x, end.y, end.z
        ]);
        
        // Direction vector for arrows
        const dir = new THREE.Vector3().subVectors(end, start).normalize();
        
        // Update Arrows (point outwards)
        this.arrow1.position.copy(start);
        if (dir.lengthSq() > 0) this.arrow1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir.clone().negate());
        
        this.arrow2.position.copy(end);
        if (dir.lengthSq() > 0) this.arrow2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

        // Update Label
        const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        this.label.position.copy(mid);
        this.labelDiv.textContent = text;

        // Update Extension Lines if provided
        if (extStart1 && extStart2) {
            this.ext1Geo.setPositions([
                extStart1.x, extStart1.y, extStart1.z,
                start.x, start.y, start.z
            ]);
            this.ext2Geo.setPositions([
                extStart2.x, extStart2.y, extStart2.z,
                end.x, end.y, end.z
            ]);
            this.ext1.computeLineDistances();
            this.ext2.computeLineDistances();
            this.ext1.visible = true;
            this.ext2.visible = true;
        } else {
            this.ext1.visible = false;
            this.ext2.visible = false;
        }

        // Must compute line distances after positions are set for dashed material (even if unused, prevents errors)
        this.line.computeLineDistances();
    }
    
    updateResolution(w, h) {
        this.lineMat.resolution.set(w, h);
    }
    
    setHidden(hidden) {
        if (hidden) {
            this.labelDiv.classList.add('hidden');
            this.line.visible = false;
            this.arrow1.visible = false;
            this.arrow2.visible = false;
            this.ext1.visible = false;
            this.ext2.visible = false;
        } else {
            this.labelDiv.classList.remove('hidden');
            this.line.visible = true;
            this.arrow1.visible = true;
            this.arrow2.visible = true;
            // extension lines visibility controlled by update() but let's assume they might be visible
        }
    }

    dispose() {
        this.lineGeo.dispose();
        this.lineMat.dispose();
        this.ext1Geo.dispose();
        this.ext2Geo.dispose();
        if (this.arrow1.geometry) this.arrow1.geometry.dispose();
        if (this.arrow1.material) this.arrow1.material.dispose();
        if (this.labelDiv && this.labelDiv.parentNode) {
            this.labelDiv.parentNode.removeChild(this.labelDiv);
        }
    }
}
