'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GameBattle from '@/components/game/game-battle';
import { useGame } from '@/resources/game/game-hook';
import { toast } from 'sonner';
import { withFloorTransition } from '@/components/hocs/floor-transition-hoc';
import { withGameProtection } from '@/components/hocs/game-protection-hoc';

// Aplicar os HOCs ao componente de batalha
const GameBattleWithTransition = withFloorTransition(GameBattle);

function BattlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading } = useGame();
  const [isLoading, setIsLoading] = useState(true);

  // Monitor de carregamento global - otimizado
  useEffect(() => {
    if (!loading.loadProgress && !loading.performAction) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 100); // Reduzir delay para transições mais rápidas
      
      return () => clearTimeout(timer);
    } else {
      setIsLoading(true);
    }
  }, [loading.loadProgress, loading.performAction]);

  // Validar se o personagem existe no URL - apenas uma vez
  useEffect(() => {
    const characterId = searchParams.get('character');
    if (!characterId) {
      toast.error('Personagem não especificado', {
        description: 'Redirecionando para a seleção de personagens'
      });
      router.push('/game/play');
    }
  }, []); // Remover dependências para executar apenas uma vez

  // Renderizar skeleton loader enquanto carrega
  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
        <div className="w-full max-w-6xl">
          <div className="text-center mb-8">
            <div className="h-8 w-64 bg-muted/50 animate-pulse rounded mx-auto mb-4"></div>
            <div className="h-4 w-48 bg-muted/30 animate-pulse rounded mx-auto"></div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-card rounded-lg overflow-hidden shadow animate-pulse">
                <div className="p-4 bg-muted/20">
                  <div className="h-6 bg-muted/40 rounded w-24 mx-auto"></div>
                </div>
                <div className="p-6">
                  <div className="aspect-square bg-muted/30 rounded-md mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-4 bg-muted/40 rounded w-full"></div>
                    <div className="h-2 bg-muted/30 rounded w-full"></div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-8 bg-muted/20 rounded"></div>
                      <div className="h-8 bg-muted/20 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-card rounded-lg p-4 animate-pulse">
            <div className="h-6 bg-muted/40 rounded w-32 mx-auto mb-4"></div>
            <div className="flex gap-2 justify-center">
              <div className="h-10 bg-muted/30 rounded w-24"></div>
              <div className="h-10 bg-muted/30 rounded w-24"></div>
              <div className="h-10 bg-muted/30 rounded w-24"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <GameBattleWithTransition>
        <GameBattle />
      </GameBattleWithTransition>
    </div>
  );
}

// Aplicar proteção de jogo
const BattlePageWithProtection = withGameProtection(BattlePage);

export default BattlePageWithProtection; 