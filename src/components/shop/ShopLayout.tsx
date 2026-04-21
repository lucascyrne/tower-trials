import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Sword, 
  Shield, 
  Gem, 
  Coins, 
  Package, 
  Sparkles,
  Zap,
  Star,
  Filter,
  ShoppingCart,
  ShoppingBag
} from 'lucide-react';
import { Equipment } from '@/resources/game/models/equipment.model';
import { Consumable } from '@/resources/game/models/consumable.model';
import { Character } from '@/resources/game/models/character.model';
import { EquipmentComparison } from '@/components/equipment/EquipmentComparison';
import { cn } from '@/lib/utils';

interface ShopLayoutProps {
  character: Character;
  availableEquipment: Equipment[];
  availableConsumables: Consumable[];
  onEquipmentPurchase: (equipment: Equipment) => void;
  onConsumablePurchase: (consumable: Consumable, quantity: number) => void;
  onOpenInventory: () => void;
}

type ShopCategory = 'equipment' | 'consumables';
type EquipmentFilter = 'all' | 'weapon' | 'armor' | 'accessory';
type ConsumableFilter = 'all' | 'potion' | 'antidote' | 'buff';

const rarityToBadgeVariant: Record<string, string> = {
  common: 'bg-muted text-muted-foreground border-border',
  uncommon: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  rare: 'bg-sky-500/15 text-sky-300 border-sky-400/30',
  epic: 'bg-violet-500/15 text-violet-300 border-violet-400/30',
  legendary: 'bg-amber-500/15 text-amber-300 border-amber-400/30',
};

function RequirementRow({ label, value, isValid }: { label: string; value: React.ReactNode; isValid: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/35 px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn('text-sm font-medium', isValid ? 'text-emerald-400' : 'text-destructive')}>
        {value}
      </span>
    </div>
  );
}

function StatPill({
  icon,
  value,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  tone: 'danger' | 'info' | 'arcane' | 'gold';
}) {
  const tones = {
    danger: 'border-red-400/30 bg-red-500/10 text-red-300',
    info: 'border-sky-400/30 bg-sky-500/10 text-sky-300',
    arcane: 'border-violet-400/30 bg-violet-500/10 text-violet-300',
    gold: 'border-amber-400/30 bg-amber-500/10 text-amber-300',
  } as const;
  return (
    <div className={cn('flex items-center gap-2 rounded-lg border px-3 py-2 shadow-sm', tones[tone])}>
      {icon}
      <span className="text-sm font-semibold">+{value}</span>
    </div>
  );
}

