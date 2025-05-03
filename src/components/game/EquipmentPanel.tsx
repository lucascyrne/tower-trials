import React, { useEffect, useState } from 'react';
import { Equipment, CharacterEquipment, EquipmentSlots } from '@/resources/game/models/equipment.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { Character } from '@/resources/game/models/character.model';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sword, Shield, Gem } from 'lucide-react';

interface EquipmentPanelProps {
    character: Character;
    onEquipmentChange: () => void;
}

export const EquipmentPanel: React.FC<EquipmentPanelProps> = ({ character, onEquipmentChange }) => {
    const [inventory, setInventory] = useState<CharacterEquipment[]>([]);
    const [equippedItems, setEquippedItems] = useState<EquipmentSlots>({
        weapon: null,
        armor: null,
        accessory: null
    });

    useEffect(() => {
        loadEquipment();
    }, [character.id]);

    const loadEquipment = async () => {
        try {
            const items = await EquipmentService.getCharacterEquipment(character.id);
            setInventory(items);

            const equipped = await EquipmentService.getEquippedSlots(character.id);
            setEquippedItems(equipped);
        } catch (error) {
            console.error('Erro ao carregar equipamentos:', error);
        }
    };

    const handleToggleEquip = async (item: CharacterEquipment) => {
        try {
            const willEquip = !item.is_equipped;
            await EquipmentService.toggleEquipment(character.id, item.equipment_id, willEquip);
            await loadEquipment();
            onEquipmentChange();
        } catch (error) {
            console.error('Erro ao equipar/desequipar item:', error);
        }
    };

    const handleSellItem = async (item: CharacterEquipment) => {
        if (!confirm('Tem certeza que deseja vender este item?')) return;

        try {
            await EquipmentService.sellEquipment(character.id, item.equipment_id);
            await loadEquipment();
            onEquipmentChange();
        } catch (error) {
            console.error('Erro ao vender item:', error);
        }
    };

    const getEquipmentIcon = (type: keyof EquipmentSlots) => {
        switch (type) {
            case 'weapon': return <Sword className="h-6 w-6" />;
            case 'armor': return <Shield className="h-6 w-6" />;
            case 'accessory': return <Gem className="h-6 w-6" />;
        }
    };

    const getEquipmentLabel = (type: keyof EquipmentSlots) => {
        switch (type) {
            case 'weapon': return 'Arma';
            case 'armor': return 'Armadura';
            case 'accessory': return 'Acessório';
        }
    };

    const renderEquipmentSlot = (type: keyof EquipmentSlots) => {
        const equipment = equippedItems[type];
        return (
            <Card className="p-4 bg-card/95 border-2 border-primary/20">
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

    return (
        <div className="space-y-6">
            {/* Slots equipados */}
            <div className="grid grid-cols-3 gap-4">
                {(['weapon', 'armor', 'accessory'] as const).map(type => 
                    renderEquipmentSlot(type)
                )}
            </div>

            {/* Inventário */}
            <div>
                <h3 className="text-xl font-bold mb-4">Inventário</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {inventory.map(item => item.equipment && (
                        <Card key={item.id} className="p-4 bg-card/95">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h4 className="text-lg font-semibold text-primary">{item.equipment.name}</h4>
                                    <p className="text-sm text-muted-foreground">{item.equipment.description}</p>
                                </div>
                                <span className={`px-2 py-1 rounded text-sm ${getRarityColor(item.equipment.rarity)}`}>
                                    {item.equipment.rarity}
                                </span>
                            </div>

                            <div className="mt-2 space-y-1">
                                {item.equipment.atk_bonus > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <Sword className="h-4 w-4 text-red-400" />
                                        <span>+{item.equipment.atk_bonus}</span>
                                    </div>
                                )}
                                {item.equipment.def_bonus > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <Shield className="h-4 w-4 text-blue-400" />
                                        <span>+{item.equipment.def_bonus}</span>
                                    </div>
                                )}
                                {item.equipment.mana_bonus > 0 && (
                                    <div className="flex items-center gap-1 text-sm">
                                        <Gem className="h-4 w-4 text-purple-400" />
                                        <span>+{item.equipment.mana_bonus}</span>
                                    </div>
                                )}
                            </div>

                            <div className="mt-4 flex justify-between gap-2">
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
                                    Vender ({Math.floor(item.equipment.price / 2)} gold)
                                </Button>
                            </div>
                        </Card>
                    ))}
                </div>
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