#include "NativeVoxelRenderer.hpp"

#include <cstring>
#include <stdexcept>

namespace eaoin::native_vulkan {
namespace {
void check(VkResult result, const char* message) {
  if (result != VK_SUCCESS) throw std::runtime_error(message);
}
}

void NativeVoxelRenderer::initialize(VkDevice device, VkPhysicalDevice physicalDevice) {
  device_ = device;
  physicalDevice_ = physicalDevice;
}

NativeVoxelMesh NativeVoxelRenderer::buildDemoChunkMesh(std::uint32_t size) const {
  NativeVoxelMesh mesh;
  const float s = static_cast<float>(size);
  mesh.vertices = {
      {0, 0, 0, 0, 1, 0, 0, 0, 1}, {s, 0, 0, 0, 1, 0, 1, 0, 1}, {s, 0, s, 0, 1, 0, 1, 1, 1}, {0, 0, s, 0, 1, 0, 0, 1, 1},
      {0, 1, 0, 0, 1, 0, 0, 0, 2}, {s, 1, 0, 0, 1, 0, 1, 0, 2}, {s, 1, s, 0, 1, 0, 1, 1, 2}, {0, 1, s, 0, 1, 0, 0, 1, 2},
  };
  mesh.indices = {0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6};
  return mesh;
}

void NativeVoxelRenderer::uploadMesh(const NativeVoxelMesh& mesh) {
  if (device_ == VK_NULL_HANDLE || physicalDevice_ == VK_NULL_HANDLE) throw std::runtime_error("NativeVoxelRenderer not initialized");
  destroy();

  const VkDeviceSize vertexSize = sizeof(NativeVoxelVertex) * mesh.vertices.size();
  const VkDeviceSize indexSize = sizeof(std::uint32_t) * mesh.indices.size();
  createBuffer(vertexSize, VK_BUFFER_USAGE_VERTEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, vertexBuffer_, vertexMemory_);
  createBuffer(indexSize, VK_BUFFER_USAGE_INDEX_BUFFER_BIT, VK_MEMORY_PROPERTY_HOST_VISIBLE_BIT | VK_MEMORY_PROPERTY_HOST_COHERENT_BIT, indexBuffer_, indexMemory_);

  void* data = nullptr;
  check(vkMapMemory(device_, vertexMemory_, 0, vertexSize, 0, &data), "Failed to map native voxel vertex memory");
  std::memcpy(data, mesh.vertices.data(), static_cast<std::size_t>(vertexSize));
  vkUnmapMemory(device_, vertexMemory_);

  check(vkMapMemory(device_, indexMemory_, 0, indexSize, 0, &data), "Failed to map native voxel index memory");
  std::memcpy(data, mesh.indices.data(), static_cast<std::size_t>(indexSize));
  vkUnmapMemory(device_, indexMemory_);

  uploadedVertices_ = static_cast<std::uint32_t>(mesh.vertices.size());
  uploadedIndices_ = static_cast<std::uint32_t>(mesh.indices.size());
}

void NativeVoxelRenderer::destroy() {
  if (device_ != VK_NULL_HANDLE) {
    if (indexBuffer_ != VK_NULL_HANDLE) vkDestroyBuffer(device_, indexBuffer_, nullptr);
    if (vertexBuffer_ != VK_NULL_HANDLE) vkDestroyBuffer(device_, vertexBuffer_, nullptr);
    if (indexMemory_ != VK_NULL_HANDLE) vkFreeMemory(device_, indexMemory_, nullptr);
    if (vertexMemory_ != VK_NULL_HANDLE) vkFreeMemory(device_, vertexMemory_, nullptr);
  }
  indexBuffer_ = VK_NULL_HANDLE;
  vertexBuffer_ = VK_NULL_HANDLE;
  indexMemory_ = VK_NULL_HANDLE;
  vertexMemory_ = VK_NULL_HANDLE;
  uploadedVertices_ = 0;
  uploadedIndices_ = 0;
}

std::uint32_t NativeVoxelRenderer::findMemoryType(std::uint32_t filter, VkMemoryPropertyFlags properties) const {
  VkPhysicalDeviceMemoryProperties memoryProperties{};
  vkGetPhysicalDeviceMemoryProperties(physicalDevice_, &memoryProperties);
  for (std::uint32_t i = 0; i < memoryProperties.memoryTypeCount; ++i) {
    if ((filter & (1u << i)) != 0 && (memoryProperties.memoryTypes[i].propertyFlags & properties) == properties) return i;
  }
  throw std::runtime_error("No suitable Vulkan memory type found");
}

void NativeVoxelRenderer::createBuffer(VkDeviceSize size, VkBufferUsageFlags usage, VkMemoryPropertyFlags properties, VkBuffer& buffer, VkDeviceMemory& memory) {
  VkBufferCreateInfo bufferInfo{};
  bufferInfo.sType = VK_STRUCTURE_TYPE_BUFFER_CREATE_INFO;
  bufferInfo.size = size;
  bufferInfo.usage = usage;
  bufferInfo.sharingMode = VK_SHARING_MODE_EXCLUSIVE;
  check(vkCreateBuffer(device_, &bufferInfo, nullptr, &buffer), "Failed to create Vulkan buffer");

  VkMemoryRequirements requirements{};
  vkGetBufferMemoryRequirements(device_, buffer, &requirements);

  VkMemoryAllocateInfo allocInfo{};
  allocInfo.sType = VK_STRUCTURE_TYPE_MEMORY_ALLOCATE_INFO;
  allocInfo.allocationSize = requirements.size;
  allocInfo.memoryTypeIndex = findMemoryType(requirements.memoryTypeBits, properties);
  check(vkAllocateMemory(device_, &allocInfo, nullptr, &memory), "Failed to allocate Vulkan buffer memory");
  check(vkBindBufferMemory(device_, buffer, memory, 0), "Failed to bind Vulkan buffer memory");
}

}  // namespace eaoin::native_vulkan
