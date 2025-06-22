-- =====================================
-- CORREÇÃO DEFINITIVA: RANKING COM PERSONAGENS MORTOS
-- Data: 2024-12-22
-- Versão: DEFINITIVA (Fonte única de verdade)
-- =====================================

-- Este sistema resolve de forma DEFINITIVA:
-- 1. Personagens mortos só em dead_characters (fonte única)
-- 2. Remove dependência de game_rankings para ranking
-- 3. Funções de ranking consistentes
-- 4. Elimina todas as redundâncias

-- =====================================
-- 1. REMOVER TODAS AS VERSÕES CONFLITANTES
-- =====================================

-- Remover TODAS as versões das funções de ranking para eliminar conflitos
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);
DROP FUNCTION IF EXISTS count_ranking_entries(TEXT, TEXT);

-- =====================================
-- 2. GARANTIR ESTRUTURA DAS TABELAS
-- =====================================

-- Garantir que dead_characters existe e tem colunas necessárias
ALTER TABLE dead_characters 
ADD COLUMN IF NOT EXISTS highest_floor INTEGER;

-- Atualizar highest_floor se NULL
UPDATE dead_characters 
SET highest_floor = GREATEST(1, floor_reached)
WHERE highest_floor IS NULL;

-- =====================================
-- 3. FUNÇÕES DE RANKING DEFINITIVAS - FONTE ÚNICA
-- =====================================

