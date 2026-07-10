import * as THREE from 'three';

export class NavigationCube {
    constructor(container, cameraController) {
        this.container = container;
        this.cameraController = cameraController;
        
        this.size = 100; // UI size in pixels
        this.init();
    }

    init() {
        // Create container for the cube
        this.domElement = document.createElement('div');
        this.domElement.style.position = 'absolute';
        this.domElement.style.top = '20px';
        this.domElement.style.right = '20px';
        this.domElement.style.width = `${this.size}px`;
        this.domElement.style.height = `${this.size}px`;
        this.domElement.style.zIndex = '1000';
        this.domElement.style.cursor = 'pointer';
        this.domElement.style.transition = 'opacity 0.3s ease';
        this.domElement.style.opacity = '0.7';
        
        this.domElement.addEventListener('mouseenter', () => this.domElement.style.opacity = '1');
        this.domElement.addEventListener('mouseleave', () => this.domElement.style.opacity = '0.7');

        this.container.appendChild(this.domElement);

        this.scene = new THREE.Scene();
        
        // Orthographic camera for the UI cube
        this.camera = new THREE.OrthographicCamera(-1.5, 1.5, 1.5, -1.5, 0.1, 10);
        this.camera.position.set(0, 0, 5);

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.renderer.setSize(this.size, this.size);
        this.domElement.appendChild(this.renderer.domElement);

        this.createCube();
        
        // Bright Lighting to ensure the cube looks pure white
        const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
        this.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(2, 3, 4);
        this.scene.add(dirLight);

        this.setupInteractions();
    }

    createCube() {
        this.cubeGroup = new THREE.Group();
        this.scene.add(this.cubeGroup);

        const geometry = new THREE.BoxGeometry(2, 2, 2);
        
        // High resolution premium materials
        this.materials = [
            this.createTextMaterial('RIGHT'),
            this.createTextMaterial('LEFT'),
            this.createTextMaterial('TOP'),
            this.createTextMaterial('BOTTOM'),
            this.createTextMaterial('FRONT'),
            this.createTextMaterial('BACK')
        ];

        this.cubeMesh = new THREE.Mesh(geometry, this.materials);
        this.cubeGroup.add(this.cubeMesh);

        // Add solid light gray edges to define the 3D shape
        const edgesGeometry = new THREE.EdgesGeometry(geometry);
        const edgesMaterial = new THREE.LineBasicMaterial({ color: 0xd0d0d0, linewidth: 2 });
        this.cubeEdges = new THREE.LineSegments(edgesGeometry, edgesMaterial);
        this.cubeGroup.add(this.cubeEdges);
        
        // Add a container for offset rotation
        this.cubeOffsetGroup = new THREE.Group();
        this.cubeGroup.add(this.cubeOffsetGroup);
        
        // Move mesh and edges into the offset group
        this.cubeGroup.remove(this.cubeMesh);
        this.cubeGroup.remove(this.cubeEdges);
        this.cubeOffsetGroup.add(this.cubeMesh);
        this.cubeOffsetGroup.add(this.cubeEdges);
    }

    setEntranceFacing(facing) {
        let angle = 0;
        switch (facing) {
            case 'south': angle = 0; break;
            case 'east': angle = -Math.PI / 2; break;
            case 'north': angle = Math.PI; break;
            case 'west': angle = Math.PI / 2; break;
            case 'south_east': angle = -Math.PI / 4; break;
            case 'north_east': angle = -3 * Math.PI / 4; break;
            case 'south_west': angle = Math.PI / 4; break;
            case 'north_west': angle = 3 * Math.PI / 4; break;
        }
        if (this.cubeOffsetGroup) {
            // Apply a smooth animation to the offset group
            const targetRotation = new THREE.Euler(0, angle, 0);
            this.cubeOffsetGroup.setRotationFromEuler(targetRotation);
        }
    }

    createTextMaterial(text) {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Solid White faces (#FFFFFF)
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, size, size);
        
        // Soft shadow under the border/bevel
        ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;

        // Light gray borders (#D0D0D0) with a slight bevel (rounded inner rect)
        ctx.strokeStyle = '#D0D0D0';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(4, 4, size - 8, size - 8, 16); // slight bevel effect
        ctx.stroke();

        // Dark gray text (#555555)
        ctx.shadowColor = 'transparent'; // Remove shadow for crisp text
        ctx.fillStyle = '#555555';
        ctx.font = 'bold 48px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, size / 2, size / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy() || 4;
        
        // Slight glossy finish
        return new THREE.MeshPhongMaterial({ 
            map: texture, 
            shininess: 40,
            specular: 0x444444,
            color: 0xffffff
        });
    }

    highlightFace(faceIndex) {
        for (let i = 0; i < 6; i++) {
            if (i === faceIndex) {
                // Blue highlight for hovered/selected face (#2D8CFF)
                this.materials[i].emissive.setHex(0x2D8CFF);
                this.materials[i].emissiveIntensity = 0.3;
                this.materials[i].color.setHex(0xeff6ff); 
            } else {
                this.materials[i].emissive.setHex(0x000000);
                this.materials[i].color.setHex(0xffffff);
            }
        }
    }

