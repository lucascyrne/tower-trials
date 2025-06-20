import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { CharacterService } from '@/services/character.service';
import { EquipmentService } from '@/services/equipment.service';
import type { Character } from '@/models/character.model';
import type { Equipment, CharacterEquipment } from '@/models/equipment.model';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Search,
  Sword,
  Shield,
  Shirt,
  Gem,
  Star,
  Zap,
  Package,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';

type SlotType = 'main_hand' | 'off_hand' | 'armor' | 'accessory';
type FilterType = 'all' | 'weapon' | 'armor' | 'accessory';
type SortType = 'name' | 'level' | 'rarity' | 'attack' | 'defense';

export const Route = createFileRoute('/_authenticated/game/play/hub/equipment/select')({
  component: EquipmentSelectPage,
  validateSearch: search => ({
    character: (search.character as string) || '',
    slot: (search.slot as SlotType) || 'main_hand',
  }),
});

function EquipmentSelectPage() {
  const navigate = useNavigate();
  const { character: characterId, slot: slotType } = Route.useSearch();

  const [character, setCharacter] = useState<Character | null>(null);
  const [availableEquipment, setAvailableEquipment] = useState<CharacterEquipment[]>([]);
  const [filteredEquipment, setFilteredEquipment] = useState<CharacterEquipment[]>([]);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortType, setSortType] = useState<SortType>('name');
  const [equiping, setEquiping] = useState(false);

  // Carregar dados iniciais
  useEffect(() => {
    const loadData = async () => {
      if (!characterId || !slotType) {
        navigate({ to: '/game/play/hub', search: { character: characterId } });
        return;
      }

      try {
        setLoading(true);

        // Carregar personagem
        const charResponse = await CharacterService.getCharacter(characterId);
        if (charResponse.success && charResponse.data) {
          setCharacter(charResponse.data);
        }

        // Carregar equipamentos do personagem
        const equipmentData = await EquipmentService.getCharacterEquipment(characterId);
        setAvailableEquipment(equipmentData);
      } catch (error) {
        console.error('Erro ao carregar dados:', error);
        toast.error('Erro ao carregar equipamentos');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [characterId, slotType, navigate]);

  // Filtrar e ordenar equipamentos
  useEffect(() => {
    const filtered = availableEquipment.filter(item => {
      if (!item.equipment) return false;

      // Filtrar por tipo de slot
      const equipment = item.equipment;
      const isCompatible = isEquipmentCompatibleWithSlot(equipment, slotType);
      if (!isCompatible) return false;

      // Filtrar por tipo de equipamento
      if (filterType !== 'all' && equipment.type !== filterType) return false;

      // Filtrar por termo de busca
      if (searchTerm && !equipment.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }

      return true;
    });

    // Ordenar
    filtered.sort((a, b) => {
      const equipA = a.equipment!;
      const equipB = b.equipment!;

      switch (sortType) {
        case 'name':
          return equipA.name.localeCompare(equipB.name);
        case 'level':
          return (equipB.level_requirement || 0) - (equipA.level_requirement || 0);
        case 'rarity': {
          const rarityOrder = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 5 };
          return (
            (rarityOrder[equipB.rarity as keyof typeof rarityOrder] || 0) -
            (rarityOrder[equipA.rarity as keyof typeof rarityOrder] || 0)
          );
        }
        case 'attack':
          return equipB.atk_bonus - equipA.atk_bonus;
        case 'defense':
          return equipB.def_bonus - equipA.def_bonus;
        default:
          return 0;
      }
    });

    setFilteredEquipment(filtered);
  }, [availableEquipment, searchTerm, filterType, sortType, slotType]);

  const isEquipmentCompatibleWithSlot = (equipment: Equipment, slot: SlotType): boolean => {
    switch (slot) {
      case 'main_hand':
      case 'off_hand':
        return equipment.type === 'weapon';
      case 'armor':
        return equipment.type === 'armor';
      case 'accessory':
        return equipment.type === 'accessory';
      default:
        return false;
    }
  };

  const getSlotDisplayName = (slot: SlotType): string => {
    switch (slot) {
      case 'main_hand':
        return 'Mão Principal';
      case 'off_hand':
        return 'Mão Secundária';
      case 'armor':
        return 'Armadura';
      case 'accessory':
        return 'Acessório';
      default:
        return slot;
    }
  };

  const getEquipmentIcon = (equipment: Equipment) => {
    switch (equipment.type) {
      case 'weapon':
        return <Sword className="h-6 w-6 text-red-400" />;
      case 'armor':
        return <Shirt className="h-6 w-6 text-blue-400" />;
      case 'accessory':
        return <Gem className="h-6 w-6 text-purple-400" />;
      default:
        return <Shield className="h-6 w-6 text-slate-400" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'border-slate-600 bg-slate-800/30 text-slate-300',
      uncommon: 'border-emerald-600 bg-emerald-900/30 text-emerald-300',
      rare: 'border-blue-600 bg-blue-900/30 text-blue-300',
      epic: 'border-purple-600 bg-purple-900/30 text-purple-300',
      legendary: 'border-amber-600 bg-amber-900/30 text-amber-300',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const handleEquipItem = async (equipment: Equipment) => {
    if (!characterId || equiping) return;

    try {
      setEquiping(true);

      const result = await EquipmentService.toggleEquipment(
        characterId,
        equipment.id,
        true,
        slotType
      );

      if (result.success) {
        toast.success(`${equipment.name} equipado com sucesso!`);
        navigate({ to: '/game/play/hub/equipment', search: { character: characterId } });
      } else {
        toast.error(result.error || 'Erro ao equipar item');
      }
    } catch (error) {
      console.error('Erro ao equipar item:', error);
      toast.error('Erro ao equipar item');
    } finally {
      setEquiping(false);
    }
  };

  const renderEquipmentCard = (item: CharacterEquipment) => {
    if (!item.equipment) return null;

    const equipment = item.equipment;
    const isSelected = selectedItem?.id === equipment.id;

    return (
      <div
        key={equipment.id}
        className={`relative cursor-pointer transition-all duration-200 ${
          isSelected ? 'transform scale-[1.02]' : 'hover:transform hover:scale-[1.01]'
        }`}
        onClick={() => setSelectedItem(equipment)}
      >
        <Card
          className={`border-2 transition-all duration-200 ${
            isSelected
              ? 'border-amber-400 bg-amber-900/20 shadow-lg shadow-amber-400/20'
              : `${getRarityColor(equipment.rarity)} hover:brightness-110`
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${getRarityColor(equipment.rarity)}`}>
                {getEquipmentIcon(equipment)}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-slate-200 truncate">{equipment.name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">
                    {equipment.rarity}
                  </Badge>
                  {equipment.level_requirement && equipment.level_requirement > 1 && (
                    <Badge variant="outline" className="text-xs">
                      Nv. {equipment.level_requirement}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                  {equipment.atk_bonus > 0 && (
                    <span className="flex items-center gap-1">
                      <Sword className="h-3 w-3 text-red-400" />+{equipment.atk_bonus}
                    </span>
                  )}
                  {equipment.def_bonus > 0 && (
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3 text-blue-400" />+{equipment.def_bonus}
                    </span>
                  )}
                  {equipment.mana_bonus > 0 && (
                    <span className="flex items-center gap-1">
                      <Zap className="h-3 w-3 text-purple-400" />+{equipment.mana_bonus}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderItemDetails = () => {
    if (!selectedItem) {
      return (
        <div className="flex items-center justify-center h-full text-slate-500">
          <div className="text-center">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Selecione um equipamento</p>
            <p className="text-sm mt-2 opacity-75">Clique em um item para ver os detalhes</p>
          </div>
        </div>
      );
    }

    const canEquip = character ? character.level >= (selectedItem.level_requirement || 1) : false;

    return (
      <div className="space-y-6">
        {/* Header do Item */}
        <div className="flex items-start gap-4">
          <div className={`p-4 rounded-lg border-2 ${getRarityColor(selectedItem.rarity)}`}>
            {getEquipmentIcon(selectedItem)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">{selectedItem.name}</h2>
            <div className="flex items-center gap-3 mb-2">
              <Badge className={`border ${getRarityColor(selectedItem.rarity)}`}>
                {selectedItem.rarity}
              </Badge>
              <Badge variant="outline" className="text-slate-300">
                {selectedItem.type}
              </Badge>
              {selectedItem.rarity === 'legendary' && (
                <Star className="h-4 w-4 text-amber-400 animate-pulse" />
              )}
            </div>
          </div>
        </div>

        {/* Descrição */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg p-4">
          <p className="text-slate-300 leading-relaxed">{selectedItem.description}</p>
        </div>

        {/* Estatísticas */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200">Atributos</h3>
          <div className="grid grid-cols-2 gap-3">
            {selectedItem.atk_bonus > 0 && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Sword className="h-4 w-4 text-red-400" />
                  <span className="text-red-300 font-medium">Ataque</span>
                </div>
                <p className="text-red-200 text-lg font-bold">+{selectedItem.atk_bonus}</p>
              </div>
            )}

            {selectedItem.def_bonus > 0 && (
              <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="text-blue-300 font-medium">Defesa</span>
                </div>
                <p className="text-blue-200 text-lg font-bold">+{selectedItem.def_bonus}</p>
              </div>
            )}

            {selectedItem.mana_bonus > 0 && (
              <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-300 font-medium">Mana</span>
                </div>
                <p className="text-purple-200 text-lg font-bold">+{selectedItem.mana_bonus}</p>
              </div>
            )}

            {selectedItem.speed_bonus && selectedItem.speed_bonus > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-yellow-300 font-medium">Velocidade</span>
                </div>
                <p className="text-yellow-200 text-lg font-bold">+{selectedItem.speed_bonus}</p>
              </div>
            )}
          </div>
        </div>

        {/* Requisitos */}
        {selectedItem.level_requirement && selectedItem.level_requirement > 1 && (
          <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Requisitos</h4>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Nível mínimo:</span>
              <span className={`font-bold ${canEquip ? 'text-green-400' : 'text-red-400'}`}>
                {selectedItem.level_requirement}
              </span>
            </div>
          </div>
        )}

        {/* Tipo de Arma */}
        {selectedItem.weapon_subtype && (
          <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Tipo de Arma</h4>
            <p className="text-slate-400 capitalize">{selectedItem.weapon_subtype}</p>
          </div>
        )}

        {/* Ações */}
        <div className="pt-4 border-t border-slate-700/50">
          <Button
            onClick={() => handleEquipItem(selectedItem)}
            disabled={!canEquip || equiping}
            className={`w-full ${
              canEquip
                ? 'bg-amber-600 hover:bg-amber-700 text-white'
                : 'bg-slate-700 text-slate-400 cursor-not-allowed'
            }`}
          >
            {equiping ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-t border-b border-current"></div>
                Equipando...
              </div>
            ) : canEquip ? (
              `Equipar em ${getSlotDisplayName(slotType)}`
            ) : (
              `Nível ${selectedItem.level_requirement} necessário`
            )}
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-700 rounded w-64"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="h-96 bg-slate-700 rounded"></div>
              <div className="lg:col-span-2 h-96 bg-slate-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-slate-100 mb-4">Personagem não encontrado</h1>
            <Button
              onClick={() => navigate({ to: '/game/play/hub', search: { character: characterId } })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Hub
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                navigate({ to: '/game/play/hub/equipment', search: { character: characterId } })
              }
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="mt-2 sm:mt-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2">
                <Sword className="h-6 sm:h-8 w-6 sm:w-8 text-amber-400" />
                <span className="hidden sm:inline">Selecionar Equipamento</span>
                <span className="sm:hidden">Equipamentos</span>
              </h1>
              <p className="text-slate-400 text-sm sm:text-base">
                {character.name} - {getSlotDisplayName(slotType)}
              </p>
            </div>
          </div>
        </div>

        {/* Layout Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Coluna Esquerda - Lista de Equipamentos (1/3) */}
          <div className="space-y-4">
            {/* Filtros e Busca */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 flex items-center gap-2 text-lg">
                  <Filter className="h-5 w-5 text-amber-400" />
                  Filtros
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Busca */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-500" />
                  <Input
                    placeholder="Buscar equipamento..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 bg-slate-700/50 border-slate-600 text-slate-200"
                  />
                </div>

                {/* Filtro por Tipo */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Tipo</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-2">
                    {[
                      { value: 'all', label: 'Todos' },
                      { value: 'weapon', label: 'Armas' },
                      { value: 'armor', label: 'Armaduras' },
                      { value: 'accessory', label: 'Acessórios' },
                    ].map(filter => (
                      <Button
                        key={filter.value}
                        variant={filterType === filter.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilterType(filter.value as FilterType)}
                        className="text-xs"
                      >
                        {filter.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Ordenação */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Ordenar por</label>
                  <select
                    value={sortType}
                    onChange={e => setSortType(e.target.value as SortType)}
                    className="w-full p-2 rounded-md bg-slate-700/50 border border-slate-600 text-slate-200 text-sm"
                  >
                    <option value="name">Nome</option>
                    <option value="level">Nível</option>
                    <option value="rarity">Raridade</option>
                    <option value="attack">Ataque</option>
                    <option value="defense">Defesa</option>
                  </select>
                </div>
              </CardContent>
            </Card>

            {/* Lista de Equipamentos */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-slate-100 text-lg">
                  Equipamentos ({filteredEquipment.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-[400px] sm:max-h-[500px] lg:max-h-[600px] overflow-y-auto">
                {filteredEquipment.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="h-12 w-12 mx-auto mb-3 text-slate-600 opacity-50" />
                    <p className="text-slate-500">Nenhum equipamento encontrado</p>
                  </div>
                ) : (
                  filteredEquipment.map(renderEquipmentCard)
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna Direita - Detalhes do Item (2/3) */}
          <div className="lg:col-span-2">
            <Card className="bg-slate-800/50 border-slate-700/50 h-full min-h-[400px]">
              <CardHeader>
                <CardTitle className="text-slate-100">Detalhes do Equipamento</CardTitle>
              </CardHeader>
              <CardContent className="h-full">{renderItemDetails()}</CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
