-- =============================================
-- MIGRATION: Correção das Funções de Cemitério
-- Version: 1.0
-- Description: Adiciona campos faltantes e cria função count_user_cemetery
-- Issue: CemeteryService esperava mais colunas e função count_user_cemetery não existia
-- Dependencies: 00014 (dead_characters system)
-- =============================================

-- === REMOVER FUNÇÕES ANTIGAS ===

DROP FUNCTION IF EXISTS get_user_cemetery(UUID, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_cemetery_stats(UUID);

-- === CRIAR FUNÇÕES CORRIGIDAS ===

-- Contar personagens mortos do usuário
CREATE OR REPLACE FUNCTION count_user_cemetery(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM dead_characters
    WHERE user_id = p_user_id;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Buscar cemitério de um usuário com TODOS os detalhes
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
    ORDER BY dc.died_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- Buscar estatísticas do cemitério com campo deadliest_monster
CREATE OR REPLACE FUNCTION get_cemetery_stats(p_user_id UUID)
RETURNS TABLE (
    total_deaths INTEGER,
    highest_floor_reached INTEGER,
    highest_level_reached INTEGER,
    total_survival_time_hours NUMERIC,
    most_common_death_cause VARCHAR,
    deadliest_monster VARCHAR
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_deaths,
        COALESCE(MAX(dc.floor_reached), 0)::INTEGER as highest_floor_reached,
        COALESCE(MAX(dc.level), 0)::INTEGER as highest_level_reached,
        COALESCE(SUM(dc.survival_time_minutes)::NUMERIC / 60.0, 0)::NUMERIC as total_survival_time_hours,
        (
            SELECT dc_inner.death_cause 
            FROM dead_characters dc_inner
            WHERE dc_inner.user_id = p_user_id 
            GROUP BY dc_inner.death_cause 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        )::VARCHAR as most_common_death_cause,
        (
            SELECT dc_inner.killed_by_monster
            FROM dead_characters dc_inner
            WHERE dc_inner.user_id = p_user_id 
              AND dc_inner.killed_by_monster IS NOT NULL
            GROUP BY dc_inner.killed_by_monster
            ORDER BY COUNT(*) DESC
            LIMIT 1
        )::VARCHAR as deadliest_monster
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Processar morte do personagem de forma simplificada
-- Move o personagem para dead_characters e marca como morto na tabela characters
CREATE OR REPLACE FUNCTION process_character_death_simple(
    p_character_id UUID,
    p_death_cause VARCHAR DEFAULT 'Battle defeat',
    p_killed_by_monster VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    success BOOLEAN,
    message VARCHAR,
    dead_character_id UUID
) AS $$
DECLARE
    v_character_data characters%ROWTYPE;
    v_dead_character_id UUID;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character_data FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Character not found', NULL::UUID;
        RETURN;
    END IF;
    
    -- Inserir na tabela dead_characters
    INSERT INTO dead_characters (
        user_id, original_character_id, name, level, xp, gold,
        strength, dexterity, intelligence, wisdom, vitality, luck,
        max_hp, max_mana, atk, def, speed,
        floor_reached, highest_floor, total_monsters_killed,
        total_damage_dealt, total_damage_taken, total_spells_cast,
        total_potions_used, death_cause, killed_by_monster, character_created_at
    ) VALUES (
        v_character_data.user_id,
        v_character_data.id,
        v_character_data.name,
        v_character_data.level,
        v_character_data.xp,
        v_character_data.gold,
        v_character_data.strength,
        v_character_data.dexterity,
        v_character_data.intelligence,
        v_character_data.wisdom,
        v_character_data.vitality,
        v_character_data.luck,
        v_character_data.max_hp,
        v_character_data.max_mana,
        v_character_data.atk,
        v_character_data.def,
        v_character_data.speed,
        v_character_data.floor,
        v_character_data.floor,
        0,  -- total_monsters_killed
        0,  -- total_damage_dealt
        0,  -- total_damage_taken
        0,  -- total_spells_cast
        0,  -- total_potions_used
        p_death_cause,
        p_killed_by_monster,
        v_character_data.created_at
    ) RETURNING id INTO v_dead_character_id;
    
    -- Marcar personagem como morto (não deletar)
    UPDATE characters 
    SET is_alive = FALSE, updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Opcional: Salvar no ranking de entrada única
    INSERT INTO game_rankings (
        user_id, player_name, highest_floor, character_level, character_gold, character_alive
    ) VALUES (
        v_character_data.user_id,
        v_character_data.name,
        v_character_data.floor,
        v_character_data.level,
        v_character_data.gold,
        FALSE
    ) RETURNING id INTO v_ranking_id;
    
    RETURN QUERY SELECT TRUE, 'Character moved to cemetery', v_dead_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === COMENTÁRIOS ===

COMMENT ON FUNCTION count_user_cemetery(UUID) IS 
'Conta o número total de personagens mortos do usuário.';

COMMENT ON FUNCTION get_user_cemetery(UUID, INTEGER, INTEGER) IS 
'Retorna todos os detalhes dos personagens mortos do usuário com paginação.';

COMMENT ON FUNCTION get_cemetery_stats(UUID) IS 
'Retorna estatísticas agregadas do cemitério do usuário, incluindo monstro mais perigoso.';

COMMENT ON FUNCTION process_character_death_simple(UUID, VARCHAR, VARCHAR) IS 
'Processa a morte de um personagem: move para dead_characters, marca como morto, e salva no ranking.';

