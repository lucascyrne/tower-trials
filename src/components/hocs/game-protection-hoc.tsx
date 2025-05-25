'use client';

import React, { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { NavigateOptions } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';

interface GameProtectionHOCProps {
  children: React.ReactNode;
}

export function withGameProtection<P extends object>(
  WrappedComponent: React.ComponentType<P>
) {
  return function GameProtectedComponent(props: P) {
    const router = useRouter();
    const pathname = usePathname();
    const { gameState, clearGameState } = useGame();
    const { player } = gameState;
    const isInGameRef = useRef(false);
    const hasShownWarningRef = useRef(false);

    // Verificar se está em uma página de jogo ativa
    const isInActiveBattle = pathname.includes('/game/play/battle') && player.id && player.floor > 0;
    
    useEffect(() => {
      if (isInActiveBattle) {
        isInGameRef.current = true;
        hasShownWarningRef.current = false;
      }
    }, [isInActiveBattle]);

    // Interceptar tentativas de navegação
    useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        if (isInGameRef.current && !hasShownWarningRef.current) {
          e.preventDefault();
          e.returnValue = 'Você perderá seu progresso na torre se sair agora. Tem certeza?';
          return e.returnValue;
        }
      };

      const handlePopState = async () => {
        if (isInGameRef.current && !hasShownWarningRef.current) {
          hasShownWarningRef.current = true;
          
          // Resetar progresso do personagem
          if (player.id) {
            try {
              await CharacterService.resetCharacterProgress(player.id);
              toast.warning('Progresso na torre perdido!', {
                description: 'Você saiu da batalha e seu progresso foi resetado.'
              });
            } catch (error) {
              console.error('Erro ao resetar progresso:', error);
            }
          }
          
          // Resetar estado do jogo
          clearGameState();
          isInGameRef.current = false;
        }
      };

      // Interceptar mudanças de rota
      const originalPush = router.push;
      const originalReplace = router.replace;

      router.push = async (href: string, options?: NavigateOptions) => {
        const targetPath = typeof href === 'string' ? href : (href as { pathname?: string }).pathname || '';
        
        // Permitir navegação dentro das páginas de jogo
        if (targetPath.startsWith('/game/play/')) {
          return originalPush.call(router, href, options);
        }
        
        // Se está em batalha e tentando sair
        if (isInGameRef.current && !hasShownWarningRef.current) {
          hasShownWarningRef.current = true;
          
          // Resetar progresso
          if (player.id) {
            try {
              await CharacterService.resetCharacterProgress(player.id);
              toast.warning('Progresso na torre perdido!', {
                description: 'Você saiu da batalha e seu progresso foi resetado.'
              });
            } catch (error) {
              console.error('Erro ao resetar progresso:', error);
            }
          }
          
          clearGameState();
          isInGameRef.current = false;
        }
        
        return originalPush.call(router, href, options);
      };

      router.replace = async (href: string, options?: NavigateOptions) => {
        const targetPath = typeof href === 'string' ? href : (href as { pathname?: string }).pathname || '';
        
        // Permitir navegação dentro das páginas de jogo
        if (targetPath.startsWith('/game/play/')) {
          return originalReplace.call(router, href, options);
        }
        
        // Se está em batalha e tentando sair
        if (isInGameRef.current && !hasShownWarningRef.current) {
          hasShownWarningRef.current = true;
          
          // Resetar progresso
          if (player.id) {
            try {
              await CharacterService.resetCharacterProgress(player.id);
              toast.warning('Progresso na torre perdido!', {
                description: 'Você saiu da batalha e seu progresso foi resetado.'
              });
            } catch (error) {
              console.error('Erro ao resetar progresso:', error);
            }
          }
          
          clearGameState();
          isInGameRef.current = false;
        }
        
        return originalReplace.call(router, href, options);
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      window.addEventListener('popstate', handlePopState);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('popstate', handlePopState);
        
        // Restaurar métodos originais
        router.push = originalPush;
        router.replace = originalReplace;
      };
    }, [isInActiveBattle, player.id]);
    return <WrappedComponent {...props} />;
  };
}

export default function GameProtectionHOC({ children }: GameProtectionHOCProps) {
  return <>{children}</>;
} 