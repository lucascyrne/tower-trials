import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Award, Heart, Brain, Sword, Sparkles, Shield, Zap, Star, Target } from 'lucide-react';
import { type CharacterStats } from '@/models/character.model';
import { StatCardWithTooltip } from './StatCardWithTooltip';

interface DerivedStatsSectionProps {
  characterStats: CharacterStats;
}

export function DerivedStatsSection({ characterStats }: DerivedStatsSectionProps) {
  // ✅ CORREÇÃO: Log para debug de re-renderizações
  console.log('[DerivedStatsSection] Re-renderizando com stats:', {
    strength: characterStats.strength,
    hp: characterStats.max_hp,
    timestamp: Date.now(),
  });
  // =====================================
  // SISTEMA ANTI-MONO-BUILD (EXATO DO CharacterService)
  // =====================================

  const str = characterStats.strength || 10;
  const dex = characterStats.dexterity || 10;
  const int = characterStats.intelligence || 10;
  const wis = characterStats.wisdom || 10;
  const vit = characterStats.vitality || 10;
  const luck = characterStats.luck || 10;
  const level = characterStats.level;

  const totalAttributes = str + dex + int + wis + vit + luck;

  // Calcular diversidade EXATA (0-1, onde 1 = perfeitamente balanceado)
  const attributeDiversity =
    1.0 -
    (Math.abs(str / totalAttributes - 1.0 / 6.0) +
      Math.abs(dex / totalAttributes - 1.0 / 6.0) +
      Math.abs(int / totalAttributes - 1.0 / 6.0) +
      Math.abs(wis / totalAttributes - 1.0 / 6.0) +
      Math.abs(vit / totalAttributes - 1.0 / 6.0) +
      Math.abs(luck / totalAttributes - 1.0 / 6.0)) /
      2.0;

  // Bônus por diversidade (builds balanceadas ganham até 20% de bônus)
  const diversityBonus = 1.0 + attributeDiversity * 0.2;

  // Penalidade para mono-builds EXATA
  let monoPenalty = 1.0;
  const maxAttributePercentage = Math.max(
    str / totalAttributes,
    dex / totalAttributes,
    int / totalAttributes,
    wis / totalAttributes,
    vit / totalAttributes,
    luck / totalAttributes
  );

  if (maxAttributePercentage > 0.8) {
    monoPenalty = 0.7; // Penalidade de 30%
  }

  // =====================================
  // ESCALAMENTO LOGARÍTMICO EXATO
  // =====================================

  const strScaling = Math.pow(str, 1.2) * diversityBonus * monoPenalty;
  const dexScaling = Math.pow(dex, 1.15) * diversityBonus * monoPenalty;
  const intScaling = Math.pow(int, 1.25) * diversityBonus * monoPenalty;
  const wisScaling = Math.pow(wis, 1.1) * diversityBonus * monoPenalty;
  const vitScaling = Math.pow(vit, 1.3) * diversityBonus * monoPenalty;
  const luckScaling = luck * diversityBonus * monoPenalty;

  // Habilidades com bônus de diversidade EXATO
  const swordMastery = characterStats.sword_mastery || 1;
  const axeMastery = characterStats.axe_mastery || 1;
  const bluntMastery = characterStats.blunt_mastery || 1;
  const defenseMastery = characterStats.defense_mastery || 1;
  const magicMastery = characterStats.magic_mastery || 1;

  const weaponMasteryBonus =
    Math.pow(Math.max(swordMastery, axeMastery, bluntMastery), 1.1) * diversityBonus;
  const defMasteryBonus = Math.pow(defenseMastery, 1.2) * diversityBonus;
  const magicMasteryBonus = Math.pow(magicMastery, 1.15) * diversityBonus;

  // =====================================
  // BASES EXATAS
  // =====================================

  const baseHp = 50 + level * 2;
  const baseMana = 20 + level * 1;
  const baseAtk = 2 + level;
  const baseDef = 1 + level;
  const baseSpeed = 3 + level;

  // =====================================
  // CÁLCULOS INDIVIDUAIS EXATOS
  // =====================================

  // HP Components
  const hpFromBase = baseHp;
  const hpFromVitality = Math.floor(vitScaling * 2.5);
  const hpFromStrength = Math.floor(strScaling * 0.3);
  const calculatedTotalHp = hpFromBase + hpFromVitality + hpFromStrength;

  // Mana Components
  const manaFromBase = baseMana;
  const manaFromIntelligence = Math.floor(intScaling * 1.5);
  const manaFromWisdom = Math.floor(wisScaling * 1.0);
  const manaFromMagicMastery = Math.floor(magicMasteryBonus * 0.8);
  const calculatedTotalMana =
    manaFromBase + manaFromIntelligence + manaFromWisdom + manaFromMagicMastery;

  // ATK Components
  const atkFromBase = baseAtk;
  const atkFromStrength = Math.floor(strScaling * 1.2);
  const atkFromWeaponMastery = Math.floor(weaponMasteryBonus * 0.6);
  const atkFromDexterity = Math.floor(dexScaling * 0.2);
  const calculatedTotalAtk =
    atkFromBase + atkFromStrength + atkFromWeaponMastery + atkFromDexterity;

  // Magic ATK Components
  const magicAtkFromBase = baseAtk;
  const magicAtkFromIntelligence = Math.floor(intScaling * 1.4);
  const magicAtkFromWisdom = Math.floor(wisScaling * 0.8);
  const magicAtkFromMagicMastery = Math.floor(magicMasteryBonus * 1.0);
  const calculatedTotalMagicAtk =
    magicAtkFromBase + magicAtkFromIntelligence + magicAtkFromWisdom + magicAtkFromMagicMastery;

  // DEF Components
  const defFromBase = baseDef;
  const defFromVitality = Math.floor(vitScaling * 0.6);
  const defFromWisdom = Math.floor(wisScaling * 0.5);
  const defFromDefenseMastery = Math.floor(defMasteryBonus * 1.0);
  const calculatedTotalDef = defFromBase + defFromVitality + defFromWisdom + defFromDefenseMastery;

  // Speed Components
  const speedFromBase = baseSpeed;
  const speedFromDexterity = Math.floor(dexScaling * 1.0);
  const speedFromLuck = Math.floor(luckScaling * 0.2);
  const calculatedTotalSpeed = speedFromBase + speedFromDexterity + speedFromLuck;

  // Critical Chance Components
  const critChanceFromDexterity = dexScaling * 0.25;
  const critChanceFromLuck = luckScaling * 0.35;
  const critChanceFromStrength = strScaling * 0.1;
  const calculatedCritChance = Math.min(
    75.0,
    critChanceFromDexterity + critChanceFromLuck + critChanceFromStrength
  );

  // Critical Damage Components
  const critDamageBase = 130.0;
  const critDamageFromStrength = strScaling * 0.4;
  const critDamageFromLuck = luckScaling * 0.6;
  const critDamageFromWeaponMastery = weaponMasteryBonus * 0.3;
  const calculatedCritDamage = Math.min(
    250.0,
    critDamageBase + critDamageFromStrength + critDamageFromLuck + critDamageFromWeaponMastery
  );

  // Magic Damage Components
  const magicDamageFromIntelligence = intScaling * 1.2;
  const magicDamageFromWisdom = wisScaling * 0.8;
  const magicDamageFromMagicMastery = magicMasteryBonus * 1.5;
  let rawMagicDamage =
    magicDamageFromIntelligence + magicDamageFromWisdom + magicDamageFromMagicMastery;
  // Diminishing returns
  if (rawMagicDamage > 100) {
    rawMagicDamage = 100 + (rawMagicDamage - 100) * 0.7;
  }
  const calculatedMagicDamage = Math.min(200.0, rawMagicDamage);

  // Função para exibir valor com modificador de equipamentos destacado
  const formatValueWithHighlight = (baseValue: number, equipmentBonus: number | undefined) => {
    const bonus = equipmentBonus || 0;
    const totalValue = baseValue + bonus;

    if (bonus > 0) {
      return (
        <span>
          {totalValue.toLocaleString()}
          <span className="text-orange-400 text-sm ml-1 font-medium">(+{bonus})</span>
        </span>
      );
    }
    return <span>{totalValue.toLocaleString()}</span>;
  };

  // Função para criar dados do tooltip com valores EXATOS
  const createExactTooltipData = (
    title: string,
    components: Array<{ label: string; value: number | string; color: string }>,
    equipmentBonus: number,
    finalTotal: number
  ) => {
    const calculations = [...components];

    // Adicionar informações do sistema anti-mono-build
    calculations.push({
      label: `Diversidade da Build: ${(attributeDiversity * 100).toFixed(1)}%`,
      value: `Bônus: ${((diversityBonus - 1) * 100).toFixed(1)}%`,
      color:
        attributeDiversity > 0.7
          ? 'text-green-400'
          : attributeDiversity > 0.4
            ? 'text-yellow-400'
            : 'text-orange-400',
    });

    if (monoPenalty < 1.0) {
      calculations.push({
        label: 'Penalidade Mono-Build:',
        value: `-${((1 - monoPenalty) * 100).toFixed(0)}%`,
        color: 'text-red-400',
      });
    }

    // Adicionar bônus de equipamento se houver
    if (equipmentBonus > 0) {
      calculations.push({
        label: 'Bônus Equipamentos:',
        value: `+${equipmentBonus}`,
        color: 'text-orange-400',
      });
    }

    return {
      title,
      calculations,
      total: {
        label: 'Total Final (Sistema):',
        value: finalTotal.toLocaleString(),
        color: 'text-green-400',
      },
    };
  };

  const statsConfig = [
    {
      icon: Heart,
      label: 'HP Máximo',
      value: formatValueWithHighlight(
        characterStats.max_hp - (characterStats.equipment_hp_bonus || 0),
        characterStats.equipment_hp_bonus
      ),
      color: 'text-red-400',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/20',
      tooltipData: createExactTooltipData(
        'Cálculo Exato do HP:',
        [
          { label: `Base (50 + 2×${level}):`, value: hpFromBase, color: 'text-blue-400' },
          {
            label: `Vitalidade^1.3 × 2.5:`,
            value: `+${hpFromVitality} (${vit}^1.3)`,
            color: 'text-pink-400',
          },
          {
            label: `Força^1.2 × 0.3:`,
            value: `+${hpFromStrength} (${str}^1.2)`,
            color: 'text-red-400',
          },
          { label: `Subtotal Calculado:`, value: calculatedTotalHp, color: 'text-gray-300' },
        ],
        characterStats.equipment_hp_bonus || 0,
        characterStats.max_hp
      ),
    },
    {
      icon: Brain,
      label: 'Mana Máxima',
      value: formatValueWithHighlight(
        characterStats.max_mana - (characterStats.equipment_mana_bonus || 0),
        characterStats.equipment_mana_bonus
      ),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/20',
      tooltipData: createExactTooltipData(
        'Cálculo Exato da Mana:',
        [
          { label: `Base (20 + 1×${level}):`, value: manaFromBase, color: 'text-blue-400' },
          {
            label: `Inteligência^1.25 × 1.5:`,
            value: `+${manaFromIntelligence} (${int}^1.25)`,
            color: 'text-purple-400',
          },
          {
            label: `Sabedoria^1.1 × 1.0:`,
            value: `+${manaFromWisdom} (${wis}^1.1)`,
            color: 'text-blue-300',
          },
          {
            label: `Maestria Mágica^1.15 × 0.8:`,
            value: `+${manaFromMagicMastery} (${magicMastery}^1.15)`,
            color: 'text-cyan-400',
          },
          { label: `Subtotal Calculado:`, value: calculatedTotalMana, color: 'text-gray-300' },
        ],
        characterStats.equipment_mana_bonus || 0,
        characterStats.max_mana
      ),
    },
    {
      icon: Sword,
      label: 'ATK Físico',
      value: formatValueWithHighlight(
        characterStats.atk - (characterStats.equipment_atk_bonus || 0),
        characterStats.equipment_atk_bonus
      ),
      color: 'text-red-400',
      bgColor: 'bg-red-500/5',
      borderColor: 'border-red-500/20',
      tooltipData: createExactTooltipData(
        'Cálculo Exato do ATK Físico:',
        [
          { label: `Base (2 + ${level}):`, value: atkFromBase, color: 'text-blue-400' },
          {
            label: `Força^1.2 × 1.2:`,
            value: `+${atkFromStrength} (${str}^1.2)`,
            color: 'text-red-400',
          },
          {
            label: `Maior Maestria^1.1 × 0.6:`,
            value: `+${atkFromWeaponMastery} (${Math.max(swordMastery, axeMastery, bluntMastery)}^1.1)`,
            color: 'text-orange-400',
          },
          {
            label: `Destreza^1.15 × 0.2:`,
            value: `+${atkFromDexterity} (${dex}^1.15)`,
            color: 'text-green-400',
          },
          { label: `Subtotal Calculado:`, value: calculatedTotalAtk, color: 'text-gray-300' },
        ],
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
            tooltipData: createExactTooltipData(
              'Cálculo Exato do ATK Mágico:',
              [
                { label: `Base (2 + ${level}):`, value: magicAtkFromBase, color: 'text-blue-400' },
                {
                  label: `Inteligência^1.25 × 1.4:`,
                  value: `+${magicAtkFromIntelligence} (${int}^1.25)`,
                  color: 'text-purple-400',
                },
                {
                  label: `Sabedoria^1.1 × 0.8:`,
                  value: `+${magicAtkFromWisdom} (${wis}^1.1)`,
                  color: 'text-blue-300',
                },
                {
                  label: `Maestria Mágica^1.15 × 1.0:`,
                  value: `+${magicAtkFromMagicMastery} (${magicMastery}^1.15)`,
                  color: 'text-cyan-400',
                },
                {
                  label: `Subtotal Calculado:`,
                  value: calculatedTotalMagicAtk,
                  color: 'text-gray-300',
                },
              ],
              0,
              characterStats.magic_attack
            ),
          },
        ]
      : []),
    {
      icon: Shield,
      label: 'Defesa',
      value: formatValueWithHighlight(
        characterStats.def - (characterStats.equipment_def_bonus || 0),
        characterStats.equipment_def_bonus
      ),
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/5',
      borderColor: 'border-blue-500/20',
      tooltipData: createExactTooltipData(
        'Cálculo Exato da Defesa:',
        [
          { label: `Base (1 + ${level}):`, value: defFromBase, color: 'text-blue-400' },
          {
            label: `Vitalidade^1.3 × 0.6:`,
            value: `+${defFromVitality} (${vit}^1.3)`,
            color: 'text-pink-400',
          },
          {
            label: `Sabedoria^1.1 × 0.5:`,
            value: `+${defFromWisdom} (${wis}^1.1)`,
            color: 'text-blue-300',
          },
          {
            label: `Maestria Defesa^1.2 × 1.0:`,
            value: `+${defFromDefenseMastery} (${defenseMastery}^1.2)`,
            color: 'text-cyan-400',
          },
          { label: `Subtotal Calculado:`, value: calculatedTotalDef, color: 'text-gray-300' },
        ],
        characterStats.equipment_def_bonus || 0,
        characterStats.def
      ),
    },
    {
      icon: Zap,
      label: 'Velocidade',
      value: formatValueWithHighlight(
        characterStats.speed - (characterStats.equipment_speed_bonus || 0),
        characterStats.equipment_speed_bonus
      ),
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/5',
      borderColor: 'border-yellow-500/20',
      tooltipData: createExactTooltipData(
        'Cálculo Exato da Velocidade:',
        [
          { label: `Base (3 + ${level}):`, value: speedFromBase, color: 'text-blue-400' },
          {
            label: `Destreza^1.15 × 1.0:`,
            value: `+${speedFromDexterity} (${dex}^1.15)`,
            color: 'text-green-400',
          },
          { label: `Sorte × 0.2:`, value: `+${speedFromLuck} (${luck})`, color: 'text-yellow-300' },
          { label: `Subtotal Calculado:`, value: calculatedTotalSpeed, color: 'text-gray-300' },
        ],
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
      tooltipData: createExactTooltipData(
        'Cálculo Exato da Chance Crítica:',
        [
          {
            label: `Destreza^1.15 × 0.25:`,
            value: `${critChanceFromDexterity.toFixed(1)}% (${dex}^1.15)`,
            color: 'text-green-400',
          },
          {
            label: `Sorte × 0.35:`,
            value: `+${critChanceFromLuck.toFixed(1)}% (${luck})`,
            color: 'text-yellow-300',
          },
          {
            label: `Força^1.2 × 0.1:`,
            value: `+${critChanceFromStrength.toFixed(1)}% (${str}^1.2)`,
            color: 'text-red-400',
          },
          { label: `Cap Máximo: 75%`, value: '', color: 'text-orange-400' },
          {
            label: `Valor Calculado:`,
            value: `${calculatedCritChance.toFixed(1)}%`,
            color: 'text-gray-300',
          },
        ],
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
      tooltipData: createExactTooltipData(
        'Cálculo Exato do Dano Crítico:',
        [
          { label: `Base:`, value: `${critDamageBase}%`, color: 'text-blue-400' },
          {
            label: `Força^1.2 × 0.4:`,
            value: `+${critDamageFromStrength.toFixed(1)}% (${str}^1.2)`,
            color: 'text-red-400',
          },
          {
            label: `Sorte × 0.6:`,
            value: `+${critDamageFromLuck.toFixed(1)}% (${luck})`,
            color: 'text-yellow-300',
          },
          {
            label: `Maior Maestria^1.1 × 0.3:`,
            value: `+${critDamageFromWeaponMastery.toFixed(1)}% (${Math.max(swordMastery, axeMastery, bluntMastery)}^1.1)`,
            color: 'text-orange-400',
          },
          { label: `Cap Máximo: 250%`, value: '', color: 'text-orange-400' },
          {
            label: `Valor Calculado:`,
            value: `${calculatedCritDamage.toFixed(0)}%`,
            color: 'text-gray-300',
          },
        ],
        0,
        characterStats.critical_damage
      ),
    },
    {
      icon: Sparkles,
      label: 'Bônus Mágico',
      value: <span>+{Math.round(characterStats.magic_damage_bonus)}%</span>,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/5',
      borderColor: 'border-purple-500/20',
      tooltipData: createExactTooltipData(
        'Cálculo Exato do Bônus Mágico:',
        [
          {
            label: `Inteligência^1.25 × 1.2:`,
            value: `${magicDamageFromIntelligence.toFixed(1)}% (${int}^1.25)`,
            color: 'text-purple-400',
          },
          {
            label: `Sabedoria^1.1 × 0.8:`,
            value: `+${magicDamageFromWisdom.toFixed(1)}% (${wis}^1.1)`,
            color: 'text-blue-300',
          },
          {
            label: `Maestria Mágica^1.15 × 1.5:`,
            value: `+${magicDamageFromMagicMastery.toFixed(1)}% (${magicMastery}^1.15)`,
            color: 'text-cyan-400',
          },
          { label: `Diminishing Returns após 100%`, value: '', color: 'text-orange-400' },
          { label: `Cap Máximo: 200%`, value: '', color: 'text-orange-400' },
          {
            label: `Valor Calculado:`,
            value: `${calculatedMagicDamage.toFixed(1)}%`,
            color: 'text-gray-300',
          },
        ],
        0,
        characterStats.magic_damage_bonus
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
      <CardContent className="space-y-4 overflow-visible">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-visible">
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

        {/* Análise da Build */}
        <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
          <h4 className="text-sm font-medium text-slate-200 mb-2">Análise da Build:</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-400">Diversidade:</span>
              <span
                className={`ml-2 ${attributeDiversity > 0.7 ? 'text-green-400' : attributeDiversity > 0.4 ? 'text-yellow-400' : 'text-orange-400'}`}
              >
                {(attributeDiversity * 100).toFixed(1)}%
              </span>
            </div>
            <div>
              <span className="text-slate-400">Bônus:</span>
              <span className="ml-2 text-green-400">
                +{((diversityBonus - 1) * 100).toFixed(1)}%
              </span>
            </div>
            {monoPenalty < 1.0 && (
              <>
                <div>
                  <span className="text-slate-400">Mono-Build:</span>
                  <span className="ml-2 text-red-400">
                    -{((1 - monoPenalty) * 100).toFixed(0)}%
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Dominante:</span>
                  <span className="ml-2 text-yellow-400">
                    {(maxAttributePercentage * 100).toFixed(0)}%
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
