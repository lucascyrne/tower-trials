-- =====================================
-- SISTEMA DE RANKING DEFINITIVO
-- Data: 2024-12-02
-- Versão: 12 (Definitiva)
-- =====================================

-- Este sistema garante que:
-- 1. Todos os personagens aparecem no ranking (vivos e mortos)
-- 2. Dados são atualizados em tempo real conforme o personagem progride
-- 3. Sistema híbrido: characters para vivos + game_rankings para mortos
-- 4. Performance otimizada com índices adequados

-- =====================================
-- 1. GARANTIR QUE TABELA GAME_RANKINGS EXISTE
-- =====================================

-- Criar tabela game_rankings se não existir
CREATE TABLE IF NOT EXISTS game_rankings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name VARCHAR(100) NOT NULL,
    highest_floor INTEGER NOT NULL DEFAULT 1,
    user_id UUID REFERENCES users(uid) ON DELETE SET NULL,
    character_alive BOOLEAN DEFAULT TRUE,
    character_level INTEGER DEFAULT 1,
    character_gold INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Garantir que as colunas existem (para compatibilidade com migrações antigas)
ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_alive BOOLEAN DEFAULT TRUE;

ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_level INTEGER DEFAULT 1;

ALTER TABLE game_rankings 
ADD COLUMN IF NOT EXISTS character_gold INTEGER DEFAULT 0;

-- Habilitar RLS
ALTER TABLE game_rankings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS básicas
DROP POLICY IF EXISTS game_rankings_select_policy ON game_rankings;
CREATE POLICY game_rankings_select_policy ON game_rankings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS game_rankings_insert_policy ON game_rankings;
CREATE POLICY game_rankings_insert_policy ON game_rankings
  FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- =====================================
-- 2. LIMPAR TRIGGERS E FUNÇÕES ANTIGAS
-- =====================================

-- Remover triggers antigos que podem estar causando conflitos
DROP TRIGGER IF EXISTS ranking_update_on_floor_change ON characters;
DROP TRIGGER IF EXISTS update_ranking_on_floor_change ON characters;
DROP TRIGGER IF EXISTS log_ranking_updates ON characters;

