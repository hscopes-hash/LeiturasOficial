import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Otimizações para reduzir uso de memória e processos
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  // Build ID inclui a versão do app para rastreabilidade
  generateBuildId: async () => {
    try {
      const { VERSION_STRING } = await import('./src/lib/version');
      return `caixafacil-${VERSION_STRING}-${Date.now().toString(36)}`;
    } catch {
      return `caixafacil-${Date.now().toString(36)}`;
    }
  },
};

export default nextConfig;
