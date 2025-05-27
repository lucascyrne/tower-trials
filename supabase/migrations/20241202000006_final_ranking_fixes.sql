-- Migração final para garantir que o sistema de ranking funcione perfeitamente
-- Corrige dados existentes e adiciona validações finais

-- =====================================
-- 1. CORRIGIR DADOS EXISTENTES
-- =====================================

-- Garantir que todos os personagens tenham is_alive definido corretamente
UPDATE characters 
SET is_alive = CASE 
    WHEN hp > 0 THEN true 
    ELSE false 
END
WHERE is_alive IS NULL;

-- Garantir que todos os personagens tenham floor >= 1
UPDATE characters 
SET floor = 1 
WHERE floor IS NULL OR floor < 1;

-- Atualizar last_activity para personagens que não têm
UPDATE characters 
SET last_activity = updated_at 
WHERE last_activity IS NULL;

-- =====================================
-- 2. FUNÇÃO PARA VERIFICAR INTEGRIDADE DOS DADOS
-- =====================================

CREATE OR REPLACE FUNCTION check_ranking_data_integrity()
RETURNS TABLE(
    check_name TEXT,
    status TEXT,
    count_affected INTEGER,
    details TEXT
) AS $$
DECLARE
    null_floors INTEGER;
    null_alive INTEGER;
    invalid_floors INTEGER;
    total_characters INTEGER;
BEGIN
    -- Contar personagens com problemas
    SELECT COUNT(*) INTO null_floors FROM characters WHERE floor IS NULL;
    SELECT COUNT(*) INTO null_alive FROM characters WHERE is_alive IS NULL;
    SELECT COUNT(*) INTO invalid_floors FROM characters WHERE floor < 1;
    SELECT COUNT(*) INTO total_characters FROM characters;
    
    -- Retornar resultados dos checks
    RETURN QUERY SELECT 
        'Null Floors'::TEXT,
        CASE WHEN null_floors = 0 THEN 'OK' ELSE 'PROBLEMA' END::TEXT,
        null_floors,
        format('Personagens com floor NULL: %s', null_floors)::TEXT;
    
    RETURN QUERY SELECT 
        'Null Alive Status'::TEXT,
        CASE WHEN null_alive = 0 THEN 'OK' ELSE 'PROBLEMA' END::TEXT,
        null_alive,
        format('Personagens com is_alive NULL: %s', null_alive)::TEXT;
    
    RETURN QUERY SELECT 
        'Invalid Floors'::TEXT,
        CASE WHEN invalid_floors = 0 THEN 'OK' ELSE 'PROBLEMA' END::TEXT,
        invalid_floors,
        format('Personagens com floor < 1: %s', invalid_floors)::TEXT;
    
    RETURN QUERY SELECT 
        'Total Characters'::TEXT,
        'INFO'::TEXT,
        total_characters,
        format('Total de personagens no banco: %s', total_characters)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================
-- 3. FUNÇÃO PARA CORRIGIR AUTOMATICAMENTE PROBLEMAS
-- =====================================

CREATE OR REPLACE FUNCTION fix_ranking_data_issues()
RETURNS TEXT AS $$
DECLARE
    fixed_floors INTEGER := 0;
    fixed_alive INTEGER := 0;
    fixed_activity INTEGER := 0;
