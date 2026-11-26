import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const parsedPort = Number(env.VITE_PORT);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : 5173;
  const apiProxyTarget = env.VITE_API_PROXY_TARGET?.trim() || 'http://localhost:4000';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        manifest: false,
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}']
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (
              id.includes('/react/') ||
              id.includes('/react-dom/') ||
              id.includes('/scheduler/')
            ) {
              return 'vendor-react';
            }
            if (
              id.includes('/@tanstack/react-query') ||
              id.includes('/axios/') ||
              id.includes('/zustand/')
            ) {
              return 'vendor-query';
            }
            if (
              id.includes('/recharts/') ||
              id.includes('/d3-') ||
              id.includes('/lodash') ||
              id.includes('/victory-vendor/')
            ) {
              return 'vendor-charts';
            }
            if (id.includes('/lucide-react/')) {
              return 'vendor-icons';
            }
            return undefined;
          }
        }
      }
    },
    server: {
      port,
      proxy: {
        '/api': {
          target: apiProxyTarget,
          changeOrigin: true
        }
      }
    }
  };
});
