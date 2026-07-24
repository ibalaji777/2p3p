# Material Preview Models

This directory is monitored by the `PreviewMeshRegistry`. 
Place your Blender-exported `.glb` files here to act as dynamic 3D thumbnails in the UI.

## Required Filenames:
- `draped_cloth.glb` (Used for Fabrics)
- `upholstered_cushion.glb` (Used for Leathers)
- `rounded_cube.glb` (Used for Woods)
- `beveled_slab.glb` (Used for Marble)
- `floor_plane.glb` (Used for Tiles)
- `chamfered_block.glb` (Used for Metals)
- `beveled_glass_cube.glb` (Used for Glass)
- `carved_block.glb` (Used for Stone)
- `architectural_panel.glb` (Used for Concrete)

## Notes:
- Keep the polygon count low (5k - 20k triangles) for fast UI rendering.
- Ensure the models are perfectly centered at `(0,0,0)` in Blender before exporting.
- Do NOT include any materials or textures in the GLB export (the engine applies them dynamically).
- Do NOT include lights or cameras in the GLB export.
