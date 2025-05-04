'use client';

import React, { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import { toast } from 'sonner';
import { EquipmentPanel } from '@/components/game/EquipmentPanel';
import { ArrowLeft } from 'lucide-react';

export default function InventoryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { gameState, selectCharacter } = useGame();
  const { player } = gameState;

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

  if (!player.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const handleEquipmentChange = () => {
    // Recarregar o personagem para atualizar os stats
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => router.push(`/game/play/hub?character=${player.id}`)}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Menu
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Inventário de {player.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <EquipmentPanel 
              character={player} 
              onEquipmentChange={handleEquipmentChange} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 