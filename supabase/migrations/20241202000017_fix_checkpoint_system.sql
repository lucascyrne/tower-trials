-- Migração para corrigir sistema de checkpoints
-- Data: 2024-12-02
-- Move checkpoints para APÓS andares de boss para evitar exploits de farming

-- =====================================================
-- CORREÇÃO DO SISTEMA DE CHECKPOINTS
-- =====================================================

-- Atualizar função para obter checkpoints desbloqueados
-- Nova lógica: checkpoints em andares 1, 11, 21, 31, 41, etc.
-- Isso evita exploits de voltar para andares de boss (10, 20, 30, etc.)
CREATE OR REPLACE FUNCTION get_unlocked_checkpoints(p_highest_floor INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    description TEXT
) AS $$
BEGIN
    -- Sempre incluir o andar 1 (início da torre)
    RETURN QUERY
    SELECT 
        1 as floor_number,
        'Andar 1 - Início da Torre'::TEXT as description;
    
    -- Incluir checkpoints pós-boss: 11, 21, 31, 41, 51, etc.
    -- Só incluir se o jogador passou do boss correspondente
    RETURN QUERY
    SELECT 
        checkpoint_floor,
        'Andar ' || checkpoint_floor || ' - Checkpoint Pós-Boss'::TEXT as description
    FROM (
        SELECT (boss_floor + 1) as checkpoint_floor
        FROM generate_series(10, GREATEST(10, p_highest_floor - 1), 10) as boss_floor
        WHERE p_highest_floor > boss_floor -- Só se passou do boss
    ) checkpoints
    ORDER BY checkpoint_floor;
END;
$$ LANGUAGE plpgsql;

-- Atualizar função get_floor_data para refletir novos checkpoints
CREATE OR REPLACE FUNCTION get_floor_data(p_floor_number INTEGER)
RETURNS TABLE (
    floor_number INTEGER,
    type floor_type,
    is_checkpoint BOOLEAN,
    min_level INTEGER,
    description TEXT
) AS $$
DECLARE
    v_floor floors;
    v_floor_type floor_type;
    v_is_checkpoint BOOLEAN;
    v_min_level INTEGER;
    v_description TEXT;
BEGIN
    -- Tentar obter andar existente
    SELECT * INTO v_floor
    FROM floors f
    WHERE f.floor_number = p_floor_number;

    -- Se o andar não existe, gerar informações dinamicamente
    IF v_floor IS NULL THEN
        -- Definir tipo do andar
        v_floor_type := CASE 
            WHEN p_floor_number % 10 = 0 THEN 'boss'::floor_type
            WHEN p_floor_number % 5 = 0 THEN 'elite'::floor_type
            WHEN p_floor_number % 7 = 0 THEN 'event'::floor_type
            ELSE 'common'::floor_type
        END;
        
        -- Checkpoints são no andar 1 e pós-boss (11, 21, 31, etc.)
        v_is_checkpoint := (p_floor_number = 1) OR 
                          (p_floor_number > 10 AND (p_floor_number - 1) % 10 = 0);
        
        v_min_level := GREATEST(1, p_floor_number / 2);
        
        -- Descrições melhoradas
        v_description := CASE 
            WHEN p_floor_number = 1 THEN 'Entrada da Torre'
            WHEN p_floor_number % 10 = 0 THEN 'Covil do Chefe - Andar ' || p_floor_number
            WHEN p_floor_number % 5 = 0 THEN 'Domínio de Elite - Andar ' || p_floor_number
            WHEN p_floor_number % 7 = 0 THEN 'Câmara de Eventos - Andar ' || p_floor_number
            WHEN v_is_checkpoint THEN 'Santuário Seguro - Andar ' || p_floor_number
            ELSE 'Corredor Sombrio - Andar ' || p_floor_number
        END;
        
        RETURN QUERY
        SELECT 
            p_floor_number,
            v_floor_type,
            v_is_checkpoint,
            v_min_level,
            v_description;
    ELSE
        -- Retornar dados do andar existente, mas atualizar is_checkpoint
        v_is_checkpoint := (v_floor.floor_number = 1) OR 
                          (v_floor.floor_number > 10 AND (v_floor.floor_number - 1) % 10 = 0);
        
        RETURN QUERY
        SELECT 
            v_floor.floor_number,
            v_floor.type,
            v_is_checkpoint, -- Usar nova lógica
            v_floor.min_level,
            v_floor.description;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ATUALIZAR DADOS EXISTENTES
-- =====================================================

-- Atualizar a coluna is_checkpoint em floors existentes
UPDATE floors 
SET is_checkpoint = (
    floor_number = 1 OR 
    (floor_number > 10 AND (floor_number - 1) % 10 = 0)
);

-- =====================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- =====================================================

COMMENT ON FUNCTION get_unlocked_checkpoints(INTEGER) IS 
'Retorna checkpoints desbloqueados: andar 1 e pós-boss (11, 21, 31, etc.) para evitar exploits';

COMMENT ON FUNCTION get_floor_data(INTEGER) IS 
'Retorna dados do andar com sistema de checkpoints corrigido';

-- =====================================================
-- INSERIR ALGUNS ANDARES DE EXEMPLO (OPCIONAL)
-- =====================================================

-- Inserir andares específicos com descrições temáticas
INSERT INTO floors (floor_number, type, monster_pool, is_checkpoint, min_level, description) VALUES
(1, 'common', '{}', true, 1, 'Entrada da Torre - O Despertar'),
(10, 'boss', '{}', false, 5, 'Covil do Guardião Sombrio'),
(11, 'common', '{}', true, 6, 'Santuário da Primeira Vitória'),
(20, 'boss', '{}', false, 10, 'Trono do Senhor das Trevas'),
(21, 'common', '{}', true, 11, 'Refúgio dos Sobreviventes'),
(30, 'boss', '{}', false, 15, 'Arena do Devorador de Almas'),
(31, 'common', '{}', true, 16, 'Câmara da Redenção'),
(50, 'boss', '{}', false, 25, 'Palácio do Rei Demônio'),
(51, 'common', '{}', true, 26, 'Oásis da Esperança'),
(100, 'boss', '{}', false, 50, 'Cidadela do Lorde Supremo'),
(101, 'common', '{}', true, 51, 'Templo da Transcendência')
ON CONFLICT (floor_number) DO UPDATE SET
    is_checkpoint = EXCLUDED.is_checkpoint,
    description = EXCLUDED.description; 