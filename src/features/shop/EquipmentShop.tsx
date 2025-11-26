import React, { useEffect, useState } from 'react';
import { type Equipment, type CharacterEquipment } from '@/resources/equipment/equipment.model';
import { type Consumable, type CharacterConsumable } from '@/resources/consumable/consumable.model';
import { type CharacterDrop } from '@/resources/monster/monster.model';
import { EquipmentService } from '@/resources/equipment/equipment.service';
import { ConsumableService } from '@/resources/consumable/consumable.service';
import { type Character } from '@/resources/character/character.model';
import { ShopLayout } from '@/features/shop/ShopLayout';
import { toast } from 'sonner';
import { InventoryModal } from '@/features/inventory/InventoryModal';
import { PurchaseConfirmationModal } from '@/features/shop/PurchaseConfirmationModal';
import { SellConfirmationModal } from '@/features/shop/SellConfirmationModal';

interface GameShopProps {
  character: Character;
  onPurchase: (newGold: number) => void;
}

export const GameShop: React.FC<GameShopProps> = ({ character, onPurchase }) => {
  const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
  const [availableConsumables, setAvailableConsumables] = useState<Consumable[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // ✅ CORREÇÃO: Estado local para sincronizar character.gold
  const [currentGold, setCurrentGold] = useState(character.gold);

  // Estados para itens vendáveis
  const [characterEquipment, setCharacterEquipment] = useState<CharacterEquipment[]>([]);
  const [characterConsumables, setCharacterConsumables] = useState<CharacterConsumable[]>([]);
  const [characterDrops, setCharacterDrops] = useState<CharacterDrop[]>([]);

  // Estados para modal de confirmação de compra
  const [purchaseModal, setPurchaseModal] = useState<{
    isOpen: boolean;
    item: Equipment | Consumable | null;
    quantity: number;
  }>({
    isOpen: false,
    item: null,
    quantity: 1,
  });

  // Estados para modal de confirmação de venda de equipamento
  const [sellEquipmentModal, setSellEquipmentModal] = useState<{
    isOpen: boolean;
    item: CharacterEquipment | null;
  }>({
    isOpen: false,
    item: null,
  });

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

      console.log('[GameShop] Inventário carregado:', {
        equipment: equipmentData?.length || 0,
        consumables: consumablesRes.success ? consumablesRes.data?.length || 0 : 0,
        drops: dropsRes.success ? dropsRes.data?.length || 0 : 0,
        equipmentDetails: equipmentData?.map(e => ({
          id: e.id,
          name: e.equipment?.name,
          is_equipped: e.is_equipped,
          type: e.equipment?.type,
        })),
      });

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

  // ✅ CORREÇÃO: Sincronizar currentGold quando character.gold mudar
  useEffect(() => {
    setCurrentGold(character.gold);
  }, [character.gold]);

  // Funções intermediárias que mostram o modal de confirmação
  const handleEquipmentPurchase = (equipment: Equipment) => {
    setPurchaseModal({
      isOpen: true,
      item: equipment,
      quantity: 1,
    });
  };

  const handleConsumablePurchase = (consumable: Consumable, quantity: number = 1) => {
    setPurchaseModal({
      isOpen: true,
      item: consumable,
      quantity,
    });
  };

  // Funções internas que executam a compra após confirmação
  const executeEquipmentPurchase = async (equipment: Equipment) => {
    if (currentGold < equipment.price) {
      toast.error('Gold insuficiente para comprar este item!');
      return;
    }

    try {
      const result = await EquipmentService.buyEquipment(character.id, equipment.id);
      if (result.success && result.data?.newGold !== undefined) {
        toast.success(`${equipment.name} comprado com sucesso!`);
        // ✅ CORREÇÃO: Atualizar gold local e chamar callback
        setCurrentGold(result.data.newGold);
        onPurchase(result.data.newGold);
        // ✅ CORREÇÃO: Recarregar inventário após compra
        await loadPlayerInventory();
      } else {
        toast.error(result.error || 'Erro ao comprar equipamento!');
      }
    } catch (error) {
      console.error('Erro ao comprar equipamento:', error);
      toast.error('Erro ao comprar equipamento!');
    }
  };

  const executeConsumablePurchase = async (consumable: Consumable, quantity: number = 1) => {
    const totalPrice = consumable.price * quantity;

    if (currentGold < totalPrice) {
      toast.error('Gold insuficiente para comprar este item!');
      return;
    }

    try {
      const result = await ConsumableService.buyConsumable(character.id, consumable.id, quantity);
      if (result.success && result.data) {
        toast.success(`${quantity}x ${consumable.name} comprado com sucesso!`);
        // ✅ CORREÇÃO: Atualizar gold local e chamar callback
        setCurrentGold(result.data.newGold);
        onPurchase(result.data.newGold);
        // ✅ CORREÇÃO: Recarregar inventário após compra
        await loadPlayerInventory();
      } else {
        toast.error(result.error || 'Erro ao comprar consumível!');
      }
    } catch (error) {
      console.error('Erro ao comprar consumível:', error);
      toast.error('Erro ao comprar consumível!');
    }
  };

  // Handler para confirmação do modal
  const handleConfirmPurchase = async () => {
    if (!purchaseModal.item) return;

    const isEquipment = 'atk_bonus' in purchaseModal.item;
    if (isEquipment) {
      await executeEquipmentPurchase(purchaseModal.item as Equipment);
    } else {
      await executeConsumablePurchase(purchaseModal.item as Consumable, purchaseModal.quantity);
    }
  };

  const handleInventoryItemSold = (newGold: number) => {
    // Atualizar o gold na página principal
    onPurchase(newGold);
    // Não é necessário recarregar a lista - a venda de itens do inventário
    // não afeta os itens disponíveis na loja
  };

  // Função para calcular preço de venda de equipamento (mesma lógica do ShopLayout)
  const getEquipmentSellPrice = (equipment: Equipment): number => {
    const rarityMultiplier: Record<string, number> = {
      common: 0.3,
      uncommon: 0.35,
      rare: 0.4,
      epic: 0.45,
      legendary: 0.5,
    };
    const multiplier = rarityMultiplier[equipment.rarity] || 0.3;
    return Math.floor(equipment.price * multiplier);
  };

  // Função intermediária que mostra o modal de confirmação
  const handleSellEquipment = (item: CharacterEquipment) => {
    if (!item.equipment) return;
    setSellEquipmentModal({
      isOpen: true,
      item,
    });
  };

  // Função interna que executa a venda após confirmação
  const executeSellEquipment = async (item: CharacterEquipment) => {
    if (!item.equipment) return;

    try {
      const result = await EquipmentService.sellEquipment(character.id, item.equipment.id);

      if (result.success && result.data?.newGold !== undefined) {
        toast.success(`${item.equipment.name} vendido com sucesso!`);
        // ✅ CORREÇÃO: Atualizar gold local e chamar callback
        setCurrentGold(result.data.newGold);
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

  // Handler para confirmação de venda de equipamento
  const handleConfirmSellEquipment = async () => {
    if (!sellEquipmentModal.item || !sellEquipmentModal.item.equipment) return;
    await executeSellEquipment(sellEquipmentModal.item);
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
        // ✅ CORREÇÃO: Atualizar gold local e chamar callback
        setCurrentGold(result.data.newGold);
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
        // ✅ CORREÇÃO: Atualizar gold local e chamar callback
        setCurrentGold(result.data.newGold);
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

  const totalPrice = purchaseModal.item ? purchaseModal.item.price * purchaseModal.quantity : 0;

  // ✅ CORREÇÃO: Criar character atualizado com gold correto
  const updatedCharacter = { ...character, gold: currentGold };

  return (
    <>
      <ShopLayout
        character={updatedCharacter}
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
        character={updatedCharacter}
        isOpen={inventoryOpen}
        onClose={() => setInventoryOpen(false)}
        onItemSold={handleInventoryItemSold}
      />

      {purchaseModal.item && (
        <PurchaseConfirmationModal
          isOpen={purchaseModal.isOpen}
          setIsOpen={isOpen =>
            setPurchaseModal(prev => ({ ...prev, isOpen, item: isOpen ? prev.item : null }))
          }
          onConfirm={handleConfirmPurchase}
          item={purchaseModal.item}
          quantity={purchaseModal.quantity}
          currentGold={currentGold}
          totalPrice={totalPrice}
        />
      )}

      {sellEquipmentModal.item && sellEquipmentModal.item.equipment && (
        <SellConfirmationModal
          isOpen={sellEquipmentModal.isOpen}
          setIsOpen={isOpen =>
            setSellEquipmentModal(prev => ({ ...prev, isOpen, item: isOpen ? prev.item : null }))
          }
          onConfirm={handleConfirmSellEquipment}
          equipment={sellEquipmentModal.item.equipment}
          sellPrice={getEquipmentSellPrice(sellEquipmentModal.item.equipment)}
          currentGold={currentGold}
        />
      )}
    </>
  );
};
