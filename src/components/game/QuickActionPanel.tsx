import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { type ActionType } from '@/resources/game/game-model';
import { type GamePlayer } from '@/resources/game/game-model';
import { type PlayerSpell } from '@/resources/game/models/spell.model';
import { type CharacterConsumable } from '@/resources/game/models/consumable.model';
import { ConsumableService } from '@/resources/game/consumable.service';
import { Sword, Shield, ArrowLeft, Zap, Heart, Sparkles, Flame, Snowflake } from 'lucide-react';

interface QuickActionPanelProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer;
  onPlayerStatsUpdate: (newHp: number, newMana: number) => void;
  onPlayerConsumablesUpdate: (consumables: CharacterConsumable[]) => void;
}

interface PotionSlot {
  id: string;
  consumable_id: string;
  consumable: {
    id: string;
    name: string;
    type: string;
    effect_value: number;
  };
  quantity: number;
}

const getSpellIcon = (spell: PlayerSpell) => {
  switch (spell.effect_type) {
    case 'damage':
      return <Flame className="w-3 h-3" />;
    case 'heal':
      return <Heart className="w-3 h-3" />;
    case 'buff':
      return <Sparkles className="w-3 h-3" />;
    case 'debuff':
      return <Snowflake className="w-3 h-3" />;
    default:
      return <Zap className="w-3 h-3" />;
  }
};

const getSpellColor = (spell: PlayerSpell) => {
  switch (spell.effect_type) {
    case 'damage':
      return 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50';
    case 'heal':
      return 'bg-green-500/20 hover:bg-green-500/30 border-green-500/50';
    case 'buff':
      return 'bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50';
    case 'debuff':
      return 'bg-purple-500/20 hover:bg-purple-500/30 border-purple-500/50';
    default:
      return 'bg-slate-500/20 hover:bg-slate-500/30 border-slate-500/50';
  }
};

