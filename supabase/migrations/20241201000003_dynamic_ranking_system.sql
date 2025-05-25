-- Sistema de Ranking Dinâmico
-- Esta migração cria um sistema que considera todos os personagens (vivos e mortos) dinamicamente

-- Função para obter ranking dinâmico por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH character_stats AS (
        -- Obter dados dos personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE (p_status_filter = 'all' OR p_status_filter = 'alive')
        
        UNION ALL
        
        -- Obter dados dos personagens mortos (do ranking histórico)
        SELECT DISTINCT ON (r.user_id, r.player_name)
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.character_alive = FALSE
        AND (p_status_filter = 'all' OR p_status_filter = 'dead')
        ORDER BY r.user_id, r.player_name, r.highest_floor DESC, r.created_at DESC
    ),
    best_per_user AS (
        -- Obter o melhor resultado por usuário
        SELECT DISTINCT ON (cs.user_id)
            cs.id,
            cs.user_id,
            cs.player_name,
            cs.highest_floor,
            cs.character_level,
            cs.character_gold,
            cs.character_alive,
            cs.created_at
        FROM character_stats cs
        ORDER BY cs.user_id, cs.highest_floor DESC, cs.character_level DESC, cs.created_at DESC
    )
    SELECT 
        bpu.id,
        bpu.user_id,
        bpu.player_name,
        bpu.highest_floor,
        bpu.character_level,
        bpu.character_gold,
        bpu.character_alive,
        bpu.created_at
    FROM best_per_user bpu
    ORDER BY bpu.highest_floor DESC, bpu.character_level DESC, bpu.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking dinâmico por maior nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH character_stats AS (
        -- Obter dados dos personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE (p_status_filter = 'all' OR p_status_filter = 'alive')
        
        UNION ALL
        
        -- Obter dados dos personagens mortos (do ranking histórico)
        SELECT DISTINCT ON (r.user_id, r.player_name)
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.character_alive = FALSE
        AND (p_status_filter = 'all' OR p_status_filter = 'dead')
        ORDER BY r.user_id, r.player_name, r.character_level DESC, r.created_at DESC
    ),
    best_per_user AS (
        -- Obter o melhor resultado por usuário
        SELECT DISTINCT ON (cs.user_id)
            cs.id,
            cs.user_id,
            cs.player_name,
            cs.highest_floor,
            cs.character_level,
            cs.character_gold,
            cs.character_alive,
            cs.created_at
        FROM character_stats cs
        ORDER BY cs.user_id, cs.character_level DESC, cs.highest_floor DESC, cs.created_at DESC
    )
    SELECT 
        bpu.id,
        bpu.user_id,
        bpu.player_name,
        bpu.highest_floor,
        bpu.character_level,
        bpu.character_gold,
        bpu.character_alive,
        bpu.created_at
    FROM best_per_user bpu
    ORDER BY bpu.character_level DESC, bpu.highest_floor DESC, bpu.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter ranking dinâmico por maior quantidade de ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter VARCHAR DEFAULT 'all' -- 'all', 'alive', 'dead'
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH character_stats AS (
        -- Obter dados dos personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE (p_status_filter = 'all' OR p_status_filter = 'alive')
        
        UNION ALL
        
        -- Obter dados dos personagens mortos (do ranking histórico)
        SELECT DISTINCT ON (r.user_id, r.player_name)
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.character_alive = FALSE
        AND (p_status_filter = 'all' OR p_status_filter = 'dead')
        ORDER BY r.user_id, r.player_name, r.character_gold DESC, r.created_at DESC
    ),
    best_per_user AS (
        -- Obter o melhor resultado por usuário
        SELECT DISTINCT ON (cs.user_id)
            cs.id,
            cs.user_id,
            cs.player_name,
            cs.highest_floor,
            cs.character_level,
            cs.character_gold,
            cs.character_alive,
            cs.created_at
        FROM character_stats cs
        ORDER BY cs.user_id, cs.character_gold DESC, cs.highest_floor DESC, cs.created_at DESC
    )
    SELECT 
        bpu.id,
        bpu.user_id,
        bpu.player_name,
        bpu.highest_floor,
        bpu.character_level,
        bpu.character_gold,
        bpu.character_alive,
        bpu.created_at
    FROM best_per_user bpu
    ORDER BY bpu.character_gold DESC, bpu.highest_floor DESC, bpu.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter histórico completo do usuário (personagens vivos e mortos)
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    player_name VARCHAR,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    WITH user_characters AS (
        -- Personagens vivos
        SELECT 
            c.id,
            c.user_id,
            c.name as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id
        
        UNION ALL
        
        -- Personagens mortos
        SELECT 
            r.id,
            r.user_id,
            r.player_name,
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive,
            r.created_at
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter estatísticas dinâmicas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE (
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH user_data AS (
        -- Personagens vivos
        SELECT 
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            TRUE as character_alive
        FROM characters c
        WHERE c.user_id = p_user_id
        
        UNION ALL
        
        -- Personagens mortos
        SELECT 
            r.highest_floor,
            r.character_level,
            r.character_gold,
            r.character_alive
        FROM game_rankings r
        WHERE r.user_id = p_user_id
        AND r.character_alive = FALSE
    )
    SELECT 
        COALESCE(MAX(ud.highest_floor), 0) as best_floor,
        COALESCE(MAX(ud.character_level), 1) as best_level,
        COALESCE(MAX(ud.character_gold), 0) as best_gold,
        COUNT(*)::INTEGER as total_runs,
        COUNT(CASE WHEN ud.character_alive = TRUE THEN 1 END)::INTEGER as alive_characters
    FROM user_data ud;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar ranking automaticamente quando personagem vivo progride
CREATE OR REPLACE FUNCTION update_character_ranking_on_progress()
RETURNS TRIGGER AS $$
BEGIN
    -- Esta função pode ser usada para triggers futuros se necessário
    -- Por enquanto, apenas retorna o NEW record
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentários para documentação
COMMENT ON FUNCTION get_dynamic_ranking_by_highest_floor IS 'Obtém ranking dinâmico por andar mais alto, considerando personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_ranking_by_level IS 'Obtém ranking dinâmico por maior nível, considerando personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_ranking_by_gold IS 'Obtém ranking dinâmico por maior quantidade de ouro, considerando personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_user_ranking_history IS 'Obtém histórico completo do usuário incluindo personagens vivos e mortos';
COMMENT ON FUNCTION get_dynamic_user_stats IS 'Obtém estatísticas dinâmicas do usuário baseadas em todos os personagens'; 