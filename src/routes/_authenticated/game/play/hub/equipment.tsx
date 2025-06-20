import { createFileRoute, useNavigate, Outlet, useLocation } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import { CharacterService } from '@/services/character.service';
import { EquipmentService } from '@/services/equipment.service';
import type { Character } from '@/models/character.model';
import type { EquipmentSlots, CharacterEquipment, Equipment } from '@/models/equipment.model';
import type { CharacterConsumable } from '@/models/consumable.model';
import { ConsumableService } from '@/services/consumable.service';
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
  const [equippedSlots, setEquippedSlots] = useState<EquipmentSlots>({});
  const [, setCharacterEquipment] = useState<CharacterEquipment[]>([]);
  const [consumables, setConsumables] = useState<CharacterConsumable[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);

  // Carregar dados do personagem
  useEffect(() => {
    const loadCharacterData = async () => {
      if (!characterId) return;

      try {
        setLoading(true);

        // Carregar personagem
        const charResponse = await CharacterService.getCharacter(characterId);
        if (charResponse.success && charResponse.data) {
          setCharacter(charResponse.data);
        }

        // Carregar equipamentos equipados
        const slotsData = await EquipmentService.getEquippedItems(characterId);
        setEquippedSlots(slotsData);

        // Carregar equipamentos do inventário
        const equipmentData = await EquipmentService.getCharacterEquipment(characterId);
        setCharacterEquipment(equipmentData);

        // Carregar consumíveis com log detalhado
        console.log('[EquipmentPage] Carregando consumíveis para personagem:', characterId);
        const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);
        console.log('[EquipmentPage] Resposta dos consumíveis:', consumablesResponse);

        if (consumablesResponse.success && consumablesResponse.data) {
          console.log(
            '[EquipmentPage] Consumíveis carregados com sucesso:',
            consumablesResponse.data
          );
          console.log('[EquipmentPage] Total de consumíveis:', consumablesResponse.data.length);

          // Log detalhado de cada consumível
          consumablesResponse.data.forEach((consumable, index) => {
            console.log(`[EquipmentPage] Consumível ${index + 1}:`, {
              id: consumable.id,
              consumable_id: consumable.consumable_id,
              quantity: consumable.quantity,
              consumable_name: consumable.consumable?.name,
              consumable_type: consumable.consumable?.type,
              hasConsumableData: !!consumable.consumable,
            });
          });

          setConsumables(consumablesResponse.data);
        } else {
          console.error('[EquipmentPage] Erro ao carregar consumíveis:', consumablesResponse.error);
          setConsumables([]);
        }
      } catch (error) {
        console.error('Erro ao carregar dados do equipamento:', error);
        toast.error('Erro ao carregar equipamentos');
      } finally {
        setLoading(false);
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
        slot: slotType as 'main_hand' | 'off_hand' | 'armor' | 'accessory',
      },
    });
  };

  const refreshEquipment = async () => {
    if (!characterId) return;

    try {
      const slotsData = await EquipmentService.getEquippedItems(characterId);
      setEquippedSlots(slotsData);

      const equipmentData = await EquipmentService.getCharacterEquipment(characterId);
      setCharacterEquipment(equipmentData);
    } catch (error) {
      console.error('Erro ao atualizar equipamentos:', error);
    }
  };

  // Função específica para recarregar consumíveis
  const refreshConsumables = async () => {
    if (!characterId) return;

    try {
      console.log('[EquipmentPage] Recarregando consumíveis...');
      const consumablesResponse = await ConsumableService.getCharacterConsumables(characterId);

      if (consumablesResponse.success && consumablesResponse.data) {
        console.log('[EquipmentPage] Consumíveis recarregados:', consumablesResponse.data.length);
        setConsumables(consumablesResponse.data);
      } else {
        console.error('[EquipmentPage] Erro ao recarregar consumíveis:', consumablesResponse.error);
      }
    } catch (error) {
      console.error('Erro ao recarregar consumíveis:', error);
    }
  };

  if (loading) {
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
