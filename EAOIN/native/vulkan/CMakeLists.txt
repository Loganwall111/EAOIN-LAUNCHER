cmake_minimum_required(VERSION 3.20)

project(eaoin_vulkan_bootstrap VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

find_package(Vulkan REQUIRED)

find_package(glfw3 QUIET)
if (glfw3_FOUND)
  add_compile_definitions(EAOIN_VULKAN_USE_GLFW=1)
endif()

add_executable(eaoin-vulkan-bootstrap
  src/main.cpp
  src/VulkanBootstrap.cpp
  src/VulkanSwapchain.cpp
  src/VulkanPipeline.cpp
  src/VulkanWindow.cpp
  src/NativeVoxelRenderer.cpp
)

target_include_directories(eaoin-vulkan-bootstrap PRIVATE
  ${Vulkan_INCLUDE_DIRS}
  ${CMAKE_CURRENT_SOURCE_DIR}/src
)

target_link_libraries(eaoin-vulkan-bootstrap PRIVATE Vulkan::Vulkan)
if (glfw3_FOUND)
  target_link_libraries(eaoin-vulkan-bootstrap PRIVATE glfw)
endif()

find_program(GLSLC glslc)
if (GLSLC)
  file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/shaders)
  add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/shaders/voxel.vert.spv
    COMMAND ${GLSLC} ${CMAKE_CURRENT_SOURCE_DIR}/shaders/voxel.vert -o ${CMAKE_CURRENT_BINARY_DIR}/shaders/voxel.vert.spv
    DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/shaders/voxel.vert
  )
  add_custom_command(
    OUTPUT ${CMAKE_CURRENT_BINARY_DIR}/shaders/voxel.frag.spv
    COMMAND ${GLSLC} ${CMAKE_CURRENT_SOURCE_DIR}/shaders/voxel.frag -o ${CMAKE_CURRENT_BINARY_DIR}/shaders/voxel.frag.spv
    DEPENDS ${CMAKE_CURRENT_SOURCE_DIR}/shaders/voxel.frag
  )
  add_custom_target(eaoin-vulkan-shaders DEPENDS
    ${CMAKE_CURRENT_BINARY_DIR}/shaders/voxel.vert.spv
    ${CMAKE_CURRENT_BINARY_DIR}/shaders/voxel.frag.spv
  )
  add_dependencies(eaoin-vulkan-bootstrap eaoin-vulkan-shaders)
endif()

target_compile_definitions(eaoin-vulkan-bootstrap PRIVATE
  EAOIN_NATIVE_VULKAN=1
  EAOIN_RELEASE_NAME="Release to Life"
  EAOIN_RELEASE_VERSION="1.0.0"
)

if (MSVC)
  target_compile_options(eaoin-vulkan-bootstrap PRIVATE /W4)
else()
  target_compile_options(eaoin-vulkan-bootstrap PRIVATE -Wall -Wextra -Wpedantic)
endif()
