import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { CharacterEquipment, EquipmentSlots } from '@/resources/game/models/equipment.model';
import { CharacterConsumable } from '@/resources/game/models/consumable.model';import { EquipmentService } from '@/resources/game/equipment.service';import { ConsumableService } from '@/resources/game/consumable.service';import { Character } from '@/resources/game/models/character.model';import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';import { Sword, Zap, Sparkles } from 'lucide-react';import { toast } from 'sonner';import { WeaponSlotSelectionModal } from './WeaponSlotSelectionModal';import { QuickPotionBar } from './QuickPotionBar';import { CharacterPaperDoll } from './CharacterPaperDoll';import { EquipmentFilters } from './EquipmentFilters';import { EquipmentCard } from './EquipmentCard';import { ConsumableCard } from './ConsumableCard';import { DropCard } from './DropCard';import { EmptyState } from './EmptyState';import { GoldDisplay } from './GoldDisplay';import { CharacterDrop, EquipmentFilter, WeaponSubtypeFilter, RarityFilter } from './types';interface InventoryPanelProps {    character: Character;    onEquipmentChange: () => void;}

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

    // Estados dos filtros
    const [equipmentFilter, setEquipmentFilter] = useState<EquipmentFilter>('all');
    const [weaponSubtypeFilter, setWeaponSubtypeFilter] = useState<WeaponSubtypeFilter>('all');
    const [rarityFilter, setRarityFilter] = useState<RarityFilter>('all');
    const [searchTerm, setSearchTerm] = useState('');

    // Modal de seleção de slot para armas
    const [showSlotModal, setShowSlotModal] = useState(false);
    const [pendingEquipment, setPendingEquipment] = useState<CharacterEquipment | null>(null);

    const loadInventory = useCallback(async () => {
        try {
            setLoading(true);
            
            // Carregar equipamentos
            const [equipmentItems, equippedSlots] = await Promise.all([
                EquipmentService.getCharacterEquipment(character.id),
                EquipmentService.getEquippedSlots(character.id)
            ]);
            
            setEquipment(equipmentItems || []);
            setEquippedItems(equippedSlots || {
                main_hand: null,
                off_hand: null,
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
        }, [character.id]);    useEffect(() => {
        loadInventory();
    }, []);

    const handleEquipItem = async (item: CharacterEquipment, slotType?: 'main_hand' | 'off_hand') => {
        if (!item.equipment) {
            toast.error('Equipamento inválido');
            return;
        }

        try {
            const result = await EquipmentService.toggleEquipment(
                character.id, 
                item.equipment_id, 
                true,
                slotType
            );
            
            if (result.success) {
                await loadInventory();
                onEquipmentChange();
                toast.success(`${item.equipment.name} equipado!`);
            } else {
                toast.error(result.error || 'Erro ao equipar item');
            }
        } catch (error) {
            console.error('Erro ao equipar item:', error);
            toast.error('Erro ao equipar item');
        }
    };

    const handleToggleEquip = async (item: CharacterEquipment) => {
        if (!item.equipment) {
            toast.error('Equipamento inválido');
            return;
        }

        // Se é uma arma e está tentando equipar, verificar se precisa do modal de seleção
        if (item.equipment.type === 'weapon' && !item.is_equipped) {
            setPendingEquipment(item);
            setShowSlotModal(true);
            return;
        }

        try {
            const willEquip = !item.is_equipped;
            const result = await EquipmentService.toggleEquipment(character.id, item.equipment_id, willEquip);
            
            if (result.success) {
                await loadInventory();
                onEquipmentChange();
                toast.success(willEquip ? 'Item equipado!' : 'Item desequipado!');
            } else {
                toast.error(result.error || 'Erro ao equipar/desequipar item');
            }
        } catch (error) {
            console.error('Erro ao equipar/desequipar item:', error);
            toast.error('Erro ao equipar/desequipar item');
        }
    };

    const handleUnequipSlot = async (slotType: keyof EquipmentSlots) => {
        const equippedItem = equippedItems[slotType];
        if (!equippedItem) return;

        try {
            const result = await EquipmentService.toggleEquipment(character.id, equippedItem.id, false);
            
            if (result.success) {
                await loadInventory();
                onEquipmentChange();
                toast.success(`${equippedItem.name} desequipado!`);
            } else {
                toast.error(result.error || 'Erro ao desequipar item');
            }
        } catch (error) {
            console.error('Erro ao desequipar item:', error);
            toast.error('Erro ao desequipar item');
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

    const handleSlotSelected = (slotType: 'main_hand' | 'off_hand') => {
        if (pendingEquipment) {
            handleEquipItem(pendingEquipment, slotType);
            setPendingEquipment(null);
            setShowSlotModal(false);
        }
    };

    const handleUseConsumable = async (item: CharacterConsumable) => {
        if (!item.consumable || item.quantity <= 0) {
            toast.error('Consumível não disponível');
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

    // Filtros aplicados aos equipamentos
    const filteredEquipment = useMemo(() => {
        return equipment
            .filter(item => item && item.equipment && !item.is_equipped) // Só mostrar não equipados
            .filter(item => {
                if (equipmentFilter !== 'all' && item.equipment!.type !== equipmentFilter) return false;
                if (weaponSubtypeFilter !== 'all' && item.equipment!.weapon_subtype !== weaponSubtypeFilter) return false;
                if (rarityFilter !== 'all' && item.equipment!.rarity !== rarityFilter) return false;
                if (searchTerm && !item.equipment!.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
                return true;
            });
    }, [equipment, equipmentFilter, weaponSubtypeFilter, rarityFilter, searchTerm]);

    const clearFilters = () => {
        setEquipmentFilter('all');
        setWeaponSubtypeFilter('all');
        setRarityFilter('all');
        setSearchTerm('');
    };

    if (loading) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[70vh]">
                <div className="lg:col-span-4 space-y-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="p-4 bg-card/95 border-2 border-primary/20 animate-pulse rounded">
                            <div className="h-20 bg-muted rounded"></div>
                        </div>
                    ))}
                </div>
                <div className="lg:col-span-8 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="p-4 bg-card/95 animate-pulse rounded">
                                <div className="h-24 bg-muted rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[70vh]">
            {/* Coluna esquerda - Paper Doll do Personagem */}
            <div className="lg:col-span-4 space-y-4">
                <CharacterPaperDoll 
                    character={character}
                    equippedItems={equippedItems}
                    onUnequipSlot={handleUnequipSlot}
                />

                {/* Gold Display */}
                <GoldDisplay gold={character.gold} />

                {/* Acesso Rápido a Poções */}
                <QuickPotionBar 
                    character={character}
                    consumables={consumables}
                    onConsumableUsed={loadInventory}
                />
            </div>

            {/* Coluna direita - Inventário com Abas */}
            <div className="lg:col-span-8">
                <Tabs defaultValue="equipment" className="w-full">
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="equipment" className="flex items-center gap-2">
                            <Sword className="h-4 w-4" />
                            Equipamentos ({equipment.filter(item => !item.is_equipped).length})
                        </TabsTrigger>
                        <TabsTrigger value="consumables" className="flex items-center gap-2">
                            <Zap className="h-4 w-4" />
                            Consumíveis ({consumables.length})
                        </TabsTrigger>
                        <TabsTrigger value="drops" className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4" />
                            Materiais ({drops.length})
                        </TabsTrigger>
                    </TabsList>

                    {/* Aba de Equipamentos */}
                    <TabsContent value="equipment" className="space-y-4">
                        {/* Barra de filtros */}
                        <EquipmentFilters
                            equipmentFilter={equipmentFilter}
                            weaponSubtypeFilter={weaponSubtypeFilter}
                            rarityFilter={rarityFilter}
                            searchTerm={searchTerm}
                            onEquipmentFilterChange={setEquipmentFilter}
                            onWeaponSubtypeFilterChange={setWeaponSubtypeFilter}
                            onRarityFilterChange={setRarityFilter}
                            onSearchTermChange={setSearchTerm}
                            onClearFilters={clearFilters}
                        />

                        {/* Lista de equipamentos */}
                        {filteredEquipment.length === 0 ? (
                            <EmptyState 
                                type="equipment" 
                                hasFilters={equipment.length > 0}
                            />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {filteredEquipment.map(item => (
                                    <EquipmentCard
                                        key={item.id}
                                        item={item}
                                        onEquipItem={handleToggleEquip}
                                        onSellItem={handleSellEquipment}
                                    />
                                ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Aba de Consumíveis */}
                    <TabsContent value="consumables" className="space-y-4">
                        {!consumables || consumables.length === 0 ? (
                            <EmptyState type="consumables" />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {consumables
                                    .filter(item => item && item.consumable && item.quantity > 0)
                                    .map(item => (
                                        <ConsumableCard
                                            key={item.id}
                                            item={item}
                                            character={character}
                                            isUsing={usingConsumable === item.consumable_id}
                                            onUseConsumable={handleUseConsumable}
                                        />
                                    ))}
                            </div>
                        )}
                    </TabsContent>

                    {/* Aba de Materiais */}
                    <TabsContent value="drops" className="space-y-4">
                        {!drops || drops.length === 0 ? (
                            <EmptyState type="drops" />
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                {drops
                                    .filter(item => item && item.drop && item.quantity > 0)
                                    .map(item => (
                                        <DropCard
                                            key={item.id}
                                            item={item}
                                        />
                                    ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            {/* Modal de seleção de slot para armas */}
            {pendingEquipment?.equipment && (
                <WeaponSlotSelectionModal
                    isOpen={showSlotModal}
                    onClose={() => {
                        setShowSlotModal(false);
                        setPendingEquipment(null);
                    }}
                    equipment={pendingEquipment.equipment}
                    onSlotSelected={handleSlotSelected}
                    currentMainHand={equippedItems.main_hand}
                    currentOffHand={equippedItems.off_hand}
                />
            )}
        </div>
    );
}; 