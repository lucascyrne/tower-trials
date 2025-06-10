import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState, useMemo } from 'react';
import { useGame } from '@/resources/game/game-hook';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConsumableService } from '@/resources/game/consumable.service';
import { EquipmentService } from '@/resources/game/equipment.service';
import type {
  CharacterConsumable,
  CraftingRecipe,
  MonsterDrop,
} from '@/resources/game/models/consumable.model';
import type {
  CharacterEquipment,
  Equipment,
  EquipmentCraftingRecipe,
} from '@/resources/game/models/equipment.model';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Hammer,
  Sword,
  Shield,
  Gem,
  Sparkles,
  Search,
  Filter,
  Package,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Zap,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { EquipmentComparison } from '@/components/equipment/EquipmentComparison';

// Tipos auxiliares para o processamento de receitas
interface ProcessedIngredient {
  name: string;
  quantity: number;
  have: number;
  type: string;
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
    weapon_subtype?: string;
    atk_bonus?: number;
    def_bonus?: number;
    mana_bonus?: number;
    speed_bonus?: number;
    hp_bonus?: number;
    level_requirement?: number;
  };
  ingredients: ProcessedIngredient[];
  canCraft: boolean;
  craftType: 'equipment';
}

type ProcessedRecipe = ProcessedConsumableRecipe | ProcessedEquipmentRecipe;

interface RecipeDetailsPanelProps {
  recipe: ProcessedRecipe | null;
  onCraft: (recipeId: string, craftType: 'consumable' | 'equipment') => Promise<void>;
  isCrafting: boolean;
  selectedCharacter: { id: string } | null;
}

