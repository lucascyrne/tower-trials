import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Heart, Brain, Sword, Sparkles, Shield, Zap, Star, Target } from 'lucide-react';
import { type CharacterStats } from '@/resources/character/character.model';
import { StatCardWithTooltip } from './StatCardWithTooltip';
import { CharacterUtils } from '@/utils/character-utils';

interface DerivedStatsSectionProps {
  characterStats: CharacterStats;
}

export function DerivedStatsSection({ characterStats }: DerivedStatsSectionProps) {
  // ✅ CRÍTICO: Obter breakdown detalhado usando fonte única
  const [statsBreakdown, setStatsBreakdown] = React.useState<{
    hp: { base: number; fromAttributes: number; fromMasteries: number };
    mana: { base: number; fromAttributes: number; fromMasteries: number };
    atk: { base: number; fromAttributes: number; fromMasteries: number };
    def: { base: number; fromAttributes: number; fromMasteries: number };
    speed: { base: number; fromAttributes: number; fromMasteries: number };
    criticalChance: { base: number; fromAttributes: number; fromMasteries: number };
    criticalDamage: { base: number; fromAttributes: number; fromMasteries: number };
    magicDamage: { base: number; fromAttributes: number; fromMasteries: number };
  } | null>(null);

  React.useEffect(() => {
    CharacterUtils.getStatsBreakdown(characterStats).then(setStatsBreakdown);
  }, [
    characterStats.strength,
    characterStats.dexterity,
    characterStats.intelligence,
    characterStats.wisdom,
    characterStats.vitality,
    characterStats.luck,
    characterStats.level,
  ]);

  // Loading state enquanto calcula
  if (!statsBreakdown) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Stats Derivados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-muted/20 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ✅ FONTE ÚNICA: Função para criar tooltips usando breakdown calculado
  const createTooltipFromBreakdown = (
    title: string,
    breakdown: { base: number; fromAttributes: number; fromMasteries: number },
    equipmentBonus: number = 0,
    finalValue: number
  ) => {
    const calculations = [
      { label: 'Base:', value: breakdown.base, color: 'text-blue-400' },
      { label: 'Atributos:', value: `+${breakdown.fromAttributes}`, color: 'text-green-400' },
    ];

    if (breakdown.fromMasteries > 0) {
      calculations.push({
        label: 'Maestrias:',
        value: `+${breakdown.fromMasteries}`,
        color: 'text-purple-400',
      });
    }

    if (equipmentBonus > 0) {
      calculations.push({
        label: 'Equipamentos:',
        value: `+${equipmentBonus}`,
        color: 'text-orange-400',
      });
    }

    return {
      title,
      calculations,
      total: {
        label: 'Total (Sistema):',
        value: finalValue.toLocaleString(),
        color: 'text-green-400',
      },
    };
  };

  // ✅ FONTE ÚNICA: Configuração usando breakdown calculado
  const statsConfig = [
    {
      icon: Heart,
      label: 'HP Máximo',
      value: (() => {
        const formatted = CharacterUtils.formatValueWithEquipmentBonus(
          characterStats.max_hp - (characterStats.equipment_hp_bonus || 0),
          characterStats.equipment_hp_bonus || 0
        );
        return formatted.hasBonus ? (
          <span>
            {formatted.formattedTotal}
            <span className="text-orange-400 text-sm ml-1 font-medium">
              {formatted.formattedBonus}
            </span>
          </span>
        ) : (
          <span>{formatted.formattedTotal}</span>
        );
      })(),
      color: 'text-red-400',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo do HP:',
        statsBreakdown.hp,
        characterStats.equipment_hp_bonus || 0,
        characterStats.max_hp
      ),
    },
    {
      icon: Brain,
      label: 'Mana Máxima',
      value: (() => {
        const formatted = CharacterUtils.formatValueWithEquipmentBonus(
          characterStats.max_mana - (characterStats.equipment_mana_bonus || 0),
          characterStats.equipment_mana_bonus || 0
        );
        return formatted.hasBonus ? (
          <span>
            {formatted.formattedTotal}
            <span className="text-orange-400 text-sm ml-1 font-medium">
              {formatted.formattedBonus}
            </span>
          </span>
        ) : (
          <span>{formatted.formattedTotal}</span>
        );
      })(),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo da Mana:',
        statsBreakdown.mana,
        characterStats.equipment_mana_bonus || 0,
        characterStats.max_mana
      ),
    },
    {
      icon: Sword,
      label: 'ATK Físico',
      value: (() => {
        const formatted = CharacterUtils.formatValueWithEquipmentBonus(
          characterStats.atk - (characterStats.equipment_atk_bonus || 0),
          characterStats.equipment_atk_bonus || 0
        );
        return formatted.hasBonus ? (
          <span>
            {formatted.formattedTotal}
            <span className="text-orange-400 text-sm ml-1 font-medium">
              {formatted.formattedBonus}
            </span>
          </span>
        ) : (
          <span>{formatted.formattedTotal}</span>
        );
      })(),
      color: 'text-red-400',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo do ATK Físico:',
        statsBreakdown.atk,
        characterStats.equipment_atk_bonus || 0,
        characterStats.atk
      ),
    },
    ...(characterStats.magic_attack && characterStats.magic_attack > 0
      ? [
          {
            icon: Sparkles,
            label: 'ATK Mágico',
            value: <span>{characterStats.magic_attack.toLocaleString()}</span>,
            color: 'text-purple-400',
            bgColor: 'bg-purple-500/5',
            borderColor: 'border-purple-500/20',
            tooltipData: createTooltipFromBreakdown(
              'Cálculo do ATK Mágico:',
              statsBreakdown.atk, // Usar mesmo breakdown do ATK físico mas com contexto mágico
              0,
              characterStats.magic_attack
            ),
          },
        ]
      : []),
    {
      icon: Shield,
      label: 'Defesa',
      value: (() => {
        const formatted = CharacterUtils.formatValueWithEquipmentBonus(
          characterStats.def - (characterStats.equipment_def_bonus || 0),
          characterStats.equipment_def_bonus || 0
        );
        return formatted.hasBonus ? (
          <span>
            {formatted.formattedTotal}
            <span className="text-orange-400 text-sm ml-1 font-medium">
              {formatted.formattedBonus}
            </span>
          </span>
        ) : (
          <span>{formatted.formattedTotal}</span>
        );
      })(),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo da Defesa:',
        statsBreakdown.def,
        characterStats.equipment_def_bonus || 0,
        characterStats.def
      ),
    },
    {
      icon: Zap,
      label: 'Velocidade',
      value: (() => {
        const formatted = CharacterUtils.formatValueWithEquipmentBonus(
          characterStats.speed - (characterStats.equipment_speed_bonus || 0),
          characterStats.equipment_speed_bonus || 0
        );
        return formatted.hasBonus ? (
          <span>
            {formatted.formattedTotal}
            <span className="text-orange-400 text-sm ml-1 font-medium">
              {formatted.formattedBonus}
            </span>
          </span>
        ) : (
          <span>{formatted.formattedTotal}</span>
        );
      })(),
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/5',
      borderColor: 'border-yellow-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo da Velocidade:',
        statsBreakdown.speed,
        characterStats.equipment_speed_bonus || 0,
        characterStats.speed
      ),
    },
    {
      icon: Star,
      label: 'Chance Crítica',
      value: <span>{characterStats.critical_chance.toFixed(1)}%</span>,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/5',
      borderColor: 'border-yellow-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo da Chance Crítica:',
        statsBreakdown.criticalChance,
        0,
        characterStats.critical_chance
      ),
    },
    {
      icon: Target,
      label: 'Dano Crítico',
      value: <span>{characterStats.critical_damage.toFixed(0)}%</span>,
      color: 'text-orange-400',
      bgColor: 'bg-orange-500/5',
      borderColor: 'border-orange-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo do Dano Crítico:',
        statsBreakdown.criticalDamage,
        0,
        characterStats.critical_damage
      ),
    },
    {
      icon: Sparkles,
      label: 'Bônus Mágico',
      value: <span>{characterStats.magic_damage_bonus?.toFixed(1) || '0.0'}%</span>,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/5',
      borderColor: 'border-purple-500/20',
      tooltipData: createTooltipFromBreakdown(
        'Cálculo do Bônus Mágico:',
        statsBreakdown.magicDamage,
        0,
        characterStats.magic_damage_bonus || 0
      ),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="h-5 w-5" />
          Stats Derivados
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {statsConfig.map((stat, index) => (
            <StatCardWithTooltip
              key={index}
              icon={stat.icon}
              label={stat.label}
              value={stat.value}
              color={stat.color}
              bgColor={stat.bgColor}
              borderColor={stat.borderColor}
              tooltipData={stat.tooltipData}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
