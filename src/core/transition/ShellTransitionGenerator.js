import * as THREE from 'three';
import { ComponentRegistry } from '../engine3d/ComponentRegistry.js';

/**
 * ShellTransitionGenerator
 * 
 * Specialized CAD/BIM 3D Geometry Generator for Architectural Shell Transitions
 * between Wall Top Boundaries and Roof Soffits / Ceilings.
 * 
 * Features:
 * 1. Parametric transition profiles:
 *    - 'cove': Smooth concave circular hollow blending wall top into ceiling/soffit.
 *    - 'chamfer': 45° or custom diagonal mitered architectural bevel.
 *    - 'fillet' / 'quarter_round': Smooth convex quarter-circle curve.
 *    - 'stepped': Classical multi-facet architectural frieze / corbel.
 *    - 'vault': Continuous C-curved barrel vault transition.
 * 2. Precision 3D Corner Mitering:
 *    - Calculates radial bisector vectors at all path vertices.
 *    - Anti-spike miter scaling with safe clamping (1 / cos(halfAngle)).
 *    - Gapless carpentry-grade corner joints on acute, right, and obtuse angles.
 * 3. Continuous 2D/3D UV Projection:
 *    - World-scale UVs mapped along path length (U) and profile perimeter (V).
 * 4. 3-Layer BIM Integration:
 *    - Registers with ComponentRegistry under slot 'transition'.
 */
export class ShellTransitionGenerator {

    /**
     * Generates a 2D profile array of {x, y} coordinates.
     * x: horizontal projection outward/inward from wall (cm)
     * y: vertical offset (0 is ceiling/soffit level, negative is drop down wall)
     * 
     * @param {string} type - 'cove' | 'chamfer' | 'fillet' | 'stepped' | 'quarter_round' | 'vault'
     * @param {number} size - Horizontal projection in cm (default: 20)
     * @param {number} drop - Vertical drop down wall in cm (default: 20)
     * @param {number} subdivisions - Resolution for curved profiles (default: 8)
     * @param {boolean} invert - If true, flips horizontal direction
     * @returns {Array<{x: number, y: number}>}
     */
    static getProfilePoints(type = 'cove', size = 20, drop = 20, subdivisions = 8, invert = false) {
        const S = Math.max(1, Number(size) || 20);
        const D = Math.max(1, Number(drop) || 20);
        const N = Math.max(2, subdivisions || 8);
        const pts = [];

        const sign = invert ? -1 : 1;

        switch (type.toLowerCase()) {
            case 'chamfer':
            case 'bevel': {
                pts.push({ x: 0, y: -D });
                pts.push({ x: S * sign, y: 0 });
                break;
            }

            case 'fillet':
            case 'quarter_round':
            case 'convex': {
                // Convex curve from (0, -D) to (S, 0)
                for (let i = 0; i <= N; i++) {
                    const t = i / N;
                    const angle = t * (Math.PI / 2);
                    const x = S * Math.sin(angle) * sign;
                    const y = -D * Math.cos(angle);
                    pts.push({ x, y });
                }
                break;
            }

            case 'stepped':
            case 'frieze': {
                // 3-step classical corbelled profile
                const steps = 3;
                for (let i = 0; i <= steps; i++) {
                    const x = (S * (i / steps)) * sign;
                    const y = -D + (D * (i / steps));
                    if (i > 0 && i < steps) {
                        pts.push({ x: (S * ((i - 1) / steps)) * sign, y });
                    }
                    pts.push({ x, y });
                }
                break;
            }

            case 'vault':
            case 'c_vault': {
                // Smooth C-vault curve
                for (let i = 0; i <= N; i++) {
                    const t = i / N;
                    const angle = t * Math.PI;
                    const x = S * Math.sin(angle) * sign;
                    const y = -D * (1 - Math.cos(angle)) / 2;
                    pts.push({ x, y });
                }
                break;
            }

            case 'cove':
            default: {
                // Classical concave cove hollow from (0, -D) to (S, 0)
                for (let i = 0; i <= N; i++) {
                    const t = i / N;
                    const angle = t * (Math.PI / 2);
                    const x = S * (1 - Math.cos(angle)) * sign;
                    const y = -D * (1 - Math.sin(angle));
                    pts.push({ x, y });
                }
                break;
            }
        }

        return pts;
    }

