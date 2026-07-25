/**
 * ScriptAPIFramework — TypeScript/Lua Script API for Mods
 */
export interface ScriptModule {
  moduleName: string;
  exports: Record<string, any>;
  loaded: boolean;
}

export class ScriptAPIFramework {
  private modules = new Map<string, ScriptModule>();

  loadModule(name: string, exports: Record<string, any>): boolean {
    const existing = this.modules.get(name);
    if (existing && existing.loaded) return false; // Prevent reload for security
    this.modules.set(name, { moduleName: name, exports, loaded: true });
    console.log(`[ScriptAPI] Loaded module: ${name}`);
    return true;
  }

  require(moduleName: string): Record<string, any> | null {
    const module = this.modules.get(moduleName);
    return module ? module.exports : null;
  }

  unloadModule(name: string): boolean {
    return this.modules.delete(name);
  }

  getLoadedModules(): string[] {
    return Array.from(this.modules.keys());
  }
}
