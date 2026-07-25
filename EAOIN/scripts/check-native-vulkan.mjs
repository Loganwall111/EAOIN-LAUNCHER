#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const checks = [];

function command(name, args = ['--version']) {
  const result = spawnSync(name, args, { encoding: 'utf8' });
  checks.push({
    name,
    ok: result.status === 0,
    detail: result.status === 0 ? (result.stdout || result.stderr).split('\n')[0] : result.stderr || 'not found',
  });
}

command('cmake');
command('c++');
command('glslc');

checks.push({
  name: 'vulkan.h',
  ok: existsSync('/usr/include/vulkan/vulkan.h') || Boolean(process.env.VULKAN_SDK),
  detail: process.env.VULKAN_SDK ? `VULKAN_SDK=${process.env.VULKAN_SDK}` : '/usr/include/vulkan/vulkan.h',
});

command('pkg-config', ['--modversion', 'glfw3']);

console.log('EAOIN Native Vulkan Environment Check');
console.log('====================================');
for (const check of checks) {
  console.log(`${check.ok ? '✅' : '❌'} ${check.name}: ${check.detail.trim()}`);
}

const failed = checks.filter((check) => !check.ok);
if (failed.length > 0) {
  console.log('\nMissing native Vulkan prerequisites. On Debian/Ubuntu install:');
  console.log('sudo apt-get update && sudo apt-get install -y cmake build-essential libvulkan-dev vulkan-tools libglfw3-dev glslc');
  console.log('\nOr use the provided native/vulkan/Dockerfile on a machine with network access.');
  process.exitCode = 1;
} else {
  console.log('\nNative Vulkan toolchain is ready.');
}
