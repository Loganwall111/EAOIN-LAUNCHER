#!/usr/bin/env bash
set -euo pipefail

if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update
  sudo apt-get install -y cmake build-essential libvulkan-dev vulkan-tools libglfw3-dev glslc || \
  sudo apt-get install -y cmake build-essential libvulkan-dev vulkan-tools libglfw3-dev shaderc
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y cmake gcc-c++ vulkan-headers vulkan-loader-devel vulkan-tools glfw-devel glslc
elif command -v pacman >/dev/null 2>&1; then
  sudo pacman -Sy --noconfirm cmake base-devel vulkan-headers vulkan-icd-loader vulkan-tools glfw shaderc
elif command -v brew >/dev/null 2>&1; then
  brew install cmake vulkan-headers vulkan-loader glfw shaderc
else
  echo "Unsupported package manager. Install Vulkan SDK, CMake, C++20 compiler, GLFW, and glslc manually." >&2
  exit 1
fi

node scripts/check-native-vulkan.mjs
