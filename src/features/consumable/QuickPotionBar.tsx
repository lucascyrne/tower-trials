import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Heart, Zap, Loader2 } from 'lucide-react';
import { type Character } from '@/resources/character/character.model';
import { type PotionSlot } from '@/resources/equipment/slot.service';
import { SlotService } from '@/resources/equipment/slot.service';
import { isHealthPotion, isManaPotion } from '@/utils/consumable-utils';

interface QuickPotionBarProps {
  character: Character;
  potionSlots: PotionSlot[];
  onPotionUsed: () => void;
}

export function QuickPotionBar({ character, potionSlots, onPotionUsed }: QuickPotionBarProps) {
  const [isUsing, setIsUsing] = useState<number | null>(null);

  console.log('[QuickPotionBar] Renderizando com slots:', {
    characterId: character.id,
    totalSlots: potionSlots.length,
    slotsWithPotions: potionSlots.filter(s => s.consumable_id && s.available_quantity > 0).length,
    slotsData: potionSlots.map(s => ({
      position: s.slot_position,
      id: s.consumable_id,
      name: s.consumable_name,
      type: s.consumable_type,
      quantity: s.available_quantity,
    })),
  });

  // ✅ CORREÇÃO: Filtrar slots que têm poções disponíveis
  const slotsWithPotions = potionSlots.filter(
    slot => slot.consumable_id && slot.available_quantity > 0 && slot.consumable_type === 'potion'
  );

  // ✅ CORREÇÃO: Filtrar por tipo de poção usando os dados do slot
  const healthPotionSlots = slotsWithPotions.filter(slot => {
    if (!slot.consumable_name || !slot.consumable_description) return false;

    // Criar objeto temporário para usar as funções utilitárias
    const tempConsumable = {
      id: slot.consumable_id!,
      name: slot.consumable_name,
      description: slot.consumable_description,
      type: slot.consumable_type as 'potion',
      effect_value: slot.effect_value || 0,
      price: slot.consumable_price || 0,
      level_requirement: 1,
      created_at: '',
      updated_at: '',
    };

    return isHealthPotion(tempConsumable);
  });

  const manaPotionSlots = slotsWithPotions.filter(slot => {
    if (!slot.consumable_name || !slot.consumable_description) return false;

    // Criar objeto temporário para usar as funções utilitárias
    const tempConsumable = {
      id: slot.consumable_id!,
      name: slot.consumable_name,
      description: slot.consumable_description,
      type: slot.consumable_type as 'potion',
      effect_value: slot.effect_value || 0,
      price: slot.consumable_price || 0,
      level_requirement: 1,
      created_at: '',
      updated_at: '',
    };

    return isManaPotion(tempConsumable);
  });

  console.log('[QuickPotionBar] Slots de poções filtrados:', {
    healthPotionSlots: healthPotionSlots.length,
    healthSlots: healthPotionSlots.map(s => ({ pos: s.slot_position, name: s.consumable_name })),
    manaPotionSlots: manaPotionSlots.length,
    manaSlots: manaPotionSlots.map(s => ({ pos: s.slot_position, name: s.consumable_name })),
  });

  // ✅ CORREÇÃO: Selecionar o melhor slot por tipo (menor slot position com maior effect_value)
  const bestHealthSlot =
    healthPotionSlots.length > 0
      ? healthPotionSlots.reduce((best, current) => {
          if (!current.effect_value || current.available_quantity <= 0) return best;
          if (!best.effect_value || best.available_quantity <= 0) return current;

          // Priorizar por effect_value, depois por slot position menor
          if (current.effect_value > best.effect_value) return current;
          if (
            current.effect_value === best.effect_value &&
            current.slot_position < best.slot_position
          )
            return current;
          return best;
        })
      : null;

  const bestManaSlot =
    manaPotionSlots.length > 0
      ? manaPotionSlots.reduce((best, current) => {
          if (!current.effect_value || current.available_quantity <= 0) return best;
          if (!best.effect_value || best.available_quantity <= 0) return current;

          // Priorizar por effect_value, depois por slot position menor
          if (current.effect_value > best.effect_value) return current;
          if (
            current.effect_value === best.effect_value &&
            current.slot_position < best.slot_position
          )
            return current;
          return best;
        })
      : null;

  console.log('[QuickPotionBar] Melhores slots selecionados:', {
    bestHealthSlot: bestHealthSlot
      ? {
          position: bestHealthSlot.slot_position,
          name: bestHealthSlot.consumable_name,
          quantity: bestHealthSlot.available_quantity,
          effectValue: bestHealthSlot.effect_value,
        }
      : null,
    bestManaSlot: bestManaSlot
      ? {
          position: bestManaSlot.slot_position,
          name: bestManaSlot.consumable_name,
          quantity: bestManaSlot.available_quantity,
          effectValue: bestManaSlot.effect_value,
        }
      : null,
  });

  const handleUseSlot = async (slot: PotionSlot) => {
    if (!slot.consumable_id || isUsing !== null) return;

    // Garantir que os valores são números válidos
    const currentHp = Math.floor(Number(character.hp) || 0);
    const maxHp = Math.floor(Number(character.max_hp) || 1);
    const currentMana = Math.floor(Number(character.mana) || 0);
    const maxMana = Math.floor(Number(character.max_mana) || 1);

    // Verificar se realmente precisa da poção
    const isHealthSlot = bestHealthSlot?.slot_position === slot.slot_position;
    const isManaSlot = bestManaSlot?.slot_position === slot.slot_position;

    if (isHealthSlot && currentHp >= maxHp) {
      toast.info('HP já está no máximo!');
      return;
    }

    if (isManaSlot && currentMana >= maxMana) {
      toast.info('Mana já está no máximo!');
      return;
    }

    // Verificar se tem quantidade suficiente
    if (slot.available_quantity <= 0) {
      toast.error('Slot vazio!', {
        description: 'Este slot não possui poções disponíveis',
      });
      onPotionUsed(); // Atualizar para sincronizar
      return;
    }

    console.log('[QuickPotionBar] Usando slot:', {
      slotPosition: slot.slot_position,
      consumableId: slot.consumable_id,
      consumableName: slot.consumable_name,
      characterId: character.id,
      currentHp: character.hp,
      maxHp: character.max_hp,
      currentMana: character.mana,
      maxMana: character.max_mana,
      availableQuantity: slot.available_quantity,
    });

    setIsUsing(slot.slot_position);

    try {
      const result = await SlotService.consumePotionFromSlot(character.id, slot.slot_position);

      console.log('[QuickPotionBar] Resultado do uso do slot:', result);

      if (result.success && result.data) {
        toast.success(result.data.message);

        // ✅ CRÍTICO: Forçar atualização imediata dos slots
        console.log('[QuickPotionBar] Forçando atualização dos slots após uso bem-sucedido');
        onPotionUsed();
      } else {
        console.error('[QuickPotionBar] Erro no serviço de slot:', result.error);
        toast.error('Erro ao usar poção', {
          description: result.error,
        });

        // Atualizar mesmo em caso de erro para garantir sincronização
        onPotionUsed();
      }
    } catch (error) {
      console.error('[QuickPotionBar] Erro no catch:', error);
      toast.error('Erro ao usar poção');

      // Forçar atualização mesmo em caso de erro crítico
      onPotionUsed();
    } finally {
      setIsUsing(null);
    }
  };

  const formatSlotInfo = (slot: PotionSlot) => {
    if (!slot.consumable_name || !slot.effect_value) return '';
    return `${slot.consumable_name} (+${slot.effect_value})`;
  };

  const getHealthPercent = () => {
    const hp = Math.floor(Number(character.hp) || 0);
    const maxHp = Math.floor(Number(character.max_hp) || 1);
    return (hp / maxHp) * 100;
  };

  const getManaPercent = () => {
    const mana = Math.floor(Number(character.mana) || 0);
    const maxMana = Math.floor(Number(character.max_mana) || 1);
    return (mana / maxMana) * 100;
  };

  const isHealthAtMax = () => {
    const hp = Math.floor(Number(character.hp) || 0);
    const maxHp = Math.floor(Number(character.max_hp) || 1);
    return hp >= maxHp;
  };

  const isManaAtMax = () => {
    const mana = Math.floor(Number(character.mana) || 0);
    const maxMana = Math.floor(Number(character.max_mana) || 1);
    return mana >= maxMana;
  };

  return (
    <Card className="bg-slate-900/50 border-slate-700">
      <CardContent className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-medium text-slate-200">Acesso Rápido</h4>
          <div className="text-xs text-slate-400">Q / W</div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Poção de Vida */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Heart className="h-3 w-3" />
              <span>
                HP: {Math.floor(Number(character.hp) || 0)}/
                {Math.floor(Number(character.max_hp) || 1)}
              </span>
            </div>
            <div className="bg-slate-800 rounded-sm h-1.5">
              <div
                className="bg-red-500 h-full rounded-sm transition-all duration-300"
                style={{ width: `${getHealthPercent()}%` }}
              />
            </div>
            {bestHealthSlot ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUseSlot(bestHealthSlot)}
                disabled={isUsing === bestHealthSlot.slot_position || isHealthAtMax()}
                className="w-full h-8 text-xs bg-red-900/20 border-red-600/30 hover:bg-red-800/30 text-red-200"
              >
                {isUsing === bestHealthSlot.slot_position ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Heart className="h-3 w-3 mr-1" />
                    <Badge variant="secondary" className="text-xs px-1 bg-red-700/30">
                      {bestHealthSlot.available_quantity}
                    </Badge>
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full h-8 text-xs opacity-50"
              >
                <Heart className="h-3 w-3 mr-1" />
                Sem slots
              </Button>
            )}
            {bestHealthSlot && (
              <div
                className="text-xs text-slate-400 text-center truncate"
                title={formatSlotInfo(bestHealthSlot)}
              >
                +{bestHealthSlot.effect_value} HP
              </div>
            )}
          </div>

          {/* Poção de Mana */}
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Zap className="h-3 w-3" />
              <span>
                MP: {Math.floor(Number(character.mana) || 0)}/
                {Math.floor(Number(character.max_mana) || 1)}
              </span>
            </div>
            <div className="bg-slate-800 rounded-sm h-1.5">
              <div
                className="bg-blue-500 h-full rounded-sm transition-all duration-300"
                style={{ width: `${getManaPercent()}%` }}
              />
            </div>
            {bestManaSlot ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUseSlot(bestManaSlot)}
                disabled={isUsing === bestManaSlot.slot_position || isManaAtMax()}
                className="w-full h-8 text-xs bg-blue-900/20 border-blue-600/30 hover:bg-blue-800/30 text-blue-200"
              >
                {isUsing === bestManaSlot.slot_position ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    <Badge variant="secondary" className="text-xs px-1 bg-blue-700/30">
                      {bestManaSlot.available_quantity}
                    </Badge>
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full h-8 text-xs opacity-50"
              >
                <Zap className="h-3 w-3 mr-1" />
                Sem slots
              </Button>
            )}
            {bestManaSlot && (
              <div
                className="text-xs text-slate-400 text-center truncate"
                title={formatSlotInfo(bestManaSlot)}
              >
                +{bestManaSlot.effect_value} MP
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
