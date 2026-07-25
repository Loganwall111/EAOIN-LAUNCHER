/**
 * SandboxSecurity — Runtime Protection for Mods
 */
export interface SecurityPolicy {
  sandboxEnabled: boolean;
  fileSystemAccess: boolean;
  networkAccess: boolean;
  threadLimit: number;
  memoryLimitMB: number;
  gpuAccess: boolean;
  systemCallRestrictions: string[];
}

export const DEFAULT_SECURITY_POLICY: SecurityPolicy = {
  sandboxEnabled: true,
  fileSystemAccess: false,
  networkAccess: false,
  threadLimit: 4,
  memoryLimitMB: 256,
  gpuAccess: false,
  systemCallRestrictions: ['exec', 'eval', 'fork', 'open', 'read_file', 'write_file'],
};

export class SandboxSecurity {
  private policies = new Map<string, SecurityPolicy>();

  constructor() {
    this.policies.set('default', DEFAULT_SECURITY_POLICY);
  }

  setPolicy(pluginId: string, policy: Partial<SecurityPolicy>): void {
    const current = this.policies.get(pluginId) ?? DEFAULT_SECURITY_POLICY;
    this.policies.set(pluginId, { ...current, ...policy });
    console.log(`[Sandbox] Security policy updated for plugin: ${pluginId}`);
  }

  enforcePolicy(pluginId: string, operation: string): boolean {
    const policy = this.policies.get(pluginId) ?? DEFAULT_SECURITY_POLICY;
    if (!policy.sandboxEnabled) {
      console.log(`[Sandbox] Sandbox disabled for ${pluginId}`);
      return true;
    }
    const restricted = policy.systemCallRestrictions.includes(operation);
    if (restricted) {
      console.log(`[Sandbox] BLOCKED operation ${operation} for plugin ${pluginId}`);
      return false;
    }
    console.log(`[Sandbox] ALLOWED operation ${operation} for plugin ${pluginId}`);
    return true;
  }

  getPolicy(pluginId: string): SecurityPolicy {
    return this.policies.get(pluginId) ?? DEFAULT_SECURITY_POLICY;
  }
}
