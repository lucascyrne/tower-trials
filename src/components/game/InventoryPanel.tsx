import React, { useEffect, useState } from 'react';
import { Equipment, CharacterEquipment, EquipmentSlots } from '@/resources/game/models/equipment.model';
import { CharacterConsumable, MonsterDrop } from '@/resources/game/models/consumable.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { ConsumableService } from '@/resources/game/consumable.service';
import { Character } from '@/resources/game/models/character.model';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sword, Shield, Gem, Package, Zap, Sparkles, Heart, Droplets } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryPanelProps {
    character: Character;
    onEquipmentChange: () => void;
}

interface CharacterDrop {
    id: string;
    drop_id: string;
    quantity: number;
    drop?: MonsterDrop;
}

export const InventoryPanel: React.FC<InventoryPanelProps> = ({ character, onEquipmentChange }) => {
    const [equipment, setEquipment] = useState<CharacterEquipment[]>([]);
    const [equippedItems, setEquippedItems] = useState<EquipmentSlots>({
        main_hand: null,
        off_hand: null,
        armor: null,
        accessory: null
    });
    const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
    const [drops, setDrops] = useState<CharacterDrop[]>([]);
    const [loading, setLoading] = useState(true);
    const [usingConsumable, setUsingConsumable] = useState<string | null>(null);

    useEffect(() => {
        loadInventory();
    }, [character.id]);

    const loadInventory = async () => {
        try {
            setLoading(true);
            
            // Carregar equipamentos
            const [equipmentItems, equippedSlots] = await Promise.all([
                EquipmentService.getCharacterEquipment(character.id),
                EquipmentService.getEquippedSlots(character.id)
            ]);
            
            setEquipment(equipmentItems || []);
            setEquippedItems(equippedSlots || {
                weapon: null,
                armor: null,
                accessory: null
            });

            // Carregar consumíveis
            const consumablesResponse = await ConsumableService.getCharacterConsumables(character.id);
            if (consumablesResponse.success && consumablesResponse.data) {
                setConsumables(consumablesResponse.data);
            }

            // Carregar drops de monstros
            const dropsResponse = await ConsumableService.getCharacterDrops(character.id);
            if (dropsResponse.success && dropsResponse.data) {
                setDrops(dropsResponse.data);
            }
            
        } catch (error) {
            console.error('Erro ao carregar inventário:', error);
            toast.error('Erro ao carregar inventário');
            
            // Definir valores padrão em caso de erro
            setEquipment([]);
            setEquippedItems({
                main_hand: null,
                off_hand: null,
                armor: null,
                accessory: null
            });
            setConsumables([]);
            setDrops([]);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleEquip = async (item: CharacterEquipment) => {
        if (!item.equipment) {
            toast.error('Equipamento inválido');
            return;
        }

        try {
            const willEquip = !item.is_equipped;
            const success = await EquipmentService.toggleEquipment(character.id, item.equipment_id, willEquip);
            
            if (success) {
                await loadInventory();
                onEquipmentChange();
                toast.success(willEquip ? 'Item equipado!' : 'Item desequipado!');
            } else {
                toast.error('Erro ao equipar/desequipar item');
            }
        } catch (error) {
            console.error('Erro ao equipar/desequipar item:', error);
            toast.error('Erro ao equipar/desequipar item');
        }
    };

    const handleSellEquipment = async (item: CharacterEquipment) => {
        if (!item.equipment) {
            toast.error('Equipamento inválido');
            return;
        }

        const sellPrice = Math.floor(item.equipment.price / 2);
        
        if (!confirm(`Tem certeza que deseja vender ${item.equipment.name} por ${sellPrice} gold?`)) {
            return;
        }

        try {
            const success = await EquipmentService.sellEquipment(character.id, item.equipment_id);
            
            if (success) {
                await loadInventory();
                onEquipmentChange();
                toast.success(`${item.equipment.name} vendido por ${sellPrice} gold!`);
            } else {
                toast.error('Erro ao vender item');
            }
        } catch (error) {
            console.error('Erro ao vender item:', error);
            toast.error('Erro ao vender item');
        }
    };

    const handleUseConsumable = async (item: CharacterConsumable) => {
        if (!item.consumable || item.quantity <= 0) {
            toast.error('Consumível não disponível');
            return;
        }

        // Verificar se pode usar o consumível baseado no estado atual
        const canUse = checkCanUseConsumable(item);
        if (!canUse.allowed) {
            toast.warning(canUse.reason);
            return;
        }

        setUsingConsumable(item.consumable_id);

        try {
            const response = await ConsumableService.consumeItem(
                character.id,
                item.consumable_id,
                character
            );

            if (response.success && response.data) {
                await loadInventory();
                onEquipmentChange(); // Atualizar character na interface
                toast.success(response.data.message);
            } else {
                toast.error(response.error || 'Erro ao usar consumível');
            }
        } catch (error) {
            console.error('Erro ao usar consumível:', error);
            toast.error('Erro ao usar consumível');
        } finally {
            setUsingConsumable(null);
        }
    };

    const checkCanUseConsumable = (item: CharacterConsumable): { allowed: boolean; reason?: string } => {
        if (!item.consumable) {
            return { allowed: false, reason: 'Consumível inválido' };
        }

        switch (item.consumable.type) {
            case 'potion':
                if (item.consumable.description.includes('HP') || item.consumable.description.includes('Vida')) {
                    if (character.hp >= character.max_hp) {
                        return { allowed: false, reason: 'HP já está no máximo' };
                    }
                } else if (item.consumable.description.includes('Mana')) {
                    if (character.mana >= character.max_mana) {
                        return { allowed: false, reason: 'Mana já está no máximo' };
                    }
                }
                break;
            case 'antidote':
                return { allowed: false, reason: 'Use durante batalhas' };
            case 'buff':
                return { allowed: false, reason: 'Use durante batalhas' };
            default:
                return { allowed: false, reason: 'Tipo não suportado' };
        }

        return { allowed: true };
    };

    const getConsumableIcon = (type: string, description: string) => {
        if (type === 'potion') {
            if (description.includes('HP') || description.includes('Vida')) {
                return <Heart className="h-4 w-4 text-red-400" />;
            } else if (description.includes('Mana')) {
                return <Droplets className="h-4 w-4 text-blue-400" />;
            }
        }
        return <Zap className="h-4 w-4" />;
    };

    const getEquipmentIcon = (type: keyof EquipmentSlots) => {
        switch (type) {
            case 'main_hand': return <Sword className="h-6 w-6" />;
            case 'off_hand': return <Sword className="h-6 w-6" />;
            case 'armor': return <Shield className="h-6 w-6" />;
            case 'accessory': return <Gem className="h-6 w-6" />;
        }
    };

    const getEquipmentLabel = (type: keyof EquipmentSlots) => {
        switch (type) {
            case 'main_hand': return 'Arma';
            case 'off_hand': return 'Arma';
            case 'armor': return 'Armadura';
            case 'accessory': return 'Acessório';
        }
    };

    const getRarityColor = (rarity: Equipment['rarity'] | MonsterDrop['rarity']) => {
        const colors = {
            common: 'text-gray-400 bg-gray-900/50',
            uncommon: 'text-green-400 bg-green-900/50',
            rare: 'text-blue-400 bg-blue-900/50',
            epic: 'text-purple-400 bg-purple-900/50',
            legendary: 'text-yellow-400 bg-yellow-900/50'
        };
        return colors[rarity];
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="p-4 bg-card/95 border-2 border-primary/20 animate-pulse">
                            <div className="h-6 bg-muted rounded mb-2"></div>
                            <div className="h-4 bg-muted rounded mb-1"></div>
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Slots equipados */}
            <div>
                <h3 className="text-xl font-bold mb-4">Equipamentos Equipados</h3>
                <div className="grid grid-cols-3 gap-4">
                    {(['main_hand', 'off_hand', 'armor', 'accessory'] as const).map(type => {
                        const equipment = equippedItems?.[type];
                        
                        return (
                            <Card key={type} className="p-4 bg-card/95 border-2 border-primary/20">
                                <div className="flex items-center gap-2 mb-2">
                                    {getEquipmentIcon(type)}
                                    <h3 className="text-lg font-bold">{getEquipmentLabel(type)}</h3>
                                </div>
                                {equipment ? (
                                    <div>
                                        <p className="text-md font-semibold text-primary">{equipment.name}</p>
                                        <p className="text-sm text-muted-foreground">{equipment.description}</p>
                                        <div className="mt-2 text-sm space-y-1">
                                            {equipment.atk_bonus > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Sword className="h-4 w-4 text-red-400" />
                                                    <span>+{equipment.atk_bonus}</span>
                                                </div>
                                            )}
                                            {equipment.def_bonus > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Shield className="h-4 w-4 text-blue-400" />
                                                    <span>+{equipment.def_bonus}</span>
                                                </div>
                                            )}
                                            {equipment.mana_bonus > 0 && (
                                                <div className="flex items-center gap-1">
                                                    <Gem className="h-4 w-4 text-purple-400" />
                                                    <span>+{equipment.mana_bonus}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic">Vazio</p>
                                )}
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Inventário com abas */}
            <div>
                <h3 className="text-xl font-bold mb-4">Inventário</h3>
                <Tabs defaultValue="equipment" className="w-full">
                    <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="equipment" className="flex items-center gap-2">
                            <Sword className="h-4 w-4" />
                            Equipamentos
                        </TabsTrigger>
                        <TabsTrigger value="consumables" className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Consumíveis
                        </TabsTrigger>
                        <TabsTrigger value="drops" className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Materiais
                        </TabsTrigger>
                    </TabsList>

                    {/* Aba de Equipamentos */}
                    <TabsContent value="equipment" className="mt-6">
                        {!equipment || equipment.length === 0 ? (
                            <Card className="p-8 bg-card/95 text-center">
                                <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-lg font-medium text-muted-foreground">Nenhum equipamento no inventário</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Derrote inimigos para obter equipamentos
                                </p>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {equipment
                                    .filter(item => item && item.equipment)
                                    .map(item => (
                                    <Card key={item.id} className="p-4 bg-card/95">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h4 className="text-lg font-semibold text-primary">{item.equipment!.name}</h4>
                                                <p className="text-sm text-muted-foreground">{item.equipment!.description}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-sm ml-2 ${getRarityColor(item.equipment!.rarity)}`}>
                                                {item.equipment!.rarity}
                                            </span>
                                        </div>

                                        <div className="mt-2 space-y-1">
                                            {item.equipment!.atk_bonus > 0 && (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Sword className="h-4 w-4 text-red-400" />
                                                    <span>+{item.equipment!.atk_bonus}</span>
                                                </div>
                                            )}
                                            {item.equipment!.def_bonus > 0 && (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Shield className="h-4 w-4 text-blue-400" />
                                                    <span>+{item.equipment!.def_bonus}</span>
                                                </div>
                                            )}
                                            {item.equipment!.mana_bonus > 0 && (
                                                <div className="flex items-center gap-1 text-sm">
                                                    <Gem className="h-4 w-4 text-purple-400" />
                                                    <span>+{item.equipment!.mana_bonus}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="mt-4 flex gap-2">
                                            <Button
                                                onClick={() => handleToggleEquip(item)}
                                                variant={item.is_equipped ? "secondary" : "default"}
                                                className="flex-1"
                                            >
                                                {item.is_equipped ? 'Desequipar' : 'Equipar'}
                                            </Button>
                                            <Button
                                                onClick={() => handleSellEquipment(item)}
                                                variant="destructive"
                                                className="flex-1"
                                            >
                                                Vender ({Math.floor(item.equipment!.price / 2)} gold)
                                            </Button>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Aba de Consumíveis */}
                    <TabsContent value="consumables" className="mt-6">
                        {!consumables || consumables.length === 0 ? (
                            <Card className="p-8 bg-card/95 text-center">
                                <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-lg font-medium text-muted-foreground">Nenhum consumível no inventário</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Consumíveis podem ser comprados na loja ou encontrados em batalhas
                                </p>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {consumables
                                    .filter(item => item && item.consumable && item.quantity > 0)
                                    .map(item => {
                                        const canUse = checkCanUseConsumable(item);
                                        const isUsing = usingConsumable === item.consumable_id;
                                        
                                        return (
                                            <Card key={item.id} className="p-4 bg-card/95">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex-1">
                                                        <h4 className="text-lg font-semibold text-primary flex items-center gap-2">
                                                            {getConsumableIcon(item.consumable!.type, item.consumable!.description)}
                                                            {item.consumable!.name}
                                                        </h4>
                                                        <p className="text-sm text-muted-foreground">{item.consumable!.description}</p>
                                                        <p className="text-sm font-medium mt-1">Quantidade: {item.quantity}</p>
                                                        {item.consumable!.effect_value > 0 && (
                                                            <p className="text-xs text-green-600 mt-1">
                                                                Efeito: +{item.consumable!.effect_value}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="mt-4">
                                                    <Button
                                                        onClick={() => handleUseConsumable(item)}
                                                        disabled={!canUse.allowed || isUsing}
                                                        className="w-full"
                                                        variant={canUse.allowed ? "default" : "secondary"}
                                                    >
                                                        {isUsing ? 'Usando...' : canUse.allowed ? 'Usar' : canUse.reason}
                                                    </Button>
                                                </div>
                                            </Card>
                                        );
                                    })}
                            </div>
                        )}
                    </TabsContent>

                    {/* Aba de Materiais */}
                    <TabsContent value="drops" className="mt-6">
                        {!drops || drops.length === 0 ? (
                            <Card className="p-8 bg-card/95 text-center">
                                <Sparkles className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                                <p className="text-lg font-medium text-muted-foreground">Nenhum material no inventário</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Derrote monstros para obter materiais valiosos
                                </p>
                            </Card>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {drops
                                    .filter(item => item && item.drop && item.quantity > 0)
                                    .map(item => (
                                    <Card key={item.id} className="p-4 bg-card/95">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1">
                                                <h4 className="text-lg font-semibold text-primary">{item.drop!.name}</h4>
                                                <p className="text-sm text-muted-foreground">{item.drop!.description}</p>
                                                <p className="text-sm font-medium mt-1">Quantidade: {item.quantity}</p>
                                            </div>
                                            <span className={`px-2 py-1 rounded text-sm ml-2 ${getRarityColor(item.drop!.rarity)}`}>
                                                {item.drop!.rarity}
                                            </span>
                                        </div>

                                        <div className="mt-4">
                                            <p className="text-xs text-muted-foreground">
                                                Material valioso • Valor: {item.drop!.value} gold
                                            </p>
                                        </div>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}; 