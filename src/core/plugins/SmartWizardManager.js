export class SmartWizardManager {
    constructor(appContext) {
        this.appContext = appContext;
        this.plugins = new Map();
        this.enabledPlugins = [];
    }

    registerPlugin(plugin) {
        if (!plugin.id || !plugin.execute) {
            console.error('Invalid plugin format');
            return;
        }
        this.plugins.set(plugin.id, plugin);
    }

    enablePlugins(pluginIds) {
        this.enabledPlugins = pluginIds;
    }

    isPluginEnabled(id) {
        return this.enabledPlugins.includes(id);
    }

    getPlugin(id) {
        return this.plugins.get(id);
    }

    async executePlugin(id, config) {
        if (!this.isPluginEnabled(id)) return { success: false, error: 'Plugin not enabled' };
        
        const plugin = this.getPlugin(id);
        if (!plugin) return { success: false, error: 'Plugin not found' };

        if (plugin.validate) {
            const validation = await plugin.validate(config, this.appContext);
            if (!validation.success) return validation;
        }

        return await plugin.execute(config, this.appContext);
    }
}
