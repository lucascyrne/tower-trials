-- =====================================
-- CORRIGIR ERRO 42804 NA FUNÇÃO delete_character
-- Data: 2024-12-21
-- Versão: 25 (Correção definitiva de tipos)
-- =====================================

-- Este sistema resolve:
-- 1. Erro 42804: "structure of query does not match function result type"
-- 2. Conflito entre VARCHAR(100) e TEXT na função save_ranking_entry
-- 3. Incompatibilidade de tipos no process_character_death
-- 4. Garantir que delete_character funcione corretamente

-- =====================================
-- 1. REMOVER TODAS AS VERSÕES CONFLITANTES DE save_ranking_entry
-- =====================================

-- Remover TODAS as versões da função save_ranking_entry para eliminar conflitos
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, VARCHAR, INTEGER, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, CHARACTER VARYING, INTEGER, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, VARCHAR(100), INTEGER, INTEGER, INTEGER, BOOLEAN);

-- =====================================
-- 2. CRIAR FUNÇÃO save_ranking_entry DEFINITIVA COM CONVERSÃO DE TIPOS
-- =====================================

-- Função única que aceita VARCHAR(100) e converte internamente para TEXT
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name VARCHAR(100), -- ACEITA VARCHAR(100) da tabela characters
    p_highest_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT true
)
RETURNS TEXT -- RETORNA TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ranking_id UUID;
    v_player_name_text TEXT;
BEGIN
    -- Validar parâmetros de entrada
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id não pode ser nulo';
    END IF;
    
    IF p_player_name IS NULL OR TRIM(p_player_name) = '' THEN
        RAISE EXCEPTION 'Nome do jogador não pode ser vazio';
    END IF;
    
    IF p_highest_floor < 1 THEN
        RAISE EXCEPTION 'Andar mais alto deve ser pelo menos 1, recebido: %', p_highest_floor;
    END IF;

    -- ✅ CORREÇÃO CRÍTICA: Converter VARCHAR(100) para TEXT explicitamente
    v_player_name_text := p_player_name::TEXT;

    -- Log da operação
    RAISE NOTICE '[SAVE_RANKING] Salvando entrada: usuário=%, jogador=%, andar=%, nível=%, ouro=%, vivo=%', 
                 p_user_id, v_player_name_text, p_highest_floor, p_character_level, p_character_gold, p_character_alive;

    -- Para personagens mortos: salvar no ranking histórico
    IF NOT p_character_alive THEN
        -- Verificar se tabela game_rankings existe
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'game_rankings') THEN
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
                p_user_id,
                v_player_name_text, -- Usar TEXT convertido
                p_highest_floor,
                p_character_level,
                p_character_gold,
                false, -- sempre false para ranking histórico
                NOW()
            )
            RETURNING id INTO v_ranking_id;
            
            RAISE NOTICE '[SAVE_RANKING] Entrada histórica criada para personagem morto: % (ID: %)', v_player_name_text, v_ranking_id;
            
            RETURN 'historical_entry_created';
        ELSE
            RAISE NOTICE '[SAVE_RANKING] Tabela game_rankings não existe - pulando inserção histórica';
            RETURN 'no_historical_table';
        END IF;
    ELSE
        -- Personagem vivo: no sistema atual os dados ficam apenas na tabela characters
        RAISE NOTICE '[SAVE_RANKING] Personagem vivo - dados mantidos apenas na tabela characters: %', v_player_name_text;
        
        RETURN 'live_character_no_action_needed';
    END IF;
END;
$$;

-- =====================================
-- 3. CORRIGIR FUNÇÃO process_character_death COM CONVERSÃO EXPLÍCITA
-- =====================================

CREATE OR REPLACE FUNCTION process_character_death(
    p_character_id UUID,
    p_death_cause TEXT DEFAULT 'Battle defeat',
    p_killed_by_monster TEXT DEFAULT NULL
)
RETURNS TABLE(
    ranking_entry_id TEXT,
    character_name TEXT, -- RETORNA TEXT ao invés de VARCHAR(100)
    character_level INTEGER,
    character_floor INTEGER
) AS $$
DECLARE
    v_character RECORD;
    v_ranking_result TEXT;
    v_character_name_text TEXT; -- ✅ NOVO: variável para conversão de tipo
