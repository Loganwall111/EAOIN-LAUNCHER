#pragma once

#include <vulkan/vulkan.h>

#include <cstdint>
#include <vector>

namespace eaoin::native_vulkan {

struct NativeVoxelVertex {
  float x;
  float y;
  float z;
  float nx;
  float ny;
  float nz;
  float u;
  float v;
  std::uint32_t blockId;
};

struct NativeVoxelMesh {
  std::vector<NativeVoxelVertex> vertices;
  std::vector<std::uint32_t> indices;
};

class NativeVoxelRenderer final {
 public:
  void initialize(VkDevice device, VkPhysicalDevice physicalDevice);
  NativeVoxelMesh buildDemoChunkMesh(std::uint32_t size = 16) const;
  void uploadMesh(const NativeVoxelMesh& mesh);
  void destroy();

  std::uint32_t uploadedVertices() const { return uploadedVertices_; }
  std::uint32_t uploadedIndices() const { return uploadedIndices_; }

 private:
  std::uint32_t findMemoryType(std::uint32_t filter, VkMemoryPropertyFlags properties) const;
  void createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& memory);

  VkDevice device_ = VK_NULL_HANDLE;
  VkPhysicalDevice physicalDevice_ = VK_NULL_HANDLE;
  VkBuffer vertexBuffer_ = VK_NULL_HANDLE;
  VkBuffer indexBuffer_ = VK_NULL_HANDLE;
  VkDeviceMemory vertexMemory_ = VK_NULL_HANDLE;
  VkDeviceMemory indexMemory_ = VK_NULL_HANDLE;
  std::uint32_t uploadedVertices_ = 0;
  std::uint32_t uploadedIndices_ = 0;
};

}  // namespace eaoin::native_vulkan
