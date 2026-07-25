#pragma once

#include <vulkan/vulkan.h>

#include <cstdint>
#include <string>
#include <vector>

namespace eaoin::native_vulkan {

struct VulkanDeviceInfo {
  std::string name;
  std::uint32_t apiVersion = 0;
  std::uint32_t driverVersion = 0;
  std::uint32_t vendorId = 0;
  std::uint32_t deviceId = 0;
  VkPhysicalDeviceType type = VK_PHYSICAL_DEVICE_TYPE_OTHER;
  bool graphicsQueue = false;
  bool computeQueue = false;
};

struct VulkanBootstrapReport {
  std::uint32_t instanceVersion = 0;
  std::vector<VulkanDeviceInfo> devices;
  std::string selectedDevice;
  std::uint32_t selectedGraphicsQueueFamily = 0;
  bool instanceCreated = false;
  bool logicalDeviceCreated = false;
};

class VulkanBootstrap final {
 public:
  VulkanBootstrap() = default;
  VulkanBootstrap(const VulkanBootstrap&) = delete;
  VulkanBootstrap& operator=(const VulkanBootstrap&) = delete;
  ~VulkanBootstrap();

  VulkanBootstrapReport initialize();
  void shutdown();

 private:
  void createInstance();
  void enumerateDevices(VulkanBootstrapReport& report);
  void createLogicalDevice(VulkanBootstrapReport& report, VkPhysicalDevice selectedDevice, std::uint32_t queueFamilyIndex);

  VkInstance instance_ = VK_NULL_HANDLE;
  VkDevice device_ = VK_NULL_HANDLE;
  VkQueue graphicsQueue_ = VK_NULL_HANDLE;
};

std::string formatVersion(std::uint32_t version);
std::string deviceTypeName(VkPhysicalDeviceType type);

}  // namespace eaoin::native_vulkan
