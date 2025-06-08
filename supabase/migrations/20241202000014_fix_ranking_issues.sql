-- =====================================
-- CORRIGIR PROBLEMAS DO RANKING
-- Data: 2024-12-02
-- Versão: 14 (Correção Critical)
-- =====================================

-- Este sistema corrige:
-- 1. Adiciona coluna is_alive que estava faltando
-- 2. Corrige funções de ranking para funcionar adequadamente
-- 3. Atualiza dados existentes para garantir consistência
-- 4. Corrige problema de DISTINCT ON que pode estar excluindo personagens

-- =====================================
-- 1. ADICIONAR COLUNA IS_ALIVE NA TABELA CHARACTERS
-- =====================================

-- Adicionar coluna is_alive se não existir
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS is_alive BOOLEAN DEFAULT TRUE;

-- Garantir que todos os personagens existentes estão marcados como vivos
UPDATE characters 
SET is_alive = TRUE 
WHERE is_alive IS NULL;

-- =====================================
-- 2. VERIFICAR E CORRIGIR DADOS EXISTENTES
-- =====================================

-- Garantir que highest_floor está correto para personagens existentes
UPDATE characters 
SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
WHERE highest_floor IS NULL OR highest_floor < floor;

-- Log de verificação
DO $$
DECLARE
    char_count INTEGER;
    chars_without_highest_floor INTEGER;
    chars_without_is_alive INTEGER;
BEGIN
    SELECT COUNT(*) INTO char_count FROM characters;
    
    SELECT COUNT(*) INTO chars_without_highest_floor 
    FROM characters WHERE highest_floor IS NULL;
    
    SELECT COUNT(*) INTO chars_without_is_alive 
    FROM characters WHERE is_alive IS NULL;
    
    RAISE NOTICE '[RANKING_FIX] Total de personagens: %', char_count;
    RAISE NOTICE '[RANKING_FIX] Personagens sem highest_floor: %', chars_without_highest_floor;
    RAISE NOTICE '[RANKING_FIX] Personagens sem is_alive: %', chars_without_is_alive;
END $$;

-- =====================================
-- 3. CORRIGIR FUNÇÕES DE RANKING PARA EVITAR PROBLEMAS DE DISTINCT
-- =====================================

-- Função corrigida de ranking por andar mais alto
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
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, nome: %, limite: %, offset: %', 
                 p_status_filter, p_name_filter, p_limit, p_offset;
    
    -- Sistema híbrido corrigido: mostrar TODOS os personagens, não apenas o melhor por usuário
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor, -- Fallback para floor se highest_floor for NULL
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
        -- Personagens mortos (dados históricos da tabela game_rankings)
        SELECT 
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
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

-- Função corrigida de ranking por nível
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
    character_gold INTEGER,
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
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
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

-- Função corrigida de ranking por ouro
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
    character_gold INTEGER,
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
            gr.id,
            gr.user_id,
            gr.player_name,
            gr.highest_floor,
            gr.character_level,
            gr.character_gold,
            gr.character_alive,
            gr.created_at
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
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
-- 4. CORRIGIR FUNÇÃO DE CONTAGEM
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
        SELECT gr.id
        FROM game_rankings gr
        WHERE gr.character_alive = false
          AND (p_status_filter = 'all' OR p_status_filter = 'dead')
          AND (p_name_filter = '' OR LOWER(gr.player_name) LIKE LOWER('%' || p_name_filter || '%'))
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
-- 5. FUNÇÃO PARA DEBUG E VERIFICAÇÃO
-- =====================================

