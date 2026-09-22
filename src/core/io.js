import { ExportEngine } from './export/ExportEngine.js';

export class FileManager {
    static exportJSON(data, fileName = "premium_floorplan.json") {
        try {
            return ExportEngine.exportProjectJSON(data, { fileName, download: true });
        } catch(e) { 
            console.error('[FileManager] Failed to save project:', e);
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                try { window.alert("Failed to save the project."); } catch(_) {}
            }
        }
    }

    static importJSON(planner, jsonData) {
        try {
            return ExportEngine.importProjectJSON(planner, jsonData, { sync: true });
        } catch(e) { 
            console.error('[FileManager] Failed to import floor plan:', e);
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                try { window.alert("Failed to render the floor plan. The file might be corrupted."); } catch(_) {}
            }
        }
    }
}