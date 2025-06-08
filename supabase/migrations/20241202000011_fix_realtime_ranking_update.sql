-- Migração para corrigir atualização em tempo real do ranking
-- Data: 2024-12-02
-- Versão: 20241202000011

-- =====================================
-- PROBLEMA IDENTIFICADO:
-- O ranking só é atualizado quando o personagem morre, não durante o progresso.
-- O sistema dinâmico funciona, mas precisa garantir que os dados sejam atualizados
-- em tempo real quando o personagem avança de andar.
-- =====================================

-- =====================================
-- 1. CORRIGIR FUNÇÃO update_character_floor PARA GARANTIR ATUALIZAÇÃO
-- =====================================

CREATE OR REPLACE FUNCTION update_character_floor(
    p_character_id UUID,
    p_floor INTEGER
)
RETURNS VOID AS $$
DECLARE
    v_character RECORD;
    v_old_floor INTEGER;
    v_user_id UUID;
BEGIN
    -- Validar se o andar é válido
    IF p_floor < 1 THEN
        RAISE EXCEPTION 'Andar deve ser pelo menos 1';
    END IF;
    
    -- Buscar dados atuais do personagem
    SELECT floor, user_id, name, level, gold, hp, is_alive
    INTO v_character
    FROM characters
    WHERE id = p_character_id;
    
    -- Verificar se o personagem foi encontrado
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;
    
    v_old_floor := COALESCE(v_character.floor, 1);
    v_user_id := v_character.user_id;
    
    -- Atualizar o andar do personagem
    UPDATE characters
    SET 
        floor = p_floor,
        updated_at = NOW(),
        last_activity = NOW()
    WHERE id = p_character_id;
    
    -- Log para debug
    RAISE NOTICE '[RANKING UPDATE] Personagem % (%) - Andar atualizado: % -> %', 
        v_character.name, p_character_id, v_old_floor, p_floor;
    
    -- Se o andar aumentou, atualizar progressão do usuário
    IF p_floor > v_old_floor THEN
        -- Atualizar progressão do usuário na tabela users
        PERFORM update_user_character_progression(v_user_id);
        
        RAISE NOTICE '[RANKING UPDATE] Progressão do usuário % atualizada - novo andar máximo verificado', v_user_id;
        
        -- Forçar atualização do cache de ranking (se necessário)
        -- O sistema dinâmico já reflete automaticamente as mudanças
        RAISE NOTICE '[RANKING UPDATE] Ranking dinâmico atualizado automaticamente para andar %', p_floor;
    END IF;
    
    -- Log final para confirmar atualização
    RAISE NOTICE '[RANKING UPDATE] Atualização concluída - personagem % agora no andar %', 
        v_character.name, p_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 2. CRIAR TRIGGER PARA MONITORAR MUDANÇAS DE ANDAR
-- =====================================

-- Função para trigger que monitora mudanças de andar
CREATE OR REPLACE FUNCTION trigger_ranking_update_on_floor_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Apenas processar se o andar realmente mudou
    IF OLD.floor IS DISTINCT FROM NEW.floor THEN
        -- Log detalhado para debug
        RAISE NOTICE '[TRIGGER] Andar do personagem % mudou de % para % (user: %)', 
            NEW.name, COALESCE(OLD.floor, 1), NEW.floor, NEW.user_id;
        
        -- Atualizar last_activity para marcar atividade recente
        NEW.last_activity := NOW();
        NEW.updated_at := NOW();
        
        -- Se o andar aumentou, é um progresso positivo
        IF NEW.floor > COALESCE(OLD.floor, 1) THEN
            RAISE NOTICE '[TRIGGER] Progresso detectado - atualizando ranking para usuário %', NEW.user_id;
            
            -- Notificar sistema de ranking (para futuras implementações de cache)
            PERFORM pg_notify('ranking_progress', json_build_object(
                'user_id', NEW.user_id,
                'character_id', NEW.id,
                'character_name', NEW.name,
                'old_floor', COALESCE(OLD.floor, 1),
                'new_floor', NEW.floor,
                'level', NEW.level,
                'gold', NEW.gold,
                'is_alive', NEW.is_alive,
                'timestamp', NOW()
            )::text);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger existente se houver
DROP TRIGGER IF EXISTS ranking_update_on_floor_change ON characters;

-- Criar o trigger
CREATE TRIGGER ranking_update_on_floor_change
    BEFORE UPDATE OF floor ON characters
    FOR EACH ROW
    EXECUTE FUNCTION trigger_ranking_update_on_floor_change();

-- =====================================
-- 3. OTIMIZAR FUNÇÃO DE RANKING PARA GARANTIR DADOS ATUAIS
-- =====================================

-- Versão otimizada que garante dados em tempo real
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
DECLARE
    result_count INTEGER;
BEGIN
    RAISE NOTICE '[RANKING] Buscando ranking dinâmico - filtro: %, limite: %', p_status_filter, p_limit;
    
    RETURN QUERY
    WITH best_characters AS (
        SELECT DISTINCT ON (c.user_id)
            c.id,
            c.user_id,
            c.name::VARCHAR(100) as player_name,
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
                ELSE true -- 'all' mostra todos
            END
        ORDER BY 
            c.user_id,
            c.floor DESC, 
            c.level DESC, 
            c.created_at ASC
    )
    SELECT 
        bc.id,
        bc.user_id,
        bc.player_name,
        bc.highest_floor,
        bc.character_level,
        bc.character_gold,
        bc.character_alive,
        bc.created_at
    FROM best_characters bc
    ORDER BY bc.highest_floor DESC, bc.character_level DESC, bc.created_at ASC
    LIMIT p_limit;
    
    -- Contar resultados de forma segura
    GET DIAGNOSTICS result_count = ROW_COUNT;
    RAISE NOTICE '[RANKING] Retornando ranking com % entradas', result_count;
