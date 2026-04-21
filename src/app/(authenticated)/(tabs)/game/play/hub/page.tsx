'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useGame } from '@/resources/game/game-hook';
import { CharacterService } from '@/resources/game/character.service';
import { Character } from '@/resources/game/models/character.model';
import { toast } from 'sonner';
import { MapModal } from '@/components/hub/MapModal';
import { CharacterInfoCard } from '@/components/hub/CharacterInfoCard';
import { ActionMenuGrid } from '@/components/hub/ActionMenuGrid';
import { HubNotifications } from '@/components/hub/HubNotifications';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function GameHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const characterId = searchParams.get('character');
  const shouldForceRefresh = searchParams.get('refresh') === '1';
  const { gameState, loadCharacterForHub } = useGame();
  const { player, mode } = gameState;
  const [isLoading, setIsLoading] = useState(true);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showHealNotification, setShowHealNotification] = useState(false);
  const [healInfo, setHealInfo] = useState<{ oldHp: number; newHp: number; character: string } | null>(null);

  useEffect(() => {
    const loadSelectedCharacter = async () => {
      if (!characterId) {
        router.push('/game/play');
        return;
      }

      if (!shouldForceRefresh && player.id === characterId && mode === 'hub') {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await CharacterService.getCharacter(characterId);
        if (response.success && response.data) {
          const cachedPlayer = sessionStorage.getItem(`player_${characterId}`);
          if (cachedPlayer) {
            const previousPlayer = JSON.parse(cachedPlayer);
            const healAmount = response.data.hp - previousPlayer.hp;
            const healPercent = (healAmount / response.data.max_hp) * 100;

            if (healAmount > 0 && healPercent >= 5) {
              setHealInfo({
                oldHp: previousPlayer.hp,
                newHp: response.data.hp,
                character: response.data.name,
              });
              setShowHealNotification(true);
              setTimeout(() => setShowHealNotification(false), 5000);
            }
          }

          sessionStorage.setItem(`player_${characterId}`, JSON.stringify(response.data));
          await loadCharacterForHub(response.data);
        } else {
          toast.error('Erro ao carregar personagem', {
            description: response.error,
          });
          router.push('/game/play');
        }
      } catch {
        toast.error('Erro ao carregar personagem');
        router.push('/game/play');
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCharacter();
  }, [characterId, mode, player.id, router, loadCharacterForHub, shouldForceRefresh]);

  if (isLoading || !player.id) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-slate-500"></div>
      </div>
    );
  }

  const handleStartFromBeginning = async () => {
    try {
      await CharacterService.updateCharacterFloor(player.id, 1);
      router.push(`/game/play/battle?character=${player.id}`);
    } catch {
      toast.error('Erro ao iniciar aventura');
    }
  };

  const handleStartFromCheckpoint = async (checkpointFloor: number) => {
    try {
      const response = await CharacterService.startFromCheckpoint(player.id, checkpointFloor);
      if (response.success) {
        router.push(`/game/play/battle?character=${player.id}`);
      } else {
        toast.error('Erro ao iniciar do checkpoint', {
          description: response.error,
        });
      }
    } catch {
      toast.error('Erro ao iniciar do checkpoint');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-4">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/game/play')}
              className="self-start"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Trocar Personagem</span>
              <span className="sm:hidden">Trocar</span>
            </Button>

            <div>
              <h1 className="text-2xl font-bold text-white sm:text-3xl">Hub de {player.name}</h1>
              <p className="text-sm text-slate-300 sm:text-base">
                Andar {player.floor} • Nível {player.level} • {player.gold} Gold
              </p>
            </div>
          </div>
        </div>

        <HubNotifications
          player={player}
          showHealNotification={showHealNotification}
          healInfo={healInfo}
          onDismissHealNotification={() => setShowHealNotification(false)}
        />

        <div className="space-y-4">
          <CharacterInfoCard player={player} />

          <ActionMenuGrid
            player={player}
            onStartAdventure={handleStartFromBeginning}
            onOpenMap={() => setShowMapModal(true)}
            onOpenCharacterStats={() => router.push(`/game/play/character-stats?character=${player.id}`)}
            onOpenShop={() => router.push(`/game/play/shop?character=${player.id}`)}
            onOpenInventory={() => router.push(`/game/play/inventory?character=${player.id}`)}
            onOpenEquipment={() => router.push(`/game/play/equipment?character=${player.id}`)}
            onOpenSpells={() => router.push(`/game/spells?character=${player.id}`)}
            onOpenCrafting={() => router.push(`/game/crafting?character=${player.id}`)}
            onOpenCemetery={() => router.push('/game/cemetery')}
            onReturnToSelection={() => router.push('/game/play')}
          />
        </div>

        <MapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          character={{ id: player.id, floor: player.floor } as Character}
          onStartFromCheckpoint={handleStartFromCheckpoint}
        />
      </div>
    </div>
  );
}
