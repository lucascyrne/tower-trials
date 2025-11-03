import React, { useEffect, useState } from 'react';
import {
  type Equipment,
  type EquipmentComparison as EquipmentComparisonType,
} from '@/models/equipment.model';
import { CharacterService } from '@/services/character.service';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  Sparkles,
  Shield,
  Swords,
  Zap,
  Heart,
} from 'lucide-react';

interface EquipmentComparisonProps {
  characterId: string;
  newEquipment: Equipment;
  slotType?: string;
  currentEquipment?: Equipment | null;
  showTitle?: boolean;
  compact?: boolean;
}

export const EquipmentComparison: React.FC<EquipmentComparisonProps> = ({
  characterId,
  newEquipment,
  slotType,
  currentEquipment,
  showTitle = true,
  compact = false,
}) => {
  const [comparisons, setComparisons] = useState<EquipmentComparisonType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadComparison = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const characterResponse = await CharacterService.getCharacterForGame(
          characterId,
          true,
          false
        );
        if (characterResponse.success && characterResponse.data) {
          const gamePlayer = characterResponse.data;

          // Criar comparações baseadas nos stats atuais do personagem
          const localComparisons: EquipmentComparisonType[] = [];

          // Comparar cada stat relevante usando os stats reais do GamePlayer
          const statsToCompare = [
            { name: 'Ataque', current: gamePlayer.atk, bonus: newEquipment.atk_bonus },
            { name: 'Defesa', current: gamePlayer.def, bonus: newEquipment.def_bonus },
            { name: 'Mana', current: gamePlayer.max_mana, bonus: newEquipment.mana_bonus },
            { name: 'Velocidade', current: gamePlayer.speed, bonus: newEquipment.speed_bonus },
            { name: 'HP', current: gamePlayer.max_hp, bonus: newEquipment.hp_bonus },
            {
              name: 'Chance Crítica',
              current: gamePlayer.critical_chance || 0,
              bonus: newEquipment.critical_chance_bonus,
            },
            {
              name: 'Dano Crítico',
              current: gamePlayer.critical_damage || 130,
              bonus: newEquipment.critical_damage_bonus,
            },
            {
              name: 'Duplo Ataque',
              current: gamePlayer.double_attack_chance || 0,
              bonus: newEquipment.double_attack_chance_bonus,
            },
            {
              name: 'Dano Mágico',
              current: gamePlayer.magic_damage_bonus || 0,
              bonus: newEquipment.magic_damage_bonus,
            },
          ];

          statsToCompare.forEach(stat => {
            if (stat.bonus > 0) {
              localComparisons.push({
                stat_name: stat.name,
                current_value: stat.current,
                new_value: stat.current + stat.bonus,
                difference: stat.bonus,
                is_improvement: stat.bonus > 0,
              });
            }
          });
          setComparisons(localComparisons);
        } else {
          setError('Erro ao carregar stats do personagem');
        }
      } catch (err) {
        console.error('Erro ao carregar comparação:', err);
        setError('Erro ao carregar comparação');
      } finally {
        setIsLoading(false);
      }
    };

    loadComparison();
  }, [characterId, newEquipment.id, slotType, currentEquipment]);

  const getStatIcon = (statName: string) => {
    const name = statName.toLowerCase();
    if (name.includes('attack') || name.includes('dano')) return <Swords className="w-3 h-3" />;
    if (name.includes('defense') || name.includes('defesa')) return <Shield className="w-3 h-3" />;
    if (name.includes('speed') || name.includes('velocidade')) return <Zap className="w-3 h-3" />;
    if (name.includes('hp') || name.includes('vida')) return <Heart className="w-3 h-3" />;
    return <Sparkles className="w-3 h-3" />;
  };

  const getChangeIcon = (isImprovement: boolean, difference: number) => {
    if (difference === 0) return <Minus className="w-4 h-4 text-muted-foreground/60" />;
    return isImprovement ? (
      <TrendingUp className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.4)]" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.4)]" />
    );
  };

  const getChangeText = (difference: number, isImprovement: boolean) => {
    if (difference === 0) return '—';
    const sign = isImprovement ? '+' : '';
    return `${sign}${difference.toFixed(difference % 1 === 0 ? 0 : 2)}`;
  };

  const getChangeColor = (isImprovement: boolean, difference: number) => {
    if (difference === 0) return 'text-muted-foreground/60';
    return isImprovement
      ? 'text-emerald-400 drop-shadow-[0_0_6px_rgba(16,185,129,0.3)]'
      : 'text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.3)]';
  };

  const getStatBadgeClass = (isImprovement: boolean, difference: number) => {
    if (difference === 0) return 'bg-muted/30 border-muted/40';
    return isImprovement
      ? 'bg-emerald-500/10 border-emerald-500/30 magical-border'
      : 'bg-red-500/10 border-red-500/30';
  };

  if (isLoading) {
    return (
      <div
        className={`${compact ? 'p-3' : 'p-6'} border border-border/50 rounded-xl bg-card/40 backdrop-blur-sm`}
      >
        <div className="flex items-center justify-center space-x-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary/70" />
          <span className="text-sm text-muted-foreground font-medium">
            Analisando modificações mágicas...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`${compact ? 'p-3' : 'p-6'} border border-destructive/30 rounded-xl bg-destructive/5 backdrop-blur-sm`}
      >
        <div className="flex items-center space-x-2">
          <Zap className="w-4 h-4 text-destructive/70" />
          <p className="text-sm text-destructive font-medium">{error}</p>
        </div>
      </div>
    );
  }

  if (comparisons.length === 0) {
    return (
      <div
        className={`${compact ? 'p-3' : 'p-6'} border border-border/50 rounded-xl bg-card/30 backdrop-blur-sm`}
      >
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground font-medium">
            {currentEquipment === null
              ? 'Slot vazio — equipamento será adicionado'
              : 'Atributos inalterados'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
      ${compact ? 'p-3' : 'p-6'} 
      border border-border/50 rounded-xl 
      bg-gradient-to-br from-card/80 to-card/40 
      backdrop-blur-sm
      transition-all duration-300 
      hover:border-border/70 hover:shadow-lg hover:shadow-primary/5
      card-enhanced
    `}
    >
      {showTitle && (
        <div className="flex items-center space-x-2 mb-4">
          <Sparkles className="w-4 h-4 text-primary/70" />
          <h4 className={`${compact ? 'text-sm' : 'text-base'} font-semibold text-foreground`}>
            Modificações Mágicas
          </h4>
        </div>
      )}

      <div className="space-y-2">
        {comparisons.map((comparison, index) => (
          <div
            key={index}
            className={`
              relative overflow-hidden
              rounded-lg border p-3
              ${getStatBadgeClass(comparison.is_improvement, comparison.difference)}
              transition-all duration-200 hover:scale-[1.02]
              ${compact ? 'text-xs' : 'text-sm'}
            `}
          >
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center space-x-2">
                {getStatIcon(comparison.stat_name)}
                <span className="font-medium text-foreground/90">{comparison.stat_name}</span>
              </div>

              <div className="flex items-center space-x-3">
                {/* Valor atual */}
                <div className="text-right">
                  <div className="text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">
                    Atual
                  </div>
                  <div className="font-mono font-semibold text-foreground/80">
                    {comparison.current_value.toFixed(comparison.current_value % 1 === 0 ? 0 : 2)}
                  </div>
                </div>

                {/* Mudança */}
                <div className="flex items-center space-x-1 min-w-[60px] justify-center">
                  {getChangeIcon(comparison.is_improvement, comparison.difference)}
                  <span
                    className={`font-mono font-bold ${getChangeColor(comparison.is_improvement, comparison.difference)}`}
                  >
                    {getChangeText(comparison.difference, comparison.is_improvement)}
                  </span>
                </div>

                {/* Valor novo */}
                <div className="text-right">
                  <div className="text-xs text-muted-foreground/70 font-medium uppercase tracking-wide">
                    Novo
                  </div>
                  <div className="font-mono font-bold text-foreground">
                    {comparison.new_value.toFixed(comparison.new_value % 1 === 0 ? 0 : 2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Efeito de fundo sutil */}
            {comparison.difference !== 0 && (
              <div className="absolute inset-0 opacity-10">
                <div
                  className={`
                  w-full h-full rounded-lg
                  ${
                    comparison.is_improvement
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-400/10'
                      : 'bg-gradient-to-r from-red-500/20 to-red-400/10'
                  }
                `}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {!compact && (
        <div className="mt-4 pt-3 border-t border-border/30">
          <div className="flex items-center justify-center space-x-6 text-xs">
            <div className="flex items-center space-x-1.5 text-emerald-400/80">
              <TrendingUp className="w-3 h-3" />
              <span className="font-medium">Aprimoramento</span>
            </div>
            <div className="flex items-center space-x-1.5 text-red-400/80">
              <TrendingDown className="w-3 h-3" />
              <span className="font-medium">Redução</span>
            </div>
            <div className="flex items-center space-x-1.5 text-muted-foreground/60">
              <Minus className="w-3 h-3" />
              <span className="font-medium">Inalterado</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
