import React, { useEffect, useState } from 'react';
import { type Equipment } from '@/models/equipment.model';
import { type Consumable } from '@/models/consumable.model';
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

  useEffect(() => {
    loadShopItems();
  }, [character.level]);

  const loadShopItems = async (preserveScroll: boolean = false) => {
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

      // Carregar consumíveis disponíveis na loja (exceto craftáveis que não são vendidos)
      const consumablesRes = await ConsumableService.getAvailableConsumables();
      if (consumablesRes.success && consumablesRes.data) {
        // Filtrar apenas consumíveis que podem ser comprados (price > 0)
        const shopConsumables = consumablesRes.data.filter(
          c => c.price > 0 && !c.name.includes('Elixir')
        );
        setAvailableConsumables(shopConsumables);
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
  };

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
