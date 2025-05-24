import React, { useEffect, useState } from 'react';
import { Equipment } from '@/resources/game/models/equipment.model';
import { Consumable } from '@/resources/game/models/consumable.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { ConsumableService } from '@/resources/game/consumable.service';
import { Character } from '@/resources/game/models/character.model';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sword, Shield, Gem, Coins, HelpCircle, Package, Star, Zap, ShoppingCart, ShoppingBag } from 'lucide-react';
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

    const renderEquipmentCard = (equipment: Equipment) => {
        // Verificar se o item está desbloqueado
        if (!equipment.is_unlocked) {
            return (
                <Card key={equipment.id} className="p-4 bg-card/50 opacity-75 border-dashed">
                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center space-y-4">
                        <HelpCircle className="h-12 w-12 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold text-muted-foreground">Item Bloqueado</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                Este item ainda não foi desbloqueado. Continue explorando a torre ou procure receitas especiais!
                            </p>
                            <div className="mt-3 space-y-1">
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-medium">Tipo:</span> {getEquipmentTypeLabel(equipment.type)}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-medium">Raridade:</span> <span className={getRarityTextColor(equipment.rarity)}>{equipment.rarity}</span>
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    <span className="font-medium">Nível Req:</span> {equipment.level_requirement}
                                </p>
                            </div>
                        </div>
                    </div>
                </Card>
            );
        }

        // Verificar se o jogador já possui este equipamento
        const canAfford = character.gold >= equipment.price;
        const hasLevel = character.level >= equipment.level_requirement;
        const canBuy = canAfford && hasLevel;

        return (
            <Card key={equipment.id} className={`p-4 transition-all hover:shadow-lg ${!canBuy ? 'opacity-75' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-primary mb-1">{equipment.name}</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getRarityColor(equipment.rarity)}`}>
                                {equipment.rarity}
                            </span>
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {getEquipmentTypeLabel(equipment.type)}
                            </span>
                        </div>
                    </div>
                    {equipment.rarity === 'epic' || equipment.rarity === 'legendary' ? (
                        <Star className="h-5 w-5 text-yellow-400" />
                    ) : equipment.rarity === 'rare' ? (
                        <Zap className="h-5 w-5 text-blue-400" />
                    ) : null}
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{equipment.description}</p>

                <div className="space-y-2 mb-4">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Nível Requerido:</span>
                        <span className={hasLevel ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                            {equipment.level_requirement}
                        </span>
                    </div>

                    {/* Stats do equipamento */}
                    <div className="grid grid-cols-2 gap-2">
                        {equipment.atk_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Sword className="h-4 w-4 text-red-400" />
                                <span className="text-red-400 font-medium">+{equipment.atk_bonus}</span>
                            </div>
                        )}
                        {equipment.def_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Shield className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-400 font-medium">+{equipment.def_bonus}</span>
                            </div>
                        )}
                        {equipment.mana_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Gem className="h-4 w-4 text-purple-400" />
                                <span className="text-purple-400 font-medium">+{equipment.mana_bonus}</span>
                            </div>
                        )}
                        {equipment.speed_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Zap className="h-4 w-4 text-yellow-400" />
                                <span className="text-yellow-400 font-medium">+{equipment.speed_bonus}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t">
                    <div className="flex items-center gap-1 text-yellow-400 font-semibold">
                        <Coins className="h-4 w-4" />
                        <span>{equipment.price}</span>
                    </div>
                    <Button
                        onClick={() => handleEquipmentPurchase(equipment)}
                        disabled={!canBuy}
                        variant={canBuy ? "default" : "secondary"}
                        className="flex-1 max-w-[120px]"
                        size="sm"
                    >
                        {!hasLevel ? 'Nível Baixo' : 
                         !canAfford ? 'Sem Gold' : 'Comprar'}
                    </Button>
                </div>
            </Card>
        );
    };

    const renderConsumableCard = (consumable: Consumable) => {
        const canAfford1 = character.gold >= consumable.price;
        const canAfford5 = character.gold >= (consumable.price * 5);
        const canAfford10 = character.gold >= (consumable.price * 10);
        const hasLevel = character.level >= (consumable.level_requirement || 1);
        const canBuy = canAfford1 && hasLevel;

        return (
            <Card key={consumable.id} className={`p-4 transition-all hover:shadow-lg ${!canBuy ? 'opacity-75' : ''}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                        <h3 className="text-lg font-semibold text-primary mb-1">{consumable.name}</h3>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {getConsumableTypeLabel(consumable.type)}
                            </span>
                            {!hasLevel && (
                                <span className="text-xs text-red-400 bg-red-900/50 px-2 py-1 rounded">
                                    Nível {consumable.level_requirement || 1}
                                </span>
                            )}
                        </div>
                    </div>
                    <ShoppingBag className="h-5 w-5 text-blue-400" />
                </div>

                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{consumable.description}</p>

                <div className="space-y-2 mb-4">
                    {(consumable.level_requirement || 1) > 1 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Nível Requerido:</span>
                            <span className={hasLevel ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                                {consumable.level_requirement || 1}
                            </span>
                        </div>
                    )}
                    {consumable.effect_value > 0 && (
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Efeito:</span>
                            <span className="text-green-400 font-medium">
                                {consumable.type === 'potion' ? `+${consumable.effect_value}` : 
                                 consumable.type === 'antidote' ? 'Remove debuffs' : 
                                 `+${consumable.effect_value} por 3 turnos`}
                            </span>
                        </div>
                    )}
                </div>

                <div className="space-y-3 pt-3 border-t">
                    <div className="flex items-center gap-1 text-yellow-400 font-semibold justify-center">
                        <Coins className="h-4 w-4" />
                        <span>{consumable.price} gold cada</span>
                    </div>
                    
                    {/* Botões de compra em diferentes quantidades */}
                    <div className="grid grid-cols-3 gap-2">
                        <Button
                            onClick={() => handleConsumablePurchase(consumable, 1)}
                            disabled={!canBuy}
                            size="sm"
                            className="text-xs"
                        >
                            1x
                        </Button>
                        <Button
                            onClick={() => handleConsumablePurchase(consumable, 5)}
                            disabled={!canAfford5 || !hasLevel}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                        >
                            5x
                        </Button>
                        <Button
                            onClick={() => handleConsumablePurchase(consumable, 10)}
                            disabled={!canAfford10 || !hasLevel}
                            size="sm"
                            variant="outline"
                            className="text-xs"
                        >
                            10x
                        </Button>
                    </div>
                    
                    {!hasLevel && (
                        <p className="text-xs text-red-400 text-center">
                            Requer nível {consumable.level_requirement || 1}
                        </p>
                    )}
                </div>
            </Card>
        );
    };

    const getEquipmentTypeLabel = (type: string) => {
        const types = {
            weapon: 'Arma',
            armor: 'Armadura',
            accessory: 'Acessório'
        };
        return types[type as keyof typeof types] || type;
    };

    const getConsumableTypeLabel = (type: string) => {
        const types = {
            potion: 'Poção',
            elixir: 'Elixir',
            antidote: 'Antídoto',
            buff: 'Fortalecimento'
        };
        return types[type as keyof typeof types] || type;
    };

    const getRarityColor = (rarity: Equipment['rarity']) => {
        const colors = {
            common: 'text-gray-300 bg-gray-800/50 border border-gray-700',
            uncommon: 'text-green-300 bg-green-900/50 border border-green-700',
            rare: 'text-blue-300 bg-blue-900/50 border border-blue-700',
            epic: 'text-purple-300 bg-purple-900/50 border border-purple-700',
            legendary: 'text-yellow-300 bg-yellow-900/50 border border-yellow-700'
        };
        return colors[rarity];
    };

    const getRarityTextColor = (rarity: Equipment['rarity']) => {
        const colors = {
            common: 'text-gray-400',
            uncommon: 'text-green-400',
            rare: 'text-blue-400',
            epic: 'text-purple-400',
            legendary: 'text-yellow-400'
        };
        return colors[rarity];
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Loja</h2>
                    <div className="flex items-center gap-4">
                        <Button variant="outline" disabled>
                            <Package className="h-4 w-4 mr-2" />
                            Inventário
                        </Button>
                        <div className="flex items-center gap-2 text-lg text-yellow-400">
                            <Coins className="h-5 w-5" />
                            <span>{character.gold} gold</span>
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Card key={i} className="p-4 animate-pulse">
                            <div className="h-4 bg-muted rounded mb-2"></div>
                            <div className="h-3 bg-muted rounded mb-4 w-3/4"></div>
                            <div className="h-20 bg-muted rounded"></div>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold">Loja</h2>
                    <div className="flex items-center gap-4">
                        <Button 
                            variant="outline" 
                            onClick={() => setInventoryOpen(true)}
                            className="flex items-center gap-2"
                        >
                            <Package className="h-4 w-4" />
                            Inventário
                        </Button>
                        <div className="flex items-center gap-2 text-lg text-yellow-400 bg-yellow-400/10 px-3 py-2 rounded-lg">
                            <Coins className="h-5 w-5" />
                            <span className="font-semibold">{character.gold} gold</span>
                        </div>
                    </div>
                </div>

                <Tabs defaultValue="equipment" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="equipment" className="flex items-center gap-2">
                            <ShoppingCart className="h-4 w-4" />
                            Equipamentos ({availableEquipment.length})
                        </TabsTrigger>
                        <TabsTrigger value="consumables" className="flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4" />
                            Consumíveis ({availableConsumables.length})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="equipment" className="space-y-4">
                        {availableEquipment.length === 0 ? (
                            <div className="text-center py-12">
                                <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-semibold mb-2">Nenhum equipamento disponível</h3>
                                <p className="text-muted-foreground">
                                    Nenhum equipamento foi encontrado para o seu nível atual.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {availableEquipment.map(equipment => renderEquipmentCard(equipment))}
                            </div>
                        )}
                    </TabsContent>

                    <TabsContent value="consumables" className="space-y-4">
                        {availableConsumables.length === 0 ? (
                            <div className="text-center py-12">
                                <ShoppingBag className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
                                <h3 className="text-lg font-semibold mb-2">Nenhum consumível disponível</h3>
                                <p className="text-muted-foreground">
                                    A loja não possui consumíveis disponíveis no momento.
                                </p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {availableConsumables.map(consumable => renderConsumableCard(consumable))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <InventoryModal
                character={character}
                isOpen={inventoryOpen}
                onClose={() => setInventoryOpen(false)}
                onItemSold={handleInventoryItemSold}
            />
        </>
    );
}; 