#version 450

layout(location = 0) in vec3 inPosition;
layout(location = 1) in vec3 inNormal;
layout(location = 2) in vec2 inUv;
layout(location = 3) in uint inBlockId;

layout(location = 0) out vec3 vNormal;
layout(location = 1) out vec2 vUv;
layout(location = 2) flat out uint vBlockId;

void main() {
  vNormal = inNormal;
  vUv = inUv;
  vBlockId = inBlockId;
  gl_Position = vec4(inPosition.x / 32.0 - 0.5, inPosition.y / 32.0 - 0.5, inPosition.z / 32.0, 1.0);
}