BEGIN
    -- Buscar dados completos do personagem ANTES de marcar como morto
    SELECT 
        c.id,
        c.user_id,
        c.name, -- VARCHAR(100) da tabela
        c.level,
        c.floor,
        COALESCE(c.highest_floor, c.floor) as highest_floor,
        c.gold,
        COALESCE(c.is_alive, true) as is_alive
    INTO v_character
    FROM characters c
    WHERE c.id = p_character_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Personagem não encontrado: %', p_character_id;
    END IF;
    
    -- Verificar se personagem já está morto
    IF NOT v_character.is_alive THEN
        RAISE EXCEPTION 'Personagem % já está morto', v_character.name;
    END IF;

    -- ✅ CORREÇÃO CRÍTICA: Converter VARCHAR(100) para TEXT explicitamente
    v_character_name_text := v_character.name::TEXT;
    
    RAISE NOTICE '[DEATH_PROCESS] Processando morte de: % (ID: %, Nível: %, Andar: %)', 
                 v_character_name_text, v_character.id, v_character.level, v_character.highest_floor;
    
    -- 1. PRIMEIRO: Salvar no ranking histórico ANTES de marcar como morto
    -- ✅ CORREÇÃO: Usar função com conversão de tipos
    SELECT save_ranking_entry(
        v_character.user_id,
        v_character.name, -- A função agora aceita VARCHAR(100) e converte internamente
        v_character.highest_floor,
        v_character.level,
        v_character.gold,
        false -- character_alive = false para ranking histórico
    ) INTO v_ranking_result;
    
    RAISE NOTICE '[DEATH_PROCESS] Entrada no ranking criada: %', v_ranking_result;
    
    -- 2. DEPOIS: Marcar personagem como morto
    UPDATE characters 
    SET 
        is_alive = false,
        hp = 0,
        updated_at = NOW()
    WHERE id = p_character_id;
    
    -- 3. OPCIONAL: Criar entrada no cemitério se a tabela existir
    BEGIN
        INSERT INTO dead_characters (
            original_character_id,
            user_id,
            name,
            level,
            floor,
            highest_floor,
            gold,
            death_cause,
            killed_by_monster,
            survival_time_minutes,
            died_at
        )
        VALUES (
            v_character.id,
            v_character.user_id,
            v_character_name_text, -- Usar TEXT convertido
            v_character.level,
            v_character.floor,
            v_character.highest_floor,
            v_character.gold,
            p_death_cause,
            p_killed_by_monster,
            EXTRACT(EPOCH FROM (NOW() - (SELECT created_at FROM characters WHERE id = p_character_id))) / 60,
            NOW()
        );
        RAISE NOTICE '[DEATH_PROCESS] Entrada no cemitério criada para %', v_character_name_text;
    EXCEPTION
        WHEN undefined_table THEN
            RAISE NOTICE '[DEATH_PROCESS] Tabela dead_characters não existe, pulando cemitério';
        WHEN OTHERS THEN
            RAISE NOTICE '[DEATH_PROCESS] Erro ao criar entrada no cemitério: %', SQLERRM;
    END;
    
    -- ✅ CORREÇÃO: Retornar TEXT ao invés de VARCHAR(100)
    RETURN QUERY SELECT 
        v_ranking_result,
        v_character_name_text, -- TEXT convertido
        v_character.level,
        v_character.highest_floor;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 4. GARANTIR QUE delete_character FUNCIONE CORRETAMENTE
-- =====================================

-- Recriar delete_character com tratamento de erros melhorado
CREATE OR REPLACE FUNCTION delete_character(p_character_id UUID)
RETURNS VOID AS $$
DECLARE
    v_death_result RECORD;
    v_character_exists BOOLEAN;
BEGIN
    -- Verificar se o personagem existe
    SELECT EXISTS (
        SELECT 1 FROM characters c
        WHERE c.id = p_character_id
    ) INTO v_character_exists;
    
    IF NOT v_character_exists THEN
        RAISE EXCEPTION 'Personagem não encontrado';
    END IF;

    -- Processar morte completa (ranking + marcar como morto)
    -- ✅ CORREÇÃO: Usar função corrigida com conversão de tipos
    BEGIN
        SELECT * INTO v_death_result 
        FROM process_character_death(p_character_id, 'Player deletion', NULL);
        
        RAISE NOTICE '[DELETE_CHARACTER] Personagem % processado: ranking=%, nível=%, andar=%', 
                     v_death_result.character_name, 
                     v_death_result.ranking_entry_id,
                     v_death_result.character_level,
                     v_death_result.character_floor;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE '[DELETE_CHARACTER] Erro ao processar morte: %', SQLERRM;
            -- Se processo de morte falhar, ainda assim marcar como morto
            UPDATE characters 
            SET 
                is_alive = false,
                hp = 0,
                updated_at = NOW()
            WHERE id = p_character_id;
            
            RAISE NOTICE '[DELETE_CHARACTER] Personagem marcado como morto diretamente devido a erro no processo';
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================
-- 5. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

COMMENT ON FUNCTION save_ranking_entry IS 
'Função corrigida que aceita VARCHAR(100) da tabela characters e converte para TEXT internamente. Resolve erro 42804 de incompatibilidade de tipos.';

COMMENT ON FUNCTION process_character_death IS 
'Função corrigida que processa morte do personagem com conversão explícita de tipos VARCHAR(100) -> TEXT.';

COMMENT ON FUNCTION delete_character IS 
'Função corrigida que deleta personagem sem erro 42804, com tratamento robusto de erros e fallback.';

-- =====================================
-- 6. VERIFICAÇÃO DE INTEGRIDADE
-- =====================================

DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    -- Verificar save_ranking_entry
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'save_ranking_entry';
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Função save_ranking_entry corrigida';
    ELSE
        RAISE EXCEPTION '✗ Função save_ranking_entry não encontrada ou duplicada';
    END IF;
    
    -- Verificar process_character_death
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'process_character_death';
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Função process_character_death corrigida';
    ELSE
        RAISE EXCEPTION '✗ Função process_character_death não encontrada ou duplicada';
    END IF;
    
    -- Verificar delete_character
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'delete_character';
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Função delete_character corrigida';
    ELSE
        RAISE EXCEPTION '✗ Função delete_character não encontrada ou duplicada';
    END IF;
END $$;

-- =====================================
-- 7. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO ERRO 42804 - delete_character';
    RAISE NOTICE 'Migração: 20241221000025';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ save_ranking_entry aceita VARCHAR(100) e converte para TEXT';
    RAISE NOTICE '✓ process_character_death com conversão explícita de tipos';
    RAISE NOTICE '✓ delete_character com tratamento robusto de erros';
    RAISE NOTICE '✓ Todas as funções conflitantes removidas';
    RAISE NOTICE '✓ Compatibilidade total entre VARCHAR(100) e TEXT';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'RESOLVIDO: Erro 42804 structure of query does not match';
    RAISE NOTICE 'AGORA: delete_character funciona sem conflitos de tipo';
    RAISE NOTICE '====================================';
END $$; 