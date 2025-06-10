import { useEffect } from 'react';
import { type ReactNode } from 'react';
import { AuthProvider } from '@/resources/auth/auth-provider';
import { GameProvider } from '@/resources/game/game-provider';
import { Toaster } from 'sonner';

interface Props {
  children: ReactNode;
}

// Hook simples para gerenciamento de tema
function useTheme() {
  useEffect(() => {
    // Aplicar tema inicial - padrão escuro, a menos que explicitamente definido como claro
    const savedTheme = localStorage.getItem('tower-trials-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    // Padrão é escuro, exceto se explicitamente salvo como claro
    if (savedTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else if (savedTheme === 'dark' || savedTheme === 'system') {
      if (savedTheme === 'system' && !prefersDark) {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } else {
      // Sem preferência salva - padrão escuro
      document.documentElement.classList.add('dark');
    }
  }, []);

  const setTheme = (theme: 'dark' | 'light' | 'system') => {
    localStorage.setItem('tower-trials-theme', theme);

    if (theme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return { setTheme };
}

export default function ContextSkeleton({ children }: Props) {
  useTheme();

  return (
    <div className="font-inter">
      <Toaster richColors position="top-right" />
      <AuthProvider>
        <GameProvider>{children}</GameProvider>
      </AuthProvider>
    </div>
  );
}
