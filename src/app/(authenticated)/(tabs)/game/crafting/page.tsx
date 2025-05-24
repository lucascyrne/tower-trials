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
import { CharacterConsumable, CraftingRecipe, MonsterDrop } from '@/resources/game/models/consumable.model';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';

// Tipos auxiliares para o processamento de receitas
interface ProcessedIngredient {
  name: string;
  quantity: number;
  have: number;
}

interface ProcessedRecipe {
  id: string;
  result_id: string;
  result: {
    name: string;
    description: string;
    type: string;
  };
  ingredients: ProcessedIngredient[];
  canCraft: boolean;
}

interface CraftingItemProps {
  recipe: ProcessedRecipe;
  onCraft: (recipeId: string) => void;
  disabled: boolean;
}

const CraftingItem: React.FC<CraftingItemProps> = ({ recipe, onCraft }) => {
  const getRecipeColor = () => {
    if (recipe.result.type === 'antidote') return 'bg-green-800/20 text-green-400';
    if (recipe.result.type === 'potion') return 'bg-red-800/20 text-red-400';
    return 'bg-blue-800/20 text-blue-400';
  };

  return (
    <Card className="bg-card/95">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>{recipe.result.name}</CardTitle>
            <CardDescription>{recipe.result.description}</CardDescription>
          </div>
          <Badge className={getRecipeColor()}>
            {recipe.result.type}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Ingredientes Necessários:</h4>
          {recipe.ingredients.map((ingredient, index) => (
            <div key={index} className="flex justify-between items-center text-sm">
              <span>{ingredient.name}</span>
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
          onClick={() => onCraft(recipe.result_id)}
          disabled={!recipe.canCraft}
        >
          {recipe.canCraft ? 'Criar' : 'Ingredientes Insuficientes'}
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
  const [recipes, setRecipes] = useState<CraftingRecipe[]>([]);
  const [inventory, setInventory] = useState<{
    consumables: CharacterConsumable[];
    drops: { id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[];
  }>({
    consumables: [],
    drops: []
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
  }, [mounted, characters, selectedCharacter, searchParams, router, selectCharacter]);

  // Carregar receitas e inventário
  useEffect(() => {
    if (!mounted || !selectedCharacter) return;
    
    const loadData = async () => {
      setLoading(true);
      
      try {
        // Carregar receitas
        const recipesRes = await ConsumableService.getCraftingRecipes();
        if (recipesRes.success && recipesRes.data) {
          setRecipes(recipesRes.data);
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
        const { data: dropsResponse } = await ConsumableService.getMonsterDrops();
        if (dropsResponse) {
          const characterDrops: { 
            id: string; 
            drop_id: string; 
            quantity: number; 
            drop?: MonsterDrop 
          }[] = [];
          
          setInventory(prev => ({ 
            ...prev, 
            drops: characterDrops 
          }));
        }
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
    if (!mounted || !recipes.length || !selectedCharacter) return;
    
    const processRecipes = async () => {
      const processed: ProcessedRecipe[] = [];
      
      for (const recipe of recipes) {
        try {
          // Verificar se o personagem pode criar este item
          const canCraftRes = await ConsumableService.canCraftItem(
            selectedCharacter.id, 
            recipe.result_id
          );
          
          if (canCraftRes.success && canCraftRes.data) {
            // Obter detalhes do item resultante
            const resultItem = inventory.consumables.find(
              c => c.consumable_id === recipe.result_id
            )?.consumable;
            
            if (resultItem) {
              // Processar ingredientes
              const processedIngredients = await Promise.all(recipe.ingredients.map(async ing => {
                let name = '';
                let have = 0;

                if (ing.item_type === 'monster_drop') {
                  // Buscar nome do drop
                  const { data: dropsResponse } = await ConsumableService.getMonsterDrops();
                  if (dropsResponse) {
                    const drop = dropsResponse.find(d => d.id === ing.item_id);
                    if (drop) {
                      name = drop.name;
                      // Verificar quantidade no inventário
                      const playerDrop = inventory.drops.find(d => d.drop_id === ing.item_id);
                      have = playerDrop?.quantity || 0;
                    }
                  }
                } else if (ing.item_type === 'consumable') {
                  // Buscar nome do consumível
                  const consumable = inventory.consumables.find(c => c.consumable_id === ing.item_id)?.consumable;
                  if (consumable) {
                    name = consumable.name;
                    // Verificar quantidade no inventário
                    const playerConsumable = inventory.consumables.find(c => c.consumable_id === ing.item_id);
                    have = playerConsumable?.quantity || 0;
                  }
                }

                return {
                  name,
                  quantity: ing.quantity,
                  have
                };
              }));

              processed.push({
                id: recipe.result_id,
                result_id: recipe.result_id,
                result: {
                  name: resultItem.name,
                  description: resultItem.description,
                  type: resultItem.type
                },
                ingredients: processedIngredients,
                canCraft: canCraftRes.data.canCraft
              });
            }
          }
        } catch (error) {
          console.error('Erro ao processar receita:', error);
        }
      }
      
      setProcessedRecipes(processed);
    };
    
    processRecipes();
  }, [mounted, recipes, inventory, selectedCharacter]);

  const handleCraftItem = async (recipeId: string) => {
    if (!selectedCharacter) return;
    
    setLoading(true);
    try {
      const result = await ConsumableService.craftItem(selectedCharacter.id, recipeId);
      
      if (result.success) {
        toast.success('Sucesso', {
          description: 'Item criado com sucesso!'
        });
        
        // Recarregar inventário
        const consumablesRes = await ConsumableService.getCharacterConsumables(selectedCharacter.id);
        if (consumablesRes.success && consumablesRes.data) {
          setInventory(prev => ({ 
            ...prev, 
            consumables: consumablesRes.data || [] 
          }));
        }
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
            <h1 className="text-2xl sm:text-3xl font-bold">Crafting</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Crie poções e elixires com os materiais coletados
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {processedRecipes.length > 0 ? (
              processedRecipes.map(recipe => (
                <CraftingItem 
                  key={recipe.id} 
                  recipe={recipe} 
                  onCraft={handleCraftItem} 
                  disabled={loading}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-8">
                <p className="text-gray-400">
                  {loading ? 'Carregando receitas...' : 'Nenhuma receita disponível'}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
        
        <TabsContent value="inventory">
          <div className="space-y-4">
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