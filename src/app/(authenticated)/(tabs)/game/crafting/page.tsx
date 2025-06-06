'use client';

import { useEffect, useState } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ConsumableService } from '@/resources/game/consumable.service';
import { EquipmentService } from '@/resources/game/equipment.service';
import { CharacterConsumable, CraftingRecipe, MonsterDrop } from '@/resources/game/models/consumable.model';
import { CharacterEquipment, EquipmentCraftingRecipe } from '@/resources/game/models/equipment.model';
import { toast } from 'sonner';
import { ArrowLeft, Hammer, Sword, Shield, Gem } from 'lucide-react';

// Tipos auxiliares para o processamento de receitas
interface ProcessedIngredient {
  name: string;
  quantity: number;
  have: number;
  type: string; // 'drop', 'consumable', 'equipment'
}

interface ProcessedConsumableRecipe {
  id: string;
  result_id: string;
  result: {
    name: string;
    description: string;
    type: string;
  };
  ingredients: ProcessedIngredient[];
  canCraft: boolean;
  craftType: 'consumable';
}

interface ProcessedEquipmentRecipe {
  id: string;
  result_equipment_id: string;
  result: {
    name: string;
    description: string;
    type: string;
    rarity: string;
  };
  ingredients: ProcessedIngredient[];
  canCraft: boolean;
  craftType: 'equipment';
}

type ProcessedRecipe = ProcessedConsumableRecipe | ProcessedEquipmentRecipe;

interface CraftingItemProps {
  recipe: ProcessedRecipe;
  onCraft: (recipeId: string, craftType: 'consumable' | 'equipment') => void;
  disabled: boolean;
}

