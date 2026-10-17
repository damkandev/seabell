import type { NextConfig } from "next";

// Tauri sirve el frontend como archivos estáticos: sin servidor ni optimizador de imágenes.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
