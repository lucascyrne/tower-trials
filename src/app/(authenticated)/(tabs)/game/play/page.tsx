'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Skull, Crown, Swords, Lock, Plus, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { Character, CharacterProgressionInfo } from '@/resources/game/models/character.model';
import { useAuth } from '@/resources/auth/auth-hook';
import { CharacterService } from '@/resources/game/character.service';
import { NameValidationService } from '@/resources/game/name-validation.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';

// Definir número máximo de slots que podem ser desbloqueados
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
  
  // Estados para criação de personagem
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createSlotNumber, setCreateSlotNumber] = useState<number | null>(null);
  const [newCharacterName, setNewCharacterName] = useState('');
  const [nameValidation, setNameValidation] = useState<{ isValid: boolean; error?: string; suggestions?: string[] }>({ isValid: true });
  const [isCreating, setIsCreating] = useState(false);
  
  // Estados para seleção de personagem
  const [showPermadeathDialog, setShowPermadeathDialog] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);

  useEffect(() => {
    if (user?.id) {
      loadData();
    }
  }, [user]);

  // Validar nome em tempo real
  useEffect(() => {
    if (newCharacterName.trim()) {
      const validation = NameValidationService.validateCharacterName(newCharacterName);
      
      if (validation.isValid && characters.length > 0) {
        const existingNames = characters.map(c => c.name);
        const formattedName = NameValidationService.formatCharacterName(newCharacterName);
        
        if (NameValidationService.isTooSimilar(formattedName, existingNames)) {
          const suggestions = NameValidationService.generateNameSuggestions(formattedName);
          setNameValidation({
            isValid: false,
            error: 'Nome muito similar a um personagem existente',
            suggestions
          });
        } else {
          setNameValidation(validation);
        }
      } else {
        setNameValidation(validation);
      }
    } else {
      setNameValidation({ isValid: true });
    }
  }, [newCharacterName, characters]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Carregar personagens
      const charactersResponse = await CharacterService.getUserCharacters(user!.id);
      if (charactersResponse.success && charactersResponse.data) {
        setCharacters(charactersResponse.data);
      }

      // Carregar progressão
      const progressionResponse = await CharacterService.getUserCharacterProgression(user!.id);
      if (progressionResponse.success && progressionResponse.data) {
        setProgression(progressionResponse.data);
      }
      
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados dos personagens');
    } finally {
      setLoading(false);
    }
  };

  // Calcular slots baseado na progressão
  useEffect(() => {
    if (progression && characters !== undefined) {
      const newSlots: CharacterSlot[] = [];
      
      for (let i = 1; i <= MAX_CHARACTER_SLOTS; i++) {
        const character = characters.find(c => {
          // Associar personagens aos slots pela ordem de criação
          const characterIndex = characters.indexOf(c) + 1;
          return characterIndex === i;
        }) || null;
        
        const isUnlocked = i <= progression.max_character_slots;
        const requiredTotalLevel = calculateRequiredTotalLevel(i);
        
        newSlots.push({
          slotNumber: i,
          character,
          isUnlocked,
          requiredTotalLevel
        });
      }
      
      setSlots(newSlots);
    }
  }, [progression, characters]);

  const calculateRequiredTotalLevel = (slotNumber: number): number => {
    if (slotNumber <= 3) return 0; // Primeiros 3 slots são gratuitos
    return (slotNumber - 3) * 15; // Fórmula: (slot - 3) * 15
  };

  const handleCreateCharacter = async () => {
    if (!user?.id || !newCharacterName.trim() || !nameValidation.isValid) return;
    
    setIsCreating(true);
    try {
      const response = await CharacterService.createCharacter({
        user_id: user.id,
        name: newCharacterName.trim()
      });

      if (response.success && response.data) {
        toast.success('Personagem criado com sucesso!', {
          description: `${NameValidationService.formatCharacterName(newCharacterName)} foi criado!`
        });
        await loadData();
        resetCreateDialog();
      } else {
        toast.error('Erro ao criar personagem', {
          description: response.error
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
        router.push(`/game/play/hub?character=${selectedCharacter.id}`);
      } else {
        toast.error('Erro ao selecionar personagem', {
          description: response.error
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
    setNameValidation({ isValid: true });
  };

  const handleNameSuggestionClick = (suggestion: string) => {
    setNewCharacterName(suggestion);
  };

  const renderCharacterStats = (character: Character) => {
                    // CORRIGIDO: Calcular progresso de XP dentro do nível atual
                const calculateCurrentLevelXpRequirement = (level: number): number => {
                  if (level <= 1) return 0;
                  return Math.floor(100 * Math.pow(1.5, level - 2));
                };
                
                const currentLevelStartXp = calculateCurrentLevelXpRequirement(character.level);
                const xpInCurrentLevel = character.xp - currentLevelStartXp;
                const xpNeededForNextLevel = character.xp_next_level - currentLevelStartXp;
                const xpProgress = Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100));

    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-700/50 p-2 rounded text-center">
            <div className="text-red-400 font-bold">{character.hp}</div>
            <div className="text-gray-400">HP</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded text-center">
            <div className="text-blue-400 font-bold">{character.mana}</div>
            <div className="text-gray-400">Mana</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded text-center">
            <div className="text-orange-400 font-bold">{character.atk}</div>
            <div className="text-gray-400">ATK</div>
          </div>
          <div className="bg-gray-700/50 p-2 rounded text-center">
            <div className="text-green-400 font-bold">{character.def}</div>
            <div className="text-gray-400">DEF</div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Andar {character.floor}</span>
              <span>{character.gold} Gold</span>
            </div>
          </div>
          
          <div>
            <div className="flex justify-between text-xs mb-1">
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
      // Slot com personagem
      return (
        <Card key={slotNumber} className="overflow-hidden hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Crown className={`h-4 w-4 ${character.level >= 10 ? 'text-yellow-500' : 'text-gray-400'}`} />
              <span className="truncate">{character.name}</span>
              <span className="text-sm text-muted-foreground ml-auto">Lv.{character.level}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            {renderCharacterStats(character)}
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              className="w-full" 
              onClick={() => handleSelectCharacter(character)}
              size="sm"
            >
              <Swords className="h-4 w-4 mr-2" />
              Jogar
            </Button>
          </CardFooter>
        </Card>
      );
    } else if (isUnlocked) {
      // Slot vazio mas desbloqueado
      return (
        <Card key={slotNumber} className="overflow-hidden border-dashed border-2 hover:border-primary/50 transition-colors">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <Users className="h-4 w-4" />
              Slot {slotNumber}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-3">
            <div className="text-center py-8">
              <Plus className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Slot disponível</p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              className="w-full" 
              variant="outline"
              onClick={() => openCreateDialog(slotNumber)}
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Personagem
            </Button>
          </CardFooter>
        </Card>
      );
    } else {
      // Slot bloqueado
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
          <CardContent className="pt-0 pb-3">
            <div className="text-center py-6">
              <Lock className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-xs text-muted-foreground mb-1">Bloqueado</p>
              <p className="text-xs text-yellow-400">
                Faltam {levelsNeeded} níveis
              </p>
            </div>
          </CardContent>
          <CardFooter className="pt-0">
            <Button 
              className="w-full" 
              variant="ghost"
              disabled
              size="sm"
            >
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
        <div className="w-full max-w-6xl mx-auto">
          <div className="flex items-center justify-center min-h-[50vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-6xl mx-auto">
        {/* Header */}
        <div className="space-y-3 sm:space-y-4 mb-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col sm:flex-row gap-2 justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/game')}
                className="self-start"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Voltar ao Menu</span>
                <span className="sm:hidden">Voltar</span>
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/game/cemetery')}
                className="self-start sm:self-end border border-red-500/20 bg-red-500/5 hover:bg-red-500/10 text-red-400 hover:text-red-300"
              >
                <Skull className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Ver Cemitério</span>
                <span className="sm:hidden">Cemitério</span>
              </Button>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">Seus Personagens</h1>
                <p className="text-sm sm:text-base text-muted-foreground">
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

        {/* Grid de Slots de Personagens */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {slots.slice(0, 12).map(renderSlotCard)} {/* Mostrar apenas os primeiros 12 slots para não poluir */}
        </div>

        {/* Diálogo de Criação de Personagem */}
        <Dialog open={showCreateDialog} onOpenChange={resetCreateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Personagem</DialogTitle>
              <DialogDescription>
                Digite o nome do seu novo personagem para o Slot {createSlotNumber}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    placeholder="Nome do personagem (3-20 caracteres)"
                    value={newCharacterName}
                    onChange={(e) => setNewCharacterName(e.target.value)}
                    className={`pr-10 ${
                      newCharacterName.trim() 
                        ? nameValidation.isValid 
                          ? 'border-green-500 focus:border-green-500' 
                          : 'border-red-500 focus:border-red-500'
                        : ''
                    }`}
                    maxLength={20}
                  />
                  {newCharacterName.trim() && (
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                      {nameValidation.isValid ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* Preview do nome formatado */}
                {newCharacterName.trim() && nameValidation.isValid && (
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Nome formatado:</span> {NameValidationService.formatCharacterName(newCharacterName)}
                  </div>
                )}
                
                {/* Mensagem de erro */}
                {newCharacterName.trim() && !nameValidation.isValid && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {nameValidation.error}
                    </AlertDescription>
                  </Alert>
                )}
                
                {/* Sugestões de nomes */}
                {nameValidation.suggestions && nameValidation.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Sugestões de nomes:</p>
                    <div className="flex flex-wrap gap-2">
                      {nameValidation.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleNameSuggestionClick(suggestion)}
                          className="text-xs"
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={resetCreateDialog}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreateCharacter}
                disabled={!newCharacterName.trim() || !nameValidation.isValid || isCreating}
              >
                {isCreating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-2"></div>
                    Criando...
                  </>
                ) : (
                  'Criar Personagem'
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Diálogo de Aviso de Permadeath */}
        <Dialog open={showPermadeathDialog} onOpenChange={setShowPermadeathDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-500">
                <Skull className="h-6 w-6" />
                Aviso de Permadeath
              </DialogTitle>
              <DialogDescription className="text-base">
                Você está prestes a entrar em uma aventura perigosa!
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-lg space-y-3">
                <p className="text-sm">
                  <strong>O que é Permadeath?</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Neste jogo, a morte é permanente. Se seu personagem morrer durante a aventura:
                </p>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>O personagem será permanentemente deletado</li>
                  <li>Todo o progresso será perdido</li>
                  <li>Equipamentos e itens serão destruídos</li>
                  <li>A pontuação será registrada no ranking</li>
                </ul>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPermadeathDialog(false)}
              >
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirmCharacterSelect}
              >
                <Skull className="h-4 w-4 mr-2" />
                Aceitar e Continuar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
} 