#include "VulkanBootstrap.hpp"

#include <algorithm>
#include <stdexcept>

namespace eaoin::native_vulkan {
namespace {

void check(VkResult result, const char* message) {
  if (result != VK_SUCCESS) {
    throw std::runtime_error(message);
  }
}

bool isDiscreteOrIntegrated(VkPhysicalDeviceType type) {
  return type == VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU || type == VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU;
}

}  // namespace

VulkanBootstrap::~VulkanBootstrap() {
  shutdown();
}

VulkanBootstrapReport VulkanBootstrap::initialize() {
  VulkanBootstrapReport report;

  std::uint32_t version = VK_API_VERSION_1_0;
#if defined(VK_VERSION_1_1)
  if (vkEnumerateInstanceVersion != nullptr) {
    check(vkEnumerateInstanceVersion(&version), "Failed to enumerate Vulkan instance version");
  }
#endif
  report.instanceVersion = version;

  createInstance();
  report.instanceCreated = true;
  enumerateDevices(report);
  return report;
}

void VulkanBootstrap::shutdown() {
  if (device_ != VK_NULL_HANDLE) {
    vkDeviceWaitIdle(device_);
    vkDestroyDevice(device_, nullptr);
    device_ = VK_NULL_HANDLE;
    graphicsQueue_ = VK_NULL_HANDLE;
  }

  if (instance_ != VK_NULL_HANDLE) {
    vkDestroyInstance(instance_, nullptr);
    instance_ = VK_NULL_HANDLE;
  }
}

void VulkanBootstrap::createInstance() {
  VkApplicationInfo appInfo{};
  appInfo.sType = VK_STRUCTURE_TYPE_APPLICATION_INFO;
  appInfo.pApplicationName = "EAOIN Release to Life";
  appInfo.applicationVersion = VK_MAKE_VERSION(1, 0, 0);
  appInfo.pEngineName = "EAOIN Native Vulkan Bootstrap";
  appInfo.engineVersion = VK_MAKE_VERSION(1, 0, 0);
  appInfo.apiVersion = VK_API_VERSION_1_2;

  VkInstanceCreateInfo createInfo{};
  createInfo.sType = VK_STRUCTURE_TYPE_INSTANCE_CREATE_INFO;
  createInfo.pApplicationInfo = &appInfo;

  check(vkCreateInstance(&createInfo, nullptr, &instance_), "Failed to create Vulkan instance");
}

void VulkanBootstrap::enumerateDevices(VulkanBootstrapReport& report) {
  std::uint32_t count = 0;
  check(vkEnumeratePhysicalDevices(instance_, &count, nullptr), "Failed to count Vulkan physical devices");
  if (count == 0) {
    throw std::runtime_error("No Vulkan physical devices found");
  }

  std::vector<VkPhysicalDevice> physicalDevices(count);
  check(vkEnumeratePhysicalDevices(instance_, &count, physicalDevices.data()), "Failed to enumerate Vulkan physical devices");

  VkPhysicalDevice selected = VK_NULL_HANDLE;
  std::uint32_t selectedQueueFamily = 0;

  for (VkPhysicalDevice physicalDevice : physicalDevices) {
    VkPhysicalDeviceProperties properties{};
    vkGetPhysicalDeviceProperties(physicalDevice, &properties);

    std::uint32_t queueCount = 0;
    vkGetPhysicalDeviceQueueFamilyProperties(physicalDevice, &queueCount, nullptr);
    std::vector<VkQueueFamilyProperties> queues(queueCount);
    vkGetPhysicalDeviceQueueFamilyProperties(physicalDevice, &queueCount, queues.data());

    VulkanDeviceInfo info;
    info.name = properties.deviceName;
    info.apiVersion = properties.apiVersion;
    info.driverVersion = properties.driverVersion;
    info.vendorId = properties.vendorID;
    info.deviceId = properties.deviceID;
    info.type = properties.deviceType;

    for (std::uint32_t i = 0; i < queues.size(); ++i) {
      const auto flags = queues[i].queueFlags;
      info.graphicsQueue = info.graphicsQueue || (flags & VK_QUEUE_GRAPHICS_BIT) != 0;
      info.computeQueue = info.computeQueue || (flags & VK_QUEUE_COMPUTE_BIT) != 0;

      if (selected == VK_NULL_HANDLE && (flags & VK_QUEUE_GRAPHICS_BIT) != 0) {
        selected = physicalDevice;
        selectedQueueFamily = i;
      }
    }

    if (isDiscreteOrIntegrated(properties.deviceType) && info.graphicsQueue) {
      selected = physicalDevice;
      selectedQueueFamily = 0;
      for (std::uint32_t i = 0; i < queues.size(); ++i) {
        if ((queues[i].queueFlags & VK_QUEUE_GRAPHICS_BIT) != 0) {
          selectedQueueFamily = i;
          break;
        }
      }
    }

    report.devices.push_back(info);
  }

  if (selected == VK_NULL_HANDLE) {
    throw std::runtime_error("No Vulkan graphics-capable queue family found");
  }

  createLogicalDevice(report, selected, selectedQueueFamily);
}

void VulkanBootstrap::createLogicalDevice(VulkanBootstrapReport& report, VkPhysicalDevice selectedDevice, std::uint32_t queueFamilyIndex) {
  const float priority = 1.0F;
  VkDeviceQueueCreateInfo queueCreateInfo{};
  queueCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_QUEUE_CREATE_INFO;
  queueCreateInfo.queueFamilyIndex = queueFamilyIndex;
  queueCreateInfo.queueCount = 1;
  queueCreateInfo.pQueuePriorities = &priority;

  VkPhysicalDeviceFeatures features{};

  VkDeviceCreateInfo deviceCreateInfo{};
  deviceCreateInfo.sType = VK_STRUCTURE_TYPE_DEVICE_CREATE_INFO;
  deviceCreateInfo.queueCreateInfoCount = 1;
  deviceCreateInfo.pQueueCreateInfos = &queueCreateInfo;
  deviceCreateInfo.pEnabledFeatures = &features;

  check(vkCreateDevice(selectedDevice, &deviceCreateInfo, nullptr, &device_), "Failed to create Vulkan logical device");
  vkGetDeviceQueue(device_, queueFamilyIndex, 0, &graphicsQueue_);

  VkPhysicalDeviceProperties properties{};
  vkGetPhysicalDeviceProperties(selectedDevice, &properties);
  report.selectedDevice = properties.deviceName;
  report.selectedGraphicsQueueFamily = queueFamilyIndex;
  report.logicalDeviceCreated = true;
}

std::string formatVersion(std::uint32_t version) {
  return std::to_string(VK_VERSION_MAJOR(version)) + "." + std::to_string(VK_VERSION_MINOR(version)) + "." + std::to_string(VK_VERSION_PATCH(version));
}

std::string deviceTypeName(VkPhysicalDeviceType type) {
  switch (type) {
    case VK_PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU:
      return "Integrated GPU";
    case VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU:
      return "Discrete GPU";
    case VK_PHYSICAL_DEVICE_TYPE_VIRTUAL_GPU:
      return "Virtual GPU";
    case VK_PHYSICAL_DEVICE_TYPE_CPU:
      return "CPU";
    default:
      return "Other";
  }
}

}  // namespace eaoin::native_vulkan
