-- ============================================================
-- BASELINE CONSOLIDADA - DRAFT EXECUCIONAL
-- ============================================================
-- Objetivo: substituir o replay de migracoes historicas por um
-- estado inicial limpo e auditavel, com funcoes/policies finais.
--
-- Como preencher este draft:
-- 1) gerar schema final em homologacao;
-- 2) colar DDL final por secao (na ordem abaixo);
-- 3) validar contrato em docs/database/runtime-contract-matrix.md;
-- 4) validar checklist em supabase/baseline/post-baseline-checklist.md.

BEGIN;

-- ============================================================
-- 00) EXTENSOES E SCHEMAS
-- ============================================================
-- TODO: criar extensoes necessarias (ex. pgcrypto) e schema privado
-- para funcoes privilegiadas, se aplicavel.

-- ============================================================
-- 01) TABELAS NUCLEO AUTH/USER
-- ============================================================
-- users
-- TODO: colar CREATE TABLE final + constraints/indices finais

-- ============================================================
-- 02) TABELAS NUCLEO GAME
-- ============================================================
-- characters, game_progress, monsters, floors, special_events,
-- consumables, equipment, spells, drops, recipes, slots, cemetery.
-- TODO: colar DDL final consolidado destas tabelas.

-- ============================================================
-- 03) FUNCOES E RPCs FINAIS
-- ============================================================
-- Auth/user:
--   create_user_profile
--
-- Character/progression:
--   get_user_characters, get_character_full_stats, get_character,
--   create_character, delete_character, check_character_limit,
--   get_user_character_progression, update_character_activity,
--   distribute_attribute_points, add_skill_xp, recalculate_character_stats,
--   get_character_unlocked_checkpoints
--
-- Secure anti-cheat:
--   secure_grant_xp, secure_grant_gold, secure_advance_floor,
--   secure_process_combat_drops, internal_update_character_hp_mana,
--   consume_potion_from_slot
--
-- Game loop:
--   get_floor_data, get_monster_for_floor, get_special_event_for_floor,
--   process_special_event
--
-- Inventory/equipment/spell:
--   buy_consumable, use_consumable, check_can_craft, craft_item,
--   get_equipped_slots, toggle_equipment, buy_equipment, sell_equipment,
--   can_equip_item, check_can_craft_equipment, craft_equipment,
--   compare_equipment_stats, calculate_equipment_bonuses_enhanced,
--   get_character_potion_slots, set_potion_slot, clear_potion_slot,
--   get_character_spell_slots, set_spell_slot,
--   get_character_available_spells, set_character_spells,
--   get_character_spell_stats, get_available_spells
--
-- Ranking/cemetery:
--   save_ranking_entry, count_ranking_entries,
--   get_dynamic_user_ranking_history, get_dynamic_user_stats,
--   save_ranking_entry_on_death, get_user_cemetery, count_user_cemetery,
--   get_cemetery_stats
--
-- TODO: colar CREATE OR REPLACE FUNCTION finais.

-- ============================================================
-- 04) POLICIES RLS
-- ============================================================
-- TODO: habilitar RLS em tabelas expostas e aplicar policies finais.

-- ============================================================
-- 05) GRANTS/REVOKES
-- ============================================================
-- TODO:
-- - revogar PUBLIC em objetos sensiveis;
-- - grants minimos por role;
-- - grants de EXECUTE para RPCs seguras conforme modelo final.

-- ============================================================
-- 06) COMENTARIOS E METADADOS
-- ============================================================
-- TODO: adicionar COMMENT ON FUNCTION/TABLE para funcoes criticas.

COMMIT;
