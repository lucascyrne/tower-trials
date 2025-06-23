import { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Heart,
  Zap,
  Sword,
  Shield,
  Star,
  Crown,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Axe,
  Hammer,
  Target,
  User,
  Gem,
  Play,
  TrendingUp,
  Eye,
} from 'lucide-react';
import { StatDisplay } from '@/components/ui/stat-display';
import { type GamePlayer } from '@/models/game.model';
import { CharacterService } from '@/services/character.service';
import { useNavigate } from '@tanstack/react-router';

interface CharacterInfoCardProps {
  player: GamePlayer;
}

/**
 * ✅ OTIMIZAÇÕES E RECURSOS IMPLEMENTADOS NO CHARACTERINFOCARD:
 *
 * 1. **React.memo**: Evita re-renderizações desnecessárias quando as props não mudam
 * 2. **useMemo para cálculos**: Progress bars, atributos e skills são memoizados
 * 3. **StatDisplay universal**: Todos os stats principais (HP, Mana, ATK, DEF, SPD, Magic Attack) mostram:
 *    - Diferenciação clara entre valores base e bônus de equipamentos
 *    - Notação "(+x)" para bônus de equipamentos
 *    - Tooltips detalhados com breakdown completo dos bônus
 *    - Modificações de efeitos mágicos ativos com indicadores visuais
 * 4. **Layout otimizado**: Stats derivados organizados e pontos de atributo destacados
 * 5. **Performance**: Dependências específicas nos useMemo para evitar recálculos
 * 6. **Transparência total**: Usuário vê claramente de onde vem cada bônus nos stats
 */

