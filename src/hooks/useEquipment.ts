/**
 * Hook para carregar e gerenciar equipamentos do personagem
 * Centraliza a lógica de obtenção de dados de equipamento
 */

import { useState, useEffect, useCallback } from 'react';
import { EquipmentService } from '@/resources/equipment/equipment.service';
import type { CharacterEquipment, EquipmentSlots } from '@/resources/equipment/equipment.model';

interface UseEquipmentResult {
  allEquipment: CharacterEquipment[];
  equippedSlots: EquipmentSlots;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook para carregar equipamentos completos do personagem
 */
export function useEquipment(characterId: string | undefined): UseEquipmentResult {
  const [allEquipment, setAllEquipment] = useState<CharacterEquipment[]>([]);
  const [equippedSlots, setEquippedSlots] = useState<EquipmentSlots>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadEquipment = useCallback(async () => {
    if (!characterId?.trim()) {
      const err = 'ID do personagem não fornecido';
      console.error(`[useEquipment] ❌ ${err}`);
      setError(err);
      setAllEquipment([]);
      setEquippedSlots({});
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Carregar dados completos do equipamento
      const result = await EquipmentService.getCharacterEquipmentComplete(characterId);

      if (!result) {
        throw new Error('Falha ao carregar equipamentos');
      }

      setAllEquipment(result.allEquipment);
      setEquippedSlots(result.equippedSlots);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar equipamentos';
      console.error(`[useEquipment] ❌ ${errorMessage}`);
      setError(errorMessage);
      setAllEquipment([]);
      setEquippedSlots({});
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    loadEquipment();
  }, [loadEquipment]);

  return {
    allEquipment,
    equippedSlots,
    loading,
    error,
    refresh: loadEquipment,
  };
}
