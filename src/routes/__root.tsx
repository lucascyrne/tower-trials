import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { AuthProvider } from '@/resources/auth/auth-provider';
import { Toaster } from 'sonner';
import { useTheme } from '@/hooks/useTheme';
import { useEffect, Suspense } from 'react';
import '../index.css';
import { GameStoreProvider } from '@/components/providers/GameStoreProvider';

// Componente separado para inicializar o tema
function ThemeInitializer() {
  // Só executar no lado do cliente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // O hook useTheme já tem proteções internas para SSR
    }
  }, []);

  // Usar o hook normalmente - ele já tem proteções para SSR
  useTheme();
  return null;
}

// Componente de Loading para Suspense - corrigido para ocupar toda a tela
function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Carregando página...</p>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="font-inter min-h-screen w-full">
      <ThemeInitializer />
      <Toaster richColors position="top-right" />
      <AuthProvider>
        <GameStoreProvider>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
          <TanStackRouterDevtools />
        </GameStoreProvider>
      </AuthProvider>
    </div>
  );
}
