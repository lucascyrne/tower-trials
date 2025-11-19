-- =============================================
-- MIGRATION: Sincronização de Estatísticas do Cemitério com Dados Legados
-- Version: 1.0
-- Description: Atualizar get_cemetery_stats para sincronizar de múltiplas fontes
-- Issue: get_cemetery_stats só consultava dead_characters, não sincronizava legados
-- Dependencies: 00038, 00039
-- =============================================

-- === REMOVER FUNÇÃO ANTIGA ===

DROP FUNCTION IF EXISTS get_cemetery_stats(UUID);

-- === CRIAR FUNÇÃO SINCRONIZADA ===

-- Buscar estatísticas do cemitério sincronizando de múltiplas fontes
CREATE OR REPLACE FUNCTION get_cemetery_stats(p_user_id UUID)
RETURNS TABLE (
    total_deaths INTEGER,
    highest_floor_reached INTEGER,
    highest_level_reached INTEGER,
    total_survival_time_hours NUMERIC,
    most_common_death_cause VARCHAR,
    deadliest_monster VARCHAR
) AS $$
WITH all_dead_characters AS (
    -- Fonte 1: dead_characters (principal)
    SELECT
        1 as source_priority,
        dc.id,
        dc.level,
        dc.floor_reached,
        dc.death_cause,
        dc.killed_by_monster,
        dc.survival_time_minutes,
        dc.user_id
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id
    
    UNION ALL
    
    -- Fonte 2: characters com is_alive = FALSE (sem entrada em dead_characters)
    SELECT
        2 as source_priority,
        c.id,
        c.level,
        c.floor,
        'Battle defeat'::VARCHAR,
        NULL::VARCHAR,
        EXTRACT(EPOCH FROM (c.updated_at - c.created_at))::INTEGER / 60,
        c.user_id
    FROM characters c
    WHERE c.user_id = p_user_id
      AND c.is_alive = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM dead_characters dc
        WHERE dc.user_id = c.user_id AND dc.original_character_id = c.id
      )
    
    UNION ALL
    
    -- Fonte 3: game_rankings com character_alive = FALSE (fallback)
    SELECT
        3 as source_priority,
        gr.id,
        gr.character_level,
        gr.highest_floor,
        'Battle defeat'::VARCHAR,
        NULL::VARCHAR,
        0,
        gr.user_id
    FROM game_rankings gr
    WHERE gr.user_id = p_user_id
      AND gr.character_alive = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM dead_characters dc2
        WHERE dc2.user_id = p_user_id AND dc2.name = gr.player_name
      )
      AND NOT EXISTS (
        SELECT 1 FROM characters c2
        WHERE c2.user_id = p_user_id AND c2.name = gr.player_name AND c2.is_alive = FALSE
      )
)
SELECT
    COUNT(DISTINCT id)::INTEGER as total_deaths,
    COALESCE(MAX(floor_reached), 0)::INTEGER as highest_floor_reached,
    COALESCE(MAX(level), 0)::INTEGER as highest_level_reached,
    COALESCE(SUM(survival_time_minutes)::NUMERIC / 60.0, 0)::NUMERIC as total_survival_time_hours,
    (
        SELECT death_cause
        FROM all_dead_characters
        WHERE death_cause IS NOT NULL
        GROUP BY death_cause
        ORDER BY COUNT(*) DESC
        LIMIT 1
    )::VARCHAR as most_common_death_cause,
    (
        SELECT killed_by_monster
        FROM all_dead_characters
        WHERE killed_by_monster IS NOT NULL
        GROUP BY killed_by_monster
        ORDER BY COUNT(*) DESC
        LIMIT 1
    )::VARCHAR as deadliest_monster
FROM all_dead_characters;
$$ LANGUAGE sql;

-- === COMENTÁRIOS ===

COMMENT ON FUNCTION get_cemetery_stats(UUID) IS 
'Retorna estatísticas agregadas do cemitério sincronizando de múltiplas fontes: dead_characters (principal), characters (is_alive=FALSE), e game_rankings (fallback).';









