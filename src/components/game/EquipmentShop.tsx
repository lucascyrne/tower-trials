import React, { useEffect, useState } from 'react';
import { Equipment } from '@/resources/game/models/equipment.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { Character } from '@/resources/game/models/character.model';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Sword, Shield, Gem, Coins, HelpCircle } from 'lucide-react';

interface EquipmentShopProps {
    character: Character;
    onPurchase: () => void;
}

export const EquipmentShop: React.FC<EquipmentShopProps> = ({ character, onPurchase }) => {
    const [availableEquipment, setAvailableEquipment] = useState<Equipment[]>([]);

    useEffect(() => {
        loadAvailableEquipment();
    }, [character.level]);

    const loadAvailableEquipment = async () => {
        try {
            const equipment = await EquipmentService.getAvailableEquipment(character.level);
            setAvailableEquipment(equipment);
        } catch (error) {
            console.error('Erro ao carregar equipamentos disponíveis:', error);
        }
    };

    const handlePurchase = async (equipment: Equipment) => {
        if (character.gold < equipment.price) {
            alert('Gold insuficiente para comprar este item!');
            return;
        }

        try {
            await EquipmentService.buyEquipment(character.id, equipment.id, equipment.price);
            onPurchase();
        } catch (error) {
            console.error('Erro ao comprar equipamento:', error);
            alert('Erro ao comprar equipamento!');
        }
    };

    const renderEquipmentCard = (equipment: Equipment) => {
        const isUnlocked = equipment.is_unlocked ?? false;

        if (!isUnlocked) {
            return (
                <Card key={equipment.id} className="p-4 bg-card/95 opacity-90">
                    <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center space-y-4">
                        <HelpCircle className="h-12 w-12 text-muted-foreground" />
                        <div>
                            <h3 className="text-lg font-semibold text-muted-foreground">Item Bloqueado</h3>
                            <p className="text-sm text-muted-foreground mt-2">
                                Você ainda não desbloqueou este item.
                                Continue explorando a torre para descobrir novos equipamentos!
                            </p>
                        </div>
                    </div>
                </Card>
            );
        }

        return (
            <Card key={equipment.id} className="p-4 bg-card/95">
                <div className="flex justify-between items-start mb-2">
                    <div>
                        <h3 className="text-lg font-semibold text-primary">{equipment.name}</h3>
                        <p className="text-sm text-muted-foreground">{equipment.description}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-sm ${getRarityColor(equipment.rarity)}`}>
                        {equipment.rarity}
                    </span>
                </div>

                <div className="space-y-2">
                    <p className="text-sm flex items-center gap-1">
                        <span className="text-muted-foreground">Nível Requerido:</span>
                        <span className={character.level >= equipment.level_requirement ? 'text-green-400' : 'text-red-400'}>
                            {equipment.level_requirement}
                        </span>
                    </p>

                    <div className="space-y-1">
                        {equipment.atk_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Sword className="h-4 w-4 text-red-400" />
                                <span>+{equipment.atk_bonus}</span>
                            </div>
                        )}
                        {equipment.def_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Shield className="h-4 w-4 text-blue-400" />
                                <span>+{equipment.def_bonus}</span>
                            </div>
                        )}
                        {equipment.mana_bonus > 0 && (
                            <div className="flex items-center gap-1 text-sm">
                                <Gem className="h-4 w-4 text-purple-400" />
                                <span>+{equipment.mana_bonus}</span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 text-yellow-400">
                        <Coins className="h-4 w-4" />
                        <span>{equipment.price}</span>
                    </div>
                    <Button
                        onClick={() => handlePurchase(equipment)}
                        disabled={character.gold < equipment.price || character.level < equipment.level_requirement}
                        variant={character.gold >= equipment.price ? "default" : "secondary"}
                        className="flex-1"
                    >
                        {character.gold < equipment.price ? 'Gold Insuficiente' : 'Comprar'}
                    </Button>
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Loja de Equipamentos</h2>
                <div className="flex items-center gap-2 text-lg text-yellow-400">
                    <Coins className="h-5 w-5" />
                    <span>{character.gold} gold</span>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableEquipment.map(equipment => renderEquipmentCard(equipment))}
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