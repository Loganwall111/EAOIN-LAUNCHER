#include "VulkanSwapchain.hpp"

#include <algorithm>
#include <stdexcept>

namespace eaoin::native_vulkan {
namespace {
void check(VkResult result, const char* message) {
  if (result != VK_SUCCESS) throw std::runtime_error(message);
}
}

VulkanSwapchain::~VulkanSwapchain() {
  destroy();
}

void VulkanSwapchain::create(const SwapchainCreateDesc& desc) {
  if (desc.device == VK_NULL_HANDLE || desc.physicalDevice == VK_NULL_HANDLE || desc.surface == VK_NULL_HANDLE) {
    throw std::runtime_error("Swapchain requires physical device, logical device, and a platform surface");
  }

  device_ = desc.device;

  VkSurfaceCapabilitiesKHR capabilities{};
  check(vkGetPhysicalDeviceSurfaceCapabilitiesKHR(desc.physicalDevice, desc.surface, &capabilities), "Failed to read surface capabilities");

  std::uint32_t formatCount = 0;
  check(vkGetPhysicalDeviceSurfaceFormatsKHR(desc.physicalDevice, desc.surface, &formatCount, nullptr), "Failed to count surface formats");
  std::vector<VkSurfaceFormatKHR> formats(formatCount);
  check(vkGetPhysicalDeviceSurfaceFormatsKHR(desc.physicalDevice, desc.surface, &formatCount, formats.data()), "Failed to read surface formats");

  std::uint32_t presentModeCount = 0;
  check(vkGetPhysicalDeviceSurfacePresentModesKHR(desc.physicalDevice, desc.surface, &presentModeCount, nullptr), "Failed to count present modes");
  std::vector<VkPresentModeKHR> presentModes(presentModeCount);
  check(vkGetPhysicalDeviceSurfacePresentModesKHR(desc.physicalDevice, desc.surface, &presentModeCount, presentModes.data()), "Failed to read present modes");

  const VkSurfaceFormatKHR surfaceFormat = chooseSurfaceFormat(formats);
  const VkPresentModeKHR presentMode = choosePresentMode(presentModes, desc.vsync);
  const VkExtent2D swapExtent = chooseExtent(capabilities, desc.width, desc.height);

  std::uint32_t imageCount = capabilities.minImageCount + 1;
  if (capabilities.maxImageCount > 0 && imageCount > capabilities.maxImageCount) imageCount = capabilities.maxImageCount;

  VkSwapchainCreateInfoKHR createInfo{};
  createInfo.sType = VK_STRUCTURE_TYPE_SWAPCHAIN_CREATE_INFO_KHR;
  createInfo.surface = desc.surface;
  createInfo.minImageCount = imageCount;
  createInfo.imageFormat = surfaceFormat.format;
  createInfo.imageColorSpace = surfaceFormat.colorSpace;
  createInfo.imageExtent = swapExtent;
  createInfo.imageArrayLayers = 1;
  createInfo.imageUsage = VK_IMAGE_USAGE_COLOR_ATTACHMENT_BIT;
  createInfo.imageSharingMode = VK_SHARING_MODE_EXCLUSIVE;
  createInfo.preTransform = capabilities.currentTransform;
  createInfo.compositeAlpha = VK_COMPOSITE_ALPHA_OPAQUE_BIT_KHR;
  createInfo.presentMode = presentMode;
  createInfo.clipped = VK_TRUE;
  createInfo.oldSwapchain = VK_NULL_HANDLE;

  check(vkCreateSwapchainKHR(device_, &createInfo, nullptr, &swapchain_), "Failed to create Vulkan swapchain");

  vkGetSwapchainImagesKHR(device_, swapchain_, &imageCount, nullptr);
  images_.resize(imageCount);
  check(vkGetSwapchainImagesKHR(device_, swapchain_, &imageCount, images_.data()), "Failed to fetch swapchain images");
  imageFormat_ = surfaceFormat.format;
  extent_ = swapExtent;

  imageViews_.resize(images_.size());
  for (std::size_t i = 0; i < images_.size(); ++i) {
    VkImageViewCreateInfo viewInfo{};
    viewInfo.sType = VK_STRUCTURE_TYPE_IMAGE_VIEW_CREATE_INFO;
    viewInfo.image = images_[i];
    viewInfo.viewType = VK_IMAGE_VIEW_TYPE_2D;
    viewInfo.format = imageFormat_;
    viewInfo.subresourceRange.aspectMask = VK_IMAGE_ASPECT_COLOR_BIT;
    viewInfo.subresourceRange.baseMipLevel = 0;
    viewInfo.subresourceRange.levelCount = 1;
    viewInfo.subresourceRange.baseArrayLayer = 0;
    viewInfo.subresourceRange.layerCount = 1;
    check(vkCreateImageView(device_, &viewInfo, nullptr, &imageViews_[i]), "Failed to create swapchain image view");
  }
}

void VulkanSwapchain::destroy() {
  if (device_ != VK_NULL_HANDLE) {
    for (VkImageView view : imageViews_) vkDestroyImageView(device_, view, nullptr);
    imageViews_.clear();
    if (swapchain_ != VK_NULL_HANDLE) vkDestroySwapchainKHR(device_, swapchain_, nullptr);
  }
  swapchain_ = VK_NULL_HANDLE;
  images_.clear();
  imageFormat_ = VK_FORMAT_UNDEFINED;
  extent_ = {};
}

VkSurfaceFormatKHR VulkanSwapchain::chooseSurfaceFormat(const std::vector<VkSurfaceFormatKHR>& formats) const {
  for (const auto& format : formats) {
    if (format.format == VK_FORMAT_B8G8R8A8_SRGB && format.colorSpace == VK_COLOR_SPACE_SRGB_NONLINEAR_KHR) return format;
  }
  if (formats.empty()) throw std::runtime_error("Surface reports no formats");
  return formats[0];
}

VkPresentModeKHR VulkanSwapchain::choosePresentMode(const std::vector<VkPresentModeKHR>& modes, bool vsync) const {
  if (!vsync) {
    for (const auto mode : modes) {
      if (mode == VK_PRESENT_MODE_MAILBOX_KHR) return mode;
    }
  }
  return VK_PRESENT_MODE_FIFO_KHR;
}

VkExtent2D VulkanSwapchain::chooseExtent(const VkSurfaceCapabilitiesKHR& capabilities, std::uint32_t width, std::uint32_t height) const {
  if (capabilities.currentExtent.width != UINT32_MAX) return capabilities.currentExtent;
  VkExtent2D extent{width, height};
  extent.width = std::clamp(extent.width, capabilities.minImageExtent.width, capabilities.maxImageExtent.width);
  extent.height = std::clamp(extent.height, capabilities.minImageExtent.height, capabilities.maxImageExtent.height);
  return extent;
}

}  // namespace eaoin::native_vulkan
