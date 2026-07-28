import * as THREE from 'three';

export class ShapeMirrorEngine {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Helper to compute 2D polygon area.
     */
    computePolygonArea(pts) {
        if (!pts || pts.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < pts.length; i++) {
            const j = (i + 1) % pts.length;
            area += pts[i][0] * pts[j][1];
            area -= pts[j][0] * pts[i][1];
        }
        return Math.abs(area / 2);
    }

    /**
     * Asynchronously loads a GLB model by URL/config and extracts its 2D footprint outline.
     * Works standalone in 2D mode without requiring 3D canvas renderer initialization.
     */
    async loadAndExtractFootprint(config, cacheKey = null, width = 100, depth = 100) {
        if (!config || !config.model) return null;
        const key = cacheKey || config.id;
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        try {
            let url = config.model;
            if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('/')) {
                url = '/' + url;
            }

            const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
            const loader = new GLTFLoader();
            const gltf = await loader.loadAsync(url);
            const modelScene = gltf.scene;

            const wrapper = new THREE.Group();
            wrapper.add(modelScene);

            const box = new THREE.Box3().setFromObject(modelScene);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            modelScene.position.set(-center.x, -box.min.y, -center.z);

            const safeW = size.x > 0 ? size.x : 1;
            const safeD = size.z > 0 ? size.z : 1;
            wrapper.scale.set(width / safeW, 1, depth / safeD);
            wrapper.updateMatrixWorld(true);

            return this.extractFootprint(wrapper, key, true, width, depth);
        } catch (e) {
            console.error('[ShapeMirrorEngine] Failed to load & extract footprint for model:', config.model, e);
            return null;
        }
    }

    /**
     * Extracts an exact 2D footprint outline from an arbitrary 3D model (GLB/procedural).
     */
    extractFootprint(object3D, cacheKey = null, forceRecompute = false, width = 100, depth = 100) {
        if (cacheKey && !forceRecompute && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        if (!object3D) return null;

        // Save original transforms
        const originalPosition = object3D.position.clone();
        const originalQuaternion = object3D.quaternion.clone();

        // Reset object root to origin for local space footprint extraction
        object3D.position.set(0, 0, 0);
        object3D.quaternion.identity();
        object3D.updateMatrixWorld(true);

        const triangles = [];
        let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

        const isChainVisible = (obj) => {
            let current = obj;
            while (current && current !== object3D.parent) {
                if (current.visible === false) return false;
                current = current.parent;
            }
            return true;
        };

        object3D.traverse((child) => {
            if (child.isMesh && child.geometry && isChainVisible(child)) {
                if (child.userData?.isHitbox || child.userData?.isGizmo) return;
                if (child.name && (child.name.includes('boundingBox') || child.name.includes('gizmo') || child.name.includes('helper') || child.name.includes('hitBox'))) return;

                const posAttr = child.geometry.attributes.position;
                if (!posAttr || posAttr.count === 0) return;
                const indexAttr = child.geometry.index;

                const vA = new THREE.Vector3();
                const vB = new THREE.Vector3();
                const vC = new THREE.Vector3();

                const addTriangle = (a, b, c) => {
                    vA.fromBufferAttribute(posAttr, a).applyMatrix4(child.matrixWorld);
                    vB.fromBufferAttribute(posAttr, b).applyMatrix4(child.matrixWorld);
                    vC.fromBufferAttribute(posAttr, c).applyMatrix4(child.matrixWorld);

                    const pA = [vA.x, vA.z];
                    const pB = [vB.x, vB.z];
                    const pC = [vC.x, vC.z];

                    const area2D = Math.abs((pB[0] - pA[0]) * (pC[1] - pA[1]) - (pC[0] - pA[0]) * (pB[1] - pA[1]));
                    if (area2D < 1e-7) return;

                    triangles.push([pA, pB, pC]);

                    minX = Math.min(minX, pA[0], pB[0], pC[0]);
                    maxX = Math.max(maxX, pA[0], pB[0], pC[0]);
                    minZ = Math.min(minZ, pA[1], pB[1], pC[1]);
                    maxZ = Math.max(maxZ, pA[1], pB[1], pC[1]);
                };

                if (indexAttr) {
                    for (let i = 0; i < indexAttr.count; i += 3) {
                        addTriangle(indexAttr.getX(i), indexAttr.getX(i + 1), indexAttr.getX(i + 2));
                    }
                } else {
                    for (let i = 0; i < posAttr.count; i += 3) {
                        addTriangle(i, i + 1, i + 2);
                    }
                }
            }
        });

        object3D.position.copy(originalPosition);
        object3D.quaternion.copy(originalQuaternion);
        object3D.updateMatrixWorld(true);

        if (triangles.length === 0) return null;

        if (!isFinite(minX)) {
            minX = -width / 2;
            maxX = width / 2;
            minZ = -depth / 2;
            maxZ = depth / 2;
        }

        const bW = maxX - minX;
        const bD = maxZ - minZ;

        const maxDimension = Math.max(bW, bD, 1);
        const targetDpi = Math.max(8, Math.min(24, 1024 / maxDimension));
        const marginPixels = 8;
        const resX = Math.min(1024, Math.max(256, Math.ceil(bW * targetDpi) + marginPixels * 2));
        const resY = Math.min(1024, Math.max(256, Math.ceil(bD * targetDpi) + marginPixels * 2));

        const scaleX = (resX - marginPixels * 2) / (bW || 1);
        const scaleY = (resY - marginPixels * 2) / (bD || 1);
        const scale = Math.min(scaleX, scaleY);

        const offsetX = resX / 2 - (minX + bW / 2) * scale;
        const offsetY = resY / 2 - (minZ + bD / 2) * scale;

        const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
        let ctx = null;
        if (canvas) {
            try {
                ctx = canvas.getContext('2d', { willReadFrequently: true });
            } catch (e) {
                ctx = null;
            }
        }

        let getPixel;

        if (ctx) {
            canvas.width = resX;
            canvas.height = resY;
            ctx.fillStyle = 'black';
            ctx.beginPath();
            for (const tri of triangles) {
                ctx.moveTo(tri[0][0] * scale + offsetX, tri[0][1] * scale + offsetY);
                ctx.lineTo(tri[1][0] * scale + offsetX, tri[1][1] * scale + offsetY);
                ctx.lineTo(tri[2][0] * scale + offsetX, tri[2][1] * scale + offsetY);
            }
            ctx.fill();

            const rawData = ctx.getImageData(0, 0, resX, resY).data;
            getPixel = (x, y) => {
                if (x < 0 || y < 0 || x >= resX || y >= resY) return 0;
                return rawData[(y * resX + x) * 4 + 3] > 128 ? 1 : 0;
            };
        } else {
            const grid = new Uint8Array(resX * resY);
            for (const tri of triangles) {
                const p0 = [tri[0][0] * scale + offsetX, tri[0][1] * scale + offsetY];
                const p1 = [tri[1][0] * scale + offsetX, tri[1][1] * scale + offsetY];
                const p2 = [tri[2][0] * scale + offsetX, tri[2][1] * scale + offsetY];

                const minPx = Math.max(0, Math.floor(Math.min(p0[0], p1[0], p2[0])));
                const maxPx = Math.min(resX - 1, Math.ceil(Math.max(p0[0], p1[0], p2[0])));
                const minPy = Math.max(0, Math.floor(Math.min(p0[1], p1[1], p2[1])));
                const maxPy = Math.min(resY - 1, Math.ceil(Math.max(p0[1], p1[1], p2[1])));

                const edge = (a, b, c) => (c[0] - a[0]) * (b[1] - a[1]) - (c[1] - a[1]) * (b[0] - a[0]);
                for (let y = minPy; y <= maxPy; y++) {
                    for (let x = minPx; x <= maxPx; x++) {
                        const pt = [x + 0.5, y + 0.5];
                        const w0 = edge(p1, p2, pt);
                        const w1 = edge(p2, p0, pt);
                        const w2 = edge(p0, p1, pt);
                        if ((w0 >= 0 && w1 >= 0 && w2 >= 0) || (w0 <= 0 && w1 <= 0 && w2 <= 0)) {
                            grid[y * resX + x] = 1;
                        }
                    }
                }
            }
            getPixel = (x, y) => {
                if (x < 0 || y < 0 || x >= resX || y >= resY) return 0;
                return grid[y * resX + x];
            };
        }

        const msCases = [
            [],
            [[3, 2]],
            [[2, 1]],
            [[3, 1]],
            [[1, 0]],
            [[3, 2], [1, 0]],
            [[2, 0]],
            [[3, 0]],
            [[0, 3]],
            [[0, 2]],
            [[0, 3], [2, 1]],
            [[0, 1]],
            [[1, 3]],
            [[1, 2]],
            [[2, 3]],
            []
        ];

        const segments = [];
        for (let y = 0; y < resY - 1; y++) {
            for (let x = 0; x < resX - 1; x++) {
                const tl = getPixel(x, y);
                const tr = getPixel(x + 1, y);
                const bl = getPixel(x, y + 1);
                const br = getPixel(x + 1, y + 1);
                const state = (tl << 3) | (tr << 2) | (br << 1) | bl;
                if (state === 0 || state === 15) continue;

                const getEdgeCoord = (edge) => {
                    if (edge === 0) return [x + 0.5, y];
                    if (edge === 1) return [x + 1, y + 0.5];
                    if (edge === 2) return [x + 0.5, y + 1];
                    if (edge === 3) return [x, y + 0.5];
                };

                for (let line of msCases[state]) {
                    segments.push([getEdgeCoord(line[0]), getEdgeCoord(line[1])]);
                }
            }
        }

        if (segments.length === 0) return null;

        const rawPaths = this.linkSegmentsToClosedPaths(segments);

        const targetWidth = (width && width > 0) ? width : (bW || 100);
        const targetDepth = (depth && depth > 0) ? depth : (bD || 100);

        const fitScaleX = (bW > 0) ? (targetWidth / bW) : 1;
        const fitScaleY = (bD > 0) ? (targetDepth / bD) : 1;

        const candidatePaths = [];
        const tightEpsilonPixels = 0.35;

        for (let p of rawPaths) {
            if (p.length < 3) continue;

            const simplified = this.simplifyClosedPolygon(p, tightEpsilonPixels);
            if (simplified.length < 3) continue;

            const phys = simplified.map(pt => [
                ((pt[0] - offsetX) / scale) * fitScaleX,
                ((pt[1] - offsetY) / scale) * fitScaleY
            ]);

            candidatePaths.push({ pts: phys, area: this.computePolygonArea(phys) });
        }

        if (candidatePaths.length === 0) return null;

        const maxArea = Math.max(...candidatePaths.map(cp => cp.area));

        const physicalPaths = candidatePaths
            .filter(cp => cp.area >= Math.max(25, maxArea * 0.02))
            .map(cp => cp.pts);

        if (physicalPaths.length === 0) {
            const largest = candidatePaths.reduce((prev, curr) => curr.area > prev.area ? curr : prev);
            physicalPaths.push(largest.pts);
        }

        if (cacheKey) this.cache.set(cacheKey, physicalPaths);
        return physicalPaths;
    }

    linkSegmentsToClosedPaths(segments) {
        const keyOf = (p) => `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
        const edgeKey = (k1, k2) => k1 < k2 ? `${k1}|${k2}` : `${k2}|${k1}`;

        const adj = new Map();

        const addEdge = (p1, p2) => {
            const k1 = keyOf(p1);
            const k2 = keyOf(p2);
            if (!adj.has(k1)) adj.set(k1, []);
            if (!adj.has(k2)) adj.set(k2, []);
            adj.get(k1).push({ point: p2, key: k2 });
            adj.get(k2).push({ point: p1, key: k1 });
        };

        for (let seg of segments) {
            addEdge(seg[0], seg[1]);
        }

        const visitedEdges = new Set();
        const paths = [];

        for (let seg of segments) {
            const kA = keyOf(seg[0]);
            const kB = keyOf(seg[1]);
            const eKey = edgeKey(kA, kB);

            if (visitedEdges.has(eKey)) continue;

            const startKey = kA;
            let currPt = seg[0];
            let currKey = kA;
            const currentPath = [];

            while (true) {
                currentPath.push(currPt);
                const neighbors = adj.get(currKey) || [];

                let nextNeighbor = null;
                for (let n of neighbors) {
                    const ek = edgeKey(currKey, n.key);
                    if (!visitedEdges.has(ek)) {
                        visitedEdges.add(ek);
                        nextNeighbor = n;
                        break;
                    }
                }

                if (!nextNeighbor) break;
                currPt = nextNeighbor.point;
                currKey = nextNeighbor.key;

                if (currKey === startKey) {
                    break;
                }
            }

            if (currentPath.length >= 3) {
                paths.push(currentPath);
            }
        }

        return paths;
    }

    simplifyClosedPolygon(points, epsilon) {
        if (points.length <= 4) return points;
        const simplified = this.simplifyPath(points, epsilon);
        if (simplified.length < 3) return points;
        return simplified;
    }

    simplifyPath(points, epsilon) {
        if (points.length <= 3) return points;

        let maxDist = 0;
        let index = 0;
        const end = points.length - 1;
        const p1 = points[0];
        const p2 = points[end];

        for (let i = 1; i < end; i++) {
            const p = points[i];
            const num = Math.abs((p2[1] - p1[1]) * p[0] - (p2[0] - p1[0]) * p[1] + p2[0] * p1[1] - p2[1] * p1[0]);
            const den = Math.sqrt(Math.pow(p2[1] - p1[1], 2) + Math.pow(p2[0] - p1[0], 2));
            const dist = den === 0 ? Math.sqrt(Math.pow(p[0] - p1[0], 2) + Math.pow(p[1] - p1[1], 2)) : num / den;

            if (dist > maxDist) {
                maxDist = dist;
                index = i;
            }
        }

        if (maxDist > epsilon) {
            const left = this.simplifyPath(points.slice(0, index + 1), epsilon);
            const right = this.simplifyPath(points.slice(index), epsilon);
            return left.slice(0, left.length - 1).concat(right);
        } else {
            return [p1, p2];
        }
    }

    pointsToSvg(paths) {
        if (!paths || paths.length === 0) return '';
        let svgPath = '';
        for (const path of paths) {
            if (!path || path.length < 3) continue;
            for (let i = 0; i < path.length; i++) {
                const p = path[i];
                svgPath += (i === 0 ? 'M ' : 'L ') + `${p[0].toFixed(2)} ${p[1].toFixed(2)} `;
            }
            svgPath += 'Z ';
        }
        return svgPath.trim();
    }
}

export const globalShapeMirror = new ShapeMirrorEngine();
