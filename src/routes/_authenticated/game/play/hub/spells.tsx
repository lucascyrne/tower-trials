import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Zap,
  Heart,
  Shield,
  Skull,
  Flame,
  Search,
  ArrowLeft,
  Save,
  X,
  Crown,
  Target,
  Clock,
  Droplet,
  Star,
  TrendingUp,
} from 'lucide-react';
import { SpellService, type AvailableSpell, type SpellStats } from '@/resources/game/spell.service';
import { CharacterService } from '@/resources/game/character/character.service';
import type { Character } from '@/resources/game/models/character.model';
import type { SpellEffectType } from '@/resources/game/models/spell.model';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

interface SpellSelectionState {
  slot1: AvailableSpell | null;
  slot2: AvailableSpell | null;
  slot3: AvailableSpell | null;
}

export const Route = createFileRoute('/_authenticated/game/play/hub/spells')({
  component: SpellsPage,
  validateSearch: search => ({
    character: (search.character as string) || '',
  }),
});

function SpellsPage() {
  const navigate = useNavigate();
  const { character: characterId } = Route.useSearch();

  const [character, setCharacter] = useState<Character | null>(null);
  const [spells, setSpells] = useState<AvailableSpell[]>([]);
  const [spellStats, setSpellStats] = useState<SpellStats | null>(null);
  const [selectedSpells, setSelectedSpells] = useState<SpellSelectionState>({
    slot1: null,
    slot2: null,
    slot3: null,
  });
  const [originalSelection, setOriginalSelection] = useState<SpellSelectionState>({
    slot1: null,
    slot2: null,
    slot3: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<SpellEffectType | 'all'>('all');
  const [filterLevel, setFilterLevel] = useState<'early' | 'mid' | 'high' | 'all'>('all');

  useEffect(() => {
    if (!characterId) {
      toast.error('Personagem não especificado');
      navigate({ to: '/game/play' });
      return;
    }

    loadData();
  }, [characterId]);

  const loadData = async () => {
    if (!characterId) return;

    setLoading(true);
    try {
      // Carregar dados do personagem
      const characterResponse = await CharacterService.getCharacter(characterId);
      if (!characterResponse.success || !characterResponse.data) {
        throw new Error('Erro ao carregar personagem');
      }
      setCharacter(characterResponse.data);

      // Carregar magias disponíveis
      const spellsResponse = await SpellService.getCharacterAvailableSpells(characterId);
      if (!spellsResponse.success || !spellsResponse.data) {
        throw new Error('Erro ao carregar magias');
      }
      setSpells(spellsResponse.data);

      // Carregar estatísticas
      const statsResponse = await SpellService.getCharacterSpellStats(characterId);
      if (statsResponse.success && statsResponse.data) {
        setSpellStats(statsResponse.data);
      }

      // Carregar seleção atual
      const equippedSpells = spellsResponse.data.filter(spell => spell.is_equipped);
      const newSelection: SpellSelectionState = {
        slot1: equippedSpells.find(spell => spell.slot_position === 1) || null,
        slot2: equippedSpells.find(spell => spell.slot_position === 2) || null,
        slot3: equippedSpells.find(spell => spell.slot_position === 3) || null,
      };
      setSelectedSpells(newSelection);
      setOriginalSelection(newSelection);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados das magias');
    } finally {
      setLoading(false);
    }
  };

  const handleSpellSelect = (spell: AvailableSpell, slot: 'slot1' | 'slot2' | 'slot3') => {
    setSelectedSpells(prev => {
      const newSelection = { ...prev };

      // Se a magia já está equipada em outro slot, remover de lá
      Object.keys(newSelection).forEach(key => {
        const slotKey = key as keyof SpellSelectionState;
        if (newSelection[slotKey]?.id === spell.id) {
          newSelection[slotKey] = null;
        }
      });

      // Equipar no slot selecionado
      newSelection[slot] = spell;

      return newSelection;
    });
  };

  const handleSlotClear = (slot: 'slot1' | 'slot2' | 'slot3') => {
    setSelectedSpells(prev => ({
      ...prev,
      [slot]: null,
    }));
  };

  const handleSaveSelection = async () => {
    if (!characterId) return;

    setSaving(true);
    try {
      const spellIds = [
        selectedSpells.slot1?.id || null,
        selectedSpells.slot2?.id || null,
        selectedSpells.slot3?.id || null,
      ];

      const response = await SpellService.setCharacterSpells(characterId, spellIds);

      if (!response.success) {
        throw new Error(response.error || 'Erro ao salvar seleção');
      }

      // Atualizar estado original
      setOriginalSelection({ ...selectedSpells });

      toast.success('Seleção de magias salva com sucesso!');

      // Recarregar dados para refletir mudanças
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar seleção:', error);
      toast.error('Erro ao salvar seleção de magias');
    } finally {
      setSaving(false);
    }
  };

  const getSpellIcon = (effectType: SpellEffectType) => {
    const icons = {
      damage: <Target className="h-5 w-5" />,
      heal: <Heart className="h-5 w-5" />,
      buff: <Shield className="h-5 w-5" />,
      debuff: <Skull className="h-5 w-5" />,
      dot: <Flame className="h-5 w-5" />,
      hot: <Sparkles className="h-5 w-5" />,
    };
    return icons[effectType] || <Zap className="h-5 w-5" />;
  };

  const getSpellColor = (effectType: SpellEffectType) => {
    const colors = {
      damage: 'text-red-500 border-red-500/30 bg-red-500/5',
      heal: 'text-green-500 border-green-500/30 bg-green-500/5',
      buff: 'text-blue-500 border-blue-500/30 bg-blue-500/5',
      debuff: 'text-purple-500 border-purple-500/30 bg-purple-500/5',
      dot: 'text-orange-500 border-orange-500/30 bg-orange-500/5',
      hot: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5',
    };
    return colors[effectType] || 'text-gray-500 border-gray-500/30 bg-gray-500/5';
  };

  const getSpellLevelCategory = (level: number) => {
    if (level <= 15) return 'early';
    if (level <= 35) return 'mid';
    return 'high';
  };

  const getLevelCategoryColor = (level: number) => {
    const category = getSpellLevelCategory(level);
    return {
      early: 'text-green-400',
      mid: 'text-yellow-400',
      high: 'text-red-400',
    }[category];
  };

  const filteredSpells = spells.filter(spell => {
    const matchesSearch =
      spell.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      spell.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || spell.effect_type === filterType;
    const matchesLevel =
      filterLevel === 'all' || getSpellLevelCategory(spell.unlocked_at_level) === filterLevel;

    return matchesSearch && matchesType && matchesLevel;
  });

  const hasChanges = JSON.stringify(selectedSpells) !== JSON.stringify(originalSelection);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando magias...</p>
        </div>
      </div>
    );
  }

  if (!character) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Personagem não encontrado</p>
          <Button onClick={() => navigate({ to: '/game/play' })} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: '/game/play/hub', search: { character: characterId } })}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao Hub
            </Button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <Sparkles className="h-8 w-8 text-purple-500" />
                Grimório de Magias
              </h1>
              <p className="text-muted-foreground">
                Gerencie as magias de{' '}
                <span className="font-medium text-primary">{character.name}</span>
              </p>
            </div>
          </div>

          {hasChanges && (
            <Button
              onClick={handleSaveSelection}
              disabled={saving}
              size="lg"
              className="bg-purple-600 hover:bg-purple-700"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Seleção
                </>
              )}
            </Button>
          )}
        </div>

        {/* Stats Overview */}
        {spellStats && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Estatísticas de Magia
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-500">
                    {spellStats.total_available}
                  </div>
                  <div className="text-sm text-muted-foreground">Magias Disponíveis</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-500">
                    {spellStats.total_equipped}/3
                  </div>
                  <div className="text-sm text-muted-foreground">Magias Equipadas</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-500">{character.level}</div>
                  <div className="text-sm text-muted-foreground">Nível Atual</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-500">
                    {spellStats.highest_level_unlocked}
                  </div>
                  <div className="text-sm text-muted-foreground">Máximo Desbloqueado</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Spell Selection Panel */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Seleção de Magias (Máximo 3)
              </CardTitle>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar magias..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterType}
                    onChange={e => setFilterType(e.target.value as SpellEffectType | 'all')}
                    className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                  >
                    <option value="all">Todos os Tipos</option>
                    <option value="damage">Dano</option>
                    <option value="heal">Cura</option>
                    <option value="buff">Benefício</option>
                    <option value="debuff">Maldição</option>
                    <option value="dot">Dano Contínuo</option>
                    <option value="hot">Cura Contínua</option>
                  </select>
                  <select
                    value={filterLevel}
                    onChange={e =>
                      setFilterLevel(e.target.value as 'early' | 'mid' | 'high' | 'all')
                    }
                    className="px-3 py-2 border border-border rounded-md bg-background text-sm"
                  >
                    <option value="all">Todos os Níveis</option>
                    <option value="early">Iniciante (1-15)</option>
                    <option value="mid">Intermediário (16-35)</option>
                    <option value="high">Avançado (36-50)</option>
                  </select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px]">
                <div className="grid gap-3">
                  {filteredSpells.map(spell => {
                    const isSelected = Object.values(selectedSpells).some(
                      selected => selected?.id === spell.id
                    );
                    const isAvailable = spell.unlocked_at_level <= character.level;

                    return (
                      <Card
                        key={spell.id}
                        className={`transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-purple-500 bg-purple-500/10'
                            : isAvailable
                              ? 'hover:bg-accent/50'
                              : 'opacity-50 cursor-not-allowed'
                        } ${getSpellColor(spell.effect_type)}`}
                        onClick={() => {
                          if (!isAvailable) return;

                          // Se já está selecionada, desselecionar
                          if (isSelected) {
                            Object.keys(selectedSpells).forEach(key => {
                              const slotKey = key as keyof SpellSelectionState;
                              if (selectedSpells[slotKey]?.id === spell.id) {
                                handleSlotClear(slotKey);
                              }
                            });
                            return;
                          }

                          // Encontrar primeiro slot vazio
                          if (!selectedSpells.slot1) {
                            handleSpellSelect(spell, 'slot1');
                          } else if (!selectedSpells.slot2) {
                            handleSpellSelect(spell, 'slot2');
                          } else if (!selectedSpells.slot3) {
                            handleSpellSelect(spell, 'slot3');
                          } else {
                            toast.warning(
                              'Você já selecionou 3 magias! Remova uma para adicionar outra.'
                            );
                          }
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getSpellColor(spell.effect_type)}`}>
                              {getSpellIcon(spell.effect_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-semibold truncate">{spell.name}</h3>
                                {isSelected && (
                                  <Badge
                                    variant="secondary"
                                    className="bg-purple-500/20 text-purple-400"
                                  >
                                    Selecionada
                                  </Badge>
                                )}
                                {!isAvailable && (
                                  <Badge variant="destructive" className="text-xs">
                                    Nível {spell.unlocked_at_level}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {spell.description}
                              </p>
                              <div className="flex flex-wrap gap-2 text-xs">
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Droplet className="h-3 w-3" />
                                  {spell.mana_cost} Mana
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {spell.cooldown}T CD
                                </Badge>
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Target className="h-3 w-3" />
                                  {spell.effect_value}
                                </Badge>
                                <Badge
                                  variant="outline"
                                  className={`flex items-center gap-1 ${getLevelCategoryColor(spell.unlocked_at_level)}`}
                                >
                                  <Star className="h-3 w-3" />
                                  Nível {spell.unlocked_at_level}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}

                  {filteredSpells.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma magia encontrada com os filtros selecionados</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Selected Spells Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Magias Selecionadas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {([1, 2, 3] as const).map(slotNumber => {
                const slotKey = `slot${slotNumber}` as keyof SpellSelectionState;
                const selectedSpell = selectedSpells[slotKey];

                return (
                  <Card
                    key={slotNumber}
                    className={`p-4 border-2 border-dashed transition-all ${
                      selectedSpell
                        ? `border-solid ${getSpellColor(selectedSpell.effect_type)}`
                        : 'border-muted-foreground/20 hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        Slot {slotNumber} (Tecla {slotNumber})
                      </Badge>
                      {selectedSpell && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSlotClear(slotKey)}
                          className="h-6 w-6 p-0 hover:bg-red-500/10 hover:text-red-500"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      )}
                    </div>

                    {selectedSpell ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <div
                            className={`p-1 rounded ${getSpellColor(selectedSpell.effect_type)}`}
                          >
                            {getSpellIcon(selectedSpell.effect_type)}
                          </div>
                          <div>
                            <h4 className="font-medium text-sm">{selectedSpell.name}</h4>
                            <p className="text-xs text-muted-foreground">
                              {SpellService.translateEffectType(selectedSpell.effect_type)}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-1">
                            <Droplet className="h-3 w-3" />
                            <span>{selectedSpell.mana_cost}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span>{selectedSpell.cooldown}T</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            <span>{selectedSpell.effect_value}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3" />
                            <span>Nv {selectedSpell.unlocked_at_level}</span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Clique em uma magia para equipar</p>
                      </div>
                    )}
                  </Card>
                );
              })}

              {hasChanges && (
                <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm text-yellow-400 flex items-center gap-2">
                    <span className="h-2 w-2 bg-yellow-400 rounded-full animate-pulse"></span>
                    Você tem alterações não salvas
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