export function QuickActionPanel({
  handleAction,
  isPlayerTurn,
  loading,
  player,
  onPlayerStatsUpdate,
  onPlayerConsumablesUpdate,
}: QuickActionPanelProps) {
  const [potionSlots, setPotionSlots] = useState<PotionSlot[]>([]);

  // Top 3 spells para os atalhos 1-3
  const quickSpells = player.spells?.slice(0, 3) || [];

  // REMOVIDO: Captura de teclas de atalho para evitar duplo processamento
  // O CombinedBattleInterface já possui sistema completo de captura de teclas
  // com debounce e proteção contra ações duplicadas
  // O QuickActionPanel serve apenas para interface visual (cliques)

  // Carregar slots de poção
  useEffect(() => {
    const loadPotionSlots = async () => {
      if (!player.consumables) return;

      const slots: PotionSlot[] = player.consumables
        .filter(c => c.consumable?.type === 'potion' && c.quantity > 0)
        .slice(0, 3) // 3 slots para os atalhos Q-W-E
        .map(c => ({
          id: c.id,
          consumable_id: c.consumable_id,
          consumable: {
            id: c.consumable!.id,
            name: c.consumable!.name,
            type: c.consumable!.type,
            effect_value: c.consumable!.effect_value,
          },
          quantity: c.quantity,
        }));

      setPotionSlots(slots);
    };

    loadPotionSlots();
  }, [player.consumables]);

  const handlePotionUse = async (slot: PotionSlot) => {
    if (!isPlayerTurn || loading.performAction || player.potionUsedThisTurn) return;

    try {
      const result = await ConsumableService.consumeItem(player.id, slot.consumable_id, player);

      if (result.success) {
        const healAmount = slot.consumable.effect_value;
        const newHp = Math.min(player.max_hp, player.hp + healAmount);
        const newMana = Math.min(player.max_mana, player.mana);

        onPlayerStatsUpdate(newHp, newMana);

        // Atualizar consumíveis
        const updatedConsumables = player
          .consumables!.map(c =>
            c.consumable_id === slot.consumable_id ? { ...c, quantity: c.quantity - 1 } : c
          )
          .filter(c => c.quantity > 0);

        onPlayerConsumablesUpdate(updatedConsumables);
      }
    } catch (error) {
      console.error('Erro ao usar poção:', error);
    }
  };

  const isActionDisabled = !isPlayerTurn || loading.performAction;

  return (
    <div className="quick-action-panel flex flex-col gap-1 p-2 bg-slate-900/40 rounded-lg border border-slate-700/50 w-16 shadow-lg">
      {/* Ações Principais */}
      <div className="flex flex-col gap-1">
        {/* Attack */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('attack')}
            disabled={isActionDisabled}
            className="quick-action-button w-12 h-12 p-0 bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 transition-all duration-150"
            title="Atacar (A)"
          >
            <Sword className="w-4 h-4" />
          </Button>
          <span className="absolute -top-1 -left-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
            A
          </span>
        </div>

        {/* Defend */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('defend')}
            disabled={isActionDisabled || player.defenseCooldown > 0}
            className={`quick-action-button w-12 h-12 p-0 bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-400 transition-all duration-150 relative ${
              player.defenseCooldown > 0 ? 'opacity-50' : ''
            }`}
            title={`Defender (S)${player.defenseCooldown > 0 ? ` - Cooldown: ${player.defenseCooldown}` : ''}`}
          >
            <Shield className="w-4 h-4" />
            {player.defenseCooldown > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {player.defenseCooldown}
              </span>
            )}
          </Button>
          <span className="absolute -top-1 -left-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
            S
          </span>
        </div>

        {/* Flee */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('flee')}
            disabled={isActionDisabled}
            className="quick-action-button w-12 h-12 p-0 bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-400 transition-all duration-150"
            title="Fugir (D)"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <span className="absolute -top-1 -left-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
            D
          </span>
        </div>
      </div>

      {/* Divisor */}
      <div className="h-px bg-slate-700/50 my-1" />

      {/* Magias Rápidas */}
      <div className="flex flex-col gap-1">
        {quickSpells.map((spell, index) => {
          const canCast = player.mana >= spell.mana_cost && spell.current_cooldown === 0;
          return (
            <div key={spell.id} className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('spell', spell.id)}
                disabled={isActionDisabled || !canCast}
                className={`quick-action-button w-12 h-12 p-0 ${getSpellColor(spell)} relative transition-all duration-150 ${
                  !canCast ? 'opacity-50' : ''
                }`}
                title={`${spell.name} (${1 + index}) - ${spell.mana_cost} Mana${
                  spell.current_cooldown > 0
                    ? ` - Cooldown: ${spell.current_cooldown}`
                    : player.mana < spell.mana_cost
                      ? ' - Mana insuficiente'
                      : ''
                }`}
              >
                {getSpellIcon(spell)}
                {spell.current_cooldown > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {spell.current_cooldown}
                  </span>
                )}
                {/* Indicador de mana */}
                <span
                  className={`absolute -bottom-1 -right-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center ${
                    player.mana >= spell.mana_cost ? 'bg-blue-600' : 'bg-red-600'
                  }`}
                >
                  {spell.mana_cost}
                </span>
              </Button>
              {/* Indicador de tecla */}
              <span className="absolute -top-1 -left-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
                {1 + index}
              </span>
            </div>
          );
        })}
      </div>

      {/* Divisor */}
      {potionSlots.length > 0 && <div className="h-px bg-slate-700/50 my-1" />}

      {/* Poções Rápidas */}
      <div className="flex flex-col gap-1">
        {potionSlots.map((slot, index) => (
          <div key={slot.id} className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePotionUse(slot)}
              disabled={isActionDisabled || player.potionUsedThisTurn}
              className={`quick-action-button w-12 h-12 p-0 bg-green-500/20 hover:bg-green-500/30 border-green-500/50 text-green-400 relative transition-all duration-150 ${
                player.potionUsedThisTurn ? 'opacity-50' : ''
              }`}
              title={`${slot.consumable.name} (${['Q', 'W', 'E'][index]}) - Cura ${slot.consumable.effect_value} HP${
                player.potionUsedThisTurn ? ' - Já usou poção neste turno' : ''
              }`}
            >
              <Heart className="w-4 h-4" />
              <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {slot.quantity}
              </span>
              {player.potionUsedThisTurn && (
                <div className="absolute inset-0 flex items-center justify-center bg-orange-500/30 rounded-lg">
                  <span className="text-orange-400 text-xs font-bold">✗</span>
                </div>
              )}
            </Button>
            {/* Indicador de tecla */}
            <span className="absolute -top-1 -left-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
              {['Q', 'W', 'E'][index]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