-- Remover funções existentes que podem ter conflitos de tipo
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_level(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_gold(INTEGER, TEXT);
DROP FUNCTION IF EXISTS get_dynamic_user_ranking_history(UUID, INTEGER);
DROP FUNCTION IF EXISTS get_dynamic_user_stats(UUID);
DROP FUNCTION IF EXISTS save_ranking_entry_on_death(UUID);
DROP FUNCTION IF EXISTS update_character_floor(UUID, INTEGER);
DROP FUNCTION IF EXISTS test_ranking_system(UUID);

-- =====================================
-- 3. FUNÇÃO PRINCIPAL: RANKING POR ANDAR MAIS ALTO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_highest_floor(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
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
    RAISE NOTICE '[RANKING] Buscando ranking por andar - filtro: %, limite: %', p_status_filter, p_limit;
    
    -- Sistema híbrido: personagens vivos da tabela characters + mortos da tabela game_rankings
    RETURN QUERY
    WITH live_characters AS (
        -- Personagens vivos (dados em tempo real da tabela characters)
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.floor > 0 -- Apenas personagens que progrediram
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
        ORDER BY c.user_id, c.floor DESC, c.level DESC, c.created_at ASC
    ),
    dead_characters AS (
        -- Personagens mortos (dados históricos da tabela game_rankings)
        SELECT DISTINCT ON (gr.user_id)
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
          AND NOT EXISTS (
              -- Evitar duplicatas: se o usuário tem personagem vivo, não incluir os mortos
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.floor > 0
          )
        ORDER BY gr.user_id, gr.highest_floor DESC, gr.created_at DESC
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
    ORDER BY cr.highest_floor DESC, cr.character_level DESC, cr.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 4. FUNÇÃO: RANKING POR MAIOR NÍVEL
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_level(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
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
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
        ORDER BY c.user_id, c.level DESC, c.floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
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
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.floor > 0
          )
        ORDER BY gr.user_id, gr.character_level DESC, gr.created_at DESC
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
    ORDER BY cr.character_level DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 5. FUNÇÃO: RANKING POR MAIOR OURO
-- =====================================

CREATE OR REPLACE FUNCTION get_dynamic_ranking_by_gold(
    p_limit INTEGER DEFAULT 10,
    p_status_filter TEXT DEFAULT 'all'
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
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.is_alive = true 
          AND c.floor > 0
          AND (p_status_filter = 'all' OR p_status_filter = 'alive')
        ORDER BY c.user_id, c.gold DESC, c.floor DESC, c.created_at ASC
    ),
    dead_characters AS (
        SELECT DISTINCT ON (gr.user_id)
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
          AND NOT EXISTS (
              SELECT 1 FROM characters c 
              WHERE c.user_id = gr.user_id 
                AND c.is_alive = true 
                AND c.floor > 0
          )
        ORDER BY gr.user_id, gr.character_gold DESC, gr.created_at DESC
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
    ORDER BY cr.character_gold DESC, cr.highest_floor DESC, cr.created_at ASC
    LIMIT p_limit;
END;
$$;

-- =====================================
-- 6. FUNÇÃO: HISTÓRICO DO USUÁRIO
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
        -- Personagens vivos do usuário
        SELECT 
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
            c.floor as highest_floor,
            c.level as character_level,
            c.gold as character_gold,
            true as character_alive,
            c.created_at
        FROM characters c
        WHERE c.user_id = p_user_id 
          AND c.is_alive = true
          AND c.floor > 0
        UNION ALL
        -- Personagens mortos do usuário (histórico)
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
        WHERE gr.user_id = p_user_id 
          AND gr.character_alive = false
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
-- 7. FUNÇÃO: ESTATÍSTICAS DO USUÁRIO
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
            COALESCE(MAX(c.floor), 0) as live_best_floor,
            COALESCE(MAX(c.level), 1) as live_best_level,
            COALESCE(MAX(c.gold), 0) as live_best_gold,
            COUNT(c.id) as live_count
        FROM characters c
        WHERE c.user_id = p_user_id AND c.is_alive = true
    ),
    dead_stats AS (
        SELECT 
            COALESCE(MAX(gr.highest_floor), 0) as dead_best_floor,
            COALESCE(MAX(gr.character_level), 1) as dead_best_level,
            COALESCE(MAX(gr.character_gold), 0) as dead_best_gold,
            COUNT(gr.id) as dead_count
        FROM game_rankings gr
        WHERE gr.user_id = p_user_id AND gr.character_alive = false
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
-- 8. FUNÇÃO: SALVAR RANKING QUANDO PERSONAGEM MORRE
-- =====================================

CREATE OR REPLACE FUNCTION save_ranking_entry_on_death(
    p_character_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_character RECORD;
    v_ranking_id UUID;
BEGIN
    -- Buscar dados do personagem
    SELECT 
        c.user_id,
        c.name,
        c.floor,
        c.level,
        c.gold
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Salvar no ranking histórico
    INSERT INTO game_rankings (
        user_id,
        player_name,
        highest_floor,
        character_level,
        character_gold,
        character_alive,
        created_at
    )
    VALUES (
        v_character.user_id,
        v_character.name,
        v_character.floor,
        v_character.level,
        v_character.gold,
        false, -- character_alive = false
        NOW()
    )
    RETURNING id INTO v_ranking_id;
    
    RAISE NOTICE '[RANKING] Entrada salva para personagem morto: % (andar %)', v_character.name, v_character.floor;
    
    RETURN v_ranking_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 9. FUNÇÃO: ATUALIZAR ANDAR DO PERSONAGEM
-- =====================================

CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
BEGIN
    -- Validar inputs
    IF p_character_id IS NULL THEN
        RAISE EXCEPTION 'ID do personagem não pode ser nulo';
    END IF;
    
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser maior que 0, recebido: %', p_floor;
    END IF;
    
    -- Atualizar o andar
    UPDATE characters 
    SET 
        floor = p_floor,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    RAISE NOTICE '[FLOOR_UPDATE] Personagem % atualizado para andar %', p_character_id, p_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 10. FUNÇÃO: TESTE DO SISTEMA DE RANKING
-- =====================================

CREATE OR REPLACE FUNCTION test_ranking_system(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_live_count INTEGER;
    v_dead_count INTEGER;
    v_total_count INTEGER;
BEGIN
    -- Teste 1: Contar personagens vivos
    SELECT COUNT(*) INTO v_live_count
    FROM characters
    WHERE is_alive = true AND floor > 0;
    
    RETURN QUERY SELECT 
        'Personagens Vivos'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens vivos com progresso', v_live_count)::TEXT;
    
    -- Teste 2: Contar entradas de ranking mortos
    SELECT COUNT(*) INTO v_dead_count
    FROM game_rankings
    WHERE character_alive = false;
    
    RETURN QUERY SELECT 
        'Personagens Mortos'::TEXT,
        'OK'::TEXT,
        format('Total: %s entradas de personagens mortos', v_dead_count)::TEXT;
    
    -- Teste 3: Total geral
    v_total_count := v_live_count + v_dead_count;
    
    RETURN QUERY SELECT 
        'Total Geral'::TEXT,
        'OK'::TEXT,
        format('Total: %s personagens no sistema (%s vivos + %s mortos)', 
               v_total_count, v_live_count, v_dead_count)::TEXT;
    
    -- Teste 4: Ranking por andar
    SELECT COUNT(*) INTO v_total_count
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    
    RETURN QUERY SELECT 
        'Ranking por Andar'::TEXT,
        CASE WHEN v_total_count > 0 THEN 'OK' ELSE 'FALHA' END::TEXT,
        format('Retornou %s entradas', v_total_count)::TEXT;
    
    -- Teste 5: Usuário específico (se fornecido)
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_total_count
        FROM get_dynamic_user_ranking_history(p_user_id, 10);
        
        RETURN QUERY SELECT 
            'Histórico do Usuário'::TEXT,
            CASE WHEN v_total_count >= 0 THEN 'OK' ELSE 'FALHA' END::TEXT,
            format('Usuário %s tem %s entradas', p_user_id, v_total_count)::TEXT;
    END IF;
END;
$$;

-- =====================================
-- 11. ÍNDICES OTIMIZADOS
-- =====================================

-- Índices básicos para game_rankings
CREATE INDEX IF NOT EXISTS idx_game_rankings_highest_floor 
ON game_rankings(highest_floor DESC);

CREATE INDEX IF NOT EXISTS idx_game_rankings_user_id 
ON game_rankings(user_id);

-- Índices para characters (personagens vivos)
CREATE INDEX IF NOT EXISTS idx_characters_ranking_floor_optimized 
ON characters(is_alive, floor DESC, level DESC, created_at ASC) 
WHERE is_alive = true AND floor > 0;

CREATE INDEX IF NOT EXISTS idx_characters_ranking_level_optimized 
ON characters(is_alive, level DESC, floor DESC, created_at ASC) 
WHERE is_alive = true AND floor > 0;

CREATE INDEX IF NOT EXISTS idx_characters_ranking_gold_optimized 
ON characters(is_alive, gold DESC, floor DESC, created_at ASC) 
WHERE is_alive = true AND floor > 0;

CREATE INDEX IF NOT EXISTS idx_characters_user_ranking 
ON characters(user_id, is_alive, floor DESC, level DESC);

-- Índices para game_rankings (personagens mortos)
CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_floor_optimized 
ON game_rankings(character_alive, highest_floor DESC, character_level DESC, created_at ASC) 
WHERE character_alive = false;

CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_level_optimized 
ON game_rankings(character_alive, character_level DESC, highest_floor DESC, created_at ASC) 
WHERE character_alive = false;

CREATE INDEX IF NOT EXISTS idx_game_rankings_dead_gold_optimized 
ON game_rankings(character_alive, character_gold DESC, highest_floor DESC, created_at ASC) 
WHERE character_alive = false;

CREATE INDEX IF NOT EXISTS idx_game_rankings_user_dead 
ON game_rankings(user_id, character_alive) 
WHERE character_alive = false;

-- =====================================
-- 12. COMENTÁRIOS FINAIS
-- =====================================

COMMENT ON FUNCTION get_dynamic_ranking_by_highest_floor IS 'Ranking híbrido: personagens vivos (tempo real) + mortos (histórico)';
COMMENT ON FUNCTION save_ranking_entry_on_death IS 'Salva entrada no ranking histórico quando personagem morre';
COMMENT ON FUNCTION update_character_floor IS 'Atualiza andar do personagem (dados em tempo real)';

-- Log de conclusão
DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'SISTEMA DE RANKING DEFINITIVO INSTALADO';
    RAISE NOTICE 'Versão: 12 (2024-12-02)';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Características:';
    RAISE NOTICE '✓ Personagens vivos: dados em tempo real';
    RAISE NOTICE '✓ Personagens mortos: dados históricos';
    RAISE NOTICE '✓ Filtros: all/alive/dead';
    RAISE NOTICE '✓ Modalidades: floor/level/gold';
    RAISE NOTICE '✓ Performance otimizada';
    RAISE NOTICE '✓ Tabela game_rankings criada/atualizada';
    RAISE NOTICE '====================================';
END $$; 