-- Função DEFINITIVA para ranking por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold BIGINT,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, nome: %, limite: %, offset: %', 
                 p_status_filter, p_name_filter, p_limit, p_offset;
    
    -- FONTE ÚNICA: characters para vivos + dead_characters para mortos
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters_ranking AS (
        -- FONTE ÚNICA: dead_characters para personagens mortos
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters_ranking
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.highest_floor DESC, cr.character_level DESC, cr.character_gold DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Função DEFINITIVA para ranking por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold BIGINT,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters_ranking AS (
        -- FONTE ÚNICA: dead_characters para personagens mortos
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters_ranking
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_level DESC, cr.highest_floor DESC, cr.character_gold DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- Função DEFINITIVA para ranking por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT '',
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold BIGINT,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH live_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters_ranking AS (
        -- FONTE ÚNICA: dead_characters para personagens mortos
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters_ranking
    )
    SELECT 
        cr.id,
        cr.user_id,
        cr.player_name,
        cr.highest_floor,
        cr.character_level,
        cr.character_gold,
        cr.character_alive,
        cr.created_at
    FROM combined_ranking cr
    ORDER BY cr.character_gold DESC, cr.highest_floor DESC, cr.character_level DESC, cr.created_at ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;

-- =====================================
-- 4. FUNÇÕES DE USUÁRIO DEFINITIVAS
-- =====================================

-- Função DEFINITIVA para histórico do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name VARCHAR(100),
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold BIGINT,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_characters AS (
        -- Personagens vivos do usuário
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id 
          AND c.is_alive = true
          AND COALESCE(c.highest_floor, c.floor) > 0
        UNION ALL
        -- FONTE ÚNICA: dead_characters para personagens mortos do usuário
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at
        FROM dead_characters dc
        WHERE dc.user_id = p_user_id
    )
    SELECT 
        uc.id,
        uc.user_id,
        uc.player_name,
        uc.highest_floor,
        uc.character_level,
        uc.character_gold,
        uc.character_alive,
        uc.created_at
    FROM user_characters uc
    ORDER BY uc.highest_floor DESC, uc.character_level DESC, uc.created_at DESC
    LIMIT p_limit;
END;
$$;

-- Função DEFINITIVA para estatísticas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold BIGINT,
    total_runs INTEGER,
    alive_characters INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT 
            COALESCE(MAX(COALESCE(c.highest_floor, c.floor)), 0) as live_best_floor,
            COALESCE(MAX(c.level), 1) as live_best_level,
            COALESCE(MAX(c.gold), 0) as live_best_gold,
            COUNT(c.id)::INTEGER as live_count
        FROM characters c
        WHERE c.user_id = p_user_id AND c.is_alive = true
    ),
    dead_stats AS (
        -- FONTE ÚNICA: dead_characters para estatísticas de mortos
        SELECT 
            COALESCE(MAX(dc.highest_floor), 0) as dead_best_floor,
            COALESCE(MAX(dc.level), 1) as dead_best_level,
            COALESCE(MAX(dc.gold), 0) as dead_best_gold,
            COUNT(dc.id)::INTEGER as dead_count
        FROM dead_characters dc
        WHERE dc.user_id = p_user_id
    )
    SELECT 
        GREATEST(us.live_best_floor, ds.dead_best_floor) as best_floor,
        GREATEST(us.live_best_level, ds.dead_best_level) as best_level,
        GREATEST(us.live_best_gold, ds.dead_best_gold) as best_gold,
        (us.live_count + ds.dead_count)::INTEGER as total_runs,
        us.live_count::INTEGER as alive_characters
    FROM user_stats us, dead_stats ds;
END;
$$;

-- =====================================
-- 5. FUNÇÃO DE CONTAGEM DEFINITIVA
-- =====================================

CREATE OR REPLACE FUNCTION count_ranking_entries(
    p_status_filter TEXT DEFAULT 'all',
    p_name_filter TEXT DEFAULT ''
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    WITH live_characters AS (
        SELECT c.id
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters_count AS (
        -- FONTE ÚNICA: dead_characters para contagem de mortos
        SELECT dc.id
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_characters AS (
        SELECT id FROM live_characters
        UNION ALL
        SELECT id FROM dead_characters_count
    )
    SELECT COUNT(*)::INTEGER INTO v_count FROM combined_characters;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 6. SIMPLIFICAR PROCESSO DE MORTE
-- =====================================

-- Função SIMPLIFICADA para processar morte - APENAS dead_characters
CREATE OR REPLACE FUNCTION process_character_death_simple(
    p_character_id UUID,
    p_death_cause TEXT DEFAULT 'Battle defeat',
    p_killed_by_monster TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    character_name TEXT,
    character_level INTEGER,
    character_floor INTEGER
) AS $$
DECLARE
    v_character RECORD;
BEGIN
    -- Buscar dados do personagem
    SELECT 
        c.id,
        c.user_id,
        c.name,
        c.level,
        c.floor,
        COALESCE(c.highest_floor, c.floor) as highest_floor,
        c.gold,
        COALESCE(c.is_alive, true) as is_alive,
        c.created_at
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    IF NOT v_character.is_alive THEN
        RAISE EXCEPTION 'Personagem % já está morto', v_character.name;
    END IF;
    
    RAISE NOTICE '[DEATH_PROCESS] Processando morte de: % (Andar: %)', 
                 v_character.name, v_character.highest_floor;
    
    -- 1. Marcar personagem como morto na tabela characters
    UPDATE characters 
    SET 
        is_alive = false,
        hp = 0,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- 2. FONTE ÚNICA: Salvar APENAS em dead_characters
    INSERT INTO dead_characters (
        original_character_id,
        user_id,
        name,
        level,
        floor_reached,
        highest_floor,
        gold,
        death_cause,
        killed_by_monster,
        survival_time_minutes,
        character_created_at,
        died_at
    )
    VALUES (
        v_character.id,
        v_character.user_id,
        v_character.name,
        v_character.level,
        v_character.floor,
        v_character.highest_floor,
        v_character.gold,
        p_death_cause,
        p_killed_by_monster,
        EXTRACT(EPOCH FROM (NOW() - v_character.created_at)) / 60,
        v_character.created_at,
        NOW()
    );
    
    RAISE NOTICE '[DEATH_PROCESS] Personagem % salvo em dead_characters', v_character.name;
    
    RETURN QUERY SELECT 
        true,
        v_character.name,
        v_character.level,
        v_character.highest_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 7. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DEFINITIVA DO RANKING';
    RAISE NOTICE 'Data: 2024-12-22 - FONTE ÚNICA';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '[OK] FONTE ÚNICA: dead_characters para personagens mortos';
    RAISE NOTICE '[OK] Funções de ranking 100%% consistentes';
    RAISE NOTICE '[OK] Eliminadas TODAS as redundâncias';
    RAISE NOTICE '[OK] Processo de morte simplificado';
    RAISE NOTICE '[OK] Sem dependência de game_rankings';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'PERSONAGENS MORTOS AGORA APARECEM NO RANKING!';
    RAISE NOTICE '====================================';
END $$; 