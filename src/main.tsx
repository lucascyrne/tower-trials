import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';

// Import the generated route tree
import { routeTree } from '@/routeTree.gen';

// Create a new router instance
const router = createRouter({ routeTree });

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Service Worker registration com controle inteligente
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('🚀 Service Worker registrado com sucesso:', registration.scope);

        // Verificar atualizações periodicamente
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // Nova versão disponível
                console.log('🔄 Nova versão do Service Worker disponível');

                // Opcionalmente notificar o usuário sobre atualização
                if (confirm('Nova versão disponível! Deseja atualizar?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });

        // Auto-verificar atualizações a cada 30 segundos
        setInterval(() => {
          registration.update();
        }, 30000);
      })
      .catch(error => {
        console.log('❌ Falha ao registrar Service Worker:', error);
      });

    // Listener para quando o SW toma controle
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      // Service Worker atualizado - recarregar página
      window.location.reload();
    });
  });
} else if (import.meta.env.DEV) {
  // Em desenvolvimento, limpar qualquer service worker existente
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(registration => {
        registration.unregister();
      });
    });

    // Limpar cache também
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          caches.delete(name);
        });
      });
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
