#pragma once

#include <vulkan/vulkan.h>

#include <cstdint>
#include <string>
#include <vector>

#if defined(EAOIN_VULKAN_USE_GLFW)
struct GLFWwindow;
#endif

namespace eaoin::native_vulkan {

struct VulkanWindowDesc {
  std::uint32_t width = 1280;
  std::uint32_t height = 720;
  std::string title = "EAOIN Native Vulkan";
};

class VulkanWindow final {
 public:
  VulkanWindow() = default;
  VulkanWindow(const VulkanWindow&) = delete;
  VulkanWindow& operator=(const VulkanWindow&) = delete;
  ~VulkanWindow();

  void create(const VulkanWindowDesc& desc);
  void destroy();
  bool shouldClose() const;
  void pollEvents() const;
  std::vector<const char*> requiredInstanceExtensions() const;
  VkSurfaceKHR createSurface(VkInstance instance) const;

  std::uint32_t width() const { return width_; }
  std::uint32_t height() const { return height_; }

 private:
  std::uint32_t width_ = 0;
  std::uint32_t height_ = 0;
#if defined(EAOIN_VULKAN_USE_GLFW)
  GLFWwindow* window_ = nullptr;
#endif
};

}  // namespace eaoin::native_vulkan