export const ShopLayout: React.FC<ShopLayoutProps> = ({
  character,
  availableEquipment,
  availableConsumables,
  onEquipmentPurchase,
  onConsumablePurchase,
  onOpenInventory
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ShopCategory>('equipment');
  const [selectedItem, setSelectedItem] = useState<Equipment | Consumable | null>(null);
  const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');
  const [consumableFilter, setConsumableFilter] = useState<ConsumableFilter>('all');

  // Filtrar equipamentos
  const filteredEquipment = availableEquipment.filter(item => {
    if (equipmentFilter === 'all') return true;
    return item.type === equipmentFilter;
  });

  // Filtrar consumíveis
  const filteredConsumables = availableConsumables.filter(item => {
    if (consumableFilter === 'all') return true;
    return item.type === consumableFilter;
  });

  const getRarityColor = (rarity: string) => rarityToBadgeVariant[rarity] || rarityToBadgeVariant.common;

  const getEquipmentTypeIcon = (type: string) => {
    switch (type) {
      case 'weapon': return <Sword className="h-4 w-4 text-red-300" />;
      case 'armor': return <Shield className="h-4 w-4 text-sky-300" />;
      case 'accessory': return <Gem className="h-4 w-4 text-violet-300" />;
      default: return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getConsumableTypeIcon = (type: string) => {
    switch (type) {
      case 'potion': return <Sparkles className="h-4 w-4 text-sky-300" />;
      case 'antidote': return <Shield className="h-4 w-4 text-emerald-300" />;
      case 'buff': return <Zap className="h-4 w-4 text-violet-300" />;
      default: return <Package className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderEquipmentCard = (equipment: Equipment) => {
    const canAfford = character.gold >= equipment.price;
    const hasLevel = character.level >= equipment.level_requirement;
    const canBuy = canAfford && hasLevel && equipment.is_unlocked;
    const isSelected = selectedItem?.id === equipment.id;

    return (
      <Card 
        key={equipment.id}
        className={cn(
          'cursor-pointer border-border/70 bg-card/70 backdrop-blur-sm transition-all duration-200',
          isSelected && 'ring-2 ring-primary/60 shadow-lg shadow-primary/25',
          !canBuy ? 'opacity-60 grayscale' : 'hover:-translate-y-0.5 hover:bg-card hover:shadow-md'
        )}
        onClick={() => setSelectedItem(equipment)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg border border-border/70 bg-muted/40 p-2">
              {getEquipmentTypeIcon(equipment.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="truncate text-sm font-medium">{equipment.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className={cn('border text-xs', getRarityColor(equipment.rarity))}>
                  {equipment.rarity}
                </Badge>
                {equipment.rarity === 'legendary' && <Star className="h-3 w-3 text-amber-400 animate-pulse" />}
                {equipment.rarity === 'epic' && <Sparkles className="h-3 w-3 text-purple-400" />}
              </div>
              <div className="flex items-center gap-1 mt-2">
                <Coins className="h-3 w-3 text-amber-300" />
                <span className="text-xs font-medium text-amber-300">{equipment.price}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderConsumableCard = (consumable: Consumable) => {
    const canAfford = character.gold >= consumable.price;
    const hasLevel = character.level >= (consumable.level_requirement || 1);
    const canBuy = canAfford && hasLevel;
    const isSelected = selectedItem?.id === consumable.id;

    return (
      <Card 
        key={consumable.id}
        className={cn(
          'cursor-pointer border-border/70 bg-card/70 backdrop-blur-sm transition-all duration-200',
          isSelected && 'ring-2 ring-primary/60 shadow-lg shadow-primary/25',
          !canBuy ? 'opacity-60 grayscale' : 'hover:-translate-y-0.5 hover:bg-card hover:shadow-md'
        )}
        onClick={() => setSelectedItem(consumable)}
      >
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 rounded-lg border border-border/70 bg-muted/40 p-2">
              {getConsumableTypeIcon(consumable.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="truncate text-sm font-medium">{consumable.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {consumable.type === 'potion' ? `+${consumable.effect_value}` : 
                 consumable.type === 'antidote' ? 'Remove debuffs' : 
                 `+${consumable.effect_value} por 3 turnos`}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <Coins className="h-3 w-3 text-amber-300" />
                <span className="text-xs font-medium text-amber-300">{consumable.price}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderItemDetails = () => {
    if (!selectedItem) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="text-center">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg font-semibold tracking-tight">Selecione um item para ver os detalhes</p>
            <p className="mt-2 max-w-md text-sm leading-relaxed opacity-75">
              Clique em qualquer item da lista para visualizar suas informações completas
            </p>
          </div>
        </div>
      );
    }

    const isEquipment = 'atk_bonus' in selectedItem;
    const item = selectedItem as Equipment | Consumable;

    if (isEquipment) {
      const equipment = item as Equipment;
      const canAfford = character.gold >= equipment.price;
      const hasLevel = character.level >= equipment.level_requirement;
      const canBuy = canAfford && hasLevel && equipment.is_unlocked;

      return (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                {getEquipmentTypeIcon(equipment.type)}
              </div>
              <h2 className="text-xl font-bold">{equipment.name}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={cn('border', getRarityColor(equipment.rarity))}>
                {equipment.rarity}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {equipment.type === 'weapon' ? 'Arma' : 
                 equipment.type === 'armor' ? 'Armadura' : 'Acessório'}
              </span>
            </div>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">Descrição</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{equipment.description}</p>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Atributos</h3>
            <div className="grid grid-cols-2 gap-3">
              {equipment.atk_bonus > 0 && (
                <StatPill icon={<Sword className="h-4 w-4 text-red-300" />} value={equipment.atk_bonus} tone="danger" />
              )}
              {equipment.def_bonus > 0 && (
                <StatPill icon={<Shield className="h-4 w-4 text-sky-300" />} value={equipment.def_bonus} tone="info" />
              )}
              {equipment.mana_bonus > 0 && (
                <StatPill icon={<Gem className="h-4 w-4 text-violet-300" />} value={equipment.mana_bonus} tone="arcane" />
              )}
              {equipment.speed_bonus > 0 && (
                <StatPill icon={<Zap className="h-4 w-4 text-amber-300" />} value={equipment.speed_bonus} tone="gold" />
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Comparação com Equipamento Atual</h3>
            <EquipmentComparison
              characterId={character.id}
              newEquipment={equipment}
              slotType={equipment.type}
              showTitle={false}
              compact={true}
            />
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Requisitos</h3>
            <div className="space-y-2">
              <RequirementRow label="Nível" value={equipment.level_requirement} isValid={hasLevel} />
              <RequirementRow
                label="Preço"
                value={
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-amber-300" />
                    {equipment.price}
                  </span>
                }
                isValid={canAfford}
              />
            </div>
          </div>

          <Button 
            onClick={() => onEquipmentPurchase(equipment)}
            disabled={!canBuy}
            className="w-full font-semibold shadow-md shadow-primary/20"
          >
            {!equipment.is_unlocked ? 'Item Bloqueado' :
             !hasLevel ? `Requer Nível ${equipment.level_requirement}` :
             !canAfford ? 'Gold Insuficiente' : 'Comprar'}
          </Button>
        </div>
      );
    } else {
      const consumable = item as Consumable;
      const canAfford = character.gold >= consumable.price;
      const hasLevel = character.level >= (consumable.level_requirement || 1);
      const canBuy = canAfford && hasLevel;

      return (
        <div className="space-y-6">
          <div className="space-y-1">
            <div className="mb-2 flex items-center gap-3">
              <div className="rounded-lg border border-border/70 bg-muted/40 p-3">
                {getConsumableTypeIcon(consumable.type)}
              </div>
              <h2 className="text-xl font-bold tracking-tight">{consumable.name}</h2>
            </div>
            <span className="text-sm text-muted-foreground">
              {consumable.type === 'potion' ? 'Poção' :
               consumable.type === 'antidote' ? 'Antídoto' : 'Fortalecimento'}
            </span>
          </div>

          <Separator />

          <div>
            <h3 className="mb-2 font-semibold">Descrição</h3>
            <p className="text-sm leading-relaxed text-muted-foreground">{consumable.description}</p>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Efeito</h3>
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
              <span className="text-sm text-emerald-300">
                {consumable.type === 'potion' ? `Restaura ${consumable.effect_value} pontos` : 
                 consumable.type === 'antidote' ? 'Remove todos os efeitos negativos' : 
                 `Aumenta atributo em ${consumable.effect_value} por 3 turnos`}
              </span>
            </div>
          </div>

          <div>
            <h3 className="mb-2 font-semibold">Preço</h3>
            <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/35 p-3">
              <Coins className="h-4 w-4 text-amber-300" />
              <span className={`font-medium ${canAfford ? 'text-emerald-400' : 'text-red-400'}`}>
                {consumable.price} gold cada
              </span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold">Comprar</h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                onClick={() => onConsumablePurchase(consumable, 1)}
                disabled={!canBuy}
                size="sm"
                className="font-semibold shadow-sm shadow-primary/10"
              >
                1x
              </Button>
              <Button
                onClick={() => onConsumablePurchase(consumable, 5)}
                disabled={!canBuy || character.gold < consumable.price * 5}
                size="sm"
                variant="outline"
                className="border-border/70"
              >
                5x
              </Button>
              <Button
                onClick={() => onConsumablePurchase(consumable, 10)}
                disabled={!canBuy || character.gold < consumable.price * 10}
                size="sm"
                variant="outline"
                className="border-border/70"
              >
                10x
              </Button>
            </div>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="grid h-full grid-cols-1 gap-6 lg:grid-cols-3">
      {/* Coluna Esquerda - Lista de Itens */}
      <div className="space-y-4 lg:col-span-1">
        {/* Header com Gold e Inventário */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-4 py-2">
            <Coins className="h-4 w-4 text-amber-300" />
            <span className="font-semibold text-amber-300">{character.gold}</span>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onOpenInventory}
            className="border-border/70 bg-card/70 shadow-sm"
          >
            <Package className="h-4 w-4 mr-2" />
            Inventário
          </Button>
        </div>

        {/* Filtros de Categoria */}
        <div className="flex gap-2 rounded-lg border border-border/70 bg-card/50 p-1">
          <Button
            variant={selectedCategory === 'equipment' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectedCategory('equipment');
              setSelectedItem(null);
            }}
            className={cn('flex-1', selectedCategory === 'equipment' && 'shadow-sm shadow-primary/20')}
          >
            <ShoppingCart className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedCategory === 'consumables' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => {
              setSelectedCategory('consumables');
              setSelectedItem(null);
            }}
            className={cn('flex-1', selectedCategory === 'consumables' && 'shadow-sm shadow-primary/20')}
          >
            <ShoppingBag className="h-4 w-4" />
          </Button>
        </div>

        {/* Filtros Específicos */}
        {selectedCategory === 'equipment' && (
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEquipmentFilter('all')}
              className={cn(equipmentFilter === 'all' && 'bg-secondary')}
            >
              <Filter className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEquipmentFilter('weapon')}
              className={cn(equipmentFilter === 'weapon' && 'bg-red-500/15 text-red-300')}
            >
              <Sword className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEquipmentFilter('armor')}
              className={cn(equipmentFilter === 'armor' && 'bg-sky-500/15 text-sky-300')}
            >
              <Shield className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEquipmentFilter('accessory')}
              className={cn(equipmentFilter === 'accessory' && 'bg-violet-500/15 text-violet-300')}
            >
              <Gem className="h-3 w-3" />
            </Button>
          </div>
        )}

        {selectedCategory === 'consumables' && (
          <div className="flex flex-wrap gap-1 rounded-lg border border-border/60 bg-card/40 p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('all')}
              className={cn(consumableFilter === 'all' && 'bg-secondary')}
            >
              <Filter className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('potion')}
              className={cn(consumableFilter === 'potion' && 'bg-sky-500/15 text-sky-300')}
            >
              <Sparkles className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('antidote')}
              className={cn(consumableFilter === 'antidote' && 'bg-emerald-500/15 text-emerald-300')}
            >
              <Shield className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConsumableFilter('buff')}
              className={cn(consumableFilter === 'buff' && 'bg-violet-500/15 text-violet-300')}
            >
              <Zap className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Lista de Itens */}
        <div className="scrollbar-thin scrollbar-track-transparent space-y-2 overflow-y-auto max-h-[60vh]">
          {selectedCategory === 'equipment' ? (
            filteredEquipment.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum equipamento encontrado</p>
              </div>
            ) : (
              filteredEquipment.map(renderEquipmentCard)
            )
          ) : (
            filteredConsumables.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhum consumível encontrado</p>
              </div>
            ) : (
              filteredConsumables.map(renderConsumableCard)
            )
          )}
        </div>
      </div>

      {/* Coluna Direita - Detalhes do Item */}
      <div className="lg:col-span-2">
        <Card className="h-full border-border/70 bg-card/70 shadow-lg shadow-black/10 backdrop-blur-sm">
          <CardContent className="p-6 h-full">
            {renderItemDetails()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}; 