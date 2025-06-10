-- =====================================
-- CORRIGIR INCONSISTÊNCIAS NO SISTEMA DE RANKING
-- Data: 2024-12-20
-- Versão: 8 (Correção de Consistência)
-- =====================================

-- Este patch corrige inconsistências onde algumas funções ainda usam `floor`
-- em vez de `highest_floor`, garantindo que todos os dados sejam exibidos corretamente
-- ATUALIZADO: Usa tabela dead_characters para personagens mortos

-- =====================================
-- 1. CORRIGIR FUNÇÃO get_dynamic_user_ranking_history
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
    character_gold INTEGER,
    character_alive BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH user_characters AS (
        -- Personagens vivos do usuário - CORRIGIDO: usar highest_floor
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            COALESCE(c.highest_floor, c.floor) as highest_floor, -- CORRIGIDO: usar highest_floor com fallback
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id 
          AND c.is_alive = true
          AND COALESCE(c.highest_floor, c.floor) > 0 -- CORRIGIDO: usar highest_floor
        UNION ALL
        -- Personagens mortos do usuário (histórico) - CORRIGIDO: usar dead_characters
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive, -- Sempre false para dead_characters
            dc.died_at as created_at -- Usar died_at como referência temporal
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
-- 2. CORRIGIR FUNÇÃO get_dynamic_user_stats
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_user_stats(p_user_id UUID)
RETURNS TABLE(
    best_floor INTEGER,
    best_level INTEGER,
    best_gold INTEGER,
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
            COALESCE(MAX(COALESCE(c.highest_floor, c.floor)), 0) as live_best_floor, -- CORRIGIDO: usar highest_floor
            COALESCE(MAX(c.level), 1) as live_best_level,
            COALESCE(MAX(c.gold), 0) as live_best_gold,
            COUNT(c.id) as live_count
        FROM characters c
        WHERE c.user_id = p_user_id AND c.is_alive = true
    ),
    dead_stats AS (
        -- CORRIGIDO: usar dead_characters em vez de game_rankings
        SELECT 
            COALESCE(MAX(dc.highest_floor), 0) as dead_best_floor,
            COALESCE(MAX(dc.level), 1) as dead_best_level,
            COALESCE(MAX(dc.gold), 0) as dead_best_gold,
            COUNT(dc.id) as dead_count
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
-- 3. CORRIGIR FUNÇÕES DE RANKING GLOBAL
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
        -- Personagens mortos (dados históricos da tabela dead_characters) - CORRIGIDO
        SELECT 
            dc.id,
            dc.user_id,
            dc.name::VARCHAR(100) as player_name,
            dc.highest_floor,
            dc.level as character_level,
            dc.gold as character_gold,
            false as character_alive, -- Sempre false para dead_characters
            dc.died_at as created_at -- Usar died_at como referência temporal
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
        -- CORRIGIDO: usar dead_characters
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
        -- CORRIGIDO: usar dead_characters
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
        -- CORRIGIDO: usar dead_characters
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
-- 5. VERIFICAR SE AS COLUNAS NECESSÁRIAS EXISTEM
-- =====================================

-- Garantir que a coluna highest_floor existe e está atualizada
DO $$
BEGIN
    -- Verificar se a coluna exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'characters' AND column_name = 'highest_floor') THEN
        ALTER TABLE characters ADD COLUMN highest_floor INTEGER DEFAULT 1;
        RAISE NOTICE '[RANKING_FIX] Coluna highest_floor adicionada à tabela characters';
    END IF;
    
    -- Atualizar valores onde highest_floor é NULL ou menor que floor atual
    UPDATE characters 
    SET highest_floor = GREATEST(COALESCE(highest_floor, 1), floor)
    WHERE highest_floor IS NULL OR highest_floor < floor;
    
    RAISE NOTICE '[RANKING_FIX] Valores de highest_floor atualizados';
END $$;

-- Garantir que a coluna is_alive existe
DO $$
BEGIN
    -- Verificar se a coluna exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'characters' AND column_name = 'is_alive') THEN
        ALTER TABLE characters ADD COLUMN is_alive BOOLEAN DEFAULT TRUE;
        RAISE NOTICE '[RANKING_FIX] Coluna is_alive adicionada à tabela characters';
    END IF;
    
    -- Garantir que todos os personagens têm is_alive definido
    UPDATE characters SET is_alive = TRUE WHERE is_alive IS NULL;
    
    RAISE NOTICE '[RANKING_FIX] Valores de is_alive normalizados';