    /**
     * Generates a 3D BufferGeometry for a wall-to-roof shell transition along a path.
     * 
     * @param {Array<{x: number, y: number, z?: number}>} pathPoints - Sequence of 2D/3D points
     * @param {Object} options - Configuration options
     * @param {string} options.type - 'cove' | 'chamfer' | 'fillet' | 'stepped' | 'vault'
     * @param {number} options.size - Horizontal projection (cm)
     * @param {number} options.drop - Vertical drop (cm)
     * @param {number} options.elevation - Baseline Y elevation (cm)
     * @param {number} options.subdivisions - Profile curve subdivisions
     * @param {boolean} options.isClosed - Whether the path forms a closed loop
     * @param {boolean} options.invert - Direction flip
     * @returns {THREE.BufferGeometry|null}
     */
    static generateTransitionGeometry(pathPoints, options = {}) {
        if (!pathPoints || pathPoints.length < 2) return null;

        const type = options.type || 'cove';
        const size = Number(options.size) || 20;
        const drop = Number(options.drop) || 20;
        const elev = Number(options.elevation) || 0;
        const subdivisions = options.subdivisions || 8;
        const isClosed = Boolean(options.isClosed);
        const invert = Boolean(options.invert);

        // 1. Generate 2D Profile
        const profile = this.getProfilePoints(type, size, drop, subdivisions, invert);
        if (profile.length < 2) return null;

        // Calculate profile cumulative distances for UVs
        const profileCumDist = [0];
        let totalProfLen = 0;
        for (let j = 1; j < profile.length; j++) {
            const d = Math.hypot(profile[j].x - profile[j - 1].x, profile[j].y - profile[j - 1].y);
            totalProfLen += d;
            profileCumDist.push(totalProfLen);
        }

        // 2. Normalize 3D Path Points (assuming 2D input has .x and .y mapping to 3D X and Z)
        const pts3D = pathPoints.map(p => {
            const px = Number(p.x) || 0;
            const pz = p.z !== undefined ? Number(p.z) : (p.y !== undefined ? Number(p.y) : 0);
            const py = p.elevation !== undefined ? Number(p.elevation) : elev;
            return new THREE.Vector3(px, py, pz);
        });

        const numPts = pts3D.length;

        // Calculate path cumulative distances for UVs
        const pathCumDist = [0];
        let totalPathLen = 0;
        for (let i = 1; i < numPts; i++) {
            const d = Math.hypot(pts3D[i].x - pts3D[i - 1].x, pts3D[i].z - pts3D[i - 1].z);
            totalPathLen += d;
            pathCumDist.push(totalPathLen);
        }
        if (isClosed) {
            const dClose = Math.hypot(pts3D[0].x - pts3D[numPts - 1].x, pts3D[0].z - pts3D[numPts - 1].z);
            totalPathLen += dClose;
        }

        // 3. Compute Segment Tangents and Unit Normals in XZ plane
        const segNormals = [];
        for (let i = 0; i < (isClosed ? numPts : numPts - 1); i++) {
            const pA = pts3D[i];
            const pB = pts3D[(i + 1) % numPts];
            const dx = pB.x - pA.x;
            const dz = pB.z - pA.z;
            const len = Math.hypot(dx, dz);
            if (len > 1e-6) {
                // Unit normal pointing to the right of the path (outward)
                segNormals.push(new THREE.Vector2(-dz / len, dx / len));
            } else {
                segNormals.push(new THREE.Vector2(0, 1));
            }
        }

        // 4. Compute Miter Bisectors at each vertex
        const vertexMiters = [];
        for (let i = 0; i < numPts; i++) {
            if (!isClosed && i === 0) {
                vertexMiters.push({ dir: segNormals[0].clone(), scale: 1.0 });
            } else if (!isClosed && i === numPts - 1) {
                vertexMiters.push({ dir: segNormals[segNormals.length - 1].clone(), scale: 1.0 });
            } else {
                const prevNorm = isClosed ? segNormals[(i - 1 + numPts) % numPts] : segNormals[i - 1];
                const nextNorm = segNormals[i % segNormals.length];

                const bisector = new THREE.Vector2().addVectors(prevNorm, nextNorm);
                const bLen = bisector.length();

                if (bLen < 1e-4) {
                    vertexMiters.push({ dir: nextNorm.clone(), scale: 1.0 });
                } else {
                    bisector.divideScalar(bLen);
                    // Cosine of half angle
                    const cosAlpha = nextNorm.dot(bisector);
                    const scale = Math.min(3.0, 1.0 / Math.max(0.2, cosAlpha));
                    vertexMiters.push({ dir: bisector, scale });
                }
            }
        }

        // 5. Generate Vertex Grid
        const vertices = [];
        const uvs = [];
        const numProf = profile.length;

        for (let i = 0; i < numPts; i++) {
            const p = pts3D[i];
            const miter = vertexMiters[i];
            const u = pathCumDist[i] / 100;

            for (let j = 0; j < numProf; j++) {
                const pr = profile[j];
                const vx = p.x + miter.dir.x * (pr.x * miter.scale);
                const vy = p.y + pr.y;
                const vz = p.z + miter.dir.y * (pr.x * miter.scale);

                vertices.push(vx, vy, vz);
                uvs.push(u, profileCumDist[j] / 100);
            }
        }

        // Handle closed loop wrap-around vertex row
        if (isClosed) {
            const p = pts3D[0];
            const miter = vertexMiters[0];
            const u = totalPathLen / 100;

            for (let j = 0; j < numProf; j++) {
                const pr = profile[j];
                const vx = p.x + miter.dir.x * (pr.x * miter.scale);
                const vy = p.y + pr.y;
                const vz = p.z + miter.dir.y * (pr.x * miter.scale);

                vertices.push(vx, vy, vz);
                uvs.push(u, profileCumDist[j] / 100);
            }
        }

        // 6. Build Triangle Indices
        const indices = [];
        const numPathSteps = isClosed ? numPts : numPts - 1;

        for (let i = 0; i < numPathSteps; i++) {
            const rowA = i * numProf;
            const rowB = (i + 1) * numProf;

            for (let j = 0; j < numProf - 1; j++) {
                const i0 = rowA + j;
                const i1 = rowA + j + 1;
                const i2 = rowB + j;
                const i3 = rowB + j + 1;

                // Two triangles per quad
                indices.push(i0, i1, i2);
                indices.push(i1, i3, i2);
            }
        }

        // 7. Construct BufferGeometry
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geo.setIndex(indices);
        geo.computeVertexNormals();

        return geo;
    }

