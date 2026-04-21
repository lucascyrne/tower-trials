'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Skull, Crown, Swords, Lock, Plus, Users } from 'lucide-react';
import { Character, CharacterProgressionInfo } from '@/resources/game/models/character.model';
import { useAuth } from '@/resources/auth/auth-hook';
import { CharacterService } from '@/resources/game/character.service';
import { NameValidationService } from '@/resources/game/name-validation.service';
import { useCharacterNameValidation } from '@/resources/game/use-character-name-validation';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { toast } from 'sonner';
import { CreateCharacterDialog } from '@/components/game/CreateCharacterDialog';
import { PermadeathWarningModal } from '@/components/game/PermadeathWarningModal';

const MAX_CHARACTER_SLOTS = 20;

interface CharacterSlot {
  slotNumber: number;
  character: Character | null;
  isUnlocked: boolean;
  requiredTotalLevel: number;
}

export default function GamePlayPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [progression, setProgression] = useState<CharacterProgressionInfo | null>(null);
  const [slots, setSlots] = useState<CharacterSlot[]>([]);
  const [loading, setLoading] = useState(true);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createSlotNumber, setCreateSlotNumber] = useState<number | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const [showPermadeathDialog, setShowPermadeathDialog] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  const existingCharacterNames = useMemo(() => characters.map(c => c.name), [characters]);
  const nameValidation = useCharacterNameValidation(newCharacterName, existingCharacterNames);

  const loadData = useCallback(async () => {
    const uid = user?.id;
    if (!uid) return;

    try {
      setLoading(true);

      const charactersResponse = await CharacterService.getUserCharacters(uid);
      if (charactersResponse.success && charactersResponse.data) {
        setCharacters(charactersResponse.data);
      }

      const progressionResponse = await CharacterService.getUserCharacterProgression(uid);
      if (progressionResponse.success && progressionResponse.data) {
        setProgression(progressionResponse.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos personagens');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (progression && characters !== undefined) {
      const newSlots: CharacterSlot[] = [];

      for (let i = 1; i <= MAX_CHARACTER_SLOTS; i++) {
        const character =
          characters.find(c => {
            const characterIndex = characters.indexOf(c) + 1;
            return characterIndex === i;
          }) || null;

        const isUnlocked = i <= progression.max_character_slots;
        const requiredTotalLevel = calculateRequiredTotalLevel(i);

        newSlots.push({
          slotNumber: i,
          character,
          isUnlocked,
          requiredTotalLevel,
        });
      }

      setSlots(newSlots);
    }
  }, [progression, characters]);

  const calculateRequiredTotalLevel = (slotNumber: number): number => {
    if (slotNumber <= 3) return 0;
    return (slotNumber - 3) * 15;
  };

  const handleCreateCharacter = async () => {
    if (!user?.id || !newCharacterName.trim() || !nameValidation.isValid) return;

    setIsCreating(true);
    try {
      const response = await CharacterService.createCharacter({
        user_id: user.id,
        name: newCharacterName.trim(),
      });

      if (response.success && response.data) {
        toast.success('Personagem criado com sucesso!', {
          description: `${NameValidationService.formatCharacterName(newCharacterName)} foi criado!`,
        });
        await loadData();
        resetCreateDialog();
      } else {
        toast.error('Erro ao criar personagem', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Erro ao criar personagem:', error);
      toast.error('Erro ao criar personagem');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectCharacter = (character: Character) => {
    setSelectedCharacter(character);
    setShowPermadeathDialog(true);
  };

  const handleConfirmCharacterSelect = async () => {
    if (!selectedCharacter) return;

    try {
      const response = await CharacterService.getCharacter(selectedCharacter.id);
      if (response.success && response.data) {
        setShowPermadeathDialog(false);
        router.push(`/game/play/hub?character=${selectedCharacter.id}`);
      } else {
        toast.error('Erro ao selecionar personagem', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Erro ao selecionar personagem:', error);
      toast.error('Erro ao selecionar personagem');
    }
  };

  const openCreateDialog = (slotNumber: number) => {
    setCreateSlotNumber(slotNumber);
    setShowCreateDialog(true);
  };

  const resetCreateDialog = () => {
    setShowCreateDialog(false);
    setCreateSlotNumber(null);
    setNewCharacterName('');
  };

  const onCreateDialogOpenChange = (open: boolean) => {
    if (!open) {
      resetCreateDialog();
    }
  };

  const renderCharacterStats = (character: Character) => {
    const calculateCurrentLevelXpRequirement = (level: number): number => {
      if (level <= 1) return 0;
      return Math.floor(100 * Math.pow(1.5, level - 2));
    };

    const currentLevelStartXp = calculateCurrentLevelXpRequirement(character.level);
    const xpInCurrentLevel = character.xp - currentLevelStartXp;
    const xpNeededForNextLevel = character.xp_next_level - currentLevelStartXp;
    const xpProgress = Math.max(
      0,
      Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100),
    );

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded bg-gray-700/50 p-2 text-center">
            <div className="font-bold text-red-400">{character.hp}</div>
            <div className="text-gray-400">HP</div>
          </div>
          <div className="rounded bg-gray-700/50 p-2 text-center">
            <div className="font-bold text-blue-400">{character.mana}</div>
            <div className="text-gray-400">Mana</div>
          </div>
          <div className="rounded bg-gray-700/50 p-2 text-center">
            <div className="font-bold text-orange-400">{character.atk}</div>
            <div className="text-gray-400">ATK</div>
          </div>
          <div className="rounded bg-gray-700/50 p-2 text-center">
            <div className="font-bold text-green-400">{character.def}</div>
            <div className="text-gray-400">DEF</div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>Andar {character.floor}</span>
              <span>{character.gold} Gold</span>
            </div>
          </div>

          <div>
            <div className="mb-1 flex justify-between text-xs">
              <span>XP</span>
              <span>{Math.round(xpProgress)}%</span>
            </div>
            <Progress value={xpProgress} className="h-1" />
          </div>
        </div>
      </div>
    );
  };

  const renderSlotCard = (slot: CharacterSlot) => {
    const { slotNumber, character, isUnlocked, requiredTotalLevel } = slot;

    if (character) {
      return (
        <Card key={slotNumber} className="overflow-hidden transition-shadow hover:shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className={`h-4 w-4 ${character.level >= 10 ? 'text-yellow-500' : 'text-gray-400'}`} />
              <span className="truncate">{character.name}</span>
              <span className="ml-auto text-sm text-muted-foreground">Lv.{character.level}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 pt-0">{renderCharacterStats(character)}</CardContent>
          <CardFooter className="pt-0">
            <Button className="w-full" onClick={() => handleSelectCharacter(character)} size="sm">
              <Swords className="mr-2 h-4 w-4" />
              Jogar
            </Button>
          </CardFooter>
        </Card>
      );
    } else if (isUnlocked) {
      return (
        <Card
          key={slotNumber}
          className="overflow-hidden border-2 border-dashed transition-colors hover:border-primary/50"
        >
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <Users className="h-4 w-4" />
              Slot {slotNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 pt-0">
            <div className="py-8 text-center">
              <Plus className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Slot disponível</p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button className="w-full" variant="outline" onClick={() => openCreateDialog(slotNumber)} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Criar Personagem
            </Button>
          </CardFooter>
        </Card>
      );
    } else {
      const currentLevel = progression?.total_character_level || 0;
      const levelsNeeded = requiredTotalLevel - currentLevel;

      return (
        <Card key={slotNumber} className="overflow-hidden border-gray-600 bg-gray-800/50 opacity-75">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <Lock className="h-4 w-4" />
              Slot {slotNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3 pt-0">
            <div className="py-6 text-center">
              <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
              <p className="mb-1 text-xs text-muted-foreground">Bloqueado</p>
              <p className="text-xs text-yellow-400">Faltam {levelsNeeded} níveis</p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button className="w-full" variant="ghost" disabled size="sm">
              Nível Total: {requiredTotalLevel}
            </Button>
          </CardFooter>
        </Card>
      );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
        <div className="mx-auto w-full max-w-6xl">
          <div className="flex min-h-[50vh] items-center justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 space-y-3 sm:space-y-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <Button variant="outline" size="sm" onClick={() => router.push('/game')} className="self-start">
                <ArrowLeft className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Voltar ao Menu</span>
                <span className="sm:hidden">Voltar</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/game/cemetery')}
                className="self-start border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:text-red-300 sm:self-end"
              >
                <Skull className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Ver Cemitério</span>
                <span className="sm:hidden">Cemitério</span>
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold sm:text-3xl">Seus Personagens</h1>
                <p className="text-sm text-muted-foreground sm:text-base">
                  Escolha um personagem para iniciar sua aventura
                </p>
              </div>

              {progression && (
                <div className="text-right text-sm">
                  <div className="text-muted-foreground">Nível Total</div>
                  <div className="text-xl font-bold text-purple-400">
                    {progression.total_character_level}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {progression.current_character_count}/{progression.max_character_slots} slots
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {slots.slice(0, 12).map(renderSlotCard)}
        </div>

        <CreateCharacterDialog
          open={showCreateDialog}
          onOpenChange={onCreateDialogOpenChange}
          name={newCharacterName}
          onNameChange={setNewCharacterName}
          nameValidation={nameValidation}
          description={<>Digite o nome do seu novo personagem para o Slot {createSlotNumber}.</>}
          onSubmit={handleCreateCharacter}
          isSubmitting={isCreating}
        />

        <PermadeathWarningModal
          isOpen={showPermadeathDialog}
          onClose={() => {
            setShowPermadeathDialog(false);
            setSelectedCharacter(null);
          }}
          onConfirm={handleConfirmCharacterSelect}
          characterName={selectedCharacter?.name ?? 'seu personagem'}
        />
      </div>
    </div>
  );
}
