-- =============================================
-- MIGRATION: Garantir Captura Correta do Inimigo na Morte
-- Version: 1.0
-- Description: Assegurar que killed_by_monster é SEMPRE preenchido com o nome do inimigo
-- Issue: Campo "Maior Ameaça" não era inicializado no cemitério
-- Solution: Validação rigorosa e melhor sincronização em get_cemetery_stats
-- =============================================

-- === RECRIAR FUNÇÃO COM VALIDAÇÃO RIGOROSA ===

DROP FUNCTION IF EXISTS process_character_death_simple(UUID, VARCHAR, VARCHAR);

-- Processar morte do personagem COM GARANTIA DE CAPTURA DO INIMIGO
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
    v_killer_name VARCHAR;
BEGIN
    -- Buscar dados do personagem
    SELECT * INTO v_character_data FROM characters WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 'Character not found', NULL::UUID;
        RETURN;
    END IF;
    
    -- ✅ CRÍTICO: Garantir que o nome do inimigo é capturado
    -- Se p_killed_by_monster for NULL ou vazio, usar padrão, mas NUNCA deixar em branco
    v_killer_name := NULLIF(TRIM(COALESCE(p_killed_by_monster, '')), '');
    IF v_killer_name IS NULL THEN
        v_killer_name := 'Inimigo Desconhecido';
    END IF;
    
    -- Inserir na tabela dead_characters COM VALIDAÇÃO
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
        v_killer_name,  -- ✅ GARANTIDO: Sempre preenchido
        v_character_data.created_at
    ) RETURNING id INTO v_dead_character_id;
    
    -- Marcar personagem como morto
    UPDATE characters 
    SET is_alive = FALSE, updated_at = NOW()
    WHERE id = p_character_id;
    
    -- Salvar no ranking
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
    
    RETURN QUERY SELECT 
        TRUE, 
        'Character moved to cemetery', 
        v_dead_character_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- === MELHORAR get_cemetery_stats PARA MELHOR SINCRONIZAÇÃO ===

DROP FUNCTION IF EXISTS get_cemetery_stats(UUID);

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
    -- Fonte 1: dead_characters (principal - SEMPRE tem killed_by_monster preenchido)
    SELECT
        1 as source_priority,
        dc.id,
        dc.level,
        dc.floor_reached,
        dc.death_cause,
        dc.killed_by_monster,  -- ✅ GARANTIDO: Sempre preenchido
        dc.survival_time_minutes,
        dc.user_id
    FROM dead_characters dc
    WHERE dc.user_id = p_user_id
    
    UNION ALL
    
    -- Fonte 2: characters com is_alive = FALSE (fallback para dados antigos)
    SELECT
        2 as source_priority,
        c.id,
        c.level,
        c.floor,
        'Battle defeat'::VARCHAR,
        'Inimigo Desconhecido'::VARCHAR,  -- ✅ Sem NULL: Usar padrão consistente
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
    
    -- Fonte 3: game_rankings (fallback para dados muito antigos)
    SELECT
        3 as source_priority,
        gr.id,
        gr.character_level,
        gr.highest_floor,
        'Battle defeat'::VARCHAR,
        'Inimigo Desconhecido'::VARCHAR,  -- ✅ Sem NULL: Usar padrão consistente
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
    COALESCE(
        (
            SELECT death_cause
            FROM all_dead_characters
            WHERE death_cause IS NOT NULL AND death_cause != ''
            GROUP BY death_cause
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        'Desconhecida'::VARCHAR
    ) as most_common_death_cause,
    COALESCE(
        (
            SELECT killed_by_monster
            FROM all_dead_characters
            WHERE killed_by_monster IS NOT NULL 
              AND killed_by_monster != '' 
              AND killed_by_monster != 'Inimigo Desconhecido'
            GROUP BY killed_by_monster
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        (
            SELECT killed_by_monster
            FROM all_dead_characters
            WHERE killed_by_monster IS NOT NULL AND killed_by_monster != ''
            GROUP BY killed_by_monster
            ORDER BY COUNT(*) DESC
            LIMIT 1
        ),
        'Desconhecido'::VARCHAR
    ) as deadliest_monster
FROM all_dead_characters;
$$ LANGUAGE sql;

-- === COMENTÁRIOS E DOCUMENTAÇÃO ===

COMMENT ON FUNCTION process_character_death_simple(UUID, VARCHAR, VARCHAR) IS 
'Processa a morte de um personagem com GARANTIA de captura do nome do inimigo:
1. Insere em dead_characters com killed_by_monster SEMPRE preenchido (nunca NULL)
2. Marca character como is_alive = FALSE
3. Salva entrada em game_rankings com character_alive = FALSE
⚠️ CRÍTICO: O nome do inimigo (killed_by_monster) NUNCA é deixado em branco - usa padrão se necessário';

COMMENT ON FUNCTION get_cemetery_stats(UUID) IS 
'Retorna estatísticas do cemitério sincronizando de múltiplas fontes:
1. dead_characters (prioridade alta - sempre tem killed_by_monster)
2. characters com is_alive=FALSE (prioridade média - fallback com valor padrão)
3. game_rankings (prioridade baixa - fallback com valor padrão)
✅ deadliest_monster SEMPRE retorna um valor válido (nunca NULL)';

