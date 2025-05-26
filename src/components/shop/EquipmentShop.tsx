import React, { useEffect, useState } from 'react';
import { Equipment } from '@/resources/game/models/equipment.model';
import { Consumable } from '@/resources/game/models/consumable.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { ConsumableService } from '@/resources/game/consumable.service';
import { Character } from '@/resources/game/models/character.model';
import { ShopLayout } from './ShopLayout';
import { InventoryModal } from './InventoryModal';
import { toast } from 'sonner';

interface GameShopProps {
    character: Character;
    onPurchase: () => void;
}

export const GameShop: React.FC<GameShopProps> = ({ character, onPurchase }) => {
    const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);
    const [availableConsumables, setAvailableConsumables] = useState<Consumable[]>([]);
    const [loading, setLoading] = useState(true);
    const [inventoryOpen, setInventoryOpen] = useState(false);

    useEffect(() => {
        loadShopItems();
    }, [character.level]);

    const loadShopItems = async () => {
        try {
            setLoading(true);
            
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
        } catch (error) {
            console.error('Erro ao carregar itens da loja:', error);
            toast.error('Erro ao carregar itens da loja');
        } finally {
            setLoading(false);
        }
    };

    const handleEquipmentPurchase = async (equipment: Equipment) => {
        if (character.gold < equipment.price) {
            toast.error('Gold insuficiente para comprar este item!');
            return;
        }

        try {
            const success = await EquipmentService.buyEquipment(character.id, equipment.id, equipment.price);
            if (success) {
                toast.success(`${equipment.name} comprado com sucesso!`);
                onPurchase();
                loadShopItems(); // Recarregar para atualizar disponibilidade
            } else {
                toast.error('Erro ao comprar equipamento!');
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
            if (result.success) {
                toast.success(`${quantity}x ${consumable.name} comprado com sucesso!`);
                onPurchase();
            } else {
                toast.error(result.error || 'Erro ao comprar consumível!');
            }
        } catch (error) {
            console.error('Erro ao comprar consumível:', error);
            toast.error('Erro ao comprar consumível!');
        }
    };

    const handleInventoryItemSold = () => {
        // Atualizar a página para refletir as mudanças no gold
        onPurchase();
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