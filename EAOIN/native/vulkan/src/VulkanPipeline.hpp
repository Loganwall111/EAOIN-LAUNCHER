#pragma once

#include <vulkan/vulkan.h>

#include <cstdint>
#include <vector>

namespace eaoin::native_vulkan {

struct PipelineCreateDesc {
  VkDevice device = VK_NULL_HANDLE;
  VkFormat colorFormat = VK_FORMAT_B8G8R8A8_SRGB;
  VkExtent2D extent{};
  std::vector<std::uint32_t> vertexShaderSpirv;
  std::vector<std::uint32_t> fragmentShaderSpirv;
};

class VulkanPipeline final {
 public:
  VulkanPipeline() = default;
  VulkanPipeline(const VulkanPipeline&) = delete;
  VulkanPipeline& operator=(const VulkanPipeline&) = delete;
  ~VulkanPipeline();

  void create(const PipelineCreateDesc& desc);
  void destroy();
  void recordClearCommands(VkCommandBuffer commandBuffer, VkFramebuffer framebuffer) const;

  VkRenderPass renderPass() const { return renderPass_; }
  VkPipelineLayout layout() const { return pipelineLayout_; }
  VkPipeline pipeline() const { return pipeline_; }

 private:
  VkShaderModule createShaderModule(const std::vector<std::uint32_t>& spirv) const;

  VkDevice device_ = VK_NULL_HANDLE;
  VkExtent2D extent_{};
  VkRenderPass renderPass_ = VK_NULL_HANDLE;
  VkPipelineLayout pipelineLayout_ = VK_NULL_HANDLE;
  VkPipeline pipeline_ = VK_NULL_HANDLE;
};

}  // namespace eaoin::native_vulkan
