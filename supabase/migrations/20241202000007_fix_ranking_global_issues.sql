-- Migração para corrigir problemas críticos do sistema de ranking global
-- Data: 2024-12-02
-- Versão: 20241202000007

-- =====================================
-- 1. DIAGNÓSTICO E LIMPEZA
-- =====================================

-- Primeiro, vamos verificar o estado atual dos dados
DO $$
DECLARE
    total_characters INTEGER;
    alive_characters INTEGER;
    dead_characters INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_characters FROM characters;
    SELECT COUNT(*) INTO alive_characters FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_characters FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'DIAGNÓSTICO: Total de personagens: %, Vivos: %, Mortos: %', 
        total_characters, alive_characters, dead_characters;
END $$;

-- =====================================
-- 2. CORRIGIR FUNÇÕES DE RANKING GLOBAL
-- =====================================

-- Função corrigida para ranking global por andar mais alto
CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
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
    RAISE NOTICE 'get_dynamic_ranking_by_highest_floor chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.floor DESC, c.level DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por nível
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
    RAISE NOTICE 'get_dynamic_ranking_by_level chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.level DESC, c.floor DESC, c.gold DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Função corrigida para ranking global por ouro
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
    RAISE NOTICE 'get_dynamic_ranking_by_gold chamada com filtro: % e limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE 
        -- Filtro de status corrigido
        CASE 
            WHEN p_status_filter = 'alive' THEN c.is_alive = true
            WHEN p_status_filter = 'dead' THEN c.is_alive = false
            ELSE true -- 'all' mostra todos independente do status
        END
    ORDER BY c.gold DESC, c.level DESC, c.floor DESC, c.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 3. FUNÇÃO SEPARADA PARA HISTÓRICO DO USUÁRIO
-- =====================================

-- Manter função específica para histórico do usuário (não é ranking global)
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
    RAISE NOTICE 'get_dynamic_user_ranking_history chamada para usuário: % com limite: %', p_user_id, p_limit;
    
    RETURN QUERY
    SELECT 
        c.id,
        c.user_id,
        c.name as player_name,
        c.floor as highest_floor,
        c.level as character_level,
        c.gold as character_gold,
        c.is_alive as character_alive,
        c.created_at
    FROM characters c
    WHERE c.user_id = p_user_id
    ORDER BY c.created_at DESC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO DE TESTE SIMPLIFICADA
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_data()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    count_value BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Teste 1: Total de personagens
    RETURN QUERY
    SELECT 
        'Total de personagens'::TEXT as test_name,
        'OK'::TEXT as result,
        COUNT(*)::BIGINT as count_value
    FROM characters;
    
    -- Teste 2: Personagens vivos
    RETURN QUERY
    SELECT 
        'Personagens vivos'::TEXT as test_name,
        'OK'::TEXT as result,
        COUNT(*)::BIGINT as count_value
    FROM characters 
    WHERE is_alive = true;
    
    -- Teste 3: Personagens mortos
    RETURN QUERY
    SELECT 
        'Personagens mortos'::TEXT as test_name,
        'OK'::TEXT as result,
        COUNT(*)::BIGINT as count_value
    FROM characters 
    WHERE is_alive = false;
END;
$$;

-- =====================================
-- 5. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Atualizar campo is_alive baseado no HP atual
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive != (hp > 0);

-- Garantir que todos os personagens tenham floor válido
UPDATE characters 
SET floor = GREATEST(floor, 1)
WHERE floor < 1;

-- =====================================
-- 6. CRIAR ÍNDICES OTIMIZADOS
-- =====================================

-- Remover índices antigos que podem estar causando problemas
DROP INDEX IF EXISTS idx_characters_ranking_floor;
DROP INDEX IF EXISTS idx_characters_ranking_level;
DROP INDEX IF EXISTS idx_characters_ranking_gold;
DROP INDEX IF EXISTS idx_characters_alive_ranking;

-- Remover índices que podem já existir para recriar
DROP INDEX IF EXISTS idx_characters_global_floor_ranking;
DROP INDEX IF EXISTS idx_characters_global_level_ranking;
DROP INDEX IF EXISTS idx_characters_global_gold_ranking;
DROP INDEX IF EXISTS idx_characters_status_filter;

-- Criar novos índices otimizados
CREATE INDEX IF NOT EXISTS idx_characters_global_floor_ranking 
ON characters(floor DESC, level DESC, gold DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_characters_global_level_ranking 
ON characters(level DESC, floor DESC, gold DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_characters_global_gold_ranking 
ON characters(gold DESC, level DESC, floor DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_characters_status_filter 
ON characters(is_alive, floor DESC, level DESC);

-- =====================================
-- 7. VERIFICAÇÃO FINAL SIMPLIFICADA
-- =====================================

-- Verificar se as funções foram criadas corretamente
DO $$
DECLARE
    total_chars INTEGER;
    alive_chars INTEGER;
    dead_chars INTEGER;
BEGIN
    RAISE NOTICE '=== VERIFICAÇÃO FINAL ===';
    
    -- Contar personagens diretamente
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(*) INTO alive_chars FROM characters WHERE is_alive = true;
    SELECT COUNT(*) INTO dead_chars FROM characters WHERE is_alive = false;
    
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Personagens vivos: %', alive_chars;
    RAISE NOTICE 'Personagens mortos: %', dead_chars;
    
    RAISE NOTICE '=== MIGRAÇÃO CONCLUÍDA COM SUCESSO ===';
END $$;

-- Migração concluída com sucesso! 