'use client';

import { ReactNode } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/resources/auth/auth-provider';
import { GameProvider } from '@/resources/game/game-provider';

interface Props {
  children: ReactNode;
}

const inter = Inter({ subsets: ['latin'] });

export default function ContextSkeleton({ children }: Props) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={true}
      disableTransitionOnChange
      storageKey="tower-trials-theme"
    >
      <div className={inter.className}>
        <Toaster richColors position="top-right" />
        <AuthProvider>
          <GameProvider>{children}</GameProvider>
        </AuthProvider>
      </div>
    </ThemeProvider>
  );
}
