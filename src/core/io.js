export class FileManager {
    static exportJSON(data) {
        try {
            let jsonStr;
            if (data && typeof data.exportState === 'function') {
                jsonStr = data.exportState();
            } else {
                jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
            }
            const blob = new Blob([jsonStr], { type: "application/json" }); 
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); 
            a.href = url; 
            a.download = "premium_floorplan.json"; 
            document.body.appendChild(a); 
            a.click(); 
            document.body.removeChild(a); 
            URL.revokeObjectURL(url);
        } catch(e) { 
            console.error(e);
            alert("Failed to save the project."); 
        }
    }

    static importJSON(planner, jsonData) {
        try {
            if (typeof jsonData !== 'string') {
                jsonData = JSON.stringify(jsonData);
            }
            planner.importState(jsonData);
            planner.syncAll();
        } catch(e) { 
            console.error(e);
            alert("Failed to render the floor plan. The file might be corrupted."); 
        }
    }
}