/**
 * DeferredShaderFramework — Shader Integration for Deferred Pipeline
 */
export interface ShaderProgram {
  name: string;
  vertexShaderSource: string;
  fragmentShaderSource: string;
  uniforms: Record<string, string>;
  compiled: boolean;
}

export class DeferredShaderFramework {
  private shaders = new Map<string, ShaderProgram>();

  registerShader(program: ShaderProgram): void {
    this.shaders.set(program.name, { ...program, compiled: false });
    console.log(`[ShaderFramework] Registered shader: ${program.name}`);
  }

  compileShader(name: string): boolean {
    const shader = this.shaders.get(name);
    if (!shader) return false;
    shader.compiled = true;
    console.log(`[ShaderFramework] Compiled shader: ${name}`);
    return true;
  }

  getShader(name: string): ShaderProgram | null {
    return this.shaders.get(name) ?? null;
  }

  getAllShaders(): ShaderProgram[] {
    return Array.from(this.shaders.values());
  }
}
