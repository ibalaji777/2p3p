import * as THREE from 'three';

export class BaseSceneSetup {
    constructor(scene) {
        this.scene = scene;
    }

    setup() {
        this.scene.background = new THREE.Color(0xf3f4f6);
        this.scene.fog = new THREE.FogExp2(0xf3f4f6, 0.0008);

        const groundGeo = new THREE.PlaneGeometry(10000, 10000);
        const groundMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1.0 });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const grid = new THREE.GridHelper(5000, 250, 0x000000, 0x000000);
        grid.material.opacity = 0.05;
        grid.material.transparent = true;
        this.scene.add(grid);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 3.0);
        hemiLight.position.set(0, 500, 0);
        this.scene.add(hemiLight);

        const sunLight = new THREE.DirectionalLight(0xfffaed, 5.0);
        sunLight.position.set(300, 600, 400);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.bias = -0.0005;
        const d = 800;
        sunLight.shadow.camera.left = -d; sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d; sunLight.shadow.camera.bottom = -d;
        this.scene.add(sunLight);
    }
}