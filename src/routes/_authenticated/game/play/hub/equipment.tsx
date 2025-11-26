import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { CharacterService } from '@/resources/character/character.service';
import { ConsumableService } from '@/resources/consumable/consumable.service';
import type { Character } from '@/resources/character/character.model';
import type { CharacterConsumable } from '@/resources/consumable/consumable.model';
import type { Equipment } from '@/resources/equipment/equipment.model';
import { useEquipment } from '@/hooks/useEquipment';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Shield, Sword } from 'lucide-react';
import { toast } from 'sonner';
import { EquipmentDetailsPanel } from '@/features/equipment/EquipmentDetailsPanel';
import { EquipmentSlotPanel } from '@/features/equipment/EquipmentSlotPanel';
import { PotionSlotManager } from '@/features/consumable/PotionSlotManager';

export const Route = createFileRoute('/_authenticated/game/play/hub/equipment')({
  component: EquipmentLayout,
  validateSearch: search => ({
    character: (search.character as string) || '',
  }),
});

function EquipmentLayout() {
  const location = useLocation();

  // Se estamos exatamente na rota /equipment, mostrar a página principal
  // Caso contrário, mostrar o Outlet com as páginas filhas
  if (location.pathname === '/game/play/hub/equipment') {
    return <EquipmentPage />;
  }

  // Para rotas filhas como /equipment/select
  return <Outlet />;
}

function EquipmentPage() {
  const navigate = useNavigate();
  const { character: characterId } = Route.useSearch();

  const [character, setCharacter] = useState<Character | null>(null);
  const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);

  // ✅ NOVO: Usar hook para carregar equipamentos
  const {
    equippedSlots,
    loading: equipLoading,
    refresh: refreshEquipment,
  } = useEquipment(characterId);

  // Carregar dados do personagem
  useEffect(() => {
    const loadCharacterData = async () => {
      if (!characterId) return;

      try {
        // Carregar personagem
        const charResponse = await CharacterService.getCharacter(characterId);
        if (charResponse.success && charResponse.data) {
          setCharacter(charResponse.data);
        }

        // Carregar consumíveis com log detalhado
        const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);

        if (consumablesResponse.success && consumablesResponse.data) {
          setConsumables(consumablesResponse.data);
        } else {
          console.error('[EquipmentPage] Erro ao carregar consumíveis:', consumablesResponse.error);
          setConsumables([]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do equipamento:', error);
        toast.error('Erro ao carregar equipamentos');
      }
    };

    loadCharacterData();
  }, [characterId]);

  const handleSlotClick = (slotType: string, item: Equipment | null) => {
    setSelectedSlot(slotType);
    setSelectedItem(item);
  };

  const handleSlotLongPress = (slotType: string) => {
    navigate({
      to: '/game/play/hub/equipment/select',
      search: {
        character: characterId!,
        slot: slotType as
          | 'main_hand'
          | 'off_hand'
          | 'armor'
          | 'amulet'
          | 'necklace'
          | 'ring_1'
          | 'ring_2',
      },
    });
  };

  // ✅ NOVO: Verificar se há uma arma two-handed equipada
  const isTwoHandedActive =
    equippedSlots.main_hand?.type === 'weapon' && equippedSlots.main_hand?.is_two_handed;

  // Função específica para recarregar consumíveis
  const refreshConsumables = async () => {
    if (!characterId) return;
    const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);

    if (consumablesResponse.success && consumablesResponse.data) {
      setConsumables(consumablesResponse.data);
    }
  };

  if (equipLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-slate-700 rounded w-64"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-96 bg-slate-700 rounded"></div>
              <div className="h-96 bg-slate-700 rounded"></div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate({ to: '/game/play/hub', search: { character: characterId } })}
              className="w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <div className="mt-2 sm:mt-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-100 flex items-center gap-2">
                <Shield className="h-6 sm:h-8 w-6 sm:w-8 text-amber-400" />
                Equipamentos
              </h1>
              <p className="text-sm sm:text-base text-slate-400">
                {character.name} - Nível {character.level}
              </p>
            </div>
          </div>
        </div>

        {/* Layout Principal */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Painel Esquerdo - Slots de Equipamento */}
          <div className="space-y-6">
            <EquipmentSlotPanel
              equippedSlots={equippedSlots}
              onSlotClick={handleSlotClick}
              onSlotLongPress={handleSlotLongPress}
            />

            {/* ✅ NOVO: Aviso de Arma Two-Handed */}
            {isTwoHandedActive && (
              <Card className="bg-orange-900/30 border-2 border-orange-600/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">⚔️</div>
                    <div>
                      <h3 className="font-semibold text-orange-300 mb-1">Arma Two-Handed Ativa</h3>
                      <p className="text-sm text-orange-200">
                        <strong>{equippedSlots.main_hand?.name}</strong> ocupa ambas as mãos. A mão
                        secundária está bloqueada.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Slots de Poção */}
            <Card className="bg-slate-800/50 border-slate-700/50">
              <CardHeader>
                <CardTitle className="text-slate-100 flex items-center gap-2">
                  <Sword className="h-5 w-5 text-blue-400" />
                  Slots de Poções
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PotionSlotManager
                  characterId={characterId!}
                  consumables={consumables}
                  onSlotsUpdate={refreshConsumables}
                />
              </CardContent>
            </Card>
          </div>

          {/* Painel Direito - Detalhes do Item */}
          <div>
            <EquipmentDetailsPanel
              selectedItem={selectedItem}
              selectedSlot={selectedSlot}
              character={character}
              onEquipmentChange={refreshEquipment}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
