import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import { TanStackRouterVite } from '@tanstack/router-vite-plugin';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { glob } from 'glob';

// Plugin para copiar assets de src/assets para public/assets
const copyAssetsPlugin = () => ({
  name: 'copy-assets',
  buildStart() {
    // Copiar assets apenas durante o build
    if (process.env.NODE_ENV === 'production') {
      const srcAssetsDir = path.resolve(__dirname, 'src/assets');
      const publicAssetsDir = path.resolve(__dirname, 'public/assets');

      // Criar diretório de destino se não existir
      if (!existsSync(publicAssetsDir)) {
        mkdirSync(publicAssetsDir, { recursive: true });
      }

      try {
        // Encontrar todos os arquivos de assets
        const assetFiles = glob.sync('**/*', {
          cwd: srcAssetsDir,
          nodir: true,
        });

        // Copiar cada arquivo mantendo a estrutura
        assetFiles.forEach(file => {
          const srcFile = path.join(srcAssetsDir, file);
          const destFile = path.join(publicAssetsDir, file);
          const destDir = path.dirname(destFile);

          // Criar diretório de destino se não existir
          if (!existsSync(destDir)) {
            mkdirSync(destDir, { recursive: true });
          }

          // Copiar arquivo
          copyFileSync(srcFile, destFile);
        });

        console.log(`✅ Copiados ${assetFiles.length} assets para public/assets`);
      } catch (error) {
        console.warn('⚠️ Erro ao copiar assets:', error);
      }
    }
  },
});

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), TanStackRouterVite(), copyAssetsPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Configurações otimizadas para desenvolvimento
    hmr: {
      overlay: true,
      port: 24678, // Porta específica para HMR
    },
    // Configurações de watch mais eficientes
    watch: {
      usePolling: false, // Desabilitar polling - mais eficiente
      ignored: ['**/node_modules/**', '**/dist/**'],
    },
    // Headers para evitar cache em desenvolvimento
    headers:
      mode === 'development'
        ? {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            Pragma: 'no-cache',
            Expires: '0',
          }
        : {},
  },
  // Configurações específicas para desenvolvimento
  ...(mode === 'development' && {
    define: {
      // Desabilitar PWA features em desenvolvimento
      __PWA_ENABLED__: false,
    },
    optimizeDeps: {
      include: ['react', 'react-dom', '@tanstack/react-router', 'lucide-react'],
      exclude: ['@tanstack/router-devtools'],
      force: true, // Força re-otimização
    },
  }),
  build: {
    // Otimizações de build apenas para produção
    target: 'esnext',
    minify: 'terser',
    sourcemap: false,
    // Configurações de chunking para otimizar tamanho
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
      output: {
        // Manual chunks apenas em produção
        ...(mode === 'production' && {
          manualChunks: {
            // Chunk para React e relacionados
            'react-vendor': ['react', 'react-dom', 'react-dom/client'],
            // Chunk para TanStack Router
            'router-vendor': [
              '@tanstack/react-router',
              '@tanstack/router-devtools',
              '@tanstack/router-vite-plugin',
            ],
            // Chunk para UI libraries
            'ui-vendor': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-dropdown-menu',
              '@radix-ui/react-select',
              '@radix-ui/react-tabs',
              '@radix-ui/react-toast',
              '@radix-ui/react-tooltip',
              '@radix-ui/react-scroll-area',
              'lucide-react',
              'class-variance-authority',
              'clsx',
              'tailwind-merge',
            ],
            // Chunk para Supabase
            'supabase-vendor': ['@supabase/supabase-js'],
            // Chunk para utilitários e forms
            'utils-vendor': ['sonner', 'react-hook-form', '@hookform/resolvers', 'zod'],
          },
        }),
        // Configurações de nomeação de chunks
        chunkFileNames: chunkInfo => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId
                .split('/')
                .pop()
                ?.replace(/\.[^/.]+$/, '')
            : 'unknown';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: assetInfo => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'css/[name]-[hash].css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
    // Aumentar limite de warning para chunks que ainda podem ser grandes
    chunkSizeWarningLimit: 800,
    // Otimizações adicionais apenas em produção
    ...(mode === 'production' && {
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    }),
  },
  // Otimizações de dependências para produção
  ...(mode === 'production' && {
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        '@tanstack/react-router',
        '@supabase/supabase-js',
        'lucide-react',
        'sonner',
      ],
      exclude: ['@tanstack/router-devtools'],
    },
  }),
}));
