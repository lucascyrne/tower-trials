import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  ArrowLeft,
  TrendingUp,
  Zap,
  Heart,
  Eye,
  Star,
  Sword,
  Shield,
  Target,
  Sparkles,
  Plus,
  Minus,
  RotateCcw,
  Save,
} from 'lucide-react';
import { CharacterService } from '@/resources/game/character.service';
import {
  type CharacterStats,
  SkillType,
  getSkillDescription,
  calculateSkillXpRequired,
} from '@/resources/game/models/character.model';
import { motion, AnimatePresence } from 'framer-motion';
import { DerivedStatsSection } from '@/components/game/derived-stats-section';

interface AttributeDistribution {
  strength: number;
  dexterity: number;
  intelligence: number;
  wisdom: number;
  vitality: number;
  luck: number;
}

export const Route = createFileRoute('/_authenticated/game/play/hub/character-stats')({
  component: CharacterStatsPage,
  validateSearch: search => {
    // Validar se o parâmetro character está presente e é uma string válida
    const character = search.character as string;
    if (!character || typeof character !== 'string' || character.trim() === '') {
      console.warn('[CharacterStatsRoute] Parâmetro character inválido:', character);
      return { character: '' };
    }
    return { character: character.trim() };
  },
});

function CharacterStatsPage() {
  const navigate = useNavigate();
  const { character: characterId } = Route.useSearch();

  // Log para depuração
  console.log('[CharacterStatsPage] Character ID recebido:', characterId);
  const [characterStats, setCharacterStats] = useState<CharacterStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDistributing, setIsDistributing] = useState(false);
  const [distribution, setDistribution] = useState<AttributeDistribution>({
    strength: 0,
    dexterity: 0,
    intelligence: 0,
    wisdom: 0,
    vitality: 0,
    luck: 0,
  });

  const loadCharacterStats = useCallback(async () => {
    if (!characterId || characterId.trim() === '') {
      console.warn(
        '[CharacterStatsPage] Character ID não fornecido, redirecionando para seleção de personagem'
      );
      navigate({ to: '/game/play' });
      return;
    }

    try {
      setLoading(true);
      const response = await CharacterService.getCharacterStats(characterId);
      if (response.success && response.data) {
        console.log('[CharacterStatsPage] Stats recebidos:', {
          hp: {
            value: response.data.max_hp,
            base: response.data.base_max_hp,
            bonus: response.data.equipment_hp_bonus,
          },
          atk: {
            value: response.data.atk,
            base: response.data.base_atk,
            bonus: response.data.equipment_atk_bonus,
          },
        });
        setCharacterStats(response.data);
      } else {
        toast.error('Erro ao carregar stats do personagem', {
          description: response.error,
        });
        navigate({ to: '/game/play/hub', search: { character: characterId } });
      }
    } catch (error) {
      console.error('Erro ao carregar stats:', error);
      toast.error('Erro ao carregar stats do personagem');
      navigate({ to: '/game/play/hub', search: { character: characterId } });
    } finally {
      setLoading(false);
    }
  }, [characterId, navigate]);

  useEffect(() => {
    if (characterId) {
      loadCharacterStats();
    }
  }, [characterId]);

  const totalPointsToDistribute = Object.values(distribution).reduce(
    (sum, value) => sum + value,
    0
  );
  const availablePoints = (characterStats?.attribute_points || 0) - totalPointsToDistribute;

  const handleIncrement = (attribute: keyof AttributeDistribution) => {
    if (availablePoints > 0) {
      setDistribution(prev => ({
        ...prev,
        [attribute]: prev[attribute] + 1,
      }));
    }
  };

  const handleDecrement = (attribute: keyof AttributeDistribution) => {
    if (distribution[attribute] > 0) {
      setDistribution(prev => ({
        ...prev,
        [attribute]: prev[attribute] - 1,
      }));
    }
  };

  const handleReset = () => {
    setDistribution({
      strength: 0,
      dexterity: 0,
      intelligence: 0,
      wisdom: 0,
      vitality: 0,
      luck: 0,
    });
  };

  const handleSubmit = async () => {
    if (totalPointsToDistribute === 0 || !characterId) return;

    setIsDistributing(true);
    try {
      const response = await CharacterService.distributeAttributePoints(characterId, distribution);

      if (response.success) {
        toast.success('Pontos distribuídos com sucesso!');
        handleReset();
        await loadCharacterStats();
      } else {
        toast.error('Erro ao distribuir pontos', {
          description: response.error,
        });
      }
    } catch (error) {
      console.error('Erro ao distribuir pontos:', error);
      toast.error('Erro ao distribuir pontos');
    } finally {
      setIsDistributing(false);
    }
  };

  // Configuração dos atributos
  const attributeConfig = {
    strength: {
      label: 'Força',
      icon: TrendingUp,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
      description: 'Aumenta dano físico e capacidade de carga',
    },
    dexterity: {
      label: 'Destreza',
      icon: Zap,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20',
      description: 'Aumenta velocidade e chance de crítico',
    },
    intelligence: {
      label: 'Inteligência',
      icon: Sparkles,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20',
      description: 'Aumenta dano mágico e pontos de mana',
    },
    wisdom: {
      label: 'Sabedoria',
      icon: Eye,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      description: 'Aumenta regeneração de mana e resistência',
    },
    vitality: {
      label: 'Vitalidade',
      icon: Heart,
      color: 'text-pink-400',
      bgColor: 'bg-pink-500/10',
      borderColor: 'border-pink-500/20',
      description: 'Aumenta pontos de vida e regeneração',
    },
    luck: {
      label: 'Sorte',
      icon: Star,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      description: 'Aumenta chance de drops raros e críticos',
    },
  };

  const getSkillIcon = (skill: SkillType) => {
    switch (skill) {
      case SkillType.SWORD_MASTERY:
        return Sword;
      case SkillType.AXE_MASTERY:
        return Zap;
      case SkillType.BLUNT_MASTERY:
        return Target;
      case SkillType.DEFENSE_MASTERY:
        return Shield;
      case SkillType.MAGIC_MASTERY:
        return Sparkles;
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
          <p className="text-muted-foreground mb-4">
            Não foi possível carregar os stats do personagem
          </p>
          <Button
            onClick={() => navigate({ to: '/game/play/hub', search: { character: characterId } })}
          >
            Voltar ao Hub
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4 overflow-visible">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col items-start gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/game/play/hub', search: { character: characterId } })}
            >
              <ArrowLeft className="h-2 w-2 mr-2" />
              Voltar ao Hub
            </Button>

            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Atributos & Habilidades</h1>
              <p className="text-sm text-muted-foreground">Gerencie os stats do seu personagem</p>
            </div>
          </div>

          {characterStats.attribute_points > 0 && (
            <Badge
              variant="outline"
              className="bg-yellow-500/10 border-yellow-500/30 text-yellow-400 px-3 py-1"
            >
              <Star className="h-4 w-4 mr-2" />
              {availablePoints} pontos disponíveis
            </Badge>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-visible">
          {/* Atributos Primários com Distribuição */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Atributos Primários
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(attributeConfig).map(([key, config]) => {
                const attribute = key as keyof AttributeDistribution;
                const currentValue = characterStats[attribute] || 0;
                const Icon = config.icon;

                return (
                  <motion.div
                    key={attribute}
                    className={`flex items-center gap-4 p-4 rounded-lg border ${config.bgColor} ${config.borderColor}`}
                    whileHover={{ scale: 1.01 }}
                  >
                    {/* Ícone e Info */}
                    <div className="flex items-center gap-3 flex-1">
                      <Icon className={`h-5 w-5 ${config.color}`} />
                      <div className="flex-1">
                        <div className="font-semibold text-sm">{config.label}</div>
                        <div className="text-xs text-muted-foreground">{config.description}</div>
                      </div>
                    </div>

                    {/* Valor Atual */}
                    <div className="text-center min-w-[80px]">
                      <div className="text-lg font-bold">
                        {currentValue}
                        {distribution[attribute] > 0 && (
                          <span className="text-green-400 ml-1 text-sm">
                            +{distribution[attribute]}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentValue + distribution[attribute]}/50
                      </div>
                    </div>

                    {/* Controles de Distribuição */}
                    {characterStats.attribute_points > 0 && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleDecrement(attribute)}
                          disabled={distribution[attribute] === 0}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>

                        <div className="w-8 text-center text-sm font-mono">
                          {distribution[attribute]}
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-full"
                          onClick={() => handleIncrement(attribute)}
                          disabled={availablePoints === 0}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Controles de Distribuição */}
              {characterStats.attribute_points > 0 && totalPointsToDistribute > 0 && (
                <AnimatePresence>
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="border-t pt-4 mt-4"
                  >
                    {/* Preview dos Melhoramentos */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-4">
                      <div className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Preview dos Melhoramentos
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {distribution.vitality > 0 && (
                          <div className="flex justify-between">
                            <span>HP:</span>
                            <span className="text-green-400">+{distribution.vitality * 8}</span>
                          </div>
                        )}
                        {distribution.intelligence > 0 && (
                          <div className="flex justify-between">
                            <span>Mana:</span>
                            <span className="text-blue-400">+{distribution.intelligence * 5}</span>
                          </div>
                        )}
                        {distribution.strength > 0 && (
                          <div className="flex justify-between">
                            <span>Ataque:</span>
                            <span className="text-red-400">+{distribution.strength * 2}</span>
                          </div>
                        )}
                        {distribution.dexterity > 0 && (
                          <div className="flex justify-between">
                            <span>Velocidade:</span>
                            <span className="text-green-400">
                              +{Math.floor(distribution.dexterity * 1.5)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={handleReset} className="flex-1">
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Resetar
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={isDistributing}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                      >
                        {isDistributing ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        ) : (
                          <Save className="h-4 w-4 mr-2" />
                        )}
                        Confirmar
                      </Button>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </CardContent>
          </Card>

          {/* Stats Derivados */}
          <DerivedStatsSection characterStats={characterStats} />

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
                {Object.values(SkillType).map(skill => {
                  const IconComponent = getSkillIcon(skill);
                  const skillLevel = characterStats[
                    `${skill}_mastery` as keyof CharacterStats
                  ] as number;
                  const skillXp = characterStats[
                    `${skill}_mastery_xp` as keyof CharacterStats
                  ] as number;
                  const xpRequired = calculateSkillXpRequired(skillLevel);
                  const xpProgress = (skillXp / xpRequired) * 100;

                  return (
                    <div key={skill} className="bg-card p-4 rounded-lg border">
                      <div className="flex items-center gap-2 mb-3">
                        <IconComponent className="h-5 w-5 text-primary" />
                        <div className="flex-1">
                          <h3 className="font-semibold capitalize">{skill.replace('_', ' ')}</h3>
                          <div className="text-sm text-muted-foreground">Nível {skillLevel}</div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>
                            XP: {skillXp}/{xpRequired}
                          </span>
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
      </div>
    </div>
  );
}