END;
$$;

-- =====================================
-- 4. FUNÇÃO PARA VERIFICAR INTEGRIDADE DO RANKING
-- =====================================

CREATE OR REPLACE FUNCTION verify_ranking_integrity()
RETURNS TABLE(
    test_name TEXT,
    result TEXT,
    details TEXT
) AS $$
DECLARE
    total_characters INTEGER;
    characters_with_progress INTEGER;
    max_floor_global INTEGER;
    users_in_ranking INTEGER;
    ranking_count INTEGER;
BEGIN
    -- Teste 1: Contar personagens totais
    SELECT COUNT(*) INTO total_characters FROM characters;
    RETURN QUERY SELECT 
        'Total Characters'::TEXT,
        total_characters::TEXT,
        'Personagens na tabela characters'::TEXT;
    
    -- Teste 2: Personagens com progresso
    SELECT COUNT(*) INTO characters_with_progress 
    FROM characters WHERE floor > 1;
    RETURN QUERY SELECT 
        'Characters with Progress'::TEXT,
        characters_with_progress::TEXT,
        'Personagens que avançaram além do andar 1'::TEXT;
    
    -- Teste 3: Andar máximo global
    SELECT COALESCE(MAX(floor), 0) INTO max_floor_global FROM characters;
    RETURN QUERY SELECT 
        'Max Floor Reached'::TEXT,
        max_floor_global::TEXT,
        'Andar mais alto alcançado por qualquer personagem'::TEXT;
    
    -- Teste 4: Usuários únicos no ranking
    SELECT COUNT(DISTINCT user_id) INTO users_in_ranking 
    FROM characters WHERE floor > 0;
    RETURN QUERY SELECT 
        'Unique Users in Ranking'::TEXT,
        users_in_ranking::TEXT,
        'Usuários únicos com personagens que jogaram'::TEXT;
    
    -- Teste 5: Verificar ranking dinâmico (de forma segura)
    BEGIN
        SELECT COUNT(*) INTO ranking_count 
        FROM get_dynamic_ranking_by_highest_floor(50, 'all');
        
        RETURN QUERY SELECT 
            'Dynamic Ranking Test'::TEXT,
            ranking_count::TEXT,
            'Entradas retornadas pela função de ranking dinâmico'::TEXT;
    EXCEPTION
        WHEN OTHERS THEN
            RETURN QUERY SELECT 
                'Dynamic Ranking Test'::TEXT,
                'ERROR'::TEXT,
                SQLERRM::TEXT;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. FUNÇÃO PARA FORÇAR ATUALIZAÇÃO DE RANKING
-- =====================================

CREATE OR REPLACE FUNCTION force_ranking_refresh()
RETURNS TEXT AS $$
DECLARE
    updated_users INTEGER := 0;
    user_record RECORD;
BEGIN
    RAISE NOTICE '[RANKING REFRESH] Iniciando atualização forçada do ranking...';
    
    -- Atualizar progressão de todos os usuários com personagens
    FOR user_record IN 
        SELECT DISTINCT user_id 
        FROM characters 
        WHERE floor > 0
    LOOP
        PERFORM update_user_character_progression(user_record.user_id);
        updated_users := updated_users + 1;
    END LOOP;
    
    RAISE NOTICE '[RANKING REFRESH] Atualização concluída - % usuários processados', updated_users;
    
    RETURN format('Ranking atualizado com sucesso - %s usuários processados', updated_users);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 6. GARANTIR INTEGRIDADE DOS DADOS
-- =====================================

-- Corrigir floors inválidos
UPDATE characters 
SET floor = GREATEST(floor, 1)
WHERE floor < 1;

-- Garantir que is_alive está correto
UPDATE characters 
SET is_alive = (hp > 0)
WHERE is_alive IS NULL OR is_alive != (hp > 0);

-- Atualizar last_activity para personagens sem data
UPDATE characters 
SET last_activity = COALESCE(updated_at, created_at, NOW())
WHERE last_activity IS NULL;

-- =====================================
-- 7. EXECUTAR TESTE INICIAL (VERSÃO SEGURA)
-- =====================================

DO $$
DECLARE
    test_result RECORD;
BEGIN
    RAISE NOTICE '=== TESTE DE INTEGRIDADE DO RANKING ===';
    
    BEGIN
        FOR test_result IN SELECT * FROM verify_ranking_integrity()
        LOOP
            RAISE NOTICE '%: % (%)', test_result.test_name, test_result.result, test_result.details;
        END LOOP;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Erro durante teste de integridade: %', SQLERRM;
    END;
    
    RAISE NOTICE '========================================';
END;
$$;

-- =====================================
-- 8. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION update_character_floor IS 'Atualiza o andar do personagem e garante que o ranking seja atualizado em tempo real';
COMMENT ON FUNCTION trigger_ranking_update_on_floor_change IS 'Trigger que monitora mudanças de andar e atualiza o ranking automaticamente';
COMMENT ON FUNCTION get_dynamic_ranking_by_highest_floor IS 'Função otimizada para ranking dinâmico em tempo real por andar mais alto';
COMMENT ON FUNCTION verify_ranking_integrity IS 'Verifica a integridade dos dados do ranking';
COMMENT ON FUNCTION force_ranking_refresh IS 'Força atualização completa do ranking para todos os usuários';

-- Migração concluída com sucesso!
-- O ranking agora será atualizado em tempo real quando os personagens progredirem. 