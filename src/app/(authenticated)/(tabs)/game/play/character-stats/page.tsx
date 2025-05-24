'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { 
  ArrowLeft, 
  TrendingUp, 
  Zap, 
  Heart, 
  Brain, 
  Eye, 
  Star, 
  Wand2,
  Sword,
  Shield,
  Award,
  Target,
  Sparkles
} from 'lucide-react';
import { CharacterService } from '@/resources/game/character.service';
import { 
  CharacterStats, 
  AttributeDistribution, 
  AttributeType,
  SkillType,
  getAttributeDescription,
  getSkillDescription,
  calculateSkillXpRequired
} from '@/resources/game/models/character.model';
import AttributeDistributionModal from '@/components/game/AttributeDistributionModal';

export default function CharacterStatsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [characterStats, setCharacterStats] = useState<CharacterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAttributeModal, setShowAttributeModal] = useState(false);

  const characterId = searchParams.get('character');

  useEffect(() => {
    loadCharacterStats();
  }, [characterId]);

  const loadCharacterStats = async () => {
    if (!characterId) {
      router.push('/game/play');
      return;
    }

    try {
      setLoading(true);
      const response = await CharacterService.getCharacterStats(characterId);
      if (response.success && response.data) {
        setCharacterStats(response.data);
      } else {
        toast.error('Erro ao carregar stats do personagem', {
          description: response.error
        });
        router.push('/game/play/hub?character=' + characterId);
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      toast.error('Erro ao carregar stats do personagem');
      router.push('/game/play/hub?character=' + characterId);
    } finally {
      setLoading(false);
    }
  };

  const handleDistributePoints = async (distribution: AttributeDistribution) => {
    if (!characterId) return;

    try {
      const response = await CharacterService.distributeAttributePoints(characterId, distribution);
      if (response.success) {
        toast.success('Pontos de atributo distribuídos com sucesso!');
        await loadCharacterStats(); // Recarregar stats
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

  const getAttributeIcon = (attribute: AttributeType) => {
    switch (attribute) {
      case AttributeType.STRENGTH: return Zap;
      case AttributeType.DEXTERITY: return Eye;
      case AttributeType.INTELLIGENCE: return Brain;
      case AttributeType.WISDOM: return Wand2;
      case AttributeType.VITALITY: return Heart;
      case AttributeType.LUCK: return Star;
    }
  };

  const getAttributeColor = (attribute: AttributeType) => {
    switch (attribute) {
      case AttributeType.STRENGTH: return 'text-red-400 bg-red-900/20';
      case AttributeType.DEXTERITY: return 'text-green-400 bg-green-900/20';
      case AttributeType.INTELLIGENCE: return 'text-blue-400 bg-blue-900/20';
      case AttributeType.WISDOM: return 'text-purple-400 bg-purple-900/20';
      case AttributeType.VITALITY: return 'text-pink-400 bg-pink-900/20';
      case AttributeType.LUCK: return 'text-yellow-400 bg-yellow-900/20';
    }
  };

  const getSkillIcon = (skill: SkillType) => {
    switch (skill) {
      case SkillType.SWORD_MASTERY: return Sword;
      case SkillType.AXE_MASTERY: return Zap;
      case SkillType.BLUNT_MASTERY: return Target;
      case SkillType.DEFENSE_MASTERY: return Shield;
      case SkillType.MAGIC_MASTERY: return Sparkles;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!characterStats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Erro ao carregar</h2>
          <p className="text-muted-foreground mb-4">Não foi possível carregar os stats do personagem</p>
          <Button onClick={() => router.push('/game/play/hub?character=' + characterId)}>
            Voltar ao Hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header responsivo e elegante */}
        <div className="space-y-4">
          {/* Linha superior - Navegação e título */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/game/play/hub?character=' + characterId)}
              className="self-start"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Voltar ao Hub</span>
              <span className="sm:hidden">Voltar</span>
            </Button>
            
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold truncate">
                Atributos & Habilidades
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                Gerencie os stats do seu personagem
              </p>
            </div>
          </div>
          
          {/* Linha inferior - Botão de distribuir pontos (se disponível) */}
          {characterStats.attribute_points > 0 && (
            <div className="flex justify-center sm:justify-end">
              <Button
                onClick={() => setShowAttributeModal(true)}
                className="bg-yellow-600 hover:bg-yellow-700 w-full sm:w-auto"
                size="sm"
              >
                <Star className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">
                  Distribuir Pontos ({characterStats.attribute_points})
                </span>
                <span className="sm:hidden">
                  Distribuir ({characterStats.attribute_points})
                </span>
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Atributos Primários */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Atributos Primários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.values(AttributeType).map((attribute) => {
                const IconComponent = getAttributeIcon(attribute);
                const colorClasses = getAttributeColor(attribute);
                const value = characterStats[attribute];
                
                return (
                  <div key={attribute} className={`p-4 rounded-lg border ${colorClasses}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <IconComponent className="h-6 w-6" />
                      <div className="flex-1">
                        <h3 className="font-semibold capitalize">
                          {attribute.replace('_', ' ')}: {value}
                        </h3>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-current h-2 rounded-full" 
                            style={{ width: `${(value / 50) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-sm font-mono">{value}/50</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {getAttributeDescription(attribute)}
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          {/* Stats Derivados */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Stats Derivados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Heart className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium">HP Máximo</span>
                  </div>
                  <div className="text-2xl font-bold">{characterStats.max_hp}</div>
                </div>
                
                <div className="bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Brain className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">Mana Máxima</span>
                  </div>
                  <div className="text-2xl font-bold">{characterStats.max_mana}</div>
                </div>

                <div className="bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Sword className="h-4 w-4 text-red-400" />
                    <span className="text-sm font-medium">Ataque</span>
                  </div>
                  <div className="text-2xl font-bold">{characterStats.atk}</div>
                </div>

                <div className="bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="h-4 w-4 text-blue-400" />
                    <span className="text-sm font-medium">Defesa</span>
                  </div>
                  <div className="text-2xl font-bold">{characterStats.def}</div>
                </div>

                <div className="bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium">Velocidade</span>
                  </div>
                  <div className="text-2xl font-bold">{characterStats.speed}</div>
                </div>

                <div className="bg-card p-3 rounded-lg border">
                  <div className="flex items-center gap-2 mb-1">
                    <Star className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium">Crítico</span>
                  </div>
                  <div className="text-2xl font-bold">{characterStats.critical_chance.toFixed(1)}%</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Habilidades */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Habilidades de Combate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.values(SkillType).map((skill) => {
                  const IconComponent = getSkillIcon(skill);
                  const skillLevel = characterStats[`${skill}_mastery` as keyof CharacterStats] as number;
                  const skillXp = characterStats[`${skill}_mastery_xp` as keyof CharacterStats] as number;
                  const xpRequired = calculateSkillXpRequired(skillLevel);
                  const xpProgress = (skillXp / xpRequired) * 100;
                  
                  return (
                    <div key={skill} className="bg-card p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <h3 className="font-semibold capitalize">
                            {skill.replace('_', ' ')}
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            Nível {skillLevel}
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>XP: {skillXp}/{xpRequired}</span>
                          <span>{Math.round(xpProgress)}%</span>
                        </div>
                        <Progress value={xpProgress} className="h-2" />
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2">
                        {getSkillDescription(skill)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal de Distribuição de Atributos */}
        {characterStats && (
          <AttributeDistributionModal
            isOpen={showAttributeModal}
            onClose={() => setShowAttributeModal(false)}
            characterStats={characterStats}
            onDistributePoints={handleDistributePoints}
          />
        )}
      </div>
    </div>
  );
} 