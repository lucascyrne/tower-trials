import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Heart, Zap, Loader2 } from 'lucide-react';
import { type CharacterConsumable } from '@/resources/game/consumable.model';
import { type Character } from '@/resources/game/character.model';
import { ConsumableService } from '@/resources/game/consumable.service';
import { formatConsumableEffect } from '@/utils/consumable-utils';

interface QuickPotionBarProps {
  character: Character;
  consumables: CharacterConsumable[];
  onConsumableUsed: () => void;
}

export function QuickPotionBar({ character, consumables, onConsumableUsed }: QuickPotionBarProps) {
  const [isUsing, setIsUsing] = useState<string | null>(null);

  console.log('[QuickPotionBar] Renderizando com:', {
    characterId: character.id,
    totalConsumables: consumables.length,
    consumablesWithQuantity: consumables.filter(c => c.quantity > 0).length,
  });

  // Filtrar poções de vida e mana
  const healthPotions = consumables.filter(
    c =>
      c.consumable &&
      c.consumable.type === 'potion' &&
      (c.consumable.description.includes('HP') || c.consumable.description.includes('Vida')) &&
      c.quantity > 0
  );

  const manaPotions = consumables.filter(
    c =>
      c.consumable &&
      c.consumable.type === 'potion' &&
      c.consumable.description.includes('Mana') &&
      c.quantity > 0
  );

  console.log('[QuickPotionBar] Poções filtradas:', {
    healthPotions: healthPotions.length,
    healthPotionNames: healthPotions.map(p => p.consumable?.name),
    manaPotions: manaPotions.length,
    manaPotionNames: manaPotions.map(p => p.consumable?.name),
  });

  // Pegar a melhor poção disponível (maior effect_value)
  const bestHealthPotion =
    healthPotions.length > 0
      ? healthPotions.reduce((best, current) => {
          if (!best?.consumable || !current?.consumable) return current;
          return current.consumable.effect_value > best.consumable.effect_value ? current : best;
        })
      : null;

  const bestManaPotion =
    manaPotions.length > 0
      ? manaPotions.reduce((best, current) => {
          if (!best?.consumable || !current?.consumable) return current;
          return current.consumable.effect_value > best.consumable.effect_value ? current : best;
        })
      : null;

  console.log('[QuickPotionBar] Melhores poções selecionadas:', {
    bestHealthPotion: bestHealthPotion
      ? {
          name: bestHealthPotion.consumable?.name,
          quantity: bestHealthPotion.quantity,
          effectValue: bestHealthPotion.consumable?.effect_value,
        }
      : null,
    bestManaPotion: bestManaPotion
      ? {
          name: bestManaPotion.consumable?.name,
          quantity: bestManaPotion.quantity,
          effectValue: bestManaPotion.consumable?.effect_value,
        }
      : null,
  });

  const handleUsePotion = async (consumable: CharacterConsumable, type: 'health' | 'mana') => {
    if (!consumable?.consumable || isUsing) return;

    // Garantir que os valores são números válidos
    const currentHp = Math.floor(Number(character.hp) || 0);
    const maxHp = Math.floor(Number(character.max_hp) || 1);
    const currentMana = Math.floor(Number(character.mana) || 0);
    const maxMana = Math.floor(Number(character.max_mana) || 1);

    // Verificar se realmente precisa da poção
    if (type === 'health' && currentHp >= maxHp) {
      toast.info('HP já está no máximo!');
      return;
    }

    if (type === 'mana' && currentMana >= maxMana) {
      toast.info('Mana já está no máximo!');
      return;
    }

    console.log('[QuickPotionBar] Tentando usar poção:', {
      consumableId: consumable.consumable_id,
      consumableName: consumable.consumable.name,
      characterId: character.id,
      currentHp: character.hp,
      maxHp: character.max_hp,
      currentMana: character.mana,
      maxMana: character.max_mana,
      type,
    });

    setIsUsing(consumable.consumable_id);

    try {
      const result = await ConsumableService.consumeItem(
        character.id,
        consumable.consumable_id,
        character
      );

      console.log('[QuickPotionBar] Resultado do uso:', result);

      if (result.success && result.data) {
        toast.success(result.data.message);
        onConsumableUsed();
      } else {
        console.error('[QuickPotionBar] Erro no serviço:', result.error);
        toast.error('Erro ao usar poção', {
          description: result.error,
        });
      }
    } catch (error) {
      console.error('[QuickPotionBar] Erro no catch:', error);
      toast.error('Erro ao usar poção');
    } finally {
      setIsUsing(null);
    }
  };

  const formatPotionInfo = (consumable: CharacterConsumable) => {
    if (!consumable.consumable) return '';
    return `${consumable.consumable.name} (${formatConsumableEffect(consumable.consumable)})`;
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
            {bestHealthPotion ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUsePotion(bestHealthPotion, 'health')}
                disabled={isUsing === bestHealthPotion.consumable_id || isHealthAtMax()}
                className="w-full h-8 text-xs bg-red-900/20 border-red-600/30 hover:bg-red-800/30 text-red-200"
              >
                {isUsing === bestHealthPotion.consumable_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Heart className="h-3 w-3 mr-1" />
                    <Badge variant="secondary" className="text-xs px-1 bg-red-700/30">
                      {bestHealthPotion.quantity}
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
                Sem poções
              </Button>
            )}
            {bestHealthPotion && (
              <div
                className="text-xs text-slate-400 text-center truncate"
                title={formatPotionInfo(bestHealthPotion)}
              >
                {formatConsumableEffect(bestHealthPotion.consumable!)}
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
            {bestManaPotion ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleUsePotion(bestManaPotion, 'mana')}
                disabled={isUsing === bestManaPotion.consumable_id || isManaAtMax()}
                className="w-full h-8 text-xs bg-blue-900/20 border-blue-600/30 hover:bg-blue-800/30 text-blue-200"
              >
                {isUsing === bestManaPotion.consumable_id ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-3 w-3 mr-1" />
                    <Badge variant="secondary" className="text-xs px-1 bg-blue-700/30">
                      {bestManaPotion.quantity}
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
                Sem poções
              </Button>
            )}
            {bestManaPotion && (
              <div
                className="text-xs text-slate-400 text-center truncate"
                title={formatPotionInfo(bestManaPotion)}
              >
                {formatConsumableEffect(bestManaPotion.consumable!)}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