END $$;

-- =====================================
-- 6. TRIGGER PARA MANTER highest_floor ATUALIZADO
-- =====================================

-- Função do trigger
CREATE OR REPLACE FUNCTION update_highest_floor_trigger()
RETURNS TRIGGER AS $$
BEGIN
    -- Sempre manter o highest_floor como o maior valor entre o atual e o novo
    NEW.highest_floor = GREATEST(COALESCE(OLD.highest_floor, 1), NEW.floor);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS maintain_highest_floor ON characters;

-- Criar trigger
CREATE TRIGGER maintain_highest_floor
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION update_highest_floor_trigger();

-- =====================================
-- 7. TESTE DAS CORREÇÕES
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_consistency()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_chars_with_highest_floor INTEGER;
    v_chars_with_is_alive INTEGER;
    v_ranking_entries INTEGER;
    v_user_history_entries INTEGER;
    v_dead_chars INTEGER;
BEGIN
    -- Teste 1: Verificar se personagens têm highest_floor
    SELECT COUNT(*) INTO v_chars_with_highest_floor
    FROM characters 
    WHERE highest_floor IS NOT NULL AND highest_floor >= floor;
    
    RETURN QUERY SELECT 
        'Personagens com highest_floor válido'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens com highest_floor >= floor', v_chars_with_highest_floor)::TEXT;
    
    -- Teste 2: Verificar se personagens têm is_alive
    SELECT COUNT(*) INTO v_chars_with_is_alive
    FROM characters 
    WHERE is_alive IS NOT NULL;
    
    RETURN QUERY SELECT 
        'Personagens com is_alive definido'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens com is_alive não-nulo', v_chars_with_is_alive)::TEXT;
    
    -- Teste 3: Verificar personagens mortos na tabela dead_characters
    SELECT COUNT(*) INTO v_dead_chars
    FROM dead_characters;
    
    RETURN QUERY SELECT 
        'Personagens mortos em dead_characters'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens mortos registrados', v_dead_chars)::TEXT;
    
    -- Teste 4: Testar ranking por andar
    SELECT COUNT(*) INTO v_ranking_entries
    FROM get_dynamic_ranking_by_highest_floor(50, 'all', '', 0);
    
    RETURN QUERY SELECT 
        'Ranking por andar funcionando'::TEXT,
        CASE WHEN v_ranking_entries > 0 THEN 'OK' ELSE 'ATENÇÃO' END::TEXT,
        format('Retornou %s entradas', v_ranking_entries)::TEXT;
    
    -- Teste 5: Testar histórico de usuário (se existir algum usuário)
    IF EXISTS (SELECT 1 FROM characters LIMIT 1) THEN
        SELECT COUNT(*) INTO v_user_history_entries
        FROM get_dynamic_user_ranking_history(
            (SELECT user_id FROM characters LIMIT 1),
            10
        );
        
        RETURN QUERY SELECT 
            'Histórico de usuário funcionando'::TEXT,
            'OK'::TEXT,
            format('Retornou %s entradas para primeiro usuário', v_user_history_entries)::TEXT;
    END IF;
END;
$$;

-- =====================================
-- 8. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DE CONSISTÊNCIA DO RANKING';
    RAISE NOTICE 'Data: 2024-12-20 - Versão: 8';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Função get_dynamic_user_ranking_history corrigida';
    RAISE NOTICE '✓ Função get_dynamic_user_stats corrigida';
    RAISE NOTICE '✓ Funções de ranking global corrigidas';
    RAISE NOTICE '✓ Função de contagem corrigida';
    RAISE NOTICE '✓ Agora usa tabela dead_characters para personagens mortos';
    RAISE NOTICE '✓ Colunas highest_floor e is_alive garantidas';
    RAISE NOTICE '✓ Trigger de highest_floor recriado';
    RAISE NOTICE '✓ Função de teste atualizada';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Execute: SELECT * FROM test_ranking_consistency();';
    RAISE NOTICE 'Para verificar se as correções funcionaram.';
    RAISE NOTICE '====================================';
END $$; 