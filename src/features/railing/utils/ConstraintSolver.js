// src/features/railing/utils/ConstraintSolver.js

/**
 * Validates and enforces dimensional constraints on railing segments
 * such as maximum glass panel width, minimum post spacing, etc.
 */
export class ConstraintSolver {
    /**
     * Calculates the optimal number of segments and their exact width 
     * given a total length and a maximum allowed width per segment.
     * @param {number} totalLength 
     * @param {number} maxWidth 
     * @returns {Object} { count, width }
     */
    static solveEqualSegments(totalLength, maxWidth) {
        if (totalLength <= 0) return { count: 1, width: 0 };
        if (maxWidth <= 0) return { count: 1, width: totalLength };

        const count = Math.ceil(totalLength / maxWidth);
        const width = totalLength / count;
        
        return { count, width };
    }

    /**
     * Calculates post positions along a given path length, enforcing min/max spacing.
     * @param {number} totalLength 
     * @param {number} targetSpacing 
     * @returns {number[]} Array of normalized t values (0.0 to 1.0) for post positions
     */
    static solvePostPositions(totalLength, targetSpacing) {
        if (totalLength <= 0) return [0, 1];
        
        // At minimum, we have a start and end post
        if (totalLength <= targetSpacing) {
            return [0, 1];
        }

        const segments = Math.round(totalLength / targetSpacing);
        const positions = [];
        
        for (let i = 0; i <= segments; i++) {
            positions.push(i / segments);
        }
        
        return positions;
    }

    /**
     * Distributes balusters evenly along a segment.
     */
    static solveBalusterPositions(totalLength, spacing, width) {
        if (totalLength <= 0 || spacing <= 0) return [];
        
        // How many fit?
        const count = Math.floor(totalLength / spacing);
        if (count <= 0) return [];

        const actualSpacing = totalLength / (count + 1);
        const positions = [];
        for (let i = 1; i <= count; i++) {
            positions.push((i * actualSpacing) / totalLength);
        }
        return positions;
    }
}
