// Create high quality SVG textures for the 4 glass roof patterns
// 1. Square Grid Glass (Modern Atrium)
// 2. Diamond Lattice Glass (Victorian Conservatory / Greenhouse)
// 3. Hexagonal Honeycomb Glass (Futuristic / Solarium)
// 4. Solid Clear Glass (Frameless Skylights)

export function generateSquareGridSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <!-- Background Glass Tint -->
    <linearGradient id="glassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.22" />
      <stop offset="50%" stop-color="#0284c7" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#0369a1" stop-opacity="0.26" />
    </linearGradient>
    <!-- Metal Mullion Gradient -->
    <linearGradient id="mullionGradV" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="35%" stop-color="#475569" />
      <stop offset="50%" stop-color="#94a3b8" />
      <stop offset="65%" stop-color="#334155" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <linearGradient id="mullionGradH" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="35%" stop-color="#475569" />
      <stop offset="50%" stop-color="#94a3b8" />
      <stop offset="65%" stop-color="#334155" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
    <!-- Glass Pane Inner Specular Reflection -->
    <linearGradient id="specularGlint" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.35" />
      <stop offset="30%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- 4 Square Glass Panes -->
  <!-- Pane Top-Left -->
  <rect x="14" y="14" width="228" height="228" rx="2" fill="url(#glassGrad)" stroke="#64748b" stroke-width="1.5" stroke-opacity="0.4"/>
  <polygon points="14,14 242,14 14,242" fill="url(#specularGlint)" />

  <!-- Pane Top-Right -->
  <rect x="270" y="14" width="228" height="228" rx="2" fill="url(#glassGrad)" stroke="#64748b" stroke-width="1.5" stroke-opacity="0.4"/>
  <polygon points="270,14 498,14 270,242" fill="url(#specularGlint)" />

  <!-- Pane Bottom-Left -->
  <rect x="14" y="270" width="228" height="228" rx="2" fill="url(#glassGrad)" stroke="#64748b" stroke-width="1.5" stroke-opacity="0.4"/>
  <polygon points="14,270 242,270 14,498" fill="url(#specularGlint)" />

  <!-- Pane Bottom-Right -->
  <rect x="270" y="270" width="228" height="228" rx="2" fill="url(#glassGrad)" stroke="#64748b" stroke-width="1.5" stroke-opacity="0.4"/>
  <polygon points="270,270 498,270 270,498" fill="url(#specularGlint)" />

  <!-- Outer Border Structural Mullions -->
  <rect x="0" y="0" width="14" height="512" fill="url(#mullionGradV)" />
  <rect x="498" y="0" width="14" height="512" fill="url(#mullionGradV)" />
  <rect x="0" y="0" width="512" height="14" fill="url(#mullionGradH)" />
  <rect x="0" y="498" width="512" height="14" fill="url(#mullionGradH)" />

  <!-- Center Cross Structural T-Mullions -->
  <rect x="242" y="0" width="28" height="512" fill="url(#mullionGradV)" />
  <line x1="256" y1="0" x2="256" y2="512" stroke="#cbd5e1" stroke-width="1.5" />
  
  <rect x="0" y="242" width="512" height="28" fill="url(#mullionGradH)" />
  <line x1="0" y1="256" x2="512" y2="256" stroke="#cbd5e1" stroke-width="1.5" />

  <!-- Center Intersection Boss / Rivet -->
  <rect x="238" y="238" width="36" height="36" rx="4" fill="#1e293b" stroke="#94a3b8" stroke-width="2" />
  <circle cx="256" cy="256" r="6" fill="#cbd5e1" />