    setupInteractions() {
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        
        let isDragging = false;
        let startPos = { x: 0, y: 0 };
        let hasMoved = false;
        let lastTapTime = 0;

        const onPointerDown = (e) => {
            isDragging = true;
            hasMoved = false;
            startPos = { x: e.clientX, y: e.clientY };
            this.domElement.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e) => {
            const rect = this.domElement.getBoundingClientRect();
            this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            if (isDragging) {
                const dx = e.clientX - startPos.x;
                const dy = e.clientY - startPos.y;
                
                if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
                    hasMoved = true;
                    // Forward drag to camera controller
                    // Positive dx (drag right) -> rotateLeft(dx), which orbits camera left, making cube spin right.
                    // Positive dy (drag down) -> rotateUp(dy), which orbits camera up, making cube spin down.
                    // We use 0.03 for sensitivity so dragging across the 100px cube rotates it roughly 90+ degrees.
                    this.cameraController.orbitBy(dx * 0.03, dy * 0.03);
                    startPos = { x: e.clientX, y: e.clientY };
                }
                this.highlightFace(-1);
            } else {
                // Raycast to highlight faces on hover
                this.raycaster.setFromCamera(this.mouse, this.camera);
                const intersects = this.raycaster.intersectObject(this.cubeMesh);
                if (intersects.length > 0) {
                    const hitIndex = Math.floor(intersects[0].faceIndex / 2);
                    this.highlightFace(hitIndex);
                } else {
                    this.highlightFace(-1);
                }
            }
        };

        const onPointerUp = (e) => {
            if (!isDragging) return;
            isDragging = false;
            this.domElement.releasePointerCapture(e.pointerId);
            
            if (!hasMoved) {
                const now = Date.now();
                if (now - lastTapTime < 300) {
                    // Double tap detected
                    this.cameraController.resetCamera();
                    lastTapTime = 0; // reset
                } else {
                    lastTapTime = now;
                    this.handleClick(e);
                }
            }
        };

        const onPointerLeave = (e) => {
            this.highlightFace(-1);
        };

        this.domElement.addEventListener('pointerdown', onPointerDown);
        this.domElement.addEventListener('pointermove', onPointerMove);
        this.domElement.addEventListener('pointerup', onPointerUp);
        this.domElement.addEventListener('pointerleave', onPointerLeave);
    }

    handleClick(e) {
        const rect = this.domElement.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        // Intersect against the offset group's children (the mesh)
        const intersects = this.raycaster.intersectObject(this.cubeMesh);

        if (intersects.length > 0) {
            const hit = intersects[0];
            
            // To figure out the correct camera direction to move to,
            // we need the normal in the world space of the cube group (which is aligned with the main camera world).
            // The hit.face.normal is in the local space of the geometry.
            const normalMatrix = new THREE.Matrix3().getNormalMatrix(this.cubeMesh.matrixWorld);
            const worldNormal = hit.face.normal.clone().applyMatrix3(normalMatrix).normalize();
            
            // Determine direction vector based on hit point, ignoring the offset.
            // Actually, we want the camera to look AT the cube from the face clicked.
            // If the user clicks "FRONT", and "FRONT" is rotated to face East (+X),
            // The worldNormal of that face will be +X.
            // So we just use the worldNormal!
            
            // For edges and corners, we can just use the intersection point in world space relative to the cube group's center.
            const centerWorld = new THREE.Vector3();
            this.cubeGroup.getWorldPosition(centerWorld);
            const hitWorld = hit.point.clone(); // already in world space of the UI scene
            
            const direction = hitWorld.sub(centerWorld).normalize();

            // Snap direction to major axes/diagonals
            const threshold = 0.4;
            let x = 0, y = 0, z = 0;
            if (direction.x > threshold) x = 1;
            else if (direction.x < -threshold) x = -1;
            
            if (direction.y > threshold) y = 1;
            else if (direction.y < -threshold) y = -1;
            
            if (direction.z > threshold) z = 1;
            else if (direction.z < -threshold) z = -1;

            if (x === 0 && y === 0 && z === 0) {
                x = worldNormal.x; y = worldNormal.y; z = worldNormal.z;
            }

            const snappedDirection = new THREE.Vector3(x, y, z).normalize();
            this.cameraController.setCameraDirection(snappedDirection);
        }
    }

    update(mainCamera) {
        // Sync cube rotation with main camera
        // We position the UI camera at a distance of 5 along the main camera's local Z axis,
        // and apply the main camera's rotation so it looks directly at the origin (the cube).
        this.camera.quaternion.copy(mainCamera.quaternion);
        this.camera.position.set(0, 0, 5).applyQuaternion(mainCamera.quaternion);
        this.renderer.render(this.scene, this.camera);
    }

    dispose() {
        if (this.domElement && this.domElement.parentNode) {
            this.domElement.parentNode.removeChild(this.domElement);
        }
        this.renderer.dispose();
    }
}
