import { Badge } from '@/components/ui/badge';
import {
  getStatusEffectIcon,
  getStatusEffectColor,
  getAttributeIcon,
  type SpellEffectType,
  type ActiveEffects,
} from '@/resources/spell/spell.model';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Clock } from 'lucide-react';
import { useMemo, useCallback } from 'react';

interface StatusEffectsDisplayProps {
  activeEffects: ActiveEffects;
  size?: 'sm' | 'md' | 'lg';
  maxVisible?: number;
  className?: string;
}

interface EffectInfo {
  type: SpellEffectType | 'attribute_mod';
  icon: string;
  color: string;
  name: string;
  description: string;
  duration: number;
  isExpiring: boolean;
}

export function StatusEffectsDisplay({
  activeEffects,
  size = 'md',
  maxVisible = 6,
  className = '',
}: StatusEffectsDisplayProps) {
  const translateAttributeName = useCallback((attribute: string): string => {
    const translations = {
      atk: 'Ataque',
      def: 'Defesa',
      speed: 'Velocidade',
      magic_attack: 'Ataque Mágico',
      critical_chance: 'Chance Crítica',
      critical_damage: 'Dano Crítico',
    };
    return translations[attribute as keyof typeof translations] || attribute;
  }, []);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-6 h-6 text-xs';
      case 'lg':
        return 'w-10 h-10 text-sm';
      default:
        return 'w-8 h-8 text-xs';
    }
  };

  const getEffectInfos = useMemo((): EffectInfo[] => {
    const effects: EffectInfo[] = [];

    const spellsWithAttributeMods = new Set<string>();

    activeEffects.attribute_modifications?.forEach(mod => {
      const modType = mod.value > 0 ? 'buff' : 'debuff';
      const sign = mod.value > 0 ? '+' : '';
      const suffix = mod.type === 'percentage' ? '%' : '';

      spellsWithAttributeMods.add(mod.source_spell);

      effects.push({
        type: 'attribute_mod',
        icon: getAttributeIcon(mod.attribute),
        color: getStatusEffectColor(modType),
        name: mod.source_spell,
        description: `${sign}${mod.value}${suffix} ${translateAttributeName(mod.attribute)}`,
        duration: mod.duration,
        isExpiring: mod.duration <= 1,
      });
    });

    activeEffects.buffs?.forEach(effect => {
      if (!spellsWithAttributeMods.has(effect.source_spell)) {
        effects.push({
          type: effect.type,
          icon: getStatusEffectIcon(effect.type),
          color: getStatusEffectColor(effect.type),
          name: effect.source_spell,
          description: `Efeito benéfico (+${effect.value})`,
          duration: effect.duration,
          isExpiring: effect.duration <= 1,
        });
      }
    });

    activeEffects.debuffs?.forEach(effect => {
      if (!spellsWithAttributeMods.has(effect.source_spell)) {
        effects.push({
          type: effect.type,
          icon: getStatusEffectIcon(effect.type),
          color: getStatusEffectColor(effect.type),
          name: effect.source_spell,
          description: `Efeito prejudicial (-${effect.value})`,
          duration: effect.duration,
          isExpiring: effect.duration <= 1,
        });
      }
    });

    activeEffects.dots?.forEach(effect => {
      effects.push({
        type: effect.type,
        icon: getStatusEffectIcon(effect.type),
        color: getStatusEffectColor(effect.type),
        name: effect.source_spell,
        description: `${effect.value} dano por turno`,
        duration: effect.duration,
        isExpiring: effect.duration <= 1,
      });
    });

    activeEffects.hots?.forEach(effect => {
      effects.push({
        type: effect.type,
        icon: getStatusEffectIcon(effect.type),
        color: getStatusEffectColor(effect.type),
        name: effect.source_spell,
        description: `${effect.value} cura por turno`,
        duration: effect.duration,
        isExpiring: effect.duration <= 1,
      });
    });

    return effects.slice(0, maxVisible);
  }, [activeEffects, maxVisible, translateAttributeName]);

  const effects = getEffectInfos;

  if (effects.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      <TooltipProvider>
        {effects.map((effect, index) => (
          <Tooltip key={`${effect.name}-${index}`}>
            <TooltipTrigger asChild>
              <div className="relative">
                <Badge
                  variant="outline"
                  className={`
                    ${getSizeClasses()} 
                    ${effect.color} 
                    flex items-center justify-center 
                    border-2 cursor-help
                    ${effect.isExpiring ? 'animate-pulse' : ''}
                  `}
                >
                  <span className="text-sm">{effect.icon}</span>

                  {/* Indicador de duração */}
                  <div className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-background border border-border rounded-full flex items-center justify-center text-[10px] font-bold">
                    {effect.isExpiring ? <Clock className="w-2 h-2" /> : effect.duration}
                  </div>
                </Badge>
              </div>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-w-xs bg-background border border-border shadow-xl"
            >
              <div className="p-2">
                <div className="font-semibold text-foreground mb-1">{effect.name}</div>
                <div className="text-sm text-muted-foreground mb-2">{effect.description}</div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    {effect.duration === 1
                      ? 'Expira no próximo turno'
                      : `${effect.duration} turnos restantes`}
                  </span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {/* Indicador de mais efeitos se exceder o limite */}
        {(activeEffects.buffs?.length || 0) +
          (activeEffects.debuffs?.length || 0) +
          (activeEffects.dots?.length || 0) +
          (activeEffects.hots?.length || 0) +
          (activeEffects.attribute_modifications?.length || 0) >
          maxVisible && (
          <Badge
            variant="outline"
            className={`
              ${getSizeClasses()}
              bg-gray-500/20 text-gray-400 border-gray-500/30
              flex items-center justify-center
            `}
          >
            <span className="text-xs">+</span>
          </Badge>
        )}
      </TooltipProvider>
    </div>
  );
}
