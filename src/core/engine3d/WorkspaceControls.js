import * as THREE from 'three';

export class WorkspaceControls {
    constructor(preview3D, planner) {
        this.preview3D = preview3D;
        this.camera = preview3D.camera;
        this.controls = preview3D.controls; // OrbitControls
        this.planner = planner; // 2D FloorPlanner instance

        const w = window.innerWidth;
        const h = window.innerHeight;
        const aspect = w / h;
        this.orthoCamera = new THREE.OrthographicCamera(-w/2, w/2, h/2, -h/2, 1, 10000);
        this.perspCamera = this.camera;

        this.currentPreset = 'iso';
        this.isCameraControlsVisible = true;
        this.isPanning2D = false;
        this.lastPanPos = { x: 0, y: 0 };
        
        this.init2DMouseControls();
    }

    // --- 3D Controls ---

    zoomIn3D(factor = 0.8) {
        if (this.preview3D.camera.isOrthographicCamera) {
            this.preview3D.camera.zoom /= factor;
            this.preview3D.camera.updateProjectionMatrix();
        } else {
            const dist = this.preview3D.camera.position.distanceTo(this.controls.target);
            this.preview3D.camera.translateZ(-dist * (1 - factor));
        }
    }

    zoomOut3D(factor = 1.2) {
        if (this.preview3D.camera.isOrthographicCamera) {
            this.preview3D.camera.zoom /= factor;
            this.preview3D.camera.updateProjectionMatrix();
        } else {
            const dist = this.preview3D.camera.position.distanceTo(this.controls.target);
            this.preview3D.camera.translateZ(dist * (factor - 1));
        }
    }