// ✅ OTIMIZAÇÃO: Usar React.memo para evitar re-renderizações desnecessárias
export const CharacterInfoCard = memo(function CharacterInfoCard({
  player,
}: CharacterInfoCardProps) {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(false);
  const [isLoadingQuickPlay, setIsLoadingQuickPlay] = useState(false);

  // ✅ OTIMIZAÇÃO: Memoizar cálculos de progresso para evitar re-renderizações desnecessárias
  const progressData = useMemo(() => {
    // Calcular progresso de XP dentro do nível atual
    const calculateCurrentLevelXpRequirement = (level: number): number => {
      if (level <= 1) return 0;
      return Math.floor(100 * Math.pow(1.5, level - 2));
    };

    const currentLevelStartXp = calculateCurrentLevelXpRequirement(player.level);
    const currentLevelEndXp = player.xp_next_level;
    const xpInCurrentLevel = player.xp - currentLevelStartXp;
    const xpNeededForNextLevel = currentLevelEndXp - currentLevelStartXp;
    const xpProgress = Math.max(0, Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100));

    const hpProgress = (player.hp / player.max_hp) * 100;
    const manaProgress = (player.mana / player.max_mana) * 100;

    return {
      xpInCurrentLevel,
      xpNeededForNextLevel,
      xpProgress,
      hpProgress,
      manaProgress,
    };
  }, [
    player.level,
    player.xp,
    player.xp_next_level,
    player.hp,
    player.max_hp,
    player.mana,
    player.max_mana,
  ]);

  // ✅ OTIMIZAÇÃO: Memoizar configuração de atributos
  const primaryAttributes = useMemo(
    () => [
      {
        name: 'FOR',
        fullName: 'Força',
        value: player.strength || 10,
        icon: Sword,
        color: 'text-red-400',
      },
      {
        name: 'AGI',
        fullName: 'Agilidade',
        value: player.dexterity || 10,
        icon: Zap,
        color: 'text-green-400',
      },
      {
        name: 'INT',
        fullName: 'Inteligência',
        value: player.intelligence || 10,
        icon: Sparkles,
        color: 'text-blue-400',
      },
      {
        name: 'SAB',
        fullName: 'Sabedoria',
        value: player.wisdom || 10,
        icon: Eye,
        color: 'text-purple-400',
      },
      {
        name: 'VIT',
        fullName: 'Vitalidade',
        value: player.vitality || 10,
        icon: Heart,
        color: 'text-pink-400',
      },
      {
        name: 'SOR',
        fullName: 'Sorte',
        value: player.luck || 10,
        icon: Crown,
        color: 'text-yellow-400',
      },
    ],
    [
      player.strength,
      player.dexterity,
      player.intelligence,
      player.wisdom,
      player.vitality,
      player.luck,
    ]
  );

  // ✅ OTIMIZAÇÃO: Memoizar habilidades de combate
  const characterSkills = useMemo(
    () =>
      [
        {
          key: 'sword_mastery',
          level: player.sword_mastery || 1,
          xp: player.sword_mastery_xp || 0,
        },
        { key: 'axe_mastery', level: player.axe_mastery || 1, xp: player.axe_mastery_xp || 0 },
        {
          key: 'blunt_mastery',
          level: player.blunt_mastery || 1,
          xp: player.blunt_mastery_xp || 0,
        },
        {
          key: 'defense_mastery',
          level: player.defense_mastery || 1,
          xp: player.defense_mastery_xp || 0,
        },
        {
          key: 'magic_mastery',
          level: player.magic_mastery || 1,
          xp: player.magic_mastery_xp || 0,
        },
      ].filter(skill => skill.level > 1 || skill.xp > 0),
    [
      player.sword_mastery,
      player.sword_mastery_xp,
      player.axe_mastery,
      player.axe_mastery_xp,
      player.blunt_mastery,
      player.blunt_mastery_xp,
      player.defense_mastery,
      player.defense_mastery_xp,
      player.magic_mastery,
      player.magic_mastery_xp,
    ]
  );

  // Função para iniciar jogo rapidamente do último checkpoint
  const handleQuickPlay = async () => {
    try {
      setIsLoadingQuickPlay(true);

      // Buscar checkpoints desbloqueados
      const checkpointsResponse = await CharacterService.getUnlockedCheckpoints(player.id);

      if (
        !checkpointsResponse.success ||
        !checkpointsResponse.data ||
        checkpointsResponse.data.length === 0
      ) {
        console.error('Nenhum checkpoint encontrado');
        return;
      }

      // Pegar o maior checkpoint desbloqueado (último)
      const checkpoints = checkpointsResponse.data.sort((a, b) => b.floor - a.floor);
      const lastCheckpoint = checkpoints[0];

      console.log(
        `[QuickPlay] Iniciando do checkpoint: Andar ${lastCheckpoint.floor} - ${lastCheckpoint.description}`
      );

      // Iniciar do último checkpoint
      const startResponse = await CharacterService.startFromCheckpoint(
        player.id,
        lastCheckpoint.floor
      );

      if (!startResponse.success) {
        console.error('Erro ao iniciar do checkpoint:', startResponse.error);
        return;
      }

      console.log(`[QuickPlay] Checkpoint configurado com sucesso. Redirecionando para batalha...`);

      // Redirecionar para a página de batalha com o ID do personagem
      navigate({
        to: '/game/play/hub/battle/$character',
        params: { character: player.id },
        search: { character: player.id },
      });
    } catch (error) {
      console.error('Erro no início rápido:', error);
    } finally {
      setIsLoadingQuickPlay(false);
    }
  };

  // ✅ CORREÇÃO: Funções para obter cores das barras de progresso
  const getHpColor = () => {
    if (progressData.hpProgress >= 70) return 'bg-green-500';
    if (progressData.hpProgress >= 40) return 'bg-yellow-500';
    if (progressData.hpProgress >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getManaColor = () => {
    if (progressData.manaProgress >= 70) return 'bg-blue-500';
    if (progressData.manaProgress >= 40) return 'bg-cyan-500';
    if (progressData.manaProgress >= 20) return 'bg-indigo-500';
    return 'bg-purple-500';
  };

  // Função para obter ícone de habilidade
  const getSkillIcon = (skill: string) => {
    switch (skill) {
      case 'sword_mastery':
        return <Sword className="h-4 w-4 text-red-400" />;
      case 'axe_mastery':
        return <Axe className="h-4 w-4 text-orange-400" />;
      case 'blunt_mastery':
        return <Hammer className="h-4 w-4 text-yellow-400" />;
      case 'defense_mastery':
        return <Shield className="h-4 w-4 text-blue-400" />;
      case 'magic_mastery':
        return <Sparkles className="h-4 w-4 text-purple-400" />;
      default:
        return <Target className="h-4 w-4 text-gray-400" />;
    }
  };

  // Função para obter nome de habilidade traduzido
  const getSkillName = (skill: string) => {
    switch (skill) {
      case 'sword_mastery':
        return 'Maestria com Espadas';
      case 'axe_mastery':
        return 'Maestria com Machados';
      case 'blunt_mastery':
        return 'Maestria com Armas Pesadas';
      case 'defense_mastery':
        return 'Maestria em Defesa';
      case 'magic_mastery':
        return 'Maestria Mágica';
      default:
        return skill;
    }
  };

  return (
    <Card className="w-full bg-slate-900/80 border-slate-700 shadow-xl">
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <User className="h-5 w-5 text-slate-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-100">{player.name}</h2>
              <p className="text-sm text-slate-400">Aventureiro</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <Button
              onClick={handleQuickPlay}
              disabled={isLoadingQuickPlay}
              size="sm"
              className="quick-play-button relative overflow-hidden bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:via-purple-500 hover:to-indigo-500 text-white border border-violet-500/20 shadow-lg transition-all duration-300 hover:shadow-violet-500/25 hover:shadow-xl hover:-translate-y-0.5 flex-shrink-0 group disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:transform-none"
            >
              {/* Overlay gradiente hover */}
              <div className="absolute inset-0 bg-gradient-to-r from-violet-600/50 via-purple-600/50 to-indigo-600/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              {/* Indicador de início rápido - pequeno ícone */}
              {!isLoadingQuickPlay && (
                <div className="quick-start-indicator absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full shadow-sm shadow-amber-400/50" />
              )}

              {/* Ícone principal */}
              <Play
                className={`h-3 w-3 mr-1.5 relative z-10 transition-transform duration-300 ${isLoadingQuickPlay ? 'animate-spin' : 'group-hover:scale-110 group-hover:drop-shadow-lg'}`}
              />

              {/* Texto */}
              <span className="relative z-10 font-medium tracking-wide">
                {isLoadingQuickPlay ? 'Iniciando...' : 'Jogar'}
              </span>

              {/* Shimmer effect on hover */}
              {!isLoadingQuickPlay && (
                <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500">
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 group-hover:animate-pulse" />
                </div>
              )}
            </Button>
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-400 bg-amber-500/10 flex-shrink-0"
            >
              <Star className="h-3 w-3 mr-1" />
              Nível {player.level}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDetails(!showDetails)}
              className="text-slate-400 hover:text-slate-200 flex-shrink-0"
            >
              {showDetails ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Layout principal horizontal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lado esquerdo: Barras de status */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">Status</h3>

            {/* HP com diferenciação base/equipamentos */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Heart className="h-4 w-4 text-red-400" />
                  HP
                  {player.hp < player.max_hp && (
                    <div className="h-2 w-2 bg-green-400 rounded-full animate-pulse" />
                  )}
                </span>
                <div className="text-right">
                  <StatDisplay
                    value={player.max_hp}
                    baseValue={player.base_max_hp}
                    equipmentBonus={player.equipment_hp_bonus}
                    className="text-red-400 font-medium"
                    size="sm"
                    showTooltip={true}
                  />
                  <div className="text-xs text-slate-400">
                    {player.hp}/{player.max_hp}
                  </div>
                </div>
              </div>
              <div className="relative">
                <Progress value={progressData.hpProgress} className="h-2" />
                <div
                  className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${getHpColor()}`}
                  style={{ width: `${progressData.hpProgress}%` }}
                />
              </div>
            </div>

            {/* Mana com diferenciação base/equipamentos */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Sparkles className="h-4 w-4 text-blue-400" />
                  Mana
                </span>
                <div className="text-right">
                  <StatDisplay
                    value={player.max_mana}
                    baseValue={player.base_max_mana}
                    equipmentBonus={player.equipment_mana_bonus}
                    className="text-blue-400 font-medium"
                    size="sm"
                    showTooltip={true}
                  />
                  <div className="text-xs text-slate-400">
                    {player.mana}/{player.max_mana}
                  </div>
                </div>
              </div>
              <div className="relative">
                <Progress value={progressData.manaProgress} className="h-2" />
                <div
                  className={`absolute top-0 left-0 h-2 rounded-full transition-all duration-300 ${getManaColor()}`}
                  style={{ width: `${progressData.manaProgress}%` }}
                />
              </div>
            </div>

            {/* XP */}
            <div className="space-y-1">
              <div className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-2 font-medium text-slate-300">
                  <Star className="h-4 w-4 text-yellow-400" />
                  XP
                </span>
                <span className="text-slate-400">
                  {progressData.xpInCurrentLevel.toLocaleString()}/
                  {progressData.xpNeededForNextLevel.toLocaleString()}
                </span>
              </div>
              <div className="relative">
                <Progress value={progressData.xpProgress} className="h-2" />
                <div
                  className="absolute top-0 left-0 h-2 bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-400 rounded-full transition-all duration-300"
                  style={{ width: `${progressData.xpProgress}%` }}
                />
              </div>
            </div>
          </div>

          {/* Centro: Stats básicos e importantes */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Combat Stats
            </h3>

            {/* Stats principais com diferenciação base/equipamentos */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Sword className="h-4 w-4 text-red-400" />
                    <span className="text-muted-foreground">ATK</span>
                  </div>
                  <StatDisplay
                    value={player.atk}
                    baseValue={player.base_atk}
                    equipmentBonus={player.equipment_atk_bonus}
                    modifications={
                      player.active_effects?.attribute_modifications?.filter(
                        mod => mod.attribute === 'atk'
                      ) || []
                    }
                    className="text-red-400 font-bold"
                    size="sm"
                    showTooltip={true}
                  />
                </div>

                {/* Magic Attack com diferenciação base/equipamentos */}
                {Boolean(player.magic_attack && player.magic_attack > 0) && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <span className="text-muted-foreground">M.ATK</span>
                    </div>
                    <StatDisplay
                      value={player.magic_attack || 0}
                      modifications={
                        player.active_effects?.attribute_modifications?.filter(
                          mod => mod.attribute === 'magic_attack'
                        ) || []
                      }
                      className="text-purple-400 font-bold"
                      size="sm"
                      showTooltip={true}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Shield className="h-4 w-4 text-blue-400" />
                    <span className="text-muted-foreground">DEF</span>
                  </div>
                  <StatDisplay
                    value={player.def}
                    baseValue={player.base_def}
                    equipmentBonus={player.equipment_def_bonus}
                    modifications={
                      player.active_effects?.attribute_modifications?.filter(
                        mod => mod.attribute === 'def'
                      ) || []
                    }
                    className="text-blue-400 font-bold"
                    size="sm"
                    showTooltip={true}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Zap className="h-4 w-4 text-yellow-400" />
                    <span className="text-muted-foreground">SPD</span>
                  </div>
                  <StatDisplay
                    value={player.speed}
                    baseValue={player.base_speed}
                    equipmentBonus={player.equipment_speed_bonus}
                    modifications={
                      player.active_effects?.attribute_modifications?.filter(
                        mod => mod.attribute === 'speed'
                      ) || []
                    }
                    className="text-yellow-400 font-bold"
                    size="sm"
                    showTooltip={true}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-400" />
                    <span className="text-muted-foreground">CRIT</span>
                  </div>
                  <span className="font-bold text-amber-400">
                    {(player.critical_chance || 0).toFixed(1)}%
                  </span>
                </div>

                {/* Bônus Mágico */}
                {Boolean(player.magic_damage_bonus && player.magic_damage_bonus > 0) && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <span className="text-muted-foreground">M.BONUS</span>
                    </div>
                    <span className="font-bold text-purple-400">
                      +{Math.round(player.magic_damage_bonus || 0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Gold */}
            <div className="bg-slate-800/50 p-3 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gem className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-slate-300">Gold</span>
                </div>
                <p className="text-lg font-bold text-yellow-400">
                  {player.gold.toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          {/* Direita: Atributos compactos */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Atributos
            </h3>

            <div className="grid grid-cols-3 gap-2">
              {primaryAttributes.map(attr => {
                const Icon = attr.icon;
                return (
                  <div
                    key={attr.name}
                    className="bg-slate-800/50 p-2 rounded-lg border border-slate-700 hover:bg-slate-700/50 transition-colors"
                    title={attr.fullName}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <Icon className={`h-3 w-3 ${attr.color}`} />
                      <span className="text-xs font-medium text-slate-400">{attr.name}</span>
                      <span className={`text-sm font-bold ${attr.color}`}>{attr.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pontos de atributo disponíveis */}
            {Boolean(player.attribute_points && player.attribute_points > 0) && (
              <div className="bg-yellow-500/10 p-3 rounded-lg border border-yellow-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-300">Pontos Disponíveis</span>
                  </div>
                  <p className="text-lg font-bold text-yellow-400">{player.attribute_points}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Seção expansível com habilidades */}
        {showDetails && (
          <div className="border-t border-slate-700 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wide">
              Habilidades de Combate
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {characterSkills.map(skill => {
                // Calcular XP necessário para o próximo nível (fórmula simples)
                const nextLevelXp = skill.level * 100;
                const currentLevelXp = (skill.level - 1) * 100;
                const skillXpProgress = skill.xp - currentLevelXp;
                const skillXpNeeded = nextLevelXp - currentLevelXp;
                const skillXpPercentage = Math.max(
                  0,
                  Math.min(100, (skillXpProgress / skillXpNeeded) * 100)
                );

                return (
                  <div
                    key={skill.key}
                    className="bg-slate-700/50 p-3 rounded-lg border border-slate-600 hover:border-slate-500 transition-colors"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex items-center justify-center">
                        {getSkillIcon(skill.key)}
                      </div>
                      <span className="text-xs font-medium text-slate-400 text-center">
                        {getSkillName(skill.key)}
                      </span>
                      <Badge variant="outline" className="border-current bg-transparent text-xs">
                        Nv. {skill.level}
                      </Badge>
                      {Boolean(skill.xp > 0) && (
                        <div className="w-full">
                          <div className="w-full h-1 bg-slate-600 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-300"
                              style={{ width: `${skillXpPercentage}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-500 mt-1 text-center">
                            {skillXpProgress}/{skillXpNeeded} XP
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
