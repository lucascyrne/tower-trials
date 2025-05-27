-- Migração para corrigir o sistema de ranking e garantir atualização em tempo real do andar mais alto
-- Esta migração resolve problemas de sincronização entre o progresso do personagem e o ranking

-- =====================================
-- 1. CORRIGIR FUNÇÃO update_character_floor PARA ATUALIZAR RANKING
-- =====================================

-- Atualizar a função para garantir que o ranking seja atualizado quando o andar muda
CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_old_floor INTEGER;
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Buscar dados atuais do personagem
    SELECT floor, user_id, name INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    v_old_floor := v_character.floor;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW(),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Log para debug
    RAISE NOTICE 'Personagem % (%) - Andar atualizado: % -> %', 
        v_character.name, p_character_id, v_old_floor, p_floor;
    
    -- Se o andar aumentou, atualizar progressão do usuário
    IF p_floor > v_old_floor THEN
        PERFORM update_user_character_progression(v_character.user_id);
        RAISE NOTICE 'Progressão do usuário % atualizada devido ao avanço do andar', v_character.user_id;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. CRIAR TRIGGER PARA ATUALIZAR RANKING AUTOMATICAMENTE
-- =====================================

-- Função para trigger que atualiza o ranking quando o andar muda
CREATE OR REPLACE FUNCTION trigger_update_ranking_on_floor_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Apenas processar se o andar realmente mudou
    IF OLD.floor IS DISTINCT FROM NEW.floor THEN
        -- Log para debug
        RAISE NOTICE 'Trigger: Andar do personagem % mudou de % para %', 
            NEW.name, OLD.floor, NEW.floor;
        
        -- Atualizar last_activity para marcar atividade recente
        NEW.last_activity := NOW();
        
        -- Se o andar aumentou, atualizar progressão do usuário
        IF NEW.floor > COALESCE(OLD.floor, 0) THEN
            -- Executar em background para não bloquear a transação principal
            PERFORM pg_notify('ranking_update', json_build_object(
                'user_id', NEW.user_id,
                'character_id', NEW.id,
                'old_floor', OLD.floor,
                'new_floor', NEW.floor,
                'character_name', NEW.name
            )::text);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar o trigger
DROP TRIGGER IF EXISTS update_ranking_on_floor_change ON characters;
CREATE TRIGGER update_ranking_on_floor_change
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_ranking_on_floor_change();

-- =====================================
-- 3. OTIMIZAR FUNÇÕES DE RANKING PARA TEMPO REAL
-- =====================================

-- Função otimizada para ranking por andar mais alto (tempo real)
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
    RETURN QUERY
    SELECT DISTINCT ON (c.user_id)
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
        c.floor > 0 AND -- Apenas personagens que jogaram
        CASE 
            WHEN p_status_filter = 'alive' THEN COALESCE(c.is_alive, true) = true
            WHEN p_status_filter = 'dead' THEN COALESCE(c.is_alive, true) = false
            ELSE true
        END
    ORDER BY 
        c.user_id,
        c.floor DESC, 
        c.level DESC, 
        c.created_at ASC
    LIMIT p_limit * 2 -- Buscar mais registros para garantir diversidade de usuários
;
END;
$$;