    getBuildingBoundingBox() {
        const box = new THREE.Box3();
        // Encapsulate main drawing layers to identify bounds
        if (this.preview3D.structureGroup) {
            box.setFromObject(this.preview3D.structureGroup);
        }
        if (this.preview3D.staticStructureGroup && this.preview3D.staticStructureGroup.children.length > 0) {
            const staticBox = new THREE.Box3().setFromObject(this.preview3D.staticStructureGroup);
            if (!staticBox.isEmpty()) box.union(staticBox);
        }
        if (box.isEmpty()) {
            box.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(1000, 1000, 1000));
        }
        return box;
    }

    setCameraPosition(preset) {
        this.currentPreset = preset;
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        
        const maxDim = Math.max(size.x, size.y, size.z, 500);
        const offset = maxDim * 1.5;

        const w = this.preview3D.container.clientWidth || window.innerWidth;
        const h = this.preview3D.container.clientHeight || window.innerHeight;
        const aspect = w / h;

        if (preset === 'top' || preset === 'left') {
            // 1. Swap to Orthographic for 2D Plan/Elevation Projections
            this.preview3D.camera = this.orthoCamera;
            this.controls.object = this.orthoCamera;
            if (this.preview3D.interactions) this.preview3D.interactions.camera = this.orthoCamera;
            
            const frustumSize = maxDim * 1.2;
            this.orthoCamera.left = -frustumSize * aspect / 2;
            this.orthoCamera.right = frustumSize * aspect / 2;
            this.orthoCamera.top = frustumSize / 2;
            this.orthoCamera.bottom = -frustumSize / 2;

            this.orthoCamera.near = 1;
            this.orthoCamera.far = offset + maxDim * 2; // Make sure far plane is far enough

            this.orthoCamera.zoom = 1;
            this.orthoCamera.updateProjectionMatrix();

            this.controls.enableRotate = false;
            this.controls.enablePan = true;
            this.controls.enableZoom = true;
            
            if (preset === 'top') {
                this.orthoCamera.position.set(center.x, center.y + offset, center.z);
            } else if (preset === 'left') {
                this.orthoCamera.position.set(center.x - offset, center.y, center.z);
            }
        } else {
            // 2. Restore Perspective for 3D Angled views
            this.preview3D.camera = this.perspCamera;
            this.controls.object = this.perspCamera;
            if (this.preview3D.interactions) this.preview3D.interactions.camera = this.perspCamera;
            
            const mode = this.preview3D.interactions ? this.preview3D.interactions.mode : 'camera';
            this.controls.enableRotate = (mode === 'camera');
            this.controls.enablePan = true;
            this.controls.enableZoom = true;

            if (preset === 'iso') {
                this.perspCamera.position.set(center.x + offset, center.y + offset, center.z + offset);
            } else if (preset === 'front') {
                this.perspCamera.position.set(center.x, center.y + offset * 0.2, center.z + offset);
            }
        }
        
        this.controls.target.copy(center);
        this.preview3D.camera.lookAt(center);
        this.controls.update();
        this.preview3D.resize();
    }

    updateCameraBounds() {
        if (!this.currentPreset) return;
        
        const box = this.getBuildingBoundingBox();
        const center = new THREE.Vector3();
        box.getCenter(center);
        const size = new THREE.Vector3();
        box.getSize(size);
        const maxDim = Math.max(size.x, size.y, size.z, 500);

        // Pan nicely to the new center
        const delta = center.clone().sub(this.controls.target);
        this.controls.target.copy(center);
        this.preview3D.camera.position.add(delta);

        // Ensure building doesn't clip out of frustum boundaries
        if (this.preview3D.camera.isOrthographicCamera) {
            const w = this.preview3D.container.clientWidth || window.innerWidth;
            const h = this.preview3D.container.clientHeight || window.innerHeight;
            const aspect = w / h;
            const frustumSize = maxDim * 1.2;
            
            this.preview3D.camera.left = -frustumSize * aspect / 2;
            this.preview3D.camera.right = frustumSize * aspect / 2;
            this.preview3D.camera.top = frustumSize / 2;
            this.preview3D.camera.bottom = -frustumSize / 2;

            const offset = maxDim * 1.5;
            this.preview3D.camera.far = offset + maxDim * 2;

            this.preview3D.camera.updateProjectionMatrix();
        }

        this.controls.update();
    }

    toggleCameraHelper(visible) {
        this.isCameraControlsVisible = visible;
        // In a more advanced setup, you might show/hide a camera gizmo in the scene
        console.log("Camera controls visibility:", this.isCameraControlsVisible);
    }

    rotateCamera(angle) {
        if (!this.controls) return;
        this.controls.rotateLeft(angle);
    }
    
    init2DMouseControls() {
        if (!this.planner || !this.planner.stage) return;
        const stage = this.planner.stage;

        // Mouse Wheel Zoom
        stage.on('wheel', (e) => {
            e.evt.preventDefault();
            const oldScale = stage.scaleX();
            const pointer = stage.getPointerPosition();
            if (!pointer) return;

            const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale };
            const direction = e.evt.deltaY > 0 ? -1 : 1;
            const scaleBy = 1.1;
            const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

            stage.scale({ x: newScale, y: newScale });
            const newPos = { x: pointer.x - mousePointTo.x * newScale, y: pointer.y - mousePointTo.y * newScale };
            stage.position(newPos);
            stage.batchDraw();
        });

        // Right Click / Middle Click Pan
        stage.on('mousedown', (e) => {
            if (e.evt.button === 1 || e.evt.button === 2) {
                e.evt.preventDefault();
                this.isPanning2D = true;
                this.lastPanPos = { x: e.evt.clientX, y: e.evt.clientY };
                stage.container().style.cursor = 'grabbing';
                document.body.style.cursor = '';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.isPanning2D) return;
            e.preventDefault();
            const dx = e.clientX - this.lastPanPos.x; const dy = e.clientY - this.lastPanPos.y;
            this.lastPanPos = { x: e.clientX, y: e.clientY };
            stage.position({ x: stage.x() + dx, y: stage.y() + dy });
            stage.batchDraw();
        });

        window.addEventListener('mouseup', (e) => {
            if (this.isPanning2D && (e.button === 1 || e.button === 2)) {
                this.isPanning2D = false;
                if (this.planner && this.planner.stage) {
                    this.planner.stage.container().style.cursor = this.planner.tool === 'select' ? 'grab' : 'crosshair';
                    document.body.style.cursor = '';
                }
            }
        });
        
        stage.on('contextmenu', (e) => e.evt.preventDefault()); // Prevent browser menu on right click
    }


    // --- 2D Controls ---

    zoomIn2D(factor = 1.1) {
        if (!this.planner || !this.planner.stage) return;
        const stage = this.planner.stage;
        const oldScale = stage.scaleX();
        const newScale = oldScale * factor;

        const pointer = stage.getPointerPosition() || { x: stage.width() / 2, y: stage.height() / 2 };
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        stage.scale({ x: newScale, y: newScale });
        const newPos = {
            x: pointer.x - mousePointTo.x * newScale,
            y: pointer.y - mousePointTo.y * newScale,
        };
        stage.position(newPos);
        stage.batchDraw();
    }

    zoomOut2D(factor = 0.9) {
        // This is essentially the same logic as zoomIn but with a smaller factor
        this.zoomIn2D(factor);
    }

    resetZoom2D() {
        if (!this.planner || !this.planner.stage) return;
        this.planner.stage.scale({ x: 1, y: 1 });
        this.planner.stage.position({ x: 0, y: 0 });
        this.planner.stage.batchDraw();
    }
}