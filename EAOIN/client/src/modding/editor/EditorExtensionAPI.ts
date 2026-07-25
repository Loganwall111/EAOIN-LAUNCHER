/**
 * EditorExtensionAPI — Plugin-Based Editor Tools
 */
import { PluginDef } from '../plugins/PluginManager';

export interface EditorExtensionDef {
  extensionId: string;
  pluginId: string;
  tools: string[];
  enabled: boolean;
}

export class EditorExtensionAPI {
  private extensions = new Map<string, EditorExtensionDef>();

  registerExtension(ext: EditorExtensionDef): void {
    this.extensions.set(ext.extensionId, ext);
    console.log(`[EditorExt] Registered extension: ${ext.extensionId} (plugin: ${ext.pluginId})`);
  }

  enableExtension(extId: string): boolean {
    const ext = this.extensions.get(extId);
    if (!ext) return false;
    ext.enabled = true;
    console.log(`[EditorExt] Enabled: ${extId}`);
    return true;
  }

  getExtensionsForPlugin(pluginId: string): EditorExtensionDef[] {
    return Array.from(this.extensions.values()).filter(e => e.pluginId === pluginId);
  }

  getAllExtensions(): EditorExtensionDef[] {
    return Array.from(this.extensions.values());
  }
}
