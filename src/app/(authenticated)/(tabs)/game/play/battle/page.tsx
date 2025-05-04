'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GameBattle from '@/components/game/game-battle';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';

export default function BattlePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectCharacter } = useGame();

  useEffect(() => {
    const loadSelectedCharacter = async () => {
      const characterId = searchParams.get('character');
      if (!characterId) {
        router.push('/game/play');
        return;
      }

      try {
        const response = await CharacterService.getCharacter(characterId);
        if (response.success && response.data) {
          await selectCharacter(response.data);
        } else {
          toast.error('Erro ao carregar personagem', {
            description: response.error
          });
          router.push('/game/play');
        }
      } catch (error) {
        console.error('Erro ao carregar personagem:', error);
        toast.error('Erro ao carregar personagem');
        router.push('/game/play');
      }
    };

    loadSelectedCharacter();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <GameBattle />
    </div>
  );
} 