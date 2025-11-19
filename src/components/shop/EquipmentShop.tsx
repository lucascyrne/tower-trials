import React, { useEffect, useState } from 'react';
import { type Equipment, type CharacterEquipment } from '@/models/equipment.model';
import { type Consumable, type CharacterConsumable } from '@/models/consumable.model';
import { type CharacterDrop } from '@/models/monster.model';
import { EquipmentService } from '@/services/equipment.service';
import { ConsumableService } from '@/services/consumable.service';
import { type Character } from '@/models/character.model';
import { ShopLayout } from '@/components/shop/ShopLayout';
import { toast } from 'sonner';
import { InventoryModal } from '@/features/inventory/InventoryModal';

interface GameShopProps {
  character: Character;
  onPurchase: (newGold: number) => void;
}

export const GameShop: React.FC<GameShopProps> = ({ character, onPurchase }) => {
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [availableConsumables, setAvailableConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  
  // Estados para itens vendáveis
  const [characterEquipment, setCharacterEquipment] = useState<CharacterEquipment[]>([]);
  const [characterConsumables, setCharacterConsumables] = useState<CharacterConsumable[]>([]);
  const [characterDrops, setCharacterDrops] = useState<CharacterDrop[]>([]);

  const loadShopItems = React.useCallback(
    async (preserveScroll: boolean = false) => {
      try {
        // Salvar posição do scroll antes de recarregar se necessário
        let scrollTop = 0;
        if (preserveScroll) {
          scrollTop = window.scrollY || document.documentElement.scrollTop;
        } else {
          setLoading(true);
        }

        // Carregar equipamentos
        const equipment = await EquipmentService.getAvailableEquipment(character.level);
        setAvailableEquipment(equipment);

        // ✅ Carregar consumíveis disponíveis na loja
        const consumablesRes = await ConsumableService.getAvailableConsumables();
        console.log('[GameShop] Consumíveis brutos retornados:', {
          success: consumablesRes.success,
          count: consumablesRes.data?.length || 0,
          data:
            consumablesRes.data?.map(c => ({
              id: c.id,
              name: c.name,
              type: c.type,
              price: c.price,
            })) || [],
        });

        if (consumablesRes.success && consumablesRes.data) {
          // ✅ Filtrar consumíveis vendáveis na loja (price > 0)
          // Incluir: poções, antídotos, buffs COM PREÇO
          // Excluir: pergaminhos de desbloqueio (craftáveis com price=0)
          const shopConsumables = consumablesRes.data.filter(c => {
            const isShopItem = c.price > 0; // Vendável
            const isNotPergaminho = !c.name.includes('Pergaminho'); // Não é desbloqueio
            return isShopItem && isNotPergaminho;
          });

          console.log('[GameShop] Consumíveis para a loja (após filtro):', {
            total: shopConsumables.length,
            items: shopConsumables.map(c => ({ name: c.name, type: c.type, price: c.price })),
          });

          setAvailableConsumables(shopConsumables);
        } else {
          console.warn('[GameShop] Falha ao buscar consumíveis:', consumablesRes.error);
        }

        // Restaurar posição do scroll se necessário
        if (preserveScroll) {
          // Usar requestAnimationFrame para garantir que o DOM foi atualizado
          requestAnimationFrame(() => {
            window.scrollTo(0, scrollTop);
          });
        }
      } catch (error) {
        console.error('Erro ao carregar itens da loja:', error);
        toast.error('Erro ao carregar itens da loja');
      } finally {
        if (!preserveScroll) {
          setLoading(false);
        }
      }
    },
    [character.level]
  );

  const loadPlayerInventory = React.useCallback(async () => {
    try {
      const [equipmentData, consumablesRes, dropsRes] = await Promise.all([
        EquipmentService.getCharacterEquipment(character.id),
        ConsumableService.getCharacterConsumables(character.id),
        ConsumableService.getCharacterDrops(character.id),
      ]);

      setCharacterEquipment(equipmentData || []);
      setCharacterConsumables(consumablesRes.success ? consumablesRes.data || [] : []);
      setCharacterDrops(dropsRes.success ? dropsRes.data || [] : []);
    } catch (error) {
      console.error('Erro ao carregar inventário do jogador:', error);
    }
  }, [character.id]);

  useEffect(() => {
    loadShopItems();
    loadPlayerInventory();
  }, [loadShopItems, loadPlayerInventory]);

  const handleEquipmentPurchase = async (equipment: Equipment) => {
    if (character.gold < equipment.price) {
      toast.error('Gold insuficiente para comprar este item!');
      return;
    }

    try {
      const result = await EquipmentService.buyEquipment(character.id, equipment.id);
      if (result.success && result.data?.newGold !== undefined) {
        toast.success(`${equipment.name} comprado com sucesso!`);
        onPurchase(result.data.newGold);
      } else {
        toast.error(result.error || 'Erro ao comprar equipamento!');
      }
    } catch (error) {
      console.error('Erro ao comprar equipamento:', error);
      toast.error('Erro ao comprar equipamento!');
    }
  };

  const handleConsumablePurchase = async (consumable: Consumable, quantity: number = 1) => {
    const totalPrice = consumable.price * quantity;

    if (character.gold < totalPrice) {
      toast.error('Gold insuficiente para comprar este item!');
      return;
    }

    try {
      const result = await ConsumableService.buyConsumable(character.id, consumable.id, quantity);
      if (result.success && result.data) {
        toast.success(`${quantity}x ${consumable.name} comprado com sucesso!`);
        onPurchase(result.data.newGold);
      } else {
        toast.error(result.error || 'Erro ao comprar consumível!');
      }
    } catch (error) {
      console.error('Erro ao comprar consumível:', error);
      toast.error('Erro ao comprar consumível!');
    }
  };

  const handleInventoryItemSold = (newGold: number) => {
    // Atualizar o gold na página principal
    onPurchase(newGold);
    // Não é necessário recarregar a lista - a venda de itens do inventário
    // não afeta os itens disponíveis na loja
  };

  const handleSellEquipment = async (item: CharacterEquipment) => {
    if (!item.equipment) return;

    try {
      const result = await EquipmentService.sellEquipment(character.id, item.equipment.id);

      if (result.success && result.data?.newGold !== undefined) {
        toast.success(`${item.equipment.name} vendido com sucesso!`);
        onPurchase(result.data.newGold);
        // Recarregar inventário para atualizar a lista
        await loadPlayerInventory();
      } else {
        toast.error(result.error || 'Erro ao vender equipamento');
      }
    } catch (error) {
      console.error('Erro ao vender equipamento:', error);
      toast.error('Erro ao vender equipamento');
    }
  };

  const handleSellConsumable = async (item: CharacterConsumable, quantity: number) => {
    if (!item.consumable) return;

    try {
      const result = await ConsumableService.sellConsumablesBatch(character.id, [
        { consumable_id: item.consumable_id, quantity },
      ]);

      if (result.success && result.data) {
        toast.success(
          `Vendido ${quantity}x ${item.consumable.name} por ${result.data.totalGoldEarned} gold!`
        );
        onPurchase(result.data.newGold);
        // Recarregar inventário para atualizar a lista
        await loadPlayerInventory();
      } else {
        toast.error(result.error || 'Erro ao vender consumível');
      }
    } catch (error) {
      console.error('Erro ao vender consumível:', error);
      toast.error('Erro ao vender consumível');
    }
  };

  const handleSellDrop = async (item: CharacterDrop, quantity: number) => {
    if (!item.drop) return;

    try {
      const result = await ConsumableService.sellDropsBatch(character.id, [
        { drop_id: item.drop_id, quantity },
      ]);

      if (result.success && result.data) {
        toast.success(
          `Vendido ${quantity}x ${item.drop.name} por ${result.data.totalGoldEarned} gold!`
        );
        onPurchase(result.data.newGold);
        // Recarregar inventário para atualizar a lista
        await loadPlayerInventory();
      } else {
        toast.error(result.error || 'Erro ao vender material');
      }
    } catch (error) {
      console.error('Erro ao vender material:', error);
      toast.error('Erro ao vender material');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mr-4"></div>
        <span>Carregando loja...</span>
      </div>
    );
  }

  return (
    <>
      <ShopLayout
        character={character}
        availableEquipment={availableEquipment}
        availableConsumables={availableConsumables}
        onEquipmentPurchase={handleEquipmentPurchase}
        onConsumablePurchase={handleConsumablePurchase}
        onOpenInventory={() => setInventoryOpen(true)}
        characterEquipment={characterEquipment}
        characterConsumables={characterConsumables}
        characterDrops={characterDrops}
        onSellEquipment={handleSellEquipment}
        onSellConsumable={handleSellConsumable}
        onSellDrop={handleSellDrop}
      />

      <InventoryModal
        character={character}
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        onItemSold={handleInventoryItemSold}
      />
    </>
  );
};
