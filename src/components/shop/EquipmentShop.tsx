import React, { useCallback, useEffect, useState } from 'react';
import { Equipment } from '@/resources/game/models/equipment.model';
import { Consumable } from '@/resources/game/models/consumable.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { ConsumableService } from '@/resources/game/consumable.service';
import { Character } from '@/resources/game/models/character.model';
import { ShopLayout } from './ShopLayout';
import { InventoryModal } from './InventoryModal';
import ConfirmationModal from '@/components/core/confirmation-modal';
import { toast } from 'sonner';

interface GameShopProps {
    character: Character;
    onPurchase: (newGold: number) => void;
}

export const GameShop: React.FC<GameShopProps> = ({ character, onPurchase }) => {
    const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
    const [availableConsumables, setAvailableConsumables] = useState<Consumable[]>([]);
    const [loading, setLoading] = useState(true);
    const [inventoryOpen, setInventoryOpen] = useState(false);
    const [purchaseConfirmationOpen, setPurchaseConfirmationOpen] = useState(false);
    const [pendingPurchase, setPendingPurchase] = useState<{
        type: 'equipment' | 'consumable';
        equipment?: Equipment;
        consumable?: Consumable;
        quantity?: number;
    } | null>(null);

    const loadShopItems = useCallback(async (preserveScroll: boolean = false) => {
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
                const shopConsumables = consumablesRes.data.filter(c => 
                    c.price > 0 && !c.name.includes('Elixir')
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
    }, [character.level]);

    useEffect(() => {
        loadShopItems();
    }, [loadShopItems]);

    const executeEquipmentPurchase = async (equipment: Equipment) => {
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

    const executeConsumablePurchase = async (consumable: Consumable, quantity: number = 1) => {
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

    const handleEquipmentPurchase = (equipment: Equipment) => {
        setPendingPurchase({ type: 'equipment', equipment });
        setPurchaseConfirmationOpen(true);
    };

    const handleConsumablePurchase = (consumable: Consumable, quantity: number = 1) => {
        setPendingPurchase({ type: 'consumable', consumable, quantity });
        setPurchaseConfirmationOpen(true);
    };

    const handleConfirmPurchase = async () => {
        if (!pendingPurchase) return;
        if (pendingPurchase.type === 'equipment' && pendingPurchase.equipment) {
            await executeEquipmentPurchase(pendingPurchase.equipment);
            return;
        }
        if (pendingPurchase.type === 'consumable' && pendingPurchase.consumable) {
            await executeConsumablePurchase(
                pendingPurchase.consumable,
                pendingPurchase.quantity || 1
            );
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

            <ConfirmationModal
                isOpen={purchaseConfirmationOpen}
                setIsOpen={setPurchaseConfirmationOpen}
                onConfirmation={handleConfirmPurchase}
                title="Confirmar compra"
                description={
                    pendingPurchase?.type === 'equipment' && pendingPurchase.equipment
                        ? `Comprar ${pendingPurchase.equipment.name} por ${pendingPurchase.equipment.price} gold?`
                        : pendingPurchase?.type === 'consumable' && pendingPurchase.consumable
                          ? `Comprar ${pendingPurchase.quantity || 1}x ${pendingPurchase.consumable.name} por ${(pendingPurchase.consumable.price * (pendingPurchase.quantity || 1))} gold?`
                          : 'Deseja confirmar esta compra?'
                }
                confirmText="Confirmar compra"
                cancelText="Cancelar"
            />
        </>
    );
}; 