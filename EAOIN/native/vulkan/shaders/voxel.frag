#version 450

layout(location = 0) in vec3 vNormal;
layout(location = 1) in vec2 vUv;
layout(location = 2) flat in uint vBlockId;

layout(location = 0) out vec4 outColor;

vec3 blockColor(uint id) {
  if (id == 1u) return vec3(0.24, 0.62, 0.20);
  if (id == 2u) return vec3(0.48, 0.29, 0.14);
  if (id == 3u) return vec3(0.48, 0.50, 0.53);
  if (id == 15u) return vec3(0.55, 0.20, 1.0);
  return vec3(0.72, 0.78, 0.86);
}

void main() {
  float light = max(0.25, dot(normalize(vNormal), normalize(vec3(0.3, 0.8, 0.4))));
  outColor = vec4(blockColor(vBlockId) * light, 1.0);
}
