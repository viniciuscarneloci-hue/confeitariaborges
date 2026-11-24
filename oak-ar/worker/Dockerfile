# Worker de fotogrametria: COLMAP + OpenMVS com CUDA. Rode numa máquina com GPU NVIDIA
# (ex.: instância g4dn/g5 na AWS, RunPod, Vast.ai) com: docker run --gpus all -p 8080:8080 --env-file .env oak-worker
FROM colmap/colmap:latest

RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
      git cmake build-essential ffmpeg python3 nodejs npm \
      libboost-iostreams-dev libboost-program-options-dev libboost-system-dev libboost-serialization-dev \
      libopencv-dev libcgal-dev libglew-dev libglfw3-dev libjpeg-dev libpng-dev libtiff-dev libeigen3-dev \
    && rm -rf /var/lib/apt/lists/*

# OpenMVS (densificação, malha e textura com exportação em GLB)
RUN git clone --depth 1 --recurse-submodules https://github.com/cdcseacave/VCG.git /opt/vcglib \
 && git clone --depth 1 --branch develop --recurse-submodules https://github.com/cdcseacave/openMVS.git /opt/openMVS \
 && cmake -S /opt/openMVS -B /opt/openMVS/build -DCMAKE_BUILD_TYPE=Release -DVCG_ROOT=/opt/vcglib -DOpenMVS_USE_CUDA=ON \
 && cmake --build /opt/openMVS/build -j"$(nproc)" && cmake --install /opt/openMVS/build
ENV PATH="/usr/local/bin/OpenMVS:${PATH}"

WORKDIR /app
COPY server.py reconstruct.sh ./
RUN npm i -g @gltf-transform/cli@4.1.1
EXPOSE 8080
CMD ["python3", "server.py"]
