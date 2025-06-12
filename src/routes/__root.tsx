import { createRootRoute, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { AuthProvider } from '@/resources/auth/auth-provider';
import { GameProvider } from '@/resources/game/game-provider';
import { Toaster } from 'sonner';
import { useTheme } from '@/hooks/use-theme';
import { useEffect, Suspense } from 'react';
import '../index.css';

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

// Componente de Loading para Suspense
function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
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
    <div className="font-inter">
      <ThemeInitializer />
      <Toaster richColors position="top-right" />
      <AuthProvider>
        <GameProvider>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
          <TanStackRouterDevtools />
        </GameProvider>
      </AuthProvider>
    </div>
  );
}