const RecipeDetailsPanel: React.FC<RecipeDetailsPanelProps> = ({
  recipe,
  onCraft,
  isCrafting,
  selectedCharacter,
}) => {
  if (!recipe) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6 bg-muted/10 rounded-lg border-2 border-dashed border-muted">
        <Package className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-muted-foreground mb-2">Selecione uma Receita</h3>
        <p className="text-sm text-muted-foreground">
          Escolha uma receita da lista para ver os detalhes e ingredientes necessários.
        </p>
      </div>
    );
  }

  const getRecipeIcon = () => {
    if (recipe.craftType === 'equipment') {
      const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
      switch (equipmentRecipe.result.type) {
        case 'weapon':
          return <Sword className="h-6 w-6" />;
        case 'armor':
          return <Shield className="h-6 w-6" />;
        case 'accessory':
          return <Gem className="h-6 w-6" />;
        default:
          return <Hammer className="h-6 w-6" />;
      }
    }
    return <Sparkles className="h-6 w-6" />;
  };

  const getRarityColor = () => {
    if (recipe.craftType === 'equipment') {
      const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
      switch (equipmentRecipe.result.rarity) {
        case 'legendary':
          return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
        case 'epic':
          return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        case 'rare':
          return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        case 'uncommon':
          return 'text-green-400 bg-green-500/10 border-green-500/20';
        default:
          return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
      }
    } else {
      const consumableRecipe = recipe as ProcessedConsumableRecipe;
      switch (consumableRecipe.result.type) {
        case 'elixir':
          return 'text-purple-400 bg-purple-500/10 border-purple-500/20';
        case 'potion':
          return 'text-red-400 bg-red-500/10 border-red-500/20';
        case 'antidote':
          return 'text-green-400 bg-green-500/10 border-green-500/20';
        default:
          return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      }
    }
  };

  const handleCraft = async () => {
    if (!recipe.canCraft || isCrafting) return;

    // Passar o ID da receita, não o ID do resultado
    await onCraft(recipe.id, recipe.craftType);
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header do Item */}
      <div className="flex items-start gap-4 p-6 border-b shrink-0">
        <div className={cn('p-3 rounded-lg border', getRarityColor())}>{getRecipeIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h2 className="text-xl font-bold truncate">{recipe.result.name}</h2>
            <div className="flex items-center gap-2 shrink-0">
              <Badge className={cn('', getRarityColor())}>
                {recipe.craftType === 'equipment'
                  ? (recipe as ProcessedEquipmentRecipe).result.rarity
                  : (recipe as ProcessedConsumableRecipe).result.type}
              </Badge>
              {recipe.craftType === 'equipment' &&
                (recipe as ProcessedEquipmentRecipe).result.level_requirement && (
                  <Badge variant="outline">
                    Nível {(recipe as ProcessedEquipmentRecipe).result.level_requirement}
                  </Badge>
                )}
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">
            {recipe.result.description}
          </p>

          {/* Badges de Tipo/Subtipo */}
          {recipe.craftType === 'equipment' && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="text-xs">
                {(() => {
                  const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
                  const type = equipmentRecipe.result.type;
                  const subtype = equipmentRecipe.result.weapon_subtype;

                  if (type === 'weapon' && subtype) {
                    switch (subtype) {
                      case 'sword':
                        return 'Espada';
                      case 'axe':
                        return 'Machado';
                      case 'blunt':
                        return 'Maça';
                      case 'staff':
                        return 'Cajado';
                      case 'dagger':
                        return 'Adaga';
                      default:
                        return 'Arma';
                    }
                  } else if (type === 'armor') {
                    return 'Armadura';
                  } else if (type === 'accessory') {
                    return 'Acessório';
                  }
                  return type;
                })()}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Atributos do Equipamento */}
      {recipe.craftType === 'equipment' &&
        (() => {
          const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
          const hasAnyBonus =
            (equipmentRecipe.result.atk_bonus || 0) > 0 ||
            (equipmentRecipe.result.def_bonus || 0) > 0 ||
            (equipmentRecipe.result.mana_bonus || 0) > 0 ||
            (equipmentRecipe.result.speed_bonus || 0) > 0 ||
            (equipmentRecipe.result.hp_bonus || 0) > 0;

          if (!hasAnyBonus) return null;

          return (
            <div className="p-6 border-b bg-muted/20 shrink-0">
              <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Atributos do Equipamento
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(equipmentRecipe.result.atk_bonus || 0) > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <Sword className="w-4 h-4 text-red-400" />
                    <span className="text-sm font-medium">
                      +{equipmentRecipe.result.atk_bonus} ATK
                    </span>
                  </div>
                )}

                {(equipmentRecipe.result.def_bonus || 0) > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <Shield className="w-4 h-4 text-blue-400" />
                    <span className="text-sm font-medium">
                      +{equipmentRecipe.result.def_bonus} DEF
                    </span>
                  </div>
                )}

                {(equipmentRecipe.result.mana_bonus || 0) > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-medium">
                      +{equipmentRecipe.result.mana_bonus} MANA
                    </span>
                  </div>
                )}

                {(equipmentRecipe.result.speed_bonus || 0) > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <Zap className="w-4 h-4 text-green-400" />
                    <span className="text-sm font-medium">
                      +{equipmentRecipe.result.speed_bonus} VEL
                    </span>
                  </div>
                )}

                {(equipmentRecipe.result.hp_bonus || 0) > 0 && (
                  <div className="flex items-center gap-2 p-2 bg-pink-500/10 border border-pink-500/20 rounded-lg">
                    <Heart className="w-4 h-4 text-pink-400" />
                    <span className="text-sm font-medium">
                      +{equipmentRecipe.result.hp_bonus} HP
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

      {/* Comparação de Equipamento */}
      {recipe.craftType === 'equipment' &&
        (() => {
          const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
          const equipmentForComparison = {
            id: equipmentRecipe.result_equipment_id,
            name: equipmentRecipe.result.name,
            description: equipmentRecipe.result.description,
            type: equipmentRecipe.result.type,
            rarity: equipmentRecipe.result.rarity,
            weapon_subtype: equipmentRecipe.result.weapon_subtype,
            atk_bonus: equipmentRecipe.result.atk_bonus || 0,
            def_bonus: equipmentRecipe.result.def_bonus || 0,
            mana_bonus: equipmentRecipe.result.mana_bonus || 0,
            speed_bonus: equipmentRecipe.result.speed_bonus || 0,
            hp_bonus: equipmentRecipe.result.hp_bonus || 0,
            level_requirement: equipmentRecipe.result.level_requirement || 1,
            price: 0,
            is_unlocked: true,
          };

          return (
            <div className="p-6 border-b bg-muted/10 shrink-0">
              <h3 className="text-base font-semibold mb-3">Comparação com Equipamento Atual</h3>
              <EquipmentComparison
                characterId={selectedCharacter?.id || ''}
                newEquipment={equipmentForComparison as Equipment}
                slotType={equipmentRecipe.result.type}
                showTitle={false}
                compact={true}
              />
            </div>
          );
        })()}

      {/* Ingredientes */}
      <div className="flex-1 p-6 overflow-hidden">
        <div className="flex items-center gap-2 mb-4">
          <h3 className="text-lg font-semibold">
            {recipe.craftType === 'equipment'
              ? 'Materiais Necessários'
              : 'Ingredientes Necessários'}
          </h3>
          <Badge variant="outline" className="ml-auto">
            {recipe.ingredients.length} itens
          </Badge>
        </div>

        <div className="space-y-3 overflow-y-auto max-h-96 pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {recipe.ingredients.map((ingredient, index) => {
            const hasEnough = ingredient.have >= ingredient.quantity;
            return (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border transition-colors',
                  hasEnough
                    ? 'bg-green-500/5 border-green-500/20'
                    : 'bg-red-500/5 border-red-500/20'
                )}
              >
                <div className="flex items-center gap-2">
                  {ingredient.type === 'equipment' && <Hammer className="h-4 w-4 text-blue-400" />}
                  {ingredient.type === 'drop' && <Gem className="h-4 w-4 text-orange-400" />}
                  {ingredient.type === 'consumable' && (
                    <Sparkles className="h-4 w-4 text-purple-400" />
                  )}
                  <span className="font-medium">{ingredient.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-mono',
                      hasEnough ? 'text-green-400' : 'text-red-400'
                    )}
                  >
                    {ingredient.have}/{ingredient.quantity}
                  </span>
                  {hasEnough ? (
                    <CheckCircle2 className="h-4 w-4 text-green-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Botão de Ação */}
      <div className="p-6 border-t bg-card/50 shrink-0">
        <Button
          onClick={handleCraft}
          disabled={!recipe.canCraft || isCrafting}
          className={cn(
            'w-full h-12 text-base font-semibold transition-all',
            recipe.canCraft && !isCrafting
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isCrafting ? (
            <>
              <Clock className="h-4 w-4 mr-2 animate-spin" />
              {recipe.craftType === 'equipment' ? 'Forjando...' : 'Criando...'}
            </>
          ) : recipe.canCraft ? (
            <>
              <Hammer className="h-4 w-4 mr-2" />
              {recipe.craftType === 'equipment' ? 'Forjar Item' : 'Criar Item'}
            </>
          ) : (
            <>
              <XCircle className="h-4 w-4 mr-2" />
              Materiais Insuficientes
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

interface RecipeListItemProps {
  recipe: ProcessedRecipe;
  isSelected: boolean;
  onClick: () => void;
}

const RecipeListItem: React.FC<RecipeListItemProps> = ({ recipe, isSelected, onClick }) => {
  const getTypeIcon = () => {
    if (recipe.craftType === 'equipment') {
      return <Hammer className="h-4 w-4 text-blue-400" />;
    }
    return <Sparkles className="h-4 w-4 text-purple-400" />;
  };

  const getRarityColor = () => {
    if (recipe.craftType === 'equipment') {
      const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
      switch (equipmentRecipe.result.rarity) {
        case 'legendary':
          return 'border-l-orange-500 bg-orange-500/5';
        case 'epic':
          return 'border-l-purple-500 bg-purple-500/5';
        case 'rare':
          return 'border-l-blue-500 bg-blue-500/5';
        case 'uncommon':
          return 'border-l-green-500 bg-green-500/5';
        default:
          return 'border-l-gray-500 bg-gray-500/5';
      }
    } else {
      const consumableRecipe = recipe as ProcessedConsumableRecipe;
      switch (consumableRecipe.result.type) {
        case 'elixir':
          return 'border-l-purple-500 bg-purple-500/5';
        case 'potion':
          return 'border-l-red-500 bg-red-500/5';
        case 'antidote':
          return 'border-l-green-500 bg-green-500/5';
        default:
          return 'border-l-blue-500 bg-blue-500/5';
      }
    }
  };

  return (
    <div
      onClick={onClick}
      className={cn(
        'p-4 border rounded-lg cursor-pointer transition-all border-l-4',
        getRarityColor(),
        isSelected
          ? 'ring-2 ring-primary border-primary bg-primary/5'
          : 'hover:bg-accent/50 hover:border-accent'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-1">{getTypeIcon()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold truncate">{recipe.result.name}</h3>
            {recipe.canCraft ? (
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {recipe.result.description}
          </p>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-xs">
              {recipe.craftType === 'equipment'
                ? (recipe as ProcessedEquipmentRecipe).result.rarity
                : (recipe as ProcessedConsumableRecipe).result.type}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {recipe.ingredients.length} ingredientes
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

function CraftingPage() {
  const navigate = useNavigate();
  const { character: characterId } = Route.useSearch();

  console.log('[CraftingPage] Iniciando com characterId:', characterId);

  const { characters, selectedCharacter, selectCharacter } = useGame();
  const [loading, setLoading] = useState(false);
  const [isCrafting, setIsCrafting] = useState(false);
  const [consumableRecipes, setConsumableRecipes] = useState<CraftingRecipe[]>([]);
  const [equipmentRecipes, setEquipmentRecipes] = useState<EquipmentCraftingRecipe[]>([]);
  const [inventory, setInventory] = useState<{
    consumables: CharacterConsumable[];
    drops: { id: string; drop_id: string; quantity: number; drop?: MonsterDrop }[];
    equipment: CharacterEquipment[];
  }>({
    consumables: [],
    drops: [],
    equipment: [],
  });

  // Listas de referência completas para resolver nomes
  const [allConsumables, setAllConsumables] = useState<
    Array<{ id: string; name: string; description: string; type: string }>
  >([]);
  const [allDrops, setAllDrops] = useState<MonsterDrop[]>([]);
  const [allEquipments, setAllEquipments] = useState<
    Array<{ id: string; name: string; description: string; type: string }>
  >([]);
  const [processedRecipes, setProcessedRecipes] = useState<ProcessedRecipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<ProcessedRecipe | null>(null);
  const [mounted, setMounted] = useState(false);

  // Estados de filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'equipment' | 'consumable'>('all');
  const [filterAvailability, setFilterAvailability] = useState<'all' | 'craftable' | 'missing'>(
    'all'
  );
  const [filterEquipmentType, setFilterEquipmentType] = useState<
    'all' | 'weapon' | 'armor' | 'accessory'
  >('all');
  const [filterWeaponSubtype, setFilterWeaponSubtype] = useState<
    'all' | 'sword' | 'axe' | 'blunt' | 'staff' | 'dagger'
  >('all');
  const [filterRarity, setFilterRarity] = useState<
    'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
  >('all');

  // Garantir que só execute no cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !characterId) return;

    if (characters.length > 0) {
      const character = characters.find(char => char.id === characterId);
      if (character && (!selectedCharacter || selectedCharacter.id !== characterId)) {
        selectCharacter(character);
      }
    }
  }, [mounted, characterId, characters.length]);

  // Carregar receitas e inventário
  useEffect(() => {
    if (!mounted || !selectedCharacter) return;

    const loadData = async () => {
      setLoading(true);

      try {
        // Carregar receitas, inventário e listas de referência em paralelo
        const [
          consumableRecipesRes,
          equipmentRecipesRes,
          consumablesRes,
          dropsRes,
          equipmentList,
          allConsumablesRes,
          allDropsRes,
          allEquipmentsRes,
        ] = await Promise.all([
          ConsumableService.getCraftingRecipes(),
          EquipmentService.getEquipmentCraftingRecipes(),
          ConsumableService.getCharacterConsumables(selectedCharacter.id),
          ConsumableService.getCharacterDrops(selectedCharacter.id),
          EquipmentService.getCharacterEquipment(selectedCharacter.id),
          ConsumableService.getAvailableConsumables(),
          ConsumableService.getMonsterDrops(),
          EquipmentService.getAllEquipments(),
        ]);

        if (consumableRecipesRes.success && consumableRecipesRes.data) {
          setConsumableRecipes(consumableRecipesRes.data);
        }

        if (equipmentRecipesRes.success && equipmentRecipesRes.data) {
          setEquipmentRecipes(equipmentRecipesRes.data);
        }

        setInventory({
          consumables: consumablesRes.success ? consumablesRes.data || [] : [],
          drops: dropsRes.success ? dropsRes.data || [] : [],
          equipment: equipmentList || [],
        });

        if (allConsumablesRes.success && allConsumablesRes.data) {
          setAllConsumables(allConsumablesRes.data);
        }

        if (allDropsRes.success && allDropsRes.data) {
          setAllDrops(allDropsRes.data);
        }

        if (allEquipmentsRes && Array.isArray(allEquipmentsRes)) {
          setAllEquipments(allEquipmentsRes);
        }
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar receitas e inventário');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [mounted, selectedCharacter]);

  // Processar receitas com informações de ingredientes
  useEffect(() => {
    if (!mounted || (!consumableRecipes.length && !equipmentRecipes.length) || !selectedCharacter)
      return;

    const processRecipes = () => {
      const processed: ProcessedRecipe[] = [];

      // Processar receitas de consumíveis
      for (const recipe of consumableRecipes) {
        try {
          const resultItem = inventory.consumables.find(
            c => c.consumable_id === recipe.result_id
          )?.consumable;

          const resultInfo = {
            name: recipe.name,
            description: recipe.description,
            type: 'potion',
          };

          if (resultItem) {
            resultInfo.name = resultItem.name;
            resultInfo.description = resultItem.description;
            resultInfo.type = resultItem.type;
          }

          const processedIngredients = recipe.ingredients.map(ing => {
            let name = '';
            let have = 0;
            let type = 'drop';

            if (ing.item_type === 'monster_drop') {
              const inventoryDrop = inventory.drops.find(d => d.drop_id === ing.item_id);
              have = inventoryDrop?.quantity || 0;
              type = 'drop';

              if (inventoryDrop?.drop?.name) {
                name = inventoryDrop.drop.name;
              } else {
                const referenceDrop = allDrops.find(d => d.id === ing.item_id);
                name = referenceDrop?.name || `Drop ID: ${ing.item_id}`;
              }
            } else if (ing.item_type === 'consumable') {
              const playerConsumable = inventory.consumables.find(
                c => c.consumable_id === ing.item_id
              );
              have = playerConsumable?.quantity || 0;
              type = 'consumable';

              if (playerConsumable?.consumable?.name) {
                name = playerConsumable.consumable.name;
              } else {
                const referenceConsumable = allConsumables.find(c => c.id === ing.item_id);
                name = referenceConsumable?.name || `Consumível ID: ${ing.item_id}`;
              }
            } else if (ing.item_type === 'equipment') {
              const playerEquipment = inventory.equipment.filter(
                e => e.equipment_id === ing.item_id && !e.is_equipped
              );
              have = playerEquipment.length;
              type = 'equipment';

              if (playerEquipment[0]?.equipment?.name) {
                name = playerEquipment[0].equipment.name;
              } else {
                const referenceEquipment = allEquipments.find(e => e.id === ing.item_id);
                name = referenceEquipment?.name || `Equipamento ID: ${ing.item_id}`;
              }
            }

            return { name, quantity: ing.quantity, have, type };
          });

          const canCraft = processedIngredients.every(ing => ing.have >= ing.quantity);

          processed.push({
            id: recipe.id,
            result_id: recipe.result_id,
            result: resultInfo,
            ingredients: processedIngredients,
            canCraft,
            craftType: 'consumable',
          } as ProcessedConsumableRecipe);
        } catch (error) {
          console.error('Erro ao processar receita de consumível:', error);
        }
      }

      // Processar receitas de equipamentos
      for (const recipe of equipmentRecipes) {
        try {
          if (recipe.equipment) {
            const processedIngredients = recipe.ingredients.map(ing => {
              let name = '';
              let have = 0;
              let type = 'drop';

              if (ing.item_type === 'monster_drop') {
                const inventoryDrop = inventory.drops.find(d => d.drop_id === ing.item_id);
                have = inventoryDrop?.quantity || 0;
                type = 'drop';

                if (inventoryDrop?.drop?.name) {
                  name = inventoryDrop.drop.name;
                } else {
                  const referenceDrop = allDrops.find(d => d.id === ing.item_id);
                  name = referenceDrop?.name || `Drop ID: ${ing.item_id}`;
                }
              } else if (ing.item_type === 'consumable') {
                const playerConsumable = inventory.consumables.find(
                  c => c.consumable_id === ing.item_id
                );
                have = playerConsumable?.quantity || 0;
                type = 'consumable';

                if (playerConsumable?.consumable?.name) {
                  name = playerConsumable.consumable.name;
                } else {
                  const referenceConsumable = allConsumables.find(c => c.id === ing.item_id);
                  name = referenceConsumable?.name || `Consumível ID: ${ing.item_id}`;
                }
              } else if (ing.item_type === 'equipment') {
                const playerEquipment = inventory.equipment.filter(
                  e => e.equipment_id === ing.item_id && !e.is_equipped
                );
                have = playerEquipment.length;
                type = 'equipment';

                if (playerEquipment[0]?.equipment?.name) {
                  name = playerEquipment[0].equipment.name;
                } else {
                  const referenceEquipment = allEquipments.find(e => e.id === ing.item_id);
                  name = referenceEquipment?.name || `Equipamento ID: ${ing.item_id}`;
                }
              }

              return { name, quantity: ing.quantity, have, type };
            });

            const canCraft = processedIngredients.every(ing => ing.have >= ing.quantity);

            processed.push({
              id: recipe.id,
              result_equipment_id: recipe.result_equipment_id,
              result: {
                name: recipe.equipment.name,
                description: recipe.equipment.description,
                type: recipe.equipment.type,
                rarity: recipe.equipment.rarity,
                weapon_subtype: recipe.equipment.weapon_subtype || undefined,
                atk_bonus: recipe.equipment.atk_bonus || 0,
                def_bonus: recipe.equipment.def_bonus || 0,
                mana_bonus: recipe.equipment.mana_bonus || 0,
                speed_bonus: recipe.equipment.speed_bonus || 0,
                hp_bonus: 0,
                level_requirement: recipe.equipment.level_requirement || 1,
              },
              ingredients: processedIngredients,
              canCraft,
              craftType: 'equipment',
            } as ProcessedEquipmentRecipe);
          }
        } catch (error) {
          console.error('Erro ao processar receita de equipamento:', error);
        }
      }

      setProcessedRecipes(processed);

      // Se há uma receita selecionada, atualizá-la com os novos dados
      if (selectedRecipe) {
        const updatedRecipe = processed.find(r => r.id === selectedRecipe.id);
        if (updatedRecipe) {
          setSelectedRecipe(updatedRecipe);
        }
      }
    };

    processRecipes();
  }, [
    mounted,
    consumableRecipes,
    equipmentRecipes,
    inventory,
    selectedCharacter,
    selectedRecipe?.id,
    allConsumables,
    allDrops,
    allEquipments,
  ]);

  // Receitas filtradas
  const filteredRecipes = useMemo(() => {
    let filtered = processedRecipes;

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(
        recipe =>
          recipe.result.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          recipe.result.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por tipo
    if (filterType !== 'all') {
      filtered = filtered.filter(recipe => recipe.craftType === filterType);
    }

    // Filtro por tipo de equipamento
    if (filterEquipmentType !== 'all') {
      filtered = filtered.filter(recipe => {
        if (recipe.craftType === 'equipment') {
          const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
          return equipmentRecipe.result.type === filterEquipmentType;
        }
        return true;
      });
    }

    // Filtro por subtipo de arma
    if (filterWeaponSubtype !== 'all') {
      filtered = filtered.filter(recipe => {
        if (recipe.craftType === 'equipment') {
          const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
          return equipmentRecipe.result.weapon_subtype === filterWeaponSubtype;
        }
        return true;
      });
    }

    // Filtro por raridade
    if (filterRarity !== 'all') {
      filtered = filtered.filter(recipe => {
        if (recipe.craftType === 'equipment') {
          const equipmentRecipe = recipe as ProcessedEquipmentRecipe;
          return equipmentRecipe.result.rarity === filterRarity;
        } else {
          const consumableRecipe = recipe as ProcessedConsumableRecipe;
          return consumableRecipe.result.type === filterRarity;
        }
      });
    }

    // Filtro por disponibilidade
    if (filterAvailability === 'craftable') {
      filtered = filtered.filter(recipe => recipe.canCraft);
    } else if (filterAvailability === 'missing') {
      filtered = filtered.filter(recipe => !recipe.canCraft);
    }

    return filtered;
  }, [
    processedRecipes,
    searchTerm,
    filterType,
    filterAvailability,
    filterEquipmentType,
    filterWeaponSubtype,
    filterRarity,
  ]);

  const handleCraftItem = async (recipeId: string, craftType: 'consumable' | 'equipment') => {
    if (!selectedCharacter || isCrafting) return;

    setIsCrafting(true);
    try {
      let result;

      if (craftType === 'consumable') {
        result = await ConsumableService.craftItem(selectedCharacter.id, recipeId);
      } else {
        result = await EquipmentService.craftEquipment(selectedCharacter.id, recipeId);
      }

      if (result.success) {
        toast.success('Item criado com sucesso!', {
          description: result.data?.message,
        });

        // Recarregar inventário em paralelo
        const [consumablesRes, dropsRes, equipmentList] = await Promise.all([
          ConsumableService.getCharacterConsumables(selectedCharacter.id),
          ConsumableService.getCharacterDrops(selectedCharacter.id),
          EquipmentService.getCharacterEquipment(selectedCharacter.id),
        ]);

        // Atualizar inventário sem perder estado de UI
        setInventory({
          consumables: consumablesRes.success ? consumablesRes.data || [] : inventory.consumables,
          drops: dropsRes.success ? dropsRes.data || [] : inventory.drops,
          equipment: equipmentList || inventory.equipment,
        });
      } else {
        toast.error('Erro ao criar item', {
          description: result.error,
        });
      }
    } catch (error) {
      console.error('Erro ao criar item:', error);
      toast.error('Erro ao criar item');
    } finally {
      setIsCrafting(false);
    }
  };

  // Mostrar loading até montar o componente
  if (!mounted) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>Carregando...</p>
      </div>
    );
  }

  // Se não há characterId, redirecionar para seleção de personagem
  if (!characterId || characterId.trim() === '') {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>Redirecionando para seleção de personagem...</p>
        <Button onClick={() => navigate({ to: '/game/play' })}>Selecionar Personagem</Button>
      </div>
    );
  }

  if (!selectedCharacter) {
    return (
      <div className="container mx-auto py-6 text-center">
        <p>Carregando personagem...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigate({ to: '/game/play/hub', search: { character: selectedCharacter.id } })
            }
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

      {/* Layout de Duas Colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Coluna Esquerda - Lista de Receitas */}
        <div className="lg:col-span-5">
          <Card className="h-full max-h-[calc(100vh-280px)]">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="flex items-center gap-2">
                  <Hammer className="h-5 w-5" />
                  Receitas Disponíveis
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {filteredRecipes.length} de {processedRecipes.length}
                  </Badge>
                  {(searchTerm ||
                    filterType !== 'all' ||
                    filterAvailability !== 'all' ||
                    filterEquipmentType !== 'all' ||
                    filterWeaponSubtype !== 'all' ||
                    filterRarity !== 'all') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchTerm('');
                        setFilterType('all');
                        setFilterAvailability('all');
                        setFilterEquipmentType('all');
                        setFilterWeaponSubtype('all');
                        setFilterRarity('all');
                      }}
                      className="h-6 px-2 text-xs"
                    >
                      Limpar Filtros
                    </Button>
                  )}
                </div>
              </div>

              {/* Filtros */}
              <div className="space-y-3">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar receita..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>

                {/* Filtros de Tipo e Disponibilidade */}
                <div className="grid grid-cols-2 gap-2">
                  <Select
                    value={filterType}
                    onValueChange={(value: 'all' | 'equipment' | 'consumable') => {
                      setFilterType(value);
                      if (value !== 'equipment') {
                        setFilterEquipmentType('all');
                        setFilterWeaponSubtype('all');
                        setFilterRarity('all');
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os Tipos</SelectItem>
                      <SelectItem value="equipment">Equipamentos</SelectItem>
                      <SelectItem value="consumable">Consumíveis</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={filterAvailability}
                    onValueChange={(value: 'all' | 'craftable' | 'missing') =>
                      setFilterAvailability(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="craftable">Criáveis</SelectItem>
                      <SelectItem value="missing">Faltam Materiais</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Filtros Específicos para Equipamentos */}
                {filterType === 'equipment' && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={filterEquipmentType}
                        onValueChange={(value: 'all' | 'weapon' | 'armor' | 'accessory') => {
                          setFilterEquipmentType(value);
                          if (value !== 'weapon') {
                            setFilterWeaponSubtype('all');
                          }
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de Equipamento" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos Equipamentos</SelectItem>
                          <SelectItem value="weapon">Armas</SelectItem>
                          <SelectItem value="armor">Armaduras</SelectItem>
                          <SelectItem value="accessory">Acessórios</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={filterRarity}
                        onValueChange={(
                          value: 'all' | 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
                        ) => setFilterRarity(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Raridade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas Raridades</SelectItem>
                          <SelectItem value="common">Comum</SelectItem>
                          <SelectItem value="uncommon">Incomum</SelectItem>
                          <SelectItem value="rare">Raro</SelectItem>
                          <SelectItem value="epic">Épico</SelectItem>
                          <SelectItem value="legendary">Lendário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filtro de Subtipo de Arma */}
                    {filterEquipmentType === 'weapon' && (
                      <Select
                        value={filterWeaponSubtype}
                        onValueChange={(
                          value: 'all' | 'sword' | 'axe' | 'blunt' | 'staff' | 'dagger'
                        ) => setFilterWeaponSubtype(value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Tipo de Arma" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as Armas</SelectItem>
                          <SelectItem value="sword">Espadas</SelectItem>
                          <SelectItem value="axe">Machados</SelectItem>
                          <SelectItem value="blunt">Maças</SelectItem>
                          <SelectItem value="staff">Cajados</SelectItem>
                          <SelectItem value="dagger">Adagas</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent"></div>
                  <span className="ml-2 text-muted-foreground">Carregando receitas...</span>
                </div>
              ) : filteredRecipes.length > 0 ? (
                <div className="space-y-2 h-full max-h-96 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                  {filteredRecipes.map(recipe => (
                    <RecipeListItem
                      key={recipe.id}
                      recipe={recipe}
                      isSelected={selectedRecipe?.id === recipe.id}
                      onClick={() => setSelectedRecipe(recipe)}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Filter className="h-12 w-12 text-muted-foreground mb-3" />
                  <p className="text-muted-foreground text-lg">Nenhuma receita encontrada</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    Tente ajustar os filtros ou explore a torre para encontrar novas receitas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Detalhes da Receita */}
        <div className="lg:col-span-7">
          <Card className="h-full max-h-[calc(100vh-280px)]">
            <RecipeDetailsPanel
              recipe={selectedRecipe}
              onCraft={handleCraftItem}
              isCrafting={isCrafting}
              selectedCharacter={selectedCharacter}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/_authenticated/game/play/hub/crafting')({
  component: CraftingPage,
  validateSearch: search => {
    // Validar se o parâmetro character está presente e é uma string válida
    const character = search.character as string;
    if (!character || typeof character !== 'string') {
      console.warn('[CraftingRoute] Parâmetro character inválido:', character);
      return { character: '' };
    }
    return { character: character.trim() };
  },
});
