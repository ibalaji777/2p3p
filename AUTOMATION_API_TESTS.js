/**
 * Automation API - Console Testing Scripts
 * 
 * Instructions:
 * 1. Open your application in the browser (e.g. http://localhost:5173).
 * 2. Press F12 to open Developer Tools, and navigate to the "Console" tab.
 * 3. Copy and paste any of the blocks below and press Enter to see the engine execute it.
 */


// ==========================================
// TEST 1: Build a Complete Room with Door & Window
// ==========================================
window.planner.automationApi.execute({
    action: 'transaction',
    commands: [
        // 1. Build 4 Walls
        { action: 'createWall', startX: -150, startY: -150, endX: 150, endY: -150, entityId: 'wall_top' },
        { action: 'createWall', startX: 150, startY: -150, endX: 150, endY: 150, entityId: 'wall_right' },
        { action: 'createWall', startX: 150, startY: 150, endX: -150, endY: 150, entityId: 'wall_bottom' },
        { action: 'createWall', startX: -150, startY: 150, endX: -150, endY: -150, entityId: 'wall_left' },
        
        // 2. Add a Door to the bottom wall
        { action: 'createDoor', wallId: 'wall_bottom', x: 150, configId: 'door_standard' },
        
        // 3. Add a Window to the top wall
        { action: 'createWindow', wallId: 'wall_top', x: 150, configId: 'window_standard' },
        
        // 4. Add a Sofa in the center
        { action: 'createFurniture', x: 0, y: 0, configId: 'sofa_01', entityId: 'my_sofa' }
    ]
});
console.log("✅ Room built successfully!");


// ==========================================
// TEST 2: Move and Rotate the Sofa
// ==========================================
window.planner.automationApi.execute({
    action: 'transaction',
    commands: [
        { action: 'moveEntity', entityId: 'my_sofa', x: -50, y: 50 },
        { action: 'rotateEntity', entityId: 'my_sofa', rotation: 45 }
    ]
});
console.log("✅ Sofa moved and rotated!");


// ==========================================
// TEST 3: Paint the Walls (Apply Materials)
// ==========================================
window.planner.automationApi.execute({
    action: 'transaction',
    commands: [
        // Make the exterior brick
        { action: 'applyMaterial', entityId: 'wall_top', face: 'front', materialId: 'brick_red' },
        { action: 'applyMaterial', entityId: 'wall_bottom', face: 'front', materialId: 'brick_red' },
        { action: 'applyMaterial', entityId: 'wall_left', face: 'front', materialId: 'brick_red' },
        { action: 'applyMaterial', entityId: 'wall_right', face: 'front', materialId: 'brick_red' }
    ]
});
console.log("✅ Walls painted with brick!");


// ==========================================
// TEST 4: Query Engine State
// ==========================================
const roomsData = window.planner.automationApi.query('getRooms');
console.log("🏠 Rooms detected by engine:", roomsData.data);

const wallsData = window.planner.automationApi.query('getWalls');
console.log("🧱 Total Walls:", wallsData.data.length);


// ==========================================
// TEST 5: Undo the Last Action (Painting)
// ==========================================
window.planner.automationApi.execute({ action: 'undo' });
console.log("⏪ Paint undone!");


// ==========================================
// TEST 6: Wipe Everything (Undo the room creation)
// ==========================================
// Run this twice to undo the Sofa Move, and then the Room Creation
window.planner.automationApi.execute({ action: 'undo' });
window.planner.automationApi.execute({ action: 'undo' });
console.log("⏪ Room erased!");
