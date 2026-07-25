FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    cmake \
    git \
    libglfw3-dev \
    libvulkan-dev \
    shaderc \
    vulkan-tools \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace/EAOIN

CMD ["bash", "-lc", "cmake -S native/vulkan -B native/vulkan/build && cmake --build native/vulkan/build --config Release && ./native/vulkan/build/eaoin-vulkan-bootstrap"]
