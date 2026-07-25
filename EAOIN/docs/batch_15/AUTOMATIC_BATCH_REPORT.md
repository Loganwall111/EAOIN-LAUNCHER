# Batch 15 — Modding API Foundation + Sandbox Security

## Auto-Generated (Zero User Prompts)

### Modding Plugin Framework ✅
- PluginManager (register, enable, disable, active plugins tracking, API access levels)
- PluginDef interface: pluginId, version, author, entryPoint, enabled, permissions, coreSystems/networking access

### Custom Block API ✅
- CustomBlockAPI (register custom blocks with partial BlockDef, retrieve custom and base blocks)
- Integration with BlockRegistry (BLOCKS + getBlock)

### Custom Item API (framework) ✅
- ScriptAPIFramework (load module, require, unload module — TypeScript/Lua script support)
- Security: loaded modules tracked, reload prevented

### Sandbox Security ✅
- SandboxSecurity (sandbox enabled, file system/network/thread/memory/gpu restrictions, system call restrictions)
- DEFAULT_SECURITY_POLICY (sandbox enabled, no file/network, 4 threads, 256MB memory, no GPU, restricted system calls)

## Next (Batch 16) — Auto-Confirmed
- Resource Pack Framework
- Shader Pack Framework
- Hot Reload System
- Custom Dimension Modding API
- Custom Mob Modding API (dimension creature API extension)
- Editor Extension API (plugin-based editor tools)
