import { supabase } from '@/lib/supabase';
import {
  AdminGamePort,
  ConsumePotionSlotInput,
  ProcessCombatDropsInput,
  SecureAdvanceFloorInput,
  SecureGrantGoldInput,
  SecureGrantXpInput,
} from '../../application/ports/admin-game.port';

export class SupabaseAdminGameRepository implements AdminGamePort {
  private formatRpcError(error: unknown): Error {
    if (!error || typeof error !== 'object') {
      return new Error('Erro RPC desconhecido');
    }

    const e = error as {
      message?: string;
      details?: string | null;
      hint?: string | null;
      code?: string;
    };
    const parts = [e.message || 'Erro RPC'];
    if (e.code) parts.push(`code=${e.code}`);
    if (e.details) parts.push(`details=${e.details}`);
    if (e.hint) parts.push(`hint=${e.hint}`);
    return new Error(parts.join(' | '));
  }

  async secureGrantXp(input: SecureGrantXpInput): Promise<unknown> {
    const { data, error } = await supabase
      .rpc('secure_grant_xp', {
        p_character_id: input.characterId,
        p_xp_amount: input.xpAmount,
        p_source: input.source ?? 'combat',
      })
      .single();

    if (error) throw this.formatRpcError(error);

    return data;
  }

  async secureGrantGold(input: SecureGrantGoldInput): Promise<number> {
    const { data, error } = await supabase
      .rpc('secure_grant_gold', {
        p_character_id: input.characterId,
        p_gold_amount: input.goldAmount,
        p_source: input.source ?? 'combat',
      })
      .single();

    if (error) throw this.formatRpcError(error);

    return data as number;
  }

  async secureAdvanceFloor(input: SecureAdvanceFloorInput): Promise<void> {
    const { error } = await supabase.rpc('secure_advance_floor', {
      p_character_id: input.characterId,
      p_new_floor: input.newFloor,
    });

    if (error) throw this.formatRpcError(error);
  }

  async processCombatDrops(input: ProcessCombatDropsInput): Promise<number> {
    const { data, error } = await supabase
      .rpc('secure_process_combat_drops', {
        p_character_id: input.characterId,
        p_drops: input.drops,
      })
      .single();

    if (error) throw this.formatRpcError(error);

    return data as number;
  }

  async consumePotionFromSlot(input: ConsumePotionSlotInput): Promise<unknown> {
    const { data, error } = await supabase.rpc('consume_potion_from_slot', {
      p_character_id: input.characterId,
      p_slot_position: input.slotPosition,
    });

    if (error) throw this.formatRpcError(error);

    return data;
  }
}
