import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest';
import Konva from 'konva';
import { SiteRenderer2D } from '../SiteRenderer2D.js';
import { SiteEngine } from '../../site/SiteEngine.js';

describe('SiteRenderer2D', () => {
    let mockPlanner;
    let mockSiteLayer;

    beforeAll(() => {
        if (typeof HTMLCanvasElement !== 'undefined') {
            HTMLCanvasElement.prototype.getContext = () => ({
                clearRect: () => {},
                fillRect: () => {},
                getImageData: () => ({ data: [0, 0, 0, 0] }),
                putImageData: () => {},
                createImageData: () => ({ data: [0, 0, 0, 0] }),
                setTransform: () => {},
                drawImage: () => {},
                save: () => {},
                fillText: () => {},
                restore: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                closePath: () => {},
                stroke: () => {},
                fill: () => {},
                scale: () => {},
                measureText: () => ({ width: 50 })
            });
        }
    });

    beforeEach(() => {
        mockSiteLayer = new Konva.Group();
        mockSiteLayer.batchDraw = vi.fn();

        mockPlanner = {
            site: null,
            siteLayer: mockSiteLayer,
            rooms: [],
            currentUnit: 'ft',
            syncSite2D: function() {
                SiteRenderer2D.render(this);
            }
        };
    });

    const squarePlot = [
        { x: 0, y: 0 },
        { x: 1000, y: 0 },
        { x: 1000, y: 1000 },
        { x: 0, y: 1000 }
    ];

    it('clears layer gracefully when no site is present', () => {
        SiteRenderer2D.render(mockPlanner);
        expect(mockSiteLayer.getChildren().length).toBe(0);
        expect(mockSiteLayer.batchDraw).toHaveBeenCalled();
    });

    it('renders outer boundary, setback envelope, dimension tags, and corner pins', () => {
        SiteEngine.createSite(mockPlanner, squarePlot, {
            setbacks: { front: 100, rear: 100, left: 100, right: 100 },
            roadFrontageIndex: 0
        });

        SiteRenderer2D.render(mockPlanner);

        const group = mockSiteLayer.findOne('#site_boundary_group');
        expect(group).not.toBeNull();

        const lines = group.find('Line');
        // lines[0]: buildable envelope fill, lines[1]: outer plot boundary
        expect(lines.length).toBeGreaterThanOrEqual(2);

        // Check corner pins (Circles)
        const circles = group.find('Circle');
        expect(circles.length).toBe(4);

        // Check dimension tags and angle badges (Texts)
        const texts = group.find('Text');
        expect(texts.length).toBeGreaterThanOrEqual(4);

        // Front road tag must be present
        const hasRoadTag = texts.some(t => t.text().includes('ROAD:'));
        expect(hasRoadTag).toBe(true);
    });

    it('clears rendering when site visibility is toggled off', () => {
        SiteEngine.createSite(mockPlanner, squarePlot);
        SiteRenderer2D.render(mockPlanner);
        expect(mockSiteLayer.getChildren().length).toBe(1);

        mockPlanner.site.visible = false;
        SiteRenderer2D.render(mockPlanner);
        expect(mockSiteLayer.getChildren().length).toBe(0);
    });

    it('handles plain Konva.Group siteLayer without throwing batchDraw error', () => {
        const plainGroup = new Konva.Group();
        const mainLayer = new Konva.Layer();
        mainLayer.batchDraw = vi.fn();
        const planner = {
            site: null,
            siteLayer: plainGroup,
            mainLayer: mainLayer
        };
        SiteEngine.createSite(planner, squarePlot);
        expect(() => SiteRenderer2D.render(planner)).not.toThrow();
        expect(mainLayer.batchDraw).toHaveBeenCalled();
    });
});
