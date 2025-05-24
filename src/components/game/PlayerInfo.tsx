import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Sword, Star, Zap, Heart, Brain, Eye, Wand2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { GamePlayer } from '@/resources/game/game-model';
import { SpellEffect } from '@/resources/game/models/spell.model';
import { Button } from '@/components/ui/button';
import AttributeDistributionModal from './AttributeDistributionModal';
import { CharacterService } from '@/resources/game/character.service';
import {   CharacterStats,   AttributeDistribution } from '@/resources/game/models/character.model';
import { toast } from 'sonner';

interface PlayerInfoProps {
  player: GamePlayer;
  playerHpPercentage: number;
  playerManaPercentage: number;
  getHpColor: (percentage: number) => string;
}

export function PlayerInfo({ player, playerHpPercentage, playerManaPercentage, getHpColor }: PlayerInfoProps) {
  const [showAttributeModal, setShowAttributeModal] = useState(false);
  const [characterStats, setCharacterStats] = useState<CharacterStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(false);
  const [showSkills, setShowSkills] = useState(false);

  // Atributos primários do player (se disponíveis)
  const attributes = {
    strength: player.strength || 10,
    dexterity: player.dexterity || 10,
    intelligence: player.intelligence || 10,
    wisdom: player.wisdom || 10,
    vitality: player.vitality || 10,
    luck: player.luck || 10
  };

  // Habilidades do player (se disponíveis)
  const skills = {
    sword_mastery: player.sword_mastery || 1,
    axe_mastery: player.axe_mastery || 1,
    blunt_mastery: player.blunt_mastery || 1,
    defense_mastery: player.defense_mastery || 1,
    magic_mastery: player.magic_mastery || 1
  };

  // Stats derivados
  const criticalChance = player.critical_chance || (attributes.luck * 0.5);
  const criticalDamage = player.critical_damage || (1.5 + (attributes.luck / 100));
  const attributePoints = player.attribute_points || 0;

  const handleAttributeDistribution = async () => {
    setIsLoadingStats(true);
    try {
      const response = await CharacterService.getCharacterStats(player.id);
      if (response.success && response.data) {
        setCharacterStats(response.data);
        setShowAttributeModal(true);
      } else {
        toast.error('Erro ao carregar stats do personagem');
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      toast.error('Erro ao carregar stats do personagem');
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleDistributePoints = async (distribution: AttributeDistribution) => {
    try {
      const response = await CharacterService.distributeAttributePoints(player.id, distribution);
      if (response.success) {
        toast.success('Pontos de atributo distribuídos com sucesso!');
        // Atualizar stats locais se possível
        window.location.reload(); // Temporário - idealmente deveria atualizar o estado do jogo
      } else {
        toast.error('Erro ao distribuir pontos', {
          description: response.error
        });
      }
    } catch (error) {
      console.error('Erro ao distribuir pontos:', error);
      toast.error('Erro ao distribuir pontos de atributo');
    }
  };

  const getAttributeIcon = (attribute: string) => {
    switch (attribute) {
      case 'strength': return Zap;
      case 'dexterity': return Eye;
      case 'intelligence': return Brain;
      case 'wisdom': return Wand2;
      case 'vitality': return Heart;
      case 'luck': return Star;
      default: return Sword;
    }
  };

  const getAttributeColor = (attribute: string) => {
    switch (attribute) {
      case 'strength': return 'text-red-400';
      case 'dexterity': return 'text-green-400';
      case 'intelligence': return 'text-blue-400';
      case 'wisdom': return 'text-purple-400';
      case 'vitality': return 'text-pink-400';
      case 'luck': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="bg-card/95 pb-2">
          <CardTitle className="text-center text-lg">{player.name}</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="aspect-square bg-muted flex items-center justify-center rounded-md mb-4">
            <div className="text-6xl font-bold text-muted-foreground">🧙</div>
          </div>
          
          <div className="space-y-3">
            {/* HP e Mana */}
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span>HP: {player.hp}/{player.max_hp}</span>
                <span>{Math.round(playerHpPercentage)}%</span>
              </div>
              <Progress 
                value={playerHpPercentage} 
                className={`h-2 ${getHpColor(playerHpPercentage)}`} 
              />
            </div>
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span>Mana: {player.mana}/{player.max_mana}</span>
                <span>{Math.round(playerManaPercentage)}%</span>
              </div>
              <Progress 
                value={playerManaPercentage} 
                className="h-2 bg-blue-500" 
              />
            </div>

            {/* Stats Derivados */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Sword className="h-4 w-4" />
                <span>ATK: {player.atk}</span>
              </div>
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Shield className="h-4 w-4" />
                <span>DEF: {player.def}</span>
              </div>
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Zap className="h-4 w-4" />
                <span>SPD: {player.speed}</span>
              </div>
              <div className="bg-muted p-2 rounded flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-400" />
                <span>LVL: {player.level}</span>
              </div>
            </div>

            {/* XP Progress */}
            <div>
              <div className="flex justify-between mb-1 text-sm">
                <span>XP: {player.xp}/{player.xp_next_level}</span>
                <span>{Math.round((player.xp / player.xp_next_level) * 100)}%</span>
              </div>
              <Progress 
                value={(player.xp / player.xp_next_level) * 100} 
                className="h-2 bg-primary/20" 
              />
            </div>

            {/* Stats Avançados */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-yellow-400">Crítico:</span>
                <span>{criticalChance.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-yellow-400">Dano Crítico:</span>
                <span>{(criticalDamage * 100).toFixed(0)}%</span>
              </div>
            </div>

            {/* Botão de Atributos */}
            {attributePoints > 0 && (
              <Button
                onClick={handleAttributeDistribution}
                disabled={isLoadingStats}
                className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                size="sm"
              >
                <Star className="h-4 w-4 mr-2" />
                Distribuir Atributos ({attributePoints})
              </Button>
            )}

            {/* Toggle para mostrar/esconder atributos */}
            <Button
              onClick={() => setShowSkills(!showSkills)}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {showSkills ? 'Ocultar' : 'Mostrar'} Detalhes
            </Button>

            {/* Atributos Primários (quando expandido) */}
            {showSkills && (
              <div className="space-y-3 pt-3 border-t">
                <h4 className="text-sm font-semibold text-center">Atributos</h4>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Object.entries(attributes).map(([key, value]) => {
                    const IconComponent = getAttributeIcon(key);
                    const colorClass = getAttributeColor(key);
                    return (
                      <div key={key} className="flex items-center gap-1 p-1">
                        <IconComponent className={`h-3 w-3 ${colorClass}`} />
                        <span className="capitalize">{key.replace('_', ' ')}: {value}</span>
                      </div>
                    );
                  })}
                </div>

                <h4 className="text-sm font-semibold text-center pt-2">Habilidades</h4>
                <div className="grid grid-cols-1 gap-1 text-xs">
                  {Object.entries(skills).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between p-1">
                      <span className="capitalize">{key.replace('_', ' ')}</span>
                      <span className="text-blue-400">Nível {value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Efeitos Ativos */}
            {Object.entries(player.active_effects).map(([type, effects]) => 
              (effects as SpellEffect[]).length > 0 && (
                <div key={type} className="text-sm">
                  <span className="font-medium">{type}: </span>
                  {(effects as SpellEffect[]).map((e: SpellEffect) => 
                    `${e.value} (${e.duration})`
                  ).join(', ')}
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Distribuição de Atributos */}
      {characterStats && (
        <AttributeDistributionModal
          isOpen={showAttributeModal}
          onClose={() => setShowAttributeModal(false)}
          characterStats={characterStats}
          onDistributePoints={handleDistributePoints}
        />
      )}
    </>
  );
} 