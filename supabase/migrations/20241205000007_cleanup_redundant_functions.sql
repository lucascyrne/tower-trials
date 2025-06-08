-- ================================================
-- LIMPEZA DE FUNÇÕES REDUNDANTES
-- ================================================
-- Esta migração remove funções duplicadas/obsoletas e mantém apenas
-- as versões mais modernas e funcionais baseadas na evolução do código

-- ================================================
-- 1. LIMPEZA DE FUNÇÕES DE CÁLCULO DE STATS
-- ================================================

-- Remover versões antigas de funções de cálculo de stats
-- Mantendo apenas: calculate_derived_stats e calculate_final_character_stats
DROP FUNCTION IF EXISTS calculate_character_derived_stats(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS calculate_derived_stats_with_weapon(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, weapon_subtype);

-- A função get_character_full_stats é mantida pois tem propósito específico diferente
-- A função get_character_detailed_stats é mantida pois retorna dados diferentes

-- ================================================
-- 2. LIMPEZA DE FUNÇÕES DE MONSTROS
-- ================================================

-- Remover função antiga de monstros, mantendo apenas a versão com ciclos
DROP FUNCTION IF EXISTS get_monster_for_floor_cyclic(INTEGER);

-- A função get_monster_for_floor foi atualizada para usar o sistema de ciclos
-- nas migrações mais recentes, então é a única que mantemos

-- ================================================
-- 3. LIMPEZA DE FUNÇÕES DE ESCALAMENTO DE MONSTROS
-- ================================================

-- Remover versões antigas de escalamento
DROP FUNCTION IF EXISTS scale_monster_stats(RECORD, INTEGER);
DROP FUNCTION IF EXISTS scale_monster_stats_with_floor(RECORD, INTEGER);

-- Mantendo apenas scale_monster_stats_balanced que é a versão mais recente

-- ================================================
-- 4. LIMPEZA DE FUNÇÕES DE RANKING DUPLICADAS
-- ================================================

-- Baseado na análise das migrações, o sistema de ranking foi reescrito várias vezes
-- As versões mais recentes estão em 20241202000012_definitive_ranking_system.sql
-- Removendo versões antigas que podem ter ficado órfãs

-- Verificar e remover possíveis duplicatas de ranking
DROP FUNCTION IF EXISTS get_ranking_by_gold(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_ranking_by_level(INTEGER, INTEGER);  
DROP FUNCTION IF EXISTS get_ranking_by_highest_floor(INTEGER, INTEGER);

-- Remover versões antigas de save_ranking_entry se existirem múltiplas
-- (Mantendo apenas as versões com SECURITY DEFINER)

-- ================================================
-- 5. LIMPEZA DE FUNÇÕES DE VALIDAÇÃO OBSOLETAS
-- ================================================

-- Remover funções de teste que podem ter ficado no banco
DROP FUNCTION IF EXISTS test_ranking_system(UUID);
DROP FUNCTION IF EXISTS test_ranking_after_fix();
DROP FUNCTION IF EXISTS test_ranking_data();
DROP FUNCTION IF EXISTS test_monster_scaling();
DROP FUNCTION IF EXISTS test_tier_progression();

-- ================================================
-- 6. LIMPEZA DE FUNÇÕES DE DEBUG
-- ================================================

-- Remover funções de debug que não devem estar em produção
DROP FUNCTION IF EXISTS debug_character_ranking(TEXT);
DROP FUNCTION IF EXISTS check_ranking_data_integrity();
DROP FUNCTION IF EXISTS fix_ranking_data_issues();
DROP FUNCTION IF EXISTS verify_ranking_integrity();
DROP FUNCTION IF EXISTS log_ranking_update();

-- ================================================
-- 7. LIMPEZA DE TRIGGERS ÓRFÃOS
-- ================================================

-- Remover triggers que podem estar associados a funções removidas
DROP TRIGGER IF EXISTS log_ranking_updates ON characters;
DROP TRIGGER IF EXISTS update_critical_stats_trigger ON characters;

-- ================================================
-- 8. LIMPEZA DE FUNÇÕES AUXILIARES OBSOLETAS
-- ================================================

-- Remover funções que foram substituídas por versões mais recentes
DROP FUNCTION IF EXISTS get_best_character_per_user_by_level(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_best_character_per_user_by_gold(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_optimized_global_ranking(VARCHAR, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_fast_user_stats(UUID);
DROP FUNCTION IF EXISTS get_fast_user_ranking_history(UUID, INTEGER, INTEGER);

-- ================================================
-- 9. FUNÇÕES DE MANUTENÇÃO QUE DEVEM SER REMOVIDAS
-- ================================================

-- Remover funções de manutenção que eram temporárias
DROP FUNCTION IF EXISTS sync_all_character_rankings();
DROP FUNCTION IF EXISTS refresh_all_rankings();
DROP FUNCTION IF EXISTS force_ranking_refresh();
DROP FUNCTION IF EXISTS recalculate_all_character_stats();

-- ================================================
-- 10. CONFIRMAR LIMPEZA DE TIPOS ÓRFÃOS
-- ================================================

-- Verificar se há tipos que não são mais utilizados
-- (Não removendo tipos pois podem quebrar outras funcionalidades)

-- ================================================
-- COMENTÁRIOS FINAIS
-- ================================================

-- Após esta limpeza, as funções principais mantidas são:
-- 
-- STATS DE PERSONAGEM:
-- - calculate_derived_stats (versão mais recente)
-- - calculate_final_character_stats (com bônus de equipamentos)
-- - get_character_full_stats (dados completos do personagem)
-- - get_character_detailed_stats (stats detalhados incluindo equipamentos)
-- - recalculate_character_stats (recalcula e atualiza stats)
--
-- MONSTROS:
-- - get_monster_for_floor (versão com sistema de ciclos)
-- - scale_monster_stats_balanced (escalamento balanceado)
--
-- RANKING:
-- - get_dynamic_ranking_by_highest_floor
-- - get_dynamic_ranking_by_level  
-- - get_dynamic_ranking_by_gold
-- - get_dynamic_user_ranking_history
-- - get_dynamic_user_stats
-- - save_ranking_entry_on_death
--
-- SEGURANÇA:
-- - secure_grant_xp
-- - secure_grant_gold
-- - secure_advance_floor
-- - secure_process_combat_drops

-- Limpeza de funções redundantes concluída 