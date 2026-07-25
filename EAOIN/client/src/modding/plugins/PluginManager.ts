/**
 * PluginManager — Modding Plugin Framework
 */
export interface PluginDef {
  pluginId: string;
  version: string;
  author: string;
  entryPoint: string;
  enabled: boolean;
  permissions: string[];
}

export interface PluginAPIAccess {
  coreSystems: boolean;
  worldGeneration: boolean;
  entityAI: boolean;
  itemBlockAPI: boolean;
  uiAPI: boolean;
  graphicsAPI: boolean;
  networking: boolean;
}

export class PluginManager {
  private plugins = new Map<string, PluginDef>();
  private activePlugins: string[] = [];

  registerPlugin(plugin: PluginDef): void {
    this.plugins.set(plugin.pluginId, plugin);
    console.log(`[Plugin] Registered plugin: ${plugin.pluginId} v${plugin.version} by ${plugin.author}`);
  }

  enablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = true;
    if (!this.activePlugins.includes(pluginId)) {
      this.activePlugins.push(pluginId);
    }
    console.log(`[Plugin] Enabled: ${pluginId}`);
    return true;
  }

  disablePlugin(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) return false;
    plugin.enabled = false;
    this.activePlugins = this.activePlugins.filter(id => id !== pluginId);
    console.log(`[Plugin] Disabled: ${pluginId}`);
    return true;
  }

  getActivePlugins(): PluginDef[] {
    return this.activePlugins.map(id => this.plugins.get(id)!).filter(p => p);
  }

  getPlugins(): PluginDef[] {
    return Array.from(this.plugins.values());
  }
}
