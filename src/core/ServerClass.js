import { ExportEngine } from './export/ExportEngine.js';

export class ServerClass {
    constructor(preview3D, planner, getProjectState, options = {}) {
        this.preview3D = preview3D;
        this.planner = planner;
        this.getProjectState = getProjectState;
        this.baseUrl = options.baseUrl || ExportEngine.DEFAULT_API_BASE_URL;
    }

    getBuildingBoundingBox() {
        return ExportEngine.getBuildingBoundingBox(this.preview3D);
    }

    async captureView(viewType) {
        return ExportEngine.capture3DView(this.preview3D, viewType);
    }

    async generatePreviewImages() {
        return ExportEngine.generate3DPreviews(this.preview3D);
    }

    exportProjectJson() {
        if (this.getProjectState) {
            return ExportEngine.safeStringify(this.getProjectState());
        }
        return ExportEngine.safeStringify({ data: this.planner.exportState() });
    }

    async saveProject(projectName) {
        const projectJson = this.exportProjectJson();
        const imagesBase64 = await this.generatePreviewImages();
        return ExportEngine.saveProjectToCloud(projectName, projectJson, imagesBase64, { baseUrl: this.baseUrl });
    }
}