CREATE OR REPLACE FUNCTION debug_character_ranking(p_character_name TEXT DEFAULT NULL)
RETURNS TABLE(
    character_name VARCHAR(100),
    character_id UUID,
    user_id UUID,
    current_floor INTEGER,
    highest_floor INTEGER,
    level INTEGER,
    gold INTEGER,
    is_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.name,
        c.id,
        c.user_id,
        c.floor,
        COALESCE(c.highest_floor, c.floor) as highest_floor,
        c.level,
        c.gold,
        c.is_alive,
        c.created_at
    FROM characters c
    WHERE (p_character_name IS NULL OR LOWER(c.name) LIKE LOWER('%' || p_character_name || '%'))
    ORDER BY COALESCE(c.highest_floor, c.floor) DESC, c.level DESC, c.gold DESC;
END;
$$;

-- =====================================
-- 6. ATUALIZAR ÍNDICES PARA PERFORMANCE
-- =====================================

-- Remover índices antigos se existirem
DROP INDEX IF EXISTS idx_characters_ranking_floor_optimized;
DROP INDEX IF EXISTS idx_characters_ranking_level_optimized;
DROP INDEX IF EXISTS idx_characters_ranking_gold_optimized;

-- Criar novos índices otimizados
CREATE INDEX IF NOT EXISTS idx_characters_is_alive_highest_floor 
ON characters(is_alive, highest_floor DESC, level DESC, gold DESC, created_at ASC) 
WHERE is_alive = true;

CREATE INDEX IF NOT EXISTS idx_characters_is_alive_level 
ON characters(is_alive, level DESC, highest_floor DESC, gold DESC, created_at ASC) 
WHERE is_alive = true;

CREATE INDEX IF NOT EXISTS idx_characters_is_alive_gold 
ON characters(is_alive, gold DESC, highest_floor DESC, level DESC, created_at ASC) 
WHERE is_alive = true;

-- =====================================
-- 7. TESTE PARA VERIFICAR CORREÇÕES
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_after_fix()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_live INTEGER;
    v_total_ranking INTEGER;
    v_ursal_found BOOLEAN;
BEGIN
    -- Teste 1: Contar personagens vivos
    SELECT COUNT(*) INTO v_total_live
    FROM characters
    WHERE is_alive = true AND COALESCE(highest_floor, floor) > 0;
    
    RETURN QUERY SELECT 
        'Personagens Vivos Válidos'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens vivos válidos', v_total_live)::TEXT;
    
    -- Teste 2: Verificar ranking
    SELECT COUNT(*) INTO v_total_ranking
    FROM get_dynamic_ranking_by_highest_floor(100, 'all', '', 0);
    
    RETURN QUERY SELECT 
        'Ranking Funcionando'::TEXT,
        CASE WHEN v_total_ranking > 0 THEN 'OK' ELSE 'FALHA' END::TEXT,
        format('Ranking retorna %s entradas', v_total_ranking)::TEXT;
    
    -- Teste 3: Verificar se Ursal aparece
    SELECT EXISTS (
        SELECT 1 FROM get_dynamic_ranking_by_highest_floor(100, 'all', '', 0)
        WHERE LOWER(player_name) LIKE '%ursal%'
    ) INTO v_ursal_found;
    
    RETURN QUERY SELECT 
        'Personagem Ursal'::TEXT,
        CASE WHEN v_ursal_found THEN 'ENCONTRADO' ELSE 'NÃO ENCONTRADO' END::TEXT,
        CASE WHEN v_ursal_found THEN 'Ursal aparece no ranking' ELSE 'Ursal não aparece no ranking' END::TEXT;
    
    -- Teste 4: Verificar dados do Ursal especificamente
    RETURN QUERY
    SELECT 
        'Debug Ursal'::TEXT,
        'INFO'::TEXT,
        format('Ursal: andar atual=%s, andar máximo=%s, nível=%s, ouro=%s, vivo=%s', 
            c.floor, 
            COALESCE(c.highest_floor, c.floor), 
            c.level, 
            c.gold, 
            c.is_alive
        )::TEXT
    FROM characters c
    WHERE LOWER(c.name) LIKE '%ursal%'
    LIMIT 1;
END;
$$;

-- =====================================
-- 8. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DE PROBLEMAS DO RANKING';
    RAISE NOTICE 'Versão: 14 (2024-12-02)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Coluna is_alive adicionada';
    RAISE NOTICE '✓ Dados existentes atualizados';
    RAISE NOTICE '✓ Funções de ranking corrigidas';
    RAISE NOTICE '✓ Removed DISTINCT ON bug que excluía personagens';
    RAISE NOTICE '✓ Índices otimizados criados';
    RAISE NOTICE '✓ Função de debug criada';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Execute: SELECT * FROM test_ranking_after_fix();';
    RAISE NOTICE 'Para verificar se as correções funcionaram.';
    RAISE NOTICE '====================================';
END $$; 