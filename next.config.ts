import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que dispositivos de la red local usen el servidor de desarrollo.
  // Sin esta excepción Next bloquea sus recursos internos, incluido /_next/hmr.
  allowedDevOrigins: ["172.20.10.12"],
};

export default nextConfig;
