import { Button } from '@/components/ui/button';
import { type ActionType } from '@/resources/game/game.model';
import { type GamePlayer } from '@/resources/game/game.model';
import { type PlayerSpell } from '@/resources/spell/spell.model';
import { ConsumableImage } from '@/components/ui/consumable-image';
import { type ConsumableType } from '@/resources/consumable/consumable.model';
import {
  Sword,
  Shield,
  ArrowLeft,
  Zap,
  Heart,
  Sparkles,
  Flame,
  Snowflake,
  Plus,
} from 'lucide-react';
import type { PotionSlot } from '@/resources/equipment/slot.service';

interface QuickActionPanelProps {
  handleAction: (action: ActionType, spellId?: string) => Promise<void>;
  isPlayerTurn: boolean;
  loading: { performAction: boolean };
  player: GamePlayer | null; // CORRIGIDO: Player pode ser null durante inicialização
  potionSlots: PotionSlot[];
  loadingPotionSlots: boolean;
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

const getPotionKeyBinding = (position: number) => {
  switch (position) {
    case 1:
      return 'Q';
    case 2:
      return 'W';
    case 3:
      return 'E';
    default:
      return '';
  }
};

export function QuickActionPanel({
  handleAction,
  isPlayerTurn,
  loading,
  player,
  potionSlots,
  loadingPotionSlots,
}: QuickActionPanelProps) {
  // ✅ PROTEÇÃO: Verificar se player existe antes de acessar propriedades
  if (!player) {
    return (
      <div className="quick-action-panel flex flex-col gap-1 p-2 bg-slate-900/40 rounded-lg border border-slate-700/50 w-16 shadow-lg">
        <div className="w-12 h-12 bg-muted/20 rounded-lg animate-pulse" />
        <div className="w-12 h-12 bg-muted/20 rounded-lg animate-pulse" />
        <div className="w-12 h-12 bg-muted/20 rounded-lg animate-pulse" />
      </div>
    );
  }

  // Top 3 spells para os atalhos 1-3
  const quickSpells = player.spells?.slice(0, 3) || [];

  // SIMPLIFICADO: Este componente é apenas para interface visual (cliques)
  // Toda a lógica de atalhos de teclado fica no CombinedBattleInterface
  // Os dados dos slots vêm via props do componente pai (game-battle.tsx)

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
            className="quick-action-button w-12 h-12 p-0 bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-400 transition-all duration-150 cursor-pointer"
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
            disabled={isActionDisabled || (player?.defenseCooldown || 0) > 0}
            className={`quick-action-button w-12 h-12 p-0 bg-blue-500/20 hover:bg-blue-500/30 border-blue-500/50 text-blue-400 transition-all duration-150 relative cursor-pointer ${
              (player?.defenseCooldown || 0) > 0 ? 'opacity-50' : ''
            }`}
            title={`Defender (S)${(player?.defenseCooldown || 0) > 0 ? ` - Cooldown: ${player?.defenseCooldown}` : ''}`}
          >
            <Shield className="w-4 h-4" />
            {(player?.defenseCooldown || 0) > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                {player?.defenseCooldown}
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
            className="quick-action-button w-12 h-12 p-0 bg-yellow-500/20 hover:bg-yellow-500/30 border-yellow-500/50 text-yellow-400 transition-all duration-150 cursor-pointer"
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
          const canCast = (player?.mana || 0) >= spell.mana_cost && spell.current_cooldown === 0;
          return (
            <div key={spell.id} className="relative">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('spell', spell.id)}
                disabled={isActionDisabled || !canCast}
                className={`quick-action-button w-12 h-12 p-0 ${getSpellColor(spell)} relative transition-all duration-150 cursor-pointer ${
                  !canCast ? 'opacity-50' : ''
                }`}
                title={`${spell.name} (${1 + index}) - ${spell.mana_cost} Mana${
                  spell.current_cooldown > 0
                    ? ` - Cooldown: ${spell.current_cooldown}`
                    : (player?.mana || 0) < spell.mana_cost
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
                    (player?.mana || 0) >= spell.mana_cost ? 'bg-blue-600' : 'bg-red-600'
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
        {loadingPotionSlots
          ? [1, 2, 3].map(i => (
              <div key={i} className="w-12 h-12 bg-muted/20 rounded-lg animate-pulse" />
            ))
          : potionSlots.map(slot => {
              const isEmpty = !slot.consumable_id;
              const keyBinding = getPotionKeyBinding(slot.slot_position);

              // Usar dados diretos do slot
              const availableQuantity = slot.available_quantity;
              const isOutOfStock = !isEmpty && availableQuantity === 0;

              return (
                <div key={`slot-${slot.slot_position}`} className="relative">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleAction('consumable', slot.consumable_id || undefined)}
                    disabled={
                      isActionDisabled || player?.potionUsedThisTurn || isEmpty || isOutOfStock
                    }
                    className={`quick-action-button w-12 h-12 p-2 relative transition-all duration-150 cursor-pointer ${
                      isEmpty
                        ? 'border-dashed border-muted-foreground/20 bg-transparent hover:bg-muted/10'
                        : isOutOfStock
                          ? 'border-red-500/30 bg-red-500/5 opacity-50'
                          : player.potionUsedThisTurn
                            ? 'border-orange-500/30 bg-orange-500/5 opacity-50'
                            : 'border-green-500/30 bg-green-500/20 hover:bg-green-500/30 text-green-400'
                    }`}
                    title={
                      isEmpty
                        ? `Slot ${keyBinding} - Vazio`
                        : isOutOfStock
                          ? `${slot.consumable_name} - Sem unidades`
                          : `${slot.consumable_name} (${keyBinding}) - ${slot.effect_value} HP${
                              player?.potionUsedThisTurn ? ' - Já usou poção neste turno' : ''
                            }`
                    }
                  >
                    {isEmpty ? (
                      <Plus className="w-4 h-4 text-muted-foreground/40" />
                    ) : slot.consumable_id ? (
                      <ConsumableImage
                        consumable={{
                          id: slot.consumable_id,
                          name: slot.consumable_name || 'Poção',
                          description: slot.consumable_description || '',
                          type: (slot.consumable_type as ConsumableType) || 'potion',
                          effect_value: slot.effect_value || 0,
                          price: slot.consumable_price || 0,
                          level_requirement: 1,
                          created_at: '',
                          updated_at: '',
                        }}
                        size="lg"
                        className="w-4 h-4"
                        showFallback={true}
                      />
                    ) : null}

                    {(player?.potionUsedThisTurn || isOutOfStock) && !isEmpty && (
                      <div className="absolute inset-0 flex items-center justify-center bg-orange-500/30 rounded-lg">
                        <span className="text-orange-400 text-xs font-bold">✗</span>
                      </div>
                    )}
                  </Button>

                  {/* Indicador de quantidade */}
                  {!isEmpty && (
                    <span
                      className={`absolute -bottom-1 -left-1 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-background ${
                        isOutOfStock ? 'bg-red-500/90' : 'bg-slate-800'
                      }`}
                    >
                      {availableQuantity}
                    </span>
                  )}

                  {/* Indicador de tecla */}
                  <span className="absolute -top-1 -left-1 bg-slate-800 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center border border-slate-600">
                    {keyBinding}
                  </span>
                </div>
              );
            })}
      </div>
    </div>
  );
}