</svg>`;
}

export function generateDiamondLatticeSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <!-- Victorian Greenhouse Warm Glass Tint -->
    <linearGradient id="victorianGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10b981" stop-opacity="0.20" />
      <stop offset="50%" stop-color="#065f46" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#047857" stop-opacity="0.24" />
    </linearGradient>
    <!-- Ornate Leaded / Bronze Mullion -->
    <linearGradient id="bronzeMullion" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1c1917" />
      <stop offset="35%" stop-color="#44403c" />
      <stop offset="50%" stop-color="#78716c" />
      <stop offset="65%" stop-color="#292524" />
      <stop offset="100%" stop-color="#0c0a09" />
    </linearGradient>
    <linearGradient id="diamondSpecular" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.40" />
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- Glass Background Fill -->
  <rect x="0" y="0" width="512" height="512" fill="url(#victorianGlass)" />

  <!-- Specular Highlights on Diamond Panes -->
  <polygon points="256,16 496,256 256,496 16,256" fill="url(#victorianGlass)" stroke="#34d399" stroke-width="1" stroke-opacity="0.5"/>
  <polygon points="256,16 376,136 256,256 136,136" fill="url(#diamondSpecular)" />

  <!-- Corner Diamonds -->
  <polygon points="0,0 120,0 0,120" fill="url(#diamondSpecular)" />
  <polygon points="512,0 392,0 512,120" fill="url(#diamondSpecular)" />
  <polygon points="0,512 120,512 0,392" fill="url(#diamondSpecular)" />
  <polygon points="512,512 392,512 512,392" fill="url(#diamondSpecular)" />

  <!-- Diagonal Lattice Grid Structural Ribs (45 degrees) -->
  <g stroke="url(#bronzeMullion)" stroke-width="16" stroke-linecap="round" stroke-linejoin="round">
    <!-- Main Center Diagonals -->
    <line x1="0" y1="0" x2="512" y2="512" />
    <line x1="512" y1="0" x2="0" y2="512" />

    <!-- Secondary Diagonals for Full Diamond Repeat -->
    <line x1="256" y1="0" x2="512" y2="256" />
    <line x1="512" y1="256" x2="256" y2="512" />
    <line x1="256" y1="512" x2="0" y2="256" />
    <line x1="0" y1="256" x2="256" y2="0" />

    <line x1="0" y1="0" x2="512" y2="0" stroke-width="20" />
    <line x1="0" y1="512" x2="512" y2="512" stroke-width="20" />
    <line x1="0" y1="0" x2="0" y2="512" stroke-width="20" />
    <line x1="512" y1="0" x2="512" y2="512" stroke-width="20" />
  </g>

  <!-- Fine Inner Leaded Rib Highlights -->
  <g stroke="#d6d3d1" stroke-width="2" opacity="0.8">
    <line x1="0" y1="0" x2="512" y2="512" />
    <line x1="512" y1="0" x2="0" y2="512" />
    <line x1="256" y1="0" x2="512" y2="256" />
    <line x1="512" y1="256" x2="256" y2="512" />
    <line x1="256" y1="512" x2="0" y2="256" />
    <line x1="0" y1="256" x2="256" y2="0" />
  </g>

  <!-- Rosette Nodes at Intersections -->
  <circle cx="256" cy="256" r="12" fill="#1c1917" stroke="#a8a29e" stroke-width="2" />
  <circle cx="256" cy="256" r="4" fill="#e7e5e4" />

  <circle cx="256" cy="0" r="10" fill="#1c1917" stroke="#a8a29e" stroke-width="2" />
  <circle cx="256" cy="512" r="10" fill="#1c1917" stroke="#a8a29e" stroke-width="2" />
  <circle cx="0" cy="256" r="10" fill="#1c1917" stroke="#a8a29e" stroke-width="2" />
  <circle cx="512" cy="256" r="10" fill="#1c1917" stroke="#a8a29e" stroke-width="2" />
</svg>`;
}

export function generateHexagonalHoneycombSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <!-- Futuristic Solarium Cyan/Blue Tint -->
    <linearGradient id="futuristicGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.24" />
      <stop offset="50%" stop-color="#0891b2" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#0e7490" stop-opacity="0.28" />
    </linearGradient>
    <!-- Sleek Titanium/Dark Frame -->
    <linearGradient id="titaniumFrame" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="35%" stop-color="#334155" />
      <stop offset="50%" stop-color="#64748b" />
      <stop offset="65%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="hexSpecular" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.38" />
      <stop offset="45%" stop-color="#ffffff" stop-opacity="0.06" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- Glass Background -->
  <rect x="0" y="0" width="512" height="512" fill="url(#futuristicGlass)" />

  <!-- Center Hexagon: R=140 -->
  <!-- Points: (256, 116), (377, 186), (377, 326), (256, 396), (135, 326), (135, 186) -->
  <polygon points="256,116 377,186 377,326 256,396 135,326 135,186" fill="url(#futuristicGlass)" stroke="#22d3ee" stroke-width="2" stroke-opacity="0.4"/>
  <polygon points="256,116 377,186 256,256 135,186" fill="url(#hexSpecular)" />

  <!-- Top Hexagon (Center-X=256, Center-Y=-124) -->
  <polygon points="256,-264 377,-194 377,-54 256,16 135,-54 135,-194" fill="url(#futuristicGlass)" />
  <!-- Bottom Hexagon (Center-X=256, Center-Y=636) -->
  <polygon points="256,496 377,566 377,706 256,776 135,706 135,566" fill="url(#futuristicGlass)" />

  <!-- Left-Top Hexagon (Center-X=46, Center-Y=66) -->
  <polygon points="46,-74 167,-4 167,136 46,206 -75,136 -75,-4" fill="url(#futuristicGlass)" />
  <!-- Right-Top Hexagon (Center-X=466, Center-Y=66) -->
  <polygon points="466,-74 587,-4 587,136 466,206 345,136 345,-4" fill="url(#futuristicGlass)" />

  <!-- Left-Bottom Hexagon (Center-X=46, Center-Y=446) -->
  <polygon points="46,306 167,376 167,516 46,586 -75,516 -75,376" fill="url(#futuristicGlass)" />
  <!-- Right-Bottom Hexagon (Center-X=466, Center-Y=446) -->
  <polygon points="466,306 587,376 587,516 466,586 345,516 345,376" fill="url(#futuristicGlass)" />

  <!-- Structural Honeycomb Hexagonal Mullion Grid -->
  <g stroke="url(#titaniumFrame)" stroke-width="14" stroke-linecap="round" stroke-linejoin="round" fill="none">
    <!-- Center Hexagon Perimeter -->
    <polygon points="256,116 377,186 377,326 256,396 135,326 135,186" />

    <!-- Radiating Spokes / Connecting Struts -->
    <line x1="256" y1="116" x2="256" y2="16" />
    <line x1="256" y1="396" x2="256" y2="496" />

    <line x1="377" y1="186" x2="466" y2="136" />
    <line x1="377" y1="326" x2="466" y2="376" />

    <line x1="135" y1="186" x2="46" y2="136" />
    <line x1="135" y1="326" x2="46" y2="376" />

    <!-- Corner Hexagon Edges for Seamless Tiling -->
    <polyline points="135,-54 256,16 377,-54" />
    <polyline points="135,566 256,496 377,566" />
    <polyline points="466,-74 466,136 512,162" />
    <polyline points="466,586 466,376 512,350" />
    <polyline points="46,-74 46,136 0,162" />
    <polyline points="46,586 46,376 0,350" />
  </g>

  <!-- Fine Inner Metallic Highlights -->
  <g stroke="#94a3b8" stroke-width="2" opacity="0.9" fill="none">
    <polygon points="256,116 377,186 377,326 256,396 135,326 135,186" />
    <line x1="256" y1="116" x2="256" y2="16" />
    <line x1="256" y1="396" x2="256" y2="496" />
    <line x1="377" y1="186" x2="466" y2="136" />
    <line x1="377" y1="326" x2="466" y2="376" />
    <line x1="135" y1="186" x2="46" y2="136" />
    <line x1="135" y1="326" x2="46" y2="376" />
  </g>

  <!-- Structural Nodes / Hex Joints -->
  <circle cx="256" cy="116" r="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
  <circle cx="377" cy="186" r="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
  <circle cx="377" cy="326" r="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
  <circle cx="256" cy="396" r="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
  <circle cx="135" cy="326" r="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
  <circle cx="135" cy="186" r="8" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
</svg>`;
}

export function generateSolidClearGlassSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <!-- Ultra-Clear Float Glass with Sky Reflection -->
    <linearGradient id="clearSkyGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#e0f2fe" stop-opacity="0.25" />
      <stop offset="30%" stop-color="#bae6fd" stop-opacity="0.10" />
      <stop offset="70%" stop-color="#38bdf8" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.22" />
    </linearGradient>
    <linearGradient id="edgeGleam" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.5" />
      <stop offset="50%" stop-color="#ffffff" stop-opacity="0.05" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.3" />
    </linearGradient>
    <linearGradient id="pureSpecular" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45" />
      <stop offset="25%" stop-color="#ffffff" stop-opacity="0.12" />
      <stop offset="60%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
  </defs>

  <!-- Clear Glass Body -->
  <rect x="0" y="0" width="512" height="512" fill="url(#clearSkyGlass)" />

  <!-- Diagonal Panoramic Sunlight Sheen -->
  <polygon points="0,0 280,0 0,280" fill="url(#pureSpecular)" />
  <polygon points="120,0 512,0 512,180 0,460 0,380" fill="url(#pureSpecular)" opacity="0.4"/>

  <!-- Subtle Micro-Seam Edge (Frameless Architectural Glass Butt-Joint) -->
  <rect x="0" y="0" width="512" height="512" fill="none" stroke="#7dd3fc" stroke-width="1.5" stroke-opacity="0.3" />
  <line x1="0" y1="0" x2="512" y2="0" stroke="url(#edgeGleam)" stroke-width="2" />
</svg>`;
}

