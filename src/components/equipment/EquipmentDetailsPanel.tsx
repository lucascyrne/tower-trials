import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { type Character } from '@/resources/game/models/character.model';
import { type Equipment } from '@/resources/game/models/equipment.model';
import { EquipmentService } from '@/resources/game/equipment.service';
import { Sword, Shield, Shirt, Gem, Star, Zap, Package } from 'lucide-react';
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
        return <Shirt className="h-12 w-12 text-blue-400" />;
      case 'accessory':
        return <Gem className="h-12 w-12 text-purple-400" />;
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
        return 'Armadura';
      case 'accessory':
        return 'Acessório';
      default:
        return slotType;
    }
  };

  const handleUnequip = async () => {
    if (!selectedItem || !selectedSlot) return;

    try {
      const result = await EquipmentService.toggleEquipment(character.id, selectedItem.id, false);

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
                {selectedItem.type}
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
              className="w-full border-red-600 text-red-400 hover:bg-red-900/30"
            >
              Desequipar Item
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
