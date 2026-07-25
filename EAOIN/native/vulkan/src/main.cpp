#include "VulkanBootstrap.hpp"

#include <cstdlib>
#include <iostream>

int main() {
  using namespace eaoin::native_vulkan;

  try {
    VulkanBootstrap bootstrap;
    const VulkanBootstrapReport report = bootstrap.initialize();

    std::cout << "EAOIN 1.0 Release to Life — Native Vulkan Bootstrap\n";
    std::cout << "Vulkan instance version: " << formatVersion(report.instanceVersion) << "\n";
    std::cout << "Instance created: " << (report.instanceCreated ? "yes" : "no") << "\n";
    std::cout << "Logical device created: " << (report.logicalDeviceCreated ? "yes" : "no") << "\n";
    std::cout << "Selected device: " << report.selectedDevice << "\n";
    std::cout << "Graphics queue family: " << report.selectedGraphicsQueueFamily << "\n";
    std::cout << "Detected devices: " << report.devices.size() << "\n";

    for (const VulkanDeviceInfo& device : report.devices) {
      std::cout << " - " << device.name
                << " [" << deviceTypeName(device.type) << "]"
                << " API " << formatVersion(device.apiVersion)
                << " graphics=" << (device.graphicsQueue ? "yes" : "no")
                << " compute=" << (device.computeQueue ? "yes" : "no")
                << " vendor=0x" << std::hex << device.vendorId
                << " device=0x" << device.deviceId << std::dec << "\n";
    }

    bootstrap.shutdown();
    return EXIT_SUCCESS;
  } catch (const std::exception& error) {
    std::cerr << "EAOIN native Vulkan bootstrap failed: " << error.what() << "\n";
    return EXIT_FAILURE;
  }
}