BEGIN
    -- Corrigir floors NULL ou inválidos
    UPDATE characters 
    SET floor = 1 
    WHERE floor IS NULL OR floor < 1;
    GET DIAGNOSTICS fixed_floors = ROW_COUNT;
    
    -- Corrigir is_alive NULL
    UPDATE characters 
    SET is_alive = (hp > 0)
    WHERE is_alive IS NULL;
    GET DIAGNOSTICS fixed_alive = ROW_COUNT;
    
    -- Corrigir last_activity NULL
    UPDATE characters 
    SET last_activity = COALESCE(updated_at, created_at, NOW())
    WHERE last_activity IS NULL;
    GET DIAGNOSTICS fixed_activity = ROW_COUNT;
    
    RETURN format('Correções aplicadas: %s floors, %s status alive, %s last_activity', 
        fixed_floors, fixed_alive, fixed_activity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. OTIMIZAR FUNÇÃO get_dynamic_ranking_by_highest_floor
-- =====================================

-- Remover função existente primeiro para evitar conflitos
DROP FUNCTION IF EXISTS get_dynamic_ranking_by_highest_floor(INTEGER, TEXT);

-- Versão final otimizada da função principal de ranking
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
    -- Log para debug
    RAISE NOTICE 'get_dynamic_ranking_by_highest_floor chamado: limit=%, filter=%', p_limit, p_status_filter;
    
    RETURN QUERY
    WITH best_characters AS (
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
END;
$$;

-- =====================================
-- 5. FUNÇÃO PARA MONITORAR ATUALIZAÇÕES DE RANKING
-- =====================================

CREATE OR REPLACE FUNCTION log_ranking_update()
RETURNS TRIGGER AS $$
BEGIN
    -- Log apenas mudanças significativas
    IF OLD.floor IS DISTINCT FROM NEW.floor OR 
       OLD.level IS DISTINCT FROM NEW.level OR 
       OLD.gold IS DISTINCT FROM NEW.gold THEN
        
        RAISE NOTICE 'Ranking Update: Player % (%) - Floor: % -> %, Level: % -> %, Gold: % -> %',
            NEW.name, NEW.id, 
            COALESCE(OLD.floor, 0), NEW.floor,
            COALESCE(OLD.level, 0), NEW.level,
            COALESCE(OLD.gold, 0), NEW.gold;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger para monitoramento (apenas em desenvolvimento)
DROP TRIGGER IF EXISTS log_ranking_updates ON characters;
CREATE TRIGGER log_ranking_updates
    AFTER UPDATE ON characters
    FOR EACH ROW
    EXECUTE FUNCTION log_ranking_update();

-- =====================================
-- 6. EXECUTAR CORREÇÕES AUTOMÁTICAS
-- =====================================

-- Executar verificação de integridade
DO $$
DECLARE
    integrity_result RECORD;
    fix_result TEXT;
BEGIN
    RAISE NOTICE 'Executando verificação de integridade dos dados...';
    
    -- Verificar integridade
    FOR integrity_result IN 
        SELECT * FROM check_ranking_data_integrity()
    LOOP
        RAISE NOTICE 'Check: % - Status: % - Count: % - Details: %', 
            integrity_result.check_name, 
            integrity_result.status, 
            integrity_result.count_affected, 
            integrity_result.details;
    END LOOP;
    
    -- Aplicar correções se necessário
    SELECT fix_ranking_data_issues() INTO fix_result;
    RAISE NOTICE 'Correções aplicadas: %', fix_result;
    
    RAISE NOTICE 'Verificação de integridade concluída!';
END;
$$;

-- =====================================
-- 7. COMENTÁRIOS E DOCUMENTAÇÃO FINAL
-- =====================================

COMMENT ON FUNCTION check_ranking_data_integrity IS 'Verifica a integridade dos dados do sistema de ranking';
COMMENT ON FUNCTION fix_ranking_data_issues IS 'Corrige automaticamente problemas comuns nos dados de ranking';
COMMENT ON FUNCTION log_ranking_update IS 'Registra atualizações importantes no ranking para debug';

-- =====================================
-- 8. ESTATÍSTICAS FINAIS
-- =====================================

DO $$
DECLARE
    total_chars INTEGER;
    chars_with_progress INTEGER;
    max_floor_reached INTEGER;
    total_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_chars FROM characters;
    SELECT COUNT(*) INTO chars_with_progress FROM characters WHERE floor > 1;
    SELECT MAX(floor) INTO max_floor_reached FROM characters;
    SELECT COUNT(DISTINCT user_id) INTO total_users FROM characters WHERE floor > 0;
    
    RAISE NOTICE '=== ESTATÍSTICAS DO SISTEMA DE RANKING ===';
    RAISE NOTICE 'Total de personagens: %', total_chars;
    RAISE NOTICE 'Personagens com progresso (floor > 1): %', chars_with_progress;
    RAISE NOTICE 'Andar mais alto alcançado: %', COALESCE(max_floor_reached, 0);
    RAISE NOTICE 'Total de usuários ativos: %', total_users;
    RAISE NOTICE '==========================================';
END;
$$;

-- Script concluído com sucesso!
-- O sistema de ranking está agora completamente funcional e otimizado 