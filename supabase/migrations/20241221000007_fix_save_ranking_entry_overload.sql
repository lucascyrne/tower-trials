-- =====================================
-- CORRIGIR CONFLITO DE OVERLOADING DA FUNÇÃO save_ranking_entry
-- Data: 2024-12-21
-- Versão: Definitiva
-- =====================================

-- Este sistema resolve:
-- 1. Remove TODAS as versões conflitantes da função save_ranking_entry
-- 2. Cria uma única versão definitiva sem ambiguidade
-- 3. Garante compatibilidade com o sistema de permadeath
-- 4. Mantém integração com o sistema híbrido de ranking

-- =====================================
-- 1. REMOVER TODAS AS VERSÕES CONFLITANTES
-- =====================================

-- Remover TODAS as versões da função save_ranking_entry
-- Isso elimina o conflito de overloading entre VARCHAR e TEXT
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, VARCHAR, INTEGER, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, TEXT, INTEGER, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, CHARACTER VARYING, INTEGER, INTEGER, INTEGER, BOOLEAN);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, VARCHAR(100), INTEGER, INTEGER, INTEGER, BOOLEAN);

-- Remover também possíveis versões com parâmetros diferentes
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, VARCHAR, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS save_ranking_entry(UUID, TEXT, INTEGER, INTEGER, INTEGER);

-- =====================================
-- 2. CRIAR FUNÇÃO DEFINITIVA ÚNICA
-- =====================================

-- Função única para salvar entrada no ranking
-- Compatível com sistema de permadeath e ranking híbrido
CREATE OR REPLACE FUNCTION save_ranking_entry(
    p_user_id UUID,
    p_player_name TEXT, -- Usando TEXT como tipo definitivo
    p_highest_floor INTEGER,
    p_character_level INTEGER DEFAULT 1,
    p_character_gold INTEGER DEFAULT 0,
    p_character_alive BOOLEAN DEFAULT true
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_ranking_id UUID;
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

    -- Log da operação
    RAISE NOTICE '[SAVE_RANKING] Salvando entrada: usuário=%, jogador=%, andar=%, nível=%, ouro=%, vivo=%', 
                 p_user_id, p_player_name, p_highest_floor, p_character_level, p_character_gold, p_character_alive;

    -- Para o sistema híbrido atual:
    -- - Personagens vivos: dados ficam apenas na tabela characters (tempo real)
    -- - Personagens mortos: dados são salvos na tabela game_rankings (histórico)
    
    IF NOT p_character_alive THEN
        -- Personagem morto: salvar no ranking histórico
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
            p_player_name,
            p_highest_floor,
            p_character_level,
            p_character_gold,
            false, -- sempre false para ranking histórico
            NOW()
        )
        RETURNING id INTO v_ranking_id;
        
        RAISE NOTICE '[SAVE_RANKING] Entrada histórica criada para personagem morto: % (ID: %)', p_player_name, v_ranking_id;
        
        RETURN 'historical_entry_created';
    ELSE
        -- Personagem vivo: no sistema atual os dados ficam apenas na tabela characters
        -- Esta função existe apenas para compatibilidade
        RAISE NOTICE '[SAVE_RANKING] Personagem vivo - dados mantidos apenas na tabela characters: %', p_player_name;
        
        RETURN 'live_character_no_action_needed';
    END IF;
END;
$$;

-- =====================================
-- 3. COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================

-- Adicionar comentário explicativo
COMMENT ON FUNCTION save_ranking_entry IS 
'Função única para salvar entradas no ranking. Para personagens vivos, dados ficam apenas na tabela characters (tempo real). Para personagens mortos, salva entrada histórica na tabela game_rankings. Compatível com sistema de permadeath e ranking híbrido.';

-- =====================================
-- 4. VERIFICAÇÃO DE INTEGRIDADE
-- =====================================

-- Verificar se a função foi criada corretamente
DO $$
DECLARE
    v_function_count INTEGER;
BEGIN
    -- Contar quantas funções save_ranking_entry existem agora
    SELECT COUNT(*) INTO v_function_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' 
      AND p.proname = 'save_ranking_entry';
    
    IF v_function_count = 1 THEN
        RAISE NOTICE '✓ Função save_ranking_entry única criada com sucesso';
    ELSIF v_function_count = 0 THEN
        RAISE EXCEPTION '✗ ERRO: Nenhuma função save_ranking_entry encontrada!';
    ELSE
        RAISE EXCEPTION '✗ ERRO: Ainda existem % funções save_ranking_entry (deve ser apenas 1)!', v_function_count;
    END IF;
END $$;

-- =====================================
-- 5. VALIDAÇÃO DA FUNÇÃO
-- =====================================

-- Verificar se a função está funcionando corretamente
-- (Testes com dados reais serão feitos no código da aplicação)
DO $$
BEGIN
    -- Verificar se a função existe e tem a assinatura correta
    IF EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND p.proname = 'save_ranking_entry'
          AND p.pronargs = 6  -- 6 parâmetros
    ) THEN
        RAISE NOTICE '✓ Função save_ranking_entry validada com sucesso';
    ELSE
        RAISE EXCEPTION '✗ Função save_ranking_entry não encontrada ou com assinatura incorreta';
    END IF;
END $$;

-- =====================================
-- 6. LOG DE CONCLUSÃO
-- =====================================

DO $$
BEGIN
    RAISE NOTICE '====================================';
    RAISE NOTICE 'CORREÇÃO DE OVERLOADING CONCLUÍDA';
    RAISE NOTICE 'Migração: 20241221000007';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Correções aplicadas:';
    RAISE NOTICE '✓ Todas as versões conflitantes removidas';
    RAISE NOTICE '✓ Função única save_ranking_entry criada';
    RAISE NOTICE '✓ Tipo TEXT padronizado para p_player_name';
    RAISE NOTICE '✓ Compatibilidade com permadeath mantida';
    RAISE NOTICE '✓ Sistema híbrido de ranking preservado';
    RAISE NOTICE '✓ Validações e logs implementados';
    RAISE NOTICE '✓ Validação da função executada com sucesso';
    RAISE NOTICE '====================================';
END $$; 