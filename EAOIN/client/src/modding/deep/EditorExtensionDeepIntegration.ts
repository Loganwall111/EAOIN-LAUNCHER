/**
 * EditorExtensionDeepIntegration — Tool Activation & Plugin Integration
 */
import { EditorExtensionAPI } from '../editor/EditorExtensionAPI';
import { PluginDef } from '../plugins/PluginManager';

export class EditorExtensionDeepIntegration {
  constructor(private extensionAPI: EditorExtensionAPI) {}

  activateEditorTool(pluginId: string, toolName: string): boolean {
    const extensions = this.extensionAPI.getExtensionsForPlugin(pluginId);
    const tool = extensions.find(e => e.tools.includes(toolName));
    if (!tool) {
      console.log(`[EditorDeep] Tool ${toolName} not found for plugin ${pluginId}`);
      return false;
    }
    console.log(`[EditorDeep] Activated editor tool: ${toolName} (plugin: ${pluginId}, extension: ${tool.extensionId})`);
    return true;
  }

  listActiveTools(pluginId?: string): string[] {
    let extensions = this.extensionAPI.getAllExtensions();
    if (pluginId) extensions = extensions.filter(e => e.pluginId === pluginId);
    return extensions.filter(e => e.enabled).map(e => e.tools).flat();
  }
}
