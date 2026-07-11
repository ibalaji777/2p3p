import { FloorPlanner } from './src/core/engine2d/index.js';

// Mock browser environment for headless testing
global.window = {
    dispatchEvent: () => {},
    addEventListener: () => {}
};
global.document = {
    createElement: () => ({ style: {}, getContext: () => ({}) }),
    getElementById: () => ({ appendChild: () => {}, getBoundingClientRect: () => ({ width: 800, height: 600 }) })
};
global.CustomEvent = class {};

async function runTests() {
    console.log('--- Running Engine Automation API Tests ---');
    
    // 1. Initialize Headless Planner
    const planner = new FloorPlanner('container');
    const api = planner.automationApi;

    // 2. Test Transaction (CompositeCommand)
    console.log('Testing Room Creation Transaction...');
    const result = api.execute({
        action: 'transaction',
        commands: [
            { action: 'createWall', startX: 0, startY: 0, endX: 100, endY: 0, entityId: 'w1' },
            { action: 'createWall', startX: 100, startY: 0, endX: 100, endY: 100, entityId: 'w2' },
            { action: 'createWall', startX: 100, startY: 100, endX: 0, endY: 100, entityId: 'w3' },
            { action: 'createWall', startX: 0, startY: 100, endX: 0, endY: 0, entityId: 'w4' }
        ]
    });

    if (result.success) {
        console.log('✅ Transaction executed successfully.');
    } else {
        console.error('❌ Transaction failed:', result.error);
    }

    const walls = api.query('getEntities').data.filter(e => e.type === 'outer');
    if (walls.length === 4) {
        console.log('✅ Verified 4 walls created.');
    } else {
        console.error('❌ Expected 4 walls, got', walls.length);
    }

    // 3. Test Invalid Command (Validation Layer)
    console.log('\nTesting Validation Layer (Invalid Payload)...');
    const invalidResult = api.execute({
        action: 'moveEntity',
        entityId: 'w1',
        x: 'not-a-number', // Should fail
        y: 50
    });

    if (!invalidResult.success) {
        console.log('✅ Validation correctly caught error:', invalidResult.error);
    } else {
        console.error('❌ Validation failed to catch invalid coordinate types.');
    }

    // 4. Test Undo
    console.log('\nTesting Undo...');
    api.execute({ action: 'undo' });
    const wallsAfterUndo = api.query('getEntities').data.filter(e => e.type === 'outer');
    if (wallsAfterUndo.length === 0) {
        console.log('✅ Undo executed successfully (Transaction rolled back).');
    } else {
        console.error('❌ Undo failed. Expected 0 walls, got', wallsAfterUndo.length);
    }
}

runTests();