-- Função para obter o melhor personagem de cada usuário por andar
CREATE OR REPLACE FUNCTION get_best_character_per_user_by_floor(
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
                ORDER BY c.floor DESC, c.level DESC, c.created_at ASC
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
    ORDER BY rc.highest_floor DESC, rc.character_level DESC, rc.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Atualizar a função principal para usar a nova lógica
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
    RETURN QUERY
    SELECT * FROM get_best_character_per_user_by_floor(p_limit, p_status_filter);
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA SINCRONIZAR RANKING MANUALMENTE
-- =====================================

-- Função para sincronizar o ranking de todos os personagens (uso administrativo)
CREATE OR REPLACE FUNCTION sync_all_character_rankings()
RETURNS TABLE(
    user_id UUID,
    characters_updated INTEGER,
    max_floor INTEGER
) AS $$
DECLARE
    user_record RECORD;
    char_count INTEGER;
    max_floor_reached INTEGER;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT c.user_id 
        FROM characters c 
        WHERE c.floor > 0
    LOOP
        -- Contar personagens do usuário
        SELECT COUNT(*), MAX(c.floor)
        INTO char_count, max_floor_reached
        FROM characters c
        WHERE c.user_id = user_record.user_id;
        
        -- Atualizar progressão do usuário
        PERFORM update_user_character_progression(user_record.user_id);
        
        RETURN QUERY SELECT user_record.user_id, char_count, max_floor_reached;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. ÍNDICES OTIMIZADOS PARA RANKING EM TEMPO REAL
-- =====================================

-- Índice composto para ranking por andar (um por usuário)
CREATE INDEX IF NOT EXISTS idx_characters_user_floor_ranking 
ON characters(user_id, floor DESC, level DESC, created_at ASC) 
WHERE floor > 0 AND COALESCE(is_alive, true) = true;

-- Índice para ranking global por andar
CREATE INDEX IF NOT EXISTS idx_characters_global_floor_ranking 
ON characters(floor DESC, level DESC, created_at ASC) 
WHERE floor > 0;

-- Índice para filtros de status
CREATE INDEX IF NOT EXISTS idx_characters_alive_floor_ranking 
ON characters(is_alive, floor DESC, level DESC) 
WHERE floor > 0;

-- =====================================
-- 6. FUNÇÃO DE TESTE PARA VERIFICAR RANKING
-- =====================================

-- Função para testar se o ranking está funcionando corretamente
CREATE OR REPLACE FUNCTION test_ranking_system(p_user_id UUID DEFAULT NULL)
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
) AS $$
DECLARE
    char_count INTEGER;
    ranking_count INTEGER;
    max_floor INTEGER;
BEGIN
    -- Teste 1: Verificar se há personagens
    SELECT COUNT(*) INTO char_count FROM characters WHERE floor > 0;
    RETURN QUERY SELECT 
        'Total Characters'::TEXT,
        char_count::TEXT,
        'Characters with floor > 0'::TEXT;
    
    -- Teste 2: Verificar ranking por andar
    SELECT COUNT(*) INTO ranking_count 
    FROM get_dynamic_ranking_by_highest_floor(50, 'all');
    RETURN QUERY SELECT 
        'Ranking Entries'::TEXT,
        ranking_count::TEXT,
        'Entries in highest floor ranking'::TEXT;
    
    -- Teste 3: Verificar andar máximo
    SELECT MAX(floor) INTO max_floor FROM characters WHERE floor > 0;
    RETURN QUERY SELECT 
        'Max Floor Reached'::TEXT,
        COALESCE(max_floor, 0)::TEXT,
        'Highest floor in database'::TEXT;
    
    -- Teste 4: Se usuário específico fornecido, verificar seus dados
    IF p_user_id IS NOT NULL THEN
        SELECT COUNT(*), MAX(floor) 
        INTO char_count, max_floor
        FROM characters 
        WHERE user_id = p_user_id AND floor > 0;
        
        RETURN QUERY SELECT 
            'User Characters'::TEXT,
            char_count::TEXT,
            format('User %s has %s characters, max floor %s', 
                p_user_id, char_count, COALESCE(max_floor, 0))::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION update_character_floor IS 'Atualiza o andar do personagem e sincroniza o ranking automaticamente';
COMMENT ON FUNCTION trigger_update_ranking_on_floor_change IS 'Trigger que monitora mudanças no andar e atualiza o ranking';
COMMENT ON FUNCTION get_best_character_per_user_by_floor IS 'Obtém o melhor personagem de cada usuário para ranking por andar';
COMMENT ON FUNCTION sync_all_character_rankings IS 'Sincroniza manualmente o ranking de todos os usuários (uso administrativo)';
COMMENT ON FUNCTION test_ranking_system IS 'Função de teste para verificar se o sistema de ranking está funcionando';

-- Script concluído com sucesso!
-- O sistema de ranking agora será atualizado automaticamente quando o andar do personagem mudar 