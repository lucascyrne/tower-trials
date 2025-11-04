import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type Character } from '@/models/character.model';
import { type Equipment } from '@/models/equipment.model';
import { EquipmentService } from '@/services/equipment.service';
import {
  Sword,
  Shield,
  Shirt,
  Gem,
  Star,
  Zap,
  Package,
  Heart,
  Target,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { toast } from 'sonner';

interface EquipmentDetailsPanelProps {
  selectedItem: Equipment | null;
  selectedSlot: string | null;
  character: Character;
  onEquipmentChange: () => void;
}

export const EquipmentDetailsPanel: React.FC<EquipmentDetailsPanelProps> = ({
  selectedItem,
  selectedSlot,
  character,
  onEquipmentChange,
}) => {
  const getEquipmentIcon = (item: Equipment) => {
    switch (item.type) {
      case 'weapon':
        return <Sword className="h-12 w-12 text-red-400" />;
      case 'armor':
        return <Shield className="h-12 w-12 text-blue-400" />;
      case 'chest':
        return <Shirt className="h-12 w-12 text-emerald-400" />;
      case 'helmet':
        return <Shield className="h-12 w-12 text-yellow-400" />;
      case 'legs':
        return <Shield className="h-12 w-12 text-cyan-400" />;
      case 'boots':
        return <Shield className="h-12 w-12 text-orange-400" />;
      case 'ring':
        return <Gem className="h-12 w-12 text-purple-400" />;
      case 'necklace':
        return <Gem className="h-12 w-12 text-pink-400" />;
      case 'amulet':
        return <Gem className="h-12 w-12 text-indigo-400" />;
      default:
        return <Shield className="h-12 w-12 text-slate-400" />;
    }
  };

  const getRarityColor = (rarity: string) => {
    const colors = {
      common: 'bg-slate-800/80 text-slate-300 border-slate-600',
      uncommon: 'bg-emerald-900/80 text-emerald-300 border-emerald-600',
      rare: 'bg-blue-900/80 text-blue-300 border-blue-600',
      epic: 'bg-purple-900/80 text-purple-300 border-purple-600',
      legendary: 'bg-amber-900/80 text-amber-300 border-amber-600',
    };
    return colors[rarity as keyof typeof colors] || colors.common;
  };

  const getSlotName = (slotType: string) => {
    switch (slotType) {
      case 'main_hand':
        return 'Mão Principal';
      case 'off_hand':
        return 'Mão Secundária';
      case 'armor':
        return 'Escudo';
      case 'chest':
        return 'Peitoral';
      case 'helmet':
        return 'Capacete';
      case 'legs':
        return 'Perneiras';
      case 'boots':
        return 'Botas';
      case 'ring_1':
        return 'Anel 1';
      case 'ring_2':
        return 'Anel 2';
      case 'necklace':
        return 'Colar';
      case 'amulet':
        return 'Amuleto';
      case 'accessory':
        return 'Acessório';
      default:
        return slotType;
    }
  };

  const handleUnequip = async () => {
    if (!selectedItem || !selectedSlot) return;

    try {
      // ✅ CORRIGIDO: Usar equipment_id original (não o ID expandido)
      // selectedItem é Equipment, então usamos selectedItem.id
      // Se fosse CharacterEquipment, usaríamos selectedItem.equipment_id
      const originalEquipmentId = selectedItem.id;
      const result = await EquipmentService.toggleEquipment(
        character.id,
        originalEquipmentId,
        false
      );

      if (result.success) {
        toast.success('Item desequipado com sucesso!');
        onEquipmentChange();
      } else {
        toast.error(result.error || 'Erro ao desequipar item');
      }
    } catch (error) {
      console.error('Erro ao desequipar item:', error);
      toast.error('Erro ao desequipar item');
    }
  };

  if (!selectedItem) {
    return (
      <Card className="bg-slate-800/50 border-slate-700/50 h-full">
        <CardHeader>
          <CardTitle className="text-slate-100">Detalhes do Item</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center text-slate-500">
            <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Nenhum item selecionado</p>
            <p className="text-sm mt-2 opacity-75">
              Clique em um slot para ver os detalhes do equipamento
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800/50 border-slate-700/50 h-full">
      <CardHeader>
        <CardTitle className="text-slate-100">Detalhes do Item</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
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
                {selectedItem.type === 'weapon'
                  ? 'Arma'
                  : selectedItem.type === 'armor'
                    ? 'Escudo'
                    : selectedItem.type === 'chest'
                      ? 'Peitoral'
                      : selectedItem.type === 'helmet'
                        ? 'Capacete'
                        : selectedItem.type === 'legs'
                          ? 'Perneiras'
                          : selectedItem.type === 'boots'
                            ? 'Botas'
                            : selectedItem.type === 'ring'
                              ? 'Anel'
                              : selectedItem.type === 'necklace'
                                ? 'Colar'
                                : selectedItem.type === 'amulet'
                                  ? 'Amuleto'
                                  : selectedItem.type}
              </Badge>
              {selectedItem.rarity === 'legendary' && (
                <Star className="h-4 w-4 text-amber-400 animate-pulse" />
              )}
            </div>
            {selectedSlot && (
              <p className="text-sm text-slate-400">Equipado em: {getSlotName(selectedSlot)}</p>
            )}
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
            {/* Stats de Combate Primários */}
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

            {selectedItem.speed_bonus > 0 && (
              <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  <span className="text-yellow-300 font-medium">Velocidade</span>
                </div>
                <p className="text-yellow-200 text-lg font-bold">+{selectedItem.speed_bonus}</p>
              </div>
            )}

            {/* HP e Mana */}
            {selectedItem.hp_bonus > 0 && (
              <div className="bg-green-900/30 border border-green-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-green-400" />
                  <span className="text-green-300 font-medium">HP</span>
                </div>
                <p className="text-green-200 text-lg font-bold">+{selectedItem.hp_bonus}</p>
              </div>
            )}

            {selectedItem.mana_bonus > 0 && (
              <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-300 font-medium">Mana</span>
                </div>
                <p className="text-purple-200 text-lg font-bold">+{selectedItem.mana_bonus}</p>
              </div>
            )}

            {/* Stats Avançados */}
            {selectedItem.critical_chance_bonus > 0 && (
              <div className="bg-orange-900/30 border border-orange-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-orange-400" />
                  <span className="text-orange-300 font-medium">Crit. Chance</span>
                </div>
                <p className="text-orange-200 text-lg font-bold">
                  +{selectedItem.critical_chance_bonus.toFixed(1)}%
                </p>
              </div>
            )}

            {selectedItem.critical_damage_bonus > 0 && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-red-400" />
                  <span className="text-red-300 font-medium">Crit. Dano</span>
                </div>
                <p className="text-red-200 text-lg font-bold">
                  +{selectedItem.critical_damage_bonus.toFixed(0)}%
                </p>
              </div>
            )}

            {selectedItem.double_attack_chance_bonus > 0 && (
              <div className="bg-cyan-900/30 border border-cyan-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-cyan-400" />
                  <span className="text-cyan-300 font-medium">Duplo Ataque</span>
                </div>
                <p className="text-cyan-200 text-lg font-bold">
                  +{selectedItem.double_attack_chance_bonus.toFixed(1)}%
                </p>
              </div>
            )}

            {selectedItem.magic_damage_bonus > 0 && (
              <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                  <span className="text-indigo-300 font-medium">Dano Mágico</span>
                </div>
                <p className="text-indigo-200 text-lg font-bold">
                  +{selectedItem.magic_damage_bonus.toFixed(1)}%
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Requisitos */}
        {selectedItem.level_requirement > 1 && (
          <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Requisitos</h4>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Nível mínimo:</span>
              <span
                className={`font-bold ${
                  character.level >= selectedItem.level_requirement
                    ? 'text-green-400'
                    : 'text-red-400'
                }`}
              >
                {selectedItem.level_requirement}
              </span>
            </div>
          </div>
        )}

        {/* Informações adicionais */}
        {selectedItem.weapon_subtype && (
          <div className="bg-slate-700/30 border border-slate-600/50 rounded-lg p-3">
            <h4 className="text-sm font-medium text-slate-300 mb-2">Tipo de Arma</h4>
            <p className="text-slate-400 capitalize">{selectedItem.weapon_subtype}</p>
          </div>
        )}

        {/* Ações */}
        {selectedSlot && (
          <div className="pt-4 border-t border-slate-700/50">
            <Button
              onClick={handleUnequip}
              variant="outline"
              className="w-full bg-slate-800/50 border-slate-600 text-slate-300 hover:bg-slate-700/50 hover:border-slate-500 hover:text-slate-200 transition-all duration-200"
            >
              <Package className="h-4 w-4 mr-2" />
              Desequipar Item
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
