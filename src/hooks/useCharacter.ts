/**
 * ✅ NOVO: Hook para carregar um personagem com validação rigorosa
 * Sem fallbacks - falha explicitamente se dados forem inválidos
 */

import { useState, useEffect, useCallback } from 'react';
import { CharacterService } from '@/resources/character/character.service';
import type { Character } from '@/resources/character/character.model';
import { toast } from 'sonner';

interface UseCharacterResult {
  character: Character | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Hook para carregar um personagem específico com validação rigorosa
 * Falha explicitamente se dados forem inválidos - sem fallbacks
 */
export function useCharacter(characterId: string | undefined): UseCharacterResult {
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCharacter = useCallback(async () => {
    if (!characterId?.trim()) {
      const err = 'ID do personagem não fornecido';
      console.error(`[useCharacter] ❌ ${err}`);
      setError(err);
      setCharacter(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[useCharacter] Carregando personagem: ${characterId}`);

      const response = await CharacterService.getCharacter(characterId);

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Personagem não encontrado');
      }

      const loaded = response.data;

      // ✅ VALIDAÇÃO RIGOROSA - sem fallbacks
      if (!loaded.id || !loaded.name || loaded.level === null || loaded.level === undefined) {
        throw new Error('Dados do personagem inválidos ou incompletos');
      }

      if (loaded.level < 1 || loaded.level > 100) {
        throw new Error(`Nível inválido: ${loaded.level}`);
      }

      console.log(`[useCharacter] ✅ Personagem carregado:`, {
        id: loaded.id,
        name: loaded.name,
        level: loaded.level,
        floor: loaded.floor,
      });

      setCharacter(loaded);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar personagem';
      console.error(`[useCharacter] ❌ ${errorMessage}`);

      setError(errorMessage);
      setCharacter(null);

      // Verificar se é erro de autenticação
      if (errorMessage.includes('autenticação') || errorMessage.includes('não autorizado')) {
        toast.error('Sessão expirada. Faça login novamente.');
        window.location.href = '/auth';
      }
    } finally {
      setLoading(false);
    }
  }, [characterId]);

  useEffect(() => {
    loadCharacter();
  }, [loadCharacter]);

  return {
    character,
    loading,
    error,
    retry: loadCharacter,
  };
}

/**
 * Hook para carregar um personagem para o jogo (com auto-heal e stats completos)
 * Falha explicitamente se dados forem inválidos - sem fallbacks
 */
export function useCharacterForGame(
  characterId: string | undefined,
  forceRefresh: boolean = false
): UseCharacterResult {
  const [character, setCharacter] = useState<Character | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCharacter = useCallback(async () => {
    if (!characterId?.trim()) {
      const err = 'ID do personagem não fornecido';
      console.error(`[useCharacterForGame] ❌ ${err}`);
      setError(err);
      setCharacter(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      console.log(`[useCharacterForGame] Carregando personagem para jogo: ${characterId}`);

      const response = await CharacterService.getCharacterForGame(
        characterId,
        forceRefresh,
        true // applyAutoHeal
      );

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Personagem não encontrado');
      }

      const loaded = response.data;

      // ✅ VALIDAÇÃO RIGOROSA - sem fallbacks
      if (!loaded.id || !loaded.name || loaded.level === null || loaded.level === undefined) {
        throw new Error('Dados do personagem inválidos ou incompletos');
      }

      if (loaded.level < 1 || loaded.level > 100) {
        throw new Error(`Nível inválido: ${loaded.level}`);
      }

      console.log(`[useCharacterForGame] ✅ Personagem carregado:`, {
        id: loaded.id,
        name: loaded.name,
        level: loaded.level,
        hp: `${loaded.hp}/${loaded.max_hp}`,
      });

      // ✅ Cast seguro: GamePlayer é compatível com Character
      setCharacter(loaded as Character);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar personagem';
      console.error(`[useCharacterForGame] ❌ ${errorMessage}`);

      setError(errorMessage);
      setCharacter(null);

      // Verificar se é erro de autenticação
      if (errorMessage.includes('autenticação') || errorMessage.includes('não autorizado')) {
        toast.error('Sessão expirada. Faça login novamente.');
        window.location.href = '/auth';
      }
    } finally {
      setLoading(false);
    }
  }, [characterId, forceRefresh]);

  useEffect(() => {
    loadCharacter();
  }, [loadCharacter]);

  return {
    character,
    loading,
    error,
    retry: loadCharacter,
  };
}