    /**
     * Builds a complete THREE.Mesh for the shell transition and registers it with ComponentRegistry.
     * 
     * @param {Object} entity - Host wall, room, or roof entity
     * @param {Array<{x: number, y: number, z?: number}>} pathPoints - Perimeter points
     * @param {Object} options - Configuration options
     * @param {Object} ctx - 3D engine context with helpers
     * @returns {THREE.Mesh|null}
     */
    static buildTransitionMesh(entity, pathPoints, options = {}, ctx = null) {
        const geo = this.generateTransitionGeometry(pathPoints, options);
        if (!geo) return null;

        const matKey = options.material || entity?.params?.transitionMaterial || 'white_plaster_wall';
        let mat = null;
        if (ctx?.helpers?.getDynamicMaterial) {
            mat = ctx.helpers.getDynamicMaterial(matKey, 'wall');
        }
        if (!mat) {
            mat = new THREE.MeshStandardMaterial({
                color: 0xefede5,
                roughness: 0.6,
                side: THREE.DoubleSide
            });
        }

        const mesh = new THREE.Mesh(geo, mat);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.userData = {
            entity,
            materialSlot: 'transition',
            isShellTransition: true,
            transitionType: options.type || 'cove'
        };

        ComponentRegistry.registerMesh(entity, 'transition', mesh);

        return mesh;
    }
}
