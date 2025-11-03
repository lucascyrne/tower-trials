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
import { CharacterService } from '@/services/character.service';
import {
  type CharacterStats,
  SkillType,
  getSkillDescription,
  calculateSkillXpRequired,
} from '@/models/character.model';
import { motion, AnimatePresence } from 'framer-motion';
import { DerivedStatsSection } from '@/features/character/DerivedStatsSection';
import { CharacterUtils, type PreviewImprovements } from '@/utils/character-utils';

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

  const loadCharacterStats = useCallback(
    async (forceRefresh: boolean = false) => {
      if (!characterId || characterId.trim() === '') {
        console.warn(
          '[CharacterStatsPage] Character ID não fornecido, redirecionando para seleção de personagem'
        );
        navigate({ to: '/game/play' });
        return;
      }

      try {
        setLoading(true);
        // ✅ CORREÇÃO CRÍTICA: Forçar busca de dados atualizados com auto-heal aplicado
        // Sempre forçar refresh nesta página para garantir dados corretos
        const shouldForceRefresh = forceRefresh || true; // Sempre forçar na página de stats
        const response = await CharacterService.getCharacterForGame(
          characterId,
          shouldForceRefresh,
          true
        );

        if (response.success && response.data) {
          // Converter GamePlayer para CharacterStats
          const gamePlayer = response.data;
          const characterStats: CharacterStats = {
            level: gamePlayer.level,
            xp: gamePlayer.xp,
            xp_next_level: gamePlayer.xp_next_level,
            gold: gamePlayer.gold,
            hp: gamePlayer.hp,
            max_hp: gamePlayer.max_hp,
            mana: gamePlayer.mana,
            max_mana: gamePlayer.max_mana,
            atk: gamePlayer.atk,
            magic_attack: gamePlayer.magic_attack,
            def: gamePlayer.def,
            speed: gamePlayer.speed,
            strength: gamePlayer.strength || 10,
            dexterity: gamePlayer.dexterity || 10,
            intelligence: gamePlayer.intelligence || 10,
            wisdom: gamePlayer.wisdom || 10,
            vitality: gamePlayer.vitality || 10,
            luck: gamePlayer.luck || 10,
            attribute_points: gamePlayer.attribute_points || 0,
            critical_chance: gamePlayer.critical_chance || 0,
            critical_damage: gamePlayer.critical_damage || 130,
            magic_damage_bonus: gamePlayer.magic_damage_bonus || 0,
            sword_mastery: gamePlayer.sword_mastery || 1,
            axe_mastery: gamePlayer.axe_mastery || 1,
            blunt_mastery: gamePlayer.blunt_mastery || 1,
            defense_mastery: gamePlayer.defense_mastery || 1,
            magic_mastery: gamePlayer.magic_mastery || 1,
            sword_mastery_xp: gamePlayer.sword_mastery_xp || 0,
            axe_mastery_xp: gamePlayer.axe_mastery_xp || 0,
            blunt_mastery_xp: gamePlayer.blunt_mastery_xp || 0,
            defense_mastery_xp: gamePlayer.defense_mastery_xp || 0,
            magic_mastery_xp: gamePlayer.magic_mastery_xp || 0,
            base_hp: gamePlayer.base_hp,
            base_max_hp: gamePlayer.base_max_hp,
            base_mana: gamePlayer.base_mana,
            base_max_mana: gamePlayer.base_max_mana,
            base_atk: gamePlayer.base_atk,
            base_def: gamePlayer.base_def,
            base_speed: gamePlayer.base_speed,
            equipment_hp_bonus: gamePlayer.equipment_hp_bonus,
            equipment_mana_bonus: gamePlayer.equipment_mana_bonus,
            equipment_atk_bonus: gamePlayer.equipment_atk_bonus,
            equipment_def_bonus: gamePlayer.equipment_def_bonus,
            equipment_speed_bonus: gamePlayer.equipment_speed_bonus,
          };

          setCharacterStats(characterStats);
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
    },
    [characterId, navigate]
  );

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
        setCharacterStats(null);
        await loadCharacterStats(true); // Forçar refresh dos dados
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

  // ✅ FONTE ÚNICA: Usar CharacterUtils para preview ao invés de cálculos próprios
  const [previewImprovements, setPreviewImprovements] = useState<PreviewImprovements | null>(null);

  useEffect(() => {
    if (characterStats && totalPointsToDistribute > 0) {
      CharacterUtils.calculatePreviewImprovements(characterStats, distribution)
        .then(setPreviewImprovements)
        .catch(error => {
          console.error('[CharacterStatsPage] Erro ao calcular preview:', error);
          setPreviewImprovements(null);
        });
    } else {
      setPreviewImprovements(null);
    }
  }, [characterStats, distribution, totalPointsToDistribute]);

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
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
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
                        Preview dos Melhoramentos (Sistema Real)
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {(() => {
                          // ✅ FONTE ÚNICA: Usar preview do CharacterUtils
                          if (!previewImprovements) {
                            return (
                              <div className="col-span-2 text-center text-muted-foreground">
                                Calculando melhoramentos...
                              </div>
                            );
                          }

                          const improvements = previewImprovements;
                          const hasAnyImprovement =
                            improvements.hp > 0 ||
                            improvements.mana > 0 ||
                            improvements.atk > 0 ||
                            improvements.speed > 0 ||
                            improvements.critChance > 0;

                          if (!hasAnyImprovement) {
                            return (
                              <div className="col-span-2 text-center text-muted-foreground">
                                Nenhum melhoramento detectado
                              </div>
                            );
                          }

                          return (
                            <>
                              {improvements.hp > 0 && (
                                <div className="flex justify-between">
                                  <span>HP:</span>
                                  <span className="text-green-400">+{improvements.hp}</span>
                                </div>
                              )}
                              {improvements.mana > 0 && (
                                <div className="flex justify-between">
                                  <span>Mana:</span>
                                  <span className="text-blue-400">+{improvements.mana}</span>
                                </div>
                              )}
                              {improvements.atk > 0 && (
                                <div className="flex justify-between">
                                  <span>Ataque:</span>
                                  <span className="text-red-400">+{improvements.atk}</span>
                                </div>
                              )}
                              {improvements.speed > 0 && (
                                <div className="flex justify-between">
                                  <span>Velocidade:</span>
                                  <span className="text-green-400">+{improvements.speed}</span>
                                </div>
                              )}
                              {improvements.critChance > 0 && (
                                <div className="flex justify-between">
                                  <span>Crítico:</span>
                                  <span className="text-yellow-400">
                                    +{improvements.critChance.toFixed(1)}%
                                  </span>
                                </div>
                              )}
                            </>
                          );
                        })()}
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
          <DerivedStatsSection
            key={`${characterStats.strength}-${characterStats.dexterity}-${characterStats.intelligence}-${characterStats.wisdom}-${characterStats.vitality}-${characterStats.luck}-${characterStats.attribute_points}`}
            characterStats={characterStats}
          />

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
