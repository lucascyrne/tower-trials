import React, { useEffect, useState } from 'react';
import { type Equipment, type CharacterEquipment, type EquipmentSlots } from '@/resources/game/models/equipment.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { type Character } from '@/resources/game/models/character.model';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sword, Shield, Gem, Package } from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentPanelProps {
    character: Character;
    onEquipmentChange: () => void;
}

export const EquipmentPanel: React.FC<EquipmentPanelProps> = ({ character, onEquipmentChange }) => {
    const [inventory, setInventory] = useState<CharacterEquipment[]>([]);
    const [equippedItems, setEquippedItems] = useState<EquipmentSlots>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadEquipment();
    }, [character.id]);

    const loadEquipment = async () => {
        try {
            setLoading(true);
            
            const [items, equipped] = await Promise.all([
                EquipmentService.getCharacterEquipment(character.id),
                EquipmentService.getEquippedItems(character.id)
            ]);
            
            setInventory(items || []);
            setEquippedItems(equipped || {
                weapon: null,
                armor: null,
                accessory: null
            });
        } catch (error) {
            console.error('Erro ao carregar equipamentos:', error);
            toast.error('Erro ao carregar equipamentos');
            
            // Definir valores padrão em caso de erro
            setInventory([]);
            setEquippedItems({});
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
                await loadEquipment();
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

    const handleSellItem = async (item: CharacterEquipment) => {
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
                await loadEquipment();
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

    const renderEquipmentSlot = (type: keyof EquipmentSlots) => {
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
                <div>
                    <div className="h-6 bg-muted rounded mb-4 w-32"></div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[1, 2].map(i => (
                            <Card key={i} className="p-4 bg-card/95 animate-pulse">
                                <div className="h-5 bg-muted rounded mb-2"></div>
                                <div className="h-4 bg-muted rounded mb-4 w-3/4"></div>
                                <div className="flex gap-2">
                                    <div className="h-8 bg-muted rounded flex-1"></div>
                                    <div className="h-8 bg-muted rounded flex-1"></div>
                                </div>
                            </Card>
                        ))}
                    </div>
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
                    {(['main_hand', 'off_hand', 'armor', 'accessory'] as const).map(type => 
                        renderEquipmentSlot(type)
                    )}
                </div>
            </div>

            {/* Inventário */}
            <div>
                <h3 className="text-xl font-bold mb-4">Inventário</h3>
                {!inventory || inventory.length === 0 ? (
                    <Card className="p-8 bg-card/95 text-center">
                        <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-lg font-medium text-muted-foreground">Nenhum equipamento no inventário</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Derrote inimigos ou visite lojas para obter equipamentos
                        </p>
                    </Card>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {inventory
                            .filter(item => item && item.equipment) // Filtrar itens válidos
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
                                        onClick={() => handleSellItem(item)}
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
            </div>
        </div>
    );
};

const getRarityColor = (rarity: Equipment['rarity']) => {
    const colors = {
        common: 'text-gray-400 bg-gray-900/50',
        uncommon: 'text-green-400 bg-green-900/50',
        rare: 'text-blue-400 bg-blue-900/50',
        epic: 'text-purple-400 bg-purple-900/50',
        legendary: 'text-yellow-400 bg-yellow-900/50'
    };
    return colors[rarity];
}; 