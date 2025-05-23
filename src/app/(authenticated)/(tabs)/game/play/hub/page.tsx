'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGame } from '@/resources/game/game-hook';
import { 
  Swords, 
  ShoppingBag, 
  Backpack, 
  ArrowLeft, 
  Crown,
  User,
  Shield,
  Sword,
  Star,
  Gem,
  Map
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { CharacterService } from '@/resources/game/character.service';
import { Character } from '@/resources/game/models/character.model';
import { toast } from 'sonner';
import { MapModal } from '@/components/game/MapModal';

export default function GameHubPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { gameState, loadCharacterForHub } = useGame();
  const { player } = gameState;
  const [isLoading, setIsLoading] = useState(true);
  const [characterLoaded, setCharacterLoaded] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showHealNotification, setShowHealNotification] = useState(false);
  const [healInfo, setHealInfo] = useState<{ oldHp: number; newHp: number; character: string } | null>(null);

  // Carregar personagem selecionado - apenas uma vez
  useEffect(() => {
    const loadSelectedCharacter = async () => {
      const characterId = searchParams.get('character');
      if (!characterId) {
        router.push('/game/play');
        return;
      }

      // Evitar carregamentos duplicados
      if (characterLoaded && player.id === characterId) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await CharacterService.getCharacter(characterId);
        if (response.success && response.data) {
          // Verificar se houve cura significativa comparando com cache anterior
          const cachedPlayer = sessionStorage.getItem(`player_${characterId}`);
          if (cachedPlayer) {
            const previousPlayer = JSON.parse(cachedPlayer);
            const healAmount = response.data.hp - previousPlayer.hp;
            const healPercent = (healAmount / response.data.max_hp) * 100;
            
            // Se foi curado significativamente (mais de 5% do HP máximo)
            if (healAmount > 0 && healPercent >= 5) {
              setHealInfo({
                oldHp: previousPlayer.hp,
                newHp: response.data.hp,
                character: response.data.name
              });
              setShowHealNotification(true);
              
              // Esconder notificação após 5 segundos
              setTimeout(() => {
                setShowHealNotification(false);
              }, 5000);
            }
          }
          
          // Salvar estado atual para comparação futura
          sessionStorage.setItem(`player_${characterId}`, JSON.stringify(response.data));
          
          await loadCharacterForHub(response.data);
          setCharacterLoaded(true);
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
      } finally {
        setIsLoading(false);
      }
    };

    loadSelectedCharacter();
  }, [searchParams.get('character')]); // Só executar quando o ID do personagem mudar

  // Loading state
  if (isLoading || !player.id) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const xpProgress = (player.xp / player.xp_next_level) * 100;
  const hpProgress = (player.hp / player.max_hp) * 100;
  const manaProgress = (player.mana / player.max_mana) * 100;

  // Função para iniciar sempre do andar 1
  const handleStartFromBeginning = async () => {
    try {
      // Resetar para andar 1
      await CharacterService.updateCharacterFloor(player.id, 1);
      router.push(`/game/play/battle?character=${player.id}`);
    } catch (error) {
      console.error('Erro ao iniciar do começo:', error);
      toast.error('Erro ao iniciar aventura');
    }
  };

  // Função para iniciar de um checkpoint
  const handleStartFromCheckpoint = async (checkpointFloor: number) => {
    try {
      const response = await CharacterService.startFromCheckpoint(player.id, checkpointFloor);
      if (response.success) {
        router.push(`/game/play/battle?character=${player.id}`);
      } else {
        toast.error('Erro ao iniciar do checkpoint', {
          description: response.error
        });
      }
    } catch (error) {
      console.error('Erro ao iniciar do checkpoint:', error);
      toast.error('Erro ao iniciar do checkpoint');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-secondary p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Cabeçalho com informações do personagem */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-6 w-6" />
              {player.name}
              <span className="ml-auto flex items-center gap-1">
                <Star className="h-5 w-5 text-yellow-500" />
                Nível {player.level}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barras de status */}
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2">
                  HP: {player.hp}/{player.max_hp}
                  {player.hp < player.max_hp && (
                    <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full flex items-center gap-1">
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Curando automaticamente
                    </span>
                  )}
                </span>
                <span>{Math.round(hpProgress)}%</span>
              </div>
              <Progress value={hpProgress} className="h-2 bg-red-500" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Mana: {player.mana}/{player.max_mana}</span>
                <span>{Math.round(manaProgress)}%</span>
              </div>
              <Progress value={manaProgress} className="h-2 bg-blue-500" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>XP: {player.xp}/{player.xp_next_level}</span>
                <span>{Math.round(xpProgress)}%</span>
              </div>
              <Progress value={xpProgress} className="h-2 bg-yellow-500" />
            </div>

            {/* Atributos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Sword className="h-4 w-4" />
                <span>Ataque: {player.atk}</span>
              </div>
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>Defesa: {player.def}</span>
              </div>
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Crown className="h-4 w-4" />
                <span>Andar: {player.floor}</span>
              </div>
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Gem className="h-4 w-4" />
                <span>Gold: {player.gold}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Menu de Ações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Entrar na Torre - Sempre do Andar 1 */}
          <Card className="hover:bg-accent/50 transition-colors">
            <Button
              variant="ghost"
              className="w-full h-full p-8"
              onClick={handleStartFromBeginning}
            >
              <div className="flex flex-col items-center gap-4">
                <Swords className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="font-bold text-lg">Entrar na Torre</h3>
                  <p className="text-sm text-muted-foreground">
                    Começar uma nova aventura do Andar 1
                  </p>
                </div>
              </div>
            </Button>
          </Card>

          {/* Mapa de Checkpoints */}
          <Card className="hover:bg-accent/50 transition-colors">
            <Button
              variant="ghost"
              className="w-full h-full p-8"
              onClick={() => setShowMapModal(true)}
            >
              <div className="flex flex-col items-center gap-4">
                <Map className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="font-bold text-lg">Mapa da Torre</h3>
                  <p className="text-sm text-muted-foreground">
                    Iniciar de um checkpoint desbloqueado
                  </p>
                </div>
              </div>
            </Button>
          </Card>

          {/* Loja */}
          <Card className="hover:bg-accent/50 transition-colors">
            <Button
              variant="ghost"
              className="w-full h-full p-8"
              onClick={() => router.push(`/game/play/shop?character=${player.id}`)}
            >
              <div className="flex flex-col items-center gap-4">
                <ShoppingBag className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="font-bold text-lg">Loja</h3>
                  <p className="text-sm text-muted-foreground">
                    Compre equipamentos e consumíveis
                  </p>
                </div>
              </div>
            </Button>
          </Card>

          {/* Inventário */}
          <Card className="hover:bg-accent/50 transition-colors">
            <Button
              variant="ghost"
              className="w-full h-full p-8"
              onClick={() => router.push(`/game/play/inventory?character=${player.id}`)}
            >
              <div className="flex flex-col items-center gap-4">
                <Backpack className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="font-bold text-lg">Inventário</h3>
                  <p className="text-sm text-muted-foreground">
                    Gerencie seus equipamentos
                  </p>
                </div>
              </div>
            </Button>
          </Card>

          {/* Voltar para Seleção */}
          <Card className="hover:bg-accent/50 transition-colors">
            <Button
              variant="ghost"
              className="w-full h-full p-8"
              onClick={() => router.push('/game/play')}
            >
              <div className="flex flex-col items-center gap-4">
                <ArrowLeft className="h-12 w-12" />
                <div className="text-center">
                  <h3 className="font-bold text-lg">Trocar Personagem</h3>
                  <p className="text-sm text-muted-foreground">
                    Voltar para seleção de personagens
                  </p>
                </div>
              </div>
            </Button>
          </Card>
        </div>

        {/* Modal do Mapa */}
        <MapModal
          isOpen={showMapModal}
          onClose={() => setShowMapModal(false)}
          character={{ id: player.id, floor: player.floor } as Character}
          onStartFromCheckpoint={handleStartFromCheckpoint}
        />

        {/* Notificação de Cura Automática */}
        {showHealNotification && healInfo && (
          <div className="fixed top-4 right-4 z-50 max-w-sm">
            <Card className="bg-green-50 border-green-200 shadow-lg">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-full">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">
                      {healInfo.character} foi curado!
                    </p>
                    <p className="text-xs text-green-600">
                      HP: {healInfo.oldHp} → {healInfo.newHp} (+{healInfo.newHp - healInfo.oldHp})
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowHealNotification(false)}
                    className="h-6 w-6 p-0 text-green-600 hover:text-green-800"
                  >
                    ×
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
} 