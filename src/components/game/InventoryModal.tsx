import React, { useState, useEffect } from 'react';
import { Equipment, CharacterEquipment } from '@/resources/game/models/equipment.model';
import { CharacterConsumable, MonsterDrop } from '@/resources/game/models/consumable.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { ConsumableService } from '@/resources/game/consumable.service';
import { Character } from '@/resources/game/models/character.model';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sword, Shield, Gem, Package, Sparkles, Coins } from 'lucide-react';
import { toast } from 'sonner';

interface InventoryModalProps {
  character: Character;
  isOpen: boolean;
  onClose: () => void;
  onItemSold: () => void;
}

interface CharacterDrop {
  id: string;
  drop_id: string;
  quantity: number;
  drop?: MonsterDrop;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({ 
  character, 
  isOpen, 
  onClose, 
  onItemSold 
}) => {
  const [equipment, setEquipment] = useState<CharacterEquipment[]>([]);
  const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
  const [drops, setDrops] = useState<CharacterDrop[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && character.id) {
      loadInventory();
    }
  }, [isOpen, character.id]);

  const loadInventory = async () => {
    setLoading(true);
    try {
      // Carregar equipamentos
      const equipmentData = await EquipmentService.getCharacterEquipment(character.id);
      setEquipment(equipmentData);

      // Carregar consumíveis
      const consumablesRes = await ConsumableService.getCharacterConsumables(character.id);
      if (consumablesRes.success && consumablesRes.data) {
        setConsumables(consumablesRes.data);
      }

      // Carregar drops
      const dropsRes = await ConsumableService.getCharacterDrops(character.id);
      if (dropsRes.success && dropsRes.data) {
        setDrops(dropsRes.data);
      }
    } catch (error) {
      console.error('Erro ao carregar inventário:', error);
      toast.error('Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  const handleSellEquipment = async (item: CharacterEquipment) => {
    if (!item.equipment) return;

    try {
      const success = await EquipmentService.sellEquipment(character.id, item.equipment.id);
      
      if (success) {
        toast.success(`${item.equipment.name} vendido com sucesso!`);
        onItemSold();
        loadInventory(); // Recarregar inventário
      } else {
        toast.error('Erro ao vender item');
      }
    } catch (error) {
      console.error('Erro ao vender equipamento:', error);
      toast.error('Erro ao vender item');
    }
  };

  const handleToggleEquip = async (item: CharacterEquipment) => {
    if (!item.equipment) return;

    try {
      const success = await EquipmentService.toggleEquipment(
        character.id,
        item.equipment.id,
        !item.is_equipped
      );
      
      if (success) {
        toast.success(
          item.is_equipped 
            ? `${item.equipment.name} desequipado!` 
            : `${item.equipment.name} equipado!`
        );
        loadInventory(); // Recarregar para mostrar mudanças
      } else {
        toast.error('Erro ao equipar/desequipar item');
      }
    } catch (error) {
      console.error('Erro ao equipar/desequipar:', error);
      toast.error('Erro ao equipar/desequipar item');
    }
  };

  const getSellPrice = (item: Equipment) => {
    const rarityMultiplier = {
      common: 0.3,
      uncommon: 0.35,
      rare: 0.4,
      epic: 0.45,
      legendary: 0.5
    };
    return Math.floor(item.price * rarityMultiplier[item.rarity]);
  };

  const getDropSellPrice = (drop: MonsterDrop) => {
    // Valor base do drop como preço de venda
    return drop.value || 1;
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
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando inventário...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Inventário - {character.name}</span>
            <div className="flex items-center gap-2 text-sm text-yellow-400">
              <Coins className="h-4 w-4" />
              <span>{character.gold} gold</span>
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="equipment" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="equipment" className="flex items-center gap-2">
              <Sword className="h-4 w-4" />
              Equipamentos ({equipment.length})
            </TabsTrigger>
            <TabsTrigger value="consumables" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Consumíveis ({consumables.length})
            </TabsTrigger>
            <TabsTrigger value="drops" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Drops ({drops.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="equipment" className="space-y-4">
            {equipment.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum equipamento encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {equipment.map((item) => item.equipment && (
                  <Card key={item.id} className={`p-4 relative ${item.is_equipped ? 'ring-2 ring-primary' : ''}`}>
                    {item.is_equipped && (
                      <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs">
                        Equipado
                      </div>
                    )}
                    
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">{item.equipment.name}</h3>
                        <span className={`px-2 py-1 rounded text-xs ${getRarityColor(item.equipment.rarity)}`}>
                          {item.equipment.rarity}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {item.equipment.description}
                    </p>

                    <div className="space-y-1 mb-3">
                      {item.equipment.atk_bonus > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Sword className="h-3 w-3 text-red-400" />
                          <span>+{item.equipment.atk_bonus}</span>
                        </div>
                      )}
                      {item.equipment.def_bonus > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Shield className="h-3 w-3 text-blue-400" />
                          <span>+{item.equipment.def_bonus}</span>
                        </div>
                      )}
                      {item.equipment.mana_bonus > 0 && (
                        <div className="flex items-center gap-1 text-xs">
                          <Gem className="h-3 w-3 text-purple-400" />
                          <span>+{item.equipment.mana_bonus}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs mb-3">
                      <span className="text-yellow-400">
                        Venda: {getSellPrice(item.equipment)} gold
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={item.is_equipped ? "secondary" : "default"}
                        onClick={() => handleToggleEquip(item)}
                        className="flex-1 text-xs"
                      >
                        {item.is_equipped ? 'Desequipar' : 'Equipar'}
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleSellEquipment(item)}
                        className="flex-1 text-xs"
                      >
                        Vender
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="consumables" className="space-y-4">
            {consumables.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum consumível encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {consumables.map((item) => item.consumable && (
                  <Card key={item.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">{item.consumable.name}</h3>
                        <p className="text-xs text-muted-foreground">Quantidade: {item.quantity}</p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {item.consumable.description}
                    </p>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-400">
                        Tipo: {item.consumable.type}
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="drops" className="space-y-4">
            {drops.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum drop encontrado</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {drops.map((item) => item.drop && (
                  <Card key={item.id} className="p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-semibold text-sm">{item.drop.name}</h3>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                          <span className={`px-2 py-1 rounded text-xs ${getRarityColor(item.drop.rarity)}`}>
                            {item.drop.rarity}
                          </span>
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                      {item.drop.description}
                    </p>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-yellow-400">
                        Valor: {getDropSellPrice(item.drop)} gold cada
                      </span>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}; 