const CraftingItem: React.FC<CraftingItemProps> = ({ recipe, onCraft }) => {
  const getRecipeColor = () => {
    if (recipe.craftType === 'equipment') {
      const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
      switch (equipmentRecipe.result.rarity) {
        case 'epic': return 'bg-purple-800/20 text-purple-400';
        case 'legendary': return 'bg-orange-800/20 text-orange-400';
        case 'rare': return 'bg-blue-800/20 text-blue-400';
        default: return 'bg-gray-800/20 text-gray-400';
      }
    } else {
      const consumableRecipe = recipe as ProcessedConsumableRecipe;
      if (consumableRecipe.result.type === 'antidote') return 'bg-green-800/20 text-green-400';
      if (consumableRecipe.result.type === 'potion') return 'bg-red-800/20 text-red-400';
      if (consumableRecipe.result.type === 'elixir') return 'bg-purple-800/20 text-purple-400';
      return 'bg-blue-800/20 text-blue-400';
    }
  };

  const getRecipeIcon = () => {
    if (recipe.craftType === 'equipment') {
      const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
      switch (equipmentRecipe.result.type) {
        case 'weapon': return <Sword className="h-4 w-4" />;
        case 'armor': return <Shield className="h-4 w-4" />;
        case 'accessory': return <Gem className="h-4 w-4" />;
        default: return <Hammer className="h-4 w-4" />;
      }
    }
    return <Hammer className="h-4 w-4" />;
  };

  const getButtonText = () => {
    if (recipe.craftType === 'equipment') {
      return recipe.canCraft ? 'Forjar' : 'Materiais Insuficientes';
    }
    return recipe.canCraft ? 'Criar' : 'Ingredientes Insuficientes';
  };

  return (
    <Card className="bg-card/95">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div className="flex items-start gap-2">
            {getRecipeIcon()}
            <div>
              <CardTitle>{recipe.result.name}</CardTitle>
              <CardDescription>{recipe.result.description}</CardDescription>
            </div>
          </div>
          <Badge className={getRecipeColor()}>
            {recipe.craftType === 'equipment' 
              ? (recipe as ProcessedEquipmentRecipe).result.rarity 
              : (recipe as ProcessedConsumableRecipe).result.type
            }
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="text-sm font-medium">
            {recipe.craftType === 'equipment' ? 'Materiais Necessários:' : 'Ingredientes Necessários:'}
          </h4>
          {recipe.ingredients.map((ingredient, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span className="flex items-center gap-1">
                {ingredient.type === 'equipment' && <Hammer className="h-3 w-3" />}
                {ingredient.name}
              </span>
              <div className="flex items-center gap-2">
                <span className={ingredient.have >= ingredient.quantity ? 'text-green-400' : 'text-red-400'}>
                  {ingredient.have}/{ingredient.quantity}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          className="w-full" 
          onClick={() => onCraft(
            recipe.craftType === 'equipment' 
              ? (recipe as ProcessedEquipmentRecipe).result_equipment_id 
              : (recipe as ProcessedConsumableRecipe).result_id,
            recipe.craftType
          )}
          disabled={!recipe.canCraft}
        >
          {getButtonText()}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default function CraftingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { characters, selectedCharacter, selectCharacter } = useGame();
  const [loading, setLoading] = useState(false);
  const [consumableRecipes, setConsumableRecipes] = useState<CraftingRecipe[]>([]);
  const [equipmentRecipes, setEquipmentRecipes] = useState<EquipmentCraftingRecipe[]>([]);
  const [inventory, setInventory] = useState<{
    consumables: CharacterConsumable[];
    drops: { id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[];
    equipment: CharacterEquipment[];
  }>({
    consumables: [],
    drops: [],
    equipment: []
  });
  const [processedRecipes, setProcessedRecipes] = useState<ProcessedRecipe[]>([]);
  const [mounted, setMounted] = useState(false);

  // Garantir que só execute no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const characterId = searchParams.get('character');
    if (characterId && characters.length > 0) {
      const character = characters.find(char => char.id === characterId);
      if (character && (!selectedCharacter || selectedCharacter.id !== characterId)) {
        selectCharacter(character);
      }
    } else if (!characterId && characters.length > 0) {
      router.push(`/game/crafting?character=${characters[0].id}`);
    }
  }, [mounted, characters, selectedCharacter, searchParams]);

  // Carregar receitas e inventário
  useEffect(() => {
    if (!mounted || !selectedCharacter) return;
    
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Carregar receitas de consumíveis
        const consumableRecipesRes = await ConsumableService.getCraftingRecipes();
        if (consumableRecipesRes.success && consumableRecipesRes.data) {
          setConsumableRecipes(consumableRecipesRes.data);
        }

        // Carregar receitas de equipamentos
        const equipmentRecipesRes = await EquipmentService.getEquipmentCraftingRecipes();
        if (equipmentRecipesRes.success && equipmentRecipesRes.data) {
          setEquipmentRecipes(equipmentRecipesRes.data);
        }
        
        // Carregar inventário de consumíveis
        const consumablesRes = await ConsumableService.getCharacterConsumables(selectedCharacter.id);
        if (consumablesRes.success && consumablesRes.data) {
          setInventory(prev => ({ 
            ...prev, 
            consumables: consumablesRes.data || [] 
          }));
        }
        
        // Carregar drops do personagem
        const dropsRes = await ConsumableService.getCharacterDrops(selectedCharacter.id);
        if (dropsRes.success && dropsRes.data) {
          setInventory(prev => ({ 
            ...prev, 
            drops: dropsRes.data || [] 
          }));
        }

        // Carregar equipamentos do personagem
        const equipmentList = await EquipmentService.getCharacterEquipment(selectedCharacter.id);
        setInventory(prev => ({ 
          ...prev, 
          equipment: equipmentList || [] 
        }));

      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro', {
          description: 'Erro ao carregar receitas e inventário.'
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [mounted, selectedCharacter]);

  // Processar receitas com informações de ingredientes
  useEffect(() => {
    if (!mounted || (!consumableRecipes.length && !equipmentRecipes.length) || !selectedCharacter) return;
    
    const processRecipes = async () => {
      const processed: ProcessedRecipe[] = [];
      
      // Processar receitas de consumíveis
      for (const recipe of consumableRecipes) {
        try {
          const resultItem = inventory.consumables.find(
            c => c.consumable_id === recipe.result_id
          )?.consumable;
          
          let resultInfo;
          if (!resultItem) {
            const consumablesRes = await ConsumableService.getAvailableConsumables();
            if (consumablesRes.success && consumablesRes.data) {
              const found = consumablesRes.data.find(c => c.id === recipe.result_id);
              if (found) {
                resultInfo = {
                  name: found.name,
                  description: found.description,
                  type: found.type
                };
              }
            }
          } else {
            resultInfo = {
              name: resultItem.name,
              description: resultItem.description,
              type: resultItem.type
            };
          }

          if (resultInfo) {
            const processedIngredients = await Promise.all(recipe.ingredients.map(async ing => {
              let name = '';
              let have = 0;
              let type = 'drop';

              if (ing.item_type === 'monster_drop') {
                const drop = inventory.drops.find(d => d.drop_id === ing.item_id)?.drop;
                if (drop) {
                  name = drop.name;
                  have = inventory.drops.find(d => d.drop_id === ing.item_id)?.quantity || 0;
                } else {
                  const { data: allDrops } = await ConsumableService.getMonsterDrops();
                  const foundDrop = allDrops?.find(d => d.id === ing.item_id);
                  name = foundDrop?.name || 'Item desconhecido';
                  have = 0;
                }
                type = 'drop';
              } else if (ing.item_type === 'consumable') {
                const playerConsumable = inventory.consumables.find(c => c.consumable_id === ing.item_id);
                if (playerConsumable?.consumable) {
                  name = playerConsumable.consumable.name;
                  have = playerConsumable.quantity;
                } else {
                  const consumablesRes = await ConsumableService.getAvailableConsumables();
                  if (consumablesRes.success && consumablesRes.data) {
                    const foundConsumable = consumablesRes.data.find(c => c.id === ing.item_id);
                    name = foundConsumable?.name || 'Item desconhecido';
                    have = 0;
                  }
                }
                type = 'consumable';
              }

              return {
                name,
                quantity: ing.quantity,
                have,
                type
              };
            }));

            const canCraft = processedIngredients.every(ing => ing.have >= ing.quantity);

            processed.push({
              id: recipe.result_id,
              result_id: recipe.result_id,
              result: resultInfo,
              ingredients: processedIngredients,
              canCraft,
              craftType: 'consumable'
            } as ProcessedConsumableRecipe);
          }
        } catch (error) {
          console.error('Erro ao processar receita de consumível:', error);
        }
      }

      // Processar receitas de equipamentos
      for (const recipe of equipmentRecipes) {
        try {
          if (recipe.equipment) {
            const processedIngredients = await Promise.all(recipe.ingredients.map(async ing => {
              let name = '';
              let have = 0;
              let type = 'drop';

              if (ing.item_type === 'monster_drop') {
                const drop = inventory.drops.find(d => d.drop_id === ing.item_id)?.drop;
                if (drop) {
                  name = drop.name;
                  have = inventory.drops.find(d => d.drop_id === ing.item_id)?.quantity || 0;
                } else {
                  const { data: allDrops } = await ConsumableService.getMonsterDrops();
                  const foundDrop = allDrops?.find(d => d.id === ing.item_id);
                  name = foundDrop?.name || 'Item desconhecido';
                  have = 0;
                }
                type = 'drop';
              } else if (ing.item_type === 'consumable') {
                const playerConsumable = inventory.consumables.find(c => c.consumable_id === ing.item_id);
                if (playerConsumable?.consumable) {
                  name = playerConsumable.consumable.name;
                  have = playerConsumable.quantity;
                } else {
                  const consumablesRes = await ConsumableService.getAvailableConsumables();
                  if (consumablesRes.success && consumablesRes.data) {
                    const foundConsumable = consumablesRes.data.find(c => c.id === ing.item_id);
                    name = foundConsumable?.name || 'Item desconhecido';
                    have = 0;
                  }
                }
                type = 'consumable';
              } else if (ing.item_type === 'equipment') {
                const playerEquipment = inventory.equipment.filter(e => e.equipment_id === ing.item_id && !e.is_equipped);
                if (playerEquipment.length > 0 && playerEquipment[0].equipment) {
                  name = playerEquipment[0].equipment.name;
                  have = playerEquipment.length;
                } else {
                  // Buscar na lista geral de equipamentos se necessário
                  name = 'Equipamento desconhecido';
                  have = 0;
                }
                type = 'equipment';
              }

              return {
                name,
                quantity: ing.quantity,
                have,
                type
              };
            }));

            const canCraft = processedIngredients.every(ing => ing.have >= ing.quantity);

            processed.push({
              id: recipe.id,
              result_equipment_id: recipe.result_equipment_id,
              result: {
                name: recipe.equipment.name,
                description: recipe.equipment.description,
                type: recipe.equipment.type,
                rarity: recipe.equipment.rarity
              },
              ingredients: processedIngredients,
              canCraft,
              craftType: 'equipment'
            } as ProcessedEquipmentRecipe);
          }
        } catch (error) {
          console.error('Erro ao processar receita de equipamento:', error);
        }
      }
      
      setProcessedRecipes(processed);
    };
    
    processRecipes();
  }, [mounted, consumableRecipes, equipmentRecipes, inventory, selectedCharacter]);

  const handleCraftItem = async (recipeId: string, craftType: 'consumable' | 'equipment') => {
    if (!selectedCharacter) return;
    
    setLoading(true);
    try {
      let result;
      
      if (craftType === 'consumable') {
        result = await ConsumableService.craftItem(selectedCharacter.id, recipeId);
      } else {
        result = await EquipmentService.craftEquipment(selectedCharacter.id, recipeId);
      }
      
      if (result.success) {
        toast.success('Sucesso', {
          description: result.data?.message || 'Item criado com sucesso!'
        });
        
        // Recarregar inventário
        const [consumablesRes, dropsRes, equipmentList] = await Promise.all([
          ConsumableService.getCharacterConsumables(selectedCharacter.id),
          ConsumableService.getCharacterDrops(selectedCharacter.id),
          EquipmentService.getCharacterEquipment(selectedCharacter.id)
        ]);
        
        if (consumablesRes.success && consumablesRes.data) {
          setInventory(prev => ({ 
            ...prev, 
            consumables: consumablesRes.data || [] 
          }));
        }
        
        if (dropsRes.success && dropsRes.data) {
          setInventory(prev => ({ 
            ...prev, 
            drops: dropsRes.data || [] 
          }));
        }

        setInventory(prev => ({ 
          ...prev, 
          equipment: equipmentList || [] 
        }));
        
      } else {
        toast.error('Erro', {
          description: result.error || 'Erro ao criar item.'
        });
      }
    } catch (error) {
      console.error('Erro ao criar item:', error);
      toast.error('Erro', {
        description: 'Erro ao criar item.'
      });
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading até montar o componente
  if (!mounted) {
    return (
      <div className="container py-6 text-center">
        <p>Carregando...</p>
      </div>
    );
  }

  if (!selectedCharacter) {
    return (
      <div className="container py-6 text-center">
        <p>Selecione um personagem para acessar o crafting.</p>
      </div>
    );
  }

  return (
    <div className="container py-4 sm:py-6">
      {/* Header padronizado */}
      <div className="space-y-3 sm:space-y-4 mb-6">
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/game/play/hub?character=${selectedCharacter.id}`)}
            className="self-start"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Voltar ao Hub</span>
            <span className="sm:hidden">Voltar</span>
          </Button>
          
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Forja de Artefatos</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Crie poções, elixires e forje equipamentos únicos com materiais raros
            </p>
          </div>
        </div>
      </div>
      
      <Tabs defaultValue="crafting">
        <TabsList className="mb-4">
          <TabsTrigger value="crafting">Receitas</TabsTrigger>
          <TabsTrigger value="inventory">Inventário</TabsTrigger>
        </TabsList>
        
        <TabsContent value="crafting">
          <div className="space-y-6">
            {/* Seção de Equipamentos Craftáveis */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Hammer className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Equipamentos Forjáveis</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedRecipes.filter(r => r.craftType === 'equipment').length > 0 ? (
                  processedRecipes
                    .filter(r => r.craftType === 'equipment')
                    .map(recipe => (
                      <CraftingItem 
                        key={recipe.id} 
                        recipe={recipe} 
                        onCraft={handleCraftItem} 
                        disabled={loading}
                      />
                    ))
                ) : (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-400">
                      Nenhuma receita de equipamento disponível
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Seção de Consumíveis */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Gem className="h-5 w-5" />
                <h2 className="text-xl font-semibold">Poções e Elixires</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedRecipes.filter(r => r.craftType === 'consumable').length > 0 ? (
                  processedRecipes
                    .filter(r => r.craftType === 'consumable')
                    .map(recipe => (
                      <CraftingItem 
                        key={recipe.id} 
                        recipe={recipe} 
                        onCraft={handleCraftItem} 
                        disabled={loading}
                      />
                    ))
                ) : (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-400">
                      {loading ? 'Carregando receitas...' : 'Nenhuma receita de consumível disponível'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="inventory">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold mb-2">Equipamentos</h2>
              <Separator className="mb-3" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.equipment.length > 0 ? (
                  inventory.equipment.map(item => (
                    <Card key={item.id} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="flex items-center gap-2">
                            {item.equipment?.type === 'weapon' && <Sword className="h-4 w-4" />}
                            {item.equipment?.type === 'armor' && <Shield className="h-4 w-4" />}
                            {item.equipment?.type === 'accessory' && <Gem className="h-4 w-4" />}
                            <CardTitle className="text-lg">{item.equipment?.name}</CardTitle>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge variant={item.is_equipped ? 'default' : 'outline'}>
                              {item.is_equipped ? 'Equipado' : 'Inventário'}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {item.equipment?.rarity}
                            </Badge>
                          </div>
                        </div>
                        <CardDescription>{item.equipment?.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-400">
                      {loading ? 'Carregando equipamentos...' : 'Nenhum equipamento disponível'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <h2 className="text-xl font-semibold mb-2">Consumíveis</h2>
              <Separator className="mb-3" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.consumables.length > 0 ? (
                  inventory.consumables.map(item => (
                    <Card key={item.consumable_id} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          <CardTitle className="text-lg">{item.consumable?.name}</CardTitle>
                          <Badge variant="outline">x{item.quantity}</Badge>
                        </div>
                        <CardDescription>{item.consumable?.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-400">
                      {loading ? 'Carregando consumíveis...' : 'Nenhum consumível disponível'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <h2 className="text-xl font-semibold mb-2">Materiais</h2>
              <Separator className="mb-3" />
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inventory.drops.length > 0 ? (
                  inventory.drops.map(item => (
                    <Card key={item.drop_id} className="bg-gray-800/50 border-gray-700">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between">
                          <CardTitle className="text-lg">{item.drop?.name}</CardTitle>
                          <Badge variant="outline">x{item.quantity}</Badge>
                        </div>
                        <CardDescription>{item.drop?.description}</CardDescription>
                      </CardHeader>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-4">
                    <p className="text-gray-400">
                      {loading ? 'Carregando materiais...' : 'Nenhum material disponível'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 