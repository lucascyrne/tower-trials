-- =============================================
-- MIGRATION: Sincronização de Cemitério com Dados Legados
-- Version: 1.0
-- Description: Criar funções que sincronizam dados de personagens mortos de múltiplas fontes
-- Issue: Personagens que morreram antes da migração 00038 ficam sem dados em dead_characters
-- Fontes: dead_characters (principal), characters (is_alive=FALSE), game_rankings (fallback)
-- =============================================

-- === ATUALIZAR FUNÇÕES EXISTENTES PARA SINCRONIZAÇÃO ===

DROP FUNCTION IF EXISTS count_user_cemetery(UUID);
DROP FUNCTION IF EXISTS get_user_cemetery(UUID, INTEGER, INTEGER);

-- Contar personagens mortos sincronizando de múltiplas fontes
CREATE OR REPLACE FUNCTION count_user_cemetery(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT combined_id) INTO v_count FROM (
        -- Fonte 1: dead_characters (principal)
        SELECT DISTINCT dc.id as combined_id
        FROM dead_characters dc
        WHERE dc.user_id = p_user_id
        
        UNION
        
        -- Fonte 2: characters com is_alive = FALSE (que não estão em dead_characters)
        SELECT DISTINCT c.id as combined_id
        FROM characters c
        WHERE c.user_id = p_user_id
          AND c.is_alive = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM dead_characters dc2
            WHERE dc2.user_id = p_user_id 
              AND dc2.original_character_id = c.id
          )
        
        UNION
        
        -- Fonte 3: game_rankings com character_alive = FALSE (fallback para dados muito antigos)
        SELECT DISTINCT gr.id as combined_id
        FROM game_rankings gr
        WHERE gr.user_id = p_user_id
          AND gr.character_alive = FALSE
          AND NOT EXISTS (
            SELECT 1 FROM dead_characters dc3
            WHERE dc3.user_id = p_user_id
              AND dc3.name = gr.player_name
          )
          AND NOT EXISTS (
            SELECT 1 FROM characters c3
            WHERE c3.user_id = p_user_id
              AND c3.name = gr.player_name
              AND c3.is_alive = FALSE
          )
    ) combined_results;
    
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql;

-- Buscar cemitério sincronizando de múltiplas fontes
CREATE OR REPLACE FUNCTION get_user_cemetery(
    p_user_id UUID, 
    p_limit INTEGER DEFAULT 20, 
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    original_character_id UUID,
    name VARCHAR,
    level INTEGER,
    xp BIGINT,
    gold BIGINT,
    strength INTEGER,
    dexterity INTEGER,
    intelligence INTEGER,
    wisdom INTEGER,
    vitality INTEGER,
    luck INTEGER,
    max_hp INTEGER,
    max_mana INTEGER,
    atk INTEGER,
    def INTEGER,
    speed INTEGER,
    floor_reached INTEGER,
    highest_floor INTEGER,
    total_monsters_killed INTEGER,
    total_damage_dealt BIGINT,
    total_damage_taken BIGINT,
    total_spells_cast INTEGER,
    total_potions_used INTEGER,
    death_cause VARCHAR,
    killed_by_monster VARCHAR,
    character_created_at TIMESTAMPTZ,
    died_at TIMESTAMPTZ,
    survival_time_minutes INTEGER,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    -- Fonte 1: dead_characters (dados completos, tem precedência)
    SELECT
        dc.id,
        dc.user_id,
        dc.original_character_id,
        dc.name,
        dc.level,
        dc.xp,
        dc.gold,
        dc.strength,
        dc.dexterity,
        dc.intelligence,
        dc.wisdom,
        dc.vitality,
        dc.luck,
        dc.max_hp,
        dc.max_mana,
        dc.atk,
        dc.def,
        dc.speed,
        dc.floor_reached,
        dc.highest_floor,
        dc.total_monsters_killed,
        dc.total_damage_dealt,
        dc.total_damage_taken,
        dc.total_spells_cast,
        dc.total_potions_used,
        dc.death_cause,
        dc.killed_by_monster,
        dc.character_created_at,
        dc.died_at,
        dc.survival_time_minutes,
        dc.created_at,
        dc.updated_at
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id
    
    UNION ALL
    
    -- Fonte 2: characters com is_alive = FALSE (que não têm entrada em dead_characters)
    SELECT
        c.id,
        c.user_id,
        c.id,  -- original_character_id = id mesmo
        c.name,
        c.level,
        c.xp,
        c.gold,
        c.strength,
        c.dexterity,
        c.intelligence,
        c.wisdom,
        c.vitality,
        c.luck,
        c.max_hp,
        c.max_mana,
        c.atk,
        c.def,
        c.speed,
        c.floor,
        c.floor,
        0,  -- total_monsters_killed
        0,  -- total_damage_dealt
        0,  -- total_damage_taken
        0,  -- total_spells_cast
        0,  -- total_potions_used
        'Battle defeat'::VARCHAR,
        NULL::VARCHAR,
        c.created_at,
        c.updated_at,
        EXTRACT(EPOCH FROM (c.updated_at - c.created_at))::INTEGER / 60,  -- survival_time_minutes calculado
        c.created_at,
        c.updated_at
    FROM characters c
    WHERE c.user_id = p_user_id
      AND c.is_alive = FALSE
      AND NOT EXISTS (
        SELECT 1 FROM dead_characters dc
        WHERE dc.user_id = c.user_id AND dc.original_character_id = c.id
      )
    
    UNION ALL
    
    -- Fonte 3: game_rankings (fallback para dados muito antigos)
    SELECT
        gr.id,
        gr.user_id,
        gr.id,  -- original_character_id
        gr.player_name,
        gr.character_level,
        0,  -- xp (não disponível)
        gr.character_gold,
        10,  -- strength (padrão)
        10,  -- dexterity
        10,  -- intelligence
        10,  -- wisdom
        10,  -- vitality
        10,  -- luck
        100,  -- max_hp (padrão)
        50,  -- max_mana (padrão)
        gr.character_level * 2,  -- atk estimado
        10,  -- def
        12,  -- speed
        gr.highest_floor,
        gr.highest_floor,
        0,  -- total_monsters_killed
        0,  -- total_damage_dealt
        0,  -- total_damage_taken
        0,  -- total_spells_cast
        0,  -- total_potions_used
        'Battle defeat'::VARCHAR,
        NULL::VARCHAR,
        gr.created_at,
        gr.created_at,
        0,  -- survival_time_minutes (não disponível)
        gr.created_at,
        gr.created_at
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
    
    ORDER BY died_at DESC, created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- === COMENTÁRIOS ===

COMMENT ON FUNCTION count_user_cemetery(UUID) IS 
'Conta o número total de personagens mortos sincronizando de múltiplas fontes: dead_characters (principal), characters (is_alive=FALSE), e game_rankings (fallback).';

COMMENT ON FUNCTION get_user_cemetery(UUID, INTEGER, INTEGER) IS 
'Retorna todos os detalhes dos personagens mortos sincronizando de múltiplas fontes com paginação.';