export function svgToDataUri(svg) {
    const encoded = encodeURIComponent(svg)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22');
    return `data:image/svg+xml;charset=utf-8,${encoded}`;
}

export function generateVeluxWindowSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="veluxGlass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#bae6fd" stop-opacity="0.30" />
      <stop offset="50%" stop-color="#7dd3fc" stop-opacity="0.15" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.35" />
    </linearGradient>
    <linearGradient id="veluxSpecular" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.45" />
      <stop offset="40%" stop-color="#ffffff" stop-opacity="0.08" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.0" />
    </linearGradient>
  </defs>
  <!-- Outer Dark Flashing Casing -->
  <rect x="0" y="0" width="512" height="512" rx="16" fill="#18181b" />
  <!-- Inner White Architectural Sash Lining -->
  <rect x="36" y="36" width="440" height="440" rx="8" fill="#f8fafc" stroke="#cbd5e1" stroke-width="2" />
  <!-- Glass Window Aperture -->
  <rect x="68" y="68" width="376" height="376" rx="4" fill="url(#veluxGlass)" stroke="#94a3b8" stroke-width="2" />
  <polygon points="68,68 444,68 68,444" fill="url(#veluxSpecular)" />
  <!-- Center Pivot Hinge Bar -->
  <line x1="68" y1="256" x2="444" y2="256" stroke="#18181b" stroke-width="8" />
  <circle cx="256" cy="256" r="10" fill="#f8fafc" stroke="#18181b" stroke-width="3" />
</svg>`;
}

export function generatePyramidLanternSVG() {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="pyrNorth" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.15" />
    </linearGradient>
    <linearGradient id="pyrSouth" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0369a1" stop-opacity="0.45" />
      <stop offset="100%" stop-color="#0284c7" stop-opacity="0.25" />
    </linearGradient>
    <linearGradient id="pyrWest" x1="100%" y1="0%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="#075985" stop-opacity="0.30" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0.10" />
    </linearGradient>
    <linearGradient id="pyrEast" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" stop-opacity="0.40" />
      <stop offset="100%" stop-color="#0c4a6e" stop-opacity="0.55" />
    </linearGradient>
  </defs>
  <!-- Outer Curb Frame -->
  <rect x="0" y="0" width="512" height="512" rx="12" fill="#18181b" />
  <!-- 4 Triangular Pyramid Facets -->
  <polygon points="32,32 480,32 256,256" fill="url(#pyrNorth)" />
  <polygon points="480,32 480,480 256,256" fill="url(#pyrEast)" />
  <polygon points="480,480 32,480 256,256" fill="url(#pyrSouth)" />
  <polygon points="32,480 32,32 256,256" fill="url(#pyrWest)" />
  <!-- Corner Hip Rafter Bars -->
  <line x1="32" y1="32" x2="256" y2="256" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
  <line x1="480" y1="32" x2="256" y2="256" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
  <line x1="480" y1="480" x2="256" y2="256" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
  <line x1="32" y1="480" x2="256" y2="256" stroke="#0f172a" stroke-width="10" stroke-linecap="round" />
  <!-- Apex Boss Cap -->
  <rect x="240" y="240" width="32" height="32" rx="4" fill="#0f172a" stroke="#cbd5e1" stroke-width="2" />
</svg>`;
}

export const GLASS_ROOF_TEXTURE_DATA = {
    glass_roof_square_grid: {
        svg: generateSquareGridSVG(),
        dataUri: svgToDataUri(generateSquareGridSVG())
    },
    glass_roof_diamond_lattice: {
        svg: generateDiamondLatticeSVG(),
        dataUri: svgToDataUri(generateDiamondLatticeSVG())
    },
    glass_roof_hexagonal_honeycomb: {
        svg: generateHexagonalHoneycombSVG(),
        dataUri: svgToDataUri(generateHexagonalHoneycombSVG())
    },
    glass_roof_solid_clear: {
        svg: generateSolidClearGlassSVG(),
        dataUri: svgToDataUri(generateSolidClearGlassSVG())
    },
    skylight_velux_frame: {
        svg: generateVeluxWindowSVG(),
        dataUri: svgToDataUri(generateVeluxWindowSVG())
    },
    skylight_pyramid_dome: {
        svg: generatePyramidLanternSVG(),
        dataUri: svgToDataUri(generatePyramidLanternSVG())
    }
};
