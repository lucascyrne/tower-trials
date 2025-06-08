-- Migração para atualizar as funções de ranking por nível e ouro com lógica otimizada
-- Garante consistência entre todas as modalidades de ranking

-- =====================================
-- 1. FUNÇÃO OTIMIZADA PARA RANKING POR NÍVEL
-- =====================================

-- Remover funções existentes primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_best_character_per_user_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);

-- Função para obter o melhor personagem de cada usuário por nível
CREATE OR REPLACE FUNCTION get_best_character_per_user_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::TEXT as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY c.user_id 
                ORDER BY c.level DESC, c.floor DESC, c.created_at ASC
            ) as rn
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true
            END
    )
    SELECT 
        rc.id,
        rc.user_id,
        rc.player_name,
        rc.highest_floor,
        rc.character_level,
        rc.character_gold,
        rc.character_alive,
        rc.created_at
    FROM ranked_characters rc
    WHERE rc.rn = 1
    ORDER BY rc.character_level DESC, rc.highest_floor DESC, rc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Criar função principal de ranking por nível
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_best_character_per_user_by_level(p_limit, p_status_filter);
END;
$$;

-- =====================================
-- 2. FUNÇÃO OTIMIZADA PARA RANKING POR OURO
-- =====================================

-- Remover funções existentes primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_best_character_per_user_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);

-- Função para obter o melhor personagem de cada usuário por ouro
CREATE OR REPLACE FUNCTION get_best_character_per_user_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_characters AS (
        SELECT 
            c.id,
            c.user_id,
            c.name::TEXT as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            COALESCE(c.is_alive, true) as character_alive,
            c.created_at,
            ROW_NUMBER() OVER (
                PARTITION BY c.user_id 
                ORDER BY c.gold DESC, c.floor DESC, c.created_at ASC
            ) as rn
        FROM characters c
        WHERE 
            c.floor > 0 AND -- Apenas personagens que jogaram
            CASE 
                WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
                WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
                ELSE true
            END
    )
    SELECT 
        rc.id,
        rc.user_id,
        rc.player_name,
        rc.highest_floor,
        rc.character_level,
        rc.character_gold,
        rc.character_alive,
        rc.created_at
    FROM ranked_characters rc
    WHERE rc.rn = 1
    ORDER BY rc.character_gold DESC, rc.highest_floor DESC, rc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Criar função principal de ranking por ouro
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_best_character_per_user_by_gold(p_limit, p_status_filter);
END;
$$;

-- =====================================
-- 3. FUNÇÃO OTIMIZADA PARA HISTÓRICO DO USUÁRIO
-- =====================================

-- Remover função existente primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);

-- Criar função de histórico do usuário para ser mais eficiente
CREATE OR REPLACE FUNCTION get_dynamic_user_ranking_history(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE(
    id UUID,
    user_id UUID,
    player_name TEXT,
    highest_floor INTEGER,
    character_level INTEGER,
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name::TEXT as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        COALESCE(c.is_alive, true) as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        c.user_id = p_user_id AND
        c.floor > 0 -- Apenas personagens que jogaram
    ORDER BY c.floor DESC, c.level DESC, c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO OTIMIZADA PARA ESTATÍSTICAS DO USUÁRIO
-- =====================================

-- Remover função existente primeiro para evitar conflito de tipo
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);

-- Criar função de estatísticas do usuário
CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
    total_runs INTEGER,
    alive_characters INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(MAX(c.floor), 0) as best_floor,
        COALESCE(MAX(c.level), 1) as best_level,
        COALESCE(MAX(c.gold), 0) as best_gold,
        COUNT(*)::INTEGER as total_runs,
        COUNT(CASE WHEN COALESCE(c.is_alive, true) = true THEN 1 END)::INTEGER as alive_characters
    FROM characters c
    WHERE c.user_id = p_user_id AND c.floor > 0;
END;
$$;

-- =====================================
-- 5. ÍNDICES ADICIONAIS PARA OTIMIZAÇÃO
-- =====================================

-- Índice para ranking por nível
CREATE INDEX IF NOT EXISTS idx_characters_user_level_ranking 
ON characters(user_id, level DESC, floor DESC, created_at ASC) 
WHERE floor > 0 AND COALESCE(is_alive, true) = true;

-- Índice para ranking por ouro
CREATE INDEX IF NOT EXISTS idx_characters_user_gold_ranking 
ON characters(user_id, gold DESC, floor DESC, created_at ASC) 
WHERE floor > 0 AND COALESCE(is_alive, true) = true;

-- Índice global para ranking por nível
CREATE INDEX IF NOT EXISTS idx_characters_global_level_ranking 
ON characters(level DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- Índice global para ranking por ouro
CREATE INDEX IF NOT EXISTS idx_characters_global_gold_ranking 
ON characters(gold DESC, floor DESC, created_at ASC) 
WHERE floor > 0;

-- =====================================
-- 6. FUNÇÃO PARA LIMPAR CACHE DE RANKING (SE NECESSÁRIO)
-- =====================================

-- Função para forçar atualização de todos os rankings
CREATE OR REPLACE FUNCTION refresh_all_rankings()
RETURNS TEXT AS $$
DECLARE
    total_users INTEGER;
    total_characters INTEGER;
BEGIN
    -- Contar totais
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters WHERE floor > 0;
    SELECT COUNT(*) INTO total_characters FROM characters WHERE floor > 0;
    
    -- Atualizar last_activity de todos os personagens ativos para forçar refresh
    UPDATE characters 
    SET updated_at = NOW() 
    WHERE floor > 0;
    
    -- Retornar estatísticas
    RETURN format('Rankings atualizados: %s usuários, %s personagens', total_users, total_characters);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION get_best_character_per_user_by_level IS 'Obtém o melhor personagem de cada usuário para ranking por nível';
COMMENT ON FUNCTION get_best_character_per_user_by_gold IS 'Obtém o melhor personagem de cada usuário para ranking por ouro';
COMMENT ON FUNCTION get_dynamic_ranking_by_level IS 'Ranking dinâmico por maior nível (um personagem por usuário)';
COMMENT ON FUNCTION get_dynamic_ranking_by_gold IS 'Ranking dinâmico por maior quantidade de ouro (um personagem por usuário)';
COMMENT ON FUNCTION get_dynamic_user_ranking_history IS 'Histórico de personagens do usuário ordenado por progresso';
COMMENT ON FUNCTION get_dynamic_user_stats IS 'Estatísticas consolidadas do usuário baseadas em todos os seus personagens';
COMMENT ON FUNCTION refresh_all_rankings IS 'Força atualização de todos os rankings (uso administrativo)';

-- Script concluído com sucesso!
-- Todas as funções de ranking agora usam a mesma lógica otimizada e em tempo real 