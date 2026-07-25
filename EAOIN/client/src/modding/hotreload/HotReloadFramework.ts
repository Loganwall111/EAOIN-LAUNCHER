/**
 * HotReloadFramework — Hot Reload for Mod Development
 */
export interface HotReloadState {
  lastReloadTime: number;
  reloadCount: number;
  activeModules: string[];
}

export class HotReloadFramework {
  private state: HotReloadState = {
    lastReloadTime: 0,
    reloadCount: 0,
    activeModules: [],
  };

  triggerReload(moduleName?: string): boolean {
    this.state.reloadCount++;
    this.state.lastReloadTime = Date.now();
    if (moduleName) {
      if (!this.state.activeModules.includes(moduleName)) {
        this.state.activeModules.push(moduleName);
      }
      console.log(`[HotReload] Reloaded module: ${moduleName}`);
    } else {
      console.log(`[HotReload] Full reload triggered (count: ${this.state.reloadCount})`);
    }
    return true;
  }

  getState(): HotReloadState {
    return { ...this.state };
  }

  registerActiveModule(moduleName: string): void {
    if (!this.state.activeModules.includes(moduleName)) {
      this.state.activeModules.push(moduleName);
    }
  }
}
