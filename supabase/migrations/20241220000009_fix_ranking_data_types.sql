-- =====================================
-- CORRIGIR TIPOS DE DADOS NO SISTEMA DE RANKING
-- Data: 2024-12-20
-- Versão: 8 (Correção de Tipos)
-- =====================================

-- Este patch corrige incompatibilidades de tipos entre bigint e integer
-- nas funções de ranking, garantindo que todas funcionem corretamente
-- ATUALIZADO: Usa tabela dead_characters para personagens mortos

-- =====================================
-- 1. REMOVER FUNÇÕES EXISTENTES PRIMEIRO
-- =====================================

-- Preciso remover as funções existentes porque não posso alterar o tipo de retorno
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);
DROP FUNCTION IF EXISTS count_ranking_entries(TEXT, TEXT);

-- =====================================
-- 2. RECRIAR FUNÇÃO get_dynamic_ranking_by_highest_floor
-- =====================================

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
    character_gold BIGINT, -- CORRIGIDO: usar BIGINT para compatibilidade
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, nome: %, limite: %, offset: %', 
                 p_status_filter, p_name_filter, p_limit, p_offset;
    
    -- Sistema híbrido corrigido: mostrar TODOS os personagens
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor,
            c.level as character_level,
            c.gold as character_gold, -- BIGINT mantido
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND COALESCE(c.highest_floor, c.floor) > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
          AND (p_name_filter = '' OR LOWER(c.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    dead_characters AS (
        -- Personagens mortos (dados da tabela dead_characters)
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold, -- BIGINT mantido
            false as character_alive,
            dc.died_at as created_at -- CORRIGIDO: usar died_at como timestamp de referência
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
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

-- =====================================
-- 3. RECRIAR FUNÇÃO get_dynamic_ranking_by_level
-- =====================================

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
    character_gold BIGINT, -- CORRIGIDO: usar BIGINT
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
    dead_characters AS (
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at -- CORRIGIDO: usar died_at como timestamp de referência
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
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

-- =====================================
-- 4. RECRIAR FUNÇÃO get_dynamic_ranking_by_gold
-- =====================================

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
    character_gold BIGINT, -- CORRIGIDO: usar BIGINT
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
    dead_characters AS (
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at -- CORRIGIDO: usar died_at como timestamp de referência
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_ranking AS (
        SELECT * FROM live_characters
        UNION ALL
        SELECT * FROM dead_characters
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
-- 5. RECRIAR FUNÇÃO get_dynamic_user_ranking_history
-- =====================================

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
    character_gold BIGINT, -- CORRIGIDO: usar BIGINT
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
        -- Personagens mortos do usuário (da tabela dead_characters)
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive,
            dc.died_at as created_at -- CORRIGIDO: usar died_at como timestamp de referência
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

-- =====================================
-- 6. RECRIAR FUNÇÃO get_dynamic_user_stats
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold BIGINT, -- CORRIGIDO: usar BIGINT
    total_runs INTEGER, -- CORRIGIDO: usar INTEGER em vez de BIGINT
    alive_characters INTEGER -- CORRIGIDO: usar INTEGER em vez de BIGINT
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
            COUNT(c.id)::INTEGER as live_count -- CAST para INTEGER
        FROM characters c
        WHERE c.user_id = p_user_id AND c.is_alive = true
    ),
    dead_stats AS (
        SELECT 
            COALESCE(MAX(dc.highest_floor), 0) as dead_best_floor,
            COALESCE(MAX(dc.level), 1) as dead_best_level,
            COALESCE(MAX(dc.gold), 0) as dead_best_gold,
            COUNT(dc.id)::INTEGER as dead_count -- CAST para INTEGER
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
-- 7. RECRIAR FUNÇÃO count_ranking_entries
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
    dead_characters AS (
        SELECT dc.id
        FROM dead_characters dc
        WHERE (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(dc.name) LIKE LOWER('%' || p_name_filter || '%'))
    ),
    combined_characters AS (
        SELECT id FROM live_characters
        UNION ALL
        SELECT id FROM dead_characters
    )
    SELECT COUNT(*)::INTEGER INTO v_count FROM combined_characters;
    
    RETURN v_count;
END;
$$;

-- =====================================
-- 8. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DE TIPOS DE DADOS NO RANKING';
    RAISE NOTICE 'Versão: 8 (2024-12-20)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ character_gold: INTEGER → BIGINT';
    RAISE NOTICE '✓ total_runs: BIGINT → INTEGER';
    RAISE NOTICE '✓ alive_characters: BIGINT → INTEGER';
    RAISE NOTICE '✓ Uso da tabela dead_characters';
    RAISE NOTICE '✓ Todas as funções corrigidas';
    RAISE NOTICE '====================================';
END $$; 