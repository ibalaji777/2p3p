/**
 * src/core/site/SiteSerializer.js
 * 
 * Serialization and deserialization authority for the Site subsystem.
 * Follows the project's Schema v2.0 persistence contract.
 */

export class SiteSerializer {
    /**
     * Serializes a canonical site object to clean JSON.
     * @param {Object} site 
     * @returns {Object|null}
     */
    static serialize(site) {
        if (!site || !site.vertices || !Array.isArray(site.vertices) || site.vertices.length < 3) {
            return null;
        }

        const setbacks = (site.setbacks !== null && site.setbacks !== undefined) ? {
            front: site.setbacks.front !== undefined && site.setbacks.front !== null ? Math.max(0, Number(site.setbacks.front)) : 0,
            rear: site.setbacks.rear !== undefined && site.setbacks.rear !== null ? Math.max(0, Number(site.setbacks.rear)) : 0,
            left: site.setbacks.left !== undefined && site.setbacks.left !== null ? Math.max(0, Number(site.setbacks.left)) : 0,
            right: site.setbacks.right !== undefined && site.setbacks.right !== null ? Math.max(0, Number(site.setbacks.right)) : 0
        } : null;

        const roadFrontages = Array.isArray(site.roadFrontages)
            ? site.roadFrontages.map(Number)
            : [Number(site.roadFrontageIndex) || 0];

        return {
            id: site.id || 'site_boundary',
            vertices: site.vertices.map(v => ({ x: Number(v.x) || 0, y: Number(v.y) || 0 })),
            setbacks,
            orientation: Number(site.orientation) || 0,
            roadFrontageIndex: (site.roadFrontageIndex !== undefined && site.roadFrontageIndex !== null) ? Number(site.roadFrontageIndex) : (roadFrontages[0] !== undefined ? roadFrontages[0] : 0),
            roadFrontages,
            unit: site.unit || 'ft',
            name: site.name || 'Plot Boundary',
            visible: site.visible !== false
        };
    }

    /**
     * Deserializes site data and registers with the planner.
     * Supports both deserialize(planner, data) and deserialize(data).
     * @param {Object} plannerOrData 
     * @param {Object} [maybeData] 
     * @returns {Object|null}
     */
    static deserialize(plannerOrData, maybeData) {
        let planner = null;
        let data = plannerOrData;
        if (maybeData !== undefined) {
            planner = plannerOrData;
            data = maybeData;
        }

        if (!data || !data.vertices || !Array.isArray(data.vertices) || data.vertices.length < 3) {
            return null;
        }

        const setbacks = (data.setbacks !== null && data.setbacks !== undefined) ? {
            front: data.setbacks.front !== undefined && data.setbacks.front !== null ? Math.max(0, Number(data.setbacks.front)) : 0,
            rear: data.setbacks.rear !== undefined && data.setbacks.rear !== null ? Math.max(0, Number(data.setbacks.rear)) : 0,
            left: data.setbacks.left !== undefined && data.setbacks.left !== null ? Math.max(0, Number(data.setbacks.left)) : 0,
            right: data.setbacks.right !== undefined && data.setbacks.right !== null ? Math.max(0, Number(data.setbacks.right)) : 0
        } : null;

        const roadFrontages = Array.isArray(data.roadFrontages)
            ? data.roadFrontages.map(Number)
            : (data.roadFrontageIndex !== undefined ? [Number(data.roadFrontageIndex) || 0] : [0]);

        const site = {
            id: data.id || 'site_boundary',
            vertices: data.vertices.map(v => ({ x: Number(v.x) || 0, y: Number(v.y) || 0 })),
            setbacks,
            orientation: Number(data.orientation) || 0,
            roadFrontageIndex: (data.roadFrontageIndex !== undefined && data.roadFrontageIndex !== null) ? Number(data.roadFrontageIndex) : (roadFrontages[0] !== undefined ? roadFrontages[0] : 0),
            roadFrontages,
            unit: data.unit || 'ft',
            name: data.name || 'Plot Boundary',
            visible: data.visible !== false
        };

        if (planner) {
            planner.site = site;
        }

        return site;
    }
}
