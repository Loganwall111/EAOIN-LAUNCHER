#include "VulkanWindow.hpp"

#include <stdexcept>

#if defined(EAOIN_VULKAN_USE_GLFW)
#define GLFW_INCLUDE_VULKAN
#include <GLFW/glfw3.h>
#endif

namespace eaoin::native_vulkan {

VulkanWindow::~VulkanWindow() {
  destroy();
}

void VulkanWindow::create(const VulkanWindowDesc& desc) {
  width_ = desc.width;
  height_ = desc.height;
#if defined(EAOIN_VULKAN_USE_GLFW)
  if (glfwInit() != GLFW_TRUE) throw std::runtime_error("Failed to initialize GLFW");
  glfwWindowHint(GLFW_CLIENT_API, GLFW_NO_API);
  glfwWindowHint(GLFW_RESIZABLE, GLFW_TRUE);
  window_ = glfwCreateWindow(static_cast<int>(desc.width), static_cast<int>(desc.height), desc.title.c_str(), nullptr, nullptr);
  if (!window_) throw std::runtime_error("Failed to create GLFW Vulkan window");
#else
  (void)desc;
  throw std::runtime_error("EAOIN_VULKAN_USE_GLFW is not enabled; configure with glfw3 to create native surfaces");
#endif
}

void VulkanWindow::destroy() {
#if defined(EAOIN_VULKAN_USE_GLFW)
  if (window_) {
    glfwDestroyWindow(window_);
    window_ = nullptr;
  }
  glfwTerminate();
#endif
  width_ = 0;
  height_ = 0;
}

bool VulkanWindow::shouldClose() const {
#if defined(EAOIN_VULKAN_USE_GLFW)
  return window_ ? glfwWindowShouldClose(window_) != 0 : true;
#else
  return true;
#endif
}

void VulkanWindow::pollEvents() const {
#if defined(EAOIN_VULKAN_USE_GLFW)
  glfwPollEvents();
#endif
}

std::vector<const char*> VulkanWindow::requiredInstanceExtensions() const {
#if defined(EAOIN_VULKAN_USE_GLFW)
  std::uint32_t count = 0;
  const char** extensions = glfwGetRequiredInstanceExtensions(&count);
  if (!extensions || count == 0) throw std::runtime_error("GLFW did not report required Vulkan extensions");
  return std::vector<const char*>(extensions, extensions + count);
#else
  return {};
#endif
}

VkSurfaceKHR VulkanWindow::createSurface(VkInstance instance) const {
#if defined(EAOIN_VULKAN_USE_GLFW)
  VkSurfaceKHR surface = VK_NULL_HANDLE;
  if (!window_) throw std::runtime_error("Cannot create Vulkan surface before window creation");
  if (glfwCreateWindowSurface(instance, window_, nullptr, &surface) != VK_SUCCESS) {
    throw std::runtime_error("Failed to create Vulkan window surface");
  }
  return surface;
#else
  (void)instance;
  throw std::runtime_error("EAOIN_VULKAN_USE_GLFW is not enabled; no surface backend available");
#endif
}

}  // namespace eaoin::native_vulkan
