#pragma once

#include <vulkan/vulkan.h>

#include <cstdint>
#include <vector>

namespace eaoin::native_vulkan {

struct SwapchainCreateDesc {
  VkPhysicalDevice physicalDevice = VK_NULL_HANDLE;
  VkDevice device = VK_NULL_HANDLE;
  VkSurfaceKHR surface = VK_NULL_HANDLE;
  std::uint32_t graphicsQueueFamily = 0;
  std::uint32_t width = 1280;
  std::uint32_t height = 720;
  bool vsync = true;
};

class VulkanSwapchain final {
 public:
  VulkanSwapchain() = default;
  VulkanSwapchain(const VulkanSwapchain&) = delete;
  VulkanSwapchain& operator=(const VulkanSwapchain&) = delete;
  ~VulkanSwapchain();

  void create(const SwapchainCreateDesc& desc);
  void destroy();

  VkSwapchainKHR handle() const { return swapchain_; }
  VkFormat imageFormat() const { return imageFormat_; }
  VkExtent2D extent() const { return extent_; }
  const std::vector<VkImage>& images() const { return images_; }
  const std::vector<VkImageView>& imageViews() const { return imageViews_; }

 private:
  VkSurfaceFormatKHR chooseSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& formats) const;
  VkPresentModeKHR choosePresentMode(const std::vector<VkPresentModeKHR>& modes, bool vsync) const;
  VkExtent2D chooseExtent(const VkSurfaceCapabilitiesKHR& capabilities, std::uint32_t width, std::uint32_t height) const;

  VkDevice device_ = VK_NULL_HANDLE;
  VkSwapchainKHR swapchain_ = VK_NULL_HANDLE;
  VkFormat imageFormat_ = VK_FORMAT_UNDEFINED;
  VkExtent2D extent_{};
  std::vector<VkImage> images_;
  std::vector<VkImageView> imageViews_;
};

}  // namespace eaoin::native_vulkan
